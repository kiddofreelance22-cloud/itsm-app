import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { generators, Issuer } from "openid-client";
import type { CallbackParamsType, Client } from "openid-client";
import { randomBytes } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { Repository } from "typeorm";
import { Role } from "../roles/entities/role.entity";
import { UserRole } from "../roles/entities/user-role.entity";
import { User } from "../users/entities/user.entity";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { UserIdentity, SsoProvider } from "./entities/user-identity.entity";
import { AuthService } from "./auth.service";

type SsoErrorCode =
  | "sso_failed"
  | "sso_user_not_found"
  | "sso_user_inactive"
  | "sso_domain_not_allowed"
  | "sso_email_unverified";

interface SsoCookie {
  provider: SsoProvider;
  state: string;
  nonce: string;
  codeVerifier: string;
}

interface PendingCode {
  expiresAt: number;
  response: AuthResponseDto;
}

export class SsoFlowError extends Error {
  constructor(
    readonly code: SsoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SsoFlowError";
  }
}

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const safeErrorDetail = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "unknown";
  }
  return error.message
    .replace(
      /\b(access_token|id_token|refresh_token|client_secret|code_verifier|authorization|code|state|nonce)\b\s*[:=]\s*["']?[^,\s"'&]+/gi,
      "$1=[redacted]",
    )
    .replace(/([?&](?:code|state|nonce|client_secret|access_token|id_token)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\beyJ[\w-]*\.[\w-]+\.[\w-]+\b/g, "[redacted-token]");
};

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  private readonly clients = new Map<SsoProvider, Client>();
  private readonly codes = new Map<string, PendingCode>();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserIdentity)
    private readonly identities: Repository<UserIdentity>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  providers(): SsoProvider[] {
    const enabled: SsoProvider[] = [];
    if (
      this.config.get<string>("sso.google.clientId") &&
      this.config.get<string>("sso.google.clientSecret")
    ) {
      enabled.push("google");
    }
    if (
      this.config.get<string>("sso.microsoft.clientId") &&
      this.config.get<string>("sso.microsoft.clientSecret") &&
      this.config.get<string>("sso.microsoft.tenantId")
    ) {
      enabled.push("microsoft");
    }
    return enabled;
  }

  frontendUrl(): string {
    return (this.config.get<string>("sso.frontendUrl") || "http://localhost:3000")
      .replace(/\/+$/, "");
  }

  secureCookie(): boolean {
    return (this.config.get<string>("sso.backendUrl") || "").startsWith("https://");
  }

  cookieName(provider: SsoProvider): string {
    return `itsm_sso_${provider}`;
  }

  async start(provider: SsoProvider): Promise<{ url: string; cookie: string }> {
    this.requireEnabled(provider);
    const client = await this.getClient(provider);
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const cookie = await this.jwt.signAsync(
      { provider, state, nonce, codeVerifier },
      {
        secret: this.cookieSecret(),
        expiresIn: "10m",
        algorithm: "HS256",
      },
    );

    return {
      url: client.authorizationUrl({
        scope: "openid email profile",
        redirect_uri: this.redirectUri(provider),
        response_type: "code",
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }),
      cookie,
    };
  }

  async callback(
    provider: SsoProvider,
    params: CallbackParamsType,
    cookie: string | undefined,
  ): Promise<string> {
    try {
      if (!cookie) {
        throw new SsoFlowError("sso_failed", "The sign-in attempt could not be verified.");
      }

      const state = await this.jwt.verifyAsync<SsoCookie>(cookie, {
        secret: this.cookieSecret(),
        algorithms: ["HS256"],
      });
      if (
        state.provider !== provider ||
        typeof state.state !== "string" ||
        typeof state.nonce !== "string" ||
        typeof state.codeVerifier !== "string"
      ) {
        throw new SsoFlowError("sso_failed", "The sign-in attempt could not be verified.");
      }

      const client = await this.getClient(provider);
      const tokenSet = await client.callback(
        this.redirectUri(provider),
        params,
        {
          state: state.state,
          nonce: state.nonce,
          code_verifier: state.codeVerifier,
        },
      );
      const user = await this.resolveUser(provider, tokenSet.claims());
      const { passwordHash: _passwordHash, ...safeUser } = user;
      const response = await this.auth.login(safeUser);
      const code = randomBytes(32).toString("hex");
      this.sweepCodes();
      this.codes.set(code, { expiresAt: Date.now() + 60_000, response });
      this.logger.log(`SSO login success provider=${provider} userId=${user.userId}`);
      return code;
    } catch (error) {
      const code =
        error instanceof SsoFlowError ? error.code : "sso_failed";
      const failureType = error instanceof Error ? error.name : "unknown";
      this.logger.warn(
        `SSO login failure provider=${provider} code=${code} type=${failureType} detail=${safeErrorDetail(error)}`,
      );
      if (error instanceof SsoFlowError) {
        throw error;
      }
      throw new SsoFlowError("sso_failed", "Single sign-on could not be completed.");
    }
  }

  async resolveUser(
    provider: SsoProvider,
    claims: Record<string, unknown>,
  ): Promise<User> {
    const tenantId = this.config.get<string>("sso.microsoft.tenantId");
    if (
      provider === "microsoft" &&
      (typeof claims.tid !== "string" ||
        claims.tid.toLowerCase() !== (tenantId || "").toLowerCase())
    ) {
      throw new SsoFlowError("sso_failed", "The Microsoft tenant could not be verified.");
    }

    if (provider === "google" && claims.email_verified !== true) {
      throw new SsoFlowError(
        "sso_email_unverified",
        "The Google account's email address is not verified.",
      );
    }

    const subjectValue =
      provider === "microsoft" ? claims.oid || claims.sub : claims.sub;
    const subject =
      typeof subjectValue === "string" ? subjectValue.trim() : "";
    if (!subject) {
      throw new SsoFlowError("sso_failed", "The identity provider returned no subject.");
    }

    const providerEmail =
      typeof claims.email === "string" ? claims.email.trim() : "";
    const preferredUsername =
      provider === "microsoft" && typeof claims.preferred_username === "string"
        ? claims.preferred_username.trim()
        : "";
    const email = (
      isValidEmail(providerEmail)
        ? providerEmail
        : isValidEmail(preferredUsername)
          ? preferredUsername
          : ""
    ).toLowerCase();
    if (!email) {
      throw new SsoFlowError("sso_failed", "The identity provider returned no valid email.");
    }

    const allowedDomains = (this.config.get<string>("sso.allowedDomains") || "")
      .split(",")
      .map((domain) => domain.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean);
    const domain = email.split("@")[1];
    if (allowedDomains.length && !allowedDomains.includes(domain)) {
      throw new SsoFlowError(
        "sso_domain_not_allowed",
        "This email domain is not allowed to sign in.",
      );
    }

    const identity = await this.identities.findOne({
      where: { provider, subject },
      relations: { user: true },
    });
    if (identity) {
      if (!identity.user || !identity.user.isActive) {
        throw new SsoFlowError("sso_user_inactive", "The linked account is inactive.");
      }
      identity.email = email;
      identity.lastLoginAt = new Date();
      await this.identities.save(identity);
      return identity.user;
    }

    let user = await this.users
      .createQueryBuilder("user")
      .where("LOWER(user.email) = LOWER(:email)", { email })
      .getOne();
    if (user && !user.isActive) {
      throw new SsoFlowError("sso_user_inactive", "The account is inactive.");
    }

    if (!user) {
      if (!this.config.get<boolean>("sso.autoProvision", false)) {
        throw new SsoFlowError(
          "sso_user_not_found",
          "No account is linked to this email address.",
        );
      }
      user = await this.provisionUser(email, claims);
    }

    await this.identities.save(
      this.identities.create({
        user,
        provider,
        subject,
        email,
        lastLoginAt: new Date(),
      }),
    );
    return user;
  }

  exchange(code: string): AuthResponseDto {
    this.sweepCodes();
    const pending = this.codes.get(code);
    this.codes.delete(code);
    if (!pending || pending.expiresAt <= Date.now()) {
      this.logger.warn("SSO code exchange failure code=sso_failed");
      throw new SsoFlowError("sso_failed", "The sign-in code is invalid or expired.");
    }
    return pending.response;
  }

  logFailure(provider: string, code: SsoErrorCode = "sso_failed"): void {
    this.logger.warn(`SSO login failure provider=${provider} code=${code}`);
  }

  errorCode(error: unknown): SsoErrorCode {
    return error instanceof SsoFlowError ? error.code : "sso_failed";
  }

  private async provisionUser(
    email: string,
    claims: Record<string, unknown>,
  ): Promise<User> {
    const roleId = this.config.get<number>("sso.defaultRoleId");
    if (!roleId) {
      throw new SsoFlowError("sso_failed", "SSO default role is not configured.");
    }
    const role = await this.roles.findOne({
      where: { roleId, isActive: true },
    });
    if (!role) {
      throw new SsoFlowError("sso_failed", "SSO default role is unavailable.");
    }

    const baseUsername =
      email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "") || "sso-user";
    let username = baseUsername;
    while (await this.users.findOne({ where: { username } })) {
      username = `${baseUsername}-${randomBytes(4).toString("hex")}`;
    }

    const fullName =
      typeof claims.name === "string" && claims.name.trim()
        ? claims.name.trim()
        : email;
    const user = await this.users.save(
      this.users.create({
        username,
        email,
        fullName,
        passwordHash: await this.auth.hashPassword(randomBytes(32).toString("hex")),
        isActive: true,
        authType: "OAuth",
        ssoEnabled: true,
        primaryRole: role,
      }),
    );
    await this.userRoles.save(this.userRoles.create({ user, role }));
    return user;
  }

  private requireEnabled(provider: SsoProvider): void {
    if (!this.providers().includes(provider)) {
      throw new SsoFlowError("sso_failed", "This sign-in provider is not configured.");
    }
  }

  private async getClient(provider: SsoProvider): Promise<Client> {
    const cached = this.clients.get(provider);
    if (cached) {
      return cached;
    }

    const issuerUrl =
      provider === "google"
        ? "https://accounts.google.com"
        : `https://login.microsoftonline.com/${encodeURIComponent(
            this.config.get<string>("sso.microsoft.tenantId") || "",
          )}/v2.0`;
    const issuer = await Issuer.discover(issuerUrl);
    const client = new issuer.Client({
      client_id: this.config.get<string>(`sso.${provider}.clientId`) || "",
      client_secret: this.config.get<string>(`sso.${provider}.clientSecret`) || "",
      redirect_uris: [this.redirectUri(provider)],
      response_types: ["code"],
    });
    this.clients.set(provider, client);
    return client;
  }

  private redirectUri(provider: SsoProvider): string {
    const backendUrl = this.config.get<string>("sso.backendUrl");
    if (!backendUrl) {
      throw new SsoFlowError("sso_failed", "SSO_BACKEND_URL is not configured.");
    }
    return `${backendUrl.replace(/\/+$/, "")}/auth/${provider}/callback`;
  }

  private cookieSecret(): string {
    const jwtSecret = this.config.get<string>("jwt.secret");
    if (!jwtSecret) {
      throw new SsoFlowError("sso_failed", "JWT_SECRET is not configured.");
    }
    return `${jwtSecret}:sso-state`;
  }

  private sweepCodes(): void {
    const now = Date.now();
    for (const [code, pending] of this.codes) {
      if (pending.expiresAt <= now) {
        this.codes.delete(code);
      }
    }
  }
}
