import React, { useState } from "react";
import { Link } from "../router";
import { api } from "../api";
import { priorityMatrixApi } from "../configApi";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, TH, errMsg } from "../components/configKit";

const COLORS = [
  { bg: "#FEF3F2", color: "#B42318", border: "#FECDCA", dot: "#D92D20" },
  { bg: "#FFFAEB", color: "#B45309", border: "#FEDF89", dot: "#B45309" },
  { bg: "#EFF8FF", color: "#026AA2", border: "#B2DDFF", dot: "#1570EF" },
  { bg: "#F2F4F7", color: "#667085", border: "#D0D5DD", dot: "#98A2B3" },
];
interface Lvl { urgencyId?: number; impactId?: number; urgencyName?: string; impactName?: string }
interface Pri { priorityId: number; priorityName: string; priorityCode?: string; order: number; isActive?: boolean }

export function PriorityMatrixPage() {
  const matrix = useAsync(() => priorityMatrixApi.list(), []);
  const urgencies = useAsync(() => api.get<Required<Pick<Lvl, "urgencyId" | "urgencyName">>[]>("/urgency"), []);
  const impacts = useAsync(() => api.get<Required<Pick<Lvl, "impactId" | "impactName">>[]>("/impact"), []);
  const priorities = useAsync(() => api.get<Pri[]>("/priority"), []);
  const [u, setU] = useState(""); const [i, setI] = useState(""); const [p, setP] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const pris = [...(priorities.data ?? [])].sort((a, b) => a.order - b.order || a.priorityId - b.priorityId);
  const colorFor = (priorityId: number) => COLORS[Math.min(Math.max(pris.findIndex((x) => x.priorityId === priorityId), 0), COLORS.length - 1)];
  const label = (x: Pri) => x.priorityName;
  const selU = u || String(urgencies.data?.[0]?.urgencyId ?? "");
  const selI = i || String(impacts.data?.[0]?.impactId ?? "");
  const selP = p || String(pris[0]?.priorityId ?? "");

  const add = async () => {
    setErr("");
    if (!selU || !selI || !selP) { setErr("Pick an Urgency, an Impact and a Priority."); return; }
    if ((matrix.data ?? []).some((r) => r.urgencyId === Number(selU) && r.impactId === Number(selI))) {
      setErr("This Urgency + Impact pair is already mapped. Each pair can only be mapped once."); return;
    }
    setBusy(true);
    try { await priorityMatrixApi.create({ urgencyId: Number(selU), impactId: Number(selI), priorityId: Number(selP) }); matrix.reload(); }
    catch (e) { setErr(errMsg(e, "Unable to add combination.")); }
    finally { setBusy(false); }
  };
  const toggle = async (id: number, isActive: boolean) => {
    setErr("");
    try { await priorityMatrixApi.update(id, { isActive }); matrix.reload(); } catch (e) { setErr(errMsg(e)); matrix.reload(); }
  };

  return (
    <>
      <PageHeader crumb="Configuration > Incident SLA Configurations > Priority Matrix" title="Priority Matrix"
        subtitle="Pick an Urgency, Impact and Priority, then add the combination. Each Urgency + Impact pair can only be mapped once." />
      <div className="page-body">
        <ErrorBar msg={matrix.error ?? err} />
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "24px 20px 20px" }}>
            <div className="priority-matrix-form-row">
              <label className="field-group priority-matrix-field"><span className="lbl">Urgency</span>
                <select className="select" value={selU} onChange={(e) => setU(e.target.value)}>
                  {(urgencies.data ?? []).map((x) => <option key={x.urgencyId} value={x.urgencyId}>{x.urgencyName}</option>)}</select></label>
              <label className="field-group priority-matrix-field"><span className="lbl">Impact</span>
                <select className="select" value={selI} onChange={(e) => setI(e.target.value)}>
                  {(impacts.data ?? []).map((x) => <option key={x.impactId} value={x.impactId}>{x.impactName}</option>)}</select></label>
              <label className="field-group priority-matrix-field"><span className="lbl">Priority</span>
                <select className="select" value={selP} onChange={(e) => setP(e.target.value)}>
                  {pris.map((x) => <option key={x.priorityId} value={x.priorityId}>{label(x)}</option>)}</select></label>
              <button className="btn-primary priority-matrix-add" disabled={busy} onClick={add}>+ Add Combination</button>
            </div>
          </div>

          <div style={{ padding: "0 20px 20px" }}>
            {matrix.loading ? <div className="spinner-row">Loading…</div> : (matrix.data ?? []).length === 0 ? (
              <div className="empty-state">No combinations mapped yet. Incidents fall back to their entered priority until you add some.</div>
            ) : (
              <table>
                <thead><tr>
                  <th style={TH}>URGENCY</th><th style={TH}>IMPACT</th><th style={{ ...TH, width: 180 }}>PRIORITY</th><th style={{ ...TH, width: 100 }}>ACTIVE</th>
                </tr></thead>
                <tbody>
                  {(matrix.data ?? []).map((r) => {
                    const c = colorFor(r.priorityId);
                    const pr = pris.find((x) => x.priorityId === r.priorityId);
                    return (
                      <tr key={r.priorityMatrixId}>
                        <td style={{ fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 500 }}>{r.urgency.urgencyName}</td>
                        <td style={{ fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 500 }}>{r.impact.impactName}</td>
                        <td><span style={{ display: "inline-flex", alignItems: "center", padding: "2px 24px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                          {pr ? label(pr) : r.priority.priorityName}</span></td>
                        <td><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                          <input type="checkbox" checked={r.isActive} onChange={(e) => void toggle(r.priorityMatrixId, e.target.checked)} style={{ accentColor: "var(--blue)" }} /> Active</label></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <div className="priority-matrix-meta">
              <div className="priority-matrix-legend">
                {pris.slice(0, 4).map((x, idx) => (
                  <div key={x.priorityId} className="priority-matrix-legend-item">
                    <span className="priority-matrix-dot" style={{ background: COLORS[idx].dot }} />{label(x)}
                  </div>
                ))}
              </div>
              <div className="priority-matrix-actions">
                <Link to="/config/admin/impact" className="btn-ghost">Edit Impact Levels</Link>
                <Link to="/config/admin/urgency" className="btn-ghost">Edit Urgency Levels</Link>
                <Link to="/config/admin/priority" className="btn-ghost">Edit Priority Levels</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
