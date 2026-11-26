import { api } from "./api";

/** A change model name — Standard, Normal and Emergency by default; more can be added in Change Models. */
export type ChangeType = string;
export type ChangeState = "New" | "Assess" | "Authorize" | "Scheduled" | "Implement" | "Review" | "Closed" | "Cancelled";
export type RiskLevel = "Low" | "Moderate" | "High" | "Very High";

interface UserRef { userId: number; firstName?: string; lastName?: string; username?: string }

export interface ChangeApproval {
  id: number; stage: number; approvalGroup: string; rule?: string | null;
  approver?: UserRef | null; status: "Pending" | "Approved" | "Rejected" | "Not required"; comment?: string | null; decidedAt?: string | null;
  change?: Change;
}
export interface ChangeTask {
  id: number; taskCode: string; shortDescription: string; assignmentGroup?: string | null;
  assignedTo?: UserRef | null; state: "Open" | "In Progress" | "Closed" | "Cancelled";
}
export interface ChangeWorkNote { id: number; note: string; author?: UserRef | null; createdAt: string }

export interface Change {
  changeId: number; changeCode: string; shortDescription: string; description?: string | null;
  changeType: ChangeType; state: ChangeState; status: string;
  category?: string | null; businessService?: string | null; configurationItems: string[]; assignmentGroup?: string | null;
  assignedTo?: UserRef | null; requestedBy?: UserRef | null;
  impact?: string | null; urgency?: string | null; priority?: string | null; justification?: string | null;
  riskAnswers: Record<string, string>; riskScore?: number | null; riskLevel?: RiskLevel | null;
  plannedStart?: string | null; plannedEnd?: string | null; actualStart?: string | null; actualEnd?: string | null;
  causesOutage: boolean; expectedOutage?: string | null;
  implementationPlan?: string | null; backoutPlan?: string | null; testPlan?: string | null; communicationPlan?: string | null;
  implementationOutcome?: string | null; implementationNotes?: string | null; pir?: Record<string, string> | null;
  closeCode?: string | null; closeNotes?: string | null; templateId?: string | null;
  relatedRecords: { kind: string; number: string; title?: string }[];
  createdAt: string; updatedAt: string; cabReviewedAt?: string | null;
  approvals?: ChangeApproval[]; tasks?: ChangeTask[]; workNotes?: ChangeWorkNote[];
  /** Only on the record view and the schedule. */
  conflicts?: Conflict[];
}

export interface Conflict { kind: "Blackout" | "Change" | "Maintenance"; text: string; ref?: string }

export type BaseType = "Standard" | "Normal" | "Emergency";
export type RuleText = "Any one member" | "Majority of members" | "All members";
export const RULES: RuleText[] = ["Any one member", "Majority of members", "All members"];
export const PIR_RULES = ["Always", "High risk and unsuccessful changes", "Only if unsuccessful", "Never"] as const;
export const COLORS = ["green", "blue", "amber", "red", "violet"] as const;
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface ChangeModel { id: string; name: string; desc: string; leadDays: number; color: string; active: boolean; base: BaseType; lifecycle: string; pir: (typeof PIR_RULES)[number]; linkIncident: boolean }
export interface Category { id: string; name: string; parentId: string | null; desc: string; group: string; tab: string; active: boolean }
export const MAX_CATEGORY_DEPTH = 5;
export interface CloseCode { id: string; name: string; desc: string; color: string; pir: boolean; active: boolean }
export type RiskSection = "impact" | "likelihood" | "readiness";
export interface RiskOption { t: string; w: number; min: "" | RiskLevel }
export interface RiskQuestion {
  id: string; section: RiskSection; label: string; help: string; type: "single" | "yesno" | "dropdown"; required: boolean; active: boolean;
  models: string[]; cats: string[]; showIf: { q: string; opt: number } | null; opts: RiskOption[];
}
export interface RiskSettings { requiredFor: string[]; emgAfter: boolean; override: boolean; overrideReason: boolean; overrideDownOnly: boolean; reassess: boolean; showScore: boolean; history: boolean; reviewMonths: number }
export interface RiskConfig {
  questions: RiskQuestion[]; bands: { level: RiskLevel; min: number; max: number }[];
  method: "sum" | "matrix"; impFrom: number[]; likFrom: number[]; matrix: RiskLevel[][]; settings: RiskSettings;
}
export interface StandardTemplate {
  id: string; name: string; category: string; service: string; group: string; owner: string; status: "Proposed" | "Active" | "Under review" | "Retired";
  description: string; implementationPlan: string; backoutPlan: string; testPlan: string; authorised: string; nextReview: string; uses: number; failed: number;
}
export interface GroupMember { userId: number; name: string }
export interface ApprovalGroup {
  id: string; name: string; desc: string; type: "Approval group" | "Board" | "Technical board"; email: string; members: GroupMember[]; lead: number | null;
  defaultRule: RuleText; meets: string; meetDay: number | null; meetTime: string; quorum: number; active: boolean;
}
export interface ApprovalRule { id: string; type: string; risk: "Any" | RiskLevel; stages: { grp: string; rule: RuleText }[]; active: boolean }
export interface ApprovalConfig { groups: ApprovalGroup[]; rules: ApprovalRule[]; settings: { noSelf: boolean; reapprove: boolean; remindHours: number; escalateHours: number } }
export interface ChangeWindow {
  id: string; name: string; kind: "Blackout" | "Maintenance"; scope: string; desc: string; allowEmergency: boolean; active: boolean;
  start?: string; end?: string; day?: number; from?: string; to?: string;
}
export type StepKind = "Assess" | "Authorize" | "Implement" | "Review" | "Close";
export type StepType = "gate" | "policy" | "individual" | "group" | "role" | "parallel" | "condition" | "wait" | "email" | "cabAgenda" | "update" | "task" | "record" | "integration" | "implement" | "review" | "close";
export interface CondRule { k: string; op: string; value: string }
export interface LifecycleStep {
  id: string; kind: StepKind; name: string; type?: StepType; mode?: "policy" | "group"; group?: string; rule?: RuleText;
  userId?: number; who?: string; roleId?: "changeManager" | "categoryTab" | "assignmentGroup"; approvers?: string[]; prule?: "all" | "any";
  match?: "all" | "any"; rules?: CondRule[]; yes?: "next" | "skip"; no?: "next" | "skip"; gate?: "risk" | "plans" | "conflict" | "leadtime" | "cis" | "incident";
  waitMinutes?: number; recipients?: string[]; subject?: string; body?: string;
  updateField?: "shortDescription" | "description" | "priority" | "category" | "businessService" | "impact" | "urgency" | "justification" | "communicationPlan"; updateValue?: string;
  taskName?: string; taskGroup?: string; taskAssignedToId?: number | null;
  recordType?: "Change"; recordTitle?: string; recordDescription?: string; integrationUrl?: string;
}
export interface Lifecycle { id: string; name: string; desc: string; steps: LifecycleStep[] }
export interface NotificationEvent { id: string; grp: string; name: string; when: string; on: boolean; recipients: string[]; subject: string; body: string; format: "html" | "text" }
export type ChangeProcessState = Exclude<ChangeState, "Cancelled">;
export type StateExitRequirement = "risk" | "cis" | "implementationPlan" | "backoutPlan" | "testPlan" | "plannedWindow" | "conflict" | "approvals" | "tasks" | "outcome" | "pir" | "closeCode";
export interface StateTransitionRow {
  state: ChangeProcessState; inUse: boolean; purpose: string; movedOnBy: string; requirements: StateExitRequirement[]; canCancel: boolean;
}
export interface AutomaticStateTransitions {
  approvalToScheduled: boolean; implementAtPlannedStart: boolean; blockBlackout: boolean; closeAfterReviewDays: number; overrunReminderMinutes: number;
}
export interface ModelStateTransitions { model: string; states: StateTransitionRow[]; automatic: AutomaticStateTransitions }

export interface ChangeConfig {
  models: ChangeModel[]; categories: Category[]; closeCodes: CloseCode[]; risk: RiskConfig; templates: StandardTemplate[];
  approval: ApprovalConfig; windows: ChangeWindow[]; lifecycles: Lifecycle[]; notifications: NotificationEvent[];
  stateTransitions: ModelStateTransitions[]; outcomes: string[]; impacts: string[]; urgencies: string[]; services: string[]; recipientKinds: string[]; notificationFields: string[];
  notificationTriggers: Pick<NotificationEvent, "id" | "grp" | "name" | "when">[];
  condFields: { id: string; label: string; ftype: "select" | "ord" | "yesno" | "number"; opts?: string[] }[];
}
export type ConfigKey = "models" | "categories" | "closeCodes" | "risk" | "templates" | "approval" | "windows" | "lifecycles" | "notifications" | "stateTransitions";

export interface Overview {
  tiles: { open: number; awaitingDecision: number; goingLive: number; inReview: number; emergencyShare: number | null; emergencies: number; recent: number };
  attention: { kind: string; changeId: number; changeCode: string; title: string; text: string }[]; attentionCount: number;
  upcoming: Change[]; byState: { state: ChangeState; count: number }[];
  typeRisk: { levels: string[]; rows: { type: string; counts: number[]; unassessed: number }[] };
  outcomes: { code: string; count: number }[];
}
export interface Simulation { model: string; lifecycle: string | null; steps: LifecycleStep[]; approvalPath: { group: string; rule: string; members: number; stage: number }[]; gates: string[]; leadDays: number; reviewRequired: boolean; executionPlan: { stepId: string; name: string; type: StepType; detail: string }[] }
export interface ChangePreview {
  risk: { score: number | null; level: RiskLevel | null; answered: number; total: number; complete: boolean; max: number; floors: string[]; visible: Record<string, boolean>; sections: Record<RiskSection, number>; base: RiskLevel | null };
  defaultGroup: string | null;
  priority: string | null;
  approvalPath: { group: string; rule: string; members: number; stage: number }[];
  conflicts: Conflict[];
  leadDays: number; leadTimeOk: boolean;
}
export interface ScheduleResult {
  changes: Change[];
  windows: { id: string; name: string; kind: "Blackout" | "Maintenance"; scope: string; start: string; end: string }[];
}
export interface CabMeeting {
  id: number; title: string; scheduledAt: string; location?: string; chair?: string; status: "Planned" | "In Progress" | "Ended";
  attendance: { name: string; role: string; present: boolean }[]; minutes?: string | null; endedAt?: string | null;
}
export interface Workbench {
  meeting: CabMeeting; quorum: { present: number; total: number; need: number; met: boolean }; policy: string; membersConfigured: boolean;
  authorisation: { change: Change; earlierApprovals: ChangeApproval[]; conflicts: Conflict[] }[];
  emergencies: Change[]; pirs: Change[]; forward: Change[]; history: CabMeeting[];
}

export interface ChangeListQuery { type?: string; risk?: string; state?: string; group?: string; q?: string; from?: string; to?: string }
export type ChangeInput = Partial<Omit<Change, "changeId" | "changeCode" | "state" | "status" | "assignedTo" | "requestedBy" | "approvals" | "tasks" | "workNotes" | "createdAt" | "updatedAt">>
  & { assignedToId?: number; submit?: boolean };

const qs = (q: ChangeListQuery) => {
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : "";
};
export const userName = (u?: UserRef | null) => (u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "—" : "—");

export const changeApi = {
  list: (q: ChangeListQuery = {}) => api.get<Change[]>(`/changes${qs(q)}`),
  get: (id: number | string) => api.get<Change>(`/changes/${id}`),
  create: (d: ChangeInput & { changeType?: ChangeType; shortDescription: string }) => api.post<Change>("/changes", d),
  update: (id: number, d: ChangeInput) => api.patch<Change>(`/changes/${id}`, d),
  submit: (id: number) => api.post<Change>(`/changes/${id}/submit`),
  cancel: (id: number, reason?: string) => api.post<Change>(`/changes/${id}/cancel`, { reason }),
  startImplementation: (id: number) => api.post<Change>(`/changes/${id}/implementation/start`),
  completeImplementation: (id: number, d: { outcome: string; actualEnd?: string; notes?: string }) => api.post<Change>(`/changes/${id}/implementation/complete`, d),
  savePir: (id: number, d: Record<string, string>) => api.post<Change>(`/changes/${id}/pir`, d),
  close: (id: number, d: { closeCode: string; closeNotes?: string }) => api.post<Change>(`/changes/${id}/close`, d),
  addTask: (id: number, d: { shortDescription: string; assignmentGroup?: string; assignedToId?: number }) => api.post<Change>(`/changes/${id}/tasks`, d),
  updateTask: (id: number, taskId: number, d: Partial<{ state: string; assignmentGroup: string; assignedToId: number }>) => api.patch<Change>(`/changes/${id}/tasks/${taskId}`, d),
  addNote: (id: number, note: string) => api.post<Change>(`/changes/${id}/notes`, { note }),
  config: () => api.get<ChangeConfig>("/changes/config").then((c) => {
    const config = { ...c, stateTransitions: c.stateTransitions ?? [] };
    setModelColors(config.models);
    return config;
  }),
  preview: (d: Record<string, unknown>) => api.post<ChangePreview>("/changes/preview", d),
  schedule: (from: string, to: string) => api.get<ScheduleResult>(`/changes/schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  workbench: () => api.get<Workbench>("/changes/cab/workbench"),
  startMeeting: (id: number) => api.post<CabMeeting>(`/changes/cab/meetings/${id}/start`),
  setAttendance: (id: number, attendance: CabMeeting["attendance"]) => api.post<CabMeeting>(`/changes/cab/meetings/${id}/attendance`, { attendance }),
  endMeeting: (id: number, minutes: string) => api.post<CabMeeting>(`/changes/cab/meetings/${id}/end`, { minutes }),
  cabDecision: (meetingId: number, changeId: number, decision: "Approved" | "Rejected", comment?: string) =>
    api.post<Change>(`/changes/cab/meetings/${meetingId}/decisions`, { changeId, decision, comment }),
  requestInfo: (id: number, comment: string) => api.post<Change>(`/changes/${id}/request-info`, { comment }),
  overview: () => api.get<Overview>("/changes/overview"),
  saveConfig: <T = unknown>(key: ConfigKey, value: unknown) => api.put<T>(`/changes/config/${key}`, value),
  simulate: (changeType: string, risk?: string, category?: string, attrs?: Record<string, string | number>, lifecycleId?: string) => api.post<Simulation>("/changes/config/simulate", { changeType, risk, category, attrs, lifecycleId }),
  workgroups: () => api.get<{ groupId: number; groupName: string }[]>("/changes/workgroups"),
  blockedApprovals: () => api.get<{ changeId: number; changeCode: string; shortDescription: string; approvalGroup: string }[]>("/changes/approvals/blocked"),
  myApprovals: () => api.get<ChangeApproval[]>("/changes/approvals/mine"),
  decide: (approvalId: number, decision: "Approved" | "Rejected", comment?: string) =>
    api.post<Change>(`/changes/approvals/${approvalId}/decision`, { decision, comment }),
};

export const CHANGE_STATES: ChangeState[] = ["New", "Assess", "Authorize", "Scheduled", "Implement", "Review", "Closed", "Cancelled"];

export const RISK_COLOR: Record<RiskLevel, { bg: string; color: string }> = {
  Low: { bg: "#ECFDF3", color: "#027A48" }, Moderate: { bg: "#FFFAEB", color: "#B54708" },
  High: { bg: "#FEF3F2", color: "#B42318" }, "Very High": { bg: "#FEE4E2", color: "#912018" },
};
export const STATE_COLOR: Record<ChangeState, { bg: string; color: string }> = {
  New: { bg: "#F2F4F7", color: "#344054" }, Assess: { bg: "#EFF8FF", color: "#175CD3" }, Authorize: { bg: "#FFFAEB", color: "#B54708" },
  Scheduled: { bg: "#F4F3FF", color: "#5925DC" }, Implement: { bg: "#EFF8FF", color: "#175CD3" }, Review: { bg: "#FDF2FA", color: "#C11574" },
  Closed: { bg: "#ECFDF3", color: "#027A48" }, Cancelled: { bg: "#F2F4F7", color: "#667085" },
};

/** Two changes conflict when their planned windows overlap; used by the list and (later) the schedule. */
export function windowsOverlap(a: Change, b: Change): boolean {
  if (!a.plannedStart || !a.plannedEnd || !b.plannedStart || !b.plannedEnd) return false;
  return new Date(a.plannedStart) < new Date(b.plannedEnd) && new Date(b.plannedStart) < new Date(a.plannedEnd);
}

// ── datetime-local <-> ISO ──
const p2 = (n: number) => String(n).padStart(2, "0");
export const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);
export const fmtDT = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${p2(d.getDate())} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
export const fmtD = (iso?: string | null) => (iso ? fmtDT(iso).slice(0, 11) : "—");
const COLOR_SET: Record<string, { bg: string; color: string }> = {
  green: { bg: "#ECFDF3", color: "#027A48" }, blue: { bg: "#EFF8FF", color: "#175CD3" }, amber: { bg: "#FFFAEB", color: "#B54708" },
  red: { bg: "#FEF3F2", color: "#B42318" }, violet: { bg: "#F4F3FF", color: "#5925DC" }, gray: { bg: "#F2F4F7", color: "#344054" },
};
export const colorSet = (name?: string) => COLOR_SET[name ?? ""] ?? COLOR_SET.gray;
const modelColor: Record<string, string> = {};
export function setModelColors(models: ChangeModel[]) {
  for (const name of Object.keys(modelColor)) delete modelColor[name];
  for (const model of models) modelColor[model.name] = model.color;
}
/** Pill colours for a change model name (kept in sync with Change Models once the configuration has loaded). */
export const typeColor = (t: string) => colorSet(modelColor[t]);

/** Category tree helpers: names are unique, so a change stores the name; the path shows where it sits. */
export function categoryPath(list: Category[], name?: string | null): string {
  const out: string[] = []; let cur = list.find((c) => c.name === name);
  while (cur && out.length < 6) { out.unshift(cur.name); const pid: string | null = cur.parentId; cur = pid ? list.find((c) => c.id === pid) : undefined; }
  return out.join(" › ");
}
/** Categories in tree order (parents before children) with their depth (1 = top level). */
export function categoryRows(list: Category[]): { c: Category; depth: number }[] {
  const out: { c: Category; depth: number }[] = [];
  const walk = (pid: string | null, depth: number) => list.filter((c) => (c.parentId ?? null) === pid).forEach((c) => { out.push({ c, depth }); if (depth < 6) walk(c.id, depth + 1); });
  walk(null, 1);
  return out;
}
/** Default assignment group of a category: its own, otherwise the nearest parent's. */
export function categoryGroup(list: Category[], name?: string | null): string {
  let cur = list.find((c) => c.name === name), n = 0;
  while (cur && n++ < 6) { if (cur.group) return cur.group; const pid: string | null = cur.parentId; cur = pid ? list.find((c) => c.id === pid) : undefined; }
  return "";
}
