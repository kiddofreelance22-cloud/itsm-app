import React, { useEffect, useState } from "react";
import { ClipboardList, Plus, Search } from "lucide-react";
import { Link } from "../router";
import { api } from "../api";
import { WO_PRIORITIES, WO_STATUSES, WorkOrderRow, workOrderApi } from "../configApi";
import { useAsync } from "../hooks";
import { ErrorBar, errMsg, formatDate } from "../components/configKit";

const PRIORITY_CLASS: Record<string, string> = { P1: "p1", P2: "p2", P3: "p3", P4: "p4" };
const STATUS_CLASS: Record<string, string> = { Open: "open", "In Progress": "in-progress", Completed: "completed", "On Hold": "on-hold", Cancelled: "cancelled" };

const PriorityBadge = ({ p }: { p: string }) => <span className={`priority-badge ${PRIORITY_CLASS[p.slice(0, 2)] ?? "p3"}`}>{p}</span>;
const WoStatusPill = ({ s }: { s: string }) => <span className={`wo-status-pill ${STATUS_CLASS[s] ?? "open"}`}>{s}</span>;

type Raw = Record<string, any>;

/** Read-only view of the incident a work order was raised against, so the analyst keeps the context. */
function LinkedIncidentCard({ incidentId }: { incidentId: string }) {
  const q = useAsync(() => api.get<Raw>(`/incidents/${encodeURIComponent(incidentId)}`), [incidentId]);
  const i = q.data;
  const row = (label: string, value: React.ReactNode) => (
    <div className="field-group"><span className="lbl">{label}</span><div style={{ fontSize: 13, color: "#1D2433", minHeight: 24 }}>{value || "—"}</div></div>
  );
  return (
    <div style={{ gridColumn: "1 / -1", border: "1px solid var(--border-soft)", borderRadius: 10, background: "#F9FAFB", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="proto-eyebrow-title">Linked Incident <span style={{ fontWeight: 400, color: "var(--muted)" }}>(read only)</span></div>
        <Link to={`/incidents/${incidentId}?view=readonly`} style={{ fontWeight: 700 }}>{i?.incidentCode ?? incidentId} →</Link>
      </div>
      {q.loading ? <div className="spinner-row">Loading…</div> : q.error || !i ? <div className="error-text">Unable to load the linked incident.</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
          <div style={{ gridColumn: "1 / -1" }}>{row("Short Description", i.title)}</div>
          {row("Status", i.status)}{row("Priority", i.priority)}
          {row("Category", i.category?.categoryName)}{row("Assignment Group", i.assignmentGroup?.groupName)}
          {row("Caller", i.createdBy?.fullName)}{row("Assigned To", i.assignedTo?.fullName)}
          <div style={{ gridColumn: "1 / -1" }}>{row("Description", <span style={{ whiteSpace: "pre-wrap" }}>{i.description}</span>)}</div>
        </div>
      )}
    </div>
  );
}

interface GroupRec { groupId: number; groupName: string }
interface UserRec { userId: number; fullName: string; isActive?: boolean }
const blank = { incidentId: "", requestNumber: "", priority: "P3 - Medium", title: "", notes: "", groupId: "", assignedTo: "", status: "Open", isActive: true };

export function WorkOrderListPage() {
  const { data, loading, error, reload } = useAsync(() => workOrderApi.list(), []);
  const groups = useAsync(() => api.get<GroupRec[]>("/assignment-groups"), []);
  // /users is Admin-only, so analysts get the light assignable list instead (an empty list was why engineer names were missing).
  const users = useAsync(() => api.get<UserRec[]>("/users/assignable").catch(() => api.get<UserRec[]>("/users").catch(() => [] as UserRec[])), []);
  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState("");
  const [groupF, setGroupF] = useState("");
  const [mode, setMode] = useState<"list" | "new" | WorkOrderRow>("list");
  const [form, setForm] = useState(blank);
  // Engineers of the chosen workgroup; with no workgroup picked, everybody who can be assigned.
  const groupMembers = useAsync(
    () => (form.groupId ? api.get<{ members?: UserRec[] }>(`/assignment-groups/${form.groupId}`).then((g) => g.members ?? []).catch(() => null) : Promise.resolve(null)),
    [form.groupId],
  );
  const assigneeOptions = (() => {
    const base = (form.groupId && groupMembers.data ? groupMembers.data : users.data ?? []).filter((u) => u.isActive !== false);
    const current = mode !== "list" && mode !== "new" && mode.assignedToId ? { userId: mode.assignedToId, fullName: mode.assignedTo } : null;
    return current && !base.some((u) => u.userId === current.userId) && String(current.userId) === form.assignedTo ? [current, ...base] : base;
  })();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const items = data ?? [];
  const q = query.trim().toLowerCase();
  const filtered = items.filter((w) => (!statusF || w.status === statusF) && (!groupF || (groupF === "__none" ? !w.workgroup || w.workgroup === "—" : w.workgroup === groupF)) && (!q || [w.woNumber, w.title, w.workgroup, w.incidentRef ?? ""].some((s) => s.toLowerCase().includes(q))));

  // /work-orders?open=<id> (from the Analyst Dashboard) jumps straight into that work order.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("open"));
    const found = id ? items.find((w) => w.workOrderId === id) : undefined;
    if (found && mode === "list") openEdit(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const openNew = () => { setForm(blank); setFormError(""); setMode("new"); };
  const openEdit = (w: WorkOrderRow) => {
    setForm({ incidentId: w.incidentRef ?? "", requestNumber: w.requestNumber ?? "", priority: w.priority, title: w.title, notes: w.notes, groupId: w.groupId ? String(w.groupId) : "",
      assignedTo: w.assignedToId ? String(w.assignedToId) : "", status: w.status, isActive: w.isActive });
    setFormError(""); setMode(w);
  };

  const save = async () => {
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    if (form.status === "Completed" && !form.assignedTo) { setFormError("Assign this work order to an engineer before completing it."); return; }
    setSaving(true); setFormError("");
    const payload = {
      incidentId: form.incidentId.trim() || null, title: form.title.trim(), notes: form.notes.trim() || null,
      groupId: form.groupId ? Number(form.groupId) : null, assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
      priority: form.priority, status: form.status, isActive: form.isActive,
    };
    try {
      if (mode === "new") await workOrderApi.create(payload);
      else if (mode !== "list") await workOrderApi.update(mode.workOrderId, payload);
      setMode("list"); reload();
    } catch (e) { setFormError(errMsg(e, "Unable to save work order.")); }
    finally { setSaving(false); }
  };

  const header = (
    <div className="page-header-row">
      <div className="page-header-left">
        <div className="breadcrumb">Manage Incidents &gt; Work Order List</div>
        <div className="page-title">Work Order List</div>
        <div className="page-subtitle">Track and update the work orders raised against incidents.</div>
      </div>
      <button className="btn-ghost" onClick={() => window.history.back()}>Close</button>
    </div>
  );

  if (mode !== "list") {
    const editing = mode !== "new";
    return (
      <>
        {header}
        <div className="sub-header">
          <div className="sub-header-title">
            <span style={{ color: "var(--blue)", cursor: "pointer" }} onClick={() => setMode("list")}>&#8592;</span>
            &nbsp; {editing ? `EDIT WORK ORDER ${(mode as WorkOrderRow).woNumber}` : "CREATE WORK ORDER"}
          </div>
          <button className="btn-ghost" onClick={() => setMode("list")}>Back to Work Orders</button>
        </div>
        <div className="page-body">
          <div className="card" style={{ padding: 28 }}>
            <ErrorBar msg={formError} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div className="field-group"><label className="lbl">Related Service Request</label>
                <input className="input" value={form.requestNumber || "—"} readOnly style={{ background: "#F2F4F7" }} /></div>
              <div className="field-group"><label className="lbl">Priority</label>
                <select className="select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {WO_PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>
              {editing && (mode as WorkOrderRow).incidentId && <LinkedIncidentCard incidentId={(mode as WorkOrderRow).incidentId as string} />}
              <div className="field-group" style={{ gridColumn: "1 / -1" }}><label className="lbl">Title <span className="req">*</span></label>
                <input className="input" value={form.title} maxLength={250} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="field-group" style={{ gridColumn: "1 / -1" }}><label className="lbl">Work Details</label>
                <textarea className="textarea" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="field-group"><label className="lbl">Workgroup</label>
                <select className="select" value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value, assignedTo: "" })}>
                  <option value="">— None —</option>{(groups.data ?? []).map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}</select></div>
              <div className="field-group"><label className="lbl">Assigned To</label>
                <select className="select" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                  <option value="">Unassigned</option>{assigneeOptions.map((u) => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}</select></div>
              <div className="field-group"><label className="lbl">Status</label>
                <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {WO_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border-soft)" }}>
              <button className="btn-primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save Changes"}</button>
              <button className="btn-ghost" onClick={() => setMode("list")}>Cancel</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="page-body">
        <ErrorBar msg={error ?? ""} />
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "16px 20px" }}>
            <div className="proto-eyebrow">
              <div className="proto-eyebrow-title"><ClipboardList size={15} aria-hidden="true" /> WORK ORDERS ( {loading ? "…" : items.length} )</div>
              <button className="btn-primary admin-master-add" onClick={openNew}><Plus aria-hidden="true" size={15} /> Create Work Order</button>
            </div>
          </div>
          <div style={{ padding: "0 20px 14px" }}>
            <div className="proto-search-wrap">
              <Search size={14} aria-hidden="true" />
              <input className="proto-search" placeholder="Search by WO number, incident, workgroup…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <select className="select" style={{ maxWidth: 160 }} aria-label="Filter by status" value={statusF} onChange={(e) => setStatusF(e.target.value)}><option value="">All statuses</option>{[...new Set(items.map((w) => w.status))].map((x) => <option key={x}>{x}</option>)}</select>
              <select className="select" style={{ maxWidth: 200 }} aria-label="Filter by workgroup" value={groupF} onChange={(e) => setGroupF(e.target.value)}><option value="">All workgroups</option><option value="__none">No workgroup</option>{[...new Set(items.map((w) => w.workgroup).filter((g) => g && g !== "—"))].map((x) => <option key={x}>{x}</option>)}</select>
            </div>
          </div>
          <div className="admin-master-table-scroll">
            <table style={{ minWidth: 960 }}>
              <thead><tr>
                <th style={{ width: 90 }}>WO #</th><th>WORK ORDER</th><th style={{ width: 180 }}>WORKGROUP</th>
                <th style={{ width: 150 }}>ASSIGNED TO</th><th style={{ width: 130 }}>PRIORITY</th><th style={{ width: 120 }}>STATUS</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="empty-state">Loading…</td></tr>
                  : filtered.length === 0 ? <tr><td colSpan={6} className="empty-state">No work orders found.</td></tr>
                  : filtered.map((w) => (
                    <tr key={w.workOrderId} style={{ opacity: w.isActive ? 1 : 0.6 }}>
                      <td><a href="#" className="wo-link" onClick={(e) => { e.preventDefault(); openEdit(w); }}>{w.woNumber}</a></td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{w.title}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                          {w.incidentId ? <>Linked to <Link to={`/incidents/${w.incidentId}?view=readonly`}>{w.incidentRef}</Link></> : "Not linked to an incident"} · Created {formatDate(w.createdAt)}
                        </div>
                      </td>
                      <td>{w.workgroup}</td><td>{w.assignedTo}</td>
                      <td><PriorityBadge p={w.priority} /></td><td><WoStatusPill s={w.status} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
