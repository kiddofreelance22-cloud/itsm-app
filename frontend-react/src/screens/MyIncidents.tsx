import React, { useMemo, useState } from "react";
import { Filter, Plus, Search, X } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { Link } from "../router";
import { ErrorBar, errMsg } from "../components/configKit";
import { Pill, Raw, StarPicker, USER_PRIORITY_STYLE, USER_STATUS_STYLE, fmtDate, stars, userClosureCode, userStatus } from "../components/endUser";

const PAGE = 10;
const RANGES: Record<string, number> = { "Any time": 0, "Last 7 days": 7, "Last 30 days": 30, "Last 90 days": 90 };
type Tab = "All" | "Open" | "Resolved" | "Closed";

export function MyIncidentsPage() {
  const { data, loading, error, reload } = useAsync(() => api.get<Raw[]>("/incidents/mine"), []);
  const cats = useAsync(() => api.get<Raw[]>("/categories").catch(() => []), []);
  const codes = useAsync(() => api.get<Raw[]>("/closure-codes").catch(() => []), []);
  const [tab, setTab] = useState<Tab>("All");
  const [q, setQ] = useState("");
  const [panel, setPanel] = useState(false);
  const [draft, setDraft] = useState({ category: "", priority: "", range: "Any time" });
  const [applied, setApplied] = useState({ category: "", priority: "", range: "Any time" });
  const [page, setPage] = useState(1);
  const [closing, setClosing] = useState<Raw | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const rows = data ?? [];
  const label = (r: Raw) => userStatus(r.status);
  const stat = (n: string) => rows.filter((r) => label(r) === n).length;
  const inTab = (r: Raw, t: Tab) => t === "All" || (t === "Open" ? !["Resolved", "Closed", "Cancelled"].includes(r.status) : r.status === t);
  const activeFilters = [applied.category, applied.priority, applied.range !== "Any time" ? applied.range : ""].filter(Boolean).length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cutoff = RANGES[applied.range] ? Date.now() - RANGES[applied.range] * 86400000 : 0;
    return rows.filter((r) => inTab(r, tab)
      && (!applied.category || r.category?.categoryName === applied.category)
      && (!applied.priority || r.priority === applied.priority)
      && (!cutoff || new Date(r.createdAt).getTime() >= cutoff)
      && (!needle || [r.incidentCode, r.incidentId, r.title, r.description].some((s) => String(s ?? "").toLowerCase().includes(needle))));
  }, [rows, tab, q, applied]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  const shown = filtered.slice((cur - 1) * PAGE, cur * PAGE);

  const confirmClose = async () => {
    if (!closing) return;
    if (!rating) { setErr("Please rate your experience before closing."); return; }
    setBusy(true); setErr("");
    try {
      const code = userClosureCode(codes.data);
      await api.patch(`/incidents/${encodeURIComponent(closing.incidentId)}`, { status: "Closed", feedbackRating: rating, feedbackComment: comment.trim() || undefined, ...(code ? { closureCode: code } : {}) });
      setClosing(null); setRating(0); setComment(""); reload();
    } catch (e) { setErr(errMsg(e, "Unable to close this incident.")); }
    finally { setBusy(false); }
  };

  const tabBtn = (t: Tab, n: number) => (
    <button key={t} type="button" onClick={() => { setTab(t); setPage(1); }} style={{ padding: "10px 4px", marginRight: 22, border: "none", background: "transparent", cursor: "pointer", fontSize: 13.5,
      fontWeight: tab === t ? 700 : 500, color: tab === t ? "#175CD3" : "#667085", borderBottom: `2px solid ${tab === t ? "#175CD3" : "transparent"}` }}>{t} ({n})</button>
  );

  return (
    <div className="dash-page">
      <div className="dash-header">
        <div className="dash-crumb">User <span className="sep">&gt;</span> <span className="cur">My Incidents</span></div>
        <div className="dash-head-row">
          <div><div className="dash-title">My Incidents</div><div className="dash-sub">Everything you&apos;ve reported, in one place.</div></div>
          <Link to="/new-incident" className="dash-btn"><Plus size={13} strokeWidth={2.2} />Report New Incident</Link>
        </div>
      </div>
      <div className="dash-stats">
        {[["Total Reported", rows.length, undefined], ["New", stat("New"), undefined], ["In Progress", rows.filter((r) => !["Open", "Resolved", "Closed", "Cancelled"].includes(r.status)).length, "#175CD3"], ["Resolved", stat("Resolved"), "#067647"], ["Closed", stat("Closed"), "#667085"]].map(([l, n, c]) => (
          <div className="dash-stat" key={l as string}><div className="dash-stat-num" style={c ? { color: c as string } : undefined}>{loading ? "–" : (n as number)}</div><div className="dash-stat-label">{l as string}</div></div>
        ))}
      </div>
      <div className="dash-body" style={{ flexDirection: "column", gap: 0 }}>
        <ErrorBar msg={error ?? ""} />
        <div className="dash-card" style={{ overflow: "visible" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", borderBottom: "1px solid #EDEFF2", flexWrap: "wrap", gap: 8 }}>
            <div>{tabBtn("All", rows.length)}{tabBtn("Open", rows.filter((r) => inTab(r, "Open")).length)}{tabBtn("Resolved", stat("Resolved"))}{tabBtn("Closed", stat("Closed"))}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", position: "relative" }}>
              <div className="proto-search-wrap" style={{ width: 240 }}>
                <Search size={14} aria-hidden="true" style={{ position: "absolute", left: 10, color: "var(--muted-2)" }} />
                <input className="proto-search" placeholder="Search incidents…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search incidents" />
              </div>
              <button type="button" className="btn-ghost" onClick={() => { setDraft(applied); setPanel(!panel); }} aria-expanded={panel} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Filter size={13} /> Filters{activeFilters > 0 && <span className="chip" style={{ fontSize: 11 }}>{activeFilters}</span>}
              </button>
              {panel && (
                <div className="card" role="dialog" aria-label="Filter Incidents" style={{ position: "absolute", right: 0, top: 46, width: 300, padding: 18, zIndex: 20, boxShadow: "0 8px 24px rgba(16,24,40,0.14)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <b style={{ fontSize: 14 }}>Filter Incidents</b>
                    <button type="button" className="admin-master-icon-button" aria-label="Close filters" onClick={() => setPanel(false)}><X size={14} /></button>
                  </div>
                  <label className="field-group"><span className="lbl">Category</span>
                    <select className="select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                      <option value="">All Categories</option>{(cats.data ?? []).filter((c) => c.isActive !== false).map((c) => <option key={c.categoryId}>{c.categoryName}</option>)}</select></label>
                  <label className="field-group"><span className="lbl">Priority</span>
                    <select className="select" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
                      <option value="">All Priorities</option>{["Critical", "High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}</select></label>
                  <label className="field-group"><span className="lbl">Created Date</span>
                    <select className="select" value={draft.range} onChange={(e) => setDraft({ ...draft, range: e.target.value })}>{Object.keys(RANGES).map((r) => <option key={r}>{r}</option>)}</select></label>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
                    <button type="button" className="btn-ghost" onClick={() => { const z = { category: "", priority: "", range: "Any time" }; setDraft(z); setApplied(z); setPage(1); setPanel(false); }}>Clear all</button>
                    <button type="button" className="btn-primary" onClick={() => { setApplied(draft); setPage(1); setPanel(false); }}>Apply Filters</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="dash-scroll" style={{ maxHeight: "none", overflowX: "auto" }}>
            <table className="dash-table" style={{ minWidth: 1500 }}>
              <thead><tr>
                {["Incident Number", "Short Description", "Description", "Category", "Priority", "Status", "Assigned Workgroup", "Assigned Agent", "Created Date", "Resolution Notes", "Closure Code", "Feedback / Rating", "Actions"].map((h) => <th key={h}>{h}</th>)}
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={13} className="dash-empty">Loading…</td></tr> : shown.length === 0 ? <tr><td colSpan={13} className="dash-empty">{rows.length ? "No incidents match your search or filters." : "You haven't reported any incidents yet."}</td></tr> : shown.map((r) => (
                  <tr key={r.incidentId}>
                    <td><Link to={`/my-incidents/${r.incidentId}`} className="num">{r.incidentCode ?? r.incidentId}</Link></td>
                    <td style={{ minWidth: 200 }}>{r.title}</td>
                    <td style={{ minWidth: 220, color: "#667085" }}>{r.description ? (r.description.length > 80 ? r.description.slice(0, 80) + "…" : r.description) : "—"}</td>
                    <td>{r.category?.categoryName ?? "—"}</td>
                    <td>{r.priority ? <Pill text={r.priority} st={USER_PRIORITY_STYLE[r.priority]} /> : "—"}</td>
                    <td><Pill text={label(r)} st={USER_STATUS_STYLE[label(r)]} /></td>
                    <td>{r.assignmentGroup?.groupName ?? "—"}</td>
                    <td>{r.assignedTo?.fullName ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.createdAt)}</td>
                    <td style={{ minWidth: 200, color: "#667085" }}>{r.resolutionNotes ? (r.resolutionNotes.length > 60 ? r.resolutionNotes.slice(0, 60) + "…" : r.resolutionNotes) : "—"}</td>
                    <td>{r.closureCode ?? "—"}</td>
                    <td><span className="dash-stars">{stars(r.feedbackRating)}</span></td>
                    <td>{r.status === "Resolved" ? <button type="button" className="btn-primary btn-sm" onClick={() => { setClosing(r); setRating(0); setComment(""); setErr(""); }}>Close</button> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderTop: "1px solid #EDEFF2", fontSize: 12.5, color: "#667085" }}>
            <span>{filtered.length === 0 ? "0 incidents" : `Showing ${(cur - 1) * PAGE + 1}–${Math.min(cur * PAGE, filtered.length)} of ${filtered.length} incidents`}</span>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <button type="button" className="btn-ghost btn-sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Previous page">‹</button>
              <b>{cur}</b> / {pages}
              <button type="button" className="btn-ghost btn-sm" disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Next page">›</button>
            </span>
          </div>
        </div>
      </div>

      {closing && (
        <div role="dialog" aria-modal="true" aria-label="Close incident" style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
          <div className="card" style={{ width: 460, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Close {closing.incidentCode ?? closing.incidentId}?</div>
            <div style={{ fontSize: 13, color: "#667085", margin: "8px 0 14px" }}>Once closed, this incident can&apos;t be reopened — you&apos;ll need to raise a new one if the issue comes back. Please rate your experience first.</div>
            <div style={{ marginBottom: 12 }}><StarPicker value={rating} onChange={setRating} /></div>
            <label className="field-group"><span className="lbl">Anything else to add? (optional)</span><textarea className="textarea" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
            <ErrorBar msg={err} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button type="button" className="btn-ghost" onClick={() => setClosing(null)}>Cancel</button>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void confirmClose()}>{busy ? "Closing…" : "Confirm & Close"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
