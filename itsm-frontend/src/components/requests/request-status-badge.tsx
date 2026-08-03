import { cn } from "@/lib/utils";
import { RequestStatus } from "@/types/request";

const styles: Record<RequestStatus, string> = {
  Submitted:   "bg-blue-100 text-blue-700",
  "In Progress": "bg-yellow-100 text-yellow-700",
  Approved:    "bg-green-100 text-green-700",
  Rejected:    "bg-red-100 text-red-700",
  Closed:      "bg-gray-100 text-gray-600",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", styles[status])}>
      {status}
    </span>
  );
}
