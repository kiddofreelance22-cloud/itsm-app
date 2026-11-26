import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, ThumbsDown, ThumbsUp, UserRound, X } from "lucide-react";
import { api } from "../api";

type DraftKind = "incident" | "service_request" | "ticket_update";
interface DraftPreview {
  title?: string;
  description?: string;
  categoryName?: string | null;
  categoryId?: number;
  subCategoryId?: number;
  classificationId?: number;
  impact?: string;
  urgency?: string;
  contactType?: string;
  derivedPriority?: string | null;
  suggestion?: {
    category?: { id: number; name: string } | null;
    subCategory?: { id: number; name: string } | null;
    impact?: { id: number; name: string } | null;
    urgency?: { id: number; name: string } | null;
    priority?: string | null;
    similarIncidents?: Array<{ number: string; title: string; status: string; resolutionNotes?: string | null }>;
  } | null;
  categoryOptions?: Array<{ id: number; name: string }>;
  subCategoryOptions?: Array<{ id: number; name: string; categoryId?: number }>;
  classificationOptions?: Array<{ id: number; name: string }>;
  contactTypeOptions?: string[];
  impactOptions?: string[];
  urgencyOptions?: string[];
  catalogName?: string;
  ticketNumber?: string;
  status?: string;
  changeType?: string;
  value?: string;
  answers?: Array<{ field: string; value: string }>;
  variables?: Array<{ variableId: number; label: string; fieldType: string; required: boolean; helpText?: string }>;
  variableValues?: Array<{ variableId: number; value: string }>;
  missingFields?: Array<string | { label: string; variableId?: number }>;
  requestPath?: { approvals?: Array<{ title: string; approver: string }> } | null;
}
interface DraftAction { actionId: string; kind: DraftKind; preview: DraftPreview; expiresAt: string; status?: string }
interface Msg {
  id?: string;
  role: "user" | "assistant";
  text: string;
  feedback?: 1 | -1 | null;
  feedbackComment?: string | null;
  draftActions?: DraftAction[];
}

const SESSION_KEY = "itsm_chat_session_id";
const GREETING: Msg = { role: "assistant", text: "Hi! I can help with how-to and catalog questions, check ticket status, prepare incident and service-request drafts, summarize authorized incidents, prepare ticket updates, or connect you to the Service Desk." };

function actionsFromToolCalls(toolCalls: unknown): DraftAction[] {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls.flatMap((call: any) => {
    const result = call?.resultSummary;
    if (!result?.actionId || !["incident", "service_request", "ticket_update"].includes(result.kind)) return [];
    return [{ actionId: result.actionId, kind: result.kind, preview: result.preview ?? {}, expiresAt: result.expiresAt, status: result.status ?? "pending" }];
  });
}

/** Floating AI assistant. Anything typed is masked for personal data on the server before it reaches the model. */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [draftEdits, setDraftEdits] = useState<Record<string, DraftPreview>>({});
  const [feedbackReasons, setFeedbackReasons] = useState<Record<string, string>>({});
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs, open, busy]);

  useEffect(() => {
    let active = true;
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return;
    api.get<Array<any>>(`/chat/sessions/${saved}`).then((rows) => {
      if (!active) return;
      setSessionId(saved);
      setMsgs(rows.length
        ? rows.map((row) => ({
            id: row.messageId,
            role: row.role,
            text: row.content,
            feedback: row.feedback,
            feedbackComment: row.feedbackComment,
            draftActions: actionsFromToolCalls(row.toolCalls),
          }))
        : [GREETING]);
    }).catch(() => {
      sessionStorage.removeItem(SESSION_KEY);
      if (active) setSessionId(undefined);
    });
    return () => { active = false; };
  }, []);

  const send = async (value = text) => {
    const message = value.trim();
    if (!message || busy) return;
    if (message === text.trim()) setText("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: message }]);
    try {
      const r = await api.post<{ sessionId: string; messageId: string; reply: string; draftActions?: DraftAction[] }>("/chat/message", { message, sessionId });
      setSessionId(r.sessionId);
      sessionStorage.setItem(SESSION_KEY, r.sessionId);
      setMsgs((m) => [...m, { id: r.messageId, role: "assistant", text: r.reply, draftActions: r.draftActions ?? [] }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", text: e?.message || "Sorry, something went wrong. Please try again." }]);
    } finally { setBusy(false); }
  };

  const editDraft = (action: DraftAction, changes: Partial<DraftPreview>) => {
    setDraftEdits((current) => ({
      ...current,
      [action.actionId]: {
        ...action.preview,
        ...(current[action.actionId] ?? {}),
        ...changes,
        ...("impact" in changes || "urgency" in changes ? { derivedPriority: null } : {}),
      },
    }));
  };

  const confirm = async (action: DraftAction) => {
    if (!sessionId || busy) return;
    setBusy(true);
    const preview = draftEdits[action.actionId] ?? action.preview;
    const edits = action.kind === "incident"
      ? {
          title: preview.title,
          description: preview.description,
          categoryId: preview.categoryId ?? preview.suggestion?.category?.id,
          subCategoryId: preview.subCategoryId ?? preview.suggestion?.subCategory?.id,
          classificationId: preview.classificationId,
          impact: preview.impact ?? preview.suggestion?.impact?.name,
          urgency: preview.urgency ?? preview.suggestion?.urgency?.name,
          contactType: preview.contactType,
        }
      : action.kind === "service_request"
        ? { variableValues: preview.variableValues ?? [] }
        : preview.changeType === "reopen" ? {} : { value: preview.value ?? "" };
    try {
      const result = await api.post<{ messageId: string; reply: string }>(`/chat/actions/${action.actionId}/confirm`, { sessionId, edits });
      setMsgs((messages): Msg[] => [...messages.map((message) => ({
        ...message,
        draftActions: message.draftActions?.map((draft) => draft.actionId === action.actionId ? { ...draft, status: "confirmed" } : draft),
      })), { id: result.messageId, role: "assistant", text: result.reply }]);
    } catch (e: any) {
      setMsgs((messages) => [...messages, { role: "assistant", text: e?.message || "The draft could not be confirmed. Please review it and try again." }]);
    } finally { setBusy(false); }
  };

  const cancel = async (action: DraftAction) => {
    if (!sessionId || busy) return;
    setBusy(true);
    try {
      const result = await api.post<{ messageId: string; reply: string }>(`/chat/actions/${action.actionId}/cancel`, { sessionId });
      setMsgs((messages): Msg[] => [...messages.map((message) => ({
        ...message,
        draftActions: message.draftActions?.map((draft) => draft.actionId === action.actionId ? { ...draft, status: "cancelled" } : draft),
      })), { id: result.messageId, role: "assistant", text: result.reply }]);
    } catch (e: any) {
      setMsgs((messages) => [...messages, { role: "assistant", text: e?.message || "The draft could not be cancelled." }]);
    } finally { setBusy(false); }
  };

  const rate = async (id: string, rating: 1 | -1) => {
    setMsgs((m) => m.map((x) => (x.id === id ? { ...x, feedback: rating } : x)));
    try { await api.post("/chat/feedback", { messageId: id, rating }); } catch { /* feedback is best-effort */ }
  };

  const submitFeedbackReason = async (id: string) => {
    const comment = (feedbackReasons[id] ?? "").trim();
    if (!comment) return;
    try {
      await api.post("/chat/feedback", { messageId: id, rating: -1, comment });
      setMsgs((messages) => messages.map((message) => message.id === id ? { ...message, feedbackComment: comment } : message));
    } catch { /* feedback is best-effort */ }
  };

  const renderDraft = (action: DraftAction) => {
    const preview = draftEdits[action.actionId] ?? action.preview;
    const requestValues = preview.variableValues ?? [];
    const missing = action.kind === "service_request"
      ? (preview.variables ?? [])
          .filter((field) => field.required && !requestValues.find((item) => item.variableId === field.variableId)?.value.trim())
          .map((field) => field.label)
      : (preview.missingFields ?? [])
          .filter((_field) => !(action.kind === "ticket_update" && preview.changeType === "contact_number" && !!preview.value?.trim()))
          .filter((field) => {
            if (action.kind !== "incident") return true;
            const label = (typeof field === "string" ? field : field.label).toLowerCase();
            const hasValue: Record<string, boolean> = {
              category: !!(preview.categoryId ?? preview.suggestion?.category?.id),
              classification: !!preview.classificationId,
              "short description": !!preview.title?.trim(),
              description: !!preview.description?.trim(),
              priority: !!preview.derivedPriority || !!(preview.impact && preview.urgency),
              impact: !!(preview.impact ?? preview.suggestion?.impact?.name),
              urgency: !!(preview.urgency ?? preview.suggestion?.urgency?.name),
              "contact type": !!preview.contactType,
            };
            const key = Object.keys(hasValue).find((candidate) => label.includes(candidate));
            return key ? !hasValue[key] : true;
          })
          .map((field) => typeof field === "string" ? field : field.label);
    const categoryId = preview.categoryId ?? preview.suggestion?.category?.id;
    const subCategoryOptions = (preview.subCategoryOptions ?? []).filter((option) => option.categoryId === categoryId);
    const pending = !action.status || action.status === "pending";
    return (
      <section className="chatw-draft" key={action.actionId} aria-label="Ticket draft">
        <b>{action.kind === "incident" ? "Incident draft" : action.kind === "service_request" ? "Service request draft" : "Ticket update draft"}</b>
        {action.kind === "incident" ? (
          <>
            <label>Title<input value={preview.title ?? ""} maxLength={200} onChange={(e) => editDraft(action, { title: e.target.value })} /></label>
            <label>Description<textarea value={preview.description ?? ""} maxLength={4000} onChange={(e) => editDraft(action, { description: e.target.value })} /></label>
            <label>Category
              <select value={preview.categoryId ?? preview.suggestion?.category?.id ?? ""} onChange={(e) => {
                const id = Number(e.target.value);
                const selected = (preview.categoryOptions ?? []).find((option) => option.id === id);
                editDraft(action, { categoryId: id || undefined, categoryName: selected?.name ?? null, subCategoryId: undefined });
              }}>
                <option value="">No category</option>
                {(preview.categoryOptions ?? []).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </label>
            {preview.suggestion?.category && <div>Suggested category: {preview.suggestion.category.name}</div>}
            <label>Classification
              <select value={preview.classificationId ?? ""} onChange={(e) => {
                const id = Number(e.target.value);
                editDraft(action, { classificationId: id || undefined });
              }}>
                <option value="">Select…</option>
                {(preview.classificationOptions ?? []).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </label>
            <label>Sub-category
              <select value={preview.subCategoryId ?? (categoryId === preview.suggestion?.category?.id ? preview.suggestion?.subCategory?.id : undefined) ?? ""} onChange={(e) => {
                const id = Number(e.target.value);
                editDraft(action, { subCategoryId: id || undefined });
              }}>
                <option value="">No sub-category</option>
                {subCategoryOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </label>
            <label>Impact
              <select value={preview.impact ?? preview.suggestion?.impact?.name ?? ""} onChange={(e) => editDraft(action, { impact: e.target.value })}>
                <option value="">Not specified</option>
                {(preview.impactOptions ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>Urgency
              <select value={preview.urgency ?? preview.suggestion?.urgency?.name ?? ""} onChange={(e) => editDraft(action, { urgency: e.target.value })}>
                <option value="">Not specified</option>
                {(preview.urgencyOptions ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            {preview.suggestion?.subCategory && <div>Suggested sub-category: {preview.suggestion.subCategory.name}</div>}
            {preview.derivedPriority && <div>Priority from Impact × Urgency: {preview.derivedPriority}</div>}
            {!preview.derivedPriority && <div>Priority will be calculated from Impact × Urgency.</div>}
            <label>Contact type
              <select value={preview.contactType ?? "Self-Service Portal"} onChange={(e) => editDraft(action, { contactType: e.target.value })}>
                {(preview.contactTypeOptions ?? ["Self-Service Portal", "Email", "Phone", "Chat"]).map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            {!!preview.suggestion?.similarIncidents?.length && (
              <div><b>Similar tickets</b>
                <ul>{preview.suggestion.similarIncidents.map((ticket) => <li key={ticket.number}>{ticket.number}: {ticket.title} ({ticket.status}){ticket.resolutionNotes ? ` — ${ticket.resolutionNotes}` : ""}</li>)}</ul>
              </div>
            )}
          </>
        ) : action.kind === "service_request" ? (
          <>
            <div><b>Catalog item:</b> {preview.catalogName}</div>
            {(preview.variables ?? []).map((field) => {
              const value = requestValues.find((item) => item.variableId === field.variableId)?.value ?? "";
              return (
                <label key={field.variableId}>{field.label}{field.required ? " *" : ""}
                  <input value={value} onChange={(e) => editDraft(action, {
                    variableValues: [
                      ...requestValues.filter((item) => item.variableId !== field.variableId),
                      { variableId: field.variableId, value: e.target.value },
                    ],
                  })} />
                </label>
              );
            })}
            {preview.requestPath?.approvals?.map((approval, i) => <div key={i}>Approval: {approval.title} — {approval.approver}</div>)}
          </>
        ) : (
          <>
            <div><b>Ticket:</b> {preview.ticketNumber} — {preview.title} ({preview.status})</div>
            <div><b>Change:</b> {preview.changeType?.replace(/_/g, " ")}</div>
            {preview.changeType === "contact_number" ? (
              <label>New contact number<input type="tel" value={preview.value ?? ""} maxLength={20} autoComplete="tel"
                onChange={(e) => editDraft(action, { value: e.target.value })} /></label>
            ) : (
              <label>{preview.changeType === "work_note" ? "Internal work note" : preview.changeType === "reopen" ? "Reopen incident" : "Comment or information"}
                {preview.changeType !== "reopen" && <textarea value={preview.value ?? ""} maxLength={2000}
                  onChange={(e) => editDraft(action, { value: e.target.value })} />}
              </label>
            )}
          </>
        )}
        {missing.length > 0 && <div className="chatw-draft-missing">Please provide: {missing.join(", ")}</div>}
        {pending ? (
          <div className="chatw-draft-actions">
            <button disabled={busy || missing.length > 0} onClick={() => confirm(action)}>{action.kind === "ticket_update" ? "Confirm update" : "Confirm"}</button>
            <button disabled={busy} onClick={() => cancel(action)}>Cancel</button>
          </div>
        ) : <div className="chatw-draft-status">{action.status === "confirmed" ? "Confirmed" : action.status === "expired" ? "Expired" : "Cancelled"}</div>}
      </section>
    );
  };

  return (
    <>
      {!open && (
        <button className="chatw-fab" aria-label="Open assistant" onClick={() => setOpen(true)}><MessageCircle size={24} /></button>
      )}
      {open && (
        <div className="chatw-panel" role="dialog" aria-label="Assistant">
          <div className="chatw-head">
            <b>IT Assistant</b>
            <button aria-label="Close assistant" onClick={() => setOpen(false)}><X size={18} /></button>
          </div>
          <div className="chatw-body">
            {msgs.map((m, i) => (
              <div key={m.id ?? i} className={`chatw-msg ${m.role}`}>
                <div className="chatw-bubble">{m.text}</div>
                {m.draftActions?.map(renderDraft)}
                {m.role === "assistant" && m.id && (
                  <div className="chatw-rate">
                    <button aria-label="Helpful" className={m.feedback === 1 ? "on" : ""} onClick={() => rate(m.id!, 1)}><ThumbsUp size={14} /></button>
                    <button aria-label="Not helpful" className={m.feedback === -1 ? "on" : ""} onClick={() => rate(m.id!, -1)}><ThumbsDown size={14} /></button>
                    {m.feedback === -1 && (
                      <span className="chatw-feedback-reason">
                        <input value={feedbackReasons[m.id] ?? m.feedbackComment ?? ""} maxLength={500} placeholder="Optional reason"
                          onChange={(e) => setFeedbackReasons((current) => ({ ...current, [m.id!]: e.target.value }))} />
                        <button disabled={!feedbackReasons[m.id]?.trim()} onClick={() => void submitFeedbackReason(m.id!)}>Send</button>
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="chatw-msg assistant"><div className="chatw-bubble chatw-typing">Working… The local assistant may take a moment.</div></div>}
            <div ref={bottom} />
          </div>
          <div className="chatw-input">
            <button aria-label="Talk to a person" title="Talk to a person" disabled={busy} onClick={() => void send("Talk to a person")}><UserRound size={16} /></button>
            <input value={text} maxLength={2000} placeholder="Ask a question…" onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
            <button aria-label="Send" disabled={busy || !text.trim()} onClick={() => void send()}><Send size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}
