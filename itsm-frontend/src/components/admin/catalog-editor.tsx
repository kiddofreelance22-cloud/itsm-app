"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload, X, Plus, Trash2, GripVertical, ChevronDown,
  Eye, Save, Loader2, Check, AlertCircle,
  Type, AlignLeft, Hash, Calendar, List, CheckSquare,
  Circle, Paperclip, User, Users, LayoutGrid,
  Info,
} from "lucide-react";
import { Catalog, CatalogVariable, FieldType } from "@/types/catalog";
import { CreateCatalogDto, CreateVariableDto } from "@/lib/api/catalogs.api";
import { useAdminCategories, useAdminWorkflows } from "@/lib/hooks/use-admin";
import { apiFetch } from "@/lib/api/client";
import { AssignmentGroup } from "@/lib/api/incidents.api";

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ["Item Details", "Variables (Form)", "Workflow", "Pricing & Cost", "Visibility", "Policies", "Knowledge", "Attachments"] as const;
type Tab = typeof TABS[number];

const FIELD_TYPES: { type: FieldType; label: string; Icon: React.ElementType }[] = [
  { type: "text",         label: "Single Line Text", Icon: Type        },
  { type: "textarea",     label: "Multi Line Text",  Icon: AlignLeft   },
  { type: "number",       label: "Number",           Icon: Hash        },
  { type: "dropdown",     label: "Dropdown",         Icon: List        },
  { type: "multi_select", label: "Multi Select",     Icon: LayoutGrid  },
  { type: "radio",        label: "Radio Buttons",    Icon: Circle      },
  { type: "checkbox",     label: "Checkbox",         Icon: CheckSquare },
  { type: "date",         label: "Date",             Icon: Calendar    },
  { type: "datetime",     label: "Date & Time",      Icon: Calendar    },
  { type: "attachment",   label: "Attachment",       Icon: Paperclip   },
  { type: "user_lookup",  label: "User Lookup",      Icon: User        },
  { type: "group_lookup", label: "Group Lookup",     Icon: Users       },
  { type: "info",         label: "Info / Instructions", Icon: Info     },
];

// Every type above is what the mockup called for, but the backend's
// CreateCatalogVariableDto only whitelists these seven — with
// forbidNonWhitelisted on, sending any other type (or the placeholder/
// helpText/isVisible/readOnly fields below) throws a 400. Pickers use
// this trimmed list; FIELD_TYPES above is kept only for icon/label lookup.
const SUPPORTED_FIELD_TYPES = FIELD_TYPES.filter((f) =>
  (["text", "textarea", "number", "date", "dropdown", "checkbox", "radio"] as FieldType[]).includes(f.type)
);

const PRIORITIES   = ["P1 - Critical", "P2 - High", "P3 - Moderate", "P4 - Low"];
const IMPACTS      = ["Low", "Medium", "High", "Critical"];
const URGENCIES    = ["Low", "Medium", "High", "Critical"];
const STAGES       = ["Draft", "Testing", "Production", "Retired"];
const REQUEST_TYPES = ["Access", "Hardware", "Software", "Service", "Information", "Change"];
const ITEM_TYPES   = ["Standard", "Service", "Hardware", "Software", "Access"];
const VISIBLE_TO   = ["All Users", "Specific User Groups", "Specific Users"];

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
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
      className={`w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
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

// ─── Variable field row ───────────────────────────────────────────────────────
function VariableRow({
  v, onUpdate, onRemove,
}: {
  v: CatalogVariable;
  onUpdate: (id: number, data: Partial<CreateVariableDto>) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const ft = FIELD_TYPES.find((f) => f.type === v.fieldType);
  const Icon = ft?.Icon ?? Type;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpanded((e) => !e)}>
        <GripVertical className="size-4 text-slate-300 cursor-grab shrink-0" />
        <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${v.isMandatory ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"}`}>
          <Icon className="size-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-800">{v.label}</span>
          <span className="ml-2 text-xs text-slate-400">{ft?.label ?? v.fieldType}</span>
          {v.isMandatory && <span className="ml-2 text-xs text-red-500 font-medium">Required</span>}
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
        <div className="border-t border-slate-100 p-4 grid grid-cols-2 gap-3 bg-slate-50/50">
          <Field label="Label">
            <TInput value={v.label} onChange={(val) => onUpdate(v.variableId, { label: val })} />
          </Field>
          <Field label="Field Type">
            <TSelect value={v.fieldType} onChange={(val) => onUpdate(v.variableId, { fieldType: val })}>
              {SUPPORTED_FIELD_TYPES.map((f) => <option key={f.type} value={f.type}>{f.label}</option>)}
            </TSelect>
          </Field>
          <div className="col-span-2">
            <Toggle checked={v.isMandatory} onChange={(val) => onUpdate(v.variableId, { isMandatory: val })} label="Required" />
          </div>
          <p className="col-span-2 text-xs text-slate-400">
            Placeholder text, help text, and visible/read-only toggles aren&apos;t saved yet — the API doesn&apos;t
            accept those fields for a variable today.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Add Variable panel ───────────────────────────────────────────────────────
function AddVariablePanel({ onAdd }: { onAdd: (data: CreateVariableDto) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");

  const handleAdd = async () => {
    if (!label.trim()) return;
    setAdding(true);
    await onAdd({ label: label.trim(), fieldType: type, isMandatory: false, isVisible: true });
    setLabel(""); setType("text"); setOpen(false); setAdding(false);
  };

  return (
    <div className="mt-3">
      {!open
        ? <button type="button" onClick={() => setOpen(true)}
            className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
            <Plus className="size-4" /> Add Variable
          </button>
        : <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/30 p-4">
            <p className="text-xs font-semibold text-slate-600 mb-3">New Variable</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Label" required>
                <TInput value={label} onChange={setLabel} placeholder="e.g. Full Name" />
              </Field>
              <Field label="Field Type">
                <TSelect value={type} onChange={(v) => setType(v as FieldType)}>
                  {SUPPORTED_FIELD_TYPES.map((f) => <option key={f.type} value={f.type}>{f.label}</option>)}
                </TSelect>
              </Field>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAdd} disabled={!label.trim() || adding}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add
              </button>
              <button type="button" onClick={() => { setOpen(false); setLabel(""); }}
                className="h-9 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
      }
    </div>
  );
}

// ─── Tab: Item Details ────────────────────────────────────────────────────────
function TabItemDetails({ f, set, categories, groups, workflows }: {
  f: Partial<CreateCatalogDto>;
  set: <K extends keyof CreateCatalogDto>(k: K, v: CreateCatalogDto[K]) => void;
  categories: { categoryId: number; categoryName: string }[];
  groups: AssignmentGroup[];
  workflows: { workflowId: number; workflowName: string }[];
}) {
  const [bannerPreview, setBannerPreview] = useState(f.bannerUrl ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const iconFileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-5 gap-6">
      {/* Left form */}
      <div className="col-span-3 space-y-5">
        <SectionTitle>Basic Information</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" required>
            <TInput value={f.catalogName ?? ""} onChange={(v) => set("catalogName", v)} placeholder="e.g. VPN Access Request" />
          </Field>
          <Field label="Catalog">
            <TSelect value={f.categoryId ? String(f.categoryId) : ""} onChange={(v) => set("categoryId", v ? Number(v) : undefined)}>
              <option value="">Select catalog</option>
              {categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>)}
            </TSelect>
          </Field>
          <Field label="Category">
            <TSelect value={f.categoryId ? String(f.categoryId) : ""} onChange={(v) => set("categoryId", v ? Number(v) : undefined)}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>)}
            </TSelect>
          </Field>
          <Field label="Sub Category">
            <TInput value={f.subCategory ?? ""} onChange={(v) => set("subCategory", v)} placeholder="e.g. Remote Access" />
          </Field>
        </div>

        <Field label="Short Description">
          <TInput value={f.shortDescription ?? ""} onChange={(v) => set("shortDescription", v)} placeholder="Brief description shown in catalog" />
        </Field>

        <Field label="Detailed Description">
          <div className="rounded-lg border border-slate-300 overflow-hidden">
            <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 bg-slate-50">
              {["B","I","U"].map((t) => (
                <button key={t} type="button" className="size-7 rounded text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors">{t}</button>
              ))}
              <div className="w-px h-4 bg-slate-200 mx-1" />
              {["≡","⊞","🔗","📷"].map((t) => (
                <button key={t} type="button" className="size-7 rounded text-sm text-slate-600 hover:bg-slate-200 transition-colors">{t}</button>
              ))}
            </div>
            <textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={4}
              placeholder="Detailed description for the catalog item"
              className="w-full px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none resize-none" />
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Icon">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 overflow-hidden">
                {f.iconUrl ? <img src={f.iconUrl} className="size-8 object-contain" alt="" /> : <LayoutGrid className="size-6" />}
              </div>
              <button type="button" onClick={() => iconFileRef.current?.click()}
                className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50">Change Icon</button>
              {f.iconUrl && (
                <button type="button" onClick={() => set("iconUrl", "")}
                  className="h-8 px-3 rounded-lg border border-slate-300 text-xs text-slate-600 hover:bg-slate-100">Remove</button>
              )}
              <input ref={iconFileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  set("iconUrl", URL.createObjectURL(file));
                }} />
            </div>
          </Field>
          <Field label="Item Type">
            <TSelect value={f.itemType ?? "Standard"} onChange={(v) => set("itemType", v)}>
              {ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}
            </TSelect>
          </Field>
          <div className="flex items-center gap-4 pt-6">
            <Toggle checked={f.isActive ?? true} onChange={(v) => set("isActive", v)} label="Active" />
            <Toggle checked={f.allowRequestedFor ?? true} onChange={(v) => set("allowRequestedFor", v)} label="Allow Requested For" />
          </div>
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
          <Field label="Fulfillment Group">
            <TSelect value={f.fulfillmentGroupId ? String(f.fulfillmentGroupId) : ""} onChange={(v) => set("fulfillmentGroupId", v ? Number(v) : undefined)}>
              <option value="">Select group</option>
              {groups.map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}
            </TSelect>
          </Field>
          <Field label="Assignment Group">
            <TSelect value={f.assignmentGroupId ? String(f.assignmentGroupId) : ""} onChange={(v) => set("assignmentGroupId", v ? Number(v) : undefined)}>
              <option value="">Select group</option>
              {groups.map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}
            </TSelect>
          </Field>
          <Field label="Impact">
            <TSelect value={f.impact ?? "Medium"} onChange={(v) => set("impact", v)}>
              {IMPACTS.map((i) => <option key={i}>{i}</option>)}
            </TSelect>
          </Field>
          <Field label="Urgency">
            <TSelect value={f.urgency ?? "Medium"} onChange={(v) => set("urgency", v)}>
              {URGENCIES.map((u) => <option key={u}>{u}</option>)}
            </TSelect>
          </Field>
          <Field label="Default Priority">
            <TSelect value={f.defaultPriority ?? "P3 - Moderate"} onChange={(v) => set("defaultPriority", v)}>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
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
        {/* Banner */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Catalog Item Image / Banner <span className="text-slate-400 font-normal">(Optional)</span></p>
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center min-h-36 flex flex-col items-center justify-center gap-2">
            {bannerPreview
              ? <img src={bannerPreview} className="max-h-28 object-contain rounded-lg" alt="Banner" />
              : <><Upload className="size-8 text-slate-300" /><p className="text-xs text-slate-400">Recommended size: 600 × 300 px</p></>
            }
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="h-7 px-3 rounded-lg bg-brand-600 text-white text-xs hover:bg-brand-700">Upload Image</button>
              {bannerPreview && (
                <button type="button" onClick={() => { setBannerPreview(""); set("bannerUrl", ""); }}
                  className="h-7 px-3 rounded-lg border border-slate-300 text-xs text-slate-600 hover:bg-slate-100">Remove</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                setBannerPreview(url); set("bannerUrl", url);
              }} />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Preview only for now — the API stores icon/banner as a plain URL string with no upload
            endpoint behind it yet, so this image won&apos;t survive a page reload until that&apos;s added.
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
              ["requiresApprovalFor",    "Requires Required For"],
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
            <Field label="Workflow">
              <TSelect value={f.workflowId ? String(f.workflowId) : ""} onChange={(v) => set("workflowId", v ? Number(v) : undefined)}>
                <option value="">Select workflow</option>
                {workflows.map((w) => <option key={w.workflowId} value={w.workflowId}>{w.workflowName}</option>)}
              </TSelect>
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Approval Required</span>
              <TSelect value={f.approvalRequired ? "Yes" : "No"} onChange={(v) => set("approvalRequired", v === "Yes")} disabled={false}>
                <option>Yes</option><option>No</option>
              </TSelect>
            </div>
            <Field label="Approval Policy">
              <TInput value={f.approvalPolicy ?? ""} onChange={(v) => set("approvalPolicy", v)} placeholder="VPN Access Approval Policy" />
            </Field>
            <Field label="Fulfillment Workflow">
              <TSelect value={f.fulfillmentWorkflowId ? String(f.fulfillmentWorkflowId) : ""} onChange={(v) => set("fulfillmentWorkflowId", v ? Number(v) : undefined)}>
                <option value="">Select workflow</option>
                {workflows.map((w) => <option key={w.workflowId} value={w.workflowId}>{w.workflowName}</option>)}
              </TSelect>
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
function TabVariables({ catalog, onCreateVar, onUpdateVar, onRemoveVar }: {
  catalog: Catalog | null;
  onCreateVar: (data: CreateVariableDto) => Promise<void>;
  onUpdateVar: (id: number, data: Partial<CreateVariableDto>) => Promise<void>;
  onRemoveVar: (id: number) => Promise<void>;
}) {
  const vars = catalog?.variables ?? [];
  const sections = [...new Set(vars.map((v) => v.sectionName || "General"))];

  return (
    <div className="grid grid-cols-5 gap-6">
      {/* Form sections list */}
      <div className="col-span-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Form Sections</p>
        <div className="space-y-1.5">
          {sections.map((s) => (
            <div key={s} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700">
              <GripVertical className="size-3.5 text-slate-300 shrink-0" />
              <span className="truncate">{s}</span>
            </div>
          ))}
          <button type="button" className="flex items-center gap-2 px-3 py-2.5 text-sm text-brand-600 hover:text-brand-700">
            <Plus className="size-3.5" /> Add Section
          </button>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Form Settings</p>
          <div className="space-y-3">
            {[
              ["Show section numbers", true],
              ["Show progress indicator", true],
              ["Collapse all sections", false],
              ["Make fields mandatory", true],
            ].map(([label, def]) => (
              <div key={label as string} className="flex items-center justify-between">
                <span className="text-xs text-slate-600">{label as string}</span>
                <Toggle checked={def as boolean} onChange={() => {}} />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Form layout</p>
            <div className="flex gap-3">
              {["Single Column", "Two Columns"].map((l) => (
                <label key={l} className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
                  <span className="size-3.5 rounded-full border-2 border-brand-600 flex items-center justify-center">
                    {l === "Single Column" && <span className="size-1.5 rounded-full bg-brand-600" />}
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
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section} className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-800">{section}</span>
                <button type="button" className="p-1 rounded text-slate-400 hover:text-slate-600"><GripVertical className="size-4" /></button>
              </div>
              <div className="p-3 space-y-2">
                {vars.filter((v) => (v.sectionName || "General") === section).map((v) => (
                  <VariableRow key={v.variableId} v={v} onUpdate={onUpdateVar} onRemove={onRemoveVar} />
                ))}
                {vars.filter((v) => (v.sectionName || "General") === section).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No fields in this section yet.</p>
                )}
              </div>
            </div>
          ))}
          <AddVariablePanel onAdd={onCreateVar} />
        </div>
      </div>

      {/* Add Variables sidebar */}
      <div className="col-span-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add Variables</p>
        <div className="flex gap-1 mb-3">
          {["Basic", "Advanced", "Reference"].map((t) => (
            <button key={t} type="button"
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${t === "Basic" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {SUPPORTED_FIELD_TYPES.map(({ type, label, Icon }) => (
            <button key={type} type="button"
              onClick={() => onCreateVar({ label, fieldType: type })}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50 transition-colors text-left">
              <Icon className="size-3.5 text-slate-400 shrink-0" />
              {label}
            </button>
          ))}
        </div>
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
// This is deliberately NOT the branching canvas from the mockup — that's a
// visual editor for the Workflow entity itself (steps, approvals), which
// already has its own dedicated page at /admin/workflows/[id]. Duplicating
// that editor inside the catalog editor would mean building it twice against
// the same data. This tab shows which workflow this catalog item is wired to
// and links out to manage it.
function TabWorkflow({ f, set, workflows }: {
  f: Partial<CreateCatalogDto>;
  set: <K extends keyof CreateCatalogDto>(k: K, v: CreateCatalogDto[K]) => void;
  workflows: { workflowId: number; workflowName: string }[];
}) {
  const approvalWorkflow = workflows.find((w) => w.workflowId === f.workflowId);
  const fulfillmentWorkflow = workflows.find((w) => w.workflowId === f.fulfillmentWorkflowId);

  return (
    <div className="max-w-2xl space-y-6">
      <SectionTitle>Approval Workflow</SectionTitle>
      <Field label="Workflow" hint="Runs when a request for this item needs approval before fulfillment.">
        <TSelect value={f.workflowId ? String(f.workflowId) : ""} onChange={(v) => set("workflowId", v ? Number(v) : undefined)}>
          <option value="">Select workflow</option>
          {workflows.map((w) => <option key={w.workflowId} value={w.workflowId}>{w.workflowName}</option>)}
        </TSelect>
      </Field>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">Approval Required</span>
        <TSelect value={f.approvalRequired ? "Yes" : "No"} onChange={(v) => set("approvalRequired", v === "Yes")}>
          <option>Yes</option><option>No</option>
        </TSelect>
      </div>
      <Field label="Approval Policy">
        <TInput value={f.approvalPolicy ?? ""} onChange={(v) => set("approvalPolicy", v)} placeholder="VPN Access Approval Policy" />
      </Field>
      {approvalWorkflow && (
        <Link href={`/admin/workflows/${approvalWorkflow.workflowId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
          Manage &ldquo;{approvalWorkflow.workflowName}&rdquo; steps &rsaquo;
        </Link>
      )}

      <SectionTitle>Fulfillment Workflow</SectionTitle>
      <Field label="Fulfillment Workflow" hint="Runs after approval to actually provision the request.">
        <TSelect value={f.fulfillmentWorkflowId ? String(f.fulfillmentWorkflowId) : ""} onChange={(v) => set("fulfillmentWorkflowId", v ? Number(v) : undefined)}>
          <option value="">Select workflow</option>
          {workflows.map((w) => <option key={w.workflowId} value={w.workflowId}>{w.workflowName}</option>)}
        </TSelect>
      </Field>
      {fulfillmentWorkflow && (
        <Link href={`/admin/workflows/${fulfillmentWorkflow.workflowId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
          Manage &ldquo;{fulfillmentWorkflow.workflowName}&rdquo; steps &rsaquo;
        </Link>
      )}
      {!f.workflowId && !f.fulfillmentWorkflowId && (
        <p className="text-xs text-slate-400">
          Pick a workflow above, save this item, then use the link that appears to edit its steps.
        </p>
      )}
    </div>
  );
}

// ─── Tab: Policies ────────────────────────────────────────────────────────────
// Consolidates the approval/SLA fields that are otherwise scattered across
// Item Details and Workflow, since the mockup treats "Policies" as its own
// tab. No new data — same fields as elsewhere, just gathered in one place.
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

// ─── Stub tabs ────────────────────────────────────────────────────────────────
function StubTab({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
      <AlertCircle className="size-10 text-slate-200 mb-3" />
      <p className="text-slate-600 text-sm font-medium">{title} isn&apos;t built yet</p>
      <p className="text-slate-400 text-xs mt-1.5">{reason}</p>
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

interface CatalogEditorProps {
  mode: "create" | "edit";
  catalog?: Catalog | null;
  onSave:      (data: CreateCatalogDto) => Promise<Catalog | null>;
  onCreateVar: (data: CreateVariableDto) => Promise<void>;
  onUpdateVar: (id: number, data: Partial<CreateVariableDto>) => Promise<void>;
  onRemoveVar: (id: number) => Promise<void>;
}

export function CatalogEditor({ mode, catalog, onSave, onCreateVar, onUpdateVar, onRemoveVar }: CatalogEditorProps) {
  const router = useRouter();
  const { categories } = useAdminCategories();
  const { workflows }  = useAdminWorkflows();
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  useEffect(() => { apiFetch<AssignmentGroup[]>("/assignment-groups").then(setGroups).catch(() => {}); }, []);

  const [activeTab, setActiveTab] = useState<Tab>("Item Details");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  // form state initialised from catalog (edit) or defaults (create)
  const init = useCallback((): Partial<CreateCatalogDto> => ({
    catalogName:           catalog?.catalogName           ?? "",
    catalogCode:           catalog?.catalogCode           ?? "",
    shortDescription:      catalog?.shortDescription      ?? "",
    description:           catalog?.description           ?? "",
    categoryId:            catalog?.category?.categoryId,
    subCategory:           catalog?.subCategory           ?? "",
    itemType:              catalog?.itemType              ?? "Standard",
    isActive:              catalog?.isActive              ?? true,
    allowRequestedFor:     catalog?.allowRequestedFor     ?? true,
    iconUrl:               catalog?.iconUrl               ?? "",
    bannerUrl:             catalog?.bannerUrl             ?? "",
    requestType:           catalog?.requestType           ?? "Access",
    approvalRequired:      catalog?.approvalRequired      ?? false,
    stage:                 catalog?.stage                 ?? "Production",
    impact:                catalog?.impact                ?? "Medium",
    urgency:               catalog?.urgency               ?? "Medium",
    defaultPriority:       catalog?.defaultPriority       ?? "P3 - Moderate",
    slaName:               catalog?.slaName               ?? "",
    tags:                  catalog?.tags                  ?? [],
    keywords:              catalog?.keywords              ?? "",
    serviceOffering:       catalog?.serviceOffering       ?? "",
    businessService:       catalog?.businessService       ?? "",
    configurationItem:     catalog?.configurationItem     ?? "",
    estimatedTime:         catalog?.estimatedTime         ?? 2,
    deliveryTimeSla:       catalog?.deliveryTimeSla       ?? 4,
    hidePrice:             catalog?.hidePrice             ?? false,
    workflowId:            catalog?.workflow?.workflowId,
    approvalPolicy:        catalog?.approvalPolicy        ?? "",
    fulfillmentWorkflowId: catalog?.fulfillmentWorkflow?.workflowId,
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
    departments:           catalog?.departments           ?? [],
    locations:             catalog?.locations             ?? [],
  }), [catalog]);

  const [f, setF] = useState<Partial<CreateCatalogDto>>(init);
  useEffect(() => { setF(init()); }, [init]);

  const set = useCallback(<K extends keyof CreateCatalogDto>(k: K, v: CreateCatalogDto[K]) =>
    setF((p) => ({ ...p, [k]: v })), []);

  const handleSave = async () => {
    if (!f.catalogName?.trim()) return;
    setSaving(true);
    const result = await onSave(f as CreateCatalogDto);
    setSaving(false);
    if (result) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (mode === "create") router.push(`/admin/catalogs/${result.catalogId}`);
    }
  };

  const catalogName = f.catalogName || (mode === "create" ? "New Catalog Item" : "Catalog Item");

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">
            Admin &rsaquo; Service Catalog &rsaquo; Catalog Items &rsaquo; {catalogName} &rsaquo; {mode === "create" ? "Create" : "Edit"}
          </p>
          <h1 className="text-xl font-bold text-slate-900">
            {mode === "create" ? "Create Catalog Item" : "Edit Catalog Item"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and configure service catalog items for users.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/catalogs"
            className="h-9 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center">
            Cancel
          </Link>
          {mode === "edit" && catalog && (
            <Link href={`/service-requests/${catalog.catalogId}`}
              className="h-9 px-4 rounded-lg border border-brand-300 bg-white text-sm font-medium text-brand-700 hover:bg-brand-50 inline-flex items-center gap-1.5">
              <Eye className="size-4" /> Preview Catalog Item
            </Link>
          )}
          <button onClick={handleSave} disabled={saving || !f.catalogName?.trim()}
            className="h-9 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 inline-flex items-center gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : mode === "create" ? "Create Catalog Item" : "Save Catalog Item"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-6 border-b border-slate-100 bg-white shrink-0 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={[
              "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              activeTab === tab
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            ].join(" ")}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "Item Details"      && <TabItemDetails f={f} set={set} categories={categories} groups={groups} workflows={workflows} />}
        {activeTab === "Variables (Form)"  && <TabVariables catalog={catalog ?? null} onCreateVar={onCreateVar} onUpdateVar={onUpdateVar} onRemoveVar={onRemoveVar} />}
        {activeTab === "Visibility"        && <TabVisibility f={f} set={set} />}
        {activeTab === "Pricing & Cost"    && <TabPricing f={f} set={set} />}
        {activeTab === "Workflow"          && <TabWorkflow f={f} set={set} workflows={workflows} />}
        {activeTab === "Policies"          && <TabPolicies f={f} set={set} />}
        {activeTab === "Knowledge"         && <StubTab title="Knowledge" reason="There's no knowledge-base module in the backend yet — no entity for articles, and nothing to link them to this catalog item." />}
        {activeTab === "Attachments"       && <StubTab title="Attachments" reason="There's no attachments module in the backend yet — no storage, upload endpoint, or entity to attach files to this catalog item." />}
      </div>
    </div>
  );
}
