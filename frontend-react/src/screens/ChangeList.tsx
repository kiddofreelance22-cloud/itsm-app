import React, { useMemo, useState } from "react";
import { Download, Plus, Search } from "lucide-react";
import { Link } from "../router";
import { useAsync } from "../hooks";
import { ErrorBar } from "../components/configKit";
import { TypePill } from "../components/changeKit";
import { formatDate } from "../fieldMeta";
import {
  RISK_COLOR, STATE_COLOR, changeApi, userName, windowsOverlap, type Change, type RiskLevel,
} from "../changeApi";

const dt = (iso?: string | null) => (iso ? `${formatDate(iso)} ${new Date(iso).toTimeString().slice(0, 5)}` : "—");

export function ChangeListPage() {
  const { data, loading, error } = useAsync(() => changeApi.list(), []);
  const types = Array.from(new Set((data ?? []).map((c) => c.changeType))).sort();
  const [f, setF] = useState({ q: "", type: "", risk: "", state: "", group: "", conflictsOnly: false });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const rows = data ?? [];
  const live = useMemo(() => rows.filter((c) => !["Closed", "Cancelled"].includes(c.state)), [rows]);
  const conflicting = useMemo(() => new Set(live.filter((c) => live.some((o) => o.changeId !== c.changeId && windowsOverlap(c, o))).map((c) => c.changeId)), [live]);
  const groups = useMemo(() => Array.from(new Set(rows.map((c) => c.assignmentGroup).filter(Boolean) as string[])).sort(), [rows]);

  const shown = rows.filter((c) =>
    (!f.type || c.changeType === f.type) && (!f.risk || c.riskLevel === f.risk) &&
    (!f.state || (f.state === "Open" ? !["Closed", "Cancelled"].includes(c.state) : c.state === f.state)) &&
    (!f.group || c.assignmentGroup === f.group) && (!f.conflictsOnly || conflicting.has(c.changeId)) &&
    (!f.q.trim() || [
      c.changeCode,
      c.shortDescription,
      c.businessService ?? "",
      c.category ?? "",
      ...(c.configurationItems ?? []),
      userName(c.assignedTo),
    ].some((s) => s.toLowerCase().includes(f.q.trim().toLowerCase()))));
  const openCount = live.length;
  const stateCounts = Array.from(new Set(rows.map((c) => c.state)))
    .map((s) => ({ s, n: rows.filter((c) => c.state === s).length }));
  const riskLevels = Array.from(new Set(rows.map((c) => c.riskLevel)
    .filter((risk): risk is RiskLevel => risk != null))).sort();

  const badge = (text: string, c: { bg: string; color: string }) => <span className="badge" style={{ background: c.bg, color: c.color }}>{text}</span>;
  const exportCsv = () => {
    const cell = (value: string | null | undefined) => {
      const text = value ?? "";
      const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const values = [
      ["Number", "Short description", "Type", "Risk", "Priority", "State", "Planned start", "Planned end", "Assignment group", "Assigned to", "Conflict"],
      ...shown.map((c) => [
        c.changeCode,
        c.shortDescription,
        c.changeType,
        c.riskLevel ?? "",
        c.priority ?? "",
        c.state,
        dt(c.plannedStart),
        dt(c.plannedEnd),
        c.assignmentGroup ?? "",
        userName(c.assignedTo),
        conflicting.has(c.changeId) ? "Yes" : "No",
      ]),
    ];
    const csv = `\uFEFF${values.map((line) => line.map(cell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "change-requests.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const row = (c: Change) => (
    <tr key={c.changeId}>
      <td><Link to={`/changes/${c.changeId}`} style={{ fontWeight: 700 }}>{c.changeCode}</Link>
        {conflicting.has(c.changeId) && <div className="change-list-conflict">Conflict</div>}</td>
      <td><div style={{ fontWeight: 600 }}>{c.shortDescription}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{[c.category, c.businessService].filter(Boolean).join(" · ")}</div></td>
      <td><TypePill t={c.changeType} /></td>
      <td>{c.riskLevel ? badge(c.riskLevel, RISK_COLOR[c.riskLevel]) : "—"}</td>
      <td>{c.priority ?? "—"}</td>
      <td>{badge(c.state, STATE_COLOR[c.state])}</td>
      <td>{dt(c.plannedStart)}<div style={{ fontSize: 11.5, color: "var(--muted)" }}>to {dt(c.plannedEnd)}</div></td>
      <td>{c.assignmentGroup ?? "—"}<div style={{ fontSize: 11.5, color: "var(--muted)" }}>{userName(c.assignedTo)}</div></td>
    </tr>
  );

  return (
    <>
      <div className="page-header-row change-list-header">
        <div className="page-header-left">
          <div className="breadcrumb">Manage Changes &gt; Change Request List</div>
          <div className="page-title">Change Request List</div>
          <div className="page-subtitle">Every change request across the organisation. Open one to assess, authorise, implement or review it.</div>
        </div>
        <div className="change-list-header-actions">
          <button type="button" className="btn-ghost" onClick={exportCsv} title="Download the filtered list as an Excel-compatible CSV">
            <Download size={14} /> Export to Excel
          </button>
          <Link to="/changes/new" className="btn-primary"><Plus size={14} /> Create change</Link>
        </div>
      </div>
      <div className="page-body change-list-page-body">
        <div className="change-list-filters">
          <label className="change-list-search">
            <Search size={16} aria-hidden="true" />
            <input className="input" aria-label="Search change requests" placeholder="Search number, description, CI, owner..." value={f.q} onChange={(e) => set("q", e.target.value)} />
          </label>
          <select className="select" aria-label="Filter by type" value={f.type} onChange={(e) => set("type", e.target.value)}><option value="">All types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
          <select className="select" aria-label="Filter by risk" value={f.risk} onChange={(e) => set("risk", e.target.value)}><option value="">All risk levels</option>{riskLevels.map((t) => <option key={t}>{t}</option>)}</select>
          <select className="select" aria-label="Filter by assignment group" value={f.group} onChange={(e) => set("group", e.target.value)}><option value="">All assignment groups</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>
          <label className="change-list-conflicts">
            <input type="checkbox" checked={f.conflictsOnly} onChange={(e) => set("conflictsOnly", e.target.checked)} /> With conflicts
          </label>
        </div>
        <div className="change-list-tabs" role="group" aria-label="Filter changes by state">
          <button aria-pressed={f.state === "Open"} className={f.state === "Open" ? "active" : ""} onClick={() => set("state", f.state === "Open" ? "" : "Open")}>Open ({openCount})</button>
          <button aria-pressed={!f.state} className={!f.state ? "active" : ""} onClick={() => set("state", "")}>All ({rows.length})</button>
          {stateCounts.map(({ s, n }) => (
            <button key={s} aria-pressed={f.state === s} className={f.state === s ? "active" : ""} onClick={() => set("state", f.state === s ? "" : s)}>{s} ({n})</button>
          ))}
        </div>
        <ErrorBar msg={error ?? ""} />
        <div className="card change-list-table-wrap">
          <div className="admin-master-table-scroll">
            <table className="dash-table change-list-table" style={{ minWidth: 960 }}>
              <thead><tr><th>Number</th><th>Short description</th><th>Type</th><th>Risk</th><th>Priority</th><th>State</th><th>Planned window</th><th>Assignment</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} className="spinner-row">Loading…</td></tr>
                  : shown.length ? shown.map(row)
                  : <tr><td colSpan={8} className="spinner-row">No changes match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{shown.length} of {rows.length} changes</div>
      </div>
    </>
  );
}
