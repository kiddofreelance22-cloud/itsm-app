import React, { useState } from "react";
import { Link } from "../router";
import { api } from "../api";
import { SlaMatrixRow, slaApi } from "../configApi";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, StatusPill, TH, errMsg } from "../components/configKit";

type Unit = "Minutes" | "Hours" | "Days";
const MULT: Record<Unit, number> = { Minutes: 1, Hours: 60, Days: 1440 };
const toMinutes = (v: number, u: Unit) => Math.round(v * MULT[u]);
/** Pick the largest unit that divides evenly, so 120 min shows as "2 Hours". */
function fromMinutes(m: number): { value: number; unit: Unit } {
  if (m % 1440 === 0) return { value: m / 1440, unit: "Days" };
  if (m % 60 === 0) return { value: m / 60, unit: "Hours" };
  return { value: m, unit: "Minutes" };
}
const fmt = (m: number | null) => { if (m == null) return "—"; const { value, unit } = fromMinutes(m); return `${value} ${unit === "Minutes" ? "Min" : unit === "Hours" ? "Hrs" : "Days"}`; };

interface Opt { id: number; label: string }
interface PriorityRec { priorityId: number; priorityName: string; responseSlaMinutes?: number | null; resolutionSlaMinutes?: number | null }
interface GroupRec { groupId: number; groupName: string }

// ───────────────────────── SLA Matrix ─────────────────────────
export function SlaMatrixPage() {
  const matrix = useAsync(() => slaApi.matrix(), []);
  const groups = useAsync(() => api.get<GroupRec[]>("/assignment-groups"), []);
  const priorities = useAsync(() => api.get<PriorityRec[]>("/priority"), []);
  const [wg, setWg] = useState(""); const [pri, setPri] = useState("");
  const [rv, setRv] = useState(30); const [ru, setRu] = useState<Unit>("Minutes");
  const [sv, setSv] = useState(4); const [su, setSu] = useState<Unit>("Hours");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const wgOpts: Opt[] = (groups.data ?? []).map((g) => ({ id: g.groupId, label: g.groupName }));
  const priOpts = priorities.data ?? [];
  const selWg = wg || String(wgOpts[0]?.id ?? "");
  const selPri = pri || String(priOpts[0]?.priorityId ?? "");
  const selPriRec = priOpts.find((p) => String(p.priorityId) === selPri);
  const rows = matrix.data ?? [];

  const add = async () => {
    setErr("");
    const response = toMinutes(rv, ru), resolution = toMinutes(sv, su);
    if (!selWg || !selPri) { setErr("Pick a workgroup and a priority."); return; }
    if (!(rv > 0) || !(sv > 0)) { setErr("Response and Resolution SLA must be greater than zero."); return; }
    if (response > resolution) { setErr("Response SLA can never cross (exceed) the Resolution SLA."); return; }
    setBusy(true);
    try { await slaApi.addMatrix({ groupId: Number(selWg), priorityId: Number(selPri), responseMinutes: response, resolutionMinutes: resolution }); matrix.reload(); }
    catch (e) { setErr(errMsg(e, "Unable to add combination.")); }
    finally { setBusy(false); }
  };

  const patch = async (r: SlaMatrixRow, p: Parameters<typeof slaApi.updateMatrix>[1]) => {
    setErr("");
    try { await slaApi.updateMatrix(r.slaMatrixId, p); matrix.reload(); }
    catch (e) { setErr(errMsg(e, "Unable to update.")); matrix.reload(); }
  };
  const remove = async (r: SlaMatrixRow) => {
    if (!window.confirm(`Remove the ${r.workgroupName} + ${r.priorityName} override?`)) return;
    try { await slaApi.removeMatrix(r.slaMatrixId); matrix.reload(); } catch (e) { setErr(errMsg(e)); }
  };

  return (
    <>
      <PageHeader crumb="Configuration > SLA Configurations > SLA Matrix" title="SLA Matrix"
        subtitle="Override the default Response/Resolution SLA for a specific Workgroup + Priority combination. Each Workgroup + Priority pair can only be mapped once, and the Response SLA can never cross (exceed) the Resolution SLA." />
      <div className="page-body">
        <ErrorBar msg={matrix.error ?? err} />
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "24px 20px 20px", display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label className="field-group" style={{ width: 220, margin: 0 }}><span className="lbl" style={{ marginBottom: 6 }}>Workgroup</span>
              <select className="select" value={selWg} onChange={(e) => setWg(e.target.value)}>{wgOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
            <label className="field-group" style={{ width: 200, margin: 0 }}><span className="lbl" style={{ marginBottom: 6 }}>Priority</span>
              <select className="select" value={selPri} onChange={(e) => setPri(e.target.value)}>{priOpts.map((o) => <option key={o.priorityId} value={o.priorityId}>{o.priorityName}</option>)}</select>
              {selPriRec && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>Default: {fmt(selPriRec.responseSlaMinutes ?? null)} / {fmt(selPriRec.resolutionSlaMinutes ?? null)}</div>}</label>
            {([["Response SLA", rv, setRv, ru, setRu], ["Resolution SLA", sv, setSv, su, setSu]] as const).map(([label, v, setV, u, setU]) => (
              <label key={label} className="field-group" style={{ margin: 0 }}><span className="lbl" style={{ marginBottom: 6 }}>{label}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  <input className="input" type="number" min={1} style={{ width: 80 }} value={v} onChange={(e) => setV(Number(e.target.value))} />
                  <select className="select" style={{ width: 100 }} value={u} onChange={(e) => setU(e.target.value as Unit)}>
                    {(["Minutes", "Hours", "Days"] as const).map((x) => <option key={x}>{x}</option>)}</select>
                </span></label>
            ))}
            <button className="btn-primary" disabled={busy} onClick={add}>Add Combination</button>
          </div>

          {matrix.loading ? <div className="spinner-row">Loading…</div> : rows.length === 0 ? (
            <div className="empty-state">No workgroup overrides added yet. Pick a Workgroup and Priority above, set the Response/Resolution SLA, then click Add Combination.</div>
          ) : (
            <div style={{ padding: "0 20px 20px" }}>
              <table>
                <thead><tr>
                  <th style={TH}>Workgroup</th><th style={TH}>Priority</th><th style={TH}>Response SLA</th><th style={TH}>Resolution SLA</th>
                  <th style={TH}>vs. Priority Default</th><th style={TH}>Active</th><th style={{ width: 44 }} />
                </tr></thead>
                <tbody>
                  {rows.map((r) => <SlaRow key={`${r.slaMatrixId}:${r.responseMinutes}:${r.resolutionMinutes}`} r={r} onPatch={patch} onRemove={remove} />)}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: "0 20px 20px", display: "flex", gap: 16, fontSize: 13 }}>
            <Link to="/config/admin/workgroups">Manage Workgroups</Link>
            <Link to="/config/admin/priority">Edit Default Priority SLA</Link>
          </div>
        </div>
      </div>
    </>
  );
}

function SlaRow({ r, onPatch, onRemove }: { r: SlaMatrixRow; onPatch: (r: SlaMatrixRow, p: { responseMinutes?: number; resolutionMinutes?: number; isActive?: boolean }) => void; onRemove: (r: SlaMatrixRow) => void }) {
  const [rsp, setRsp] = useState(fromMinutes(r.responseMinutes));
  const [res, setRes] = useState(fromMinutes(r.resolutionMinutes));
  const commit = () => {
    const a = toMinutes(rsp.value, rsp.unit), b = toMinutes(res.value, res.unit);
    if (a !== r.responseMinutes || b !== r.resolutionMinutes) onPatch(r, { responseMinutes: a, resolutionMinutes: b });
  };
  const cell = (st: { value: number; unit: Unit }, set: (v: { value: number; unit: Unit }) => void) => (
    <span style={{ display: "flex", gap: 4 }}>
      <input className="input" type="number" min={1} style={{ width: 70 }} value={st.value} onChange={(e) => set({ ...st, value: Number(e.target.value) })} onBlur={commit} />
      <select className="select" style={{ width: 84 }} value={st.unit} onChange={(e) => set({ ...st, unit: e.target.value as Unit })} onBlur={commit}>
        <option value="Minutes">Min</option><option value="Hours">Hrs</option><option value="Days">Days</option></select>
    </span>
  );
  const diff = r.defaultResolutionMinutes == null ? null : r.resolutionMinutes - r.defaultResolutionMinutes;
  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{r.workgroupName}</td>
      <td>{r.priorityName}</td>
      <td>{cell(rsp, setRsp)}</td>
      <td>{cell(res, setRes)}</td>
      <td style={{ fontSize: 12.5, color: diff == null || diff === 0 ? "var(--muted)" : diff < 0 ? "#067647" : "#B54708" }}>
        {diff == null ? "No default" : diff === 0 ? "Same as default" : `${diff < 0 ? "Faster" : "Slower"} by ${fmt(Math.abs(diff))}`}
      </td>
      <td><label className="admin-master-check-label"><input type="checkbox" checked={r.isActive} onChange={(e) => onPatch(r, { isActive: e.target.checked })} /> {r.isActive ? "Active" : "Inactive"}</label></td>
      <td><button className="admin-master-icon-button danger" aria-label="Remove" onClick={() => onRemove(r)}>✕</button></td>
    </tr>
  );
}

// ───────────────────────── Workgroup SLA Window ─────────────────────────
interface WindowRec { slaServiceWindowId: number; slaName: string }

export function WorkgroupSlaPage() {
  const rows = useAsync(() => slaApi.windows(), []);
  const windows = useAsync(() => api.get<WindowRec[]>("/sla-service-windows"), []);
  const [err, setErr] = useState("");

  const set = async (groupId: number, p: { slaServiceWindowId?: number | null; isActive?: boolean }) => {
    setErr("");
    try { await slaApi.setWindow(groupId, p); rows.reload(); }
    catch (e) { setErr(errMsg(e, "Unable to save.")); rows.reload(); }
  };

  return (
    <>
      <PageHeader crumb="Configuration > SLA Configurations > Workgroup SLA Window" title="Workgroup SLA Window"
        subtitle="Assign each workgroup the business-hours calendar (Service Window) its SLA clock should follow." />
      <div className="page-body">
        <ErrorBar msg={rows.error ?? windows.error ?? err} />
        <div className="card admin-master-table-wrap">
          {rows.loading ? <div className="spinner-row">Loading…</div> : (rows.data ?? []).length === 0 ? <div className="empty-state">No workgroups yet.</div> : (
            <div style={{ padding: "24px 20px 20px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={{ ...TH, paddingBottom: 16, textAlign: "left", color: "#667085", borderBottom: "1px solid #EDEFF2" }}>WORKGROUP</th>
                  <th style={{ ...TH, paddingBottom: 16, textAlign: "left", color: "#667085", borderBottom: "1px solid #EDEFF2" }}>MANAGER</th>
                  <th style={{ ...TH, paddingBottom: 16, textAlign: "left", color: "#667085", borderBottom: "1px solid #EDEFF2" }}>ASSIGNED SERVICE WINDOW</th>
                  <th style={{ ...TH, paddingBottom: 16, textAlign: "left", color: "#667085", borderBottom: "1px solid #EDEFF2" }}>ACTIVE</th>
                </tr></thead>
                <tbody>
                  {(rows.data ?? []).map((r) => (
                    <tr key={r.groupId}>
                      <td style={{ fontWeight: 600, padding: "12px 0" }}>{r.workgroupName}</td>
                      <td>{r.manager}</td>
                      <td>
                        <select className="select" style={{ maxWidth: 300 }} value={r.slaServiceWindowId ?? ""}
                          onChange={(e) => void set(r.groupId, { slaServiceWindowId: e.target.value ? Number(e.target.value) : null })}>
                          <option value="">— Not assigned —</option>
                          {(windows.data ?? []).map((w) => <option key={w.slaServiceWindowId} value={w.slaServiceWindowId}>{w.slaName}</option>)}
                        </select>
                      </td>
                      <td><label className="admin-master-check-label"><input type="checkbox" checked={r.isActive} onChange={(e) => void set(r.groupId, { isActive: e.target.checked })} /> <StatusPill active={r.isActive} /></label></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", gap: 16, fontSize: 13, marginTop: 18 }}>
                <Link to="/config/admin/sla-service-window">Manage Service Windows</Link>
                <Link to="/config/admin/workgroups">Manage Workgroups</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
