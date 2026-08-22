"use client";
import { useState } from "react";
import { Plus, Trash2, CheckCircle2, ListChecks, Bell, Info, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { WorkflowStep } from "@/types/workflow";
import { Role } from "@/types/admin";

const STEP_TYPES = [
  { value: "approval", label: "Approval", Icon: CheckCircle2, classes: "bg-violet-50 border-violet-200 text-violet-700" },
  { value: "task", label: "Task", Icon: ListChecks, classes: "bg-blue-50 border-blue-200 text-blue-700" },
  { value: "notification", label: "Notification", Icon: Bell, classes: "bg-amber-50 border-amber-200 text-amber-700" },
] as const;

interface WorkflowFlowDiagramProps {
  workflowId: number;
  steps: WorkflowStep[];
  roles: Role[];
  onAddStep: (
    workflowId: number,
    body: { stepName: string; stepOrder: number; stepType: "approval" | "task" | "notification"; approverRoleId?: number }
  ) => Promise<boolean>;
  onRemoveStep: (workflowId: number, stepId: number) => Promise<boolean>;
}

interface NewStep {
  stepName: string;
  stepType: "approval" | "task" | "notification";
  approverRoleId: number | "";
}

const emptyStep = (): NewStep => ({ stepName: "", stepType: "approval", approverRoleId: "" });

function Connector() {
  return (
    <div className="flex justify-center">
      <div className="h-6 w-0.5 bg-slate-200" />
    </div>
  );
}

function PillNode({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: string }) {
  return (
    <div className="flex justify-center">
      <div className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold", tone)}>
        {icon} {label}
      </div>
    </div>
  );
}

export function WorkflowFlowDiagram({ workflowId, steps, roles, onAddStep, onRemoveStep }: WorkflowFlowDiagramProps) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newStep, setNewStep] = useState<NewStep>(emptyStep());

  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  const handleAdd = async () => {
    if (!newStep.stepName.trim()) return;
    setSaving(true);
    const ok = await onAddStep(workflowId, {
      stepName: newStep.stepName,
      stepOrder: steps.length + 1,
      stepType: newStep.stepType,
      approverRoleId: newStep.approverRoleId ? Number(newStep.approverRoleId) : undefined,
    });
    setSaving(false);
    if (ok) {
      setAdding(false);
      setNewStep(emptyStep());
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Steps run in this order, top to bottom. Branching, drag-to-reorder, and editing an existing step
          aren&apos;t supported by the API yet — only adding a step to the end or deleting one.
        </p>
      </div>

      <div className="mx-auto max-w-md">
        <PillNode icon={<Play className="size-3" />} label="Start" tone="bg-green-100 text-green-700" />
        <Connector />

        {sorted.length === 0 && !adding && (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-gray-400">
            No steps yet. Add one below to define the approval/task flow.
          </p>
        )}

        {sorted.map((step, idx) => {
          const meta = STEP_TYPES.find((t) => t.value === step.stepType) ?? STEP_TYPES[1];
          const Icon = meta.Icon;
          return (
            <div key={step.workflowStepId}>
              <div className={cn("group relative rounded-xl border-2 bg-white px-4 py-3 shadow-sm", meta.classes.split(" ")[1])}>
                <div className="flex items-start gap-3">
                  <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", meta.classes)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Step {idx + 1} · {meta.label}
                    </p>
                    <p className="text-sm font-semibold text-slate-800">{step.stepName}</p>
                    {step.approverRole && (
                      <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {step.approverRole.roleName}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveStep(workflowId, step.workflowStepId)}
                    className="shrink-0 text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                    aria-label={`Remove ${step.stepName}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <Connector />
            </div>
          );
        })}

        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-medium text-slate-400 hover:border-brand-300 hover:text-brand-600"
          >
            <Plus className="size-4" /> Add Step
          </button>
        ) : (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-700">Step {steps.length + 1}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Step Name *</Label>
                <Input
                  autoFocus
                  value={newStep.stepName}
                  onChange={(e) => setNewStep((p) => ({ ...p, stepName: e.target.value }))}
                  placeholder="e.g. Manager Approval"
                  className="bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Step Type</Label>
                <select
                  value={newStep.stepType}
                  onChange={(e) => setNewStep((p) => ({ ...p, stepType: e.target.value as NewStep["stepType"] }))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STEP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {(newStep.stepType === "approval" || newStep.stepType === "task") && (
              <div className="space-y-1.5">
                <Label>Approver Role</Label>
                <select
                  value={newStep.approverRoleId}
                  onChange={(e) => setNewStep((p) => ({ ...p, approverRoleId: e.target.value ? Number(e.target.value) : "" }))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Any authenticated user —</option>
                  {roles.map((r) => (
                    <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => { setAdding(false); setNewStep(emptyStep()); }} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleAdd} disabled={saving || !newStep.stepName.trim()} className="gap-2">
                {saving && <Spinner size="sm" />}
                Add Step
              </Button>
            </div>
          </div>
        )}

        {sorted.length > 0 && (
          <>
            <Connector />
            <PillNode icon={<Square className="size-2.5" />} label="End" tone="bg-red-100 text-red-700" />
          </>
        )}
      </div>
    </div>
  );
}
