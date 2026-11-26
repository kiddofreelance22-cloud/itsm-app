import React, { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { allNavSections } from "../components/navConfig";
import { ErrorBar, Eyebrow, PageHeader, SearchBox, StatusPill, TH, errMsg } from "../components/configKit";
import { slaApi } from "../configApi";

type Raw = Record<string, any>;
const DAYS = [{ n: 1, l: "Mon" }, { n: 2, l: "Tue" }, { n: 3, l: "Wed" }, { n: 4, l: "Thu" }, { n: 5, l: "Fri" }, { n: 6, l: "Sat" }, { n: 7, l: "Sun" }];
const ZONES = ["UTC", "IST (India)", "EST (US East)", "PST (US West)", "GMT (UK)", "CET (Europe)"];

function daysSummary(days: { day: number; enabled: boolean }[] = []): string {
  const on = DAYS.filter((d) => days.some((x) => x.day === d.n && x.enabled)).map((d) => d.n);
  if (!on.length) return "—";
  if (on.length === 7) return "Every day";
  const runs: string[] = []; let start = on[0], prev = on[0];
  const name = (n: number) => DAYS[n - 1].l;
  for (const n of [...on.slice(1), 99]) {
    if (n !== prev + 1) { runs.push(start === prev ? name(start) : prev - start === 1 ? `${name(start)}, ${name(prev)}` : `${name(start)}–${name(prev)}`); start = n; }
    prev = n;
  }
  return runs.join(", ");
}

// ───────────────────────── SLA Service Window ─────────────────────────
export function SlaServiceWindowPage() {
  const { data, loading, error, reload } = useAsync(() => api.get<Raw[]>("/sla-service-windows"), []);
  const groups = useAsync(() => slaApi.windows(), []);
  const [picked, setPicked] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<"new" | Raw | null>(null);
  const [form, setForm] = useState({ name: "", description: "", days: [1, 2, 3, 4, 5] as number[], start: "09:00", end: "18:00", zone: "UTC", order: 1, active: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const items = useMemo(() => [...(data ?? [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.slaServiceWindowId - b.slaServiceWindowId), [data]);
  const filtered = items.filter((i) => !query.trim() || String(i.slaName).toLowerCase().includes(query.trim().toLowerCase()));

  const openAdd = () => { setForm({ name: "", description: "", days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00", zone: "UTC", order: items.length + 1, active: true }); setFormError(""); setPicked([]); setEditing("new"); };
  const openEdit = (i: Raw) => {
    const on = (i.serviceWindow ?? []).filter((d: Raw) => d.enabled);
    setForm({ name: i.slaName, description: i.description ?? "", days: on.map((d: Raw) => d.day), start: on[0]?.from ?? "09:00", end: on[0]?.to ?? "18:00",
      zone: ZONES.includes(i.timeZone) ? i.timeZone : i.timeZone || "UTC", order: i.displayOrder ?? 0, active: i.isActive !== false });
    setFormError(""); setPicked((groups.data ?? []).filter((g) => g.slaServiceWindowId === i.slaServiceWindowId).map((g) => g.groupId)); setEditing(i);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Service Window Name is required."); return; }
    if (!form.days.length) { setFormError("Pick at least one active day."); return; }
    if (form.end <= form.start) { setFormError("End Time must be after Start Time."); return; }
    setSaving(true); setFormError("");
    const body = {
      slaName: form.name.trim(), description: form.description.trim() || null, timeZone: form.zone, displayOrder: Number(form.order) || 0, isActive: form.active,
      serviceWindow: DAYS.map((d) => ({ day: d.n, enabled: form.days.includes(d.n), from: form.start, to: form.end })),
    };
    try {
      let windowId: number | null = null;
      if (editing === "new") windowId = (await api.post<Raw>("/sla-service-windows", body)).slaServiceWindowId ?? null;
      else if (editing) { await api.patch(`/sla-service-windows/${editing.slaServiceWindowId}`, body); windowId = editing.slaServiceWindowId; }
      if (windowId != null) {
        // A workgroup uses one window at a time: ticking it moves it here, unticking leaves it with none.
        const before = (groups.data ?? []).filter((g) => g.slaServiceWindowId === windowId).map((g) => g.groupId);
        for (const gid of picked.filter((x) => !before.includes(x))) await slaApi.setWindow(gid, { slaServiceWindowId: windowId });
        for (const gid of before.filter((x) => !picked.includes(x))) await slaApi.setWindow(gid, { slaServiceWindowId: null });
        groups.reload();
      }
      setEditing(null); reload();
    } catch (err) { setFormError(errMsg(err, "Unable to save.")); }
    finally { setSaving(false); }
  };

  const crumb = "Configuration > Incident SLA Configurations > SLA Service Window";
  const subtitle = "Define named business-hour calendars (days, times, timezone) that can be assigned to workgroups to control when the SLA clock runs.";

  if (editing) {
    return (
      <>
        <PageHeader crumb={crumb} title="SLA Service Window" subtitle={subtitle} />
        <div className="page-body">
          <form className="card admin-master-form-panel" onSubmit={save}>
            <div className="admin-master-form-heading">
              <h2>{editing === "new" ? "Add Service Window" : "Edit Service Window"}</h2>
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>← Back to SLA Service Windows</button>
            </div>
            <ErrorBar msg={formError} />
            <div className="admin-master-form-grid">
              <label className="field-group admin-master-wide"><span className="lbl">Service Window Name <span className="req">*</span></span>
                <input className="input" value={form.name} maxLength={150} autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="field-group admin-master-wide"><span className="lbl">Description</span>
                <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <div className="field-group admin-master-wide"><span className="lbl">Days Active</span>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {DAYS.map((d) => (
                    <label key={d.n} className="admin-master-check-label">
                      <input type="checkbox" checked={form.days.includes(d.n)} onChange={(e) => setForm({ ...form, days: e.target.checked ? [...form.days, d.n] : form.days.filter((x) => x !== d.n) })} /> {d.l}
                    </label>
                  ))}
                </div></div>
              <label className="field-group"><span className="lbl">Start Time</span>
                <input className="input" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
              <label className="field-group"><span className="lbl">End Time</span>
                <input className="input" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
              <label className="field-group"><span className="lbl">Timezone</span>
                <select className="select" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}>
                  {[...new Set([...ZONES, form.zone])].map((z) => <option key={z}>{z}</option>)}</select></label>
              <div className="field-group admin-master-wide"><span className="lbl">Workgroups on this window</span>
                <div style={{ border: "1px solid #E4E7EC", borderRadius: 8, padding: "8px 12px", maxHeight: 190, overflowY: "auto", display: "grid", gap: 4 }}>
                  {(groups.data ?? []).length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>No workgroups yet.</span>}
                  {(groups.data ?? []).map((g) => {
                    const here = editing && editing !== "new" ? g.slaServiceWindowId === editing.slaServiceWindowId : false;
                    const other = g.slaServiceWindowId != null && !here ? items.find((w) => w.slaServiceWindowId === g.slaServiceWindowId)?.slaName : null;
                    return (
                      <label key={g.groupId} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                        <input type="checkbox" checked={picked.includes(g.groupId)} onChange={(e) => setPicked(e.target.checked ? [...picked, g.groupId] : picked.filter((x) => x !== g.groupId))} />
                        {g.workgroupName}
                        {other && <span style={{ fontSize: 12, color: picked.includes(g.groupId) ? "#B54708" : "var(--muted)" }}>{picked.includes(g.groupId) ? `moves from ${other}` : `on ${other}`}</span>}
                      </label>);
                  })}
                </div>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>A workgroup uses one window at a time, so ticking it here moves it off its current window.</span></div>
              <label className="field-group"><span className="lbl">Display Order</span>
                <input className="input" type="number" min={0} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} /></label>
              <div className="field-group"><span className="lbl">Status</span>
                <span className="admin-master-check-label"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</span></div>
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
      <PageHeader crumb={crumb} title="SLA Service Window" subtitle={subtitle} />
      <div className="page-body">
        <ErrorBar msg={error ?? ""} />
        <div className="card admin-master-table-wrap">
          <Eyebrow title={<>SLA Service Windows ( {loading ? "…" : items.length} )</>}
            action={<button className="btn-primary admin-master-add" onClick={openAdd}><Plus size={15} aria-hidden="true" /> Add Service Window</button>} />
          <div style={{ padding: "0 20px 14px" }}><SearchBox value={query} onChange={setQuery} placeholder="Search service windows…" /></div>
          {loading ? <div className="spinner-row">Loading…</div> : filtered.length === 0 ? (
            <div className="empty-state">{query ? `No service windows match "${query}".` : "No service windows yet."}</div>
          ) : (
            <div style={{ padding: "0 20px 20px" }}>
              <table>
                <thead><tr><th style={{ width: 44 }} /><th style={TH}>Service Window</th><th style={{ ...TH, width: 160 }}>Days</th><th style={{ ...TH, width: 200 }}>Time</th><th style={{ ...TH, width: 200 }}>Workgroups</th><th style={{ ...TH, width: 110 }}>Status</th><th style={{ width: 44 }} /></tr></thead>
                <tbody>
                  {filtered.map((i) => {
                    const first = (i.serviceWindow ?? []).find((d: Raw) => d.enabled);
                    return (
                      <tr key={i.slaServiceWindowId}>
                        <td style={{ verticalAlign: "top", paddingTop: 14 }}><div className="numbered-badge">{i.displayOrder ?? 0}</div></td>
                        <td><div style={{ fontWeight: 600, fontSize: 13 }}>{i.slaName}</div>{i.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{i.description}</div>}</td>
                        <td style={{ fontSize: 12.5 }}>{daysSummary(i.serviceWindow)}</td>
                        <td style={{ fontSize: 12.5 }}>{first ? `${first.from} – ${first.to} ${i.timeZone}` : "—"}</td>
                        <td style={{ fontSize: 12.5 }}>{(() => { const on = (groups.data ?? []).filter((g) => g.slaServiceWindowId === i.slaServiceWindowId); return on.length ? <>{on.length}<span style={{ color: "var(--muted)" }}> {"\u00b7"} {on.map((g) => g.workgroupName).join(", ")}</span></> : <span style={{ color: "var(--muted)" }}>None</span>; })()}</td>
                        <td><StatusPill active={i.isActive !== false} /></td>
                        <td className="admin-master-actions"><button className="admin-master-icon-button" aria-label={`Edit ${i.slaName}`} onClick={() => openEdit(i)}><Pencil size={15} aria-hidden="true" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ───────────────────────── Request SLA Service Window (Service Requests) ─────────────────────────
export function RequestSlaServiceWindowPage() {
  const { data, loading, error, reload } = useAsync(() => api.get<Raw[]>("/request-sla-service-windows"), []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<"new" | Raw | null>(null);
  const [form, setForm] = useState({ name: "", description: "", days: [1, 2, 3, 4, 5] as number[], start: "09:00", end: "18:00", zone: "UTC", order: 1, is24x7: false, isDefault: false, active: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const items = useMemo(() => [...(data ?? [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.slaServiceWindowId - b.slaServiceWindowId), [data]);
  const filtered = items.filter((i) => !query.trim() || String(i.slaName).toLowerCase().includes(query.trim().toLowerCase()));

  const openAdd = () => { setForm({ name: "", description: "", days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00", zone: "UTC", order: items.length + 1, is24x7: false, isDefault: false, active: true }); setFormError(""); setEditing("new"); };
  const openEdit = (i: Raw) => {
    const on = (i.serviceWindow ?? []).filter((d: Raw) => d.enabled);
    setForm({ name: i.slaName, description: i.description ?? "", days: on.map((d: Raw) => d.day), start: on[0]?.from ?? "09:00", end: on[0]?.to ?? "18:00",
      zone: ZONES.includes(i.timeZone) ? i.timeZone : i.timeZone || "UTC", order: i.displayOrder ?? 0, is24x7: !!i.is24x7, isDefault: !!i.isDefault, active: i.isActive !== false });
    setFormError(""); setEditing(i);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Service Window Name is required."); return; }
    if (!form.is24x7 && !form.days.length) { setFormError("Pick at least one active day."); return; }
    if (!form.is24x7 && form.end <= form.start) { setFormError("End Time must be after Start Time."); return; }
    setSaving(true); setFormError("");
    const body = {
      slaName: form.name.trim(), description: form.description.trim() || null, timeZone: form.zone, displayOrder: Number(form.order) || 0,
      is24x7: form.is24x7, isDefault: form.isDefault, isActive: form.active,
      serviceWindow: DAYS.map((d) => ({ day: d.n, enabled: form.days.includes(d.n), from: form.start, to: form.end })),
    };
    try {
      if (editing === "new") await api.post<Raw>("/request-sla-service-windows", body);
      else if (editing) await api.patch(`/request-sla-service-windows/${editing.slaServiceWindowId}`, body);
      setEditing(null); reload();
    } catch (err) { setFormError(errMsg(err, "Unable to save.")); }
    finally { setSaving(false); }
  };

  const crumb = "Configuration > Service SLA Configurations > Service SLA Window";
  const subtitle = "Define named business-hour calendars (days, times, timezone) used for calculating Service Request delivery SLA targets. Separate from incident SLA service windows.";

  if (editing) {
    return (
      <>
        <PageHeader crumb={crumb} title="Service Request SLA Window" subtitle={subtitle} />
        <div className="page-body">
          <form className="card admin-master-form-panel" onSubmit={save}>
            <div className="admin-master-form-heading">
              <h2>{editing === "new" ? "Add Service Window" : "Edit Service Window"}</h2>
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>← Back to Service Windows</button>
            </div>
            <ErrorBar msg={formError} />
            <div className="admin-master-form-grid">
              <label className="field-group admin-master-wide"><span className="lbl">Service Window Name <span className="req">*</span></span>
                <input className="input" value={form.name} maxLength={150} autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="field-group admin-master-wide"><span className="lbl">Description</span>
                <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <div className="field-group admin-master-wide">
                <label className="admin-master-check-label">
                  <input type="checkbox" checked={form.is24x7} onChange={(e) => setForm({ ...form, is24x7: e.target.checked })} /> <strong>24x7 Window (always running, no calendar pauses)</strong>
                </label>
              </div>
              {!form.is24x7 && (
                <>
                  <div className="field-group admin-master-wide"><span className="lbl">Days Active</span>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {DAYS.map((d) => (
                        <label key={d.n} className="admin-master-check-label">
                          <input type="checkbox" checked={form.days.includes(d.n)} onChange={(e) => setForm({ ...form, days: e.target.checked ? [...form.days, d.n] : form.days.filter((x) => x !== d.n) })} /> {d.l}
                        </label>
                      ))}
                    </div></div>
                  <label className="field-group"><span className="lbl">Start Time</span>
                    <input className="input" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
                  <label className="field-group"><span className="lbl">End Time</span>
                    <input className="input" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
                </>
              )}
              <label className="field-group"><span className="lbl">Timezone</span>
                <select className="select" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}>
                  {[...new Set([...ZONES, form.zone])].map((z) => <option key={z}>{z}</option>)}</select></label>
              <label className="field-group"><span className="lbl">Display Order</span>
                <input className="input" type="number" min={0} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} /></label>
              <div className="field-group"><span className="lbl">Default</span>
                <span className="admin-master-check-label"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default for requests without a specific SLA</span></div>
              <div className="field-group"><span className="lbl">Status</span>
                <span className="admin-master-check-label"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</span></div>
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
      <PageHeader crumb={crumb} title="Service Request SLA Window" subtitle={subtitle} />
      <div className="page-body">
        <ErrorBar msg={error ?? ""} />
        <div className="card admin-master-table-wrap">
          <Eyebrow title={<>Service Request SLA Windows ( {loading ? "…" : items.length} )</>}
            action={<button className="btn-primary admin-master-add" onClick={openAdd}><Plus size={15} aria-hidden="true" /> Add Service Window</button>} />
          <div style={{ padding: "0 20px 14px" }}><SearchBox value={query} onChange={setQuery} placeholder="Search service windows…" /></div>
          {loading ? <div className="spinner-row">Loading…</div> : filtered.length === 0 ? (
            <div className="empty-state">{query ? `No service windows match "${query}".` : "No service windows yet."}</div>
          ) : (
            <div style={{ padding: "0 20px 20px" }}>
              <table>
                <thead><tr><th style={{ width: 44 }} /><th style={TH}>Service Window</th><th style={{ ...TH, width: 160 }}>Days</th><th style={{ ...TH, width: 200 }}>Time</th><th style={{ ...TH, width: 100 }}>Default</th><th style={{ ...TH, width: 110 }}>Status</th><th style={{ width: 44 }} /></tr></thead>
                <tbody>
                  {filtered.map((i) => {
                    const first = (i.serviceWindow ?? []).find((d: Raw) => d.enabled);
                    return (
                      <tr key={i.slaServiceWindowId}>
                        <td style={{ verticalAlign: "top", paddingTop: 14 }}><div className="numbered-badge">{i.displayOrder ?? 0}</div></td>
                        <td><div style={{ fontWeight: 600, fontSize: 13 }}>{i.slaName}</div>{i.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{i.description}</div>}</td>
                        <td style={{ fontSize: 12.5 }}>{i.is24x7 ? "24x7 (All days)" : daysSummary(i.serviceWindow)}</td>
                        <td style={{ fontSize: 12.5 }}>{i.is24x7 ? `Continuous (${i.timeZone})` : first ? `${first.from} – ${first.to} ${i.timeZone}` : "—"}</td>
                        <td style={{ fontSize: 12.5 }}>{i.isDefault ? <span className="pill pill-blue">Default</span> : "—"}</td>
                        <td><StatusPill active={i.isActive !== false} /></td>
                        <td className="admin-master-actions"><button className="admin-master-icon-button" aria-label={`Edit ${i.slaName}`} onClick={() => openEdit(i)}><Pencil size={15} aria-hidden="true" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ───────────────────────── Roles ─────────────────────────
interface NavRow { navKey: string; visible: boolean; canCreate: boolean }
const NAV_LABEL: Record<string, string> = Object.fromEntries(allNavSections().flatMap((s) => s.items.map((i) => [i.to, i.label])));

export function RolesPage() {
  const roles = useAsync(() => api.get<Raw[]>("/roles"), []);
  const [counts, setCounts] = useState<Record<number, string[]>>({});
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<"new" | Raw | null>(null);
  const [form, setForm] = useState({ name: "", description: "", order: 1, active: true });
  const [perm, setPerm] = useState<Record<string, NavRow>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const sections = useMemo(() => allNavSections(), []);

  // Chips on the list come from each role's saved navigation access.
  const loadChips = async (list: Raw[]) => {
    const out: Record<number, string[]> = {};
    await Promise.all(list.map(async (r) => {
      try { const rows = await api.get<NavRow[]>(`/roles/${r.roleId}/navigation`); out[r.roleId] = rows.filter((x) => x.visible).map((x) => NAV_LABEL[x.navKey] ?? x.navKey); }
      catch { out[r.roleId] = []; }
    }));
    setCounts(out);
  };
  React.useEffect(() => { if (roles.data) void loadChips(roles.data); }, [roles.data]);

  const items = useMemo(() => [...(roles.data ?? [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.roleId - b.roleId), [roles.data]);
  const filtered = items.filter((r) => !query.trim() || String(r.roleName).toLowerCase().includes(query.trim().toLowerCase()));

  const openEdit = async (r: "new" | Raw) => {
    setFormError(""); setEditing(r);
    const base: Record<string, NavRow> = {};
    sections.forEach((s) => s.items.forEach((i) => { base[i.to] = { navKey: i.to, visible: false, canCreate: false }; }));
    if (r === "new") { setForm({ name: "", description: "", order: items.length + 1, active: true }); setPerm(base); return; }
    setForm({ name: r.roleName, description: r.description ?? "", order: r.displayOrder ?? 0, active: r.isActive !== false });
    setPerm(base);
    try { const rows = await api.get<NavRow[]>(`/roles/${r.roleId}/navigation`); const m = { ...base }; rows.forEach((x) => { if (m[x.navKey]) m[x.navKey] = { navKey: x.navKey, visible: !!x.visible, canCreate: !!x.canCreate }; }); setPerm(m); } catch { /* start empty */ }
  };

  const setRow = (key: string, patch: Partial<NavRow>) => setPerm((p) => {
    const cur = p[key], next = { ...cur, ...patch };
    if (patch.canCreate) next.visible = true;            // editing implies seeing
    if (patch.visible === false) next.canCreate = false;  // hiding removes edit
    return { ...p, [key]: next };
  });
  const setSection = (items: { to: string }[], visible: boolean) => setPerm((p) => {
    const m = { ...p }; items.forEach((i) => { m[i.to] = { navKey: i.to, visible, canCreate: visible ? m[i.to].canCreate : false }; }); return m;
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Role Name is required."); return; }
    setSaving(true); setFormError("");
    try {
      const body = { roleName: form.name.trim(), description: form.description.trim() || undefined, displayOrder: Number(form.order) || 0, isActive: form.active };
      const saved = editing === "new" ? await api.post<Raw>("/roles", body) : await api.patch<Raw>(`/roles/${(editing as Raw).roleId}`, body);
      await api.put(`/roles/${saved.roleId}/navigation`, { rows: Object.values(perm).filter((r) => r.visible || r.canCreate).map((r) => ({ navKey: r.navKey, visible: !!r.visible, canCreate: !!r.canCreate })) });
      setEditing(null); roles.reload();
    } catch (err) { setFormError(errMsg(err, "Unable to save.")); }
    finally { setSaving(false); }
  };

  const crumb = "Configuration > User Management > Roles";
  const subtitle = "Create and configure the roles users can be assigned, and what each one can access.";

  if (editing) {
    return (
      <>
        <PageHeader crumb={crumb} title="Roles" subtitle={subtitle} />
        <div className="page-body">
          <form className="card admin-master-form-panel" onSubmit={save}>
            <div className="admin-master-form-heading">
              <h2>{editing === "new" ? "Add Role" : "Edit Role"}</h2>
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>← Back to Roles</button>
            </div>
            <ErrorBar msg={formError} />
            <div className="admin-master-form-grid">
              <label className="field-group admin-master-wide"><span className="lbl">Role Name <span className="req">*</span></span>
                <input className="input" value={form.name} maxLength={100} autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="field-group admin-master-wide"><span className="lbl">Description</span>
                <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <label className="field-group"><span className="lbl">Display Order</span>
                <input className="input" type="number" min={0} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} /></label>
              <div className="field-group"><span className="lbl">Status</span>
                <span className="admin-master-check-label"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</span></div>

              <div className="admin-master-wide">
                <div style={{ fontSize: 11, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.5px", marginBottom: 6 }}>NAVIGATION ACCESS</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
                  Choose which items in the left navigation this role can see (Visible), and which of those they can also create/edit on (Edit). Every screen in Meridian&apos;s navigation is listed below.
                  Leave everything unticked to keep the built-in menu for this role.
                </div>
                <table>
                  <thead><tr><th style={TH}>Navigation Item</th><th style={{ ...TH, width: 90, textAlign: "center" }}>Visible</th><th style={{ ...TH, width: 90, textAlign: "center" }}>Edit</th></tr></thead>
                  <tbody>
                    {sections.map((sec) => (
                      <React.Fragment key={sec.title}>
                        <tr><td colSpan={3} style={{ background: "#F9FAFB", fontWeight: 700, fontSize: 12, padding: "8px 12px" }}>
                          {sec.title}
                          <button type="button" className="btn-ghost btn-sm" style={{ marginLeft: 12 }} onClick={() => setSection(sec.items, true)}>All</button>
                          <button type="button" className="btn-ghost btn-sm" style={{ marginLeft: 4 }} onClick={() => setSection(sec.items, false)}>None</button>
                        </td></tr>
                        {sec.items.map((it) => (
                          <tr key={it.to}>
                            <td style={{ paddingLeft: 24, fontSize: 13 }}>{it.label}</td>
                            <td style={{ textAlign: "center" }}><input type="checkbox" checked={perm[it.to]?.visible ?? false} onChange={(e) => setRow(it.to, { visible: e.target.checked })} /></td>
                            <td style={{ textAlign: "center" }}><input type="checkbox" checked={perm[it.to]?.canCreate ?? false} onChange={(e) => setRow(it.to, { canCreate: e.target.checked })} /></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
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
      <PageHeader crumb={crumb} title="Roles" subtitle={subtitle} />
      <div className="page-body">
        <ErrorBar msg={roles.error ?? ""} />
        <div className="card admin-master-table-wrap">
          <Eyebrow title={<>Roles ( {roles.loading ? "…" : items.length} )</>}
            action={<button className="btn-primary admin-master-add" onClick={() => void openEdit("new")}><Plus size={15} aria-hidden="true" /> Add Role</button>} />
          <div style={{ padding: "0 20px 14px" }}><SearchBox value={query} onChange={setQuery} placeholder="Search roles…" /></div>
          {roles.loading ? <div className="spinner-row">Loading…</div> : filtered.length === 0 ? <div className="empty-state">{query ? `No roles match "${query}".` : "No roles yet."}</div> : (
            <div style={{ padding: "0 20px 20px" }}>
              <table>
                <thead><tr><th style={{ width: 44 }} /><th style={TH}>Role</th><th style={TH}>Permissions</th><th style={{ ...TH, width: 80 }}>Users</th><th style={{ ...TH, width: 110 }}>Status</th><th style={{ width: 44 }} /></tr></thead>
                <tbody>
                  {filtered.map((r) => {
                    const chips = counts[r.roleId] ?? [];
                    return (
                      <tr key={r.roleId}>
                        <td style={{ verticalAlign: "top", paddingTop: 14 }}><div className="numbered-badge">{r.displayOrder ?? 0}</div></td>
                        <td><div style={{ fontWeight: 600, fontSize: 13 }}>{r.roleName}</div>{r.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{r.description}</div>}</td>
                        <td>{chips.length === 0 ? <span style={{ color: "var(--muted)", fontSize: 12 }}>No permissions granted</span> : (
                          <>{chips.slice(0, 3).map((c) => <span key={c} className="chip" style={{ marginRight: 4, fontSize: 11 }}>{c}</span>)}
                            {chips.length > 3 && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>+{chips.length - 3} more</span>}</>)}</td>
                        <td style={{ fontSize: 12.5 }}>{r.userCount ?? 0}</td>
                        <td><StatusPill active={r.isActive !== false} /></td>
                        <td className="admin-master-actions"><button className="admin-master-icon-button" aria-label={`Edit ${r.roleName}`} onClick={() => void openEdit(r)}><Pencil size={15} aria-hidden="true" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
