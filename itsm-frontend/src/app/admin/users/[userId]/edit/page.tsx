"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Camera, Eye, EyeOff, CheckCircle2, ChevronRight,
  X, Loader2, ExternalLink, Save, ChevronLeft,
  User, Lock, FileText, AlertTriangle, Info, ShieldAlert
} from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { MultiSelectDropdown } from "@/components/admin/multi-select-dropdown";
import { useAdminUsers, useAdminRoles } from "@/lib/hooks/use-admin";
import { useDepartments } from "@/lib/hooks/use-departments";
import { apiFetch } from "@/lib/api/client";
import { UsersApi, UpdateUserDto } from "@/lib/api/users.api";
import { RolesApi } from "@/lib/api/roles.api";
import { AssignmentGroupApi } from "@/lib/api/admin-modules.api";
import { AssignmentGroup, Role, AdminUser, Location } from "@/types/admin";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Tab = "contact" | "address" | "emergency" | "work";



function validatePassword(pw: string) {
  if (!pw) return { minLength: true, uppercase: true, number: true, special: true };
  return {
    minLength:   pw.length >= 8,
    uppercase:   /[A-Z]/.test(pw),
    number:      /[0-9]/.test(pw),
    special:     /[^A-Za-z0-9]/.test(pw),
  };
}

// ─── UI primitives ────────────────────────────────────────────────────────────

function Field({
  label, required, error, children, hint, className = "",
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode; hint?: string; className?: string;
}) {
  return (
    <div className={['space-y-1.5', className].filter(Boolean).join(' ')}>
      <label className="block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint  && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, type = "text", disabled, invalid, className = "",
  prefix, suffix,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; disabled?: boolean; invalid?: boolean;
  className?: string; prefix?: React.ReactNode; suffix?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 flex items-center text-slate-400 pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={[
          "w-full h-10 rounded-lg border bg-white text-sm text-slate-800 outline-none transition-all",
          "placeholder:text-slate-400 shadow-sm",
          "focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
          "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
          invalid ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-300",
          prefix  ? "pl-10" : "pl-3",
          suffix  ? "pr-10" : "pr-3",
          className,
        ].join(" ")}
      />
      {suffix && (
        <span className="absolute right-3 flex items-center">{suffix}</span>
      )}
    </div>
  );
}

function SelectInput({
  value, onChange, children, disabled, invalid, className = "",
}: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; disabled?: boolean; invalid?: boolean; className?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={[
          "w-full h-10 rounded-lg border bg-white text-sm text-slate-800 pl-3 pr-8",
          "appearance-none outline-none shadow-sm transition-all",
          "focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
          "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
          invalid ? "border-red-400" : "border-slate-300",
          className,
        ].filter(Boolean).join(" ")}
      >
        {children}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-3 size-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out focus:outline-none",
        "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-blue-600" : "bg-slate-200",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block size-5 rounded-full bg-white shadow ring-0",
          "transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

function SectionCard({ title, children, className = "", icon }: { title: string; children: React.ReactNode; className?: string, icon?: React.ReactNode }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200 uppercase tracking-wider text-[11px] font-bold text-slate-700">
        {icon && <span className="text-slate-400 flex items-center justify-center">{icon}</span>}
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = Number(params?.userId);
  
  const { roles } = useAdminRoles();
  const { departments } = useDepartments();
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [existingUser, setExistingUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [bizServices, setBizServices] = useState<string[]>([]);
  const [authTypes, setAuthTypes] = useState<string[]>([]);
  const [userTypes, setUserTypes] = useState<string[]>([]);
  const [landingPages, setLandingPages] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [dateFormats, setDateFormats] = useState<string[]>([]);
  const [timezones, setTimezones] = useState<string[]>([]);
  const [customAttrs, setCustomAttrs] = useState<Array<{ sourceAttr: string; targetField: string; sourceType?: string; description?: string }>>([]);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});

  // Load user data on mount
  useEffect(() => {
    if (!userId) return;
    Promise.all([
      UsersApi.getOne(userId),
      apiFetch<AssignmentGroup[]>("/assignment-groups").catch(() => []),
      // Pull from the single Location admin source (/admin/location) instead of
      // a separate hardcoded list, so this dropdown always matches what's configured there.
      apiFetch<Location[]>("/locations").catch(() => []),
      apiFetch<string[]>("/options/biz-services").catch(() => []),
      apiFetch<string[]>("/options/auth-types").catch(() => []),
      apiFetch<string[]>("/options/user-types").catch(() => []),
      apiFetch<string[]>("/options/landing-pages").catch(() => []),
      apiFetch<string[]>("/options/languages").catch(() => []),
      apiFetch<string[]>("/options/date-formats").catch(() => []),
      apiFetch<string[]>("/options/timezones").catch(() => []),
      apiFetch<any[]>("/directory/custom-attributes").catch(() => []),
    ])
      .then(([user, groups, locations, bs, at, ut, lp, l, df, tz, ca]) => {
        setExistingUser(user);
        setGroups(groups || []);
        setLocations(locations || []);
        setBizServices(bs || []);
        setAuthTypes(at || []);
        setUserTypes(ut || []);
        setLandingPages(lp || []);
        setLanguages(l || []);
        setDateFormats(df || []);
        setTimezones(tz || []);
        setCustomAttrs(ca || []);
      })
      .catch((err) => setLoadError(err?.message || "Failed to load user"))
      .finally(() => setLoading(false));
  }, [userId]);

  // ── Form state ────────────────────────────────────────────────────────────
  const [f, setF] = useState({
    firstName: "", lastName: "", displayName: "", email: "", phone: "",
    employeeId: "", jobTitle: "", departmentId: "", managerName: "",
    businessService: "", location: "", userType: "Internal" as any,
    username: "",
    password: "", confirmPassword: "",
    authType: "Internal" as any,
    ssoEnabled: false,
    passwordExpiryNever: false, passwordExpiryDays: "90",
    roleIds: [] as string[], assignmentGroupIds: [] as string[], defaultLandingPage: "My Dashboard",
    allowMobileAccess: true, allowApiAccess: false,
    allowLogin: true, reviewRequired: false,
    notes: "", language: "English (US)",
    dateFormat: "DD MMM YYYY (16 May 2025)",
    timeZone: "(GMT+05:30) Asia/Kolkata",
    isActive: true,
    workPhone: "", mobilePhone: "", alternateEmail: "",
    workAddress: "", city: "", state: "", country: "", postalCode: "",
    emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
    costCenter: "", building: "", floor: "", deskNumber: "",
  });

  // Populate form when user loads
  useEffect(() => {
    if (!existingUser) return;
    const resolvedDeptId = existingUser.departmentId
      ? String(existingUser.departmentId)
      : (existingUser.department?.departmentId ? String(existingUser.department.departmentId) : "");
    setF({
      firstName: existingUser.firstName || "",
      lastName: existingUser.lastName || "",
      displayName: existingUser.displayName || "",
      email: existingUser.email || "",
      phone: existingUser.phone || "",
      employeeId: existingUser.employeeId || "",
      jobTitle: existingUser.jobTitle || "",
      departmentId: resolvedDeptId,
      managerName: existingUser.managerName || "",
      businessService: existingUser.businessService || "",
      location: existingUser.location || "",
      userType: existingUser.userType || "Internal",
      username: existingUser.username,
      password: "",
      confirmPassword: "",
      authType: existingUser.authType || "Internal",
      ssoEnabled: existingUser.ssoEnabled || false,
      passwordExpiryNever: !existingUser.passwordExpiryDays,
      passwordExpiryDays: existingUser.passwordExpiryDays?.toString() || "90",
      roleIds: (existingUser.userRoles || []).map((ur) => String(ur.role.roleId)),
      assignmentGroupIds: groups.filter((g) => g.members?.some((m) => m.userId === existingUser.userId)).map((g) => String(g.groupId)),
      defaultLandingPage: existingUser.defaultLandingPage || "My Dashboard",
      allowMobileAccess: existingUser.allowMobileAccess || true,
      allowApiAccess: existingUser.allowApiAccess || false,
      allowLogin: existingUser.allowLogin !== false,
      reviewRequired: existingUser.reviewRequired || false,
      notes: existingUser.notes || "",
      language: existingUser.language || "English (US)",
      dateFormat: existingUser.dateFormat || "DD MMM YYYY (16 May 2025)",
      timeZone: existingUser.timeZone || "(GMT+05:30) Asia/Kolkata",
      isActive: existingUser.isActive,
      workPhone: existingUser.workPhone || "",
      mobilePhone: existingUser.mobilePhone || "",
      alternateEmail: existingUser.alternateEmail || "",
      workAddress: existingUser.workAddress || "",
      city: existingUser.city || "",
      state: existingUser.state || "",
      country: existingUser.country || "",
      postalCode: existingUser.postalCode || "",
      emergencyContactName: existingUser.emergencyContactName || "",
      emergencyContactPhone: existingUser.emergencyContactPhone || "",
      emergencyContactRelation: existingUser.emergencyContactRelation || "",
      costCenter: existingUser.costCenter || "",
      building: existingUser.building || "",
      floor: existingUser.floor || "",
      deskNumber: existingUser.deskNumber || "",
    });

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`user_custom_${existingUser.userId}`);
        if (raw) {
          setCustomFields(JSON.parse(raw));
        }
      } catch {}
    }
  }, [existingUser, groups]);

  const set = useCallback(<K extends keyof typeof f>(k: K, v: typeof f[K]) =>
    setF((p) => ({ ...p, [k]: v })), []);

  const [showPassword, setShowPassword]  = useState(false);
  const [showConfirm, setShowConfirm]    = useState(false);
  const [activeTab, setActiveTab]        = useState<Tab>("contact");
  const [errors, setErrors]              = useState<Partial<Record<string, string>>>({});
  const [submitting, setSubmitting]      = useState(false);
  // workgroup removal validation: maps groupId → group name when user has open tickets there
  const [blockedGroups, setBlockedGroups] = useState<Record<string, string>>({});

  const pwChecks = f.password ? validatePassword(f.password) : { minLength: true, uppercase: true, number: true, special: true };
  const pwValid  = f.password ? Object.values(pwChecks).every(Boolean) : true;

  // ── Workgroup removal validation ───────────────────────────────────────────
  // When the user deselects a workgroup, check if the resolver has open tickets
  // assigned from that workgroup. If so, block the removal and show a warning.
  const handleAssignmentGroupChange = useCallback(async (newIds: string[]) => {
    const originalGroupIds = groups
      .filter((g) => g.members?.some((m) => m.userId === userId))
      .map((g) => String(g.groupId));
    const removedIds = originalGroupIds.filter((id) => !newIds.includes(id));

    if (removedIds.length === 0) {
      setBlockedGroups({});
      set("assignmentGroupIds", newIds);
      return;
    }

    // Check each removed group for open tickets via the dedicated endpoint
    const newBlocked: Record<string, string> = {};
    for (const gid of removedIds) {
      try {
        const result = await apiFetch<{ count: number; hasOpenTickets: boolean }>(
          `/assignment-groups/${gid}/open-tickets/${userId}`
        ).catch(() => ({ count: 0, hasOpenTickets: false }));
        if (result?.hasOpenTickets) {
          const grp = groups.find((g) => String(g.groupId) === gid);
          if (grp) newBlocked[gid] = grp.groupName;
        }
      } catch {
        // ignore fetch errors — allow the change
      }
    }

    if (Object.keys(newBlocked).length > 0) {
      setBlockedGroups(newBlocked);
      // Keep blocked groups in the selection (cannot remove them)
      const safeIds = [...newIds, ...Object.keys(newBlocked).filter((id) => !newIds.includes(id))];
      set("assignmentGroupIds", safeIds);
    } else {
      setBlockedGroups({});
      set("assignmentGroupIds", newIds);
    }
  }, [groups, userId, set]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.firstName.trim())   e.firstName  = "First name is required";
    if (!f.lastName.trim())    e.lastName   = "Last name is required";
    if (!f.displayName.trim()) e.displayName = "Display name is required";
    if (!f.email.trim())       e.email      = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Invalid email address";
    if (!f.departmentId)  e.departmentId = "Department is required";
    if (f.password) {
      if (!pwValid)             e.password  = "Password does not meet requirements";
      if (f.password !== f.confirmPassword) e.confirmPassword = "Passwords do not match";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;

    // ── Step 1: Validate workgroup removals BEFORE saving anything ────────────
    const originalGroupIds = groups
      .filter((g) => g.members?.some((m) => m.userId === userId))
      .map((g) => String(g.groupId));
    const groupsToRemove = originalGroupIds.filter((id) => !f.assignmentGroupIds.includes(id));

    if (groupsToRemove.length > 0) {
      // Re-check open tickets for each group being removed (definitive pre-save check)
      const conflictNames: string[] = [];
      for (const gid of groupsToRemove) {
        try {
          const result = await apiFetch<{ count: number; hasOpenTickets: boolean }>(
            `/assignment-groups/${gid}/open-tickets/${userId}`
          );
          if (result?.hasOpenTickets) {
            const grp = groups.find((g) => String(g.groupId) === gid);
            if (grp) conflictNames.push(grp.groupName);
          }
        } catch {
          // ignore — allow save to proceed; backend will also block if needed
        }
      }
      if (conflictNames.length > 0) {
        setSaveError(
          `Cannot remove resolver from workgroup(s) with open tickets: ${conflictNames.join(", ")}. Please reassign or resolve all open tickets first.`
        );
        return;
      }
    }

    setSubmitting(true);

    const dto: UpdateUserDto = {
      firstName:    f.firstName,
      lastName:     f.lastName,
      displayName:  f.displayName,
      email:        f.email,
      phone:        f.phone || undefined,
      employeeId:   f.employeeId || undefined,
      jobTitle:     f.jobTitle  || undefined,
      departmentId: f.departmentId ? Number(f.departmentId) : undefined,
      managerName:  f.managerName || undefined,
      businessService: f.businessService || undefined,
      location:     f.location || undefined,
      userType:     f.userType,
      authType:     f.authType,
      ssoEnabled:   f.ssoEnabled,
      isActive:     f.isActive,
      allowMobileAccess: f.allowMobileAccess,
      allowApiAccess:    f.allowApiAccess,
      allowLogin:        f.allowLogin,
      reviewRequired:    f.reviewRequired,
      passwordExpiryDays: f.passwordExpiryNever ? null : Number(f.passwordExpiryDays) || 90,
      roleId:       f.roleIds[0] ? Number(f.roleIds[0]) : undefined,
      assignmentGroupId: f.assignmentGroupIds[0] ? Number(f.assignmentGroupIds[0]) : undefined,
      defaultLandingPage: f.defaultLandingPage,
      workPhone:    f.workPhone || undefined,
      mobilePhone:  f.mobilePhone || undefined,
      alternateEmail: f.alternateEmail || undefined,
      workAddress:  f.workAddress || undefined,
      city:         f.city || undefined,
      state:        f.state || undefined,
      country:      f.country || undefined,
      postalCode:   f.postalCode || undefined,
      emergencyContactName:  f.emergencyContactName  || undefined,
      emergencyContactPhone: f.emergencyContactPhone || undefined,
      emergencyContactRelation: f.emergencyContactRelation || undefined,
      costCenter:   f.costCenter  || undefined,
      building:     f.building    || undefined,
      floor:        f.floor       || undefined,
      deskNumber:   f.deskNumber  || undefined,
      language:     f.language,
      dateFormat:   f.dateFormat,
      timeZone:     f.timeZone,
      notes:        f.notes || undefined,
    };

    if (f.password) {
      dto.password = f.password;
    }

    try {
      await UsersApi.update(userId, dto);

      // ── Step 2: Sync role & group membership ────────────────────────────────
      const originalRoleIds = (existingUser?.userRoles || []).map((ur) => String(ur.role.roleId));

      const rolesToAdd    = f.roleIds.filter((id) => !originalRoleIds.includes(id));
      const rolesToRemove = originalRoleIds.filter((id) => !f.roleIds.includes(id));
      const groupsToAdd   = f.assignmentGroupIds.filter((id) => !originalGroupIds.includes(id));
      // groupsToRemove already computed above (and validated)

      await Promise.all([
        ...rolesToAdd.map((id) => RolesApi.assign(userId, Number(id)).catch(() => {})),
        ...rolesToRemove.map((id) => RolesApi.unassign(userId, Number(id)).catch(() => {})),
        ...groupsToAdd.map((id) => AssignmentGroupApi.addMember(Number(id), userId).catch(() => {})),
      ]);

      for (const id of groupsToRemove) {
        try {
          await AssignmentGroupApi.removeMember(Number(id), userId);
        } catch (err) {
          // Backend double-check may also throw ConflictException — surface it
          setSaveError(err instanceof Error ? err.message : `Failed to remove from workgroup ${id}`);
          setSubmitting(false);
          return;
        }
      }

      if (typeof window !== "undefined" && Object.keys(customFields).length > 0) {
        try {
          localStorage.setItem(`user_custom_${userId}`, JSON.stringify(customFields));
        } catch {}
      }

      router.push("/admin/users");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Tab content ──────────────────────────────────────────────────────────

  const tabContent: Record<Tab, React.ReactNode> = {
    contact: (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          <Field label="Work Phone">
            <TextInput value={f.workPhone} onChange={(v) => set("workPhone", v)}
              placeholder="+91 22 1234 5678" />
          </Field>
          <Field label="Mobile Phone">
            <TextInput value={f.mobilePhone} onChange={(v) => set("mobilePhone", v)}
              placeholder="+91 98765 43210" />
          </Field>
          <Field label="Alternate Email" className="col-span-2">
            <TextInput value={f.alternateEmail} onChange={(v) => set("alternateEmail", v)}
              type="email" placeholder="personal@example.com" />
          </Field>
        </div>
        <div className="bg-blue-50/50 border border-blue-100 rounded p-3 flex gap-2 text-sm text-blue-800 mt-2">
          <Info className="size-4 shrink-0 mt-0.5 text-blue-500" />
          <p>An email will be sent to the user with account details and log in instructions.</p>
        </div>
      </div>
    ),
    address: (
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Field label="Street Address" className="col-span-2">
          <TextInput value={f.workAddress} onChange={(v) => set("workAddress", v)} placeholder="123 Main St" />
        </Field>
        <Field label="City">
          <TextInput value={f.city} onChange={(v) => set("city", v)} placeholder="Mumbai" />
        </Field>
        <Field label="State / Province">
          <TextInput value={f.state} onChange={(v) => set("state", v)} placeholder="Maharashtra" />
        </Field>
        <Field label="Country">
          <TextInput value={f.country} onChange={(v) => set("country", v)} placeholder="India" />
        </Field>
        <Field label="Postal Code">
          <TextInput value={f.postalCode} onChange={(v) => set("postalCode", v)} placeholder="400001" />
        </Field>
      </div>
    ),
    emergency: (
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Field label="Contact Name">
          <TextInput value={f.emergencyContactName} onChange={(v) => set("emergencyContactName", v)}
            placeholder="John Doe" />
        </Field>
        <Field label="Relationship">
          <TextInput value={f.emergencyContactRelation} onChange={(v) => set("emergencyContactRelation", v)}
            placeholder="Spouse / Parent / Sibling" />
        </Field>
        <Field label="Contact Number" className="col-span-2">
          <TextInput value={f.emergencyContactPhone} onChange={(v) => set("emergencyContactPhone", v)}
            placeholder="+91 98765 43210" />
        </Field>
      </div>
    ),
    work: (
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Field label="Cost Center">
          <TextInput value={f.costCenter} onChange={(v) => set("costCenter", v)}
            placeholder="CC-12345" />
        </Field>
        <Field label="Building">
          <TextInput value={f.building} onChange={(v) => set("building", v)}
            placeholder="Building A" />
        </Field>
        <Field label="Floor">
          <TextInput value={f.floor} onChange={(v) => set("floor", v)}
            placeholder="3rd Floor" />
        </Field>
        <Field label="Desk Number">
          <TextInput value={f.deskNumber} onChange={(v) => set("deskNumber", v)}
            placeholder="A-301" />
        </Field>
      </div>
    ),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (loadError || !existingUser) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link href="/admin/users" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
          <ChevronLeft className="size-4" /> Back to Users
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {loadError || "User not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Breadcrumb
        items={[
          { label: "Home", href: "/home" },
          { label: "Admin" },
          { label: "Users", href: "/admin/users" },
          { label: existingUser.fullName || "Edit User" },
        ]}
      />
      <Link href="/admin/users" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700">
        <ChevronLeft className="size-4" /> Back to Users
      </Link>

      <div className="flex items-center justify-between mb-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Edit User</h1>
            <p className="text-slate-500 mt-1">{existingUser.fullName} ({existingUser.username})</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/admin/users")}
              disabled={submitting}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="size-4" />
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* ── Inline save error banner ── */}
        {saveError && (
          <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <ShieldAlert className="size-5 shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1 text-sm">{saveError}</div>
            <button type="button" onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600">
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* ── Workgroup blocked warning ── */}
        {Object.keys(blockedGroups).length > 0 && (
          <div className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
            <AlertTriangle className="size-5 shrink-0 mt-0.5 text-amber-500" />
            <div className="flex-1 text-sm">
              <span className="font-semibold">Cannot remove resolver from workgroup(s): </span>
              {Object.values(blockedGroups).join(", ")}.
              <span className="ml-1">They have open tickets assigned in these groups. Please reassign or resolve all open tickets first.</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-8 mt-6">
          {/* Main Column */}
          <div className="col-span-2 space-y-8 w-full">
            <SectionCard title="User Information" icon={<User className="size-4" />}>
              <div className="flex gap-6 mb-5">
                {/* Avatar upload */}
                <div className="flex flex-col items-center space-y-2 mt-1">
                  <div className="w-20 h-20 rounded-full border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <button type="button" className="text-blue-600 text-[11px] font-semibold hover:underline">Upload<br/>photo</button>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">JPG, PNG<br/>(max 2MB)</p>
                  </div>
                </div>
                {/* Names */}
                <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-5">
                  <Field label="First Name" required error={errors.firstName}>
                    <TextInput value={f.firstName} onChange={(v) => set("firstName", v)}
                      placeholder="John" invalid={!!errors.firstName} />
                  </Field>
                  <Field label="Last Name" required error={errors.lastName}>
                    <TextInput value={f.lastName} onChange={(v) => set("lastName", v)}
                      placeholder="Doe" invalid={!!errors.lastName} />
                  </Field>
                  <Field label="Display Name" required className="col-span-2" error={errors.displayName}>
                    <TextInput value={f.displayName} onChange={(v) => set("displayName", v)}
                      placeholder="John Doe" invalid={!!errors.displayName} />
                  </Field>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <Field label="Email ID" required error={errors.email}>
                  <TextInput value={f.email} onChange={(v) => set("email", v)}
                    type="email" placeholder="john.smith@company.com" invalid={!!errors.email} />
                </Field>
                <Field label="Phone Number">
                  <div className="flex gap-2">
                    <SelectInput value="+91" onChange={()=>{}} className="w-[100px] bg-slate-50 border-slate-200">
                      <option value="+91">IN +91</option>
                      <option value="+1">US +1</option>
                    </SelectInput>
                    <TextInput value={f.phone} onChange={(v) => set("phone", v)}
                      placeholder="98765 43210" className="flex-1" />
                  </div>
                </Field>
                <Field label="Employee ID">
                  <TextInput value={f.employeeId} onChange={(v) => set("employeeId", v)}
                    placeholder="E12345" />
                </Field>
                <Field label="Job Title">
                  <TextInput value={f.jobTitle} onChange={(v) => set("jobTitle", v)}
                    placeholder="IT Support Specialist" />
                </Field>
                <Field label="Department" required error={errors.departmentId}>
                  <SelectInput value={f.departmentId} onChange={(v) => set("departmentId", v)}
                    invalid={!!errors.departmentId}>
                    <option value="">Select department</option>
                    {departments.filter((d) => d.isActive !== false || String(d.departmentId) === f.departmentId).map((d) => (
                      <option key={d.departmentId} value={String(d.departmentId)}>{d.departmentName}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Manager">
                  <SelectInput value={f.managerName} onChange={(v) => set("managerName", v)}>
                    <option value="">Select manager</option>
                  </SelectInput>
                </Field>
                <Field label="Business Service">
                  <SelectInput value={f.businessService} onChange={(v) => set("businessService", v)}>
                    <option value="">Select service</option>
                    {bizServices.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Location">
                  <SelectInput value={f.location} onChange={(v) => set("location", v)}>
                    <option value="">Select location</option>
                    {locations.filter((l) => l.isActive).map((l) => (
                      <option key={l.locationId} value={l.locationName}>{l.locationName}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="User Type" required>
                  <div className="flex gap-4 mt-2">
                    {userTypes.map((t) => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="userType" value={t} checked={f.userType === t}
                          onChange={(e) => set("userType", e.target.value as any)}
                          className="size-4 text-blue-600 focus:ring-blue-500 border-slate-300" />
                        <span className="text-sm text-slate-700">{t}</span>
                      </label>
                    ))}
                  </div>
                </Field>
                {customAttrs.map((ca) => {
                  const fieldKey = ca.targetField;
                  const val = customFields[fieldKey] ?? (f as any)[fieldKey] ?? "";
                  return (
                    <Field key={ca.sourceAttr} label={ca.description || ca.targetField} hint={`Mapped from ${ca.sourceType || "Directory"} (${ca.sourceAttr})`}>
                      <TextInput
                        value={val}
                        onChange={(v) => {
                          setCustomFields((prev) => ({ ...prev, [fieldKey]: v }));
                          if (fieldKey in f) {
                            set(fieldKey as any, v);
                          }
                        }}
                        placeholder={`Enter ${ca.description || ca.targetField}`}
                      />
                    </Field>
                  );
                })}
                <Field label="User Status" required>
                  <div className="flex items-center gap-2 mt-2 cursor-pointer" onClick={() => set("isActive", !f.isActive)}>
                    <input type="checkbox" checked={f.isActive} onChange={() => {}}
                      className="size-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300" />
                    <span className="text-sm text-slate-700">Active</span>
                  </div>
                </Field>
              </div>

              {/* Tabs for additional info */}
              <div className="mt-8">
                <div className="flex gap-4 border-b border-slate-200">
                  {(['contact', 'address', 'emergency', 'work'] as Tab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`pb-2 text-sm font-semibold transition-colors border-b-2 ${
                        activeTab === tab
                          ? "text-blue-600 border-blue-600"
                          : "text-slate-500 border-transparent hover:text-slate-700"
                      }`}
                    >
                      {tab === 'contact' && 'Contact Details'}
                      {tab === 'address' && 'Address'}
                      {tab === 'emergency' && 'Emergency Contact'}
                      {tab === 'work' && 'Work Information'}
                    </button>
                  ))}
                </div>
                <div className="pt-5">{tabContent[activeTab]}</div>
              </div>
            </SectionCard>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-8">
            <SectionCard title="Account Information" icon={<Lock className="size-4" />}>
              <div className="space-y-5">
                <Field label="Username" required>
                  <TextInput value={f.username} onChange={() => {}} disabled placeholder="john.smith" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Password">
                    <TextInput value={f.password} onChange={(v) => set("password", v)}
                      type={showPassword ? "text" : "password"}
                      placeholder="Auto-generated"
                      suffix={
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400">
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      }
                      invalid={!!errors.password}
                    />
                  </Field>
                  <Field label="Confirm Password" error={errors.confirmPassword}>
                    <TextInput value={f.confirmPassword} onChange={(v) => set("confirmPassword", v)}
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter password"
                      suffix={
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-slate-400">
                          {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      }
                      invalid={!!errors.confirmPassword}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Authentication Type" required>
                    <SelectInput value={f.authType} onChange={(v) => set("authType", v as any)}>
                      {authTypes.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Single Sign-On (SSO)">
                    <div className="flex items-center gap-2 mt-2">
                      <Toggle checked={f.ssoEnabled} onChange={(v) => set("ssoEnabled", v)} />
                      <span className="text-sm text-slate-600">{f.ssoEnabled ? "Enabled" : "Disabled"}</span>
                    </div>
                  </Field>
                </div>
                <div className="bg-orange-50/50 border border-orange-200 rounded p-3 flex gap-2 text-[13px] text-orange-800">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-orange-500" />
                  <p>Leave password blank to auto-generate a secure temporary password. The user will receive it via email.</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Role & Access" icon={<CheckCircle2 className="size-4" />}>
              <div className="space-y-5">
                <Field label="Role" hint="A user can hold more than one role.">
                  <MultiSelectDropdown
                    placeholder="Select role(s)"
                    selected={f.roleIds}
                    onChange={(v) => set("roleIds", v)}
                    options={roles.map((r) => ({ value: String(r.roleId), label: r.roleName }))}
                  />
                </Field>
                <Field label="Assignment Group" hint="An engineer can belong to more than one group.">
                  <MultiSelectDropdown
                    placeholder="Select group(s)"
                    selected={f.assignmentGroupIds}
                    onChange={handleAssignmentGroupChange}
                    options={groups.map((g) => ({ value: String(g.groupId), label: g.groupName }))}
                  />
                  {Object.keys(blockedGroups).length > 0 && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2">
                      <ShieldAlert className="size-4 shrink-0 mt-0.5 text-amber-600" />
                      <div className="text-xs text-amber-800">
                        <p className="font-semibold mb-1">Cannot remove from the following workgroup(s) — open tickets are assigned:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {Object.values(blockedGroups).map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                        <p className="mt-1 text-amber-700">Please reassign or resolve all open tickets first.</p>
                      </div>
                    </div>
                  )}
                </Field>
                <Field label="Default Landing Page">
                  <SelectInput value={f.defaultLandingPage} onChange={(v) => set("defaultLandingPage", v)}>
                    {landingPages.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </SelectInput>
                </Field>
                <div className="grid grid-cols-2 gap-y-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={f.allowMobileAccess} onChange={(e) => set("allowMobileAccess", e.target.checked)}
                      className="size-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300" />
                    <span className="text-sm text-slate-700">Allow Mobile Access</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={f.allowApiAccess} onChange={(e) => set("allowApiAccess", e.target.checked)}
                      className="size-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300" />
                    <span className="text-sm text-slate-700">Allow API Access</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={f.allowLogin} onChange={(e) => set("allowLogin", e.target.checked)}
                      className="size-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300" />
                    <span className="text-sm text-slate-700">Allow Login</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={f.reviewRequired} onChange={(e) => set("reviewRequired", e.target.checked)}
                      className="size-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300" />
                    <span className="text-sm text-slate-700">Review Required</span>
                  </label>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Additional Information" icon={<FileText className="size-4" />}>
              <div className="space-y-5">
                <Field label="Language">
                  <SelectInput value={f.language} onChange={(v) => set("language", v)}>
                    {languages.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Notes">
                  <textarea
                    value={f.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Enter any additional notes about the user..."
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none placeholder:text-slate-400"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date Format">
                    <SelectInput value={f.dateFormat} onChange={(v) => set("dateFormat", v)}>
                      {dateFormats.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Time Zone">
                    <SelectInput value={f.timeZone} onChange={(v) => set("timeZone", v)}>
                      {timezones.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
  );
}
