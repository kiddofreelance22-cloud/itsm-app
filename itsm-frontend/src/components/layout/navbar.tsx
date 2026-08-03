"use client";

import Link from "next/link";
import { Headphones, Bell, HelpCircle, ChevronDown, Menu, User, Settings, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/hooks/use-auth";

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { user, logout } = useAuth();
  const initials = (user?.fullName ?? "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-navy-900 px-4 text-white md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-[rgba(255,255,255,0.8)] hover:bg-[rgba(255,255,255,0.1)] hover:text-white md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/home" className="flex items-center gap-2.5">
          <Headphones className="size-6 shrink-0" aria-hidden="true" />
          <span className="leading-tight">
            <span className="block text-base font-bold tracking-wide">ITSM</span>
            <span className="hidden text-[11px] font-medium text-[rgba(255,255,255,0.7)] sm:block">
              Incident Management System
            </span>
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Link
          href="/notifications"
          className="relative rounded-md p-2 text-[rgba(255,255,255,0.85)] hover:bg-[rgba(255,255,255,0.1)] hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
        </Link>
        <button
          className="hidden rounded-md p-2 text-[rgba(255,255,255,0.85)] hover:bg-[rgba(255,255,255,0.1)] hover:text-white sm:block"
          aria-label="Help"
        >
          <HelpCircle className="size-5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 text-sm hover:bg-[rgba(255,255,255,0.1)]">
              <Avatar className="size-8">
                <AvatarFallback className="bg-white text-navy-900">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden font-medium sm:inline">{user?.fullName ?? "User"}</span>
              <ChevronDown className="hidden size-4 text-[rgba(255,255,255,0.7)] sm:inline" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2.5 py-1.5">
              <p className="text-sm font-medium text-slate-900">{user?.fullName ?? "User"}</p>
              <p className="truncate text-xs text-slate-500">{user?.email ?? "—"}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User className="size-4" /> My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/notifications">
                <Settings className="size-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild destructive>
              <button className="w-full flex items-center gap-2" onClick={logout}>
                <LogOut className="size-4" /> Logout
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
