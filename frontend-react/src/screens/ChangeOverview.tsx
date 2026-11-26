import React from "react";
import { Link } from "../router";
import { useAsync } from "../hooks";
import { ErrorBar } from "../components/configKit";
import { PageHead, StatePill, TypePill, RiskPill } from "../components/changeKit";
import { STATE_COLOR, changeApi, colorSet, fmtDT } from "../changeApi";

const KIND_COLOR: Record<string, { bg: string; color: string }> = {
  Conflict: { bg: "#FEF3F2", color: "#B42318" }, Overrun: { bg: "#FEF3F2", color: "#B42318" }, Approval: { bg: "#FFFAEB", color: "#B54708" },
  "Review due": { bg: "#EFF8FF", color: "#175CD3" }, Draft: { bg: "#F2F4F7", color: "#344054" },
};
const ACTION: Record<string, string> = { Conflict: "Reschedule", Overrun: "Open", Approval: "Review", "Review due": "Open review", Draft: "Open" };

export function ChangeOverviewPage() {
  const q = useAsync(() => changeApi.overview(), []);
  const cfg = useAsync(() => changeApi.config(), []).data;
  const o = q.data;
  const std = cfg?.models.find((m) => m.base === "Standard" && m.active)?.name;
  const emg = cfg?.models.find((m) => m.base === "Emergency" && m.active)?.name;
  const nrm = cfg?.models.find((m) => m.base === "Normal" && m.active)?.name;
  const max = Math.max(1, ...(o?.byState.map((s) => s.count) ?? [1]));
  const outcomeMax = Math.max(1, ...(o?.outcomes.map((x) => x.count) ?? [1]));
  const tile = (label: string, value: string, sub: string, to: string) => (
    <Link to={to} className="cm-card" style={{ margin: 0, display: "block", textDecoration: "none", color: "inherit" }}>
      <div className="cm-lbl">{label}</div><div style={{ fontSize: 28, fontWeight: 800, margin: "4px 0" }}>{value}</div><div className="cm-hint">{sub}</div>
    </Link>
  );
  return (
    <>
      <PageHead crumb="Change Management > Change Overview" title="Change Overview" subtitle="Where every change stands, what needs a decision and what is about to go live."
        action={<div style={{ display: "flex", gap: 8 }}>
          {std && <Link to={`/changes/new?type=${encodeURIComponent(std)}`} className="btn-ghost">{std} change</Link>}
          {emg && <Link to={`/changes/new?type=${encodeURIComponent(emg)}`} className="btn-ghost">{emg} change</Link>}
          <Link to={nrm ? `/changes/new?type=${encodeURIComponent(nrm)}` : "/changes/new"} className="btn-primary">Create {nrm?.toLowerCase() ?? "normal"} change</Link>
        </div>} />
      <div className="page-body">
        <ErrorBar msg={q.error ?? ""} />
        {q.loading || !o ? <div className="spinner-row">Loading…</div> : <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 16 }}>
            {tile("Open changes", String(o.tiles.open), "Not yet closed or cancelled", "/changes")}
            {tile("Awaiting decision", String(o.tiles.awaitingDecision), "In Assess or Authorize", "/changes/approvals")}
            {tile("Going live", String(o.tiles.goingLive), "In the next 7 days", "/changes/schedule")}
            {tile("In review", String(o.tiles.inReview), "Post-implementation review", "/changes")}
            {tile("Emergency share", o.tiles.emergencyShare === null ? "—" : `${o.tiles.emergencyShare}%`, `${o.tiles.emergencies} of ${o.tiles.recent} raised in 30 days`, "/changes")}
          </div>
          <div className="cm-grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <div className="cm-card">
              <div className="cm-card-title">Needs attention ({o.attentionCount})</div>
              {o.attention.length ? o.attention.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: i ? "1px solid #EDEFF2" : undefined }}>
                  <span className="badge" style={KIND_COLOR[a.kind] ?? KIND_COLOR.Draft}>{a.kind}</span>
                  <div style={{ flex: 1, fontSize: 12.5 }}><b>{a.changeCode}</b> — {a.title}<div className="cm-hint">{a.text}</div></div>
                  <Link to={`/changes/${a.changeId}`} className="btn-ghost btn-sm">{ACTION[a.kind] ?? "Open"}</Link>
                </div>)) : <div className="cm-hint">Nothing needs your attention right now.</div>}
            </div>
            <div className="cm-card">
              <div className="cm-card-title" style={{ justifyContent: "space-between" }}><span>Going live in the next 7 days</span><Link to="/changes/schedule">Open change schedule</Link></div>
              {o.upcoming.length ? o.upcoming.map((c, i) => (
                <div key={c.changeId} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: i ? "1px solid #EDEFF2" : undefined, fontSize: 12.5 }}>
                  <div style={{ width: 118, color: "var(--muted)" }}>{fmtDT(c.plannedStart)}</div>
                  <div style={{ flex: 1 }}><Link to={`/changes/${c.changeId}`} style={{ fontWeight: 700 }}>{c.changeCode}</Link> {c.shortDescription}<div className="cm-hint">{c.businessService} · {c.assignmentGroup ?? "No group"}</div></div>
                  <div style={{ display: "grid", gap: 4, justifyItems: "end" }}><TypePill t={c.changeType} /><RiskPill r={c.riskLevel} /><StatePill s={c.state} /></div>
                </div>)) : <div className="cm-hint">No changes are scheduled in the next 7 days.</div>}
            </div>
          </div>
          <div className="cm-grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", marginTop: 16 }}>
            <div className="cm-card">
              <div className="cm-card-title">Open changes by state</div>
              {o.byState.map((s) => (
                <div key={s.state} style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0", fontSize: 12.5 }}>
                  <div style={{ width: 80 }}>{s.state}</div>
                  <div style={{ flex: 1, background: "#F2F4F7", borderRadius: 4, height: 14 }}><div style={{ width: `${(s.count / max) * 100}%`, height: 14, borderRadius: 4, background: STATE_COLOR[s.state].color, opacity: 0.8 }} /></div>
                  <div style={{ width: 24, textAlign: "right", fontWeight: 700 }}>{s.count}</div>
                </div>))}
            </div>
            <div className="cm-card">
              <div className="cm-card-title">Open changes by type and risk</div>
              <table className="dash-table"><thead><tr><th>Type</th>{o.typeRisk.levels.map((l) => <th key={l}>{l}</th>)}<th>Not assessed</th></tr></thead>
                <tbody>{o.typeRisk.rows.map((r) => (
                  <tr key={r.type}><td><TypePill t={r.type} /></td>{r.counts.map((n, i) => <td key={i} style={{ fontWeight: n ? 700 : 400, color: n ? undefined : "var(--muted-2)" }}>{n}</td>)}<td>{r.unassessed}</td></tr>))}</tbody></table>
            </div>
          </div>
          <div className="cm-card" style={{ marginTop: 16 }}>
            <div className="cm-card-title">Closed changes — outcome</div>
            {o.outcomes.length ? o.outcomes.map((x) => (
              <div key={x.code} style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0", fontSize: 12.5 }}>
                <div style={{ width: 160 }}>{x.code}</div>
                <div style={{ flex: 1, background: "#F2F4F7", borderRadius: 4, height: 14 }}><div style={{ width: `${(x.count / outcomeMax) * 100}%`, height: 14, borderRadius: 4, background: colorSet(cfg?.closeCodes.find((c) => c.name === x.code)?.color).color, opacity: 0.8 }} /></div>
                <div style={{ width: 24, textAlign: "right", fontWeight: 700 }}>{x.count}</div>
              </div>)) : <div className="cm-hint">No changes have been closed yet.</div>}
          </div>
        </>}
      </div>
    </>
  );
}
