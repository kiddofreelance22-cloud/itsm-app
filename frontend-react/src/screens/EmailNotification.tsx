import React, { useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { NotificationRuleRow, notificationApi } from "../configApi";
import { useAsync } from "../hooks";
import { api } from "../api";
import { ErrorBar, Eyebrow, PageHeader, SearchBox, StatusPill, TH, errMsg } from "../components/configKit";

export const EVENT_OPTIONS = [
  { value: "created", label: "Incident Created" }, { value: "assigned", label: "Incident Assigned" },
  { value: "pendingCustomer", label: "Pending Customer" }, { value: "onHold", label: "On Hold" },
  { value: "resolved", label: "Incident Resolved" }, { value: "closed", label: "Incident Closed" },
  { value: "reopened", label: "Incident Reopened" }, { value: "slaBreachWarning", label: "SLA Breach Warning" },
  { value: "approvalRequested", label: "Approval Requested" },
];
const EVENT_LABEL = Object.fromEntries(EVENT_OPTIONS.map((o) => [o.value, o.label]));
const RECIPIENTS = [
  { key: "reporter", label: "Reporter" }, { key: "assignedAgent", label: "Assigned Agent" },
  { key: "workgroup", label: "Workgroup Members" }, { key: "approver", label: "Approver" }, { key: "watchers", label: "Watchers" },
];
const RLABEL = Object.fromEntries(RECIPIENTS.map((r) => [r.key, r.label]));

/** Parameters that can be dropped into the subject/body; the server fills them from the real incident. */
export const PARAMETERS: { key: string; label: string; sample: string }[] = [
  { key: "incident.id", label: "Incident ID", sample: "INC0010046" },
  { key: "incident.shortDescription", label: "Short Description", sample: "Laptop is not connecting to the VPN" },
  { key: "incident.description", label: "Description", sample: "Since this morning the VPN client fails with a timeout." },
  { key: "incident.priority", label: "Priority", sample: "P2 - High" },
  { key: "incident.status", label: "Status", sample: "In Progress" },
  { key: "incident.category", label: "Category", sample: "Network" },
  { key: "incident.assignedTo", label: "Assigned To", sample: "Asha Verma" },
  { key: "incident.assignmentGroup", label: "Assignment Group", sample: "General Support" },
  { key: "incident.reporter", label: "Requested For", sample: "Manisha Sahasrabuddhe" },
  { key: "incident.reporterEmail", label: "Requester E-mail", sample: "manisha@example.com" },
  { key: "incident.createdAt", label: "Created On", sample: "Wed, 07 Oct 2026 20:39:00 GMT" },
  { key: "incident.resolutionCode", label: "Resolution Code", sample: "Fixed by Reset" },
  { key: "incident.resolutionNotes", label: "Resolution Notes", sample: "Reinstalled the VPN client and re-issued the certificate." },
  { key: "incident.link", label: "Incident Link", sample: "https://itsm.example.com/incidents/INC0010046" },
];
const SAMPLE = Object.fromEntries(PARAMETERS.map((p) => [p.key, p.sample]));
const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
/** Fills the parameters with sample incident data so the preview shows what a real e-mail looks like. */
const withSample = (tpl: string) => tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => (k in SAMPLE ? escHtml(SAMPLE[k]) : m));

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Ticket Notification</title></head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif; color:#1d2433;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
        <tr><td style="background-color:#1f4e79; padding:22px 28px; color:#ffffff; font-size:22px; font-weight:bold;">IT Service Management</td></tr>
        <tr><td style="padding:28px;">
          <p>Hello {{incident.reporter}},</p>
          <p>Your service ticket has been updated. Please find the details below.</p>
          <table width="100%" cellpadding="6" cellspacing="0" style="border:1px solid #e4e7ec; border-radius:6px; font-size:14px;">
            <tr><td width="35%"><b>Incident ID</b></td><td>{{incident.id}}</td></tr>
            <tr><td><b>Summary</b></td><td>{{incident.shortDescription}}</td></tr>
            <tr><td><b>Status</b></td><td>{{incident.status}}</td></tr>
            <tr><td><b>Priority</b></td><td>{{incident.priority}}</td></tr>
            <tr><td><b>Assigned To</b></td><td>{{incident.assignedTo}}</td></tr>
          </table>
          <p style="margin-top:24px;"><a href="{{incident.link}}" style="background-color:#175cd3; color:#ffffff; padding:10px 20px; border-radius:6px; text-decoration:none; font-weight:bold;">View Ticket</a></p>
          <p style="color:#667085; font-size:12px;">This is an automated message from the IT Service Management portal.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

interface Form { name: string; triggerEvent: string; recipients: string[]; subject: string; body: string; bodyFormat: "text" | "html"; displayOrder: number; isActive: boolean }
const blank = (n: number): Form => ({ name: "", triggerEvent: EVENT_OPTIONS[0].value, recipients: [], subject: "", body: "", bodyFormat: "html", displayOrder: n, isActive: true });

export function EmailNotificationPage() {
  const { data, loading, error, reload } = useAsync(() => notificationApi.list(), []);
  const statusesQ = useAsync(() => api.get<{ statusId: number; statusName: string; isActive: boolean }[]>("/status"), []);
  const allStatuses = (statusesQ.data ?? []).filter((s) => s.isActive !== false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<"new" | NotificationRuleRow | null>(null);
  const [form, setForm] = useState<Form>(blank(1));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [param, setParam] = useState(PARAMETERS[0].key);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const items = data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q) || i.subject.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const openAdd = () => { setForm(blank(items.length + 1)); setFormError(""); setEditing("new"); };
  const openEdit = (r: NotificationRuleRow) => {
    setForm({ name: r.name, triggerEvent: r.triggerEvent, recipients: [...r.recipients], subject: r.subject, body: r.body, bodyFormat: r.bodyFormat ?? "text", displayOrder: r.displayOrder, isActive: r.isActive });
    setFormError(""); setEditing(r);
  };

  /** Inserts `before + selection + after` at the cursor (wrapping the selected text when there is one). */
  const insertAtCursor = (before: string, after = "", fallback = "") => {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? form.body.length, end = el?.selectionEnd ?? form.body.length;
    const selected = form.body.slice(start, end) || fallback;
    const next = form.body.slice(0, start) + before + selected + after + form.body.slice(end);
    setForm({ ...form, body: next });
    requestAnimationFrame(() => { el?.focus(); const pos = start + before.length + selected.length + after.length; el?.setSelectionRange(pos, pos); });
  };
  const toolbar: [string, () => void, React.CSSProperties?][] = [
    ["B", () => insertAtCursor("<b>", "</b>", "bold text"), { fontWeight: 800 }],
    ["I", () => insertAtCursor("<i>", "</i>", "italic text"), { fontStyle: "italic" }],
    ["¶ Paragraph", () => insertAtCursor("<p>", "</p>", "Paragraph text")],
    ["Line Break", () => insertAtCursor("<br>")],
    ["Link", () => { const url = window.prompt("Link address (https://…)", "https://"); if (url) insertAtCursor(`<a href="${escHtml(url)}">`, "</a>", "link text"); }],
    ["CTA Button", () => insertAtCursor('<a href="{{incident.link}}" style="display:inline-block; background-color:#175cd3; color:#ffffff; padding:10px 20px; border-radius:6px; text-decoration:none; font-weight:bold;">', "</a>", "View Ticket")],
  ];
  const previewDoc = form.bodyFormat === "html" ? withSample(form.body) : `<div style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${withSample(escHtml(form.body))}</div>`;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.subject.trim()) { setFormError("Rule Name and Subject are required."); return; }
    setSaving(true); setFormError("");
    try {
      const payload = { ...form, name: form.name.trim(), subject: form.subject.trim(), displayOrder: Number(form.displayOrder) || 0 };
      if (editing === "new") await notificationApi.create(payload);
      else if (editing) await notificationApi.update(editing.ruleId, payload);
      setEditing(null); reload();
    } catch (err) { setFormError(errMsg(err, "Unable to save.")); }
    finally { setSaving(false); }
  };

  const crumb = "Configuration > Others > E-mail Notification";
  const subtitle = "Configure which incident events send an e-mail, who receives it, and what the message says.";

  if (editing) {
    return (
      <>
        <PageHeader crumb={crumb} title="E-mail Notification" subtitle={subtitle} />
        <div className="page-body">
          <form className="card admin-master-form-panel" onSubmit={save}>
            <div className="admin-master-form-heading">
              <h2>{editing === "new" ? "Add Notification Rule" : "Edit Notification Rule"}</h2>
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>← Back to Notification Rules</button>
            </div>
            <ErrorBar msg={formError} />
            <div className="admin-master-form-grid">
              <label className="field-group">
                <span className="lbl">Rule Name <span className="req">*</span></span>
                <input className="input" value={form.name} maxLength={200} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </label>
              <label className="field-group">
                <span className="lbl">Trigger Event <span className="req">*</span></span>
                <select className="select" value={form.triggerEvent} onChange={(e) => setForm({ ...form, triggerEvent: e.target.value })}>
                  <optgroup label="System Events">
                    {EVENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </optgroup>
                  {allStatuses.length > 0 && (
                    <optgroup label="Status Configuration">
                      {allStatuses.map((s) => (
                        <option key={s.statusId} value={s.statusName}>Status: {s.statusName}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              {/* Show all configured statuses from Status Configuration */}
              <div className="field-group">
                <span className="lbl">Status Configuration</span>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                  Click any status below to quickly select it as the Trigger Event:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {statusesQ.loading ? (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Loading statuses…</span>
                  ) : allStatuses.length === 0 ? (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>No statuses configured.</span>
                  ) : allStatuses.map((s) => {
                    const isSelected = form.triggerEvent === s.statusName || (form.triggerEvent === "assigned" && s.statusName === "Assigned") || (form.triggerEvent === "resolved" && s.statusName === "Resolved") || (form.triggerEvent === "closed" && s.statusName === "Closed") || (form.triggerEvent === "onHold" && s.statusName === "On Hold");
                    return (
                      <button
                        type="button"
                        key={s.statusId}
                        onClick={() => setForm({ ...form, triggerEvent: s.statusName })}
                        title={`Click to set Trigger Event to "${s.statusName}"`}
                        style={{
                          fontSize: 12,
                          background: isSelected ? "#3538CD" : "#EFF4FF",
                          color: isSelected ? "#FFFFFF" : "#3538CD",
                          border: `1px solid ${isSelected ? "#3538CD" : "#C7D7FD"}`,
                          borderRadius: 6,
                          padding: "3px 10px",
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          transition: "all 0.15s ease",
                        }}
                      >
                        {s.statusName}
                        {isSelected && <span style={{ fontSize: 10, fontWeight: 700 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="field-group">
                <span className="lbl">Display Order</span>
                <input className="input" type="number" min={0} value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
              </label>
              <div className="field-group">
                <span className="lbl">Status</span>
                <span className="admin-master-check-label"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</span>
              </div>
              <div className="field-group admin-master-wide">
                <span className="lbl">Recipients</span>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Who gets this e-mail when the trigger event happens.</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
                  {RECIPIENTS.map((r) => (
                    <label key={r.key} className="admin-master-check-label">
                      <input type="checkbox" checked={form.recipients.includes(r.key)}
                        onChange={(e) => setForm({ ...form, recipients: e.target.checked ? [...form.recipients, r.key] : form.recipients.filter((x) => x !== r.key) })} />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>
              <label className="field-group admin-master-wide">
                <span className="lbl">Subject <span className="req">*</span></span>
                <input className="input" value={form.subject} maxLength={300} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  Use tokens like {"{{incident.id}}"}, {"{{incident.shortDescription}}"}, {"{{incident.priority}}"} and {"{{incident.assignedTo}}"} — they&apos;re filled in with the real incident&apos;s details when the e-mail is sent.
                </div>
              </label>
              <div className="field-group admin-master-wide">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span className="lbl">Email Body</span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select className="select" style={{ width: 130 }} aria-label="Body format" value={form.bodyFormat} onChange={(e) => setForm({ ...form, bodyFormat: e.target.value as "text" | "html" })}>
                      <option value="html">HTML</option><option value="text">Plain text</option>
                    </select>
                    {form.bodyFormat === "html" && <button type="button" className="btn-ghost btn-sm" onClick={() => { if (!form.body.trim() || window.confirm("Replace the current body with the default template?")) setForm({ ...form, body: DEFAULT_HTML }); }}>Use default template</button>}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 8px" }}>
                  {form.bodyFormat === "html" ? "Design the e-mail as HTML — use the toolbar to add formatting, then insert incident details as parameters." : "Plain text; line breaks are kept. Insert incident details as parameters."}
                </div>
                {form.bodyFormat === "html" && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {toolbar.map(([label, run, style]) => <button key={label} type="button" className="btn-ghost btn-sm" style={style} onClick={run}>{label}</button>)}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <select className="select" style={{ width: 240 }} aria-label="Parameter" value={param} onChange={(e) => setParam(e.target.value)}>
                    {PARAMETERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                  <button type="button" className="btn-primary btn-sm" onClick={() => insertAtCursor(`{{${param}}}`)}>+ Insert Parameter</button>
                </div>
                <textarea ref={bodyRef} className="textarea" aria-label="Email body" spellCheck={false} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                  style={{ minHeight: 220, fontFamily: form.bodyFormat === "html" ? "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" : undefined, fontSize: 12.5 }} />
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Parameters are inserted at the cursor as {"{{incident.id}}"} and replaced with the real incident details when the e-mail is sent.</div>
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="btn-ghost btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setShowPreview(!showPreview)}>
                    {showPreview ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />} {showPreview ? "Hide Preview" : "Show Preview"}
                  </button>
                </div>
                {showPreview && (
                  <div style={{ marginTop: 10, border: "1px solid #D0D5DD", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ background: "#F9FAFB", padding: "6px 12px", fontSize: 12, color: "#667085", borderBottom: "1px solid #E4E7EC" }}>Preview — rendered with sample incident data</div>
                    <div style={{ padding: "8px 12px", fontSize: 13, borderBottom: "1px solid #F2F4F7" }}><b>Subject:</b> {form.subject.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => SAMPLE[k] ?? m) || <span style={{ color: "#98A2B3" }}>(empty)</span>}</div>
                    {/* sandbox="" = no scripts, no forms, no navigation: a rule's HTML can never run code inside the admin's session */}
                    <iframe title="E-mail preview" sandbox="" srcDoc={previewDoc} style={{ width: "100%", height: 380, border: 0, background: "#fff" }} />
                  </div>
                )}
              </div>
            </div>
            <div className="admin-master-form-actions">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
            </div>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader crumb={crumb} title="E-mail Notification" subtitle={subtitle} />
      <div className="page-body">
        <ErrorBar msg={error ?? ""} />
        <div className="card admin-master-table-wrap">
          <Eyebrow title={<>E-mail Notification Rules ( {loading ? "…" : items.length} )</>}
            action={<button className="btn-primary admin-master-add" onClick={openAdd}><Plus size={15} aria-hidden="true" /> Add Notification Rule</button>} />
          <div style={{ padding: "0 20px 14px" }}><SearchBox value={query} onChange={setQuery} placeholder="Search notification rules…" /></div>
          {loading ? <div className="spinner-row">Loading…</div> : filtered.length === 0 ? (
            <div className="empty-state">{query ? `No notification rules match "${query}".` : "No notification rules yet."}</div>
          ) : (
            <div style={{ padding: "0 20px 20px" }}>
              <table>
                <thead><tr>
                  <th style={{ width: 44 }} /><th style={TH}>Rule</th><th style={{ ...TH, width: 170 }}>Trigger Event</th>
                  <th style={TH}>Recipients</th><th style={{ ...TH, width: 110 }}>Status</th><th style={{ width: 44 }} />
                </tr></thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.ruleId}>
                      <td style={{ verticalAlign: "top", paddingTop: 14 }}><div className="numbered-badge">{r.displayOrder}</div></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{r.name}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{r.subject}</div>
                      </td>
                      <td style={{ fontSize: 12.5 }}>
                        {EVENT_LABEL[r.triggerEvent] ?? (allStatuses.some((s) => s.statusName.toLowerCase() === r.triggerEvent.toLowerCase()) ? `Status: ${r.triggerEvent}` : r.triggerEvent)}
                      </td>
                      <td>
                        {r.recipients.length ? r.recipients.map((k) => (
                          <span key={k} className="chip" style={{ marginRight: 4, fontSize: 11 }}>{RLABEL[k] ?? k}</span>
                        )) : <span style={{ color: "var(--muted)", fontSize: 12 }}>No recipients</span>}
                      </td>
                      <td><StatusPill active={r.isActive} /></td>
                      <td className="admin-master-actions">
                        <button className="admin-master-icon-button" title="Edit" aria-label={`Edit ${r.name}`} onClick={() => openEdit(r)}><Pencil size={15} aria-hidden="true" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
