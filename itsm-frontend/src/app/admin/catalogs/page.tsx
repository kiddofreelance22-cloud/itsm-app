"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, Column } from "@/components/admin/data-table";
import { CatalogFormDialog } from "@/components/admin/catalog-form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCatalogs } from "@/lib/hooks/use-catalogs";
import { useAdminCategories, useAdminWorkflows } from "@/lib/hooks/use-admin";
import { Catalog } from "@/types/catalog";

export default function AdminCatalogsPage() {
  const { catalogs, isLoading, create, update, remove } = useCatalogs("all");
  const { categories } = useAdminCategories();
  const { workflows } = useAdminWorkflows();
  const [dialog, setDialog] = useState(false);
  const [editCatalog, setEditCatalog] = useState<Catalog | null>(null);
  const [deleteCatalog, setDeleteCatalog] = useState<Catalog | null>(null);
  const [saving, setSaving] = useState(false);

  const columns: Column<Catalog>[] = [
    { key: "catalogName", label: "Name", sortable: true,
      render: (c) => <span className="font-medium">{c.catalogName}</span> },
    { key: "category", label: "Category",
      render: (c) => <span className="text-slate-500">{c.category?.categoryName ?? "Uncategorized"}</span> },
    { key: "workflow", label: "Workflow",
      render: (c) => <span className="text-slate-500">{c.workflow?.workflowName ?? "None"}</span> },
    { key: "isActive", label: "Status",
      render: (c) => (
        <span className={`text-xs rounded-full px-2 py-0.5 ${c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {c.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    { key: "actions", label: "",
      render: (c) => (
        <div className="flex gap-1">
          <Link href={`/admin/catalogs/${c.catalogId}`}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600" title="Edit fields">
            <Eye className="size-3.5" />
          </Link>
          <button onClick={() => { setEditCatalog(c); setDialog(true); }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600">
            <Pencil className="size-3.5" />
          </button>
          <button onClick={() => setDeleteCatalog(c)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Catalogs" }]} />
      <PageHeader title="Catalog Items" description="Manage service catalog items and their form fields."
        action={
          <Button onClick={() => { setEditCatalog(null); setDialog(true); }} className="gap-1.5">
            <Plus className="size-4" /> Add Catalog Item
          </Button>
        }
      />
      <DataTable columns={columns} data={catalogs} isLoading={isLoading}
        rowKey={(c) => c.catalogId} searchKeys={["catalogName"]} searchPlaceholder="Search catalog..." />

      <CatalogFormDialog
        open={dialog} catalog={editCatalog}
        categories={categories} workflows={workflows} isLoading={saving}
        onSubmit={async (data) => {
          setSaving(true);
          const ok = editCatalog ? await update(editCatalog.catalogId, data) : await create(data);
          setSaving(false);
          return !!ok;
        }}
        onClose={() => { setDialog(false); setEditCatalog(null); }}
      />

      <ConfirmDialog open={!!deleteCatalog} title={`Delete "${deleteCatalog?.catalogName}"?`}
        description="This will remove the catalog item and all its form fields."
        confirmLabel="Delete" variant="danger"
        onConfirm={async () => { if (deleteCatalog) { await remove(deleteCatalog.catalogId); setDeleteCatalog(null); } }}
        onCancel={() => setDeleteCatalog(null)} />
    </div>
  );
}
