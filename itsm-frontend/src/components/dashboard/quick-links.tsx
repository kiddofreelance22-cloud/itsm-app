import Link from "next/link";
import { LucideIcon, Headphones, ShoppingCart, User, Bell, UserCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface QuickLink {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

const links: QuickLink[] = [
  { href: "/incidents/create", icon: Headphones, title: "Report an Issue", description: "Create a new incident" },
  { href: "/service-requests", icon: ShoppingCart, title: "Request Something", description: "Raise a service request" },
  { href: "/approvals", icon: User, title: "My Approvals", description: "View pending approvals" },
  { href: "/notifications", icon: Bell, title: "Notifications", description: "View all notifications" },
  { href: "/profile", icon: UserCircle, title: "My Profile", description: "Manage your profile" },
];

export function QuickLinks() {
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Quick Links</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center gap-2 rounded-lg p-3 text-center transition-colors hover:bg-slate-50"
            >
              <Icon className="size-6 text-slate-600" aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium text-slate-800">{link.title}</span>
                <span className="block text-xs text-slate-500">{link.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
