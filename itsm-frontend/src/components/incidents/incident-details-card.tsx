"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, FileText, Download, Eye } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/components/incidents/priority-badge";
import { Incident } from "@/types/incident";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

export function IncidentDetailsCard({ incident }: { incident: Incident }) {
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <CardTitle>Incident Details</CardTitle>
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Collapse incident details" : "Expand incident details"}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
        >
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </CardHeader>

      {open && (
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Field
              label="Status"
              value={
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-600" />
                  {incident.status}
                </span>
              }
            />
            <Field label="Priority" value={<PriorityBadge priority={incident.priority} />} />
            <Field label="Impact" value={incident.impact} />
            <Field label="Urgency" value={incident.urgency} />
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
            <Field label="Category" value={incident.category} />
            <Field label="Sub Category" value={incident.subCategory} />
            <Field label="Assignment Group" value={incident.assignmentGroup} />
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
            <Field label="Assigned To" value={incident.assignedTo} />
            <Field label="Location" value={incident.location} />
            <Field label="Affected Asset" value={incident.affectedAsset} />
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Description</p>
            <p className="mt-1.5 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {incident.description}
            </p>
          </div>

          {incident.attachments.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Attachments ({incident.attachments.length})
              </p>
              <ul className="mt-1.5 flex flex-col gap-2">
                {incident.attachments.map((a) => (
                  <li
                    key={a.name}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm text-slate-700">
                      <FileText className="size-4 text-slate-400" />
                      <span>
                        <span className="block font-medium">{a.name}</span>
                        <span className="block text-xs text-slate-400">{a.size}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label={`Download ${a.name}`}
                      >
                        <Download className="size-4" />
                      </button>
                      <button
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label={`Preview ${a.name}`}
                      >
                        <Eye className="size-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              Additional Information
            </p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
              <Field label="Contact Number" value={incident.contactNumber} />
              <Field label="Email ID" value={incident.emailId} />
              <Field label="Department" value={incident.department} />
              <Field label="Business Service" value={incident.businessService} />
              <Field
                label="SLA"
                value={`Response in ${incident.sla.respondedIn ?? "-"}, Resolve in ${incident.sla.timeElapsed.split("/")[1]?.trim() ?? "-"}`}
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
