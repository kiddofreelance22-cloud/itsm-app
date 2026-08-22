"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  Eye,
  FileText,
  Gauge,
  Laptop2,
  Mail,
  MapPin,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Pencil,
  Phone,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  Tag,
  Timer,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { IncidentsApi, type Incident, type IncidentActivity } from "@/lib/api/incidents.api";
import { useAuth } from "@/lib/hooks/use-auth";
import { useIncidentActivities } from "@/lib/hooks/use-incidents";
import { useToast } from "@/lib/hooks/use-toast";
import { ResolveIncidentModal, type ResolvePayload } from "@/components/incidents/resolve-incident-modal";
import { useAdminAssignmentGroup } from "@/lib/hooks/use-admin-modules";
import { apiFetch } from "@/lib/api/client";
import { Status as AdminStatus, Priority as AdminPriority } from "@/types/admin";

const STATUS_BADGE: Record<string, string> = {
  Open: "bg-blue-50 text-blue-700 ring-blue-200",
  Assigned: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "In Progress": "bg-blue-50 text-blue-700 ring-blue-200",
  Resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Closed: "bg-slate-50 text-slate-500 ring-slate-200",
  "On Hold": "bg-purple-50 text-purple-700 ring-purple-200",
};

const STATUS_DOT: Record<string, string> = {
  Open: "bg-blue-500",
  Assigned: "bg-cyan-500",
  "In Progress": "bg-blue-500",
  "On Hold": "bg-purple-500",
  Resolved: "bg-emerald-500",
  Closed: "bg-slate-400",
};

const PRIORITY_DOT: Record<string, string> = {
  Critical: "bg-red-500",
  High: "bg-orange-500",
  Medium: "bg-amber-500",
  Low: "bg-slate-400",
};

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ s }: { s: string }): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_BADGE[s] ?? STATUS_BADGE.Open}`}
    >
      {s}
    </span>
  );
}

function Field({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-400">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </p>
      <p className="text-sm font-medium text-slate-700">{value ?? "—"}</p>
    </div>
  );
}

function DotField({ color, label, value }: { color: string; label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <p className="mb-1.5 text-xs text-slate-400">{label}</p>
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        <span className={`size-2 rounded-full ${color}`} /> {value}
      </p>
    </div>
  );
}

function Breadcrumb({ incidentCode }: { incidentCode?: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 text-sm text-slate-500">
      <span className="cursor-pointer hover:text-blue-600">Home</span>
      <ChevronRight className="size-3.5 text-slate-300" />
      <span className="cursor-pointer hover:text-blue-600">My Incidents</span>
      <ChevronRight className="size-3.5 text-slate-300" />
      <span className="font-medium text-slate-700">{incidentCode ?? "INC-XXXX"}</span>
    </div>
  );
}


type IncidentForm = { status: string; priority: string; description: string; assignedTo: number | "" };

function IncidentDetailsCard({
  incident,
  editing,
  form,
  setForm,
  saving,
  onCancelEdit,
  onSave,
  canReassign = false,
  groupMembers = [],
  statusOptions,
  priorityOptions,
}: {
  incident: Incident;
  editing: boolean;
  form: IncidentForm;
  setForm: React.Dispatch<React.SetStateAction<IncidentForm>>;
  saving: boolean;
  onCancelEdit: () => void;
  onSave: () => void;
  canReassign?: boolean;
  groupMembers?: { userId: number; fullName: string }[];
  statusOptions: string[];
  priorityOptions: string[];
}): React.JSX.Element {
    const [open, setOpen] = useState(true);

    return (
      <section className="rounded-2xl border border-slate-200 bg-white">
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Tag className="size-4 text-slate-400" /> Incident Details
          </h2>
          {open ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
        </button>

        {open && (
          <div className="border-t border-slate-100 px-5 py-5">
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {priorityOptions.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
                {canReassign && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Assigned To (reassign)</label>
                    <select
                      value={form.assignedTo}
                      onChange={(e) => setForm((prev) => ({ ...prev, assignedTo: e.target.value === "" ? "" : Number(e.target.value) }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Unassigned (back to group queue)</option>
                      {groupMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>{m.fullName}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Description</label>
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={onCancelEdit} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button onClick={onSave} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                <DotField color={STATUS_DOT[incident.status] ?? "bg-slate-400"} label="Status" value={incident.status} />
                <DotField color={PRIORITY_DOT[incident.priority] ?? "bg-slate-400"} label="Priority" value={incident.priority} />
                <Field icon={Gauge} label="Impact" value={incident.impact ?? "—"} />
                <Field icon={Clock} label="Urgency" value={incident.urgency ?? "—"} />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <Field label="Category" value={incident.category?.categoryName ?? "—"} />
                <Field label="Sub Category" value={incident.subCategory?.subCategoryName ?? "—"} />
                <Field label="Assignment Group" value={incident.assignmentGroup?.groupName ?? "—"} />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <Field icon={Users} label="Assigned To" value={incident.assignedTo?.fullName ?? "Unassigned"} />
                <Field icon={MapPin} label="Location" value={incident.location?.locationName ?? "—"} />
                <Field icon={Laptop2} label="Affected Asset" value={incident.affectedAsset ?? "—"} />
              </div>

                <div>
                  <p className="mb-1.5 text-xs text-slate-400">Description</p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
                    {incident.description || "No description provided."}
                  </div>
                </div>

              {incident.affectedAsset ? (
                <div>
                  <p className="mb-2 text-xs text-slate-400">Attachments</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                          <FileText className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{incident.affectedAsset}</p>
                          <p className="text-xs text-slate-400">Asset reference</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="border-t border-slate-100 pt-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Additional Information</p>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <Field icon={Phone} label="Contact Number" value={incident.contactNumber ?? "—"} />
                  <Field icon={Mail} label="Email ID" value={incident.createdBy?.email ?? "—"} />
                  <Field icon={Building2} label="Department" value={incident.department ?? "—"} />
                </div>
                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <Field label="Business Service" value={incident.businessService ?? "—"} />
                  <Field icon={Timer} label="SLA" value={incident.slaResponseTarget ? `Target ${fmtDate(incident.slaResponseTarget)}` : "—"} />
                </div>
              </div>
              </div>
            )}
          </div>
        )}
      </section>
    );
  }


function SLACard({ incident }: { incident: Incident }): React.JSX.Element {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const responseTarget = incident.slaResponseTarget ? new Date(incident.slaResponseTarget) : new Date(now.getTime() + 30 * 60 * 1000);
  const resolutionTarget = incident.slaResolutionTarget ? new Date(incident.slaResolutionTarget) : new Date(now.getTime() + 8 * 60 * 60 * 1000);
  
  // Calculate response time progress (0-100)
  const createdAt = new Date(incident.createdAt);
  const responseDuration = responseTarget.getTime() - createdAt.getTime();
  const responseElapsed = Math.max(0, now.getTime() - createdAt.getTime());
  const responsePct = Math.min(100, (responseElapsed / responseDuration) * 100);
  
  // Calculate resolution time progress (0-100)
  const resolutionDuration = resolutionTarget.getTime() - createdAt.getTime();
  const resolutionElapsed = Math.max(0, now.getTime() - createdAt.getTime());
  const resolutionPct = Math.min(100, (resolutionElapsed / resolutionDuration) * 100);
  
  // Calculate time remaining
  const responseRemaining = Math.max(0, responseTarget.getTime() - now.getTime());
  const resolutionRemaining = Math.max(0, resolutionTarget.getTime() - now.getTime());
  
  const formatTimeRemaining = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">SLA Information</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">Response Time</p>
            <p className="text-xs text-slate-500">Target: {fmtDate(responseTarget)}</p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div 
              className={`h-full rounded-full transition-all ${
                responsePct >= 100 ? "bg-red-500" : responsePct >= 75 ? "bg-amber-500" : "bg-blue-500"
              }`} 
              style={{ width: `${Math.min(100, responsePct)}%` }} 
            />
          </div>
          <p className={`text-xs font-medium ${
            incident.slaResponseMet ? "text-emerald-600" : responsePct >= 100 ? "text-red-600" : "text-slate-600"
          }`}>
            {incident.slaResponseMet ? (
              <>
                <CheckCircle2 className="mb-1 inline size-3" /> Met
              </>
            ) : responsePct >= 100 ? (
              <>
                <XCircle className="mb-1 inline size-3" /> Breached
              </>
            ) : (
              formatTimeRemaining(responseRemaining)
            )}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">Resolution Time</p>
            <p className="text-xs text-slate-500">Target: {fmtDate(resolutionTarget)}</p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div 
              className={`h-full rounded-full transition-all ${
                resolutionPct >= 100 ? "bg-red-500" : resolutionPct >= 75 ? "bg-amber-500" : "bg-blue-500"
              }`} 
              style={{ width: `${Math.min(100, resolutionPct)}%` }} 
            />
          </div>
          <p className={`text-xs font-medium ${
            !incident.slaBreached ? "text-emerald-600" : "text-red-600"
          }`}>
            {!incident.slaBreached ? (
              <>
                <CheckCircle2 className="mb-1 inline size-3" /> Within SLA
              </>
            ) : (
              <>
                <XCircle className="mb-1 inline size-3" /> SLA Breached
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}


function activityIcon(type: string): { bg: string; Icon: React.ElementType } {
  switch (type) {
    case "created":
      return { bg: "bg-violet-100 text-violet-600", Icon: Shield };
    case "status_change":
      return { bg: "bg-blue-100 text-blue-600", Icon: RefreshCw };
    case "assignment_change":
    case "claimed":
      return { bg: "bg-emerald-100 text-emerald-600", Icon: UserCheck };
    case "priority_change":
      return { bg: "bg-amber-100 text-amber-700", Icon: AlertCircle };
    default:
      return { bg: "bg-sky-100 text-sky-600", Icon: PlayCircle };
  }
}

function activityLabel(act: IncidentActivity): string {
  switch (act.type) {
    case "created":
      return "Incident Created";
    case "status_change":
      return "Status Updated";
    case "priority_change":
      return "Priority Updated";
    case "assignment_change":
      return "Assigned";
    case "claimed":
      return "Incident Claimed";
    case "work_note":
      return "Work Note";
    case "comment":
      return "Comment Added";
    default:
      return "Update Added";
  }
}

function activityMeta(act: IncidentActivity): string | undefined {
  if (act.type === "assignment_change") {
    const target = typeof act.meta?.to === "string" ? act.meta.to : "Unassigned";
    return `to ${target}`;
  }

  if (act.type === "created") {
    return act.author?.fullName ? `by ${act.author.fullName}` : "by System";
  }

  return act.author?.fullName ? `by ${act.author.fullName}` : undefined;
}


function TimelineCard({ activities }: { activities: IncidentActivity[] }): React.JSX.Element {
  // Show activity timeline for non-message activities (created, status/assignment/priority changes, claimed)
  const events = activities.filter((a) => a.type !== "comment" && a.type !== "work_note");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
        <Clock className="size-4 text-slate-400" /> Timeline
      </h3>

      <div className="space-y-0">
        {events.map((act, i) => {
          const { bg, Icon } = activityIcon(act.type);
          return (
            <div key={act.activityId} className="flex gap-3">
              <div className="relative flex-shrink-0">
                <div className={`flex size-8 items-center justify-center rounded-full ${bg}`}>
                  <Icon className="size-3.5" />
                </div>
                {i < events.length - 1 && <div className="absolute left-1/2 top-8 h-full w-px -translate-x-1/2 bg-slate-100" />}
              </div>
              <div className="pb-5">
                <p className="text-sm font-semibold text-slate-800">{activityLabel(act)}</p>
                {activityMeta(act) && <p className="text-xs text-slate-400">{activityMeta(act)}</p>}
                <p className="mt-0.5 text-xs text-slate-400">{fmtDate(act.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <button className="text-sm font-medium text-blue-600 hover:underline">View All Updates</button>
    </section>
  );
}


function ConversationCard({
  activities,
  onSend,
  sending = false,
}: {
  activities: IncidentActivity[];
  onSend: (message: string) => Promise<void>;
  sending?: boolean;
}): React.JSX.Element {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messages = activities.filter((a) => !!a.content);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const value = draft.trim();
    if (!value || isSending || sending) return;
    setIsSending(true);
    try {
      await onSend(value);
      setDraft("");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
        <MessageSquare className="size-4 text-slate-400" /> Conversation
      </h3>

      <div className="mb-4 max-h-80 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">No messages yet.</p>
        )}
        {messages.map((m) => (
          <div key={m.activityId} className={`rounded-xl px-4 py-3 ${m.isWorkNote ? "bg-purple-50" : "bg-blue-50"}`}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{m.author?.fullName ?? "System"}</span>
              <span className="whitespace-nowrap text-xs text-slate-400">{fmtDate(m.createdAt)}</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{m.content}</p>
          </div>
        ))}
        <div ref={listEndRef} />
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Type your message..."
          className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
        />
        <button type="button" className="text-slate-400 hover:text-slate-600">
          <Paperclip className="size-4" />
        </button>
        <button
          type="button"
          disabled={!draft.trim() || isSending || sending}
          onClick={() => void handleSend()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {isSending || sending ? "Sending..." : "Send"} <Send className="size-3.5" />
        </button>
      </div>
    </section>
  );
}


function RelatedItemsCard(): React.JSX.Element {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-slate-800">Related Items</h3>
      <div className="space-y-2 text-sm">
        <p className="text-slate-400">No related items</p>
      </div>
    </section>
  );
}


export default function IncidentDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const incidentId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? "";
  const { user, isAnalyst, isAdmin, isManager } = useAuth();
  const { toast } = useToast();
  const { activities, addActivity } = useIncidentActivities(incidentId);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ status: string; priority: string; description: string; assignedTo: number | ""; }>({
    status: "", priority: "", description: "", assignedTo: "",
  });
  const { items: groups } = useAdminAssignmentGroup();
  const [claiming, setClaiming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<string[]>([]);

  // Pull from the same admin-configured Status / Priority lists used when
  // creating an incident, so anything added there is selectable here too.
  useEffect(() => {
    apiFetch<AdminStatus[]>("/status")
      .then((s) => setStatusOptions(s.filter((x) => x.isActive && x.type === "incident").map((x) => x.statusName)))
      .catch(() => {});
    apiFetch<AdminPriority[]>("/priority")
      .then((p) => setPriorityOptions(p.filter((x) => x.isActive).map((x) => x.priorityName)))
      .catch(() => {});
  }, []);

  const handleSendMessage = async (message: string) => {
    if (!incidentId || !message.trim()) return;
    setSendingMessage(true);
    try {
      await addActivity(message.trim());
    } finally {
      setSendingMessage(false);
    }
  };

  const isMine = !!incident?.assignedTo && incident.assignedTo.userId === user?.userId;
  const isClosed = incident?.status === "Resolved" || incident?.status === "Closed";
  const canClaim = isAnalyst && !incident?.assignedTo && !isClosed;
  const canResolve = (isAnalyst || isAdmin || isManager) && !isClosed;
  const canRelease = isAnalyst && isMine && !isClosed;
  const canReassign = (isAdmin || isManager) && !isClosed;

  const handleClaim = async () => {
    if (!incidentId) return;
    setClaiming(true);
    try {
      const updated = await IncidentsApi.claim(incidentId);
      setIncident(updated);
      toast({ title: "Incident claimed", description: "It now appears in My Incidents.", variant: "success" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to claim incident", variant: "error" });
    } finally {
      setClaiming(false);
    }
  };

  const handleRelease = async () => {
    if (!incidentId) return;
    setReleasing(true);
    try {
      const updated = await IncidentsApi.release(incidentId);
      setIncident(updated);
      toast({ title: "Released back to group queue", variant: "info" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to release incident", variant: "error" });
    } finally {
      setReleasing(false);
    }
  };

  const handleResolve = async (payload: ResolvePayload): Promise<boolean> => {
    if (!incidentId) return false;
    try {
      const updated = await IncidentsApi.resolve(incidentId, payload);
      setIncident(updated);
      toast({ title: "Incident resolved", description: "SLA clock has been stopped.", variant: "success" });
      return true;
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to resolve incident", variant: "error" });
      return false;
    }
  };

  useEffect(() => {
    if (!incidentId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const incidentData = await IncidentsApi.getOne(incidentId);
        setIncident(incidentData);
        setForm({
          status: incidentData.status,
          priority: incidentData.priority,
          description: incidentData.description ?? "",
          assignedTo: incidentData.assignedTo?.userId ?? "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load incident");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [incidentId]);

  const startEdit = () => {
    if (!incident) return;
    setForm({
      status: incident.status,
      priority: incident.priority,
      description: incident.description ?? "",
      assignedTo: incident.assignedTo?.userId ?? "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!incidentId) return;
    setSaving(true);
    try {
      const updated = await IncidentsApi.update(incidentId, {
        status: form.status as Incident["status"],
        priority: form.priority as Incident["priority"],
        description: form.description,
        ...(canReassign ? { assignedTo: form.assignedTo === "" ? null : Number(form.assignedTo) } : {}),
      });
      setIncident(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save incident");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#F7F9FC] px-6 py-5">
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-slate-500">Loading incident details...</p>
        </div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="min-h-screen w-full bg-[#F7F9FC] px-6 py-5">
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-red-500">{error ?? "Incident not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F7F9FC] px-6 py-5">
      <Breadcrumb incidentCode={incident.incidentCode} />

      <div className="mb-5 mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{incident.incidentCode ?? "INC-XXXX"}</h1>
            <StatusBadge s={incident.status} />
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-800">{incident.title}</p>
          <p className="mt-1 text-sm text-slate-400">
            Created on {fmtDate(incident.createdAt)} • by {incident.createdBy?.fullName ?? "System"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!editing && (
            <>
              {canClaim && (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <UserCheck className="size-3.5" /> {claiming ? "Claiming..." : "Claim Incident"}
                </button>
              )}
              {canResolve && (
                <button
                  onClick={() => setResolveOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="size-3.5" /> Resolve
                </button>
              )}
              {canRelease && (
                <button
                  onClick={handleRelease}
                  disabled={releasing}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  <RotateCcw className="size-3.5" /> {releasing ? "Releasing..." : "Release to Group"}
                </button>
              )}
              <button onClick={startEdit} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <Pencil className="size-3.5" /> {canReassign ? "Update / Reassign" : "Edit"}
              </button>
              {!isAnalyst && (
                <>
                  <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <RefreshCw className="size-3.5" /> Request Update
                  </button>
                  <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    <RotateCcw className="size-3.5" /> Reopen
                  </button>
                </>
              )}
              <button className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50">
                <MoreVertical className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {incident && (
        <ResolveIncidentModal
          incident={incident}
          open={resolveOpen}
          onOpenChange={setResolveOpen}
          onResolve={handleResolve}
        />
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          <IncidentDetailsCard
            incident={incident}
            editing={editing}
            form={form}
            setForm={setForm}
            saving={saving}
            onCancelEdit={() => setEditing(false)}
            onSave={handleSave}
            canReassign={canReassign}
            groupMembers={groups.find((g) => g.groupId === incident.assignmentGroup?.groupId)?.members ?? []}
            statusOptions={statusOptions}
            priorityOptions={priorityOptions}
          />
          <SLACard incident={incident} />
        </div>

        <div className="space-y-5">
          <TimelineCard activities={activities} />
          <ConversationCard activities={activities} onSend={handleSendMessage} sending={sendingMessage} />
          <RelatedItemsCard />
        </div>
      </div>
    </div>
  );
}