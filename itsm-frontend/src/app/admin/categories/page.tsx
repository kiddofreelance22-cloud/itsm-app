"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, Column } from "@/components/admin/data-table";
import { CategoryFormDialog } from "@/components/admin/category-form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdminCategories } from "@/lib/hooks/use-admin";
import { Category } from "@/types/admin";

export default function AdminCategoriesPage() {
  const { categories, isLoading, create, update, remove } = useAdminCategories();
  const [dialog, setDialog] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  // Flatten tree for table display
  const flat: Category[] = [];
  const flatten = (cats: Category[], depth = 0) => {
    for (const c of cats) {
      flat.push({ ...c, categoryName: "　".repeat(depth) + c.categoryName });
      if (c.children?.length) flatten(c.children, depth + 1);
    }
  };
  flatten(categories);

  const columns: Column<Category>[] = [
    { key: "categoryName", label: "Name", sortable: true,
      render: (c) => <span className="font-medium">{c.categoryName}</span> },
    { key: "parent", label: "Parent",
      render: (c) => <span className="text-slate-500">{c.parent?.categoryName ?? "—"}</span> },
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
          <button onClick={() => { setEditCat(c); setDialog(true); }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600">
            <Pencil className="size-3.5" />
          </button>
          <button onClick={() => setDeleteCat(c)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Categories" }]} />
      <PageHeader title="Categories" description="Organize catalog items and incidents into categories."
        action={
          <Button onClick={() => { setEditCat(null); setDialog(true); }} className="gap-1.5">
            <Plus className="size-4" /> Add Category
          </Button>
        }
      />
      <DataTable columns={columns} data={flat} isLoading={isLoading}
        rowKey={(c) => c.categoryId} searchKeys={["categoryName"]} searchPlaceholder="Search categories..." />

      <CategoryFormDialog
        open={dialog} category={editCat} categories={flat} isLoading={saving}
        onSubmit={async (data) => {
          setSaving(true);
          const ok = editCat ? await update(editCat.categoryId, data) : await create(data);
          setSaving(false);
          return !!ok;
        }}
        onClose={() => { setDialog(false); setEditCat(null); }}
      />

      <ConfirmDialog open={!!deleteCat} title={`Delete "${deleteCat?.categoryName}"?`}
        description="Sub-categories will lose their parent reference."
        confirmLabel="Delete" variant="danger"
        onConfirm={async () => { if (deleteCat) { await remove(deleteCat.categoryId); setDeleteCat(null); } }}
        onCancel={() => setDeleteCat(null)} />
    </div>
  );
}
