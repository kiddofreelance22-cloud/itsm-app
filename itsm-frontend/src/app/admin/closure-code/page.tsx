"use client";
import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminClosureCode } from "@/lib/hooks/use-admin-modules";
import { ClosureCode } from "@/types/admin";
import { Column } from "@/components/admin/data-table";
const columns: Column<ClosureCode>[] = [{ key: "closureCodeName", label: "Closure Code Name", sortable: true, render: (r) => <span className="font-medium">{r.closureCodeName}</span> }];
export default function ClosureCodePage() { const state = useAdminClosureCode(); return <GenericAdminPage<ClosureCode> title="Closure Code Management" description="Manage completion codes available when a request is closed." breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Closure Code" }]} idKey="closureCodeId" nameKey="closureCodeName" items={state.items} isLoading={state.isLoading} columns={columns} searchKeys={["closureCodeName"]} singularLabel="Closure Code" fields={[{ key: "closureCodeName", label: "Closure Code Name" }, { key: "isActive", label: "Active", type: "checkbox" }]} onCreate={state.create} onUpdate={state.update} onRemove={state.remove} />; }