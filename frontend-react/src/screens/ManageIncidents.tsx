import React, { useEffect, useMemo, useRef, useState } from "react";
import { Columns3, Filter, Plus, X } from "lucide-react";
import { incidentApi } from "../incidentApi";
import { useAuth } from "../AuthContext";
import { PRIORITY_META, STATUS_META, formatDate } from "../fieldMeta";
import { useAsync } from "../hooks";
import { Link } from "../router";
import type { Incident, Status } from "../types";

// "open" is the default view: everything that is not yet Resolved or Closed.
type StatusFilter = "open" | "all" | Status;
const CLOSED_STATES: Status[] = ["RESOLVED", "CLOSED"];

// ── Column catalogue (Configure Columns) ──
interface ColDef { key: string; label: string; width?: number; render: (i: Incident) => React.ReactNode }
const dash = (v: React.ReactNode) => (v === null || v === undefined || v === "" ? "—" : v);
const COLUMNS: ColDef[] = [
  { key: "number", label: "Incident Number", width: 140, render: (i) => <Link to={`/incidents/${i.id}`} style={{ fontWeight: 700 }}>{i.number}</Link> },
  { key: "shortDescription", label: "Short Description", render: (i) => i.shortDescription },
  { key: "category", label: "Category", width: 140, render: (i) => dash(i.category) },
  { key: "priority", label: "Priority", width: 110, render: (i) => {
    const pm = i.priority ? PRIORITY_META[i.priority] : null;
    return pm ? <span className="badge" style={{ background: pm.bg, color: pm.color }}><span className="dot" style={{ background: pm.dot }} />{pm.label}</span> : dash(i.priorityName);
  } },
  { key: "status", label: "Status", width: 120, render: (i) => { const sm = STATUS_META[i.status]; return <span className="badge" style={{ background: sm.bg, color: sm.color }}><span className="dot" style={{ background: sm.dot }} />{sm.label}</span>; } },
  { key: "assignedWorkgroup", label: "Assigned Workgroup", width: 160, render: (i) => dash(i.assignedWorkgroup) },
  { key: "createdAt", label: "Created Date", width: 120, render: (i) => formatDate(i.createdAt) },
  { key: "assignedTo", label: "Assigned To", width: 150, render: (i) => dash(i.assignedToName) },
  { key: "caller", label: "Caller", width: 150, render: (i) => dash(i.callerName) },
  { key: "impact", label: "Impact", width: 100, render: (i) => dash(i.impact) },
  { key: "urgency", label: "Urgency", width: 100, render: (i) => dash(i.urgency) },
  { key: "location", label: "Location", width: 140, render: (i) => dash(i.location) },
  { key: "updatedAt", label: "Updated Date", width: 120, render: (i) => formatDate(i.updatedAt) },
  { key: "resolvedAt", label: "Resolved Date", width: 120, render: (i) => formatDate(i.resolvedAt) },
  { key: "slaDue", label: "SLA Due", width: 120, render: (i) => formatDate(i.slaResolutionTarget ?? null) },
];
const DEFAULT_COLS = ["number", "shortDescription", "category", "priority", "status", "assignedWorkgroup", "createdAt"];
const COLS_KEY = "itsm.incidentList.columns";

// ── Filter fields (multiple filters are AND-ed together) ──
type FieldType = "text" | "enum" | "date";
interface FilterDef { key: string; label: string; type: FieldType; get: (i: Incident) => string }
const iso = (d?: string | null) => (d ? d.slice(0, 10) : "");
const FILTERS: FilterDef[] = [
  { key: "number", label: "Incident Number", type: "text", get: (i) => i.number },
  { key: "shortDescription", label: "Short Description", type: "text", get: (i) => i.shortDescription },
  { key: "status", label: "Status", type: "enum", get: (i) => i.statusName ?? STATUS_META[i.status].label },
  { key: "priority", label: "Priority", type: "enum", get: (i) => i.priorityName ?? "" },
  { key: "impact", label: "Impact", type: "enum", get: (i) => i.impact ?? "" },
  { key: "urgency", label: "Urgency", type: "enum", get: (i) => i.urgency ?? "" },
  { key: "category", label: "Category", type: "enum", get: (i) => i.category ?? "" },
  { key: "assignedWorkgroup", label: "Assigned Workgroup", type: "enum", get: (i) => i.assignedWorkgroup ?? "" },
  { key: "assignedTo", label: "Assigned To", type: "enum", get: (i) => i.assignedToName ?? "" },
  { key: "caller", label: "Caller", type: "enum", get: (i) => i.callerName ?? "" },
  { key: "location", label: "Location", type: "enum", get: (i) => i.location ?? "" },
  { key: "createdAt", label: "Created Date", type: "date", get: (i) => iso(i.createdAt) },
  { key: "resolvedAt", label: "Resolved Date", type: "date", get: (i) => iso(i.resolvedAt) },
];
const OPS: Record<FieldType, { v: string; l: string }[]> = {
  text: [{ v: "contains", l: "contains" }, { v: "not_contains", l: "does not contain" }, { v: "is", l: "is" }, { v: "is_not", l: "is not" }],
  enum: [{ v: "is", l: "is" }, { v: "is_not", l: "is not" }],
  date: [{ v: "on", l: "on" }, { v: "after", l: "on or after" }, { v: "before", l: "on or before" }],
};
interface Rule { id: number; field: string; op: string; value: string }

function matches(rule: Rule, inc: Incident): boolean {
  const def = FILTERS.find((f) => f.key === rule.field);
  if (!def || rule.value === "") return true;     // an unfinished rule never hides anything
  const a = def.get(inc).toLowerCase(); const b = rule.value.toLowerCase();
  switch (rule.op) {
    case "contains": return a.includes(b);
    case "not_contains": return !a.includes(b);
    case "is": case "on": return a === b;
    case "is_not": return a !== b;
    case "after": return a !== "" && a >= b;
    case "before": return a !== "" && a <= b;
    default: return true;
  }
}

export function ManageIncidentsPage() {
  const { user } = useAuth();
  const incidentsQ = useAsync<{ incidents: Incident[] }>(
    () => incidentApi.allIncidents(user?.roles ?? []),
    [user?.roles.join(",")]
  );
  const groupsQ = useAsync(() => incidentApi.assignmentGroups(), [user?.id]);
  const allIncidents = incidentsQ.data?.incidents ?? [];
  const workgroupOptions = useMemo(
    () => (groupsQ.data ?? []).filter((group) => group.isActive !== false).map((group) => group.groupName).sort((a, b) => a.localeCompare(b)),
    [groupsQ.data]
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [search, setSearch] = useState("");
  const [rules, setRules] = useState<Rule[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [cols, setCols] = useState<string[]>(DEFAULT_COLS);
  const [colsOpen, setColsOpen] = useState(false);
  const ruleSeq = useRef(1);
  const colsRef = useRef<HTMLDivElement>(null);

  // Remember the chosen columns for this browser.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(COLS_KEY) ?? "null");
      if (Array.isArray(saved)) { const ok = saved.filter((k) => COLUMNS.some((c) => c.key === k)); if (ok.length) setCols(ok); }
    } catch { /* storage unavailable — keep defaults */ }
  }, []);
  const saveCols = (next: string[]) => { setCols(next); try { window.localStorage.setItem(COLS_KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  useEffect(() => {
    if (!colsOpen) return;
    const close = (e: MouseEvent) => { if (!colsRef.current?.contains(e.target as Node)) setColsOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [colsOpen]);

  const visibleCols = useMemo(() => COLUMNS.filter((c) => cols.includes(c.key)), [cols]);   // keeps catalogue order
  const toggleCol = (key: string) => {
    if (key === "number") return;                       // the incident number is always shown — it is the link to the record
    saveCols(cols.includes(key) ? cols.filter((k) => k !== key) : [...cols, key]);
  };

  const optionsFor = (key: string) => {
    if (key === "assignedWorkgroup") return workgroupOptions;
    const def = FILTERS.find((f) => f.key === key);
    return def ? Array.from(new Set(allIncidents.map((i) => def.get(i)).filter(Boolean))).sort((x, y) => x.localeCompare(y)) : [];
  };
  const addRule = () => { setShowFilters(true); setRules((r) => [...r, { id: ruleSeq.current++, field: "priority", op: "is", value: "" }]); };
  const patchRule = (id: number, patch: Partial<Rule>) => setRules((rs) => rs.map((r) => {
    if (r.id !== id) return r;
    const next = { ...r, ...patch };
    if (patch.field && patch.field !== r.field) {            // new field → sensible operator, blank value
      const t = FILTERS.find((f) => f.key === patch.field)!.type;
      next.op = OPS[t][0].v; next.value = "";
    }
    return next;
  }));

  const incidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allIncidents.filter((i) =>
      (statusFilter === "all" || (statusFilter === "open" ? !CLOSED_STATES.includes(i.status) : i.status === statusFilter))
      && rules.every((r) => matches(r, i))
      && (!q || [i.number, i.shortDescription, i.category ?? "", i.assignedWorkgroup ?? "", i.assignedToName ?? "", i.callerName ?? ""].some((s) => s.toLowerCase().includes(q))));
  }, [allIncidents, statusFilter, rules, search]);
  const activeRules = rules.filter((r) => r.value !== "").length;
  const filtersActive = statusFilter !== "open" || activeRules > 0 || !!search.trim();

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">Manage Incidents &gt; Incident List</div>
          <div className="page-title">Incident List</div>
          <div className="page-subtitle">{user?.role === "RESOLVER" ? "Incidents in your workgroups, including assigned and resolved work." : "All incidents reported across the organization."}</div>
        </div>
        <button className="btn-ghost" onClick={() => window.history.back()}>Close</button>
      </div>
      <div className="page-body">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
          <label className="field-group" style={{ minWidth: 200 }}><span className="lbl">Status</span>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label="Filter by status">
              <option value="open">Open tickets</option>
              <option value="all">All tickets</option>
              {(Object.keys(STATUS_META) as Status[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select></label>
          <label className="field-group" style={{ flex: 1, minWidth: 220 }}><span className="lbl">Search</span>
            <input className="input" placeholder="Incident number, description, category, workgroup, assignee…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          <button className="btn-ghost" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Filter size={14} aria-hidden="true" /> Filters{activeRules ? ` (${activeRules})` : ""}
          </button>
          <div ref={colsRef} style={{ position: "relative" }}>
            <button className="btn-ghost" onClick={() => setColsOpen((v) => !v)} aria-haspopup="true" aria-expanded={colsOpen} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Columns3 size={14} aria-hidden="true" /> Configure Columns
            </button>
            {colsOpen && (
              <div className="card" role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", width: 250, maxHeight: 380, overflow: "auto", padding: 12, zIndex: 40, boxShadow: "0 8px 24px rgba(16,24,40,0.16)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.5px", marginBottom: 8 }}>SHOW COLUMNS</div>
                {COLUMNS.map((c) => (
                  <label key={c.key} className="admin-master-check-label" style={{ display: "flex", gap: 8, padding: "5px 2px", opacity: c.key === "number" ? 0.6 : 1 }}>
                    <input type="checkbox" checked={cols.includes(c.key)} disabled={c.key === "number"} onChange={() => toggleCol(c.key)} /> {c.label}
                  </label>
                ))}
                <button className="btn-ghost" style={{ marginTop: 8, width: "100%" }} onClick={() => saveCols(DEFAULT_COLS)}>Reset to default</button>
              </div>
            )}
          </div>
          {filtersActive && <button className="btn-ghost" onClick={() => { setStatusFilter("open"); setRules([]); setSearch(""); }}>Reset</button>}
          <div style={{ fontSize: 12.5, color: "#667085", paddingBottom: 8 }}>{incidentsQ.loading ? "" : `${incidents.length} of ${allIncidents.length}`}</div>
        </div>

        {showFilters && (
          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.5px", marginBottom: 8 }}>FILTERS — INCIDENTS MUST MATCH ALL OF THESE</div>
            {groupsQ.error && rules.some((rule) => rule.field === "assignedWorkgroup") && <div className="error-text" role="alert">{groupsQ.error}</div>}
            {rules.length === 0 && <div style={{ fontSize: 13, color: "#667085", marginBottom: 8 }}>No filters yet. Add one to narrow the list.</div>}
            {rules.map((r) => {
              const def = FILTERS.find((f) => f.key === r.field)!;
              return (
                <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <select className="select" style={{ width: 190 }} aria-label="Filter field" value={r.field} onChange={(e) => patchRule(r.id, { field: e.target.value })}>
                    {FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
                  <select className="select" style={{ width: 160 }} aria-label="Filter condition" value={r.op} onChange={(e) => patchRule(r.id, { op: e.target.value })}>
                    {OPS[def.type].map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
                  {def.type === "enum" ? (
                    <select className="select" style={{ width: 220 }} aria-label="Filter value" value={r.value} onChange={(e) => patchRule(r.id, { value: e.target.value })}>
                      <option value="">Select…</option>{optionsFor(r.field).map((v) => <option key={v} value={v}>{v}</option>)}</select>
                  ) : (
                    <input className="input" style={{ width: 220 }} aria-label="Filter value" type={def.type === "date" ? "date" : "text"} value={r.value} placeholder="Value…" onChange={(e) => patchRule(r.id, { value: e.target.value })} />
                  )}
                  <button type="button" className="admin-master-icon-button danger" aria-label="Remove filter" onClick={() => setRules((rs) => rs.filter((x) => x.id !== r.id))}><X size={14} /></button>
                </div>
              );
            })}
            <button className="btn-ghost" onClick={addRule} style={{ display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} aria-hidden="true" /> Add filter</button>
          </div>
        )}

        {incidentsQ.loading ? (
          <div className="spinner-row">Loading…</div>
        ) : incidentsQ.error ? (
          <div className="error-text" role="alert">{incidentsQ.error}</div>
        ) : incidents.length === 0 ? (
          <div className="empty-state">{allIncidents.length === 0 ? "No incidents yet." : "No incidents match the current filters."}</div>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table style={{ minWidth: Math.max(700, visibleCols.length * 140) }}>
              <thead>
                <tr>{visibleCols.map((c) => <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id}>{visibleCols.map((c) => <td key={c.key}>{c.render(inc)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
