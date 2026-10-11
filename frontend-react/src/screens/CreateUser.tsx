"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { ApiError, api } from "../api";
import { adminMasterApi } from "../adminMasterApi";
import { useAuth } from "../AuthContext";
import { useRouter, useRouteParams } from "../router";
import { directoryApi, type MappingRow } from "../configApi";

type RecordData = Record<string, unknown>;
interface Option { id: number; label: string; code?: string }
interface FormField { key: string; label: string; type?: "text" | "email" | "password" | "number" | "select" | "checkbox"; options?: string[]; wide?: boolean; required?: boolean }
interface FormSection { title: string; fields: FormField[] }

const initialForm: Record<string, string | boolean> = {
  firstName: "", lastName: "", displayName: "", email: "", phone: "", employeeId: "", jobTitle: "",
  departmentId: "", managerName: "", businessService: "", location: "", userType: "Internal",
  username: "", password: "", confirmPassword: "", authType: "Internal", ssoEnabled: false,
  passwordExpiryNever: false, passwordExpiryDays: "90", defaultLandingPage: "My Dashboard",
  allowMobileAccess: true, allowApiAccess: false, allowLogin: true, reviewRequired: false, isActive: true,
  workPhone: "", mobilePhone: "", alternateEmail: "", workAddress: "", city: "", state: "",
  country: "", postalCode: "", emergencyContactName: "", emergencyContactPhone: "",
  emergencyContactRelation: "", costCenter: "", building: "", floor: "", deskNumber: "",
  language: "English (US)", dateFormat: "DD MMM YYYY", timeZone: "UTC", notes: "",
};

const baseSections: FormSection[] = [
  {
    title: "User Information",
    fields: [
      { key: "firstName", label: "First Name", required: true }, { key: "lastName", label: "Last Name", required: true },
      { key: "displayName", label: "Display Name", required: true }, { key: "email", label: "Email ID", type: "email", required: true },
      { key: "phone", label: "Phone Number" }, { key: "employeeId", label: "Employee ID" },
      { key: "jobTitle", label: "Job Title" }, { key: "departmentId", label: "Department", type: "select", required: true },
      { key: "managerName", label: "Manager", type: "select" },
      { key: "businessService", label: "Business Service", type: "select", options: ["IT Support", "HR Services", "Finance", "Facilities", "Engineering", "Customer Support"] },
      { key: "location", label: "Location", type: "select" },
      { key: "userType", label: "User Type", type: "select", options: ["Internal", "External", "Partner"] },
      { key: "isActive", label: "Active", type: "checkbox" },
    ],
  },
  {
    title: "Account Information",
    fields: [
      { key: "username", label: "Username", required: true }, { key: "password", label: "Password", type: "password" },
      { key: "confirmPassword", label: "Confirm Password", type: "password" },
      { key: "authType", label: "Authentication Type", type: "select", options: ["Internal", "LDAP", "SAML", "OAuth"] },
      { key: "ssoEnabled", label: "Single Sign-On (SSO)", type: "checkbox" },
      { key: "passwordExpiryDays", label: "Password Expiry (days)", type: "number" },
      { key: "passwordExpiryNever", label: "Password Never Expires", type: "checkbox" },
    ],
  },
  {
    title: "Contact Details",
    fields: [
      { key: "workPhone", label: "Work Phone" }, { key: "mobilePhone", label: "Mobile Phone" },
      { key: "alternateEmail", label: "Alternate Email", type: "email" },
    ],
  },
  {
    title: "Address",
    fields: [
      { key: "workAddress", label: "Street Address", wide: true }, { key: "city", label: "City" },
      { key: "state", label: "State / Province" }, { key: "country", label: "Country" }, { key: "postalCode", label: "Postal Code" },
    ],
  },
  {
    title: "Emergency Contact",
    fields: [
      { key: "emergencyContactName", label: "Contact Name" }, { key: "emergencyContactPhone", label: "Contact Phone" },
      { key: "emergencyContactRelation", label: "Relationship" },
    ],
  },
  {
    title: "Work Information",
    fields: [
      { key: "costCenter", label: "Cost Center" }, { key: "building", label: "Building" },
      { key: "floor", label: "Floor" }, { key: "deskNumber", label: "Desk Number" },
    ],
  },
  {
    title: "Preferences and Access",
    fields: [
      { key: "defaultLandingPage", label: "Default Landing Page", type: "select", options: ["My Dashboard", "Home", "My Incidents", "Service Catalog"] },
      { key: "language", label: "Language", type: "select", options: ["English (US)", "English (UK)", "Hindi", "German", "French", "Spanish", "Japanese"] },
      { key: "dateFormat", label: "Date Format", type: "select", options: ["DD MMM YYYY", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] },
      { key: "timeZone", label: "Time Zone", type: "select", options: ["UTC", "Asia/Kolkata", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Singapore"] },
      { key: "allowMobileAccess", label: "Allow Mobile Access", type: "checkbox" },
      { key: "allowApiAccess", label: "Allow API Access", type: "checkbox" },
      { key: "allowLogin", label: "Allow Login", type: "checkbox" }, { key: "reviewRequired", label: "Review Required", type: "checkbox" },
      { key: "notes", label: "Notes", wide: true },
    ],
  },
];

function asOptions(items: RecordData[], idKey: string, labelKey: string, codeKey?: string): Option[] {
  return items.map((item) => ({
    id: Number(item[idKey]),
    label: String(item[labelKey] ?? ""),
    ...(codeKey && item[codeKey] ? { code: String(item[codeKey]) } : {}),
  }));
}

function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: Option[]; selected: number[]; onChange: (ids: number[]) => void;
}) {
  return (
    <fieldset className="user-multi-select">
      <legend>{label}</legend>
      {options.length === 0 ? <p className="muted">No options available</p> : options.map((option) => (
        <label key={option.id}>
          <input
            type="checkbox"
            checked={selected.includes(option.id)}
            onChange={(event) => onChange(event.target.checked
              ? [...selected, option.id]
              : selected.filter((id) => id !== option.id))}
          />
          <span>{option.label}{option.code ? ` (${option.code})` : ""}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function CreateUserPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const editParams = useRouteParams("/config/admin/users/:id/edit");
  const editingId = editParams?.id ? Number(editParams.id) : null;
  const isEdit = editingId !== null && !Number.isNaN(editingId);
  const [form, setForm] = useState(initialForm);
  const [roles, setRoles] = useState<Option[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [managers, setManagers] = useState<Option[]>([]);
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [initialRoleAssignmentIds, setInitialRoleAssignmentIds] = useState<number[]>([]);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [initialGroupIds, setInitialGroupIds] = useState<number[]>([]);
  const [blockedGroups, setBlockedGroups] = useState<Record<number, string>>({});
  const [customAttrs, setCustomAttrs] = useState<MappingRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async <T,>(endpoint: string, done: (items: Option[]) => void, key: string, label: string, code?: string) => {
      try {
        const items = await adminMasterApi.list<T & RecordData>(endpoint);
        done(asOptions(items, key, label, code));
      } catch {
        done([]);
      }
    };
    void load("/roles", setRoles, "roleId", "roleName", "roleCode");
    void adminMasterApi.list<RecordData>("/assignment-groups")
      .then((items) => setGroups(asOptions(items, "groupId", "groupName")))
      .catch(() => setGroups([]));
    void load("/departments", setDepartments, "departmentId", "departmentName");
    void load("/locations", setLocations, "locationId", "locationName");
    void load("/users", setManagers, "userId", "fullName");

    directoryApi.customAttributes()
      .then((items) => setCustomAttrs(items))
      .catch(async () => {
        try {
          const srcList = await directoryApi.sources();
          const all: MappingRow[] = [];
          for (const s of srcList) {
            const maps = await directoryApi.mappings(s.sourceId);
            all.push(...maps);
          }
          const standardFields = new Set([
            "full name", "email address", "department", "job title",
            "phone number", "office location", "user principal name (reference)",
            "first name", "last name", "display name", "email id", "employee id",
            "manager", "business service", "location", "user type", "active",
          ]);
          const seen = new Set<string>();
          const custom = all.filter((m) => {
            const k = m.localField?.trim().toLowerCase();
            if (!k || seen.has(k)) return false;
            seen.add(k);
            return m.isActive && (m.isCustom || !standardFields.has(k));
          });
          setCustomAttrs(custom);
        } catch {
          // ignore
        }
      });
  }, []);

  const sections = React.useMemo(() => {
    const customFields: FormField[] = customAttrs.map((ca) => {
      const trimmed = ca.localField.trim();
      const slug = trimmed.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "");
      const lowerSlug = slug.charAt(0).toLowerCase() + slug.slice(1);
      const key = initialForm[lowerSlug] !== undefined ? lowerSlug : `custom_${lowerSlug || ca.mappingId}`;
      return {
        key,
        label: trimmed,
        type: "text" as const,
      };
    });

    return baseSections.map((sec, idx) => {
      if (idx === 0) {
        const standardExceptActive = sec.fields.filter((f) => f.key !== "isActive");
        const activeField = sec.fields.find((f) => f.key === "isActive");
        return {
          ...sec,
          fields: [...standardExceptActive, ...customFields, ...(activeField ? [activeField] : [])],
        };
      }
      return sec;
    });
  }, [customAttrs]);

  useEffect(() => {
    if (!isEdit || editingId === null) return;
    let cancelled = false;
    (async () => {
      try {
        const [existing, allGroups] = await Promise.all([
          adminMasterApi.get<RecordData>(`/users/${editingId}`),
          adminMasterApi.list<RecordData>("/assignment-groups"),
        ]);
        if (cancelled) return;
        const record = existing;
        const next: Record<string, string | boolean> = { ...initialForm };
        Object.keys(initialForm).forEach((key) => {
          const value = record[key];
          if (value === null || value === undefined) return;
          next[key] = typeof initialForm[key] === "boolean" ? Boolean(value) : String(value);
        });
        const department = record.department as RecordData | null | undefined;
        next.departmentId = department?.departmentId ? String(department.departmentId) : "";
        next.password = "";
        next.confirmPassword = "";
        next.passwordExpiryNever = record.passwordExpiryDays === null;
        if (record.passwordExpiryDays) next.passwordExpiryDays = String(record.passwordExpiryDays);
        const localCustom = localStorage.getItem(`user_custom_${editingId}`);
        if (localCustom) {
          try {
            const parsed = JSON.parse(localCustom);
            Object.assign(next, parsed);
          } catch {}
        }
        setForm(next);
        const userRoles = (record.userRoles as RecordData[] | undefined) ?? [];
        const primary = record.primaryRole as RecordData | null | undefined;
        const ids = new Set<number>();
        if (primary?.roleId) ids.add(Number(primary.roleId));
        const assignedRoleIds = userRoles
          .map((ur) => (ur.role as RecordData | undefined)?.roleId)
          .filter((id): id is number => typeof id === "number")
          .map(Number);
        assignedRoleIds.forEach((id) => ids.add(id));
        setRoleIds([...ids]);
        setInitialRoleAssignmentIds(assignedRoleIds);
        const group = record.assignmentGroup as RecordData | null | undefined;
        const membershipIds = allGroups
          .filter((item) => ((item.members as RecordData[] | undefined) ?? []).some((member) => Number(member.userId) === editingId))
          .map((item) => Number(item.groupId));
        if (group?.groupId && !membershipIds.includes(Number(group.groupId))) {
          membershipIds.push(Number(group.groupId));
        }
        setGroupIds(membershipIds);
        setInitialGroupIds(membershipIds);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Unable to load user.");
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, editingId]);

  const setValue = (key: string, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "firstName" || key === "lastName") {
      setForm((current) => {
        const next = { ...current, [key]: value };
        const name = `${String(next.firstName).trim()} ${String(next.lastName).trim()}`.trim();
        return {
          ...next,
          displayName: name,
          username: current.username === "" || current.username === `${String(current.firstName).toLowerCase()}.${String(current.lastName).toLowerCase()}`
            ? name.toLowerCase().replace(/\s+/g, ".")
            : current.username,
        };
      });
    }
  };

  const fieldOptions = (field: FormField): Option[] => {
    if (field.key === "departmentId") return departments;
    if (field.key === "location") return locations;
    if (field.key === "managerName") return managers;
    return (field.options ?? []).map((option, index) => ({ id: index + 1, label: option }));
  };

  const handleGroupChange = async (nextIds: number[]) => {
    if (!isEdit || editingId === null) {
      setGroupIds(nextIds);
      return;
    }
    const removedIds = initialGroupIds.filter((id) => !nextIds.includes(id));
    if (removedIds.length === 0) {
      setBlockedGroups({});
      setGroupIds(nextIds);
      return;
    }

    const newBlocked: Record<number, string> = {};
    for (const gid of removedIds) {
      try {
        const res = await api.get<{ count: number; hasOpenTickets: boolean }>(
          `/assignment-groups/${gid}/open-tickets/${editingId}`
        ).catch(async () => {
          const incs = await api.get<any[]>(
            `/incidents?assignmentGroupId=${gid}&assignedToUserId=${editingId}&openOnly=true`
          ).catch(() => []);
          return { count: incs?.length || 0, hasOpenTickets: (incs?.length || 0) > 0 };
        });
        if (res && res.hasOpenTickets) {
          const grp = groups.find((g) => g.id === gid);
          newBlocked[gid] = grp?.label ?? `Workgroup #${gid}`;
        }
      } catch {
        // ignore fetch errors
      }
    }

    if (Object.keys(newBlocked).length > 0) {
      setBlockedGroups(newBlocked);
      const safeIds = [...nextIds, ...Object.keys(newBlocked).map(Number).filter((id) => !nextIds.includes(id))];
      setGroupIds(safeIds);
    } else {
      setBlockedGroups({});
      setGroupIds(nextIds);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const password = String(form.password);
    if (password && (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password))) {
      setError("Password must be at least 8 characters and include an uppercase letter, a number, and a special character.");
      return;
    }
    if (password && password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (isEdit && editingId !== null) {
      const removedIds = initialGroupIds.filter((id) => !groupIds.includes(id));
      for (const gid of removedIds) {
        try {
          const res = await api.get<{ count: number; hasOpenTickets: boolean }>(
            `/assignment-groups/${gid}/open-tickets/${editingId}`
          ).catch(async () => {
            const incs = await api.get<any[]>(
              `/incidents?assignmentGroupId=${gid}&assignedToUserId=${editingId}&openOnly=true`
            ).catch(() => []);
            return { count: incs?.length || 0, hasOpenTickets: (incs?.length || 0) > 0 };
          });
          if (res && res.hasOpenTickets) {
            const grp = groups.find((g) => g.id === gid);
            const gName = grp?.label ?? `Workgroup #${gid}`;
            setError(`Cannot remove resolver from workgroup "${gName}" because open tickets are assigned to this user. Please reassign or resolve open tickets first.`);
            return;
          }
        } catch {}
      }
    }

    setSaving(true);
    try {
      const payload: RecordData = { ...form };
      delete payload.confirmPassword;
      delete payload.passwordExpiryNever;
      // Alternate e-mail is optional: a blank box must not be sent (it would fail the e-mail check).
      if (!String(payload.alternateEmail ?? "").trim()) delete payload.alternateEmail;
      payload.password = password || undefined;
      payload.departmentId = form.departmentId ? Number(form.departmentId) : undefined;
      payload.passwordExpiryDays = form.passwordExpiryNever ? null : Number(form.passwordExpiryDays) || 90;
      payload.roleId = roleIds[0];
      payload.assignmentGroupId = groupIds[0];
      const customValues: Record<string, any> = {};
      Object.keys(payload).forEach((k) => {
        if (k.startsWith("custom_")) {
          customValues[k] = payload[k];
          delete payload[k];
        }
      });
      const saved = isEdit && editingId !== null
        ? await adminMasterApi.update<RecordData>("/users", editingId, payload)
        : await adminMasterApi.create<RecordData>("/users", payload);
      const userId = Number(saved.userId ?? editingId);
      if (userId && Object.keys(customValues).length > 0) {
        localStorage.setItem(`user_custom_${userId}`, JSON.stringify(customValues));
      }
      const assignments = await Promise.allSettled([
        ...roleIds.filter((roleId) => roleId !== roleIds[0] && !initialRoleAssignmentIds.includes(roleId))
          .map((roleId) => adminMasterApi.create<void>("/roles/assign", { userId, roleId })),
        ...(isEdit ? initialRoleAssignmentIds.filter((roleId) => !roleIds.includes(roleId)) : [])
          .map((roleId) => api.delete<void>(`/roles/user/${userId}/role/${roleId}`)),
        ...groupIds.map((groupId) => adminMasterApi.create<void>(`/assignment-groups/${groupId}/members/${userId}`)),
        ...(isEdit ? initialGroupIds.filter((groupId) => !groupIds.includes(groupId)) : [])
          .map((groupId) => api.delete<void>(`/assignment-groups/${groupId}/members/${userId}`)),
      ]);
      const failures = assignments.filter((result) => result.status === "rejected").length;
      if (failures) setError(`User ${isEdit ? "saved" : "created"}, but ${failures} additional role or group assignment(s) failed.`);
      else {
        setInitialRoleAssignmentIds(roleIds);
        setInitialGroupIds(groupIds);
        navigate("/config/admin/users");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Unable to ${isEdit ? "update" : "create"} user.`);
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== "ADMIN") return <div className="page-body"><div className="empty-state">Admin access required.</div></div>;

  return (
    <>
      <div className="page-header">
        <div className="breadcrumb">Configuration &gt; User Management &gt; {isEdit ? "Edit User" : "Create User"}</div>
        <div className="admin-master-heading">
          <div>
            <div className="page-title">{isEdit ? "Edit User" : "Create User"}</div>
            <div className="page-subtitle">{isEdit ? "Update the user profile, account, roles, and access. Leave the password blank to keep it unchanged." : "Set up the user profile, account, roles, and access."}</div>
          </div>
          <button type="button" className="btn-ghost user-back-button" onClick={() => navigate("/config/admin/users")}>
            <ArrowLeft aria-hidden="true" size={14} /> Back to Users
          </button>
        </div>
      </div>
      <form className="page-body create-user-form" onSubmit={submit}>
        {error && <div className="admin-master-error" role="alert">{error}</div>}
        {sections.map((section) => (
          <section className="card create-user-section" key={section.title}>
            <h2>{section.title}</h2>
            <div className="create-user-fields">
              {section.fields.map((field) => (
                <label className={`field-group ${field.wide ? "create-user-field-wide" : ""}`} key={field.key}>
                  {field.type === "checkbox" ? (
                    <span className="admin-master-check-label">
                      <input type="checkbox" checked={Boolean(form[field.key])} onChange={(event) => setValue(field.key, event.target.checked)} />
                      {field.label}
                    </span>
                  ) : <span className="lbl">{field.label}{field.required && <span className="req"> *</span>}</span>}
                  {field.type === "select" ? (
                    <select
                      className="select"
                      required={field.required}
                      value={String(form[field.key] ?? "")}
                      onChange={(event) => setValue(field.key, event.target.value)}
                    >
                      <option value="">Select {field.label.toLowerCase()}</option>
                      {fieldOptions(field).map((option) => (
                        <option key={option.id} value={field.key === "departmentId" ? option.id : option.label}>{option.label}</option>
                      ))}
                    </select>
                  ) : field.type !== "checkbox" && (
                    <input
                      className="input"
                      type={field.type ?? "text"}
                      required={field.required}
                      value={String(form[field.key] ?? "")}
                      onChange={(event) => setValue(field.key, event.target.value)}
                      disabled={field.key === "passwordExpiryDays" && Boolean(form.passwordExpiryNever)}
                    />
                  )}
                </label>
              ))}
            </div>
          </section>
        ))}
        <section className="card create-user-section">
          <h2>Role &amp; Access</h2>
          <div className="create-user-access-grid">
            <MultiSelect label="Roles" options={roles} selected={roleIds} onChange={setRoleIds} />
            <MultiSelect label="Assignment Groups" options={groups} selected={groupIds} onChange={handleGroupChange} />
          </div>
          {Object.keys(blockedGroups).length > 0 && (
            <div style={{ marginTop: 14, padding: "12px 16px", background: "#FEF0C7", border: "1px solid #FEDF89", borderRadius: 8, color: "#B54708", fontSize: 13, lineHeight: "1.4" }}>
              <strong>Cannot remove resolver from workgroup(s) with open tickets:</strong>
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                {Object.values(blockedGroups).map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              <div style={{ marginTop: 6, fontSize: 12, color: "#93370D" }}>
                Please reassign or resolve all open tickets assigned to this resolver before removing them from these workgroup(s).
              </div>
            </div>
          )}
          <p className="hint">The first selected role and group are assigned during user creation; additional selections are assigned afterward.</p>
        </section>
        <div className="admin-master-form-actions create-user-actions">
          <button type="button" className="btn-ghost" onClick={() => navigate("/config/admin/users")}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save aria-hidden="true" size={14} /> {saving ? "Saving…" : isEdit ? "Update User" : "Save User"}
          </button>
        </div>
      </form>
    </>
  );
}