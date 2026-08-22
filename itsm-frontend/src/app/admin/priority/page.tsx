"use client";

import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminPriority } from "@/lib/hooks/use-admin-modules";
import { Priority } from "@/types/admin";
import { Column } from "@/components/admin/data-table";

const columns: Column<Priority>[] = [
  { key: "priorityName", label: "Priority Name", sortable: true, render: (r) => <span className="font-medium">{r.priorityName}</span> },
  { key: "priorityCode", label: "Priority Code", render: (r) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.priorityCode}</code> },
  { key: "responseSlaMinutes", label: "Response SLA", render: (r) => <span className="text-slate-500 text-sm">{r.responseSlaMinutes ? `${r.responseSlaMinutes} min` : "—"}</span> },
  { key: "resolutionSlaMinutes", label: "Resolution SLA", render: (r) => <span className="text-slate-500 text-sm">{r.resolutionSlaMinutes ? `${r.resolutionSlaMinutes} min` : "—"}</span> },
  { key: "order", label: "Order", sortable: true, render: (r) => <span className="text-slate-500">{r.order}</span> },
];

export default function AdminPriorityPage() {
  const { items, isLoading, create, update, remove } = useAdminPriority();
  return (
    <GenericAdminPage<Priority>
      title="Priority Management"
      description="Create, edit and manage priority levels."
      breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Priority" }]}
      idKey="priorityId" nameKey="priorityName" codeKey="priorityCode"
      items={items} isLoading={isLoading}
      columns={columns}
      searchKeys={["priorityName", "priorityCode"]}
      singularLabel="Priority"
      fields={[
        { key: "priorityName", label: "Priority Name", placeholder: "e.g. High" },
        { key: "priorityCode", label: "Priority Code", placeholder: "e.g. HIGH" },
        { key: "description", label: "Description", type: "textarea", required: false, placeholder: "Optional description" },
        { key: "responseSlaMinutes", label: "Response SLA (minutes)", type: "number", required: false, placeholder: "e.g. 30" },
        { key: "resolutionSlaMinutes", label: "Resolution SLA (minutes)", type: "number", required: false, placeholder: "e.g. 480" },
        { key: "order", label: "Display Order", type: "number", placeholder: "1" },
        { key: "isActive", label: "Active", type: "checkbox", placeholder: "Mark as active" },
      ]}
      onCreate={create}
      onUpdate={update}
      onRemove={remove}
    />
  );
}
