"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
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
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useAuth } from "@/lib/hooks/use-auth";
import { useIncidentActivities } from "@/lib/hooks/use-incidents";
import { useToast } from "@/lib/hooks/use-toast";
import { ResolveIncidentModal, type ResolvePayload } from "@/components/incidents/resolve-incident-modal";
import { useAdminAssignmentGroup } from "@/lib/hooks/use-admin-modules";
import { apiFetch } from "@/lib/api/client";
import { Status as AdminStatus, Priority as AdminPriority, Category as AdminCategory, SubCategory as AdminSubCategory, Impact as AdminImpact, Urgency as AdminUrgency, Location as AdminLocation } from "@/types/admin";
import { CategoriesApi } from "@/lib/api/categories.api";
import { SubCategoryApi, ImpactApi, UrgencyApi, LocationApi } from "@/lib/api/admin-modules.api";

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
  // Don't render field if value is empty/undefined/null
  if (value === null || value === undefined || value === "" || value === "—") {
    return <></>;
  }
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-400">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
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

type IncidentForm = {
  status: string; priority: string; description: string; assignedTo: number | "";
  impact: string; urgency: string;
  categoryId: number | ""; subCategoryId: number | ""; groupId: number | ""; locationId: number | "";
  affectedAsset: string; businessService: string; contactNumber: string; department: string;
};

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
  descriptionLocked = false,
  categories = [],
  subCategories = [],
  impactOptions = [],
  urgencyOptions = [],
  assignmentGroups = [],
  locationOptions = [],
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
  /** Engineers can edit every other field, but Description stays read-only. */
  descriptionLocked?: boolean;
  categories?: AdminCategory[];
  subCategories?: AdminSubCategory[];
  impactOptions?: string[];
  urgencyOptions?: string[];
  assignmentGroups?: { groupId: number; groupName: string }[];
  locationOptions?: { locationId: number; locationName: string }[];
}): React.JSX.Element {
    const [open, setOpen] = useState(true);
    const filteredSubCategories = subCategories.filter(
      (s) => form.categoryId === "" || s.category?.categoryId === form.categoryId
    );

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

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Impact</label>
                  <select
                    value={form.impact}
                    onChange={(e) => setForm((prev) => ({ ...prev, impact: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {impactOptions.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Urgency</label>
                  <select
                    value={form.urgency}
                    onChange={(e) => setForm((prev) => ({ ...prev, urgency: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {urgencyOptions.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Category</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      categoryId: e.target.value === "" ? "" : Number(e.target.value),
                      subCategoryId: "",
                    }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>
                    ))}
                  </select>
                </div>

                {filteredSubCategories.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Sub Category</label>
                    <select
                      value={form.subCategoryId}
                      onChange={(e) => setForm((prev) => ({ ...prev, subCategoryId: e.target.value === "" ? "" : Number(e.target.value) }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {filteredSubCategories.map((s) => (
                        <option key={s.subCategoryId} value={s.subCategoryId}>{s.subCategoryName}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Assignment Group</label>
                  <select
                    value={form.groupId}
                    onChange={(e) => setForm((prev) => ({ ...prev, groupId: e.target.value === "" ? "" : Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {assignmentGroups.map((g) => (
                      <option key={g.groupId} value={g.groupId}>{g.groupName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Location</label>
                  <select
                    value={form.locationId}
                    onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value === "" ? "" : Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {locationOptions.map((l) => (
                      <option key={l.locationId} value={l.locationId}>{l.locationName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Affected Asset</label>
                  <input
                    type="text"
                    value={form.affectedAsset}
                    onChange={(e) => setForm((prev) => ({ ...prev, affectedAsset: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Contact Number</label>
                  <input
                    type="text"
                    value={form.contactNumber}
                    onChange={(e) => setForm((prev) => ({ ...prev, contactNumber: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Department</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Business Service</label>
                  <input
                    type="text"
                    value={form.businessService}
                    onChange={(e) => setForm((prev) => ({ ...prev, businessService: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
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
                  <label className="text-xs font-medium text-slate-500">
                    Description {descriptionLocked && <span className="font-normal text-slate-400">(read-only for your role)</span>}
                  </label>
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    readOnly={descriptionLocked}
                    disabled={descriptionLocked}
                    className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ${descriptionLocked ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
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
              <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <DotField color={STATUS_DOT[incident.status] ?? "bg-slate-400"} label="Status" value={incident.status} />
                <DotField color={PRIORITY_DOT[incident.priority] ?? "bg-slate-400"} label="Priority" value={incident.priority} />
                <Field icon={Gauge} label="Impact" value={incident.impact ?? "—"} />
                <Field icon={Clock} label="Urgency" value={incident.urgency ?? "—"} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Category" value={
                  incident.category?.categoryId ? (
                    <Link href={`/incidents?category=${incident.category.categoryId}`} className="text-blue-600 hover:underline">
                      {incident.category.categoryName}
                    </Link>
                  ) : "—"
                } />
                <Field label="Assignment Group" value={incident.assignmentGroup?.groupName ?? "—"} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Additional Information</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field icon={Phone} label="Contact Number" value={incident.contactNumber ?? "—"} />
                  <Field icon={Mail} label="Email ID" value={incident.createdBy?.email ?? "—"} />
                  <Field icon={Building2} label="Department" value={incident.department ?? "—"} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
  // Once claimed, the response clock stops — freeze elapsed time at the
  // claim moment instead of the live clock, or the bar keeps advancing
  // (and eventually turns red/"Breached") even after the badge already
  // reads "Met" from `incident.slaResponseMet`.
  const responseClockEnd = incident.claimedAt ? new Date(incident.claimedAt) : now;
  const responseElapsed = Math.max(0, responseClockEnd.getTime() - createdAt.getTime());
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
                incident.slaResponseMet
                  ? "bg-emerald-500"
                  : responsePct >= 100 ? "bg-red-500" : responsePct >= 75 ? "bg-amber-500" : "bg-blue-500"
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
    case "urgency_change":
    case "impact_change":
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
    case "urgency_change":
      return "Urgency Updated";
    case "impact_change":
      return "Impact Updated";
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
                {act.content && (
                  <p className="mt-0.5 text-xs text-slate-600">{act.content}</p>
                )}
                <p className="mt-0.5 text-xs text-slate-400">
                  {[act.author?.fullName ? `by ${act.author.fullName}` : null, fmtDate(act.createdAt)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
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
  const { user, isAnalyst, isAdmin, isManager, isEngineer, isServiceDesk } = useAuth();
  // Engineers can edit every other incident field/option, but Description
  // stays locked in the UI (and is rejected server-side if sent anyway).
  const descriptionLocked = isEngineer && !isAdmin && !isManager && !isServiceDesk;
  const { toast } = useToast();
  const { activities, addActivity } = useIncidentActivities(incidentId);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<IncidentForm>({
    status: "", priority: "", description: "", assignedTo: "",
    impact: "", urgency: "",
    categoryId: "", subCategoryId: "", groupId: "", locationId: "",
    affectedAsset: "", businessService: "", contactNumber: "", department: "",
  });
  const { items: groups } = useAdminAssignmentGroup();
  const [claiming, setClaiming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<string[]>([]);
  const [impactOptions, setImpactOptions] = useState<string[]>([]);
  const [urgencyOptions, setUrgencyOptions] = useState<string[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [subCategories, setSubCategories] = useState<AdminSubCategory[]>([]);
  const [locationOptions, setLocationOptions] = useState<AdminLocation[]>([]);

  // Pull from the same admin-configured lists used when creating an
  // incident, so every field that's editable there is editable here too
  // (see requirement: Engineers/Analysts can edit all incident fields except
  // Description, so the edit form needs to expose all of them, not just
  // Status/Priority).
  useEffect(() => {
    apiFetch<AdminStatus[]>("/status")
      .then((s) => setStatusOptions(s.filter((x) => x.isActive && x.type === "incident").map((x) => x.statusName)))
      .catch(() => {});
    apiFetch<AdminPriority[]>("/priority")
      .then((p) => setPriorityOptions(p.filter((x) => x.isActive).map((x) => x.priorityName)))
      .catch(() => {});
    ImpactApi.list().then((i: AdminImpact[]) => setImpactOptions(i.filter((x) => x.isActive).map((x) => x.impactName))).catch(() => {});
    UrgencyApi.list().then((u: AdminUrgency[]) => setUrgencyOptions(u.filter((x) => x.isActive).map((x) => x.urgencyName))).catch(() => {});
    CategoriesApi.list().then((c: AdminCategory[]) => setCategories(c.filter((x) => x.isActive))).catch(() => {});
    SubCategoryApi.list().then((s: AdminSubCategory[]) => setSubCategories(s.filter((x) => x.isActive))).catch(() => {});
    LocationApi.list().then((l: AdminLocation[]) => setLocationOptions(l.filter((x) => x.isActive))).catch(() => {});
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

  const formFromIncident = (incidentData: Incident): IncidentForm => ({
    status: incidentData.status,
    priority: incidentData.priority,
    description: incidentData.description ?? "",
    assignedTo: incidentData.assignedTo?.userId ?? "",
    impact: incidentData.impact ?? "",
    urgency: incidentData.urgency ?? "",
    categoryId: incidentData.category?.categoryId ?? "",
    subCategoryId: incidentData.subCategory?.subCategoryId ?? "",
    groupId: incidentData.assignmentGroup?.groupId ?? "",
    locationId: incidentData.location?.locationId ?? "",
    affectedAsset: incidentData.affectedAsset ?? "",
    businessService: incidentData.businessService ?? "",
    contactNumber: incidentData.contactNumber ?? "",
    department: incidentData.department ?? "",
  });

  useEffect(() => {
    if (!incidentId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const incidentData = await IncidentsApi.getOne(incidentId);
        setIncident(incidentData);
        setForm(formFromIncident(incidentData));
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
    setForm(formFromIncident(incident));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!incidentId) return;
    setSaving(true);
    try {
      const updated = await IncidentsApi.update(incidentId, {
        status: form.status as Incident["status"],
        priority: form.priority as Incident["priority"],
        impact: form.impact || undefined,
        urgency: form.urgency || undefined,
        categoryId: form.categoryId === "" ? undefined : Number(form.categoryId),
        subCategoryId: form.subCategoryId === "" ? undefined : Number(form.subCategoryId),
        groupId: form.groupId === "" ? null : Number(form.groupId),
        locationId: form.locationId === "" ? undefined : Number(form.locationId),
        affectedAsset: form.affectedAsset,
        businessService: form.businessService,
        contactNumber: form.contactNumber,
        department: form.department,
        ...(descriptionLocked ? {} : { description: form.description }),
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
      <Breadcrumb
        items={[
          { label: "Home", href: "/home" },
          { label: (isAdmin || isAnalyst) ? "All Incidents" : "My Incidents", href: "/incidents" },
          { label: incident.incidentCode ?? `#${incident.incidentId}` },
        ]}
      />

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
            descriptionLocked={descriptionLocked}
            categories={categories}
            subCategories={subCategories}
            impactOptions={impactOptions}
            urgencyOptions={urgencyOptions}
            assignmentGroups={groups}
            locationOptions={locationOptions}
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