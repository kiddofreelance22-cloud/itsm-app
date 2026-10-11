import {
  Home, FilePlus2, ClipboardList, BookOpen, ShoppingCart,
  CheckSquare, UserCircle, Bell, Users, Shield, Tag, LayoutGrid,
  GitBranch, Settings, AlertTriangle, TrendingUp, Zap, MapPin,
  Group, Activity, Inbox, LayoutDashboard, UsersRound,
  BarChart2, Monitor, Phone, Package, Database,
  Cog, Brain, Puzzle, Repeat, Gauge, Briefcase, User,
} from "lucide-react";

// Shown to End Users (requesters) — raising and tracking their own tickets.
export const requesterNavItems = [
  { label: "Home",            href: "/home",                         icon: Home },
  { label: "Create Incident", href: "/incidents/create",             icon: FilePlus2 },
  { label: "My Incidents",    href: "/incidents",                    icon: ClipboardList },
  { label: "Knowledge Base",  href: "/knowledge-base",               icon: BookOpen },
  { label: "Service Catalog", href: "/service-requests",             icon: ShoppingCart },
  { label: "My Requests",     href: "/service-requests/my-requests", icon: LayoutGrid },
  { label: "My Approvals",    href: "/approvals",                    icon: CheckSquare },
  { label: "My Profile",      href: "/profile",                      icon: UserCircle },
  { label: "Notifications",   href: "/notifications",                icon: Bell },
] as const;

// Shown to IT Agent / IT Manager / Service Desk / Admin — working the queue.
export const analystNavItems = [
  { label: "Home",              href: "/home",                          icon: Home },
  { label: "Analyst Dashboard", href: "/analyst-dashboard",             icon: LayoutDashboard },
  { label: "Assigned to Me",    href: "/incidents/my-queue",            icon: Inbox },
  { label: "Incident Queue",    href: "/incidents/queue",               icon: Inbox },
  { label: "My Workgroups",     href: "/my-workgroups",                 icon: UsersRound },
  { label: "Incidents",         href: "/incidents",                     icon: ClipboardList },
  { label: "Create Incident",   href: "/incidents/create",              icon: FilePlus2 },
  { label: "Service Requests",  href: "/service-requests/my-requests",  icon: LayoutGrid },
  { label: "Service Catalog",   href: "/service-requests",              icon: ShoppingCart },
  { label: "My Approvals",      href: "/approvals",                     icon: CheckSquare },
  { label: "Knowledge Base",    href: "/knowledge-base",                icon: BookOpen },
  { label: "My Profile",        href: "/profile",                       icon: UserCircle },
  { label: "Notifications",     href: "/notifications",                 icon: Bell },
] as const;

// Kept for any existing imports; requester list is the historical default.
export const primaryNavItems = requesterNavItems;

// Admin sidebar top-level modules (Image 1)
export const adminNavItems = [
  { label: "Dashboard",      href: "/admin/dashboard",        icon: LayoutDashboard },
  { label: "Reports",        href: "/admin/reports",          icon: BarChart2 },
  { label: "IT Clinic",      href: "/admin/it-clinic",        icon: Monitor },
  { label: "Incident",       href: "/admin/incident",         icon: AlertTriangle },
  { label: "Call",           href: "/admin/call",             icon: Phone },
  { label: "Request",        href: "/admin/request",          icon: ClipboardList },
  { label: "Asset",          href: "/admin/asset",            icon: Package },
  { label: "Change",         href: "/admin/change",           icon: GitBranch },
  { label: "CMDB",           href: "/admin/cmdb",             icon: Database },
  { label: "Operations",     href: "/admin/operations",       icon: Cog },
  { label: "Orchestration",  href: "/admin/orchestration",    icon: Puzzle },
  { label: "Knowledge",      href: "/admin/knowledge",        icon: BookOpen },
  { label: "Problem",        href: "/admin/problem",          icon: Brain },
  { label: "Catalog",        href: "/admin/catalog",          icon: ShoppingCart },
  { label: "Release",        href: "/admin/release",          icon: Repeat },
  { label: "SLA",            href: "/admin/sla",              icon: Gauge },
  { label: "Portfolio",      href: "/admin/portfolio",        icon: Briefcase },
  { label: "Admin",          href: "/admin/users",            icon: User },
] as const;
