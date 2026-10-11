"use client";
import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminPendingReason } from "@/lib/hooks/use-admin-modules";
import { PendingReason } from "@/types/admin";
import { Column } from "@/components/admin/data-table";
const columns: Column<PendingReason>[] = [{ key: "pendingReasonName", label: "Pending Reason Name", sortable: true, render: (r) => <span className="font-medium">{r.pendingReasonName}</span> }];
export default function PendingReasonPage() { const state = useAdminPendingReason(); return <GenericAdminPage<PendingReason> title="Pending Reason Management" description="Manage reasons that pause service request work." breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Pending Reason" }]} idKey="pendingReasonId" nameKey="pendingReasonName" items={state.items} isLoading={state.isLoading} columns={columns} searchKeys={["pendingReasonName"]} singularLabel="Pending Reason" fields={[{ key: "pendingReasonName", label: "Pending Reason Name" }, { key: "isActive", label: "Active", type: "checkbox" }]} onCreate={state.create} onUpdate={state.update} onRemove={state.remove} />; }