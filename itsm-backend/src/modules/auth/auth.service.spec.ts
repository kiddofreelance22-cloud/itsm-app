import { ForbiddenException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Repository } from "typeorm";
import { User } from "../users/entities/user.entity";
import { RolesService } from "../roles/roles.service";
import { DirectoryService } from "../itsm-config/directory.service";
import { UserImpersonation } from "./entities/user-impersonation.entity";
import { AuthService } from "./auth.service";

describe("AuthService support sessions", () => {
  const setup = () => {
    const users = { findOne: jest.fn() } as unknown as jest.Mocked<Repository<User>>;
    const sessions = {
      create: jest.fn((row) => row),
      findOne: jest.fn(),
      save: jest.fn(async (row) => row),
    } as unknown as jest.Mocked<Repository<UserImpersonation>>;
    const roles = {
      getRoleNamesForUser: jest.fn(),
      getPermissionsForUser: jest.fn(),
    } as unknown as jest.Mocked<RolesService>;
    const jwt = { sign: jest.fn() } as unknown as jest.Mocked<JwtService>;
    const directory = {} as DirectoryService;
    return { service: new AuthService(users, sessions, roles, jwt, directory), users, sessions, roles, jwt };
  };

  it("only lets a non-impersonated administrator start a support session", async () => {
    const { service, users } = setup();
    await expect(service.switchUser({ userId: 4, roles: ["IT Agent"] }, 8)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.switchUser({ userId: 4, roles: ["Admin"], impersonatedBy: { userId: 2 } }, 8)).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it("issues a short-lived target-role token and records the administrator session", async () => {
    const { service, users, sessions, roles, jwt } = setup();
    users.findOne
      .mockResolvedValueOnce({ userId: 4, fullName: "Support Admin", isActive: true } as User)
      .mockResolvedValueOnce({ userId: 8, username: "user8", email: "user8@example.com", fullName: "End User", isActive: true } as User);
    roles.getRoleNamesForUser.mockResolvedValue(["End User"]);
    roles.getPermissionsForUser.mockResolvedValue(["ticket.read"]);
    jwt.sign.mockReturnValue("support-token");

    const result = await service.switchUser({ userId: 4, roles: ["Admin"] }, 8, "127.0.0.1", "test-agent");

    expect(result.accessToken).toBe("support-token");
    expect(result.user).toMatchObject({ userId: 8, fullName: "End User", impersonatedBy: { userId: 4, fullName: "Support Admin" } });
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({
      sub: 8,
      roles: ["End User"],
      impersonatedBy: { userId: 4, fullName: "Support Admin" },
      impersonationId: result.impersonationId,
    }), { expiresIn: 1800 });
    expect(sessions.save).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 4,
      targetUserId: 8,
      sessionId: result.impersonationId,
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    }));
  });

  it("only lets the original administrator close their audited session", async () => {
    const { service, sessions } = setup();
    sessions.findOne.mockResolvedValue({
      sessionId: "session-id",
      actorUserId: 4,
      targetUserId: 8,
      endedAt: null,
    } as UserImpersonation);

    await expect(service.endImpersonation(5, "session-id")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.endImpersonation(4, "session-id")).resolves.toBeUndefined();
    expect(sessions.save).toHaveBeenCalledWith(expect.objectContaining({ endedAt: expect.any(Date) }));
  });
});
