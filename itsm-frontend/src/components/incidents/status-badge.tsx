import { Badge } from "@/components/ui/badge";
import { IncidentStatus } from "@/types/incident";

const statusVariant: Record<IncidentStatus, "blue" | "green" | "gray" | "amber"> = {
  Assigned: "blue",
  "In Progress": "blue",
  Resolved: "green",
  Closed: "gray",
  "On Hold": "amber",
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>;
}
