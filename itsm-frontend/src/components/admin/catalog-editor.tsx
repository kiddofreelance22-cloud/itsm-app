"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload, X, Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Grid3x3,
  Eye, Save, Loader2, Check, AlertCircle,
  Type, AlignLeft, Hash, Calendar, List, CheckSquare,
  Circle, Paperclip, User, Users, LayoutGrid,
  Info, Pencil, Settings, Lock, Shield, Laptop,
  ExternalLink,
} from "lucide-react";
import { Catalog, CatalogVariable, CatalogFormSection, CatalogAttachment, FieldType } from "@/types/catalog";
import {
  CreateCatalogDto, CreateVariableDto, CreateSectionDto,
} from "@/lib/api/catalogs.api";
import { CatalogsApi } from "@/lib/api/catalogs.api";
import { useAdminWorkflows } from "@/lib/hooks/use-admin";
import { apiFetch, resolveAssetUrl } from "@/lib/api/client";
import { uploadFile } from "@/lib/api/uploads.api";
import { AssignmentGroup } from "@/lib/api/incidents.api";
import type { ServiceCategory } from "@/types/admin";
import { RichTextEditor } from "./rich-text-editor";
import { CatalogAttachmentsPanel } from "./catalog-attachments-panel";
import { ServiceCategoryPickerModal } from "./service-category-picker-modal";
import { WorkflowFormDialog } from "./workflow-form-dialog";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PriorityApi, ImpactApi, UrgencyApi } from "@/lib/api/admin-modules.api";
import { Priority, Impact, Urgency } from "@/types/admin";

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ["Form Details", "Form Builder", "Preview", "Additional Info"] as const;
type Tab = typeof TABS[number];

const FIELD_TYPES: { type: FieldType; label: string; Icon: React.ElementType; group: "Basic" | "Advanced" | "Reference" }[] = [
  { type: "text",         label: "Single Line Text",     Icon: Type,        group: "Basic" },
  { type: "textarea",     label: "Multi Line Text",      Icon: AlignLeft,   group: "Basic" },
  { type: "number",       label: "Number",                Icon: Hash,        group: "Basic" },
  { type: "dropdown",     label: "Dropdown",              Icon: List,        group: "Basic" },
  { type: "checkbox",     label: "Checkbox",              Icon: CheckSquare, group: "Basic" },
  { type: "date",         label: "Date",                  Icon: Calendar,    group: "Basic" },
  { type: "multi_select", label: "Multi Select",          Icon: LayoutGrid,  group: "Advanced" },
  { type: "radio",        label: "Radio Buttons",         Icon: Circle,      group: "Advanced" },
  { type: "datetime",     label: "Date & Time",           Icon: Calendar,    group: "Advanced" },
  { type: "attachment",   label: "Attachment",            Icon: Paperclip,   group: "Advanced" },
  { type: "info",         label: "Info / Instructions",   Icon: Info,        group: "Advanced" },
  { type: "user_lookup",  label: "Person (User table)",   Icon: User,        group: "Reference" },
  { type: "group_lookup", label: "Lookup (Source table)", Icon: Users,       group: "Reference" },
];
const OPTION_BASED_TYPES: FieldType[] = ["dropdown", "multi_select", "checkbox", "radio"];

const STAGES       = ["Draft", "Testing", "Production", "Retired"];
const REQUEST_TYPES = ["Access", "Hardware", "Software", "Service", "Information", "Change"];
const ITEM_TYPES = ["Standard", "Service", "Hardware", "Software", "Access"];
const VISIBLE_TO   = ["All Users", "Specific User Groups", "Specific Users"];

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-semibold text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] italic text-slate-400">{hint}</p>}
    </div>
  );
}

function TInput({ value, onChange, placeholder, type = "text", disabled, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; disabled?: boolean; className?: string;
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      className={`w-full h-9 rounded-[4px] border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
    />
  );
}

function TSelect({ value, onChange, children, disabled }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm text-slate-800 appearance-none outline-none shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50">
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-4 text-slate-400" />
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${checked ? "bg-brand-600" : "bg-slate-200"}`}>
        <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </label>
  );
}

// ─── Tag input ────────────────────────────────────────────────────────────────
function TagInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !values.includes(v)) { onChange([...values, v]); setInput(""); }
  };
  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 min-h-10 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2.5 py-0.5 text-xs font-medium">
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}><X className="size-3" /></button>
        </span>
      ))}
      <input value={input} onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        placeholder={values.length === 0 ? placeholder : ""}
        className="flex-1 min-w-24 text-sm text-slate-800 placeholder:text-slate-400 outline-none bg-transparent" />
    </div>
  );
}

// ─── Section divider ─────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <h3 className="text-sm font-semibold text-slate-800 whitespace-nowrap">{children}</h3>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

// ─── Variable option editor (dropdown / multi_select / checkbox / radio) ──────
function VariableOptionsEditor({ options, onChange }: {
  options: { optionLabel: string; optionValue: string; sortOrder?: number }[];
  onChange: (opts: { optionLabel: string; optionValue: string; sortOrder?: number }[]) => void;
}) {
  const update = (idx: number, patch: Partial<{ optionLabel: string; optionValue: string }>) => {
    onChange(options.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };
  const remove = (idx: number) => onChange(options.filter((_, i) => i !== idx));
  const add = () => onChange([...options, { optionLabel: "", optionValue: "", sortOrder: options.length }]);

  return (
    <div className="col-span-2 space-y-2">
      <p className="text-xs font-medium text-slate-600">Options</p>
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input value={opt.optionLabel} onChange={(e) => update(idx, { optionLabel: e.target.value })}
            placeholder="Label" className="flex-1 h-8 rounded border border-slate-300 px-2 text-xs" />
          <input value={opt.optionValue} onChange={(e) => update(idx, { optionValue: e.target.value })}
            placeholder="Value" className="flex-1 h-8 rounded border border-slate-300 px-2 text-xs" />
          <button type="button" onClick={() => remove(idx)} className="p-1 text-slate-400 hover:text-red-600">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1">
        <Plus className="size-3" /> Add option
      </button>
    </div>
  );
}

// ─── Variable field row ───────────────────────────────────────────────────────
function VariableRow({
  v, sections, onUpdate, onRemove, draggable, onDragStart, onDragOver, onDrop,
}: {
  v: CatalogVariable;
  sections: CatalogFormSection[];
  onUpdate: (id: number, data: Partial<CreateVariableDto>) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const ft = FIELD_TYPES.find((f) => f.type === v.fieldType);
  const Icon = ft?.Icon ?? Type;
  const isOptionBased = OPTION_BASED_TYPES.includes(v.fieldType);

  const handleRowClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      setExpanded((e) => !e);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    if (onDragStart) onDragStart();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div 
      draggable={draggable} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
      onDragOver={onDragOver} 
      onDrop={onDrop}
      className="rounded-xl border border-slate-200 bg-white overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={handleRowClick}>
        <GripVertical className="size-4 text-slate-300 cursor-grab shrink-0" />
        <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${v.isMandatory ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"}`}>
          <Icon className="size-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-800">{v.label}</span>
          <span className="ml-2 text-xs text-slate-400">{ft?.label ?? v.fieldType}</span>
          {v.isMandatory && <span className="ml-2 text-xs text-red-500 font-medium">Required</span>}
          {!v.isVisible && <span className="ml-2 text-xs text-slate-400 font-medium">Hidden</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(v.variableId); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="size-3.5" />
          </button>
          <ChevronDown className={`size-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 p-4 grid grid-cols-2 gap-3 bg-slate-50/50" onClick={(e) => e.stopPropagation()}>
          <Field label="Label">
            <TInput value={v.label} onChange={(val) => onUpdate(v.variableId, { label: val })} />
          </Field>
          <Field label="Field Type">
            <TSelect value={v.fieldType} onChange={(val) => onUpdate(v.variableId, { fieldType: val })}>
              {FIELD_TYPES.map((f) => <option key={f.type} value={f.type}>{f.label}</option>)}
            </TSelect>
          </Field>
          <Field label="Section">
            <TSelect value={v.section?.sectionId ? String(v.section.sectionId) : ""}
              onChange={(val) => onUpdate(v.variableId, { sectionId: val ? Number(val) : undefined })}>
              <option value="">General (no section)</option>
              {sections.map((s) => <option key={s.sectionId} value={s.sectionId}>{s.name}</option>)}
            </TSelect>
          </Field>
          {v.fieldType !== "info" && (
            <Field label="Default Value">
              <TInput value={v.defaultValue ?? ""} onChange={(val) => onUpdate(v.variableId, { defaultValue: val })} />
            </Field>
          )}
          {v.fieldType !== "info" && !isOptionBased && (
            <Field label="Placeholder">
              <TInput value={v.placeholder ?? ""} onChange={(val) => onUpdate(v.variableId, { placeholder: val })} />
            </Field>
          )}
          <Field label="Help Text">
            <TInput value={v.helpText ?? ""} onChange={(val) => onUpdate(v.variableId, { helpText: val })} placeholder="Shown beneath the field" />
          </Field>

          {/* Type-specific configuration */}
          {v.fieldType === "number" && (
            <>
              <Field label="Min"><TInput type="number" value={v.minValue ?? ""} onChange={(val) => onUpdate(v.variableId, { minValue: val })} /></Field>
              <Field label="Max"><TInput type="number" value={v.maxValue ?? ""} onChange={(val) => onUpdate(v.variableId, { maxValue: val })} /></Field>
            </>
          )}
          {(v.fieldType === "text" || v.fieldType === "textarea") && (
            <Field label="Validation Regex (optional)" hint="e.g. ^[A-Za-z0-9]+$">
              <TInput value={v.validationRegex ?? ""} onChange={(val) => onUpdate(v.variableId, { validationRegex: val })} />
            </Field>
          )}
          {(v.fieldType === "date" || v.fieldType === "datetime") && (
            <>
              <Field label="Minimum Date"><TInput type="date" value={v.dateMin ?? ""} onChange={(val) => onUpdate(v.variableId, { dateMin: val })} /></Field>
              <Field label="Maximum Date"><TInput type="date" value={v.dateMax ?? ""} onChange={(val) => onUpdate(v.variableId, { dateMax: val })} /></Field>
            </>
          )}
          {v.fieldType === "attachment" && (
            <>
              <Field label="Allowed File Types" hint="Comma-separated, e.g. .pdf,.png,.jpg">
                <TInput value={v.allowedFileTypes ?? ""} onChange={(val) => onUpdate(v.variableId, { allowedFileTypes: val })} />
              </Field>
              <Field label="Max File Size (MB)">
                <TInput type="number" value={v.maxFileSizeMb ? String(v.maxFileSizeMb) : ""} onChange={(val) => onUpdate(v.variableId, { maxFileSizeMb: val ? Number(val) : undefined })} />
              </Field>
            </>
          )}
          {v.fieldType === "user_lookup" && (
            <Field label="Source Table">
              <div className="rounded-[4px] border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                <strong>User table</strong> — Requesters search and select people from the User directory (name, email, employee ID).
              </div>
            </Field>
          )}
          {v.fieldType === "group_lookup" && (
            <Field label="Source Table *" hint="Values are picked from this table (Location, Department, Email, etc.)">
              <TSelect
                value={v.lookupSource || "locations"}
                onChange={(val) => onUpdate(v.variableId, { lookupSource: val })}
              >
                <option value="locations">Location</option>
                <option value="departments">Department</option>
                <option value="emails">Email (User email addresses)</option>
                <option value="users">User (User table)</option>
                <option value="groups">Assignment group</option>
                <option value="categories">Service Category</option>
                <option value="roles">Role</option>
              </TSelect>
            </Field>
          )}
          {isOptionBased && (
            <VariableOptionsEditor
              options={(v.options ?? []).map((o) => ({ optionLabel: o.optionLabel, optionValue: o.optionValue, sortOrder: o.sortOrder }))}
              onChange={(opts) => onUpdate(v.variableId, { options: opts })}
            />
          )}

          {v.fieldType !== "info" && (
            <div className="col-span-2 flex items-center gap-6 pt-1">
              <Toggle checked={v.isMandatory} onChange={(val) => onUpdate(v.variableId, { isMandatory: val })} label="Required" />
              <Toggle checked={v.isVisible} onChange={(val) => onUpdate(v.variableId, { isVisible: val })} label="Visible" />
              <Toggle checked={v.readOnly} onChange={(val) => onUpdate(v.variableId, { readOnly: val })} label="Read Only" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Item Details ────────────────────────────────────────────────────────
function TabItemDetails({ f, set, selectedCategory, onOpenCategoryPicker, groups, priorities, impacts, urgencies }: {
  f: Partial<CreateCatalogDto>;
  set: <K extends keyof CreateCatalogDto>(k: K, v: CreateCatalogDto[K]) => void;
  selectedCategory: ServiceCategory | null;
  onOpenCategoryPicker: () => void;
  groups: AssignmentGroup[];
  priorities: Priority[];
  impacts: Impact[];
  urgencies: Urgency[];
}) {
  const [bannerPreview, setBannerPreview] = useState(f.bannerUrl ?? "");
  const [iconPreview, setIconPreview] = useState(f.iconUrl ?? "");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const iconFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setBannerPreview(f.bannerUrl ?? ""); }, [f.bannerUrl]);
  useEffect(() => { setIconPreview(f.iconUrl ?? ""); }, [f.iconUrl]);

  const handleBannerUpload = async (file: File) => {
    setUploadingBanner(true);
    try {
      const result = await uploadFile(file);
      set("bannerUrl", result.url);
      setBannerPreview(resolveAssetUrl(result.url));
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleIconUpload = async (file: File) => {
    setUploadingIcon(true);
    try {
      const result = await uploadFile(file);
      set("iconUrl", result.url);
      setIconPreview(resolveAssetUrl(result.url));
    } finally {
      setUploadingIcon(false);
    }
  };

  return (
    <div className="grid max-w-[1120px] grid-cols-5 gap-7">
      {/* Left form */}
      <div className="col-span-3 space-y-5">
        <SectionTitle>Basic Information</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Catalog Name*">
            <TInput value={f.catalogName ?? ""} onChange={(v) => set("catalogName", v)} placeholder="VPN Access Request" />
          </Field>
          <Field label="Category*">
            <button
              type="button"
              onClick={onOpenCategoryPicker}
              className="flex h-9 w-full items-center gap-2 rounded-[4px] border border-slate-300 bg-white px-2.5 text-left text-[13px] outline-none transition-colors hover:bg-slate-50 focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100"
            >
              <Grid3x3 className="size-4 shrink-0 text-slate-400" />
              <span className={selectedCategory ? "flex items-center gap-1 truncate text-slate-800" : "text-slate-400"}>
                {selectedCategory ? (
                  <>
                    {selectedCategory.categoryName}
                  </>
                ) : (
                  "Select a category"
                )}
              </span>
            </button>
          </Field>
          <Field label="Short Description*">
            <TInput value={f.shortDescription ?? ""} onChange={(v) => set("shortDescription", v)} placeholder="Request VPN access to connect to corporate network securely." />
          </Field>
        </div>

        <Field label="Detailed Description">
          <RichTextEditor value={f.description ?? ""} onChange={(html) => set("description", html)} placeholder="Describe what this catalog item does…" />
        </Field>

        <div className="grid grid-cols-2 gap-4 items-center">
          <div className="flex items-center gap-3 pt-6">
            <div className="flex-1">
              <span className="text-sm text-slate-600 block mb-2">Icon</span>
              <div className="flex items-center gap-2">
                <div className="size-12 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Lock className="size-6 text-slate-400" />
                </div>
                <button type="button" className="text-xs text-brand-600 hover:text-brand-700">Change Icon</button>
                <button type="button" className="text-xs text-slate-400 hover:text-red-600">Remove</button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-6">
            <span className="text-sm text-slate-600">Item Type</span>
            <TSelect value={f.itemType ?? "Standard"} onChange={(v) => set("itemType", v)}>
              {ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}
            </TSelect>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between pt-6">
            <span className="text-sm text-slate-600">Active</span>
            <Toggle checked={f.isActive ?? true} onChange={(v) => set("isActive", v)} />
          </div>
          <div className="flex items-center justify-between pt-6">
            <span className="text-sm text-slate-600">Allow Requested For</span>
            <Toggle checked={f.allowRequestedFor ?? true} onChange={(v) => set("allowRequestedFor", v)} />
          </div>
        </div>

        {/* Catalog Item Image / Banner Section */}
        <SectionTitle>Catalog Item Image / Banner (Optional)</SectionTitle>
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="size-16 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <div className="flex items-center gap-2">
                <Laptop className="size-8 text-slate-400" />
                <Shield className="size-6 text-brand-500" />
              </div>
            </div>
            <div className="flex-1">
              <button type="button" className="text-sm text-brand-600 hover:text-brand-700">Upload Image</button>
              <button type="button" className="text-sm text-slate-400 hover:text-red-600 ml-4">Remove</button>
            </div>
          </div>
          <p className="text-xs text-slate-400">Recommended size: 600 x 300 px</p>
        </div>

        <SectionTitle>Service Offering Information</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Service Offering">
            <TInput value={f.serviceOffering ?? ""} onChange={(v) => set("serviceOffering", v)} placeholder="Remote Connectivity Services" />
          </Field>
          <Field label="Business Service">
            <TInput value={f.businessService ?? ""} onChange={(v) => set("businessService", v)} placeholder="Employee Productivity" />
          </Field>
          <Field label="Configuration Item">
            <TInput value={f.configurationItem ?? ""} onChange={(v) => set("configurationItem", v)} placeholder="VPN Service" />
          </Field>
          <Field label="Impact">
            <TSelect value={f.impactId ? String(f.impactId) : ""} onChange={(v) => set("impactId", v ? Number(v) : undefined)}>
              <option value="">Select impact</option>
              {impacts.map((i) => <option key={i.impactId} value={i.impactId}>{i.impactName}</option>)}
            </TSelect>
          </Field>
          <Field label="Urgency">
            <TSelect value={f.urgencyId ? String(f.urgencyId) : ""} onChange={(v) => set("urgencyId", v ? Number(v) : undefined)}>
              <option value="">Select urgency</option>
              {urgencies.map((u) => <option key={u.urgencyId} value={u.urgencyId}>{u.urgencyName}</option>)}
            </TSelect>
          </Field>
          <Field label="Default Priority">
            <TSelect value={f.priorityId ? String(f.priorityId) : ""} onChange={(v) => set("priorityId", v ? Number(v) : undefined)}>
              <option value="">Select priority</option>
              {priorities.map((p) => <option key={p.priorityId} value={p.priorityId}>{p.priorityName}</option>)}
            </TSelect>
          </Field>
        </div>

        <SectionTitle>Additional Information</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Request Type">
            <TSelect value={f.requestType ?? "Access"} onChange={(v) => set("requestType", v)}>
              {REQUEST_TYPES.map((t) => <option key={t}>{t}</option>)}
            </TSelect>
          </Field>
          <Field label="Approval Required">
            <TSelect value={f.approvalRequired ? "Yes" : "No"} onChange={(v) => set("approvalRequired", v === "Yes")}>
              <option>Yes</option><option>No</option>
            </TSelect>
          </Field>
          <Field label="Stage">
            <TSelect value={f.stage ?? "Production"} onChange={(v) => set("stage", v)}>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </TSelect>
          </Field>
          <Field label="SLA">
            <TInput value={f.slaName ?? ""} onChange={(v) => set("slaName", v)} placeholder="VPN Access SLA" />
          </Field>
          <Field label="Fulfillment Group*">
            <TSelect value={f.fulfillmentGroupId ? String(f.fulfillmentGroupId) : ""} onChange={(v) => set("fulfillmentGroupId", v ? Number(v) : undefined)}>
              <option value="">Select group</option>
              {groups.map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}
            </TSelect>
          </Field>
          <Field label="Assignment Group*">
            <TSelect value={f.assignmentGroupId ? String(f.assignmentGroupId) : ""} onChange={(v) => set("assignmentGroupId", v ? Number(v) : undefined)}>
              <option value="">Select group</option>
              {groups.map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}
            </TSelect>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tags">
            <TagInput values={f.tags ?? []} onChange={(v) => set("tags", v)} placeholder="VPN, Remote Access..." />
          </Field>
          <Field label="Keywords (Searchable)">
            <TInput value={f.keywords ?? ""} onChange={(v) => set("keywords", v)} placeholder="vpn, remote, network access" />
          </Field>
        </div>

        <SectionTitle>Service Offering Information</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Service Offering">
            <TInput value={f.serviceOffering ?? ""} onChange={(v) => set("serviceOffering", v)} placeholder="Remote Connectivity Services" />
          </Field>
          <Field label="Business Service">
            <TInput value={f.businessService ?? ""} onChange={(v) => set("businessService", v)} placeholder="Employee Productivity" />
          </Field>
          <Field label="Configuration Item">
            <TInput value={f.configurationItem ?? ""} onChange={(v) => set("configurationItem", v)} placeholder="VPN Service" />
          </Field>
        </div>
      </div>

      {/* Right panel */}
      <div className="col-span-2 space-y-5">
        {/* Icon */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">Icon</p>
          <div className="flex items-center gap-3">
            <div className="size-14 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
              {iconPreview ? <img src={iconPreview} className="size-full object-cover" alt="Icon" /> : <Upload className="size-5 text-slate-300" />}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => iconFileRef.current?.click()} disabled={uploadingIcon}
                className="h-8 px-3 rounded-lg bg-brand-600 text-white text-xs hover:bg-brand-700 disabled:opacity-60 inline-flex items-center gap-1.5">
                {uploadingIcon ? <Loader2 className="size-3 animate-spin" /> : null}
                {f.iconUrl ? "Change Icon" : "Upload Icon"}
              </button>
              {f.iconUrl && (
                <button type="button" onClick={() => { setIconPreview(""); set("iconUrl", ""); }}
                  className="h-8 px-3 rounded-lg border border-slate-300 text-xs text-slate-600 hover:bg-slate-100">Remove</button>
              )}
            </div>
            <input ref={iconFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleIconUpload(file); }} />
          </div>
        </div>

        {/* Banner */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Catalog Item Image / Banner <span className="text-slate-400 font-normal">(Optional)</span></p>
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center min-h-36 flex flex-col items-center justify-center gap-2">
            {bannerPreview
              ? <img src={bannerPreview} className="max-h-28 object-contain rounded-lg" alt="Banner" />
              : <><Upload className="size-8 text-slate-300" /><p className="text-xs text-slate-400">Recommended size: 600 × 300 px</p></>
            }
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingBanner}
                className="h-7 px-3 rounded-lg bg-brand-600 text-white text-xs hover:bg-brand-700 disabled:opacity-60 inline-flex items-center gap-1.5">
                {uploadingBanner ? <Loader2 className="size-3 animate-spin" /> : null}
                Upload Image
              </button>
              {bannerPreview && (
                <button type="button" onClick={() => { setBannerPreview(""); set("bannerUrl", ""); }}
                  className="h-7 px-3 rounded-lg border border-slate-300 text-xs text-slate-600 hover:bg-slate-100">Remove</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleBannerUpload(file); }} />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Uploaded through POST /uploads and persisted to disk — the URL saved on this catalog item
            survives a reload, unlike the previous blob-URL preview.
          </p>
        </div>

        {/* Catalog Item Config */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800 mb-4">Catalog Item Configuration</p>
          <div className="space-y-3">
            {([
              ["availableInPortal",      "Available in Service Portal"],
              ["availableInMobile",      "Available in Mobile App"],
              ["showInCatalog",          "Show in Service Catalog"],
              ["showInPopular",          "Show in Popular Items"],
              ["allowRequestsForOthers", "Allow Requests for Others"],
              ["requiresApprovalFor",    "Requires Requested For"],
              ["hidePrice",              "Hide Price"],
              ["enableDiscussion",       "Enable Discussion"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{label}</span>
                <Toggle checked={!!(f as Record<string, unknown>)[key]} onChange={(v) => set(key as keyof CreateCatalogDto, v as never)} />
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Config */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800 mb-4">Workflow Configuration</p>
          <div className="space-y-3">

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Approval Required</span>
              <TSelect value={f.approvalRequired ? "Yes" : "No"} onChange={(v) => set("approvalRequired", v === "Yes")} disabled={false}>
                <option>Yes</option><option>No</option>
              </TSelect>
            </div>
            <Field label="Approval Policy">
              <TInput value={f.approvalPolicy ?? ""} onChange={(v) => set("approvalPolicy", v)} placeholder="VPN Access Approval Policy" />
            </Field>

          </div>
          {f.fulfillmentWorkflowId && (
            <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
              Workflow decides the approval and fulfillment process for this item.
            </div>
          )}
        </div>

        {/* Visibility */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800 mb-4">Visibility & Availability</p>
          <Field label="Visible to">
            <div className="flex gap-4">
              {VISIBLE_TO.map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                  <span onClick={() => set("visibleTo", v)}
                    className={`size-4 rounded-full border-2 flex items-center justify-center transition-colors ${(f.visibleTo ?? "All Users") === v ? "border-brand-600" : "border-slate-300"}`}>
                    {(f.visibleTo ?? "All Users") === v && <span className="size-2 rounded-full bg-brand-600 block" />}
                  </span>
                  {v}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Variables (Form) ────────────────────────────────────────────────────
function TabVariables({
  catalog, f, set,
  onCreateVar, onUpdateVar, onRemoveVar, onReorderVars,
  onCreateSection, onUpdateSection, onRemoveSection, onReorderSections,
}: {
  catalog: Catalog | null;
  f: Partial<CreateCatalogDto>;
  set: <K extends keyof CreateCatalogDto>(k: K, v: CreateCatalogDto[K]) => void;
  onCreateVar: (data: CreateVariableDto) => Promise<CatalogVariable | null>;
  onUpdateVar: (id: number, data: Partial<CreateVariableDto>) => Promise<void>;
  onRemoveVar: (id: number) => Promise<void>;
  onReorderVars?: (entries: { variableId: number; sortOrder: number; sectionId?: number | null }[]) => Promise<void>;
  onCreateSection?: (data: CreateSectionDto) => Promise<void>;
  onUpdateSection?: (id: number, data: Partial<CreateSectionDto>) => Promise<void>;
  onRemoveSection?: (id: number) => Promise<void>;
  onReorderSections?: (entries: { sectionId: number; displayOrder: number }[]) => Promise<void>;
}) {
  const vars = catalog?.variables ?? [];
  const sections = [...(catalog?.sections ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const canManageSections = !!catalog; // sections/variables only exist once the catalog item has been saved once

  const [newSectionName, setNewSectionName] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingSectionName, setEditingSectionName] = useState("");
  const [targetSectionId, setTargetSectionId] = useState<number | "general">(sections[0]?.sectionId ?? "general");
  const [paletteGroup, setPaletteGroup] = useState<"Basic" | "Advanced" | "Reference">("Basic");
  const dragVarId = useRef<number | null>(null);
  const dragSectionId = useRef<number | null>(null);
  // Set on dragstart from the "Add Variables" palette on the right; distinguishes
  // "drag a brand-new field type in" from "reorder a field already on the form"
  // (handled by dragVarId above) once the drop lands in the designer.
  const dragNewFieldType = useRef<{ type: FieldType; label: string } | null>(null);

  const variablesFor = (sectionId: number | null) =>
    vars.filter((v) => (v.section?.sectionId ?? null) === sectionId).sort((a, b) => a.sortOrder - b.sortOrder);
  const generalVars = variablesFor(null);

  const handleAddSection = async () => {
    if (!newSectionName.trim() || !onCreateSection) return;
    await onCreateSection({ name: newSectionName.trim(), displayOrder: sections.length });
    setNewSectionName(""); setAddingSection(false);
  };

  const handleRenameSection = async (sectionId: number) => {
    if (!editingSectionName.trim() || !onUpdateSection) return;
    await onUpdateSection(sectionId, { name: editingSectionName.trim() });
    setEditingSectionId(null);
  };

  // ── Section drag reorder ──────────────────────────────────────────────────
  const handleSectionDrop = async (targetId: number) => {
    const draggedId = dragSectionId.current;
    dragSectionId.current = null;
    if (!draggedId || draggedId === targetId || !onReorderSections) return;
    const order = sections.map((s) => s.sectionId);
    const from = order.indexOf(draggedId);
    const to = order.indexOf(targetId);
    order.splice(from, 1);
    order.splice(to, 0, draggedId);
    await onReorderSections(order.map((sectionId, idx) => ({ sectionId, displayOrder: idx })));
  };

  // ── Variable drag reorder (within/between sections) ────────────────────────
  const handleVariableDrop = async (targetSectionIdForDrop: number | null, targetVariableId: number | null) => {
    const draggedId = dragVarId.current;
    dragVarId.current = null;
    if (!draggedId || !onReorderVars) return;

    // Build the full ordered variable-id list across every section (General first is
    // fine — what matters is each section's own relative order and its sectionId).
    const grouped = [null, ...sections.map((s) => s.sectionId)].map((sid) => ({
      sectionId: sid,
      ids: variablesFor(sid).map((v) => v.variableId).filter((id) => id !== draggedId),
    }));
    const destGroup = grouped.find((g) => g.sectionId === targetSectionIdForDrop);
    if (!destGroup) return;
    const insertAt = targetVariableId ? destGroup.ids.indexOf(targetVariableId) : destGroup.ids.length;
    destGroup.ids.splice(insertAt === -1 ? destGroup.ids.length : insertAt, 0, draggedId);

    const entries: { variableId: number; sortOrder: number; sectionId?: number | null }[] = [];
    for (const group of grouped) {
      group.ids.forEach((variableId, idx) => {
        entries.push({ variableId, sortOrder: idx, sectionId: group.sectionId });
      });
    }
    await onReorderVars(entries);
  };

  // ── Drop from the "Add Variables" palette (a brand-new field type) ─────────
  const handleDropOnSection = async (targetSectionIdForDrop: number | null, targetVariableId: number | null) => {
    const newField = dragNewFieldType.current;
    dragNewFieldType.current = null;
    if (newField) {
      const created = await onCreateVar({
        label: newField.label,
        fieldType: newField.type,
        isMandatory: f.makeFieldsMandatory ?? false,
        isVisible: true,
        sectionId: targetSectionIdForDrop ?? undefined,
        sortOrder: variablesFor(targetSectionIdForDrop).length,
      });
      // Dropped onto a specific existing row (not just the section body) —
      // move the newly created field to sit right before that row instead of
      // leaving it appended at the end.
      if (created && targetVariableId && onReorderVars) {
        const siblingIds = variablesFor(targetSectionIdForDrop)
          .map((v) => v.variableId)
          .filter((id) => id !== created.variableId);
        const insertAt = siblingIds.indexOf(targetVariableId);
        siblingIds.splice(insertAt === -1 ? siblingIds.length : insertAt, 0, created.variableId);
        await onReorderVars(siblingIds.map((variableId, idx) => ({ variableId, sortOrder: idx, sectionId: targetSectionIdForDrop })));
      }
      return;
    }
    await handleVariableDrop(targetSectionIdForDrop, targetVariableId);
  };

  const quickAdd = async (type: FieldType, label: string) => {
    await onCreateVar({
      label,
      fieldType: type,
      isMandatory: f.makeFieldsMandatory ?? false,
      isVisible: true,
      sectionId: targetSectionId === "general" ? undefined : targetSectionId,
      sortOrder: variablesFor(targetSectionId === "general" ? null : targetSectionId).length,
    });
  };

  const renderSectionBox = (section: CatalogFormSection | null, index: number) => {
    const sectionId = section?.sectionId ?? null;
    const sectionVars = variablesFor(sectionId);
    return (
      <div key={sectionId ?? "general"}
        draggable={!!section}
        onDragStart={(e) => { if (section) { dragSectionId.current = section.sectionId; e.dataTransfer.setData("text/plain", `section:${section.sectionId}`); } }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => { if (section) handleSectionDrop(section.sectionId); }}
        className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100" onClick={(e) => e.stopPropagation()}>
          {editingSectionId === sectionId && section ? (
            <div className="flex items-center gap-2 flex-1">
              <input autoFocus value={editingSectionName} onChange={(e) => setEditingSectionName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameSection(section.sectionId); if (e.key === "Escape") setEditingSectionId(null); }}
                className="flex-1 h-7 rounded border border-slate-300 px-2 text-sm" />
              <button type="button" onClick={(e) => { e.stopPropagation(); handleRenameSection(section.sectionId); }} className="text-xs text-brand-600 font-medium">Save</button>
            </div>
          ) : (
            <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              {f.showSectionNumbers && <span className="text-slate-400">{index + 1}.</span>}
              {section ? section.name : "General"}
            </span>
          )}
          <div className="flex items-center gap-1">
            {section && (
              <>
                <button type="button" onClick={(e) => { e.stopPropagation(); setEditingSectionId(section.sectionId); setEditingSectionName(section.name); }}
                  className="p-1 rounded text-slate-400 hover:text-slate-600"><Pencil className="size-3.5" /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveSection?.(section.sectionId); }}
                  className="p-1 rounded text-slate-400 hover:text-red-600"><Trash2 className="size-3.5" /></button>
              </>
            )}
            {section && <button type="button" className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-grab"><GripVertical className="size-4" /></button>}
          </div>
        </div>
        <div className="p-3 space-y-2" onDragOver={(e) => e.preventDefault()} onDrop={() => handleDropOnSection(sectionId, null)}>
          {sectionVars.map((v) => (
            <VariableRow key={v.variableId} v={v} sections={sections} onUpdate={onUpdateVar} onRemove={onRemoveVar}
              draggable
              onDragStart={() => { dragVarId.current = v.variableId; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOnSection(sectionId, v.variableId)}
            />
          ))}
          {sectionVars.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">No fields in this section yet. Add one from the palette on the right.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-5 gap-6">
      {/* Form sections list */}
      <div className="col-span-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Form Sections</p>
        <p className="text-xs text-slate-400 mb-2">Drag to reorder sections</p>
        <div className="space-y-1.5">
          {sections.map((s) => (
            <div key={s.sectionId}
              draggable onDragStart={() => { dragSectionId.current = s.sectionId; }}
              onDragOver={(e) => e.preventDefault()} onDrop={() => handleSectionDrop(s.sectionId)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 cursor-grab">
              <GripVertical className="size-3.5 text-slate-300 shrink-0" />
              <span className="truncate">{s.name}</span>
            </div>
          ))}
          {canManageSections ? (
            addingSection ? (
              <div className="flex items-center gap-1.5">
                <input autoFocus value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddSection(); if (e.key === "Escape") setAddingSection(false); }}
                  placeholder="Section name" className="flex-1 h-8 rounded border border-slate-300 px-2 text-sm" />
                <button type="button" onClick={handleAddSection} className="text-brand-600"><Check className="size-4" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingSection(true)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-brand-600 hover:text-brand-700">
                <Plus className="size-3.5" /> Add Section
              </button>
            )
          ) : (
            <p className="text-xs text-slate-400 px-1">Save the catalog item once to start adding sections.</p>
          )}
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Form Settings</p>
          <div className="space-y-3">
            {([
              ["showSectionNumbers",    "Show section numbers"],
              ["showProgressIndicator", "Show progress indicator"],
              ["collapseAllSections",   "Collapse all sections"],
              ["makeFieldsMandatory",   "Make new fields mandatory"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-slate-600">{label}</span>
                <Toggle checked={!!(f as Record<string, unknown>)[key]} onChange={(v) => set(key as keyof CreateCatalogDto, v as never)} />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Form layout</p>
            <div className="flex gap-3">
              {([["single", "Single Column"], ["two-column", "Two Columns"]] as const).map(([val, l]) => (
                <label key={val} className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
                  <span onClick={() => set("formLayout", val)}
                    className={`size-3.5 rounded-full border-2 flex items-center justify-center ${(f.formLayout ?? "single") === val ? "border-brand-600" : "border-slate-300"}`}>
                    {(f.formLayout ?? "single") === val && <span className="size-1.5 rounded-full bg-brand-600" />}
                  </span>
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form designer */}
      <div className="col-span-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Form Designer</p>
        {!canManageSections ? (
          <p className="text-sm text-slate-400">Save the catalog item once to start building its form.</p>
        ) : (
          <div className="space-y-4">
            {sections.map((s, idx) => renderSectionBox(s, idx))}
            {(generalVars.length > 0 || sections.length === 0) && renderSectionBox(null, sections.length)}
          </div>
        )}
      </div>

      {/* Add Variables sidebar */}
      <div className="col-span-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add Variables</p>
        {canManageSections && (
          <div className="mb-3">
            <label className="block text-xs text-slate-500 mb-1">Add to section</label>
            <TSelect value={String(targetSectionId)} onChange={(v) => setTargetSectionId(v === "general" ? "general" : Number(v))}>
              <option value="general">General (no section)</option>
              {sections.map((s) => <option key={s.sectionId} value={s.sectionId}>{s.name}</option>)}
            </TSelect>
          </div>
        )}
        <div className="flex gap-1 mb-3">
          {(["Basic", "Advanced", "Reference"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setPaletteGroup(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${t === paletteGroup ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {FIELD_TYPES.filter((f2) => f2.group === paletteGroup).map(({ type, label, Icon }) => (
            <button key={type} type="button"
              draggable={canManageSections}
              onDragStart={(e) => {
                if (!canManageSections) { e.preventDefault(); return; }
                dragNewFieldType.current = { type, label };
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData("text/plain", `field:${type}`);
              }}
              onDragEnd={() => { dragNewFieldType.current = null; }}
              onClick={() => canManageSections && quickAdd(type, label)}
              disabled={!canManageSections}
              title="Drag onto the form, or click to add at the end of the selected section"
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50 transition-colors text-left disabled:opacity-50 cursor-grab active:cursor-grabbing disabled:cursor-not-allowed">
              <GripVertical className="size-3.5 text-slate-300 shrink-0" />
              <Icon className="size-3.5 text-slate-400 shrink-0" />
              {label}
            </button>
          ))}
        </div>
        {!canManageSections && (
          <p className="text-xs text-slate-400 mt-3">Save the catalog item once to start adding variables.</p>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Visibility ─────────────────────────────────────────────────────────
function TabVisibility({ f, set }: { f: Partial<CreateCatalogDto>; set: <K extends keyof CreateCatalogDto>(k: K, v: CreateCatalogDto[K]) => void }) {
  return (
    <div className="max-w-2xl space-y-6">
      <SectionTitle>Visibility & Availability</SectionTitle>
      <Field label="Visible To" required>
        <div className="flex gap-6">
          {VISIBLE_TO.map((v) => (
            <label key={v} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <span onClick={() => set("visibleTo", v)}
                className={`size-4 rounded-full border-2 flex items-center justify-center ${(f.visibleTo ?? "All Users") === v ? "border-brand-600" : "border-slate-300"}`}>
                {(f.visibleTo ?? "All Users") === v && <span className="size-2 rounded-full bg-brand-600 block" />}
              </span>
              {v}
            </label>
          ))}
        </div>
      </Field>
      <Field label="User Groups">
        <TagInput values={f.userGroups ?? []} onChange={(v) => set("userGroups", v)} placeholder="Add group..." />
      </Field>
      <Field label="Departments">
        <TagInput values={f.departments ?? []} onChange={(v) => set("departments", v)} placeholder="Add department..." />
      </Field>
      <Field label="Locations">
        <TagInput values={f.locations ?? []} onChange={(v) => set("locations", v)} placeholder="Add location..." />
      </Field>
    </div>
  );
}

// ─── Tab: Pricing & Cost ──────────────────────────────────────────────────────
function TabPricing({ f, set }: { f: Partial<CreateCatalogDto>; set: <K extends keyof CreateCatalogDto>(k: K, v: CreateCatalogDto[K]) => void }) {
  return (
    <div className="max-w-lg space-y-5">
      <SectionTitle>Time & Cost</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Estimated Time (mins)">
          <TInput type="number" value={String(f.estimatedTime ?? 2)} onChange={(v) => set("estimatedTime", Number(v))} />
        </Field>
        <Field label="Delivery Time SLA (Working Hours)">
          <TInput type="number" value={String(f.deliveryTimeSla ?? 4)} onChange={(v) => set("deliveryTimeSla", Number(v))} />
        </Field>
      </div>
      <Toggle checked={f.hidePrice ?? false} onChange={(v) => set("hidePrice", v)} label="Hide Price from users" />
    </div>
  );
}

// ─── Tab: Workflow ────────────────────────────────────────────────────────────
function TabWorkflow({ f, set, workflows, onCreateWorkflow }: {
  f: Partial<CreateCatalogDto>;
  set: <K extends keyof CreateCatalogDto>(k: K, v: CreateCatalogDto[K]) => void;
  workflows: { workflowId: number; workflowName: string }[];
  onCreateWorkflow?: (name: string) => Promise<number>;
}) {
  const [activeTab, setActiveTab] = useState<"approval" | "fulfillment">("approval");
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");

  const currentWorkflowId = activeTab === "approval" ? f.workflowId : f.fulfillmentWorkflowId;
  const currentWorkflow = workflows.find((w) => w.workflowId === currentWorkflowId);

  const openWorkflowPage = (workflowId: number) => {
    window.location.href = `/admin/workflows/${workflowId}`;
  };

  const handleCreateNewWorkflow = async () => {
    if (!newWorkflowName.trim() || !onCreateWorkflow) return;
    setIsCreatingWorkflow(true);
    try {
      const workflowId = await onCreateWorkflow(newWorkflowName);
      if (workflowId) {
        if (activeTab === "approval") {
          set("workflowId", workflowId);
        } else {
          set("fulfillmentWorkflowId", workflowId);
        }
        setNewWorkflowName("");
        openWorkflowPage(workflowId);
      }
    } finally {
      setIsCreatingWorkflow(false);
    }
  };

  const handleSelectWorkflow = (workflowId: number) => {
    const workflow = workflows.find((w) => w.workflowId === workflowId);
    if (workflow) {
      if (activeTab === "approval") {
        set("workflowId", workflowId);
      } else {
        set("fulfillmentWorkflowId", workflowId);
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Workflow Selection Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Workflow Configuration</SectionTitle>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("approval")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "approval"
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Approval Workflow
            </button>
            <button
              onClick={() => setActiveTab("fulfillment")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "fulfillment"
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Fulfillment Workflow
            </button>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {activeTab === "approval" ? "Approval Workflow" : "Fulfillment Workflow"}
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <TSelect
                  value={currentWorkflowId ? String(currentWorkflowId) : ""}
                  onChange={(v) => handleSelectWorkflow(Number(v))}
                >
                  <option value="">Select workflow</option>
                  {workflows.map((w) => (
                    <option key={w.workflowId} value={w.workflowId}>
                      {w.workflowName}
                    </option>
                  ))}
                </TSelect>
              </div>
              <button
                onClick={() => setNewWorkflowName(`${activeTab === "approval" ? "Approval" : "Fulfillment"} Workflow for ${f.catalogName || "Item"}`)}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
              >
                <Plus className="size-4 inline mr-1" /> Create New
              </button>
            </div>
          </div>

          {activeTab === "approval" && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Approval Required</span>
                <Toggle
                  checked={f.approvalRequired ?? false}
                  onChange={(v) => set("approvalRequired", v)}
                />
              </div>
            </div>
          )}
        </div>

        {newWorkflowName && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <Field label="New Workflow Name" required>
              <TInput
                value={newWorkflowName}
                onChange={setNewWorkflowName}
                placeholder="Enter workflow name"
              />
            </Field>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCreateNewWorkflow}
                disabled={isCreatingWorkflow || !newWorkflowName.trim()}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {isCreatingWorkflow ? "Creating..." : "Create Workflow"}
              </button>
              <button
                onClick={() => setNewWorkflowName("")}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

        <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-slate-50 p-5">
          {currentWorkflow ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected workflow</p>
                <p className="mt-1 text-base font-semibold text-slate-800">{currentWorkflow.workflowName}</p>
                <p className="mt-1 text-sm text-slate-500">Open the workflow editor on its own page to arrange steps and connections.</p>
              </div>
              <button
                type="button"
                onClick={() => openWorkflowPage(currentWorkflow.workflowId)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
              >
                <ExternalLink className="size-4" />
                Open Workflow Editor
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <Settings className="size-5 text-slate-300" />
              <span>Select or create a workflow to open its dedicated editor page.</span>
            </div>
          )}
        </div>
    </div>
  );
}

// ─── Tab: Policies ────────────────────────────────────────────────────────────
function TabPolicies({ f, set }: {
  f: Partial<CreateCatalogDto>;
  set: <K extends keyof CreateCatalogDto>(k: K, v: CreateCatalogDto[K]) => void;
}) {
  return (
    <div className="max-w-2xl space-y-6">
      <SectionTitle>Approval Policy</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between pt-6">
          <span className="text-sm text-slate-600">Requires approval before fulfillment</span>
          <Toggle checked={f.approvalRequired ?? false} onChange={(v) => set("approvalRequired", v)} />
        </div>
        <Field label="Approval Policy Name">
          <TInput value={f.approvalPolicy ?? ""} onChange={(v) => set("approvalPolicy", v)} placeholder="VPN Access Approval Policy" />
        </Field>
      </div>

      <SectionTitle>Requester Policy</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between pt-6">
          <span className="text-sm text-slate-600">Requires a &ldquo;Requested For&rdquo; person</span>
          <Toggle checked={f.requiresApprovalFor ?? false} onChange={(v) => set("requiresApprovalFor", v)} />
        </div>
        <div className="flex items-center justify-between pt-6">
          <span className="text-sm text-slate-600">Allow requests for others</span>
          <Toggle checked={f.allowRequestsForOthers ?? true} onChange={(v) => set("allowRequestsForOthers", v)} />
        </div>
      </div>

      <SectionTitle>Service Level</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <Field label="SLA Name">
          <TInput value={f.slaName ?? ""} onChange={(v) => set("slaName", v)} placeholder="VPN Access SLA" />
        </Field>
        <Field label="Delivery Time SLA (Working Hours)">
          <TInput type="number" value={String(f.deliveryTimeSla ?? 4)} onChange={(v) => set("deliveryTimeSla", Number(v))} />
        </Field>
      </div>
    </div>
  );
}

// ─── Stub tab (Knowledge only — no KB module exists in the backend) ───────────
function StubTab({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
      <AlertCircle className="size-10 text-slate-200 mb-3" />
      <p className="text-slate-600 text-sm font-medium">{title} isn&apos;t built yet</p>
      <p className="text-slate-400 text-xs mt-1.5">{reason}</p>
    </div>
  );
}

function TabPreview({ catalog, f, selectedCategory }: { catalog: Catalog | null; f: Partial<CreateCatalogDto>; selectedCategory: ServiceCategory | null }) {
  const variables = catalog?.variables?.filter((variable) => variable.isVisible) ?? [];
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Preview</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">{f.catalogName || "New Catalog Item"}</h2>
        <p className="mt-1 text-sm text-slate-500">{f.shortDescription || "No short description provided."}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div><span className="text-slate-500">Category:</span> <span className="text-slate-900">{selectedCategory?.categoryName || "Not selected"}</span></div>
        <div><span className="text-slate-500">Request type:</span> <span className="text-slate-900">{f.requestType || "Not selected"}</span></div>
      </div>
      {f.description && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{f.description}</p>}
      <div className="border-t border-slate-200 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">Request Form</h3>
        {variables.length > 0 ? <div className="mt-4 space-y-4">{variables.map((variable) => <div key={variable.variableId} className="space-y-1"><label className="text-sm font-medium text-slate-700">{variable.label}{variable.isMandatory && <span className="ml-1 text-red-500">*</span>}</label><div className="h-9 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">{variable.fieldType} field</div></div>)}</div> : <p className="mt-3 text-sm text-slate-400">Add fields in Form Builder to preview the request form.</p>}
      </div>
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

interface CatalogEditorProps {
  mode: "create" | "edit";
  catalog?: Catalog | null;
  onSave:      (data: CreateCatalogDto) => Promise<Catalog | null>;
  onCreateVar: (data: CreateVariableDto) => Promise<CatalogVariable | null>;
  onUpdateVar: (id: number, data: Partial<CreateVariableDto>) => Promise<void>;
  onRemoveVar: (id: number) => Promise<void>;
  onReorderVars?: (entries: { variableId: number; sortOrder: number; sectionId?: number | null }[]) => Promise<void>;
  onCreateSection?: (data: CreateSectionDto) => Promise<void>;
  onUpdateSection?: (id: number, data: Partial<CreateSectionDto>) => Promise<void>;
  onRemoveSection?: (id: number) => Promise<void>;
  onReorderSections?: (entries: { sectionId: number; displayOrder: number }[]) => Promise<void>;
}

export function CatalogEditor({
  mode, catalog, onSave, onCreateVar, onUpdateVar, onRemoveVar, onReorderVars,
  onCreateSection, onUpdateSection, onRemoveSection, onReorderSections,
}: CatalogEditorProps) {
  const router = useRouter();
  const { create: createWorkflow } = useAdminWorkflows();
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [impacts, setImpacts] = useState<Impact[]>([]);
  const [urgencies, setUrgencies] = useState<Urgency[]>([]);
  
  useEffect(() => { apiFetch<AssignmentGroup[]>("/assignment-groups").then(setGroups).catch(() => {}); }, []);
  useEffect(() => { PriorityApi.list().then(setPriorities).catch(() => {}); }, []);
  useEffect(() => { ImpactApi.list().then(setImpacts).catch(() => {}); }, []);
  useEffect(() => { UrgencyApi.list().then(setUrgencies).catch(() => {}); }, []);

  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  useEffect(() => {
    setSelectedCategory(catalog?.serviceCategory ? {
      serviceCategoryId: catalog.serviceCategory.serviceCategoryId,
      categoryName: catalog.serviceCategory.categoryName,
      parentCategoryId: catalog.serviceCategory.parentCategoryId,
      description: catalog.serviceCategory.description,
      imageUrl: catalog.serviceCategory.imageUrl,
      tileColor: catalog.serviceCategory.tileColor ?? "#111827",
      sortOrder: catalog.serviceCategory.sortOrder ?? 0,
      isActive: true,
    } : null);
  }, [catalog]);

  const [activeTab, setActiveTab] = useState<Tab>("Form Details");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [isDirty, setIsDirty]     = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [createdCatalog, setCreatedCatalog] = useState<Catalog | null>(null);
  const [showWorkflowPrompt, setShowWorkflowPrompt] = useState(false);
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  // Attachments are loaded/managed locally (mirrors how `groups` above is
  // fetched inline) since they only apply once a catalog item exists.
  const [attachmentsList, setAttachmentsList] = useState<CatalogAttachment[]>([]);
  const loadAttachments = useCallback(async () => {
    if (!catalog) return;
    try { setAttachmentsList(await CatalogsApi.getAttachments(catalog.catalogId)); }
    catch { /* Attachments tab shows an empty state either way */ }
  }, [catalog]);
  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  // form state initialised from catalog (edit) or defaults (create)
  const init = useCallback((): Partial<CreateCatalogDto> => ({
    catalogName:           catalog?.catalogName           ?? "",
    catalogCode:           catalog?.catalogCode           ?? "",
    shortDescription:      catalog?.shortDescription      ?? "",
    description:           catalog?.description           ?? "",
    serviceCategoryId:     catalog?.serviceCategory?.serviceCategoryId,
    itemType:              catalog?.itemType              ?? "Standard",
    isActive:              catalog?.isActive              ?? true,
    allowRequestedFor:     catalog?.allowRequestedFor     ?? true,
    iconUrl:               catalog?.iconUrl               ?? "",
    bannerUrl:             catalog?.bannerUrl             ?? "",
    requestType:           catalog?.requestType           ?? "Access",
    approvalRequired:      catalog?.approvalRequired      ?? false,
    stage:                 catalog?.stage                 ?? "Production",
    priorityId:            catalog?.priority?.priorityId,
    impactId:              catalog?.impact?.impactId,
    urgencyId:             catalog?.urgency?.urgencyId,
    slaName:               catalog?.slaName               ?? "",
    tags:                  catalog?.tags                  ?? [],
    keywords:              catalog?.keywords              ?? "",
    serviceOffering:       catalog?.serviceOffering       ?? "",
    businessService:       catalog?.businessService       ?? "",
    configurationItem:     catalog?.configurationItem     ?? "",
    estimatedTime:         catalog?.estimatedTime         ?? 2,
    deliveryTimeSla:       catalog?.deliveryTimeSla       ?? 4,
    hidePrice:             catalog?.hidePrice             ?? false,
    approvalPolicy:        catalog?.approvalPolicy        ?? "",
    fulfillmentGroupId:    catalog?.fulfillmentGroup?.groupId,
    assignmentGroupId:     catalog?.assignmentGroup?.groupId,
    availableInPortal:     catalog?.availableInPortal     ?? true,
    availableInMobile:     catalog?.availableInMobile     ?? true,
    showInCatalog:         catalog?.showInCatalog         ?? true,
    showInPopular:         catalog?.showInPopular         ?? false,
    requiresApprovalFor:   catalog?.requiresApprovalFor   ?? false,
    allowRequestsForOthers:catalog?.allowRequestsForOthers?? true,
    enableDiscussion:      catalog?.enableDiscussion      ?? false,
    visibleTo:             catalog?.visibleTo             ?? "All Users",
    userGroups:            catalog?.userGroups            ?? [],
    departments:           catalog?.departments            ?? [],
    locations:             catalog?.locations             ?? [],
    showSectionNumbers:    catalog?.showSectionNumbers    ?? true,
    showProgressIndicator: catalog?.showProgressIndicator ?? true,
    collapseAllSections:   catalog?.collapseAllSections   ?? false,
    makeFieldsMandatory:   catalog?.makeFieldsMandatory   ?? false,
    formLayout:            (catalog?.formLayout as "single" | "two-column") ?? "single",
  }), [catalog]);

  const [f, setF] = useState<Partial<CreateCatalogDto>>(init);
  useEffect(() => { setF(init()); }, [init]);

  const set = useCallback(<K extends keyof CreateCatalogDto>(k: K, v: CreateCatalogDto[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setIsDirty(true);
  }, []);

  const handleSave = async () => {
    // Validate required fields
    if (!f.catalogName?.trim()) {
      alert("Catalog name is required");
      return;
    }
    if (!f.serviceCategoryId) {
      alert("Category is required");
      return;
    }
    
    setSaving(true);
    try {
      const result = await onSave(f as CreateCatalogDto);
      setSaving(false);
      if (result) {
        setSaved(true);
        setIsDirty(false);
        setTimeout(() => setSaved(false), 2000);
        if (mode === "create") {
          setCreatedCatalog(result);
          setShowWorkflowPrompt(true);
        }
      }
    } catch (error) {
      setSaving(false);
      alert("Failed to save catalog item. Please try again.");
    }
  };

  const handlePreview = () => {
    // Allow preview even for new items to see the form structure
    setShowPreview(true);
  };

  const handleNextTab = () => {
    const currentIndex = TABS.indexOf(activeTab);
    const nextTab = TABS[currentIndex + 1];
    if (nextTab) setActiveTab(nextTab);
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      router.push("/admin/catalogs");
    }
  };

  const confirmCancel = () => {
    setShowCancelConfirm(false);
    router.push("/admin/catalogs");
  };

  const finishCatalogSave = () => {
    if (createdCatalog) router.push(`/admin/catalogs/${createdCatalog.catalogId}`);
  };

  const handleWorkflowSubmit = async (data: { workflowName: string; description?: string; isActive?: boolean }) => {
    if (!createdCatalog) return false;
    setSavingWorkflow(true);
    try {
      const workflow = await createWorkflow(data);
      if (!workflow?.workflowId) return false;
      await CatalogsApi.update(createdCatalog.catalogId, { workflowId: workflow.workflowId });
      setShowWorkflowDialog(false);
      router.push(`/admin/workflows/${workflow.workflowId}`);
      return false;
    } finally {
      setSavingWorkflow(false);
    }
  };

  const openWorkflowForSavedCatalog = async () => {
    if (!createdCatalog) return;
    setSavingWorkflow(true);
    try {
      const workflow = await createWorkflow({
        workflowName: `${createdCatalog.catalogName} Approval Flow`,
        description: `Approval workflow for ${createdCatalog.catalogName}.`,
        isActive: true,
      });
      if (workflow?.workflowId) {
        setShowWorkflowPrompt(false);
        router.push(`/admin/workflows/${workflow.workflowId}`);
      }
    } finally {
      setSavingWorkflow(false);
    }
  };

  const catalogName = f.catalogName || (mode === "create" ? "New Catalog Item" : "Catalog Item");

  return (
    <div className="flex min-h-full flex-col bg-[#f7f8fa] text-slate-800">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <div>
          <Breadcrumb items={[
            { label: "Home", href: "/home" },
            { label: "Admin" },
            { label: "Service Catalog", href: "/admin/catalogs" },
            { label: "Catalog Items", href: "/admin/catalogs" },
            { label: catalogName },
            { label: mode === "create" ? "Create" : "Edit" },
          ]} />
          <h1 className="mt-0.5 text-[15px] font-medium uppercase tracking-wide text-brand-600">Form Builder</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={handleCancel} className="h-8 border border-slate-300 bg-white px-4 text-xs font-medium text-slate-600 hover:bg-slate-50">Back</button>
          <button type="button" onClick={handleNextTab} className="h-8 bg-sky-700 px-5 text-xs font-medium text-white hover:bg-sky-800">Next</button>
          <button type="button" onClick={handleSave} disabled={saving || !f.catalogName?.trim()} className="h-8 border border-slate-300 bg-slate-50 px-4 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-3">
        {TABS.map((tab, index) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={[
              "relative flex h-10 items-center gap-2 whitespace-nowrap px-4 text-[12px] font-medium transition-colors",
              activeTab === tab
                ? "bg-[#52667d] text-white"
                : "bg-[#e1e7ed] text-slate-700 hover:bg-slate-200",
            ].join(" ")}>
            <span className="flex size-5 items-center justify-center rounded-full bg-white/85 text-[10px] font-bold text-slate-700">{Math.min(index + 1, 4)}</span>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-auto border-b border-slate-200 bg-white p-5">
        {activeTab === "Form Details"      && (
          <TabItemDetails f={f} set={set} selectedCategory={selectedCategory}
            onOpenCategoryPicker={() => setCategoryPickerOpen(true)} groups={groups} priorities={priorities} impacts={impacts} urgencies={urgencies} />
        )}
        {activeTab === "Form Builder"  && (
          <TabVariables
            catalog={catalog ?? null} f={f} set={set}
            onCreateVar={onCreateVar} onUpdateVar={onUpdateVar} onRemoveVar={onRemoveVar} onReorderVars={onReorderVars}
            onCreateSection={onCreateSection} onUpdateSection={onUpdateSection} onRemoveSection={onRemoveSection} onReorderSections={onReorderSections}
          />
        )}
        {activeTab === "Preview" && <TabPreview catalog={catalog ?? null} f={f} selectedCategory={selectedCategory} />}
        {activeTab === "Additional Info" && <div className="space-y-8"><TabPricing f={f} set={set} /><TabVisibility f={f} set={set} /><TabPolicies f={f} set={set} /><div><SectionTitle>Attachments</SectionTitle>{catalog ? <CatalogAttachmentsPanel attachments={attachmentsList} onUpload={async (data) => { await CatalogsApi.createAttachment(catalog.catalogId, data); await loadAttachments(); }} onRemove={async (attachmentId) => { await CatalogsApi.removeAttachment(catalog.catalogId, attachmentId); await loadAttachments(); }} /> : <p className="mt-3 text-sm text-slate-400">Save the catalog item once to start attaching files.</p>}</div></div>}
      </div>

      {/* Catalog actions and tab navigation */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">Create and configure this service catalog item.</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleCancel}
              className="h-8 px-4 border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center">
              Cancel
            </button>
            <button type="button" onClick={handlePreview}
              className="h-8 px-4 border border-brand-300 bg-white text-xs font-medium text-brand-700 hover:bg-brand-50 inline-flex items-center gap-1.5">
              <Eye className="size-4" /> Preview Form
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !f.catalogName?.trim()}
              className="h-8 px-4 bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-60 inline-flex items-center gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : <Save className="size-4" />}
              {saving ? "Saving…" : saved ? "Saved!" : mode === "create" ? "Save Catalog Item" : "Save Changes"}
            </button>
          </div>
        </div>
        <div className="hidden justify-end">
          <button type="button" onClick={handleNextTab} disabled={activeTab === TABS[TABS.length - 1]}
            className="h-9 px-5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
            Next
          </button>
        </div>
      </div>

      <ServiceCategoryPickerModal
        open={categoryPickerOpen}
        initialCategoryId={selectedCategory?.serviceCategoryId ?? f.serviceCategoryId ?? null}
        onSelect={(category) => { setSelectedCategory(category); set("serviceCategoryId", category.serviceCategoryId); }}
        onClose={() => setCategoryPickerOpen(false)}
      />

      {mode === "create" && (
        <>
          {showWorkflowPrompt && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-xl overflow-hidden border border-slate-400 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-medium text-slate-800">Save Catalog</h2>
                  <button type="button" onClick={finishCatalogSave} aria-label="Close" className="text-xl leading-none text-slate-500 hover:text-slate-900">×</button>
                </div>
                <p className="px-5 py-5 text-[13px] leading-5 text-slate-800">
                  The Service Catalog is saved successfully. Do you want to create or modify the Approval Flow for the Service Catalog?
                </p>
                <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
                  <button type="button" onClick={openWorkflowForSavedCatalog} disabled={savingWorkflow} className="h-8 min-w-16 bg-sky-700 px-4 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-60">{savingWorkflow ? "Opening..." : "OK"}</button>
                  <button type="button" onClick={finishCatalogSave} disabled={savingWorkflow} className="h-8 min-w-20 border border-slate-400 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            </div>
          )}
          <WorkflowFormDialog
            open={showWorkflowDialog}
            isLoading={savingWorkflow}
            onSubmit={handleWorkflowSubmit}
            onClose={() => { setShowWorkflowDialog(false); finishCatalogSave(); }}
          />
        </>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Preview: {f.catalogName}</h2>
              <button onClick={() => setShowPreview(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="size-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                  {f.iconUrl && <img src={f.iconUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />}
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-slate-900">{f.catalogName}</h3>
                    <p className="text-sm text-slate-500 mt-1">{f.shortDescription}</p>
                    {f.tags && f.tags.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {f.tags.map((tag) => (
                          <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                {f.description && (
                  <div className="prose prose-sm max-w-none">
                    <p>{f.description}</p>
                  </div>
                )}

                {/* Form Preview */}
                {catalog && (catalog.variables ?? []).length > 0 && (
                  <div className="border-t border-slate-100 pt-6">
                    <h4 className="text-sm font-semibold text-slate-900 mb-4">Request Form</h4>
                    <div className="space-y-4">
                      {(catalog.variables ?? []).filter(v => v.isVisible).map((variable) => (
                        <div key={variable.variableId} className="space-y-1">
                          <label className="text-sm font-medium text-slate-700">
                            {variable.label}
                            {variable.isMandatory && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <div className="text-sm text-slate-400">
                            {variable.fieldType} field
                            {variable.helpText && <p className="text-xs mt-1">{variable.helpText}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Info */}
                <div className="border-t border-slate-100 pt-6 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Category:</span>
                    <span className="ml-2 text-slate-900">{selectedCategory?.categoryName || "Not selected"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Request Type:</span>
                    <span className="ml-2 text-slate-900">{f.requestType}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Estimated Time:</span>
                    <span className="ml-2 text-slate-900">{f.estimatedTime} days</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Stage:</span>
                    <span className="ml-2 text-slate-900">{f.stage}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Unsaved Changes</h3>
            <p className="text-sm text-slate-600 mb-6">
              You have unsaved changes. Are you sure you want to cancel and lose your changes?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
                Keep Editing
              </button>
              <button onClick={confirmCancel}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
                Cancel & Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
