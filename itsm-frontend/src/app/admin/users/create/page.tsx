"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera, Eye, EyeOff, CheckCircle2, ChevronRight,
  X, Loader2, ExternalLink,
} from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { MultiSelectDropdown } from "@/components/admin/multi-select-dropdown";
import { useAdminUsers, useAdminRoles } from "@/lib/hooks/use-admin";
import { useDepartments } from "@/lib/hooks/use-departments";
import { apiFetch } from "@/lib/api/client";
import { AssignmentGroup, Role, Location } from "@/types/admin";
import { CreateUserDto } from "@/lib/api/users.api";
import { RolesApi } from "@/lib/api/roles.api";
import { AssignmentGroupApi } from "@/lib/api/admin-modules.api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Tab = "contact" | "address" | "emergency" | "work";



function validatePassword(pw: string) {
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
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
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
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
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
        "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand-600" : "bg-slate-200",
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

function RadioButton({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span
        onClick={onChange}
        className={[
          "size-4 rounded-full border-2 flex items-center justify-center transition-colors",
          checked ? "border-brand-600 bg-white" : "border-slate-300 bg-white",
        ].join(" ")}
      >
        {checked && <span className="size-2 rounded-full bg-brand-600 block" />}
      </span>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

function SectionCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible ${className}`}>
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <CheckCircle2 className={`size-4 ${ok ? "text-green-500" : "text-slate-300"}`} />
      <span className={ok ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </li>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CreateNewUserPage() {
  const router = useRouter();
  const { create } = useAdminUsers();
  const { roles } = useAdminRoles();
  const { departments } = useDepartments();
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  const [users, setUsers] = useState<{ userId: number; fullName: string }[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [bizServices, setBizServices] = useState<string[]>([]);
  const [authTypes, setAuthTypes] = useState<string[]>([]);
  const [userTypes, setUserTypes] = useState<string[]>([]);
  const [landingPages, setLandingPages] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [dateFormats, setDateFormats] = useState<string[]>([]);
  const [timezones, setTimezones] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<AssignmentGroup[]>("/assignment-groups").then(setGroups).catch(() => {});
    apiFetch<{ userId: number; fullName: string }[]>("/users").then(setUsers).catch(() => {});
    // Pull from the single Location admin source (/admin/location) instead of
    // a separate hardcoded list, so this dropdown always matches what's configured there.
    apiFetch<Location[]>("/locations").then(setLocations).catch(() => {});
    
    apiFetch<string[]>("/options/biz-services").then(setBizServices).catch(() => {});
    apiFetch<string[]>("/options/auth-types").then(setAuthTypes).catch(() => {});
    apiFetch<string[]>("/options/user-types").then(setUserTypes).catch(() => {});
    apiFetch<string[]>("/options/landing-pages").then(setLandingPages).catch(() => {});
    apiFetch<string[]>("/options/languages").then(setLanguages).catch(() => {});
    apiFetch<string[]>("/options/date-formats").then(setDateFormats).catch(() => {});
    apiFetch<string[]>("/options/timezones").then(setTimezones).catch(() => {});
  }, []);

  // ── Photo ────────────────────────────────────────────────────────────────
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Form state ────────────────────────────────────────────────────────────
  const [f, setF] = useState({
    // User info
    firstName: "", lastName: "", displayName: "", email: "", phone: "",
    employeeId: "", jobTitle: "", departmentId: "", managerName: "",
    businessService: "", location: "", userType: "Internal" as any,
    // Account
    username: "", password: "", confirmPassword: "",
    authType: "Internal" as any,
    ssoEnabled: false,
    passwordExpiryNever: false, passwordExpiryDays: "90",
    // Role & Access
    roleIds: [] as string[], assignmentGroupIds: [] as string[], defaultLandingPage: "My Dashboard",
    allowMobileAccess: true, allowApiAccess: false,
    allowLogin: true, reviewRequired: false,
    // Additional
    notes: "", language: "English (US)",
    dateFormat: "DD MMM YYYY (16 May 2025)",
    timeZone: "(GMT+05:30) Asia/Kolkata",
    isActive: true,
    // Contact details tab
    workPhone: "", mobilePhone: "", alternateEmail: "",
    // Address tab
    workAddress: "", city: "", state: "", country: "", postalCode: "",
    // Emergency tab
    emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
    // Work info tab
    costCenter: "", building: "", floor: "", deskNumber: "",
  });

  const set = useCallback(<K extends keyof typeof f>(k: K, v: typeof f[K]) =>
    setF((p) => ({ ...p, [k]: v })), []);

  const [showPassword, setShowPassword]  = useState(false);
  const [showConfirm, setShowConfirm]    = useState(false);
  const [activeTab, setActiveTab]        = useState<Tab>("contact");
  const [errors, setErrors]              = useState<Partial<Record<string, string>>>({});
  const [submitting, setSubmitting]      = useState(false);

  // Auto-generate username from name
  useEffect(() => {
    if (!f.firstName && !f.lastName) return;
    const suggested = `${f.firstName.toLowerCase()}.${f.lastName.toLowerCase()}`.replace(/\s+/g, "");
    if (!f.username || f.username === suggested.slice(0, -1)) {
      set("username", suggested);
    }
  }, [f.firstName, f.lastName]); // eslint-disable-line

  // Auto-set display name
  useEffect(() => {
    if (f.firstName || f.lastName) {
      set("displayName", `${f.firstName} ${f.lastName}`.trim());
    }
  }, [f.firstName, f.lastName]); // eslint-disable-line

  const pwChecks = validatePassword(f.password);
  const pwValid  = Object.values(pwChecks).every(Boolean);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.firstName.trim())   e.firstName  = "First name is required";
    if (!f.lastName.trim())    e.lastName   = "Last name is required";
    if (!f.displayName.trim()) e.displayName = "Display name is required";
    if (!f.email.trim())       e.email      = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Invalid email address";
    if (!f.username.trim())    e.username   = "Username is required";
    if (!f.departmentId.trim())  e.departmentId = "Department is required";
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

    const dto: CreateUserDto = {
      firstName:    f.firstName,
      lastName:     f.lastName,
      displayName:  f.displayName,
      username:     f.username,
      email:        f.email,
      phone:        f.phone || undefined,
      password:     f.password || undefined,
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
      // First selection becomes the primary role/group (unchanged DTO shape);
      // any additional ones are attached right after the user is created below.
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

    const created = await create(dto as Parameters<typeof create>[0]);

    // Attach any roles/groups beyond the first (primary) one that was already
    // sent in the create DTO — a user can hold multiple of each.
    if (created) {
      const extraRoleIds = f.roleIds.slice(1).map(Number);
      const extraGroupIds = f.assignmentGroupIds.slice(1).map(Number);
      await Promise.all([
        ...extraRoleIds.map((roleId) => RolesApi.assign(created.userId, roleId).catch(() => {})),
        ...extraGroupIds.map((groupId) => AssignmentGroupApi.addMember(groupId, created.userId).catch(() => {})),
      ]);
    }

    setSubmitting(false);
    if (created) router.push("/admin/users");
  };

  const selectedRoles = roles.filter((r) => f.roleIds.includes(String(r.roleId)));

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
          <TextInput value={f.emergencyContactName} onChange={(v) => set("emergencyContactName", v)} placeholder="Jane Smith" />
        </Field>
        <Field label="Contact Phone">
          <TextInput value={f.emergencyContactPhone} onChange={(v) => set("emergencyContactPhone", v)} placeholder="+91 98765 00000" />
        </Field>
        <Field label="Relationship">
          <TextInput value={f.emergencyContactRelation} onChange={(v) => set("emergencyContactRelation", v)} placeholder="Spouse" />
        </Field>
      </div>
    ),
    work: (
      <div className="grid grid-cols-2 gap-4">
        <Field label="Cost Center">
          <TextInput value={f.costCenter} onChange={(v) => set("costCenter", v)} placeholder="CC-100" />
        </Field>
        <Field label="Building">
          <TextInput value={f.building} onChange={(v) => set("building", v)} placeholder="Building A" />
        </Field>
        <Field label="Floor">
          <TextInput value={f.floor} onChange={(v) => set("floor", v)} placeholder="2" />
        </Field>
        <Field label="Desk Number">
          <TextInput value={f.deskNumber} onChange={(v) => set("deskNumber", v)} placeholder="D-205" />
        </Field>
      </div>
    ),
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: "Home",  href: "/home" },
        { label: "Admin" },
        { label: "Users", href: "/admin/users" },
        { label: "Create New User" },
      ]} />

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create New User</h1>
          <p className="text-sm text-slate-500 mt-1">Create a new user and set their role, access, and preferences.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/users"
            className="h-10 px-5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="h-10 px-5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Save User
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* User Information */}
          <SectionCard title="User Information">
            <div className="flex gap-6">
              {/* Profile photo */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div
                  onClick={() => photoRef.current?.click()}
                  className="size-24 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors overflow-hidden"
                >
                  {photoPreview
                    ? <img src={photoPreview} alt="Profile" className="size-full object-cover" />
                    : <Camera className="size-7 text-slate-400" />}
                </div>
                <input ref={photoRef} type="file" accept="image/jpg,image/jpeg,image/png" className="hidden" onChange={handlePhoto} />
                <button onClick={() => photoRef.current?.click()} type="button"
                  className="text-xs text-brand-600 hover:underline font-medium">
                  Upload photo
                </button>
                <p className="text-[10px] text-slate-400">JPG, PNG (max 2MB)</p>
              </div>

              {/* Name fields */}
              <div className="flex-1 grid grid-cols-2 gap-4">
                <Field label="First Name" required error={errors.firstName}>
                  <TextInput value={f.firstName} onChange={(v) => set("firstName", v)}
                    placeholder="John" invalid={!!errors.firstName} />
                </Field>
                <Field label="Last Name" required error={errors.lastName}>
                  <TextInput value={f.lastName} onChange={(v) => set("lastName", v)}
                    placeholder="Smith" invalid={!!errors.lastName} />
                </Field>
                <div className="col-span-2">
                  <Field label="Display Name" required error={errors.displayName}>
                    <TextInput value={f.displayName} onChange={(v) => set("displayName", v)}
                      placeholder="John Smith" invalid={!!errors.displayName} />
                  </Field>
                </div>
              </div>
            </div>

            {/* More user info */}
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Field label="Email ID" required error={errors.email}>
                <TextInput value={f.email} onChange={(v) => set("email", v)}
                  type="email" placeholder="john.smith@company.com" invalid={!!errors.email} />
              </Field>
              <Field label="Phone Number">
                <div className="flex gap-2">
                  <div className="flex items-center gap-1.5 h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 shrink-0">
                    <span className="text-base">🇮🇳</span>
                    <span className="text-slate-500">+91</span>
                  </div>
                  <TextInput value={f.phone} onChange={(v) => set("phone", v)}
                    placeholder="98765 43210" className="flex-1" />
                </div>
              </Field>

              <Field label="Employee ID">
                <TextInput value={f.employeeId} onChange={(v) => set("employeeId", v)} placeholder="E12345" />
              </Field>
              <Field label="Job Title">
                <TextInput value={f.jobTitle} onChange={(v) => set("jobTitle", v)} placeholder="IT Support Specialist" />
              </Field>

              <Field label="Department" required error={errors.departmentId}>
                <SelectInput value={f.departmentId} onChange={(v) => set("departmentId", v)} invalid={!!errors.departmentId}>
                  <option value="">Select department</option>
                  {departments.filter((d) => d.isActive).map((d) => (
                    <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Manager">
                <SelectInput value={f.managerName} onChange={(v) => set("managerName", v)}>
                  <option value="">Select manager</option>
                  {users.map((u) => (
                    <option key={u.userId} value={u.fullName}>{u.fullName}</option>
                  ))}
                </SelectInput>
              </Field>

              <Field label="Business Service">
                <SelectInput value={f.businessService} onChange={(v) => set("businessService", v)}>
                  <option value="">Select service</option>
                  {bizServices.map((s) => <option key={s}>{s}</option>)}
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

              <div className="col-span-2 grid grid-cols-2 gap-6">
                <Field label="User Type" required>
                  <div className="flex gap-5 mt-1">
                    {userTypes.map((t) => (
                      <RadioButton key={t} label={t} checked={f.userType === t} onChange={() => set("userType", t)} />
                    ))}
                  </div>
                </Field>
                <Field label="User Status" required>
                  <div className="flex items-center gap-3 mt-1">
                    <Toggle checked={f.isActive} onChange={(v) => set("isActive", v)} />
                    <span className="text-sm font-medium text-slate-700">{f.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </Field>
              </div>
            </div>

            {/* ── Contact / Address / Emergency / Work tabs ── */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="flex gap-0 border-b border-slate-200">
                {(["contact", "address", "emergency", "work"] as Tab[]).map((tab) => {
                  const labels: Record<Tab, string> = {
                    contact: "Contact Details", address: "Address",
                    emergency: "Emergency Contact", work: "Work Information",
                  };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={[
                        "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                        activeTab === tab
                          ? "border-brand-600 text-brand-600"
                          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
                      ].join(" ")}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>
              <div className="pt-4">{tabContent[activeTab]}</div>
            </div>

            {/* Email notice */}
            <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
              <svg className="size-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-blue-700">An email will be sent to the user with account details and login instructions.</p>
            </div>
          </SectionCard>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Account Information */}
          <SectionCard title="Account Information">
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Username" required error={errors.username}>
                  <TextInput value={f.username} onChange={(v) => set("username", v)}
                    placeholder="john.smith" invalid={!!errors.username} />
                </Field>
                <Field label="Password" error={errors.password}>
                  <TextInput
                    value={f.password}
                    onChange={(v) => set("password", v)}
                    type={showPassword ? "text" : "password"}
                    invalid={!!errors.password}
                    suffix={
                      <button type="button" onClick={() => setShowPassword((s) => !s)}
                        className="text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    }
                  />
                </Field>
                <Field label="Confirm Password" error={errors.confirmPassword}>
                  <TextInput
                    value={f.confirmPassword}
                    onChange={(v) => set("confirmPassword", v)}
                    type={showConfirm ? "text" : "password"}
                    invalid={!!errors.confirmPassword}
                    suffix={
                      <button type="button" onClick={() => setShowConfirm((s) => !s)}
                        className="text-slate-400 hover:text-slate-600">
                        {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    }
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Authentication Type" required>
                  <SelectInput value={f.authType} onChange={(v) => set("authType", v as any)}>
                    {authTypes.map((t) => <option key={t}>{t}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Single Sign-On (SSO)">
                  <div className="flex items-center gap-3 h-10">
                    <Toggle checked={f.ssoEnabled} onChange={(v) => set("ssoEnabled", v)} />
                    <span className="text-sm text-slate-600">{f.ssoEnabled ? "Enabled" : "Disabled"}</span>
                  </div>
                </Field>
              </div>

              {/* Password policy */}
              {f.password && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Password Policy</p>
                    <ul className="space-y-1.5">
                      <CheckItem ok={pwChecks.minLength}  label="Minimum 8 characters" />
                      <CheckItem ok={pwChecks.uppercase}  label="At least 1 uppercase letter" />
                      <CheckItem ok={pwChecks.number}     label="At least 1 number" />
                      <CheckItem ok={pwChecks.special}    label="At least 1 special character" />
                    </ul>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Password Expiry</p>
                    <div className="space-y-2">
                      <RadioButton label="Never" checked={f.passwordExpiryNever}
                        onChange={() => set("passwordExpiryNever", true)} />
                      <div className="flex items-center gap-2">
                        <RadioButton label="After" checked={!f.passwordExpiryNever}
                          onChange={() => set("passwordExpiryNever", false)} />
                        <input
                          type="number"
                          value={f.passwordExpiryDays}
                          onChange={(e) => set("passwordExpiryDays", e.target.value)}
                          disabled={f.passwordExpiryNever}
                          min={1} max={999}
                          className="w-16 h-8 rounded border border-slate-300 px-2 text-sm text-center outline-none focus:border-brand-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <span className="text-sm text-slate-500">days</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* No password hint */}
              {!f.password && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
                  <p className="text-sm text-amber-700">
                    Leave password blank to auto-generate a secure temporary password. The user will receive it via email.
                  </p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Role & Access */}
          <SectionCard title="Role & Access">
            <div className="grid grid-cols-1 gap-4">
              <Field label="Role" hint="A user can hold more than one role.">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <MultiSelectDropdown
                      placeholder="Select role(s)"
                      selected={f.roleIds}
                      onChange={(v) => set("roleIds", v)}
                      options={roles.map((r) => ({
                        value: String(r.roleId),
                        label: r.roleName + (r.roleCode ? ` (${r.roleCode})` : ""),
                      }))}
                    />
                  </div>
                  {selectedRoles.length > 0 && (
                    <Link href="/admin/roles"
                      className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors">
                      <ExternalLink className="size-3.5" /> View Role Permissions
                    </Link>
                  )}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Assignment Group" hint="An engineer can belong to more than one group." className="col-span-2">
                  <MultiSelectDropdown
                    placeholder="Select group(s)"
                    selected={f.assignmentGroupIds}
                    onChange={(v) => set("assignmentGroupIds", v)}
                    options={groups.map((g) => ({ value: String(g.groupId), label: g.groupName }))}
                  />
                </Field>
                <Field label="Default Landing Page" className="col-span-2">
                  <SelectInput value={f.defaultLandingPage} onChange={(v) => set("defaultLandingPage", v)}>
                    {landingPages.map((p) => <option key={p}>{p}</option>)}
                  </SelectInput>
                </Field>
              </div>

              {/* Access checkboxes */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {(
                  [
                    { key: "allowMobileAccess", label: "Allow Mobile Access" },
                    { key: "allowApiAccess",    label: "Allow API Access"    },
                    { key: "allowLogin",        label: "Allow Login"         },
                    { key: "reviewRequired",    label: "Review Required"     },
                  ] as const
                ).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none group">
                    <div
                      onClick={() => set(key, !f[key])}
                      className={[
                        "size-4 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                        f[key]
                          ? "border-brand-600 bg-brand-600"
                          : "border-slate-300 bg-white group-hover:border-brand-400",
                      ].join(" ")}
                    >
                      {f[key] && (
                        <svg className="size-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Additional Information */}
          <SectionCard title="Additional Information">
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Language">
                  <SelectInput value={f.language} onChange={(v) => set("language", v)}>
                    {languages.map((l) => <option key={l}>{l}</option>)}
                  </SelectInput>
                </Field>
                <div /> {/* spacer to match layout */}
              </div>

              <Field label="Notes">
                <textarea
                  value={f.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Enter any additional notes about the user..."
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none shadow-sm transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-100 resize-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Date Format">
                  <SelectInput value={f.dateFormat} onChange={(v) => set("dateFormat", v)}>
                    {dateFormats.map((d) => <option key={d}>{d}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Time Zone">
                  <SelectInput value={f.timeZone} onChange={(v) => set("timeZone", v)}>
                    {timezones.map((t) => <option key={t}>{t}</option>)}
                  </SelectInput>
                </Field>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="mt-6 flex justify-end gap-3 pb-8">
        <Link
          href="/admin/users"
          className="h-10 px-5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={submitting}
          className="h-10 px-5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Save User
        </button>
      </div>
    </div>
  );
}

