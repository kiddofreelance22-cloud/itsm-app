import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import { useAsync } from "../hooks";
import { ErrorBar, formatDate } from "../components/configKit";

interface ChatMessageRow {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  feedback?: 1 | -1 | null;
  feedbackComment?: string | null;
  toolCalls: Array<{ name: string }>;
}
interface ConversationRow {
  sessionId: string;
  lastActivity: string;
  messages: ChatMessageRow[];
}
interface FeedbackReport {
  createdTickets: number;
  conversations: ConversationRow[];
}

export function ChatbotFeedbackPage() {
  const { user } = useAuth();
  const [rating, setRating] = useState<"all" | "1" | "-1">("all");
  const { data, loading, error } = useAsync(
    () => user?.role === "ADMIN"
      ? api.get<FeedbackReport>(`/chat/admin/feedback${rating === "all" ? "" : `?rating=${rating}`}`)
      : Promise.resolve({ createdTickets: 0, conversations: [] }),
    [rating, user?.role],
  );
  if (user?.role !== "ADMIN") return <div className="page-body"><ErrorBar msg="This page is available to administrators only." /></div>;

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">Administration &gt; Chatbot Feedback</div>
          <div className="page-title">Chatbot Feedback</div>
          <div className="page-subtitle">Recent masked conversations, tool activity, and user ratings.</div>
        </div>
      </div>
      <div className="page-body">
        <ErrorBar msg={error ?? ""} />
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <strong>Tickets created by the chatbot: {loading ? "…" : data?.createdTickets ?? 0}</strong>
          <label style={{ marginLeft: 24 }}>Rating{" "}
            <select value={rating} onChange={(event) => setRating(event.target.value as typeof rating)}>
              <option value="all">All ratings</option>
              <option value="1">Thumbs up</option>
              <option value="-1">Thumbs down</option>
            </select>
          </label>
        </div>
        {loading ? <div className="spinner-row">Loading…</div> : !data?.conversations.length
          ? <div className="empty-state">No recent conversations match this filter.</div>
          : data.conversations.map((conversation) => (
            <section className="card" key={conversation.sessionId} style={{ padding: 18, marginBottom: 12 }}>
              <h3 style={{ marginTop: 0 }}>Conversation {conversation.sessionId.slice(0, 8)} · {formatDate(conversation.lastActivity)}</h3>
              {conversation.messages.map((message, index) => (
                <article key={`${message.createdAt}-${index}`} style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
                  <strong>{message.role === "user" ? "User" : "Assistant"}</strong>
                  {" · "}{formatDate(message.createdAt)}
                  <p style={{ whiteSpace: "pre-wrap", margin: "6px 0" }}>{message.content}</p>
                  {!!message.toolCalls.length && <div>Tools: {message.toolCalls.map((tool) => tool.name).join(", ")}</div>}
                  {message.feedback != null && <div>Rating: {message.feedback === 1 ? "Thumbs up" : "Thumbs down"}
                    {message.feedbackComment ? ` — ${message.feedbackComment}` : ""}</div>}
                </article>
              ))}
            </section>
          ))}
      </div>
    </>
  );
}
