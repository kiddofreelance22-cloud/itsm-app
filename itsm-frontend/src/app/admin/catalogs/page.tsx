"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, Column } from "@/components/admin/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCatalogs } from "@/lib/hooks/use-catalogs";
import { Catalog } from "@/types/catalog";

// "+ Add Catalog Item" and the row edit action both go straight to the full
// Catalog Item editor (/admin/catalogs/create and /admin/catalogs/[id]) —
// the tabbed editor with Item Details/Variables/Workflow/etc. There used to
// be a second, separate quick-create dialog (CatalogFormDialog) wired to
// this page that only exposed a handful of fields; it's been removed so
// there's one consistent place to create and edit a catalog item instead of
// two different UIs doing overlapping things.
export default function AdminCatalogsPage() {
  const { catalogs, isLoading, remove } = useCatalogs("all");
  const [deleteCatalog, setDeleteCatalog] = useState<Catalog | null>(null);

  const columns: Column<Catalog>[] = [
    { key: "catalogName", label: "Catalog Name", sortable: true,
      render: (c) => <span className="font-medium">{c.catalogName}</span> },
    { key: "serviceCategory", label: "Category",
      render: (c) => <span className="text-slate-500">{c.serviceCategory?.categoryName ?? c.category?.categoryName ?? "Uncategorized"}</span> },
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
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600" title="Edit catalog item">
            <Pencil className="size-3.5" />
          </Link>
          <button onClick={() => setDeleteCatalog(c)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600" title="Delete">
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
          <Link href="/admin/catalogs/create">
            <Button className="gap-1.5">
              <Plus className="size-4" /> Add Catalog Item
            </Button>
          </Link>
        }
      />
      <DataTable columns={columns} data={catalogs} isLoading={isLoading}
        rowKey={(c) => c.catalogId} searchKeys={["catalogName"]} searchPlaceholder="Search catalog..." />

      <ConfirmDialog open={!!deleteCatalog} title={`Delete "${deleteCatalog?.catalogName}"?`}
        description="This will remove the catalog item and all its form fields."
        confirmLabel="Delete" variant="danger"
        onConfirm={async () => { if (deleteCatalog) { await remove(deleteCatalog.catalogId); setDeleteCatalog(null); } }}
        onCancel={() => setDeleteCatalog(null)} />
    </div>
  );
}
