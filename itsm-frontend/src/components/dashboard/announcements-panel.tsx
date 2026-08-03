import Link from "next/link";
import { Megaphone } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Announcement } from "@/types";
import { cn } from "@/lib/utils";

const dotClass: Record<Announcement["colorDot"], string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-amber-500",
};

export function AnnouncementsPanel({ announcements }: { announcements: Announcement[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-[18px] text-slate-500" aria-hidden="true" />
          Announcements
        </CardTitle>
        <Link href="#" className="text-sm font-medium text-brand-600 hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-slate-100">
        {announcements.map((a) => (
          <div key={a.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start gap-2">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dotClass[a.colorDot])} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{a.description}</p>
                <p className="mt-1 text-xs text-slate-400">{a.date}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
