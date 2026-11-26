"use client";

import React, { useEffect, useMemo, useState } from "react";
import { csmApi, type CsmAttachment, type CsmCase, type CsmCustomerType, type CsmEscalation, type CsmMajorCase } from "../csmApi";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, formatDate, formatDateTime, errMsg } from "../components/configKit";
import { Link, useRouteParams, useRouter } from "../router";

const cardStyle: React.CSSProperties = { padding: 18, marginBottom: 14 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 };
const fieldStyle: React.CSSProperties = { display: "grid", gap: 5, marginBottom: 12 };
const inputStyle: React.CSSProperties = { minWidth: 0 };
const CASE_STATUSES = ["New", "Open", "Assigned", "In Progress", "Pending Customer", "Resolved", "Closed"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

function Metric({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return <section className="card" style={{ padding: 16 }}><div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div><strong style={{ display: "block", fontSize: 25, marginTop: 6 }}>{value}</strong>{detail && <small style={{ color: "var(--muted)" }}>{detail}</small>}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={fieldStyle}><span className="lbl">{label}</span>{children}</label>;
}

function TableMessage({ loading, error, empty }: { loading: boolean; error?: string | null; empty: string }) {
  if (loading) return <div className="spinner-row">Loading…</div>;
  if (error) return <ErrorBar msg={error} />;
  return <div className="empty-state">{empty}</div>;
}

function CaseTable({ cases }: { cases: CsmCase[] }) {
  return <div className="card" style={{ overflowX: "auto" }}>
    <table style={{ minWidth: 900 }}>
      <thead><tr><th>Case</th><th>Customer</th><th>Type</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>SLA</th><th>Updated</th></tr></thead>
      <tbody>{cases.map((item) => {
        const remaining = item.slaResolutionTarget ? new Date(item.slaResolutionTarget).getTime() - Date.now() : null;
        const sla = remaining == null ? "—" : remaining < 0 ? "Breached" : `${Math.ceil(remaining / 3600000)}h left`;
        return <tr key={item.caseId}>
          <td><Link to={`/csm/cases/${item.caseId}`} style={{ fontWeight: 700 }}>{item.caseCode}</Link><div>{item.shortDescription}</div></td>
          <td>{item.customerName}<div className="muted">{item.customerType}</div></td><td>{item.caseType}</td>
          <td><span className="badge">{item.priority}</span></td><td><span className="badge">{item.status}</span></td>
          <td>{item.assignedTo ?? item.assignmentGroup ?? "Unassigned"}</td><td>{sla}</td><td>{formatDateTime(item.updatedAt)}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

export function CsmDashboardPage() {
  const q = useAsync(() => csmApi.dashboard(), []);
  const { data } = q;
  return <>
    <PageHeader crumb="Customer Service Management" title="Customer Service Dashboard" subtitle="Monitor customer operations, case volumes, SLA performance and customer health."
      action={<Link className="btn-primary" to="/csm/cases/new">Create Case</Link>} />
    <div className="page-body">
      <ErrorBar msg={q.error ?? ""} />
      {q.loading && !data ? <div className="spinner-row">Loading…</div> : data && <>
        <div style={gridStyle}>
          <Metric label="Total Cases" value={data.totalCases} />
          <Metric label="Open Cases" value={data.openCases} />
          <Metric label="VIP / Priority" value={data.priorityCases} />
          <Metric label="Within SLA" value={data.withinSla} />
          <Metric label="SLA Breaches" value={data.slaBreaches} />
          <Metric label="Active Customers" value={data.customers} />
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
          <section className="card" style={{ ...cardStyle, flex: "2 1 620px" }}>
            <h2 style={{ marginTop: 0 }}>My Open Cases</h2>
            {data.recentCases.length ? <CaseTable cases={data.recentCases} /> : <div className="empty-state">No cases yet. Create a case to start building your customer support queue.</div>}
            <Link to="/csm/cases" className="btn-ghost" style={{ marginTop: 12 }}>View all cases</Link>
          </section>
          <section className="card" style={{ ...cardStyle, flex: "1 1 280px" }}>
            <h2 style={{ marginTop: 0 }}>Quick Actions</h2>
            <div style={{ display: "grid", gap: 8 }}>
              <Link className="btn-ghost" to="/csm/cases/new">＋ Create Case</Link>
              <Link className="btn-ghost" to="/csm/escalations/new">↗ Raise an Escalation</Link>
              <Link className="btn-ghost" to="/csm/major-cases/new">⚑ Create Major Case</Link>
              <Link className="btn-ghost" to="/csm/customer-health">◎ Customer Health</Link>
              <Link className="btn-ghost" to="/approvals">✓ My Approvals</Link>
            </div>
          </section>
        </div>
      </>}
    </div>
  </>;
}

const LIFE_STAGES = [
  ["Created", "Capture customer, category, product, description and evidence. A unique case number is generated and the applicable SLA starts."],
  ["Triage", "Validate the case, identify duplicates, confirm classification, assess impact and urgency, and set priority."],
  ["Assign", "Route the case to a support group or agent based on the service and customer context."],
  ["Investigate", "Record work logs, collaborate with resolver teams, link relevant records and keep the customer updated."],
  ["Resolve", "Record the resolution, validate service restoration and request customer confirmation."],
  ["Close", "Capture closure notes and feedback while retaining the complete case history."],
];

export function CsmLifecyclePage() {
  const [stage, setStage] = useState(0);
  return <>
    <PageHeader crumb="Customer Service Management > Case Management" title="Case Lifecycle Management" subtitle="End-to-end case management with visibility, SLA tracking and customer collaboration." />
    <div className="page-body">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
        {LIFE_STAGES.map(([name], index) => <button key={name} type="button" className={index === stage ? "btn-primary" : "btn-ghost"} onClick={() => setStage(index)}>{index + 1}. {name}</button>)}
      </div>
      <section className="card" style={{ ...cardStyle, marginTop: 14 }}>
        <h2>{LIFE_STAGES[stage][0]}</h2><p>{LIFE_STAGES[stage][1]}</p>
        <Link className="btn-primary" to={stage === 0 ? "/csm/cases/new" : "/csm/cases"}>{stage === 0 ? "Create Case" : "Open Case Inbox"}</Link>
      </section>
    </div>
  </>;
}

export function CsmCasesPage() {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [selectedView, setSelectedView] = useState(0);
  const [viewName, setViewName] = useState("");
  const [viewError, setViewError] = useState("");
  const viewsQuery = useAsync(() => csmApi.views(), []);
  const views = viewsQuery.data ?? [];
  const reloadViews = viewsQuery.reload;
  const cases = useAsync(() => csmApi.cases({ q: appliedQuery, status, priority, customerType, viewId: selectedView || undefined }), [appliedQuery, status, priority, customerType, selectedView]);
  const saveView = async () => {
    if (!viewName.trim()) { setViewError("Enter a name for this view."); return; }
    setViewError("");
    try {
      const saved = await csmApi.createView({ viewName, filters: { status: status || undefined, priority: priority || undefined, customerType: customerType || undefined }, isShared: false });
      setViewName("");
      setSelectedView(saved.viewId);
      reloadViews();
    } catch (error) { setViewError(errMsg(error)); }
  };
  return <>
    <PageHeader crumb="Customer Service Management > Case Management" title="Case Inbox" subtitle="View, manage and take action on cases across your teams."
      action={<Link className="btn-primary" to="/csm/cases/new">＋ Create Case</Link>} />
    <div className="page-body">
      <ErrorBar msg={cases.error ?? viewError} />
      <section className="card" style={cardStyle}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <Field label="Search"><input className="input" style={inputStyle} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setAppliedQuery(query); }} placeholder="Case number, description, or customer" /></Field>
          <Field label="Status"><select className="select" value={status} onChange={(e) => { setSelectedView(0); setStatus(e.target.value); }}><option value="">All statuses</option>{CASE_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Priority"><select className="select" value={priority} onChange={(e) => { setSelectedView(0); setPriority(e.target.value); }}><option value="">All priorities</option>{PRIORITIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Customer Type"><select className="select" value={customerType} onChange={(e) => { setSelectedView(0); setCustomerType(e.target.value); }}><option value="">B2B &amp; B2C</option><option>B2B</option><option>B2C</option></select></Field>
          <button type="button" className="btn-primary" onClick={() => { setSelectedView(0); setAppliedQuery(query); }}>Search</button>
        </div>
        <div style={{ display: "flex", alignItems: "end", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <Field label="Saved view"><select className="select" value={selectedView} onChange={(e) => setSelectedView(Number(e.target.value))}><option value={0}>All matching cases</option>{views.map((view) => <option key={view.viewId} value={view.viewId}>{view.viewName}{view.isShared ? " (Shared)" : ""}</option>)}</select></Field>
          <Field label="Save current filters as a view"><input className="input" value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="e.g. High priority B2B" /></Field>
          <button type="button" className="btn-ghost" onClick={() => void saveView()}>Save view</button>
        </div>
      </section>
      {cases.loading && !cases.data ? <TableMessage loading empty="" /> : cases.error ? <ErrorBar msg={cases.error} /> :
        cases.data?.length ? <CaseTable cases={cases.data} /> : <div className="empty-state">No cases match these filters.</div>}
    </div>
  </>;
}

export function CsmCaseCreatePage() {
  const { navigate } = useRouter();
  const routeType = useRouteParams("/csm/cases/new/:type")?.type;
  const lookups = useAsync(() => csmApi.lookups(), []);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<Record<string, string>>({
    customerType: routeType === "b2c" ? "B2C" : "B2B", caseType: "Issue", category: "", subcategory: "",
    productService: "", customerId: "", customerContact: "", contactEmail: "", contactPhone: "",
    shortDescription: "", description: "", priority: "Medium", impact: "Single User", urgency: "Medium",
    source: "Agent", assignmentGroupId: "", assignedTo: "", slaId: "",
    occurrenceAt: "", issueFrequency: "One time", issueLocation: "", affectedComponent: "",
    stepsToReproduce: "", additionalNotes: "",
  });
  const [selectedContactId, setSelectedContactId] = useState("");
  const contacts = useAsync(
    () => data.customerId ? csmApi.customerContacts(Number(data.customerId)) : Promise.resolve([]),
    [data.customerId],
  );
  const put = (key: string, value: string) => setData((current) => ({ ...current, [key]: value }));
  const customers = useMemo(() => (lookups.data?.customers ?? []).filter((customer) => customer.type === data.customerType), [lookups.data, data.customerType]);
  const submit = async () => {
    setSaving(true); setError("");
    try {
      const created = await csmApi.createCase({
        customerId: Number(data.customerId), customerContact: data.customerContact, contactEmail: data.contactEmail,
        contactPhone: data.contactPhone, caseType: data.caseType, category: data.category, subcategory: data.subcategory,
        productService: data.productService, shortDescription: data.shortDescription, description: data.description,
        priority: data.priority, impact: data.impact, urgency: data.urgency, source: data.source,
        assignmentGroupId: data.assignmentGroupId ? Number(data.assignmentGroupId) : undefined,
        assignedTo: data.assignedTo ? Number(data.assignedTo) : undefined, slaId: data.slaId ? Number(data.slaId) : undefined,
        issueDetails: {
          occurrenceAt: data.occurrenceAt || undefined, issueFrequency: data.issueFrequency,
          issueLocation: data.issueLocation, affectedComponent: data.affectedComponent,
          stepsToReproduce: data.stepsToReproduce, additionalNotes: data.additionalNotes,
        },
      });
      navigate(`/csm/cases/${created.caseId}`);
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  return <>
    <PageHeader crumb="Customer Service Management > Cases" title="Create Case" subtitle="Capture the customer's issue, request or complaint and start the appropriate SLA." />
    <div className="page-body">
      <ErrorBar msg={error || lookups.error || ""} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(250px,1fr)", gap: 14, alignItems: "start" }}>
        <section className="card" style={cardStyle}>
          <div className="tabs" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {["Case Details", "Additional Information", "Review & Submit"].map((item, index) => <button key={item} className={index === step ? "btn-primary" : "btn-ghost"} type="button" onClick={() => setStep(index)}>{index + 1}. {item}</button>)}
          </div>
          {step === 0 && <>
            <h2>Customer Information</h2>
            <div style={gridStyle}>
              <Field label="Customer Type *"><select className="select" value={data.customerType} onChange={(e) => { put("customerType", e.target.value); put("customerId", ""); }}><option>B2B</option><option>B2C</option></select></Field>
              <Field label="Customer *"><select className="select" required value={data.customerId} onChange={(e) => { put("customerId", e.target.value); setSelectedContactId(""); put("customerContact", ""); put("contactEmail", ""); put("contactPhone", ""); }}><option value="">Select a customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.code})</option>)}</select></Field>
              {data.customerId && <Field label="Saved Contact"><select className="select" value={selectedContactId} onChange={(e) => {
                const contact = contacts.data?.find((person) => person.contactId === Number(e.target.value));
                setSelectedContactId(e.target.value);
                if (contact) { put("customerContact", contact.fullName); put("contactEmail", contact.email ?? ""); put("contactPhone", contact.phone ?? ""); }
              }}><option value="">{contacts.loading ? "Loading contacts…" : "Enter contact manually"}</option>{contacts.data?.filter((contact) => contact.status === "Active").map((contact) => <option key={contact.contactId} value={contact.contactId}>{contact.fullName}{contact.isPrimary ? " · Primary" : ""}</option>)}</select></Field>}
              <Field label="Contact"><input className="input" value={data.customerContact} onChange={(e) => put("customerContact", e.target.value)} /></Field>
              <Field label="Contact Email"><input type="email" className="input" value={data.contactEmail} onChange={(e) => put("contactEmail", e.target.value)} /></Field>
              <Field label="Contact Phone"><input className="input" value={data.contactPhone} onChange={(e) => put("contactPhone", e.target.value)} /></Field>
            </div>
            <h2>Case Information</h2>
            <div style={gridStyle}>
              <Field label="Case Type *"><select className="select" value={data.caseType} onChange={(e) => put("caseType", e.target.value)}><option>Issue</option><option>Request</option><option>Complaint</option></select></Field>
              <Field label="Category *"><input className="input" required value={data.category} onChange={(e) => put("category", e.target.value)} /></Field>
              <Field label="Subcategory"><input className="input" value={data.subcategory} onChange={(e) => put("subcategory", e.target.value)} /></Field>
              <Field label="Product / Service"><input className="input" value={data.productService} onChange={(e) => put("productService", e.target.value)} /></Field>
            </div>
            <Field label="Short Description *"><input className="input" required maxLength={300} value={data.shortDescription} onChange={(e) => put("shortDescription", e.target.value)} /></Field>
            <Field label="Description *"><textarea className="textarea" required maxLength={4000} rows={4} value={data.description} onChange={(e) => put("description", e.target.value)} /></Field>
            <h2>Details &amp; Prioritization</h2>
            <div style={gridStyle}>
              <Field label="Priority"><select className="select" value={data.priority} onChange={(e) => put("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
              <Field label="Impact"><select className="select" value={data.impact} onChange={(e) => put("impact", e.target.value)}><option>Single User</option><option>Multiple Users</option><option>Business Unit</option><option>Enterprise</option></select></Field>
              <Field label="Urgency"><select className="select" value={data.urgency} onChange={(e) => put("urgency", e.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></Field>
              <Field label="Source"><select className="select" value={data.source} onChange={(e) => put("source", e.target.value)}><option>Agent</option><option>Customer Portal</option><option>Email</option><option>Phone</option><option>Chat</option><option>Social Media</option></select></Field>
              <Field label="Support Group"><select className="select" value={data.assignmentGroupId} onChange={(e) => put("assignmentGroupId", e.target.value)}><option value="">Unassigned</option>{lookups.data?.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></Field>
              <Field label="Assignee"><select className="select" value={data.assignedTo} onChange={(e) => put("assignedTo", e.target.value)}><option value="">Unassigned</option>{lookups.data?.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></Field>
              <Field label="SLA"><select className="select" value={data.slaId} onChange={(e) => put("slaId", e.target.value)}><option value="">No SLA selected</option>{lookups.data?.slas.map((s) => <option key={s.id} value={s.id}>{s.label} · {s.service}</option>)}</select></Field>
            </div>
          </>}
          {step === 1 && <>
            <h2>Additional Information</h2>
            <div style={gridStyle}>
              <Field label="Occurrence Date & Time"><input className="input" type="datetime-local" value={data.occurrenceAt} onChange={(e) => put("occurrenceAt", e.target.value)} /></Field>
              <Field label="Issue Frequency"><select className="select" value={data.issueFrequency} onChange={(e) => put("issueFrequency", e.target.value)}><option>One time</option><option>Intermittent</option><option>Continuous</option></select></Field>
              <Field label="Issue Location"><input className="input" value={data.issueLocation} onChange={(e) => put("issueLocation", e.target.value)} /></Field>
              <Field label="Affected Service Component"><input className="input" value={data.affectedComponent} onChange={(e) => put("affectedComponent", e.target.value)} /></Field>
            </div>
            <Field label="Steps to Reproduce"><textarea className="textarea" rows={4} maxLength={2000} value={data.stepsToReproduce} onChange={(e) => put("stepsToReproduce", e.target.value)} /></Field>
            <Field label="Additional Notes"><textarea className="textarea" rows={4} maxLength={2000} value={data.additionalNotes} onChange={(e) => put("additionalNotes", e.target.value)} /></Field>
          </>}
          {step === 2 && <section className="card" style={cardStyle}>
            <h2>Review &amp; Submit</h2>
            <p><strong>Customer:</strong> {customers.find((c) => c.id === Number(data.customerId))?.label ?? "Not selected"}</p>
            <p><strong>Case:</strong> {data.caseType} · {data.category || "No category"} · {data.priority}</p>
            <p><strong>Description:</strong> {data.shortDescription || "Not entered"}</p>
            <p>{data.description}</p>
            <div className="sr-notice">Submitting creates a case record and starts the selected SLA.</div>
          </section>}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
            <button type="button" className="btn-ghost" onClick={() => step === 0 ? navigate("/csm/cases") : setStep(step - 1)}>{step === 0 ? "Cancel" : "Back"}</button>
            {step < 2 ? <button type="button" className="btn-primary" disabled={step === 0 && (!data.customerId || !data.category || !data.shortDescription || !data.description)} onClick={() => setStep(step + 1)}>Next: {step === 0 ? "Additional Information" : "Review & Submit"} →</button>
              : <button type="button" className="btn-primary" disabled={saving} onClick={() => void submit()}>{saving ? "Submitting…" : "Submit Case"}</button>}
          </div>
        </section>
        <aside>
          <section className="card" style={cardStyle}><h3>Customer Snapshot</h3>{customers.find((c) => c.id === Number(data.customerId))?.label ?? (lookups.loading ? "Loading customers…" : "Select a customer to see account context.")}</section>
          <section className="card" style={cardStyle}><h3>Case Workflow</h3><ol>{LIFE_STAGES.map(([s]) => <li key={s}>{s}</li>)}</ol></section>
          {lookups.error && <ErrorBar msg={lookups.error} />}
        </aside>
      </div>
    </div>
  </>;
}

export function CsmCaseDetailsPage() {
  const params = useRouteParams("/csm/cases/:id");
  const id = Number(params?.id);
  const valid = Number.isInteger(id) && id > 0;
  const item = useAsync(() => valid ? csmApi.case(id) : Promise.reject(new Error("Case not found.")), [id, valid]);
  const attachments = useAsync(() => valid ? csmApi.caseAttachments(id) : Promise.resolve([]), [id, valid]);
  const lookups = useAsync(() => csmApi.lookups(), []);
  const [activity, setActivity] = useState("");
  const [activityType, setActivityType] = useState("Work Log");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [groupId, setGroupId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [resolutionCode, setResolutionCode] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [closureNotes, setClosureNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  React.useEffect(() => {
    if (!item.data) return;
    setStatus(item.data.status);
    setPriority(item.data.priority);
    setGroupId(item.data.assignmentGroupId ? String(item.data.assignmentGroupId) : "");
    setAssigneeId(item.data.assignedToId ? String(item.data.assignedToId) : "");
    setResolutionCode(item.data.resolutionCode ?? "");
    setResolutionSummary(item.data.resolutionSummary ?? "");
    setClosureNotes(item.data.closureNotes ?? "");
  }, [item.data]);
  const update = async (patch: Record<string, unknown>) => {
    if (!item.data) return;
    setBusy(true); setError("");
    try { await csmApi.updateCase(item.data.caseId, patch); item.reload(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const addActivity = async () => {
    if (!activity.trim() || !item.data) return;
    setBusy(true); setError("");
    try { await csmApi.addActivity(item.data.caseId, { activityType, content: activity }); setActivity(""); item.reload(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const uploadAttachment = async (file?: File) => {
    if (!file || !item.data) return;
    setBusy(true); setAttachmentError("");
    try { await csmApi.uploadCaseAttachment(item.data.caseId, file); attachments.reload(); }
    catch (e) { setAttachmentError(errMsg(e)); }
    finally { setBusy(false); }
  };
  const deleteAttachment = async (attachment: CsmAttachment) => {
    if (!item.data) return;
    setAttachmentError("");
    try { await csmApi.deleteCaseAttachment(item.data.caseId, attachment.attachmentId); attachments.reload(); }
    catch (e) { setAttachmentError(errMsg(e)); }
  };
  const downloadAttachment = async (attachment: CsmAttachment) => {
    if (!item.data) return;
    setAttachmentError("");
    try { await csmApi.downloadCaseAttachment(item.data.caseId, attachment); }
    catch (e) { setAttachmentError(errMsg(e)); }
  };
  const row = item.data;
  return <>
    <PageHeader crumb="Customer Service Management > Case Inbox" title={row ? `${row.caseCode} · ${row.shortDescription}` : "Case Details"} subtitle={row ? `${row.customerName} · ${row.customerType} · ${row.caseType}` : ""} action={<Link className="btn-ghost" to="/csm/cases">Back to cases</Link>} />
    <div className="page-body"><ErrorBar msg={item.error ?? error} />
      {!row ? <TableMessage loading={item.loading} error={item.error} empty="Case not found." /> : <>
        <div style={gridStyle}>
          <Metric label="Status" value={row.status} />
          <Metric label="Priority" value={row.priority} />
          <Metric label="Assigned" value={row.assignedTo ?? row.assignmentGroup ?? "Unassigned"} />
          <Metric label="Resolution SLA" value={row.slaResolutionTarget ? formatDateTime(row.slaResolutionTarget) : "Not set"} />
        </div>
        <section className="card" style={cardStyle}>
          <h2>Case Details</h2><p>{row.description}</p>
          <div style={gridStyle}><div><strong>Customer</strong><p>{row.customerName} ({row.customerCode})</p></div><div><strong>Product / Service</strong><p>{row.productService ?? "—"}</p></div><div><strong>Category</strong><p>{row.category} / {row.subcategory ?? "—"}</p></div><div><strong>Source</strong><p>{row.source}</p></div><div><strong>Created</strong><p>{formatDateTime(row.createdAt)}</p></div><div><strong>Updated</strong><p>{formatDateTime(row.updatedAt)}</p></div></div>
          <div style={gridStyle}>
            <Field label="Update Status"><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>{CASE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Priority"><select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Support Group"><select className="select" value={groupId} onChange={(e) => { setGroupId(e.target.value); if (assigneeId && !lookups.data?.groupMembers.some((m) => m.groupId === Number(e.target.value) && m.userId === Number(assigneeId))) setAssigneeId(""); }}><option value="">Unassigned</option>{lookups.data?.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></Field>
            <Field label="Assignee"><select className="select" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">Unassigned</option>{lookups.data?.users.filter((u) => !groupId || lookups.data?.groupMembers.some((m) => m.groupId === Number(groupId) && m.userId === u.id)).map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></Field>
          </div>
          {status === "Resolved" && <Field label="Resolution Summary *"><textarea className="textarea" rows={3} value={resolutionSummary} onChange={(e) => setResolutionSummary(e.target.value)} /></Field>}
          {status === "Closed" && <><Field label="Resolution Code"><input className="input" value={resolutionCode} onChange={(e) => setResolutionCode(e.target.value)} /></Field><Field label="Resolution Summary *"><textarea className="textarea" rows={3} value={resolutionSummary} onChange={(e) => setResolutionSummary(e.target.value)} /></Field><Field label="Closure Notes *"><textarea className="textarea" rows={3} value={closureNotes} onChange={(e) => setClosureNotes(e.target.value)} /></Field></>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <button type="button" className="btn-primary" disabled={busy || (status === "Resolved" && !resolutionSummary.trim()) || (status === "Closed" && !closureNotes.trim())}
              onClick={() => void update({ status, priority, assignmentGroupId: groupId ? Number(groupId) : null, assignedTo: assigneeId ? Number(assigneeId) : null, resolutionCode, resolutionSummary, closureNotes })}>Save Case</button>
            <Link className="btn-ghost" to={`/csm/escalations/new?caseId=${row.caseId}`}>Raise Escalation</Link>
          </div>
        </section>
        <section className="card" style={cardStyle}><h2>Investigation &amp; Updates</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <Field label="Activity Type"><select className="select" value={activityType} onChange={(e) => setActivityType(e.target.value)}><option>Work Log</option><option>Internal Note</option><option>Customer Update</option></select></Field>
            <Field label="Add Work Log / Note"><textarea className="textarea" rows={2} value={activity} onChange={(e) => setActivity(e.target.value)} /></Field>
            <button type="button" className="btn-primary" disabled={busy || !activity.trim()} onClick={() => void addActivity()}>Add Update</button>
          </div>
          <ol>{(row.activity ?? []).map((entry) => <li key={entry.activityId}><strong>{entry.activityType}</strong> · {entry.createdBy ?? "User"} · {formatDateTime(entry.createdAt)}<div>{entry.content}</div></li>)}</ol>
        </section>
        <section className="card" style={cardStyle}><h2>Attachments</h2><ErrorBar msg={attachmentError || attachments.error || ""} />
          <label className="btn-ghost" style={{ display: "inline-flex", cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Uploading…" : "＋ Add attachment"}
            <input type="file" accept=".pdf,.docx,.xlsx,.txt,.png,.jpg,.jpeg" disabled={busy} style={{ display: "none" }}
              onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void uploadAttachment(file); }} />
          </label>
          {attachments.loading && !attachments.data ? <div className="spinner-row">Loading attachments…</div>
            : attachments.data?.length ? <ul>{attachments.data.map((attachment) => <li key={attachment.attachmentId}>
              {attachment.fileName} · {(attachment.sizeBytes / 1024).toFixed(0)} KB
              <button type="button" className="btn-ghost" onClick={() => void downloadAttachment(attachment)}>Download</button>
              <button type="button" className="btn-ghost" onClick={() => void deleteAttachment(attachment)}>Remove</button>
            </li>)}</ul> : <div className="empty-state">No supporting files attached.</div>}
        </section>
        {!!row.relatedMajorCases?.length && <section className="card" style={cardStyle}><h2>Related Major Cases</h2>{row.relatedMajorCases.map((major) => <p key={major.majorCaseId}><Link to="/csm/major-cases">{major.majorCaseCode}</Link> · {major.title} · {major.status}</p>)}</section>}
      </>}
    </div>
  </>;
}

export function CsmEscalationsPage() {
  const list = useAsync(() => csmApi.escalations(), []);
  const [error, setError] = useState("");
  const changeStatus = async (row: CsmEscalation, status: string) => {
    setError("");
    try { await csmApi.updateEscalation(row.escalationId, status); list.reload(); } catch (e) { setError(errMsg(e)); }
  };
  return <>
    <PageHeader crumb="Customer Service Management > Case Management" title="Escalations" subtitle="Track and manage case escalations, progress and target dates." action={<Link to="/csm/escalations/new" className="btn-primary">＋ Create Escalation</Link>} />
    <div className="page-body"><ErrorBar msg={list.error ?? error} />
      {list.loading && !list.data ? <TableMessage loading empty="" /> : list.data?.length ? <div className="card" style={{ overflowX: "auto" }}><table style={{ minWidth: 900 }}><thead><tr><th>Escalation</th><th>Case</th><th>Customer</th><th>Type / Level</th><th>Priority</th><th>Target</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{list.data.map((e) => <tr key={e.escalationId}><td>{e.escalationCode}</td><td><Link to={`/csm/cases/${e.caseId}`}>{e.caseCode}</Link><div>{e.caseTitle}</div></td><td>{e.customerName} ({e.customerType})</td><td>{e.escalationType} · {e.level}</td><td>{e.priority}</td><td>{formatDateTime(e.dueBy)}</td><td>{e.status}</td><td>{e.status !== "Resolved" && <button className="btn-ghost" type="button" onClick={() => void changeStatus(e, e.status === "Open" ? "In Progress" : "Resolved")}>{e.status === "Open" ? "Start" : "Resolve"}</button>}</td></tr>)}</tbody></table></div> : <div className="empty-state">No escalations yet.</div>}
    </div>
  </>;
}

export function CsmEscalationCreatePage() {
  const { navigate } = useRouter();
  const lookups = useAsync(() => Promise.all([csmApi.lookups(), csmApi.cases()]).then(([options, cases]) => ({ options, cases })), []);
  const [data, setData] = useState({ caseId: "", escalationType: "SLA Breach", level: "Level 2 (L2) - Team Lead", priority: "High", targetGroupId: "", targetUserId: "", dueBy: "", reason: "", comments: "", recipients: "Case Owner, Support Group, Customer", sendImmediateNotification: true });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const put = (key: string, value: string) => setData((old) => ({ ...old, [key]: value }));
  const [urlCase, setUrlCase] = useState("");
  useEffect(() => {
    setUrlCase(new URLSearchParams(window.location.search).get("caseId") ?? "");
  }, []);
  const submit = async () => {
    setSaving(true); setError("");
    try {
      await csmApi.createEscalation({
        caseId: Number(data.caseId), escalationType: data.escalationType, level: data.level, priority: data.priority,
        targetGroupId: data.targetGroupId ? Number(data.targetGroupId) : undefined, targetUserId: data.targetUserId ? Number(data.targetUserId) : undefined,
        dueBy: data.dueBy, reason: data.reason, comments: data.comments, recipients: data.recipients.split(",").map((x) => x.trim()).filter(Boolean),
        sendImmediateNotification: data.sendImmediateNotification,
      });
      navigate("/csm/escalations");
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  useEffect(() => {
    if (urlCase) setData((old) => old.caseId ? old : { ...old, caseId: urlCase });
  }, [urlCase]);
  return <>
    <PageHeader crumb="Customer Service Management > Escalations" title="Create Escalation" subtitle="Raise a case for higher-level attention and faster resolution." />
    <div className="page-body"><ErrorBar msg={error || lookups.error || ""} />
      <section className="card" style={cardStyle}>
        <div style={gridStyle}>
          <Field label="Case *"><select className="select" value={data.caseId} onChange={(e) => put("caseId", e.target.value)}><option value="">Select an open case</option>{(lookups.data?.cases ?? []).filter((c) => !["Resolved", "Closed"].includes(c.status)).map((c) => <option key={c.caseId} value={c.caseId}>{c.caseCode} · {c.shortDescription}</option>)}</select></Field>
          <Field label="Escalation Type *"><select className="select" value={data.escalationType} onChange={(e) => put("escalationType", e.target.value)}><option>SLA Breach</option><option>Priority</option><option>Customer</option><option>Major Case</option></select></Field>
          <Field label="Escalation Level *"><select className="select" value={data.level} onChange={(e) => put("level", e.target.value)}><option>Level 1 (L1) - Support Agent</option><option>Level 2 (L2) - Team Lead</option><option>Level 3 (L3) - Service Manager</option><option>Level 4 (L4) - Service Head</option></select></Field>
          <Field label="Priority"><select className="select" value={data.priority} onChange={(e) => put("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Support Group"><select className="select" value={data.targetGroupId} onChange={(e) => put("targetGroupId", e.target.value)}><option value="">Select a group</option>{lookups.data?.options.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></Field>
          <Field label="Target Individual"><select className="select" value={data.targetUserId} onChange={(e) => put("targetUserId", e.target.value)}><option value="">Optional</option>{lookups.data?.options.users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></Field>
          <Field label="Due By *"><input className="input" type="datetime-local" value={data.dueBy} onChange={(e) => put("dueBy", e.target.value)} /></Field>
        </div>
        <Field label="Escalation Reason *"><textarea className="textarea" maxLength={2000} rows={3} value={data.reason} onChange={(e) => put("reason", e.target.value)} /></Field>
        <Field label="Additional Comments"><textarea className="textarea" maxLength={2000} rows={2} value={data.comments} onChange={(e) => put("comments", e.target.value)} /></Field>
        <Field label="Notify (comma-separated)"><input className="input" value={data.recipients} onChange={(e) => put("recipients", e.target.value)} /></Field>
        <label><input type="checkbox" checked={data.sendImmediateNotification} onChange={(e) => setData((old) => ({ ...old, sendImmediateNotification: e.target.checked }))} /> Send immediate notification</label>
        <div style={{ marginTop: 18 }}><button type="button" className="btn-primary" disabled={saving || !data.caseId || !data.dueBy || !data.reason.trim()} onClick={() => void submit()}>{saving ? "Creating…" : "Create Escalation"}</button></div>
      </section>
    </div>
  </>;
}

export function CsmMajorCasesPage() {
  const list = useAsync(() => csmApi.majorCases(), []);
  const [error, setError] = useState("");
  const update = async (item: CsmMajorCase, status: string) => {
    const note = window.prompt("Add an update for the major case:", "");
    if (note === null) return;
    try { await csmApi.updateMajorCase(item.majorCaseId, { status, update: note }); list.reload(); } catch (e) { setError(errMsg(e)); }
  };
  return <>
    <PageHeader crumb="Customer Service Management > Case Management" title="Major Cases" subtitle="Coordinate high-impact incidents across customers, services and business operations." action={<Link to="/csm/major-cases/new" className="btn-primary">＋ Create Major Case</Link>} />
    <div className="page-body"><ErrorBar msg={list.error ?? error} />
      {list.loading && !list.data ? <TableMessage loading empty="" /> : list.data?.length ? <div className="card" style={{ overflowX: "auto" }}><table style={{ minWidth: 900 }}><thead><tr><th>Major Case</th><th>Service</th><th>Impact</th><th>Severity</th><th>Status</th><th>Started</th><th>Target Restore</th><th>Update</th></tr></thead><tbody>
        {list.data.map((m) => <tr key={m.majorCaseId}><td><strong>{m.majorCaseCode}</strong><div>{m.title}</div></td><td>{m.productService}</td><td>{m.businessImpact}</td><td>{m.severity}</td><td>{m.status}</td><td>{formatDateTime(m.incidentStart)}</td><td>{formatDateTime(m.targetRestoration)}</td><td><select className="select" value={m.status} onChange={(e) => void update(m, e.target.value)}>{["In Coordination", "In Progress", "Monitoring", "Resolved", "Closed"].map((s) => <option key={s}>{s}</option>)}</select></td></tr>)}
      </tbody></table></div> : <div className="empty-state">No major cases have been created.</div>}
    </div>
  </>;
}

export function CsmMajorCaseCreatePage() {
  const { navigate } = useRouter();
  const lookups = useAsync(() => Promise.all([csmApi.lookups(), csmApi.cases()]).then(([options, cases]) => ({ options, cases })), []);
  const [data, setData] = useState({ title: "", description: "", productService: "", majorCaseType: "Service Outage", severity: "Critical", businessImpact: "High", impactType: "Service Disruption", estimatedImpact: "", ownerId: "", incidentCommanderId: "", resolverGroupId: "", coordinationGroupId: "", incidentStart: "", targetRestoration: "", notifyCustomers: true, communicationChannels: ["Email"] as string[], relatedCaseIds: [] as number[] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const put = (key: string, value: string) => setData((old) => ({ ...old, [key]: value }));
  const submit = async () => {
    setSaving(true); setError("");
    try {
      await csmApi.createMajorCase({
        ...data,
        ownerId: data.ownerId ? Number(data.ownerId) : undefined,
        incidentCommanderId: data.incidentCommanderId ? Number(data.incidentCommanderId) : undefined,
        resolverGroupId: data.resolverGroupId ? Number(data.resolverGroupId) : undefined,
        coordinationGroupId: data.coordinationGroupId ? Number(data.coordinationGroupId) : undefined,
      });
      navigate("/csm/major-cases");
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  const toggleChannel = (channel: string) => setData((old) => ({ ...old, communicationChannels: old.communicationChannels.includes(channel) ? old.communicationChannels.filter((x) => x !== channel) : [...old.communicationChannels, channel] }));
  const toggleCase = (id: number) => setData((old) => ({ ...old, relatedCaseIds: old.relatedCaseIds.includes(id) ? old.relatedCaseIds.filter((x) => x !== id) : [...old.relatedCaseIds, id] }));
  return <>
    <PageHeader crumb="Customer Service Management > Major Cases" title="Create Major Case" subtitle="Coordinate a high-impact issue affecting multiple customers, services or operations." />
    <div className="page-body"><ErrorBar msg={error || lookups.error || ""} /><section className="card" style={cardStyle}>
      <h2>Major Case Details</h2><div style={gridStyle}>
        <Field label="Title *"><input className="input" value={data.title} onChange={(e) => put("title", e.target.value)} /></Field>
        <Field label="Service / Product *"><input className="input" value={data.productService} onChange={(e) => put("productService", e.target.value)} /></Field>
        <Field label="Major Case Type"><select className="select" value={data.majorCaseType} onChange={(e) => put("majorCaseType", e.target.value)}><option>Service Outage</option><option>Security Incident</option><option>Data Loss</option><option>Widespread Degradation</option></select></Field>
      </div>
      <Field label="Description *"><textarea className="textarea" rows={3} value={data.description} onChange={(e) => put("description", e.target.value)} /></Field>
      <h2>Impact &amp; Severity</h2><div style={gridStyle}>
        <Field label="Severity"><select className="select" value={data.severity} onChange={(e) => put("severity", e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Business Impact"><select className="select" value={data.businessImpact} onChange={(e) => put("businessImpact", e.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Enterprise</option></select></Field>
        <Field label="Impact Type"><select className="select" value={data.impactType} onChange={(e) => put("impactType", e.target.value)}><option>Service Disruption</option><option>Security</option><option>Data Integrity</option><option>Performance</option></select></Field>
        <Field label="Estimated Impact"><input className="input" value={data.estimatedImpact} onChange={(e) => put("estimatedImpact", e.target.value)} placeholder="Customers, accounts, regions" /></Field>
      </div>
      <h2>Coordination &amp; Ownership</h2><div style={gridStyle}>
        <Field label="Major Incident Owner"><select className="select" value={data.ownerId} onChange={(e) => put("ownerId", e.target.value)}><option value="">Select owner</option>{lookups.data?.options.users.map((u) => <option value={u.id} key={u.id}>{u.label}</option>)}</select></Field>
        <Field label="Incident Commander"><select className="select" value={data.incidentCommanderId} onChange={(e) => put("incidentCommanderId", e.target.value)}><option value="">Optional</option>{lookups.data?.options.users.map((u) => <option value={u.id} key={u.id}>{u.label}</option>)}</select></Field>
        <Field label="Resolver Group"><select className="select" value={data.resolverGroupId} onChange={(e) => put("resolverGroupId", e.target.value)}><option value="">Select group</option>{lookups.data?.options.groups.map((g) => <option value={g.id} key={g.id}>{g.label}</option>)}</select></Field>
        <Field label="Coordination Group"><select className="select" value={data.coordinationGroupId} onChange={(e) => put("coordinationGroupId", e.target.value)}><option value="">Optional</option>{lookups.data?.options.groups.map((g) => <option value={g.id} key={g.id}>{g.label}</option>)}</select></Field>
      </div>
      <h2>Timeline &amp; Communication</h2><div style={gridStyle}>
        <Field label="Incident Start *"><input className="input" type="datetime-local" value={data.incidentStart} onChange={(e) => put("incidentStart", e.target.value)} /></Field>
        <Field label="Target Restoration *"><input className="input" type="datetime-local" value={data.targetRestoration} onChange={(e) => put("targetRestoration", e.target.value)} /></Field>
      </div>
      <label><input type="checkbox" checked={data.notifyCustomers} onChange={(e) => setData((old) => ({ ...old, notifyCustomers: e.target.checked }))} /> Notify affected customers</label>
      <div><label><input type="checkbox" checked={data.communicationChannels.includes("Email")} onChange={() => toggleChannel("Email")} /> Email</label>
        <small style={{ display: "block", color: "var(--muted)" }}>Customer emails are queued through SMTP. SMS, in-app, and portal-banner delivery require integrations that are not configured here.</small>
      </div>
      <h2>Related Cases</h2><div style={{ maxHeight: 180, overflowY: "auto" }}>{(lookups.data?.cases ?? []).map((item) => <label key={item.caseId} style={{ display: "block" }}><input type="checkbox" checked={data.relatedCaseIds.includes(item.caseId)} onChange={() => toggleCase(item.caseId)} /> {item.caseCode} · {item.shortDescription}</label>)}</div>
      <button type="button" className="btn-primary" disabled={saving || !data.title.trim() || !data.description.trim() || !data.productService.trim() || !data.incidentStart || !data.targetRestoration} onClick={() => void submit()}>{saving ? "Creating…" : "Create Major Case"}</button>
    </section></div>
  </>;
}

export function CsmCustomersPage() {
  const { navigate } = useRouter();
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [type, setType] = useState<CsmCustomerType | undefined>();
  const customers = useAsync(() => csmApi.customers(applied, type), [applied, type]);
  return <>
    <PageHeader crumb="Customer Service Management > Customer Management" title="Customers" subtitle="Manage business accounts and consumer profiles." action={<button className="btn-primary" type="button" onClick={() => navigate("/csm/customers/new")}>＋ Create Customer</button>} />
    <div className="page-body"><ErrorBar msg={customers.error ?? ""} />
      <section className="card" style={{ ...cardStyle, display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
        <Field label="Search"><input className="input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setApplied(query); }} placeholder="Name, ID or email" /></Field>
        <Field label="Customer Type"><select className="select" value={type ?? ""} onChange={(e) => setType(e.target.value ? e.target.value as CsmCustomerType : undefined)}><option value="">All</option><option>B2B</option><option>B2C</option></select></Field>
        <button className="btn-primary" onClick={() => setApplied(query)}>Search</button>
      </section>
      {customers.loading && !customers.data ? <TableMessage loading empty="" /> : customers.data?.length ? <div className="card" style={{ overflowX: "auto" }}><table><thead><tr><th>Customer</th><th>Type</th><th>Industry / Segment</th><th>Region</th><th>Email</th><th>Location</th><th>Status</th></tr></thead><tbody>
        {customers.data.map((c) => <tr key={c.customerId}><td><Link to={`/csm/customers/${c.customerId}`}><strong>{c.customerCode}</strong><div>{c.name}</div></Link></td><td>{c.customerType}</td><td>{c.industry ?? c.segment ?? "—"}</td><td>{c.region ?? "—"}</td><td>{c.email ?? "—"}</td><td>{c.location ?? "—"}</td><td>{c.status}</td></tr>)}
      </tbody></table></div> : <div className="empty-state">No customers found. Create a B2B account or B2C consumer profile to get started.</div>}
    </div>
  </>;
}

export function CsmCustomerCreatePage() {
  const { navigate } = useRouter();
  const [type, setType] = useState<CsmCustomerType>("B2B");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({ name: "", email: "", phone: "", industry: "", accountType: "Enterprise", region: "", website: "", location: "", segment: "Retail", preferredChannel: "Email" });
  const put = (key: string, value: string) => setData((old) => ({ ...old, [key]: value }));
  const submit = async () => {
    setSaving(true); setError("");
    try { await csmApi.createCustomer({ ...data, customerType: type }); navigate("/csm/customers"); }
    catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  return <>
    <PageHeader crumb="Customer Service Management > Customers" title="Create Customer" subtitle="Add a business account or individual consumer profile." />
    <div className="page-body"><ErrorBar msg={error} /><section className="card" style={cardStyle}>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}><button type="button" className={type === "B2B" ? "btn-primary" : "btn-ghost"} onClick={() => setType("B2B")}>B2B · Business</button><button type="button" className={type === "B2C" ? "btn-primary" : "btn-ghost"} onClick={() => setType("B2C")}>B2C · Consumer</button></div>
      <div style={gridStyle}>
        <Field label={type === "B2B" ? "Account Name *" : "Customer Name *"}><input className="input" value={data.name} onChange={(e) => put("name", e.target.value)} /></Field>
        <Field label="Email"><input className="input" type="email" value={data.email} onChange={(e) => put("email", e.target.value)} /></Field>
        <Field label="Phone"><input className="input" value={data.phone} onChange={(e) => put("phone", e.target.value)} /></Field>
        {type === "B2B" && <>
          <Field label="Industry"><input className="input" value={data.industry} onChange={(e) => put("industry", e.target.value)} /></Field>
          <Field label="Account Type"><select className="select" value={data.accountType} onChange={(e) => put("accountType", e.target.value)}><option>Enterprise</option><option>Business</option><option>Partner</option></select></Field>
          <Field label="Website"><input className="input" value={data.website} onChange={(e) => put("website", e.target.value)} /></Field>
        </>}
        <Field label="Region"><input className="input" value={data.region} onChange={(e) => put("region", e.target.value)} /></Field>
        <Field label="Location"><input className="input" value={data.location} onChange={(e) => put("location", e.target.value)} /></Field>
        <Field label="Segment"><input className="input" value={data.segment} onChange={(e) => put("segment", e.target.value)} /></Field>
        <Field label="Preferred Channel"><select className="select" value={data.preferredChannel} onChange={(e) => put("preferredChannel", e.target.value)}><option>Email</option><option>Phone</option><option>Chat</option><option>Portal</option></select></Field>
      </div>
      <button type="button" className="btn-primary" disabled={saving || data.name.trim().length < 2} onClick={() => void submit()}>{saving ? "Saving…" : "Create Customer"}</button>
    </section></div>
  </>;
}

export function CsmCustomerProfilePage() {
  const id = Number(useRouteParams("/csm/customers/:id")?.id);
  const valid = Number.isInteger(id) && id > 0;
  const profile = useAsync(() => valid ? csmApi.customerProfile(id) : Promise.reject(new Error("Customer not found.")), [id, valid]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", industry: "", accountType: "", region: "", website: "", location: "", segment: "", preferredChannel: "Email", status: "Active" });
  const [contactId, setContactId] = useState<number | null>(null);
  const [contact, setContact] = useState({ fullName: "", email: "", phone: "", title: "", isPrimary: false, status: "Active" });
  useEffect(() => {
    if (!profile.data) return;
    setCustomer({
      name: profile.data.name, email: profile.data.email ?? "", phone: profile.data.phone ?? "",
      industry: profile.data.industry ?? "", accountType: profile.data.accountType ?? "",
      region: profile.data.region ?? "", website: profile.data.website ?? "", location: profile.data.location ?? "",
      segment: profile.data.segment ?? "", preferredChannel: profile.data.preferredChannel ?? "Email",
      status: profile.data.status,
    });
  }, [profile.data]);
  const setCustomerField = (key: string, value: string) => setCustomer((old) => ({ ...old, [key]: value }));
  const setContactField = (key: string, value: string | boolean) => setContact((old) => ({ ...old, [key]: value }));
  const saveCustomer = async () => {
    setSaving(true); setError("");
    try { await csmApi.updateCustomer(id, customer); setEditing(false); profile.reload(); }
    catch (e) { setError(errMsg(e)); }
    finally { setSaving(false); }
  };
  const resetContact = () => {
    setContactId(null);
    setContact({ fullName: "", email: "", phone: "", title: "", isPrimary: false, status: "Active" });
  };
  const saveContact = async () => {
    setSaving(true); setError("");
    try {
      if (contactId) await csmApi.updateContact(id, contactId, contact);
      else await csmApi.createContact(id, {
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        title: contact.title,
        isPrimary: contact.isPrimary,
      });
      resetContact(); profile.reload();
    } catch (e) { setError(errMsg(e)); }
    finally { setSaving(false); }
  };
  const beginEditContact = (row: NonNullable<typeof profile.data>["contacts"][number]) => {
    setContactId(row.contactId);
    setContact({ fullName: row.fullName, email: row.email ?? "", phone: row.phone ?? "", title: row.title ?? "", isPrimary: row.isPrimary, status: row.status });
  };
  const row = profile.data;
  return <>
    <PageHeader crumb="Customer Service Management > Customers" title={row?.name ?? "Customer Profile"}
      subtitle={row ? `${row.customerCode} · ${row.customerType} · ${row.status}` : ""}
      action={<Link className="btn-ghost" to="/csm/customers">Back to customers</Link>} />
    <div className="page-body"><ErrorBar msg={profile.error ?? error} />
      {!row ? <TableMessage loading={profile.loading} error={profile.error} empty="Customer not found." /> : <>
        <section className="card" style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Account Profile</h2><button className="btn-ghost" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel" : "Edit Profile"}</button>
          </div>
          {editing ? <>
            <div style={gridStyle}>
              <Field label="Name"><input className="input" value={customer.name} onChange={(e) => setCustomerField("name", e.target.value)} /></Field>
              <Field label="Email"><input className="input" type="email" value={customer.email} onChange={(e) => setCustomerField("email", e.target.value)} /></Field>
              <Field label="Phone"><input className="input" value={customer.phone} onChange={(e) => setCustomerField("phone", e.target.value)} /></Field>
              <Field label="Industry"><input className="input" value={customer.industry} onChange={(e) => setCustomerField("industry", e.target.value)} /></Field>
              <Field label="Account Type"><input className="input" value={customer.accountType} onChange={(e) => setCustomerField("accountType", e.target.value)} /></Field>
              <Field label="Region"><input className="input" value={customer.region} onChange={(e) => setCustomerField("region", e.target.value)} /></Field>
              <Field label="Website"><input className="input" value={customer.website} onChange={(e) => setCustomerField("website", e.target.value)} /></Field>
              <Field label="Location"><input className="input" value={customer.location} onChange={(e) => setCustomerField("location", e.target.value)} /></Field>
              <Field label="Segment"><input className="input" value={customer.segment} onChange={(e) => setCustomerField("segment", e.target.value)} /></Field>
              <Field label="Preferred Channel"><select className="select" value={customer.preferredChannel} onChange={(e) => setCustomerField("preferredChannel", e.target.value)}><option>Email</option><option>Phone</option><option>Chat</option><option>Portal</option></select></Field>
              <Field label="Status"><select className="select" value={customer.status} onChange={(e) => setCustomerField("status", e.target.value)}><option>Active</option><option>Inactive</option></select></Field>
            </div>
            <button type="button" className="btn-primary" disabled={saving || customer.name.trim().length < 2} onClick={() => void saveCustomer()}>{saving ? "Saving…" : "Save Profile"}</button>
          </> : <div style={gridStyle}>
            <div><strong>Email</strong><p>{row.email ?? "—"}</p></div><div><strong>Phone</strong><p>{row.phone ?? "—"}</p></div>
            <div><strong>Industry / Segment</strong><p>{row.industry ?? row.segment ?? "—"}</p></div><div><strong>Account Type</strong><p>{row.accountType ?? "—"}</p></div>
            <div><strong>Region</strong><p>{row.region ?? "—"}</p></div><div><strong>Location</strong><p>{row.location ?? "—"}</p></div>
            <div><strong>Website</strong><p>{row.website ?? "—"}</p></div><div><strong>Preferred Channel</strong><p>{row.preferredChannel ?? "—"}</p></div>
            <div><strong>Parent Account</strong><p>{row.parentCustomer ?? "—"}</p></div>
          </div>}
        </section>
        <section className="card" style={cardStyle}>
          <h2>Contacts</h2>
          <div style={{ overflowX: "auto" }}><table><thead><tr><th>Name</th><th>Title</th><th>Email</th><th>Phone</th><th>Primary</th><th>Status</th><th></th></tr></thead>
            <tbody>{row.contacts.map((person) => <tr key={person.contactId}><td>{person.fullName}</td><td>{person.title ?? "—"}</td><td>{person.email ?? "—"}</td><td>{person.phone ?? "—"}</td><td>{person.isPrimary ? "Yes" : "—"}</td><td>{person.status}</td><td><button className="btn-ghost" onClick={() => beginEditContact(person)}>Edit</button></td></tr>)}</tbody>
          </table></div>
          <h3>{contactId ? "Edit Contact" : "Add Contact"}</h3>
          <div style={gridStyle}>
            <Field label="Name *"><input className="input" value={contact.fullName} onChange={(e) => setContactField("fullName", e.target.value)} /></Field>
            <Field label="Title"><input className="input" value={contact.title} onChange={(e) => setContactField("title", e.target.value)} /></Field>
            <Field label="Email"><input className="input" type="email" value={contact.email} onChange={(e) => setContactField("email", e.target.value)} /></Field>
            <Field label="Phone"><input className="input" value={contact.phone} onChange={(e) => setContactField("phone", e.target.value)} /></Field>
            {contactId && <Field label="Status"><select className="select" value={contact.status} onChange={(e) => setContactField("status", e.target.value)}><option>Active</option><option>Inactive</option></select></Field>}
          </div>
          <label><input type="checkbox" checked={contact.isPrimary} onChange={(e) => setContactField("isPrimary", e.target.checked)} /> Primary contact</label>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}><button type="button" className="btn-primary" disabled={saving || contact.fullName.trim().length < 2} onClick={() => void saveContact()}>{saving ? "Saving…" : contactId ? "Save Contact" : "Add Contact"}</button>{contactId && <button type="button" className="btn-ghost" onClick={resetContact}>Cancel</button>}</div>
        </section>
        <section className="card" style={cardStyle}><h2>Recent Cases</h2>{row.cases.length ? <div style={{ overflowX: "auto" }}><table><thead><tr><th>Case</th><th>Type</th><th>Priority</th><th>Status</th><th>Created</th></tr></thead><tbody>
          {row.cases.map((caseItem) => <tr key={caseItem.caseId}><td><Link to={`/csm/cases/${caseItem.caseId}`}>{caseItem.caseCode} · {caseItem.shortDescription}</Link></td><td>{caseItem.caseType}</td><td>{caseItem.priority}</td><td>{caseItem.status}</td><td>{formatDateTime(caseItem.createdAt)}</td></tr>)}
        </tbody></table></div> : <div className="empty-state">No cases for this customer.</div>}</section>
        <section className="card" style={cardStyle}><h2>Contracts</h2>{row.contracts.length ? <ul>{row.contracts.map((contract) => <li key={contract.contractId}>{contract.contractCode} · {contract.contractName} · {contract.status} · {formatDate(contract.startDate)} – {formatDate(contract.endDate)}</li>)}</ul> : <div className="empty-state">No contracts recorded.</div>}</section>
      </>}
    </div>
  </>;
}

export function CsmCustomerHealthPage() {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const data = useAsync(() => csmApi.customerHealth(applied), [applied]);
  return <>
    <PageHeader crumb="Customer Service Management > Customer Management" title="Customer Health" subtitle="Review customer health indicators, support trends and recommended follow-up." />
    <div className="page-body"><ErrorBar msg={data.error ?? ""} />
      <section className="card" style={{ ...cardStyle, display: "flex", gap: 8, alignItems: "end" }}><Field label="Search Customer"><input className="input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setApplied(query); }} placeholder="Name, ID, email or account" /></Field><button className="btn-primary" onClick={() => setApplied(query)}>Search</button></section>
      {data.loading && !data.data ? <TableMessage loading empty="" /> : data.data?.length ? <div className="card" style={{ overflowX: "auto" }}><table><thead><tr><th>Customer</th><th>Type</th><th>Health</th><th>Open Cases</th><th>90-Day Cases</th><th>SLA Breaches</th><th>Active Contracts</th><th>Location</th></tr></thead><tbody>
        {data.data.map((c) => <tr key={c.customerId}><td><strong>{c.customerCode}</strong><div>{c.name}</div></td><td>{c.customerType}</td><td><span className="badge">{c.healthScore} · {c.healthScore >= 80 ? "Healthy" : c.healthScore >= 50 ? "At Risk" : "Needs Attention"}</span></td><td>{c.openCases}</td><td>{c.caseCount}</td><td>{c.slaBreaches}</td><td>{c.activeContracts}</td><td>{c.location ?? "—"}</td></tr>)}
      </tbody></table></div> : <div className="empty-state">Create a customer and record cases to calculate customer health.</div>}
    </div>
  </>;
}

export function CsmContractsPage() {
  const contracts = useAsync(() => csmApi.contracts(), []);
  const slas = useAsync(() => csmApi.slas(), []);
  const lookups = useAsync(() => csmApi.lookups(), []);
  const [tab, setTab] = useState<"contracts" | "slas">("contracts");
  const [error, setError] = useState("");
  const [contractForm, setContractForm] = useState(false);
  const [slaForm, setSlaForm] = useState(false);
  const [editingContractId, setEditingContractId] = useState<number | null>(null);
  const [editingSlaId, setEditingSlaId] = useState<number | null>(null);
  const [renewal, setRenewal] = useState<{ id: number; startDate: string; endDate: string } | null>(null);
  const [contract, setContract] = useState({ customerId: "", contractName: "", contractType: "Service Contract", ownerName: "", status: "Active", startDate: "", endDate: "", autoRenew: false, description: "", services: "" });
  const [sla, setSla] = useState({ slaName: "", slaType: "Operational SLA", service: "", contractId: "", responseMinutes: "240", resolutionMinutes: "480", availabilityPercent: "99", status: "Active", description: "", appliesTo: "Cases", priorities: "High, Medium, Low" });
  const [saving, setSaving] = useState(false);
  const updateContract = (key: string, value: string | boolean) => setContract((old) => ({ ...old, [key]: value }));
  const updateSla = (key: string, value: string) => setSla((old) => ({ ...old, [key]: value }));
  const saveContract = async () => {
    setSaving(true); setError("");
    try {
      const { customerId, ...fields } = contract;
      const body = {
        ...fields, services: contract.services.split(",").map((x) => x.trim()).filter(Boolean),
        ...(editingContractId ? {} : { customerId: Number(customerId) }),
      };
      if (editingContractId) await csmApi.updateContract(editingContractId, body);
      else await csmApi.createContract(body);
      setContractForm(false); setEditingContractId(null); contracts.reload();
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  const saveSla = async () => {
    setSaving(true); setError("");
    try {
      const body = {
        ...sla, contractId: sla.contractId ? Number(sla.contractId) : editingSlaId ? null : undefined,
        responseMinutes: Number(sla.responseMinutes), resolutionMinutes: Number(sla.resolutionMinutes),
        availabilityPercent: sla.availabilityPercent === "" ? null : Number(sla.availabilityPercent),
        appliesTo: sla.appliesTo.split(",").map((x) => x.trim()).filter(Boolean),
        priorities: sla.priorities.split(",").map((x) => x.trim()).filter(Boolean),
      };
      if (editingSlaId) await csmApi.updateSla(editingSlaId, body);
      else await csmApi.createSla(body);
      setSlaForm(false); setEditingSlaId(null); slas.reload();
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  const editContract = (c: NonNullable<typeof contracts.data>[number]) => {
    setEditingContractId(c.contractId);
    setContract({
      customerId: String(c.customerId), contractName: c.contractName, contractType: c.contractType,
      ownerName: c.ownerName ?? "", status: c.status, startDate: c.startDate.slice(0, 10),
      endDate: c.endDate.slice(0, 10), autoRenew: c.autoRenew, description: c.description ?? "",
      services: c.services.join(", "),
    });
    setContractForm(true); setTab("contracts");
  };
  const editSla = (s: NonNullable<typeof slas.data>[number]) => {
    setEditingSlaId(s.slaId);
    setSla({
      slaName: s.slaName, slaType: s.slaType, service: s.service,
      contractId: s.contractId ? String(s.contractId) : "", responseMinutes: String(s.responseMinutes),
      resolutionMinutes: String(s.resolutionMinutes), availabilityPercent: s.availabilityPercent == null ? "" : String(s.availabilityPercent),
      status: s.status, description: s.description ?? "", appliesTo: s.appliesTo.join(", "), priorities: s.priorities.join(", "),
    });
    setSlaForm(true); setTab("slas");
  };
  const startRenewal = (c: NonNullable<typeof contracts.data>[number]) => {
    const nextStart = new Date(`${c.endDate.slice(0, 10)}T00:00:00`);
    nextStart.setDate(nextStart.getDate() + 1);
    const startDate = nextStart.toISOString().slice(0, 10);
    const nextEnd = new Date(`${startDate}T00:00:00`);
    nextEnd.setFullYear(nextEnd.getFullYear() + 1);
    setRenewal({ id: c.contractId, startDate, endDate: nextEnd.toISOString().slice(0, 10) });
  };
  const saveRenewal = async () => {
    if (!renewal) return;
    setSaving(true); setError("");
    try { await csmApi.renewContract(renewal.id, { startDate: renewal.startDate, endDate: renewal.endDate }); setRenewal(null); contracts.reload(); }
    catch (e) { setError(errMsg(e)); }
    finally { setSaving(false); }
  };
  return <>
    <PageHeader crumb="Customer Service Management > Customer Management" title="Contracts & SLAs" subtitle="Define customer contracts, service scope, terms and measurable service targets." />
    <div className="page-body"><ErrorBar msg={error || contracts.error || slas.error || lookups.error || ""} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}><button className={tab === "contracts" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("contracts")}>Contracts</button><button className={tab === "slas" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("slas")}>SLAs</button></div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        {tab === "contracts" ? <button className="btn-primary" onClick={() => {
          if (contractForm) { setContractForm(false); setEditingContractId(null); }
          else {
            setContract({ customerId: "", contractName: "", contractType: "Service Contract", ownerName: "", status: "Active", startDate: "", endDate: "", autoRenew: false, description: "", services: "" });
            setEditingContractId(null); setContractForm(true);
          }
        }}>{contractForm ? "Cancel" : "＋ Create Contract"}</button> : <button className="btn-primary" onClick={() => {
          if (slaForm) { setSlaForm(false); setEditingSlaId(null); }
          else {
            setSla({ slaName: "", slaType: "Operational SLA", service: "", contractId: "", responseMinutes: "240", resolutionMinutes: "480", availabilityPercent: "99", status: "Active", description: "", appliesTo: "Cases", priorities: "High, Medium, Low" });
            setEditingSlaId(null); setSlaForm(true);
          }
        }}>{slaForm ? "Cancel" : "＋ Create SLA"}</button>}
      </div>
      {contractForm && tab === "contracts" && <section className="card" style={cardStyle}><h2>{editingContractId ? "Edit Contract" : "Contract Details"}</h2><div style={gridStyle}>
        {!editingContractId && <Field label="Customer *"><select className="select" value={contract.customerId} onChange={(e) => updateContract("customerId", e.target.value)}><option value="">Select customer</option>{lookups.data?.customers.filter((c) => c.type === "B2B").map((c) => <option value={c.id} key={c.id}>{c.label}</option>)}</select></Field>}
        <Field label="Contract Name *"><input className="input" value={contract.contractName} onChange={(e) => updateContract("contractName", e.target.value)} /></Field>
        <Field label="Contract Type"><select className="select" value={contract.contractType} onChange={(e) => updateContract("contractType", e.target.value)}><option>Service Contract</option><option>Support Contract</option><option>Subscription</option></select></Field>
        <Field label="Owner"><input className="input" value={contract.ownerName} onChange={(e) => updateContract("ownerName", e.target.value)} /></Field>
        <Field label="Status"><select className="select" value={contract.status} onChange={(e) => updateContract("status", e.target.value)}><option>Draft</option><option>Active</option><option>Expired</option><option>Terminated</option></select></Field>
        <Field label="Start Date *"><input className="input" type="date" value={contract.startDate} onChange={(e) => updateContract("startDate", e.target.value)} /></Field>
        <Field label="End Date *"><input className="input" type="date" value={contract.endDate} onChange={(e) => updateContract("endDate", e.target.value)} /></Field>
        <Field label="Services (comma-separated)"><input className="input" value={contract.services} onChange={(e) => updateContract("services", e.target.value)} /></Field>
      </div><Field label="Description"><textarea className="textarea" value={contract.description} onChange={(e) => updateContract("description", e.target.value)} /></Field><label><input type="checkbox" checked={contract.autoRenew} onChange={(e) => updateContract("autoRenew", e.target.checked)} /> Auto-renew</label><p><button className="btn-primary" disabled={saving || (!editingContractId && !contract.customerId) || !contract.contractName || !contract.startDate || !contract.endDate} onClick={() => void saveContract()}>{saving ? "Saving…" : editingContractId ? "Update Contract" : "Save Contract"}</button></p></section>}
      {renewal && tab === "contracts" && <section className="card" style={cardStyle}><h2>Renew Contract</h2><div style={gridStyle}>
        <Field label="Renewal Start"><input className="input" type="date" value={renewal.startDate} onChange={(e) => setRenewal({ ...renewal, startDate: e.target.value })} /></Field>
        <Field label="Renewal End"><input className="input" type="date" value={renewal.endDate} onChange={(e) => setRenewal({ ...renewal, endDate: e.target.value })} /></Field>
      </div><button className="btn-primary" disabled={saving || !renewal.startDate || !renewal.endDate} onClick={() => void saveRenewal()}>{saving ? "Renewing…" : "Confirm Renewal"}</button><button className="btn-ghost" onClick={() => setRenewal(null)}>Cancel</button></section>}
      {slaForm && tab === "slas" && <section className="card" style={cardStyle}><h2>{editingSlaId ? "Edit SLA" : "SLA Details"}</h2><div style={gridStyle}>
        <Field label="SLA Name *"><input className="input" value={sla.slaName} onChange={(e) => updateSla("slaName", e.target.value)} /></Field>
        <Field label="SLA Type"><select className="select" value={sla.slaType} onChange={(e) => updateSla("slaType", e.target.value)}><option>Operational SLA</option><option>Premium SLA</option><option>Standard SLA</option></select></Field>
        <Field label="Service *"><input className="input" value={sla.service} onChange={(e) => updateSla("service", e.target.value)} /></Field>
        <Field label="Applies To (comma-separated)"><input className="input" value={sla.appliesTo} onChange={(e) => updateSla("appliesTo", e.target.value)} /></Field>
        <Field label="Priorities (comma-separated)"><input className="input" value={sla.priorities} onChange={(e) => updateSla("priorities", e.target.value)} /></Field>
        <Field label="Contract"><select className="select" value={sla.contractId} onChange={(e) => updateSla("contractId", e.target.value)}><option value="">No contract</option>{contracts.data?.map((c) => <option key={c.contractId} value={c.contractId}>{c.contractName}</option>)}</select></Field>
        <Field label="Response Time (minutes) *"><input className="input" type="number" min={1} value={sla.responseMinutes} onChange={(e) => updateSla("responseMinutes", e.target.value)} /></Field>
        <Field label="Resolution Time (minutes) *"><input className="input" type="number" min={1} value={sla.resolutionMinutes} onChange={(e) => updateSla("resolutionMinutes", e.target.value)} /></Field>
        <Field label="Availability %"><input className="input" type="number" min={0} max={100} value={sla.availabilityPercent} onChange={(e) => updateSla("availabilityPercent", e.target.value)} /></Field>
        <Field label="Status"><select className="select" value={sla.status} onChange={(e) => updateSla("status", e.target.value)}><option>Draft</option><option>Active</option><option>Inactive</option></select></Field>
      </div><Field label="Description"><textarea className="textarea" value={sla.description} onChange={(e) => updateSla("description", e.target.value)} /></Field><button className="btn-primary" disabled={saving || !sla.slaName || !sla.service} onClick={() => void saveSla()}>{saving ? "Saving…" : editingSlaId ? "Update SLA" : "Save SLA"}</button></section>}
      {tab === "contracts" ? contracts.data?.length ? <div className="card" style={{ overflowX: "auto" }}><table><thead><tr><th>Contract</th><th>Customer</th><th>Type</th><th>Period</th><th>Services</th><th>SLAs</th><th>Status</th><th>Actions</th></tr></thead><tbody>{contracts.data.map((c) => <tr key={c.contractId}><td><strong>{c.contractCode}</strong><div>{c.contractName}</div></td><td>{c.customerName} ({c.customerType})</td><td>{c.contractType}</td><td>{formatDate(c.startDate)} – {formatDate(c.endDate)}</td><td>{c.services?.join(", ") || "—"}</td><td>{c.slaCount}</td><td>{c.status}</td><td><button className="btn-ghost" onClick={() => editContract(c)}>Edit</button><button className="btn-ghost" disabled={c.status === "Terminated"} onClick={() => startRenewal(c)}>Renew</button></td></tr>)}</tbody></table></div> : <div className="empty-state">No contracts yet. Create a contract and attach customer SLAs.</div> :
        slas.data?.length ? <div className="card" style={{ overflowX: "auto" }}><table><thead><tr><th>SLA</th><th>Service</th><th>Contract</th><th>Response</th><th>Resolution</th><th>Availability</th><th>Status</th><th></th></tr></thead><tbody>{slas.data.map((s) => <tr key={s.slaId}><td><strong>{s.slaCode}</strong><div>{s.slaName}</div></td><td>{s.service}</td><td>{s.contractName ?? "—"}</td><td>{s.responseMinutes} min</td><td>{s.resolutionMinutes} min</td><td>{s.availabilityPercent ?? "—"}%</td><td>{s.status}</td><td><button className="btn-ghost" onClick={() => editSla(s)}>Edit</button></td></tr>)}</tbody></table></div> : <div className="empty-state">No SLAs yet. Define response and resolution targets for a service.</div>}
    </div>
  </>;
}
