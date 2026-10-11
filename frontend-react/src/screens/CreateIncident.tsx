import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useAsync } from "../hooks";
import { useRouter } from "../router";
import { LogField, attachmentApi, checkAttachment, fmtBytes, logFieldApi } from "../configApi";
import { ErrorBar, PageHeader, errMsg } from "../components/configKit";
import { SearchSelect, type SearchOption } from "../components/SearchSelect";
import { BrowsePicker, treeToNodes } from "../components/BrowsePicker";

type Raw = Record<string, any>;
interface CatNode { categoryId: number; categoryName: string; children: CatNode[]; defaultAssignmentGroup?: { groupId: number } | null }
const CONTACT_TYPES = ["Self-Service Portal", "Email", "Phone", "Chat"];
const MAX_FILES = 10;

/** Walk the tree to build the picker's "Group (count)" list; selecting any node picks it. */
function flatten(nodes: CatNode[], depth = 0): { n: CatNode; depth: number }[] {
  return nodes.flatMap((n) => [{ n, depth }, ...flatten(n.children ?? [], depth + 1)]);
}

export function CreateIncidentPage({ forUser = false }: { forUser?: boolean }) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const staff = user?.role === "RESOLVER" || user?.role === "ADMIN";
  const resolverMode = forUser && staff;                 // "New Incident for User": every field shown

  const cfgQ = useAsync(() => logFieldApi.list(), []);
  const cats = useAsync(() => api.get<CatNode[]>("/categories/tree"), []);
  const cls = useAsync(() => api.get<Raw[]>("/classifications"), []);
  const pris = useAsync(() => api.get<Raw[]>("/priority"), []);
  const imps = useAsync(() => api.get<Raw[]>("/impact"), []);
  const urgs = useAsync(() => api.get<Raw[]>("/urgency"), []);
  const groups = useAsync(() => api.get<Raw[]>("/assignment-groups"), []);
  const locs = useAsync(() => api.get<Raw[]>("/locations").catch(() => []), []);
  const users = useAsync(() => (staff ? api.get<Raw[]>("/users").catch(() => []) : Promise.resolve([] as Raw[])), [staff]);

  const cfg = useMemo(() => new Map((cfgQ.data ?? []).map((f: LogField) => [f.fieldKey, f])), [cfgQ.data]);
  const show = (k: string) => resolverMode || (cfg.get(k)?.visible ?? true);
  const req = (k: string) => (cfg.get(k)?.visible || resolverMode) && !!cfg.get(k)?.required;

  const [f, setF] = useState({
    callerId: "", contactNumber: "", email: "", categoryId: "", classificationId: "", title: "", description: "", priority: "Medium", impact: "", urgency: "",
    groupId: "", assignedTo: "", configurationItem: "", contactType: "Self-Service Portal", locationId: "",
  });

  // Sync current user's email & phone once auth loads (form initializes before user is ready)
  useEffect(() => {
    if (user && !resolverMode) {
      setF((p) => ({
        ...p,
        email: p.email || user.email || "",
      }));
    }
  }, [user, resolverMode]);

  // Caller: searchable by first/last name, e-mail, employee ID or user name. End users default to themselves but may pick someone else.
  const [callerLabel, setCallerLabel] = useState("");
  const callerCache = useRef<Record<string, Raw>>({});
  const searchCallers = useCallback(async (q: string): Promise<SearchOption[]> => {
    const rows = await api.get<Raw[]>(`/users/directory?q=${encodeURIComponent(q.trim())}`);
    return rows.map((u) => {
      callerCache.current[String(u.userId)] = u;
      return { value: String(u.userId), label: u.fullName, sub: [u.email, u.username && `@${u.username}`, u.employeeId && `ID ${u.employeeId}`].filter(Boolean).join(" · ") };
    });
  }, []);
  const [files, setFiles] = useState<File[]>([]);
  const [fileErr, setFileErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { ref: string; id: string; priority: string; category: string; summary: string; on: string; failedFiles: string[] }>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const catList = useMemo(() => flatten(cats.data ?? []), [cats.data]);
  const catName = (id: string) => catList.find((c) => String(c.n.categoryId) === id)?.n.categoryName ?? "";
  const categoryNodes = useMemo(() => treeToNodes(cats.data, "categoryId", "categoryName"), [cats.data]);

  const classificationNodes = useMemo(() => {
    const rows = (cls.data ?? []).filter((c) => c.isActive !== false);
    return rows.map((r) => ({
      id: String(r.classificationId),
      label: String(r.name),
      parentId: r.parentId ? String(r.parentId) : null,
    }));
  }, [cls.data]);
  const clsName = (id: string) => classificationNodes.find((x) => x.id === id)?.label ?? "";
  const activeOf = (r: Raw[] | null | undefined, name: string) => (r ?? []).filter((x) => x.isActive !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((x) => x[name] as string);
  const groupMembers = (groups.data ?? []).find((g) => String(g.groupId) === f.groupId)?.members as Raw[] | undefined;
  const assignees = (users.data ?? []).filter((u) => u.isActive !== false && (!f.groupId || !groupMembers || groupMembers.some((m) => m.userId === u.userId)));
  const selfId = resolverMode ? "" : user?.id ?? "";
  const effectiveCallerId = f.callerId || selfId;
  const callerShown = f.callerId ? callerLabel : resolverMode ? "" : user?.name ?? "";
  const caller = callerCache.current[effectiveCallerId];

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list); const problems: string[] = []; const ok: File[] = [];
    for (const file of incoming) {
      const p = checkAttachment(file);
      if (p) problems.push(p);
      else if (files.length + ok.length >= MAX_FILES) problems.push(`Only ${MAX_FILES} files can be attached.`);
      else if ([...files, ...ok].some((x) => x.name === file.name && x.size === file.size)) problems.push(`${file.name} is already attached.`);
      else ok.push(file);
    }
    setFiles([...files, ...ok]); setFileErr(problems.join(" "));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (resolverMode && !f.callerId) missing.push("Caller");
    if (!f.title.trim()) missing.push("Short Description");
    const checks: [string, string, string][] = [
      ["category", "Category", f.categoryId], ["classification", "Classification", f.classificationId], ["description", "Description", f.description],
      ["priority", "Priority", f.priority], ["impact", "Impact", f.impact], ["urgency", "Urgency", f.urgency],
      ["configurationItem", "Configuration Item", f.configurationItem], ["contactType", "Contact Type", f.contactType], ["location", "Location", f.locationId],
      ["assignmentGroup", "Assignment Group", f.groupId], ["assignedTo", "Assigned To", f.assignedTo],
    ];
    for (const [k, label, v] of checks) if (show(k) && req(k) && !String(v).trim()) missing.push(label);
    if (show("attachments") && req("attachments") && files.length === 0) missing.push("Attachment");
    if (missing.length) { setErr(`Please fill in the required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`); return; }

    setBusy(true); setErr("");
    const body: Raw = {
      title: f.title.trim(), description: f.description.trim() || undefined, priority: f.priority || undefined,
      impact: f.impact || undefined, urgency: f.urgency || undefined,
      categoryId: f.categoryId ? Number(f.categoryId) : undefined, classificationId: f.classificationId ? Number(f.classificationId) : undefined,
      assignmentGroupId: f.groupId ? Number(f.groupId) : undefined, affectedAsset: f.configurationItem.trim() || undefined,
      contactType: f.contactType || undefined, locationId: f.locationId ? Number(f.locationId) : undefined,
      contactNumber: f.contactNumber.trim() || undefined, callerEmail: f.email.trim() || undefined,
    };
    if (effectiveCallerId && effectiveCallerId !== user?.id) body.callerId = Number(effectiveCallerId);
    if (resolverMode && f.assignedTo) body.assignedTo = Number(f.assignedTo);
    try {
      const inc = await api.post<Raw>("/incidents", body);
      const failed: string[] = [];
      for (const file of files) { try { await attachmentApi.upload(inc.incidentId, file); } catch (x) { failed.push(`${file.name} (${errMsg(x)})`); } }
      setDone({
        ref: inc.incidentCode ?? inc.incidentId, id: inc.incidentId, priority: inc.priority ?? f.priority, category: catName(f.categoryId) || "—",
        summary: f.title.trim(), on: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }), failedFiles: failed,
      });
    } catch (x) { setErr(errMsg(x, "Unable to submit the incident.")); }
    finally { setBusy(false); }
  };

  const leave = () => navigate(staff ? "/incidents" : "/my-incidents");
  const lbl = (text: string, key?: string, always = false) => (
    <span className="lbl">{text} {(always || (key && req(key))) && <span className="req">*</span>}</span>
  );
  const crumb = resolverMode ? "Manage Incidents > New Incident for User" : "User > New Incident";

  return (
    <>
      <PageHeader crumb={crumb} title={resolverMode ? "Create Incident for User" : "Create New Incident"}
        subtitle={resolverMode ? "Log an incident on behalf of a user. All fields are available." : "Please provide the details below to raise a new incident."} onClose={leave} />
      <div className="page-body">
        <ErrorBar msg={err || (cfgQ.error ?? "")} />
        <form className="card" style={{ padding: 28 }} onSubmit={submit} noValidate>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div className="field-group">{lbl("Caller", undefined, true)}
              <SearchSelect ariaLabel="Caller" value={effectiveCallerId} label={callerShown} fetchOptions={searchCallers} clearable={resolverMode || !!f.callerId}
                placeholder="Search by name, e-mail, employee ID or user name…"
                onSelect={(o) => {
                  const u = o ? callerCache.current[o.value] : undefined;
                  setCallerLabel(o?.label ?? "");
                  setF((p) => ({ ...p, callerId: o?.value ?? "", email: u?.email ?? "", contactNumber: u?.phone ?? (o ? p.contactNumber : "") }));
                }} />
            </div>
            <label className="field-group">{lbl("Contact Number")}
              <input className="input" value={f.contactNumber} maxLength={30} onChange={(e) => set("contactNumber", e.target.value)} /></label>
            <label className="field-group">{lbl("Email ID")}
              <input className="input" type="email" value={resolverMode ? f.email : f.email || ""} placeholder={resolverMode ? caller?.email : undefined} maxLength={200} onChange={(e) => set("email", e.target.value)} /></label>

            {show("category") && (
              <div className="field-group">{lbl("Category", "category")}
                <BrowsePicker
                  title="Select Incident Category"
                  ariaLabel="Category"
                  value={f.categoryId}
                  label={catName(f.categoryId)}
                  nodes={categoryNodes}
                  placeholder="Click Browse to select a category…"
                  clearable
                  onSelect={(node) => {
                    if (!node) {
                      setF((p) => ({ ...p, categoryId: "" }));
                      return;
                    }
                    const rawNode = catList.find((c) => String(c.n.categoryId) === node.id)?.n;
                    setF((p) => ({
                      ...p,
                      categoryId: node.id,
                      groupId: p.groupId || (rawNode?.defaultAssignmentGroup ? String(rawNode.defaultAssignmentGroup.groupId) : ""),
                    }));
                  }}
                />
              </div>
            )}
            {show("classification") && (
              <div className="field-group">{lbl("Classification", "classification")}
                <BrowsePicker
                  title="Select Incident Classification"
                  ariaLabel="Classification"
                  value={f.classificationId}
                  label={clsName(f.classificationId)}
                  nodes={classificationNodes}
                  placeholder="Click Browse to select a classification…"
                  clearable
                  onSelect={(node) => setF((p) => ({ ...p, classificationId: node?.id ?? "" }))}
                />
              </div>
            )}
            <label className="field-group" style={{ gridColumn: "1 / -1" }}>{lbl("Short Description", undefined, true)}
              <input className="input" value={f.title} maxLength={200} onChange={(e) => set("title", e.target.value)} /></label>
            {show("description") && (
              <label className="field-group" style={{ gridColumn: "1 / -1" }}>{lbl("Description", "description")}
                <textarea className="textarea" rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
            )}
            {show("priority") && (
              <label className="field-group">{lbl("Priority", "priority")}
                <select className="select" value={f.priority} onChange={(e) => set("priority", e.target.value)}>
                  {activeOf(pris.data, "priorityName").map((n) => <option key={n}>{n}</option>)}</select></label>
            )}
            {show("impact") && (
              <label className="field-group">{lbl("Impact", "impact")}
                <select className="select" value={f.impact} onChange={(e) => set("impact", e.target.value)}>
                  <option value="">Select…</option>{activeOf(imps.data, "impactName").map((n) => <option key={n}>{n}</option>)}</select></label>
            )}
            {show("urgency") && (
              <label className="field-group">{lbl("Urgency", "urgency")}
                <select className="select" value={f.urgency} onChange={(e) => set("urgency", e.target.value)}>
                  <option value="">Select…</option>{activeOf(urgs.data, "urgencyName").map((n) => <option key={n}>{n}</option>)}</select></label>
            )}
            {show("assignmentGroup") && (
              <label className="field-group">{lbl("Assignment Group", "assignmentGroup")}
                <select className="select" value={f.groupId} onChange={(e) => { set("groupId", e.target.value); set("assignedTo", ""); }}>
                  <option value="">Auto-assign</option>{(groups.data ?? []).filter((g) => g.isActive !== false).map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}</select></label>
            )}
            {show("assignedTo") && staff && (
              <label className="field-group">{lbl("Assigned To", "assignedTo")}
                <select className="select" value={f.assignedTo} onChange={(e) => set("assignedTo", e.target.value)}>
                  <option value="">Unassigned</option>{assignees.map((u) => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}</select></label>
            )}
            {show("configurationItem") && (
              <label className="field-group">{lbl("Configuration Item", "configurationItem")}
                <input className="input" value={f.configurationItem} maxLength={150} onChange={(e) => set("configurationItem", e.target.value)} /></label>
            )}
            {show("contactType") && (
              <label className="field-group">{lbl("Contact Type", "contactType")}
                <select className="select" value={f.contactType} onChange={(e) => set("contactType", e.target.value)}>{CONTACT_TYPES.map((c) => <option key={c}>{c}</option>)}</select></label>
            )}
            {show("location") && (
              <label className="field-group">{lbl("Location", "location")}
                <select className="select" value={f.locationId} onChange={(e) => set("locationId", e.target.value)}>
                  <option value="">Select…</option>{(locs.data ?? []).filter((l) => l.isActive !== false).map((l) => <option key={l.locationId} value={l.locationId}>{l.locationName}</option>)}</select></label>
            )}
            {show("attachments") && (
              <div className="field-group" style={{ gridColumn: "1 / -1" }}>{lbl("Attachment", "attachments")}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
                  onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
                  style={{ border: `1.5px dashed ${drag ? "#175CD3" : "#D0D5DD"}`, background: drag ? "#EFF4FC" : "#F9FAFB", borderRadius: 8, padding: "22px 16px", textAlign: "center", cursor: "pointer" }}>
                  <Paperclip size={18} color="#667085" />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#344054", marginTop: 4 }}>Drag and drop files <span style={{ fontWeight: 400, color: "#667085" }}>or click to browse</span></div>
                  <div style={{ fontSize: 12, color: "#98A2B3", marginTop: 2 }}>Supported files: jpg, png, pdf, docx (max size 10MB)</div>
                  <input ref={fileRef} type="file" multiple hidden accept=".jpg,.jpeg,.png,.pdf,.docx" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
                </div>
                {fileErr && <div className="error-text" style={{ marginTop: 6 }}>{fileErr}</div>}
                {files.map((file) => (
                  <div key={file.name + file.size} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
                    <Paperclip size={13} color="#98A2B3" /><span style={{ flex: 1 }}>{file.name}</span><span style={{ color: "#98A2B3", fontSize: 12 }}>{fmtBytes(file.size)}</span>
                    <button type="button" className="admin-master-icon-button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((x) => x !== file))}><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border-soft)" }}>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit"}</button>
            <button type="button" className="btn-ghost" onClick={leave}>Cancel</button>
          </div>
        </form>
      </div>



      {done && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Incident Submitted" style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
          <div className="card" style={{ width: 440, padding: 28 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#067647" }}>✓ Incident Submitted</div>
            <div style={{ fontSize: 13, color: "#667085", margin: "6px 0 18px" }}>Your incident has been logged and routed to the support team.</div>
            {([["Ticket Number", done.ref], ["Priority", done.priority], ["Category", done.category], ["Submitted On", done.on], ["Summary", done.summary]] as const).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "7px 0", borderBottom: "1px solid #F2F4F7", fontSize: 13 }}>
                <span style={{ color: "#667085" }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span></div>
            ))}
            {done.failedFiles.length > 0 && <div className="error-text" style={{ marginTop: 12 }}>The incident was created, but these files could not be attached: {done.failedFiles.join("; ")}. You can add them from the incident.</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" className="btn-primary" onClick={() => navigate(staff ? `/incidents/${done.id}` : `/my-incidents/${done.id}`)}>OK</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const CreateIncidentForUserPage = () => <CreateIncidentPage forUser />;
