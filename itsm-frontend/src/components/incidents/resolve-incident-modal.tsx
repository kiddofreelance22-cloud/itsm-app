"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Incident } from "@/lib/api/incidents.api";

const RESOLUTION_CODES = [
  "Solution Provided",
  "Workaround Provided",
  "Duplicate Incident",
  "User Error",
  "Configuration Change",
  "Hardware Replaced",
  "No Fault Found",
];

const RESOLUTION_CATEGORIES = ["Resolved", "Not Reproducible", "Cancelled by User"];
const RESOLUTION_SUBCATEGORIES = ["Successful", "Partial", "Escalated then Fixed"];

export interface ResolvePayload {
  resolutionCode: string;
  resolutionNotes: string;
  additionalComments?: string;
  resolutionCategory?: string;
  resolutionSubcategory?: string;
}

export function ResolveIncidentModal({
  incident,
  open,
  onOpenChange,
  onResolve,
}: {
  incident: Incident;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (payload: ResolvePayload) => Promise<boolean>;
}) {
  const [resolutionCode, setResolutionCode] = useState(RESOLUTION_CODES[0]);
  const [resolutionCategory, setResolutionCategory] = useState(RESOLUTION_CATEGORIES[0]);
  const [resolutionSubcategory, setResolutionSubcategory] = useState(RESOLUTION_SUBCATEGORIES[0]);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [additionalComments, setAdditionalComments] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [confirmed, setConfirmed] = useState({
    solution: true,
    informed: true,
    tasks: true,
    notes: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const allConfirmed = Object.values(confirmed).every(Boolean);
  const canSubmit = resolutionCode && resolutionNotes.trim().length > 0 && allConfirmed && !submitting;

  const reset = () => {
    setResolutionNotes("");
    setAdditionalComments("");
    setInternalNotes("");
    setConfirmed({ solution: false, informed: false, tasks: false, notes: false });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const ok = await onResolve({
      resolutionCode,
      resolutionNotes: internalNotes
        ? `${resolutionNotes}\n\nInternal notes: ${internalNotes}`
        : resolutionNotes,
      additionalComments: additionalComments || undefined,
      resolutionCategory,
      resolutionSubcategory,
    });
    setSubmitting(false);
    if (ok) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Resolve Incident: {incident.incidentId}</DialogTitle>
          <DialogDescription>Provide resolution details and close the incident.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Resolution Code *</Label>
              <Select value={resolutionCode} onChange={(e) => setResolutionCode(e.target.value)}>
                {RESOLUTION_CODES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Resolution Notes *</Label>
              <Textarea
                rows={5}
                maxLength={4000}
                placeholder="Describe what was done to resolve this incident..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
              <p className="text-right text-xs text-slate-400">{resolutionNotes.length} / 4000</p>
            </div>

            <div className="space-y-1.5">
              <Label>Additional Comments (Visible to customer)</Label>
              <Textarea
                rows={3}
                maxLength={4000}
                placeholder="A short note the requester will see..."
                value={additionalComments}
                onChange={(e) => setAdditionalComments(e.target.value)}
              />
              <p className="text-right text-xs text-slate-400">{additionalComments.length} / 4000</p>
            </div>

            <div className="space-y-1.5">
              <Label>Internal Comments (Not visible to customer)</Label>
              <Textarea
                rows={3}
                maxLength={4000}
                placeholder="Root cause, actions taken, monitoring notes..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
              <p className="text-right text-xs text-slate-400">{internalNotes.length} / 4000</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Resolved By</Label>
              <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                {incident.assignedTo?.fullName ?? "Unassigned"}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Resolution Category</Label>
              <Select value={resolutionCategory} onChange={(e) => setResolutionCategory(e.target.value)}>
                {RESOLUTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Resolution Subcategory</Label>
              <Select value={resolutionSubcategory} onChange={(e) => setResolutionSubcategory(e.target.value)}>
                {RESOLUTION_SUBCATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div className="rounded-lg border border-brand-100 bg-brand-50/60 p-3">
              <p className="mb-2 text-sm font-medium text-brand-900">Please confirm before resolving</p>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={confirmed.solution}
                    onCheckedChange={(v) => setConfirmed((p) => ({ ...p, solution: v === true }))}
                    className="mt-0.5"
                  />
                  Solution has been implemented
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={confirmed.informed}
                    onCheckedChange={(v) => setConfirmed((p) => ({ ...p, informed: v === true }))}
                    className="mt-0.5"
                  />
                  Customer has been informed (if required)
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={confirmed.tasks}
                    onCheckedChange={(v) => setConfirmed((p) => ({ ...p, tasks: v === true }))}
                    className="mt-0.5"
                  />
                  Related tasks are completed
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={confirmed.notes}
                    onCheckedChange={(v) => setConfirmed((p) => ({ ...p, notes: v === true }))}
                    className="mt-0.5"
                  />
                  Work notes and resolution details are updated
                </label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? "Resolving..." : "Resolve Incident"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
