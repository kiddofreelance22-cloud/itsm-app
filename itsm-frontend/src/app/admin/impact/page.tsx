"use client";

import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminImpact } from "@/lib/hooks/use-admin-modules";
import { Impact } from "@/types/admin";
import { Column } from "@/components/admin/data-table";

const columns: Column<Impact>[] = [
  { key: "impactName", label: "Impact Name", sortable: true, render: (r) => <span className="font-medium">{r.impactName}</span> },
  { key: "impactCode", label: "Impact Code", render: (r) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.impactCode}</code> },
  { key: "description", label: "Description", render: (r) => <span className="text-slate-500 text-sm">{r.description ?? "—"}</span> },
  { key: "order", label: "Order", sortable: true, render: (r) => <span className="text-slate-500">{r.order}</span> },
];

export default function AdminImpactPage() {
  const { items, isLoading, create, update, remove } = useAdminImpact();
  return (
    <GenericAdminPage<Impact>
      title="Impact Management"
      description="Create, edit and manage impact levels."
      breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Impact" }]}
      idKey="impactId" nameKey="impactName" codeKey="impactCode"
      items={items} isLoading={isLoading}
      columns={columns}
      searchKeys={["impactName", "impactCode"]}
      singularLabel="Impact"
      fields={[
        { key: "impactName", label: "Impact Name", placeholder: "e.g. High Impact" },
        { key: "impactCode", label: "Impact Code", placeholder: "e.g. HIGH" },
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
