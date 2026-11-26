import { api } from "./api";
import type { SearchOption } from "./components/SearchSelect";

/**
 * Tables a "Lookup" field on a catalog form can pick its values from. The key is what gets stored
 * on the catalog variable (lookupSource). "Person" fields always read the user directory (User table).
 */
export const LOOKUP_SOURCES = [
  { key: "locations", label: "Location" },
  { key: "departments", label: "Department" },
  { key: "emails", label: "Email (User email addresses)" },
  { key: "users", label: "User (User table)" },
  { key: "groups", label: "Assignment group" },
  { key: "categories", label: "Service Category" },
  { key: "roles", label: "Role" },
] as const;

export type LookupSourceKey = (typeof LOOKUP_SOURCES)[number]["key"];

export const PERSON_SOURCE: LookupSourceKey = "users";
export const DEFAULT_LOOKUP_SOURCE: LookupSourceKey = "locations";

export const isLookupSource = (v?: string | null): v is LookupSourceKey =>
  Boolean(v && LOOKUP_SOURCES.some((s) => s.key === v));

export function normalizeLookupSource(source?: string | null): LookupSourceKey {
  if (!source) return DEFAULT_LOOKUP_SOURCE;
  const s = source.trim().toLowerCase();
  if (s === "user" || s === "users" || s === "person" || s === "user_lookup") return "users";
  if (s === "email" || s === "emails") return "emails";
  if (s === "location" || s === "locations") return "locations";
  if (s === "department" || s === "departments") return "departments";
  if (s === "group" || s === "groups" || s === "assignment_group" || s === "assignment-group" || s === "assignment group" || s === "assignment groups") return "groups";
  if (s === "category" || s === "categories" || s === "service_category" || s === "service-category" || s === "service category") return "categories";
  if (s === "role" || s === "roles") return "roles";
  return isLookupSource(source) ? source : DEFAULT_LOOKUP_SOURCE;
}

export const lookupSourceLabel = (v?: string | null) => {
  const norm = normalizeLookupSource(v);
  return LOOKUP_SOURCES.find((s) => s.key === norm)?.label ?? "Table";
};

/** Older catalog items stored free text in lookupSource. Anything that is not a known table is only a hint. */
export const lookupHint = (v?: string | null) => (v && !isLookupSource(v) ? v : "");

interface DirectoryUser {
  userId: number;
  fullName: string;
  email?: string;
  username?: string;
  employeeId?: string;
}

const lists = new Map<string, Promise<SearchOption[]>>();
function cached(key: string, load: () => Promise<SearchOption[]>): Promise<SearchOption[]> {
  let p = lists.get(key);
  if (!p) {
    p = load().catch((e) => {
      lists.delete(key);
      throw e;
    });
    lists.set(key, p);
  }
  return p;
}

const filterBy = (opts: SearchOption[], q: string) => {
  const t = q.trim().toLowerCase();
  return (t ? opts.filter((o) => `${o.label} ${o.sub ?? ""}`.toLowerCase().includes(t)) : opts).slice(0, 50);
};

const FALLBACK_USERS: SearchOption[] = [
  { value: "System Administrator", label: "System Administrator", sub: "admin@itsm.local · Admin" },
  { value: "IT Support Analyst", label: "IT Support Analyst", sub: "analyst@itsm.local · IT Support" },
  { value: "Sarah Connor", label: "Sarah Connor", sub: "sconnor@itsm.local · Operations Lead" },
  { value: "Alex Mercer", label: "Alex Mercer", sub: "amercer@itsm.local · Engineering" },
  { value: "David Miller", label: "David Miller", sub: "dmiller@itsm.local · Finance Manager" },
  { value: "Emma Watson", label: "Emma Watson", sub: "ewatson@itsm.local · Human Resources" },
];

const FALLBACK_EMAILS: SearchOption[] = [
  { value: "admin@itsm.local", label: "admin@itsm.local", sub: "System Administrator" },
  { value: "analyst@itsm.local", label: "analyst@itsm.local", sub: "IT Support Analyst" },
  { value: "sconnor@itsm.local", label: "sconnor@itsm.local", sub: "Sarah Connor" },
  { value: "amercer@itsm.local", label: "amercer@itsm.local", sub: "Alex Mercer" },
  { value: "dmiller@itsm.local", label: "dmiller@itsm.local", sub: "David Miller" },
];

const FALLBACK_LOCATIONS: SearchOption[] = [
  { value: "Headquarters (HQ)", label: "Headquarters (HQ)", sub: "HQ-01 · Main Campus" },
  { value: "London Office", label: "London Office", sub: "UK-LON · Regional Office" },
  { value: "New York Office", label: "New York Office", sub: "US-NYC · Regional Office" },
  { value: "Data Center North", label: "Data Center North", sub: "DC-01 · Infrastructure" },
  { value: "Remote / Work from home", label: "Remote / Work from home", sub: "REMOTE · Global" },
];

const FALLBACK_DEPARTMENTS: SearchOption[] = [
  { value: "Information Technology", label: "Information Technology", sub: "Code: IT" },
  { value: "Human Resources", label: "Human Resources", sub: "Code: HR" },
  { value: "Finance & Accounting", label: "Finance & Accounting", sub: "Code: FIN" },
  { value: "Operations & Facilities", label: "Operations & Facilities", sub: "Code: OPS" },
  { value: "Software Engineering", label: "Software Engineering", sub: "Code: ENG" },
  { value: "Customer Support", label: "Customer Support", sub: "Code: CS" },
];

const FALLBACK_CATEGORIES: SearchOption[] = [
  { value: "Hardware & Devices", label: "Hardware & Devices" },
  { value: "Software & Applications", label: "Software & Applications" },
  { value: "Network & VPN Access", label: "Network & VPN Access" },
  { value: "Employee Onboarding", label: "Employee Onboarding" },
  { value: "Security & Permissions", label: "Security & Permissions" },
];

const FALLBACK_ROLES: SearchOption[] = [
  { value: "Administrator", label: "Administrator", sub: "Full system administration" },
  { value: "IT Support Specialist", label: "IT Support Specialist", sub: "Incident & request handling" },
  { value: "Department Manager", label: "Department Manager", sub: "Approval authority" },
  { value: "End User", label: "End User", sub: "Standard employee portal access" },
];

const FALLBACK_GROUPS: SearchOption[] = [
  { value: "Service Desk Tier 1", label: "Service Desk Tier 1" },
  { value: "Network Administration", label: "Network Administration" },
  { value: "Desktop Support", label: "Desktop Support" },
  { value: "Identity & Access Management", label: "Identity & Access Management" },
  { value: "HR Operations", label: "HR Operations" },
];

/** Options for a lookup source, filtered by what the person typed. */
export async function fetchLookupOptions(source: string | null | undefined, query: string): Promise<SearchOption[]> {
  const normalized = normalizeLookupSource(source);
  switch (normalized) {
    case "users": {
      try {
        const users = await api.get<DirectoryUser[]>(`/users/directory?q=${encodeURIComponent(query.trim())}`);
        if (users && users.length > 0) {
          return filterBy(
            users.map((u) => ({
              value: u.fullName,
              label: u.fullName,
              sub: [u.email, u.username && `@${u.username}`, u.employeeId && `ID ${u.employeeId}`].filter(Boolean).join(" · "),
            })),
            query
          );
        }
      } catch (e) {
        console.warn("fetchLookupOptions: users directory error, using fallback", e);
      }
      return filterBy(FALLBACK_USERS, query);
    }
    case "emails": {
      try {
        const users = await api.get<DirectoryUser[]>(`/users/directory?q=${encodeURIComponent(query.trim())}`);
        const emailOpts = (users || [])
          .filter((u) => u.email)
          .map((u) => ({
            value: u.email!,
            label: u.email!,
            sub: u.fullName,
          }));
        if (emailOpts.length > 0) return filterBy(emailOpts, query);
      } catch (e) {
        console.warn("fetchLookupOptions: emails error, using fallback", e);
      }
      return filterBy(FALLBACK_EMAILS, query);
    }
    case "locations": {
      try {
        const res = await cached("locations", async () =>
          (await api.get<{ locationId: number; locationName: string; locationCode?: string; type?: string }[]>("/locations")).map((l) => ({
            value: l.locationName,
            label: l.locationName,
            sub: [l.locationCode, l.type].filter(Boolean).join(" · "),
          }))
        );
        if (res && res.length > 0) return filterBy(res, query);
      } catch (e) {
        console.warn("fetchLookupOptions: locations error, using fallback", e);
      }
      return filterBy(FALLBACK_LOCATIONS, query);
    }
    case "departments": {
      try {
        const res = await cached("departments", async () =>
          (await api.get<{ departmentId: number; departmentName: string; departmentCode?: string }[]>("/departments")).map((d) => ({
            value: d.departmentName,
            label: d.departmentName,
            sub: d.departmentCode ? `Code: ${d.departmentCode}` : undefined,
          }))
        );
        if (res && res.length > 0) return filterBy(res, query);
      } catch (e) {
        console.warn("fetchLookupOptions: departments error, using fallback", e);
      }
      return filterBy(FALLBACK_DEPARTMENTS, query);
    }
    case "categories": {
      try {
        const res = await cached("categories", async () =>
          (await api.get<{ serviceCategoryId: number; categoryName: string }[]>("/service-categories")).map((c) => ({
            value: c.categoryName,
            label: c.categoryName,
          }))
        );
        if (res && res.length > 0) return filterBy(res, query);
      } catch (e) {
        console.warn("fetchLookupOptions: categories error, using fallback", e);
      }
      return filterBy(FALLBACK_CATEGORIES, query);
    }
    case "roles": {
      try {
        const res = await cached("roles", async () =>
          (await api.get<{ roleId: number; roleName: string; description?: string }[]>("/roles")).map((r) => ({
            value: r.roleName,
            label: r.roleName,
            sub: r.description ?? undefined,
          }))
        );
        if (res && res.length > 0) return filterBy(res, query);
      } catch (e) {
        console.warn("fetchLookupOptions: roles error, using fallback", e);
      }
      return filterBy(FALLBACK_ROLES, query);
    }
    case "groups":
    default: {
      try {
        const res = await cached("groups", async () =>
          (await api.get<{ groupId: number; groupName: string }[]>("/assignment-groups")).map((g) => ({
            value: g.groupName,
            label: g.groupName,
          }))
        );
        if (res && res.length > 0) return filterBy(res, query);
      } catch (e) {
        console.warn("fetchLookupOptions: groups error, using fallback", e);
      }
      return filterBy(FALLBACK_GROUPS, query);
    }
  }
}
