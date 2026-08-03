"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ElementType, useState } from "react";
import {
  Headphones, LayoutDashboard, Activity, Tag, FolderTree, AlertTriangle,
  Zap, Gauge, Users2, MapPin, Users, ShieldCheck, BookOpen, GitBranch,
  LogOut, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/use-auth";

export const adminSidebarItems = [

  { label: "Status",           href: "/admin/status",           icon: Activity },
  { label: "Category",         href: "/admin/categories",       icon: Tag },
  { label: "Sub Category",     href: "/admin/sub-category",     icon: FolderTree },
  { label: "Priority",         href: "/admin/priority",         icon: AlertTriangle },
  { label: "Impact",           href: "/admin/impact",           icon: Zap },
  { label: "Urgency",          href: "/admin/urgency",          icon: Gauge },
  { label: "Assignment Group", href: "/admin/assignment-group", icon: Users2 },
  { label: "Location",         href: "/admin/location",         icon: MapPin },
  { label: "Users",            href: "/admin/users",            icon: Users },
  { label: "Roles",            href: "/admin/roles",            icon: ShieldCheck },
  { label: "Catalog",          href: "/admin/catalogs",         icon: BookOpen },
  { label: "Workflow",         href: "/admin/workflows",        icon: GitBranch },
] as const;

interface NavItemProps {
  href: string;
  icon: ElementType;
  label: string;
  collapsed: boolean;
  onClick?: () => void;
}

function NavItem({ href, icon: Icon, label, collapsed, onClick }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        collapsed ? "justify-center px-2" : "",
        isActive
          ? "bg-brand-600 text-white shadow-sm"
          : "text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
      )}
    >
      <Icon
        className={cn(
          "shrink-0 transition-transform duration-150",
          collapsed ? "size-5" : "size-[18px]",
          isActive ? "text-white" : "text-[rgba(255,255,255,0.5)] group-hover:text-white"
        )}
        aria-hidden="true"
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

interface AdminSidebarContentProps {
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}

export function AdminSidebarContent({ collapsed, onNavigate, onToggleCollapse }: AdminSidebarContentProps) {
  const { logout } = useAuth();

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--color-navy-900)" }}>
      {/* Logo strip */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-[rgba(255,255,255,0.08)]",
          collapsed ? "justify-center px-2" : "gap-2.5 px-4"
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-600">
          <Headphones className="size-4 text-white" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide text-white">ITSM</p>
            <p className="text-[10px] font-medium text-[rgba(255,255,255,0.5)]">Admin Console</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav
        aria-label="Admin navigation"
        className="flex-1 overflow-y-auto p-2 thin-scrollbar"
      >
        {!collapsed && (
          <p className="mb-1 mt-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[rgba(255,255,255,0.3)]">
            Administration
          </p>
        )}
        <div className="flex flex-col gap-0.5">
          {adminSidebarItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
              onClick={onNavigate}
            />
          ))}
        </div>
      </nav>

      {/* Bottom: collapse toggle + logout */}
      <div className="shrink-0 border-t border-[rgba(255,255,255,0.08)] p-2 flex flex-col gap-0.5">
        {/* Logout */}
        <button
          onClick={logout}
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[rgba(255,255,255,0.5)] transition-all duration-150 hover:bg-red-500/10 hover:text-red-400",
            collapsed ? "justify-center px-2" : ""
          )}
        >
          <LogOut className="size-[18px] shrink-0 group-hover:text-red-400" aria-hidden="true" />
          {!collapsed && "Logout"}
        </button>

        {/* Collapse toggle (desktop only) */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[rgba(255,255,255,0.35)] transition-all duration-150 hover:bg-[rgba(255,255,255,0.08)] hover:text-white",
              collapsed ? "justify-center px-2" : ""
            )}
          >
            {collapsed
              ? <ChevronRight className="size-[18px] shrink-0" aria-hidden="true" />
              : <><ChevronLeft className="size-[18px] shrink-0" aria-hidden="true" /><span>Collapse</span></>
            }
          </button>
        )}
      </div>
    </div>
  );
}

interface AdminSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function AdminSidebar({ mobileOpen, onMobileClose }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 shadow-2xl transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "var(--color-navy-900)" }}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-brand-600">
              <Headphones className="size-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">ITSM</p>
              <p className="text-[10px] text-[rgba(255,255,255,0.5)]">Admin Console</p>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="rounded p-1 text-[rgba(255,255,255,0.5)] hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="h-[calc(100%-56px)] overflow-hidden">
          <AdminSidebarContent collapsed={false} onNavigate={onMobileClose} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col shrink-0 transition-all duration-200",
          collapsed ? "w-16" : "w-60"
        )}
        style={{ background: "var(--color-navy-900)", minHeight: "calc(100vh - 56px)" }}
      >
        <AdminSidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </aside>
    </>
  );
}
