import { Badge } from "@/components/ui/badge";
import { RequestStatus } from "@/types/request";

const statusVariant: Record<RequestStatus, "blue" | "green" | "gray" | "amber" | "red"> = {
  Submitted: "amber",
  "In Progress": "blue",
  Approved: "green",
  Rejected: "red",
  Closed: "gray",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>;
}
