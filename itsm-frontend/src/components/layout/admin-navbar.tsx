"use client";

import Link from "next/link";
import { Menu, ChevronDown, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/hooks/use-auth";
import { resolveAssetUrl } from "@/lib/api/client";

interface AdminNavbarProps {
  onMenuClick: () => void;
}

export function AdminNavbar({ onMenuClick }: AdminNavbarProps) {
  const { user, logout } = useAuth();
  const initials = (user?.fullName ?? "A")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className="sticky top-0 z-30 flex h-[46px] items-center justify-between px-4 md:px-6 shadow-sm"
      style={{ background: "var(--color-navy-950)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.1)] hover:text-white lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </button>
        <span className="hidden items-center gap-1.5 rounded-full border border-brand-600/40 bg-brand-600/10 px-3 py-0.5 text-xs font-semibold text-brand-400 sm:flex">
          <span className="size-1.5 rounded-full bg-brand-500 animate-pulse text-white" />
          Admin Console
        </span>
      </div>

      {/* Right: user dropdown */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 text-sm hover:bg-[rgba(255,255,255,0.1)] transition-colors">
              <Avatar className="size-8">
                <AvatarImage src={user?.profilePhotoUrl ? resolveAssetUrl(user.profilePhotoUrl) : undefined} alt="" />
                <AvatarFallback className="bg-brand-600 text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold text-white leading-none">{user?.fullName ?? "Admin"}</p>
                <p className="text-[10px] text-[rgba(255,255,255,0.45)] leading-none mt-0.5 truncate max-w-35">
                  {user?.email ?? "—"}
                </p>
              </div>
              <ChevronDown className="hidden size-3.5 text-[rgba(255,255,255,0.4)] sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2.5 py-1.5">
              <p className="text-sm font-medium text-slate-900">{user?.fullName ?? "Admin"}</p>
              <p className="truncate text-xs text-slate-500">{user?.email ?? "—"}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User className="size-4" />
                My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild destructive>
              <button className="w-full flex items-center gap-2" onClick={logout}>
                <LogOut className="size-4" />
                Logout
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
