import React, { useState } from "react";
import { Link, useRouteParams } from "../router";
import { useAuth } from "../AuthContext";
import { ApprovalRequest, approvalApi } from "../configApi";
import { useAsync } from "../hooks";
import { ErrorBar, errMsg, formatDate } from "../components/configKit";

function ApprovalPill({ status }: { status: ApprovalRequest["status"] }) {
  return <span className={`approval-pill ${status.toLowerCase()}`}>{status}</span>;
}

export function ApproveIncidentRecordsPage() {
  const { user } = useAuth();
  const focusedApprovalId = useRouteParams("/incident-approvals/:id")?.id;
  const canDecide = user?.role === "ADMIN" || user?.role === "RESOLVER";
  const { data, loading, error, reload } = useAsync(() => approvalApi.list(), []);
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const items = data ?? [];
  const q = query.trim().toLowerCase();
  const filtered = items.filter((i) => {
    if (focusedApprovalId && String(i.approvalId) !== focusedApprovalId) return false;
    if (pendingOnly && i.status !== "Pending") return false;
    if (!q) return true;
    return [i.incidentRef, i.requestedBy, i.approvalType, i.shortDescription].some((s) => s.toLowerCase().includes(q));
  });

  const decide = async (id: number, kind: "approve" | "reject") => {
    let note = "";
    if (kind === "reject") {
      const r = window.prompt("Reason for rejecting (shown to the requester):", "");
      if (r === null) return;
      note = r;
    }
    setBusyId(id); setErr("");
    try { await (kind === "approve" ? approvalApi.approve(id, note) : approvalApi.reject(id, note)); reload(); }
    catch (e) { setErr(errMsg(e, `Unable to ${kind}.`)); }
    finally { setBusyId(null); }
  };

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">User &gt; Approve Incident Records</div>
          <div className="page-title">Approve Incident Records</div>
          <div className="page-subtitle">Review and decide on incidents awaiting your approval.</div>
        </div>
        <button className="btn-ghost" onClick={() => window.history.back()}>Close</button>
      </div>

      <div className="page-body">
        <ErrorBar msg={error ?? err} />
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "16px 20px" }}>
            <div className="proto-eyebrow">
              <div className="proto-eyebrow-title"><span>&#10003;</span>&nbsp; APPROVAL REQUESTS ( {loading ? "…" : items.length} )</div>
            </div>
          </div>
          <div style={{ padding: "0 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="proto-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
                style={{ position: "absolute", left: 10, color: "var(--muted-2)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input className="proto-search" placeholder="Search by incident, requester, approval type…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <label className="proto-check-filter">
              <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} /> Pending only
            </label>
          </div>

          <div className="admin-master-table-scroll">
            <table style={{ minWidth: 860 }}>
              <thead><tr>
                <th style={{ width: 130 }}>INCIDENT</th><th>REQUEST</th><th style={{ width: 200 }}>REQUESTED BY</th>
                <th style={{ width: 110 }}>STATUS</th><th style={{ width: 160 }}>ACTIONS</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="empty-state">Loading…</td></tr>
                  : filtered.length === 0 ? <tr><td colSpan={5} className="empty-state">No approval requests found.</td></tr>
                  : filtered.map((a) => (
                    <tr key={a.approvalId}>
                      <td><Link to={user?.role === "END_USER" ? `/my-incidents/${a.incidentId}` : `/incidents/${a.incidentId}`} className="inc-link">{a.incidentRef}</Link></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{a.approvalType}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{a.shortDescription}</div>
                        {a.approverNote && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Note: {a.approverNote}</div>}
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{a.requestedBy}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{formatDate(a.requestedAt)}</div>
                      </td>
                      <td><ApprovalPill status={a.status} /></td>
                      <td>
                        {a.status === "Pending" && canDecide && String((a as any).requestedById) !== String(user?.id) && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn-primary btn-sm" disabled={busyId === a.approvalId} onClick={() => void decide(a.approvalId, "approve")}>Approve</button>
                            <button className="btn-ghost btn-sm" disabled={busyId === a.approvalId} onClick={() => void decide(a.approvalId, "reject")}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
