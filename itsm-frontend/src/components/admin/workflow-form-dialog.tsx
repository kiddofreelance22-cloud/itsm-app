"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Workflow } from "@/types/workflow";

interface WorkflowFormDialogProps {
  open: boolean;
  workflow?: Workflow | null;
  isLoading?: boolean;
  onSubmit: (data: {
    workflowName: string;
    description?: string;
    isActive?: boolean;
  }) => Promise<boolean>;
  onClose: () => void;
}

export function WorkflowFormDialog({
  open, workflow, isLoading = false, onSubmit, onClose,
}: WorkflowFormDialogProps) {
  const isEdit = !!workflow;
  const [form, setForm] = useState({
    workflowName: "", description: "", isActive: true,
  });

  useEffect(() => {
    if (workflow) {
      setForm({
        workflowName: workflow.workflowName,
        description: workflow.description ?? "",
        isActive: workflow.isActive,
      });
    } else {
      setForm({ workflowName: "", description: "", isActive: true });
    }
  }, [workflow, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onSubmit({
      workflowName: form.workflowName,
      description: form.description || undefined,
      isActive: form.isActive,
    });
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Workflow" : "Create Workflow"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Workflow Name *</Label>
            <Input
              value={form.workflowName}
              onChange={(e) => setForm((p) => ({ ...p, workflowName: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="wf-active"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="accent-blue-600"
            />
            <label htmlFor="wf-active" className="text-sm text-gray-700 cursor-pointer">
              Active
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading && <Spinner size="sm" />}
              {isEdit ? "Save Changes" : "Create Workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
