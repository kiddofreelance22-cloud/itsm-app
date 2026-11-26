import React, { useMemo, useState } from "react";
import { useAsync } from "../hooks";
import { ErrorBar, errMsg } from "../components/configKit";
import { ChangeLink, ConflictList, PageHead, RiskPill, StatePill, TypePill } from "../components/changeKit";
import { useAuth } from "../AuthContext";
import { useRouteParams } from "../router";
import { changeApi, fmtDT, userName, type ChangeApproval } from "../changeApi";

function ApprovalCard({ a, me, onDone }: { a: ChangeApproval; me?: number; onDone: (msg: string) => void }) {
  const ch = a.change!;
  const [open, setOpen] = useState(false);
  const detail = useAsync(() => (open ? changeApi.get(ch.changeId) : Promise.resolve(null)), [open, ch.changeId]);
  const d = detail.data;
  const [comment, setComment] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (kind: "Approved" | "Rejected" | "info") => {
    if (kind !== "Approved" && !comment.trim()) { setErr(kind === "Rejected" ? "A comment is required to reject a change." : "Say what information you need."); return; }
    setBusy(true); setErr("");
    try {
      if (kind === "info") { await changeApi.requestInfo(ch.changeId, comment.trim()); onDone(`Your question was sent to the change owner and recorded on ${ch.changeCode}. It stays in your queue.`); setComment(""); }
      else { await changeApi.decide(a.id, kind, comment.trim() || undefined); onDone(`${ch.changeCode} ${kind.toLowerCase()}.`); }
    } catch (e) { setErr(errMsg(e, "Unable to record your decision.")); } finally { setBusy(false); }
  };

  return (
    <div className="cm-card">
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <ChangeLink c={ch} /> <TypePill t={ch.changeType} /> <RiskPill r={ch.riskLevel} /> <StatePill s={ch.state} />
        <div style={{ flex: 1 }} />
        <button className="btn-ghost btn-sm" onClick={() => setOpen(!open)}>{open ? "Hide details" : "Review"}</button>
      </div>
      <div style={{ fontWeight: 700, margin: "8px 0 2px" }}>{ch.shortDescription}</div>
      <div className="cm-hint">Requested by {userName(ch.requestedBy)} · {ch.assignmentGroup ?? "No group"} · Your decision as <b>{a.approvalGroup}</b> (stage {a.stage})</div>
      {a.approver && me && a.approver.userId !== me && <div className="cm-note warn" style={{ marginTop: 6 }}>Assigned to {userName(a.approver)}. As an administrator you can record the decision on their behalf; it is noted on the change.</div>}
      {open && (
        <div style={{ marginTop: 12 }}>
          {detail.loading || !d ? <div className="spinner-row">Loading…</div> : <>
            <dl className="cm-kv">
              <dt>Planned window</dt><dd>{fmtDT(d.plannedStart)} → {fmtDT(d.plannedEnd)}</dd>
              <dt>Service</dt><dd>{d.businessService ?? "—"}</dd>
              <dt>Configuration items</dt><dd>{d.configurationItems?.join(", ") || "—"}</dd>
              <dt>Outage</dt><dd>{d.causesOutage ? d.expectedOutage || "Yes" : "No outage expected"}</dd>
              <dt>Priority</dt><dd>{d.priority ?? "—"}</dd>
              <dt>Description</dt><dd>{d.description ?? "—"}</dd>
              <dt>Backout plan</dt><dd>{d.backoutPlan ?? "—"}</dd>
            </dl>
            <div style={{ marginTop: 8 }}><ConflictList conflicts={d.conflicts} ok="No blackout or configuration item conflicts." /></div>
            <div className="cm-lbl" style={{ margin: "12px 0 4px" }}>Approval path</div>
            {d.approvals?.map((s) => <div key={s.id} style={{ fontSize: 12.5, padding: "2px 0" }}>{s.stage}. {s.approvalGroup} — <b>{s.status}</b>{s.comment ? ` · ${s.comment}` : ""}</div>)}
          </>}
          <div className="field-group" style={{ marginTop: 12 }}><span className="cm-lbl">Comment</span>
            <textarea className="textarea" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Required to reject or to ask for more information" /></div>
          <ErrorBar msg={err} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn-ghost btn-sm" disabled={busy} onClick={() => act("info")}>Request more information</button>
            <button className="btn-danger btn-sm" disabled={busy} onClick={() => act("Rejected")}>Reject</button>
            <button className="btn-primary btn-sm" disabled={busy} onClick={() => act("Approved")}>Approve</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChangeApprovalsPage() {
  const { user } = useAuth();
  const focusedId = useRouteParams("/changes/approvals/:id")?.id;
  const q = useAsync(() => changeApi.myApprovals(), []);
  const blocked = useAsync(() => changeApi.blockedApprovals().catch(() => []), []);
  const [group, setGroup] = useState("");
  const [flash, setFlash] = useState("");
  const rows = q.data ?? [];
  const groups = useMemo(() => { const m = new Map<string, number>(); rows.forEach((r) => m.set(r.approvalGroup, (m.get(r.approvalGroup) ?? 0) + 1)); return Array.from(m.entries()); }, [rows]);
  const shown = rows.filter((r) => (!focusedId || String(r.id) === focusedId) && (!group || r.approvalGroup === group));

  return (
    <>
      <PageHead crumb="Change Management > Approve Changes" title="Approve Changes"
        subtitle="Changes waiting on an approval group you belong to: Change Management, CAB and ECAB. A comment is required to reject or ask for more information." />
      <div className="page-body">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <button className={group ? "btn-ghost btn-sm" : "btn-primary btn-sm"} onClick={() => setGroup("")}>All ({rows.length})</button>
          {groups.map(([g, n]) => <button key={g} className={group === g ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setGroup(group === g ? "" : g)}>{g} ({n})</button>)}
        </div>
        {flash && <div className="cm-note ok" style={{ marginBottom: 12 }}>{flash}</div>}
        <ErrorBar msg={q.error ?? ""} />
        {q.loading ? <div className="spinner-row">Loading…</div>
          : shown.length ? shown.map((a) => <ApprovalCard key={a.id} a={a} me={user ? Number(user.id) : undefined} onDone={(m) => { setFlash(m); q.reload(); blocked.reload(); }} />)
          : <div className="cm-card"><div className="cm-hint">Nothing is waiting for your approval.</div></div>}
        {(blocked.data ?? []).length > 0 && (
          <div className="cm-note info" style={{ marginTop: 12 }}>
            <b>{blocked.data!.length === 1 ? "1 change is" : `${blocked.data!.length} changes are`} waiting for approval but you raised or own {blocked.data!.length === 1 ? "it" : "them"}.</b> Approval policy does not let you approve your own change, so another approver must decide:
            {" "}{blocked.data!.map((b, i) => <span key={b.changeId}>{i ? ", " : ""}<ChangeLink c={b} /> (with {b.approvalGroup})</span>)}.
          </div>)}
      </div>
    </>
  );
}
