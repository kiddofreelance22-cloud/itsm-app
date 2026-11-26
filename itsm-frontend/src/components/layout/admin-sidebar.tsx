"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ElementType, useState } from "react";
import {
  Headphones, LogOut, ChevronDown, ChevronLeft, ChevronRight, X,
  ClipboardList, LayoutGrid, Settings, ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/use-auth";
import { adminNavItems } from "./nav-items";

// Two-column horizontal layout structure
interface NavItem {
  label: string;
  href: string;
  indent?: boolean;
}

interface NavSection {
  label: string;
  icon: ElementType;
  items?: NavItem[];
  subsections?: { label: string; items: NavItem[] }[];
}

const configurationSections = [
  {
    label: "Incident Masters",
    items: [
      { label: "Categories", href: "/admin/categories" },
      { label: "Sub-categories", href: "/admin/sub-category" },
      { label: "Status", href: "/admin/status" },
      { label: "Assignment Groups", href: "/admin/assignment-group" },
      { label: "Closure Codes", href: "/admin/closure-code" },
      { label: "Pending Reasons", href: "/admin/pending-reason" },
    ],
  },
  {
    label: "Incident SLA Configurations",
    items: [
      { label: "Impact", href: "/admin/impact" },
      { label: "Priority", href: "/admin/priority" },
      { label: "Priority Matrix", href: "/admin/priority-matrix" },
      { label: "SLA Service Window", href: "/admin/sla-service-window" },
      { label: "Urgency", href: "/admin/urgency" },
    ],
  },
  {
    label: "Service Request Masters",
    items: [
      { label: "Service Categories", href: "/admin/service-category" },
      { label: "Service Completion", href: "/admin/service-completion" },
    ],
  },
  {
    label: "Service SLA Configurations",
    items: [
      { label: "Service Impact", href: "/admin/service-impact" },
      { label: "Service Priority", href: "/admin/service-priority" },
      { label: "Service Urgency", href: "/admin/service-urgency" },
      { label: "Service SLA Window", href: "/admin/request-sla-service-window" },
      { label: "Service Pending Reasons", href: "/admin/request-pending-reason" },
    ],
  },
  {
    label: "User Management",
    items: [
      { label: "Users", href: "/admin/users" },
      { label: "Roles", href: "/admin/roles" },
      { label: "Departments", href: "/admin/departments" },
      { label: "Locations", href: "/admin/location" },
    ],
  },
  {
    label: "Workflow Management",
    items: [{ label: "Workflows", href: "/admin/workflows" }],
  },
];

const moduleItems = adminNavItems
  .filter(({ label }) => !["Dashboard", "Reports", "Incident", "Admin"].includes(label))
  .map(({ label, href }) => ({ label, href }));

const menuSections: NavSection[] = [
  {
    label: "Manage Incidents",
    icon: ClipboardList,
    items: [
      { label: "Incident List", href: "/admin/incident/incident-list" },
      { label: "New Incident for User", href: "/admin/incident/create" },
    ],
  },
  {
    label: "Manage Service Requests",
    icon: ShoppingCart,
    items: [
      { label: "Service Request List", href: "/admin/request/request-list" },
      { label: "New Service Request", href: "/admin/request/create" },
    ],
  },
  { label: "Configuration", icon: Settings, subsections: configurationSections },
  {
    label: "Other Modules",
    icon: LayoutGrid,
    items: [
      { label: "Dashboard", href: "/admin/dashboard" },
      { label: "Reports", href: "/admin/reports" },
      ...moduleItems,
    ],
  },
];

interface NavItemProps {
  href: string;
  label: string;
  collapsed: boolean;
  onClick?: () => void;
}

function NavItem({ href, label, collapsed, onClick }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2 border-l-[3px] border-transparent px-3 py-[7px] text-[12.5px] font-medium transition-all duration-150",
        collapsed ? "justify-center px-2" : "",
        isActive
          ? "border-brand-600 bg-brand-100 font-bold text-brand-600"
          : "text-[#101828] font-medium hover:bg-brand-50 hover:text-black"
      )}
    >
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

interface SectionProps {
  section: NavSection;
  collapsed: boolean;
  onNavigate?: () => void;
}

function Section({ section, collapsed, onNavigate }: SectionProps) {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();
  const { icon: Icon } = section;

  const hasActiveItem = (section.items?.some(item => pathname === item.href || pathname.startsWith(item.href + "/")) ?? false) ||
    (section.subsections?.some(sub => sub.items.some(item => pathname === item.href || pathname.startsWith(item.href + "/"))) ?? false);

  if (collapsed) {
    const firstItem = section.items?.[0] ?? section.subsections?.[0]?.items[0];
    return (
      <div className="flex flex-col items-center py-2">
        <Link
          href={firstItem?.href ?? "/admin"}
          onClick={onNavigate}
          title={section.label}
          aria-label={section.label}
          className="flex items-center justify-center rounded-lg p-2 text-[#667085] hover:bg-brand-50 hover:text-brand-600 transition-colors"
        >
          <Icon className="size-5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 border-t border-[#edeff2] px-3 py-3 text-[10.5px] font-extrabold uppercase tracking-[0.6px] transition-all duration-150",
          hasActiveItem
            ? "text-brand-600 font-black"
            : "text-[#101828] font-black hover:bg-brand-50 hover:text-black"
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform duration-150",
            expanded ? "rotate-180" : ""
          )}
        />
      </button>

      {expanded && (
        <div className="ml-2 mt-1 flex flex-col gap-0.5">
          {section.items?.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              collapsed={collapsed}
              onClick={onNavigate}
            />
          ))}

          {section.subsections?.map((subsection) => (
            <div key={subsection.label} className="mt-2">
              <p className="px-3 py-1 text-[11px] font-black uppercase tracking-[0.6px] text-[#101828]">
                {subsection.label}
              </p>
              {subsection.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  collapsed={collapsed}
                  onClick={onNavigate}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
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
    <div className="flex h-full flex-col border-r border-[#d5dae1] bg-white">
      {/* Logo strip */}
      <div
        className={cn(
          "flex h-[46px] shrink-0 items-center border-b border-[#edeff2]",
          collapsed ? "justify-center px-2" : "gap-2.5 px-4"
        )}
      >
        <div className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-brand-600">
          <Headphones className="size-3.5 text-white" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-[13px] font-bold tracking-wide text-[#1d2433]">Meridian</p>
            <p className="text-[10px] font-medium text-[#98a2b3]">Admin Console</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav
        aria-label="Admin navigation"
        className="flex-1 overflow-y-auto p-2 thin-scrollbar"
      >
        <div className="flex flex-col gap-1">
          {menuSections.map((section) => (
            <Section
              key={section.label}
              section={section}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </nav>

      {/* Bottom: collapse toggle + logout */}
      <div className="shrink-0 border-t border-[#edeff2] p-2 flex flex-col gap-0.5">
        <button
          onClick={logout}
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "group flex items-center gap-2 border-l-[3px] border-transparent px-3 py-[7px] text-[12.5px] font-medium text-[#667085] transition-all duration-150 hover:bg-red-50 hover:text-red-600",
            collapsed ? "justify-center px-2" : ""
          )}
        >
          <LogOut className="size-4.5 shrink-0 group-hover:text-red-400" aria-hidden="true" />
          {!collapsed && "Logout"}
        </button>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center gap-2 border-l-[3px] border-transparent px-3 py-[7px] text-[12.5px] font-medium text-[#667085] transition-all duration-150 hover:bg-brand-50 hover:text-[#344054]",
              collapsed ? "justify-center px-2" : ""
            )}
          >
            {collapsed
              ? <ChevronRight className="size-4.5 shrink-0" aria-hidden="true" />
              : <><ChevronLeft className="size-4.5 shrink-0" aria-hidden="true" /><span>Collapse</span></>
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
        <div className="flex h-[46px] items-center justify-between px-4 border-b border-[rgba(255,255,255,0.08)]">
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
        <div className="h-[calc(100%-46px)] overflow-hidden">
          <AdminSidebarContent collapsed={false} onNavigate={onMobileClose} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col shrink-0 transition-all duration-200",
          collapsed ? "w-16" : "w-60"
        )}
        style={{ background: "var(--color-navy-900)", minHeight: "calc(100vh - 46px)" }}
      >
        <AdminSidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </aside>
    </>
  );
}
