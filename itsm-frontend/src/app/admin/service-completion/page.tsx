"use client";

import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminServiceCompletion } from "@/lib/hooks/use-admin-modules";
import { ServiceCompletion } from "@/types/admin";
import { Column } from "@/components/admin/data-table";

const columns: Column<ServiceCompletion>[] = [
  { key: "completionName", label: "Completion Name", sortable: true, render: (r) => <span className="font-medium">{r.completionName}</span> },
  { key: "description", label: "Description", render: (r) => <span className="text-slate-500 text-sm">{r.description ?? "—"}</span> },
  { key: "sortOrder", label: "Sort Order", sortable: true, render: (r) => <span className="text-slate-500">{r.sortOrder}</span> },
  { key: "isDefault", label: "Default", render: (r) => <span className="text-slate-500">{r.isDefault ? "Yes" : "No"}</span> },
];

export default function AdminServiceCompletionPage() {
  const { items, isLoading, create, update, remove } = useAdminServiceCompletion();
  return <GenericAdminPage<ServiceCompletion>
    title="Service Completion Management" description="Manage completion outcomes for service requests."
    breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Service Completion" }]}
    idKey="serviceCompletionId" nameKey="completionName" items={items} isLoading={isLoading} columns={columns}
    searchKeys={["completionName", "description"]} singularLabel="Service Completion"
    fields={[
      { key: "completionName", label: "Completion Name", placeholder: "e.g. Fulfilled" },
      { key: "description", label: "Description", type: "textarea", required: false },
      { key: "sortOrder", label: "Sort Order", type: "number", placeholder: "0" },
      { key: "isDefault", label: "Default", type: "checkbox", placeholder: "Use as the default completion" },
      { key: "isActive", label: "Active", type: "checkbox", placeholder: "Available for service requests" },
    ]}
    onCreate={create} onUpdate={update} onRemove={remove}
  />;
}