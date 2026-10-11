import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { Client as LdapClient, EqualityFilter, OrFilter } from "ldapts";
import { DirectorySource } from "./entities/directory-source.entity";
import { DirectoryAttributeMapping } from "./entities/directory-attribute-mapping.entity";
import { DirectorySyncRun } from "./entities/directory-sync-run.entity";
import { CreateDirectorySourceDto, DirectorySourceDto, SaveAttributeMappingsDto } from "./dto/itsm-config.dto";
import { decryptSecret, encryptSecret } from "./secret.util";
import { User } from "../users/entities/user.entity";
import { Role } from "../roles/entities/role.entity";
import { UserRole } from "../roles/entities/user-role.entity";

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

// Local field (as shown on the Attribute Mapping board) → User column.
const LOCAL_FIELD_TO_USER: Record<string, keyof User> = {
  "Full Name": "fullName",
  "Email Address": "email",
  "Job Title": "jobTitle",
  "Phone Number": "phone",
  "Office Location": "location",
};

interface DirEntry { username: string; email: string; values: Record<string, string> }

/** Never expose stored credentials — only whether they are set. */
const safe = (s: DirectorySource) => {
  const { bindPassword: _bp, clientSecret: _cs, ...rest } = s as any;
  return rest;
};

@Injectable()
export class DirectoryService {
  private readonly logger = new Logger(DirectoryService.name);

  constructor(
    @InjectRepository(DirectorySource) private sources: Repository<DirectorySource>,
    @InjectRepository(DirectoryAttributeMapping) private mappings: Repository<DirectoryAttributeMapping>,
    @InjectRepository(DirectorySyncRun) private runs: Repository<DirectorySyncRun>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Role) private roles: Repository<Role>,
    @InjectRepository(UserRole) private userRoles: Repository<UserRole>,
  ) {}

  // ── Sources ──────────────────────────────────────────────────────────────
  async list() {
    const rows = await this.sources.createQueryBuilder("s")
      .addSelect(["s.bindPassword", "s.clientSecret"]).orderBy("s.sourceId", "ASC").getMany();
    return rows.map((s) => ({ ...safe(s), hasBindPassword: !!s.bindPassword, hasClientSecret: !!s.clientSecret }));
  }

  async create(dto: CreateDirectorySourceDto) {
    const s = this.sources.create({
      type: dto.type,
      name: dto.name?.trim() || (dto.type === "ldap" ? "New On-Prem AD Source" : "New Azure AD / O365 Source"),
      isActive: false, autoCreateUsers: false,
      ssoEnabled: dto.type === "azure_ad", searchFilter: "(objectClass=user)", defaultRole: "End User",
    });
    const saved = await this.sources.save(s);
    await this.seedMappings(saved.sourceId);
    return (await this.list()).find((x) => x.sourceId === saved.sourceId);
  }

  async update(id: number, dto: DirectorySourceDto) {
    const s = await this.getRaw(id);
    const { bindPassword, clientSecret, ...plain } = dto;
    Object.assign(s, Object.fromEntries(Object.entries(plain).filter(([, v]) => v !== undefined)));
    if (bindPassword) s.bindPassword = encryptSecret(bindPassword);
    if (clientSecret) s.clientSecret = encryptSecret(clientSecret);
    if (s.type === "ldap" && s.ldapUrl && !/^ldaps?:\/\/.+/i.test(s.ldapUrl.trim())) {
      throw new BadRequestException("LDAP / LDAPS URL must start with ldap:// or ldaps://");
    }
    if (s.type === "azure_ad") {
      if (s.clientId && !GUID_RE.test(s.clientId.trim())) throw new BadRequestException("Application (Client) ID must be a GUID.");
      if (s.tenantId && !GUID_RE.test(s.tenantId.trim()) && !DOMAIN_RE.test(s.tenantId.trim())) {
        throw new BadRequestException("Directory (Tenant) ID must be a GUID or a verified domain.");
      }
    }
    await this.sources.save(s);
    return (await this.list()).find((x) => x.sourceId === id);
  }

  async remove(id: number) {
    await this.sources.remove(await this.getRaw(id));
    return { deleted: true };
  }

  private async getRaw(id: number): Promise<DirectorySource> {
    const s = await this.sources.createQueryBuilder("s").addSelect(["s.bindPassword", "s.clientSecret"])
      .where("s.sourceId = :id", { id }).getOne();
    if (!s) throw new NotFoundException("Directory source not found");
    return s;
  }

  // ── Test connection (real network calls) ─────────────────────────────────
  async test(id: number) {
    const s = await this.getRaw(id);
    let ok = false; let message = "";
    try {
      if (s.type === "ldap") message = await this.testLdap(s);
      else message = await this.testAzure(s);
      ok = true;
    } catch (e) {
      message = `Connection failed — ${(e as Error).message}`;
    }
    s.lastTestOk = ok; s.lastTestMessage = message; s.lastTestedAt = new Date();
    await this.sources.save(s);
    return { ok, message };
  }

  private async testLdap(s: DirectorySource): Promise<string> {
    if (!s.ldapUrl || !s.bindDn) throw new Error("LDAP / LDAPS URL and Bind DN are required.");
    if (!/^ldaps?:\/\/.+/i.test(s.ldapUrl.trim())) throw new Error("LDAP / LDAPS URL must start with ldap:// or ldaps://.");
    const pw = decryptSecret(s.bindPassword);
    if (!pw) throw new Error("Bind Password is required.");
    const client = new LdapClient({ url: s.ldapUrl.trim(), timeout: 8000, connectTimeout: 8000 });
    try {
      await client.bind(s.bindDn, pw);
      return `Successfully bound to ${s.ldapUrl} as ${s.bindDn}.`;
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  private async graphToken(s: DirectorySource): Promise<string> {
    if (!s.tenantId || !s.clientId) throw new Error("Directory (Tenant) ID and Application (Client) ID are required.");
    if (!GUID_RE.test(s.clientId.trim())) throw new Error("Application (Client) ID is not a valid GUID.");
    if (!GUID_RE.test(s.tenantId.trim()) && !DOMAIN_RE.test(s.tenantId.trim())) throw new Error("Directory (Tenant) ID is not a valid GUID or verified domain.");
    const secret = decryptSecret(s.clientSecret);
    if (!secret) throw new Error("Client Secret is required.");
    const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(s.tenantId.trim())}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: s.clientId.trim(), client_secret: secret, grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
      signal: AbortSignal.timeout(10000),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) throw new Error(body.error_description?.split("\r\n")[0] || `token request failed (${res.status})`);
    return body.access_token as string;
  }

  private async testAzure(s: DirectorySource): Promise<string> {
    await this.graphToken(s);
    return `Successfully authenticated with Azure AD tenant ${s.tenantId}.`;
  }


  // ── Sign-in support ──────────────────────────────────────────────────────
  /**
   * Verifies a directory user's password by binding as them. Returns false (never throws) on any failure.
   * An empty password is rejected up front: many LDAP servers treat "DN + empty password" as an anonymous bind that succeeds.
   */
  async authenticateLdap(username: string, password: string): Promise<boolean> {
    if (!username || !password || username.length > 256 || password.length > 512) return false;
    const sources = await this.sources.createQueryBuilder("s").addSelect("s.bindPassword")
      .where("s.type = 'ldap' AND s.isActive = true").orderBy("s.sourceId", "ASC").getMany();
    for (const s of sources) {
      if (!s.ldapUrl || !s.bindDn || !s.baseDn) continue;
      const svcPw = decryptSecret(s.bindPassword);
      if (!svcPw) continue;
      let dn: string | null = null;
      const finder = new LdapClient({ url: s.ldapUrl.trim(), timeout: 8000, connectTimeout: 8000 });
      try {
        await finder.bind(s.bindDn, svcPw);
        const { searchEntries } = await finder.search(s.baseDn, {
          scope: "sub", sizeLimit: 2, attributes: ["dn"],
          // filter objects escape the value, so a username like "*)(uid=*" cannot alter the query
          filter: new OrFilter({ filters: ["sAMAccountName", "userPrincipalName", "mail", "uid"].map((a) => new EqualityFilter({ attribute: a, value: username })) }),
        });
        if (searchEntries.length === 1) dn = searchEntries[0].dn;     // ambiguous or unknown → refuse
      } catch (e) {
        this.logger.warn(`LDAP lookup failed on "${s.name}": ${(e as Error).message}`);
      } finally { await finder.unbind().catch(() => undefined); }
      if (!dn) continue;
      const user = new LdapClient({ url: s.ldapUrl.trim(), timeout: 8000, connectTimeout: 8000 });
      try { await user.bind(dn, password); return true; }
      catch { /* wrong password */ }
      finally { await user.unbind().catch(() => undefined); }
    }
    return false;
  }

  /** True when an account provisioned by an Azure source that enforces SSO must not use a password. */
  async isPasswordLoginBlocked(user: Pick<User, "authType">): Promise<boolean> {
    if (user.authType !== "OAuth") return false;
    return (await this.sources.count({ where: { type: "azure_ad", isActive: true, ssoOnly: true } })) > 0;
  }

  /** Decrypted settings for the Microsoft sign-in flow, or null when SSO is not fully configured. */
  async getAzureSso(): Promise<null | { sourceId: number; tenantId: string; clientId: string; clientSecret: string; redirectUri: string; autoCreateUsers: boolean; allowedDomains: string[]; defaultRole: string }> {
    const s = await this.sources.createQueryBuilder("s").addSelect("s.clientSecret")
      .where("s.type = 'azure_ad' AND s.isActive = true AND s.ssoEnabled = true").orderBy("s.sourceId", "ASC").getOne();
    if (!s?.tenantId || !s.clientId || !s.redirectUri) return null;
    const secret = decryptSecret(s.clientSecret);
    if (!secret) return null;
    return {
      sourceId: s.sourceId, tenantId: s.tenantId.trim(), clientId: s.clientId.trim(), clientSecret: secret, redirectUri: s.redirectUri.trim(),
      autoCreateUsers: s.autoCreateUsers, defaultRole: s.defaultRole || "End User",
      allowedDomains: (s.allowedDomains ?? "").split(/[,\s;]+/).map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean),
    };
  }

  /** Creates a directory-backed account (no usable password) with the source's default role. */
  async provisionUser(opts: { email: string; fullName: string; username?: string; authType: "LDAP" | "OAuth"; defaultRole: string; ssoEnabled?: boolean; extra?: Partial<User> }): Promise<User> {
    const base = (opts.username || opts.email).split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "") || "user";
    const clash = await this.users.findOne({ where: { username: base } });
    const user = await this.users.save(this.users.create({
      ...(opts.extra ?? {}), email: opts.email, username: clash ? opts.email.toLowerCase() : base, fullName: opts.fullName || opts.email,
      passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10), isActive: true, authType: opts.authType, ssoEnabled: !!opts.ssoEnabled,
    } as any) as unknown as User);
    const role = await this.roles.findOne({ where: { roleName: opts.defaultRole } });
    if (role) await this.userRoles.save(this.userRoles.create({ user, role }));
    return user;
  }

  // ── Attribute mapping ────────────────────────────────────────────────────
  async getActiveCustomAttributes() {
    const list = await this.mappings.find({
      where: { isActive: true },
      order: { displayOrder: "ASC", mappingId: "ASC" },
    });
    const standardFields = new Set([
      "full name", "email address", "department", "job title",
      "phone number", "office location", "user principal name (reference)",
      "first name", "last name", "display name", "email id", "employee id",
      "manager", "business service", "location", "user type", "active",
    ]);
    const seen = new Set<string>();
    return list.filter((m) => {
      const k = m.localField.trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return m.isCustom || !standardFields.has(k);
    });
  }

  async getMappings(sourceId: number) {
    await this.getRaw(sourceId);
    return this.mappings.find({ where: { sourceId }, order: { displayOrder: "ASC", mappingId: "ASC" } });
  }

  async saveMappings(sourceId: number, dto: SaveAttributeMappingsDto) {
    await this.getRaw(sourceId);
    const seen = new Set<string>();
    for (const r of dto.rows) {
      const k = r.localField.trim().toLowerCase();
      if (seen.has(k)) throw new BadRequestException(`"${r.localField}" is mapped more than once.`);
      seen.add(k);
    }
    await this.mappings.manager.transaction(async (tx) => {
      await tx.delete(DirectoryAttributeMapping, { sourceId });
      await tx.save(DirectoryAttributeMapping, dto.rows.map((r, i) => tx.create(DirectoryAttributeMapping, {
        sourceId, localField: r.localField.trim(), externalAttribute: r.externalAttribute.trim(),
        isActive: r.isActive ?? true, isCustom: r.isCustom ?? false, displayOrder: i + 1,
      })));
    });
    return this.getMappings(sourceId);
  }

  private async seedMappings(sourceId: number) {
    const preset = [
      ["Full Name", "displayName"], ["Email Address", "mail"], ["Department", "department"], ["Job Title", "title"],
      ["Phone Number", "telephoneNumber"], ["Office Location", "physicalDeliveryOfficeName"], ["User Principal Name (reference)", "userPrincipalName"],
    ];
    await this.mappings.save(preset.map(([l, e], i) => this.mappings.create({ sourceId, localField: l, externalAttribute: e, displayOrder: i + 1 })));
  }

  // ── Sync history + run ───────────────────────────────────────────────────
  history(sourceId: number) {
    return this.runs.find({ where: { sourceId }, order: { startedAt: "DESC" }, take: 100 });
  }

  async syncNow(sourceId: number, triggeredBy: string) {
    const s = await this.getRaw(sourceId);
    const busy = await this.runs.findOne({ where: { sourceId, status: "Running" }, order: { startedAt: "DESC" } });
    if (busy && Date.now() - busy.startedAt.getTime() < 10 * 60 * 1000) throw new ConflictException("A sync for this directory is already running.");
    const run = await this.runs.save(this.runs.create({ sourceId, triggeredBy, status: "Running" }));
    try {
      if (!s.isActive) throw new Error("This directory source is inactive. Activate it before syncing.");
      const maps = (await this.getMappings(sourceId)).filter((m) => m.isActive);
      const entries = s.type === "ldap" ? await this.fetchLdap(s, maps) : await this.fetchGraph(s, maps);
      const counts = await this.upsertUsers(s, maps, entries);
      Object.assign(run, { fetched: entries.length, ...counts, finishedAt: new Date() });
      run.status = counts.failed === 0 ? "Success" : counts.created + counts.updated > 0 ? "Partial" : "Failed";
      run.message = counts.failed === 0
        ? `Synced successfully from ${s.type}.`
        : `${counts.failed} user(s) skipped: ${counts.reasons.slice(0, 3).join("; ")}`;
    } catch (e) {
      this.logger.warn(`Directory sync ${sourceId} failed: ${(e as Error).message}`);
      Object.assign(run, { status: "Failed", finishedAt: new Date(), message: (e as Error).message });
    }
    const { reasons: _r, ...clean } = run as any;
    return this.runs.save(clean);
  }

  private async fetchLdap(s: DirectorySource, maps: DirectoryAttributeMapping[]): Promise<DirEntry[]> {
    if (!s.ldapUrl || !s.bindDn || !s.baseDn) throw new Error("LDAP URL, Bind DN and Base DN are required to sync.");
    const pw = decryptSecret(s.bindPassword);
    if (!pw) throw new Error("Bind Password is required.");
    const attrs = [...new Set([...maps.map((m) => m.externalAttribute), "sAMAccountName", "userPrincipalName", "mail"])];
    // Servers disagree on the case they answer with and the client only keeps attributes whose case matches the request,
    // so ask for both spellings and let ldapValue() pick whichever came back populated.
    const requested = [...new Set(attrs.flatMap((a) => [a, a.toLowerCase()]))];
    const client = new LdapClient({ url: s.ldapUrl.trim(), timeout: 20000, connectTimeout: 8000 });
    try {
      await client.bind(s.bindDn, pw);
      const { searchEntries } = await client.search(s.baseDn, {
        scope: "sub", filter: s.searchFilter || "(objectClass=user)", attributes: requested, sizeLimit: 5000,
      });
      return searchEntries.map((e: any) => {
        const values: Record<string, string> = {};
        for (const a of attrs) { const v = this.ldapValue(e, a); if (v !== undefined) values[a] = v; }
        return { username: values.sAMAccountName || values.userPrincipalName || "", email: values.mail || "", values };
      });
    } finally { await client.unbind().catch(() => undefined); }
  }

  /**
   * LDAP attribute names are case-insensitive and servers vary in how they return them (AD: "displayName", others: "displayname").
   * Clients may also hand back an empty array under the name that was requested. Pick the first non-empty value, or undefined.
   */
  private ldapValue(entry: Record<string, unknown>, name: string): string | undefined {
    for (const key of Object.keys(entry)) {
      if (key.toLowerCase() !== name.toLowerCase()) continue;
      const raw = entry[key];
      const first = Array.isArray(raw) ? raw[0] : raw;
      if (first == null) continue;
      const text = (Buffer.isBuffer(first) ? first.toString("utf8") : String(first)).trim();
      if (text) return text;
    }
    return undefined;
  }

  private async fetchGraph(s: DirectorySource, maps: DirectoryAttributeMapping[]): Promise<DirEntry[]> {
    const token = await this.graphToken(s);
    const select = [...new Set([...maps.map((m) => m.externalAttribute), "userPrincipalName", "mail", "displayName"])].join(",");
    const out: DirEntry[] = [];
    let url: string | null = `https://graph.microsoft.com/v1.0/users?$select=${encodeURIComponent(select)}&$top=200`;
    while (url && out.length < 20000) {
      const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message || `Graph request failed (${res.status})`);
      for (const u of body.value ?? []) {
        const values: Record<string, string> = {};
        for (const [k, v] of Object.entries(u)) if (v != null && typeof v !== "object") values[k] = String(v);
        out.push({ username: values.userPrincipalName || "", email: values.mail || values.userPrincipalName || "", values });
      }
      url = body["@odata.nextLink"] ?? null;
    }
    return out;
  }

  private async upsertUsers(s: DirectorySource, maps: DirectoryAttributeMapping[], entries: DirEntry[]) {
    let created = 0, updated = 0, failed = 0;
    const reasons: string[] = [];
    const roleName = s.defaultRole || "End User";
    const role = await this.roles.findOne({ where: { roleName } });
    for (const e of entries) {
      try {
        if (!e.email) { failed++; reasons.push(`missing 'mail' for ${e.username || "unknown"}`); continue; }
        const patch: Partial<User> = {};
        for (const m of maps) {
          const col = LOCAL_FIELD_TO_USER[m.localField];
          const val = e.values[m.externalAttribute];
          if (col && val) (patch as any)[col] = val;
        }
        const existing = await this.users.findOne({ where: { email: e.email } });
        if (existing) {
          // Never touch roles, active flag or password of an existing account.
          await this.users.update({ userId: existing.userId }, patch as any);
          updated++;
        } else if (s.autoCreateUsers) {
          await this.provisionUser({
            email: e.email, fullName: (patch.fullName as string) || e.values.displayName || e.email, username: e.username, extra: patch,
            authType: s.type === "ldap" ? "LDAP" : "OAuth", defaultRole: roleName, ssoEnabled: s.type === "azure_ad" && s.ssoEnabled,
          });
          created++;
        } else { failed++; reasons.push(`${e.email} not found (auto-create is off)`); }
      } catch (err) {
        failed++; reasons.push(`${e.email || e.username}: ${(err as Error).message}`);
      }
    }
    return { created, updated, failed, reasons };
  }
}
