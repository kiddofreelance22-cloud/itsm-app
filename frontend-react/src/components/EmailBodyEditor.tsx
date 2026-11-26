import React, { useMemo, useRef, useState } from "react";

/** Sample values for the preview. Parameters are replaced with the real request's details when the e-mail is sent. */
export const SAMPLE_PARAMS: Record<string, string> = {
  "request.number": "SR0000482", "request.item": "Laptop - standard", "request.category": "Hardware", "request.priority": "P3 - Medium",
  "request.status": "In Progress", "request.requestedBy": "Anita Desai", "request.assignedTo": "Rahul Verma", "request.workgroup": "Desktop Support",
  "request.dueDate": "30 Oct 2026, 5:00 PM", "request.holdReason": "Waiting for stock", "approval.stage": "Manager approval",
  "approval.comments": "Approved, please proceed.", "recipient.name": "Anita",
};
const PARAM_LABEL: Record<string, string> = {
  "request.number": "Request number", "request.item": "Catalog item", "request.category": "Category", "request.priority": "Priority", "request.status": "Status",
  "request.requestedBy": "Requested by", "request.assignedTo": "Assigned to", "request.workgroup": "Workgroup", "request.dueDate": "Estimated delivery",
  "request.holdReason": "Hold reason", "approval.stage": "Approval stage", "approval.comments": "Approver comments", "recipient.name": "Recipient's first name",
};
export const paramLabel = (k: string) => PARAM_LABEL[k] ?? k;

const escapeHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** HTML to readable plain text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => (label.replace(/<[^>]+>/g, "").trim() === href ? href : `${label.replace(/<[^>]+>/g, "").trim()} (${href})`))
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*/gi, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
}
/** Plain text to simple HTML: blank lines make paragraphs, single line breaks make <br>. */
export function textToHtml(text: string): string {
  return text.trim().split(/\n{2,}/).filter(Boolean).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("\n");
}
export const fillSample = (t: string) => t.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => SAMPLE_PARAMS[k] ?? "");

/**
 * Body editor for an e-mail rule. The body is stored as HTML. In plain-text mode the same message is shown and edited as text.
 * Formatting and parameters are added at the end of the body, ready to be moved into place.
 */
export function EmailBodyEditor({ value, onChange, fields }: { value: string; onChange: (html: string) => void; fields: string[] }) {
  const [mode, setMode] = useState<"html" | "text" | "visual">("html");
  const [previewAs, setPreviewAs] = useState<"rendered" | "text">("rendered");
  const [text, setText] = useState(() => htmlToText(value));
  const ref = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLIFrameElement>(null);
  const shown = mode === "text" ? text : value;
  const set = (v: string) => { if (mode === "text") { setText(v); onChange(textToHtml(v)); } else onChange(v); };
  const switchTo = (m: "html" | "text" | "visual") => { if (m === mode) return; if (m === "text") setText(htmlToText(value)); setMode(m); };
  // The visual editor loads the body once when it is opened; later edits come from the editor itself so the caret never jumps.
  const visualDoc = useMemo(() => (mode === "visual" ? (/<html[\s>]/i.test(value) ? value : `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:14px">${value}</body></html>`) : ""), [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const visualDocOf = () => editorRef.current?.contentDocument ?? null;
  const syncVisual = () => { const d = visualDocOf(); if (d) onChange(`<!doctype html>\n${d.documentElement.outerHTML}`); };
  const onVisualLoad = () => {
    const d = visualDocOf(); if (!d) return;
    d.designMode = "on";
    d.addEventListener("input", syncVisual);
  };
  const exec = (cmd: string, arg?: string) => { const d = visualDocOf(); if (!d) return; editorRef.current?.contentWindow?.focus(); d.execCommand(cmd, false, arg); syncVisual(); };
  const append = (htmlBit: string, textBit: string) => {
    if (mode === "visual") { exec("insertText", textBit || htmlBit); return; }
    const base = shown; set(base + (mode === "html" ? htmlBit : textBit)); requestAnimationFrame(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }); };
  const tool = (label: string, onClick: () => void) => <button type="button" className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={onClick}>{label}</button>;
  const preview = htmlToText(fillSample(value));
  const previewDoc = /<html[\s>]/i.test(value) ? fillSample(value) : `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:12px;font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${fillSample(value)}</body></html>`;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <div className="sr-chips" role="group" aria-label="Body format">
          <button type="button" className={`sr-chip ${mode === "html" ? "active" : ""}`} aria-pressed={mode === "html"} onClick={() => switchTo("html")}>HTML</button>
          <button type="button" className={`sr-chip ${mode === "text" ? "active" : ""}`} aria-pressed={mode === "text"} onClick={() => switchTo("text")}>Plain text</button>
          <button type="button" className={`sr-chip ${mode === "visual" ? "active" : ""}`} aria-pressed={mode === "visual"} onClick={() => switchTo("visual")}>Editor</button>
        </div>
        {mode === "visual" ? (
          <>
            {tool("Bold", () => exec("bold"))}
            {tool("Italic", () => exec("italic"))}
            {tool("Underline", () => exec("underline"))}
            {tool("Bullets", () => exec("insertUnorderedList"))}
            {tool("Link", () => { const u = window.prompt("Link address", "https://"); if (u) exec("createLink", u); })}
          </>
        ) : (
          <>
            {tool("Paragraph", () => append("\n<p></p>", "\n\n"))}
            {tool("Line break", () => append("<br>", "\n"))}
          </>
        )}
        {mode === "html" && tool("Link", () => append('<a href="https://">link text</a>', ""))}
        {mode === "html" && tool("Action button", () => append('\n<p><a href="https://" style="display:inline-block;padding:10px 18px;background:#1D4ED8;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">Open request</a></p>', ""))}
        <select className="select" style={{ width: 200 }} aria-label="Insert parameter" value="" onChange={(e) => { if (e.target.value) append(`{{${e.target.value}}}`, `{{${e.target.value}}}`); }}>
          <option value="">Insert parameter</option>{fields.map((f) => <option key={f} value={f}>{paramLabel(f)}</option>)}
        </select>
      </div>
      {mode === "visual" ? (
        <iframe ref={editorRef} title="E-mail editor" sandbox="allow-same-origin" srcDoc={visualDoc} onLoad={onVisualLoad} style={{ width: "100%", height: 320, border: "1px solid #E4E7EC", borderRadius: 8, background: "#fff" }} />
      ) : (
        <textarea ref={ref} className="textarea" aria-label="E-mail body" style={{ minHeight: 190, fontFamily: mode === "html" ? "monospace" : "inherit" }} value={shown} onChange={(e) => set(e.target.value)} />
      )}
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{mode === "visual" ? "Edit the e-mail directly as it will look. Parameters such as {{request.number}} are replaced with the real request's details when the e-mail is sent." : "Formatting and parameters are added at the end of the body; move them into place in the box above. Parameters are replaced with the real request's details when the e-mail is sent."}</div>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <div className="lbl" style={{ margin: 0 }}>Preview with sample request data</div>
          <div className="sr-chips" role="group" aria-label="Preview type">
            <button type="button" className={`sr-chip ${previewAs === "rendered" ? "active" : ""}`} aria-pressed={previewAs === "rendered"} onClick={() => setPreviewAs("rendered")}>As sent</button>
            <button type="button" className={`sr-chip ${previewAs === "text" ? "active" : ""}`} aria-pressed={previewAs === "text"} onClick={() => setPreviewAs("text")}>Text only</button>
          </div>
        </div>
        {previewAs === "rendered" ? (
          value.trim()
            ? <iframe title="E-mail preview" sandbox="" srcDoc={previewDoc} style={{ width: "100%", height: 420, border: "1px solid #E4E7EC", borderRadius: 8, background: "#fff" }} />
            : <div style={{ padding: "10px 12px", background: "#F9FAFB", border: "1px solid #E4E7EC", borderRadius: 8, fontSize: 13 }}>Nothing to preview yet.</div>
        ) : (
          <pre style={{ margin: 0, padding: "10px 12px", background: "#F9FAFB", border: "1px solid #E4E7EC", borderRadius: 8, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.55 }}>{preview || "Nothing to preview yet."}</pre>
        )}
      </div>
    </div>
  );
}
