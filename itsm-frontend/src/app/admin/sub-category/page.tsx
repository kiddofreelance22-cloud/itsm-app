"use client";

import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminSubCategory } from "@/lib/hooks/use-admin-modules";
import { useAdminCategories } from "@/lib/hooks/use-admin";
import { SubCategory } from "@/types/admin";
import { Column } from "@/components/admin/data-table";

type AdminFormData = Record<string, string | number | boolean | null | undefined>;

const columns: Column<SubCategory>[] = [
  { key: "subCategoryName", label: "Sub Category Name", sortable: true, render: (r) => <span className="font-medium">{r.subCategoryName}</span> },
  { key: "subCategoryCode", label: "Sub Category Code", render: (r) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.subCategoryCode}</code> },
  { key: "category", label: "Category", render: (r) => <span className="text-slate-500">{r.category?.categoryName ?? "—"}</span> },
  { key: "description", label: "Description", render: (r) => <span className="text-slate-500 text-sm">{r.description ?? "—"}</span> },
];

export default function AdminSubCategoryPage() {
  const { items, isLoading, create, update, remove } = useAdminSubCategory();
  const { categories } = useAdminCategories();

  // Flatten categories for select options
  const catOptions = categories.map((c) => ({ label: c.categoryName, value: String(c.categoryId) }));

  return (
    <GenericAdminPage<SubCategory>
      title="Sub Category Management"
      description="Create, edit and manage sub-categories under a category."
      breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Sub Category" }]}
      idKey="subCategoryId" nameKey="subCategoryName" codeKey="subCategoryCode"
      items={items} isLoading={isLoading}
      columns={columns}
      searchKeys={["subCategoryName", "subCategoryCode"]}
      singularLabel="Sub Category"
      fields={[
        { key: "subCategoryName", label: "Sub Category Name", placeholder: "e.g. Hardware Failure" },
        { key: "subCategoryCode", label: "Sub Category Code", placeholder: "e.g. HW_FAIL" },
        { key: "categoryId", label: "Parent Category", type: "select", required: false, options: categories.map((c) => c.categoryName) },
        { key: "description", label: "Description", type: "textarea", required: false },
        { key: "isActive", label: "Active", type: "checkbox", placeholder: "Mark as active" },
      ]}
      onCreate={async (data: AdminFormData) => {
        // Map categoryName back to categoryId
        const category = categories.find((c) => c.categoryName === data.categoryId);
        return create({ ...data, categoryId: category?.categoryId });
      }}
      onUpdate={async (id, data: AdminFormData) => {
        const category = categories.find((c) => c.categoryName === data.categoryId);
        return update(id, { ...data, categoryId: category?.categoryId });
      }}
      onRemove={remove}
    />
  );
}
