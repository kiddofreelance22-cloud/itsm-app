"use client";

import { useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConversationMessage } from "@/types/incident";

export function ConversationPanel({ messages: initial }: { messages: ConversationMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          author: "You",
          timestamp: new Date().toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          message: draft.trim(),
        },
      ]);
      setDraft("");
      setSending(false);
    }, 500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="thin-scrollbar mb-3 flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="text-sm text-slate-400">No messages yet.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg bg-slate-50 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{m.author}</p>
                <p className="shrink-0 text-xs text-slate-400">{m.timestamp}</p>
              </div>
              <p className="text-sm text-slate-600">{m.message}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Attach a file to your message"
          >
            <Paperclip className="size-4" />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message..."
            aria-label="Type your message"
            className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100"
          />
          <Button size="sm" onClick={handleSend} loading={sending} disabled={!draft.trim()}>
            <Send className="size-4" /> Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
