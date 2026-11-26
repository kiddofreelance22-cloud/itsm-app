import React, { useEffect, useState } from "react";
import { Link, useRouteParams, useRouter } from "../router";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, errMsg, formatDateTime } from "../components/configKit";
import { api, ApiError } from "../api";
import { requestLifecycleApi, type ApprovalItem } from "../requestsApi";
import { ApprovalChain, Pill, PriorityBadge, money } from "../components/serviceRequestKit";

const tone = (s: ApprovalItem["state"]) =>
  s === "Awaiting me" || s === "Responded, waiting for others"
    ? "amber"
    : s === "Approved"
      ? "green"
      : s === "Rejected"
        ? "red"
        : "amber";

/** Approve Service Requests: the approvals waiting on me, and a review view to decide them. */
export function ServiceRequestApprovalsPage() {
  const list = useAsync(() => requestLifecycleApi.approvals(), []);
  const focusedId = useRouteParams("/service-requests/approvals/:id")?.id;
  const { navigate } = useRouter();
  const [pendingOnly, setPendingOnly] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<ApprovalItem | null>(null);
  const [flash, setFlash] = useState<{ text: string; toQueue: boolean } | null>(null);

  useEffect(() => {
    if (!focusedId || !list.data) return;
    const focused = list.data.find((item) => String(item.requestId) === focusedId);
    if (focused) setOpen(focused);
  }, [focusedId, list.data]);

  const query = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((r) =>
    (!pendingOnly || r.state === "Awaiting me" || r.state === "Responded, waiting for others") &&
    (!query || `${r.requestNumber} ${r.catalogName ?? ""} ${r.requestedBy ?? ""}`.toLowerCase().includes(query)));

  if (open) {
    return (
      <>
        <PageHeader crumb="User > Approve Service Requests" title="Approve Service Requests" subtitle="Requests that need your sign-off before fulfilment can start." />
        <div className="page-body">
          <div className="sr-review-head">
            <span className="sc-eyebrow">Review request — {open.requestNumber}</span>
            <button type="button" className="btn-ghost" onClick={() => { setOpen(null); navigate("/service-requests/approvals"); }}>Back to approvals</button>
          </div>
          <ReviewPanel item={open} onBack={() => { setOpen(null); navigate("/service-requests/approvals"); }} onDone={(text, toQueue) => { setFlash({ text, toQueue }); setOpen(null); navigate("/service-requests/approvals"); list.reload(); }} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader crumb="User > Approve Service Requests" title="Approve Service Requests" subtitle="Requests that need your sign-off before fulfilment can start." />
      <div className="page-body">
        <ErrorBar msg={list.error ?? ""} />
        {flash && (
          <div className="service-request-notice" role="status" style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
            <span>{flash.text}</span>
            {flash.toQueue && <Link to="/service-requests/queue">Open the fulfilment queue</Link>}
          </div>
        )}
        <div className="sc-eyebrow" style={{ margin: "4px 0 10px" }}>Approval requests ({rows.length})</div>
        <div className="sr-approval-filters">
          <input className="sc-field" style={{ maxWidth: 340 }} type="search" aria-label="Search approval requests" placeholder="Search by SR number, service, requester…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="admin-master-check-label"><input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} /> Pending approvals</label>
        </div>
        <div className="sc-panel" style={{ overflow: "hidden" }}>
          {list.loading && !list.data ? <div className="spinner-row">Loading…</div> : rows.length === 0 ? (
            <div className="sc-empty">{(list.data ?? []).length === 0 || pendingOnly ? "Nothing is waiting on you. Clear the filter to see requests you have already decided." : "No approval requests match your search."}</div>
          ) : rows.map((r) => (
            <button type="button" key={`${r.requestId}-${r.levelNumber}`} className="sr-lrow" onClick={() => { setFlash(null); setOpen(r); }}>
              <span className="sr-lrow-num">{r.requestNumber}</span>
              <span className="sr-lrow-main"><b>{r.catalogName}</b><small>{r.category ?? "—"} · Est. cost {money(r.estimatedCost)}</small></span>
              <span className="sr-lrow-by"><b>{r.requestedBy ?? "—"}</b><small>{formatDateTime(r.createdAt)}</small></span>
              <span className="sr-lrow-stage">{r.stage}</span>
              <span><Pill tone={tone(r.state)}>{r.state}</Pill></span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function ReviewPanel({ item, onBack, onDone }: { item: ApprovalItem; onBack: () => void; onDone: (flash: string, toQueue: boolean) => void }) {
  const detail = useAsync(() => requestLifecycleApi.detail(item.requestId), [item.requestId]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const r = detail.data;
  const pendingLevel = r?.approvals?.find((approval) => approval.status === "Pending");

  const g = r?.guide ?? null;
  const policy = g?.comment ?? "reject";
  const noteHint = policy === "optional" ? "(optional)" : policy === "both" ? "(required to approve or reject)" : "(required to reject or to ask for information)";
  const noComment = !comment.trim();
  const approveBlocked = policy === "both" && noComment;
  const rejectBlocked = policy !== "optional" && noComment;
  const infoBlocked = noComment;
  const handleActionError = (error: unknown) => {
    if (error instanceof ApiError && error.code === "ALREADY_RESPONDED") {
      setError("");
      setComment("");
      detail.reload();
      return;
    }
    setError(errMsg(error));
  };
  const [delegateTo, setDelegateTo] = useState<{ id: number; name: string } | null>(null);
  const [dq, setDq] = useState(""); const [found, setFound] = useState<{ userId: number; fullName: string }[]>([]);
  useEffect(() => {
    if (delegateTo || dq.trim().length < 2) { setFound([]); return; }
    let live = true;
    const t = setTimeout(() => { api.get<{ userId: number; fullName: string }[]>(`/users/directory?q=${encodeURIComponent(dq.trim())}`).then((x) => { if (live) setFound(x); }).catch(() => { if (live) setFound([]); }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [dq, delegateTo]);

  const decide = async (action: "Approved" | "Rejected") => {
    if (action === "Rejected" && rejectBlocked) { setError("Add a comment so the requester knows why."); return; }
    if (action === "Approved" && approveBlocked) { setError("This step needs a comment to approve."); return; }
    setBusy(true); setError("");
    try {
      const after = await requestLifecycleApi.decide(
        item.requestId,
        action,
        comment.trim() || undefined,
        pendingLevel?.requestApprovalId,
      );
      const status = (after as { status?: string } | undefined)?.status;
      if (action === "Rejected") {
        if (status === "Returned") onDone(`${item.requestNumber} was sent back to the requester to change and resubmit.`, false);
        else if (status === "Pending Approval") onDone(`${item.requestNumber} was rejected and has moved to its next review.`, false);
        else onDone(`${item.requestNumber} was rejected. The requester has been told why.`, false);
      } else if (status === "Fulfilled") onDone(`You approved ${item.requestNumber}. It was fulfilled automatically, with no further work needed.`, true);
      else if (status === "Waiting") onDone(`You approved ${item.requestNumber}. It is paused for a set time and carries on by itself.`, false);
      else if (status && status !== "Pending Approval") onDone(`${item.requestNumber} is approved and has gone to the fulfilment queue.`, true);
      else onDone(`You approved ${item.requestNumber}. It now waits for the next approver.`, false);
    } catch (e) { handleActionError(e); } finally { setBusy(false); }
  };
  const askInfo = async () => {
    if (infoBlocked) { setError("Write your question in the comments box first."); return; }
    setBusy(true); setError("");
    try { await requestLifecycleApi.requestInfo(item.requestId, comment.trim()); onDone(`You asked ${r?.requestedBy?.fullName ?? "the requester"} for more information on ${item.requestNumber}. It comes back to you when they answer.`, false); }
    catch (e) { handleActionError(e); } finally { setBusy(false); }
  };
  const handOver = async () => {
    if (!delegateTo) return;
    setBusy(true); setError("");
    try { await requestLifecycleApi.delegate(item.requestId, delegateTo.id, comment.trim() || undefined); onDone(`${item.requestNumber} was delegated to ${delegateTo.name}. It is now waiting on them.`, false); }
    catch (e) { handleActionError(e); } finally { setBusy(false); }
  };

  if (!r) return <div className="sc-panel" style={{ padding: 20 }}>{detail.error ? <ErrorBar msg={detail.error} /> : "Loading…"}</div>;
  const days = Number(r.catalog?.deliveryTimeSla ?? r.catalog?.estimatedTime) || 0;
  const group = r.assignmentGroup?.groupName ?? r.catalog?.fulfillmentGroup?.groupName ?? r.catalog?.assignmentGroup?.groupName ?? "—";
  const fact = (label: string, v: React.ReactNode) => <div><div className="lbl">{label}</div><div className="sr-fact">{v}</div></div>;
  const canDecide = item.state === "Awaiting me" && !!pendingLevel?.canAct && r.viewer.canApprove;
  const myInfoRequest = [...(r.approvals ?? [])]
    .reverse()
    .find((approval) => approval.myVoteStatus === "Info requested");

  return (
    <div className="sc-panel sr-review">
      <div className="sr-review-facts">
        {fact("Service requested", r.catalog?.catalogName)}
        {fact("Requested by", <>{r.requestedBy?.fullName ?? "—"} <span className="sr-muted">· {formatDateTime(r.createdAt)}</span></>)}
        {fact("Estimated cost", money(r.estimatedCost))}
        {fact("Priority", <PriorityBadge name={r.priority?.priorityName ?? item.priority} color={r.priority?.color} />)}
        {fact("Fulfilment group", group)}
        {fact("Delivery target", days ? `${days} business ${days > 1 ? "days" : "day"}` : "—")}
      </div>
      <div>
        <div className="sc-eyebrow" style={{ marginBottom: 8 }}>Approval chain</div>
        <ApprovalChain approvals={r.approvals} status={r.status} />
      </div>
      <div>
        <div className="sc-eyebrow" style={{ marginBottom: 8 }}>Request details</div>
        <div className="sr-details">
          {(r.variableValues ?? []).map((v, i) => <div key={i}><strong>{v.variable.label}:</strong> {v.value}</div>)}
          {(r.variableValues ?? []).length === 0 && <span className="sr-muted">No extra details were entered.</span>}
        </div>
      </div>
      {(() => {
        // Everything people wrote on this request (the requester's answers included), oldest first.
        const notes = [...(r.history ?? [])].filter((h) => (h.comments ?? "").trim()).sort((a, b) => new Date(a.actionAt).getTime() - new Date(b.actionAt).getTime());
        return (
          <div>
            <div className="sc-eyebrow" style={{ marginBottom: 8 }}>Comments &amp; activity</div>
            {notes.length === 0 ? <span className="sr-muted">No comments yet.</span> : (
              <div style={{ display: "grid", gap: 8 }}>
                {notes.map((h) => {
                  const mine = h.actionBy?.userId != null && h.actionBy.userId === r.requestedBy?.userId;
                  return (
                    <div key={h.historyId} style={{ border: "1px solid #E4E7EC", borderLeft: `3px solid ${mine ? "#175CD3" : "#98A2B3"}`, borderRadius: 8, padding: "8px 12px", background: mine ? "#F5FAFF" : "#FCFCFD" }}>
                      <div style={{ fontSize: 12, color: "#475467", marginBottom: 2 }}>
                        <strong>{h.actionBy?.fullName ?? "System"}</strong>{mine ? " (requester)" : ""} · {h.action} · {formatDateTime(h.actionAt)}
                      </div>
                      <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{h.comments}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
      <ErrorBar msg={error} />
      {canDecide ? (
        <>
          <div>
            <label className="lbl" htmlFor="ap-note">Decision comments <span className="sr-muted">{noteHint}</span></label>
            <textarea id="ap-note" className="textarea" placeholder="Add a note to go with your decision..." value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {g && (
            <div style={{ border: "1px solid #E4E7EC", borderRadius: 8, padding: "9px 12px", fontSize: 12, lineHeight: 1.6, color: "#344054", background: "#FCFCFD" }}>
              <div><span style={{ fontWeight: 700, color: "#067647" }}>If you approve:</span> {g.ifApprove}</div>
              {g.canReject && <div><span style={{ fontWeight: 700, color: "#B42318" }}>If you reject:</span> {g.ifReject}</div>}
              {g.canInfo && <div><span style={{ fontWeight: 700, color: "#175CD3" }}>If you request information:</span> the request goes back to the requester with your question and returns to you when they answer.</div>}
              {g.timing && <div><span style={{ fontWeight: 700, color: "#B54708" }}>If nobody decides:</span> {g.timing}</div>}
            </div>
          )}
          <div className="sr-actions">
            <button type="button" className="sc-btn primary" disabled={busy || approveBlocked} onClick={() => void decide("Approved")}>Approve</button>
            {(g?.canReject ?? true) && <button type="button" className="sc-btn danger" disabled={busy || rejectBlocked} onClick={() => void decide("Rejected")}>Reject</button>}
            {g?.canInfo && <button type="button" className="sc-btn" disabled={busy || infoBlocked} onClick={() => void askInfo()}>Request info</button>}
            <button type="button" className="sc-btn" disabled={busy} onClick={onBack}>Cancel</button>
          </div>
          {g?.canDelegate && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              {delegateTo ? <span className="sr-member">{delegateTo.name}<button type="button" aria-label="Clear delegate" onClick={() => setDelegateTo(null)}>x</button></span> : (
                <div style={{ position: "relative" }}>
                  <input className="sc-field" style={{ maxWidth: 240 }} aria-label="Delegate to" placeholder="Delegate to..." value={dq} onChange={(e) => setDq(e.target.value)} />
                  {found.length > 0 && <div className="sr-suggest">{found.map((u) => <button key={u.userId} type="button" onClick={() => { setDelegateTo({ id: u.userId, name: u.fullName }); setDq(""); setFound([]); }}>{u.fullName}</button>)}</div>}
                </div>)}
              <button type="button" className="sc-btn" disabled={busy || !delegateTo} onClick={() => void handOver()}>Delegate</button>
            </div>
          )}
        </>
      ) : (
        pendingLevel && !pendingLevel.canAct && pendingLevel.myVoteStatus && pendingLevel.myVoteStatus !== "none" ? (
          <div className="service-request-notice" role="status">
            You {pendingLevel.myVoteStatus === "Approved" ? "approved" : "rejected"} this on {formatDateTime(pendingLevel.myVoteAt)}. Waiting for the other approvers.
          </div>
        ) : myInfoRequest ? (
          <div className="service-request-notice" role="status">
            You requested information on {formatDateTime(myInfoRequest.myVoteAt)}. The request is waiting for the requester.
          </div>
        ) : (
          <div className="sr-muted">
            {item.state === "Awaiting me"
              ? "This request is waiting on another approver, or someone else has already acted on it."
              : `You ${item.state.toLowerCase()} this request${item.actedAt ? ` on ${formatDateTime(item.actedAt)}` : ""}.`}
          </div>
        )
      )}
    </div>
  );
}
