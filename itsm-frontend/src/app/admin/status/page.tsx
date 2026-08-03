"use client";

import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminStatus } from "@/lib/hooks/use-admin-modules";
import { Status } from "@/types/admin";
import { Column } from "@/components/admin/data-table";

const columns: Column<Status>[] = [
  { key: "statusName", label: "Status Name", sortable: true, render: (r) => <span className="font-medium">{r.statusName}</span> },
  { key: "statusCode", label: "Status Code", render: (r) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.statusCode}</code> },
  { key: "type", label: "Type", render: (r) => <span className="capitalize text-slate-500">{r.type}</span> },
  { key: "isOpen", label: "Open?", render: (r) => <span className={`text-xs font-medium ${r.isOpen ? "text-blue-600" : "text-slate-400"}`}>{r.isOpen ? "Yes" : "No"}</span> },
];

export default function AdminStatusPage() {
  const { items, isLoading, create, update, remove } = useAdminStatus();
  return (
    <GenericAdminPage<Status>
      title="Status Management"
      description="Create, edit and manage incident status values."
      breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Status" }]}
      idKey="statusId" nameKey="statusName" codeKey="statusCode"
      items={items} isLoading={isLoading}
      columns={columns}
      searchKeys={["statusName", "statusCode"]}
      singularLabel="Status"
      fields={[
        { key: "statusName", label: "Status Name", placeholder: "e.g. In Progress" },
        { key: "statusCode", label: "Status Code", placeholder: "e.g. IN_PROGRESS" },
        { key: "type", label: "Type", type: "select", options: ["incident", "request", "change", "problem"] },
        { key: "isOpen", label: "Is Open", type: "checkbox", placeholder: "Mark as an open state" },
        { key: "isActive", label: "Active", type: "checkbox", placeholder: "Mark as active" },
      ]}
      onCreate={create}
      onUpdate={update}
      onRemove={remove}
    />
  );
}
