import { Bell, FileText, Megaphone, MessageSquare } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card } from "@/components/ui/card";



export default function NotificationsPage() {
  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Notifications" }]} />
      <div className="flex items-center gap-2">
        <Bell className="size-6 text-brand-600" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">Stay up to date with your incidents and announcements.</p>

      <div className="mt-6 flex flex-col gap-2">
        <p className="text-sm text-slate-500">No new notifications.</p>
      </div>
    </div>
  );
}
