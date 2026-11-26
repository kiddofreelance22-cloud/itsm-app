import React, { useEffect, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Clock,
  GitFork, Link2, Mail, Pencil, Plug, Plus, Sliders, Trash2, UserCheck, Users, X,
} from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, TH, errMsg } from "../components/configKit";
import { lifecycleApi, requestConfigApi, serviceRequestApi, type Lifecycle, type LifecycleScope, type LifecycleStep } from "../requestsApi";
import { Pill } from "../components/serviceRequestKit";
import { Link } from "../router";

type ApproverType = "user" | "group" | "role" | "custom" | "requester_manager" | "parallel";
type ApprovalRule = "any" | "majority" | "all";
interface PEntry { type: Exclude<ApproverType, "parallel">; ref: number | null; label: string }
/** Approver resolved per request from the requester's own profile (no fixed person). */
const MANAGER_LABEL = "Requester's reporting manager";
interface DTask { taskName: string; description: string; assigneeType: "group" | "role"; assigneeId: number | null; dueDateHours: string; priority: "low" | "medium" | "high" | "critical" }
interface DStep {
  key: string; kind: "approval" | "condition" | "task" | "email" | "update" | "wait" | "record" | "integration"; name: string;
  approverType: ApproverType; approverId: number | null; approverLabel: string;
  field: string; operator: string; value: string; yesTo: string; noTo: string;
  tasks: DTask[];
  onReject: RejectOutcome; rejectArg: string; rejectLabel: string;
  approvalRule: ApprovalRule; parallel: PEntry[];
  onApprove: ApproveOutcome; approveArg: string; approveLabel: string;
  commentPolicy: "optional" | "reject" | "both"; allowReject: boolean; allowInfo: boolean; allowDelegate: boolean;
  remindDays: number; timeoutDays: number; onTimeout: "escalate" | "approve" | "reject"; timeoutArg: string; timeoutLabel: string;
  emailRuleId: number | null; emailTo: string[];
  waitDays: number;
  recType: "incident" | "change" | "problem" | "work_order" | "request"; recTitle: string; recDescription: string; recPriority: string; recPriorityId: number | null; recCatalogId: number | null;
  intKind: "webhook" | "teams"; intUrl: string; intSecret: string;
  updField: "priority" | "assignmentGroup" | "agent"; updValue: number | null; updLabel: string;
}
type ApproveOutcome = "next" | "fulfil" | "step" | "notify" | "priority" | "assign" | "reroute" | "task" | "auto";
const STEP_TYPE: Record<DStep["kind"], LifecycleStep["stepType"]> = { approval: "approval", condition: "condition", task: "task", email: "notification", update: "update", wait: "wait", record: "record", integration: "integration" };
type RejectOutcome = "close" | "rework" | "back" | "escalate" | "continue";
const OPERATORS = [
  "is greater than",
  "is less than",
  "is at least",
  "is at most",
  "equals",
  "not equals",
  "contains",
  "is true",
  "is false",
  "is empty",
  "is not empty",
  ">",
  "<",
  ">=",
  "<=",
];
const NO_VALUE = ["is true", "is false", "is empty", "is not empty"];
const KIND_LABEL: Record<DStep["kind"], string> = { approval: "Approval", condition: "Condition", task: "Task", email: "E-mail", update: "Update request", wait: "Wait / timer", record: "Create related record", integration: "Run integration" };
let seq = 0;
const newKey = () => `n${Date.now()}_${seq++}`;

const blankStep = (kind: DStep["kind"]): DStep => ({
  key: newKey(), kind, name: kind === "condition" ? "Estimated cost check" : "",
  approverType: "user", approverId: null, approverLabel: "",
  field: kind === "condition" ? "Estimated cost" : "",
  operator: "is greater than",
  value: kind === "condition" ? "$1,000" : "",
  yesTo: kind === "condition" ? "fulfil_auto" : "",
  noTo: kind === "condition" ? "fulfilment" : "",
  tasks: kind === "task" ? [blankTask()] : [],
  onReject: "close", rejectArg: "", rejectLabel: "",
  approvalRule: "any", parallel: [],
  onApprove: "next", approveArg: "", approveLabel: "",
  commentPolicy: "reject", allowReject: true, allowInfo: true, allowDelegate: false,
  remindDays: 0, timeoutDays: 0, onTimeout: "escalate", timeoutArg: "", timeoutLabel: "",
  emailRuleId: null, emailTo: ["requester"],
  waitDays: 1,
  recType: "work_order", recTitle: "", recDescription: "", recPriority: "", recPriorityId: null, recCatalogId: null,
  intKind: "webhook", intUrl: "", intSecret: "",
  updField: "priority", updValue: null, updLabel: "",
});
const blankTask = (): DTask => ({ taskName: "", description: "", assigneeType: "group", assigneeId: null, dueDateHours: "", priority: "medium" });

const TEMPLATES: { id: string; label: string; desc: string; build: () => DStep[] }[] = [
  { id: "blank", label: "No approval", desc: "Pre-approved. Requests go straight to fulfilment.", build: () => [] },
  { id: "one", label: "One approval", desc: "A single approver signs off, then the request is fulfilled.", build: () => [{ ...blankStep("approval"), name: "Reporting manager approval", approverType: "requester_manager", approverLabel: MANAGER_LABEL }] },
  { id: "two", label: "Two approvals", desc: "A manager approves first, then a second approver such as Finance.", build: () => [{ ...blankStep("approval"), name: "Reporting manager approval", approverType: "requester_manager", approverLabel: MANAGER_LABEL }, { ...blankStep("approval"), name: "Finance approval", approverType: "user" }] },
  { id: "cost", label: "Cost condition check", desc: "If Estimated cost is > $1,000 route to manager approval; otherwise fulfil automatically.", build: () => [{ ...blankStep("condition"), name: "Estimated cost check", field: "Estimated cost", operator: "is greater than", value: "$1,000", yesTo: "", noTo: "fulfil_auto" }, { ...blankStep("approval"), name: "Reporting manager approval", approverType: "requester_manager", approverLabel: MANAGER_LABEL }, { ...blankStep("task"), name: "Fulfil the request" }] },
  { id: "task", label: "Approval, then a task", desc: "One approval, then a fulfilment task for a workgroup.", build: () => [{ ...blankStep("approval"), name: "Reporting manager approval", approverType: "requester_manager", approverLabel: MANAGER_LABEL }, { ...blankStep("task"), name: "Fulfil the request" }] },
];

function parseCondition(expr?: string | null): Pick<DStep, "field" | "operator" | "value"> {
  const text = expr ?? ""; const lower = text.toLowerCase();
  const sortedOps = [
    " is greater than ", " is less than ", " is at least ", " is at most ",
    " not equals ", " equals ", " contains ", " is true", " is false",
    " is empty", " is not empty",
    " >= ", " <= ", " != ", " == ", " > ", " < "
  ];
  const op = sortedOps.find((candidate) => lower.includes(candidate));
  if (!op) return { field: text, operator: "is greater than", value: "" };
  const index = lower.indexOf(op);
  let operator = op.trim();
  if (operator === "==") operator = "equals";
  if (operator === "!=") operator = "not equals";
  return { field: text.slice(0, index).trim(), operator, value: text.slice(index + op.length).trim() };
}
const buildCondition = (s: DStep) => (NO_VALUE.includes(s.operator) ? `${s.field.trim()} ${s.operator}` : `${s.field.trim()} ${s.operator} ${s.value.trim()}`);

async function loadDraft(wf: Lifecycle): Promise<{ steps: DStep[]; unsupported: string[] }> {
  const ordered = [...wf.steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const unsupported = ordered.filter((s) => !["approval", "condition", "task", "notification", "update", "wait", "record", "integration"].includes(s.stepType)).map((s) => `${s.stepName} (${s.stepType})`);
  const out: DStep[] = [];
  const levelKey = new Map<number, string>();
  const userIds = new Set(ordered.flatMap((s) => s.approvalLevels ?? [])
    .filter((level) => level.approverType === "user" && level.approverId != null)
    .map((level) => level.approverId!));
  for (const step of ordered.filter((item) => item.stepType === "update")) {
    const config = step.config as { field?: string; value?: unknown } | null;
    const userId = Number(config?.value);
    if (config?.field === "agent" && Number.isInteger(userId) && userId > 0) userIds.add(userId);
  }
  const userNames = new Map<number, string>();
  const groupIds = new Set(ordered.flatMap((s) => s.approvalLevels ?? [])
    .filter((level) => level.approverType === "group" && level.approverId != null)
    .map((level) => level.approverId!));
  await Promise.all([...userIds].map(async (id) => {
    const user = await api.get<{ fullName?: string; displayName?: string; firstName?: string; lastName?: string; username?: string }>(`/users/${id}`);
    const name = user.displayName?.trim()
      || user.fullName?.trim()
      || [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
      || user.username?.trim();
    if (name) userNames.set(id, name);
  }));
  const groupNames = new Map<number, string>();
  if (groupIds.size) {
    const groups = await api.get<{ approverGroupId: number; groupName: string }[]>("/approver-groups");
    for (const group of groups) if (groupIds.has(group.approverGroupId)) groupNames.set(group.approverGroupId, group.groupName);
  }
  for (const s of ordered) {
    if (s.stepType === "approval") {
      const levels = [...(s.approvalLevels ?? [])].sort((a, b) => a.levelNumber - b.levelNumber);
      if (levels.length === 0 && s.approverRole) out.push({ ...blankStep("approval"), key: `s${s.workflowStepId}`, name: s.stepName, approverType: "role", approverId: s.approverRole.roleId, approverLabel: s.approverRole.roleName });
      levels.forEach((l, i) => out.push({ ...blankStep("approval"), key: i === 0 ? `s${s.workflowStepId}` : newKey(), name: l.title || s.stepName, approverType: l.approverType, approverId: l.approverType === "custom" ? l.customGroup?.groupId ?? null : l.approverId ?? null, approverLabel: l.approverType === "requester_manager" ? MANAGER_LABEL : l.approverType === "user" ? userNames.get(l.approverId ?? -1) ?? "" : l.approverType === "group" ? groupNames.get(l.approverId ?? -1) ?? "" : l.customGroup?.groupName ?? "", commentPolicy: l.commentPolicy ?? "reject", allowReject: l.allowReject !== false, allowInfo: l.allowInfo !== false, allowDelegate: !!l.allowDelegate, remindDays: l.remindDays ?? 0, timeoutDays: l.timeoutDays ?? 0, onTimeout: l.onTimeout ?? "escalate", timeoutArg: l.timeoutArg ?? "", timeoutLabel: l.timeoutArg ? escalateName(l.timeoutArg) : "", onApprove: l.onApprove ?? "next", approveArg: l.onApprove === "step" ? `s${l.approveArg ?? ""}` : l.approveArg ?? "", approveLabel: l.onApprove === "notify" && l.approveArg ? escalateName(l.approveArg) : "", approvalRule: l.approvalRule ?? "any", parallel: (l.approvers ?? []).map((a) => ({ type: a.type, ref: a.ref ?? null, label: a.label ?? "" })), onReject: l.onReject ?? "close", rejectArg: l.rejectArg ?? "", rejectLabel: l.onReject === "escalate" && l.rejectArg ? escalateName(l.rejectArg) : "" }));
      levels.forEach((l, i) => { if (l.approvalLevelId) levelKey.set(l.approvalLevelId, i === 0 ? `s${s.workflowStepId}` : out[out.length - levels.length + i].key); });
    } else if (s.stepType === "task") {
      const tasks = await lifecycleApi.tasks(wf.workflowId, s.workflowStepId);
      out.push({ ...blankStep("task"), key: `s${s.workflowStepId}`, name: s.stepName, tasks: tasks.map((t) => ({ taskName: t.taskName, description: t.description ?? "", assigneeType: t.assigneeType === "role" ? "role" : "group", assigneeId: t.assigneeId ?? null, dueDateHours: t.dueDateHours ? String(t.dueDateHours) : "", priority: t.priority ?? "medium" })) });
    } else if (s.stepType === "notification") {
      const cfg = (s.config ?? {}) as { ruleId?: number; to?: string[] };
      out.push({ ...blankStep("email"), key: `s${s.workflowStepId}`, name: s.stepName, emailRuleId: cfg.ruleId ?? null, emailTo: cfg.to?.length ? cfg.to : ["requester"] });
    } else if (s.stepType === "wait") {
      out.push({ ...blankStep("wait"), key: `s${s.workflowStepId}`, name: s.stepName, waitDays: Number((s.config as { days?: number } | null)?.days) || 1 });
    } else if (s.stepType === "record") {
      const cfg = (s.config ?? {}) as { recordType?: DStep["recType"]; title?: string; description?: string; priority?: string; priorityId?: number; catalogId?: number };
      out.push({ ...blankStep("record"), key: `s${s.workflowStepId}`, name: s.stepName, recType: cfg.recordType ?? "work_order", recTitle: cfg.title ?? "", recDescription: cfg.description ?? "", recPriority: cfg.priority ?? "", recPriorityId: cfg.priorityId ?? null, recCatalogId: cfg.catalogId ?? null });
    } else if (s.stepType === "integration") {
      const cfg = (s.config ?? {}) as { kind?: DStep["intKind"]; url?: string; secret?: string };
      out.push({ ...blankStep("integration"), key: `s${s.workflowStepId}`, name: s.stepName, intKind: cfg.kind ?? "webhook", intUrl: cfg.url ?? "", intSecret: cfg.secret ?? "" });
    } else if (s.stepType === "update") {
      const cfg = (s.config ?? {}) as { field?: DStep["updField"]; value?: number };
      out.push({ ...blankStep("update"), key: `s${s.workflowStepId}`, name: s.stepName, updField: cfg.field ?? "priority", updValue: cfg.value ?? null, updLabel: cfg.field === "agent" ? userNames.get(Number(cfg.value)) ?? "" : "" });
    } else if (s.stepType === "condition") {
      const t = (branch: "yes" | "no") => (wf.transitions ?? []).find((x) => x.fromStep.workflowStepId === s.workflowStepId && x.branch === branch);
      const target = (branch: "yes" | "no") => { const x = t(branch); return !x ? "" : x.toStep ? `s${x.toStep.workflowStepId}` : "end"; };
      out.push({ ...blankStep("condition"), key: `s${s.workflowStepId}`, name: s.stepName, ...parseCondition(s.conditionExpression), yesTo: target("yes"), noTo: target("no") });
    }
  }
  for (const st of out) if (st.kind === "approval" && st.onReject === "back") st.rejectArg = levelKey.get(Number(st.rejectArg)) ?? "";
  return { steps: out, unsupported };
}

function validate(name: string, steps: DStep[]): string {
  if (!name.trim()) return "Give the lifecycle a name.";
  if (steps.length === 0) return "Add at least one step.";
  for (const [i, s] of steps.entries()) {
    const at = `Step ${i + 1}`;
    if (!s.name.trim()) return `${at} needs a name.`;
    if (s.kind === "approval" && s.approverType === "parallel" && (s.parallel.length < 2 || s.parallel.some((a) => a.type !== "requester_manager" && !a.ref))) return `${at}: add at least two approvers and choose each one.`;
    if (s.kind === "approval" && s.approverType !== "requester_manager" && s.approverType !== "parallel" && (s.approverId == null || !Number.isInteger(s.approverId) || s.approverId <= 0)) return `${at}: choose who approves.`;
    if (s.kind === "approval" && s.onReject === "escalate" && !s.rejectArg) return `${at}: "If rejected" escalates but nobody is chosen.`;
    if (s.kind === "approval" && s.onReject === "back" && !steps.slice(0, i).some((x) => x.kind === "approval" && x.key === s.rejectArg)) return `${at}: choose which earlier approval step it goes back to.`;
    if (s.kind === "approval" && ["priority", "assign", "reroute", "task", "notify"].includes(s.onApprove) && !s.approveArg.trim()) return `${at}: "If approved" needs a value.`;
    if (s.kind === "approval" && s.onApprove === "step" && !steps.slice(i + 1).some((x) => x.kind === "approval" && x.key === s.approveArg)) return `${at}: choose which later approval step it skips ahead to.`;
    if (s.kind === "approval" && s.timeoutDays > 0 && s.onTimeout === "escalate" && !s.timeoutArg) return `${at}: the timeout escalates but nobody is chosen.`;
    if (s.kind === "approval" && s.remindDays > 0 && s.timeoutDays > 0 && s.remindDays >= s.timeoutDays) return `${at}: the reminder must come before the timeout.`;
    if (s.kind === "email" && (!s.emailRuleId || !s.emailTo.length)) return `${at}: choose an e-mail template and who receives it.`;
    if (s.kind === "update" && !s.updValue) return `${at}: choose what to change the request to.`;
    if (s.kind === "wait" && !(s.waitDays >= 1 && s.waitDays <= 365)) return `${at}: wait between 1 and 365 business days.`;
    if (s.kind === "record" && !s.recTitle.trim()) return `${at}: give the new record a title.`;
    if (s.kind === "record" && s.recType === "request" && !s.recCatalogId) return `${at}: choose a catalog item for the new service request.`;
    if (s.kind === "integration" && !/^https:\/\/\S+$/i.test(s.intUrl.trim())) return `${at}: the address must start with https://.`;
    if (s.kind === "approval" && s.onApprove === "auto" && !s.approveArg.trim()) return `${at}: write the resolution note the requester will see.`;
    if (s.kind === "condition" && (!s.field.trim() || (!NO_VALUE.includes(s.operator) && !s.value.trim()))) return `${at}: complete the condition.`;
    if (s.kind === "task") {
      if (!s.tasks.length) return `${at}: add at least one task.`;
      if (s.tasks.some((t) => !t.taskName.trim() || !t.assigneeId)) return `${at}: every task needs a name and an assignee.`;
    }
  }
  return "";
}

function stepConfig(s: DStep): { config?: Record<string, unknown> } {
  if (s.kind === "email") return { config: { ruleId: s.emailRuleId, to: s.emailTo } };
  if (s.kind === "update") return { config: { field: s.updField, value: s.updValue } };
  if (s.kind === "wait") return { config: { days: s.waitDays } };
  if (s.kind === "record") return { config: { recordType: s.recType, title: s.recTitle.trim(), description: s.recDescription.trim() || undefined, priority: s.recPriority.trim() || undefined, priorityId: s.recPriorityId ?? undefined, catalogId: s.recCatalogId ?? undefined } };
  if (s.kind === "integration") return { config: { kind: s.intKind, url: s.intUrl.trim(), secret: s.intSecret.trim() || undefined } };
  return {};
}

async function saveDraft(name: string, description: string, steps: DStep[], scope: LifecycleScope, existing?: Lifecycle): Promise<number> {
  let id = existing?.workflowId ?? 0;
  const createdNew = !existing;
  if (!existing) id = (await lifecycleApi.create({ workflowName: name.trim(), workflowScope: scope, description: description.trim() || undefined, status: "active", isActive: true })).workflowId;
  else await lifecycleApi.update(id, { workflowName: name.trim(), description: description.trim() });
  const oldIds = (existing?.steps ?? []).map((s) => s.workflowStepId);
  const created: number[] = [];
  const idOf = new Map<string, number>();
  const levelOfKey = new Map<string, number>();
  try {
    let order = Math.max(0, ...(existing?.steps ?? []).map((s) => s.stepOrder));
    for (const s of steps) {
      const step = await lifecycleApi.addStep(id, { stepName: s.name.trim(), stepOrder: ++order, stepType: STEP_TYPE[s.kind], ...stepConfig(s) });
      const sid = (step as unknown as LifecycleStep).workflowStepId;
      created.push(sid); idOf.set(s.key, sid);
    }
    for (const s of steps) {
      const sid = idOf.get(s.key)!;
      if (s.kind === "approval") {
        const savedLevels = await lifecycleApi.setApprovalLevels(id, sid, [{ levelNumber: 1, title: s.name.trim(), approverType: s.approverType, approvalRule: s.approvalRule, commentPolicy: s.commentPolicy, allowReject: s.allowReject, allowInfo: s.allowInfo, allowDelegate: s.allowDelegate, remindDays: s.remindDays, timeoutDays: s.timeoutDays, onTimeout: s.onTimeout, timeoutArg: s.timeoutDays > 0 && s.onTimeout === "escalate" ? s.timeoutArg : null, onApprove: s.onApprove, approveArg: s.onApprove === "step" ? String(idOf.get(s.approveArg) ?? "") : ["next", "fulfil"].includes(s.onApprove) ? null : s.approveArg, ...(s.approverType === "parallel" ? { approvers: s.parallel.map((a) => ({ type: a.type, ref: a.type === "requester_manager" ? null : a.ref, label: a.label })) } : {}), onReject: s.onReject, rejectArg: s.onReject === "back" ? String(levelOfKey.get(s.rejectArg) ?? "") : s.rejectArg || null, ...(s.approverType === "requester_manager" || s.approverType === "parallel" ? {} : s.approverType === "custom" ? { customGroupId: s.approverId! } as object : { approverId: s.approverId }) } as never]);
        if (savedLevels[0]?.approvalLevelId) levelOfKey.set(s.key, savedLevels[0].approvalLevelId);
      } else if (s.kind === "task") {
        await lifecycleApi.setTasks(id, sid, s.tasks.map((t) => ({ taskName: t.taskName.trim(), description: t.description.trim() || undefined, assigneeType: t.assigneeType, assigneeId: t.assigneeId!, dueDateHours: t.dueDateHours ? Number(t.dueDateHours) : undefined, priority: t.priority })));
      } else if (s.kind === "condition") {
        await lifecycleApi.updateStep(id, sid, { conditionExpression: buildCondition(s) });
      }
    }
    for (const s of steps.filter((x) => x.kind === "condition")) {
      const taskStep = steps.find((x) => x.kind === "task");
      const target = (v: string) => {
        if (v === "end") return 0;
        if (v === "fulfil_auto" || v === "fulfilment") {
          return taskStep ? (idOf.get(taskStep.key) ?? 0) : 0;
        }
        return idOf.get(v) ?? -1;
      };
      const transitions = (([["yes", s.yesTo], ["no", s.noTo]] as const)).filter(([, v]) => v !== "" && target(v) !== -1).map(([branch, v]) => ({ branch, targetStepId: target(v) }));
      if (transitions.length) await lifecycleApi.setTransitions(id, idOf.get(s.key)!, transitions);
    }
  } catch (e) {
    if (createdNew) await lifecycleApi.remove(id).catch(() => undefined);
    else for (const sid of created) await lifecycleApi.removeStep(id, sid).catch(() => undefined);
    throw e;
  }
  for (const sid of oldIds) await lifecycleApi.removeStep(id, sid).catch(() => undefined);
  return id;
}

function summary(wf: Lifecycle, scope: LifecycleScope): string {
  const ordered = [...wf.steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const names = ordered.map((s) => s.stepName);
  if (!names.length) return "No steps";
  return scope === "knowledge"
    ? names.join(" \u203a ")
    : ["Submitted", ...names, "Fulfilment", "Closed"].join(" \u203a ");
}

/* ──────────────────────── main page ──────────────────────── */
export function LifecyclePage({ scope = "service_request" }: { scope?: LifecycleScope }) {
  const isKnowledge = scope === "knowledge";
  const lifecycleLabel = isKnowledge ? "Knowledge lifecycle" : "service lifecycle";
  const list = useAsync(() => lifecycleApi.list(scope), [scope]);
  const usage = useAsync(() => lifecycleApi.usage(), []);
  const [tab, setTab] = useState<"lifecycles" | "standard">("lifecycles");
  const [editing, setEditing] = useState<{ id: number | null; name: string; description: string; steps: DStep[]; source?: Lifecycle; blocked: string[]; scope: LifecycleScope } | null>(null);
  const [copy, setCopy] = useState<{ from: Lifecycle; name: string } | null>(null);
  const [error, setError] = useState(""); const [flash, setFlash] = useState(""); const [busy, setBusy] = useState(false);

  const reload = () => { list.reload(); usage.reload(); };
  const open = async (wf: Lifecycle) => {
    setError(""); setBusy(true);
    try { const d = await loadDraft(wf); setEditing({ id: wf.workflowId, name: wf.workflowName, description: wf.description ?? "", steps: d.steps, source: wf, blocked: d.unsupported, scope }); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const doCopy = async () => {
    if (!copy) return;
    if (!copy.name.trim()) { setError("Name the copy."); return; }
    setBusy(true); setError("");
    try {
      const full = await lifecycleApi.get(copy.from.workflowId); const d = await loadDraft(full);
      if (d.unsupported.length) throw new Error(`This lifecycle has steps the editor cannot copy: ${d.unsupported.join(", ")}.`);
      await saveDraft(copy.name, full.description ?? "", d.steps.map((s) => ({ ...s, key: s.key })), scope);
      setCopy(null); setFlash(`Copied as "${copy.name.trim()}".`); reload();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const remove = async (wf: Lifecycle) => {
    if (!window.confirm(`Delete the lifecycle "${wf.workflowName}"?`)) return;
    setError("");
    try { await lifecycleApi.remove(wf.workflowId); setFlash(`Deleted "${wf.workflowName}".`); reload(); } catch (e) { setError(errMsg(e)); }
  };

  if (editing) return <LifecycleEditor draft={editing} onBack={() => { setEditing(null); reload(); }} onSaved={(msg) => { setEditing(null); setFlash(msg); reload(); }} />;

  const rows = list.data ?? [];

  return (
    <>
      <PageHeader
        crumb={isKnowledge ? "Configuration > Knowledge Management > Knowledge Lifecycle" : "Configuration > Service Request Management > Service Lifecycle"}
        title={isKnowledge ? "Knowledge Lifecycle" : "Service Lifecycle"}
        subtitle={isKnowledge
          ? "Create governance workflows for knowledge articles using the Service Request lifecycle builder. Mapping a lifecycle does not automatically change article status."
          : "Build the lifecycle a request follows, step by step: who approves it, who fulfils it and how it closes. Catalog items pick a lifecycle in the Service Catalog Builder."}
      />
      <div className="page-body">
        <ErrorBar msg={list.error ?? error} />
        {flash && <div className="sr-notice" style={{ marginBottom: 12 }}>{flash}</div>}

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid #E4E7EC", marginBottom: 24, display: "flex", gap: 0 }}>
          {(isKnowledge ? ["lifecycles"] as const : ["lifecycles", "standard"] as const).map((t) => (
            <button key={t} type="button"
              onClick={() => setTab(t)}
              style={{
                border: "none", background: "none", cursor: "pointer",
                padding: "10px 20px", fontSize: 14, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? "#101828" : "#667085",
                borderBottom: tab === t ? "2px solid #1570EF" : "2px solid transparent",
                marginBottom: -1, transition: "color 0.15s",
              }}
            >
              {t === "lifecycles" ? "Lifecycles" : "Standard lifecycle"}
            </button>
          ))}
        </div>

        {(isKnowledge || tab === "lifecycles") && (
          <>
            {copy && (
              <div className="card" style={{ marginBottom: 16, padding: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Copy lifecycle</div>
                <label className="field-group" style={{ maxWidth: 420 }}><span className="lbl">Name of the copy</span>
                  <input className="input" value={copy.name} onChange={(e) => setCopy({ ...copy, name: e.target.value })} /></label>
                <div className="sr-actions" style={{ marginTop: 12 }}><button className="btn-primary" disabled={busy} onClick={() => void doCopy()}>Save copy</button><button className="btn-ghost" onClick={() => setCopy(null)}>Cancel</button></div>
              </div>
            )}

            <div className="card admin-master-table-wrap">
              <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E4E7EC" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#344054", letterSpacing: "0.5px", textTransform: "uppercase" }}>{isKnowledge ? "KNOWLEDGE LIFECYCLES" : "SERVICE LIFECYCLES"} ({rows.length})</div>
                </div>
                <button className="btn-primary" style={{ height: 36 }} onClick={() => { setFlash(""); setEditing({ id: null, name: "", description: "", steps: [], blocked: [], scope }); }}>
                  Create {lifecycleLabel}
                </button>
              </div>
              <div style={{ padding: "12px 20px", fontSize: 12.5, color: "#667085", borderBottom: "1px solid #F2F4F7" }}>
                {isKnowledge
                  ? "Knowledge lifecycles created here can be selected in the Lifecycle & Governance section of a Knowledge article."
                  : "Every lifecycle you create is listed here and can be selected for a catalog item in the Lifecycle dropdown of the Service Catalog Builder."}
              </div>
              {list.loading && !list.data ? <div className="spinner-row">Loading...</div> : rows.length === 0 ? (
                <div className="empty-state">No lifecycles yet. Create one to get started.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th style={{ ...TH, paddingLeft: 20 }}>Lifecycle</th>
                      <th style={TH}>Steps</th>
                      <th style={TH}>Used by</th>
                      <th style={TH} />
                    </tr>
                  </thead>
                  <tbody>{rows.map((wf) => {
                    const used = usage.data?.[wf.workflowId] ?? [];
                    return (
                      <tr key={wf.workflowId}>
                        <td style={{ fontSize: 13, paddingLeft: 20 }}><strong>{wf.workflowName}</strong>{wf.description && <div style={{ fontSize: 12, color: "var(--muted)" }}>{wf.description}</div>}</td>
                        <td style={{ fontSize: 12.5, maxWidth: 340 }}>{summary(wf, scope)}</td>
                        <td style={{ fontSize: 12.5, maxWidth: 200 }}>{used.length ? used.join(", ") : <span style={{ color: "var(--muted)" }}>Not used</span>}</td>
                        <td style={{ whiteSpace: "nowrap", paddingRight: 16 }}>
                          <button className="btn-ghost" style={{ height: 30, padding: "0 10px", fontSize: 12, marginRight: 4 }} disabled={busy} onClick={() => void open(wf)}>Edit</button>
                          <button className="btn-ghost" style={{ height: 30, padding: "0 10px", fontSize: 12, marginRight: 4 }} onClick={() => { setFlash(""); setCopy({ from: wf, name: `Copy of ${wf.workflowName}` }); }}>Copy</button>
                          <button className="btn-ghost" style={{ height: 30, padding: "0 10px", fontSize: 12, color: used.length ? "#98A2B3" : "#D92D20", borderColor: used.length ? undefined : "#FDA29B" }} disabled={used.length > 0} title={used.length ? "A lifecycle in use cannot be deleted." : undefined} onClick={() => void remove(wf)}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              )}
              <div style={{ padding: "12px 20px", fontSize: 12, color: "#667085", borderTop: "1px solid #F2F4F7" }}>
                {isKnowledge
                  ? "A lifecycle linked to a Knowledge article cannot be deleted. Unassign it from the article first."
                  : "A lifecycle that a catalog item is using cannot be deleted. Assign that item another lifecycle in the Service Catalog Builder first."}
              </div>
            </div>
          </>
        )}

        {!isKnowledge && tab === "standard" && <StandardLifecycleTab />}
      </div>
    </>
  );
}

/* ─── Standard Lifecycle tab ─── */
function StandardLifecycleTab() {
  const stages = [
    { n: 1, stage: "Submission", status: "Approved straight away — there is no approval stage", owner: "Requester", sla: "Not started", notifies: "Requester, fulfilment workgroup", screen: "Service Catalog", screenPath: "/catalog" },
    { n: 2, stage: "Assignment", status: "Approved to In Progress", owner: "Workgroup named on the catalog item", sla: "Running", notifies: "Workgroup, assignee", screen: "Service Request List", screenPath: "/config/admin/requests" },
    { n: 3, stage: "Fulfilment", status: "In Progress, On Hold and back, then Fulfilled", owner: "Assigned agent", sla: "Running, paused while on hold", notifies: "Requester on hold and on fulfilment", screen: "Service Request Record", screenPath: "/config/admin/requests" },
    { n: 4, stage: "Confirmation", status: "Fulfilled to Closed, or back to In Progress if reopened", owner: "Requester", sla: "Stopped", notifies: "Assignee if reopened", screen: "My Service Requests", screenPath: "/my-requests" },
    { n: 5, stage: "Closure", status: "Closed, automatically 3 business days after fulfilment", owner: "System", sla: "Stopped", notifies: "Requester", screen: "My Service Requests", screenPath: "/my-requests" },
  ];

  return (
    <div>
      {/* Section header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#344054", letterSpacing: "0.3px", textTransform: "uppercase", borderBottom: "2px solid #E4E7EC", paddingBottom: 10, marginBottom: 12 }}>NO APPROVAL LIFECYCLE</div>
        <p style={{ fontSize: 13, color: "#667085", lineHeight: 1.6, margin: 0 }}>
          The standard lifecycle has no approval step; a submitted request goes straight to the fulfilment workgroup, and the requester confirms delivery at the end. A catalog item that needs approvals is given a lifecycle from the Lifecycles tab instead.
        </p>
      </div>

      {/* Flow diagram container with swimlanes */}
      <div className="card" style={{ padding: "24px 28px", marginBottom: 24, background: "#fff", position: "relative" }}>
        <div style={{ position: "relative", minHeight: 250, maxWidth: 840 }}>
          {/* REQUESTER swimlane box */}
          <div style={{
            background: "#F8FAFC", borderRadius: 8, border: "1px solid #EAECF0",
            padding: "14px 18px", height: 105, boxSizing: "border-box", marginBottom: 12, position: "relative",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475467", letterSpacing: "0.5px" }}>REQUESTER</span>
            
            {/* Submit request box */}
            <div style={{
              position: "absolute", left: 130, top: 22, width: 145, height: 60,
              background: "#fff", border: "1px solid #D0D5DD", borderRadius: 6,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 2px rgba(16,24,40,0.05)", zIndex: 2,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#101828", textAlign: "center" }}>Submit request</span>
              <span style={{ fontSize: 11, color: "#667085", textAlign: "center" }}>from the catalog</span>
            </div>

            {/* Confirm and close box */}
            <div style={{
              position: "absolute", left: 490, top: 22, width: 155, height: 60,
              background: "#ECFDF3", border: "1px solid #A6F4C5", borderRadius: 6,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 2px rgba(16,24,40,0.05)", zIndex: 2,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#027A48", textAlign: "center" }}>Confirm and close</span>
              <span style={{ fontSize: 11, color: "#027A48", textAlign: "center" }}>or auto-close in 3 days</span>
            </div>
          </div>

          {/* FULFILMENT swimlane box */}
          <div style={{
            background: "#F8FAFC", borderRadius: 8, border: "1px solid #EAECF0",
            padding: "14px 18px", height: 105, boxSizing: "border-box", position: "relative",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475467", letterSpacing: "0.5px" }}>FULFILMENT</span>

            {/* Assign box */}
            <div style={{
              position: "absolute", left: 330, top: 22, width: 135, height: 60,
              background: "#fff", border: "1px solid #D0D5DD", borderRadius: 6,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 2px rgba(16,24,40,0.05)", zIndex: 2,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#101828", textAlign: "center" }}>Assign</span>
              <span style={{ fontSize: 11, color: "#667085", textAlign: "center" }}>to the workgroup</span>
            </div>

            {/* Fulfil tasks box */}
            <div style={{
              position: "absolute", left: 490, top: 22, width: 155, height: 60,
              background: "#fff", border: "1px solid #D0D5DD", borderRadius: 6,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 2px rgba(16,24,40,0.05)", zIndex: 2,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#101828", textAlign: "center" }}>Fulfil tasks</span>
              <span style={{ fontSize: 11, color: "#667085", textAlign: "center" }}>may pause on hold</span>
            </div>
          </div>

          {/* SVG connecting lines and arrows overlay */}
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
            <defs>
              <marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <polygon points="0 0, 7 3.5, 0 7" fill="#667085" />
              </marker>
            </defs>

            {/* Line from Submit down to FULFILMENT then right into Assign */}
            {/* Submit center bottom is at (202, 82). Path: (202, 82) -> (202, 168) -> (330, 168) */}
            <path d="M 202 82 L 202 168 L 330 168" fill="none" stroke="#667085" strokeWidth="1.2" markerEnd="url(#arrow)" />
            <text x="215" y="162" fontSize="10.5" fill="#475467" fontFamily="system-ui, sans-serif">No approval — straight to fulfillment</text>

            {/* Horizontal line from Assign to Fulfil tasks: (465, 168) -> (490, 168) */}
            <line x1="465" y1="168" x2="490" y2="168" stroke="#667085" strokeWidth="1.2" markerEnd="url(#arrow)" />

            {/* Upward line from Fulfil tasks top (567, 139) -> Confirm bottom (567, 82) */}
            <line x1="567" y1="139" x2="567" y2="82" stroke="#667085" strokeWidth="1.2" markerEnd="url(#arrow)" />
            <text x="575" y="114" fontSize="10.5" fill="#475467" fontFamily="system-ui, sans-serif">Fulfilled</text>
          </svg>
        </div>
      </div>

      {/* Stage reference table */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#344054", letterSpacing: "0.3px", textTransform: "uppercase", borderBottom: "2px solid #E4E7EC", paddingBottom: 10, marginBottom: 0 }}>STAGE REFERENCE</div>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th style={{ ...TH, paddingLeft: 20 }}>Stage</th>
              <th style={TH}>Status</th>
              <th style={TH}>Owner</th>
              <th style={TH}>SLA clock</th>
              <th style={TH}>Notifies</th>
              <th style={TH}>Screen</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.n}>
                <td style={{ paddingLeft: 20, fontSize: 13, fontWeight: 600, color: "#101828" }}>{s.n}. {s.stage}</td>
                <td style={{ fontSize: 12.5 }}>{s.status}</td>
                <td style={{ fontSize: 12.5 }}>{s.owner}</td>
                <td style={{ fontSize: 12.5 }}>{s.sla}</td>
                <td style={{ fontSize: 12.5 }}>{s.notifies}</td>
                <td style={{ fontSize: 12.5 }}><Link to={s.screenPath} style={{ color: "#1570EF" }}>{s.screen}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "12px 20px", fontSize: 12, color: "#667085", borderTop: "1px solid #F2F4F7" }}>
          The requester can cancel a request until fulfilment starts. Lifecycles with approval steps add an authorisation step between submission and assignment.
        </div>
      </div>
    </div>
  );
}

/* ─── Lifecycle editor ─── */
interface Lookups {
  roles: { id: number; label: string }[]; groups: { id: number; label: string }[];
  assignmentGroups: { id: number; label: string }[]; priorities: { id: number; label: string }[];
  incidentPriorities: { id: number; label: string }[]; catalogs: { id: number; label: string }[];
  templates: { id: number; label: string }[];
}

function LifecycleEditor({ draft, onBack, onSaved }: { draft: { id: number | null; name: string; description: string; steps: DStep[]; source?: Lifecycle; blocked: string[]; scope: LifecycleScope }; onBack: () => void; onSaved: (msg: string) => void }) {
  const isKnowledge = draft.scope === "knowledge";
  const [name, setName] = useState(draft.name); const [description, setDescription] = useState(draft.description);
  const [steps, setSteps] = useState<DStep[]>(draft.steps);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [chooseTemplate, setChooseTemplate] = useState(draft.id === null && draft.steps.length === 0);
  const [addAtIndex, setAddAtIndex] = useState<number | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const lookups = useAsync<Lookups>(async () => {
    const [roles, groups, ag, pri, incidentPri, catalogs, tpl] = await Promise.all([
      api.get<{ roleId: number; roleName: string }[]>("/roles"), requestConfigApi.groups(),
      serviceRequestApi.assignmentGroups(), serviceRequestApi.priorities(),
      api.get<{ priorityId: number; priorityName: string; isActive?: boolean }[]>("/priority"),
      serviceRequestApi.catalogs(), requestConfigApi.rules(),
    ]);
    return {
      roles: roles.map((r) => ({ id: r.roleId, label: r.roleName })),
      groups: groups.map((g) => ({ id: g.approverGroupId, label: g.groupName })),
      assignmentGroups: ag.filter((g) => g.groupId !== undefined).map((g) => ({ id: g.groupId as number, label: g.groupName ?? "" })),
      priorities: pri.filter((x) => x.priorityId !== undefined).map((x) => ({ id: x.priorityId as number, label: x.priorityName ?? "" })),
      incidentPriorities: incidentPri.filter((p) => p.isActive !== false).map((p) => ({ id: p.priorityId, label: p.priorityName })),
      catalogs: catalogs.filter((c) => c.isActive !== false).map((c) => ({ id: c.catalogId, label: c.catalogName })),
      templates: tpl.filter((x) => x.isActive).map((x) => ({ id: x.ruleId, label: x.ruleName })),
    };
  }, []);
  const lk = lookups.data ?? { roles: [], groups: [], assignmentGroups: [], priorities: [], incidentPriorities: [], catalogs: [], templates: [] };
  const readOnly = draft.blocked.length > 0;

  const patch = (key: string, p: Partial<DStep>) => setSteps((all) => all.map((s) => (s.key === key ? { ...s, ...p } : s)));
  const move = (i: number, d: -1 | 1) => setSteps((all) => { const n = [...all]; const j = i + d; if (j < 0 || j >= n.length) return all; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const addAt = (
    kind: DStep["kind"],
    index: number,
    approverType?: ApproverType,
    defaultName?: string,
    defaultCond?: Partial<DStep>
  ) => {
    const s = blankStep(kind);
    if (defaultName) s.name = defaultName;
    if (approverType) {
      s.approverType = approverType;
      if (approverType === "requester_manager") {
        s.approverLabel = MANAGER_LABEL;
        if (!defaultName) s.name = "Reporting Manager";
      }
    }
    if (defaultCond) Object.assign(s, defaultCond);
    setSteps((all) => [...all.slice(0, index), s, ...all.slice(index)]);
    setOpenKey(s.key);
    setAddAtIndex(null);
  };
  const applyTemplate = (t: (typeof TEMPLATES)[number]) => { const built = t.build(); setSteps(built); setOpenKey(built[0]?.key ?? null); setChooseTemplate(false); };
  const del = (key: string) => setSteps((all) => all.filter((s) => s.key !== key).map((s) => ({ ...s, yesTo: s.yesTo === key ? "" : s.yesTo, noTo: s.noTo === key ? "" : s.noTo })));

  const save = async () => {
    const problem = validate(name, steps);
    if (problem) { setError(problem); return; }
    setError(""); setBusy(true);
    try { await saveDraft(name, description, steps, draft.scope, draft.source); onSaved(`Saved "${name.trim()}".`); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const branchName = (target: string, fallback: string) => {
    if (!target || target === "") return "Continue to next step";
    if (target === "fulfil_auto") return "Fulfil automatically";
    if (target === "fulfilment") return "Fulfilment";
    if (target === "end") return "Finish the lifecycle";
    const st = steps.find((x) => x.key === target);
    return st ? st.name || "Next step" : fallback;
  };

  const describe = (s: DStep): React.ReactNode => {
    if (s.kind === "approval") {
      if (s.approverType === "requester_manager") {
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: "#175CD3", fontWeight: 600, background: "#EFF8FF", border: "1px solid #B2DDFF", padding: "1px 8px", borderRadius: 12 }}>
              User field: Reporting Manager
            </span>
            <span style={{ fontSize: 12, color: "#475467" }}>Dynamic approval from user record (Entra ID)</span>
          </div>
        );
      }
      return (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
          {s.approverLabel ? `Approved by ${s.approverLabel}` : s.approverId ? "1 approver chosen" : "Choose who approves"}
        </div>
      );
    }
    if (s.kind === "email") return <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{lk.templates.find((t) => t.id === s.emailRuleId)?.label ?? "Choose a template"} to {s.emailTo.map((t) => EMAIL_TO[t] ?? t).join(", ")}</div>;
    if (s.kind === "update") return <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{updateText(s, lk)}</div>;
    if (s.kind === "wait") return <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Pauses the request for {s.waitDays} business day{s.waitDays === 1 ? "" : "s"}</div>;
    if (s.kind === "record") return <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Raises a {REC_LABEL[s.recType].toLowerCase()}: {s.recTitle || "no title yet"}</div>;
    if (s.kind === "integration") return <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{s.intKind === "teams" ? "Posts a message to Teams" : "Calls a webhook"}{s.intUrl ? ` at ${s.intUrl.replace(/^https:\/\//, "").split("/")[0]}` : ""}</div>;
    if (s.kind === "task") {
      return (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
          {s.tasks.length} task{s.tasks.length === 1 ? "" : "s"}: {s.tasks.map((t) => t.taskName || "unnamed").join(", ")}
        </div>
      );
    }
    return (
      <div style={{ display: "grid", gap: 2, marginTop: 2 }}>
        <div style={{ fontSize: 12.5, color: "#344054" }}>
          If <strong>{s.field || "Estimated cost"}</strong> {s.operator} {NO_VALUE.includes(s.operator) ? "" : <strong>{s.value || "$1,000"}</strong>}
        </div>
        <div style={{ fontSize: 11.5, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: "#027A48", fontWeight: 600 }}>Satisfied → {branchName(s.yesTo, "Fulfil automatically")}</span>
          <span style={{ color: "#B42318", fontWeight: 600 }}>Not satisfied → {branchName(s.noTo, "Fulfilment")}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        crumb={isKnowledge ? "Configuration > Knowledge Management > Knowledge Lifecycle" : "Configuration > Service Request Management > Service Lifecycle"}
        title={draft.id ? `Edit ${isKnowledge ? "Knowledge" : "service"} lifecycle` : `Create ${isKnowledge ? "Knowledge" : "service"} lifecycle`}
        subtitle={isKnowledge ? "Configure the governance steps to associate with Knowledge articles." : "A request runs through these steps from top to bottom."}
      />
      <div className="page-body">
        <button className="btn-ghost" style={{ marginBottom: 12, display: "inline-flex", gap: 6 }} onClick={onBack}><ArrowLeft size={14} /> Back to {isKnowledge ? "Knowledge" : "service"} lifecycles</button>
        <ErrorBar msg={error || lookups.error || ""} />
        {readOnly && <div className="sr-notice warn" style={{ marginBottom: 12 }}>This lifecycle contains steps this editor cannot represent ({draft.blocked.join(", ")}), so it is read-only here.</div>}
        <div className="card sr-panel" style={{ marginBottom: 16, display: "grid", gap: 12, maxWidth: 760 }}>
          <label className="field-group"><span className="lbl">Lifecycle name <span className="req">*</span></span>
            <input className="input" value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field-group"><span className="lbl">Description</span>
            <textarea className="textarea" value={description} disabled={readOnly} onChange={(e) => setDescription(e.target.value)} /></label>
        </div>
        {chooseTemplate && !readOnly && (
          <div className="card sr-panel" style={{ marginBottom: 16 }}>
            <div className="sr-panel-head"><h3>Start from</h3><button className="btn-ghost" onClick={() => setChooseTemplate(false)}>Build from scratch</button></div>
            <div className="lc-templates">{TEMPLATES.map((t) => <button key={t.id} type="button" className="lc-template" onClick={() => applyTemplate(t)}><strong>{t.label}</strong><span>{t.desc}</span></button>)}</div>
          </div>
        )}
        <div className="card sr-panel">
          <div className="sr-panel-head"><h3>Lifecycle flow</h3>
            {!readOnly && <div className="sr-actions">
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Add a step:</span>
              <button className="btn-ghost" onClick={() => addAt("approval", steps.length, "user", "Approval by a named person")}><Plus size={13} /> Named person</button>
              <button className="btn-ghost" onClick={() => addAt("approval", steps.length, "group", "Group approval")}><Plus size={13} /> Approver group</button>
              <button className="btn-ghost" onClick={() => addAt("approval", steps.length, "requester_manager", "Reporting Manager")}><Plus size={13} /> Reporting Manager</button>
              <button className="btn-ghost" onClick={() => addAt("condition", steps.length, undefined, "Estimated cost check")}><Plus size={13} /> Condition</button>
              <button className="btn-ghost" onClick={() => addAt("task", steps.length, undefined, "Fulfil the request")}><Plus size={13} /> Task</button>
              <button className="btn-ghost" onClick={() => addAt("email", steps.length, undefined, "Send e-mail")}><Plus size={13} /> E-mail</button>
              <button className="btn-ghost" onClick={() => addAt("update", steps.length, undefined, "Update the request")}><Plus size={13} /> Update request</button>
              <button className="btn-ghost" onClick={() => addAt("wait", steps.length, undefined, "Wait")}><Plus size={13} /> Wait</button>
              <button className="btn-ghost" onClick={() => addAt("record", steps.length, undefined, "Create a related record")}><Plus size={13} /> Related record</button>
              <button className="btn-ghost" onClick={() => addAt("integration", steps.length, undefined, "Run integration")}><Plus size={13} /> Integration</button>
            </div>}
          </div>

          {/* Trigger Banner matching Screenshot 2 */}
          <div style={{
            background: "#F8F9FC", border: "1px solid #EAECF0", borderRadius: 8, padding: "12px 16px",
            marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#FEF0C7", color: "#B54708", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>⚡</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#667085", letterSpacing: "0.5px", textTransform: "uppercase" }}>{isKnowledge ? "TRIGGER: KNOWLEDGE ARTICLE GOVERNANCE" : "TRIGGER: WHEN A SERVICE REQUEST IS SUBMITTED"}</div>
                <div style={{ fontSize: 12.5, color: "#344054" }}>{isKnowledge ? "This lifecycle is stored as governance metadata on mapped articles." : "Runs for every catalog item that uses this lifecycle."}</div>
              </div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "#027A48", background: "#ECFDF3", padding: "2px 8px", borderRadius: 12 }}>{isKnowledge ? "Mapped only" : "Always runs"}</span>
          </div>

          {addAtIndex === 0 && !readOnly && (
            <AddStepInlineCard
              onPick={(k, at, defName, defCond) => addAt(k, 0, at, defName, defCond)}
              onCancel={() => setAddAtIndex(null)}
            />
          )}

          {steps.length === 0 ? <div className="empty-state">No steps yet. Add an approval, a condition or a task.</div> : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 0 }}>
              {steps.map((s, i) => {
                const isOpen = openKey === s.key;
                return (
                  <li key={s.key}>
                    {!readOnly && (
                      <AddStepMenu
                        label={i === 0 ? "Add a step at the start" : `Add a step after step ${i}`}
                        onOpenInline={() => setAddAtIndex(i)}
                      />
                    )}
                    {addAtIndex === i && i > 0 && !readOnly && (
                      <AddStepInlineCard
                        onPick={(k, at, defName, defCond) => addAt(k, i, at, defName, defCond)}
                        onCancel={() => setAddAtIndex(null)}
                      />
                    )}
                    <div className="card" style={{ padding: 0, border: "1px solid var(--border)", boxShadow: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                        <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--blue-light)", color: "var(--blue)", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                        <Pill tone={s.kind === "approval" ? "amber" : s.kind === "task" ? "violet" : s.kind === "email" || s.kind === "update" || s.kind === "record" ? "green" : s.kind === "wait" || s.kind === "integration" ? "violet" : "blue"}>{KIND_LABEL[s.kind]}</Pill>
                        <button type="button" onClick={() => setOpenKey(isOpen ? null : s.key)} style={{ flex: 1, textAlign: "left", border: 0, background: "none", cursor: "pointer" }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{s.name || "Untitled step"}</div>
                          {describe(s)}
                        </button>
                        {!readOnly && <>
                          <button className="admin-master-icon-button" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                          <button className="admin-master-icon-button" disabled={i === steps.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                          <button className="admin-master-icon-button" onClick={() => del(s.key)}><Trash2 size={14} /></button>
                        </>}
                      </div>
                      {isOpen && <div style={{ padding: "4px 14px 14px", borderTop: "1px solid var(--border-soft)", display: "grid", gap: 12 }}>
                        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 12 }}>
                          <label className="field-group"><span className="lbl">Step name <span className="req">*</span></span>
                            <input
                              className="input"
                              value={s.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                patch(s.key, { name: val });
                                if (s.kind === "approval" && /reporting\s*manager|manager\s*approval/i.test(val) && s.approverType === "user" && !s.approverId) {
                                  patch(s.key, { approverType: "requester_manager", approverLabel: MANAGER_LABEL });
                                }
                              }}
                            />
                          </label>
                          {s.kind === "approval" && <ApprovalFields s={s} lk={lk} patch={(p) => patch(s.key, p)} />}
                          {s.kind === "approval" && <RejectFields s={s} earlier={steps.slice(0, steps.indexOf(s)).filter((x) => x.kind === "approval")} lk={lk} patch={(p) => patch(s.key, p)} />}
                          {s.kind === "approval" && <ControlsFields s={s} lk={lk} patch={(p) => patch(s.key, p)} />}
                          {s.kind === "approval" && <ApproveFields s={s} later={steps.slice(i + 1).filter((x) => x.kind === "approval")} lk={lk} patch={(p) => patch(s.key, p)} />}
                          {s.kind === "email" && <EmailFields s={s} lk={lk} patch={(p) => patch(s.key, p)} first={steps.slice(0, i).every((x) => x.kind !== "approval")} />}
                          {s.kind === "wait" && <WaitFields s={s} patch={(p) => patch(s.key, p)} />}
                          {s.kind === "record" && <RecordFields s={s} lk={lk} patch={(p) => patch(s.key, p)} first={steps.slice(0, i).every((x) => x.kind !== "approval")} />}
                          {s.kind === "integration" && <IntegrationFields s={s} patch={(p) => patch(s.key, p)} />}
                          {s.kind === "update" && <UpdateFields s={s} lk={lk} patch={(p) => patch(s.key, p)} first={steps.slice(0, i).every((x) => x.kind !== "approval")} />}
                          {s.kind === "condition" && <ConditionFields s={s} later={steps.slice(i + 1)} patch={(p) => patch(s.key, p)} />}
                          {s.kind === "task" && <TaskFields s={s} lk={lk} patch={(p) => patch(s.key, p)} />}
                        </fieldset>
                      </div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {!readOnly && steps.length > 0 && (
            <AddStepMenu label="Add a step at the end" onOpenInline={() => setAddAtIndex(steps.length)} />
          )}

          {addAtIndex === steps.length && steps.length > 0 && !readOnly && (
            <AddStepInlineCard
              onPick={(k, at, defName, defCond) => addAt(k, steps.length, at, defName, defCond)}
              onCancel={() => setAddAtIndex(null)}
            />
          )}

          {!readOnly && (
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ width: "100%", padding: "8px 14px", border: "1px dashed #D0D5DD", borderRadius: 8, color: "#1570EF", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                onClick={() => setAddAtIndex(steps.length)}
              >
                <Plus size={14} /> Add another step
              </button>
            </div>
          )}
        </div>
        <ChecksPanel name={name} steps={steps} lk={lk} onOpen={setOpenKey} />
        <TestPanel steps={steps} lk={lk} />
        {!readOnly && <div className="sr-actions" style={{ marginTop: 16 }}><button className="btn-primary" disabled={busy} onClick={() => void save()}>Save lifecycle</button><button className="btn-ghost" onClick={onBack}>Cancel</button></div>}
      </div>
    </>
  );
}

const STEP_CHOICES = [
  {
    kind: "approval" as const,
    approverType: "user" as ApproverType,
    title: "Approval by a named person",
    desc: "One named approver, such as the Finance lead.",
    defaultName: "Named approver sign-off",
    icon: <UserCheck size={18} color="#1570EF" />,
  },
  {
    kind: "approval" as const,
    approverType: "group" as ApproverType,
    title: "Approval by an approver group",
    desc: "Any one member, or every member, of a group.",
    defaultName: "Group approval",
    icon: <Users size={18} color="#7F56D9" />,
  },
  {
    kind: "approval" as const,
    approverType: "requester_manager" as ApproverType,
    title: "Approval by a user field from Entra ID",
    desc: "Found on the requester's record: their manager, department head and so on.",
    defaultName: "Reporting Manager",
    icon: <Sliders size={18} color="#027A48" />,
  },
  {
    kind: "condition" as const,
    title: "Condition",
    desc: "Checks a catalog form field and sends the request one way if it is satisfied, another if it is not.",
    defaultName: "Estimated cost check",
    defaultCondition: {
      field: "Estimated cost",
      operator: "is greater than",
      value: "$1,000",
      yesTo: "fulfil_auto",
      noTo: "fulfilment",
    },
    icon: <GitFork size={18} color="#F79009" />,
  },
  {
    kind: "task" as const,
    title: "Fulfilment task",
    desc: "A piece of work the fulfilment agent ticks off.",
    defaultName: "Fulfil the request",
    icon: <CheckCircle2 size={18} color="#0086C9" />,
  },
  {
    kind: "email" as const,
    title: "Send an e-mail",
    desc: "Sends one of your e-mail templates when the step before it is approved.",
    defaultName: "Send e-mail",
    icon: <Mail size={18} color="#039855" />,
  },
  {
    kind: "update" as const,
    title: "Update the request",
    desc: "Changes the priority, workgroup or fulfilment agent as the request moves on.",
    defaultName: "Update the request",
    icon: <Pencil size={18} color="#039855" />,
  },
  {
    kind: "wait" as const,
    title: "Wait / timer",
    desc: "Pauses the request for a set number of business days, such as a cooling-off period.",
    defaultName: "Wait",
    icon: <Clock size={18} color="#7A5AF8" />,
  },
  {
    kind: "record" as const,
    title: "Create a related record",
    desc: "Raises an incident, change, problem or work order and links it to the request.",
    defaultName: "Create a related record",
    icon: <Link2 size={18} color="#039855" />,
  },
  {
    kind: "integration" as const,
    title: "Run an integration",
    desc: "Calls a webhook or posts a message to a Microsoft Teams channel.",
    defaultName: "Run integration",
    icon: <Plug size={18} color="#7A5AF8" />,
  },
];

function AddStepInlineCard({
  onPick,
  onCancel,
}: {
  onPick: (k: DStep["kind"], approverType?: ApproverType, defaultName?: string, defaultCond?: Partial<DStep>) => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      background: "#F8FAFC", border: "2px dashed #B2DDFF", borderRadius: 10,
      padding: "16px 20px", margin: "14px 0", boxShadow: "0 2px 6px rgba(16,24,40,0.06)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#175CD3", letterSpacing: "0.5px", textTransform: "uppercase" }}>
          ADD A STEP HERE — WHAT SHOULD HAPPEN?
        </div>
        <button type="button" className="btn-ghost" style={{ height: 26, padding: "0 8px", fontSize: 12 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {STEP_CHOICES.map((c) => (
          <button
            key={c.title}
            type="button"
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left",
              background: "#FFFFFF", border: "1px solid #D0D5DD", borderRadius: 8, padding: "14px 16px",
              cursor: "pointer", transition: "all 0.15s ease",
            }}
            onClick={() => onPick(c.kind, c.approverType, c.defaultName, c.defaultCondition)}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1570EF"; e.currentTarget.style.background = "#EFF8FF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#D0D5DD"; e.currentTarget.style.background = "#FFFFFF"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {c.icon}
              <strong style={{ fontSize: 13.5, color: "#101828", fontWeight: 600 }}>{c.title}</strong>
            </div>
            <span style={{ fontSize: 12, color: "#475467", lineHeight: 1.4 }}>{c.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AddStepMenu({ label, onOpenInline }: { label: string; onOpenInline: () => void }) {
  return (
    <div className="lc-add">
      <span className="lc-line" />
      <button type="button" className="lc-add-btn" aria-label={label} title={label} onClick={onOpenInline}><Plus size={12} /></button>
    </div>
  );
}

function ApprovalFields({ s, lk, patch }: { s: DStep; lk: Lookups; patch: (p: Partial<DStep>) => void }) {
  const [q, setQ] = useState(""); const [found, setFound] = useState<{ userId: number; fullName: string; email?: string }[]>([]);
  useEffect(() => {
    if (s.approverType !== "user" || q.trim().length < 2) { setFound([]); return; }
    let live = true;
    const t = setTimeout(() => { api.get<{ userId: number; fullName: string; email?: string }[]>(`/users/directory?q=${encodeURIComponent(q.trim())}`).then((r) => { if (live) setFound(r); }).catch(() => { if (live) setFound([]); }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, s.approverType]);
  const options = s.approverType === "role" ? lk.roles : s.approverType === "group" ? lk.groups : lk.assignmentGroups;
  const isNamedReportingManager = /reporting\s*manager|manager\s*approval/i.test(s.name);

  return (
    <>
      <label className="field-group"><span className="lbl">Who approves</span>
        <select className="select" value={s.approverType} onChange={(e) => { const t = e.target.value as ApproverType; patch({ approverType: t, approverId: null, approverLabel: t === "requester_manager" ? MANAGER_LABEL : "" }); }}>
          <option value="requester_manager">Approval by a user field from Entra ID (Reporting Manager)</option>
          <option value="user">Approval by a named person (A specific person)</option>
          <option value="group">Approval by an approver group</option>
          <option value="role">Anyone with a role</option>
          <option value="custom">An assignment group</option>
          <option value="parallel">Several approvers at the same time</option>
        </select></label>

      {/* If named Reporting Manager but currently set to specific user, offer quick switch */}
      {isNamedReportingManager && s.approverType !== "requester_manager" && (
        <div style={{ background: "#FEF0C7", border: "1px solid #FEDF89", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: "#B54708" }}>
            This step is named <strong>{s.name}</strong>. Map to dynamic user field <strong>Reporting Manager</strong>?
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ height: 28, fontSize: 12, padding: "0 10px", whiteSpace: "nowrap" }}
            onClick={() => patch({ approverType: "requester_manager", approverId: null, approverLabel: MANAGER_LABEL })}
          >
            Map to Reporting Manager
          </button>
        </div>
      )}

      {s.approverType === "parallel" ? (
        <ParallelFields s={s} lk={lk} patch={patch} />
      ) : s.approverType === "requester_manager" ? (
        <div style={{ background: "#EFF8FF", border: "1px solid #B2DDFF", borderRadius: 8, padding: "12px 14px", display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 600, color: "#175CD3", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <CheckCircle2 size={16} color="#175CD3" /> Mapped to User Field: Reporting Manager (Entra ID)
          </div>
          <div style={{ fontSize: 12.5, color: "#1849A9", lineHeight: 1.5 }}>
            Each request is dynamically routed to the reporting manager set on the user&apos;s record (synchronized from Entra ID or User directory). No static person is required. If the user has no manager assigned, an administrator will be prompted to approve.
          </div>
        </div>
      ) : s.approverType === "user" ? (
        <div className="field-group"><span className="lbl">Approver <span className="req">*</span></span>
          {s.approverId ? <div className="sr-members"><span className="sr-member">{s.approverLabel || `User ${s.approverId}`}<button type="button" onClick={() => patch({ approverId: null, approverLabel: "" })}>x</button></span></div> : (
            <><input className="input" placeholder="Search people by name or e-mail..." value={q} onChange={(e) => setQ(e.target.value)} />
              {found.length > 0 && <div className="sr-suggest">{found.map((u) => <button key={u.userId} type="button" onClick={() => { patch({ approverId: u.userId, approverLabel: u.fullName }); setQ(""); setFound([]); }}>{u.fullName}{u.email && <span style={{ color: "var(--muted)" }}> - {u.email}</span>}</button>)}</div>}</>
          )}
        </div>
      ) : (
        <label className="field-group"><span className="lbl">{s.approverType === "role" ? "Role" : s.approverType === "group" ? "Approver group" : "Assignment group"} <span className="req">*</span></span>
          <select className="select" value={s.approverId ?? ""} onChange={(e) => patch({ approverId: e.target.value ? Number(e.target.value) : null, approverLabel: options.find((o) => String(o.id) === e.target.value)?.label ?? "" })}>
            <option value="">Select...</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select></label>
      )}
      {(s.approverType === "group" || s.approverType === "custom" || s.approverType === "role") && <RuleField s={s} patch={patch} who="member" />}
    </>
  );
}

const RULE_TEXT: Record<ApprovalRule, string> = { any: "Any one is enough", majority: "A majority must approve", all: "Everyone must approve" };
function RuleField({ s, patch, who }: { s: DStep; patch: (p: Partial<DStep>) => void; who: "member" | "approver" }) {
  return (
    <label className="field-group"><span className="lbl">Approval rule</span>
      <select className="select" value={s.approvalRule} onChange={(e) => patch({ approvalRule: e.target.value as ApprovalRule })}>
        {(["any", "majority", "all"] as ApprovalRule[]).map((r) => <option key={r} value={r}>{RULE_TEXT[r]}</option>)}
      </select>
      <span style={{ fontSize: 12.5, color: "#667085" }}>
        {s.approvalRule === "any"
          ? `The first ${who} to answer decides.`
          : s.approvalRule === "majority"
            ? `Passes when more than half approve; fails when a majority is no longer possible.`
            : `Everyone must approve; one rejection fails the step.`}
      </span>
    </label>
  );
}

/** Several approvers asked at the same time. Each row is one person, group, role or the requester's manager. */
function ParallelFields({ s, lk, patch }: { s: DStep; lk: Lookups; patch: (p: Partial<DStep>) => void }) {
  const [q, setQ] = useState<Record<number, string>>({}); const [found, setFound] = useState<{ idx: number; list: { userId: number; fullName: string }[] }>({ idx: -1, list: [] });
  const set = (i: number, e: Partial<PEntry>) => patch({ parallel: s.parallel.map((x, j) => (j === i ? { ...x, ...e } : x)) });
  const search = (i: number, text: string) => {
    setQ({ ...q, [i]: text });
    if (text.trim().length < 2) { setFound({ idx: i, list: [] }); return; }
    api.get<{ userId: number; fullName: string }[]>(`/users/directory?q=${encodeURIComponent(text.trim())}`).then((r) => setFound({ idx: i, list: r })).catch(() => setFound({ idx: i, list: [] }));
  };
  const opts = (t: PEntry["type"]) => (t === "role" ? lk.roles : t === "group" ? lk.groups : lk.assignmentGroups);
  return (
    <div className="field-group" style={{ gap: 8 }}>
      <span className="lbl">Approvers asked at the same time <span className="req">*</span></span>
      {s.parallel.map((a, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "190px 1fr auto", gap: 8, alignItems: "start" }}>
          <select className="select" value={a.type} onChange={(e) => set(i, { type: e.target.value as PEntry["type"], ref: null, label: e.target.value === "requester_manager" ? MANAGER_LABEL : "" })}>
            <option value="user">A named person</option><option value="group">An approver group</option><option value="role">Anyone with a role</option><option value="custom">An assignment group</option><option value="requester_manager">Requester&apos;s manager</option>
          </select>
          {a.type === "requester_manager" ? <span style={{ alignSelf: "center", fontSize: 13, color: "#475467" }}>{MANAGER_LABEL}</span>
            : a.type === "user" ? (a.ref ? <div className="sr-members"><span className="sr-member">{a.label || `User ${a.ref}`}<button type="button" onClick={() => set(i, { ref: null, label: "" })}>x</button></span></div> : (
              <div><input className="input" placeholder="Search people by name or e-mail..." value={q[i] ?? ""} onChange={(e) => search(i, e.target.value)} />
                {found.idx === i && found.list.length > 0 && <div className="sr-suggest">{found.list.map((u) => <button key={u.userId} type="button" onClick={() => { set(i, { ref: u.userId, label: u.fullName }); setFound({ idx: -1, list: [] }); setQ({ ...q, [i]: "" }); }}>{u.fullName}</button>)}</div>}</div>))
              : <select className="select" value={a.ref ?? ""} onChange={(e) => set(i, { ref: e.target.value ? Number(e.target.value) : null, label: opts(a.type).find((o) => String(o.id) === e.target.value)?.label ?? "" })}>
                <option value="">Select...</option>{opts(a.type).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>}
          <button type="button" className="btn-ghost" aria-label="Remove approver" onClick={() => patch({ parallel: s.parallel.filter((_, j) => j !== i) })}><X size={14} /></button>
        </div>
      ))}
      <div><button type="button" className="btn-ghost" onClick={() => patch({ parallel: [...s.parallel, { type: "user", ref: null, label: "" }] })}><Plus size={13} /> Add approver</button></div>
      <RuleField s={s} patch={patch} who="approver" />
    </div>
  );
}

const escalateName = (arg: string) => { const [t, id] = arg.split(":"); return `${t === "user" ? "User" : t === "group" ? "Approver group" : t === "role" ? "Role" : "Assignment group"} #${id}`; };

const REJECT_INFO: Record<RejectOutcome, { hint: string; example: string }> = {
  close: { hint: "The request is closed as Rejected. The requester is notified with the approver's comments.", example: "Example: the manager declines a second monitor because the budget is spent." },
  rework: { hint: "The request is not closed. It goes back to the requester, who answers the comments and resubmits it.", example: "Example: Finance sends a purchase back because the cost centre is wrong." },
  back: { hint: "That earlier step reviews the request again, and the approvals carry on from there.", example: "Example: Finance rejects the cost, so the manager reviews the request again." },
  escalate: { hint: "Another approver makes the final decision. If they approve, the request carries on; if they reject it, it is closed.", example: "Example: a rejected access request can be appealed to the IT Director." },
  continue: { hint: "The rejection is recorded as advice and the request carries on as if approved.", example: "Example: Security's review of standard software is advisory." },
};

/** "If rejected, go to" — what a rejection does. A rejection never moves a request on unless this says so. */
function RejectFields({ s, earlier, lk, patch }: { s: DStep; earlier: DStep[]; lk: Lookups; patch: (p: Partial<DStep>) => void }) {
  const [etype, setEtype] = useState<"user" | "group" | "role" | "custom">((s.rejectArg.split(":")[0] as "user") || "user");
  const [q, setQ] = useState(""); const [found, setFound] = useState<{ userId: number; fullName: string; email?: string }[]>([]);
  useEffect(() => {
    if (s.onReject !== "escalate" || etype !== "user" || q.trim().length < 2) { setFound([]); return; }
    let live = true;
    const t = setTimeout(() => { api.get<{ userId: number; fullName: string; email?: string }[]>(`/users/directory?q=${encodeURIComponent(q.trim())}`).then((r) => { if (live) setFound(r); }).catch(() => { if (live) setFound([]); }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, etype, s.onReject]);
  const list = etype === "role" ? lk.roles : etype === "group" ? lk.groups : lk.assignmentGroups;
  const info = REJECT_INFO[s.onReject];
  const choose = (o: RejectOutcome) => patch({ onReject: o, rejectArg: o === "rework" ? "this" : o === "back" ? earlier[earlier.length - 1]?.key ?? "" : "", rejectLabel: "" });
  return (
    <div style={{ background: "#FFFBFA", border: "1px solid #FECDCA", borderRadius: 8, padding: "12px 14px", display: "grid", gap: 10 }}>
      <label className="field-group" style={{ margin: 0 }}><span className="lbl" style={{ color: "#B42318" }}>If rejected, go to</span>
        <select className="select" value={s.onReject} onChange={(e) => choose(e.target.value as RejectOutcome)}>
          <optgroup label="Stop the request"><option value="close">Close the request as Rejected</option></optgroup>
          <optgroup label="Give it another chance">
            <option value="rework">Return to the requester for changes</option>
            {earlier.length > 0 && <option value="back">Send back to an earlier approval step</option>}
            <option value="escalate">Escalate to another approver for the final decision</option>
          </optgroup>
          <optgroup label="Advisory approval"><option value="continue">Record the rejection and carry on</option></optgroup>
        </select></label>
      {s.onReject === "rework" && (
        <label className="field-group" style={{ margin: 0 }}><span className="lbl">When the requester resubmits</span>
          <select className="select" value={s.rejectArg || "this"} onChange={(e) => patch({ rejectArg: e.target.value })}>
            <option value="this">Resume at this step</option><option value="start">Restart the approvals from step 1</option>
          </select></label>)}
      {s.onReject === "back" && (
        <label className="field-group" style={{ margin: 0 }}><span className="lbl">Send back to</span>
          <select className="select" value={s.rejectArg} onChange={(e) => patch({ rejectArg: e.target.value })}>
            {earlier.map((x) => <option key={x.key} value={x.key}>{`Step ${earlier.indexOf(x) + 1}: ${x.name || "Approval"}`}</option>)}
          </select></label>)}
      {s.onReject === "escalate" && (
        <div className="field-group" style={{ margin: 0 }}><span className="lbl">Escalate to <span className="req">*</span></span>
          <select className="select" value={etype} onChange={(e) => { setEtype(e.target.value as "user"); patch({ rejectArg: "", rejectLabel: "" }); }}>
            <option value="user">A named person</option><option value="group">An approver group</option><option value="role">Anyone with a role</option><option value="custom">An assignment group</option>
          </select>
          {etype === "user" ? (s.rejectArg ? <div className="sr-members"><span className="sr-member">{s.rejectLabel || escalateName(s.rejectArg)}<button type="button" onClick={() => patch({ rejectArg: "", rejectLabel: "" })}>x</button></span></div> : (
            <><input className="input" placeholder="Search people by name or e-mail..." value={q} onChange={(e) => setQ(e.target.value)} />
              {found.length > 0 && <div className="sr-suggest">{found.map((u) => <button key={u.userId} type="button" onClick={() => { patch({ rejectArg: `user:${u.userId}`, rejectLabel: u.fullName }); setQ(""); setFound([]); }}>{u.fullName}</button>)}</div>}</>
          )) : (
            <select className="select" value={s.rejectArg.startsWith(etype + ":") ? s.rejectArg.split(":")[1] : ""} onChange={(e) => patch({ rejectArg: e.target.value ? `${etype}:${e.target.value}` : "", rejectLabel: list.find((o) => String(o.id) === e.target.value)?.label ?? "" })}>
              <option value="">Select...</option>{list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>)}
        </div>)}
      <div style={{ fontSize: 12.5, color: "#667085", lineHeight: 1.5 }}>{info.hint} <em>{info.example}</em></div>
    </div>
  );
}

const EMAIL_TO: Record<string, string> = { requester: "the requester", assignedAgent: "the assigned agent", workgroup: "the workgroup" };
const PRIORITY_FIELD = { priority: "Priority", assignmentGroup: "Assignment group", agent: "Fulfilment agent" } as const;
const updateText = (s: DStep, lk: Lookups) => {
  const list = s.updField === "priority" ? lk.priorities : s.updField === "assignmentGroup" ? lk.assignmentGroups : [];
  const v = s.updValue ? list.find((o) => o.id === s.updValue)?.label ?? s.updLabel ?? `#${s.updValue}` : "";
  return v ? `Set ${PRIORITY_FIELD[s.updField].toLowerCase()} to ${v}` : "Choose what to change";
};

/** Search people by name, or pick a group / role. Used by "If approved" notify and assign. */
function WhoPicker({ types, type, id, label, lk, onChange }: { types: ("user" | "group" | "role" | "custom")[]; type: string; id: number | null; label: string; lk: Lookups; onChange: (v: { type: string; id: number | null; label: string }) => void }) {
  const [q, setQ] = useState(""); const [found, setFound] = useState<{ userId: number; fullName: string }[]>([]);
  useEffect(() => {
    if (type !== "user" || q.trim().length < 2) { setFound([]); return; }
    let live = true;
    const t = setTimeout(() => { api.get<{ userId: number; fullName: string }[]>(`/users/directory?q=${encodeURIComponent(q.trim())}`).then((r) => { if (live) setFound(r); }).catch(() => { if (live) setFound([]); }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, type]);
  const NAMES = { user: "A named person", group: "An approver group", role: "Anyone with a role", custom: "An assignment group" } as const;
  const list = type === "role" ? lk.roles : type === "group" ? lk.groups : lk.assignmentGroups;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {types.length > 1 && <select className="select" value={type} onChange={(e) => onChange({ type: e.target.value, id: null, label: "" })}>{types.map((t) => <option key={t} value={t}>{NAMES[t]}</option>)}</select>}
      {type === "user" ? (id ? <div className="sr-members"><span className="sr-member">{label || `User #${id}`}<button type="button" onClick={() => onChange({ type, id: null, label: "" })}>x</button></span></div> : (
        <><input className="input" placeholder="Search people by name or e-mail..." value={q} onChange={(e) => setQ(e.target.value)} />
          {found.length > 0 && <div className="sr-suggest">{found.map((u) => <button key={u.userId} type="button" onClick={() => { onChange({ type, id: u.userId, label: u.fullName }); setQ(""); setFound([]); }}>{u.fullName}</button>)}</div>}</>
      )) : (
        <select className="select" value={id ?? ""} onChange={(e) => onChange({ type, id: e.target.value ? Number(e.target.value) : null, label: list.find((o) => String(o.id) === e.target.value)?.label ?? "" })}>
          <option value="">Select...</option>{list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>)}
    </div>
  );
}

/** What the approver can do on this step, and what happens if they do nothing. */
function ControlsFields({ s, lk, patch }: { s: DStep; lk: Lookups; patch: (p: Partial<DStep>) => void }) {
  const [wtype, wid] = s.timeoutArg.includes(":") ? s.timeoutArg.split(":") : ["group", ""];
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  return (
    <div style={{ background: "#F9FAFB", border: "1px solid #E4E7EC", borderRadius: 8, padding: "12px 14px", display: "grid", gap: 10 }}>
      <span className="lbl" style={{ margin: 0 }}>What the approver can do</span>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={s.allowReject} onChange={(e) => patch({ allowReject: e.target.checked })} /> Can reject</label>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={s.allowInfo} onChange={(e) => patch({ allowInfo: e.target.checked })} /> Can ask the requester for information</label>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={s.allowDelegate} onChange={(e) => patch({ allowDelegate: e.target.checked })} /> Can delegate to someone else</label>
      </div>
      <label className="field-group" style={{ margin: 0 }}><span className="lbl">Comments</span>
        <select className="select" value={s.commentPolicy} onChange={(e) => patch({ commentPolicy: e.target.value as DStep["commentPolicy"] })}>
          <option value="reject">Required to reject or to ask for information</option>
          <option value="both">Required to approve or reject</option>
          <option value="optional">Always optional</option>
        </select></label>
      <span className="lbl" style={{ margin: 0 }}>Reminders and timeout</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="field-group" style={{ margin: 0 }}><span className="lbl">Remind after (business days)</span><input className="input" type="number" min={0} value={s.remindDays} onChange={(e) => patch({ remindDays: num(e.target.value) })} /></label>
        <label className="field-group" style={{ margin: 0 }}><span className="lbl">Time out after (business days)</span><input className="input" type="number" min={0} value={s.timeoutDays} onChange={(e) => patch({ timeoutDays: num(e.target.value) })} /></label>
      </div>
      {s.timeoutDays > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <label className="field-group" style={{ margin: 0 }}><span className="lbl">If nobody decides</span>
            <select className="select" value={s.onTimeout} onChange={(e) => patch({ onTimeout: e.target.value as DStep["onTimeout"] })}>
              <option value="escalate">Escalate to someone else</option><option value="approve">Approve automatically</option><option value="reject">Reject automatically</option>
            </select></label>
          {s.onTimeout === "escalate" && <WhoPicker types={["user", "group", "role", "custom"]} type={wtype || "group"} id={Number(wid) || null} label={s.timeoutLabel} lk={lk} onChange={(v) => patch({ timeoutArg: v.id ? `${v.type}:${v.id}` : "", timeoutLabel: v.label })} />}
        </div>)}
      <div style={{ fontSize: 12.5, color: "#667085" }}>Business days skip weekends. Reminders go to whoever the step is waiting on.</div>
    </div>
  );
}

const APPROVE_INFO: Record<ApproveOutcome, string> = {
  next: "The request moves on to the next step.",
  fulfil: "The remaining approvals are skipped and the request goes straight to fulfilment. Example: a director's approval covers everything below it.",
  step: "The approvals in between are skipped and the request carries on at the step you choose.",
  notify: "That person is told the step was approved, then the request carries on.",
  priority: "The request's priority is changed, then it carries on.",
  assign: "A fulfilment agent is assigned, then the request carries on.",
  reroute: "The request is rerouted to another workgroup. Any steps left are skipped.",
  task: "A fulfilment task is added to the request, then it carries on.",
  auto: "Skips every remaining step and marks the request fulfilled with no manual work. Fulfilment tasks that were queued are cancelled. Example: once approved, a licence is assigned automatically from the pool.",
};

/** "If approved, go to": what an approval does besides moving on. */
function ApproveFields({ s, later, lk, patch }: { s: DStep; later: DStep[]; lk: Lookups; patch: (p: Partial<DStep>) => void }) {
  const choose = (o: ApproveOutcome) => patch({ onApprove: o, approveArg: o === "step" ? later[0]?.key ?? "" : "", approveLabel: "" });
  const [wtype, wid] = s.approveArg.includes(":") ? s.approveArg.split(":") : ["user", s.approveArg];
  return (
    <div style={{ background: "#F6FEF9", border: "1px solid #ABEFC6", borderRadius: 8, padding: "12px 14px", display: "grid", gap: 10 }}>
      <label className="field-group" style={{ margin: 0 }}><span className="lbl" style={{ color: "#067647" }}>If approved, go to</span>
        <select className="select" value={s.onApprove} onChange={(e) => choose(e.target.value as ApproveOutcome)}>
          <option value="next">Continue to the next step</option>
          <option value="fulfil">Skip the remaining approvals and fulfil</option>
          {later.length > 0 && <option value="step">Skip ahead to a later approval step</option>}
          <option value="notify">Notify someone, then continue</option>
          <option value="priority">Set the priority, then continue</option>
          <option value="assign">Assign a fulfilment agent, then continue</option>
          <option value="reroute">Reroute to another workgroup</option>
          <option value="task">Add a fulfilment task, then continue</option>
          <option value="auto">Fulfil automatically (no manual work)</option>
        </select></label>
      {s.onApprove === "step" && <select className="select" value={s.approveArg} onChange={(e) => patch({ approveArg: e.target.value })}>{later.map((x) => <option key={x.key} value={x.key}>{x.name || "Approval"}</option>)}</select>}
      {s.onApprove === "notify" && <WhoPicker types={["user", "group", "role", "custom"]} type={wtype || "user"} id={Number(wid) || null} label={s.approveLabel} lk={lk} onChange={(v) => patch({ approveArg: v.id ? `${v.type}:${v.id}` : "", approveLabel: v.label })} />}
      {s.onApprove === "assign" && <WhoPicker types={["user"]} type="user" id={Number(s.approveArg) || null} label={s.approveLabel} lk={lk} onChange={(v) => patch({ approveArg: v.id ? String(v.id) : "", approveLabel: v.label })} />}
      {s.onApprove === "priority" && <select className="select" value={s.approveArg} onChange={(e) => patch({ approveArg: e.target.value })}><option value="">Select a priority...</option>{lk.priorities.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>}
      {s.onApprove === "reroute" && <select className="select" value={s.approveArg} onChange={(e) => patch({ approveArg: e.target.value })}><option value="">Select a workgroup...</option>{lk.assignmentGroups.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>}
      {s.onApprove === "auto" && <textarea className="textarea" maxLength={500} placeholder="Resolution note for the requester, e.g. A licence from the pool was assigned to your account." value={s.approveArg} onChange={(e) => patch({ approveArg: e.target.value })} />}
      {s.onApprove === "task" && <input className="input" placeholder="Task name, e.g. Raise a purchase order" value={s.approveArg} onChange={(e) => patch({ approveArg: e.target.value })} />}
      <div style={{ fontSize: 12.5, color: "#667085", lineHeight: 1.5 }}>{APPROVE_INFO[s.onApprove]}</div>
    </div>
  );
}

const REC_LABEL: Record<DStep["recType"], string> = { incident: "Incident", change: "Change", problem: "Problem", work_order: "Work order", request: "Service Request" };

function WaitFields({ s, patch }: { s: DStep; patch: (p: Partial<DStep>) => void }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label className="field-group" style={{ margin: 0 }}><span className="lbl">Wait for (business days) <span className="req">*</span></span>
        <input className="input" type="number" min={1} max={365} style={{ maxWidth: 140 }} value={s.waitDays} onChange={(e) => patch({ waitDays: Math.round(Number(e.target.value)) || 0 })} /></label>
      <div style={{ fontSize: 12.5, color: "#667085" }}>The request shows as Waiting and carries on by itself when the time is up. Steps after the wait run when it ends. Weekends do not count.</div>
    </div>
  );
}

function RecordFields({ s, patch, first, lk }: { s: DStep; patch: (p: Partial<DStep>) => void; first: boolean; lk: Lookups }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label className="field-group" style={{ margin: 0 }}><span className="lbl">Record type</span>
        <select className="select" value={s.recType} onChange={(e) => patch({ recType: e.target.value as DStep["recType"] })}>{Object.entries(REC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      {s.recType === "request" && (
        <label className="field-group" style={{ margin: 0 }}><span className="lbl">Catalog item <span className="req">*</span></span>
          <select className="select" value={s.recCatalogId ?? ""} onChange={(e) => patch({ recCatalogId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Select a catalog item...</option>{lk.catalogs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select></label>
      )}
      <label className="field-group" style={{ margin: 0 }}><span className="lbl">Title <span className="req">*</span></span>
        <input className="input" placeholder="e.g. Prepare {{request.item}} for {{request.requestedBy}}" value={s.recTitle} onChange={(e) => patch({ recTitle: e.target.value })} /></label>
      <label className="field-group" style={{ margin: 0 }}><span className="lbl">Description</span>
        <textarea className="textarea" placeholder="Optional. You can use {{request.number}}, {{request.item}} and {{request.requestedBy}}." value={s.recDescription} onChange={(e) => patch({ recDescription: e.target.value })} /></label>
      {s.recType === "incident" && (
        <label className="field-group" style={{ margin: 0 }}><span className="lbl">Incident Priority</span>
          <select className="select" value={s.recPriority} onChange={(e) => patch({ recPriority: e.target.value })}>
            <option value="">Use the default priority</option>{lk.incidentPriorities.map((p) => <option key={p.id} value={p.label}>{p.label}</option>)}
          </select></label>)}
      {s.recType === "request" && (
        <label className="field-group" style={{ margin: 0 }}><span className="lbl">Service Request Priority</span>
          <select className="select" value={s.recPriorityId ?? ""} onChange={(e) => patch({ recPriorityId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Use the catalog default</option>{lk.priorities.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select></label>)}
      {(s.recType === "problem" || s.recType === "work_order") && (
        <label className="field-group" style={{ margin: 0 }}><span className="lbl">Priority</span>
          <input className="input" placeholder="e.g. P3 - Medium" style={{ maxWidth: 220 }} value={s.recPriority} onChange={(e) => patch({ recPriority: e.target.value })} /></label>)}
      <div style={{ fontSize: 12.5, color: "#667085" }}>{first ? "Raised as soon as the request is submitted" : "Raised when the approval before it is approved"} and linked to the request. If it cannot be raised, that is recorded in the request history and the request carries on.</div>
    </div>
  );
}

function IntegrationFields({ s, patch }: { s: DStep; patch: (p: Partial<DStep>) => void }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label className="field-group" style={{ margin: 0 }}><span className="lbl">Integration</span>
        <select className="select" value={s.intKind} onChange={(e) => patch({ intKind: e.target.value as DStep["intKind"] })}>
          <option value="webhook">Webhook (send the request's details to a web address)</option>
          <option value="teams">Microsoft Teams message (incoming webhook)</option>
        </select></label>
      <label className="field-group" style={{ margin: 0 }}><span className="lbl">Address <span className="req">*</span></span>
        <input className="input" placeholder="https://..." value={s.intUrl} onChange={(e) => patch({ intUrl: e.target.value })} /></label>
      {s.intKind === "webhook" && (
        <label className="field-group" style={{ margin: 0 }}><span className="lbl">Secret (optional)</span>
          <input className="input" type="password" autoComplete="new-password" placeholder="Sent as the X-Webhook-Secret header" value={s.intSecret} onChange={(e) => patch({ intSecret: e.target.value })} /></label>)}
      <div style={{ fontSize: 12.5, color: "#667085" }}>The address must be https and public: internal network addresses are refused. A failed call is recorded in the request history and the request carries on. Entra ID, Microsoft 365 and Intune actions need a Microsoft Graph connection that this system does not have, so they are not offered.</div>
    </div>
  );
}

function EmailFields({ s, lk, patch, first }: { s: DStep; lk: Lookups; patch: (p: Partial<DStep>) => void; first: boolean }) {
  const toggle = (k: string) => patch({ emailTo: s.emailTo.includes(k) ? s.emailTo.filter((x) => x !== k) : [...s.emailTo, k] });
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label className="field-group" style={{ margin: 0 }}><span className="lbl">E-mail template <span className="req">*</span></span>
        <select className="select" value={s.emailRuleId ?? ""} onChange={(e) => patch({ emailRuleId: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Select a template...</option>{lk.templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select></label>
      <div className="field-group" style={{ margin: 0 }}><span className="lbl">Send to <span className="req">*</span></span>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{Object.entries(EMAIL_TO).map(([k, v]) => <label key={k} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={s.emailTo.includes(k)} onChange={() => toggle(k)} />{v[0].toUpperCase() + v.slice(1)}</label>)}</div></div>
      <div style={{ fontSize: 12.5, color: "#667085" }}>{first ? "Sent as soon as the request is submitted." : "Sent when the approval before it is approved. Nothing is sent if that approval is rejected."} Templates are managed under E-mail notifications.</div>
    </div>
  );
}

function UpdateFields({ s, lk, patch, first }: { s: DStep; lk: Lookups; patch: (p: Partial<DStep>) => void; first: boolean }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label className="field-group" style={{ margin: 0 }}><span className="lbl">Change</span>
        <select className="select" value={s.updField} onChange={(e) => patch({ updField: e.target.value as DStep["updField"], updValue: null, updLabel: "" })}>
          {Object.entries(PRIORITY_FIELD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
      <div className="field-group" style={{ margin: 0 }}><span className="lbl">To <span className="req">*</span></span>
        {s.updField === "agent"
          ? <WhoPicker types={["user"]} type="user" id={s.updValue} label={s.updLabel} lk={lk} onChange={(v) => patch({ updValue: v.id, updLabel: v.label })} />
          : <select className="select" value={s.updValue ?? ""} onChange={(e) => patch({ updValue: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Select...</option>{(s.updField === "priority" ? lk.priorities : lk.assignmentGroups).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>}</div>
      <div style={{ fontSize: 12.5, color: "#667085" }}>{first ? "Applied as soon as the request is submitted." : "Applied when the approval before it is approved."}</div>
    </div>
  );
}

/* ──────────────────────── checks + test ──────────────────────── */
interface Issue { level: "error" | "warn"; key?: string; text: string }
function lint(name: string, steps: DStep[], lk: Lookups): Issue[] {
  const out: Issue[] = [];
  if (!name.trim()) out.push({ level: "error", text: "Give the lifecycle a name." });
  if (!steps.length) { out.push({ level: "error", text: "Add at least one step." }); return out; }
  if (!steps.some((x) => x.kind === "approval")) out.push({ level: "warn", text: "There is no approval step, so every request goes straight to fulfilment." });
  steps.forEach((s, i) => {
    const at = `Step ${i + 1} (${s.name.trim() || KIND_LABEL[s.kind]})`; const e = (text: string) => out.push({ level: "error", key: s.key, text: `${at}: ${text}` }); const w = (text: string) => out.push({ level: "warn", key: s.key, text: `${at}: ${text}` });
    if (!s.name.trim()) e("needs a name.");
    if (s.kind === "approval") {
      if (s.approverType === "parallel" ? s.parallel.length < 2 || s.parallel.some((a) => a.type !== "requester_manager" && !a.ref) : s.approverType !== "requester_manager" && !s.approverId) e("choose who approves.");
      if (s.onReject === "escalate" && !s.rejectArg) e('"If rejected" escalates but nobody is chosen.');
      if (s.onReject === "back" && !steps.slice(0, i).some((x) => x.kind === "approval" && x.key === s.rejectArg)) e('"If rejected" goes back, but no earlier approval step is chosen.');
      if (s.timeoutDays > 0 && s.onTimeout === "escalate" && !s.timeoutArg) e("the timeout escalates but nobody is chosen.");
      if (s.remindDays > 0 && s.timeoutDays > 0 && s.remindDays >= s.timeoutDays) e("the reminder must come before the timeout.");
      if (!s.allowReject && s.onReject !== "close") w("rejecting is switched off, so \"If rejected\" can only happen through a timeout.");
      if (!s.allowReject && !s.allowInfo && s.timeoutDays === 0) w("the approver can only approve this step.");
      if (s.onReject === "continue") w("a rejection is only recorded as advice, so this approval cannot stop the request.");
      if (["priority", "assign", "reroute", "task", "notify"].includes(s.onApprove) && !s.approveArg.trim()) e('"If approved" needs a value.');
      if (s.onApprove === "step" && !steps.slice(i + 1).some((x) => x.kind === "approval" && x.key === s.approveArg)) e('"If approved" skips ahead, but no later approval step is chosen.');
      if ((s.onApprove === "fulfil" || s.onApprove === "reroute") && steps.slice(i + 1).some((x) => x.kind === "approval")) w("approving here skips every approval after it.");
    }
    if (s.kind === "email" && (!s.emailRuleId || !s.emailTo.length)) e("choose a template and who receives it.");
    if (s.kind === "email" && s.emailRuleId && !lk.templates.some((t) => t.id === s.emailRuleId)) w("the chosen e-mail template is inactive or no longer exists, so nothing will be sent.");
    if (s.kind === "update" && !s.updValue) e("choose what to change the request to.");
    if (s.kind === "wait" && !(s.waitDays >= 1 && s.waitDays <= 365)) e("wait between 1 and 365 business days.");
    if (s.kind === "wait" && i === steps.length - 1) w("nothing follows this wait, so it only delays the start of fulfilment.");
    if (s.kind === "record" && !s.recTitle.trim()) e("give the new record a title.");
    if (s.kind === "integration" && !/^https:\/\/\S+$/i.test(s.intUrl.trim())) e("the address must start with https://.");
    if (s.kind === "approval" && s.onApprove === "auto" && !s.approveArg.trim()) e("write the resolution note the requester will see.");
    if (s.kind === "approval" && s.onApprove === "auto" && steps.slice(i + 1).some((x) => x.kind === "task")) w("fulfilling automatically cancels the fulfilment tasks after this step.");
    if (s.kind === "condition" && (!s.field.trim() || (!NO_VALUE.includes(s.operator) && !s.value.trim()))) e("complete the condition.");
    if (s.kind === "task" && (!s.tasks.length || s.tasks.some((t) => !t.taskName.trim() || !t.assigneeId))) e("every task needs a name and an assignee.");
  });
  return out;
}

function ChecksPanel({ name, steps, lk, onOpen }: { name: string; steps: DStep[]; lk: Lookups; onOpen: (key: string) => void }) {
  const issues = lint(name, steps, lk);
  const errors = issues.filter((x) => x.level === "error").length;
  return (
    <div className="card sr-panel" style={{ marginTop: 16 }}>
      <div className="sr-panel-head"><h3>Checks</h3>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: errors ? "#B42318" : issues.length ? "#B54708" : "#027A48" }}>{errors ? `${errors} to fix before saving` : issues.length ? `${issues.length} to look at` : "No problems found"}</span></div>
      {issues.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>Every step is complete.</div> : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {issues.map((x, i) => (
            <li key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: x.level === "error" ? "#B42318" : "#B54708", minWidth: 52 }}>{x.level === "error" ? "Fix" : "Note"}</span>
              {x.key ? <button type="button" onClick={() => onOpen(x.key!)} style={{ border: 0, background: "none", padding: 0, textAlign: "left", cursor: "pointer", color: "var(--ink)", font: "inherit" }}>{x.text}</button> : <span>{x.text}</span>}
            </li>))}
        </ul>)}
    </div>
  );
}

/** Walks the lifecycle the way the engine does, using the answers chosen here. Nothing is saved or sent. */
function simulate(steps: DStep[], ans: Record<string, string>, lk: Lookups): string[] {
  const out = ["Request submitted."]; const skipped = new Set<string>(); const seen = new Map<string, number>();
  const label = (s: DStep) => s.name.trim() || KIND_LABEL[s.kind];
  const firstTask = steps.findIndex((x) => x.kind === "task");
  let i = 0; let guard = 0;
  while (i < steps.length && guard++ < 80) {
    const s = steps[i];
    if (s.kind === "email") { out.push(`E-mail "${lk.templates.find((t) => t.id === s.emailRuleId)?.label ?? "?"}" sent to ${s.emailTo.map((t) => EMAIL_TO[t] ?? t).join(", ")}.`); i++; continue; }
    if (s.kind === "update") { out.push(`${label(s)}: ${updateText(s, lk)}.`); i++; continue; }
    if (s.kind === "wait") { out.push(`${label(s)}: the request pauses for ${s.waitDays} business day${s.waitDays === 1 ? "" : "s"}, then carries on.`); i++; continue; }
    if (s.kind === "record") { out.push(`${label(s)}: a ${REC_LABEL[s.recType].toLowerCase()} "${s.recTitle || "untitled"}" is raised and linked to the request.`); i++; continue; }
    if (s.kind === "integration") { out.push(`${label(s)}: ${s.intKind === "teams" ? "a message is posted to Teams" : "the webhook is called"}.`); i++; continue; }
    if (s.kind === "task") { out.push(`Fulfilment task${s.tasks.length === 1 ? "" : "s"}: ${s.tasks.map((t) => t.taskName || "unnamed").join(", ")}.`); i++; continue; }
    if (s.kind === "condition") {
      const yes = (ans[s.key] ?? "yes") === "yes"; const to = yes ? s.yesTo : s.noTo;
      out.push(`${label(s)}: condition ${yes ? "satisfied" : "not satisfied"}.`);
      if (to === "end") { out.push("Lifecycle finished."); return out; }
      if (to === "fulfil_auto" || to === "fulfilment") { if (firstTask < 0) { out.push("Goes to fulfilment."); return out; } i = firstTask; continue; }
      const t = steps.findIndex((x) => x.key === to); i = t >= 0 ? t : i + 1; continue;
    }
    // approval
    if (skipped.has(s.key)) { out.push(`${label(s)}: skipped.`); i++; continue; }
    const times = seen.get(s.key) ?? 0; seen.set(s.key, times + 1);
    let decision = times > 0 ? "approve" : ans[s.key] ?? "approve";
    let auto = "";
    if (decision === "timeout") {
      if (s.timeoutDays <= 0) { out.push(`${label(s)}: no timeout is set, so the request waits for an answer.`); return out; }
      out.push(`${label(s)}: no decision in ${s.timeoutDays} business day${s.timeoutDays === 1 ? "" : "s"}.`);
      if (s.onTimeout === "escalate") {
        const appeal = ans[`${s.key}:appeal`] ?? "approve";
        out.push(`Escalated to ${s.timeoutLabel || "another approver"} for the final decision.`);
        if (appeal === "reject") { out.push("The appeal is rejected. The request is closed as Rejected."); return out; }
        out.push("The appeal is approved. The request carries on."); i++; continue;
      }
      decision = s.onTimeout === "approve" ? "approve" : "reject"; auto = ` (automatically, after ${s.timeoutDays} business day${s.timeoutDays === 1 ? "" : "s"})`;
    }
    const who = s.approverType === "requester_manager" ? "the requester's manager" : s.approverType === "parallel" ? `${s.parallel.length} approvers${s.approvalRule !== "any" ? ` (${s.approvalRule})` : ""}` : s.approverLabel || "the approver";
    if (decision === "approve") {
      out.push(`${label(s)}: approved by ${who}${times > 0 ? " (second time round)" : ""}${auto}.`);
      const later = steps.slice(i + 1).filter((x) => x.kind === "approval");
      if (s.onApprove === "fulfil" || s.onApprove === "reroute") { later.forEach((x) => skipped.add(x.key)); out.push(s.onApprove === "fulfil" ? "Remaining approvals skipped." : `Rerouted to ${lk.assignmentGroups.find((g) => String(g.id) === s.approveArg)?.label ?? "another workgroup"}; remaining approvals skipped.`); }
      else if (s.onApprove === "step") { const t = steps.findIndex((x) => x.key === s.approveArg); steps.slice(i + 1, t < 0 ? i + 1 : t).filter((x) => x.kind === "approval").forEach((x) => skipped.add(x.key)); if (t >= 0) out.push(`Skips ahead to "${label(steps[t])}".`); }
      else if (s.onApprove === "notify") out.push(`${s.approveLabel || "Someone"} is notified.`);
      else if (s.onApprove === "priority") out.push(`Priority set to ${lk.priorities.find((p) => String(p.id) === s.approveArg)?.label ?? "the chosen priority"}.`);
      else if (s.onApprove === "assign") out.push(`${s.approveLabel || "An agent"} is assigned to fulfil it.`);
      else if (s.onApprove === "task") out.push(`Task added: ${s.approveArg}.`);
      else if (s.onApprove === "auto") { out.push(`Fulfilled automatically: ${s.approveArg || "no note"}. The request closes without manual work.`); return out; }
      i++; continue;
    }
    out.push(`${label(s)}: rejected by ${who}${auto}.`);
    if (s.onReject === "close") { out.push("The request is closed as Rejected. Nothing after this step is asked."); return out; }
    if (s.onReject === "continue") { out.push("The rejection is recorded as advice and the request carries on."); i++; continue; }
    if (s.onReject === "rework") {
      const restart = s.rejectArg === "start";
      out.push(`Returned to the requester. After they resubmit, approvals ${restart ? "restart from the first step" : `resume at "${label(s)}"`} (assumed approved this time).`);
      if (restart) { skipped.clear(); i = 0; } continue;
    }
    if (s.onReject === "back") {
      const t = steps.findIndex((x) => x.key === s.rejectArg);
      if (t < 0 || t >= i) { out.push("Nothing earlier to go back to, so it is returned to the requester."); return out; }
      out.push(`Sent back to "${label(steps[t])}" to be reviewed again (assumed approved this time).`); i = t; continue;
    }
    if (s.onReject === "escalate") {
      const appeal = ans[`${s.key}:appeal`] ?? "approve";
      out.push(`Escalated to ${s.rejectLabel || "another approver"} for the final decision.`);
      if (appeal === "reject") { out.push("The appeal is rejected. The request is closed as Rejected."); return out; }
      out.push("The appeal is approved. The request carries on."); i++; continue;
    }
  }
  out.push(steps.some((x) => x.kind === "task") ? "Request moves to the fulfilment queue." : "Request moves to the fulfilment queue with no tasks.");
  return out;
}

function TestPanel({ steps, lk }: { steps: DStep[]; lk: Lookups }) {
  const [ans, setAns] = useState<Record<string, string>>({}); const [trace, setTrace] = useState<string[] | null>(null);
  const interesting = steps.filter((s) => s.kind === "approval" || s.kind === "condition");
  if (!interesting.length) return null;
  const set = (k: string, v: string) => { setAns((a) => ({ ...a, [k]: v })); setTrace(null); };
  return (
    <div className="card sr-panel" style={{ marginTop: 16 }}>
      <div className="sr-panel-head"><h3>Test this lifecycle</h3><button className="btn-ghost" onClick={() => setTrace(simulate(steps, ans, lk))}>Run test</button></div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Choose what happens at each step, then run the test to see the path a request would take. Nothing is saved or sent.</div>
      <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
        {interesting.map((s) => (
          <div key={s.key} style={{ display: "grid", gridTemplateColumns: "1fr 190px", gap: 8, alignItems: "center", fontSize: 13 }}>
            <span>{s.name.trim() || KIND_LABEL[s.kind]}</span>
            {s.kind === "approval"
              ? <select className="select" value={ans[s.key] ?? "approve"} onChange={(e) => set(s.key, e.target.value)}><option value="approve">Approver approves</option><option value="reject">Approver rejects</option>{s.timeoutDays > 0 && <option value="timeout">Nobody answers (times out)</option>}</select>
              : <select className="select" value={ans[s.key] ?? "yes"} onChange={(e) => set(s.key, e.target.value)}><option value="yes">Condition satisfied</option><option value="no">Condition not satisfied</option></select>}
            {s.kind === "approval" && ((s.onReject === "escalate" && ans[s.key] === "reject") || (s.onTimeout === "escalate" && ans[s.key] === "timeout")) && (<><span style={{ color: "var(--muted)" }}>Appeal to {(ans[s.key] === "timeout" ? s.timeoutLabel : s.rejectLabel) || "the escalation approver"}</span>
              <select className="select" value={ans[`${s.key}:appeal`] ?? "approve"} onChange={(e) => set(`${s.key}:appeal`, e.target.value)}><option value="approve">Appeal approved</option><option value="reject">Appeal rejected</option></select></>)}
          </div>))}
      </div>
      {trace && <ol style={{ margin: "14px 0 0", paddingLeft: 20, display: "grid", gap: 4, fontSize: 13 }}>{trace.map((t, i) => <li key={i}>{t}</li>)}</ol>}
    </div>
  );
}

function ConditionFields({ s, later, patch }: { s: DStep; later: DStep[]; patch: (p: Partial<DStep>) => void }) {
  const PRESETS = [
    { label: "Estimated cost check (> $1,000)", field: "Estimated cost", operator: "is greater than", value: "$1,000", yesTo: "fulfil_auto", noTo: "fulfilment" },
    { label: "High Priority check", field: "Priority", operator: "equals", value: "High", yesTo: "", noTo: "" },
    { label: "Hardware cost check (> $500)", field: "Total Cost", operator: "is greater than", value: "$500", yesTo: "", noTo: "" },
    { label: "VIP Requester check", field: "VIP", operator: "is true", value: "", yesTo: "", noTo: "" },
  ];

  const target = (field: "yesTo" | "noTo", label: string, accentColor: string) => (
    <label className="field-group">
      <span className="lbl" style={{ color: accentColor, fontWeight: 600 }}>{label}</span>
      <select className="select" value={s[field]} onChange={(e) => patch({ [field]: e.target.value } as Partial<DStep>)}>
        <option value="">Continue to the next step</option>
        <option value="fulfil_auto">Fulfil automatically (Skip approval straight to fulfilment)</option>
        <option value="fulfilment">Fulfilment (Route to fulfilment workgroup)</option>
        <option value="end">Finish the lifecycle</option>
        {later.map((n) => <option key={n.key} value={n.key}>Skip to: {n.name || "Untitled step"}</option>)}
      </select>
    </label>
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Quick Presets matching Screenshot 2 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#667085", textTransform: "uppercase" }}>Common Condition Checks:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="btn-ghost"
            style={{ height: 26, padding: "0 8px", fontSize: 11.5, background: "#F2F4F7" }}
            onClick={() => patch({
              field: p.field,
              operator: p.operator,
              value: p.value,
              yesTo: p.yesTo || s.yesTo,
              noTo: p.noTo || s.noTo,
            })}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="sr-form" style={{ margin: 0 }}>
        <div className="row" style={{ gridTemplateColumns: "1.4fr 1.2fr 1fr" }}>
          <label className="field-group">
            <span className="lbl">If this form field / attribute <span className="req">*</span></span>
            <input
              className="input"
              value={s.field}
              placeholder="e.g. Estimated cost, Priority, VIP..."
              list="common-condition-fields"
              onChange={(e) => patch({ field: e.target.value })}
            />
            <datalist id="common-condition-fields">
              <option value="Estimated cost" />
              <option value="Total Cost" />
              <option value="Priority" />
              <option value="Urgency" />
              <option value="Impact" />
              <option value="Department" />
              <option value="Location" />
            </datalist>
          </label>

          <label className="field-group">
            <span className="lbl">Comparison</span>
            <select className="select" value={s.operator} onChange={(e) => patch({ operator: e.target.value })}>
              {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>

          {!NO_VALUE.includes(s.operator) && (
            <label className="field-group">
              <span className="lbl">Value <span className="req">*</span></span>
              <input
                className="input"
                value={s.value}
                placeholder="e.g. $1,000, 500, High"
                onChange={(e) => patch({ value: e.target.value })}
              />
            </label>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        {target("yesTo", "Satisfied → Action", "#027A48")}
        {target("noTo", "Not satisfied → Action", "#B42318")}
      </div>
    </div>
  );
}

function TaskFields({ s, lk, patch }: { s: DStep; lk: Lookups; patch: (p: Partial<DStep>) => void }) {
  const setTask = (i: number, p: Partial<DTask>) => patch({ tasks: s.tasks.map((t, j) => (j === i ? { ...t, ...p } : t)) });
  return (
    <>
      {s.tasks.map((t, i) => (
        <div key={i} className="sr-form" style={{ margin: 0 }}>
          <div className="row">
            <label className="field-group"><span className="lbl">Task <span className="req">*</span></span><input className="input" value={t.taskName} onChange={(e) => setTask(i, { taskName: e.target.value })} /></label>
            <label className="field-group"><span className="lbl">Assign to</span><select className="select" value={t.assigneeType} onChange={(e) => setTask(i, { assigneeType: e.target.value as "group" | "role", assigneeId: null })}><option value="group">A workgroup</option><option value="role">Anyone with a role</option></select></label>
            <label className="field-group"><span className="lbl">{t.assigneeType === "group" ? "Workgroup" : "Role"} <span className="req">*</span></span>
              <select className="select" value={t.assigneeId ?? ""} onChange={(e) => setTask(i, { assigneeId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Select...</option>{(t.assigneeType === "group" ? lk.assignmentGroups : lk.roles).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select></label>
          </div>
          <div className="row">
            <label className="field-group"><span className="lbl">Instructions</span><input className="input" value={t.description} onChange={(e) => setTask(i, { description: e.target.value })} /></label>
            <label className="field-group"><span className="lbl">Due within (hours)</span><input className="input" type="number" min="1" value={t.dueDateHours} onChange={(e) => setTask(i, { dueDateHours: e.target.value })} /></label>
            <label className="field-group"><span className="lbl">Priority</span><select className="select" value={t.priority} onChange={(e) => setTask(i, { priority: e.target.value as DTask["priority"] })}>{["low", "medium", "high", "critical"].map((p) => <option key={p}>{p}</option>)}</select></label>
          </div>
          <div><button type="button" className="btn-ghost" onClick={() => patch({ tasks: s.tasks.filter((_, j) => j !== i) })}><Trash2 size={13} /> Remove task</button></div>
        </div>
      ))}
      <div><button type="button" className="btn-ghost" onClick={() => patch({ tasks: [...s.tasks, blankTask()] })}><Plus size={13} /> Add task</button></div>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>These become the fulfilment tasks on each request.</div>
    </>
  );
}
