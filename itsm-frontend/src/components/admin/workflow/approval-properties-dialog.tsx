"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssignmentGroup, Role } from "@/types/admin";
import type { ApprovalLevel, ApprovalLevelInput } from "@/types/workflow";

interface ApprovalPropertiesDialogProps {
  open: boolean;
  stepName: string;
  approvalLevels: ApprovalLevel[];
  roles: Role[];
  assignmentGroups: AssignmentGroup[];
  onSave: (levels: ApprovalLevelInput[]) => Promise<ApprovalLevel[]>;
  onClose: () => void;
}

function newLevel(levelNumber: number): ApprovalLevelInput {
  return {
    levelNumber,
    title: `Approval Level ${levelNumber}`,
    approverType: "role",
    autoApproval: false,
    emailNotificationsForEndUser: false,
    referBackToRequestor: true,
    referBackToPreviousApprovers: true,
  };
}

function toInput(level: ApprovalLevel): ApprovalLevelInput {
  return {
    approvalLevelId: level.approvalLevelId,
    levelNumber: level.levelNumber,
    title: level.title,
    approverType: level.approverType,
    approverId: level.approverId,
    autoApproval: level.autoApproval,
    emailNotificationsForEndUser: level.emailNotificationsForEndUser,
    referBackToRequestor: level.referBackToRequestor,
    referBackToPreviousApprovers: level.referBackToPreviousApprovers,
    customGroupId: level.customGroupId ?? level.customGroup?.groupId,
  };
}

function ToggleField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="mt-0.5" />
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer text-[13px] font-medium text-slate-700">{label}</Label>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

export function ApprovalPropertiesDialog({
  open,
  stepName,
  approvalLevels,
  roles,
  assignmentGroups,
  onSave,
  onClose,
}: ApprovalPropertiesDialogProps) {
  const [levels, setLevels] = useState<ApprovalLevelInput[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLevels(approvalLevels.length ? approvalLevels.map(toInput) : [newLevel(1)]);
    setActiveIndex(0);
    setError("");
  }, [open, approvalLevels]);

  const activeLevel = levels[activeIndex];
  const updateActive = (patch: Partial<ApprovalLevelInput>) => {
    setLevels((current) => current.map((level, index) => index === activeIndex ? { ...level, ...patch } : level));
    setError("");
  };

  const addLevel = () => {
    const next = [...levels, newLevel(levels.length + 1)];
    setLevels(next);
    setActiveIndex(next.length - 1);
    setError("");
  };

  const removeActiveLevel = () => {
    const next = levels.filter((_, index) => index !== activeIndex).map((level, index) => ({ ...level, levelNumber: index + 1 }));
    setLevels(next);
    setActiveIndex(Math.max(0, activeIndex - 1));
    setError("");
  };

  const save = async (closeAfterSave: boolean) => {
    if (!levels.length) {
      setError("Add at least one approval level.");
      return;
    }
    if (levels.some((level) => !level.title.trim() || !level.approverId)) {
      setError("Each approval level needs a title and an approver.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await onSave(levels.map((level, index) => ({ ...level, title: level.title.trim(), levelNumber: index + 1 })));
      setLevels(saved.map(toInput));
      if (closeAfterSave) onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save approval settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="mb-0 border-b border-slate-200 px-6 py-4 pr-14">
          <DialogTitle className="text-base">Approval properties</DialogTitle>
          <DialogDescription>Configure approval levels for {stepName || "this workflow step"}.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 grid-cols-1 overflow-y-auto md:max-h-[65vh] md:grid-cols-[240px_minmax(0,1fr)] md:overflow-hidden">
          <aside className="border-b border-slate-200 bg-slate-50 p-4 md:overflow-y-auto md:border-b-0 md:border-r">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Approval levels</h3>
                <p className="mt-1 text-xs text-slate-500">{levels.length} level{levels.length === 1 ? "" : "s"}</p>
              </div>
              <Button type="button" variant="secondary" size="icon" onClick={addLevel} aria-label="Add approval level" title="Add approval level">
                <Plus />
              </Button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
              {levels.map((level, index) => (
                <button
                  key={level.approvalLevelId ?? `new-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-pressed={activeIndex === index}
                  className={`min-w-40 rounded-[7px] border px-3 py-2.5 text-left transition-colors md:min-w-0 ${activeIndex === index ? "border-brand-500 bg-brand-100 text-brand-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-70">Level {index + 1}</span>
                  <span className="mt-1 block truncate text-sm font-medium">{level.title || "Untitled approval"}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
            {activeLevel ? (
              <div className="mx-auto max-w-2xl space-y-5">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Level {activeIndex + 1}</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-900">Approver settings</h3>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={removeActiveLevel} aria-label="Remove approval level" title="Remove approval level">
                    <Trash2 className="text-slate-500" />
                  </Button>
                </div>

                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-[minmax(130px,0.8fr)_minmax(0,1.2fr)] sm:items-start">
                  <Label htmlFor="approval-level-title" className="pt-2 text-[13px] font-medium text-slate-700">Title <span className="text-red-600">*</span></Label>
                  <Input id="approval-level-title" value={activeLevel.title} onChange={(event) => updateActive({ title: event.target.value })} placeholder="e.g. Manager approval" />

                  <Label htmlFor="approval-level-approver" className="pt-2 text-[13px] font-medium text-slate-700">Approver <span className="text-red-600">*</span></Label>
                  <select
                    id="approval-level-approver"
                    value={activeLevel.approverId ?? ""}
                    onChange={(event) => updateActive({ approverType: "role", approverId: event.target.value ? Number(event.target.value) : undefined })}
                    className="h-9 w-full rounded-[7px] border border-slate-300 bg-white px-3 text-[13px] text-slate-700 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">Select a role</option>
                    {roles.filter((role) => role.isActive).map((role) => <option key={role.roleId} value={role.roleId}>{role.roleName}</option>)}
                  </select>

                  <div className="sm:col-span-2 divide-y divide-slate-100 border-y border-slate-100">
                    <ToggleField
                      id="approval-auto"
                      label="Auto approve"
                      description="Automatically approve this level when its conditions are met."
                      checked={activeLevel.autoApproval}
                      onCheckedChange={(autoApproval) => updateActive({ autoApproval })}
                    />
                    <ToggleField
                      id="approval-email-end-user"
                      label="E-mail notifications for end user"
                      description="Notify the requester when this approval level changes."
                      checked={activeLevel.emailNotificationsForEndUser}
                      onCheckedChange={(emailNotificationsForEndUser) => updateActive({ emailNotificationsForEndUser })}
                    />
                    <ToggleField
                      id="approval-refer-requestor"
                      label="Refer back to requestor"
                      checked={activeLevel.referBackToRequestor}
                      onCheckedChange={(referBackToRequestor) => updateActive({ referBackToRequestor })}
                    />
                    <ToggleField
                      id="approval-refer-previous"
                      label="Refer back to previous approvers"
                      checked={activeLevel.referBackToPreviousApprovers}
                      onCheckedChange={(referBackToPreviousApprovers) => updateActive({ referBackToPreviousApprovers })}
                    />
                  </div>

                  <Label htmlFor="approval-custom-group" className="pt-2 text-[13px] font-medium text-slate-700">Custom group</Label>
                  <select
                    id="approval-custom-group"
                    value={activeLevel.customGroupId ?? ""}
                    onChange={(event) => updateActive({ customGroupId: event.target.value ? Number(event.target.value) : undefined })}
                    className="h-9 w-full rounded-[7px] border border-slate-300 bg-white px-3 text-[13px] text-slate-700 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">Select a group</option>
                    {assignmentGroups.filter((group) => group.isActive).map((group) => <option key={group.groupId} value={group.groupId}>{group.groupName}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex min-h-48 items-center justify-center text-center">
                <div>
                  <p className="text-sm font-medium text-slate-700">No approval levels</p>
                  <p className="mt-1 text-xs text-slate-500">Add a level to configure its approver.</p>
                </div>
              </div>
            )}
            {error && <p role="alert" className="mt-4 rounded-[7px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="secondary" onClick={() => void save(false)} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" onClick={() => void save(true)} disabled={saving}>{saving ? "Saving..." : "Save and close"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}