import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { createPublicKey, randomBytes } from "crypto";
import * as jwt from "jsonwebtoken";
import { User } from "../users/entities/user.entity";
import { DirectoryService } from "../itsm-config/directory.service";
import { AuthService } from "./auth.service";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const authority = () => (process.env.AZURE_AUTHORITY_HOST || "https://login.microsoftonline.com").replace(/\/+$/, "");
const stateSecret = () => {
  const s = process.env.JWT_SECRET; if (!s) throw new Error("JWT_SECRET is required for SSO.");
  return `sso-state:${s}`;                       // distinct from the app's access-token secret
};

interface Pending { exp: number; auth: unknown }

/** Authorization-code sign-in with Microsoft Entra ID / Azure AD. */
@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  private readonly codes = new Map<string, Pending>();
  private jwks: { at: number; tenant: string; keys: any[] } | null = null;

  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private directory: DirectoryService,
    private auth: AuthService,
  ) {}

  async isEnabled(): Promise<boolean> { return !!(await this.directory.getAzureSso()); }

  /** Returns the Microsoft authorize URL plus the browser-binding nonce to put in a cookie. */
  async start(): Promise<{ url: string; cookieNonce: string }> {
    const cfg = await this.directory.getAzureSso();
    if (!cfg) throw new BadRequestException("Microsoft sign-in is not configured.");
    if (/^(common|organizations|consumers)$/i.test(cfg.tenantId)) throw new BadRequestException("A specific tenant is required; 'common' is not allowed.");
    const cookieNonce = randomBytes(16).toString("hex");
    const oidcNonce = randomBytes(16).toString("hex");
    const state = jwt.sign({ n: cookieNonce, on: oidcNonce, k: "sso" }, stateSecret(), { expiresIn: "10m" });
    const q = new URLSearchParams({
      client_id: cfg.clientId, response_type: "code", redirect_uri: cfg.redirectUri, response_mode: "query",
      scope: "openid profile email", state, nonce: oidcNonce, prompt: "select_account",
    });
    return { url: `${authority()}/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/authorize?${q}`, cookieNonce };
  }

  /** Completes the flow and returns a one-time code the SPA exchanges for the app's JWT. Throws a user-safe message on failure. */
  async callback(code: string, state: string, cookieNonce: string | undefined): Promise<string> {
    const cfg = await this.directory.getAzureSso();
    if (!cfg) throw new BadRequestException("Microsoft sign-in is not configured.");
    let st: any;
    try { st = jwt.verify(state, stateSecret(), { algorithms: ["HS256"] }); } catch { throw new UnauthorizedException("The sign-in attempt expired. Please try again."); }
    if (st.k !== "sso" || !cookieNonce || st.n !== cookieNonce) throw new UnauthorizedException("This sign-in did not start in your browser. Please try again.");

    const res = await fetch(`${authority()}/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri, scope: "openid profile email" }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.id_token) { this.logger.warn(`SSO token exchange failed: ${body.error ?? res.status}`); throw new UnauthorizedException("Microsoft did not accept the sign-in. Please try again."); }

    const claims = await this.verifyIdToken(body.id_token, cfg.tenantId, cfg.clientId);
    if (claims.nonce !== st.on) throw new UnauthorizedException("Sign-in could not be verified (nonce mismatch).");

    const email = String(claims.email || claims.preferred_username || claims.upn || "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new UnauthorizedException("Your Microsoft account has no e-mail address we can use.");
    if (cfg.allowedDomains.length && !cfg.allowedDomains.includes(email.split("@")[1])) {
      throw new UnauthorizedException(`Sign-ins from ${email.split("@")[1]} are not allowed here.`);
    }

    let user = await this.users.findOne({ where: { email } });
    if (user && !user.isActive) throw new UnauthorizedException("Your account is disabled. Contact your administrator.");
    if (!user) {
      if (!cfg.autoCreateUsers) throw new UnauthorizedException("You don't have an account here yet. Contact your administrator.");
      user = await this.directory.provisionUser({ email, fullName: String(claims.name || email), authType: "OAuth", defaultRole: cfg.defaultRole, ssoEnabled: true });
    }
    const { passwordHash, ...safe } = user;
    const authResponse = await this.auth.login(safe as any);
    const oneTime = randomBytes(24).toString("hex");
    this.sweep();
    this.codes.set(oneTime, { exp: Date.now() + 60_000, auth: authResponse });
    return oneTime;
  }

  /** Single-use: the code is deleted the moment it's presented. */
  exchange(code: string): unknown {
    this.sweep();
    const p = this.codes.get(code);
    this.codes.delete(code);
    if (!p || p.exp < Date.now()) throw new UnauthorizedException("That sign-in code is invalid or has expired.");
    return p.auth;
  }
  private sweep() { const now = Date.now(); for (const [k, v] of this.codes) if (v.exp < now) this.codes.delete(k); }

  private async keys(tenant: string): Promise<any[]> {
    if (this.jwks && this.jwks.tenant === tenant && Date.now() - this.jwks.at < 3600_000) return this.jwks.keys;
    const r = await fetch(`${authority()}/${encodeURIComponent(tenant)}/discovery/v2.0/keys`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new UnauthorizedException("Could not load Microsoft's signing keys.");
    const j: any = await r.json();
    this.jwks = { at: Date.now(), tenant, keys: j.keys ?? [] };
    return this.jwks.keys;
  }

  private async verifyIdToken(idToken: string, tenant: string, clientId: string): Promise<any> {
    const decoded: any = jwt.decode(idToken, { complete: true });
    if (!decoded?.header?.kid || decoded.header.alg !== "RS256") throw new UnauthorizedException("Unsupported token.");
    let jwk = (await this.keys(tenant)).find((k) => k.kid === decoded.header.kid);
    if (!jwk) { this.jwks = null; jwk = (await this.keys(tenant)).find((k) => k.kid === decoded.header.kid); }   // key rotation
    if (!jwk) throw new UnauthorizedException("Token signed with an unknown key.");
    const tid = decoded.payload?.tid;
    if (GUID.test(tenant) && tid?.toLowerCase() !== tenant.toLowerCase()) throw new UnauthorizedException("Token is from a different tenant.");
    try {
      return jwt.verify(idToken, createPublicKey({ key: jwk, format: "jwk" }), {
        algorithms: ["RS256"], audience: clientId, issuer: `${authority()}/${tid}/v2.0`,
      });
    } catch (e) { this.logger.warn(`ID token rejected: ${(e as Error).message}`); throw new UnauthorizedException("Sign-in could not be verified."); }
  }
}
