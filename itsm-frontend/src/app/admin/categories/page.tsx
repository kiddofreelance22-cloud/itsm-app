"use client";

import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { CategoryFormPanel } from "@/components/admin/category-form-panel";
import { CategoryTree } from "@/components/admin/category-tree";
import { CategoryDeleteDialog } from "@/components/admin/category-delete-dialog";
import { useAdminCategories } from "@/lib/hooks/use-admin";
import { CategoryDeletePolicy } from "@/lib/api/categories.api";
import { Category } from "@/types/admin";

// Flatten the tree (parent-first, indented) — used only to populate the
// "Parent Category" dropdown inside the form panel; the page itself
// renders the real nested tree via <CategoryTree>.
function flattenForDropdown(cats: Category[], depth = 0, out: Category[] = []): Category[] {
  for (const c of cats) {
    out.push({ ...c, categoryName: "　".repeat(depth) + c.categoryName });
    if (c.children?.length) flattenForDropdown(c.children, depth + 1, out);
  }
  return out;
}

export default function AdminCategoriesPage() {
  const { categories, isLoading, create, update, remove } = useAdminCategories();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<number | null>(null);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const flat = flattenForDropdown(categories);

  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Category Management" }]} />

      <div className={`flex flex-col items-stretch gap-5 lg:flex-row ${panelOpen ? "min-h-[calc(100vh-110px)]" : ""}`}>
        <div className={`min-w-0 ${panelOpen ? "lg:w-[54%]" : "flex-1"}`}>
          {!panelOpen && <PageHeader title="Category Management" description="Build a category tree used in service requests and incidents — add subcategories inline and optionally scope any node to specific workgroups, locations, or members."
            action={<Button onClick={() => { setEditCat(null); setDefaultParentId(null); setPanelOpen(true); }} className="gap-1.5"><Plus className="size-4" /> Add Root Category</Button>}
          />}
          {panelOpen && (
            <div className="mb-3 flex items-center justify-between border-b-2 border-slate-800 pb-2.5">
              <h1 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.6px] text-slate-800"><FileText className="size-3.5" /> Category Tree</h1>
              <Button onClick={() => { setEditCat(null); setDefaultParentId(null); setPanelOpen(true); }} className="h-9 gap-1.5 rounded-lg px-4 text-xs"><Plus className="size-3.5" /> Add New Category</Button>
            </div>
          )}

          {isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
              Loading categories…
            </div>
          ) : (
            <CategoryTree
              categories={categories}
              onEdit={(c) => { setEditCat(c); setDefaultParentId(null); setPanelOpen(true); }}
              onAddChild={(parent) => { setEditCat(null); setDefaultParentId(parent.categoryId); setPanelOpen(true); }}
              onDelete={(c) => setDeleteCat(c)}
            />
          )}
        </div>

        {panelOpen && (
          <div className="w-full shrink-0 lg:w-[46%] lg:border-l lg:border-slate-200 lg:pl-8">
            <CategoryFormPanel
              open={panelOpen}
              category={editCat}
              categories={flat}
              defaultParentId={defaultParentId}
              isLoading={saving}
              onSubmit={async (data) => {
                setSaving(true);
                const ok = editCat ? await update(editCat.categoryId, data) : await create(data);
                setSaving(false);
                return !!ok;
              }}
              onClose={() => { setPanelOpen(false); setEditCat(null); setDefaultParentId(null); }}
            />
          </div>
        )}
      </div>

      <CategoryDeleteDialog
        category={deleteCat}
        isLoading={deleting}
        onConfirm={async (policy: CategoryDeletePolicy) => {
          if (!deleteCat) return;
          setDeleting(true);
          await remove(deleteCat.categoryId, policy);
          setDeleting(false);
          setDeleteCat(null);
        }}
        onCancel={() => setDeleteCat(null)}
      />
    </div>
  );
}
