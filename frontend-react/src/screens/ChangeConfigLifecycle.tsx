import React, { useEffect, useMemo, useState } from "react";
import { ErrorBar, errMsg } from "../components/configKit";
import { Check, ConfigPage, Lbl, uid, useDraft } from "../components/changeConfigKit";
import { useAuth } from "../AuthContext";
import { Link } from "../router";
import { useAsync } from "../hooks";
import { api } from "../api";
import { SearchSelect } from "../components/SearchSelect";
import { CHANGE_STATES, RISK_COLOR, RULES, changeApi, colorSet, type AutomaticStateTransitions, type ChangeModel, type CondRule, type Lifecycle, type LifecycleStep, type ModelStateTransitions, type RuleText, type Simulation, type StateExitRequirement, type StateTransitionRow, type StepType } from "../changeApi";

const KIND_OF: Record<StepType, LifecycleStep["kind"]> = { gate: "Assess", policy: "Authorize", individual: "Authorize", group: "Authorize", role: "Authorize", parallel: "Authorize", condition: "Authorize", wait: "Authorize", email: "Authorize", cabAgenda: "Authorize", update: "Authorize", task: "Authorize", record: "Authorize", integration: "Authorize", implement: "Implement", review: "Review", close: "Close" };
const META: Record<StepType, { label: string; tag: string; color: string; bg: string; help: string }> = {
  gate: { label: "Gate check", tag: "GATE CHECK", color: "#B54708", bg: "#FFF4ED", help: "A check the change must pass before it can be submitted. If it fails, the change goes back to its owner." },
  policy: { label: "Approval policy (by risk)", tag: "APPROVAL · POLICY", color: "#175CD3", bg: "#EFF4FC", help: "Asks the groups the Approval Policy & CAB page sets for this change model and risk level." },
  individual: { label: "Person approval", tag: "APPROVAL · PERSON", color: "#175CD3", bg: "#EFF4FC", help: "One named person decides." },
  group: { label: "Group / CAB approval", tag: "APPROVAL · GROUP", color: "#175CD3", bg: "#EFF4FC", help: "An approval group or board decides by the rule you choose." },
  role: { label: "Role approval", tag: "APPROVAL · ROLE", color: "#175CD3", bg: "#EFF4FC", help: "Asks whoever holds a role for this particular change." },
  parallel: { label: "Parallel approvals", tag: "APPROVAL · PARALLEL", color: "#5925DC", bg: "#F4F3FF", help: "Several approvers are asked at the same time." },
  condition: { label: "Condition (if / else)", tag: "CONDITION", color: "#B93815", bg: "#FFF4ED", help: "Decides whether the next step is used, from details of the change." },
  wait: { label: "Wait", tag: "AUTOMATION · WAIT", color: "#6941C6", bg: "#F4F3FF", help: "Pause the lifecycle for a configured duration. The wait is saved and resumes automatically." },
  email: { label: "Send e-mail", tag: "AUTOMATION · E-MAIL", color: "#175CD3", bg: "#EFF4FC", help: "Queue an e-mail to the configured addresses using change detail tokens." },
  cabAgenda: { label: "Add to CAB agenda", tag: "CAB", color: "#175CD3", bg: "#EFF4FC", help: "Request a CAB decision. The change appears on the CAB agenda and blocks later steps until decided." },
  update: { label: "Update change", tag: "AUTOMATION · UPDATE", color: "#067647", bg: "#ECFDF3", help: "Set a supported field on this change." },
  task: { label: "Create task", tag: "AUTOMATION · TASK", color: "#067647", bg: "#ECFDF3", help: "Create an open change task for a team or assignee." },
  record: { label: "Create related change", tag: "AUTOMATION · RECORD", color: "#067647", bg: "#ECFDF3", help: "Create a related change draft and link it to this change." },
  integration: { label: "Call integration", tag: "AUTOMATION · INTEGRATION", color: "#6941C6", bg: "#F4F3FF", help: "POST change details to a public HTTPS endpoint." },
  implement: { label: "Implement", tag: "STAGE", color: "#067647", bg: "#ECFDF3", help: "The change is scheduled, then worked. Required." },
  review: { label: "Post-implementation review", tag: "STAGE", color: "#067647", bg: "#ECFDF3", help: "Review before closure. Without this step a successful change closes as soon as implementation is recorded; a failure still goes to review." },
  close: { label: "Close", tag: "STAGE", color: "#067647", bg: "#ECFDF3", help: "The change is closed with a close code. Required." },
};
const PALETTE: { title: string; types: StepType[] }[] = [
  { title: "APPROVALS", types: ["individual", "group", "role", "parallel", "policy"] },
  { title: "LOGIC", types: ["condition", "gate"] },
  { title: "ACTIONS", types: ["wait", "email", "cabAgenda", "update", "task", "record", "integration"] },
];
const GATES: { id: NonNullable<LifecycleStep["gate"]>; label: string; help: string }[] = [
  { id: "risk", label: "Risk assessment complete", help: "Every required risk question is answered." }, { id: "plans", label: "Plans written", help: "Implementation, backout and test plans are filled in." },
  { id: "conflict", label: "No clash with another change", help: "The window does not overlap another change on the same service or CI. (A blackout always blocks.)" },
  { id: "leadtime", label: "Notice period met", help: "The planned start respects the model's lead time (always checked)." },
  { id: "cis", label: "Configuration items named", help: "At least one configuration item is listed." }, { id: "incident", label: "Incident linked", help: "A related incident is recorded." },
];
const ROLES = [
  { id: "changeManager", label: "Change manager", help: "The Change Management group." }, { id: "categoryTab", label: "Category technical board", help: "The board set on the change's category (or its parent); skipped if none." },
  { id: "assignmentGroup", label: "Assignment group members", help: "Members of the change's workgroup." },
] as const;
const mk = (type: StepType, o: Partial<LifecycleStep> = {}): LifecycleStep => ({ id: uid("st"), type, kind: KIND_OF[type], name: o.name ?? META[type].label, ...o });
const isApproval = (t: StepType) => ["policy", "individual", "group", "role", "parallel", "cabAgenda"].includes(t);
const typeOf = (s: LifecycleStep): StepType => s.type ?? (s.kind === "Assess" ? "gate" : s.kind === "Authorize" ? (s.mode === "group" ? "group" : "policy") : (s.kind.toLowerCase() as StepType));
const reviewText = (l: Lifecycle, models: { lifecycle: string; pir: string }[]) => {
  if (!l.steps.some((s) => typeOf(s) === "review")) return "No post-implementation review.";
  const linked = models.filter((m) => m.lifecycle === l.id);
  const rules = Array.from(new Set(linked.map((m) => m.pir).filter((rule) => rule !== "Never")));
  if (!rules.length) return linked.length ? "No post-implementation review." : "Review after implementation.";
  return `Review ${rules.map((rule) => rule === "Always" ? "always" : rule === "Only if unsuccessful" ? "only if unsuccessful" : rule === "High risk and unsuccessful changes" ? "for high risk or unsuccessful changes" : rule.toLowerCase()).join(" or ")}.`;
};
const assessText = (l: Lifecycle) => {
  const implement = l.steps.findIndex((s) => typeOf(s) === "implement");
  const steps = implement < 0 ? l.steps : l.steps.slice(0, implement);
  if (!steps.length) return "No assessment or authorisation steps configured.";
  const counts = [
    ["approval", steps.filter((s) => isApproval(typeOf(s))).length],
    ["condition", steps.filter((s) => typeOf(s) === "condition").length],
    ["gate", steps.filter((s) => typeOf(s) === "gate").length],
    ["other", steps.filter((s) => !["condition", "gate"].includes(typeOf(s)) && !isApproval(typeOf(s))).length],
  ] as const;
  return counts.filter(([, count]) => count > 0).map(([label, count]) => `${count} ${label}${count === 1 ? "" : "s"}`).join(", ") + ".";
};
const OPS: Record<string, [string, string][]> = {
  select: [["is", "is"], ["isNot", "is not"]], yesno: [["is", "is"]], number: [["gt", "is more than"], ["gte", "is at least"], ["lt", "is less than"], ["eq", "is exactly"]],
  ord: [["atLeast", "is at least"], ["atMost", "is at most"], ["is", "is"], ["isNot", "is not"]],
};

const QUICK: { id: string; name: string; desc: string; build: (groups: string[]) => LifecycleStep[] }[] = [
  { id: "pre", name: "Pre-approved", desc: "No approvals. A schedule check, then straight to scheduling.", build: () => [mk("gate", { gate: "conflict", name: "No schedule clash" }), mk("implement"), mk("close")] },
  { id: "cm", name: "Change manager only", desc: "Risk gate, then the change manager authorises.", build: () => [mk("gate", { gate: "risk", name: "Risk assessment complete" }), mk("role", { roleId: "changeManager", name: "Change manager approval" }), mk("implement"), mk("review"), mk("close")] },
  { id: "cab", name: "Risk-based CAB", desc: "Change manager for all; CAB only when the risk is High or above.", build: (g) => [
    mk("gate", { gate: "risk", name: "Risk assessment complete" }), mk("role", { roleId: "changeManager", name: "Change manager approval" }),
    mk("condition", { name: "Risk is High or above?", match: "all", rules: [{ k: "risk", op: "atLeast", value: "High" }], yes: "next", no: "skip" }),
    mk("group", { name: "CAB approval", group: g.includes("CAB") ? "CAB" : g[0] ?? "", rule: "Majority of members" }), mk("implement"), mk("review"), mk("close")] },
  { id: "ecab", name: "Emergency (ECAB)", desc: "ECAB now, review and retrospective CAB afterwards.", build: (g) => [mk("group", { name: "ECAB approval", group: g.includes("ECAB") ? "ECAB" : g[0] ?? "", rule: "Any one member" }), mk("implement"), mk("review"), mk("close")] },
  { id: "major", name: "Major change", desc: "Notice period, CAB and the technical board in parallel, then a senior sign-off.", build: (g) => [
    mk("gate", { gate: "leadtime", name: "Notice period met" }), mk("gate", { gate: "risk", name: "Risk assessment complete" }),
    mk("parallel", { name: "CAB and technical board", approvers: [`group:${g.includes("CAB") ? "CAB" : g[0] ?? ""}`, "role:categoryTab"], prule: "all" }),
    mk("role", { roleId: "changeManager", name: "Change manager sign-off" }), mk("implement"), mk("review"), mk("close")] },
];

const PROCESS_STATES = CHANGE_STATES.filter((state): state is Exclude<typeof state, "Cancelled"> => state !== "Cancelled");
const STATE_META: Record<StateTransitionRow["state"], { movedOnBy: string; purpose: string }> = {
  New: { movedOnBy: "Change owner", purpose: "Draft of a change request." },
  Assess: { movedOnBy: "Change manager", purpose: "Change readiness and risk are assessed." },
  Authorize: { movedOnBy: "Approval groups", purpose: "Required approvals are collected." },
  Scheduled: { movedOnBy: "Change owner", purpose: "Approved and waiting for the planned start." },
  Implement: { movedOnBy: "Assignment group", purpose: "The change is in progress." },
  Review: { movedOnBy: "Change manager", purpose: "Post-implementation review is completed." },
  Closed: { movedOnBy: "System (automatic)", purpose: "Final state." },
};
const STATE_REQUIREMENTS: { id: StateExitRequirement; label: string }[] = [
  { id: "risk", label: "Risk assessment" }, { id: "cis", label: "Configuration items" },
  { id: "implementationPlan", label: "Implementation plan" }, { id: "backoutPlan", label: "Backout plan" },
  { id: "testPlan", label: "Test plan" }, { id: "plannedWindow", label: "Planned window" },
  { id: "conflict", label: "Conflict check" }, { id: "approvals", label: "All approvals" },
  { id: "tasks", label: "Change tasks closed" }, { id: "outcome", label: "Implementation outcome" },
  { id: "pir", label: "Post-implementation review" }, { id: "closeCode", label: "Close code" },
];
const EMPTY_AUTOMATIC: AutomaticStateTransitions = {
  approvalToScheduled: false, implementAtPlannedStart: false, blockBlackout: false, closeAfterReviewDays: 0, overrunReminderMinutes: 0,
};
const initialStateTransitions = (model: ChangeModel, lifecycles: Lifecycle[]): ModelStateTransitions => {
  const lifecycle = lifecycles.find((item) => item.id === model.lifecycle);
  const usesApprovals = lifecycle?.steps.some((item) => isApproval(typeOf(item))) ?? false;
  const usesAssessment = lifecycle?.steps.some((item) => ["gate", "wait", "email", "update", "task", "record", "integration"].includes(typeOf(item))) ?? false;
  const usesReview = lifecycle?.steps.some((item) => typeOf(item) === "review") ?? model.pir !== "Never";
  const inUse = new Set<StateTransitionRow["state"]>(["New", "Scheduled", "Implement", "Closed"]);
  if (model.base !== "Standard" && usesAssessment) inUse.add("Assess");
  if (model.base !== "Standard" && usesApprovals) inUse.add("Authorize");
  if (usesReview) inUse.add("Review");
  return {
    model: model.name,
    states: PROCESS_STATES.map((state) => ({
      state, inUse: inUse.has(state), purpose: STATE_META[state].purpose, movedOnBy: STATE_META[state].movedOnBy,
      requirements: [], canCancel: ["New", "Assess", "Authorize", "Scheduled"].includes(state),
    })),
    automatic: { ...EMPTY_AUTOMATIC },
  };
};

export function ChangeLifecyclePage() {
  const d = useDraft("lifecycles");
  const stateDraft = useDraft("stateTransitions");
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const usersQ = useAsync(() => api.get<{ userId: number; fullName?: string; firstName?: string; lastName?: string; username?: string }[]>("/users/assignable"), []);
  const workgroupsQ = useAsync(() => changeApi.workgroups(), []);
  const [sel, setSel] = useState<string | null>(null);      // lifecycle being designed
  const [step, setStep] = useState<string | null>(null);    // selected step
  const [mode, setMode] = useState<"design" | "test">("design");
  const list = d.draft ?? [];
  const lc = list.find((l) => l.id === sel) ?? null;
  const models = d.cfg?.models ?? [];
  const groups = (d.cfg?.approval.groups ?? []).filter((g) => g.active);
  const groupNames = groups.map((g) => g.name);
  const people = (usersQ.data ?? []).map((u) => ({ id: u.userId, name: u.fullName ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || `User ${u.userId}`) }));
  const personOptions = [{ value: "", label: "Choose a person" }, ...people.map((p) => ({ value: String(p.id), label: p.name }))];
  const patch = (fn: (l: Lifecycle) => void) => d.edit((x) => { const t = x.find((y) => y.id === sel); if (t) fn(t); });
  const usedBy = (id: string) => models.filter((m) => m.lifecycle === id).map((m) => m.name);
  const saved = !!d.cfg?.lifecycles.some((l) => l.id === sel);
  const [listTab, setListTab] = useState<"lifecycles" | "states">("lifecycles");
  const [selectedStateModel, setSelectedStateModel] = useState("");
  useEffect(() => {
    if (!models.some((model) => model.name === selectedStateModel)) setSelectedStateModel(models[0]?.name ?? "");
  }, [models, selectedStateModel]);
  const savedStateTransitions = stateDraft.draft ?? [];
  const selectedModel = models.find((model) => model.name === selectedStateModel);
  const selectedTransitions = selectedModel
    ? savedStateTransitions.find((item) => item.model === selectedModel.name) ?? initialStateTransitions(selectedModel, d.cfg?.lifecycles ?? [])
    : null;
  const editSelectedTransitions = (fn: (value: ModelStateTransitions) => void) => {
    if (!selectedModel) return;
    stateDraft.edit((items) => {
      let config = items.find((item) => item.model === selectedModel.name);
      if (!config) { config = initialStateTransitions(selectedModel, d.cfg?.lifecycles ?? []); items.push(config); }
      fn(config);
    });
  };

  const create = () => { const id = uid("lc"); d.edit((x) => { x.push({ id, name: "", desc: "", steps: [mk("implement"), mk("close")] }); }); setSel(id); setStep(null); setMode("design"); };
  const copy = (l: Lifecycle) => { const id = uid("lc"); d.edit((x) => { x.push({ id, name: `${l.name} (copy)`, desc: l.desc, steps: l.steps.map((s) => ({ ...JSON.parse(JSON.stringify(s)), id: uid("st") })) }); }); setSel(id); setStep(null); };
  const implIdx = (l: Lifecycle) => l.steps.findIndex((s) => typeOf(s) === "implement");

  /** Adds after the selected step, or at the end of "Assess & authorize" (just before Implement). */
  const addStep = (type: StepType) => {
    const st = mk(type, type === "gate" ? { gate: "risk", name: "Risk assessment complete" } : type === "condition" ? { match: "all", rules: [{ k: "risk", op: "atLeast", value: "High" }], yes: "next", no: "skip" } :
      type === "group" ? { group: groupNames[0] ?? "", rule: "Any one member" as RuleText } : type === "role" ? { roleId: "changeManager" } : type === "parallel" ? { approvers: groupNames.slice(0, 2).map((g) => `group:${g}`), prule: "all" } :
      type === "wait" ? { waitMinutes: 60 } : type === "email" ? { recipients: [], subject: "", body: "" } :
      type === "update" ? { updateField: "priority", updateValue: "" } : type === "task" ? { taskName: "", taskGroup: "", taskAssignedToId: null } :
      type === "record" ? { recordType: "Change", recordTitle: "", recordDescription: "" } : type === "integration" ? { integrationUrl: "" } : {});
    patch((l) => { const at = l.steps.findIndex((s) => s.id === step); const impl = implIdx(l); l.steps.splice(at >= 0 && at < impl ? at + 1 : impl < 0 ? l.steps.length : impl, 0, st); });
    setStep(st.id); setMode("design");
  };
  const applyQuick = (q: (typeof QUICK)[number]) => {
    if (lc && lc.steps.length > 2 && !window.confirm(`Replace the steps of this lifecycle with “${q.name}”?`)) return;
    patch((l) => { l.steps = q.build(groupNames); if (!l.name) l.name = q.name; if (!l.desc) l.desc = q.desc; }); setStep(null);
  };
  const toggleReview = () => patch((l) => { const i = l.steps.findIndex((s) => typeOf(s) === "review"); if (i >= 0) l.steps.splice(i, 1); else l.steps.splice(Math.max(0, l.steps.findIndex((s) => typeOf(s) === "close")), 0, mk("review")); });

  // Checks shown in the overview and counted as "problems"
  const problems = useMemo(() => {
    if (!lc) return [] as string[];
    const out: string[] = [];
    if (!lc.name.trim()) out.push("Give the lifecycle a name.");
    for (const s of lc.steps) {
      const t = typeOf(s), n = s.name || META[t].label;
      if (t === "individual" && !s.userId) out.push(`“${n}”: choose the approver.`);
      if (t === "group" && !s.group) out.push(`“${n}”: choose the approval group.`);
      if (t === "parallel" && (s.approvers?.length ?? 0) < 2) out.push(`“${n}”: add at least two approvers.`);
      if (t === "condition" && !(s.rules?.length && s.rules.every((r) => r.value !== ""))) out.push(`“${n}”: complete the condition.`);
      if (t === "condition" && lc.steps.findIndex((x) => x.id === s.id) >= implIdx(lc) - 1) out.push(`“${n}”: a condition needs a step after it to apply to.`);
      if (t === "cabAgenda" && !groups.some((g) => g.name === "CAB")) out.push(`“${n}”: configure an active CAB approval group.`);
      if (t === "wait" && (!Number.isInteger(s.waitMinutes) || (s.waitMinutes ?? 0) < 1 || (s.waitMinutes ?? 0) > 525600)) out.push(`“${n}”: choose a wait between 1 and 525600 minutes.`);
      if (t === "email" && (!(s.recipients?.length) || s.recipients.some((r) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r)) || !s.subject?.trim() || !s.body?.trim())) out.push(`“${n}”: configure valid recipient addresses, a subject and a message.`);
      if (t === "update" && (!s.updateField || s.updateValue === undefined || s.updateValue.length > 10000)) out.push(`“${n}”: choose a field and value to update.`);
      if (t === "task" && !s.taskName?.trim()) out.push(`“${n}”: enter the task name.`);
      if (t === "record" && !s.recordTitle?.trim()) out.push(`“${n}”: enter the related change title.`);
      if (t === "integration" && !/^https:\/\/[^/]+/i.test(s.integrationUrl ?? "")) out.push(`“${n}”: enter a public HTTPS URL.`);
    }
    if (lc.steps.filter((s) => typeOf(s) === "policy").length > 1) out.push("The approval policy can be used only once.");
    return out;
  }, [lc]);

  // Test run
  const [sim, setSim] = useState<Simulation | null>(null);
  const [simErr, setSimErr] = useState("");
  const [tr, setTr] = useState({ model: "", risk: "", category: "", priority: "", outage: "No", leadDays: "14", ciCount: "1" });
  const riskLevels = d.cfg?.risk.bands.map((b) => b.level) ?? [];
  const trModel = tr.model || usedBy(sel ?? "")[0] || models[0]?.name || "";
  const trRisk = tr.risk || riskLevels[0] || "";
  const runTest = async () => {
    setSimErr(""); setSim(null);
    try { setSim(await changeApi.simulate(trModel, trRisk, tr.category || undefined, { priority: tr.priority, outage: tr.outage, leadDays: Number(tr.leadDays) || 0, ciCount: Number(tr.ciCount) || 0 }, sel ?? undefined)); }
    catch (e) { setSimErr(errMsg(e, "Test run failed.")); }
  };

  const curStep = lc?.steps.find((s) => s.id === step) ?? null;
  const ci = curStep && lc ? lc.steps.indexOf(curStep) : -1;
  const setS = (fn: (s: LifecycleStep) => void) => patch((l) => { const s = l.steps.find((x) => x.id === step); if (s) fn(s); });
  const fieldDef = (k: string) => d.cfg?.condFields.find((f) => f.id === k);
  const valueOptions = (k: string): string[] => {
    const f = fieldDef(k);
    if (k === "type") return models.map((m) => m.name); if (k === "risk") return riskLevels; if (k === "category") return (d.cfg?.categories ?? []).map((c) => c.name);
    if (k === "priority") return ["P1 - Critical", "P2 - High", "P3 - Medium", "P4 - Low"]; if (k === "service") return d.cfg?.services ?? []; if (f?.ftype === "yesno") return ["Yes", "No"]; return f?.opts ?? [];
  };
  const defaultOp = (k: string) => OPS[fieldDef(k)?.ftype ?? "select"][0][0];
  const setRule = (i: number, fn: (r: CondRule) => void) => setS((s) => { const r = s.rules![i]; fn(r); });

  // ───────── list view ─────────
  if (!lc) return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">Configuration &gt; Change Lifecycle</div>
          <div className="page-title">Change Lifecycle</div>
          <div className="page-subtitle">Build the lifecycle a change follows, step by step: how it is assessed and authorised, how it is scheduled and implemented, and how it is reviewed and closed. Change models pick a lifecycle in Change Models.</div>
        </div>
        {(listTab === "states" ? stateDraft.dirty : d.dirty) && <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" disabled={listTab === "states" ? stateDraft.saving : d.saving} onClick={listTab === "states" ? stateDraft.discard : d.discard}>Discard</button>
          <button className="btn-primary" disabled={(listTab === "states" ? stateDraft.saving : d.saving) || !admin} onClick={listTab === "states" ? stateDraft.save : d.save}>
            {(listTab === "states" ? stateDraft.saving : d.saving) ? "Saving…" : "Save changes"}
          </button>
        </div>}
      </div>
      <div className="page-body lc-list-page">
        {listTab === "states" && stateDraft.msg && <div className="cm-note ok" style={{ marginBottom: 12 }}>{stateDraft.msg}</div>}
        {listTab === "states" && <ErrorBar msg={stateDraft.err || stateDraft.loadError || ""} />}
        <div className="lc-list-tabs" role="tablist" aria-label="Change lifecycle configuration">
          <button role="tab" aria-selected={listTab === "lifecycles"} className={listTab === "lifecycles" ? "active" : ""} onClick={() => setListTab("lifecycles")}>Lifecycles</button>
          <button role="tab" aria-selected={listTab === "states"} className={listTab === "states" ? "active" : ""} onClick={() => setListTab("states")}>States &amp; transitions</button>
        </div>
        {listTab === "lifecycles" ? <>
          <div className="lc-list-heading">
            <b>LIFECYCLES ({list.length})</b>
            <button className="btn-primary" onClick={create}>Create lifecycle</button>
          </div>
          <div className="lc-list-hint">Every lifecycle you create is listed here and can be selected for a change model in the Lifecycle dropdown of Change Models.</div>
          <div className="lc-list-table-wrap">
            <table className="lc-list-table">
              <thead><tr><th>LIFECYCLE</th><th>STEPS</th><th>USED BY</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {list.map((l) => {
                  const users = models.filter((m) => m.lifecycle === l.id);
                  const impl = l.steps.findIndex((s) => typeOf(s) === "implement");
                  const after = impl < 0 ? l.steps : l.steps.slice(impl + 1);
                  return (
                    <tr key={l.id}>
                      <td><b>{l.name || "Unnamed lifecycle"}</b>{l.desc && <span className="lc-list-desc">{l.desc}</span>}</td>
                      <td>
                        <div><b>Assess &amp; authorize:</b> {assessText(l)}</div>
                        <div className="lc-list-review"><b>Review &amp; closure:</b> {after.some((s) => typeOf(s) === "close") ? reviewText(l, models) : "No review or closure steps configured."}</div>
                      </td>
                      <td><div className="lc-list-models">{users.length ? users.map((m) => {
                        const color = colorSet(m.color);
                        return <span key={m.id} className="lc-model-pill" style={{ color: color.color, background: color.bg }}>{m.name}</span>;
                      }) : <span className="cm-hint">Not assigned</span>}</div></td>
                      <td><div className="lc-list-actions">
                        <button className="btn-ghost btn-sm" onClick={() => { setSel(l.id); setStep(null); setMode("design"); }}>Edit</button>
                        <button className="btn-ghost btn-sm" onClick={() => copy(l)}>Copy</button>
                        <button className="btn-ghost btn-sm" disabled={users.length > 0} title={users.length ? "Assign this lifecycle's models to another lifecycle before deleting it." : undefined}
                          onClick={() => d.edit((x) => { x.splice(x.findIndex((y) => y.id === l.id), 1); })}>Delete</button>
                      </div></td>
                    </tr>
                  );
                })}
                {!list.length && <tr><td colSpan={4} className="lc-list-empty">No lifecycles configured yet. Create a lifecycle to define change steps.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="lc-list-footnote">A lifecycle that a change model is using cannot be deleted. Give that model another lifecycle in Change Models first.</div>
        </> : stateDraft.loading ? (
          <div className="cm-card"><div className="spinner-row">Loading state settings…</div></div>
        ) : !stateDraft.draft ? (
          <div className="cm-card lc-states-empty"><div className="cm-card-title">State settings unavailable</div><p className="cm-hint">State settings could not be loaded. Check the error above and try again.</p></div>
        ) : !models.length ? (
          <div className="cm-card lc-states-empty">
            <div className="cm-card-title">No change models configured</div>
            <p className="cm-hint">Create a change model before configuring its states and transitions. State settings are saved per model.</p>
          </div>
        ) : selectedModel && selectedTransitions ? (
          <div className="lc-states-editor">
            <div className="lc-states-model-selector">
              <b>Change model:</b>
              <div className="lc-states-models" role="tablist" aria-label="Change model">
                {models.map((model) => <button key={model.id} role="tab" aria-selected={selectedStateModel === model.name}
                  className={selectedStateModel === model.name ? "active" : ""} onClick={() => setSelectedStateModel(model.name)}>{model.name}</button>)}
              </div>
            </div>
            <section className="cm-card lc-state-flow-card">
              <div className="lc-state-flow">
                {selectedTransitions.states.map((row, index, allRows) => (
                  <React.Fragment key={row.state}>
                    <span className={`lc-flow-state${row.inUse ? row.state === "Closed" ? " terminal" : " enabled" : " disabled"}`}>{row.state}</span>
                    {index < allRows.length - 1 && <span className="lc-flow-arrow" aria-hidden="true">→</span>}
                  </React.Fragment>
                ))}
              </div>
              <div className="lc-state-flow-summary">
                Can be cancelled from: {selectedTransitions.states.filter((row) => row.canCancel).map((row) => row.state).join(", ") || "Nowhere"}.
                {" "}{selectedTransitions.states.filter((row) => row.inUse).length} of {selectedTransitions.states.length} states in use for {selectedModel.name} changes.
              </div>
            </section>

            <section className="cm-card lc-state-table-card">
              <div className="lc-state-card-heading">
                <div><h2>States &amp; transitions</h2><p>Define how each state is used and what must be complete before moving on.</p></div>
                <span className="cm-hint">{selectedTransitions.states.filter((row) => row.inUse).length} of {selectedTransitions.states.length} in use</span>
              </div>
              <div className="lc-state-table-wrap">
                <table className="lc-state-table">
                  <thead><tr><th>STATE</th><th>IN USE</th><th>PURPOSE</th><th>MOVED ON BY</th><th>REQUIRED COMPLETION CRITERIA</th><th>ALLOW CANCELLATION</th></tr></thead>
                  <tbody>{selectedTransitions.states.map((row) => {
                    const fixedState = ["New", "Scheduled", "Implement", "Closed"].includes(row.state);
                    return <tr key={row.state}>
                      <td><b>{row.state}</b></td>
                      <td><label className="lc-state-use"><input type="checkbox" checked={row.inUse} disabled={fixedState}
                        onChange={(e) => editSelectedTransitions((value) => { value.states.find((item) => item.state === row.state)!.inUse = e.target.checked; })} />
                        <span>{row.inUse ? "In use" : "Not used"}</span></label></td>
                      <td><input className="input lc-state-purpose" aria-label={`${row.state} purpose`} value={row.purpose}
                        onChange={(e) => editSelectedTransitions((value) => { value.states.find((item) => item.state === row.state)!.purpose = e.target.value; })} /></td>
                      <td><select className="input lc-state-moved" aria-label={`${row.state} moved on by`} value={row.movedOnBy}
                        onChange={(e) => editSelectedTransitions((value) => { value.states.find((item) => item.state === row.state)!.movedOnBy = e.target.value; })}>
                        {["Change owner", "Change manager", "Approval groups", "Assignment group", "System (automatic)"].map((item) => <option key={item}>{item}</option>)}
                      </select></td>
                      <td><div className="lc-state-criteria">{STATE_REQUIREMENTS.map((criterion) => <label key={criterion.id}
                        className={`lc-criterion${row.requirements.includes(criterion.id) ? " selected" : ""}`}>
                        <input type="checkbox" checked={row.requirements.includes(criterion.id)} onChange={(e) => editSelectedTransitions((value) => {
                          const current = value.states.find((item) => item.state === row.state)!;
                          current.requirements = e.target.checked ? [...current.requirements, criterion.id] : current.requirements.filter((item) => item !== criterion.id);
                        })} /><span>{criterion.label}</span>
                      </label>)}</div></td>
                      <td><label className="lc-state-cancel"><input type="checkbox" checked={row.canCancel} disabled={!["New", "Assess", "Authorize", "Scheduled"].includes(row.state)}
                        onChange={(e) => editSelectedTransitions((value) => { value.states.find((item) => item.state === row.state)!.canCancel = e.target.checked; })} />
                        <span>{row.canCancel ? "Yes" : "No"}</span></label></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
              <div className="lc-state-footnote">New, Scheduled, Implement and Closed are required states. Cancellation is only available before implementation.</div>
            </section>

            <section className="cm-card lc-state-auto-card">
              <div className="lc-state-card-heading"><div><h2>Automatic transitions</h2><p>Set transitions and reminders that happen without a manual state change.</p></div></div>
              <div className="lc-state-auto-options">
                <Check label="Move to Scheduled after final approval" checked={selectedTransitions.automatic.approvalToScheduled}
                  onChange={(checked) => editSelectedTransitions((value) => { value.automatic.approvalToScheduled = checked; })} />
                <Check label="Start implementation at the planned start when a task starts" checked={selectedTransitions.automatic.implementAtPlannedStart}
                  onChange={(checked) => editSelectedTransitions((value) => { value.automatic.implementAtPlannedStart = checked; })} />
                <Check label="Block implementation during blackout windows (except emergency changes)" checked={selectedTransitions.automatic.blockBlackout}
                  onChange={(checked) => editSelectedTransitions((value) => { value.automatic.blockBlackout = checked; })} />
                <div className="lc-state-number-option">
                  <Check label="Automatically close successful Review changes after" checked={selectedTransitions.automatic.closeAfterReviewDays > 0}
                    onChange={(checked) => editSelectedTransitions((value) => { value.automatic.closeAfterReviewDays = checked ? 5 : 0; })} />
                  <input className="input" type="number" min={1} max={365} aria-label="Business days before closing successful review changes"
                    disabled={selectedTransitions.automatic.closeAfterReviewDays === 0} value={selectedTransitions.automatic.closeAfterReviewDays || ""}
                    onChange={(e) => editSelectedTransitions((value) => { value.automatic.closeAfterReviewDays = Number(e.target.value); })} />
                  <span>business days</span>
                </div>
                <div className="lc-state-number-option">
                  <Check label="Remind the owner when implementation overruns the planned end by" checked={selectedTransitions.automatic.overrunReminderMinutes > 0}
                    onChange={(checked) => editSelectedTransitions((value) => { value.automatic.overrunReminderMinutes = checked ? 60 : 0; })} />
                  <input className="input" type="number" min={1} max={525600} aria-label="Minutes before sending implementation overrun reminder"
                    disabled={selectedTransitions.automatic.overrunReminderMinutes === 0} value={selectedTransitions.automatic.overrunReminderMinutes || ""}
                    onChange={(e) => editSelectedTransitions((value) => { value.automatic.overrunReminderMinutes = Number(e.target.value); })} />
                  <span>minutes</span>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </>
  );

  // ───────── designer ─────────
  const impl = implIdx(lc);
  const hasReview = lc.steps.some((s) => typeOf(s) === "review");
  const counts = { approvals: lc.steps.filter((s) => isApproval(typeOf(s))).length, conditions: lc.steps.filter((s) => typeOf(s) === "condition").length, gates: lc.steps.filter((s) => typeOf(s) === "gate").length };
  const hasCab = lc.steps.some((s) => (s.group && /CAB/.test(s.group)) || s.approvers?.some((a) => /CAB/.test(a)) || ["policy", "cabAgenda"].includes(typeOf(s)));
  const node = (s: LifecycleStep, i: number) => {
    const t = typeOf(s), m = META[t], on = s.id === step, locked = ["implement", "close"].includes(t);
    const sub = t === "group" ? `${s.group || "No group chosen"} · ${s.rule ?? "Any one member"}` : t === "individual" ? s.who || "No approver chosen" : t === "role" ? ROLES.find((r) => r.id === s.roleId)?.label ?? "No role" : t === "parallel" ? `${s.approvers?.length ?? 0} approvers · ${s.prule === "any" ? "any one" : "all"} must approve`
      : t === "wait" ? `${s.waitMinutes ?? 0} minutes` : t === "email" ? (s.recipients ?? []).join(", ") || "No recipients configured"
      : t === "cabAgenda" ? "CAB decision required" : t === "update" ? `${s.updateField ?? "Field"} = ${s.updateValue ?? ""}`
      : t === "task" ? s.taskName || "No task name" : t === "record" ? s.recordTitle || "No related change title"
      : t === "integration" ? s.integrationUrl || "No URL configured"
      : t === "condition" ? (s.rules ?? []).map((r) => `${fieldDef(r.k)?.label ?? r.k} ${(OPS[fieldDef(r.k)?.ftype ?? "select"].find((o) => o[0] === r.op) ?? [0, r.op])[1]} ${r.value}`).join(s.match === "any" ? " or " : " and ") : t === "gate" ? GATES.find((g) => g.id === s.gate)?.help ?? "" : m.help;
    return (
      <div key={s.id}>
        <button type="button" className={`lc-node${on ? " on" : ""}`} onClick={() => setStep(s.id)}>
          <span className="lc-num">{i + 1}</span>
          <span style={{ minWidth: 0, textAlign: "left" }}>
            <span className="lc-tag" style={{ color: m.color }}>{m.tag}</span>
            <b className="lc-title">{s.name || m.label}</b>
            <span className="cm-hint" style={{ display: "block" }}>{sub}</span>
            {t === "gate" && <span className="lc-fail">If not → Back to the owner</span>}
            {t === "condition" && <span className="cm-hint" style={{ display: "block" }}>If yes → {s.yes === "skip" ? "skip the next step" : "next step"} · otherwise → {s.no === "skip" ? "skip the next step" : "next step"}</span>}
          </span>
          {locked && <span className="lc-lock">required</span>}
        </button>
        {i < lc.steps.length - 1 && <div className="lc-link">{i < impl - 1 || (i === impl - 1) ? <button type="button" className="lc-plus" title="Insert a step here" onClick={() => { setStep(s.id); }}>+</button> : <span className="lc-dot-line" />}</div>}
      </div>
    );
  };

  return (
    <ConfigPage d={d} crumb="Change Lifecycle" title={lc.name || "New lifecycle"} subtitle="Pick a starting point, then add and set up steps. Steps run top to bottom; conditions and approvals sit before Implement.">
      <div className="cm-card" style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <button className="btn-ghost" onClick={() => { setSel(null); setStep(null); }}>‹ Lifecycles</button>
        <div style={{ flex: 1, minWidth: 220 }}><Lbl label="Lifecycle name *"><input className="input" placeholder="e.g. Normal change — risk-based CAB" value={lc.name} onChange={(e) => patch((x) => { x.name = e.target.value; })} /></Lbl></div>
        <span className="badge" style={{ background: saved ? "#EFF4FC" : "#FFFAEB", color: saved ? "#175CD3" : "#B54708" }}>{saved ? (d.dirty ? "Unsaved changes" : "Saved") : "Draft — not saved yet"}</span>
        <div className="cm-seg"><button className={mode === "design" ? "on" : ""} onClick={() => setMode("design")}>Design</button><button className={mode === "test" ? "on" : ""} onClick={() => setMode("test")}>Test run</button></div>
        <button className="btn-ghost" onClick={() => copy(lc)}>Copy</button>
        <button className="btn-primary" disabled={d.saving || !d.dirty || problems.length > 0} onClick={() => d.save()}>{d.saving ? "Saving…" : "Save lifecycle"}</button>
        <span className="badge" style={{ background: problems.length ? "#FEF3F2" : "#ECFDF3", color: problems.length ? "#B42318" : "#067647" }}>{problems.length ? `${problems.length} problem${problems.length === 1 ? "" : "s"}` : "No problems"}</span>
      </div>

      <div className="cm-card">
        <div className="cm-lbl" style={{ marginBottom: 8 }}>QUICK START — PICK A STARTING POINT</div>
        <div className="lc-quick">{QUICK.map((q) => <button key={q.id} type="button" className="lc-quick-card" onClick={() => applyQuick(q)}><b>{q.name}</b><span>{q.desc}</span></button>)}</div>
      </div>

      <div className="lc-cols">
        <div className="cm-card">
          <div className="cm-lbl">ADD A STEP</div>
          <div className="cm-hint" style={{ margin: "2px 0 8px" }}>Adds after the selected step, or at the end of Assess &amp; authorize.</div>
          {PALETTE.map((g) => (
            <div key={g.title}>
              <div className="lc-pal-title">{g.title}</div>
              {g.types.map((t) => <button key={t} type="button" className="lc-pal" onClick={() => addStep(t)}><span className="lc-pal-ico" style={{ background: META[t].bg, color: META[t].color }}>+</span>{META[t].label}</button>)}
            </div>))}
          <div className="lc-pal-title">STAGES</div>
          <button type="button" className="lc-pal" onClick={toggleReview}><span className="lc-pal-ico" style={{ background: META.review.bg, color: META.review.color }}>{hasReview ? "−" : "+"}</span>{hasReview ? "Remove post-implementation review" : "Add post-implementation review"}</button>
        </div>

        <div className="cm-card lc-canvas">
          <div className="cm-lbl">LIFECYCLE FLOW</div>
          <div className="cm-hint" style={{ margin: "2px 0 10px" }}>Select a step to set it up. Use the order buttons in the step panel to move it.</div>
          <div className="lc-trigger"><span className="lc-tag" style={{ color: "#B54708" }}>WHEN</span><b>A change is submitted</b><span className="cm-hint">Used by {usedBy(lc.id).join(", ") || "no change model yet"}.</span></div>
          <div className="lc-phase">ASSESS &amp; AUTHORIZE</div>
          {lc.steps.map((s, i) => (
            <React.Fragment key={s.id}>
              {i === impl && <div className="lc-phase">DELIVER</div>}
              {node(s, i)}
            </React.Fragment>))}
        </div>

        <div>
          {curStep ? (
            <div className="cm-card">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="lc-tag" style={{ color: META[typeOf(curStep)].color, flex: 1 }}>{META[typeOf(curStep)].tag}</span>
                {!["implement", "close"].includes(typeOf(curStep)) && <>
                  <button type="button" className="btn-ghost btn-sm" disabled={ci <= 0 || ci >= impl} title="Move up" aria-label="Move step up" onClick={() => patch((l) => {
                    if (ci > 0 && ci < impl) [l.steps[ci - 1], l.steps[ci]] = [l.steps[ci], l.steps[ci - 1]];
                  })}>↑</button>
                  <button type="button" className="btn-ghost btn-sm" disabled={ci >= impl - 1 && typeOf(curStep) !== "review"} title="Move down" aria-label="Move step down" onClick={() => patch((l) => {
                    const lim = typeOf(curStep) === "review" ? l.steps.length - 1 : impl - 1;
                    if (ci >= 0 && ci < lim) [l.steps[ci + 1], l.steps[ci]] = [l.steps[ci], l.steps[ci + 1]];
                  })}>↓</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => { patch((l) => { if (ci >= 0) l.steps.splice(ci, 1); }); setStep(null); }}>Delete</button></>}
                <button type="button" className="btn-ghost btn-sm" onClick={() => setStep(null)}>Done</button>
              </div>
              <div className="cm-hint" style={{ margin: "4px 0 10px" }}>{META[typeOf(curStep)].help}</div>
              <div className="cm-form-grid" style={{ gridTemplateColumns: "1fr" }}>
                <Lbl label="Step name"><input className="input" value={curStep.name} onChange={(e) => setS((s) => { s.name = e.target.value; })} /></Lbl>
                {typeOf(curStep) === "gate" && <Lbl label="Check" hint={GATES.find((g) => g.id === curStep.gate)?.help}><select className="select" value={curStep.gate ?? "risk"} onChange={(e) => setS((s) => { s.gate = e.target.value as LifecycleStep["gate"]; s.name = GATES.find((g) => g.id === s.gate)?.label ?? s.name; })}>{GATES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></Lbl>}
                {typeOf(curStep) === "group" && <>
                  <Lbl label="Approval group"><select className="select" value={curStep.group ?? ""} onChange={(e) => setS((s) => { s.group = e.target.value; })}><option value="">Choose group</option>{groups.map((g) => <option key={g.id}>{g.name}</option>)}</select></Lbl>
                  <Lbl label="Approval rule"><select className="select" value={curStep.rule ?? "Any one member"} onChange={(e) => setS((s) => { s.rule = e.target.value as RuleText; })}>{RULES.map((r) => <option key={r}>{r}</option>)}</select></Lbl></>}
                {typeOf(curStep) === "individual" && <Lbl label="Approver">
                  {usersQ.error && <ErrorBar msg={usersQ.error} />}
                  <SearchSelect
                    ariaLabel="Approver"
                    value={String(curStep.userId ?? "")}
                    label={people.find((p) => p.id === curStep.userId)?.name ?? curStep.who ?? "Choose a person"}
                    options={personOptions}
                    placeholder="Search people…"
                    emptyText="No people match your search."
                    onSelect={(option) => setS((s) => {
                      s.userId = Number(option?.value) || undefined;
                      s.who = people.find((p) => p.id === s.userId)?.name;
                    })}
                  />
                </Lbl>}
                {typeOf(curStep) === "role" && <Lbl label="Role" hint={ROLES.find((r) => r.id === curStep.roleId)?.help}><select className="select" value={curStep.roleId ?? "changeManager"} onChange={(e) => setS((s) => { s.roleId = e.target.value as LifecycleStep["roleId"]; })}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Lbl>}
                {typeOf(curStep) === "parallel" && <>
                  <div className="cm-lbl">Approvers (asked at the same time)</div>
                  {(curStep.approvers ?? []).map((a, j) => {
                    const [k, ...r] = a.split(":");
                    return (
                      <div key={j} style={{ display: "flex", gap: 6 }}>
                        <select className="select" value={a} onChange={(e) => setS((s) => { s.approvers![j] = e.target.value; })}>
                          <optgroup label="Groups">{groups.map((g) => <option key={g.id} value={`group:${g.name}`}>{g.name}</option>)}</optgroup>
                          <optgroup label="Roles"><option value="role:changeManager">Change manager</option><option value="role:categoryTab">Category technical board</option></optgroup>
                          <optgroup label="People">{people.map((p) => <option key={p.id} value={`person:${p.id}:${p.name}`}>{p.name}</option>)}</optgroup>
                          {!["group", "role", "person"].includes(k) || !r.length ? <option value={a}>{a}</option> : null}
                        </select>
                        <button className="btn-ghost btn-sm" disabled={(curStep.approvers?.length ?? 0) <= 2} onClick={() => setS((s) => { s.approvers!.splice(j, 1); })}>✕</button>
                      </div>);
                  })}
                  <div><button className="btn-ghost btn-sm" onClick={() => setS((s) => { s.approvers = [...(s.approvers ?? []), groupNames[0] ? `group:${groupNames[0]}` : "role:changeManager"]; })}>Add approver</button></div>
                  <Lbl label="Who must approve"><select className="select" value={curStep.prule ?? "all"} onChange={(e) => setS((s) => { s.prule = e.target.value as "all" | "any"; })}><option value="all">Everyone asked</option><option value="any">Any one of them</option></select></Lbl></>}
                {typeOf(curStep) === "condition" && <>
                  <Lbl label="Match"><select className="select" value={curStep.match ?? "all"} onChange={(e) => setS((s) => { s.match = e.target.value as "all" | "any"; })}><option value="all">All of these rules</option><option value="any">Any of these rules</option></select></Lbl>
                  {(curStep.rules ?? []).map((r, j) => {
                    const f = fieldDef(r.k), ft = f?.ftype ?? "select", vals = valueOptions(r.k);
                    return (
                      <div key={j} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6 }}>
                        <select className="select" value={r.k} onChange={(e) => setRule(j, (x) => { x.k = e.target.value; x.op = defaultOp(x.k); x.value = ""; })}>{(d.cfg?.condFields ?? []).map((cf) => <option key={cf.id} value={cf.id}>{cf.label}</option>)}</select>
                        <select className="select" value={r.op} onChange={(e) => setRule(j, (x) => { x.op = e.target.value; })}>{OPS[ft].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                        {ft === "number" ? <input className="input" type="number" min={0} value={r.value} onChange={(e) => setRule(j, (x) => { x.value = e.target.value; })} /> :
                          <select className="select" value={r.value} onChange={(e) => setRule(j, (x) => { x.value = e.target.value; })}><option value="">Choose…</option>{vals.map((v) => <option key={v}>{v}</option>)}</select>}
                        <button className="btn-ghost btn-sm" disabled={(curStep.rules?.length ?? 0) <= 1} onClick={() => setS((s) => { s.rules!.splice(j, 1); })}>✕</button>
                      </div>);
                  })}
                  <div><button className="btn-ghost btn-sm" onClick={() => setS((s) => { s.rules = [...(s.rules ?? []), { k: "risk", op: "atLeast", value: "High" }]; })}>Add rule</button></div>
                  <Lbl label="When the condition is true"><select className="select" value={curStep.yes ?? "next"} onChange={(e) => setS((s) => { s.yes = e.target.value as "next" | "skip"; })}><option value="next">Go to the next step</option><option value="skip">Skip the next step</option></select></Lbl>
                  <Lbl label="Otherwise"><select className="select" value={curStep.no ?? "skip"} onChange={(e) => setS((s) => { s.no = e.target.value as "next" | "skip"; })}><option value="next">Go to the next step</option><option value="skip">Skip the next step</option></select></Lbl></>}
                {typeOf(curStep) === "wait" && <Lbl label="Wait duration (minutes)" hint="The change pauses here. A background worker resumes it when the duration expires.">
                  <input className="input" type="number" min={1} max={525600} value={curStep.waitMinutes ?? 60} onChange={(e) => setS((s) => { s.waitMinutes = Number(e.target.value); })} />
                </Lbl>}
                {typeOf(curStep) === "email" && <>
                  <Lbl label="Recipient e-mail addresses" hint="Separate multiple addresses with commas. Tokens: {{number}}, {{short_description}}, {{state}}, {{risk}}, {{requester}}, {{owner}}, {{planned_start}}, {{planned_end}}.">
                    <input className="input" value={(curStep.recipients ?? []).join(", ")} onChange={(e) => setS((s) => { s.recipients = e.target.value.split(",").map((x) => x.trim()).filter(Boolean); })} />
                  </Lbl>
                  <Lbl label="Subject"><input className="input" maxLength={255} value={curStep.subject ?? ""} onChange={(e) => setS((s) => { s.subject = e.target.value; })} /></Lbl>
                  <Lbl label="Message"><textarea className="textarea" rows={5} maxLength={10000} value={curStep.body ?? ""} onChange={(e) => setS((s) => { s.body = e.target.value; })} /></Lbl>
                </>}
                {typeOf(curStep) === "update" && <>
                  <Lbl label="Field to update"><select className="select" value={curStep.updateField ?? "priority"} onChange={(e) => setS((s) => { s.updateField = e.target.value as LifecycleStep["updateField"]; })}>
                    <option value="shortDescription">Short description</option><option value="description">Description</option><option value="priority">Priority</option><option value="category">Category</option>
                    <option value="businessService">Business service</option><option value="impact">Impact</option><option value="urgency">Urgency</option><option value="justification">Justification</option><option value="communicationPlan">Communication plan</option>
                  </select></Lbl>
                  <Lbl label="New value"><textarea className="textarea" rows={3} maxLength={10000} value={curStep.updateValue ?? ""} onChange={(e) => setS((s) => { s.updateValue = e.target.value; })} /></Lbl>
                </>}
                {typeOf(curStep) === "task" && <>
                  <Lbl label="Task name"><input className="input" maxLength={255} value={curStep.taskName ?? ""} onChange={(e) => setS((s) => { s.taskName = e.target.value; })} /></Lbl>
                  <Lbl label="Assignment workgroup"><select className="select" value={curStep.taskGroup ?? ""} onChange={(e) => setS((s) => { s.taskGroup = e.target.value; })}><option value="">Use no workgroup</option>{(workgroupsQ.data ?? []).map((g) => <option key={g.groupId} value={g.groupName}>{g.groupName}</option>)}</select></Lbl>
                  {workgroupsQ.error && <ErrorBar msg={workgroupsQ.error} />}
                  <Lbl label="Assigned user"><select className="select" value={String(curStep.taskAssignedToId ?? "")} onChange={(e) => setS((s) => { s.taskAssignedToId = Number(e.target.value) || null; })}><option value="">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Lbl>
                </>}
                {typeOf(curStep) === "record" && <>
                  <Lbl label="Related record type"><select className="select" value="Change" disabled><option value="Change">Change</option></select></Lbl>
                  <Lbl label="Related change title"><input className="input" maxLength={255} value={curStep.recordTitle ?? ""} onChange={(e) => setS((s) => { s.recordTitle = e.target.value; })} /></Lbl>
                  <Lbl label="Description"><textarea className="textarea" rows={3} maxLength={10000} value={curStep.recordDescription ?? ""} onChange={(e) => setS((s) => { s.recordDescription = e.target.value; })} /></Lbl>
                </>}
                {typeOf(curStep) === "integration" && <Lbl label="HTTPS endpoint" hint="Only public HTTPS destinations are allowed. Redirects and private or internal addresses are blocked.">
                  <input className="input" type="url" placeholder="https://example.com/change-hook" value={curStep.integrationUrl ?? ""} onChange={(e) => setS((s) => { s.integrationUrl = e.target.value; })} />
                </Lbl>}
              </div>
            </div>
          ) : null}

          <div className="cm-card">
            <div className="cm-lbl">LIFECYCLE OVERVIEW</div>
            {mode === "design" ? (<>
              <Lbl label="Description"><textarea className="textarea" rows={2} placeholder="When this lifecycle is used" value={lc.desc} onChange={(e) => patch((x) => { x.desc = e.target.value; })} /></Lbl>
              <dl className="lc-ov">
                <dt>Approval steps</dt><dd>{counts.approvals}</dd><dt>Conditions</dt><dd>{counts.conditions}</dd><dt>Gate checks</dt><dd>{counts.gates}</dd>
                <dt>CAB involvement</dt><dd>{hasCab ? "Yes" : "No"}</dd><dt>Post-implementation review</dt><dd>{hasReview ? "Yes" : "Only if the outcome needs it"}</dd>
                <dt>Used by</dt><dd>{usedBy(lc.id).join(", ") || "No change model"}</dd><dt>Checks</dt><dd style={{ color: problems.length ? "var(--red)" : "var(--green)" }}>{problems.length ? `${problems.length} to fix` : "All good"}</dd>
              </dl>
              {problems.map((p) => <div key={p} className="cm-note bad">{p}</div>)}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 12.5 }}>
                <Link to="/changes/config/approval">Approval groups &amp; CAB</Link><Link to="/changes/config/notifications">E-mail templates</Link><Link to="/changes/config/risk">Risk assessment</Link>
              </div>
            </>) : (<>
              <div className="cm-hint" style={{ marginBottom: 8 }}>See which path a change would take through this lifecycle. A test run uses the <b>saved</b> configuration{saved ? "" : " — save this lifecycle first"}{d.dirty && saved ? "; unsaved edits are not included" : ""}.</div>
              <div className="cm-form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Lbl label="Change model"><select className="select" value={trModel} onChange={(e) => setTr({ ...tr, model: e.target.value })}>{models.map((m) => <option key={m.id}>{m.name}</option>)}</select></Lbl>
                <Lbl label="Risk level"><select className="select" value={trRisk} onChange={(e) => setTr({ ...tr, risk: e.target.value })}>{riskLevels.map((r) => <option key={r}>{r}</option>)}</select></Lbl>
                <Lbl label="Category"><select className="select" value={tr.category} onChange={(e) => setTr({ ...tr, category: e.target.value })}><option value="">Any</option>{d.cfg?.categories.filter((c) => c.active).map((c) => <option key={c.id}>{c.name}</option>)}</select></Lbl>
                <Lbl label="Priority"><select className="select" value={tr.priority} onChange={(e) => setTr({ ...tr, priority: e.target.value })}><option value="">Any</option>{valueOptions("priority").map((p) => <option key={p}>{p}</option>)}</select></Lbl>
                <Lbl label="Causes an outage"><select className="select" value={tr.outage} onChange={(e) => setTr({ ...tr, outage: e.target.value })}><option>No</option><option>Yes</option></select></Lbl>
                <Lbl label="Days until start"><input className="input" type="number" min={0} value={tr.leadDays} onChange={(e) => setTr({ ...tr, leadDays: e.target.value })} /></Lbl>
              </div>
              <button className="btn-primary btn-sm" style={{ marginTop: 8 }} disabled={!saved || !trModel || !trRisk} onClick={runTest}>Run test</button>
              <ErrorBar msg={simErr} />
              {sim && <div style={{ marginTop: 10, fontSize: 12.5 }}>
                <div><b>{sim.model}</b> through <b>{lc.name}</b></div>
                {sim.gates.length > 0 && <div className="cm-hint">Checks before submit: {sim.gates.map((g) => GATES.find((x) => x.id === g)?.label ?? g).join("; ")}.</div>}
                <div className="cm-lbl" style={{ marginTop: 6 }}>Approval path at <span className="badge" style={{ background: RISK_COLOR[trRisk as keyof typeof RISK_COLOR]?.bg, color: RISK_COLOR[trRisk as keyof typeof RISK_COLOR]?.color }}>{trRisk}</span> risk</div>
                {sim.approvalPath.length ? sim.approvalPath.map((p, i) => <div key={i}>Stage {p.stage}: {p.group} — {p.rule} <span className="cm-hint">({p.members ? `${p.members} ${p.members === 1 ? "member" : "members"}` : "no members set"})</span></div>) : <div className="cm-hint">No approval needed — goes straight to Scheduled.</div>}
                <div className="cm-lbl" style={{ marginTop: 8 }}>Execution plan</div>
                {sim.executionPlan.map((item, i) => <div key={`${item.stepId}-${i}`}>{i + 1}. <b>{item.name}</b> — {item.detail}</div>)}
                <div className="cm-hint" style={{ marginTop: 4 }}>{sim.reviewRequired ? "A post-implementation review is required." : "A review is only needed if the outcome calls for it."}</div>
              </div>}
            </>)}
          </div>
        </div>
      </div>
    </ConfigPage>
  );
}
