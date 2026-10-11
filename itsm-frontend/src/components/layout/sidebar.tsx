"use client";

import Link from "next/link";
import { type ElementType } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { requesterNavItems, analystNavItems } from "./nav-items";
import { useAuth } from "@/lib/hooks/use-auth";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function NavLink({ href, icon: Icon, label, onNavigate }: {
  href: string; icon: ElementType; label: string; onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = href === "/incidents"
    ? pathname === "/incidents" || /^\/incidents\/[^/]+$/.test(pathname)
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 border-l-[3px] border-transparent px-3 py-[7px] text-[12.5px] font-medium transition-colors",
        isActive ? "border-brand-600 bg-brand-100 font-bold text-brand-600" : "text-[#344054] hover:bg-brand-50 hover:text-[#1d2433]"
      )}
    >
      <Icon className="size-4.5 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, isAnalyst, isAgent, isEngineer, isManager, isServiceDesk, hasPermission, logout } = useAuth();
  
  // Check if user's role grants dashboard access. The Analyst Dashboard is
  // built entirely from incident/task/problem/change data scoped to the
  // current user (see DashboardService.getAnalystStats), so we gate it on
  // those module permissions — the ones admins can actually configure from
  // Roles Management — rather than a "Dashboard" permission that isn't a
  // selectable module there.
  const canViewDashboard =
    hasPermission("dashboard:read") || hasPermission("dashboard:create") ||
    hasPermission("dashboard:update") || hasPermission("dashboard:administer") ||
    hasPermission("incidents:read") || hasPermission("incidents:create") ||
    hasPermission("incidents:update") || hasPermission("incidents:administer");
  
  // Admins get the full analyst nav + admin console link
  const baseItems = (isAnalyst || isAdmin) ? analystNavItems : requesterNavItems;

  // Filter out Analyst Dashboard if user doesn't have dashboard permissions
  const filteredBaseItems = canViewDashboard 
    ? baseItems 
    : baseItems.filter((item) => item.label !== "Analyst Dashboard");

  // "Incident Queue" (the group-claim view) is only meaningful for roles that
  // triage/distribute work across a group — Admin, Manager, Service Desk.
  // Individual-contributor Analysts/Engineers only work their own queue, so
  // the group-claim page is hidden for them (and access is blocked
  // server-side too — see RolesGuard on IncidentsController).
 // Incident Queue includes a "My Queue" tab, so keep analyst-role navigation
  // focused on the fuller queue workspace.
  const items = (isAnalyst || isAdmin)
    ? filteredBaseItems.filter((item) => item.label !== "Assigned to Me")
    : filteredBaseItems;
  // Section label mirrors the "Analyst Workspace" grouping used across the
  // analyst mockups so agents/managers/service desk feel oriented.
  const sectionLabel = isAdmin
    ? "Admin Workspace"
    : isAnalyst
    ? isManager ? "Manager Workspace" : isServiceDesk ? "Service Desk Workspace" : "Analyst Workspace"
    : null;

  return (
    <div className="flex h-full flex-col justify-between">
      <nav aria-label="Primary" className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
        {sectionLabel && (
          <p className="mb-1 mt-1 border-t border-[#edeff2] px-3 pt-3 text-[10.5px] font-extrabold uppercase tracking-[0.6px] text-[#8a94a6]">
            {sectionLabel}
          </p>
        )}
        {items.map((item) => (
          <NavLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}
        {isAdmin && (
          <>
            <p className="mb-1 mt-3 border-t border-[#edeff2] px-3 pt-3 text-[10.5px] font-extrabold uppercase tracking-[0.6px] text-[#8a94a6]">
              Admin
            </p>
            <NavLink href="/admin/users" icon={Settings} label="Admin Console" onNavigate={onNavigate} />
          </>
        )}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 border-l-[3px] border-transparent px-3 py-[7px] text-[12.5px] font-medium text-[#344054] transition-colors hover:bg-brand-50 hover:text-[#1d2433]"
        >
          <LogOut className="size-4.5" aria-hidden="true" />
          Logout
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-[260px] bg-white shadow-xl transition-transform duration-200 lg:hidden",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-[46px] items-center justify-between border-b border-[#edeff2] px-4">
          <span className="font-semibold text-slate-900">Menu</span>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x size-5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <SidebarContent onNavigate={onClose} />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-[260px] shrink-0 border-r border-[#d5dae1] bg-white lg:block" style={{ minHeight: "calc(100vh - 46px)" }}>
        <SidebarContent />
      </aside>
    </>
  );
}
