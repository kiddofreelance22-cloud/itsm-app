"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  X, ChevronDown, Info, LayoutGrid,
  Monitor, Laptop, Smartphone, Wifi, Network, Server, Database,
  Mail, MessageSquare, Phone, Lock, Shield, Key, HardDrive, Cpu, Printer,
  Cloud, Globe, Settings, Wrench, ClipboardList, FileText, AlertTriangle,
  HelpCircle, Building2, MapPin, CreditCard, Package, LifeBuoy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Category } from "@/types/admin";
import { CreateCategoryDto } from "@/lib/api/categories.api";
import { useAdminAssignmentGroup, useAdminLocation } from "@/lib/hooks/use-admin-modules";

// ── Icon picker options (persisted as the Lucide icon name) ──────────────────
const ICON_OPTIONS: { name: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { name: "Monitor", Icon: Monitor },
  { name: "Laptop", Icon: Laptop },
  { name: "Smartphone", Icon: Smartphone },
  { name: "Wifi", Icon: Wifi },
  { name: "Network", Icon: Network },
  { name: "Server", Icon: Server },
  { name: "Database", Icon: Database },
  { name: "Mail", Icon: Mail },
  { name: "MessageSquare", Icon: MessageSquare },
  { name: "Phone", Icon: Phone },
  { name: "Lock", Icon: Lock },
  { name: "Shield", Icon: Shield },
  { name: "Key", Icon: Key },
  { name: "HardDrive", Icon: HardDrive },
  { name: "Cpu", Icon: Cpu },
  { name: "Printer", Icon: Printer },
  { name: "Cloud", Icon: Cloud },
  { name: "Globe", Icon: Globe },
  { name: "Settings", Icon: Settings },
  { name: "Wrench", Icon: Wrench },
  { name: "ClipboardList", Icon: ClipboardList },
  { name: "FileText", Icon: FileText },
  { name: "AlertTriangle", Icon: AlertTriangle },
  { name: "HelpCircle", Icon: HelpCircle },
  { name: "Building2", Icon: Building2 },
  { name: "MapPin", Icon: MapPin },
  { name: "CreditCard", Icon: CreditCard },
  { name: "Package", Icon: Package },
  { name: "LifeBuoy", Icon: LifeBuoy },
];
export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> =
  Object.fromEntries(ICON_OPTIONS.map((o) => [o.name, o.Icon]));

// ── Small tag-style multi-select used by the Assignments section ────────────
interface MultiSelectOption { id: number; label: string; }
function MultiSelect({
  label, placeholder, options, selected, onChange, disabled,
}: {
  label: string; placeholder: string; options: MultiSelectOption[];
  selected: number[]; onChange: (ids: number[]) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div ref={ref} className="relative">
      <Label>{label}</Label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-left shadow-sm outline-none transition-colors focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        {selected.length === 0 && <span className="py-1 text-sm text-slate-400">{placeholder}</span>}
        {selected.map((id) => {
          const opt = options.find((o) => o.id === id);
          if (!opt) return null;
          return (
            <span key={id} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
              {opt.label}
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); toggle(id); }}
                className="cursor-pointer text-brand-400 hover:text-brand-700"
              >
                <X className="size-3" />
              </span>
            </span>
          );
        })}
        <ChevronDown className="ml-auto size-4 shrink-0 text-slate-400" />
      </button>
      {open && !disabled && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {options.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">No options available</p>}
          {options.map((opt) => (
            <label key={opt.id} className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              <Checkbox checked={selected.includes(opt.id)} onCheckedChange={() => toggle(opt.id)} />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function slugifyCode(name: string): string {
  return name.toUpperCase().trim().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const VISIBILITY_FIELDS = [
  { key: "availableInPortal" as const, label: "Available in Service Portal", hint: "Show this category when employees browse the self-service portal." },
  { key: "availableInMobile" as const, label: "Available in Mobile App", hint: "Show this category in the ITSM mobile app." },
  { key: "showInCatalog" as const, label: "Show in Service Request Catalog", hint: "Include this category when browsing the service catalog." },
  { key: "allowInIncident" as const, label: "Allow selection in Incident", hint: "Let agents choose this category when logging an incident." },
];

interface FormState {
  categoryName: string;
  categoryCode: string;
  description: string;
  parentCategoryId: number | "";
  displayOrder: number | "";
  icon: string;
  isActive: boolean;
  availableInPortal: boolean;
  availableInMobile: boolean;
  showInCatalog: boolean;
  allowInIncident: boolean;
  defaultAssignmentGroupId: number | "";
  workgroupIds: number[];
  locationIds: number[];
  memberIds: number[];
}

const emptyForm: FormState = {
  categoryName: "",
  categoryCode: "",
  description: "",
  parentCategoryId: "",
  displayOrder: "",
  icon: "",
  isActive: true,
  availableInPortal: true,
  availableInMobile: true,
  showInCatalog: true,
  allowInIncident: true,
  defaultAssignmentGroupId: "",
  workgroupIds: [],
  locationIds: [],
  memberIds: [],
};

interface CategoryFormPanelProps {
  open: boolean;
  category?: Category | null;
  /** Flattened category list (parent-first, indented) used to populate the parent dropdown. */
  categories: Category[];
  /** Pre-selects the parent when opened via "Add Subcategory" on a specific tree node. */
  defaultParentId?: number | null;
  isLoading?: boolean;
  onSubmit: (data: CreateCategoryDto) => Promise<boolean>;
  onClose: () => void;
}

export function CategoryFormPanel({
  open, category, categories, defaultParentId = null, isLoading = false, onSubmit, onClose,
}: CategoryFormPanelProps) {
  const isEdit = !!category;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [codeTouched, setCodeTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { items: assignmentGroups } = useAdminAssignmentGroup();
  const { items: locations } = useAdminLocation();

  const workgroupOptions: MultiSelectOption[] = useMemo(
    () => assignmentGroups.map((g) => ({ id: g.groupId, label: g.groupName })),
    [assignmentGroups]
  );
  const locationOptions: MultiSelectOption[] = useMemo(
    () => locations.map((l) => ({ id: l.locationId, label: l.locationName })),
    [locations]
  );
  // Only offer members belonging to the currently-selected workgroups —
  // mirrors the mock, where "Workgroup Members" narrows once a workgroup is chosen.
  const memberOptions: MultiSelectOption[] = useMemo(() => {
    const groups = assignmentGroups.filter((g) => form.workgroupIds.includes(g.groupId));
    const seen = new Map<number, string>();
    for (const g of groups) for (const m of g.members) seen.set(m.userId, m.fullName);
    return Array.from(seen, ([id, label]) => ({ id, label }));
  }, [assignmentGroups, form.workgroupIds]);

  const nextOrder = useMemo(
    () => categories.reduce((max, c) => Math.max(max, c.displayOrder ?? 0), 0) + 1,
    [categories]
  );

  useEffect(() => {
    if (!open) return;
    if (category) {
      setForm({
        categoryName: category.categoryName,
        categoryCode: category.categoryCode ?? "",
        description: category.description ?? "",
        parentCategoryId: category.parentCategoryId ?? category.parent?.categoryId ?? "",
        displayOrder: category.displayOrder ?? "",
        icon: category.icon ?? "",
        isActive: category.isActive,
        availableInPortal: category.availableInPortal,
        availableInMobile: category.availableInMobile,
        showInCatalog: category.showInCatalog,
        allowInIncident: category.allowInIncident,
        defaultAssignmentGroupId: category.defaultAssignmentGroup?.groupId ?? "",
        workgroupIds: category.workgroupIds ?? [],
        locationIds: category.locationIds ?? [],
        memberIds: category.memberIds ?? [],
      });
      setCodeTouched(true);
    } else {
      setForm({ ...emptyForm, displayOrder: nextOrder, parentCategoryId: defaultParentId ?? "" });
      setCodeTouched(false);
    }
    setErrors({});
    setPickerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category, defaultParentId]);

  // Close the icon picker when clicking outside of it
  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleNameChange = (v: string) => {
    set("categoryName", v);
    if (!codeTouched) set("categoryCode", slugifyCode(v));
  };

  const handleCodeChange = (v: string) => {
    setCodeTouched(true);
    set("categoryCode", v.toUpperCase().replace(/[^A-Z0-9_]/g, ""));
  };

  // Parent options: exclude the category itself and any of its descendants
  // (picking a descendant as parent would create a cycle).
  const parentIdOf = useMemo(() => {
    const map = new Map<number, number | null>();
    categories.forEach((c) => map.set(c.categoryId, c.parentCategoryId ?? c.parent?.categoryId ?? null));
    return map;
  }, [categories]);

  const isSelfOrDescendant = (candidateId: number): boolean => {
    if (!category) return false;
    let cur: number | null = candidateId;
    const guard = new Set<number>();
    while (cur != null) {
      if (cur === category.categoryId) return true;
      if (guard.has(cur)) break;
      guard.add(cur);
      cur = parentIdOf.get(cur) ?? null;
    }
    return false;
  };

  const parentOptions = categories.filter((c) => !isSelfOrDescendant(c.categoryId));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.categoryName.trim()) e.categoryName = "Category name is required";
    if (!form.categoryCode.trim()) e.categoryCode = "Category code is required";
    else if (!/^[A-Z0-9_]+$/.test(form.categoryCode.trim()))
      e.categoryCode = "Uppercase letters, numbers and underscores only";
    if (!form.description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const ok = await onSubmit({
      categoryName: form.categoryName.trim(),
      categoryCode: form.categoryCode.trim(),
      description: form.description.trim(),
      parentCategoryId: form.parentCategoryId ? Number(form.parentCategoryId) : undefined,
      displayOrder: form.displayOrder === "" ? undefined : Number(form.displayOrder),
      icon: form.icon || undefined,
      isActive: form.isActive,
      availableInPortal: form.availableInPortal,
      availableInMobile: form.availableInMobile,
      showInCatalog: form.showInCatalog,
      allowInIncident: form.allowInIncident,
      defaultAssignmentGroupId: form.defaultAssignmentGroupId === "" ? undefined : Number(form.defaultAssignmentGroupId),
      workgroupIds: form.workgroupIds,
      locationIds: form.locationIds,
      memberIds: form.memberIds,
    });
    if (ok) onClose();
  };

  if (!open) return null;

  const SelectedIcon = form.icon ? ICON_MAP[form.icon] : null;

  return (
    <div className="flex h-full max-h-[calc(100vh-110px)] flex-col border-0 bg-transparent lg:sticky lg:top-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b-2 border-slate-800 px-0 pb-2.5">
        <div>
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-slate-800">
            {isEdit ? "Edit Category" : "Add Sub-Category"}
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            {isEdit
              ? "Update this category's details and visibility."
              : "Add a new category to organize service requests and incidents."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-5 overflow-y-auto px-0 py-4 pr-3">
          {/* Category Information */}
          <section className="space-y-4">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.5px] text-slate-400">
              Category Information
            </h3>
            <div>
              <Label required>Category Name</Label>
              <Input
                value={form.categoryName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter category name"
                invalid={!!errors.categoryName}
              />
              {errors.categoryName && <p className="mt-1 text-xs text-red-500">{errors.categoryName}</p>}
            </div>
            <div>
              <Label required>Category Code</Label>
              <Input
                value={form.categoryCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="Enter category code"
                invalid={!!errors.categoryCode}
                className="font-mono"
              />
              {errors.categoryCode ? (
                <p className="mt-1 text-xs text-red-500">{errors.categoryCode}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">Unique code for system reference</p>
              )}
            </div>
            <div>
              <Label required>Description</Label>
              <Textarea
                rows={3}
                maxLength={500}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Enter description for the category"
                invalid={!!errors.description}
              />
              <div className="mt-1 flex items-center justify-between">
                {errors.description ? (
                  <p className="text-xs text-red-500">{errors.description}</p>
                ) : <span />}
                <p className="shrink-0 text-xs text-slate-400">{form.description.length}/500 characters</p>
              </div>
            </div>
          </section>

          {/* Configuration */}
          <section className="space-y-4">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.5px] text-slate-400">
              Configuration
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Parent Category (optional)</Label>
                <div className="relative">
                  <select
                    value={form.parentCategoryId}
                    onChange={(e) => set("parentCategoryId", e.target.value ? Number(e.target.value) : "")}
                    className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-800 shadow-sm outline-none transition-colors focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100"
                  >
                    <option value="">— None (top-level) —</option>
                    {parentOptions.map((c) => (
                      <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div>
                <Label>Display Order</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(e) => set("displayOrder", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Auto"
                />
                <p className="mt-1 text-xs text-slate-400">Numeric order for display (lower number shows first)</p>
              </div>
            </div>
          </section>

          {/* Incident Routing */}
          <section className="space-y-2">
            <div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.5px] text-slate-400">
                Incident Routing
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Incidents filed under this category (or a descendant that doesn&apos;t set its own) route here automatically. Leave blank to inherit the parent category&apos;s routing, or the system default if none is set anywhere up the tree.
              </p>
            </div>
            <div>
              <Label>Default Assignment Group</Label>
              <div className="relative">
                <select
                  value={form.defaultAssignmentGroupId}
                  onChange={(e) => set("defaultAssignmentGroupId", e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-8 text-sm text-slate-800 shadow-sm outline-none transition-colors focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100"
                >
                  <option value="">Inherit from parent / system default</option>
                  {assignmentGroups.map((g) => (
                    <option key={g.groupId} value={g.groupId}>{g.groupName}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-4 text-slate-400" />
              </div>
            </div>
          </section>

          {/* Assignments (Optional) */}
          <section className="space-y-3">
            <div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.5px] text-slate-400">
                Assignments (Optional)
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Restrict who can see or manage this node. Leave blank to inherit the parent category&apos;s assignments.
              </p>
            </div>
            <MultiSelect
              label="Workgroups"
              placeholder="Example: Selections, Support…"
              options={workgroupOptions}
              selected={form.workgroupIds}
              onChange={(ids) => setForm((p) => ({
                ...p,
                workgroupIds: ids,
                // Drop any selected member who no longer belongs to a chosen workgroup.
                memberIds: p.memberIds.filter((id) =>
                  assignmentGroups.some((g) => ids.includes(g.groupId) && g.members.some((m) => m.userId === id))
                ),
              }))}
            />
            <MultiSelect
              label="Locations"
              placeholder="Example: Locations…"
              options={locationOptions}
              selected={form.locationIds}
              onChange={(ids) => set("locationIds", ids)}
            />
            <div>
              <Label>Workgroup Members</Label>
              {form.workgroupIds.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-xs text-slate-400">
                  Select a workgroup above to choose specific members.
                </p>
              ) : memberOptions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-xs text-slate-400">
                  The selected workgroup(s) have no members yet.
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {memberOptions.map((m) => (
                    <label key={m.id} className="flex cursor-pointer select-none items-center gap-2 rounded-md px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50">
                      <Checkbox
                        checked={form.memberIds.includes(m.id)}
                        onCheckedChange={() => set("memberIds",
                          form.memberIds.includes(m.id)
                            ? form.memberIds.filter((id) => id !== m.id)
                            : [...form.memberIds, m.id])}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Icon */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.5px] text-slate-400">Icon</h3>
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300">
                {SelectedIcon ? <SelectedIcon className="size-6 text-brand-600" /> : <LayoutGrid className="size-6" />}
              </div>
              <div className="relative" ref={pickerRef}>
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Change Icon
                </button>
                {pickerOpen && (
                  <div className="absolute left-0 top-10 z-20 grid w-64 grid-cols-6 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                    {ICON_OPTIONS.map(({ name, Icon }) => (
                      <button
                        key={name}
                        type="button"
                        title={name}
                        onClick={() => { set("icon", name); setPickerOpen(false); }}
                        className={`flex size-8 items-center justify-center rounded-md transition-colors hover:bg-brand-50 ${
                          form.icon === name ? "bg-brand-100 text-brand-600" : "text-slate-500"
                        }`}
                      >
                        <Icon className="size-4" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {form.icon && (
                <button
                  type="button"
                  onClick={() => set("icon", "")}
                  className="h-8 rounded-lg border border-slate-300 px-3 text-xs text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Remove
                </button>
              )}
            </div>
          </section>

          {/* Status */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.5px] text-slate-400">Status</h3>
            <div className="flex items-center gap-6">
              <label className="flex cursor-pointer select-none items-center gap-2">
                <span
                  onClick={() => set("isActive", true)}
                  className={`flex size-4 items-center justify-center rounded-full border-2 ${
                    form.isActive ? "border-brand-600" : "border-slate-300"
                  }`}
                >
                  {form.isActive && <span className="size-2 rounded-full bg-brand-600" />}
                </span>
                <span className="text-sm text-slate-700">Active</span>
              </label>
              <label className="flex cursor-pointer select-none items-center gap-2">
                <span
                  onClick={() => set("isActive", false)}
                  className={`flex size-4 items-center justify-center rounded-full border-2 ${
                    !form.isActive ? "border-brand-600" : "border-slate-300"
                  }`}
                >
                  {!form.isActive && <span className="size-2 rounded-full bg-brand-600" />}
                </span>
                <span className="text-sm text-slate-700">In Active</span>
              </label>
            </div>
          </section>

          {/* Visibility */}
          <section className="space-y-3 pb-1">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.5px] text-slate-400">Visibility</h3>
            <div className="space-y-3">
              {VISIBILITY_FIELDS.map(({ key, label, hint }) => (
                <label key={key} className="flex cursor-pointer select-none items-start gap-2.5">
                  <Checkbox
                    checked={form[key]}
                    onCheckedChange={(v) => set(key, v === true)}
                    className="mt-0.5"
                  />
                  <span className="flex items-center gap-1.5 text-sm text-slate-700">
                    {label}
                    <span title={hint}>
                      <Info className="size-3.5 text-slate-300" />
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-0 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {isEdit ? "Save Changes" : "Create Category"}
          </Button>
        </div>
      </form>
    </div>
  );
}
