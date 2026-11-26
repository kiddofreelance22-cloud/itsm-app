import React, { useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { useAsync } from "../hooks";
import { useAuth } from "../AuthContext";
import { ErrorBar, Eyebrow, SearchBox, StatusPill, TH, errMsg } from "../components/configKit";
import { PageHead } from "../components/changeKit";
import { changeApi, type NotificationEvent } from "../changeApi";

/** Merge fields a change e-mail can use; the server fills them from the real change. */
const PARAMETERS = [
  { key: "number", label: "Change ID" }, { key: "short_description", label: "Short Description" },
  { key: "description", label: "Description" }, { key: "type", label: "Change Model" },
  { key: "state", label: "State" }, { key: "risk", label: "Risk Level" }, { key: "priority", label: "Priority" },
  { key: "category", label: "Category" }, { key: "service", label: "Business Service" },
  { key: "assignment_group", label: "Assignment Group" }, { key: "requester", label: "Requester" },
  { key: "owner", label: "Change Owner" }, { key: "planned_start", label: "Planned Start" },
  { key: "planned_end", label: "Planned End" }, { key: "link", label: "Change Link" },
  { key: "approver", label: "Approver" }, { key: "comments", label: "Comments" },
];
const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const fill = (tpl: string) => tpl;

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Change Notification</title></head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif; color:#1d2433;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
        <tr><td style="background-color:#1f4e79; padding:22px 28px; color:#ffffff; font-size:22px; font-weight:bold;">IT Service Management</td></tr>
        <tr><td style="padding:28px;">
          <p>Hello,</p>
          <p>The change below has been updated. Please find the details below.</p>
          <table width="100%" cellpadding="6" cellspacing="0" style="border:1px solid #e4e7ec; border-radius:6px; font-size:14px;">
            <tr><td width="35%"><b>Change ID</b></td><td>{{change.number}}</td></tr>
            <tr><td><b>Summary</b></td><td>{{change.short_description}}</td></tr>
            <tr><td><b>Type</b></td><td>{{change.type}}</td></tr>
            <tr><td><b>State</b></td><td>{{change.state}}</td></tr>
            <tr><td><b>Risk</b></td><td>{{change.risk}}</td></tr>
            <tr><td><b>Planned</b></td><td>{{change.planned_start}} to {{change.planned_end}}</td></tr>
          </table>
          <p style="margin-top:24px;"><a href="{{change.link}}" style="background-color:#175cd3; color:#ffffff; padding:10px 20px; border-radius:6px; text-decoration:none; font-weight:bold;">View Change</a></p>
          <p style="color:#667085; font-size:12px;">This is an automated message from the IT Service Management portal.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export function ChangeNotificationsPage() {
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const q = useAsync(() => changeApi.config(), []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<NotificationEvent | null>(null);
  const [form, setForm] = useState<NotificationEvent | null>(null);
  const [formError, setFormError] = useState("");
  const [flash, setFlash] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [param, setParam] = useState(PARAMETERS[0].key);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const events = q.data?.notifications ?? [];
  const triggers = q.data?.notificationTriggers ?? [];
  const kinds = q.data?.recipientKinds ?? [];
  const availableTriggers = triggers.filter((trigger) => !events.some((event) => event.id === trigger.id));
  const [newTriggerId, setNewTriggerId] = useState("e1");
  const triggerToAdd = availableTriggers.find((trigger) => trigger.id === newTriggerId) ?? availableTriggers[0];
  const filtered = useMemo(() => { const t = query.trim().toLowerCase(); return t ? events.filter((e) => (e.name + e.subject + e.grp + e.when).toLowerCase().includes(t)) : events; }, [events, query]);
  const crumb = "Configuration > Change Management > E-mail Notification";
  const subtitle = `Configure which change events send an e-mail, who receives it, and what the message says. ${events.filter((e) => e.on).length} of ${events.length} events are switched on.`;

  const open = (e: NotificationEvent) => { setForm(JSON.parse(JSON.stringify(e))); setEditing(e); setFormError(""); setFlash(""); };
  const addRule = () => {
    const trigger = triggerToAdd;
    if (!trigger) return;
    const rule: NotificationEvent = { ...trigger, on: false, recipients: [], subject: `{{change.number}}: ${trigger.name} — {{change.short_description}}`, body: DEFAULT_HTML, format: "html" };
    setForm(rule); setEditing(rule); setFormError(""); setFlash("");
  };
  const patch = (fn: (f: NotificationEvent) => void) => setForm((p) => { if (!p) return p; const c = JSON.parse(JSON.stringify(p)) as NotificationEvent; fn(c); return c; });

  const insertAtCursor = (before: string, after = "", fallback = "") => {
    if (!form) return;
    const el = bodyRef.current, start = el?.selectionStart ?? form.body.length, end = el?.selectionEnd ?? form.body.length;
    const sel = form.body.slice(start, end) || fallback;
    patch((f) => { f.body = f.body.slice(0, start) + before + sel + after + f.body.slice(end); });
    requestAnimationFrame(() => { el?.focus(); const pos = start + before.length + sel.length + after.length; el?.setSelectionRange(pos, pos); });
  };
  const toolbar: [string, () => void, React.CSSProperties?][] = [
    ["B", () => insertAtCursor("<b>", "</b>", "bold text"), { fontWeight: 800 }], ["I", () => insertAtCursor("<i>", "</i>", "italic text"), { fontStyle: "italic" }],
    ["¶ Paragraph", () => insertAtCursor("<p>", "</p>", "Paragraph text")], ["Line Break", () => insertAtCursor("<br>")],
    ["Link", () => { const url = window.prompt("Link address (https://…)", "https://"); if (url) insertAtCursor(`<a href="${escHtml(url)}">`, "</a>", "link text"); }],
    ["CTA Button", () => insertAtCursor('<a href="{{change.link}}" style="display:inline-block; background-color:#175cd3; color:#ffffff; padding:10px 20px; border-radius:6px; text-decoration:none; font-weight:bold;">', "</a>", "View Change")],
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !editing) return;
    if (!form.name.trim()) { setFormError("Rule name is required."); return; }
    if (!form.subject.trim()) { setFormError("Subject is required."); return; }
    if (!form.body.trim()) { setFormError("The message cannot be empty."); return; }
    if (form.on && !form.recipients.length) { setFormError("This notification is switched on but has no recipients."); return; }
    setSaving(true); setFormError("");
    try {
      const next = events.some((x) => x.id === form.id)
        ? events.map((x) => (x.id === form.id ? form : x))
        : [...events, form];
      await changeApi.saveConfig("notifications", next);
      setEditing(null); setFlash(`“${form.name}” ${events.some((x) => x.id === form.id) ? "saved" : "created"}.`); q.reload();
    } catch (err) { setFormError(errMsg(err, "Unable to save.")); } finally { setSaving(false); }
  };

  if (editing && form) {
    const html = form.format === "html";
    const previewDoc = html ? fill(form.body) : `<div style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${escHtml(fill(form.body))}</div>`;
    return (
      <>
        <PageHead crumb={crumb} title="E-mail Notification" subtitle={subtitle} />
        <div className="page-body">
          <form className="card admin-master-form-panel" onSubmit={save}>
            <div className="admin-master-form-heading">
              <h2>{events.some((x) => x.id === editing.id) ? "Edit Notification Rule" : "Add Notification Rule"}</h2>
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>← Back to Notification Rules</button>
            </div>
            {!admin && <div className="cm-note warn" style={{ marginBottom: 10 }}>Only an administrator can save changes on this screen.</div>}
            <ErrorBar msg={formError} />
            <div className="admin-master-form-grid">
              <div className="field-group"><span className="lbl">Rule Name</span><input className="input" value={form.name} readOnly /></div>
              <div className="field-group"><span className="lbl">Trigger Event</span><input className="input" value={`${form.grp}: ${form.when}`} readOnly /><span className="cm-hint">Change events are fixed; you can switch each one on or off and edit its message.</span></div>
              <div className="field-group"><span className="lbl">Status</span><span className="admin-master-check-label"><input type="checkbox" checked={form.on} onChange={(e) => patch((f) => { f.on = e.target.checked; })} /> Active</span></div>
              <div className="field-group admin-master-wide">
                <span className="lbl">Recipients</span>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Choose who receives this e-mail when the trigger event happens. Anyone without an e-mail address is skipped.</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
                  {kinds.map((k) => (
                    <label key={k} className="admin-master-check-label"><input type="checkbox" checked={form.recipients.includes(k)} onChange={(e) => patch((f) => { f.recipients = e.target.checked ? [...f.recipients, k] : f.recipients.filter((x) => x !== k); })} /> {k}</label>
                  ))}
                </div>
              </div>
              <label className="field-group admin-master-wide">
                <span className="lbl">Subject <span className="req">*</span></span>
                <input className="input" value={form.subject} maxLength={300} onChange={(e) => patch((f) => { f.subject = e.target.value; })} />
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Use tokens like {"{{change.number}}"}, {"{{change.short_description}}"} and {"{{change.risk}}"} — they’re filled in with the real change’s details when the e-mail is sent.</div>
              </label>
              <div className="field-group admin-master-wide">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span className="lbl">Email Body</span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select className="select" style={{ width: 130 }} aria-label="Body format" value={form.format} onChange={(e) => patch((f) => { f.format = e.target.value as "html" | "text"; })}><option value="html">HTML</option><option value="text">Plain text</option></select>
                    {html && <button type="button" className="btn-ghost btn-sm" onClick={() => { if (!form.body.trim() || window.confirm("Replace the current body with the default template?")) patch((f) => { f.body = DEFAULT_HTML; }); }}>Use default template</button>}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 8px" }}>{html ? "Design the e-mail as HTML — use the toolbar to add formatting, then insert change details as parameters." : "Plain text; line breaks are kept. Insert change details as parameters."}</div>
                {html && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{toolbar.map(([label, run, style]) => <button key={label} type="button" className="btn-ghost btn-sm" style={style} onClick={run}>{label}</button>)}</div>}
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <select className="select" style={{ width: 240 }} aria-label="Parameter" value={param} onChange={(e) => setParam(e.target.value)}>{PARAMETERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select>
                  <button type="button" className="btn-primary btn-sm" onClick={() => insertAtCursor(`{{change.${param}}}`)}>+ Insert Parameter</button>
                </div>
                <textarea ref={bodyRef} className="textarea" aria-label="Email body" spellCheck={false} value={form.body} onChange={(e) => patch((f) => { f.body = e.target.value; })}
                  style={{ minHeight: 220, fontFamily: html ? "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" : undefined, fontSize: 12.5 }} />
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Parameters are inserted at the cursor as {"{{change.number}}"} and replaced with the real change details when the e-mail is sent. Older {"${number}"} tokens still work.</div>
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="btn-ghost btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setShowPreview(!showPreview)}>
                    {showPreview ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />} {showPreview ? "Hide Preview" : "Show Preview"}
                  </button>
                </div>
                {showPreview && (
                  <div style={{ marginTop: 10, border: "1px solid #D0D5DD", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ background: "#F9FAFB", padding: "6px 12px", fontSize: 12, color: "#667085", borderBottom: "1px solid #E4E7EC" }}>Preview — placeholders are shown as-is · To: {form.recipients.join(", ") || "nobody"}</div>
                    <div style={{ padding: "8px 12px", fontSize: 13, borderBottom: "1px solid #F2F4F7" }}><b>Subject:</b> {fill(form.subject) || <span style={{ color: "#98A2B3" }}>(empty)</span>}</div>
                    {/* sandbox="" = no scripts, no forms, no navigation: a rule's HTML can never run code inside the admin's session */}
                    <iframe title="E-mail preview" sandbox="" srcDoc={previewDoc} style={{ width: "100%", height: 380, border: 0, background: "#fff" }} />
                  </div>
                )}
              </div>
            </div>
            <div className="admin-master-form-actions">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving || !admin}>{saving ? "Saving…" : events.some((x) => x.id === editing.id) ? "Save Changes" : "Create Rule"}</button>
            </div>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead crumb={crumb} title="E-mail Notification" subtitle={subtitle} action={
        <div style={{ display: "flex", gap: 8 }}>
          <select className="select" aria-label="Notification trigger" value={triggerToAdd?.id ?? ""} disabled={!availableTriggers.length} onChange={(e) => setNewTriggerId(e.target.value)}>
            {availableTriggers.map((trigger) => <option key={trigger.id} value={trigger.id}>{trigger.name}</option>)}
          </select>
          <button className="btn-primary" disabled={!admin || q.loading || !availableTriggers.length} onClick={addRule}>Add notification rule</button>
        </div>} />
      <div className="page-body">
        {flash && <div className="cm-note ok" style={{ marginBottom: 12 }}>{flash}</div>}
        <ErrorBar msg={q.error ?? ""} />
        <div className="card admin-master-table-wrap">
          <Eyebrow title={<>E-mail Notification Rules ( {q.loading ? "…" : events.length} )</>} />
          <div style={{ padding: "0 20px 14px" }}><SearchBox value={query} onChange={setQuery} placeholder="Search notification rules…" /></div>
          {q.loading ? <div className="spinner-row">Loading…</div> : filtered.length === 0 ? <div className="empty-state">{query ? `No notification rules match "${query}".` : "No notification rules have been configured."}</div> : (
            <div style={{ padding: "0 20px 20px" }}>
              <table>
                <thead><tr><th style={{ width: 44 }} /><th style={TH}>Rule</th><th style={{ ...TH, width: 230 }}>Trigger Event</th><th style={TH}>Recipients</th><th style={{ ...TH, width: 110 }}>Status</th><th style={{ width: 44 }} /></tr></thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td style={{ verticalAlign: "top", paddingTop: 14 }}><div className="numbered-badge">{events.indexOf(e) + 1}</div></td>
                      <td><div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{e.name}</div><div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{e.subject}</div></td>
                      <td style={{ fontSize: 12.5 }}><b>{e.grp}</b><div className="cm-hint">{e.when}</div></td>
                      <td>{e.recipients.length ? e.recipients.map((k) => <span key={k} className="chip" style={{ marginRight: 4, fontSize: 11 }}>{k}</span>) : <span style={{ color: "var(--muted)", fontSize: 12 }}>No recipients</span>}</td>
                      <td><StatusPill active={e.on} /></td>
                      <td className="admin-master-actions"><button className="admin-master-icon-button" title="Edit" aria-label={`Edit ${e.name}`} onClick={() => open(e)}><Pencil size={15} aria-hidden="true" /></button></td>
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
