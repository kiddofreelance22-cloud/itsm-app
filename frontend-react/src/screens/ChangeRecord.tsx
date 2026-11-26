import React, { useState } from "react";
import { Link, useRouteParams } from "../router";
import { useAsync } from "../hooks";
import { useAuth } from "../AuthContext";
import { ErrorBar, errMsg } from "../components/configKit";
import { ConflictList, Lifecycle, PageHead, RiskPill, StatePill, TypePill } from "../components/changeKit";
import { changeApi, fmtDT, fromLocalInput, toLocalInput, userName, type Change } from "../changeApi";

const TABS = ["Details", "Risk", "Schedule", "Approvals", "Tasks", "CIs and related", "Implementation and closure"] as const;
type Tab = (typeof TABS)[number];
const EDITABLE = ["New", "Assess", "Authorize", "Scheduled"];
const RELATED_KINDS = ["Incident", "Problem", "Known Error", "Service Request", "Release"];

const KV = ({ rows }: { rows: [string, React.ReactNode][] }) => (
  <dl className="cm-kv">{rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v || v === 0 ? v : "—"}</dd></React.Fragment>)}</dl>
);
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="cm-card"><div className="cm-card-title">{title}</div>{children}</div>
);

/** "/changes/:id" also matches /changes/new, /changes/approvals… — only numeric ids are records. */
export function ChangeRecordPage() {
  const params = useRouteParams("/changes/:id");
  const id = Number(params?.id);
  return id ? <ChangeRecord id={id} /> : null;
}

function ChangeRecord({ id }: { id: number }) {
  const { user } = useAuth();
  const staff = user?.role !== "END_USER";
  const q = useAsync(() => changeApi.get(id), [id]);
  const cfgQ = useAsync(() => changeApi.config(), []);
  const [tab, setTab] = useState<Tab>("Details");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState<string | null>(null);

  const c = q.data;
  const cfg = cfgQ.data ?? undefined;
  if (q.loading && !c) return <div className="spinner-row">Loading…</div>;
  if (!c) return <ErrorBar msg={q.error ?? "Change not found."} />;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr("");
    try { await fn(); q.reload(); } catch (e) { setErr(errMsg(e, "That did not work.")); } finally { setBusy(false); }
  };
  const editable = staff && EDITABLE.includes(c.state);
  const pendingStage = c.approvals?.find((a) => a.status === "Pending");

  return (
    <>
      <PageHead crumb="Change Request List > Change Record" title={c.changeCode}
        subtitle={undefined}
        action={<div style={{ display: "flex", gap: 8 }}>
          {editable && <Link to={`/changes/${c.changeId}/edit`} className="btn-ghost">Edit</Link>}
          {staff && c.state === "New" && <button className="btn-primary" disabled={busy} onClick={() => run(() => changeApi.submit(c.changeId))}>Submit for assessment</button>}
          {c.state === "Authorize" && pendingStage && (pendingStage.approvalGroup === "CAB"
            ? <Link to="/changes/cab" className="btn-ghost">Open CAB agenda</Link> : <Link to="/changes/approvals" className="btn-ghost">Go to approvals</Link>)}
          {staff && EDITABLE.includes(c.state) && cancelReason === null && <button className="btn-ghost" onClick={() => setCancelReason("")}>Cancel change</button>}
        </div>} />
      <div className="page-body">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <TypePill t={c.changeType} /> <RiskPill r={c.riskLevel} /> {c.priority && <span className="badge" style={{ background: "#F2F4F7", color: "#344054" }}>{c.priority}</span>} <StatePill s={c.state} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, margin: "8px 0 0" }}>{c.shortDescription}</div>
        <Lifecycle state={c.state} />
        {c.state === "Cancelled" && c.closeNotes && <div className="cm-note bad">{c.closeNotes}</div>}
        {cancelReason !== null && (
          <div className="cm-card" style={{ marginTop: 12 }}>
            <div className="cm-card-title">Cancel this change</div>
            <textarea className="textarea" rows={2} placeholder="Reason (recorded on the change)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn-danger btn-sm" disabled={busy} onClick={() => run(async () => { await changeApi.cancel(c.changeId, cancelReason || undefined); setCancelReason(null); })}>Cancel change</button>
              <button className="btn-ghost btn-sm" onClick={() => setCancelReason(null)}>Keep change</button>
            </div>
          </div>
        )}
        <ErrorBar msg={err} />
        {!!c.conflicts?.length && <ConflictList conflicts={c.conflicts} ok="" />}

        <div className="cm-tabs">{TABS.map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}{t === "Approvals" && c.approvals?.length ? ` (${c.approvals.length})` : ""}{t === "Tasks" && c.tasks?.length ? ` (${c.tasks.length})` : ""}</button>)}</div>

        <div className="cm-grid">
          <div>
            {tab === "Details" && <>
              <Card title="Description"><div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{c.description || "—"}</div></Card>
              <Card title="Change details"><KV rows={[
                ["Business justification", c.justification], ["Category", c.category], ["Business service", c.businessService],
                ["Impact", c.impact], ["Urgency", c.urgency], ["Outage", c.causesOutage ? c.expectedOutage || "Yes" : "No outage expected"],
              ]} /></Card>
              <Card title="Plans"><KV rows={[
                ["Implementation plan", c.implementationPlan], ["Backout plan", c.backoutPlan], ["Test and verification plan", c.testPlan], ["Communication plan", c.communicationPlan],
              ]} /></Card>
            </>}

            {tab === "Risk" && <Card title="Risk assessment">
              {c.changeType === "Standard" ? <div className="cm-note info">Standard changes inherit Low risk from their authorised template; no questionnaire is needed.</div>
                : c.riskLevel ? <>
                  <div style={{ fontSize: 13, marginBottom: 8 }}><b>Score {c.riskScore}</b> · <RiskPill r={c.riskLevel} />
                    {cfg && <span className="cm-hint"> · Bands: {cfg.risk.bands.map((b) => `${b.level} ${b.min}–${b.max > 50 ? "+" : b.max}`).join(", ")}</span>}</div>
                  {cfg?.risk.questions.filter((qn) => qn.active || c.riskAnswers[qn.id] !== undefined).map((qn) => { const i = c.riskAnswers[qn.id]; const o = i !== undefined ? qn.opts[Number(i)] : null;
                    return <div key={qn.id} className="cm-risk-q"><div style={{ fontWeight: 600, fontSize: 13 }}>{qn.label}</div><div style={{ fontSize: 12.5 }}>{o ? `${o.t} (+${o.w})` : <span style={{ color: "var(--muted)" }}>Not answered</span>}</div></div>; })}
                </> : <div className="cm-note warn">The risk questionnaire has not been completed. It must be finished before the change can be submitted for assessment.</div>}
            </Card>}

            {tab === "Schedule" && <>
              <Card title="Planned window"><KV rows={[
                ["Impact / urgency / priority", [c.impact, c.urgency, c.priority].filter(Boolean).join(" / ")],
                ["Planned start", fmtDT(c.plannedStart)], ["Planned end", fmtDT(c.plannedEnd)],
                ["Actual start", fmtDT(c.actualStart)], ["Actual end", fmtDT(c.actualEnd)],
              ]} />
                {c.state === "Implement" && <div className="cm-hint" style={{ marginTop: 8 }}>The planned window is locked once implementation starts.</div>}</Card>
              <Card title="Conflict check"><ConflictList conflicts={c.conflicts} ok="No blackout or configuration item conflicts in the planned window." />
                <div style={{ marginTop: 8 }}><Link to="/changes/schedule">Open the change schedule</Link></div></Card>
            </>}

            {tab === "Approvals" && <Card title="Approvals">
              {c.approvals?.length ? (
                <table className="dash-table"><thead><tr><th>Stage</th><th>Approval group</th><th>Approver / rule</th><th>Status</th><th>Decided</th><th>Comment</th></tr></thead>
                  <tbody>{c.approvals.map((a) => <tr key={a.id}><td>{a.stage}</td><td>{a.approvalGroup}</td><td>{a.approver ? userName(a.approver) : a.rule}</td>
                    <td><span className="badge" style={{ background: a.status === "Approved" ? "#ECFDF3" : a.status === "Rejected" ? "#FEF3F2" : "#FFFAEB", color: a.status === "Approved" ? "#027A48" : a.status === "Rejected" ? "#B42318" : "#B54708" }}>{a.status}</span></td>
                    <td>{fmtDT(a.decidedAt)}</td><td>{a.comment ?? "—"}</td></tr>)}</tbody></table>
              ) : <div className="cm-hint">{c.changeType === "Standard" ? "Standard changes are pre-approved." : "Approvals are requested when the change is submitted."}</div>}
            </Card>}

            {tab === "Tasks" && <TasksTab c={c} staff={staff} busy={busy} run={run} />}
            {tab === "CIs and related" && <RelatedTab c={c} editable={editable} busy={busy} run={run} />}
            {tab === "Implementation and closure" && <ImplTab c={c} staff={staff} cfg={cfg} busy={busy} run={run} />}
          </div>

          <div>
            <Card title="People and dates"><KV rows={[
              ["Requested by", userName(c.requestedBy)], ["Change owner", userName(c.assignedTo)], ["Assignment group", c.assignmentGroup],
              ["Created", fmtDT(c.createdAt)], ["Planned window", c.plannedStart ? `${fmtDT(c.plannedStart)} → ${fmtDT(c.plannedEnd)}` : "—"],
              ["Service", c.businessService], ["Configuration items", c.configurationItems?.join(", ")],
            ]} /></Card>
            <Card title="Work notes">
              <textarea className="textarea" rows={2} placeholder="Add a work note" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn-primary btn-sm" style={{ marginTop: 8 }} disabled={busy || !note.trim()} onClick={() => run(async () => { await changeApi.addNote(c.changeId, note.trim()); setNote(""); })}>Post work note</button>
              <div style={{ marginTop: 12 }}>
                {c.workNotes?.map((n) => <div key={n.id} style={{ padding: "8px 0", borderTop: "1px solid #EDEFF2", fontSize: 12.5 }}>
                  <div className="cm-hint">{fmtDT(n.createdAt)} · {userName(n.author)}</div>{n.note}</div>)}
                {!c.workNotes?.length && <div className="cm-hint">No work notes yet.</div>}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

type RunFn = (fn: () => Promise<unknown>) => Promise<void>;

function TasksTab({ c, staff, busy, run }: { c: Change; staff: boolean; busy: boolean; run: RunFn }) {
  const [t, setT] = useState({ shortDescription: "", assignmentGroup: "" });
  const wgQ = useAsync(() => changeApi.workgroups().catch(() => [] as { groupId: number; groupName: string }[]), []);
  const closed = ["Closed", "Cancelled"].includes(c.state);
  return (
    <Card title="Change tasks">
      {c.tasks?.length ? (
        <table className="dash-table"><thead><tr><th>Task</th><th>Short description</th><th>Assignment group</th><th>Assigned to</th><th>State</th></tr></thead>
          <tbody>{c.tasks.map((k) => <tr key={k.id}><td>{k.taskCode}</td><td>{k.shortDescription}</td><td>{k.assignmentGroup ?? "—"}</td><td>{userName(k.assignedTo)}</td>
            <td>{staff && !closed ? <select className="select" value={k.state} disabled={busy} onChange={(e) => run(() => changeApi.updateTask(c.changeId, k.id, { state: e.target.value }))}>
              {["Open", "In Progress", "Closed", "Cancelled"].map((s) => <option key={s}>{s}</option>)}</select> : k.state}</td></tr>)}</tbody></table>
      ) : <div className="cm-hint">No change tasks yet.</div>}
      {staff && !closed && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input className="input" style={{ flex: 2, minWidth: 200 }} placeholder="Short description" value={t.shortDescription} onChange={(e) => setT({ ...t, shortDescription: e.target.value })} />
          <select className="select" style={{ flex: 1, minWidth: 140 }} aria-label="Assignment group" value={t.assignmentGroup} onChange={(e) => setT({ ...t, assignmentGroup: e.target.value })}><option value="">Assignment group</option>{(wgQ.data ?? []).map((g) => <option key={g.groupId}>{g.groupName}</option>)}</select>
          <button className="btn-primary btn-sm" disabled={busy || !t.shortDescription.trim()} onClick={() => run(async () => { await changeApi.addTask(c.changeId, { shortDescription: t.shortDescription.trim(), assignmentGroup: t.assignmentGroup || undefined }); setT({ shortDescription: "", assignmentGroup: "" }); })}>Add task</button>
        </div>
      )}
    </Card>
  );
}

function RelatedTab({ c, editable, busy, run }: { c: Change; editable: boolean; busy: boolean; run: RunFn }) {
  const [r, setR] = useState({ kind: "Incident", number: "", title: "" });
  return (
    <>
      <Card title="Affected configuration items">
        {c.configurationItems?.length ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{c.configurationItems.map((ci) => <span key={ci} className="badge" style={{ background: "#F2F4F7", color: "#344054" }}>{ci}</span>)}</div> : <div className="cm-hint">None recorded.</div>}
        <div style={{ marginTop: 10, fontSize: 12.5 }}>Impacted business service: <b>{c.businessService ?? "—"}</b></div>
      </Card>
      <Card title="Related records">
        {c.relatedRecords?.length ? <table className="dash-table"><thead><tr><th>Type</th><th>Number</th><th>Title</th></tr></thead>
          <tbody>{c.relatedRecords.map((x, i) => <tr key={i}><td>{x.kind}</td><td>{x.number}</td><td>{x.title ?? "—"}</td></tr>)}</tbody></table>
          : <div className="cm-hint">No related incidents, problems or requests.</div>}
        {editable && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <select className="select" value={r.kind} onChange={(e) => setR({ ...r, kind: e.target.value })}>{RELATED_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            <input className="input" placeholder="Number" value={r.number} onChange={(e) => setR({ ...r, number: e.target.value })} />
            <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Title (optional)" value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} />
            <button className="btn-primary btn-sm" disabled={busy || !r.number.trim()} onClick={() => run(async () => { await changeApi.update(c.changeId, { relatedRecords: [...(c.relatedRecords ?? []), { kind: r.kind, number: r.number.trim(), title: r.title || undefined }] }); setR({ kind: "Incident", number: "", title: "" }); })}>Link record</button>
          </div>
        )}
      </Card>
    </>
  );
}

function ImplTab({ c, staff, cfg, busy, run }: { c: Change; staff: boolean; cfg?: import("../changeApi").ChangeConfig; busy: boolean; run: RunFn }) {
  const [done, setDone] = useState({ outcome: "", actualEnd: toLocalInput(new Date().toISOString()), notes: "" });
  const [pir, setPir] = useState({ heldOn: "", objectivesMet: "", attendees: "", cause: "", actions: "" });
  const [close, setClose] = useState({ closeCode: "", closeNotes: "" });
  const code = cfg?.closeCodes.find((x) => x.name === close.closeCode);
  const model = cfg?.models.find((m) => m.name === c.changeType);
  const failed = ["Failed", "Backed out"].includes(c.implementationOutcome ?? "");
  const byModel = model?.pir === "Always" || (model?.pir === "Only if unsuccessful" && failed) || (model?.pir === "High risk and unsuccessful changes" && (failed || c.riskLevel === "High" || c.riskLevel === "Very High"));
  const pirRequired = byModel || !!code?.pir;
  const pirReason = byModel ? `A post-implementation review is required for this change (${model?.pir.toLowerCase()}).` : "";

  if (c.state === "Cancelled") return <Card title="Closure"><KV rows={[["Close code", c.closeCode], ["Close notes", c.closeNotes]]} /></Card>;
  if (["New", "Assess", "Authorize"].includes(c.state)) return <Card title="Implementation and closure"><div className="cm-hint">Outcome, review and closure are recorded here once implementation is under way.</div></Card>;
  return (
    <>
      {c.state === "Scheduled" && staff && (
        <Card title="Implementation"><div className="cm-hint" style={{ marginBottom: 8 }}>This change is authorised and scheduled for {fmtDT(c.plannedStart)}.</div>
          <button className="btn-primary" disabled={busy} onClick={() => run(() => changeApi.startImplementation(c.changeId))}>Start implementation</button></Card>
      )}
      {c.state === "Implement" && staff && (
        <Card title="Record implementation outcome"><div className="cm-form-grid">
          <div className="field-group"><span className="cm-lbl">Outcome</span><select className="select" value={done.outcome} onChange={(e) => setDone({ ...done, outcome: e.target.value })}><option value="">Select outcome</option>{(cfg?.outcomes ?? []).map((o) => <option key={o}>{o}</option>)}</select></div>
          <div className="field-group"><span className="cm-lbl">Actual end</span><input type="datetime-local" className="input" value={done.actualEnd} onChange={(e) => setDone({ ...done, actualEnd: e.target.value })} /></div>
          <div className="field-group full" style={{ gridColumn: "1 / -1" }}><span className="cm-lbl">Implementation notes</span><textarea className="textarea" rows={3} value={done.notes} onChange={(e) => setDone({ ...done, notes: e.target.value })} /></div>
        </div>
          <button className="btn-primary" style={{ marginTop: 10 }} disabled={busy || !done.outcome} onClick={() => run(() => changeApi.completeImplementation(c.changeId, { outcome: done.outcome, actualEnd: fromLocalInput(done.actualEnd), notes: done.notes || undefined }))}>Complete implementation</button></Card>
      )}
      {(c.state === "Review" || c.state === "Closed") && <>
        <Card title="Implementation outcome"><KV rows={[["Outcome", c.implementationOutcome], ["Actual start", fmtDT(c.actualStart)], ["Actual end", fmtDT(c.actualEnd)], ["Implementation notes", c.implementationNotes]]} /></Card>
        <Card title={`Post-implementation review${c.pir ? " (held)" : ""}`}>
          {c.pir ? <KV rows={[["Review held on", c.pir.heldOn ? fmtDT(c.pir.heldOn) : "—"], ["Objectives met", c.pir.objectivesMet], ["Attendees", c.pir.attendees], ["What happened and why", c.pir.cause], ["Lessons learned and actions", c.pir.actions]]} />
            : c.state === "Review" && staff ? <>
              {pirReason && <div className="cm-note warn">{pirReason}</div>}
              <div className="cm-form-grid" style={{ marginTop: 8 }}>
                <div className="field-group"><span className="cm-lbl">Review held on</span><input type="date" className="input" value={pir.heldOn} onChange={(e) => setPir({ ...pir, heldOn: e.target.value })} /></div>
                <div className="field-group"><span className="cm-lbl">Objectives met?</span><select className="select" value={pir.objectivesMet} onChange={(e) => setPir({ ...pir, objectivesMet: e.target.value })}><option value="">Select</option>{["Yes", "Partially", "No"].map((o) => <option key={o}>{o}</option>)}</select></div>
                <div className="field-group" style={{ gridColumn: "1 / -1" }}><span className="cm-lbl">Attendees</span><input className="input" value={pir.attendees} onChange={(e) => setPir({ ...pir, attendees: e.target.value })} /></div>
                <div className="field-group" style={{ gridColumn: "1 / -1" }}><span className="cm-lbl">What happened and why</span><textarea className="textarea" rows={3} value={pir.cause} onChange={(e) => setPir({ ...pir, cause: e.target.value })} /></div>
                <div className="field-group" style={{ gridColumn: "1 / -1" }}><span className="cm-lbl">Lessons learned and follow-up actions</span><textarea className="textarea" rows={3} value={pir.actions} onChange={(e) => setPir({ ...pir, actions: e.target.value })} /></div>
              </div>
              <button className="btn-primary btn-sm" style={{ marginTop: 10 }} disabled={busy || !pir.objectivesMet} onClick={() => run(() => changeApi.savePir(c.changeId, { ...pir, heldOn: pir.heldOn ? new Date(pir.heldOn).toISOString() : "" }))}>Save review</button>
            </> : <div className="cm-hint">No review recorded.</div>}
        </Card>
      </>}
      {c.state === "Review" && staff && (
        <Card title="Close the change"><div className="cm-form-grid">
          <div className="field-group"><span className="cm-lbl">Close code</span><select className="select" value={close.closeCode} onChange={(e) => setClose({ ...close, closeCode: e.target.value })}><option value="">Select close code</option>{(cfg?.closeCodes ?? []).filter((x) => x.active && x.name !== "Cancelled").map((o) => <option key={o.name}>{o.name}</option>)}</select></div>
          <div className="field-group" style={{ gridColumn: "1 / -1" }}><span className="cm-lbl">Close notes</span><textarea className="textarea" rows={2} value={close.closeNotes} onChange={(e) => setClose({ ...close, closeNotes: e.target.value })} /></div>
        </div>
          {pirRequired && !c.pir && <div className="cm-note warn">A post-implementation review is required before this change can be closed.</div>}
          <button className="btn-primary" style={{ marginTop: 10 }} disabled={busy || !close.closeCode || (pirRequired && !c.pir)} onClick={() => run(() => changeApi.close(c.changeId, { closeCode: close.closeCode, closeNotes: close.closeNotes || undefined }))}>Close change</button></Card>
      )}
      {c.state === "Closed" && <Card title="Closure"><KV rows={[["Close code", c.closeCode], ["Close notes", c.closeNotes]]} /></Card>}
    </>
  );
}
