import React, { useState } from "react";
import { WorkgroupWindowRow, slaApi } from "../configApi";
import { api } from "../api";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, TH, errMsg } from "../components/configKit";

interface WindowOption { slaServiceWindowId: number; slaName: string; isActive?: boolean }

function Row({ row, windows, onSaved, onError }: { row: WorkgroupWindowRow; windows: WindowOption[]; onSaved: () => void; onError: (m: string) => void }) {
  const [windowId, setWindowId] = useState(row.slaServiceWindowId ? String(row.slaServiceWindowId) : "");
  const [active, setActive] = useState(row.isActive);
  const [busy, setBusy] = useState(false);
  const dirty = windowId !== (row.slaServiceWindowId ? String(row.slaServiceWindowId) : "") || active !== row.isActive;
  const save = async () => {
    setBusy(true); onError("");
    try { await slaApi.setWindow(row.groupId, { slaServiceWindowId: windowId ? Number(windowId) : null, isActive: active }); onSaved(); }
    catch (e) { onError(errMsg(e, "Unable to save.")); } finally { setBusy(false); }
  };
  const cell: React.CSSProperties = { padding: "14px 12px 14px 0", borderBottom: "1px solid #F2F4F7", verticalAlign: "middle" };
  return (
    <tr>
      <td style={{ ...cell, fontSize: 12.5, fontWeight: 500 }}>{row.workgroupName}</td>
      <td style={{ ...cell, fontSize: 12.5, color: "var(--ink-soft)" }}>{row.manager || "—"}</td>
      <td style={cell}>
        <select className="select" style={{ width: 280, margin: 0 }} value={windowId} onChange={(e) => setWindowId(e.target.value)}>
          <option value="">— No service window (24x7) —</option>
          {windows.filter((w) => w.isActive !== false || String(w.slaServiceWindowId) === windowId).map((w) => <option key={w.slaServiceWindowId} value={w.slaServiceWindowId}>{w.slaName}</option>)}
        </select>
      </td>
      <td style={cell}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
      </td>
      <td style={{ ...cell, textAlign: "right" }}>
        {dirty && <button className="btn-primary" style={{ height: 30, padding: "0 12px" }} disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button>}
      </td>
    </tr>
  );
}

export function WorkgroupSlaPage() {
  const rows = useAsync(() => slaApi.windows(), []);
  const windows = useAsync(() => api.get<WindowOption[]>("/sla-service-windows"), []);
  const [err, setErr] = useState("");
  return (
    <>
      <PageHeader crumb="Configuration > Incident SLA Configurations > Workgroup SLA Window" title="Workgroup SLA Window"
        subtitle="Assign each workgroup the service window (business-hours calendar) its Response and Resolution SLA clocks follow." />
      <div className="page-body">
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "24px 20px 20px", overflowX: "auto" }}>
            <ErrorBar msg={err || rows.error || windows.error || ""} />
            {rows.loading ? <div className="spinner-row">Loading…</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["WORKGROUP", "MANAGER", "SLA SERVICE WINDOW", "ACTIVE", ""].map((h) => (
                    <th key={h} style={{ ...TH, paddingBottom: 16, textAlign: "left", color: "#667085", borderBottom: "1px solid #EDEFF2" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {(rows.data ?? []).map((r) => <Row key={`${r.groupId}-${r.slaServiceWindowId}-${r.isActive}`} row={r} windows={windows.data ?? []} onSaved={rows.reload} onError={setErr} />)}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
