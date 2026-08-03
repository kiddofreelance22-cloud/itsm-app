"use client";

import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminLocation } from "@/lib/hooks/use-admin-modules";
import { Location } from "@/types/admin";
import { Column } from "@/components/admin/data-table";

const columns: Column<Location>[] = [
  { key: "locationName", label: "Location Name", sortable: true, render: (r) => <span className="font-medium">{r.locationName}</span> },
  { key: "locationCode", label: "Location Code", render: (r) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.locationCode}</code> },
  { key: "type", label: "Type", render: (r) => <span className="text-slate-500">{r.type}</span> },
  { key: "description", label: "Description", render: (r) => <span className="text-slate-500 text-sm">{r.description ?? "—"}</span> },
];

export default function AdminLocationPage() {
  const { items, isLoading, create, update, remove } = useAdminLocation();
  return (
    <GenericAdminPage<Location>
      title="Location Management"
      description="Create, edit and manage locations."
      breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Location" }]}
      idKey="locationId" nameKey="locationName" codeKey="locationCode"
      items={items} isLoading={isLoading}
      columns={columns}
      searchKeys={["locationName", "locationCode"]}
      singularLabel="Location"
      fields={[
        { key: "locationName", label: "Location Name", placeholder: "e.g. Mumbai Head Office" },
        { key: "locationCode", label: "Location Code", placeholder: "e.g. MUM_HO" },
        { key: "type", label: "Type", type: "select", options: ["Office", "Branch", "Remote", "Data Center", "Other"] },
        { key: "description", label: "Description", type: "textarea", required: false },
        { key: "isActive", label: "Active", type: "checkbox", placeholder: "Mark as active" },
      ]}
      onCreate={create}
      onUpdate={update}
      onRemove={remove}
    />
  );
}
