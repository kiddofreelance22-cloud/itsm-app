"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, Column } from "@/components/admin/data-table";
import { DepartmentFormDialog } from "@/components/admin/department-form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDepartments } from "@/lib/hooks/use-departments";
import { Department } from "@/lib/api/departments.api";

export default function AdminDepartmentsPage() {
  const { departments, isLoading, create, update, remove } = useDepartments();
  const [dialog, setDialog] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);

  const columns: Column<Department>[] = [
    { key: "departmentName", label: "Name", sortable: true,
      render: (d) => <span className="font-medium">{d.departmentName}</span> },
    { key: "departmentCode", label: "Code", sortable: true,
      render: (d) => <span className="text-slate-500">{d.departmentCode}</span> },
    { key: "description", label: "Description",
      render: (d) => <span className="text-slate-400 text-sm">{d.description || '-'}</span> },
    { key: "isActive", label: "Status",
      render: (d) => (
        <span className={`text-xs rounded-full px-2 py-0.5 ${d.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {d.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    { key: "actions", label: "",
      render: (d) => (
        <div className="flex gap-1">
          <button onClick={() => { setEditDept(d); setDialog(true); }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600" title="Edit department">
            <Pencil className="size-3.5" />
          </button>
          <button onClick={() => setDeleteDept(d)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600" title="Delete department">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const handleDelete = async () => {
    if (!deleteDept) return;
    const success = await remove(deleteDept.departmentId);
    if (success) {
      setDeleteDept(null);
    }
  };

  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Departments" }]} />
      <PageHeader title="Departments" description="Manage organizational departments for user assignments."
        action={
          <Button onClick={() => { setEditDept(null); setDialog(true); }} className="gap-1.5">
            <Plus className="size-4" /> Add Department
          </Button>
        }
      />
      <DataTable columns={columns} data={departments} isLoading={isLoading}
        rowKey={(d) => d.departmentId} searchKeys={["departmentName", "departmentCode"]} searchPlaceholder="Search departments..." />

      <DepartmentFormDialog
        open={dialog} department={editDept} isLoading={saving}
        onSubmit={async (data) => {
          setSaving(true);
          const ok = editDept ? await update(editDept.departmentId, data) : !!(await create(data));
          setSaving(false);
          return !!ok;
        }}
        onClose={() => { setDialog(false); setEditDept(null); }}
      />

      <ConfirmDialog
        open={!!deleteDept}
        title="Delete Department"
        description={`Are you sure you want to delete "${deleteDept?.departmentName}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDept(null)}
      />
    </div>
  );
}
