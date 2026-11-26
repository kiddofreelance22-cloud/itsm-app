/**
 * Change Management configuration: types, defaults, and the pure helpers that apply it.
 *
 * Every section is stored in the `change_settings` table and edited from the Configuration screens.
 * New installations start with empty change-management configuration.
 */
export type BaseType = "Standard" | "Normal" | "Emergency";
export type RiskLevelName = "Low" | "Moderate" | "High" | "Very High";
export type ApprovalRuleText = "Any one member" | "Majority of members" | "All members";
export const RULES: ApprovalRuleText[] = ["Any one member", "Majority of members", "All members"];
export const PIR_RULES = ["Always", "High risk and unsuccessful changes", "Only if unsuccessful", "Never"] as const;
export const COLORS = ["green", "blue", "amber", "red", "violet"] as const;

export interface ChangeModel {
  id: string; name: string; desc: string; leadDays: number; color: string; active: boolean;
  /** Which built-in behaviour the model follows: Standard (template, pre-approved), Normal, or Emergency. */
  base: BaseType;
  lifecycle: string; pir: (typeof PIR_RULES)[number]; linkIncident: boolean;
}
/** A node in the category tree (up to MAX_CATEGORY_DEPTH levels). `group` is the default assignment group (a workgroup name); `tab` the technical board. */
export interface Category { id: string; name: string; parentId: string | null; desc: string; group: string; tab: string; active: boolean }
export const MAX_CATEGORY_DEPTH = 5;
export interface CloseCode { id: string; name: string; desc: string; color: string; pir: boolean; active: boolean }
export const RISK_SECTIONS = ["impact", "likelihood", "readiness"] as const;
export type RiskSection = (typeof RISK_SECTIONS)[number];
export const RISK_QTYPES = ["single", "yesno", "dropdown"] as const;
/** `min` on an answer raises the change to at least that level whatever the score ("can force High"). */
export interface RiskOption { t: string; w: number; min: "" | RiskLevelName }
export interface RiskQuestion {
  id: string; section: RiskSection; label: string; help: string; type: (typeof RISK_QTYPES)[number]; required: boolean; active: boolean;
  /** Only asked for these change models / categories (empty = all). */
  models: string[]; cats: string[];
  /** Follow-up: only shown when question `q` was answered with option index `opt`. */
  showIf: { q: string; opt: number } | null;
  opts: RiskOption[];
}
export interface RiskBand { level: RiskLevelName; min: number; max: number }
export interface RiskSettings { requiredFor: string[]; emgAfter: boolean; override: boolean; overrideReason: boolean; overrideDownOnly: boolean; reassess: boolean; showScore: boolean; history: boolean; reviewMonths: number }
export interface RiskConfig {
  questions: RiskQuestion[]; bands: RiskBand[];
  /** "sum": total score → band. "matrix": Impact score × (Likelihood + Readiness) score → level. */
  method: "sum" | "matrix"; impFrom: number[]; likFrom: number[]; matrix: RiskLevelName[][]; settings: RiskSettings;
}
export interface StandardTemplate {
  id: string; name: string; category: string; service: string; group: string; owner: string;
  status: "Proposed" | "Active" | "Under review" | "Retired";
  description: string; implementationPlan: string; backoutPlan: string; testPlan: string;
  authorised: string; nextReview: string; uses: number; failed: number;
}
export interface GroupMember { userId: number; name: string }
export interface ApprovalGroup {
  id: string; name: string; desc: string; type: "Approval group" | "Board" | "Technical board"; email: string;
  members: GroupMember[]; lead: number | null; defaultRule: ApprovalRuleText; meets: string;
  /** Boards that meet: weekday (0 = Sunday) and time, used to schedule CAB meetings. */
  meetDay: number | null; meetTime: string; quorum: number; active: boolean;
}
export interface ApprovalStage { grp: string; rule: ApprovalRuleText }
export interface ApprovalRule { id: string; type: string; risk: "Any" | RiskLevelName; stages: ApprovalStage[]; active: boolean }
export interface ApprovalSettings { noSelf: boolean; reapprove: boolean; remindHours: number; escalateHours: number }
export interface ApprovalConfig { groups: ApprovalGroup[]; rules: ApprovalRule[]; settings: ApprovalSettings }
export interface ChangeWindow {
  id: string; name: string; kind: "Blackout" | "Maintenance"; scope: string; allowEmergency: boolean; desc: string; active: boolean;
  start?: string; end?: string; day?: number; from?: string; to?: string;
}
export type StepKind = "Assess" | "Authorize" | "Implement" | "Review" | "Close";
export const STEP_ORDER: StepKind[] = ["Assess", "Authorize", "Implement", "Review", "Close"];
/** What a step does. `kind` (the ITIL phase) is derived from it when a lifecycle is saved. */
export type StepType = "gate" | "policy" | "individual" | "group" | "role" | "parallel" | "condition" | "wait" | "email" | "cabAgenda" | "update" | "task" | "record" | "integration" | "implement" | "review" | "close";
export const STEP_TYPES: StepType[] = ["gate", "policy", "individual", "group", "role", "parallel", "condition", "wait", "email", "cabAgenda", "update", "task", "record", "integration", "implement", "review", "close"];
export const KIND_OF_TYPE: Record<StepType, StepKind> = {
  gate: "Assess", policy: "Authorize", individual: "Authorize", group: "Authorize", role: "Authorize", parallel: "Authorize",
  condition: "Authorize", wait: "Authorize", email: "Authorize", cabAgenda: "Authorize", update: "Authorize",
  task: "Authorize", record: "Authorize", integration: "Authorize", implement: "Implement", review: "Review", close: "Close",
};
export const GATES = ["risk", "plans", "conflict", "leadtime", "cis", "incident"] as const;
export const ROLE_IDS = ["changeManager", "categoryTab", "assignmentGroup"] as const;
export interface CondRule { k: string; op: string; value: string }
export interface LifecycleStep {
  id: string; kind: StepKind; name: string; type?: StepType;
  /** Legacy: Authorize steps saved before the designer existed. */
  mode?: "policy" | "group";
  group?: string; rule?: ApprovalRuleText;
  /** individual */ userId?: number; who?: string;
  /** role */ roleId?: (typeof ROLE_IDS)[number]; fallback?: string;
  /** parallel: entries are "group:NAME", "role:ID" or "person:ID:Name"; `prule` says how many must approve */ approvers?: string[]; prule?: "all" | "any";
  /** condition */ match?: "all" | "any"; rules?: CondRule[]; yes?: "next" | "skip"; no?: "next" | "skip";
  /** gate */ gate?: (typeof GATES)[number];
  /** wait */ waitMinutes?: number;
  /** email */ recipients?: string[]; subject?: string; body?: string;
  /** update */ updateField?: "shortDescription" | "description" | "priority" | "category" | "businessService" | "impact" | "urgency" | "justification" | "communicationPlan"; updateValue?: string;
  /** task */ taskName?: string; taskGroup?: string; taskAssignedToId?: number | null;
  /** related record */ recordType?: "Change"; recordTitle?: string; recordDescription?: string;
  /** integration */ integrationUrl?: string;
}
export interface Lifecycle { id: string; name: string; desc: string; steps: LifecycleStep[] }
export interface NotificationEvent { id: string; grp: string; name: string; when: string; on: boolean; recipients: string[]; subject: string; body: string; format: "html" | "text" }
export const NOTIFICATION_TRIGGERS: Pick<NotificationEvent, "id" | "grp" | "name" | "when">[] = [
  { id: "e1", grp: "Submission & approval", name: "Change submitted", when: "A change leaves New for Assess or Authorize" },
  { id: "e2", grp: "Submission & approval", name: "Approval requested", when: "An approval stage is requested" },
  { id: "e3", grp: "Submission & approval", name: "Approval reminder", when: "An approval is still pending after the reminder time" },
  { id: "e4", grp: "Submission & approval", name: "Change approved", when: "All approval stages are approved" },
  { id: "e5", grp: "Submission & approval", name: "Change rejected", when: "An approver rejects the change" },
  { id: "e6", grp: "Submission & approval", name: "More information requested", when: "An approver asks a question" },
  { id: "e7", grp: "Emergency & CAB", name: "Emergency change raised", when: "An emergency change is submitted to the ECAB" },
  { id: "e8", grp: "Emergency & CAB", name: "CAB meeting started", when: "The CAB chair starts the meeting" },
  { id: "e9", grp: "Emergency & CAB", name: "CAB decision recorded", when: "The CAB records a decision on a change" },
  { id: "e10", grp: "Implementation", name: "Implementation in 24 hours", when: "24 hours before the planned start" },
  { id: "e11", grp: "Implementation", name: "Implementation started", when: "The change moves to Implement" },
  { id: "e12", grp: "Implementation", name: "Implementation overrun", when: "Implement runs past the planned end" },
  { id: "e13", grp: "Implementation", name: "Change unsuccessful or backed out", when: "Outcome recorded as Failed or Backed out" },
  { id: "e14", grp: "Implementation", name: "Schedule conflict detected", when: "A submitted change overlaps another change on the same service or CI" },
  { id: "e15", grp: "Review & closure", name: "Post-implementation review due", when: "A change enters Review" },
  { id: "e16", grp: "Review & closure", name: "Change closed", when: "The change is closed" },
  { id: "e17", grp: "Review & closure", name: "Change cancelled", when: "The change is cancelled" },
  { id: "e18", grp: "Review & closure", name: "Standard template review due", when: "30 days before a template's review date" },
];
export type ChangeProcessState = "New" | "Assess" | "Authorize" | "Scheduled" | "Implement" | "Review" | "Closed";
export type StateExitRequirement = "risk" | "cis" | "implementationPlan" | "backoutPlan" | "testPlan" | "plannedWindow" | "conflict" | "approvals" | "tasks" | "outcome" | "pir" | "closeCode";
export interface StateTransitionRow {
  state: ChangeProcessState; inUse: boolean; purpose: string; movedOnBy: string; requirements: StateExitRequirement[]; canCancel: boolean;
}
export interface AutomaticStateTransitions {
  approvalToScheduled: boolean; implementAtPlannedStart: boolean; blockBlackout: boolean; closeAfterReviewDays: number; overrunReminderMinutes: number;
}
export interface ModelStateTransitions { model: string; states: StateTransitionRow[]; automatic: AutomaticStateTransitions }

export interface ChangeSettings {
  models: ChangeModel[]; categories: Category[]; closeCodes: CloseCode[]; risk: RiskConfig; templates: StandardTemplate[];
  approval: ApprovalConfig; windows: ChangeWindow[]; lifecycles: Lifecycle[]; notifications: NotificationEvent[]; stateTransitions: ModelStateTransitions[];
}
export const SETTING_KEYS = ["models", "categories", "closeCodes", "risk", "templates", "approval", "windows", "lifecycles", "notifications", "stateTransitions"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

/** Fixed lists the screens offer; not configurable. */
export const IMPLEMENTATION_OUTCOMES = ["Successful", "Successful with issues", "Failed", "Backed out"];
export const FAILED_OUTCOMES = ["Failed", "Backed out"];
export const IMPACTS = ["High", "Medium", "Low"];
export const URGENCIES = ["High", "Medium", "Low"];
export const SERVICES: string[] = [];
export const RECIPIENT_KINDS = ["Requester", "Change owner", "Change manager", "Current approvers", "Assignment group", "CAB members", "ECAB members"];
export const NOTIFICATION_FIELDS = ["number", "short_description", "description", "type", "state", "risk", "priority", "category", "service", "assignment_group", "requester", "owner", "planned_start", "planned_end", "link", "approver", "comments"];
/** Fields a lifecycle condition can test. */
export const COND_FIELDS = [
  { id: "type", label: "Change model", ftype: "select" }, { id: "risk", label: "Risk level", ftype: "ord", opts: ["Low", "Moderate", "High", "Very High"] },
  { id: "priority", label: "Priority", ftype: "select" }, { id: "category", label: "Category", ftype: "select" }, { id: "service", label: "Business service", ftype: "select" },
  { id: "outage", label: "Causes a service outage", ftype: "yesno" }, { id: "conflict", label: "Has a schedule conflict", ftype: "yesno" },
  { id: "leadDays", label: "Days until planned start", ftype: "number" }, { id: "ciCount", label: "Number of CIs", ftype: "number" },
] as const;

// ───────────────────────── defaults ─────────────────────────
export function defaults(): ChangeSettings {
  return {
    models: [], categories: [], closeCodes: [], templates: [], windows: [], lifecycles: [], notifications: [], stateTransitions: [],
    risk: {
      questions: [], bands: [], method: "sum", impFrom: [], likFrom: [], matrix: [],
      settings: { requiredFor: [], emgAfter: false, override: false, overrideReason: false, overrideDownOnly: false, reassess: false, showScore: false, history: false, reviewMonths: 0 },
    },
    approval: { groups: [], rules: [], settings: { noSelf: true, reapprove: false, remindHours: 0, escalateHours: 0 } },
  };
}
// ───────────────────────── pure helpers ─────────────────────────
export const modelFor = (cfg: ChangeSettings, type: string): ChangeModel | undefined => cfg.models.find((m) => m.name === type);
export const baseOf = (cfg: ChangeSettings, type: string): BaseType => modelFor(cfg, type)?.base ?? (["Standard", "Emergency"].includes(type) ? (type as BaseType) : "Normal");
/**
 * A model with no lifecycle of its own follows the Approval Policy alone. (It used to borrow the first lifecycle in the
 * list, so Standard and Normal changes all showed the same long path regardless of the policy.)
 */
const POLICY_ONLY_LIFECYCLE: Lifecycle = { id: "", name: "Approval Policy", desc: "", steps: [{ id: "policy", kind: "Authorize", name: "Approval policy", type: "policy" }] };
export const lifecycleOf = (cfg: ChangeSettings, type: string): Lifecycle =>
  cfg.lifecycles.find((l) => l.id === modelFor(cfg, type)?.lifecycle) ?? cfg.lifecycles.find((l) => l.name.toLowerCase().includes(baseOf(cfg, type).toLowerCase())) ?? POLICY_ONLY_LIFECYCLE;
export const hasStep = (cfg: ChangeSettings, type: string, kind: StepKind) => lifecycleOf(cfg, type).steps.some((s) => s.kind === kind);
export const activeGroup = (cfg: ChangeSettings, name: string) => cfg.approval.groups.find((g) => g.name === name && g.active);
export const isCabGroup = (cfg: ChangeSettings, name: string) => cfg.approval.groups.find((g) => g.name === name)?.type === "Board" || name === "CAB" || name === "ECAB";

/** The step's type, also for lifecycles saved before step types existed. */
export function stepType(s: LifecycleStep): StepType {
  if (s.type && STEP_TYPES.includes(s.type)) return s.type;
  switch (s.kind) {
    case "Assess": return "gate";
    case "Authorize": return s.mode === "group" ? "group" : "policy";
    case "Implement": return "implement";
    case "Review": return "review";
    default: return "close";
  }
}
export const gatesOf = (cfg: ChangeSettings, type: string): string[] =>
  lifecycleOf(cfg, type).steps.filter((s) => stepType(s) === "gate").map((s) => s.gate ?? "risk");

// ── category tree ──
/** The category and its ancestors, nearest first. */
export function categoryChain(cfg: ChangeSettings, name?: string | null): Category[] {
  const out: Category[] = [];
  let cur = cfg.categories.find((c) => c.name === name);
  while (cur && out.length < MAX_CATEGORY_DEPTH + 1 && !out.includes(cur)) { out.push(cur); cur = cur.parentId ? cfg.categories.find((c) => c.id === cur!.parentId) : undefined; }
  return out;
}
/** Default assignment group / technical board of a category: its own, otherwise the nearest ancestor's. */
export const categoryGroup = (cfg: ChangeSettings, name?: string | null) => categoryChain(cfg, name).find((c) => c.group)?.group ?? "";
export const categoryTab = (cfg: ChangeSettings, name?: string | null) => categoryChain(cfg, name).find((c) => c.tab)?.tab ?? "";
export const categoryPath = (cfg: ChangeSettings, name?: string | null) => categoryChain(cfg, name).map((c) => c.name).reverse().join(" › ");

// ── conditions ──
export type ChangeAttrs = Partial<Record<"type" | "risk" | "priority" | "category" | "service" | "outage" | "conflict" | "leadDays" | "ciCount", string | number>>;
const ORD: Record<string, string[]> = { risk: ["Low", "Moderate", "High", "Very High"] };
function ruleMet(r: CondRule, a: ChangeAttrs): boolean {
  const v = a[r.k as keyof ChangeAttrs];
  const f = COND_FIELDS.find((x) => x.id === r.k);
  if (f?.ftype === "number") { const x = Number(v) || 0, y = Number(r.value) || 0; return r.op === "gt" ? x > y : r.op === "gte" ? x >= y : r.op === "lt" ? x < y : x === y; }
  if (f?.ftype === "ord") { const o = ORD[r.k] ?? []; const x = o.indexOf(String(v ?? "")), y = o.indexOf(r.value); return r.op === "is" ? x === y : r.op === "isNot" ? x !== y : r.op === "atLeast" ? x >= y : x <= y; }
  return r.op === "isNot" ? String(v ?? "") !== r.value : String(v ?? "") === r.value;
}
export const condMet = (s: LifecycleStep, a: ChangeAttrs) => { const rs = s.rules ?? []; return !rs.length || (s.match === "any" ? rs.some((r) => ruleMet(r, a)) : rs.every((r) => ruleMet(r, a))); };

/** One approval stage of a change. Rows sharing a `stage` number are asked at the same time (parallel approvals). */
export interface PathStage {
  group: string; rule: ApprovalRuleText; stage: number;
  /** A named approver (person approval, or "person:" in a parallel step). */
  userId?: number;
  /** Role approval: the people to ask (resolved by the service). */
  role?: string;
}

/**
 * Approval stages for a change: the model's lifecycle steps in order, with conditions applied. A "policy" step expands through the
 * approval policy (Approval Policy & CAB); the other approval steps name who approves.
 */
export function approvalPath(cfg: ChangeSettings, type: string, risk: string | null | undefined, category?: string | null, ctx: ChangeAttrs = {}, onlyStepId?: string, steps?: LifecycleStep[]): PathStage[] {
  const attrs: ChangeAttrs = { ...ctx, type, risk: risk ?? "", category: category ?? "" };
  const policyStages = (): ApprovalStage[] => {
    const rules = cfg.approval.rules.filter((r) => r.active);
    const base = baseOf(cfg, type);
    const pick = (t: string) => rules.find((r) => r.type === t && r.risk === (risk ?? "")) ?? rules.find((r) => r.type === t && r.risk === "Any");
    return (pick(type) ?? (type !== base ? pick(base) : undefined))?.stages ?? [];
  };
  if (baseOf(cfg, type) === "Standard" && !onlyStepId) return []; // pre-approved template: no approval stages
  const out: PathStage[] = [];
  let stage = 0, skip = 0;
  const lifecycleSteps = steps ?? lifecycleOf(cfg, type).steps;
  const selectedSteps = onlyStepId ? lifecycleSteps.filter((st) => st.id === onlyStepId) : lifecycleSteps;
  for (const st of selectedSteps) {
    const t = stepType(st);
    if (t === "implement" && !onlyStepId) break;
    if (["gate", "review", "close"].includes(t)) continue;
    if (skip > 0) { skip--; continue; }
    switch (t) {
      case "condition": { const act = condMet(st, attrs) ? st.yes : st.no; if (act === "skip") skip = 1; break; }
      case "policy":
        for (const ps of policyStages()) {
          let g = ps.grp;
          if (g === "Category TAB") { g = categoryTab(cfg, category); if (!g) continue; }   // no board set on the category (or its parents): stage skipped
          out.push({ group: g, rule: ps.rule, stage: ++stage });
        }
        break;
      case "group": if (st.group) out.push({ group: st.group, rule: st.rule ?? "Any one member", stage: ++stage }); break;
      case "cabAgenda": out.push({ group: "CAB", rule: activeGroup(cfg, "CAB")?.defaultRule ?? "Any one member", stage: ++stage }); break;
      case "individual": if (st.userId) out.push({ group: st.who || `User ${st.userId}`, rule: "Any one member", stage: ++stage, userId: st.userId }); break;
      case "role": {
        if (st.roleId === "changeManager") out.push({ group: "Change Management", rule: "Any one member", stage: ++stage });
        else if (st.roleId === "categoryTab") { const g = categoryTab(cfg, category); if (g) out.push({ group: g, rule: "Any one member", stage: ++stage }); }
        else if (st.roleId === "assignmentGroup") out.push({ group: "Assignment group", rule: "Any one member", stage: ++stage, role: "assignmentGroup" });
        break;
      }
      case "parallel": {
        const n = ++stage, rule: ApprovalRuleText = st.prule === "any" ? "Any one member" : "All members";
        for (const a of st.approvers ?? []) {
          const [kind, ...rest] = a.split(":");
          if (kind === "group" && rest[0]) out.push({ group: rest.join(":"), rule, stage: n });
          else if (kind === "person" && Number(rest[0])) out.push({ group: rest.slice(1).join(":") || `User ${rest[0]}`, rule, stage: n, userId: Number(rest[0]) });
          else if (kind === "role" && rest[0] === "changeManager") out.push({ group: "Change Management", rule, stage: n });
          else if (kind === "role" && rest[0] === "categoryTab") { const g = categoryTab(cfg, category); if (g) out.push({ group: g, rule, stage: n }); }
        }
        break;
      }
    }
  }
  return out;
}

const LEVELS: RiskLevelName[] = ["Low", "Moderate", "High", "Very High"];
export interface RiskResult {
  score: number; max: number; level: RiskLevelName; base: RiskLevelName | ""; answered: number; total: number; complete: boolean; missing: string[];
  floors: string[]; sections: Record<RiskSection, number>; visible: Record<string, boolean>;
}
/**
 * Score the questionnaire. Answers map question id → selected option index. Inactive questions, and questions that do not apply to
 * the change's model/category or whose follow-up condition is not met, are ignored. An answer with a minimum level raises the result to at least that level.
 */
export function scoreRisk(cfg: ChangeSettings, answers: Record<string, string | number> | undefined | null, model?: string, category?: string | null): RiskResult & { level: RiskLevelName } {
  const qs = cfg.risk.questions.filter((x) => x.active);
  const cats = categoryChain(cfg, category).map((c) => c.name);
  const visible: Record<string, boolean> = {};
  const idxOf = (qn: RiskQuestion) => { const raw = answers?.[qn.id]; const i = raw === undefined || raw === null || raw === "" ? -1 : Number(raw); return Number.isInteger(i) && i >= 0 && i < qn.opts.length ? i : -1; };
  for (const qn of qs) {
    let v = (!qn.models.length || !model || qn.models.includes(model)) && (!qn.cats.length || qn.cats.some((c) => cats.includes(c)));
    if (v && qn.showIf) { const dep = qs.find((x) => x.id === qn.showIf!.q); v = !!dep && visible[dep.id] === true && idxOf(dep) === Number(qn.showIf.opt); }
    visible[qn.id] = v;
  }
  const sections: Record<RiskSection, number> = { impact: 0, likelihood: 0, readiness: 0 };
  let score = 0, max = 0, answered = 0, total = 0, need = 0, got = 0, floor = -1; const floors: string[] = []; const missing: string[] = [];
  for (const qn of qs) {
    if (!visible[qn.id]) continue;
    total++; max += Math.max(0, ...qn.opts.map((o) => o.w));
    if (qn.required) need++;
    const i = idxOf(qn);
    if (i < 0) { if (qn.required) missing.push(qn.label); continue; }
    const o = qn.opts[i]; score += o.w; sections[qn.section] = (sections[qn.section] ?? 0) + o.w; answered++; if (qn.required) got++;
    if (o.min && LEVELS.indexOf(o.min) > floor) floor = LEVELS.indexOf(o.min);
    if (o.min) floors.push(`"${o.t}" raises the risk to at least ${o.min}.`);
  }
  let base: RiskLevelName | "" = "";
  if (answered) {
    if (cfg.risk.method === "matrix") {
      const lv = (from: number[], v: number) => { let k = 0; from.forEach((f, j) => { if (v >= f) k = j; }); return k; };
      base = cfg.risk.matrix[lv(cfg.risk.impFrom, sections.impact)]?.[lv(cfg.risk.likFrom, sections.likelihood + sections.readiness)] ?? "Low";
    } else {
      const bands = [...cfg.risk.bands].sort((a, b) => a.min - b.min);
      base = (bands.find((b) => score >= b.min && score <= b.max) ?? bands[bands.length - 1])?.level ?? "Low";
    }
  }
  const level = (base ? LEVELS[Math.max(LEVELS.indexOf(base), floor)] : "Low") as RiskLevelName;
  return { score, max, level, base, answered, total, complete: got === need, missing, floors, sections, visible };
}

/** ITIL-style priority from impact x urgency (High/Medium/Low). */
export function derivePriority(impact?: string | null, urgency?: string | null): string | undefined {
  const rank = (v?: string | null) => ({ high: 1, medium: 2, low: 3 } as Record<string, number>)[(v ?? "").toLowerCase()];
  const i = rank(impact), u = rank(urgency);
  if (!i || !u) return undefined;
  return ["", "P1 - Critical", "P2 - High", "P3 - Moderate", "P4 - Low", "P5 - Planning"][Math.min(i + u - 1, 5)];
}

/** Is a post-implementation review required before closing, per the model's rule and the close code? */
export function pirRequired(cfg: ChangeSettings, type: string, risk: string | null | undefined, outcome: string | null | undefined, closeCode?: string): boolean {
  const failed = FAILED_OUTCOMES.includes(outcome ?? "");
  const rule = modelFor(cfg, type)?.pir ?? "Only if unsuccessful";
  const byRule = rule === "Always" ? true : rule === "Never" ? false : rule === "Only if unsuccessful" ? failed : failed || risk === "High" || risk === "Very High";
  return byRule || !!cfg.closeCodes.find((c) => c.name === closeCode)?.pir;
}

/**
 * Settings saved before the category tree, the new risk questionnaire, lifecycle step types and e-mail formats existed are
 * upgraded on read, so nothing needs a data migration and old values keep working.
 */
export function normalizeSettings(cfg: ChangeSettings): ChangeSettings {
  const d = defaults();
  cfg.categories = (cfg.categories ?? d.categories).map((c) => ({ id: c.id, name: c.name, parentId: c.parentId ?? null, desc: c.desc ?? "", group: c.group ?? "", tab: c.tab ?? "", active: c.active !== false }));
  cfg.closeCodes = (cfg.closeCodes ?? d.closeCodes).map((c) => ({ ...c, desc: c.desc ?? "" }));
  // A change needs more than one way to end: make sure the four standard outcomes always exist (existing codes are kept as-is).
  const have = new Set(cfg.closeCodes.map((c) => c.name.toLowerCase()));
  for (const c of STANDARD_CLOSE_CODES) if (!have.has(c.name.toLowerCase())) cfg.closeCodes.push({ ...c });
  const r: any = cfg.risk ?? d.risk;
  cfg.risk = {
    ...d.risk, ...r,
    questions: (r.questions ?? d.risk.questions).map((q: any) => ({
      section: "impact", help: "", type: "single", required: true, active: true, models: [], cats: [], showIf: null, ...q,
      opts: (q.opts ?? []).map((o: any) => ({ min: "", ...o })),
    })),
    settings: { ...d.risk.settings, ...(r.settings ?? {}) },
  };
  for (const k of ["bands", "impFrom", "likFrom", "matrix"] as const) if (!Array.isArray((cfg.risk as any)[k])) (cfg.risk as any)[k] = (d.risk as any)[k];
  cfg.lifecycles = (cfg.lifecycles ?? d.lifecycles).map((l) => ({ ...l, steps: l.steps.map((s) => { const t = stepType(s); return { ...s, type: t, kind: KIND_OF_TYPE[t] }; }) }));
  cfg.notifications = (cfg.notifications?.length ? cfg.notifications : DEFAULT_NOTIFICATIONS.map((e) => ({ ...e, recipients: [...e.recipients] }))).map((e) => ({ ...e, format: e.format === "html" ? "html" : "text" }));
  cfg.stateTransitions = cfg.stateTransitions ?? d.stateTransitions;
  return cfg;
}

export const STANDARD_CLOSE_CODES: CloseCode[] = [
  { id: "cc-successful", name: "Successful", desc: "Implemented as planned.", color: "#12B76A", pir: false, active: true },
  { id: "cc-successful-issues", name: "Successful with issues", desc: "Implemented, but problems had to be worked around.", color: "#F79009", pir: false, active: true },
  { id: "cc-unsuccessful", name: "Unsuccessful", desc: "The change did not achieve its goal.", color: "#F04438", pir: true, active: true },
  { id: "cc-backed-out", name: "Backed out", desc: "The change was rolled back.", color: "#7A5AF8", pir: true, active: true },
];

/** Approver / CAB / implementer notifications used when none have been configured (ids match the events the service raises). */
const ev = (id: string, grp: string, name: string, when: string, recipients: string[], subject: string, body: string): NotificationEvent =>
  ({ id, grp, name, when, on: true, recipients, subject, body, format: "text" });
export const DEFAULT_NOTIFICATIONS: NotificationEvent[] = [
  ev("e2", "Approvals", "Approval requested", "A stage of the approval path is waiting for a decision", ["Current approvers"], "[{{number}}] Approval needed: {{short_description}}", "Change {{number}} ({{type}}, risk {{risk}}) needs your decision.\n{{link}}"),
  ev("e4", "Approvals", "Change approved", "All approvals are in", ["Requester", "Change owner"], "[{{number}}] Approved: {{short_description}}", "Change {{number}} was approved by {{approver}}.\n{{link}}"),
  ev("e5", "Approvals", "Change rejected", "An approver rejects the change", ["Requester", "Change owner"], "[{{number}}] Rejected: {{short_description}}", "Change {{number}} was rejected by {{approver}}.\n{{comments}}\n{{link}}"),
  ev("e6", "Approvals", "More information requested", "An approver asks for more information", ["Requester", "Change owner"], "[{{number}}] Information requested: {{short_description}}", "{{approver}} asked: {{comments}}\n{{link}}"),
  ev("e8", "CAB", "CAB review requested", "A change is put on a CAB agenda", ["CAB members"], "[{{number}}] For CAB review: {{short_description}}", "Change {{number}} is on the CAB agenda.\n{{link}}"),
  ev("e11", "Implementation", "Implementation started", "Implementation begins", ["Requester", "Assignment group"], "[{{number}}] Implementation started", "Implementation of {{number}} has started.\n{{link}}"),
  ev("e13", "Implementation", "Implementation failed", "A change ends unsuccessfully or is backed out", ["Change manager", "Requester"], "[{{number}}] Implementation unsuccessful", "Change {{number}} did not complete successfully.\n{{link}}"),
];
