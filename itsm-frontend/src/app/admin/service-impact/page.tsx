"use client";

import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminServiceImpact } from "@/lib/hooks/use-admin-modules";
import { ServiceImpact } from "@/types/admin";
import { Column } from "@/components/admin/data-table";

const columns: Column<ServiceImpact>[] = [
  { key: "impactName", label: "Impact Name", sortable: true, render: (r) => <span className="font-medium">{r.impactName}</span> },
  { key: "sortOrder", label: "Sort Order", sortable: true, render: (r) => <span className="text-slate-500">{r.sortOrder}</span> },
  { key: "isDefault", label: "Default", render: (r) => <span className="text-slate-500">{r.isDefault ? "Yes" : "No"}</span> },
];

export default function AdminServiceImpactPage() {
  const { items, isLoading, create, update, remove } = useAdminServiceImpact();
  return <GenericAdminPage<ServiceImpact>
    title="Service Impact Management" description="Define the impact levels used to prioritize service requests."
    breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Service Impact" }]}
    idKey="serviceImpactId" nameKey="impactName" items={items} isLoading={isLoading} columns={columns}
    searchKeys={["impactName"]} singularLabel="Service Impact"
    fields={[
      { key: "impactName", label: "Impact Name", placeholder: "e.g. High" },
      { key: "sortOrder", label: "Sort Order", type: "number", placeholder: "0" },
      { key: "isDefault", label: "Default", type: "checkbox", placeholder: "Use as the default impact" },
      { key: "isActive", label: "Active", type: "checkbox", placeholder: "Available for service requests" },
    ]}
    onCreate={create} onUpdate={update} onRemove={remove}
  />;
}