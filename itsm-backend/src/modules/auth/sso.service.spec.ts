import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Repository } from "typeorm";
import { Role } from "../roles/entities/role.entity";
import { UserRole } from "../roles/entities/user-role.entity";
import { User } from "../users/entities/user.entity";
import { AuthService } from "./auth.service";
import { UserIdentity } from "./entities/user-identity.entity";
import { SsoFlowError, SsoService } from "./sso.service";

describe("SsoService.resolveUser", () => {
  const activeUser = (userId = 7, email = "person@example.com") =>
    Object.assign(new User(), {
      userId,
      username: "person",
      email,
      fullName: "Example Person",
      isActive: true,
    });

  function createHarness(options: {
    settings?: Record<string, unknown>;
    identity?: UserIdentity | null;
    emailUser?: User | null;
  } = {}) {
    const userQuery = {
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(options.emailUser ?? null),
    };
    const users = {
      createQueryBuilder: jest.fn().mockReturnValue(userQuery),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value: Partial<User>) => Object.assign(new User(), value)),
      save: jest.fn(async (value: User) =>
        Object.assign(value, { userId: value.userId || 9 }),
      ),
    };
    const identities = {
      findOne: jest.fn().mockResolvedValue(options.identity ?? null),
      create: jest.fn((value: Partial<UserIdentity>) =>
        Object.assign(new UserIdentity(), value),
      ),
      save: jest.fn(async (value: UserIdentity) => value),
    };
    const role = Object.assign(new Role(), { roleId: 3, isActive: true });
    const roles = { findOne: jest.fn().mockResolvedValue(role) };
    const userRoles = {
      create: jest.fn((value: Partial<UserRole>) =>
        Object.assign(new UserRole(), value),
      ),
      save: jest.fn(async (value: UserRole) => value),
    };
    const auth = {
      hashPassword: jest.fn().mockResolvedValue("unusable-random-password-hash"),
    };
    const configValues = {
      "sso.microsoft.tenantId": "tenant-id",
      "sso.allowedDomains": "",
      "sso.autoProvision": false,
      "sso.defaultRoleId": 3,
      ...options.settings,
    };
    const config = {
      get: jest.fn((key: string) => configValues[key]),
    };
    const service = new SsoService(
      users as unknown as Repository<User>,
      identities as unknown as Repository<UserIdentity>,
      roles as unknown as Repository<Role>,
      userRoles as unknown as Repository<UserRole>,
      auth as unknown as AuthService,
      {} as JwtService,
      config as unknown as ConfigService,
    );

    return { service, users, identities, roles, userRoles, auth, userQuery };
  }

  it("uses an existing provider subject before attempting email matching", async () => {
    const user = activeUser();
    const identity = Object.assign(new UserIdentity(), { user, email: user.email });
    const { service, identities, users } = createHarness({ identity });

    await expect(
      service.resolveUser("google", {
        sub: "google-subject",
        email: user.email,
        email_verified: true,
      }),
    ).resolves.toBe(user);

    expect(identities.findOne).toHaveBeenCalledWith({
      where: { provider: "google", subject: "google-subject" },
      relations: { user: true },
    });
    expect(users.createQueryBuilder).not.toHaveBeenCalled();
    expect(identities.save).toHaveBeenCalled();
  });

  it("links a provider subject to an existing account with a case-insensitive email match", async () => {
    const user = activeUser();
    const { service, identities, userQuery } = createHarness({ emailUser: user });

    await expect(
      service.resolveUser("google", {
        sub: "google-subject",
        email: "PERSON@EXAMPLE.COM",
        email_verified: true,
      }),
    ).resolves.toBe(user);

    expect(userQuery.where).toHaveBeenCalledWith(
      "LOWER(user.email) = LOWER(:email)",
      { email: "person@example.com" },
    );
    expect(identities.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        provider: "google",
        subject: "google-subject",
        email: "person@example.com",
      }),
    );
  });

  it("rejects an inactive user found by email", async () => {
    const user = Object.assign(activeUser(), { isActive: false });
    const { service } = createHarness({ emailUser: user });

    await expect(
      service.resolveUser("google", {
        sub: "google-subject",
        email: user.email,
        email_verified: true,
      }),
    ).rejects.toMatchObject({ code: "sso_user_inactive" });
  });

  it("rejects an email outside the configured domain allowlist", async () => {
    const { service, identities } = createHarness({
      settings: { "sso.allowedDomains": "example.org, example.net" },
    });

    await expect(
      service.resolveUser("google", {
        sub: "google-subject",
        email: "person@example.com",
        email_verified: true,
      }),
    ).rejects.toMatchObject({ code: "sso_domain_not_allowed" });
    expect(identities.findOne).not.toHaveBeenCalled();
  });

  it("auto-provisions an unknown user with the configured default role when enabled", async () => {
    const { service, users, userRoles } = createHarness({
      settings: { "sso.autoProvision": true },
    });

    await expect(
      service.resolveUser("google", {
        sub: "google-subject",
        email: "person@example.com",
        email_verified: true,
        name: "Example Person",
      }),
    ).resolves.toMatchObject({
      userId: 9,
      email: "person@example.com",
      authType: "OAuth",
      ssoEnabled: true,
    });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "person@example.com",
        passwordHash: "unusable-random-password-hash",
      }),
    );
    expect(userRoles.save).toHaveBeenCalled();
  });

  it("rejects an unknown user when auto-provisioning is disabled", async () => {
    const { service, roles } = createHarness();

    await expect(
      service.resolveUser("google", {
        sub: "google-subject",
        email: "person@example.com",
        email_verified: true,
      }),
    ).rejects.toMatchObject({ code: "sso_user_not_found" });
    expect(roles.findOne).not.toHaveBeenCalled();
  });

  it("rejects Microsoft tokens from a different tenant", async () => {
    const { service, identities } = createHarness();

    await expect(
      service.resolveUser("microsoft", {
        oid: "microsoft-object-id",
        tid: "another-tenant",
        email: "person@example.com",
      }),
    ).rejects.toMatchObject({
      code: "sso_failed",
      constructor: SsoFlowError,
    });
    expect(identities.findOne).not.toHaveBeenCalled();
  });

  it("rejects Google identities without verified email", async () => {
    const { service, identities } = createHarness();

    await expect(
      service.resolveUser("google", {
        sub: "google-subject",
        email: "person@example.com",
        email_verified: false,
      }),
    ).rejects.toMatchObject({ code: "sso_email_unverified" });
    expect(identities.findOne).not.toHaveBeenCalled();
  });
});