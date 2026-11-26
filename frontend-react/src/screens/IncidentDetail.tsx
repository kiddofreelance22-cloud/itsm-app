import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { incidentApi } from "../incidentApi";
import { useAsync } from "../hooks";
import { Link, useRouteParams } from "../router";
import { ErrorBar, errMsg } from "../components/configKit";
import { Pill, Raw, StarPicker, USER_PRIORITY_STYLE, USER_STATUS_STYLE, fmtDateTime, fmtShort, stars, userClosureCode, userStatus } from "../components/endUser";

interface Activity { activityId: number; type: string; content: string | null; isWorkNote: boolean; createdAt: string; author?: { userId: number; fullName: string } | null }

/** Requesters only see friendly milestones, never internal events like priority or group changes. */
function friendly(a: Activity): string | null {
  switch (a.type) {
    case "created": return "You reported this incident";
    case "group_assigned": case "assignment_change": case "claimed": return "Assigned to our support team";
    case "resolved": return "Marked as Resolved";
    case "closed": return "You closed this incident";
    case "reopened": return "You reopened this incident";
    case "status_change": {
      // Judge by the status the incident moved TO (the text reads "…from X to Y"), not any status named in the sentence.
      const to = ((a.content ?? "").match(/\bto\s+"?([A-Za-z ]+?)"?\s*[.,)]?\s*$/i)?.[1] ?? a.content ?? "").trim();
      if (/^in progress$/i.test(to)) return "Work started on your incident";
      if (/^on hold|pending/i.test(to)) return "Waiting on a response before work continues";
      if (/^resolved$/i.test(to)) return "Marked as Resolved";
      if (/^closed$/i.test(to)) return "This incident was closed";
      return null;
    }
    default: return null;
  }
}
const initials = (n: string) => { const p = n.trim().split(/\s+/); return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase(); };

export function IncidentDetailPage() {
  const id = useRouteParams("/my-incidents/:id")?.id ?? "";
  const [inc, setInc] = useState<Raw | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [acts, setActs] = useState<Activity[]>([]);
  const fieldsQ = useAsync(() => incidentApi.fieldVisibility(), []);
  const codes = useAsync(() => api.get<Raw[]>("/closure-codes").catch(() => []), []);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [draft, setDraft] = useState("");
  const [allMsgs, setAllMsgs] = useState(false);

  const load = useCallback(async () => {
    try {
      const i = await api.get<Raw>(`/incidents/${encodeURIComponent(id)}`);
      setInc(i); setLoadErr("");
      setActs(await api.get<Activity[]>(`/incidents/${encodeURIComponent(id)}/activities`).catch(() => []));
    } catch (e) { setLoadErr(errMsg(e, "We couldn't load this incident.")); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const vis = useMemo(() => {
    const m: Record<string, boolean> = {};
    (fieldsQ.data?.fields ?? []).forEach((f) => { m[f.fieldName] = f.visible; });
    return (name: string) => m[name] ?? true;                // unconfigured = visible
  }, [fieldsQ.data]);
  const feedbackRequired = !!(fieldsQ.data?.fields ?? []).find((f) => f.fieldName === "Feedback / Rating")?.required;

  if (loadErr) return <div className="page-body"><ErrorBar msg={loadErr} /><Link to="/my-incidents">← Back to My Incidents</Link></div>;
  if (!inc) return <div className="page-body"><div className="spinner-row">Loading…</div></div>;

  const ref = inc.incidentCode ?? inc.incidentId;
  const label = userStatus(inc.status);
  const resolved = inc.status === "Resolved";
  const closed = inc.status === "Closed";
  const cancelled = inc.status === "Cancelled";
  const messages = acts.filter((a) => a.type === "comment" && !a.isWorkNote);   // internal work notes never shown to requesters
  const timeline = acts.map((a) => ({ a, text: friendly(a) })).filter((x): x is { a: Activity; text: string } => !!x.text)
    .filter((x, i, arr) => i === 0 || arr[i - 1].text !== x.text); // a resolve logs both an event and a status change: show it once;
  const shownMsgs = allMsgs ? messages : messages.slice(-3);
  const paused = !!inc.slaPausedAt;
  const done = closed || resolved;
  const remaining = (() => {
    if (!inc.slaResolutionTarget) return "";
    const ms = new Date(inc.slaResolutionTarget).getTime() - Date.now(); const a = Math.abs(ms);
    const h = Math.floor(a / 3600000), m = Math.floor((a % 3600000) / 60000);
    return `${h > 0 ? `${h}h ` : ""}${m}m ${ms >= 0 ? "remaining" : "overdue"}`;
  })();

  const confirmClose = async () => {
    if (feedbackRequired && !rating) { setErr("Please rate your experience before confirming and closing."); return; }
    setBusy(true); setErr("");
    try {
      const code = userClosureCode(codes.data);
      await api.patch(`/incidents/${encodeURIComponent(inc.incidentId)}`, { status: "Closed", ...(rating ? { feedbackRating: rating } : {}), feedbackComment: feedback.trim() || undefined, ...(code ? { closureCode: code } : {}) });
      setConfirm(false); setInfo(""); await load();
    } catch (e) { setErr(errMsg(e, "Unable to close this incident.")); setConfirm(false); }
    finally { setBusy(false); }
  };
  const reopen = async () => {
    setReopening(true); setErr("");
    try {
      await api.patch(`/incidents/${encodeURIComponent(inc.incidentId)}`, { status: "Open" });
      await api.post(`/incidents/${encodeURIComponent(inc.incidentId)}/comments`, { content: "Reopened by the requester: the issue is not fixed." }).catch(() => undefined);
      setInfo("Thanks — we've reopened this and our team will take another look."); await load();
    } catch (e) { setErr(errMsg(e, "Unable to reopen this incident.")); }
    finally { setReopening(false); }
  };
  const send = async () => {
    if (!draft.trim()) return;
    try { await api.post(`/incidents/${encodeURIComponent(inc.incidentId)}/comments`, { content: draft.trim() }); setDraft(""); setActs(await api.get<Activity[]>(`/incidents/${encodeURIComponent(id)}/activities`)); }
    catch (e) { setErr(errMsg(e, "Unable to send your message.")); }
  };

  const row = (name: string, value: React.ReactNode) => vis(name) && (
    <div className="field-group" key={name}><span className="lbl">{name}</span><div style={{ fontSize: 13, color: "#1D2433", minHeight: 24 }}>{value || "—"}</div></div>
  );

  return (
    <>
      <div style={{ padding: "16px 28px 0" }}>
        <div className="breadcrumb">My Incidents &gt; {ref}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="page-title" style={{ margin: 0 }}>{ref}</div>
              {vis("Status") && <Pill text={label} st={USER_STATUS_STYLE[label]} />}
            </div>
            {vis("Short Description") && <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{inc.title}</div>}
            <div style={{ fontSize: 12, color: "#98A2B3", marginTop: 4 }}>Reported by you{vis("Created Date") && ` · ${fmtDateTime(inc.createdAt)}`}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {resolved && (
              <>
                <button type="button" className="btn-ghost" disabled={reopening} onClick={() => void reopen()}>{reopening ? "Reopening…" : "Reopen — Not Fixed"}</button>
                <button type="button" className="btn-primary" style={{ background: "#067647", borderColor: "#067647" }} onClick={() => { setErr(""); setConfirm(true); }}>Confirm &amp; Close</button>
              </>
            )}
            {(closed || cancelled) && <span style={{ fontSize: 12, color: "#98A2B3" }}>🔒 {closed ? "Closed" : "Cancelled"} — locked</span>}
            <Link to="/my-incidents" className="btn-ghost">Close</Link>
          </div>
        </div>
        {info && <div style={{ marginTop: 12, fontSize: 12.5, padding: "9px 12px", borderRadius: 8, color: "#067647", background: "#ECFDF3", border: "1px solid #ABEFC6" }}>{info}</div>}
        <ErrorBar msg={err} />
        {resolved && (
          <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "#ECFDF3", border: "1px solid #ABEFC6" }}>
            <div style={{ fontWeight: 700, color: "#067647", fontSize: 13.5 }}>Our team marked this as resolved</div>
            <div style={{ fontSize: 12.5, color: "#344054", marginTop: 2 }}>If everything is working again, confirm and close it below. If the issue is still happening, reopen it and we&apos;ll keep looking into it.</div>
          </div>
        )}
      </div>

      <div className="page-body">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(260px,1fr)", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            <div className="card" style={{ padding: 22 }}>
              <div className="proto-eyebrow-title" style={{ marginBottom: 14 }}>Incident Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
                {row("Status", <Pill text={label} st={USER_STATUS_STYLE[label]} />)}
                {row("Priority", inc.priority ? <Pill text={inc.priority} st={USER_PRIORITY_STYLE[inc.priority]} /> : null)}
                {row("Category", inc.category?.categoryName)}
                {row("Incident Number", ref)}
                {row("Assigned Agent", inc.assignedTo ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span className="user-avatar" style={{ width: 24, height: 24, fontSize: 10, background: "#EFF4FC", color: "#175CD3" }}>{initials(inc.assignedTo.fullName)}</span>{inc.assignedTo.fullName}</span> : null)}
                {row("Assigned Workgroup", inc.assignmentGroup?.groupName)}
              </div>
              {vis("Description") && (
                <div className="field-group" style={{ marginTop: 14 }}><span className="lbl">Description</span>
                  <div style={{ fontSize: 13, color: "#344054", whiteSpace: "pre-wrap" }}>{inc.description || "—"}</div>
                  {inc.slaResolutionTarget && !done && <div style={{ fontSize: 12, color: "#98A2B3", marginTop: 6 }}>Expected by {fmtShort(inc.slaResolutionTarget)}</div>}</div>
              )}
              {vis("Resolution Notes") && inc.resolutionNotes && <div className="field-group" style={{ marginTop: 14 }}><span className="lbl">Resolution Notes</span><div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{inc.resolutionNotes}</div></div>}
              {vis("Resolution Code") && inc.resolutionCode && <div className="field-group" style={{ marginTop: 14 }}><span className="lbl">Resolution Code</span><div style={{ fontSize: 13 }}>{inc.resolutionCode}</div></div>}
              {vis("Closure Code") && inc.closureCode && <div className="field-group" style={{ marginTop: 14 }}><span className="lbl">Closure Code</span><div style={{ fontSize: 13 }}>{inc.closureCode}</div></div>}
              {vis("Feedback / Rating") && (
                <div className="field-group" style={{ marginTop: 14 }}>
                  <span className="lbl">Feedback / Rating {resolved && feedbackRequired && <span className="req">*</span>}</span>
                  {resolved ? (
                    <>
                      <StarPicker value={rating} onChange={setRating} />
                      <textarea className="textarea" rows={2} style={{ marginTop: 8 }} placeholder="Tell us how we did (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} aria-label="Feedback comment" />
                      <div style={{ fontSize: 12, color: "#98A2B3", marginTop: 4 }}>Please rate your experience before confirming and closing.</div>
                    </>
                  ) : inc.feedbackRating ? (
                    <><span className="dash-stars" style={{ fontSize: 16 }}>{stars(inc.feedbackRating)}</span>{inc.feedbackComment && <div style={{ fontSize: 13, color: "#344054", marginTop: 4 }}>{inc.feedbackComment}</div>}</>
                  ) : <div style={{ fontSize: 13, color: "#98A2B3" }}>—</div>}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 22 }}>
              <div className="proto-eyebrow-title" style={{ marginBottom: 10 }}>Conversation</div>
              {messages.length === 0 && <div style={{ fontSize: 12.5, color: "#98A2B3" }}>No messages yet.</div>}
              {shownMsgs.map((m) => {
                const mine = m.author?.userId === inc.createdBy?.userId;
                return (
                  <div key={m.activityId} style={{ display: "flex", gap: 10, padding: "8px 0", flexDirection: mine ? "row-reverse" : "row" }}>
                    <div className="user-avatar" style={{ width: 30, height: 30, fontSize: 11, background: mine ? "#EFF4FC" : "#ECFDF3", color: mine ? "#175CD3" : "#067647" }}>{initials(m.author?.fullName ?? "?")}</div>
                    <div style={{ maxWidth: "75%" }}>
                      <div style={{ fontSize: 13, whiteSpace: "pre-wrap", background: mine ? "#EFF4FC" : "#F9FAFB", padding: "8px 12px", borderRadius: 10 }}>{m.content}</div>
                      <div style={{ fontSize: 11.5, color: "#98A2B3", marginTop: 2, textAlign: mine ? "right" : "left" }}>{mine ? "You" : m.author?.fullName ?? "Support"} · {fmtShort(m.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
              {messages.length > 3 && <button type="button" className="btn-ghost btn-sm" onClick={() => setAllMsgs(!allMsgs)}>{allMsgs ? "Show fewer messages" : `Show all ${messages.length} messages`}</button>}
              {!closed && !cancelled && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input className="input" style={{ flex: 1 }} placeholder="Write a message to the support team…" value={draft} onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void send(); } }} aria-label="Message" />
                  <button type="button" className="btn-primary" disabled={!draft.trim()} onClick={() => void send()}>Send</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="proto-eyebrow-title" style={{ marginBottom: 12 }}>Progress</div>
              <div style={{ fontSize: 12, color: "#98A2B3" }}>Resolution Time</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtShort(inc.slaResolutionTarget)}</div>
              <div style={{ fontSize: 12, color: paused ? "#B54708" : inc.slaBreached && !done ? "#B42318" : "#067647" }}>
                {done ? (inc.slaBreached ? "Took longer than expected" : "Completed on time") : paused ? "On hold — the clock is paused" : `${inc.slaBreached ? "Running late" : "On track"} — ${remaining}`}
              </div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div className="proto-eyebrow-title" style={{ marginBottom: 12 }}>Timeline</div>
              {timeline.map(({ a, text }) => (
                <div key={a.activityId} style={{ display: "flex", gap: 10, padding: "6px 0" }}>
                  <span style={{ color: "#175CD3", width: 14 }}>●</span>
                  <div><div style={{ fontSize: 13 }}>{text}</div><div style={{ fontSize: 11.5, color: "#98A2B3" }}>{fmtShort(a.createdAt)}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {confirm && (
        <div role="dialog" aria-modal="true" aria-label="Confirm and close" style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
          <div className="card" style={{ width: 460, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Close {ref}?</div>
            <div style={{ fontSize: 13, color: "#667085", margin: "8px 0 14px" }}>Once closed, this incident can&apos;t be reopened — you&apos;ll need to raise a new one if the issue comes back.</div>
            <label className="field-group"><span className="lbl">Anything else to add? (optional)</span><textarea className="textarea" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void confirmClose()}>{busy ? "Closing…" : "Confirm & Close"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
