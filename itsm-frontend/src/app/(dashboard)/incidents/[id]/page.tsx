"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner, PageSpinner } from "@/components/ui/spinner";
import { useIncident, useIncidents } from "@/lib/hooks/use-incidents";
import { useAuth } from "@/lib/hooks/use-auth";

const STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;
const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

function priorityColor(p: string) {
  return p === "Critical" ? "bg-red-100 text-red-700"
    : p === "High" ? "bg-orange-100 text-orange-700"
    : p === "Medium" ? "bg-yellow-100 text-yellow-700"
    : "bg-slate-100 text-slate-600";
}
function statusColor(s: string) {
  return s === "Open" ? "bg-red-100 text-red-700"
    : s === "In Progress" ? "bg-yellow-100 text-yellow-700"
    : s === "Resolved" ? "bg-green-100 text-green-700"
    : "bg-slate-100 text-slate-500";
}

export default function IncidentDetailPage() {
  const params = useParams();
  const { isAdmin } = useAuth();
  const id = params.id as string;
  const { incident, isLoading, error } = useIncident(id);
  const { update } = useIncidents();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ status: string; priority: string; description: string }>({
    status: "", priority: "", description: "",
  });

  const startEdit = () => {
    if (!incident) return;
    setForm({ status: incident.status, priority: incident.priority, description: incident.description ?? "" });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await update(id, { status: form.status as typeof STATUSES[number], priority: form.priority as typeof PRIORITIES[number], description: form.description });
    setSaving(false);
    setEditing(false);
  };

  if (isLoading) return <PageSpinner />;
  if (error || !incident) return <p className="p-8 text-slate-500">Incident not found.</p>;

  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumb items={[
        { label: "Home", href: "/home" },
        { label: "My Incidents", href: "/incidents" },
        { label: `#${incident.incidentId}` },
      ]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm text-slate-400">#{incident.incidentId}</span>
            <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${statusColor(incident.status)}`}>{incident.status}</span>
            <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${priorityColor(incident.priority)}`}>{incident.priority}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{incident.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Raised by {incident.createdBy.fullName} · {new Date(incident.createdAt).toLocaleString()}
          </p>
        </div>
        {(isAdmin || true) && !editing && (
          <Button variant="secondary" size="sm" onClick={startEdit}>Edit</Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Details card */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Details</h2>
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Priority</Label>
                      <Select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
                        {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea rows={4} value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                      {saving && <Spinner size="sm" />} Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-xs text-slate-400">Category</p><p className="font-medium">{incident.category?.categoryName ?? "—"}</p></div>
                    <div><p className="text-xs text-slate-400">Assigned To</p><p className="font-medium">{incident.assignedTo?.fullName ?? "Unassigned"}</p></div>
                  </div>
                  {incident.description && (
                    <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 leading-relaxed">
                      {incident.description}
                    </div>
                  )}
                  {incident.request && (
                    <p className="text-xs text-slate-400">
                      Linked request: <span className="font-medium text-blue-600">#{incident.request.requestId}</span>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Info</h3>
              <InfoRow label="Created" value={new Date(incident.createdAt).toLocaleDateString()} />
              {incident.resolvedAt && <InfoRow label="Resolved" value={new Date(incident.resolvedAt).toLocaleDateString()} />}
              <InfoRow label="Reported by" value={incident.createdBy.fullName} />
              <InfoRow label="Priority" value={incident.priority} />
              <InfoRow label="Status" value={incident.status} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
