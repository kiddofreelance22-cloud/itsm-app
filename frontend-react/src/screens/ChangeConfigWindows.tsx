import React, { useState } from "react";
import { ConfigPage, Check, Lbl, Panel, Pillish, uid, useDraft } from "../components/changeConfigKit";
import { DAYS, type ChangeWindow } from "../changeApi";

export function ChangeWindowsPage() {
  const d = useDraft("windows");
  const [sel, setSel] = useState<string | null>(null);
  const [kind, setKind] = useState<"All" | "Blackout" | "Maintenance">("All");
  const list = (d.draft ?? []).filter((w) => kind === "All" || w.kind === kind);
  const w = (d.draft ?? []).find((x) => x.id === sel) ?? null;
  const services = d.cfg?.services ?? [];
  const patch = (fn: (w: ChangeWindow) => void) => d.edit((l) => { const t = l.find((x) => x.id === sel); if (t) fn(t); });
  const when = (x: ChangeWindow) => (x.kind === "Blackout" ? `${x.start} to ${x.end}` : `Every ${DAYS[x.day ?? 0]} ${x.from}–${x.to}`);
  const add = () => { const id = uid("win"); d.edit((l) => { l.push({ id, name: "", kind: "Blackout", scope: "All services", allowEmergency: true, desc: "", active: true, start: "", end: "" }); }); setSel(id); };
  const scopeSet = new Set((w?.scope ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const toggleScope = (s: string) => patch((t) => {
    const cur = new Set(t.scope.split(",").map((x) => x.trim()).filter((x) => x && x !== "All services"));
    cur.has(s) ? cur.delete(s) : cur.add(s); t.scope = cur.size ? Array.from(cur).join(", ") : "All services";
  });
  return (
    <ConfigPage d={d} crumb="Blackout & Maintenance Windows" title="Blackout & Maintenance Windows" subtitle="Blackouts freeze changes to the services in scope. Maintenance windows are the agreed times for changes that need an outage."
      extra={<button className="btn-ghost" onClick={add}>Add window</button>}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{(["All", "Blackout", "Maintenance"] as const).map((k) => <button key={k} className={kind === k ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setKind(k)}>{k} ({(d.draft ?? []).filter((x) => k === "All" || x.kind === k).length})</button>)}</div>
      <div className="cm-grid">
        <div className="cm-card" style={{ padding: 0, overflow: "hidden" }}><div className="admin-master-table-scroll">
          <table className="dash-table" style={{ minWidth: 640 }}>
            <thead><tr><th>Window</th><th>Type</th><th>When</th><th>Services</th><th>Emergency</th><th>Status</th></tr></thead>
            <tbody>{list.map((x) => (
              <tr key={x.id} onClick={() => setSel(x.id)} style={{ cursor: "pointer", background: sel === x.id ? "var(--blue-light)" : undefined }}>
                <td><b>{x.name || "Unnamed"}</b><div className="cm-hint">{x.desc}</div></td><td>{x.kind}</td><td>{when(x)}</td><td>{x.scope}</td>
                <td>{x.kind === "Blackout" ? (x.allowEmergency ? "May proceed" : "Blocked") : "—"}</td><td><Pillish on={x.active} /></td></tr>))}
              {!list.length && <tr><td colSpan={6} className="spinner-row">No windows.</td></tr>}</tbody>
          </table></div></div>
        <div className="cm-sticky">
          {w ? (
            <Panel title={w.name || "New window"} right={<button className="btn-danger btn-sm" onClick={() => { d.edit((l) => { l.splice(l.findIndex((x) => x.id === w.id), 1); }); setSel(null); }}>Delete</button>}>
              <div className="cm-form-grid" style={{ gridTemplateColumns: "1fr" }}>
                <Lbl label="Name"><input className="input" value={w.name} onChange={(e) => patch((t) => { t.name = e.target.value; })} /></Lbl>
                <Lbl label="Type"><select className="select" value={w.kind} onChange={(e) => patch((t) => { t.kind = e.target.value as ChangeWindow["kind"]; if (t.kind === "Maintenance") { t.day = t.day ?? 6; t.from = t.from || "22:00"; t.to = t.to || "04:00"; } })}><option>Blackout</option><option>Maintenance</option></select></Lbl>
                {w.kind === "Blackout" ? <>
                  <Lbl label="Starts" hint="YYYY-MM-DD HH:MM"><input className="input" value={w.start ?? ""} onChange={(e) => patch((t) => { t.start = e.target.value; })} placeholder="2026-12-24 00:00" /></Lbl>
                  <Lbl label="Ends" hint="YYYY-MM-DD HH:MM"><input className="input" value={w.end ?? ""} onChange={(e) => patch((t) => { t.end = e.target.value; })} placeholder="2026-12-27 23:59" /></Lbl>
                  <Check label="Emergency changes may still go ahead (ECAB approval)" checked={w.allowEmergency} onChange={(v) => patch((t) => { t.allowEmergency = v; })} />
                </> : <>
                  <Lbl label="Every"><select className="select" value={w.day ?? 6} onChange={(e) => patch((t) => { t.day = Number(e.target.value); })}>{DAYS.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></Lbl>
                  <Lbl label="From (HH:MM)"><input className="input" value={w.from ?? ""} onChange={(e) => patch((t) => { t.from = e.target.value; })} /></Lbl>
                  <Lbl label="To (HH:MM, next day if earlier)"><input className="input" value={w.to ?? ""} onChange={(e) => patch((t) => { t.to = e.target.value; })} /></Lbl>
                </>}
                <Lbl label="Services in scope" hint={w.scope}>
                  <div><Check label="All services" checked={scopeSet.has("All services")} onChange={() => patch((t) => { t.scope = "All services"; })} />
                    {services.map((s) => <Check key={s} label={s} checked={scopeSet.has(s)} onChange={() => toggleScope(s)} />)}</div>
                </Lbl>
                <Lbl label="Reason"><textarea className="textarea" rows={2} value={w.desc} onChange={(e) => patch((t) => { t.desc = e.target.value; })} /></Lbl>
                <Check label="Active" checked={w.active} onChange={(v) => patch((t) => { t.active = v; })} />
              </div>
            </Panel>
          ) : <Panel title="Select a window"><div className="cm-hint">Choose a window to edit it. Changes planned inside an active blackout cannot be submitted; an outage outside every maintenance window gets a warning.</div></Panel>}
        </div>
      </div>
    </ConfigPage>
  );
}
