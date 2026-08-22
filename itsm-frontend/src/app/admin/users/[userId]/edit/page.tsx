"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Camera, Eye, EyeOff, CheckCircle2, ChevronRight,
  X, Loader2, ExternalLink, Save, ChevronLeft,
} from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { MultiSelectDropdown } from "@/components/admin/multi-select-dropdown";
import { useAdminUsers, useAdminRoles } from "@/lib/hooks/use-admin";
import { apiFetch } from "@/lib/api/client";
import { UsersApi, UpdateUserDto } from "@/lib/api/users.api";
import { RolesApi } from "@/lib/api/roles.api";
import { AssignmentGroupApi } from "@/lib/api/admin-modules.api";
import { AssignmentGroup, Role, AdminUser, Location } from "@/types/admin";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Tab = "contact" | "address" | "emergency" | "work";

const DEPARTMENTS   = ["IT Support", "HR", "Finance", "Operations", "Engineering", "Sales", "Marketing", "Legal"];
const BIZ_SERVICES  = ["IT Support", "HR Services", "Finance", "Facilities", "Engineering", "Customer Support"];
const AUTH_TYPES    = ["Internal", "LDAP", "SAML", "OAuth"] as const;
const USER_TYPES    = ["Internal", "External", "Partner"] as const;
const LANDING_PAGES = ["My Dashboard", "Home", "My Incidents", "Service Catalog"] as const;
const LANGUAGES     = ["English (US)", "English (UK)", "Hindi", "German", "French", "Spanish", "Japanese"];
const DATE_FORMATS  = ["DD MMM YYYY (16 May 2025)", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
const TIMEZONES     = [
  "(GMT+05:30) Asia/Kolkata",
  "(GMT+00:00) UTC",
  "(GMT-05:00) America/New_York",
  "(GMT-08:00) America/Los_Angeles",
  "(GMT+01:00) Europe/London",
  "(GMT+08:00) Asia/Singapore",
];

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
  value, onChange, children, disabled, invalid,
}: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; disabled?: boolean; invalid?: boolean;
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
        ].join(" ")}
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

function SectionCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = Number(params?.userId);
  
  const { roles } = useAdminRoles();
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [existingUser, setExistingUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user data on mount
  useEffect(() => {
    if (!userId) return;
    Promise.all([
      UsersApi.getOne(userId),
      apiFetch<AssignmentGroup[]>("/assignment-groups").catch(() => []),
      // Pull from the single Location admin source (/admin/location) instead of
      // a separate hardcoded list, so this dropdown always matches what's configured there.
      apiFetch<Location[]>("/locations").catch(() => []),
    ])
      .then(([user, groups, locations]) => {
        setExistingUser(user);
        setGroups(groups || []);
        setLocations(locations || []);
      })
      .catch((err) => setError(err?.message || "Failed to load user"))
      .finally(() => setLoading(false));
  }, [userId]);

  // ── Form state ────────────────────────────────────────────────────────────
  const [f, setF] = useState({
    firstName: "", lastName: "", displayName: "", email: "", phone: "",
    employeeId: "", jobTitle: "", department: "", managerName: "",
    businessService: "", location: "", userType: "Internal" as typeof USER_TYPES[number],
    username: "",
    password: "", confirmPassword: "",
    authType: "Internal" as typeof AUTH_TYPES[number],
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
    setF({
      firstName: existingUser.firstName || "",
      lastName: existingUser.lastName || "",
      displayName: existingUser.displayName || "",
      email: existingUser.email || "",
      phone: existingUser.phone || "",
      employeeId: existingUser.employeeId || "",
      jobTitle: existingUser.jobTitle || "",
      department: existingUser.department || "",
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
  }, [existingUser, groups]);

  const set = useCallback(<K extends keyof typeof f>(k: K, v: typeof f[K]) =>
    setF((p) => ({ ...p, [k]: v })), []);

  const [showPassword, setShowPassword]  = useState(false);
  const [showConfirm, setShowConfirm]    = useState(false);
  const [activeTab, setActiveTab]        = useState<Tab>("contact");
  const [errors, setErrors]              = useState<Partial<Record<string, string>>>({});
  const [submitting, setSubmitting]      = useState(false);

  const pwChecks = f.password ? validatePassword(f.password) : { minLength: true, uppercase: true, number: true, special: true };
  const pwValid  = f.password ? Object.values(pwChecks).every(Boolean) : true;

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.firstName.trim())   e.firstName  = "First name is required";
    if (!f.lastName.trim())    e.lastName   = "Last name is required";
    if (!f.displayName.trim()) e.displayName = "Display name is required";
    if (!f.email.trim())       e.email      = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Invalid email address";
    if (!f.department.trim())  e.department = "Department is required";
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
    setSubmitting(true);

    const dto: UpdateUserDto = {
      firstName:    f.firstName,
      lastName:     f.lastName,
      displayName:  f.displayName,
      email:        f.email,
      phone:        f.phone || undefined,
      employeeId:   f.employeeId || undefined,
      jobTitle:     f.jobTitle  || undefined,
      department:   f.department || undefined,
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
      // First selection stays as the primary role/group for backward-compat display;
      // the full multi-role / multi-group membership is synced separately below.
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

    // Only add password if provided
    if (f.password) {
      dto.password = f.password;
    }

    try {
      await UsersApi.update(userId, dto);

      // Sync full role & group membership (beyond the single "primary" one
      // already sent above) by diffing against what the user originally had.
      const originalRoleIds = (existingUser?.userRoles || []).map((ur) => String(ur.role.roleId));
      const originalGroupIds = groups
        .filter((g) => g.members?.some((m) => m.userId === userId))
        .map((g) => String(g.groupId));

      const rolesToAdd    = f.roleIds.filter((id) => !originalRoleIds.includes(id));
      const rolesToRemove = originalRoleIds.filter((id) => !f.roleIds.includes(id));
      const groupsToAdd    = f.assignmentGroupIds.filter((id) => !originalGroupIds.includes(id));
      const groupsToRemove = originalGroupIds.filter((id) => !f.assignmentGroupIds.includes(id));

      await Promise.all([
        ...rolesToAdd.map((id) => RolesApi.assign(userId, Number(id)).catch(() => {})),
        ...rolesToRemove.map((id) => RolesApi.unassign(userId, Number(id)).catch(() => {})),
        ...groupsToAdd.map((id) => AssignmentGroupApi.addMember(Number(id), userId).catch(() => {})),
        ...groupsToRemove.map((id) => AssignmentGroupApi.removeMember(Number(id), userId).catch(() => {})),
      ]);

      router.push("/admin/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Tab content ──────────────────────────────────────────────────────────

  const tabContent: Record<Tab, React.ReactNode> = {
    contact: (
      <div className="grid grid-cols-2 gap-4">
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
    ),
    address: (
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
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
      <div className="min-h-screen bg-slate-50 px-6 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (error || !existingUser) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/admin/users" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ChevronLeft className="size-4" /> Back to Users
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || "User not found"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/admin/users" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
          <ChevronLeft className="size-4" /> Back to Users
        </Link>

        <div className="mb-6 flex items-center justify-between">
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

        <div className="grid grid-cols-3 gap-6">
          {/* Main form */}
          <div className="col-span-2 space-y-5">
            <SectionCard title="Basic Information">
              <div className="grid grid-cols-2 gap-4">
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
                <Field label="Email" required error={errors.email}>
                  <TextInput value={f.email} onChange={(v) => set("email", v)}
                    type="email" placeholder="john@example.com" invalid={!!errors.email} />
                </Field>
                <Field label="Phone">
                  <TextInput value={f.phone} onChange={(v) => set("phone", v)}
                    placeholder="+91 9876543210" />
                </Field>
                <Field label="Employee ID">
                  <TextInput value={f.employeeId} onChange={(v) => set("employeeId", v)}
                    placeholder="EMP-12345" />
                </Field>
                <Field label="Job Title">
                  <TextInput value={f.jobTitle} onChange={(v) => set("jobTitle", v)}
                    placeholder="Senior Software Engineer" />
                </Field>
                <Field label="Department" required error={errors.department}>
                  <SelectInput value={f.department} onChange={(v) => set("department", v)}
                    invalid={!!errors.department}>
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Manager Name">
                  <TextInput value={f.managerName} onChange={(v) => set("managerName", v)}
                    placeholder="Manager Name" />
                </Field>
                <Field label="Business Service">
                  <SelectInput value={f.businessService} onChange={(v) => set("businessService", v)}>
                    <option value="">Select Service</option>
                    {BIZ_SERVICES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Location">
                  <SelectInput value={f.location} onChange={(v) => set("location", v)}>
                    <option value="">Select Location</option>
                    {locations.filter((l) => l.isActive).map((l) => (
                      <option key={l.locationId} value={l.locationName}>{l.locationName}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="User Type" className="col-span-2">
                  <SelectInput value={f.userType} onChange={(v) => set("userType", v as typeof USER_TYPES[number])}>
                    {USER_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Account Information">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Username">
                  <TextInput value={f.username} onChange={() => {}} disabled placeholder="Username is read-only" />
                </Field>
                <Field label="Auth Type">
                  <SelectInput value={f.authType} onChange={(v) => set("authType", v as typeof AUTH_TYPES[number])}>
                    {AUTH_TYPES.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="New Password (optional)">
                  <TextInput value={f.password} onChange={(v) => set("password", v)}
                    type={showPassword ? "text" : "password"}
                    placeholder="Leave blank to keep current password"
                    suffix={
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400">
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    }
                    invalid={!!errors.password}
                  />
                  {f.password && (
                    <ul className="text-xs space-y-1 mt-2">
                      <li className={`flex items-center gap-2 ${pwChecks.minLength ? "text-slate-600" : "text-slate-400"}`}>
                        <CheckCircle2 className={`size-3 ${pwChecks.minLength ? "text-green-500" : "text-slate-300"}`} />
                        At least 8 characters
                      </li>
                      <li className={`flex items-center gap-2 ${pwChecks.uppercase ? "text-slate-600" : "text-slate-400"}`}>
                        <CheckCircle2 className={`size-3 ${pwChecks.uppercase ? "text-green-500" : "text-slate-300"}`} />
                        One uppercase letter
                      </li>
                      <li className={`flex items-center gap-2 ${pwChecks.number ? "text-slate-600" : "text-slate-400"}`}>
                        <CheckCircle2 className={`size-3 ${pwChecks.number ? "text-green-500" : "text-slate-300"}`} />
                        One number
                      </li>
                      <li className={`flex items-center gap-2 ${pwChecks.special ? "text-slate-600" : "text-slate-400"}`}>
                        <CheckCircle2 className={`size-3 ${pwChecks.special ? "text-green-500" : "text-slate-300"}`} />
                        One special character
                      </li>
                    </ul>
                  )}
                </Field>
                {f.password && (
                  <Field label="Confirm Password" error={errors.confirmPassword}>
                    <TextInput value={f.confirmPassword} onChange={(v) => set("confirmPassword", v)}
                      type={showConfirm ? "text" : "password"}
                      placeholder="Confirm new password"
                      suffix={
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-slate-400">
                          {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      }
                      invalid={!!errors.confirmPassword}
                    />
                  </Field>
                )}
                <div className="col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">SSO Enabled</label>
                    <Toggle checked={f.ssoEnabled} onChange={(v) => set("ssoEnabled", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Allow Mobile Access</label>
                    <Toggle checked={f.allowMobileAccess} onChange={(v) => set("allowMobileAccess", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Allow API Access</label>
                    <Toggle checked={f.allowApiAccess} onChange={(v) => set("allowApiAccess", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Allow Login</label>
                    <Toggle checked={f.allowLogin} onChange={(v) => set("allowLogin", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Active</label>
                    <Toggle checked={f.isActive} onChange={(v) => set("isActive", v)} />
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Role & Access">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Role" hint="A user can hold more than one role.">
                  <MultiSelectDropdown
                    placeholder="No Role"
                    selected={f.roleIds}
                    onChange={(v) => set("roleIds", v)}
                    options={roles.map((r) => ({ value: String(r.roleId), label: r.roleName }))}
                  />
                </Field>
                <Field label="Assignment Group" hint="An engineer can belong to more than one group.">
                  <MultiSelectDropdown
                    placeholder="No Group"
                    selected={f.assignmentGroupIds}
                    onChange={(v) => set("assignmentGroupIds", v)}
                    options={groups.map((g) => ({ value: String(g.groupId), label: g.groupName }))}
                  />
                </Field>
                <Field label="Default Landing Page" className="col-span-2">
                  <SelectInput value={f.defaultLandingPage} onChange={(v) => set("defaultLandingPage", v)}>
                    {LANDING_PAGES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Preferences">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Language">
                  <SelectInput value={f.language} onChange={(v) => set("language", v)}>
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Date Format">
                  <SelectInput value={f.dateFormat} onChange={(v) => set("dateFormat", v)}>
                    {DATE_FORMATS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Timezone" className="col-span-2">
                  <SelectInput value={f.timeZone} onChange={(v) => set("timeZone", v)}>
                    {TIMEZONES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
            </SectionCard>

            {/* Tabs for additional info */}
            <SectionCard title="Additional Information">
              <div className="space-y-4">
                <div className="flex gap-2 border-b border-slate-100">
                  {(['contact', 'address', 'emergency', 'work'] as Tab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab
                          ? "text-blue-600 border-blue-600"
                          : "text-slate-500 border-transparent hover:text-slate-700"
                      }`}
                    >
                      {tab === 'contact' && 'Contact'}
                      {tab === 'address' && 'Address'}
                      {tab === 'emergency' && 'Emergency'}
                      {tab === 'work' && 'Work'}
                    </button>
                  ))}
                </div>
                <div>{tabContent[activeTab]}</div>
              </div>
            </SectionCard>

            <SectionCard title="Notes">
              <textarea
                value={f.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Internal notes about this user..."
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </SectionCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <SectionCard title="Summary">
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-slate-500">Name</p>
                  <p className="font-medium text-slate-800">{f.displayName || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium text-slate-800 break-all">{f.email || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Role{f.roleIds.length > 1 ? "s" : ""}</p>
                  <p className="font-medium text-slate-800">
                    {roles.filter((r) => f.roleIds.includes(String(r.roleId))).map((r) => r.roleName).join(", ") || "No role"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Department</p>
                  <p className="font-medium text-slate-800">{f.department || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <p className={`font-medium ${f.isActive ? "text-green-600" : "text-red-600"}`}>
                    {f.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
