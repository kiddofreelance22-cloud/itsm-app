import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, SearchBox, StatusPill as ActivePill, TH, errMsg } from "../components/configKit";
import {
  requestConfigApi, serviceRequestApi,
  type NotificationRuleItem, type RequestStatusItem,
} from "../requestsApi";
import { Pill, TONES, resetRequestStatuses } from "../components/serviceRequestKit";
import { Link } from "../router";
import { EmailBodyEditor } from "../components/EmailBodyEditor";
import { MasterListPage } from "./MasterListPage";

const confirmDelete = (what: string) => typeof window === "undefined" || window.confirm(`Delete ${what}? This cannot be undone.`);

/* ───────────────────────── Service Impact ───────────────────────── */
export const ServiceImpactPage = () => (
  <MasterListPage cfg={{
    path: "/service-impacts", crumb: "Configuration > Service SLA Configurations > Service Impact", title: "Service Impact",
    subtitle: "Define how many people or how much of the business a service request serves. Impact and urgency together set the priority.",
    listTitle: "Service Impact Levels", singular: "Service Impact Level", nameLabel: "Service Impact Level",
    searchPlaceholder: "Search service impact levels…", idKey: "serviceImpactId", nameKey: "impactName", orderKey: "sortOrder",
    descriptionHint: "When and how this should be used…",
    headerLink: { label: "Open Service Priority Matrix", to: "/config/admin/request-priority-matrix" },
  }} />
);

/* ───────────────────────── Request priority matrix ───────────────────────── */
export function RequestPriorityMatrixPage() {
  const matrix = useAsync(() => requestConfigApi.matrix(), []);
  const urgencies = useAsync(() => serviceRequestApi.urgencies(), []);
  const impacts = useAsync(() => serviceRequestApi.serviceImpacts(), []);
  const priorities = useAsync(() => serviceRequestApi.priorities(), []);
  const [u, setU] = useState(""); const [i, setI] = useState(""); const [p, setP] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const selU = u || String(urgencies.data?.[0]?.urgencyId ?? "");
  const selI = i || String(impacts.data?.[0]?.serviceImpactId ?? "");
  const selP = p || String(priorities.data?.[0]?.priorityId ?? "");

  const add = async () => {
    setErr("");
    if (!selU || !selI || !selP) { setErr("Pick an urgency, a service impact and a priority."); return; }
    if ((matrix.data ?? []).some((r) => r.urgencyId === Number(selU) && r.serviceImpactId === Number(selI))) { setErr("This urgency and impact pair is already mapped. Each pair can only be mapped once."); return; }
    setBusy(true);
    try { await requestConfigApi.createMatrix({ urgencyId: Number(selU), serviceImpactId: Number(selI), priorityId: Number(selP) }); matrix.reload(); }
    catch (e) { setErr(errMsg(e, "Unable to add the combination.")); } finally { setBusy(false); }
  };
  const patch = async (id: number, body: { priorityId?: number; isActive?: boolean }) => {
    setErr("");
    try { await requestConfigApi.updateMatrix(id, body); } catch (e) { setErr(errMsg(e)); }
    matrix.reload();
  };

  return (
    <>
      <PageHeader crumb="Configuration > Service SLA Configurations > Service Priority Matrix" title="Service Priority Matrix"
        subtitle="Pick a service urgency, service impact and service priority, then add the combination. Each urgency and impact pair can be mapped once."
        action={<><Link className="btn-ghost" to="/config/admin/service-urgency">Edit service urgency</Link><Link className="btn-ghost" to="/config/admin/service-impact">Edit service impact</Link><Link className="btn-ghost" to="/config/admin/service-priority">Edit service priority</Link></>} />
      <div className="page-body">
        <ErrorBar msg={matrix.error ?? err} />
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "24px 20px 20px" }}>
            <div className="priority-matrix-form-row">
              <label className="field-group priority-matrix-field"><span className="lbl">Urgency</span>
                <select className="select" value={selU} onChange={(e) => setU(e.target.value)}>{(urgencies.data ?? []).map((x) => <option key={x.urgencyId} value={x.urgencyId}>{x.urgencyName}</option>)}</select></label>
              <label className="field-group priority-matrix-field"><span className="lbl">Service impact</span>
                <select className="select" value={selI} onChange={(e) => setI(e.target.value)}>{(impacts.data ?? []).map((x) => <option key={x.serviceImpactId} value={x.serviceImpactId}>{x.impactName}</option>)}</select></label>
              <label className="field-group priority-matrix-field"><span className="lbl">Priority</span>
                <select className="select" value={selP} onChange={(e) => setP(e.target.value)}>{(priorities.data ?? []).map((x) => <option key={x.priorityId} value={x.priorityId}>{x.priorityName}</option>)}</select></label>
              <button className="btn-primary" disabled={busy} onClick={() => void add()}><Plus size={14} aria-hidden="true" /> Add combination</button>
            </div>
          </div>
          <div style={{ padding: "0 20px 20px", overflowX: "auto" }}>
            {matrix.loading && !matrix.data ? <div className="spinner-row">Loading…</div> : (matrix.data ?? []).length === 0 ? <div className="empty-state">No combinations yet. Pick an urgency, impact and priority above, then add the combination.</div> : (
              <table>
                <thead><tr><th style={TH}>Urgency</th><th style={TH}>Service impact</th><th style={TH}>Priority</th><th style={TH}>Active</th></tr></thead>
                <tbody>{(matrix.data ?? []).map((r) => (
                  <tr key={r.requestPriorityMatrixId}>
                    <td>{r.urgency.urgencyName}</td><td>{r.serviceImpact.impactName}</td>
                    <td><select className="select" style={{ width: "auto" }} value={r.priorityId} aria-label={`Priority for ${r.urgency.urgencyName} and ${r.serviceImpact.impactName}`}
                      onChange={(e) => void patch(r.requestPriorityMatrixId, { priorityId: Number(e.target.value) })}>
                      {(priorities.data ?? []).map((x) => <option key={x.priorityId} value={x.priorityId}>{x.priorityName}</option>)}</select></td>
                    <td><label className="admin-master-check-label"><input type="checkbox" checked={r.isActive} onChange={(e) => void patch(r.requestPriorityMatrixId, { isActive: e.target.checked })} /> {r.isActive ? "Active" : "Inactive"}</label></td>
                  </tr>))}</tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── Approver groups ───────────────────────── */
type DirUser = { userId: number; fullName: string; email?: string };
interface GroupDraft { id: number | null; groupName: string; description: string; isActive: boolean; members: DirUser[] }

export function ApproverGroupsPage() {
  const list = useAsync(() => requestConfigApi.groups(), []);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<GroupDraft | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const rows = useMemo(() => (list.data ?? []).filter((g) => !query.trim() || `${g.groupName} ${g.members.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())), [list.data, query]);

  const edit = async (id: number) => {
    setErr("");
    try {
      const g = await requestConfigApi.group(id);
      setDraft({ id, groupName: g.groupName, description: g.description ?? "", isActive: g.isActive, members: g.members.map((m) => ({ userId: m.userId, fullName: m.fullName, email: m.email })) });
    } catch (e) { setErr(errMsg(e)); }
  };
  const save = async () => {
    if (!draft) return;
    setErr("");
    if (!draft.groupName.trim()) { setErr("Give the group a name."); return; }
    if (!draft.members.length) { setErr("Add at least one member."); return; }
    setBusy(true);
    const body = { groupName: draft.groupName.trim(), description: draft.description.trim() || null, isActive: draft.isActive, memberIds: draft.members.map((m) => m.userId) };
    try { if (draft.id) await requestConfigApi.updateGroup(draft.id, body); else await requestConfigApi.createGroup(body); setDraft(null); list.reload(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const remove = async (id: number, name: string) => {
    if (!confirmDelete(`the group “${name}”`)) return;
    setErr("");
    try { await requestConfigApi.deleteGroup(id); list.reload(); } catch (e) { setErr(errMsg(e)); }
  };

  if (draft) return <GroupForm draft={draft} setDraft={setDraft} busy={busy} err={err} onSave={() => void save()} />;
  return (
    <>
      <PageHeader crumb="Configuration > Service Request Management > Service Approver Group" title="Service Approver Group" subtitle="Create the groups that an approval step can use in a lifecycle, and choose who belongs to each." action={<Link className="btn-ghost" to="/config/admin/lifecycles">Open Service Lifecycle</Link>} />
      <div className="page-body">
        <ErrorBar msg={list.error ?? err} />
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <SearchBox value={query} onChange={setQuery} placeholder="Search groups or members…" />
            <button className="btn-primary" onClick={() => { setErr(""); setDraft({ id: null, groupName: "", description: "", isActive: true, members: [] }); }}><Plus size={14} aria-hidden="true" /> Create service approver group</button>
          </div>
          <div style={{ padding: "0 20px 16px", overflowX: "auto" }}>
            {list.loading && !list.data ? <div className="spinner-row">Loading…</div> : rows.length === 0 ? <div className="empty-state">{query ? "No service approver groups match your search." : "No service approver groups yet. Choose Create service approver group to add the first one."}</div> : (
              <table>
                <thead><tr><th style={TH}>Group</th><th style={TH}>Members</th><th style={TH}>Used in</th><th style={TH}>Status</th><th style={TH} /></tr></thead>
                <tbody>{rows.map((g) => (
                  <tr key={g.approverGroupId}>
                    <td style={{ fontSize: 13 }}><strong>{g.groupName}</strong>{g.description && <div style={{ fontSize: 12, color: "var(--muted)" }}>{g.description}</div>}</td>
                    <td style={{ fontSize: 12.5 }}>{g.memberCount}{g.members.length > 0 && <span style={{ color: "var(--muted)" }}> · {g.members.join(", ")}{g.memberCount > g.members.length ? "…" : ""}</span>}</td>
                    <td style={{ fontSize: 12.5 }}>{g.usedIn.length ? g.usedIn.join(", ") : <span style={{ color: "var(--muted)" }}>Not used</span>}</td>
                    <td><ActivePill active={g.isActive} /></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="admin-master-icon-button" aria-label={`Edit ${g.groupName}`} onClick={() => void edit(g.approverGroupId)}><Pencil size={14} aria-hidden="true" /></button>
                      <button className="admin-master-icon-button" aria-label={`Delete ${g.groupName}`} disabled={g.usedIn.length > 0} title={g.usedIn.length ? "In use by a lifecycle" : undefined} onClick={() => void remove(g.approverGroupId, g.groupName)}><Trash2 size={14} aria-hidden="true" /></button>
                    </td>
                  </tr>))}</tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function GroupForm({ draft, setDraft, busy, err, onSave }: { draft: GroupDraft; setDraft: (d: GroupDraft | null) => void; busy: boolean; err: string; onSave: () => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<DirUser[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return; }
    let cancelled = false;
    const t = setTimeout(() => { api.get<DirUser[]>(`/users/directory?q=${encodeURIComponent(q.trim())}`).then((r) => { if (!cancelled) setFound(r); }).catch(() => { if (!cancelled) setFound([]); }); }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);
  const chosen = new Set(draft.members.map((m) => m.userId));
  return (
    <>
      <PageHeader crumb="Configuration > Service Request Management > Service Approver Group" title={draft.id ? "Edit service approver group" : "Create service approver group"} onClose={() => setDraft(null)} />
      <div className="page-body">
        <ErrorBar msg={err} />
        <div className="card" style={{ padding: 24, display: "grid", gap: 16, maxWidth: 720 }}>
          <label className="field-group"><span className="lbl">Group name <span className="req">*</span></span>
            <input className="input" value={draft.groupName} onChange={(e) => setDraft({ ...draft, groupName: e.target.value })} /></label>
          <label className="field-group"><span className="lbl">Description</span>
            <textarea className="textarea" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          <div className="field-group"><span className="lbl">Members <span className="req">*</span></span>
            <input className="input" placeholder="Search people by name or e-mail…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
            {found.length > 0 && <div className="sr-suggest">{found.filter((u) => !chosen.has(u.userId)).map((u) => (
              <button key={u.userId} type="button" onClick={() => { setDraft({ ...draft, members: [...draft.members, u] }); setQ(""); setFound([]); }}>{u.fullName}{u.email && <span style={{ color: "var(--muted)" }}> · {u.email}</span>}</button>))}</div>}
            <div className="sr-members">{draft.members.length === 0 ? <span style={{ fontSize: 12.5, color: "var(--muted)" }}>No members yet.</span> : draft.members.map((m) => (
              <span key={m.userId} className="sr-member">{m.fullName}<button type="button" aria-label={`Remove ${m.fullName}`} onClick={() => setDraft({ ...draft, members: draft.members.filter((x) => x.userId !== m.userId) })}><X size={12} aria-hidden="true" /></button></span>))}</div>
          </div>
          <label className="admin-master-check-label"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active</label>
          <div className="sr-actions"><button className="btn-primary" disabled={busy} onClick={onSave}>Save group</button><button className="btn-ghost" onClick={() => setDraft(null)}>Cancel</button></div>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── Request statuses ───────────────────────── */
const COLOR_KEYS = Object.keys(TONES);
interface StatusDraft { id: number | null; statusName: string; stage: "work" | "hold"; color: string; description: string; isActive: boolean; system: boolean }

const SYSTEM_NOTES: Record<string, string> = {
  "Pending Approval": "A request enters this status when it is submitted with approvals to collect.",
  "Waiting": "A request enters this status when a Wait step in its lifecycle pauses it. It carries on by itself when the wait ends.",
  "Returned": "A request enters this status when an approver sends it back to the requester, either to change it or to answer a question.",
  "Approved": "A request enters this status when its last approval is given, or straight away when no approval is needed.",
  "In Progress": "A request enters this status when an agent takes it from the queue or resumes it from hold.",
  "On Hold": "A request enters this status when an agent puts it on hold without choosing one of the custom On hold statuses.",
  "Fulfilled": "A request enters this status when the agent marks it fulfilled, or when a lifecycle condition fulfils it automatically.",
  "Closed": "A request enters this status when the requester confirms delivery, or automatically 3 business days after fulfilment.",
  "Rejected": "A request enters this status when an approver rejects it or a lifecycle condition closes it.",
  "Cancelled": "A request enters this status when the requester cancels it before fulfilment starts.",
};

export function RequestStatusConfigPage() {
  const list = useAsync(() => requestConfigApi.statuses(), []);
  const stages = useAsync(() => requestConfigApi.stages(), []);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [draft, setDraft] = useState<StatusDraft | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const open = (s?: RequestStatusItem) => { setErr(""); setDraft(s
    ? { id: s.requestStatusId, statusName: s.statusName, stage: s.stage === "hold" ? "hold" : "work", color: s.color, description: s.description ?? "", isActive: s.isActive, system: s.isSystem }
    : { id: null, statusName: "", stage: "work", color: "violet", description: "", isActive: true, system: false }); };
  const save = async () => {
    if (!draft) return;
    setErr("");
    if (!draft.statusName.trim()) { setErr("Give the status a name."); return; }
    setBusy(true);
    try {
      if (draft.id) await requestConfigApi.updateStatus(draft.id, draft.system ? { color: draft.color, description: draft.description.trim() || null } : { statusName: draft.statusName.trim(), stage: draft.stage, color: draft.color, description: draft.description.trim() || null, isActive: draft.isActive });
      else await requestConfigApi.createStatus({ statusName: draft.statusName.trim(), stage: draft.stage, color: draft.color, description: draft.description.trim() || null, isActive: draft.isActive });
      resetRequestStatuses(); setDraft(null); list.reload();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const remove = async (s: RequestStatusItem) => {
    if (!confirmDelete(`the status “${s.statusName}”`)) return;
    setErr("");
    try { await requestConfigApi.deleteStatus(s.requestStatusId); resetRequestStatuses(); list.reload(); } catch (e) { setErr(errMsg(e)); }
  };

  if (draft) return (
    <>
      <PageHeader crumb="Configuration > Service Request Management > Service Request Status" title={draft.id ? (draft.system ? "Edit service request system status" : "Edit service request custom status") : "Add service request custom status"} onClose={() => setDraft(null)} />
      <div className="page-body">
        <ErrorBar msg={err} />
        <div className="card" style={{ padding: 24, display: "grid", gap: 16, maxWidth: 620 }}>
          {draft.system && <div className="sr-notice"><strong>System status.</strong> {SYSTEM_NOTES[draft.statusName] ? `${SYSTEM_NOTES[draft.statusName]} ` : ""}It can be recoloured and described, but not renamed or removed, because the lifecycle moves requests into it.</div>}
          <label className="field-group"><span className="lbl">Status name <span className="req">*</span></span>
            <input className="input" value={draft.statusName} disabled={draft.system} onChange={(e) => setDraft({ ...draft, statusName: e.target.value })} /></label>
          <label className="field-group"><span className="lbl">Stage</span>
            <select className="select" value={draft.stage} disabled={draft.system} onChange={(e) => setDraft({ ...draft, stage: e.target.value as "work" | "hold" })}>
              <option value="work">In progress (SLA clock runs)</option><option value="hold">On hold (SLA clock pauses)</option></select></label>
          <div className="field-group"><span className="lbl">Colour</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{COLOR_KEYS.map((c) => (
              <button key={c} type="button" aria-pressed={draft.color === c} onClick={() => setDraft({ ...draft, color: c })}
                style={{ border: draft.color === c ? "2px solid var(--blue)" : "1px solid var(--border)", borderRadius: 14, padding: 2, background: "none", cursor: "pointer" }}><Pill tone={c}>{c}</Pill></button>))}</div></div>
          <div className="field-group"><span className="lbl">Shown as</span><div><Pill tone={draft.color}>{draft.statusName.trim() || "Status name"}</Pill></div></div>
          <label className="field-group"><span className="lbl">Description</span>
            <textarea className="textarea" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          {!draft.system && <label className="admin-master-check-label"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active – agents can pick this status on a request</label>}
          <div className="sr-actions"><button className="btn-primary" disabled={busy} onClick={() => void save()}>Save status</button><button className="btn-ghost" onClick={() => setDraft(null)}>Cancel</button></div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <PageHeader crumb="Configuration > Service Request Management > Service Request Status" title="Service Request Status" subtitle="Set the statuses a service request moves through: what each one is called, its colour, and the extra statuses agents can use while work is in progress or on hold." action={<Link className="btn-ghost" to="/service-requests/queue">Open Service Request List</Link>} />
      <div className="page-body">
        <ErrorBar msg={list.error ?? err} />
        <div className="card" style={{ padding: "14px 20px", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Stages of a request</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 8px" }}>Every status belongs to one stage, and the stage decides what the SLA clock does. Select a stage to see only its statuses.</div>
          <div className="sr-chips" role="group" aria-label="Stages">
            {(stages.data ?? []).map((st) => (
              <button key={st.key} type="button" className={`sr-chip ${stageFilter === st.key ? "active" : ""}`} aria-pressed={stageFilter === st.key} onClick={() => setStageFilter(stageFilter === st.key ? "" : st.key)}>
                {st.label} <span style={{ opacity: 0.7 }}>{(list.data ?? []).filter((x) => x.stage === st.key).length}</span>
              </button>))}
          </div>
        </div>
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", gap: 12 }}><SearchBox value={query} onChange={setQuery} placeholder="Search statuses…" /><button className="btn-primary" onClick={() => open()}><Plus size={14} aria-hidden="true" /> Add custom status</button></div>
          {list.loading && !list.data ? <div className="spinner-row">Loading…</div> : (stages.data ?? []).filter((st) => !stageFilter || st.key === stageFilter).map((st) => {
            const q = query.trim().toLowerCase();
            const rows = (list.data ?? []).filter((s) => s.stage === st.key && (!q || `${s.statusName} ${s.description ?? ""}`.toLowerCase().includes(q)));
            return (
              <div key={st.key}>
                <div className="sr-stage">{st.label} <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>· {st.hint}</span></div>
                <div style={{ padding: "0 20px 8px", overflowX: "auto" }}>
                  <table><thead><tr><th style={TH}>Status</th><th style={TH}>SLA clock</th><th style={TH}>On requests</th><th style={TH}>Active</th><th style={TH} /></tr></thead>
                    <tbody>{rows.map((s) => (
                      <tr key={s.requestStatusId}>
                        <td style={{ fontSize: 13 }}><Pill tone={s.color}>{s.statusName}</Pill><span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted)" }}>{s.isSystem ? "System" : "Custom"}</span>{s.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, maxWidth: 520 }}>{s.description}</div>}</td>
                        <td style={{ fontSize: 12.5, textTransform: "capitalize" }}>{s.clock}</td>
                        <td style={{ fontSize: 12.5 }}>{s.inUse}</td>
                        <td><ActivePill active={s.isActive} /></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="admin-master-icon-button" aria-label={`Edit ${s.statusName}`} onClick={() => open(s)}><Pencil size={14} aria-hidden="true" /></button>
                          {!s.isSystem && <button className="admin-master-icon-button" aria-label={`Delete ${s.statusName}`} disabled={s.inUse > 0} title={s.inUse ? "On open requests; deactivate it instead" : undefined} onClick={() => void remove(s)}><Trash2 size={14} aria-hidden="true" /></button>}
                        </td>
                      </tr>))}</tbody></table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── E-mail notification rules ───────────────────────── */
interface RuleDraft { id: number | null; ruleName: string; eventKey: string; recipients: string[]; subject: string; body: string; isActive: boolean; displayOrder: number }

export function RequestEmailNotificationPage() {
  const list = useAsync(() => requestConfigApi.rules(), []);
  const metaQ = useAsync(() => requestConfigApi.notificationMeta(), []);
  const meta = metaQ.data ?? { events: [], recipients: [], mergeFields: [] };
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const eventLabel = (k: string) => meta.events.find((e) => e.key === k)?.label ?? k;
  const filteredRules = (list.data ?? []).filter((r) => !query.trim() || `${r.ruleName} ${r.subject}`.toLowerCase().includes(query.trim().toLowerCase()));
  const recipientLabel = (k: string) => meta.recipients.find((r) => r.key === k)?.label ?? k;

  const fromRule = (r: NotificationRuleItem): RuleDraft => ({ id: r.ruleId, ruleName: r.ruleName, eventKey: r.eventKey, recipients: r.recipients, subject: r.subject, body: r.body, isActive: r.isActive, displayOrder: r.displayOrder ?? 0 });
  const save = async () => {
    if (!draft) return;
    setErr("");
    if (!draft.ruleName.trim() || !draft.subject.trim() || !draft.body.trim()) { setErr("Name, subject and body are required."); return; }
    if (!draft.recipients.length) { setErr("Choose at least one recipient."); return; }
    setBusy(true);
    const body = { ruleName: draft.ruleName.trim(), eventKey: draft.eventKey, recipients: draft.recipients, subject: draft.subject.trim(), body: draft.body, isActive: draft.isActive, displayOrder: draft.displayOrder };
    try { if (draft.id) await requestConfigApi.updateRule(draft.id, body); else await requestConfigApi.createRule(body); setDraft(null); list.reload(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const toggle = async (r: NotificationRuleItem) => {
    setErr("");
    try { await requestConfigApi.updateRule(r.ruleId, { isActive: !r.isActive }); } catch (e) { setErr(errMsg(e)); }
    list.reload();
  };
  const remove = async (r: NotificationRuleItem) => {
    if (!confirmDelete(`the rule “${r.ruleName}”`)) return;
    setErr("");
    try { await requestConfigApi.deleteRule(r.ruleId); list.reload(); } catch (e) { setErr(errMsg(e)); }
  };

  if (draft) return (
    <>
      <PageHeader crumb="Configuration > Service Request Management > Service Request E-mail Notification" title={draft.id ? "Edit service request notification rule" : "Add service request notification rule"} onClose={() => setDraft(null)} />
      <div className="page-body">
        <ErrorBar msg={err} />
        <div className="card" style={{ padding: 24, display: "grid", gap: 16, maxWidth: 760 }}>
          <label className="field-group"><span className="lbl">Rule name <span className="req">*</span></span>
            <input className="input" value={draft.ruleName} onChange={(e) => setDraft({ ...draft, ruleName: e.target.value })} /></label>
          <label className="field-group"><span className="lbl">Trigger event</span>
            <select className="select" value={draft.eventKey} onChange={(e) => setDraft({ ...draft, eventKey: e.target.value })}>{meta.events.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select></label>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="lbl">Recipients <span className="req">*</span></legend><div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>Who gets this e-mail when the trigger event happens.</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>{meta.recipients.map((r) => (
              <label key={r.key} className="admin-master-check-label"><input type="checkbox" checked={draft.recipients.includes(r.key)}
                onChange={(e) => setDraft({ ...draft, recipients: e.target.checked ? [...draft.recipients, r.key] : draft.recipients.filter((x) => x !== r.key) })} /> {r.label}</label>))}</div>
            </fieldset>
          <label className="field-group"><span className="lbl">Subject <span className="req">*</span></span>
            <input className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></label>
          <label className="field-group"><span className="lbl">Display order</span>
            <input className="input" type="number" min={0} style={{ maxWidth: 140 }} value={draft.displayOrder} onChange={(e) => setDraft({ ...draft, displayOrder: Number(e.target.value) || 0 })} /></label>
          <div className="field-group"><span className="lbl">E-mail body <span className="req">*</span></span>
            <EmailBodyEditor key={draft.id ?? "new"} value={draft.body} onChange={(html) => setDraft((d) => (d ? { ...d, body: html } : d))} fields={meta.mergeFields} /></div>
          <label className="admin-master-check-label"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active</label>
          <div className="sr-actions"><button className="btn-primary" disabled={busy} onClick={() => void save()}>Save rule</button><button className="btn-ghost" onClick={() => setDraft(null)}>Cancel</button></div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <PageHeader crumb="Configuration > Service Request Management > Service Request E-mail Notification" title="Service Request E-mail Notification" subtitle="Configure which service request events send an e-mail, who receives it, and what the message says." />
      <div className="page-body">
        <ErrorBar msg={list.error ?? err} />
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <SearchBox value={query} onChange={setQuery} placeholder="Search notification rules…" />
            <button className="btn-primary" onClick={() => { setErr(""); setDraft({ id: null, ruleName: "", eventKey: meta.events[0]?.key ?? "", recipients: [], subject: "", body: "", isActive: true, displayOrder: (list.data ?? []).reduce((m, r) => Math.max(m, r.displayOrder ?? 0), 0) + 1 }); }}><Plus size={14} aria-hidden="true" /> Add rule</button>
          </div>
          {list.loading && !list.data ? <div className="spinner-row">Loading…</div> : (list.data ?? []).length === 0 ? <div className="empty-state">No e-mail rules yet. Add one to send e-mail when a request reaches a step.</div> : filteredRules.length === 0 ? <div className="empty-state">No notification rules match your search.</div> : (
            <div style={{ padding: "0 20px 16px", overflowX: "auto" }}>
              <table><thead><tr><th style={TH}>Rule</th><th style={TH}>Trigger event</th><th style={TH}>Recipients</th><th style={TH}>Active</th><th style={TH} /></tr></thead>
                <tbody>{filteredRules.map((r) => (
                  <tr key={r.ruleId}>
                    <td style={{ fontSize: 13 }}><strong>{r.ruleName}</strong><div style={{ fontSize: 12, color: "var(--muted)" }}>{r.subject}</div></td>
                    <td style={{ fontSize: 12.5 }}>{eventLabel(r.eventKey)}</td>
                    <td style={{ fontSize: 12.5 }}>{r.recipients.map(recipientLabel).join(", ") || <span style={{ color: "var(--muted)" }}>No recipients</span>}</td>
                    <td><label className="admin-master-check-label"><input type="checkbox" checked={r.isActive} onChange={() => void toggle(r)} aria-label={`${r.ruleName} active`} /></label></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="admin-master-icon-button" aria-label={`Edit ${r.ruleName}`} onClick={() => { setErr(""); setDraft(fromRule(r)); }}><Pencil size={14} aria-hidden="true" /></button>
                      <button className="admin-master-icon-button" aria-label={`Delete ${r.ruleName}`} onClick={() => void remove(r)}><Trash2 size={14} aria-hidden="true" /></button>
                    </td>
                  </tr>))}</tbody></table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
