import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { ChangeSetting } from "./entities/change-setting.entity";
import {
  ChangeSettings, COLORS, COND_FIELDS, GATES, KIND_OF_TYPE, MAX_CATEGORY_DEPTH, PIR_RULES, RISK_QTYPES, RISK_SECTIONS, ROLE_IDS, RULES, SETTING_KEYS, SettingKey,
  NOTIFICATION_TRIGGERS, RECIPIENT_KINDS, STEP_TYPES, StepType, defaults, normalizeSettings, stepType,
} from "./change-config";

const bad = (msg: string): never => { throw new BadRequestException(msg); };
const isArr = (v: unknown): v is any[] => Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const dupes = (names: string[]) => names.find((n, i) => names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i);
const removedIds = <T extends { id: string }>(oldL: T[], newL: T[]) => oldL.filter((o) => !newL.some((n) => n.id === o.id));

@Injectable()
export class ChangeConfigService {
  private cache: { at: number; value: ChangeSettings } | null = null;

  constructor(
    @InjectRepository(ChangeSetting) private repo: Repository<ChangeSetting>,
    @InjectDataSource() private ds: DataSource,
  ) {}

  /** Effective configuration: saved sections over the defaults. Cached briefly so request handling stays cheap. */
  async effective(): Promise<ChangeSettings> {
    if (this.cache && Date.now() - this.cache.at < 5000) return JSON.parse(JSON.stringify(this.cache.value));
    const out = defaults() as any;
    for (const r of await this.repo.find()) if ((SETTING_KEYS as readonly string[]).includes(r.key)) out[r.key] = r.value;
    normalizeSettings(out);
    this.cache = { at: Date.now(), value: out };
    return JSON.parse(JSON.stringify(out));
  }

  private async used(sql: string, p: unknown[]): Promise<boolean> { return (await this.ds.query(sql, p)).length > 0; }

  /** Active workgroups (Configuration → Workgroup) — the only source of assignment groups for changes. */
  async workgroups(): Promise<{ groupId: number; groupName: string }[]> {
    return this.ds.query(`SELECT group_id AS "groupId", group_name AS "groupName" FROM assignment_groups WHERE is_active = true ORDER BY group_name`);
  }
  private async requireWorkgroup(name: string, what: string, known: Set<string>) {
    if (name && !known.has(name)) bad(`${what}: "${name}" is not a workgroup. Choose one from the Workgroup list.`);
  }

  /** Validate and save one section. Removing something that changes still use is refused. */
  async save(key: string, value: unknown, userId?: number): Promise<ChangeSettings[SettingKey]> {
    if (!(SETTING_KEYS as readonly string[]).includes(key)) bad(`Unknown setting "${key}".`);
    const cur = await this.effective();
    const clean = await this.validate(key as SettingKey, value, cur);
    await this.repo.save(this.repo.create({ key, value: clean as any, updatedBy: userId ?? null }));
    this.cache = null;
    return clean;
  }

  /** Read-modify-write for system-maintained values such as template usage counts. */
  async patch<K extends SettingKey>(key: K, fn: (v: ChangeSettings[K]) => ChangeSettings[K]): Promise<void> {
    const cur = await this.effective();
    await this.repo.save(this.repo.create({ key, value: fn(cur[key]) as any }));
    this.cache = null;
  }

  private async validate(key: SettingKey, v: any, cur: ChangeSettings): Promise<any> {
    switch (key) {
      case "models": return this.models(v, cur);
      case "categories": return this.categories(v, cur);
      case "closeCodes": return this.closeCodes(v, cur);
      case "risk": return this.risk(v, cur);
      case "templates": return this.templates(v, cur);
      case "approval": return this.approval(v, cur);
      case "windows": return this.windows(v);
      case "lifecycles": return this.lifecycles(v, cur);
      case "notifications": return this.notifications(v);
      case "stateTransitions": return this.stateTransitions(v);
    }
  }

  private stateTransitions(v: any) {
    const states = ["New", "Assess", "Authorize", "Scheduled", "Implement", "Review", "Closed"];
    const requirements = ["risk", "cis", "implementationPlan", "backoutPlan", "testPlan", "plannedWindow", "conflict", "approvals", "tasks", "outcome", "pir", "closeCode"];
    const movedOnBy = ["Change owner", "Change manager", "Approval groups", "Assignment group", "System (automatic)"];
    if (!isArr(v)) bad("Invalid state-transition configuration.");
    const out = v.map((m: any) => {
      if (!str(m.model)) bad("Every state-transition configuration needs a change model.");
      if (!isArr(m.states) || m.states.length !== states.length) bad(`Model "${m.model}": configure each lifecycle state exactly once.`);
      const rows = m.states.map((r: any) => {
        if (!states.includes(r.state)) bad(`Model "${m.model}": "${r.state}" is not a lifecycle state.`);
        if (!isArr(r.requirements) || r.requirements.some((x: unknown) => !requirements.includes(String(x)))) bad(`Model "${m.model}", state "${r.state}": choose valid completion criteria.`);
        if (!movedOnBy.includes(r.movedOnBy)) bad(`Model "${m.model}", state "${r.state}": choose who moves the state on.`);
        if (["New", "Scheduled", "Implement", "Closed"].includes(r.state) && r.inUse === false) bad(`Model "${m.model}": ${r.state} is a required state.`);
        if (!["New", "Assess", "Authorize", "Scheduled"].includes(r.state) && r.canCancel) bad(`Model "${m.model}": ${r.state} cannot be cancelled.`);
        return { state: r.state, inUse: !!r.inUse, purpose: str(r.purpose), movedOnBy: r.movedOnBy, requirements: [...new Set(r.requirements)], canCancel: !!r.canCancel };
      });
      if (new Set(rows.map((r: any) => r.state)).size !== states.length || states.some((s) => !rows.some((r: any) => r.state === s))) {
        bad(`Model "${m.model}": configure each lifecycle state exactly once.`);
      }
      const a = m.automatic;
      if (!a || typeof a !== "object") bad(`Model "${m.model}": automatic transitions are required.`);
      const closeAfterReviewDays = Number(a.closeAfterReviewDays), overrunReminderMinutes = Number(a.overrunReminderMinutes);
      if (!Number.isInteger(closeAfterReviewDays) || closeAfterReviewDays < 0 || closeAfterReviewDays > 365) bad(`Model "${m.model}": review closure must be between 0 and 365 business days.`);
      if (!Number.isInteger(overrunReminderMinutes) || overrunReminderMinutes < 0 || overrunReminderMinutes > 525600) bad(`Model "${m.model}": overrun reminder must be between 0 and 525600 minutes.`);
      return { model: str(m.model), states: rows, automatic: {
        approvalToScheduled: !!a.approvalToScheduled, implementAtPlannedStart: !!a.implementAtPlannedStart, blockBlackout: !!a.blockBlackout,
        closeAfterReviewDays, overrunReminderMinutes,
      } };
    });
    const duplicate = dupes(out.map((m: any) => m.model));
    if (duplicate) bad(`Two state-transition configurations are named "${duplicate}".`);
    return out;
  }

  private async models(v: any, cur: ChangeSettings) {
    if (!isArr(v)) bad("Invalid change models.");
    const out = v.map((m: any) => {
      if (!str(m.name)) bad("Every change model needs a name.");
      if (!["Standard", "Normal", "Emergency"].includes(m.base)) bad(`Model "${m.name}": choose how it behaves (Standard, Normal or Emergency).`);
      const lifecycle = cur.lifecycles.find((l) => l.id === m.lifecycle)
        ?? (!str(m.lifecycle) ? cur.lifecycles.find((l) => l.name.toLowerCase().includes(m.base.toLowerCase())) ?? cur.lifecycles[0] : undefined);
      if (!lifecycle) throw new BadRequestException(`Model "${m.name}": choose a lifecycle.`);
      if (!PIR_RULES.includes(m.pir)) bad(`Model "${m.name}": choose a post-implementation review rule.`);
      const lead = Number(m.leadDays);
      if (!Number.isFinite(lead) || lead < 0 || lead > 365) bad(`Model "${m.name}": lead time must be between 0 and 365 days.`);
      return { id: str(m.id) || `mod_${Math.random().toString(36).slice(2, 8)}`, name: str(m.name), desc: str(m.desc), leadDays: Math.floor(lead), color: COLORS.includes(m.color) ? m.color : "blue",
        active: m.active !== false, base: m.base, lifecycle: lifecycle.id, pir: m.pir, linkIncident: !!m.linkIncident };
    });
    const d = dupes(out.map((m) => m.name)); if (d) bad(`Two change models are called "${d}".`);
    for (const r of removedIds(cur.models, out)) if (await this.used(`SELECT 1 FROM changes WHERE change_type = $1 LIMIT 1`, [r.name])) bad(`"${r.name}" is used by existing changes. Deactivate it instead of deleting it.`);
    return out;
  }

  private async categories(v: any, cur: ChangeSettings) {
    if (!isArr(v)) bad("Invalid categories.");
    const wg = new Set((await this.workgroups()).map((g) => g.groupName));
    const boards = new Set(cur.approval.groups.map((g) => g.name));
    const out = v.map((c: any) => { if (!str(c.name)) bad("Every category needs a name.");
      return { id: str(c.id) || `cat_${Math.random().toString(36).slice(2, 8)}`, name: str(c.name), parentId: c.parentId ? String(c.parentId) : null, desc: str(c.desc), group: str(c.group), tab: str(c.tab), active: c.active !== false }; });
    const d = dupes(out.map((c) => c.name)); if (d) bad(`Two categories are called "${d}". Category names must be unique, because a change stores the name.`);
    const byId = new Map<string, any>(out.map((c: any) => [c.id, c] as [string, any]));
    for (const c of out) {
      if (c.parentId && !byId.has(c.parentId)) bad(`Category "${c.name}" sits under a category that no longer exists.`);
      let depth = 1, p = c.parentId ? byId.get(c.parentId) : undefined; const seen = new Set([c.id]);
      while (p) { if (seen.has(p.id)) bad(`Category "${c.name}" is its own ancestor.`); seen.add(p.id); depth++; p = p.parentId ? byId.get(p.parentId) : undefined; }
      if (depth > MAX_CATEGORY_DEPTH) bad(`Category "${c.name}" is ${depth} levels deep; the limit is ${MAX_CATEGORY_DEPTH}.`);
      await this.requireWorkgroup(c.group, `Category "${c.name}" default assignment group`, wg);
      if (c.tab && !boards.has(c.tab)) bad(`Category "${c.name}": "${c.tab}" is not an approval group or board.`);
    }
    for (const r of removedIds(cur.categories, out)) if (await this.used(`SELECT 1 FROM changes WHERE category = $1 LIMIT 1`, [r.name])) bad(`Category "${r.name}" is used by existing changes. Deactivate it instead.`);
    return out;
  }

  private async closeCodes(v: any, cur: ChangeSettings) {
    if (!isArr(v)) bad("Invalid close codes.");
    const out = v.map((c: any) => { if (!str(c.name)) bad("Every close code needs a name.");
      return { id: str(c.id) || `cc_${Math.random().toString(36).slice(2, 8)}`, name: str(c.name), desc: str(c.desc), color: str(c.color) || "gray", pir: !!c.pir, active: c.active !== false }; });
    const d = dupes(out.map((c) => c.name)); if (d) bad(`Two close codes are called "${d}".`);
    if (out.length && !out.some((c) => c.active && c.name !== "Cancelled")) bad("Keep at least one active close code besides Cancelled.");
    for (const r of removedIds(cur.closeCodes, out)) if (await this.used(`SELECT 1 FROM changes WHERE close_code = $1 LIMIT 1`, [r.name])) bad(`Close code "${r.name}" is used by existing changes. Deactivate it instead.`);
    return out;
  }

  private risk(v: any, cur: ChangeSettings) {
    if (!v || !isArr(v.questions) || !isArr(v.bands)) bad("Invalid risk configuration.");
    const levels = ["Low", "Moderate", "High", "Very High"];
    const modelNames = new Set(cur.models.map((m) => m.name));
    const catNames = new Set(cur.categories.map((c) => c.name));
    const ids = new Set<string>();
    const questions = v.questions.map((q: any) => {
      if (!str(q.label)) bad("Every risk question needs wording.");
      if (!isArr(q.opts) || q.opts.length < 2) bad(`"${q.label}" needs at least two answers.`);
      const id = str(q.id) || `rq_${Math.random().toString(36).slice(2, 8)}`;
      if (ids.has(id)) bad("Two risk questions share an id."); ids.add(id);
      const section = (RISK_SECTIONS as readonly string[]).includes(q.section) ? q.section : "impact";
      const showIf = q.showIf && q.showIf.q ? { q: String(q.showIf.q), opt: Number(q.showIf.opt) } : null;
      return { id, section, label: str(q.label), help: str(q.help), type: (RISK_QTYPES as readonly string[]).includes(q.type) ? q.type : "single", required: q.required !== false, active: q.active !== false,
        models: (isArr(q.models) ? q.models : []).map(String).filter((m: string) => modelNames.has(m)), cats: (isArr(q.cats) ? q.cats : []).map(String).filter((c: string) => catNames.has(c)), showIf,
        opts: q.opts.map((o: any) => { const w = Number(o.w); if (!str(o.t) || !Number.isFinite(w) || w < 0) bad(`"${q.label}": every answer needs text and a score of 0 or more.`);
          return { t: str(o.t), w, min: levels.includes(o.min) ? o.min : "" }; }) };
    });
    if (questions.length && !questions.some((q: any) => q.active)) bad("Keep at least one active risk question.");
    questions.forEach((q: any, i: number) => {
      if (!q.showIf) return;
      const dep = questions.findIndex((x: any) => x.id === q.showIf.q);
      if (dep < 0 || dep >= i) bad(`"${q.label}": a follow-up question must come after the question it depends on.`);
      if (!(q.showIf.opt >= 0 && q.showIf.opt < questions[dep].opts.length)) bad(`"${q.label}": choose which answer of "${questions[dep].label}" shows it.`);
    });
    const method = v.method === "matrix" ? "matrix" : "sum";
    const bands = !questions.length && !v.bands.length ? [] : levels.map((lv) => { const b = v.bands.find((x: any) => x.level === lv); if (!b) bad(`Add a score band for ${lv}.`); return { level: lv, min: Number(b.min), max: Number(b.max) }; });
    const matrix = (isArr(v.matrix) ? v.matrix : []).map((row: any) => (isArr(row) ? row : []).map(String));
    if (method === "sum") {
      if (bands.length && bands[0].min !== 0) bad("The Low band must start at 0.");
      bands.forEach((b, i) => { if (!(b.min <= b.max)) bad(`${b.level}: the lowest score cannot be above the highest.`); if (i && b.min !== bands[i - 1].max + 1) bad(`${b.level} must start at ${bands[i - 1].max + 1}, straight after ${bands[i - 1].level}, with no gap or overlap.`); });
    }
    const asc = (a: number[]) => a.length === 4 && a.every((x, i) => Number.isFinite(x) && (i === 0 || x > a[i - 1]));
    const impFrom = (isArr(v.impFrom) ? v.impFrom : []).map(Number), likFrom = (isArr(v.likFrom) ? v.likFrom : []).map(Number);
    if (method === "matrix" && (questions.length || matrix.length)) { if (!asc(impFrom)) bad("Impact level scores must go up from Minor to Severe."); if (!asc(likFrom)) bad("Likelihood level scores must go up from Rare to Likely."); }
    if (method === "matrix" && (questions.length || matrix.length) && (matrix.length !== 4 || matrix.some((r: string[]) => r.length !== 4 || r.some((c) => !levels.includes(c))))) bad("The risk matrix needs a level in each of its 16 cells.");
    const st = v.settings ?? {};
    const settings = { requiredFor: (isArr(st.requiredFor) ? st.requiredFor : []).map(String).filter((m: string) => modelNames.has(m)), emgAfter: !!st.emgAfter, override: !!st.override, overrideReason: !!st.overrideReason,
      overrideDownOnly: !!st.overrideDownOnly, reassess: !!st.reassess, showScore: st.showScore !== false, history: !!st.history, reviewMonths: Math.max(0, Math.min(60, Math.floor(Number(st.reviewMonths) || 0))) };
    return { questions, bands, method, impFrom: asc(impFrom) ? impFrom : [], likFrom: asc(likFrom) ? likFrom : [], matrix: matrix.length === 4 ? matrix : [], settings };
  }

  private async templates(v: any, cur: ChangeSettings) {
    if (!isArr(v)) bad("Invalid templates.");
    const out = v.map((t: any) => {
      if (!str(t.name)) bad("Every template needs a name.");
      if (!["Proposed", "Active", "Under review", "Retired"].includes(t.status)) bad(`Template "${t.name}": choose a status.`);
      if (t.status === "Active" && (!str(t.implementationPlan) || !str(t.backoutPlan))) bad(`Template "${t.name}" needs implementation steps and a backout plan before it can be Active.`);
      const old = cur.templates.find((o) => o.id === t.id);
      return { id: str(t.id) || `std_${Math.random().toString(36).slice(2, 8)}`, name: str(t.name), category: str(t.category), service: str(t.service), group: str(t.group), owner: str(t.owner),
        status: t.status, description: str(t.description), implementationPlan: String(t.implementationPlan ?? ""), backoutPlan: String(t.backoutPlan ?? ""), testPlan: String(t.testPlan ?? ""),
        authorised: str(t.authorised), nextReview: str(t.nextReview), uses: old?.uses ?? 0, failed: old?.failed ?? 0 };   // counters are maintained by the system
    });
    const d = dupes(out.map((t) => t.name)); if (d) bad(`Two templates are called "${d}".`);
    for (const r of removedIds(cur.templates, out)) if (await this.used(`SELECT 1 FROM changes WHERE template_id = $1 LIMIT 1`, [r.id])) bad(`Template "${r.name}" has been used. Retire it instead of deleting it.`);
    return out;
  }

  private async approval(v: any, cur: ChangeSettings) {
    if (!v || !isArr(v.groups) || !isArr(v.rules) || !v.settings) bad("Invalid approval configuration.");
    const groups = v.groups.map((g: any) => {
      if (!str(g.name)) bad("Every group needs a name.");
      if (!["Approval group", "Board", "Technical board"].includes(g.type)) bad(`Group "${g.name}": choose a type.`);
      const members = (isArr(g.members) ? g.members : []).map((m: any) => ({ userId: Number(m.userId), name: str(m.name) })).filter((m: any) => Number.isInteger(m.userId) && m.userId > 0);
      if (new Set(members.map((m: any) => m.userId)).size !== members.length) bad(`Group "${g.name}" lists the same member twice.`);
      const lead = g.lead ? Number(g.lead) : null;
      if (lead && !members.some((m: any) => m.userId === lead)) bad(`Group "${g.name}": the chair or lead must be one of its members.`);
      const quorum = Number(g.quorum) || 0;
      if (quorum < 0 || quorum > members.length) bad(`Group "${g.name}": quorum cannot be more than its ${members.length} members.`);
      const day = g.meetDay === null || g.meetDay === undefined || g.meetDay === "" ? null : Number(g.meetDay);
      if (day !== null && !(day >= 0 && day <= 6)) bad(`Group "${g.name}": choose a valid meeting day.`);
      if (day !== null && !/^\d{2}:\d{2}$/.test(str(g.meetTime))) bad(`Group "${g.name}": enter the meeting time as HH:MM.`);
      return { id: str(g.id) || `grp_${Math.random().toString(36).slice(2, 8)}`, name: str(g.name), desc: str(g.desc), type: g.type, email: str(g.email), members, lead,
        defaultRule: RULES.includes(g.defaultRule) ? g.defaultRule : "Any one member", meets: str(g.meets) || "On demand", meetDay: day, meetTime: day === null ? "" : str(g.meetTime), quorum, active: g.active !== false };
    });
    const d = dupes(groups.map((g: any) => g.name)); if (d) bad(`Two groups are called "${d}".`);
    const names = new Set<string>(groups.map((g: any) => g.name));
    const modelNames = new Set(cur.models.map((m) => m.name));
    const rules = v.rules.map((r: any) => {
      if (!modelNames.has(r.type)) bad(`A rule refers to an unknown change model "${r.type}".`);
      if (!["Any", "Low", "Moderate", "High", "Very High"].includes(r.risk)) bad("Every rule needs a risk level.");
      const stages = (isArr(r.stages) ? r.stages : []).map((s: any) => {
        if (s.grp !== "Category TAB" && !names.has(s.grp)) bad(`A rule uses "${s.grp}", which is not an approval group.`);
        if (!RULES.includes(s.rule)) bad(`Choose how many members must approve at "${s.grp}".`);
        return { grp: s.grp, rule: s.rule };
      });
      return { id: str(r.id) || `pr_${Math.random().toString(36).slice(2, 8)}`, type: r.type, risk: r.risk, stages, active: r.active !== false };
    });
    const seen = rules.filter((r: any) => r.active).map((r: any) => `${r.type}|${r.risk}`);
    const dup = seen.find((k: string, i: number) => seen.indexOf(k) !== i); if (dup) bad(`Two active rules apply to ${dup.replace("|", " / ")}.`);
    const s = v.settings;
    const settings = { noSelf: true, /* segregation of duties is always enforced */ reapprove: !!s.reapprove, remindHours: Math.max(0, Math.floor(Number(s.remindHours) || 0)), escalateHours: Math.max(0, Math.floor(Number(s.escalateHours) || 0)) };
    if (settings.remindHours && settings.escalateHours && settings.escalateHours <= settings.remindHours) bad("Escalation must come after the reminder.");
    for (const r of cur.approval.groups.filter((g) => !groups.some((n: any) => n.id === g.id)))
      if (cur.lifecycles.some((l) => l.steps.some((st) => st.group === r.name))) bad(`Group "${r.name}" is used in a lifecycle. Remove it there first.`);
    for (const r of cur.approval.groups.filter((g) => !groups.some((n: any) => n.id === g.id)))
      if (await this.used(`SELECT 1 FROM change_approvals WHERE approval_group = $1 LIMIT 1`, [r.name])) bad(`Group "${r.name}" appears on existing approvals. Deactivate it instead of deleting it.`);
    return { groups, rules, settings };
  }

  private windows(v: any) {
    if (!isArr(v)) bad("Invalid windows.");
    const dt = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/, tm = /^\d{2}:\d{2}$/;
    const out = v.map((w: any) => {
      if (!str(w.name)) bad("Every window needs a name.");
      if (!str(w.scope)) bad(`Window "${w.name}": choose the services in scope (or "All services").`);
      const base = { id: str(w.id) || `win_${Math.random().toString(36).slice(2, 8)}`, name: str(w.name), kind: w.kind, scope: str(w.scope), allowEmergency: !!w.allowEmergency, desc: str(w.desc), active: w.active !== false };
      if (w.kind === "Blackout") {
        if (!dt.test(str(w.start)) || !dt.test(str(w.end))) bad(`Window "${w.name}": enter start and end as YYYY-MM-DD HH:MM.`);
        if (new Date(str(w.start).replace(" ", "T")) >= new Date(str(w.end).replace(" ", "T"))) bad(`Window "${w.name}": the end must be after the start.`);
        return { ...base, start: str(w.start), end: str(w.end) };
      }
      if (w.kind !== "Maintenance") bad(`Window "${w.name}": choose Blackout or Maintenance.`);
      const day = Number(w.day);
      if (!(day >= 0 && day <= 6) || !tm.test(str(w.from)) || !tm.test(str(w.to))) bad(`Window "${w.name}": choose the weekday and times (HH:MM).`);
      return { ...base, day, from: str(w.from), to: str(w.to) };
    });
    const d = dupes(out.map((w) => w.name)); if (d) bad(`Two windows are called "${d}".`);
    return out;
  }

  private async lifecycles(v: any, cur: ChangeSettings) {
    if (!isArr(v) || !v.length) bad("Create at least one lifecycle.");
    const groupNames = new Set(cur.approval.groups.filter((g) => g.active).map((g) => g.name));
    const workgroupNames = new Set((await this.workgroups()).map((g) => g.groupName));
    const out = await Promise.all(v.map(async (l: any) => {
      if (!str(l.name)) bad("Every lifecycle needs a name.");
      const steps = await Promise.all((isArr(l.steps) ? l.steps : []).map(async (s: any) => {
        const t: StepType = (STEP_TYPES as string[]).includes(s.type) ? s.type : stepType(s);
        const base: any = { id: str(s.id) || `st_${Math.random().toString(36).slice(2, 8)}`, type: t, kind: KIND_OF_TYPE[t], name: str(s.name) || t };
        const where = `Lifecycle "${l.name}": "${base.name}"`;
        if (t === "group") { if (!groupNames.has(s.group)) bad(`${where} needs an approval group.`); base.group = s.group; base.rule = RULES.includes(s.rule) ? s.rule : "Any one member"; }
        if (t === "individual") { const id = Number(s.userId); if (!Number.isInteger(id) || id <= 0) bad(`${where} needs an approver.`); base.userId = id; base.who = str(s.who); }
        if (t === "role") { if (!(ROLE_IDS as readonly string[]).includes(s.roleId)) bad(`${where} needs a role.`); base.roleId = s.roleId; }
        if (t === "parallel") {
          const ap = (isArr(s.approvers) ? s.approvers : []).map(String);
          if (ap.length < 2) bad(`${where} needs at least two approvers.`);
          for (const a of ap) { const [k, r1] = a.split(":"); if (!((k === "group" && groupNames.has(a.slice(6))) || (k === "person" && Number(r1) > 0) || (k === "role" && (ROLE_IDS as readonly string[]).includes(r1) && r1 !== "assignmentGroup"))) bad(`${where}: "${a}" is not a valid approver.`); }
          base.approvers = ap; base.prule = s.prule === "any" ? "any" : "all";
        }
        if (t === "condition") {
          const rules = (isArr(s.rules) ? s.rules : []).map((r: any) => { if (!COND_FIELDS.some((f) => f.id === r.k)) bad(`${where}: unknown field "${r.k}".`); if (r.value === undefined || r.value === "") bad(`${where}: every rule needs a value.`); return { k: String(r.k), op: String(r.op), value: String(r.value) }; });
          if (!rules.length) bad(`${where} needs at least one rule.`);
          base.match = s.match === "any" ? "any" : "all"; base.rules = rules; base.yes = s.yes === "skip" ? "skip" : "next"; base.no = s.no === "skip" ? "skip" : "next";
        }
        if (t === "gate") { if (!(GATES as readonly string[]).includes(s.gate)) bad(`${where} needs a check.`); base.gate = s.gate; }
        if (t === "cabAgenda") {
          if (!groupNames.has("CAB")) bad(`${where} needs an active CAB approval group.`);
        }
        if (t === "wait") {
          const minutes = Number(s.waitMinutes);
          if (!Number.isInteger(minutes) || minutes < 1 || minutes > 525600) bad(`${where} must wait between 1 and 525600 minutes.`);
          base.waitMinutes = minutes;
        }
        if (t === "email") {
          const recipients = (isArr(s.recipients) ? s.recipients : []).map((r: unknown) => str(r).toLowerCase());
          if (!recipients.length || recipients.some((r: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))) bad(`${where} needs one or more valid email addresses.`);
          if (!str(s.subject) || str(s.subject).length > 255) bad(`${where} needs a subject of 255 characters or fewer.`);
          if (!String(s.body ?? "").trim() || String(s.body).length > 10000) bad(`${where} needs a message of 10000 characters or fewer.`);
          base.recipients = [...new Set(recipients)]; base.subject = str(s.subject); base.body = String(s.body);
        }
        if (t === "update") {
          const fields = ["shortDescription", "description", "priority", "category", "businessService", "impact", "urgency", "justification", "communicationPlan"];
          if (!fields.includes(s.updateField)) bad(`${where} needs a supported change field.`);
          if (typeof s.updateValue !== "string" || s.updateValue.length > 10000) bad(`${where} needs a value of 10000 characters or fewer.`);
          base.updateField = s.updateField; base.updateValue = s.updateValue;
        }
        if (t === "task") {
          if (!str(s.taskName) || str(s.taskName).length > 255) bad(`${where} needs a task name of 255 characters or fewer.`);
          const group = str(s.taskGroup);
          if (group && !workgroupNames.has(group)) bad(`${where}: "${group}" is not an active workgroup.`);
          const assignedToId = s.taskAssignedToId ? Number(s.taskAssignedToId) : null;
          if (assignedToId !== null && (!Number.isInteger(assignedToId) || assignedToId <= 0 ||
            !(await this.used(`SELECT 1 FROM users WHERE user_id = $1 AND is_active = true LIMIT 1`, [assignedToId])))) bad(`${where} needs an active assigned user.`);
          base.taskName = str(s.taskName); base.taskGroup = group; base.taskAssignedToId = assignedToId;
        }
        if (t === "record") {
          if (s.recordType !== "Change") bad(`${where} needs a supported related record type.`);
          if (!str(s.recordTitle) || str(s.recordTitle).length > 255) bad(`${where} needs a related change title of 255 characters or fewer.`);
          if (String(s.recordDescription ?? "").length > 10000) bad(`${where}: related change description must be 10000 characters or fewer.`);
          base.recordType = "Change"; base.recordTitle = str(s.recordTitle); base.recordDescription = String(s.recordDescription ?? "");
        }
        if (t === "integration") {
          const url = (() => {
            try { return new URL(str(s.integrationUrl)); } catch { return bad(`${where} needs a valid HTTPS URL.`); }
          })();
          if (url.protocol !== "https:" || url.username || url.password) bad(`${where} needs an HTTPS URL without embedded credentials.`);
          base.integrationUrl = url.toString();
        }
        return base;
      }));
      const types = steps.map((s: any) => s.type as StepType);
      for (const k of ["implement", "close"] as StepType[]) if (!types.includes(k)) bad(`Lifecycle "${l.name}" needs ${k === "implement" ? "an" : "a"} ${k === "implement" ? "Implement" : "Close"} step.`);
      for (const k of ["implement", "review", "close"] as StepType[]) if (types.filter((x: StepType) => x === k).length > 1) bad(`Lifecycle "${l.name}" can have only one ${k} step.`);
      if (steps.filter((s: any) => s.type === "policy").length > 1) bad(`Lifecycle "${l.name}" can use the approval policy only once.`);
      const iImpl = types.indexOf("implement"), iRev = types.indexOf("review"), iClose = types.indexOf("close");
      if ((iRev >= 0 && (iRev < iImpl || iRev > iClose)) || iClose < iImpl) bad(`Lifecycle "${l.name}": steps must end Implement, Review, Close, in that order.`);
      types.forEach((t: StepType, i: number) => { if (i > iImpl && !["implement", "review", "close"].includes(t)) bad(`Lifecycle "${l.name}": approvals, conditions and checks must come before Implement.`); });
      return { id: str(l.id) || `lc_${Math.random().toString(36).slice(2, 8)}`, name: str(l.name), desc: str(l.desc), steps };
    }));
    const d = dupes(out.map((l) => l.name)); if (d) bad(`Two lifecycles are called "${d}".`);
    for (const r of removedIds(cur.lifecycles, out)) if (cur.models.some((m) => m.lifecycle === r.id)) bad(`"${r.name}" is used by a change model. Give that model another lifecycle first.`);
    return out;
  }

  private notifications(v: any) {
    if (!isArr(v)) bad("Invalid notifications.");
    const seen = new Set<string>();
    return v.map((n: any) => {
      const trigger = NOTIFICATION_TRIGGERS.find((e) => e.id === n.id);
      if (!trigger) throw new BadRequestException(`Unknown change notification trigger "${str(n.id)}".`);
      if (seen.has(trigger.id)) bad(`"${trigger.name}" appears more than once.`);
      seen.add(trigger.id);
      const recipients = isArr(n.recipients) ? n.recipients.map(String) : [];
      if (recipients.some((r: string) => !(RECIPIENT_KINDS as string[]).includes(r))) bad(`"${trigger.name}" has an invalid recipient.`);
      if (!str(n.subject)) bad(`"${trigger.name}" needs a subject.`);
      if (n.on !== false && !recipients.length) bad(`"${trigger.name}" is switched on but has no recipients.`);
      if (!str(n.body)) bad(`"${trigger.name}" needs a message.`);
      return { ...trigger, on: !!n.on, recipients, subject: str(n.subject), body: String(n.body), format: n.format === "html" ? "html" : "text" };
    });
  }
}
