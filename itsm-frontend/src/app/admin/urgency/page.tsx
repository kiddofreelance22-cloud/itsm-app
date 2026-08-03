"use client";

import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminUrgency } from "@/lib/hooks/use-admin-modules";
import { Urgency } from "@/types/admin";
import { Column } from "@/components/admin/data-table";

const columns: Column<Urgency>[] = [
  { key: "urgencyName", label: "Urgency Name", sortable: true, render: (r) => <span className="font-medium">{r.urgencyName}</span> },
  { key: "urgencyCode", label: "Urgency Code", render: (r) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.urgencyCode}</code> },
  { key: "description", label: "Description", render: (r) => <span className="text-slate-500 text-sm">{r.description ?? "—"}</span> },
  { key: "order", label: "Order", sortable: true, render: (r) => <span className="text-slate-500">{r.order}</span> },
];

export default function AdminUrgencyPage() {
  const { items, isLoading, create, update, remove } = useAdminUrgency();
  return (
    <GenericAdminPage<Urgency>
      title="Urgency Management"
      description="Create, edit and manage urgency levels."
      breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Urgency" }]}
      idKey="urgencyId" nameKey="urgencyName" codeKey="urgencyCode"
      items={items} isLoading={isLoading}
      columns={columns}
      searchKeys={["urgencyName", "urgencyCode"]}
      singularLabel="Urgency"
      fields={[
        { key: "urgencyName", label: "Urgency Name", placeholder: "e.g. Low" },
        { key: "urgencyCode", label: "Urgency Code", placeholder: "e.g. LOW" },
        { key: "description", label: "Description", type: "textarea", required: false },
        { key: "order", label: "Display Order", type: "number", placeholder: "1" },
        { key: "isActive", label: "Active", type: "checkbox", placeholder: "Mark as active" },
      ]}
      onCreate={create}
      onUpdate={update}
      onRemove={remove}
    />
  );
}
