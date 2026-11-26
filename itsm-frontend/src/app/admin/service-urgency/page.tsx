"use client";

import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminServiceUrgency } from "@/lib/hooks/use-admin-modules";
import { ServiceUrgency } from "@/types/admin";
import { Column } from "@/components/admin/data-table";

const columns: Column<ServiceUrgency>[] = [
  { key: "urgencyName", label: "Urgency Name", sortable: true, render: (r) => <span className="font-medium">{r.urgencyName}</span> },
  { key: "urgencyCode", label: "Urgency Code", render: (r) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.urgencyCode}</code> },
  { key: "order", label: "Order", sortable: true, render: (r) => <span className="text-slate-500">{r.order}</span> },
  { key: "isActive", label: "Active", render: (r) => <span className="text-slate-500">{r.isActive ? "Yes" : "No"}</span> },
];

export default function AdminServiceUrgencyPage() {
  const { items, isLoading, create, update, remove } = useAdminServiceUrgency();
  return (
    <GenericAdminPage<ServiceUrgency>
      title="Service Urgency Management"
      description="Create, edit and manage urgency levels for service requests."
      breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Service Urgency" }]}
      idKey="urgencyId" nameKey="urgencyName" codeKey="urgencyCode"
      items={items} isLoading={isLoading}
      columns={columns}
      searchKeys={["urgencyName", "urgencyCode"]}
      singularLabel="Service Urgency"
      fields={[
        { key: "urgencyName", label: "Service Urgency Name", placeholder: "e.g. High" },
        { key: "urgencyCode", label: "Urgency Code", placeholder: "e.g. HIGH" },
        { key: "description", label: "Description", type: "textarea", required: false, placeholder: "Optional description" },
        { key: "order", label: "Display Order", type: "number", placeholder: "1" },
        { key: "isActive", label: "Active", type: "checkbox", placeholder: "Mark as active" },
      ]}
      onCreate={create}
      onUpdate={update}
      onRemove={remove}
    />
  );
}
