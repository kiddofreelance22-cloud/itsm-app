import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Play, X } from "lucide-react";
import { api } from "../api";
import { incidentApi } from "../incidentApi";
import { useAuth } from "../AuthContext";
import { PRIORITY_COLOR_HEX } from "../fieldMeta";
import { useAsync } from "../hooks";
import { Link, useRouteParams, useRouter } from "../router";
import {
  ApprovalRequest, Attachment, IncidentChecklist, MandatoryRule, RelatedItem, TransitionMatrix, WO_PRIORITIES, WO_STATUSES, WorkOrderRow,
  approvalApi, attachmentApi, checkAttachment, fmtBytes, masterApi, priorityMatrixApi, recordApi, ruleApi, slaApi, transitionApi, workOrderApi,
} from "../configApi";
import { ErrorBar, errMsg, formatDateTime } from "../components/configKit";
import { BrowsePicker, treeToNodes } from "../components/BrowsePicker";

type Raw = Record<string, any>;
interface Activity { activityId: number; type: string; content: string | null; isWorkNote: boolean; createdAt: string; author?: { userId: number; fullName: string } | null }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Open: { bg: "#F2F4F7", color: "#344054" }, Assigned: { bg: "#F0F9FF", color: "#026AA2" }, "In Progress": { bg: "#EFF4FC", color: "#175CD3" },
  "Pending Customer": { bg: "#F4F3FF", color: "#5925DC" }, "On Hold": { bg: "#FFFAEB", color: "#B54708" }, Resolved: { bg: "#ECFDF3", color: "#067647" },
  Closed: { bg: "#F2F4F7", color: "#667085" }, Cancelled: { bg: "#F2F4F7", color: "#667085" },
};
const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  Critical: { bg: "#FEE4E2", color: "#912018" }, High: { bg: "#FEF3F2", color: "#B42318" }, Medium: { bg: "#FFFAEB", color: "#B54708" }, Low: { bg: "#EFF4FC", color: "#175CD3" },
};
const TL_DOT: Record<string, string> = { created: "●", status_change: "↻", resolved: "✓", closed: "■", reopened: "↺", assignment_change: "→", claimed: "→", group_assigned: "→", sla_breached: "!" };
const norm = (s: string) => s.replace(/^\s*\d+\s*-\s*/, "").trim().toLowerCase();
const LOCKED = ["Closed", "Cancelled"];
/** "Pending", "Pending Customer", "Pending Vendor"… */
const isPendingStatus = (s?: string | null) => /^pending/i.test((s ?? "").trim());
const byNewest = <T extends { createdAt: string; activityId: number }>(rows: T[]) =>
  [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.activityId - a.activityId);

function relTime(target?: string | null, now = Date.now()): string {
  if (!target) return "";
  const ms = new Date(target).getTime() - now; const a = Math.abs(ms);
  const h = Math.floor(a / 3600000), m = Math.floor((a % 3600000) / 60000);
  const txt = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return ms >= 0 ? `${txt} remaining` : `${txt} overdue`;
}
const shortDT = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
const initials = (n: string) => { const p = n.trim().split(/\s+/); return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase(); };

export function IncidentRecordPage() {
  const id = useRouteParams("/incidents/:id")?.id ?? "";
  const { user } = useAuth();
  const { navigate } = useRouter();
  const returnToQueue = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("source") === "queue";
  // Opened from a Work Order (?view=readonly): show the incident for context only — no edits, claims, resolves or messages.
  const viewOnly = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "readonly";
  const returnPath = returnToQueue ? "/incident-queue" : "/incidents";
  const [inc, setInc] = useState<Raw | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState<"details" | "wo" | "checklist">("details");
  const [edit, setEdit] = useState<Raw | null>(null);       // draft while editing
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirm, setConfirm] = useState<null | "resolve" | "close">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [resCode, setResCode] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);

  const [acts, setActs] = useState<Activity[]>([]);
  const [showAllTl, setShowAllTl] = useState(false);
  const [msg, setMsg] = useState(""); const [isNote, setIsNote] = useState(false);
  const [checklist, setChecklist] = useState<IncidentChecklist | null>(null);
  const [links, setLinks] = useState<RelatedItem[]>([]);
  const [linkOpen, setLinkOpen] = useState(false); const [linkRef, setLinkRef] = useState("");
  const [wos, setWos] = useState<WorkOrderRow[]>([]);
  const [woForm, setWoForm] = useState<null | "new" | WorkOrderRow>(null);
  const [wo, setWo] = useState({ title: "", notes: "", groupId: "", assignedTo: "", priority: "P3 - Medium", status: "Open" });
  const [woErr, setWoErr] = useState("");
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [attErr, setAttErr] = useState("");
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // reference data
  const statuses = useAsync(() => api.get<Raw[]>("/status"), []);
  const matrix = useAsync<TransitionMatrix>(() => transitionApi.get(), []);
  const pris = useAsync(() => api.get<Raw[]>("/priority"), []);
  const slaWindows = useAsync(() => api.get<Raw[]>("/sla-service-windows"), []);
  const workgroupSlaWindows = useAsync(() => slaApi.windows(), []);
  const pMatrix = useAsync(() => priorityMatrixApi.list().catch(() => []), []);
  const imps = useAsync(() => api.get<Raw[]>("/impact"), []);
  const urgs = useAsync(() => api.get<Raw[]>("/urgency"), []);
  const catTree = useAsync(() => api.get<Raw[]>("/categories"), []);
  const groups = useAsync(() => api.get<Raw[]>("/assignment-groups"), []);
  const clsQ = useAsync(() => api.get<Raw[]>("/classifications"), []);
  const pendQ = useAsync(() => api.get<Raw[]>("/pending-reasons").catch(() => []), []);
  const holdQ = useAsync(() => masterApi.list("/on-hold-reasons").catch(() => []), []);
  const resCodesQ = useAsync(() => api.get<Raw[]>("/resolution-codes").catch(() => []), []);
  const rulesQ = useAsync(() => ruleApi.mandatory().catch(() => [] as MandatoryRule[]), []);
  const usersQ = useAsync(() => api.get<Raw[]>("/users").catch(() => []), []);

  const reloadBits = useCallback(async () => {
    const [a, c, l, w, f, ap] = await Promise.allSettled([
      api.get<Activity[]>(`/incidents/${encodeURIComponent(id)}/activities`), recordApi.checklist(id), recordApi.links(id), recordApi.workOrders(id),
      attachmentApi.list(id), approvalApi.list(false),
    ]);
    if (a.status === "fulfilled") setActs(a.value);
    if (c.status === "fulfilled") setChecklist(c.value);
    if (l.status === "fulfilled") setLinks(l.value);
    if (w.status === "fulfilled") setWos(w.value);
    if (f.status === "fulfilled") setAtts(f.value);
    if (ap.status === "fulfilled") setApprovals(ap.value.filter((x) => x.incidentId === id || x.incidentRef === id));
  }, [id]);
  const load = useCallback(async () => {
    try { setInc(await api.get<Raw>(`/incidents/${encodeURIComponent(id)}`)); setLoadErr(""); }
    catch (e) { setLoadErr(errMsg(e, "Unable to load this incident.")); }
    await reloadBits();
  }, [id, reloadBits]);
  useEffect(() => { void load(); }, [load]);

  const status: string = inc?.status ?? "";
  const locked = LOCKED.includes(status) || viewOnly;
  const editing = !!edit;
  const ref = inc?.incidentCode ?? inc?.incidentId ?? id;
  const isResolved = status === "Resolved";
  const isClosed = status === "Closed" || status === "Cancelled";
  // Only the Caller (the user the incident was raised for) can close it.
  const isCaller = !!inc?.createdBy && String(inc.createdBy.userId) === user?.id;
  const activeResCodes = (resCodesQ.data ?? []).filter((c) => c.isActive !== false);
  const canClaim = !viewOnly && user?.role !== "END_USER" && !inc?.assignedTo && !isClosed;
  const isAssignedToMe = !viewOnly && !!inc?.assignedTo && String(inc.assignedTo.userId) === user?.id;

  // Show the latest approval state for this incident as the banner (the board's "approvalNotice").
  useEffect(() => {
    const open = approvals.filter((a) => !(a as any).consumedAt);
    const pending = open.find((a) => a.status === "Pending"); const approved = open.find((a) => a.status === "Approved");
    const rejected = approvals.find((a) => a.status === "Rejected");
    if (pending) setNotice({ ok: false, msg: `${pending.approvalType} requested ${formatDateTime(pending.requestedAt)} — waiting for an approver in Approve Incident Records.` });
    else if (approved && status !== "Closed") setNotice({ ok: true, msg: `${approved.approvalType} approved${approved.approverNote ? ` — “${approved.approverNote}”` : ""}. You can now ${approved.action.toLowerCase()} this incident.` });
    else if (rejected && !locked) setNotice((n) => n ?? { ok: false, msg: `${rejected.approvalType} was rejected${rejected.approverNote ? `: ${rejected.approverNote}` : "."}` });
  }, [approvals, status, locked]);

  // ── option lists ──
  const names = (r: Raw[] | null | undefined, k: string) => (r ?? []).filter((x) => x.isActive !== false).map((x) => x[k] as string);
  const catNames = useMemo(() => { const out: Raw[] = []; const walk = (n: Raw[]) => n.forEach((x) => { out.push(x); walk(x.children ?? []); }); walk(catTree.data ?? []); return out; }, [catTree.data]);
  const categoryNodes = useMemo(() => treeToNodes(catTree.data, "categoryId", "categoryName"), [catTree.data]);
  const classificationNodes = useMemo(() => (clsQ.data ?? []).filter((c) => c.isActive !== false).map((c) => ({ id: String(c.classificationId), label: String(c.name), parentId: c.parentId ? String(c.parentId) : null })), [clsQ.data]);
  const statusOptions = useMemo(() => {
    const all = names(statuses.data, "statusName");
    if (!matrix.data) return all;
    // Hide only moves the matrix explicitly forbids, so statuses created after the matrix was last saved still appear.
    // (Older servers that don't report `blocked` fall back to "only what is explicitly allowed".)
    if (matrix.data.blocked) {
      const blocked = new Set(matrix.data.blocked.filter((t) => t.from === status).map((t) => t.to));
      return all.filter((s) => s === status || !blocked.has(s));
    }
    const allowed = new Set((matrix.data.transitions ?? []).filter((t) => t.from === status).map((t) => t.to));
    return all.filter((s) => s === status || allowed.size === 0 || allowed.has(s));
  }, [matrix.data, statuses.data, status]);
  const canResolveFromHere = !matrix.data || (matrix.data.blocked
    ? !matrix.data.blocked.some((t) => t.from === status && t.to === "Resolved")
    : (matrix.data.transitions ?? []).some((t) => t.from === status && t.to === "Resolved") || (matrix.data.transitions ?? []).every((t) => t.from !== status));
  const openWos = wos.filter((w) => w.isActive && ["Open", "In Progress", "On Hold"].includes(w.status));
  const reqOpen = checklist?.requiredOpen ?? 0;
  const resolveBlock = [reqOpen > 0 ? `${reqOpen} required checklist item${reqOpen > 1 ? "s" : ""} incomplete` : "", openWos.length ? `${openWos.length} work order${openWos.length > 1 ? "s" : ""} still open` : ""].filter(Boolean).join(" and ");

  // ── mandatory rules, evaluated against the draft just like the server does ──
  const fieldValue = (d: Raw): Record<string, string | null> => ({
    Status: d.status, Priority: d.priority, Impact: d.impact, Urgency: d.urgency, Category: d.categoryName, Classification: d.classificationName,
    "Pending Reason": d.pendingReason, "On Hold Reason": d.onHoldReason, "Assignment Group": d.groupId ? String(d.groupId) : null, "Assigned To": d.assignedTo ? String(d.assignedTo) : null,
    "Resolution Notes": d.resolutionNotes,
  });
  const requiredReason = (field: string, d: Raw | null): string | null => {
    if (!d) return null;
    const vals = fieldValue(d);
    for (const r of rulesQ.data ?? []) {
      if (!r.isActive || !r.targetFields.includes(field)) continue;
      const actual = vals[r.conditionField];
      if (actual && r.conditionValues.some((v) => norm(v) === norm(actual))) return `${r.conditionField} is ${actual}`;
    }
    return null;
  };

  const startEdit = () => {
    if (!inc) return;
    setErr("");
    setEdit({
      title: inc.title ?? "", description: inc.description ?? "", status: inc.status, priority: inc.priority ?? "", impact: inc.impact ?? "", urgency: inc.urgency ?? "",
      categoryId: inc.category?.categoryId ?? "", categoryName: inc.category?.categoryName ?? "", groupId: inc.assignmentGroup?.groupId ?? "", assignedTo: inc.assignedTo?.userId ?? "",
      classificationId: inc.classificationId ?? "", classificationName: (clsQ.data ?? []).find((c) => c.classificationId === inc.classificationId)?.name ?? "",
      slaServiceWindowId: inc.slaServiceWindowId ?? "", pendingReason: inc.pendingReason ?? "", onHoldReason: inc.onHoldReason ?? "", resolutionNotes: inc.resolutionNotes ?? "", resolutionCode: inc.resolutionCode ?? "", email: inc.callerEmail ?? "", department: inc.department ?? "",
    });
  };
  // Priority follows the Priority Matrix: whenever Impact or Urgency changes in the draft, look up the
  // configured priority for that pair and show it straight away (the server applies the same rule on save).
  const matrixPriority = (impact?: string, urgency?: string): string | null => {
    if (!impact || !urgency) return null;
    const row = (pMatrix.data ?? []).find((m) => m.isActive && m.impact?.impactName?.toLowerCase() === impact.toLowerCase() && m.urgency?.urgencyName?.toLowerCase() === urgency.toLowerCase());
    return row?.priority?.priorityName ?? null;
  };
  const setDraft = (k: string, v: any) => setEdit((d) => {
    if (!d) return d;
    const next = { ...d, [k]: v };
    if (k === "impact" || k === "urgency") {
      const p = matrixPriority(next.impact, next.urgency);
      if (p) next.priority = p;
    }
    return next;
  });

  const saveEdit = async () => {
    if (!inc || !edit) return;
    const missing: string[] = [];
    for (const f of ["Priority", "Impact", "Urgency", "Category", "Classification", "Assignment Group", "Assigned To", "Pending Reason", "On Hold Reason", "Resolution Notes"]) {
      const val = fieldValue(edit)[f];
      if (requiredReason(f, edit) && !val) missing.push(f);
    }
    if (missing.length) { setErr(`Please fill in: ${missing.join(", ")}.`); return; }
    const body: Raw = {};
    const set = (k: string, now: any, was: any) => {
      // Priority / Impact / Urgency / Status can never be blank — a blank means "leave it alone", not "set to null".
      if ((now === "" || now == null) && ["status", "priority", "impact", "urgency"].includes(k)) return;
      if (String(now ?? "") !== String(was ?? "")) body[k] = now === "" ? null : now;
    };
    set("title", edit.title.trim(), inc.title); set("description", edit.description, inc.description ?? "");
    set("status", edit.status, inc.status); set("priority", edit.priority, inc.priority); set("impact", edit.impact, inc.impact); set("urgency", edit.urgency, inc.urgency);
    set("pendingReason", edit.pendingReason, inc.pendingReason); set("onHoldReason", edit.onHoldReason, inc.onHoldReason);
    if ((edit.resolutionCode ?? "") !== (inc.resolutionCode ?? "")) body.resolutionCode = edit.resolutionCode || null;
    if (edit.status === "Resolved" && inc.status !== "Resolved" && activeResCodes.length && !edit.resolutionCode) { setErr("Please choose a Resolution Code."); return; }
    if ((edit.resolutionNotes ?? "") !== (inc.resolutionNotes ?? "")) body.resolutionNotes = (edit.resolutionNotes ?? "").trim();
    if (String(edit.categoryId ?? "") !== String(inc.category?.categoryId ?? "")) body.categoryId = edit.categoryId ? Number(edit.categoryId) : null;
    if (String(edit.groupId ?? "") !== String(inc.assignmentGroup?.groupId ?? "")) body.groupId = edit.groupId ? Number(edit.groupId) : null;
    if (String(edit.assignedTo ?? "") !== String(inc.assignedTo?.userId ?? "")) body.assignedTo = edit.assignedTo ? Number(edit.assignedTo) : null;
    if (String(edit.classificationId ?? "") !== String(inc.classificationId ?? "")) body.classificationId = edit.classificationId ? Number(edit.classificationId) : null;
    if ((edit.department ?? "") !== (inc.department ?? "")) body.department = edit.department;
    if (String(edit.slaServiceWindowId ?? "") !== String(inc.slaServiceWindowId ?? "")) body.slaServiceWindowId = edit.slaServiceWindowId ? Number(edit.slaServiceWindowId) : null;
    if (!Object.keys(body).length) { setEdit(null); return; }
    setSaving(true); setErr("");
    try { await api.patch(`/incidents/${encodeURIComponent(inc.incidentId)}`, body); setEdit(null); await load(); }
    catch (e) {
      const m = errMsg(e, "Unable to save.");
      setErr(m); if (/approval/i.test(m)) setNotice({ ok: false, msg: m });
      await reloadBits();
    } finally { setSaving(false); }
  };

  // Would a Mandatory Field Rule demand Resolution Notes once this incident is Resolved?
  const resolveNoteRule = inc ? requiredReason("Resolution Notes", {
    status: "Resolved", priority: inc.priority, impact: inc.impact, urgency: inc.urgency, categoryName: inc.category?.categoryName,
    classificationName: (clsQ.data ?? []).find((c) => c.classificationId === inc.classificationId)?.name, pendingReason: inc.pendingReason,
    onHoldReason: inc.onHoldReason, groupId: inc.assignmentGroup?.groupId, assignedTo: inc.assignedTo?.userId, resolutionNotes: "",
  }) : null;
  const transition = async (kind: "resolve" | "close" | "reopen") => {
    if (!inc) return;
    if (kind === "resolve" && resolveNoteRule && !(note.trim() || inc.resolutionNotes)) { setErr(`Resolution Notes are required (${resolveNoteRule}).`); return; }
    if (kind === "resolve" && activeResCodes.length && !resCode) { setErr("Please choose a Resolution Code."); return; }
    setBusy(true); setErr("");
    const body: Raw = kind === "resolve" ? { status: "Resolved", resolutionNotes: note.trim() || inc.resolutionNotes || undefined, resolutionCode: resCode || undefined } : kind === "close" ? { status: "Closed" } : { status: "Open" };
    try {
      await api.patch(`/incidents/${encodeURIComponent(inc.incidentId)}`, body);
      if (note.trim() && kind === "close") await api.post(`/incidents/${encodeURIComponent(inc.incidentId)}/comments`, { content: `Closing note: ${note.trim()}` }).catch(() => undefined);
      setConfirm(null); setNote(""); setNotice(null); await load();
    } catch (e) {
      const m = errMsg(e, `Unable to ${kind}.`); setErr(m);
      if (/approval/i.test(m)) setNotice({ ok: false, msg: m });
      setConfirm(null); await reloadBits();
    } finally { setBusy(false); }
  };

  const claimIncident = async () => {
    setClaimBusy(true);
    setErr("");
    try {
      await incidentApi.claimIncident(id);
      await load();
    } catch (e) {
      setErr(errMsg(e, "Unable to claim this incident."));
    } finally {
      setClaimBusy(false);
    }
  };
  const releaseIncident = async () => {
    setReleaseBusy(true);
    setErr("");
    try {
      await incidentApi.releaseIncident(id);
      await load();
    } catch (e) {
      setErr(errMsg(e, "Unable to release this incident."));
    } finally {
      setReleaseBusy(false);
    }
  };

  const resumeSla = async () => { try { await recordApi.resumeSla(id); await load(); } catch (e) { setErr(errMsg(e, "Unable to resume the SLA.")); } };
  const send = async () => {
    if (!msg.trim()) return;
    try { await api.post(`/incidents/${encodeURIComponent(id)}/activities`, { content: msg.trim(), isWorkNote: isNote }); setMsg(""); setActs(await api.get<Activity[]>(`/incidents/${encodeURIComponent(id)}/activities`)); }
    catch (e) { setErr(errMsg(e, "Unable to send the message.")); }
  };
  const requestUpdate = async () => {
    try { await api.post(`/incidents/${encodeURIComponent(id)}/comments`, { content: `${user?.name ?? "A resolver"} requested an update on this incident.` }); setActs(await api.get<Activity[]>(`/incidents/${encodeURIComponent(id)}/activities`)); setNotice({ ok: true, msg: "Update requested — it appears in the conversation." }); }
    catch (e) { setErr(errMsg(e)); }
  };
  const toggleItem = async (itemId: number, done: boolean) => { try { setChecklist(await recordApi.toggle(id, itemId, done)); } catch (e) { setErr(errMsg(e)); } };
  const addLink = async () => {
    if (!linkRef.trim()) return;
    try { setLinks(await recordApi.link(id, linkRef.trim())); setLinkRef(""); setLinkOpen(false); } catch (e) { setErr(errMsg(e, "Unable to link.")); }
  };
  const upload = async (files: FileList | null) => {
    if (!files) return; setAttErr("");
    for (const f of Array.from(files)) {
      const p = checkAttachment(f); if (p) { setAttErr(p); continue; }
      try { await attachmentApi.upload(id, f); } catch (e) { setAttErr(errMsg(e)); }
    }
    setAtts(await attachmentApi.list(id));
  };

  const openWoForm = (w: "new" | WorkOrderRow) => {
    if (viewOnly) return;
    setWoErr(""); setWoForm(w);
    setWo(w === "new" ? { title: "", notes: "", groupId: String(inc?.assignmentGroup?.groupId ?? ""), assignedTo: "", priority: "P3 - Medium", status: "Open" }
      : { title: w.title, notes: w.notes, groupId: w.groupId ? String(w.groupId) : "", assignedTo: w.assignedToId ? String(w.assignedToId) : "", priority: w.priority, status: w.status });
  };
  const saveWo = async () => {
    if (!wo.title.trim()) { setWoErr("Title is required."); return; }
    const payload = { incidentId: inc?.incidentId, title: wo.title.trim(), notes: wo.notes.trim() || null, groupId: wo.groupId ? Number(wo.groupId) : null, assignedTo: wo.assignedTo ? Number(wo.assignedTo) : null, priority: wo.priority, status: wo.status };
    try {
      if (woForm === "new") await workOrderApi.create(payload); else if (woForm) await workOrderApi.update(woForm.workOrderId, payload);
      setWoForm(null); setWos(await recordApi.workOrders(id));
    } catch (e) { setWoErr(errMsg(e, "Unable to save the work order.")); }
  };
  const removeWo = async () => {
    if (!woForm || woForm === "new" || !window.confirm(`Remove ${woForm.woNumber}?`)) return;
    try { await api.delete(`/work-orders/${woForm.workOrderId}`); setWoForm(null); setWos(await recordApi.workOrders(id)); } catch (e) { setWoErr(errMsg(e)); }
  };

  if (loadErr) return <div className="page-body"><ErrorBar msg={loadErr} /><Link to={returnPath}>{returnToQueue ? "← Back to Incident Queue" : "← Back to Incident List"}</Link></div>;
  if (!inc) return <div className="page-body"><div className="spinner-row">Loading…</div></div>;

  const ss = STATUS_STYLE[status] ?? (isPendingStatus(status) ? STATUS_STYLE["Pending Customer"] : STATUS_STYLE.Open);
  const priorityName = String(inc.priority ?? "");
  const configuredPriority = (pris.data ?? []).find((p) => {
    const candidates = [p.priorityName, p.priorityCode].filter(Boolean).map((name) => String(name).trim().toLowerCase());
    const current = norm(priorityName).toLowerCase();
    return candidates.some((name) => norm(name).toLowerCase() === current || current.startsWith(`${name} -`));
  });
  const configuredPriorityColor = PRIORITY_COLOR_HEX[String(configuredPriority?.color ?? "")];
  const ps = configuredPriorityColor
    ? { bg: `${configuredPriorityColor}1A`, color: "#1D2433" }
    : PRIORITY_STYLE[priorityName] ?? PRIORITY_STYLE.Low;
  const field = (label: string, key: string, view: React.ReactNode, input: React.ReactNode, reqKey?: string) => {
    const reason = editing && reqKey ? requiredReason(reqKey, edit) : null;
    return (
      <div className="field-group" key={label}>
        <span className="lbl">{label} {reason && <span className="req">*</span>}</span>
        {editing ? input : <div style={{ fontSize: 13, color: "#1D2433", minHeight: 32, display: "flex", alignItems: "center" }}>{view || "—"}</div>}
        {reason && <div style={{ fontSize: 11.5, color: "#B54708", marginTop: 3 }}>Required — {reason}</div>}
      </div>
    );
  };
  const sel = (key: string, opts: { v: string | number; l: string }[], blank: string | null = "None") => (
    <select className="select" value={edit?.[key] ?? ""} onChange={(e) => setDraft(key, e.target.value)}>
      {blank !== null && <option value="">{blank}</option>}{opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
  const nm = (arr: string[]) => arr.map((x) => ({ v: x, l: x }));
  // Latest update on top for both the Timeline and the Conversation.
  const tlEvents = byNewest(acts.filter((a) => !["comment", "work_note"].includes(a.type)));
  const convo = byNewest(acts.filter((a) => ["comment", "work_note"].includes(a.type)));
  // Judge the Response SLA from the claim time vs. the target (the stored flag defaults to false, so it can't be trusted alone).
  const respTarget = inc.slaResponseTarget ? new Date(inc.slaResponseTarget).getTime() : null;
  const firstResponseAt = inc.claimedAt ?? acts.find((activity) => activity.type === "claimed")?.createdAt;
  const respMissed = firstResponseAt
    ? (respTarget !== null && new Date(firstResponseAt).getTime() > respTarget)
    : (respTarget !== null && Date.now() > respTarget);
  const respStatus = firstResponseAt ? (respMissed ? "Missed" : "Met") : respMissed ? "Missed" : relTime(inc.slaResponseTarget);
  const resolutionDone = ["Resolved", "Closed"].includes(status);
  const paused = !!inc.slaPausedAt;
  const resText = paused ? "Paused" : resolutionDone ? (inc.slaBreached ? "Breached" : "Met") : inc.slaBreached ? `Breached — ${relTime(inc.slaResolutionTarget)}` : `On track — ${relTime(inc.slaResolutionTarget)}`;
  const resColor = paused ? "#B54708" : inc.slaBreached ? "#B42318" : "#067647";

  const tabBtn = (k: typeof tab, label: string, badge?: string) => (
    <button type="button" onClick={() => setTab(k)} style={{ padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: tab === k ? 700 : 500,
      color: tab === k ? "#175CD3" : "#667085", borderBottom: `2px solid ${tab === k ? "#175CD3" : "transparent"}` }}>
      {label}{badge !== undefined && <span className="chip" style={{ marginLeft: 6, fontSize: 11 }}>{badge}</span>}
    </button>
  );

  return (
    <>
      {/* Header */}
      <div style={{ padding: "16px 28px 0" }}>
        <div className="breadcrumb">Manage Incidents &gt; {ref}</div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginTop: 6 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div className="page-title" style={{ margin: 0 }}>{ref}</div>
              <span className="dash-badge" style={{ background: ss.bg, color: ss.color }}>{status}</span>
              <span className="dash-badge" style={{ background: ps.bg, color: ps.color }}>
                {configuredPriorityColor && <span className="dot" style={{ background: configuredPriorityColor }} />}
                {inc.priority}
              </span>
            </div>
            {editing ? <input className="input" style={{ marginTop: 8, maxWidth: 640 }} value={edit?.title} maxLength={200} onChange={(e) => setDraft("title", e.target.value)} aria-label="Short description" />
              : <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{inc.title}</div>}
            <div style={{ fontSize: 12, color: "#98A2B3", marginTop: 4 }}>Created by {inc.createdBy?.fullName ?? "—"} · {formatDateTime(inc.createdAt)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {editing ? (
              <>
                <button className="btn-primary" disabled={saving} onClick={() => void saveEdit()}>{saving ? "Saving…" : "Save Changes"}</button>
                <button className="btn-ghost" onClick={() => { setEdit(null); setErr(""); }}>Cancel</button>
              </>
            ) : locked ? (
              <>
                <button className="btn-ghost" disabled style={{ cursor: "not-allowed", opacity: 0.55 }}>Edit</button>
                <button className="btn-ghost" disabled style={{ cursor: "not-allowed", opacity: 0.55 }}>Request Update</button>
                <span style={{ fontSize: 12, color: "#98A2B3" }}>{viewOnly ? "🔒 Read-only view" : `🔒 ${status} — locked`}</span>
              </>
            ) : (
              <>
                {canClaim && <button className="btn-primary" disabled={claimBusy} onClick={() => void claimIncident()}>{claimBusy ? "Claiming…" : "Claim Incident"}</button>}
                {isAssignedToMe && !isClosed && <button className="btn-ghost" disabled={releaseBusy} onClick={() => void releaseIncident()}>{releaseBusy ? "Releasing…" : "Release to Group"}</button>}
                <button className="btn-ghost" onClick={startEdit}>Edit</button>
                <button className="btn-ghost" onClick={() => void requestUpdate()}>Request Update</button>
                {canResolveFromHere && !isResolved && (
                  resolveBlock
                    ? <button className="btn-ghost" disabled title={`Cannot resolve yet: ${resolveBlock}.`} style={{ cursor: "not-allowed", opacity: 0.55 }}>Resolve</button>
                    : <button className="btn-primary" onClick={() => { setNote(""); setErr(""); setResCode(inc.resolutionCode ?? ""); setConfirm("resolve"); }}>Resolve</button>
                )}
                {isResolved && <button className="btn-ghost" onClick={() => void transition("reopen")} disabled={busy}>Reopen</button>}
                {isResolved && isCaller && <button className="btn-primary" style={{ background: "#067647", borderColor: "#067647" }} onClick={() => { setNote(""); setConfirm("close"); }}>Close Ticket</button>}
              </>
            )}
            <button className="btn-ghost" onClick={() => (viewOnly ? window.history.back() : navigate(returnPath))}>{viewOnly ? "Back" : `Back to ${returnToQueue ? "Queue" : "Incident List"}`}</button>
          </div>
        </div>
        {notice && (
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, padding: "9px 12px", borderRadius: 8,
            color: notice.ok ? "#067647" : "#B54708", background: notice.ok ? "#ECFDF3" : "#FFFAEB", border: `1px solid ${notice.ok ? "#ABEFC6" : "#FEDF89"}` }}>
            <span style={{ flex: 1 }}>{notice.msg}</span>
            <button type="button" aria-label="Dismiss" className="admin-master-icon-button" onClick={() => setNotice(null)}><X size={14} /></button>
          </div>
        )}
        <ErrorBar msg={err || slaWindows.error || workgroupSlaWindows.error || ""} />
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #E4E7EC", marginTop: 12 }}>
          {tabBtn("details", "Details")}{tabBtn("wo", "Work Order", String(wos.length))}{tabBtn("checklist", "Checklist", `${checklist?.doneCount ?? 0}/${checklist?.total ?? 0}`)}
        </div>
      </div>

      <div className="page-body">
        {tab === "details" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(280px,1fr)", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
              <div className="card" style={{ padding: 22 }}>
                <div className="proto-eyebrow-title" style={{ marginBottom: 14 }}>Incident Details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
                  {field("Status", "status", status, <select className="select" value={edit?.status ?? ""} onChange={(e) => setDraft("status", e.target.value)}>{statusOptions.map((s) => <option key={s}>{s}</option>)}</select>)}
                  {field("Priority", "priority", inc.priority, sel("priority", nm(names(pris.data, "priorityName")), null), "Priority")}
                  {field("Impact", "impact", inc.impact, sel("impact", nm(names(imps.data, "impactName")), null), "Impact")}
                  {field("Urgency", "urgency", inc.urgency, sel("urgency", nm(names(urgs.data, "urgencyName")), null), "Urgency")}
                  {field("Category", "category", inc.category?.categoryName, (
                    <BrowsePicker title="Select Incident Category" ariaLabel="Category" value={String(edit?.categoryId ?? "")} label={edit?.categoryName ?? ""} clearable
                      nodes={categoryNodes} placeholder="Click Browse to select a category…"
                      onSelect={(n) => { setDraft("categoryId", n?.id ?? ""); setDraft("categoryName", n?.label ?? ""); }} />), "Category")}
                  {field("SLA Service Window", "slaServiceWindowId", (() => {
                    const groupWindow = (workgroupSlaWindows.data ?? []).find((w) => w.groupId === inc.assignmentGroup?.groupId && w.isActive);
                    const effectiveWindowId = inc.slaServiceWindowId ?? groupWindow?.slaServiceWindowId;
                    return (slaWindows.data ?? []).find((w) => w.slaServiceWindowId === effectiveWindowId)?.slaName
                      ?? (groupWindow?.slaServiceWindowId ? "Workgroup service window" : "Workgroup default (24x7)");
                  })(), sel("slaServiceWindowId", (slaWindows.data ?? [])
                    .filter((w) => w.isActive !== false || w.slaServiceWindowId === inc.slaServiceWindowId)
                    .map((w) => ({ v: w.slaServiceWindowId, l: w.slaName })), "Workgroup default"))}
                  {field("Assignment Group", "group", inc.assignmentGroup?.groupName, sel("groupId", (() => {
                    // Only the groups this user can see (the server already scopes the list) — plus the incident's current group so the box never shows blank.
                    const opts = (groups.data ?? []).filter((g) => g.isActive !== false).map((g) => ({ v: g.groupId, l: g.groupName }));
                    const cur = inc.assignmentGroup;
                    return cur && !opts.some((o) => String(o.v) === String(cur.groupId)) ? [{ v: cur.groupId, l: cur.groupName }, ...opts] : opts;
                  })()), "Assignment Group")}
                  {field("Assigned To", "assignedTo", inc.assignedTo?.fullName, (() => {
                    const g = (groups.data ?? []).find((x) => String(x.groupId) === String(edit?.groupId)); const mem = g?.members as Raw[] | undefined;
                    return sel("assignedTo", (usersQ.data ?? []).filter((u) => u.isActive !== false && (!mem || mem.some((m) => m.userId === u.userId))).map((u) => ({ v: u.userId, l: u.fullName })));
                  })(), "Assigned To")}
                  {field("Classification", "classification", (clsQ.data ?? []).find((c) => c.classificationId === inc.classificationId)?.name,
                    <BrowsePicker title="Select Incident Classification" ariaLabel="Classification" value={String(edit?.classificationId ?? "")} label={edit?.classificationName ?? ""} clearable
                      nodes={classificationNodes} placeholder="Click Browse to select a classification…"
                      onSelect={(n) => { setDraft("classificationId", n?.id ?? ""); setDraft("classificationName", n?.label ?? ""); }} />, "Classification")}
                  {(isPendingStatus(status) || (editing && isPendingStatus(edit?.status)) || requiredReason("Pending Reason", edit)) &&
                    field("Pending Reason", "pendingReason", inc.pendingReason, sel("pendingReason", nm(names(pendQ.data, "pendingReasonName"))), "Pending Reason")}
                  {(status === "On Hold" || (editing && edit?.status === "On Hold") || requiredReason("On Hold Reason", edit)) &&
                    field("On Hold Reason", "onHoldReason", inc.onHoldReason, sel("onHoldReason", (holdQ.data ?? []).filter((r) => r.isActive).map((r) => ({ v: r.name, l: `${r.name} — ${r.slaImpact === "continue" ? "SLA keeps running" : "SLA paused"}` }))), "On Hold Reason")}
                </div>
                {(editing ? (edit?.status === "Resolved" || edit?.status === "Closed" || !!requiredReason("Resolution Notes", edit)) : !!inc.resolutionNotes) && (
                  <div className="field-group" style={{ marginTop: 14 }}>
                    <span className="lbl">Resolution Notes{requiredReason("Resolution Notes", edit) ? <span className="req"> *</span> : null}</span>
                    {editing ? <textarea className="textarea" rows={3} value={edit?.resolutionNotes ?? ""} onChange={(e) => setDraft("resolutionNotes", e.target.value)} />
                      : <div style={{ fontSize: 13, color: "#344054", whiteSpace: "pre-wrap" }}>{inc.resolutionNotes}</div>}
                  </div>
                )}
                {(editing ? (edit?.status === "Resolved" || edit?.status === "Closed") : !!inc.resolutionCode) && (
                  <div className="field-group" style={{ marginTop: 14 }}>
                    <span className="lbl">Resolution Code{editing && edit?.status === "Resolved" && activeResCodes.length > 0 ? <span className="req"> *</span> : null}</span>
                    {editing ? sel("resolutionCode", nm(activeResCodes.map((c) => c.name as string)), "None")
                      : <div style={{ fontSize: 13, color: "#344054" }}>{inc.resolutionCode}</div>}
                  </div>
                )}
                <div className="field-group" style={{ marginTop: 14 }}>
                  <span className="lbl">Description</span>
                  {editing ? <textarea className="textarea" rows={4} value={edit?.description} onChange={(e) => setDraft("description", e.target.value)} />
                    : <div style={{ fontSize: 13, color: "#344054", whiteSpace: "pre-wrap" }}>{inc.description || "—"}</div>}
                </div>
                <div style={{ marginTop: 18 }}>
                  <div className="proto-eyebrow-title" style={{ marginBottom: 10 }}>Additional Information</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
                    <div className="field-group"><span className="lbl">Email ID</span><div style={{ fontSize: 13 }}>{inc.callerEmail ?? inc.createdBy?.email ?? "—"}</div></div>
                    <div className="field-group"><span className="lbl">Department</span>
                      {editing ? <input className="input" value={edit?.department} onChange={(e) => setDraft("department", e.target.value)} /> : <div style={{ fontSize: 13 }}>{inc.department || "—"}</div>}</div>
                    <div className="field-group"><span className="lbl">Contact Type</span><div style={{ fontSize: 13 }}>{inc.contactType || "—"}</div></div>
                    <div className="field-group"><span className="lbl">Configuration Item</span><div style={{ fontSize: 13 }}>{inc.affectedAsset || "—"}</div></div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div className="proto-eyebrow-title">Attachments ({atts.length})</div>
                  {!locked && <button className="btn-ghost" onClick={() => fileRef.current?.click()}><Paperclip size={13} /> Add file</button>}
                  <input ref={fileRef} type="file" multiple hidden accept=".jpg,.jpeg,.png,.pdf,.docx" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
                </div>
                {attErr && <div className="error-text" style={{ marginBottom: 6 }}>{attErr}</div>}
                {atts.length === 0 ? <div style={{ fontSize: 12.5, color: "#98A2B3" }}>No attachments.</div> : atts.map((a) => (
                  <div key={a.attachmentId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #F2F4F7", fontSize: 13 }}>
                    <Paperclip size={13} color="#98A2B3" />
                    <a href="#" style={{ flex: 1 }} onClick={(e) => { e.preventDefault(); void attachmentApi.download(id, a).catch((x) => setAttErr(errMsg(x))); }}>{a.fileName}</a>
                    <span style={{ color: "#98A2B3", fontSize: 12 }}>{fmtBytes(a.sizeBytes)}</span>
                    {!locked && <button className="admin-master-icon-button danger" aria-label={`Remove ${a.fileName}`} onClick={async () => { try { await attachmentApi.remove(id, a.attachmentId); setAtts(await attachmentApi.list(id)); } catch (x) { setAttErr(errMsg(x)); } }}><X size={14} /></button>}
                  </div>
                ))}
              </div>

              <div className="card" style={{ padding: 22 }}>
                <div className="proto-eyebrow-title" style={{ marginBottom: 10 }}>Conversation</div>
                {!locked && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                    <input className="input" style={{ flex: 1 }} placeholder={isNote ? "Add an internal work note…" : "Write a message to the requester…"} value={msg} onChange={(e) => setMsg(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} aria-label="Message" />
                    <label className="admin-master-check-label" style={{ whiteSpace: "nowrap" }}><input type="checkbox" checked={isNote} onChange={(e) => setIsNote(e.target.checked)} /> Work note</label>
                    <button className="btn-primary" disabled={!msg.trim()} onClick={() => void send()}>Send</button>
                  </div>
                )}
                {convo.length === 0 && <div style={{ fontSize: 12.5, color: "#98A2B3", marginBottom: 8 }}>No messages yet.</div>}
                {convo.map((m) => (
                  <div key={m.activityId} style={{ display: "flex", gap: 10, padding: "8px 0" }}>
                    <div className="user-avatar" style={{ background: m.type === "work_note" ? "#FFFAEB" : "#EFF4FC", color: m.type === "work_note" ? "#B54708" : "#175CD3", width: 30, height: 30, fontSize: 11 }}>{initials(m.author?.fullName ?? "?")}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{m.content}</div>
                      <div style={{ fontSize: 11.5, color: "#98A2B3" }}>{m.author?.fullName ?? "System"} · {shortDT(m.createdAt)}{m.type === "work_note" && " · Work note (internal)"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
              <div className="card" style={{ padding: 20 }}>
                <div className="proto-eyebrow-title" style={{ marginBottom: 12 }}>SLA Information</div>
                <div style={{ fontSize: 12, color: "#98A2B3" }}>Response Time</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{shortDT(inc.slaResponseTarget)}</div>
                <div style={{ fontSize: 12, color: respMissed ? "#B42318" : "#067647", marginBottom: 12 }}>{respStatus}</div>
                <div style={{ fontSize: 12, color: "#98A2B3" }}>Resolution Time</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{shortDT(inc.slaResolutionTarget)}</div>
                <div style={{ fontSize: 12, color: resColor }}>{resText}</div>
                {paused && (
                  <>
                    <div style={{ fontSize: 12, color: "#B54708", marginTop: 8 }}>Resolution SLA paused{inc.onHoldReason ? ` — ${inc.onHoldReason}` : inc.pendingReason ? ` — ${inc.pendingReason}` : ""} since {shortDT(inc.slaPausedAt)}.</div>
                    {!locked && <button type="button" className="btn-ghost" style={{ marginTop: 10, height: 30, fontSize: 11.5, display: "flex", alignItems: "center", gap: 6 }} onClick={() => void resumeSla()}><Play size={11} /> Resume SLA</button>}
                  </>
                )}
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div className="proto-eyebrow-title" style={{ marginBottom: 12 }}>Timeline</div>
                {tlEvents.length === 0 && <div style={{ fontSize: 12.5, color: "#98A2B3" }}>No activity yet.</div>}
                {(showAllTl ? tlEvents : tlEvents.slice(0, 4)).map((t) => (
                  <div key={t.activityId} style={{ display: "flex", gap: 10, padding: "6px 0" }}>
                    <div style={{ width: 18, color: "#175CD3", textAlign: "center" }}>{TL_DOT[t.type] ?? "•"}</div>
                    <div><div style={{ fontSize: 12.5 }}>{t.content}</div><div style={{ fontSize: 11.5, color: "#98A2B3" }}>{t.author?.fullName ?? "System"} — {shortDT(t.createdAt)}</div></div>
                  </div>
                ))}
                {tlEvents.length > 4 && <button type="button" className="btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setShowAllTl(!showAllTl)}>{showAllTl ? "Show less" : `Show all (${tlEvents.length})`}</button>}
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div className="proto-eyebrow-title">Related Items</div>
                  {!locked && <button type="button" className="btn-ghost btn-sm" onClick={() => setLinkOpen(!linkOpen)}>+ Link</button>}
                </div>
                {linkOpen && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <input className="input" placeholder="Incident number, e.g. INC0010046" value={linkRef} onChange={(e) => setLinkRef(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addLink(); }} aria-label="Incident number to link" />
                    <button className="btn-primary btn-sm" onClick={() => void addLink()}>Link</button>
                  </div>
                )}
                {links.length === 0 ? <div style={{ fontSize: 12.5, color: "#98A2B3" }}>No related items</div> : links.map((l) => (
                  <div key={l.linkId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 13 }}>
                    <Link to={`/incidents/${l.incidentId}`} style={{ fontWeight: 700 }}>{l.incidentRef}</Link><span style={{ flex: 1, color: "#667085", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.shortDescription}</span>
                    {!locked && <button className="admin-master-icon-button danger" aria-label={`Unlink ${l.incidentRef}`} onClick={async () => { try { setLinks(await recordApi.unlink(id, l.linkId)); } catch (e) { setErr(errMsg(e)); } }}><X size={13} /></button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "wo" && (
          <div className="card" style={{ padding: 22 }}>
            {woForm ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div className="proto-eyebrow-title">{woForm === "new" ? "Create Work Order" : `Edit ${woForm.woNumber}`}</div>
                  <button className="btn-ghost" onClick={() => setWoForm(null)}>← Back to Work Orders</button>
                </div>
                <ErrorBar msg={woErr} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <label className="field-group"><span className="lbl">Related Incident</span><input className="input" value={ref} readOnly /></label>
                  <label className="field-group"><span className="lbl">Priority</span><select className="select" value={wo.priority} onChange={(e) => setWo({ ...wo, priority: e.target.value })}>{WO_PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
                  <label className="field-group" style={{ gridColumn: "1 / -1" }}><span className="lbl">Title <span className="req">*</span></span><input className="input" value={wo.title} maxLength={250} onChange={(e) => setWo({ ...wo, title: e.target.value })} /></label>
                  <label className="field-group" style={{ gridColumn: "1 / -1" }}><span className="lbl">Work Details</span><textarea className="textarea" rows={3} value={wo.notes} onChange={(e) => setWo({ ...wo, notes: e.target.value })} /></label>
                  <label className="field-group"><span className="lbl">Workgroup</span><select className="select" value={wo.groupId} onChange={(e) => setWo({ ...wo, groupId: e.target.value })}><option value="">None</option>{(groups.data ?? []).map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}</select></label>
                  <label className="field-group"><span className="lbl">Assigned To</span><select className="select" value={wo.assignedTo} onChange={(e) => setWo({ ...wo, assignedTo: e.target.value })}><option value="">None</option>{(usersQ.data ?? []).filter((u) => u.isActive !== false).map((u) => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}</select></label>
                  <label className="field-group"><span className="lbl">Status</span><select className="select" value={wo.status} onChange={(e) => setWo({ ...wo, status: e.target.value })}>{WO_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button className="btn-primary" onClick={() => void saveWo()}>{woForm === "new" ? "Create Work Order" : "Save Changes"}</button>
                  <button className="btn-ghost" onClick={() => setWoForm(null)}>Cancel</button>
                  {woForm !== "new" && <button className="btn-danger" style={{ marginLeft: "auto" }} onClick={() => void removeWo()}>Remove Work Order</button>}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div className="proto-eyebrow-title">Work Orders ({wos.length})</div>
                  {!locked && <button className="btn-primary" onClick={() => openWoForm("new")}>Create Work Order</button>}
                </div>
                {openWos.length > 0 && <div style={{ fontSize: 12.5, color: "#B54708", background: "#FFFAEB", border: "1px solid #FEDF89", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{openWos.length} work order(s) still open — close them before resolving this incident.</div>}
                {wos.length === 0 ? <div className="empty-state">No work orders raised for this incident yet.</div> : (
                  <table>
                    <thead><tr><th>WO #</th><th>Work Order</th><th>Workgroup</th><th>Assigned To</th><th>Priority</th><th>Status</th></tr></thead>
                    <tbody>
                      {wos.map((w) => (
                        <tr key={w.workOrderId}>
                          <td><a href="#" className="wo-link" onClick={(e) => { e.preventDefault(); openWoForm(w); }}>{w.woNumber}</a></td>
                          <td><div style={{ fontWeight: 500 }}>{w.title}</div><div style={{ fontSize: 11.5, color: "#98A2B3" }}>Created {new Date(w.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div></td>
                          <td>{w.workgroup}</td><td>{w.assignedTo}</td><td>{w.priority}</td><td>{w.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        )}

        {tab === "checklist" && (
          <div className="card" style={{ padding: 22, maxWidth: 760 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="proto-eyebrow-title">Checklist</div>
              <div style={{ fontSize: 12.5, color: "#667085" }}>{checklist?.doneCount ?? 0}/{checklist?.total ?? 0} done</div>
            </div>
            <div style={{ height: 6, background: "#F2F4F7", borderRadius: 3, margin: "10px 0 6px", overflow: "hidden" }}>
              <div style={{ width: `${checklist?.total ? (checklist.doneCount / checklist.total) * 100 : 0}%`, height: "100%", background: "#12B76A" }} />
            </div>
            <div style={{ fontSize: 12.5, color: "#667085", marginBottom: 10 }}>Standard Resolution Checklist — complete before resolving this incident.</div>
            {(checklist?.items ?? []).length === 0 && <div style={{ fontSize: 13, color: "#667085", padding: "10px 0" }}>No checklist applies to this incident right now. Checklists appear when the incident's Status, Workgroup and Category match the checklist's scope (empty scope fields match anything).</div>}
            {(checklist?.items ?? []).map((it) => (
              <label key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "1px solid #F2F4F7", cursor: locked ? "default" : "pointer" }}>
                <input type="checkbox" checked={it.done} disabled={locked} onChange={(e) => void toggleItem(it.id, e.target.checked)} style={{ marginTop: 3 }} />
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, textDecoration: it.done ? "line-through" : "none", color: it.done ? "#98A2B3" : "#1D2433" }}>{it.name}</span>
                  {it.description && <span style={{ display: "block", fontSize: 12, color: "#98A2B3" }}>{it.description}</span>}
                  {it.checklist && <span style={{ display: "block", fontSize: 11.5, color: "#667085" }}>From checklist: {it.checklist}</span>}
                </span>
                {it.required && <span className="chip" style={{ fontSize: 11 }}>Required</span>}
              </label>
            ))}
            {reqOpen > 0 && <div style={{ fontSize: 12.5, color: "#B54708", marginTop: 12 }}>Complete all required checklist items before resolving.</div>}
          </div>
        )}
      </div>

      {confirm && (
        <div role="dialog" aria-modal="true" aria-label={confirm === "resolve" ? "Resolve incident" : "Close incident"} style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
          <div className="card" style={{ width: 460, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{confirm === "resolve" ? "Mark this incident as resolved?" : "Close this incident?"}</div>
            <div style={{ fontSize: 13, color: "#667085", margin: "8px 0 14px" }}>
              {confirm === "resolve"
                ? `${ref} will move to Resolved. It can still be reopened from here if the issue isn't fully fixed.`
                : `${ref} will be marked as Closed and moved out of your open incidents. Once closed, it cannot be reopened — you'll need to raise a new incident if the issue comes back.`}
            </div>
            {confirm === "resolve" && (
              <label className="field-group" style={{ marginBottom: 12 }}>
                <span className="lbl">Resolution Code {activeResCodes.length > 0 && <span className="req">*</span>}</span>
                <select className="select" value={resCode} onChange={(e) => setResCode(e.target.value)} aria-label="Resolution Code">
                  <option value="">{activeResCodes.length ? "Select a resolution code…" : "No resolution codes configured"}</option>
                  {activeResCodes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                {resCode && activeResCodes.find((c) => c.name === resCode)?.description && <span style={{ fontSize: 12, color: "#667085", marginTop: 4 }}>{activeResCodes.find((c) => c.name === resCode)?.description}</span>}
              </label>
            )}
            <label className="field-group"><span className="lbl">{confirm === "resolve" ? (resolveNoteRule ? "Resolution note (required)" : "Resolution note (optional)") : "Closing note (optional)"}</span>
              <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            {err && <div className="error-text" role="alert" style={{ marginTop: 10 }}>{err}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy || (confirm === "resolve" && ((!!resolveNoteRule && !(note.trim() || inc.resolutionNotes)) || (activeResCodes.length > 0 && !resCode)))} style={confirm === "close" ? { background: "#067647", borderColor: "#067647" } : undefined} onClick={() => void transition(confirm)}>
                {busy ? "Working…" : confirm === "resolve" ? "Resolve" : "Close Ticket"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
