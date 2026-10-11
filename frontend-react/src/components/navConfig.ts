import type { LucideIcon } from "lucide-react";
import { ClipboardList, FilePlus2, Inbox, LayoutDashboard, Settings } from "lucide-react";

export interface NavigationItem {
  label: string;
  to: string;
  icon?: LucideIcon;
}

export interface NavigationSubgroup {
  title: string;
  items: NavigationItem[];
}

export interface FlatSection {
  title: string;
  items: NavigationItem[];
}

export interface CollapsibleGroup {
  title: string;
  icon: LucideIcon;
  subgroups: NavigationSubgroup[];
}


export type NavRole = "END_USER" | "RESOLVER" | "ADMIN" | string | undefined;

/** The menu each role starts with, before any Role > Navigation Access restrictions are applied. */
export function buildNav(role: NavRole): { flatSections: FlatSection[]; configGroup: CollapsibleGroup | null } {
  const user = { role };
  // Flat sections that are always visible (like prototype: USER, MANAGE INCIDENTS)
  const flatSections: FlatSection[] = user?.role === "END_USER"
    ? [
        {
          title: "USER",
          items: [
            { label: "My Dashboard", to: "/my-dashboard" },
            { label: "My Incidents", to: "/my-incidents" },
            { label: "Service Requests", to: "/service-requests" },
            { label: "My Requests", to: "/service-requests/my-requests" },
            { label: "New Incident", to: "/new-incident" },
            { label: "Feedback Moderation", to: "/feedback" },
            { label: "Approve Incident Records", to: "/approvals" },
          ],
        },
      ]
    : user?.role === "RESOLVER"
    ? [
        {
          title: "ANALYST WORKSPACE",
          items: [
            { label: "Analyst Dashboard", to: "/resolver-dashboard", icon: LayoutDashboard },
            { label: "Service Catalog", to: "/service-requests" },
            { label: "My Service Requests", to: "/service-requests/my-requests", icon: ClipboardList },
            { label: "Incident List", to: "/incidents", icon: ClipboardList },
            { label: "Incident Queue", to: "/incident-queue", icon: Inbox },
            { label: "Create Incident", to: "/new-incident-for-user", icon: FilePlus2 },
            { label: "Work Orders", to: "/work-orders", icon: ClipboardList },
            { label: "Feedback Moderation", to: "/feedback" },
            { label: "My Approvals", to: "/approvals", icon: ClipboardList },
          ],
        },
      ]
    : user?.role === "ADMIN"
    ? [
        {
          title: "MANAGE INCIDENTS",
          items: [
            { label: "Admin Dashboard", to: "/admin-dashboard" },
            { label: "Resolver Dashboard", to: "/resolver-dashboard" },
            { label: "Service Requests", to: "/admin/requests" },
            { label: "Service Catalog", to: "/admin/catalogs" },
            { label: "Incident List", to: "/incidents" },
            { label: "New Incident for User", to: "/new-incident-for-user" },
            { label: "Work Order List", to: "/work-orders" },
            { label: "Feedback Moderation", to: "/feedback" },
            { label: "Approve Incident Records", to: "/approvals" },
          ],
        },
      ]
    : [];

  // Collapsible CONFIGURATION group (admin only)
  const configGroup: CollapsibleGroup | null = user?.role === "ADMIN"
    ? {
        title: "CONFIGURATION",
        icon: Settings,
        subgroups: [
          {
            title: "Incident Masters",
            items: [
              { label: "Category", to: "/config/admin/categories" },
              { label: "Classification", to: "/config/admin/classification" },
              { label: "Incident Work Order Checklist", to: "/config/admin/checklist" },
              { label: "Checklist", to: "/config/admin/checklists" },
              { label: "Closure Code", to: "/config/admin/closure-code" },
              { label: "Log Incident Page", to: "/config/admin/log-incident-page" },
              { label: "End User Incident Details Page", to: "/config/field-visibility" },
              { label: "Mandatory Field Rules", to: "/config/admin/mandatory-field-rules" },
              { label: "On Hold Reason", to: "/config/admin/on-hold-reasons" },
              { label: "Pending Reason", to: "/config/admin/pending-reason" },
              { label: "Resolution Code", to: "/config/admin/resolution-code" },
            ],
          },
          {
            title: "SLA Configurations",
            items: [
              { label: "Impact", to: "/config/admin/impact" },
              { label: "SLA Matrix By CI", to: "/config/admin/sla-matrix-by-ci" },
              { label: "Priority", to: "/config/admin/priority" },
              { label: "Priority Matrix", to: "/config/admin/priority-matrix" },
              { label: "Workgroup SLA Window", to: "/config/admin/workgroup-sla" },
              { label: "SLA Service Window", to: "/config/admin/sla-service-window" },
              { label: "SLA Matrix", to: "/config/admin/sla-matrix" },
              { label: "Urgency", to: "/config/admin/urgency" },
            ],
          },
          {
            title: "TFS",
            items: [
              { label: "TFS Configuration", to: "#tfs-config" },
              { label: "Work Item Field Configuration", to: "#work-item" },
              { label: "Value to Value Mapping", to: "#value-mapping" },
              { label: "Profile Mapping", to: "#profile-mapping" },
              { label: "TFS Profile Mapping", to: "#tfs-profile" },
            ],
          },
          {
            title: "Others",
            items: [
              { label: "Cost Configuration", to: "#cost-config" },
              { label: "Feedback Configuration", to: "#feedback-config" },
              { label: "ETR E-mail Notification", to: "#etr" },
              { label: "Status Configuration", to: "/config/admin/status" },
              { label: "Status Transition Matrix", to: "/config/admin/status-transitions" },
              { label: "E-mail Notification", to: "/config/admin/email-notification" },
              { label: "SMS Notification", to: "#sms" },
              { label: "Voice Call Notification", to: "#voice" },
              { label: "Information Ticker", to: "#ticker" },
              { label: "Major Incident", to: "#major-incident" },
              { label: "Rule", to: "#rule" },
              { label: "User Type", to: "#user-type" },
              { label: "Auto Work Order Configuration", to: "#auto-work-order" },
              { label: "Standard Operating Procedure (SOP)", to: "#sop" },
              { label: "Evaluator Configuration", to: "#evaluator" },
              { label: "Approver Group Configuration", to: "#approver-group" },
              { label: "Approval Configuration", to: "/config/admin/approval-config" },
              { label: "Workgroup", to: "/config/admin/workgroups" },
            ],
          },
          {
            title: "User Management",
            items: [
              { label: "Users", to: "/config/admin/users" },
              { label: "Create New User", to: "/config/admin/users/create" },
              { label: "Roles", to: "/config/admin/roles" },
              { label: "Location", to: "/config/admin/locations" },
            ],
          },
          {
            title: "Directory Integration",
            items: [
              { label: "Directory Settings", to: "/config/admin/directory-settings" },
              { label: "Attribute Mapping", to: "/config/admin/attribute-mapping" },
              { label: "Sync History", to: "/config/admin/sync-history" },
            ],
          },
        ],
      }
    : null;


  return { flatSections, configGroup };
}

/** Every item any role can reach, grouped by section — used by Roles > Navigation Access. */
export function allNavSections(): FlatSection[] {
  const seen = new Set<string>();
  const out: FlatSection[] = [];
  for (const role of ["END_USER", "RESOLVER", "ADMIN"]) {
    const { flatSections, configGroup } = buildNav(role);
    const sections: FlatSection[] = [
      ...flatSections,
      ...(configGroup ? configGroup.subgroups.map((g) => ({ title: `Configuration › ${g.title}`, items: g.items })) : []),
    ];
    for (const sec of sections) {
      const items = sec.items.filter((i) => i.to.startsWith("/") && !seen.has(i.to));
      items.forEach((i) => seen.add(i.to));
      if (!items.length) continue;
      const existing = out.find((o) => o.title === sec.title);
      if (existing) existing.items.push(...items); else out.push({ title: sec.title, items });
    }
  }
  return out;
}

/**
 * Menu for a non-admin user whose role has Navigation Access configured: it is built
 * from the items ticked on the role, across ALL screens, instead of trimming the
 * built-in menu of the user's base role. This is what lets a custom role such as
 * "IT Engineer" see exactly what an admin ticked, even if it matches no built-in menu.
 */
export function buildNavFromAllowed(
  allowed: Set<string>,
  alwaysKeep: string[] = [],
): { flatSections: FlatSection[]; configGroup: CollapsibleGroup | null } {
  const keep = (to: string) => allowed.has(to) || alwaysKeep.includes(to);
  const flatSections: FlatSection[] = [];
  const subgroups: NavigationSubgroup[] = [];
  for (const sec of allNavSections()) {
    const items = sec.items.filter((i) => keep(i.to));
    if (!items.length) continue;
    if (sec.title.startsWith("Configuration › ")) subgroups.push({ title: sec.title.replace("Configuration › ", ""), items });
    else flatSections.push({ title: sec.title, items });
  }
  return {
    flatSections,
    configGroup: subgroups.length ? { title: "CONFIGURATION", icon: Settings, subgroups } : null,
  };
}
