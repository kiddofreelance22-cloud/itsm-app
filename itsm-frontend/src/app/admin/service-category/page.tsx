"use client";

import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminServiceCategory } from "@/lib/hooks/use-admin-modules";
import { ServiceCategory } from "@/types/admin";
import { Column } from "@/components/admin/data-table";

const columns: Column<ServiceCategory>[] = [
  { key: "categoryName", label: "Category Name", sortable: true, render: (r) => <span className="font-medium">{r.categoryName}</span> },
  { key: "parentCategoryName", label: "Parent", render: (r) => <span className="text-slate-500">{r.parentCategoryName ?? "Root"}</span> },
  { key: "sortOrder", label: "Sort Order", sortable: true, render: (r) => <span className="text-slate-500">{r.sortOrder}</span> },
  { key: "tileColor", label: "Tile Color", render: (r) => <span className="inline-block size-4 rounded border border-slate-200 align-middle" style={{ backgroundColor: r.tileColor }} /> },
];

export default function AdminServiceCategoryPage() {
  const { items, isLoading, create, update, remove } = useAdminServiceCategory();
  return <GenericAdminPage<ServiceCategory>
    title="Service Category Management" description="Create and manage categories available in service requests."
    breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Service Category" }]}
    idKey="serviceCategoryId" nameKey="categoryName" items={items} isLoading={isLoading} columns={columns}
    searchKeys={["categoryName", "description"]} singularLabel="Service Category"
    fields={[
      { key: "parentCategoryName", label: "Parent Category", type: "search", required: false, placeholder: "Search and select a parent category", options: items.filter((item) => item.serviceCategoryId !== 0).map((item) => item.categoryName) },
      { key: "categoryName", label: "Category Name", placeholder: "Specify the category name" },
      { key: "sortOrder", label: "Sort Order", type: "number", placeholder: "0" },
      { key: "description", label: "Description", type: "textarea", required: false, placeholder: "Specify the description" },
      { key: "imageUrl", label: "Category Image URL", required: false, placeholder: "https://..." },
      { key: "tileColor", label: "Tile Color", placeholder: "#111827" },
      { key: "isActive", label: "Active", type: "checkbox", placeholder: "Available for service requests" },
    ]}
    onCreate={create} onUpdate={update} onRemove={remove}
  />;
}