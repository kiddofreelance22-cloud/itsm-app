"use client";

import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminRequestSlaServiceWindow } from "@/lib/hooks/use-admin-modules";
import { RequestSlaServiceWindow } from "@/types/admin";
import { Column } from "@/components/admin/data-table";

const columns: Column<RequestSlaServiceWindow>[] = [
  { key: "slaName", label: "SLA Name", sortable: true, render: (r) => <span className="font-medium">{r.slaName}</span> },
  { key: "timeZone", label: "Time Zone", render: (r) => <span className="text-slate-500">{r.timeZone}</span> },
  { key: "is24x7", label: "Service Window", render: (r) => <span className="text-slate-500">{r.is24x7 ? "24/7" : `${r.serviceWindow?.filter((d) => d.enabled).length ?? 0} days`}</span> },
  { key: "isDefault", label: "Default", render: (r) => <span className="text-slate-500">{r.isDefault ? "Yes" : "No"}</span> },
];

export default function RequestSlaServiceWindowPage() {
  const state = useAdminRequestSlaServiceWindow();
  return (
    <GenericAdminPage<RequestSlaServiceWindow>
      title="Service SLA Service Window Management"
      description="Configure working hours used for Service Request SLA calculations."
      breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Service SLA Window" }]}
      idKey="slaServiceWindowId"
      nameKey="slaName"
      items={state.items}
      isLoading={state.isLoading}
      columns={columns}
      searchKeys={["slaName", "timeZone"]}
      singularLabel="Service SLA Service Window"
      fields={[
        { key: "slaName", label: "Service SLA Name" },
        { key: "holidayCalendarLocation", label: "Holiday Calendar Location", required: false },
        { key: "timeZone", label: "Time Zone", placeholder: "Enter an IANA time zone" },
        { key: "serviceWindow", label: "Service Window JSON", type: "textarea", placeholder: "Enter a JSON array of day, enabled, from, and to values" },
        { key: "useAnalystWorkLocation", label: "Use Analyst's Work Location", type: "checkbox" },
        { key: "is24x7", label: "24/7", type: "checkbox" },
        { key: "isDefault", label: "Default", type: "checkbox" },
        { key: "isActive", label: "Active", type: "checkbox" },
      ]}
      onCreate={state.create}
      onUpdate={state.update}
      onRemove={state.remove}
    />
  );
}
