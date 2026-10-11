"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageSpinner } from "@/components/ui/spinner";
import { WorkflowEditor } from "@/components/admin/workflow-editor";
import { useAdminRoles, useAdminWorkflows } from "@/lib/hooks/use-admin";
import { useAdminAssignmentGroup } from "@/lib/hooks/use-admin-modules";
import { useEffect, useState } from "react";
import { ApprovalLevelInput, Workflow } from "@/types/workflow";
import { WorkflowsApi } from "@/lib/api/workflows.api";

export default function AdminWorkflowDetailPage() {
  const params = useParams();
  const workflowId = Number(params.workflowId);
  const { addStep, removeStep, updateStep, reorderStep, updateTransitions } = useAdminWorkflows();
  const { roles } = useAdminRoles();
  const { items: assignmentGroups } = useAdminAssignmentGroup();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try { setWorkflow(await WorkflowsApi.getOne(workflowId)); }
    catch { /* handled by component */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, [workflowId]);

  const handleAddStep: typeof addStep = async (id, body) => {
    const ok = await addStep(id, body);
    if (ok) await load();
    return ok;
  };

  const handleRemoveStep = async (id: number, stepId: number) => {
    const ok = await removeStep(id, stepId);
    if (ok) await load();
    return ok;
  };

  const handleUpdateStep = async (id: number, stepId: number, body: { stepName?: string; conditionExpression?: string; approverRoleId?: number | null; approvalLevels?: ApprovalLevelInput[] }) => {
    const ok = await updateStep(id, stepId, body);
    if (ok) await load();
    return ok;
  };

  const handleReorderStep = async (id: number, stepId: number, newOrder: number) => {
    const ok = await reorderStep(id, stepId, { newOrder });
    if (ok) await load();
    return ok;
  };

  if (isLoading) return <PageSpinner />;
  if (!workflow) return <p className="p-8 text-slate-500">Workflow not found.</p>;

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <Breadcrumb items={[
          { label: "Home", href: "/home" },
          { label: "Admin" },
          { label: "Workflows", href: "/admin/workflows" },
          { label: workflow.workflowName },
        ]} />
      </div>

      <WorkflowEditor
        workflowId={workflowId}
        workflowName={workflow.workflowName}
        steps={workflow.steps}
        transitions={workflow.transitions}
        roles={roles}
        assignmentGroups={assignmentGroups}
        onAddStep={handleAddStep}
        onRemoveStep={handleRemoveStep}
        onUpdateStep={handleUpdateStep}
        onSaveApprovalLevels={(stepId, levels) => WorkflowsApi.replaceApprovalLevels(workflowId, stepId, levels)}
        onSave={async () => {
          const saved = await WorkflowsApi.update(workflowId, { workflowName: workflow.workflowName });
          if (saved) await load();
          return !!saved;
        }}
        onReorderStep={handleReorderStep}
        onUpdateTransitions={async (id, stepId, body) => {
          const ok = await updateTransitions(id, stepId, body);
          if (ok) await load();
          return ok;
        }}
      />
    </div>
  );
}
