"use client";
import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { WorkflowStep } from "@/types/workflow";
import { Role } from "@/types/admin";

const STEP_TYPES = [
  { value: "approval", label: "Approval" },
  { value: "task", label: "Task" },
  { value: "notification", label: "Notification" },
];

interface StepBuilderProps {
  workflowId: number;
  steps: WorkflowStep[];
  roles: Role[];
  onAddStep: (
    workflowId: number,
    body: {
      stepName: string;
      stepOrder: number;
      stepType: "approval" | "task" | "notification";
      approverRoleId?: number;
    }
  ) => Promise<boolean>;
  onRemoveStep: (workflowId: number, stepId: number) => Promise<boolean>;
}

interface NewStep {
  stepName: string;
  stepType: "approval" | "task" | "notification";
  approverRoleId: number | "";
}

const emptyStep = (): NewStep => ({
  stepName: "",
  stepType: "approval",
  approverRoleId: "",
});

export function StepBuilder({
  workflowId,
  steps,
  roles,
  onAddStep,
  onRemoveStep,
}: StepBuilderProps) {
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Workflow Steps</h3>
        {!adding && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdding(true)}
            className="gap-1 h-8"
          >
            <Plus className="h-3.5 w-3.5" /> Add Step
          </Button>
        )}
      </div>

      {sorted.length === 0 && !adding && (
        <p className="text-sm text-gray-400 text-center py-6 border rounded-lg border-dashed">
          No steps yet. Click &quot;Add Step&quot; to define the approval/task flow.
        </p>
      )}

      {/* Existing steps */}
      <div className="space-y-2">
        {sorted.map((step, idx) => (
          <div
            key={step.workflowStepId}
            className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5"
          >
            <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
            <span className="text-xs font-bold text-gray-400 w-5 text-center">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-800">{step.stepName}</span>
              <span className="ml-2 text-xs text-gray-400 capitalize">({step.stepType})</span>
              {step.approverRole && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                  {step.approverRole.roleName}
                </span>
              )}
            </div>
            <button
              onClick={() => onRemoveStep(workflowId, step.workflowStepId)}
              className="text-gray-400 hover:text-red-500 shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add step form */}
      {adding && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-700">
            Step {steps.length + 1}
          </p>

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
                onChange={(e) =>
                  setNewStep((p) => ({
                    ...p,
                    stepType: e.target.value as NewStep["stepType"],
                  }))
                }
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STEP_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(newStep.stepType === "approval" || newStep.stepType === "task") && (
            <div className="space-y-1.5">
              <Label>Approver Role</Label>
              <select
                value={newStep.approverRoleId}
                onChange={(e) =>
                  setNewStep((p) => ({
                    ...p,
                    approverRoleId: e.target.value ? Number(e.target.value) : "",
                  }))
                }
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Any authenticated user —</option>
                {roles.map((r) => (
                  <option key={r.roleId} value={r.roleId}>
                    {r.roleName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAdding(false);
                setNewStep(emptyStep());
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={saving || !newStep.stepName.trim()}
              className="gap-2"
            >
              {saving && <Spinner size="sm" />}
              Add Step
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
