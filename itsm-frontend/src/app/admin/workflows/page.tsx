"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Eye, Trash2 } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, Column } from "@/components/admin/data-table";
import { WorkflowFormDialog } from "@/components/admin/workflow-form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdminWorkflows } from "@/lib/hooks/use-admin";
import { Workflow } from "@/types/workflow";

export default function AdminWorkflowsPage() {
  const { workflows, isLoading, create, update } = useAdminWorkflows();
  const [dialog, setDialog] = useState(false);
  const [editWf, setEditWf] = useState<Workflow | null>(null);
  const [saving, setSaving] = useState(false);

  const columns: Column<Workflow>[] = [
    { key: "workflowName", label: "Name", sortable: true,
      render: (w) => <span className="font-medium">{w.workflowName}</span> },
    { key: "steps", label: "Steps",
      render: (w) => (
        <span className="text-slate-500">{w.steps?.length ?? 0} step{w.steps?.length !== 1 ? "s" : ""}</span>
      ),
    },
    { key: "isActive", label: "Status",
      render: (w) => (
        <span className={`text-xs rounded-full px-2 py-0.5 ${w.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {w.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    { key: "actions", label: "",
      render: (w) => (
        <div className="flex gap-1">
          <Link href={`/admin/workflows/${w.workflowId}`}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600" title="Edit steps">
            <Eye className="size-3.5" />
          </Link>
          <button onClick={() => { setEditWf(w); setDialog(true); }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600">
            <Pencil className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Workflows" }]} />
      <PageHeader title="Workflows" description="Define approval and task flows for service requests."
        action={
          <Button onClick={() => { setEditWf(null); setDialog(true); }} className="gap-1.5">
            <Plus className="size-4" /> Add Workflow
          </Button>
        }
      />
      <DataTable columns={columns} data={workflows} isLoading={isLoading}
        rowKey={(w) => w.workflowId} searchKeys={["workflowName"]} searchPlaceholder="Search workflows..." />

      <WorkflowFormDialog
        open={dialog} workflow={editWf} isLoading={saving}
        onSubmit={async (data) => {
          setSaving(true);
          const ok = editWf ? await update(editWf.workflowId, data) : !!(await create(data));
          setSaving(false);
          return !!ok;
        }}
        onClose={() => { setDialog(false); setEditWf(null); }}
      />
    </div>
  );
}
