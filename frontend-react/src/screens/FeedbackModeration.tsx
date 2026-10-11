import React, { useState } from "react";
import { Link } from "../router";
import { useAuth } from "../AuthContext";
import { FeedbackRow, feedbackApi } from "../configApi";
import { useAsync } from "../hooks";
import { ErrorBar, errMsg, formatDate } from "../components/configKit";

type Status = "Published" | "Flagged" | "Hidden" | "Pending";
const statusOf = (f: FeedbackRow): Status => (f.flagged ? "Flagged" : !f.moderated ? "Pending" : f.published ? "Published" : "Hidden");

function Stars({ rating }: { rating: number }) {
  return <span className="feedback-stars">{"★".repeat(rating)}{"☆".repeat(5 - rating)}</span>;
}
function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function avatarColor(initials: string) {
  const colors = [{ bg: "#EFF4FC", color: "#175CD3" }, { bg: "#ECFDF3", color: "#067647" }, { bg: "#FFFAEB", color: "#B45309" }, { bg: "#FEF3F2", color: "#B42318" }];
  return colors[initials.charCodeAt(0) % colors.length];
}

export function FeedbackModerationPage() {
  const { user } = useAuth();
  const canModerate = user?.role === "ADMIN" || user?.role === "RESOLVER";
  const { data, loading, error, reload } = useAsync(() => feedbackApi.list(), []);
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const items = data ?? [];
  const q = query.trim().toLowerCase();
  const filtered = items.filter((i) => {
    if (pendingOnly && i.moderated) return false;
    if (!q) return true;
    return [i.submittedBy, i.incidentRef, i.comment].some((s) => s.toLowerCase().includes(q));
  });

  const apply = async (f: FeedbackRow, patch: { published?: boolean; flagged?: boolean }) => {
    setBusy(f.incidentId); setErr("");
    try { await feedbackApi.moderate(f.incidentId, { note: f.moderatorNote, ...patch }); reload(); }
    catch (e) { setErr(errMsg(e, "Unable to update feedback.")); }
    finally { setBusy(null); }
  };

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">User &gt; Feedback Moderation</div>
          <div className="page-title">Feedback Moderation</div>
          <div className="page-subtitle">Review requester feedback on closed incidents and moderate what&apos;s visible to the team.</div>
        </div>
        <button className="btn-ghost" onClick={() => window.history.back()}>Close</button>
      </div>

      <div className="page-body">
        <ErrorBar msg={error ?? err} />
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "16px 20px" }}>
            <div className="proto-eyebrow"><div className="proto-eyebrow-title"><span>&#9733;</span>&nbsp; FEEDBACK ( {loading ? "…" : items.length} )</div></div>
          </div>
          <div style={{ padding: "0 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="proto-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
                style={{ position: "absolute", left: 10, color: "var(--muted-2)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input className="proto-search" placeholder="Search by incident, submitter, comment…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <label className="proto-check-filter">
              <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} /> Pending review only
            </label>
          </div>

          <div style={{ padding: "0 20px 20px" }}>
            {loading ? <div className="spinner-row">Loading…</div> : filtered.length === 0 ? <div className="empty-state">No feedback found.</div> : filtered.map((f) => {
              const initials = initialsOf(f.submittedBy);
              const c = avatarColor(initials);
              const st = statusOf(f);
              return (
                <div key={f.incidentId} className="feedback-row">
                  <div className="user-avatar" style={{ background: c.bg, color: c.color }}>{initials}</div>
                  <div className="feedback-content">
                    <div className="feedback-meta">
                      <strong>{f.submittedBy}</strong> on <Link to={user?.role === "END_USER" ? `/my-incidents/${f.incidentId}` : `/incidents/${f.incidentId}`}>{f.incidentRef}</Link>
                      {" · "}{formatDate(f.date)}
                    </div>
                    <div className="feedback-quote">{f.comment ? `"${f.comment}"` : <i>No written comment.</i>}</div>
                  </div>
                  <div className="feedback-right">
                    <Stars rating={f.rating} />
                    <span className={`fb-pill ${st.toLowerCase()}`}>{st}</span>
                    {canModerate && (
                      <span style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button className="btn-ghost btn-sm" disabled={busy === f.incidentId || (f.moderated && f.published && !f.flagged)}
                          onClick={() => void apply(f, { published: true, flagged: false })}>Publish</button>
                        <button className="btn-ghost btn-sm" disabled={busy === f.incidentId || f.flagged}
                          onClick={() => void apply(f, { flagged: true, published: false })}>Flag</button>
                        <button className="btn-ghost btn-sm" disabled={busy === f.incidentId || (f.moderated && !f.published && !f.flagged)}
                          onClick={() => void apply(f, { published: false, flagged: false })}>Hide</button>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
