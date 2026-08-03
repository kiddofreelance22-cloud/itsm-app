"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/spinner";
import { StepBuilder } from "@/components/admin/step-builder";
import { useAdminWorkflows, useAdminRoles } from "@/lib/hooks/use-admin";
import { useEffect, useState } from "react";
import { Workflow } from "@/types/workflow";
import { WorkflowsApi } from "@/lib/api/workflows.api";

export default function AdminWorkflowDetailPage() {
  const params = useParams();
  const workflowId = Number(params.workflowId);
  const { addStep, removeStep } = useAdminWorkflows();
  const { roles } = useAdminRoles();
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

  if (isLoading) return <PageSpinner />;
  if (!workflow) return <p className="p-8 text-slate-500">Workflow not found.</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb items={[
        { label: "Home", href: "/home" },
        { label: "Admin" },
        { label: "Workflows", href: "/admin/workflows" },
        { label: workflow.workflowName },
      ]} />

      <Link href="/admin/workflows"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Back to workflows
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">{workflow.workflowName}</h1>
        {workflow.description && (
          <p className="text-sm text-slate-500 mt-0.5">{workflow.description}</p>
        )}
      </div>

      <Card>
        <CardContent className="pt-5">
          <StepBuilder
            workflowId={workflowId}
            steps={workflow.steps}
            roles={roles}
            onAddStep={handleAddStep}
            onRemoveStep={handleRemoveStep}
          />
        </CardContent>
      </Card>
    </div>
  );
}
