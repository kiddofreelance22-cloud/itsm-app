"use client";
import { GenericAdminPage } from "@/components/admin/generic-admin-page";
import { useAdminImpact, useAdminPriority, useAdminPriorityMatrix, useAdminUrgency } from "@/lib/hooks/use-admin-modules";
import { PriorityMatrix } from "@/types/admin";
import { Column } from "@/components/admin/data-table";
const columns: Column<PriorityMatrix>[] = [
  { key: "urgency", label: "Urgency", render: (r) => <span>{r.urgency?.urgencyName ?? r.urgencyId}</span> },
  { key: "impact", label: "Impact", render: (r) => <span>{r.impact?.impactName ?? r.impactId}</span> },
  { key: "priority", label: "Priority", render: (r) => <span className="font-medium">{r.priority?.priorityName ?? r.priorityId}</span> },
];
export default function PriorityMatrixPage() {
  const matrix = useAdminPriorityMatrix(); const urgencies = useAdminUrgency(); const impacts = useAdminImpact(); const priorities = useAdminPriority();
  const options = (items: unknown[], id: string, name: string) => items.map((item) => { const record = item as Record<string, unknown>; return { value: String(record[id]), label: String(record[name]) }; });
  return <GenericAdminPage<PriorityMatrix> title="Priority Matrix" description="Map urgency and impact combinations to priorities." breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Priority Matrix" }]} idKey="priorityMatrixId" nameKey="priorityMatrixId" items={matrix.items} isLoading={matrix.isLoading || urgencies.isLoading || impacts.isLoading || priorities.isLoading} columns={columns} searchKeys={["urgencyId", "impactId", "priorityId"]} singularLabel="Priority Matrix" fields={[{ key: "urgencyId", label: "Urgency", type: "select", options: options(urgencies.items, "urgencyId", "urgencyName") }, { key: "impactId", label: "Impact", type: "select", options: options(impacts.items, "impactId", "impactName") }, { key: "priorityId", label: "Priority", type: "select", options: options(priorities.items, "priorityId", "priorityName") }, { key: "isActive", label: "Active", type: "checkbox" }]} onCreate={matrix.create} onUpdate={matrix.update} onRemove={matrix.remove} />;
}