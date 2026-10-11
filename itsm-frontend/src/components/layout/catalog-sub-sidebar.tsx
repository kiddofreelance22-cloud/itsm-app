"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings2, UserRound } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SubLinkProps { label: string; href?: string; newPage?: boolean; showActive?: boolean; }

function SubLink({ label, href, newPage, showActive = true }: SubLinkProps) {
  const pathname = usePathname();
  const isActive = showActive && !!href && (href === "/admin/catalogs" || href === "/admin/catalogs/create" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  if (!href) return <span className="incident-tree-item cursor-default select-none text-slate-400">{label}</span>;
  return <Link href={href} target={newPage ? "_blank" : undefined} rel={newPage ? "noopener noreferrer" : undefined} aria-current={isActive ? "page" : undefined} className={cn("incident-tree-item transition-colors", isActive ? "incident-tree-item-active" : "text-slate-700 hover:bg-blue-50/60 hover:text-blue-700")}>{label}</Link>;
}

export function CatalogSubSidebar() {
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLowerCase();
  const visible = (links: SubLinkProps[]) => links.filter(({ label }) => !query || label.toLowerCase().includes(query));
  const userLinks = [{ label: "Approve Service Catalog" }, { label: "Create Service Catalog", href: "/admin/catalogs/create" }, { label: "Edit Service Catalogs", href: "/admin/catalogs", showActive: false }, { label: "User Group" }, { label: "Package" }];
  const configLinks = [{ label: "Service Catalog Approver" }, { label: "HOD" }, { label: "Service Category", href: "/admin/categories" }, { label: "Catalog to Change Mapping" }];

  return (
    <aside className="hidden w-65 shrink-0 flex-col overflow-hidden border-r border-[#d5dae1] bg-white lg:flex">
      <div className="shrink-0 border-b border-[#edeff2] p-2.5"><label className="relative block"><Search className="absolute left-2 top-2 size-3.5 text-slate-400" aria-hidden="true" /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter navigator" aria-label="Filter catalog navigator" className="h-7 w-full rounded-[5px] border border-[#d0d5dd] bg-white pl-7 pr-2 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15" /></label></div>
      <nav aria-label="Catalog navigation" className="incident-tree-scroll flex-1 overflow-y-auto"><div className="pb-3">
        <div className="incident-tree-group flex items-center gap-1.5"><UserRound className="size-3" />User</div>{visible(userLinks).map((link) => <SubLink key={link.label} {...link} />)}
        <div className="incident-tree-group flex items-center gap-1.5"><Settings2 className="size-3" />Configuration</div>{visible(configLinks).map((link) => <SubLink key={link.label} {...link} />)}
      </div></nav>
    </aside>
  );
}