"use client";

import Link from "next/link";
import { type ElementType } from "react";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { primaryNavItems } from "./nav-items";
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
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, logout } = useAuth();

  return (
    <div className="flex h-full flex-col justify-between">
      <nav aria-label="Primary" className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
        {primaryNavItems.map((item) => (
          <NavLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <LogOut className="size-[18px]" aria-hidden="true" />
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
        "fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-xl transition-transform duration-200 lg:hidden",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4">
          <span className="font-semibold text-slate-900">Menu</span>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x size-5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <SidebarContent onNavigate={onClose} />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-slate-100 bg-white lg:block" style={{ minHeight: "calc(100vh - 56px)" }}>
        <SidebarContent />
      </aside>
    </>
  );
}
