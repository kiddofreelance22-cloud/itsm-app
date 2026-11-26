import React from "react";
import { ConfigPage, Check, Pillish, uid, useDraft } from "../components/changeConfigKit";
import { colorSet, type CloseCode } from "../changeApi";

/** Close codes record how a change ended. Configured on their own, separately from categories. */
export function ChangeCloseCodesPage() {
  const d = useDraft("closeCodes");
  const list = d.draft ?? [];
  const set = (id: string, fn: (c: CloseCode) => void) => d.edit((l) => { const c = l.find((x) => x.id === id); if (c) fn(c); });
  return (
    <ConfigPage d={d} crumb="Close Codes" title="Close Codes" subtitle="Close codes record how a change ended. They are offered when a change is closed and shown in the Change Overview outcomes."
      extra={<button className="btn-ghost" onClick={() => d.edit((l) => { l.push({ id: uid("cc"), name: "", desc: "", color: "gray", pir: false, active: true }); })}>Add close code</button>}>
      <div className="cm-card" style={{ padding: 0, overflow: "hidden" }}><div className="admin-master-table-scroll">
        <table className="dash-table" style={{ minWidth: 860 }}>
          <thead><tr><th>Close code</th><th>Description</th><th>Colour</th><th>Review before closing</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((c) => (
            <tr key={c.id}>
              <td><input className="input" value={c.name} onChange={(e) => set(c.id, (x) => { x.name = e.target.value; })} /><div style={{ marginTop: 6 }}><span className="badge" style={{ background: colorSet(c.color).bg, color: colorSet(c.color).color }}>{c.name || "…"}</span></div></td>
              <td><input className="input" value={c.desc} onChange={(e) => set(c.id, (x) => { x.desc = e.target.value; })} /></td>
              <td><select className="select" value={c.color} onChange={(e) => set(c.id, (x) => { x.color = e.target.value; })}>{["green", "blue", "amber", "red", "violet", "gray"].map((o) => <option key={o}>{o}</option>)}</select></td>
              <td><Check label="Review required" checked={c.pir} onChange={(v) => set(c.id, (x) => { x.pir = v; })} /></td>
              <td><Pillish on={c.active} /> <Check label="" checked={c.active} onChange={(v) => set(c.id, (x) => { x.active = v; })} /></td>
              <td><button className="btn-ghost btn-sm" onClick={() => d.edit((l) => { l.splice(l.findIndex((x) => x.id === c.id), 1); })}>Delete</button></td>
            </tr>))}</tbody>
      </table></div></div>
      <div className="cm-hint">“Cancelled” is used when a change is cancelled and is never offered at closure. A close code used by existing changes can be deactivated but not deleted.</div>
    </ConfigPage>
  );
}
