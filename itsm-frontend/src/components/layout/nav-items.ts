import {
  Home, FilePlus2, ClipboardList, BookOpen, ShoppingCart,
  CheckSquare, UserCircle, Bell, Users, Shield, Tag, LayoutGrid,
  GitBranch, Settings, AlertTriangle, TrendingUp, Zap, MapPin,
  Group, Layers, Activity,
} from "lucide-react";

export const primaryNavItems = [
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

export const adminNavItems = [
  { label: "Status",           href: "/admin/status",           icon: Activity },
  { label: "Category",         href: "/admin/categories",       icon: Tag },
  { label: "Sub Category",     href: "/admin/sub-category",     icon: Layers },
  { label: "Priority",         href: "/admin/priority",         icon: AlertTriangle },
  { label: "Impact",           href: "/admin/impact",           icon: TrendingUp },
  { label: "Urgency",          href: "/admin/urgency",          icon: Zap },
  { label: "Assignment Group", href: "/admin/assignment-group", icon: Group },
  { label: "Location",         href: "/admin/location",         icon: MapPin },
  { label: "Users",            href: "/admin/users",            icon: Users },
  { label: "Roles",            href: "/admin/roles",            icon: Shield },
  { label: "Catalogs",         href: "/admin/catalogs",         icon: Settings },
  { label: "Workflows",        href: "/admin/workflows",        icon: GitBranch },
] as const;
