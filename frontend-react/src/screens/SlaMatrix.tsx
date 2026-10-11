import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../api";
import { SlaMatrixRow, slaApi } from "../configApi";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, TH, errMsg } from "../components/configKit";

type Unit = "Minutes" | "Hours";
const PRIORITY_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  Critical: { bg: "#FEF3F2", color: "#B42318", border: "#FECDCA" },
  High: { bg: "#FFF6ED", color: "#B93815", border: "#FDDCAB" },
  Medium: { bg: "#FFFAEB", color: "#B45309", border: "#FEDF89" },
  Low: { bg: "#F2F4F7", color: "#344054", border: "#E4E7EC" },
};
const toDisplay = (mins: number): { value: number; unit: Unit } =>
  mins > 0 && mins % 60 === 0 ? { value: mins / 60, unit: "Hours" } : { value: mins, unit: "Minutes" };
const toMinutes = (value: number, unit: Unit) => Math.round(value * (unit === "Hours" ? 60 : 1));

function DurationInput({ minutes, onChange, disabled }: { minutes: number; onChange: (mins: number) => void; disabled?: boolean }) {
  const initial = toDisplay(minutes);
  const [value, setValue] = useState(String(initial.value));
  const [unit, setUnit] = useState<Unit>(initial.unit);
  const push = (v: string, u: Unit) => { const n = Number(v); if (v !== "" && n > 0) onChange(toMinutes(n, u)); };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input className="input" type="number" min={1} value={value} disabled={disabled} style={{ width: 80, height: 34 }}
        onChange={(e) => { setValue(e.target.value); push(e.target.value, unit); }} />
      <select className="select" value={unit} disabled={disabled} style={{ width: 110, height: 34 }}
        onChange={(e) => { const u = e.target.value as Unit; setUnit(u); push(value, u); }}>
        <option value="Minutes">Minutes</option><option value="Hours">Hours</option>
      </select>
    </div>
  );
}

function MatrixRowView({ row, onSaved, onError }: { row: SlaMatrixRow; onSaved: () => void; onError: (m: string) => void }) {
  const [resp, setResp] = useState(row.responseMinutes);
  const [reso, setReso] = useState(row.resolutionMinutes);
  const [active, setActive] = useState(row.isActive);
  const [busy, setBusy] = useState(false);
  const dirty = resp !== row.responseMinutes || reso !== row.resolutionMinutes || active !== row.isActive;
  const c = PRIORITY_COLOR[row.priorityName] ?? PRIORITY_COLOR.Low;
  const save = async () => {
    setBusy(true); onError("");
    try { await slaApi.updateMatrix(row.slaMatrixId, { responseMinutes: resp, resolutionMinutes: reso, isActive: active }); onSaved(); }
    catch (e) { onError(errMsg(e, "Unable to save.")); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Remove the ${row.workgroupName} / ${row.priorityName} override?`)) return;
    try { await slaApi.removeMatrix(row.slaMatrixId); onSaved(); } catch (e) { onError(errMsg(e, "Unable to remove.")); }
  };
  const cell: React.CSSProperties = { padding: "12px 12px 12px 0", borderBottom: "1px solid #F2F4F7", verticalAlign: "middle" };
  return (
    <tr>
      <td style={{ ...cell, fontSize: 12.5, fontWeight: 600 }}>{row.workgroupName}</td>
      <td style={cell}><span style={{ display: "inline-flex", padding: "2px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{row.priorityName}</span></td>
      <td style={cell}><DurationInput minutes={row.responseMinutes} onChange={setResp} /></td>
      <td style={cell}><DurationInput minutes={row.resolutionMinutes} onChange={setReso} /></td>
      <td style={cell}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
      </td>
      <td style={{ ...cell, whiteSpace: "nowrap", textAlign: "right" }}>
        {dirty && <button className="btn-primary" style={{ height: 30, padding: "0 12px", marginRight: 8 }} disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button>}
        <button className="admin-master-icon-button" title="Remove" aria-label="Remove override" onClick={() => void remove()}><Trash2 size={15} /></button>
      </td>
    </tr>
  );
}

export function SlaMatrixPage() {
  const matrix = useAsync(() => slaApi.matrix(), []);
  const groups = useAsync(() => api.get<{ groupId: number; groupName: string; isActive?: boolean }[]>("/assignment-groups"), []);
  const pris = useAsync(() => api.get<{ priorityId: number; priorityName: string; isActive?: boolean }[]>("/priority"), []);
  const [groupId, setGroupId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [resp, setResp] = useState(30);
  const [reso, setReso] = useState(240);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const rows = matrix.data ?? [];

  const add = async () => {
    setErr("");
    if (!groupId || !priorityId) { setErr("Choose a workgroup and a priority."); return; }
    if (rows.some((r) => String(r.groupId) === groupId && String(r.priorityId) === priorityId)) { setErr("That workgroup + priority combination already exists."); return; }
    setAdding(true);
    try {
      await slaApi.addMatrix({ groupId: Number(groupId), priorityId: Number(priorityId), responseMinutes: resp, resolutionMinutes: reso });
      setGroupId(""); setPriorityId(""); matrix.reload();
    } catch (e) { setErr(errMsg(e, "Unable to add the combination.")); } finally { setAdding(false); }
  };

  return (
    <>
      <PageHeader crumb="Configuration > SLA Configurations > SLA Matrix" title="SLA Matrix"
        subtitle="Override the default Response/Resolution SLA for a specific Workgroup + Priority combination. Each Workgroup + Priority pair can only be mapped once." />
      <div className="page-body">
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "24px 20px 20px" }}>
            <ErrorBar msg={err || matrix.error || groups.error || pris.error || ""} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, alignItems: "end" }}>
              <label className="field-group" style={{ margin: 0 }}>
                <span className="lbl">Workgroup</span>
                <select className="select" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">Select workgroup…</option>
                  {(groups.data ?? []).filter((g) => g.isActive !== false).map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}
                </select>
              </label>
              <label className="field-group" style={{ margin: 0 }}>
                <span className="lbl">Priority</span>
                <select className="select" value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
                  <option value="">Select priority…</option>
                  {(pris.data ?? []).filter((p) => p.isActive !== false).map((p) => <option key={p.priorityId} value={p.priorityId}>{p.priorityName}</option>)}
                </select>
              </label>
              <div className="field-group" style={{ margin: 0 }}><span className="lbl">Response SLA</span><DurationInput minutes={30} onChange={setResp} /></div>
              <div className="field-group" style={{ margin: 0 }}><span className="lbl">Resolution SLA</span><DurationInput minutes={240} onChange={setReso} /></div>
              <div style={{ display: "flex", alignItems: "end" }}><button className="btn-primary" style={{ height: 36, padding: "0 16px" }} disabled={adding} onClick={() => void add()}>{adding ? "Adding…" : "+ Add Combination"}</button></div>
            </div>
          </div>
          <div style={{ padding: "16px 20px 20px", overflowX: "auto" }}>
            {matrix.loading ? <div className="spinner-row">Loading…</div> : rows.length === 0 ? <div className="empty-state">No overrides yet — every workgroup uses the default Priority SLA.</div> : (
              <table style={{ width: "100%", minWidth: 1080, tableLayout: "fixed", borderCollapse: "collapse" }}>
                <colgroup>
                  <col style={{ width: 210 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 250 }} />
                  <col style={{ width: 250 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 90 }} />
                </colgroup>
                <thead>
                  <tr>
                    {["WORKGROUP", "PRIORITY", "RESPONSE SLA", "RESOLUTION SLA", "ACTIVE", ""].map((h) => (
                      <th key={h} style={{ ...TH, paddingBottom: 16, textAlign: "left", color: "#667085", borderBottom: "1px solid #EDEFF2" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>{rows.map((r) => <MatrixRowView key={`${r.slaMatrixId}-${r.responseMinutes}-${r.resolutionMinutes}-${r.isActive}`} row={r} onSaved={matrix.reload} onError={setErr} />)}</tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
