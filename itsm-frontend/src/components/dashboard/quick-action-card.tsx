import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  iconBgClass: string;
}

export function QuickActionCard({
  href,
  icon: Icon,
  title,
  description,
  iconBgClass,
}: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:-translate-y-0.5"
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full text-white transition-transform group-hover:scale-105",
          iconBgClass
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </Link>
  );
}
