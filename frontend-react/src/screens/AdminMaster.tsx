"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { ApiError } from "../api";
import { adminMasterApi } from "../adminMasterApi";
import { useAuth } from "../AuthContext";
import { Link, useRouteParams, useRouter } from "../router";
import { WorkgroupForm } from "./WorkgroupForm";

type AdminRecord = Record<string, unknown>;
type FieldType = "text" | "password" | "number" | "textarea" | "checkbox" | "select" | "json";

interface AdminField {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: string[];
}

interface AdminMasterDefinition {
  title: string;
  description: string;
  endpoint: string;
  idKey: string;
  nameKey: string;
  columns: AdminField[];
  fields: AdminField[];
}

const activeField: AdminField = { key: "isActive", label: "Active", type: "checkbox" };

const definitions: Record<string, AdminMasterDefinition> = {
  categories: {
    title: "Category Management", description: "Manage incident categories and their hierarchy.",
    endpoint: "/categories", idKey: "categoryId", nameKey: "categoryName",
    columns: [
      { key: "categoryName", label: "Category Name" }, { key: "categoryCode", label: "Code" },
      { key: "parent", label: "Parent Category" }, { key: "isActive", label: "Active", type: "checkbox" },
    ],
    fields: [
      { key: "categoryName", label: "Category Name", required: true }, { key: "categoryCode", label: "Category Code" },
      { key: "parentCategoryId", label: "Parent Category ID", type: "number" },
      { key: "description", label: "Description", type: "textarea" }, activeField,
    ],
  },
  "sub-category": {
    title: "Sub-category Management", description: "Manage sub-categories under incident categories.",
    endpoint: "/sub-category", idKey: "subCategoryId", nameKey: "subCategoryName",
    columns: [
      { key: "subCategoryName", label: "Sub-category Name" }, { key: "subCategoryCode", label: "Code" },
      { key: "category", label: "Category" }, { key: "isActive", label: "Active", type: "checkbox" },
    ],
    fields: [
      { key: "subCategoryName", label: "Sub-category Name", required: true }, { key: "subCategoryCode", label: "Sub-category Code", required: true },
      { key: "categoryId", label: "Category ID", type: "number" },
      { key: "description", label: "Description", type: "textarea" }, activeField,
    ],
  },
  status: {
    title: "Status Management", description: "Manage incident status values.",
    endpoint: "/status", idKey: "statusId", nameKey: "statusName",
    columns: [
      { key: "statusName", label: "Status Name" }, { key: "statusCode", label: "Code" },
      { key: "type", label: "Type" }, { key: "isOpen", label: "Open", type: "checkbox" },
      { key: "isActive", label: "Active", type: "checkbox" },
    ],
    fields: [
      { key: "statusName", label: "Status Name", required: true }, { key: "statusCode", label: "Status Code", required: true },
      { key: "type", label: "Type", type: "select", options: ["incident", "request", "change", "problem"] },
      { key: "isOpen", label: "Open status", type: "checkbox" }, activeField,
    ],
  },
  "assignment-group": {
    title: "Assignment Group Management", description: "Manage groups that incidents can be assigned to.",
    endpoint: "/assignment-groups", idKey: "groupId", nameKey: "groupName",
    columns: [
      { key: "groupName", label: "Group Name" }, { key: "groupCode", label: "Code" },
      { key: "isDefault", label: "Default", type: "checkbox" }, { key: "isActive", label: "Active", type: "checkbox" },
    ],
    fields: [
      { key: "groupName", label: "Group Name", required: true }, { key: "groupCode", label: "Group Code", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "isDefault", label: "Default group", type: "checkbox" }, activeField,
    ],
  },
  "closure-code": {
    title: "Closure Codes", description: "Define the reasons an incident can be closed with, used on the closure screen.",
    endpoint: "/closure-codes", idKey: "closureCodeId", nameKey: "closureCodeName",
    columns: [{ key: "closureCodeName", label: "Closure Code" }, { key: "description", label: "Description" }, { key: "isActive", label: "Active", type: "checkbox" }],
    fields: [
      { key: "closureCodeName", label: "Closure Code Name", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "displayOrder", label: "Display Order", type: "number" },
      activeField,
    ],
  },
  "pending-reason": {
    title: "Pending Reasons", description: "Define why an incident is placed on hold while it's pending action.",
    endpoint: "/pending-reasons", idKey: "pendingReasonId", nameKey: "pendingReasonName",
    columns: [{ key: "pendingReasonName", label: "Pending Reason" }, { key: "description", label: "Description" }, { key: "isActive", label: "Active", type: "checkbox" }],
    fields: [
      { key: "pendingReasonName", label: "Pending Reason Name", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "displayOrder", label: "Display Order", type: "number" },
      activeField,
    ],
  },
  "request-pending-reason": {
    title: "Service Request Pending Reasons", description: "Define why a service request is placed on hold. Separate from incident pending reasons.",
    endpoint: "/request-pending-reasons", idKey: "pendingReasonId", nameKey: "pendingReasonName",
    columns: [{ key: "pendingReasonName", label: "Pending Reason" }, { key: "description", label: "Description" }, { key: "slaImpact", label: "SLA Impact" }, { key: "isActive", label: "Active", type: "checkbox" }],
    fields: [
      { key: "pendingReasonName", label: "Pending Reason Name", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "slaImpact", label: "SLA Impact", type: "select", options: ["pause", "continue"] },
      { key: "displayOrder", label: "Display Order", type: "number" },
      activeField,
    ],
  },
  "resolution-code": {
    title: "Resolution Codes", description: "Define how an incident was technically resolved, captured at resolution time.",
    endpoint: "/resolution-codes", idKey: "resolutionCodeId", nameKey: "resolutionCodeName",
    columns: [{ key: "resolutionCodeName", label: "Resolution Code" }, { key: "description", label: "Description" }, { key: "isActive", label: "Active", type: "checkbox" }],
    fields: [
      { key: "resolutionCodeName", label: "Resolution Code Name", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "displayOrder", label: "Display Order", type: "number" },
      activeField,
    ],
  },
  impact: {
    title: "Impact", description: "Define how broadly an incident affects the business — used to help derive priority.",
    endpoint: "/impact", idKey: "impactId", nameKey: "impactName",
    columns: [
      { key: "impactName", label: "Impact Level" }, { key: "description", label: "Description" },
      { key: "color", label: "Color" }, { key: "isActive", label: "Active", type: "checkbox" },
    ],
    fields: [
      { key: "impactName", label: "Impact Name", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "displayOrder", label: "Display Order", type: "number" },
      { key: "color", label: "Color", type: "select", options: ["Red", "Amber", "Blue", "Gray", "Green", "Purple"] },
      activeField,
    ],
  },
  priority: {
    title: "Priority", description: "Define the priority levels incidents are assigned, typically derived from Impact and Urgency.",
    endpoint: "/priority", idKey: "priorityId", nameKey: "priorityName",
    columns: [
      { key: "priorityName", label: "Priority Level" }, { key: "responseSla", label: "Response SLA" },
      { key: "resolutionSla", label: "Resolution SLA" }, { key: "color", label: "Color" }, { key: "isActive", label: "Status", type: "checkbox" },
    ],
    fields: [
      { key: "priorityName", label: "Priority Name", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "responseSlaMinutes", label: "Response SLA (Minutes)", type: "number" },
      { key: "resolutionSlaHours", label: "Resolution SLA (Hours)", type: "number" },
      { key: "order", label: "Display Order", type: "number" },
      { key: "color", label: "Color", type: "select", options: ["Red", "Amber", "Blue", "Gray", "Green", "Purple"] }, activeField,
    ],
  },
  "priority-matrix": {
    title: "Priority Matrix Management", description: "Map urgency and impact combinations to priority values.",
    endpoint: "/priority-matrices", idKey: "priorityMatrixId", nameKey: "priorityMatrixId",
    columns: [
      { key: "urgency", label: "Urgency" }, { key: "impact", label: "Impact" },
      { key: "priority", label: "Priority" }, { key: "isActive", label: "Active", type: "checkbox" },
    ],
    fields: [
      { key: "urgencyId", label: "Urgency ID", type: "number", required: true },
      { key: "impactId", label: "Impact ID", type: "number", required: true },
      { key: "priorityId", label: "Priority ID", type: "number", required: true }, activeField,
    ],
  },
  "sla-service-window": {
    title: "SLA Service Window", description: "Define named business-hour calendars (days, times, timezone) that can be assigned to workgroups to control when the SLA clock runs.",
    endpoint: "/sla-windows", idKey: "slaId", nameKey: "slaName",
    columns: [
      { key: "slaName", label: "Service Window" }, { key: "daysActive", label: "Days" },
      { key: "time", label: "Time" }, { key: "isActive", label: "Status", type: "checkbox" },
    ],
    fields: [
      { key: "slaName", label: "Service Window Name", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "daysActive", label: "Days Active (e.g. Mon-Fri)", required: true },
      { key: "startTime", label: "Start Time (e.g. 09:00 AM)" },
      { key: "endTime", label: "End Time (e.g. 06:00 PM)" },
      { key: "timeZone", label: "Timezone", type: "select", options: ["UTC", "IST", "EST", "PST"] },
      { key: "order", label: "Display Order", type: "number" }, activeField,
    ],
  },
  urgency: {
    title: "Urgency", description: "Define how quickly an incident needs attention — used to help derive priority.",
    endpoint: "/urgency", idKey: "urgencyId", nameKey: "urgencyName",
    columns: [
      { key: "urgencyName", label: "Urgency Level" }, { key: "description", label: "Description" },
      { key: "color", label: "Color" }, { key: "isActive", label: "Status", type: "checkbox" },
    ],
    fields: [
      { key: "urgencyName", label: "Urgency Name", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "displayOrder", label: "Display Order", type: "number" },
      { key: "color", label: "Color", type: "select", options: ["Red", "Amber", "Blue", "Gray", "Green", "Purple"] }, activeField,
    ],
  },
  users: {
    title: "Users Management", description: "Manage system users and account access.",
    endpoint: "/users", idKey: "userId", nameKey: "fullName",
    columns: [
      { key: "fullName", label: "Name" }, { key: "username", label: "Username" },
      { key: "email", label: "Email" }, { key: "department", label: "Department" },
      { key: "primaryRole", label: "Role" }, { key: "isActive", label: "Active", type: "checkbox" },
    ],
    fields: [
      { key: "username", label: "Username", required: true }, { key: "email", label: "Email", required: true },
      { key: "firstName", label: "First Name", required: true }, { key: "lastName", label: "Last Name", required: true },
      { key: "password", label: "Password", type: "password" }, { key: "departmentId", label: "Department ID", type: "number" },
      { key: "jobTitle", label: "Job Title" }, { key: "userType", label: "User Type", type: "select", options: ["Internal", "External", "Partner"] },
      { key: "allowLogin", label: "Allow login", type: "checkbox" }, activeField,
    ],
  },
  roles: {
    title: "Role Management", description: "Manage roles available for user access.",
    endpoint: "/roles", idKey: "roleId", nameKey: "roleName",
    columns: [
      { key: "roleName", label: "Role Name" }, { key: "roleCode", label: "Code" },
      { key: "description", label: "Description" }, { key: "isActive", label: "Active", type: "checkbox" },
    ],
    fields: [
      { key: "roleName", label: "Role Name", required: true }, { key: "roleCode", label: "Role Code" },
      { key: "description", label: "Description", type: "textarea" }, activeField,
    ],
  },
  departments: {
    title: "Department Management", description: "Manage departments and portal availability.",
    endpoint: "/departments", idKey: "departmentId", nameKey: "departmentName",
    columns: [
      { key: "departmentName", label: "Department Name" }, { key: "departmentCode", label: "Code" },
      { key: "availableInPortal", label: "Portal", type: "checkbox" }, { key: "isActive", label: "Active", type: "checkbox" },
    ],
    fields: [
      { key: "departmentName", label: "Department Name", required: true }, { key: "departmentCode", label: "Department Code", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "availableInPortal", label: "Available in portal", type: "checkbox" }, activeField,
    ],
  },
  locations: {
    title: "Location Management", description: "Manage organization locations.",
    endpoint: "/locations", idKey: "locationId", nameKey: "locationName",
    columns: [
      { key: "locationName", label: "Location Name" }, { key: "locationCode", label: "Code" },
      { key: "type", label: "Type" }, { key: "isActive", label: "Active", type: "checkbox" },
    ],
    fields: [
      { key: "locationName", label: "Location Name", required: true }, { key: "locationCode", label: "Location Code", required: true },
      { key: "type", label: "Location Type" }, { key: "description", label: "Description", type: "textarea" }, activeField,
    ],
  },
  workgroups: {
    title: "Groups", description: "Create groups once and reuse them across incidents, service requests, changes, approvals, and assignments.",
    endpoint: "/assignment-groups", idKey: "groupId", nameKey: "groupName",
    columns: [
      { key: "groupName", label: "Group" }, { key: "manager", label: "Manager" },
      { key: "memberCount", label: "Members" }, { key: "isActive", label: "Status", type: "checkbox" },
      { key: "isDefault", label: "Default" }
    ],
    fields: [
      { key: "groupName", label: "Workgroup Name", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "manager", label: "Manager" },
      { key: "memberCount", label: "Member Count", type: "number" },
      activeField,
      { key: "isDefault", label: "Default Workgroup", type: "checkbox" },
    ],
  },
};

function emptyForm(fields: AdminField[]): AdminRecord {
  return Object.fromEntries(fields.map((field) => [
    field.key,
    field.type === "checkbox" ? field.key === "isActive" : field.type === "json" ? "[]" : "",
  ]));
}

function formatValue(value: unknown, type?: FieldType): string {
  if (type === "checkbox") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.categoryName ?? record.departmentName ?? record.roleName ?? record.locationName ?? record.impactName ?? record.urgencyName ?? record.priorityName ?? record.name ?? "—");
  }
  return String(value);
}

function valueToFormString(value: unknown, type?: FieldType): string {
  if (type === "checkbox") return String(Boolean(value));
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    // Try to extract a meaningful string from the object
    return String(record.description ?? record.name ?? record.categoryName ?? record.departmentName ?? record.roleName ?? record.locationName ?? record.impactName ?? record.urgencyName ?? record.priorityName ?? "");
  }
  return String(value);
}

export function AdminMasterPage() {
  const params = useRouteParams("/config/admin/:master");
  const { user } = useAuth();
  const { navigate, path } = useRouter();
  const masterKey = params?.master === "groups" || path === "/config/admin/groups"
    ? "workgroups"
    : params?.master;
  
  // These have dedicated pages — skip rendering AdminMaster for them
  const dedicatedPages = new Set(["categories", "priority-matrix", "sla-matrix", "workgroup-sla"]);
  if (masterKey && dedicatedPages.has(masterKey)) return null;

  const definition = masterKey ? definitions[masterKey] : undefined;
  const managementSection = ["users", "roles", "departments", "locations", "workgroups"].includes(masterKey ?? "")
    ? "User Management"
    : ["impact", "priority", "priority-matrix", "sla-service-window", "workgroup-sla", "urgency"].includes(masterKey ?? "")
      ? "SLA Configurations"
      : masterKey === "workgroups"
        ? "User Management"
        : "Incident Masters";

  // Masters that render as a numbered list (name + description rows) instead of a plain table
  const NUMBERED_MASTERS = new Set(["closure-code", "pending-reason", "resolution-code", "impact", "urgency", "priority", "sla-service-window"]);
  const isNumbered = NUMBERED_MASTERS.has(masterKey ?? "");

  // Color chip mapping for Impact, Urgency, Priority
  const COLOR_MAP: Record<string, { bg: string; color: string; border: string }> = {
    Red:    { bg: "#FEF3F2", color: "#B42318", border: "#FECDCA" },
    Amber:  { bg: "#FFFAEB", color: "#B45309", border: "#FEDF89" },
    Blue:   { bg: "#EFF8FF", color: "#026AA2", border: "#B2DDFF" },
    Gray:   { bg: "#F2F4F7", color: "#667085", border: "#D0D5DD" },
    Green:  { bg: "#ECFDF3", color: "#067647", border: "#ABEFC6" },
    Purple: { bg: "#F4F3FF", color: "#5925DC", border: "#D9D6FE" },
  };

  // Name key for numbered list items
  const numberedNameKey = masterKey === "closure-code" ? "closureCodeName"
    : masterKey === "pending-reason" ? "pendingReasonName"
    : masterKey === "resolution-code" ? "resolutionCodeName"
    : masterKey === "urgency" ? "urgencyName"
    : masterKey === "priority" ? "priorityName"
    : masterKey === "sla-service-window" ? "slaName"
    : "impactName";
  const [items, setItems] = useState<AdminRecord[]>([]);
  const [form, setForm] = useState<AdminRecord>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!definition) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    adminMasterApi.list<AdminRecord>(definition.endpoint)
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Unable to load records.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [definition?.endpoint]);

  if (user?.role !== "ADMIN") return <div className="page-body"><div className="empty-state">Admin access required.</div></div>;
  if (!definition) return <div className="page-body"><div className="empty-state">Configuration page not found.</div></div>;

  const loadItems = async () => {
    setLoading(true);
    try {
      setItems(await adminMasterApi.list<AdminRecord>(definition.endpoint));
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load records.");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(definition.fields));
    setFormOpen(true);
    setError("");
  };

  const openEdit = (item: AdminRecord) => {
    const nextForm = emptyForm(definition.fields);
    definition.fields.forEach((field) => {
      const value = item[field.key];
      nextForm[field.key] = field.type === "json"
        ? JSON.stringify(value ?? [], null, 2)
        : field.type === "checkbox"
          ? Boolean(value)
          : value === null || value === undefined
            ? ""
            : typeof value === "object"
              ? valueToFormString(value, field.type)
              : String(value);
    });
    setForm(nextForm);
    setEditingId(Number(item[definition.idKey]));
    setFormOpen(true);
    setError("");
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: AdminRecord = {};
      definition.fields.forEach((field) => {
        const value = form[field.key];
        if (field.key === "password" && value === "") return;
        if (field.type === "number") payload[field.key] = value === "" ? null : Number(value);
        else if (field.type === "json") payload[field.key] = JSON.parse(String(value || "[]"));
        else payload[field.key] = value;
      });
      if (editingId === null) await adminMasterApi.create<AdminRecord>(definition.endpoint, payload);
      else await adminMasterApi.update<AdminRecord>(definition.endpoint, editingId, payload);
      setFormOpen(false);
      await loadItems();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to save record.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: AdminRecord) => {
    const id = Number(item[definition.idKey]);
    if (!window.confirm(`Delete ${String(item[definition.nameKey] ?? "this record")}?`)) return;
    setError("");
    try {
      await adminMasterApi.remove<void>(definition.endpoint, id);
      await loadItems();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to delete record.");
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const isUsers = masterKey === "users";

  // Users table: optional columns the admin can switch on/off from the "Columns" menu.
  const USER_COLUMNS = [
    { key: "department", label: "Department" },
    { key: "email", label: "Email" },
    { key: "primaryRole", label: "Role" },
    { key: "userType", label: "User Type" },
    { key: "status", label: "Status" },
  ] as const;
  const [userCols, setUserCols] = useState<Record<string, boolean>>({
    department: true, email: false, primaryRole: false, userType: true, status: true,
  });
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!colsOpen) return;
    const close = (e: MouseEvent) => {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [colsOpen]);
  const showCol = (key: string) => userCols[key] !== false;

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    return definition.columns.some((col) => {
      const val = formatValue(item[col.key], col.type).toLowerCase();
      return val.includes(searchQuery.toLowerCase());
    });
  });

  function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function avatarColor(initials: string): { bg: string; color: string } {
    const colors = [
      { bg: "#EFF4FC", color: "#175CD3" },
      { bg: "#ECFDF3", color: "#067647" },
      { bg: "#FFFAEB", color: "#B45309" },
      { bg: "#FEF3F2", color: "#B42318" },
      { bg: "#F0FDF4", color: "#15803D" },
    ];
    const idx = (initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % colors.length;
    return colors[idx];
  }

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">Configuration &gt; {managementSection} &gt; {definition.title}</div>
          <div className="page-title">{definition.title}</div>
          <div className="page-subtitle">{definition.description}</div>
        </div>
        <button className="btn-ghost">Close</button>
      </div>
      <div className="page-body">
        {error && <div className="admin-master-error" role="alert">{error}</div>}
        {formOpen && masterKey === "workgroups" && (
          <WorkgroupForm
            key={editingId ?? "new"}
            item={editingId === null ? null : items.find((it) => Number(it[definition.idKey]) === editingId) ?? null}
            onClose={() => setFormOpen(false)}
            onSaved={() => { setFormOpen(false); void loadItems(); }}
          />
        )}
        {formOpen && masterKey !== "workgroups" && (
          <form className="card admin-master-form-panel" onSubmit={save}>
            <div className="admin-master-form-heading">
              <h2>{editingId === null ? "Add record" : "Edit record"}</h2>
              <button type="button" className="admin-master-icon-button" aria-label="Close form" onClick={() => setFormOpen(false)}>
                <X aria-hidden="true" size={16} />
              </button>
            </div>
            <div className="admin-master-form-grid">
              {definition.fields.map((field) => (
                <label className={`field-group ${field.type === "textarea" || field.type === "json" ? "admin-master-wide" : ""}`} key={field.key}>
                  {field.type === "checkbox" ? (
                    <span className="admin-master-check-label">
                      <input
                        type="checkbox"
                        checked={Boolean(form[field.key])}
                        onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.checked }))}
                      />
                      {field.label}
                    </span>
                  ) : <span className="lbl">{field.label}{field.required && <span className="req"> *</span>}</span>}
                  {field.type === "textarea" || field.type === "json" ? (
                    <textarea
                      className="textarea"
                      required={field.required}
                      value={String(form[field.key] ?? "")}
                      onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  ) : field.type === "select" ? (
                    <select
                      className="select"
                      required={field.required}
                      value={String(form[field.key] ?? "")}
                      onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                    >
                      <option value="">Select…</option>
                      {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : field.type !== "checkbox" && (
                    <input
                      className="input"
                      type={field.type === "number" || field.type === "password" ? field.type : "text"}
                      required={field.required}
                      value={String(form[field.key] ?? "")}
                      onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="admin-master-form-actions">
              <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </form>
        )}
        <div className="card admin-master-table-wrap" style={{ overflow: "hidden", display: "flex", flexDirection: "column", width: "100%", maxWidth: isUsers ? "none" : 600, flex: isUsers ? 1 : 0 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E4E7EC", flexShrink: 0 }}>
            <div className="proto-eyebrow">
              <div className="proto-eyebrow-title">
                {isUsers
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>&nbsp;</>
                  : null}
                {isUsers ? "USERS" : `${definition.title.replace(" Management", "").toUpperCase()}S`} ( {loading ? "…" : items.length} )
              </div>
              {isUsers ? (
                <Link to="/config/admin/users/create" className="btn-primary admin-master-add">
                  <Plus aria-hidden="true" size={15} /> Add User
                </Link>
              ) : (
                <button className="btn-primary admin-master-add" onClick={openCreate}>
                  <Plus aria-hidden="true" size={15} /> Add {definition.title.replace(" Management", "")}
                </button>
              )}
            </div>
          </div>
          <div style={{ padding: "0 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div className="proto-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
                style={{ position: "absolute", left: 10, color: "var(--muted-2)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                className="proto-search"
                placeholder={isUsers ? "Search by name, username, email, department, role…" : `Search ${definition.title.replace(" Management", "").toLowerCase()}s…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {isUsers && (
              <div ref={colsRef} style={{ position: "relative" }}>
                <button type="button" className="columns-btn" aria-haspopup="true" aria-expanded={colsOpen} onClick={() => setColsOpen((o) => !o)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                  </svg>
                  Columns &#8964;
                </button>
                {colsOpen && (
                  <div role="menu" style={{ position: "absolute", right: 0, top: 40, zIndex: 20, minWidth: 180, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 8px 24px rgba(16,24,40,0.12)", padding: 8 }}>
                    {USER_COLUMNS.map((c) => (
                      <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 12.5, cursor: "pointer" }}>
                        <input type="checkbox" checked={showCol(c.key)} onChange={() => setUserCols((cur) => ({ ...cur, [c.key]: !showCol(c.key) }))} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {loading ? (
            <div className="spinner-row">Loading…</div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">No records found.</div>
          ) : isUsers ? (
            /* Users-specific table matching prototype */
            <div className="admin-master-table-scroll" style={{ overflow: "auto", flex: 1, minHeight: 400 }}>
              <table>
                <thead><tr>
                  <th style={{ width: 48 }}></th>
                  <th>NAME</th>
                  {showCol("department") && <th style={{ width: 200 }}>DEPARTMENT</th>}
                  {showCol("email") && <th style={{ width: 240 }}>EMAIL</th>}
                  {showCol("primaryRole") && <th style={{ width: 160 }}>ROLE</th>}
                  {showCol("userType") && <th style={{ width: 130 }}>USER TYPE</th>}
                  {showCol("status") && <th style={{ width: 100 }}>STATUS</th>}
                  <th style={{ width: 50 }}></th>
                </tr></thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const fullName = formatValue(item["fullName"]);
                    const username = formatValue(item["username"]);
                    const dept = formatValue(item["department"]);
                    const userType = formatValue(item["userType"]);
                    const isActive = Boolean(item["isActive"]);
                    const initials = initialsOf(fullName !== "—" ? fullName : username);
                    const c = avatarColor(initials);
                    return (
                      <tr key={String(item[definition.idKey])}>
                        <td>
                          <div className="user-avatar" style={{ background: c.bg, color: c.color }}>{initials}</div>
                        </td>
                        <td>
                          <div className="user-name-cell">
                            <div>
                              <div className="user-name-primary">{fullName !== "—" ? fullName : username}</div>
                              {fullName !== "—" && username !== "—" && (
                                <div className="user-name-secondary">{username}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        {showCol("department") && <td style={{ fontSize: 12.5 }}>{dept}</td>}
                        {showCol("email") && <td style={{ fontSize: 12.5 }}>{formatValue(item["email"])}</td>}
                        {showCol("primaryRole") && <td style={{ fontSize: 12.5 }}>{formatValue(item["primaryRole"])}</td>}
                        {showCol("userType") && <td style={{ fontSize: 12.5 }}>{userType}</td>}
                        {showCol("status") && (
                          <td>
                            <span className={`status-pill ${isActive ? "active" : "inactive"}`}>
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        )}
                        <td className="admin-master-actions">
                          <button className="admin-master-icon-button" title="Edit" aria-label={`Edit ${fullName}`} onClick={() => navigate(`/config/admin/users/${String(item.userId)}/edit`)}>
                            <Pencil aria-hidden="true" size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : masterKey === "workgroups" ? (
            /* Workgroups-specific table matching prototype */
            <div style={{ padding: "0 20px 20px" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 44 }}></th>
                    <th style={{ textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>WORKGROUP</th>
                    <th style={{ width: 140, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>MANAGER</th>
                    <th style={{ width: 90, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px", textAlign: "center" }}>MEMBERS</th>
                    <th style={{ width: 100, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>STATUS</th>
                    <th style={{ width: 90, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>DEFAULT</th>
                    <th style={{ width: 44 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const name = formatValue(item["groupName"]);
                    const desc = formatValue(item["description"]);
                    const managerRec = item["manager"] as { fullName?: string } | null | undefined;
                    const manager = managerRec?.fullName ?? formatValue(item["manager"]);
                    const memberList = item["members"] as unknown[] | undefined;
                    const members = Array.isArray(memberList) ? String(memberList.length) : formatValue(item["memberCount"]);
                    const isActive = Boolean(item["isActive"]);
                    const isDefault = Boolean(item["isDefault"]);
                    const initials = initialsOf(name);
                    const c = avatarColor(initials);
                    return (
                      <tr key={String(item[definition.idKey])}>
                        <td style={{ verticalAlign: "top", paddingTop: 14 }}>
                          <div className="user-avatar" style={{ background: c.bg, color: c.color }}>{initials}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{name}</div>
                          {desc !== "—" && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{desc}</div>}
                        </td>
                        <td style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{manager}</td>
                        <td style={{ fontSize: 12.5, color: "var(--ink-soft)", textAlign: "center" }}>{members}</td>
                        <td>
                          <span className={`status-pill ${isActive ? "active" : "inactive"}`}>
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          {isDefault ? <span className="chip" style={{ background: "#EFF4FC", color: "#175CD3", fontWeight: 700, fontSize: 11, padding: "2px 8px" }}>Default</span> : null}
                        </td>
                        <td className="admin-master-actions">
                          <button className="admin-master-icon-button" title="Edit" aria-label={`Edit ${name}`} onClick={() => openEdit(item)}>
                            <Pencil aria-hidden="true" size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : isNumbered ? (
            /* Numbered list for Closure Codes, Pending Reasons, Resolution Codes, Impact, Urgency, Priority, SLA Service Window */
            <div style={{ padding: "0 20px 20px", overflow: "auto", flex: 1, minHeight: 400 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 44 }}></th>
                    <th style={{ textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>
                      {definition.columns[0].label}
                    </th>
                    {masterKey === "priority" && (
                      <>
                        <th style={{ width: 140, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>RESPONSE SLA</th>
                        <th style={{ width: 140, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>RESOLUTION SLA</th>
                      </>
                    )}
                    {masterKey === "sla-service-window" && (
                      <>
                        <th style={{ width: 140, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>DAYS</th>
                        <th style={{ width: 180, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>TIME</th>
                      </>
                    )}
                    {(masterKey === "impact" || masterKey === "urgency" || masterKey === "priority") && (
                      <th style={{ width: 120, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>COLOR</th>
                    )}
                    <th style={{ width: 110, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" }}>STATUS</th>
                    <th style={{ width: 44 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => {
                    const name = formatValue(item[numberedNameKey]);
                    const desc = formatValue(item["description"]);
                    const isActive = Boolean(item["isActive"]);
                    const colorStr = String(item["color"] ?? "");
                    const colorStyle = COLOR_MAP[colorStr];
                    
                    const rspSla = formatValue(item["responseSlaMinutes"]) + " Minutes";
                    const resSla = formatValue(item["resolutionSlaHours"]) + " Hours";
                    const days = formatValue(item["daysActive"]);
                    const time = (item["startTime"] || "00:00") + " - " + (item["endTime"] || "23:59") + " " + (item["timeZone"] || "UTC");

                    return (
                      <tr key={String(item[definition.idKey])}>
                        <td style={{ verticalAlign: "top", paddingTop: 14 }}>
                          <div className="numbered-badge">{index + 1}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{name}</div>
                          {desc !== "—" && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{desc}</div>}
                        </td>
                        {masterKey === "priority" && (
                          <>
                            <td style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{item["responseSlaMinutes"] ? rspSla : "—"}</td>
                            <td style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{item["resolutionSlaHours"] ? resSla : "—"}</td>
                          </>
                        )}
                        {masterKey === "sla-service-window" && (
                          <>
                            <td style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{days}</td>
                            <td style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{time}</td>
                          </>
                        )}
                        {(masterKey === "impact" || masterKey === "urgency" || masterKey === "priority") && (
                          <td>
                            {colorStyle ? (
                              <span style={{
                                display: "inline-flex", alignItems: "center", padding: "2px 12px",
                                borderRadius: 12, fontSize: 12, fontWeight: 600,
                                background: colorStyle.bg, color: colorStyle.color,
                                border: `1px solid ${colorStyle.border}`,
                              }}>
                                {colorStr}
                              </span>
                            ) : colorStr || "—"}
                          </td>
                        )}
                        <td>
                          <span className={`status-pill ${isActive ? "active" : "inactive"}`}>
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="admin-master-actions">
                          <button className="admin-master-icon-button" title="Edit" aria-label={`Edit ${name}`} onClick={() => openEdit(item)}>
                            <Pencil aria-hidden="true" size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-master-table-scroll" style={{ overflow: "auto", flex: 1, minHeight: 400 }}>
              <table>
                <thead><tr>
                  {definition.columns.map((column) => <th key={column.key}>{column.label}</th>)}
                  <th className="admin-master-actions-heading">Actions</th>
                </tr></thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={String(item[definition.idKey])}>
                      {definition.columns.map((column) => (
                        <td key={column.key}>
                          {column.key === "isActive" ? (
                            <span className={`status-pill ${item[column.key] ? "active" : "inactive"}`}>
                              {item[column.key] ? "Active" : "Inactive"}
                            </span>
                          ) : (
                            formatValue(item[column.key], column.type)
                          )}
                        </td>
                      ))}
                      <td className="admin-master-actions">
                        <button className="admin-master-icon-button" title="Edit" aria-label={`Edit ${String(item[definition.nameKey] ?? "record")}`} onClick={() => openEdit(item)}>
                          <Pencil aria-hidden="true" size={15} />
                        </button>
                        <button className="admin-master-icon-button danger" title="Delete" aria-label={`Delete ${String(item[definition.nameKey] ?? "record")}`} onClick={() => void remove(item)}>
                          <Trash2 aria-hidden="true" size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
