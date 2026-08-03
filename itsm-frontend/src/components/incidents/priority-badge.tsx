import { IncidentPriority } from "@/types/incident";
import { cn } from "@/lib/utils";

const priorityColor: Record<IncidentPriority, { dot: string; text: string }> = {
  Low: { dot: "bg-green-600", text: "text-slate-700" },
  Medium: { dot: "bg-amber-500", text: "text-slate-700" },
  High: { dot: "bg-red-600", text: "text-slate-700" },
  Critical: { dot: "bg-red-700", text: "text-red-700" },
};

export function PriorityBadge({ priority }: { priority: IncidentPriority }) {
  const { dot, text } = priorityColor[priority];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", text)}>
      <span className={cn("size-2 rounded-full", dot)} aria-hidden="true" />
      {priority}
    </span>
  );
}
