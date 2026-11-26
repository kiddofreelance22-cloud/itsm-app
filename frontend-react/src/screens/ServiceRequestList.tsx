import { useAuth } from "../AuthContext";
import React, { useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Link, useRouteParams } from "../router";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, SearchBox, errMsg, formatDateTime } from "../components/configKit";
import { requestLifecycleApi, serviceRequestApi, type ServiceRequest } from "../requestsApi";
import { ApprovalChain, Facts, Panel, SlaBadge, StatusPill, Stars, Timeline, money, requestNo, useRequestStatuses } from "../components/serviceRequestKit";

const PAGE_SIZE = 10;
type StageOf = (status: string) => string | undefined;
const FILTERS: [string, string, (r: ServiceRequest, stage: StageOf) => boolean][] = [
  ["all", "All", () => true],
  ["confirm", "Needs your confirmation", (r, st) => st(r.status) === "done"],
  ["open", "In progress", (r, st) => !["done", "closed", "stopped"].includes(st(r.status) ?? "")],
  ["done", "Finished", (r, st) => ["closed", "stopped"].includes(st(r.status) ?? "")],
];

/** My Service Requests: the requester's own list on the left, the selected request on the right. */
export function ServiceRequestListPage() {
  const params = useRouteParams("/service-requests/my-requests/:id");
  const requestId = params ? Number(params.id) : 0;
  return (
    <>
      <PageHeader crumb="User > My Service Requests" title="My Service Requests" subtitle="Track each request from approval to delivery, then confirm it to close." />
      <div className="page-body">
        <div className="sr-split">
          <MyRequestList selectedId={requestId} />
          <div className="sr-split-detail">
            {requestId ? <MyRequestRecord key={requestId} requestId={requestId} /> : <div className="card sr-panel"><div className="empty-state">Select a request on the left to see its progress, activity and fulfilment.</div></div>}
          </div>
        </div>
      </div>
    </>
  );
}

function expectedBy(r: ServiceRequest, stage: StageOf): string {
  const st = stage(r.status);
  if (st === "done") return r.autoCloseAt ? `Confirm by ${formatDateTime(r.autoCloseAt)}` : "Awaiting your confirmation";
  if (st === "closed" || st === "stopped") return "—";
  return r.slaFulfilmentTarget ? formatDateTime(r.slaFulfilmentTarget) : "—";
}

function MyRequestList({ selectedId }: { selectedId: number }) {
  const { user: me } = useAuth();
  const list = useAsync(() => serviceRequestApi.mine(), []);
  const statusRows = useRequestStatuses();
  const stage: StageOf = (name) => statusRows.find((x) => x.statusName === name)?.stage;
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const rows = list.data ?? [];

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k, , fn]) => [k, rows.filter((r) => fn(r, stage)).length])), [rows, statusRows]);
  const visible = useMemo(() => {
    const fn = FILTERS.find(([k]) => k === filter)?.[2] ?? (() => true);
    const q = query.trim().toLowerCase();
    return rows.filter((r) => fn(r, stage)).filter((r) => !q || requestNo(r).toLowerCase().includes(q) || r.catalog?.catalogName.toLowerCase().includes(q));
  }, [rows, filter, query, statusRows]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const shown = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="card sr-split-list">
      <ErrorBar msg={list.error ?? ""} />
      <div style={{ padding: "14px 16px 10px", display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 0 }}><SearchBox value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Search by request number or item…" /></div>
        <Link to="/service-requests" className="btn-primary" aria-label="New request"><Plus size={14} aria-hidden="true" /> New</Link>
      </div>
      <div className="sr-chips" style={{ padding: "0 16px 10px" }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" className={`sr-chip${filter === k ? " active" : ""}`} onClick={() => { setFilter(k); setPage(1); }}>
            {label}<span className="n">{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>
      {list.loading ? <div className="spinner-row">Loading…</div> : shown.length === 0 ? (
        <div className="empty-state">{rows.length ? "No requests in this view." : "You have not raised any requests yet."}</div>
      ) : (
        <ul className="sr-split-rows">
          {shown.map((r) => {
            const done = (r.approvals ?? []).filter((a) => a.status === "Approved").length;
            const sel = r.requestId === selectedId;
            return (
              <li key={r.requestId}>
                <Link to={`/service-requests/my-requests/${r.requestId}`} className={`sr-split-row${sel ? " active" : ""}`} aria-current={sel ? "true" : undefined}>
                  <div className="top"><strong>{requestNo(r)}</strong><StatusPill status={r.status} subStatus={r.subStatus} /></div>
                  <div className="item">{r.catalog?.catalogName}</div>
                  {(() => { const mine = String(r.requestedBy?.userId) === String(me?.id); if (mine && r.submittedBy && r.submittedBy.userId !== r.requestedBy?.userId) return <div style={{ fontSize: 12, color: "var(--muted)" }}>Submitted for you by {r.submittedBy.fullName}</div>; if (!mine && r.requestedBy) return <div style={{ fontSize: 12, color: "var(--muted)" }}>For {r.requestedBy.fullName}</div>; return null; })()}
                  <div className="meta">
                    {r.status === "Pending Approval" && (r.approvals ?? []).length > 0 ? `${done} of ${r.approvals!.length} approved · ` : ""}
                    {expectedBy(r, stage) !== "—" ? `Expected ${expectedBy(r, stage)}` : `Opened ${formatDateTime(r.createdAt)}`}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 && (
        <div className="sr-pager"><span>Page {page} of {pages}</span>
          <span style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
          </span></div>
      )}
    </div>
  );
}

function MyRequestRecord({ requestId }: { requestId: number }) {
  const detail = useAsync(() => requestLifecycleApi.detail(requestId), [requestId]);
  const statusRows = useRequestStatuses();
  const stageOf = (name: string) => statusRows.find((x) => x.statusName === name)?.stage ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"" | "reopen" | "cancel">("");
  const [text, setText] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);
  const [ratingText, setRatingText] = useState("");
  const r = detail.data;

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setError(""); setBusy(true);
    try { await fn(); after?.(); detail.reload(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  if (detail.loading && !r) return <div className="spinner-row">Loading…</div>;
  if (!r) return <ErrorBar msg={detail.error ?? "Request not found."} />;

  const lastReject = [...(r.approvals ?? [])].reverse().find((a) => a.status === "Rejected");
  const infoRequested = (r.approvals ?? []).find((a) => a.status === "Info requested");
  const answeringApproval = r.status === "Returned" && !!infoRequested;
  const canCancel = ["Pending Approval", "Approved"].includes(r.status);
  const rated = !!r.feedbackSubmittedAt;
  const clearMode = () => { setMode(""); setText(""); };

  return (
    <>
      <div className="sr-split-title">
        <Link to="/service-requests/my-requests" className="btn-ghost sr-split-back"><ArrowLeft size={14} aria-hidden="true" /> All requests</Link>
        <h2>{requestNo(r)} — {r.catalog.catalogName}</h2>
        <div>{r.catalog.category?.categoryName ?? ""}{r.catalog.category?.categoryName ? " · " : ""}Opened {formatDateTime(r.createdAt)}</div>
      </div>
      <div>
        <ErrorBar msg={error || detail.error || ""} />

        {r.status === "Fulfilled" && (
          <div className="sr-notice" style={{ marginBottom: 16 }}>
            Fulfilled{r.fulfilledAt ? ` on ${formatDateTime(r.fulfilledAt)}` : ""}. Please confirm it is resolved, or reopen it.{" "}
            {r.autoCloseAt && <>It will close automatically on {formatDateTime(r.autoCloseAt)} if you do not respond.</>}
          </div>
        )}
        {r.status === "Rejected" && <div className="sr-notice warn" style={{ marginBottom: 16 }}>Rejected at {lastReject?.title ?? "approval"}{lastReject?.comments ? `: ${lastReject.comments}` : "."}</div>}
        {r.status === "Approved" && <div className="sr-notice" style={{ marginBottom: 16 }}>Approved. It is waiting for the fulfilment team to take it.</div>}
        {r.status === "On Hold" && <div className="sr-notice warn" style={{ marginBottom: 16 }}>On hold{r.pendingReason ? `: ${r.pendingReason.pendingReasonName}` : r.subStatus ? `: ${r.subStatus}` : ""}.{r.holdNotes ? ` ${r.holdNotes}` : ""}</div>}

        <div className="card sr-panel" style={{ marginBottom: 16 }}>
          <div className="sr-actions">
            <StatusPill status={r.status} subStatus={r.subStatus} />
            {["queue", "work", "hold", "done"].includes(stageOf(r.status)) && <SlaBadge state={r.sla?.state} />}
            <span style={{ flex: 1 }} />
            {r.status === "Fulfilled" && <>
              <button className="btn-primary" disabled={busy} onClick={() => void run(() => requestLifecycleApi.close(requestId))}>Confirm and close</button>
              <button className="btn-ghost" disabled={busy} onClick={() => setMode(mode === "reopen" ? "" : "reopen")}>Not resolved — reopen</button>
            </>}
            {canCancel && <button className="btn-ghost" disabled={busy} onClick={() => setMode(mode === "cancel" ? "" : "cancel")}>Cancel request</button>}
          </div>
          {mode && (
            <div className="sr-form">
              <label className="field-group"><span className="lbl">{mode === "reopen" ? "What is still wrong?" : "Reason (optional)"}{mode === "reopen" && <span className="req"> *</span>}</span>
                <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} /></label>
              <div className="sr-actions">
                <button className="btn-primary" disabled={busy || (mode === "reopen" && !text.trim())}
                  onClick={() => void run(() => mode === "reopen" ? requestLifecycleApi.reopen(requestId, text.trim()) : serviceRequestApi.cancel(requestId, text.trim() || undefined), clearMode)}>
                  {mode === "reopen" ? "Reopen request" : "Confirm cancellation"}</button>
                <button className="btn-ghost" onClick={clearMode}>Back</button>
              </div>
            </div>
          )}
        </div>

        <div className="sr-record sr-record-narrow">
          <div className="sr-stack">
            <Panel title="Request details">
              <Facts rows={[
                ["Item", r.catalog.catalogName], ["Requested by", r.requestedBy?.fullName], ["Opened", formatDateTime(r.createdAt)],
                ["Estimated cost", money(r.estimatedCost)],
                ...(r.variableValues ?? []).map((v) => [v.variable.label, v.value] as [string, React.ReactNode]),
              ]} />
            </Panel>
            <Panel title="Activity">
              {answeringApproval && (
                <div className="sr-notice warn" style={{ marginBottom: 12 }}>
                  <strong>{infoRequested.title} asked:</strong> {infoRequested.comments} Posting your answer here sends the request back to this approver.
                </div>
              )}
              <div className="sr-form" style={{ marginTop: 0, marginBottom: 14 }}>
                <textarea className="textarea" placeholder={answeringApproval ? "Write your answer to the approver…" : "Add a comment for the fulfilment team…"} value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="sr-actions"><button className="btn-primary" disabled={busy || !comment.trim()} onClick={() => void run(() => requestLifecycleApi.comment(requestId, comment.trim()), () => setComment(""))}>{answeringApproval ? "Send answer to approver" : "Post"}</button></div>
              </div>
              <Timeline history={r.history} />
            </Panel>
          </div>
          <div className="sr-stack">
            <Panel title="Approval progress"><ApprovalChain approvals={r.approvals} status={r.status} /></Panel>
            <Panel title="Fulfilment">
              <Facts rows={[
                ["Assigned to", r.assignedTo?.fullName ?? "Not assigned yet"], ["Team", r.assignmentGroup?.groupName],
                ["Estimated delivery", ["done", "closed", "stopped"].includes(stageOf(r.status)) ? "—" : formatDateTime(r.slaFulfilmentTarget)],
                ...(r.fulfilledAt ? [["Outcome", r.closureCode?.closureCodeName] as [string, React.ReactNode], ["Notes", r.fulfilmentNotes] as [string, React.ReactNode]] : []),
              ]} />
            </Panel>
            {["Fulfilled", "Closed"].includes(r.status) && (
              <Panel title="Rate the service">
                {rated ? (<><Stars value={r.feedbackRating ?? 0} />{r.feedbackComment && <p style={{ fontSize: 13, margin: "8px 0 0" }}>{r.feedbackComment}</p>}</>) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    <Stars value={rating} onChange={setRating} />
                    <textarea className="textarea" placeholder="Anything we should know? (optional)" value={ratingText} onChange={(e) => setRatingText(e.target.value)} />
                    <div><button className="btn-primary" disabled={busy || !rating} onClick={() => void run(() => requestLifecycleApi.rate(requestId, rating, ratingText.trim() || undefined))}>Submit rating</button></div>
                  </div>
                )}
              </Panel>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
