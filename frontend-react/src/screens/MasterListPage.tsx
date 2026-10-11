import React, { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { PRIORITY_COLOR_HEX } from "../fieldMeta";
import { ErrorBar, Eyebrow, PageHeader, SearchBox, StatusPill, TH, errMsg, formatDateTime } from "../components/configKit";

type Raw = Record<string, any>;

export interface MasterListConfig {
  path: string;            // API path, e.g. "/on-hold-reasons"
  crumb: string;           // "Configuration > Incident Masters > On Hold Reasons"
  title: string;
  subtitle: string;
  listTitle: string;       // "On Hold Reasons"
  singular: string;        // "On Hold Reason"
  nameLabel: string;       // "On Hold Reason Name"
  searchPlaceholder?: string;
  idKey?: string;          // default "id"
  nameKey?: string;        // default "name"
  orderKey?: string;       // default "displayOrder"
  withSlaImpact?: boolean;
  withRequired?: boolean;  // checklist items: "Required before resolving"
  colorOptions?: string[];
  withSla?: boolean;       // Priority: response / resolution SLA with units
  withVersions?: boolean;  // Status: v-badge + version history
  extraCreate?: Raw;       // constant fields sent on create (e.g. { type: "incident" })
  descriptionHint?: string;
}

type Unit = "Minutes" | "Hours" | "Days";
const MULT: Record<Unit, number> = { Minutes: 1, Hours: 60, Days: 1440 };
function split(m: number | null | undefined): { v: number; u: Unit } {
  if (!m) return { v: 0, u: "Hours" };
  if (m % 1440 === 0) return { v: m / 1440, u: "Days" };
  if (m % 60 === 0) return { v: m / 60, u: "Hours" };
  return { v: m, u: "Minutes" };
}
const fmtSla = (m?: number | null) => { if (!m) return "—"; const { v, u } = split(m); return `${v} ${u === "Minutes" ? "Min" : u === "Hours" ? "Hrs" : "Days"}`; };

interface FormState {
  name: string; description: string; order: number; isActive: boolean; slaImpact: "pause" | "continue"; isRequired: boolean; color: string;
  respV: number; respU: Unit; resoV: number; resoU: Unit;
}
interface Version { versionId: number; version: number; label: string; modifiedBy: string; modifiedAt: string }

export function MasterListPage({ cfg }: { cfg: MasterListConfig }) {
  const idKey = cfg.idKey ?? "id", nameKey = cfg.nameKey ?? "name", orderKey = cfg.orderKey ?? "displayOrder";
  const { data, loading, error, reload } = useAsync(() => api.get<Raw[]>(cfg.path), [cfg.path]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<"new" | Raw | null>(null);
  const blank = (n: number): FormState => ({ name: "", description: "", order: n, isActive: true, slaImpact: "pause", isRequired: false, color: cfg.colorOptions?.[0] ?? "",
    respV: 30, respU: "Minutes", resoV: 8, resoU: "Hours" });
  const [form, setForm] = useState<FormState>(blank(1));
  const [versions, setVersions] = useState<Version[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const items = data ?? [];
  const sorted = useMemo(() => [...items].sort((a, b) => (a[orderKey] ?? 0) - (b[orderKey] ?? 0) || (a[idKey] ?? 0) - (b[idKey] ?? 0)), [items, idKey, orderKey]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((i) => String(i[nameKey] ?? "").toLowerCase().includes(q) || String(i.description ?? "").toLowerCase().includes(q)) : sorted;
  }, [sorted, query, nameKey]);

  const openAdd = () => { setForm(blank(items.length + 1)); setVersions([]); setFormError(""); setEditing("new"); };
  const openEdit = async (i: Raw) => {
    const r = split(i.responseSlaMinutes), s = split(i.resolutionSlaMinutes);
    setForm({
      name: i[nameKey] ?? "", description: i.description ?? "", order: i[orderKey] ?? 0, isActive: i.isActive !== false, slaImpact: i.slaImpact ?? "pause",
      isRequired: !!i.isRequired, color: i.color ?? cfg.colorOptions?.[0] ?? "", respV: r.v || 30, respU: r.v ? r.u : "Minutes", resoV: s.v || 8, resoU: s.v ? s.u : "Hours",
    });
    setFormError(""); setVersions([]); setEditing(i);
    if (cfg.withVersions) { try { setVersions(await api.get<Version[]>(`${cfg.path}/${i[idKey]}/versions`)); } catch { /* history is informational */ } }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError(`${cfg.nameLabel} is required.`); return; }
    const body: Raw = { [nameKey]: form.name.trim(), description: form.description.trim() || null, [orderKey]: Number(form.order) || 0, isActive: form.isActive };
    if (cfg.withSlaImpact) body.slaImpact = form.slaImpact;
    if (cfg.withRequired) body.isRequired = form.isRequired;
    if (cfg.colorOptions) body.color = form.color || null;
    if (cfg.withSla) {
      const resp = Math.round(form.respV * MULT[form.respU]), reso = Math.round(form.resoV * MULT[form.resoU]);
      if (!(resp > 0) || !(reso > 0)) { setFormError("Response and Resolution SLA must be greater than zero."); return; }
      if (resp > reso) { setFormError("Response SLA can never exceed the Resolution SLA."); return; }
      body.responseSlaMinutes = resp; body.resolutionSlaMinutes = reso;
    }
    setSaving(true); setFormError("");
    try {
      if (editing === "new") await api.post(cfg.path, { ...body, ...(cfg.extraCreate ?? {}) });
      else if (editing) await api.patch(`${cfg.path}/${editing[idKey]}`, body);
      setEditing(null); reload();
    } catch (err) { setFormError(errMsg(err, "Unable to save.")); }
    finally { setSaving(false); }
  };

  const originalName = editing && editing !== "new" ? String(editing[nameKey] ?? "") : "";
  const renaming = cfg.withVersions && editing && editing !== "new" && form.name.trim() && form.name.trim() !== originalName;

  if (editing) {
    return (
      <>
        <PageHeader crumb={cfg.crumb} title={cfg.title} subtitle={cfg.subtitle} />
        <div className="page-body">
          <form className="card admin-master-form-panel" onSubmit={save}>
            <div className="admin-master-form-heading">
              <h2>{editing === "new" ? `Add ${cfg.singular}` : `Edit ${cfg.singular}`}</h2>
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>← Back to {cfg.listTitle}</button>
            </div>
            <ErrorBar msg={formError} />
            <div className="admin-master-form-grid">
              {cfg.withVersions && <div className="admin-master-wide" style={{ fontSize: 11, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.5px" }}>STATUS INFORMATION</div>}
              <label className="field-group admin-master-wide">
                <span className="lbl">{cfg.nameLabel} <span className="req">*</span></span>
                <input className="input" value={form.name} maxLength={150} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </label>
              <label className="field-group admin-master-wide">
                <span className="lbl">Description</span>
                <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                {cfg.descriptionHint && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{cfg.descriptionHint}</div>}
              </label>
              {cfg.withSla && (
                <>
                  {([["Response SLA", "respV", "respU", "Time to acknowledge the incident after logging."], ["Resolution SLA", "resoV", "resoU", "Time to fully resolve the incident after logging."]] as const).map(([label, vk, uk, help]) => (
                    <label key={label} className="field-group">
                      <span className="lbl">{label}</span>
                      <span style={{ display: "flex", gap: 6 }}>
                        <input className="input" type="number" min={1} style={{ width: 90 }} value={form[vk]} onChange={(e) => setForm({ ...form, [vk]: Number(e.target.value) })} />
                        <select className="select" style={{ width: 110 }} value={form[uk]} onChange={(e) => setForm({ ...form, [uk]: e.target.value as Unit })}>
                          {(["Minutes", "Hours", "Days"] as const).map((u) => <option key={u}>{u}</option>)}
                        </select>
                      </span>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{help}</div>
                    </label>
                  ))}
                </>
              )}
              <label className="field-group">
                <span className="lbl">Display Order</span>
                <input className="input" type="number" min={0} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
              </label>
              {cfg.colorOptions && (
                <label className="field-group">
                  <span className="lbl">Color</span>
                  <select className="select" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}>
                    {cfg.colorOptions.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              )}
              <div className="field-group">
                <span className="lbl">Status</span>
                <span className="admin-master-check-label">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
                </span>
              </div>
              {cfg.withRequired && (
                <div className="field-group">
                  <span className="lbl">Resolution gate</span>
                  <span className="admin-master-check-label">
                    <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm({ ...form, isRequired: e.target.checked })} /> Required — must be ticked before an incident can be resolved
                  </span>
                </div>
              )}
              {cfg.withSlaImpact && (
                <div className="field-group admin-master-wide">
                  <span className="lbl">Resolution SLA Impact <span className="req">*</span></span>
                  <div style={{ display: "flex", gap: 24 }}>
                    {(["pause", "continue"] as const).map((v) => (
                      <label key={v} className="admin-master-check-label">
                        <input type="radio" name="slaImpact" checked={form.slaImpact === v} onChange={() => setForm({ ...form, slaImpact: v })} />
                        {v === "pause" ? "Pause Resolution SLA" : "Continue Resolution SLA"}
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                    Pause stops the Resolution SLA clock while an incident sits in this state; Continue keeps the clock running. The incident&apos;s Resume SLA action only appears when paused.
                  </div>
                </div>
              )}
              {renaming && (
                <div className="admin-master-wide" style={{ background: "#EFF4FC", border: "1px solid #B2CCFF", color: "#175CD3", borderRadius: 8, padding: "10px 14px", fontSize: 12.5 }}>
                  Saving will rename “{originalName}” → “{form.name.trim()}” and add a new version to the history, recorded under your name.
                </div>
              )}
              {cfg.withVersions && (
                <div className="admin-master-wide">
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.5px", marginBottom: 8 }}>VERSION HISTORY</div>
                  {editing === "new" ? (
                    <div style={{ fontSize: 12.5, color: "var(--muted)" }}>This status doesn’t exist yet — saving will record version 1 as “Created”, tagged with your name and the current date/time.</div>
                  ) : versions.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No history recorded.</div> : versions.map((h) => (
                    <div key={h.versionId} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #F2F4F7", alignItems: "baseline" }}>
                      <span className="chip" style={{ fontSize: 11 }}>v{h.version}</span>
                      <div><div style={{ fontSize: 13, fontWeight: 600 }}>{h.label}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>Modified by {h.modifiedBy} on {formatDateTime(h.modifiedAt)}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="admin-master-form-actions">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
            </div>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader crumb={cfg.crumb} title={cfg.title} subtitle={cfg.subtitle} />
      <div className="page-body">
        <ErrorBar msg={error ?? ""} />
        <div className="card admin-master-table-wrap">
          <Eyebrow
            title={<>{cfg.listTitle} ( {loading ? "…" : items.length} )</>}
            action={<button className="btn-primary admin-master-add" onClick={openAdd}><Plus size={15} aria-hidden="true" /> Add {cfg.singular}</button>}
          />
          <div style={{ padding: "0 20px 14px" }}>
            <SearchBox value={query} onChange={setQuery} placeholder={cfg.searchPlaceholder ?? `Search ${cfg.listTitle.toLowerCase()}…`} />
          </div>
          {loading ? <div className="spinner-row">Loading…</div> : filtered.length === 0 ? (
            <div className="empty-state">{query ? `No ${cfg.listTitle.toLowerCase()} match "${query}".` : `No ${cfg.listTitle.toLowerCase()} yet.`}</div>
          ) : (
            <div style={{ padding: "0 20px 20px" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 44 }} />
                    <th style={TH}>{cfg.singular}</th>
                    {cfg.withSla && <><th style={{ ...TH, width: 120 }}>RESPONSE SLA</th><th style={{ ...TH, width: 120 }}>RESOLUTION SLA</th></>}
                    {cfg.withSlaImpact && <th style={{ ...TH, width: 150 }}>SLA IMPACT</th>}
                    {cfg.withRequired && <th style={{ ...TH, width: 100 }}>REQUIRED</th>}
                    {cfg.colorOptions && <th style={{ ...TH, width: 100 }}>COLOR</th>}
                    <th style={{ ...TH, width: 110 }}>STATUS</th>
                    <th style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i[idKey]}>
                      <td style={{ verticalAlign: "top", paddingTop: 14 }}><div className="numbered-badge">{i[orderKey] ?? 0}</div></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>
                          {i[nameKey]}
                          {cfg.path === "/priority" && i.color && <span aria-label={`${i.color} priority color`} title={`${i.color} priority color`} style={{ display: "inline-block", width: 9, height: 9, marginLeft: 8, borderRadius: "50%", verticalAlign: "middle", background: PRIORITY_COLOR_HEX[i.color] ?? "#98A2B3" }} />}
                          {cfg.withVersions && <span className="chip" style={{ marginLeft: 8, fontSize: 11 }}>v{i.version ?? 1}</span>}
                        </div>
                        {i.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{i.description}</div>}
                      </td>
                      {cfg.withSla && <><td style={{ fontSize: 12.5 }}>{fmtSla(i.responseSlaMinutes)}</td><td style={{ fontSize: 12.5 }}>{fmtSla(i.resolutionSlaMinutes)}</td></>}
                      {cfg.withSlaImpact && <td style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{i.slaImpact === "continue" ? "Continue SLA" : "Pause SLA"}</td>}
                      {cfg.withRequired && <td style={{ fontSize: 12.5 }}>{i.isRequired ? <span className="chip" style={{ fontSize: 11 }}>Required</span> : "—"}</td>}
                      {cfg.colorOptions && (
                        <td style={{ fontSize: 12.5 }}>{i.color ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: PRIORITY_COLOR_HEX[i.color] ?? "#98A2B3" }} />{i.color}</span> : "—"}</td>
                      )}
                      <td><StatusPill active={i.isActive !== false} /></td>
                      <td className="admin-master-actions">
                        <button className="admin-master-icon-button" title="Edit" aria-label={`Edit ${i[nameKey]}`} onClick={() => void openEdit(i)}>
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const IM = "Configuration > Incident Masters >";
const SC = "Configuration > SLA Configurations >";
const COLORS = ["Red", "Amber", "Blue", "Gray", "Green", "Purple"];

export const WoChecklistPage = () => (
  <MasterListPage cfg={{ path: "/wo-checklist-items", crumb: `${IM} Incident Work Order Checklist`, title: "Incident Work Order Checklist", listTitle: "Incident Work Order Checklist", singular: "Checklist Item", nameLabel: "Checklist Item Name", withRequired: true,
    subtitle: "Define the checks an agent must complete before a work order can be created from an incident." }} />
);
export const OnHoldReasonsPage = () => (
  <MasterListPage cfg={{ path: "/on-hold-reasons", crumb: `${IM} On Hold Reasons`, title: "On Hold Reasons", listTitle: "On Hold Reasons", singular: "On Hold Reason", nameLabel: "On Hold Reason Name", withSlaImpact: true,
    subtitle: "Define why an incident is placed On Hold while work is paused." }} />
);
export const ResolutionCodesPage = () => (
  <MasterListPage cfg={{ path: "/resolution-codes", crumb: `${IM} Resolution Code`, title: "Resolution Code", listTitle: "Resolution Codes", singular: "Resolution Code", nameLabel: "Resolution Code Name",
    subtitle: "Define the codes agents choose from when resolving an incident." }} />
);
export const ClosureCodesPage = () => (
  <MasterListPage cfg={{ path: "/closure-codes", idKey: "closureCodeId", nameKey: "closureCodeName", crumb: `${IM} Closure Code`, title: "Closure Code", listTitle: "Closure Codes", singular: "Closure Code", nameLabel: "Closure Code Name",
    subtitle: "Define the codes agents or requesters choose from when closing an incident." }} />
);
export const PendingReasonsPage = () => (
  <MasterListPage cfg={{ path: "/pending-reasons", idKey: "pendingReasonId", nameKey: "pendingReasonName", crumb: `${IM} Pending Reason`, title: "Pending Reason", listTitle: "Pending Reasons", singular: "Pending Reason", nameLabel: "Pending Reason Name", withSlaImpact: true,
    subtitle: "Define why an incident is waiting on the customer or a third party." }} />
);
export const ImpactPage = () => (
  <MasterListPage cfg={{ path: "/impact", idKey: "impactId", nameKey: "impactName", orderKey: "order", crumb: `${SC} Impact`, title: "Impact", listTitle: "Impact Levels", singular: "Impact Level", nameLabel: "Impact Name", colorOptions: COLORS,
    searchPlaceholder: "Search impact levels…", subtitle: "Define how broadly an incident affects the business — used to help derive priority." }} />
);
export const UrgencyPage = () => (
  <MasterListPage cfg={{ path: "/urgency", idKey: "urgencyId", nameKey: "urgencyName", orderKey: "order", crumb: `${SC} Urgency`, title: "Urgency", listTitle: "Urgency Levels", singular: "Urgency Level", nameLabel: "Urgency Name", colorOptions: COLORS,
    searchPlaceholder: "Search urgency levels…", subtitle: "Define how quickly an incident needs attention — used to help derive priority." }} />
);
export const PriorityPage = () => (
  <MasterListPage cfg={{ path: "/priority", idKey: "priorityId", nameKey: "priorityName", orderKey: "order", crumb: `${SC} Priority`, title: "Priority", listTitle: "Priority Levels", singular: "Priority Level", nameLabel: "Priority Name", colorOptions: COLORS, withSla: true,
    searchPlaceholder: "Search priority levels…", subtitle: "Define the priority levels incidents are assigned, typically derived from Impact and Urgency." }} />
);
export const StatusPage = () => (
  <MasterListPage cfg={{ path: "/status", idKey: "statusId", nameKey: "statusName", crumb: "Configuration > Others > Status Configuration", title: "Status Configuration", listTitle: "Statuses", singular: "Status", nameLabel: "Status Name", withVersions: true,
    extraCreate: { type: "incident" }, searchPlaceholder: "Search statuses…",
    subtitle: "Define the incident statuses available across the application. Every rename is versioned and tracks who made the change." }} />
);
