"use client";

import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminRequestPendingReason } from "@/lib/hooks/use-admin-modules";
import { RequestPendingReason } from "@/types/admin";
import { Column } from "@/components/admin/data-table";

const columns: Column<RequestPendingReason>[] = [
  {
    key: "pendingReasonName",
    label: "Pending Reason Name",
    sortable: true,
    render: (r) => <span className="font-medium">{r.pendingReasonName}</span>,
  },
  {
    key: "description",
    label: "Description",
    render: (r) => <span className="text-muted-foreground">{r.description || "—"}</span>,
  },
  {
    key: "slaImpact",
    label: "SLA Impact",
    sortable: true,
    render: (r) => (
      <span className={r.slaImpact === "continue" ? "text-blue-600 font-medium" : "text-amber-600 font-medium"}>
        {r.slaImpact === "continue" ? "Continue SLA" : "Pause SLA"}
      </span>
    ),
  },
  {
    key: "isActive",
    label: "Active",
    render: (r) => <span>{r.isActive ? "Yes" : "No"}</span>,
  },
];

export default function RequestPendingReasonPage() {
  const state = useAdminRequestPendingReason();

  return (
    <GenericAdminPage<RequestPendingReason>
      title="Service Request Pending Reason Management"
      description="Manage hold and pending reasons that apply exclusively to Service Requests (separate from Incident pending reasons)."
      breadcrumbs={[
        { label: "Home", href: "/home" },
        { label: "Admin" },
        { label: "Service Request Pending Reasons" },
      ]}
      idKey="pendingReasonId"
      nameKey="pendingReasonName"
      items={state.items}
      isLoading={state.isLoading}
      columns={columns}
      searchKeys={["pendingReasonName", "description"]}
      singularLabel="Service Pending Reason"
      fields={[
        { key: "pendingReasonName", label: "Service Pending Reason Name", required: true },
        { key: "description", label: "Description" },
        {
          key: "slaImpact",
          label: "SLA Impact",
          type: "select",
          options: [
            { label: "Pause SLA", value: "pause" },
            { label: "Continue SLA", value: "continue" },
          ],
        },
        { key: "isActive", label: "Active", type: "checkbox" },
      ]}
      onCreate={state.create}
      onUpdate={state.update}
      onRemove={state.remove}
    />
  );
}
