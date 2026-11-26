import React, { useState } from "react";
import { ArrowLeft, Plus, Unlink } from "lucide-react";
import { Link, useRouteParams } from "../router";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, TH, errMsg, formatDateTime } from "../components/configKit";
import { LinkPicker } from "../components/LinkPicker";
import { requestConfigApi, requestLifecycleApi, requestLinksApi, serviceRequestApi, type CreateRelatedBody, type RelatedType, type RequestTaskRow } from "../requestsApi";
import { ApprovalChain, Facts, Panel, PriorityBadge, SlaBadge, StatusPill, Stars, Timeline, money, requestNo } from "../components/serviceRequestKit";

type Form = "" | "assign" | "hold" | "fulfil" | "close" | "cancel" | "resubmit";
const REL_TYPES: { type: RelatedType; label: string; when: string }[] = [
  { type: "incident", label: "Incident", when: "Something is broken or not working. For example, the laptop that was delivered will not start." },
  { type: "request", label: "Service request", when: "The requester needs another catalog item as a follow-up. For example, a docking station for the new laptop." },
  { type: "change", label: "Change", when: "Fulfilling this needs a planned change to a live system. For example, a firewall rule for VPN access." },
  { type: "problem", label: "Problem", when: "The same issue keeps coming back and its root cause needs finding. For example, VPN tokens failing again and again." },
  { type: "work_order", label: "Work order", when: "Someone has to do physical work on site. For example, cabling and mounting equipment at a desk." },
];
const REL_LABEL = Object.fromEntries(REL_TYPES.map((t) => [t.type, t.label])) as Record<RelatedType, string>;
const PRIORITIES = ["P1 - Critical", "P2 - High", "P3 - Medium", "P4 - Low"];
const CONVERTIBLE = ["Pending Approval", "Approved", "In Progress", "On Hold"];
const TASK_STATUSES: RequestTaskRow["status"][] = ["Open", "In Progress", "Completed", "Cancelled"];

/** Service Request Record: classification, assignment, SLA, tasks, approvals and the activity timeline. */
export function ServiceRequestRecordPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const params = useRouteParams("/service-requests/queue/:id");
  const adminParams = useRouteParams("/admin/requests/:id");
  const requestId = Number((params ?? adminParams)?.id ?? 0);

  const detail = useAsync(() => requestLifecycleApi.detail(requestId), [requestId]);
  const urgencies = useAsync(() => serviceRequestApi.urgencies(), []);
  const impacts = useAsync(() => serviceRequestApi.serviceImpacts(), []);
  const groups = useAsync(() => serviceRequestApi.assignmentGroups(), []);
  const closureCodes = useAsync(() => requestLifecycleApi.closureCodes(), []);
  const pendingReasons = useAsync(() => requestLifecycleApi.pendingReasons(), []);
  const statuses = useAsync(() => requestConfigApi.statuses(), []);

  const [agentView, setAgentView] = useState(false);
  const [tab, setTab] = useState<"details" | "wo" | "tasks">("details");
  const links = useAsync(() => (agentView ? requestLinksApi.list(requestId).catch(() => null) : Promise.resolve([])), [requestId, agentView]);
  const workNotes = useAsync(() => (agentView ? requestLinksApi.notes(requestId).catch(() => null) : Promise.resolve([])), [requestId, agentView]);
  const catalogs = useAsync(() => serviceRequestApi.catalogs(), []);
  const [createOpen, setCreateOpen] = useState(false);
  const [relType, setRelType] = useState<RelatedType | "">("");
  const [rel, setRel] = useState({ short: "", desc: "", relation: "Related to", priority: "P3 - Medium", changeType: "Normal" as "Standard" | "Normal" | "Emergency", date: "", location: "", catalogId: "", convert: false });
  const [relMsg, setRelMsg] = useState("");
  const [noteText, setNoteText] = useState("");
  const [form, setForm] = useState<Form>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [text, setText] = useState("");
  const [groupId, setGroupId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [startNow, setStartNow] = useState(true);
  const [reasonId, setReasonId] = useState("");
  const [holdStatus, setHoldStatus] = useState("");
  const [codeId, setCodeId] = useState("");
  const [urgencyId, setUrgencyId] = useState("");
  const [impactId, setImpactId] = useState("");

  const r = detail.data;
  React.useEffect(() => { if (r) setAgentView(isAdmin || r.viewer.isAgent); }, [r?.requestId, isAdmin, r?.viewer.isAgent]);
  const members = useAsync(() => groupId ? api.get<{ members?: { userId: number; fullName: string }[] }>(`/assignment-groups/${groupId}`) : Promise.resolve(null), [groupId]);

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setError(""); setBusy(true);
    try { await fn(); after?.(); detail.reload(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const close = () => { setForm(""); setText(""); };

  if (detail.loading && !r) return <div className="spinner-row">Loading…</div>;
  if (!r) return (<><PageHeader crumb="Service Requests > Service Request List" title="Request" /><div className="page-body"><ErrorBar msg={detail.error ?? "Request not found."} /></div></>);

  const open = ["Pending Approval", "Returned", "Approved", "In Progress", "On Hold", "Fulfilled"].includes(r.status);
  const working = ["In Progress", "On Hold"].includes(r.status);
  const openTasks = (r.tasks ?? []).filter((t) => t.status === "Open" || t.status === "In Progress").length;
  const customWork = (statuses.data ?? []).filter((s) => !s.isSystem && s.stage === "work" && s.isActive);
  const customHold = (statuses.data ?? []).filter((s) => !s.isSystem && s.stage === "hold" && s.isActive);
  const editable = isAdmin && ((r.status === "Pending Approval" && !(r.approvals ?? []).some((a) => a.status !== "Pending")) || (r.status === "Approved" && !r.assignedTo));
  const urgencyValue = urgencyId || String(r.urgency?.urgencyId ?? "");
  const impactValue = impactId || String(r.serviceImpact?.serviceImpactId ?? "");
  const classificationDirty = (urgencyId && Number(urgencyId) !== r.urgency?.urgencyId) || (impactId && Number(impactId) !== r.serviceImpact?.serviceImpactId);
  const openForm = (f: Form) => { setError(""); setForm(form === f ? "" : f); if (f === "assign") { setGroupId(String(r.assignmentGroup?.groupId ?? "")); setAssigneeId(String(r.assignedTo?.userId ?? "")); setStartNow(r.status === "Approved"); } };
  const listPath = isAdmin ? "/admin/requests" : "/service-requests/queue";
  const workOrders = (links.data ?? []).filter((l) => l.type === "work_order");
  const openWorkOrders = workOrders.filter((w) => !["Completed", "Cancelled"].includes(w.status));
  const tasksDone = (r.tasks ?? []).filter((t) => t.status === "Completed").length;
  const tabBtn = (k: typeof tab, label: string, badge?: string) => (
    <button type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{ padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: tab === k ? 700 : 500,
      color: tab === k ? "#175CD3" : "#667085", borderBottom: `2px solid ${tab === k ? "#175CD3" : "transparent"}` }}>
      {label}{badge !== undefined && <span className="chip" style={{ marginLeft: 6, fontSize: 11 }}>{badge}</span>}
    </button>
  );

  return (
    <>
      <div style={{ padding: "16px 28px", borderBottom: "1px solid #E4E7EC", background: "#FFFFFF" }}>
        <div style={{ fontSize: 11.5, color: "#667085", marginBottom: 6 }}>
          Manage Service Requests &gt; <Link to={listPath}>Service Request List</Link> &gt; <span style={{ color: "#344054", fontWeight: 500 }}>{requestNo(r)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontWeight: 800, fontSize: 20, color: "#0F1626", letterSpacing: "-0.2px" }}>{requestNo(r)} — {r.catalog.catalogName}</h1>
              <StatusPill status={r.status} subStatus={r.subStatus} />
            </div>
            <div style={{ fontSize: 12.5, color: "#667085", marginTop: 3 }}>
              Requested by {r.requestedBy?.fullName ?? "—"} · {formatDateTime(r.createdAt)}{r.catalog.category?.categoryName ? ` · ${r.catalog.category.categoryName}` : ""}
            </div>
          </div>
          <div className="sr-actions">
            {agentView && <button className={createOpen ? "btn-primary" : "btn-ghost"} aria-expanded={createOpen} onClick={() => { setCreateOpen((o) => !o); setRelMsg(""); }}><Plus size={13} aria-hidden="true" /> Create related</button>}
            <Link to={listPath} className="btn-ghost" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><ArrowLeft size={14} aria-hidden="true" /> Back to list</Link>
          </div>
        </div>
        <div role="tablist" style={{ display: "flex", gap: 4, margin: "14px 0 -17px" }}>
          {tabBtn("details", "Details")}{tabBtn("wo", "Work Order", String(workOrders.length))}{tabBtn("tasks", "Tasks", `${tasksDone}/${(r.tasks ?? []).length}`)}
        </div>
      </div>
      <div className="page-body">
        <ErrorBar msg={error || detail.error || ""} />

        <div className="card sr-panel" style={{ marginBottom: 16 }}>
          <div className="sr-actions">
            <PriorityBadge name={r.priority?.priorityName} color={r.priority?.color} />
            {["Approved", "In Progress", "On Hold", "Fulfilled", "Closed"].includes(r.status) && <SlaBadge state={r.sla?.state} />}
            <span style={{ flex: 1 }} />
            {r.status === "Approved" && <button className="btn-primary" disabled={busy} onClick={() => void run(() => requestLifecycleApi.start(requestId))}>Assign to me and start</button>}
            {["Approved", "In Progress", "On Hold"].includes(r.status) && <button className="btn-ghost" disabled={busy} onClick={() => openForm("assign")}>Assign…</button>}
            {r.status === "In Progress" && <button className="btn-ghost" disabled={busy} onClick={() => openForm("hold")}>Put on hold</button>}
            {r.status === "On Hold" && <button className="btn-primary" disabled={busy} onClick={() => void run(() => requestLifecycleApi.resume(requestId))}>Resume</button>}
            {r.status === "In Progress" && <button className="btn-primary" disabled={busy} onClick={() => { setTab("details"); openForm("fulfil"); }}>Mark fulfilled</button>}
            {r.status === "Fulfilled" && <button className="btn-ghost" disabled={busy} onClick={() => openForm("close")}>Close on requester’s behalf</button>}
            {r.viewer.canResubmit && <button className="btn-primary" disabled={busy} onClick={() => openForm("resubmit")}>{(r.approvals ?? []).some((a) => a.status === "Info requested") ? "Answer the approver" : "Resubmit for approval"}</button>}
            {editable && <Link to={`/admin/edit-service-request/${requestId}`} className="btn-ghost">Edit</Link>}
            {isAdmin && open && <button className="btn-ghost" disabled={busy} onClick={() => openForm("cancel")}>Cancel request</button>}
          </div>

          {form === "assign" && (
            <div className="sr-form">
              <div className="row">
                <label className="field-group"><span className="lbl">Assignment group</span>
                  <select className="select" value={groupId} onChange={(e) => { setGroupId(e.target.value); setAssigneeId(""); }}>
                    <option value="">No group</option>{(groups.data ?? []).map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}</select></label>
                <label className="field-group"><span className="lbl">Assignee</span>
                  <select className="select" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} disabled={!groupId}>
                    <option value="">Unassigned</option>{(members.data?.members ?? []).map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}</select></label>
              </div>
              {r.status === "Approved" && <label className="admin-master-check-label"><input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} /> Start work now</label>}
              <textarea className="textarea" placeholder="Note (optional)" value={text} onChange={(e) => setText(e.target.value)} />
              <div className="sr-actions">
                <button className="btn-primary" disabled={busy || (!groupId && !assigneeId)} onClick={() => void run(() => requestLifecycleApi.assign(requestId, {
                  ...(groupId ? { assignmentGroupId: Number(groupId) } : {}), ...(assigneeId ? { assigneeId: Number(assigneeId) } : {}),
                  start: r.status === "Approved" && startNow && !!assigneeId, ...(text.trim() ? { comments: text.trim() } : {}),
                }), close)}>Save assignment</button>
                <button className="btn-ghost" onClick={close}>Back</button>
              </div>
            </div>
          )}

          {form === "hold" && (
            <div className="sr-form">
              <div className="row">
                <label className="field-group"><span className="lbl">Reason</span>
                  <select className="select" value={reasonId} onChange={(e) => setReasonId(e.target.value)}>
                    <option value="">No specific reason</option>{(pendingReasons.data ?? []).filter((p) => p.isActive !== false).map((p) => <option key={p.pendingReasonId} value={p.pendingReasonId}>{p.pendingReasonName} ({p.slaImpact === "continue" ? "SLA keeps running" : "SLA paused"})</option>)}</select></label>
                {customHold.length > 0 && <label className="field-group"><span className="lbl">Status detail</span>
                  <select className="select" value={holdStatus} onChange={(e) => setHoldStatus(e.target.value)}>
                    <option value="">None</option>{customHold.map((s) => <option key={s.requestStatusId}>{s.statusName}</option>)}</select></label>}
              </div>
              <textarea className="textarea" placeholder="Notes for the requester (optional)" value={text} onChange={(e) => setText(e.target.value)} />
              <div className="sr-actions">
                <button className="btn-primary" disabled={busy} onClick={() => void run(() => requestLifecycleApi.hold(requestId, {
                  ...(reasonId ? { pendingReasonId: Number(reasonId) } : {}), ...(holdStatus ? { subStatus: holdStatus } : {}), ...(text.trim() ? { notes: text.trim() } : {}),
                }), () => { close(); setReasonId(""); setHoldStatus(""); })}>Put on hold</button>
                <button className="btn-ghost" onClick={close}>Back</button>
              </div>
            </div>
          )}

          {form === "fulfil" && tab === "details" && (
            <div className="sr-form">
              {openWorkOrders.length > 0 && <div className="sr-notice warn">{openWorkOrders.length} linked work order{openWorkOrders.length === 1 ? " is" : "s are"} still open ({openWorkOrders.map((w) => w.number).join(", ")}). Complete or cancel {openWorkOrders.length === 1 ? "it" : "them"} first.</div>}
              {openTasks > 0 && <div className="sr-notice warn">{openTasks} fulfilment task{openTasks === 1 ? " is" : "s are"} still open. Complete or cancel them first.</div>}
              <label className="field-group"><span className="lbl">Closure code <span className="req">*</span></span>
                <select className="select" value={codeId} onChange={(e) => setCodeId(e.target.value)}>
                  <option value="">Select…</option>{(closureCodes.data ?? []).filter((c) => c.isActive !== false).map((c) => <option key={c.closureCodeId} value={c.closureCodeId}>{c.closureCodeName}</option>)}</select></label>
              <label className="field-group"><span className="lbl">Fulfilment notes <span className="req">*</span></span>
                <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} /></label>
              <div className="sr-actions">
                <button className="btn-primary" disabled={busy || !codeId || !text.trim() || openTasks > 0 || openWorkOrders.length > 0} onClick={() => void run(() => requestLifecycleApi.fulfil(requestId, { closureCodeId: Number(codeId), notes: text.trim() }), close)}>Mark fulfilled</button>
                <button className="btn-ghost" onClick={close}>Back</button>
              </div>
            </div>
          )}

          {form === "resubmit" && (() => {
            const asked = (r.approvals ?? []).find((a) => a.status === "Info requested");
            const returned = (r.approvals ?? []).filter((a) => a.status === "Rejected").pop();
            return (
              <div className="sr-form">
                {asked ? (
                  <div className="sr-notice warn"><strong>{asked.title} asked:</strong> {asked.comments}</div>
                ) : (
                  <div className="sr-notice warn">{returned ? <><strong>{returned.title} returned this request:</strong> {returned.comments}</> : "An approver returned this request."} Change what is needed, then resubmit it.</div>
                )}
                <textarea className="textarea" placeholder={asked ? "Your answer (required)" : "What did you change? (optional)"} value={text} onChange={(e) => setText(e.target.value)} />
                <div className="sr-actions">
                  <button className="btn-primary" disabled={busy || (!!asked && !text.trim())} onClick={() => void run(() => serviceRequestApi.resubmit(requestId, text.trim() || undefined), close)}>{asked ? "Send answer" : "Resubmit"}</button>
                  <button className="btn-ghost" onClick={close}>Back</button>
                </div>
              </div>
            );
          })()}

          {(form === "close" || form === "cancel") && (
            <div className="sr-form">
              <textarea className="textarea" placeholder={form === "close" ? "Note (optional)" : "Reason (optional)"} value={text} onChange={(e) => setText(e.target.value)} />
              <div className="sr-actions">
                <button className="btn-primary" disabled={busy} onClick={() => void run(() => form === "close" ? requestLifecycleApi.close(requestId, text.trim() || undefined) : serviceRequestApi.cancel(requestId, text.trim() || undefined), close)}>
                  {form === "close" ? "Close request" : "Confirm cancellation"}</button>
                <button className="btn-ghost" onClick={close}>Back</button>
              </div>
            </div>
          )}
        </div>

        {relMsg && <div className="sr-notice" style={{ marginBottom: 16 }}>{relMsg}</div>}
        {createOpen && agentView && (
          <div className="card sr-panel" style={{ marginBottom: 16, borderColor: "#B9CDF3" }}>
            <div className="sr-panel-head"><h3>Create a related record</h3><button className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button></div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>Raise another record from {requestNo(r)} when this request uncovers a fault, a follow-up need, a change, a recurring issue or on-site work. It is linked to this request and listed under Linked tickets.</div>
            <div className="sr-actions" style={{ marginBottom: 12 }}>
              {REL_TYPES.map((t) => <button key={t.type} type="button" className={`sr-chip ${relType === t.type ? "active" : ""}`} aria-pressed={relType === t.type} onClick={() => { setRelType(t.type); setRel((x) => ({ ...x, relation: t.type === "request" ? "Parent of" : "Related to", convert: false })); }}>{t.label}</button>)}
            </div>
            {relType && (
              <div className="sr-form" style={{ margin: 0, maxWidth: 680 }}>
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{REL_TYPES.find((t) => t.type === relType)?.when}</div>
                {relType === "request" && (
                  <label className="field-group"><span className="lbl">Catalog item <span className="req">*</span></span>
                    <select className="select" value={rel.catalogId} onChange={(e) => setRel({ ...rel, catalogId: e.target.value })}>
                      <option value="">Select…</option>{(catalogs.data ?? []).map((c) => <option key={c.catalogId} value={c.catalogId}>{c.catalogName}</option>)}</select></label>
                )}
                <label className="field-group"><span className="lbl">Short description <span className="req">*</span></span><input className="input" value={rel.short} onChange={(e) => setRel({ ...rel, short: e.target.value })} /></label>
                <label className="field-group"><span className="lbl">Details</span><textarea className="textarea" value={rel.desc} onChange={(e) => setRel({ ...rel, desc: e.target.value })} /></label>
                <div className="row">
                  {(relType === "incident" || relType === "problem") && <label className="field-group"><span className="lbl">Priority</span><select className="select" value={rel.priority} onChange={(e) => setRel({ ...rel, priority: e.target.value })}>{PRIORITIES.map((x) => <option key={x}>{x}</option>)}</select></label>}
                  {relType === "change" && <label className="field-group"><span className="lbl">Change type</span><select className="select" value={rel.changeType} onChange={(e) => setRel({ ...rel, changeType: e.target.value as typeof rel.changeType })}>{["Standard", "Normal", "Emergency"].map((x) => <option key={x}>{x}</option>)}</select></label>}
                  {(relType === "change" || relType === "work_order") && <label className="field-group"><span className="lbl">{relType === "change" ? "Planned date" : "Scheduled date"}</span><input className="input" type="date" value={rel.date} onChange={(e) => setRel({ ...rel, date: e.target.value })} /></label>}
                  {relType === "work_order" && <label className="field-group"><span className="lbl">Location</span><input className="input" value={rel.location} onChange={(e) => setRel({ ...rel, location: e.target.value })} /></label>}
                </div>
                {relType === "incident" && CONVERTIBLE.includes(r.status) && (
                  <label className="admin-master-check-label"><input type="checkbox" checked={rel.convert} onChange={(e) => setRel({ ...rel, convert: e.target.checked })} /> This is a fault, not a request: cancel {requestNo(r)} and handle it as an incident</label>
                )}
                <div className="sr-actions"><button className="btn-primary" disabled={busy || rel.short.trim().length < 3 || (relType === "request" && !rel.catalogId)} onClick={() => void run(async () => {
                  const body: CreateRelatedBody = {
                    type: relType, shortDescription: rel.short.trim(), relation: rel.relation, ...(rel.desc.trim() ? { description: rel.desc.trim() } : {}),
                    ...(relType === "incident" || relType === "problem" ? { priority: rel.priority } : {}),
                    ...(relType === "change" ? { changeType: rel.changeType } : {}), ...((relType === "change" || relType === "work_order") && rel.date ? { plannedDate: rel.date } : {}),
                    ...(relType === "work_order" && rel.location.trim() ? { location: rel.location.trim() } : {}),
                    ...(relType === "request" ? { catalogId: Number(rel.catalogId) } : {}), ...(relType === "incident" && rel.convert ? { convert: true } : {}),
                  };
                  const made = await requestLinksApi.create(requestId, body);
                  setRelMsg(`${REL_LABEL[made.type]} ${made.number} was created and linked to ${requestNo(r)}.${body.convert ? ` ${requestNo(r)} was cancelled because it is being handled as an incident.` : ""}`);
                }, () => { setCreateOpen(false); setRelType(""); setRel({ ...rel, short: "", desc: "", date: "", location: "", convert: false }); links.reload(); })}>Create and link</button></div>
              </div>
            )}
          </div>
        )}

        {tab === "details" && (
        <div className="sr-record">
          <div className="sr-stack">
            <Panel title="Request details">
              <Facts rows={[
                ["Item", r.catalog.catalogName], ["Category", r.catalog.category?.categoryName], ["Requested by", r.requestedBy?.fullName],
                ["Estimated cost", money(r.estimatedCost)],
                ...(r.variableValues ?? []).map((v) => [v.variable.label, /^(true|false)$/i.test(String(v.value).trim()) ? (/^true$/i.test(String(v.value).trim()) ? "Yes" : "No") : v.value] as [string, React.ReactNode]),
              ]} />
            </Panel>

            {agentView && (
              <Panel title={`Linked tickets${links.data ? ` (${links.data.length})` : ""}`}>
                {links.data === null ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Linked tickets are not available on the server yet.</div> : (
                  <>
                    {(links.data ?? []).length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>Nothing is linked to this request yet.</div> : (
                      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>{(links.data ?? []).map((l) => (
                        <div key={`${l.direction}${l.linkId}`} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
                          <span className="cb-status" style={{ flex: "none" }}>{REL_LABEL[l.type] ?? l.type}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div><strong>{l.number}</strong> <span style={{ overflowWrap: "anywhere" }}>{l.title}</span></div>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>{l.details ? `${l.details} \u00b7 ` : ""}{l.group ? `${l.group} \u00b7 ` : ""}{l.status}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>{l.direction === "out" ? l.relation : `${l.relation} this request`}</div>
                            {(l.alsoLinked ?? []).length > 0 && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Also linked to {(l.alsoLinked ?? []).join(", ")}</div>}
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flex: "none" }}>
                            {l.targetId != null && (l.type === "request" || l.type === "incident") && (
                              <a className="btn-ghost btn-sm" style={{ textDecoration: "none" }} href={l.type === "request" ? `/service-requests/queue/${l.targetId}` : `/incidents/${l.targetId}`}>Open</a>
                            )}
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                              aria-label={`De-link ${l.number}`}
                              disabled={busy}
                              onClick={() => void run(() => requestLinksApi.remove(requestId, l.linkId), () => links.reload())}
                            >
                              <Unlink size={12} aria-hidden="true" /> De-Link
                            </button>
                          </div>
                        </div>))}</div>
                    )}
                    <LinkPicker requestId={requestId} onLinked={() => links.reload()} />
                  </>
                )}
              </Panel>
            )}

            {agentView && (
              <Panel title="Work notes">
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Internal. The requester cannot see work notes.</div>
                {workNotes.data === null ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Work notes are not available on the server yet.</div> : (
                  <>
                    <div className="sr-form" style={{ marginTop: 0, marginBottom: 12 }}>
                      <textarea className="textarea" placeholder="Add a work note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                      <div className="sr-actions"><button className="btn-primary" disabled={busy || !noteText.trim()} onClick={() => void run(() => requestLinksApi.addNote(requestId, noteText.trim()), () => { setNoteText(""); workNotes.reload(); })}>Add note</button></div>
                    </div>
                    {(workNotes.data ?? []).length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No work notes yet.</div> : (
                      <div style={{ display: "grid", gap: 10 }}>{(workNotes.data ?? []).map((n) => (
                        <div key={n.noteId} style={{ fontSize: 13 }}>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{n.createdBy?.fullName ?? "Agent"} · {formatDateTime(n.createdAt)}</div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{n.text}</div>
                        </div>))}</div>
                    )}
                  </>
                )}
              </Panel>
            )}

            <Panel title="Activity">
              <div className="sr-form" style={{ marginTop: 0, marginBottom: 14 }}>
                <textarea className="textarea" placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="sr-actions"><button className="btn-primary" disabled={busy || !comment.trim()} onClick={() => void run(() => requestLifecycleApi.comment(requestId, comment.trim()), () => setComment(""))}>Post comment</button></div>
              </div>
              <Timeline history={r.history} />
            </Panel>
          </div>

          <div className="sr-stack">
            <Panel title="Classification">
              <div style={{ display: "grid", gap: 10 }}>
                <label className="field-group"><span className="lbl">Urgency</span>
                  <select className="select" value={urgencyValue} disabled={!open} onChange={(e) => setUrgencyId(e.target.value)}>
                    <option value="">Not set</option>{(urgencies.data ?? []).map((u) => <option key={u.urgencyId} value={u.urgencyId}>{u.urgencyName}</option>)}</select></label>
                <label className="field-group"><span className="lbl">Service impact</span>
                  <select className="select" value={impactValue} disabled={!open} onChange={(e) => setImpactId(e.target.value)}>
                    <option value="">Not set</option>{(impacts.data ?? []).map((i) => <option key={i.serviceImpactId} value={i.serviceImpactId}>{i.impactName}</option>)}</select></label>
                <div style={{ fontSize: 13 }}>Priority: <PriorityBadge name={r.priority?.priorityName} color={r.priority?.color} /></div>
                {classificationDirty && <div><button className="btn-primary" disabled={busy} onClick={() => void run(() => requestLifecycleApi.classify(requestId, {
                  ...(urgencyId ? { urgencyId: Number(urgencyId) } : {}), ...(impactId ? { serviceImpactId: Number(impactId) } : {}),
                }), () => { setUrgencyId(""); setImpactId(""); })}>Save classification</button></div>}
              </div>
            </Panel>

            <Panel title="Assignment">
              <Facts rows={[["Group", r.assignmentGroup?.groupName], ["Assigned to", r.assignedTo?.fullName ?? "Unassigned"], ["First response", r.claimedAt ? formatDateTime(r.claimedAt) : "—"]]} />
              {r.status === "In Progress" && customWork.length > 0 && (
                <label className="field-group" style={{ marginTop: 12 }}><span className="lbl">Status detail</span>
                  <select className="select" value={r.subStatus ?? ""} disabled={busy} onChange={(e) => void run(() => requestLifecycleApi.subStatus(requestId, e.target.value || null))}>
                    <option value="">None</option>{customWork.map((s) => <option key={s.requestStatusId}>{s.statusName}</option>)}</select></label>
              )}
              {r.status === "On Hold" && <div style={{ marginTop: 12 }}><Facts rows={[["Hold reason", r.pendingReason?.pendingReasonName ?? r.subStatus], ["Notes", r.holdNotes]]} /></div>}
            </Panel>

            <Panel title="Service level">
              <Facts rows={[
                ["State", <SlaBadge key="s" state={r.sla?.state} />],
                ["Response target", r.slaResponseTarget ? `${formatDateTime(r.slaResponseTarget)}${r.claimedAt ? (r.slaResponseMet ? " · met" : " · missed") : ""}` : "—"],
                ["Fulfilment target", formatDateTime(r.slaFulfilmentTarget)],
                ...(r.slaPausedAt ? [["Paused since", formatDateTime(r.slaPausedAt)] as [string, React.ReactNode]] : []),
              ]} />
            </Panel>

            <Panel title="Approvals"><ApprovalChain approvals={r.approvals} status={r.status} /></Panel>

            {r.fulfilledAt && (
              <Panel title="Outcome">
                <Facts rows={[["Closure code", r.closureCode?.closureCodeName], ["Notes", r.fulfilmentNotes], ["Fulfilled", formatDateTime(r.fulfilledAt)],
                  ...(r.status === "Fulfilled" && r.autoCloseAt ? [["Closes automatically", formatDateTime(r.autoCloseAt)] as [string, React.ReactNode]] : [])]} />
              </Panel>
            )}
            {r.feedbackSubmittedAt && <Panel title="Requester feedback"><Stars value={r.feedbackRating ?? 0} />{r.feedbackComment && <p style={{ fontSize: 13, margin: "8px 0 0" }}>{r.feedbackComment}</p>}</Panel>}
          </div>
        </div>
        )}

        {tab === "wo" && (
          <div className="card sr-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="proto-eyebrow-title">Work Orders ({workOrders.length})</div>
              {agentView && open && <button className="btn-primary" onClick={() => { setCreateOpen(true); setRelType("work_order"); setRelMsg(""); setRel((x) => ({ ...x, relation: "Related to", convert: false })); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Plus size={13} aria-hidden="true" /> Create Work Order</button>}
            </div>
            {links.data === null ? <div className="empty-state">Work orders are not available on the server yet.</div>
              : workOrders.length === 0 ? <div className="empty-state">No work orders raised for this request yet.</div> : (
              <div style={{ overflowX: "auto" }}><table>
                <thead><tr><th style={TH}>WO #</th><th style={TH}>Work Order</th><th style={TH}>Workgroup</th><th style={TH}>Relationship</th><th style={TH}>Status</th></tr></thead>
                <tbody>{workOrders.map((w) => (
                  <tr key={`${w.direction}${w.linkId}`}>
                    <td style={{ fontSize: 13 }}>{w.targetId != null
                      ? <Link to={`/work-orders?open=${encodeURIComponent(String(w.targetId))}`} className="wo-link">{w.number}</Link>
                      : w.number}</td>
                    <td style={{ fontSize: 13 }}><div style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{w.title}</div>{w.details && <div style={{ fontSize: 12, color: "var(--muted)" }}>{w.details}</div>}</td>
                    <td style={{ fontSize: 12.5 }}>{w.group ?? "—"}</td>
                    <td style={{ fontSize: 12.5 }}>{w.direction === "out" ? w.relation : `${w.relation} this request`}</td>
                    <td style={{ fontSize: 12.5 }}>{w.status}</td>
                  </tr>))}</tbody>
              </table></div>
            )}
          </div>
        )}

        {tab === "tasks" && (
          <div className="sr-stack">
            <Panel title="Fulfilment tasks">
              {(r.tasks ?? []).length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>This request has no fulfilment tasks.</div> : (
                <div style={{ overflowX: "auto" }}><table>
                  <thead><tr><th style={TH}>Task</th><th style={TH}>Due</th><th style={{ ...TH, width: 150 }}>Status</th></tr></thead>
                  <tbody>{(r.tasks ?? []).map((t) => (
                    <tr key={t.requestTaskId}>
                      <td style={{ fontSize: 13 }}><strong>{t.taskName}</strong>{t.description && <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.description}</div>}</td>
                      <td style={{ fontSize: 12.5 }}>{formatDateTime(t.dueAt)}</td>
                      <td><select className="select" value={t.status} disabled={busy || !working || !r.viewer.isAgent} aria-label={`Status of ${t.taskName}`}
                        onChange={(e) => void run(() => requestLifecycleApi.task(requestId, t.requestTaskId, e.target.value as RequestTaskRow["status"]))}>
                        {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
                    </tr>))}</tbody>
                </table></div>
              )}
              {!working && (r.tasks ?? []).length > 0 && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>Tasks can be updated while the request is In Progress.</div>}
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
