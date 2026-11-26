import React, { useState } from "react";
import { Link } from "../router";
import { useAsync } from "../hooks";
import { ErrorBar, errMsg } from "../components/configKit";
import { ChangeLink, ConflictList, PageHead, RiskPill, TypePill } from "../components/changeKit";
import { changeApi, fmtDT, userName, type Workbench } from "../changeApi";

type Item = Workbench["authorisation"][number];

function DecisionCard({ it, meetingId, live, onDone }: { it: Item; meetingId: number; live: boolean; onDone: () => void }) {
  const c = it.change;
  const [comment, setComment] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const decide = async (d: "Approved" | "Rejected") => {
    if (d === "Rejected" && !comment.trim()) { setErr("A comment is required to reject a change."); return; }
    setBusy(true); setErr("");
    try { await changeApi.cabDecision(meetingId, it.change.changeId, d, comment.trim() || undefined); onDone(); } catch (e) { setErr(errMsg(e, "Unable to record the decision.")); } finally { setBusy(false); }
  };
  return (
    <div className="cm-card" style={{ background: "#FCFCFD" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><ChangeLink c={c} /><TypePill t={c.changeType} /><RiskPill r={c.riskLevel} /></div>
      <div style={{ fontWeight: 700, margin: "6px 0 2px" }}>{c.shortDescription}</div>
      <div className="cm-hint">Presented by {userName(c.assignedTo ?? c.requestedBy)} · {c.assignmentGroup ?? "No group"}</div>
      <dl className="cm-kv" style={{ marginTop: 8 }}>
        <dt>Window</dt><dd>{fmtDT(c.plannedStart)} → {fmtDT(c.plannedEnd)}</dd>
        <dt>Service</dt><dd>{c.businessService ?? "—"}</dd>
        <dt>Outage</dt><dd>{c.causesOutage ? c.expectedOutage || "Yes" : "No outage expected"}</dd>
        <dt>Earlier approvals</dt><dd>{it.earlierApprovals.length ? it.earlierApprovals.map((a) => `${a.approvalGroup}: ${a.status}`).join("; ") : "None"}</dd>
        <dt>Backout</dt><dd>{c.backoutPlan ?? "—"}</dd>
      </dl>
      <ConflictList conflicts={it.conflicts} ok="" />
      <div className="field-group" style={{ marginTop: 8 }}><span className="cm-lbl">Conditions and minutes</span>
        <textarea className="textarea" rows={2} value={comment} disabled={!live} onChange={(e) => setComment(e.target.value)} placeholder={live ? "Record conditions of approval, or the reason to reject" : "Start the meeting to record decisions"} /></div>
      <ErrorBar msg={err} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn-danger btn-sm" disabled={!live || busy} onClick={() => decide("Rejected")}>Reject</button>
        <button className="btn-primary btn-sm" disabled={!live || busy} onClick={() => decide("Approved")}>Approve</button>
      </div>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="cm-card"><div className="cm-card-title">{title}</div>{children}</div>;

export function CabWorkbenchPage() {
  const q = useAsync(() => changeApi.workbench(), []);
  const [err, setErr] = useState("");
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const w = q.data;
  if (q.loading && !w) return <div className="spinner-row">Loading…</div>;
  if (!w) return <ErrorBar msg={q.error ?? "Unable to load the CAB workbench."} />;
  const m = w.meeting, live = m.status === "In Progress";
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(""); try { await fn(); q.reload(); } catch (e) { setErr(errMsg(e, "That did not work.")); } finally { setBusy(false); } };
  const toggle = (i: number) => run(() => changeApi.setAttendance(m.id, m.attendance.map((a, j) => (j === i ? { ...a, present: !a.present } : a))));

  return (
    <>
      <PageHead crumb="Manage Changes > CAB Workbench" title={`CAB Workbench — ${m.title}`}
        subtitle={`${fmtDT(m.scheduledAt)}${m.location ? ` · ${m.location}` : ""}${m.chair ? ` · Chair: ${m.chair}` : ""}`}
        action={<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="badge" style={{ background: live ? "#ECFDF3" : "#F2F4F7", color: live ? "#027A48" : "#344054" }}>{m.status}</span>
          {m.status === "Planned" && <button className="btn-primary" disabled={busy} onClick={() => run(() => changeApi.startMeeting(m.id))}>Start meeting</button>}
          {live && <button className="btn-primary" disabled={busy} onClick={() => run(async () => { await changeApi.endMeeting(m.id, minutes); setMinutes(""); })}>End meeting and publish minutes</button>}
        </div>} />
      <div className="page-body">
        <ErrorBar msg={err} />
        <div className="cm-grid">
          <div>
            <Section title={`1. Changes for authorisation (${w.authorisation.length})`}>
              {w.authorisation.length ? w.authorisation.map((it) => <DecisionCard key={it.change.changeId} it={it} meetingId={m.id} live={live} onDone={q.reload} />)
                : <div className="cm-hint">No changes are waiting for CAB authorisation.</div>}
            </Section>
            <Section title={`2. Emergency changes for retrospective review (${w.emergencies.length})`}>
              {w.emergencies.length ? w.emergencies.map((c) => (
                <div key={c.changeId} style={{ padding: "6px 0", borderTop: "1px solid #EDEFF2", fontSize: 12.5 }}><ChangeLink c={c} /> — {c.shortDescription}
                  <div className="cm-hint">{c.state} · {c.implementationOutcome ?? "Not yet implemented"} · reviewed when the minutes are published</div></div>
              )) : <div className="cm-hint">No emergency changes since the last CAB.</div>}
            </Section>
            <Section title={`3. Post-implementation reviews and failed changes (${w.pirs.length})`}>
              {w.pirs.length ? w.pirs.map((c) => (
                <div key={c.changeId} style={{ padding: "6px 0", borderTop: "1px solid #EDEFF2", fontSize: 12.5 }}><ChangeLink c={c} /> — {c.shortDescription}
                  <div className="cm-hint">{c.implementationOutcome ?? c.state} · {c.pir ? "Review held" : "Review outstanding"}</div></div>
              )) : <div className="cm-hint">Nothing to review.</div>}
            </Section>
            <Section title={`4. Forward schedule — next 14 days (${w.forward.length})`}>
              {w.forward.map((c) => <div key={c.changeId} style={{ padding: "6px 0", borderTop: "1px solid #EDEFF2", fontSize: 12.5 }}>{fmtDT(c.plannedStart)} · <ChangeLink c={c} /> — {c.shortDescription} <span className="cm-hint">({c.state})</span></div>)}
              {!w.forward.length && <div className="cm-hint">No changes planned.</div>}
              <div style={{ marginTop: 8 }}><Link to="/changes/schedule">Open change schedule</Link></div>
            </Section>
          </div>
          <div>
            <Section title="Attendance">
              {m.attendance.map((a, i) => (
                <label key={a.name} className="cm-opt"><input type="checkbox" checked={a.present} disabled={busy || m.status === "Ended"} onChange={() => toggle(i)} /><span><b>{a.name}</b> <span className="cm-hint">{a.role}</span></span></label>
              ))}
              <div className={`cm-note ${w.quorum.met ? "ok" : "warn"}`}>{w.quorum.present} of {w.quorum.total} present — {w.quorum.met ? "quorum met." : `no quorum yet (${w.quorum.need} needed).`}</div>{!w.membersConfigured && <div className="cm-note warn">The CAB group has no members yet, so a placeholder board is shown. Add members in Groups.</div>}
            </Section>
            <Section title="Decision rules"><div style={{ fontSize: 12.5 }}>{w.policy}</div></Section>
            {live && <Section title="Minutes"><textarea className="textarea" rows={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Minutes to publish when the meeting ends" /></Section>}
            <Section title="Published minutes">
              {w.history.length ? w.history.map((h) => <div key={h.id} style={{ padding: "6px 0", borderTop: "1px solid #EDEFF2", fontSize: 12.5 }}><b>{fmtDT(h.scheduledAt)}</b><div style={{ whiteSpace: "pre-wrap" }}>{h.minutes || "No minutes recorded."}</div></div>)
                : <div className="cm-hint">No minutes have been published yet.</div>}
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}
