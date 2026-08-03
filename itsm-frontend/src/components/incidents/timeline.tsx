import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TimelineEvent } from "@/types/incident";
import { FilePlus2, UserCheck, PlayCircle, MessageSquare, CheckCircle2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<TimelineEvent["icon"], { icon: typeof FilePlus2; bg: string; text: string }> = {
  created: { icon: FilePlus2, bg: "bg-purple-100", text: "text-purple-600" },
  assigned: { icon: UserCheck, bg: "bg-blue-100", text: "text-blue-600" },
  started: { icon: PlayCircle, bg: "bg-amber-100", text: "text-amber-600" },
  update: { icon: MessageSquare, bg: "bg-sky-100", text: "text-sky-600" },
  resolved: { icon: CheckCircle2, bg: "bg-green-100", text: "text-green-600" },
  reopened: { icon: RotateCw, bg: "bg-red-100", text: "text-red-600" },
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative flex flex-col gap-5 pl-1">
          {events.map((event, i) => {
            const { icon: Icon, bg, text } = iconMap[event.icon];
            const isLast = i === events.length - 1;
            return (
              <li key={event.id} className="relative flex gap-3">
                {!isLast && (
                  <span
                    className="absolute left-[15px] top-8 h-[calc(100%-4px)] w-px bg-slate-200"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={cn(
                    "z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                    bg,
                    text
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{event.title}</p>
                    <p className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                      {event.timestamp}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">{event.actor}</p>
                </div>
              </li>
            );
          })}
        </ol>
        {events.length > 0 && (
          <button className="mt-2 text-sm font-medium text-brand-600 hover:underline">
            View All Updates
          </button>
        )}
      </CardContent>
    </Card>
  );
}
