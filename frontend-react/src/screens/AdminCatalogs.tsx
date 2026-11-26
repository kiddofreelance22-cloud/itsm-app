import React, { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, FileText, Pencil, Plus, Save, Trash2, Upload } from "lucide-react";
import { API_BASE_URL } from "../api";
import { Link } from "../router";
import { ErrorBar, errMsg } from "../components/configKit";
import { useAsync } from "../hooks";
import {
  serviceRequestApi,
  type CatalogAttachment,
  type CatalogFieldType,
  type CatalogLookupItem,
  type CatalogPayload,
  type CatalogSection,
  type CatalogVariable,
  type CatalogVariablePayload,
  type CatalogWorkflow,
  type ServiceCatalog,
  type ServiceCatalogCategory,
} from "../requestsApi";

import {
  LOOKUP_SOURCES,
  DEFAULT_LOOKUP_SOURCE,
  PERSON_SOURCE,
  lookupSourceLabel,
  normalizeLookupSource,
} from "../lookupSources";
import { LookupField } from "../components/LookupField";

const FIELD_TYPES: CatalogFieldType[] = [
  "text", "textarea", "number", "dropdown", "checkbox", "date", "multi_select",
  "radio", "datetime", "attachment", "info", "user_lookup", "group_lookup",
];
export const FIELD_TYPE_LABELS: Record<CatalogFieldType, string> = {
  text: "Single-line text",
  textarea: "Paragraph",
  number: "Number",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  date: "Date",
  multi_select: "Checkbox group (Multi-select)",
  radio: "Radio buttons",
  datetime: "Date & Time",
  attachment: "Attachment",
  info: "Info box",
  user_lookup: "Person (User table)",
  group_lookup: "Lookup (Source table)",
};
const OPTION_FIELDS: CatalogFieldType[] = ["dropdown", "multi_select", "checkbox", "radio"];
const TABS = ["Item details", "Form builder", "Preview", "Additional info"] as const;
type EditorTab = (typeof TABS)[number];

interface VariableDraft {
  label: string;
  fieldType: CatalogFieldType;
  sectionId: string;
  defaultValue: string;
  placeholder: string;
  helpText: string;
  minValue: string;
  maxValue: string;
  validationRegex: string;
  dateMin: string;
  dateMax: string;
  allowedFileTypes: string;
  maxFileSizeMb: string;
  lookupSource: string;
  optionsText: string;
  isMandatory: boolean;
  isVisible: boolean;
  readOnly: boolean;
}

const EMPTY_VARIABLE: VariableDraft = {
  label: "",
  fieldType: "text",
  sectionId: "",
  defaultValue: "",
  placeholder: "",
  helpText: "",
  minValue: "",
  maxValue: "",
  validationRegex: "",
  dateMin: "",
  dateMax: "",
  allowedFileTypes: "",
  maxFileSizeMb: "",
  lookupSource: "",
  optionsText: "",
  isMandatory: false,
  isVisible: true,
  readOnly: false,
};

const newCatalogDraft = (catalog: ServiceCatalog | null): CatalogPayload => ({
  catalogName: catalog?.catalogName ?? "",
  catalogCode: catalog?.catalogCode ?? "",
  shortDescription: catalog?.shortDescription ?? "",
  description: catalog?.description ?? "",
  serviceCategoryId: catalog?.serviceCategory?.serviceCategoryId ?? (!catalog && typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("category")) || null : null),
  isActive: catalog?.isActive ?? true,
  allowRequestedFor: catalog?.allowRequestedFor ?? true,
  itemType: catalog?.itemType ?? "Standard",
  requestType: catalog?.requestType ?? "Access",
  approvalRequired: catalog?.approvalRequired ?? false,
  stage: catalog?.stage ?? "Production",
  priorityId: catalog?.priority?.priorityId ?? null,
  impactId: catalog?.impact?.impactId ?? null,
  serviceImpactId: catalog?.serviceImpact?.serviceImpactId ?? null,
  estimatedCost: catalog?.estimatedCost != null && catalog.estimatedCost !== "" ? Number(catalog.estimatedCost) : undefined,
  urgencyId: catalog?.urgency?.urgencyId ?? null,
  slaName: catalog?.slaName ?? "",
  tags: catalog?.tags ?? [],
  keywords: catalog?.keywords ?? "",
  serviceOffering: catalog?.serviceOffering ?? "",
  businessService: catalog?.businessService ?? "",
  configurationItem: catalog?.configurationItem ?? "",
  estimatedTime: catalog?.estimatedTime ?? 2,
  deliveryTimeSla: catalog?.deliveryTimeSla ?? 4,
  hidePrice: catalog?.hidePrice ?? false,
  workflowId: catalog?.workflow?.workflowId ?? null,
  approvalPolicy: catalog?.approvalPolicy ?? "",
  fulfillmentWorkflowId: catalog?.fulfillmentWorkflow?.workflowId ?? null,
  fulfillmentGroupId: catalog?.fulfillmentGroup?.groupId ?? null,
  assignmentGroupId: catalog?.assignmentGroup?.groupId ?? null,
  availableInPortal: catalog?.availableInPortal ?? true,
  availableInMobile: catalog?.availableInMobile ?? true,
  showInCatalog: catalog?.showInCatalog ?? true,
  showInPopular: catalog?.showInPopular ?? false,
  requiresApprovalFor: catalog?.requiresApprovalFor ?? false,
  allowRequestsForOthers: catalog?.allowRequestsForOthers ?? true,
  enableDiscussion: catalog?.enableDiscussion ?? false,
  visibleTo: catalog?.visibleTo ?? "All Users",
  userGroups: catalog?.userGroups ?? [],
  departments: catalog?.departments ?? [],
  locations: catalog?.locations ?? [],
  showSectionNumbers: catalog?.showSectionNumbers ?? true,
  showProgressIndicator: catalog?.showProgressIndicator ?? true,
  collapseAllSections: catalog?.collapseAllSections ?? false,
  makeFieldsMandatory: catalog?.makeFieldsMandatory ?? false,
  formLayout: catalog?.formLayout === "two-column" ? "two-column" : "single",
  status: catalog?.status === "archived" ? "archived" : catalog?.isActive === false ? "draft" : "published",
  visibility: catalog?.visibility === "internal" || catalog?.visibility === "private" ? catalog.visibility : "public",
  iconUrl: catalog?.iconUrl ?? "",
  bannerUrl: catalog?.bannerUrl ?? "",
  tileColor: catalog?.tileColor ?? "",
});

function imageUrl(path?: string | null) {
  if (!path) return "";
  return /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function optionsFromText(raw: string) {
  return raw.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [label, ...valueParts] = line.split("|");
    const optionLabel = label.trim();
    return { optionLabel, optionValue: valueParts.join("|").trim() || optionLabel, sortOrder: index };
  });
}

function optionsToText(variable: CatalogVariable) {
  return (variable.options ?? []).map((option) => `${option.optionLabel}|${option.optionValue}`).join("\n");
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`service-request-field${wide ? " service-request-field-wide" : ""}`}><span className="lbl">{label}</span>{children}</label>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="service-request-choice"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>;
}

interface CatalogEditorProps {
  catalog: ServiceCatalog | null;
  categories: ServiceCatalogCategory[];
  workflows: CatalogWorkflow[];
  groups: CatalogLookupItem[];
  priorities: CatalogLookupItem[];
  urgencies: CatalogLookupItem[];
  lookupErrors: string[];
  busy: boolean;
  onBack: () => void;
  onCreated: (catalogId: number) => void;
  onBusyChange: (busy: boolean) => void;
  onCatalogsChanged: () => void;
}

function CatalogEditor({
  catalog,
  categories,
  workflows,
  groups,
  priorities,
  urgencies,
  lookupErrors,
  busy,
  onBack,
  onCreated,
  onBusyChange,
  onCatalogsChanged,
}: CatalogEditorProps) {
  const [draft, setDraft] = useState<CatalogPayload>(() => newCatalogDraft(catalog));
  const [tab, setTab] = useState<EditorTab>("Item details");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingSectionName, setEditingSectionName] = useState("");
  const [editingVariable, setEditingVariable] = useState<CatalogVariable | null>(null);
  const [variableDraft, setVariableDraft] = useState<VariableDraft>(EMPTY_VARIABLE);
  const [fileBusy, setFileBusy] = useState("");
  const attachmentQuery = useAsync(
    () => catalog ? serviceRequestApi.catalogAttachments(catalog.catalogId) : Promise.resolve([] as CatalogAttachment[]),
    [catalog?.catalogId],
  );

  const sections = [...(catalog?.sections ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const variables = [...(catalog?.variables ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const serviceImpacts = useAsync(() => serviceRequestApi.serviceImpacts(), []);
  const set = <K extends keyof CatalogPayload>(key: K, value: CatalogPayload[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const setList = (key: "tags" | "userGroups" | "departments" | "locations", text: string) =>
    set(key, text.split(",").map((value) => value.trim()).filter(Boolean));

  const saveCatalog = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const catalogName = draft.catalogName.trim();
    if (!catalogName) {
      setError("Catalog name is required.");
      setTab("Item details");
      return;
    }
    onBusyChange(true);
    setError("");
    setNotice("");
    try {
      const payload: CatalogPayload = {
        ...draft,
        catalogName,
        shortDescription: draft.shortDescription?.trim() || undefined,
        description: draft.description?.trim() || undefined,
        serviceCategoryId: draft.serviceCategoryId || null,
        status: draft.status === "archived" ? "archived" : draft.isActive ? "published" : "draft",
        visibility: draft.visibility ?? "public",
        tags: draft.tags ?? [],
      };
      if (catalog) {
        await serviceRequestApi.updateCatalog(catalog.catalogId, payload);
        setNotice("Catalog item saved.");
        onCatalogsChanged();
      } else {
        const created = await serviceRequestApi.createCatalog(payload);
        setNotice("Catalog item created.");
        onCreated(created.catalogId);
      }
    } catch (e) {
      setError(errMsg(e, "Unable to save this catalog item."));
    } finally {
      onBusyChange(false);
    }
  };

  const runCatalogAction = async (action: () => Promise<unknown>, successMessage?: string): Promise<boolean> => {
    onBusyChange(true);
    setError("");
    try {
      await action();
      if (successMessage) setNotice(successMessage);
      onCatalogsChanged();
      return true;
    } catch (e) {
      setError(errMsg(e));
      return false;
    } finally {
      onBusyChange(false);
    }
  };

  const uploadCatalogImage = async (kind: "iconUrl" | "bannerUrl", file?: File) => {
    if (!file) return;
    setFileBusy(kind);
    setError("");
    try {
      const uploaded = await serviceRequestApi.upload(file);
      set(kind, uploaded.url);
      setNotice("Image uploaded. Save the catalog item to apply the change.");
    } catch (e) {
      setError(errMsg(e, "Unable to upload the image."));
    } finally {
      setFileBusy("");
    }
  };

  const saveSection = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!catalog || !sectionName.trim()) return;
    const saved = await runCatalogAction(
      () => serviceRequestApi.createSection(catalog.catalogId, {
        name: sectionName.trim(),
        description: sectionDescription.trim() || undefined,
        displayOrder: sections.length,
      }),
      "Form section added.",
    );
    if (saved) {
      setSectionName("");
      setSectionDescription("");
    }
  };

  const renameSection = async (section: CatalogSection) => {
    if (!catalog || !editingSectionName.trim()) return;
    const saved = await runCatalogAction(
      () => serviceRequestApi.updateSection(catalog.catalogId, section.sectionId, { name: editingSectionName.trim() }),
      "Section renamed.",
    );
    if (saved) setEditingSectionId(null);
  };

  const reorderSections = async (sectionId: number, direction: -1 | 1) => {
    if (!catalog) return;
    const index = sections.findIndex((section) => section.sectionId === sectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await runCatalogAction(() => serviceRequestApi.reorderSections(
      catalog.catalogId,
      reordered.map((section, displayOrder) => ({ sectionId: section.sectionId, displayOrder })),
    ));
  };

  const resetVariableForm = () => {
    setEditingVariable(null);
    setVariableDraft(EMPTY_VARIABLE);
  };

  const editVariable = (variable: CatalogVariable) => {
    setEditingVariable(variable);
    setVariableDraft({
      ...EMPTY_VARIABLE,
      label: variable.label,
      fieldType: variable.fieldType,
      sectionId: variable.section?.sectionId ? String(variable.section.sectionId) : "",
      isMandatory: variable.isMandatory,
      isVisible: variable.isVisible,
      readOnly: variable.readOnly,
      defaultValue: variable.defaultValue ?? "",
      placeholder: variable.placeholder ?? "",
      helpText: variable.helpText ?? "",
      minValue: variable.minValue ?? "",
      maxValue: variable.maxValue ?? "",
      validationRegex: variable.validationRegex ?? "",
      dateMin: variable.dateMin ?? "",
      dateMax: variable.dateMax ?? "",
      allowedFileTypes: variable.allowedFileTypes ?? "",
      maxFileSizeMb: variable.maxFileSizeMb == null ? "" : String(variable.maxFileSizeMb),
      lookupSource: variable.fieldType === "user_lookup"
        ? PERSON_SOURCE
        : variable.fieldType === "group_lookup"
          ? (variable.lookupSource ? normalizeLookupSource(variable.lookupSource) : DEFAULT_LOOKUP_SOURCE)
          : (variable.lookupSource ?? ""),
      optionsText: optionsToText(variable),
    });
  };

  const saveVariable = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!catalog) return;
    if (!variableDraft.label.trim()) {
      setError("Field label is required.");
      return;
    }
    const hasOptions = OPTION_FIELDS.includes(variableDraft.fieldType);
    const options = hasOptions ? optionsFromText(variableDraft.optionsText) : undefined;
    if (hasOptions && !options?.length) {
      setError("Add at least one option using one line per option in Label|value format.");
      return;
    }
    if (options?.some((option) => !option.optionLabel || !option.optionValue)) {
      setError("Each option needs a label and value. Use Label|value or repeat the label as its value.");
      return;
    }
    const resolvedLookupSource = variableDraft.fieldType === "user_lookup"
      ? PERSON_SOURCE
      : variableDraft.fieldType === "group_lookup"
        ? normalizeLookupSource(variableDraft.lookupSource || DEFAULT_LOOKUP_SOURCE)
        : undefined;

    const payload: CatalogVariablePayload = {
      label: variableDraft.label.trim(),
      fieldType: variableDraft.fieldType,
      sectionId: variableDraft.sectionId ? Number(variableDraft.sectionId) : undefined,
      isMandatory: variableDraft.isMandatory,
      isVisible: variableDraft.isVisible,
      readOnly: variableDraft.readOnly,
      defaultValue: variableDraft.defaultValue || undefined,
      placeholder: variableDraft.placeholder || undefined,
      helpText: variableDraft.helpText || undefined,
      minValue: variableDraft.minValue || undefined,
      maxValue: variableDraft.maxValue || undefined,
      validationRegex: variableDraft.validationRegex || undefined,
      dateMin: variableDraft.dateMin || undefined,
      dateMax: variableDraft.dateMax || undefined,
      allowedFileTypes: variableDraft.allowedFileTypes || undefined,
      maxFileSizeMb: variableDraft.maxFileSizeMb ? Number(variableDraft.maxFileSizeMb) : undefined,
      lookupSource: resolvedLookupSource,
      options: options ?? [],
      sortOrder: editingVariable?.sortOrder ?? variables.length,
    };
    const saved = await runCatalogAction(async () => {
      if (editingVariable) {
        await serviceRequestApi.updateVariable(catalog.catalogId, editingVariable.variableId, payload);
        if (!variableDraft.sectionId && editingVariable.section?.sectionId) {
          await serviceRequestApi.reorderVariables(catalog.catalogId, [{
            variableId: editingVariable.variableId,
            sortOrder: editingVariable.sortOrder,
            sectionId: null,
          }]);
        }
      } else {
        await serviceRequestApi.createVariable(catalog.catalogId, payload);
      }
    }, editingVariable ? "Form field updated." : "Form field added.");
    if (saved) resetVariableForm();
  };

  const moveVariable = async (variable: CatalogVariable, direction: -1 | 1) => {
    if (!catalog) return;
    const sameSection = variables.filter((entry) => (entry.section?.sectionId ?? null) === (variable.section?.sectionId ?? null));
    const index = sameSection.findIndex((entry) => entry.variableId === variable.variableId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sameSection.length) return;
    [sameSection[index], sameSection[target]] = [sameSection[target], sameSection[index]];
    const nextOrder = sameSection.map((entry, sortOrder) => ({
      variableId: entry.variableId,
      sortOrder,
      sectionId: entry.section?.sectionId ?? null,
    }));
    await runCatalogAction(() => serviceRequestApi.reorderVariables(catalog.catalogId, nextOrder));
  };

  const uploadAttachment = async (files: FileList | null) => {
    if (!catalog || !files?.length) return;
    setFileBusy("attachment");
    setError("");
    try {
      for (const file of Array.from(files)) {
        const uploaded = await serviceRequestApi.upload(file);
        await serviceRequestApi.createCatalogAttachment(catalog.catalogId, {
          fileName: uploaded.fileName,
          contentType: uploaded.contentType,
          size: uploaded.size,
          storagePath: uploaded.url,
        });
      }
      attachmentQuery.reload();
      setNotice("Attachment uploaded.");
    } catch (e) {
      setError(errMsg(e, "Unable to upload the attachment."));
    } finally {
      setFileBusy("");
    }
  };

  const uploadLabel = (kind: "iconUrl" | "bannerUrl", label: string) => (
    <div className="service-request-upload-control">
      {draft[kind] && <img src={imageUrl(draft[kind])} alt={label} />}
      <label className="btn-ghost btn-sm">
        <Upload size={13} /> {fileBusy === kind ? "Uploading…" : draft[kind] ? `Change ${label}` : `Upload ${label}`}
        <input type="file" accept="image/*" hidden disabled={!!fileBusy} onChange={(event) => { void uploadCatalogImage(kind, event.target.files?.[0]); event.currentTarget.value = ""; }} />
      </label>
      {draft[kind] && <button type="button" className="btn-ghost btn-sm" onClick={() => set(kind, "")}>Remove</button>}
    </div>
  );

  return (
    <div className="service-requests-page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">Administration / Service Catalog</div>
          <div className="page-title">{catalog ? `Edit: ${catalog.catalogName}` : "New Catalog Item"}</div>
          <div className="page-subtitle">Configure the catalog item, request form, visibility, workflow, and attachments.</div>
        </div>
        <button type="button" className="btn-ghost service-request-nav-button" onClick={onBack}><ArrowLeft size={14} /> Catalog list</button>
      </header>
      <div className="page-body service-requests-body admin-catalog-editor">
        {notice && <div className="service-request-notice" role="status">{notice}</div>}
        {error && <ErrorBar msg={error} />}
        {lookupErrors.map((message) => <ErrorBar key={message} msg={message} />)}
        <div className="admin-catalog-tabs" role="tablist" aria-label="Catalog editor sections">
          {TABS.map((item) => <button type="button" role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}
        </div>

        {tab === "Item details" && (
          <form className="admin-catalog-panel" onSubmit={(event) => void saveCatalog(event)}>
            <section className="card service-request-section">
              <div className="service-request-section-heading"><div><h2>Basic information</h2><p>Details shown to users in the service catalog.</p></div></div>
              <div className="service-request-fields two-column">
                <Field label="Catalog name *"><input className="input" required value={draft.catalogName} onChange={(event) => set("catalogName", event.target.value)} /></Field>
                <Field label="Catalog code"><input className="input" value={draft.catalogCode ?? ""} onChange={(event) => set("catalogCode", event.target.value)} /></Field>
                <Field label="Service category" wide><CategoryPicker categories={categories} value={draft.serviceCategoryId ?? null} onChange={(id) => set("serviceCategoryId", id)} /></Field>
                <Field label="Item type"><select className="select" value={draft.itemType ?? "Standard"} onChange={(event) => set("itemType", event.target.value)}>{["Standard", "Service", "Hardware", "Software", "Access"].map((type) => <option key={type}>{type}</option>)}</select></Field>
                <Field label="Short description"><input className="input" value={draft.shortDescription ?? ""} onChange={(event) => set("shortDescription", event.target.value)} /></Field>
                <Field label="Request type"><select className="select" value={draft.requestType ?? "Access"} onChange={(event) => set("requestType", event.target.value)}>{["Access", "Hardware", "Software", "Service", "Information", "Change"].map((type) => <option key={type}>{type}</option>)}</select></Field>
                <Field label="Detailed description" wide><textarea className="textarea" value={draft.description ?? ""} onChange={(event) => set("description", event.target.value)} /></Field>
                <Field label="Icon">{uploadLabel("iconUrl", "icon")}</Field>
                <Field label="Catalog banner">{uploadLabel("bannerUrl", "image")}</Field>
              </div>
              <div className="admin-catalog-toggle-row">
                <Toggle checked={!!draft.isActive} onChange={(value) => setDraft((current) => ({ ...current, isActive: value, status: value ? "published" : "draft" }))} label="Active in service catalog" />
                <Toggle checked={!!draft.allowRequestedFor} onChange={(value) => set("allowRequestedFor", value)} label="Allow requested-for selection" />
              </div>
            </section>

            <section className="card service-request-section">
              <div className="service-request-section-heading"><div><h2>Service and fulfillment</h2><p>Default routing, workflow, impact, urgency, and time estimates.</p></div></div>
              <div className="service-request-fields two-column">
                <Field label="Lifecycle"><select className="select" value={draft.workflowId ?? ""} onChange={(event) => set("workflowId", event.target.value ? Number(event.target.value) : null)}><option value="">No approval</option>{workflows.map((workflow) => <option key={workflow.workflowId} value={workflow.workflowId}>{workflow.workflowName}</option>)}</select></Field>
                <Field label="Fulfillment workflow"><select className="select" value={draft.fulfillmentWorkflowId ?? ""} onChange={(event) => set("fulfillmentWorkflowId", event.target.value ? Number(event.target.value) : null)}><option value="">No workflow</option>{workflows.map((workflow) => <option key={workflow.workflowId} value={workflow.workflowId}>{workflow.workflowName}</option>)}</select></Field>
                <Field label="Fulfillment group"><select className="select" value={draft.fulfillmentGroupId ?? ""} onChange={(event) => set("fulfillmentGroupId", event.target.value ? Number(event.target.value) : null)}><option value="">No group</option>{groups.map((group) => <option key={group.groupId} value={group.groupId}>{group.groupName}</option>)}</select></Field>
                <Field label="Assignment group"><select className="select" value={draft.assignmentGroupId ?? ""} onChange={(event) => set("assignmentGroupId", event.target.value ? Number(event.target.value) : null)}><option value="">No group</option>{groups.map((group) => <option key={group.groupId} value={group.groupId}>{group.groupName}</option>)}</select></Field>
                <Field label="Impact"><select className="select" value={draft.serviceImpactId ?? ""} onChange={(event) => set("serviceImpactId", event.target.value ? Number(event.target.value) : null)}><option value="">Select impact</option>{(serviceImpacts.data ?? []).map((impact) => <option key={impact.serviceImpactId} value={impact.serviceImpactId}>{impact.impactName}</option>)}</select></Field>
                <Field label="Est. cost ($)"><input className="input" type="number" min="0" step="0.01" value={draft.estimatedCost ?? ""} onChange={(event) => set("estimatedCost", event.target.value === "" ? undefined : Number(event.target.value))} /></Field>
                <Field label="Urgency"><select className="select" value={draft.urgencyId ?? ""} onChange={(event) => set("urgencyId", event.target.value ? Number(event.target.value) : null)}><option value="">Select urgency</option>{urgencies.map((urgency) => <option key={urgency.urgencyId} value={urgency.urgencyId}>{urgency.urgencyName}</option>)}</select></Field>
                <Field label="Priority"><select className="select" value={draft.priorityId ?? ""} onChange={(event) => set("priorityId", event.target.value ? Number(event.target.value) : null)}><option value="">Automatic — from the priority matrix</option>{priorities.map((priority) => <option key={priority.priorityId} value={priority.priorityId}>{priority.priorityName}</option>)}</select></Field>
                <Field label="Stage"><select className="select" value={draft.stage ?? "Production"} onChange={(event) => set("stage", event.target.value)}>{["Draft", "Testing", "Production", "Retired"].map((stage) => <option key={stage}>{stage}</option>)}</select></Field>
                <Field label="SLA name"><input className="input" value={draft.slaName ?? ""} onChange={(event) => set("slaName", event.target.value)} /></Field>
                <Field label="Estimated time (days)"><input className="input" type="number" min="0" value={draft.estimatedTime ?? ""} onChange={(event) => set("estimatedTime", event.target.value === "" ? undefined : Number(event.target.value))} /></Field>
                <Field label="Delivery SLA (working hours)"><input className="input" type="number" min="0" value={draft.deliveryTimeSla ?? ""} onChange={(event) => set("deliveryTimeSla", event.target.value === "" ? undefined : Number(event.target.value))} /></Field>
                <Field label="Approval policy"><input className="input" value={draft.approvalPolicy ?? ""} onChange={(event) => set("approvalPolicy", event.target.value)} /></Field>
              </div>
              <div className="admin-catalog-toggle-row">
                <Toggle checked={!!draft.approvalRequired} onChange={(value) => set("approvalRequired", value)} label="Approval required" />
                <Toggle checked={!!draft.hidePrice} onChange={(value) => set("hidePrice", value)} label="Hide price" />
              </div>
            </section>

            <section className="card service-request-section">
              <div className="service-request-section-heading"><div><h2>Service offering</h2></div></div>
              <div className="service-request-fields two-column">
                <Field label="Service offering"><input className="input" value={draft.serviceOffering ?? ""} onChange={(event) => set("serviceOffering", event.target.value)} /></Field>
                <Field label="Business service"><input className="input" value={draft.businessService ?? ""} onChange={(event) => set("businessService", event.target.value)} /></Field>
                <Field label="Configuration item"><input className="input" value={draft.configurationItem ?? ""} onChange={(event) => set("configurationItem", event.target.value)} /></Field>
              </div>
            </section>
            <div className="service-request-form-actions"><button type="submit" className="btn-primary" disabled={busy}><Save size={14} /> {busy ? "Saving…" : "Save item details"}</button></div>
          </form>
        )}

        {tab === "Form builder" && (
          <div className="admin-catalog-panel">
            {!catalog ? <section className="card service-request-section"><p className="service-request-help">Save the catalog item before adding sections and request form fields.</p><button type="button" className="btn-primary" disabled={busy || !draft.catalogName.trim()} onClick={() => void saveCatalog()}><Save size={14} /> Save catalog item</button></section> : <>
              <section className="card service-request-section">
                <div className="service-request-section-heading"><div><h2>Form settings</h2><p>Set the layout and behavior for requester forms.</p></div></div>
                <div className="admin-catalog-toggle-row">
                  <Toggle checked={!!draft.showSectionNumbers} onChange={(value) => set("showSectionNumbers", value)} label="Show section numbers" />
                  <Toggle checked={!!draft.showProgressIndicator} onChange={(value) => set("showProgressIndicator", value)} label="Show progress indicator" />
                  <Toggle checked={!!draft.collapseAllSections} onChange={(value) => set("collapseAllSections", value)} label="Collapse sections by default" />
                  <Toggle checked={!!draft.makeFieldsMandatory} onChange={(value) => set("makeFieldsMandatory", value)} label="Make new fields mandatory" />
                </div>
                <label className="service-request-field admin-catalog-layout"><span className="lbl">Form layout</span><select className="select" value={draft.formLayout ?? "single"} onChange={(event) => set("formLayout", event.target.value as "single" | "two-column")}><option value="single">Single column</option><option value="two-column">Two columns</option></select></label>
              </section>
              <section className="card service-request-section">
                <div className="service-request-section-heading"><div><h2>Form sections</h2><p>Organize variables into sections. Unassigned fields appear under General.</p></div></div>
                <form className="service-request-fields two-column admin-catalog-section-form" onSubmit={(event) => void saveSection(event)}>
                  <Field label="Section name"><input className="input" required value={sectionName} onChange={(event) => setSectionName(event.target.value)} /></Field>
                  <Field label="Section description"><input className="input" value={sectionDescription} onChange={(event) => setSectionDescription(event.target.value)} /></Field>
                  <div className="service-request-form-actions service-request-field-wide"><button className="btn-ghost" type="submit" disabled={busy || !sectionName.trim()}><Plus size={14} /> Add section</button></div>
                </form>
                <div className="service-request-section-list">
                  {sections.map((section, index) => <div key={section.sectionId}>
                    {editingSectionId === section.sectionId
                      ? <input className="input" value={editingSectionName} aria-label="Section name" onChange={(event) => setEditingSectionName(event.target.value)} />
                      : <span>{section.name}{section.description ? <small className="admin-catalog-section-description">{section.description}</small> : null}</span>}
                    <div className="service-request-row-actions">
                      {editingSectionId === section.sectionId
                        ? <><button type="button" className="btn-ghost btn-sm" onClick={() => void renameSection(section)}>Save</button><button type="button" className="btn-ghost btn-sm" onClick={() => setEditingSectionId(null)}>Cancel</button></>
                        : <><button type="button" className="btn-ghost btn-sm" title="Move section up" disabled={busy || index === 0} onClick={() => void reorderSections(section.sectionId, -1)}><ArrowUp size={13} /></button><button type="button" className="btn-ghost btn-sm" title="Move section down" disabled={busy || index === sections.length - 1} onClick={() => void reorderSections(section.sectionId, 1)}><ArrowDown size={13} /></button><button type="button" className="btn-ghost btn-sm" onClick={() => { setEditingSectionId(section.sectionId); setEditingSectionName(section.name); }}>Rename</button><button type="button" className="btn-danger btn-sm" onClick={() => { if (window.confirm(`Remove section "${section.name}"? Its fields will move to General.`)) void runCatalogAction(() => serviceRequestApi.deleteSection(catalog.catalogId, section.sectionId), "Section removed."); }}><Trash2 size={13} /></button></>}
                    </div>
                  </div>)}
                  {!sections.length && <p className="service-request-help">No sections yet.</p>}
                </div>
              </section>
              <section className="card service-request-section">
                <div className="service-request-section-heading"><div><h2>Request form fields</h2><p>Add the inputs requesters need to submit this service request.</p></div></div>
                {variables.length > 0 && <div className="service-request-table-wrap"><table className="service-request-table">
                  <thead><tr><th>Field</th><th>Type</th><th>Section</th><th>Required</th><th>Visibility</th><th>Order</th><th>Actions</th></tr></thead>
                  <tbody>{variables.map((variable) => <tr key={variable.variableId}>
                    <td>{variable.label}</td>
                    <td>{variable.fieldType === "user_lookup" ? "Person (User table)" : variable.fieldType === "group_lookup" ? `Lookup: ${lookupSourceLabel(variable.lookupSource)}` : FIELD_TYPE_LABELS[variable.fieldType] ?? variable.fieldType.replace("_", " ")}</td>
                    <td>{variable.section?.name || variable.sectionName || "General"}</td>
                    <td>{variable.isMandatory ? "Yes" : "No"}</td>
                    <td>{variable.isVisible ? "Visible" : "Hidden"}</td>
                    <td><div className="service-request-row-actions"><button type="button" className="btn-ghost btn-sm" title="Move field up" disabled={busy} onClick={() => void moveVariable(variable, -1)}><ArrowUp size={13} /></button><button type="button" className="btn-ghost btn-sm" title="Move field down" disabled={busy} onClick={() => void moveVariable(variable, 1)}><ArrowDown size={13} /></button></div></td>
                    <td><div className="service-request-row-actions"><button type="button" className="btn-ghost btn-sm" onClick={() => editVariable(variable)}>Edit</button><button type="button" className="btn-danger btn-sm" disabled={busy} onClick={() => { if (window.confirm(`Remove field "${variable.label}"?`)) void runCatalogAction(() => serviceRequestApi.deleteVariable(catalog.catalogId, variable.variableId), "Form field removed."); }}><Trash2 size={13} /> Remove</button></div></td>
                  </tr>)}</tbody>
                </table></div>}
                <form className="service-request-admin-field-form" onSubmit={(event) => void saveVariable(event)}>
                  <h3>{editingVariable ? `Edit "${editingVariable.label}"` : "Add a field"}</h3>
                  <div className="service-request-fields two-column">
                    <Field label="Field label *"><input className="input" required value={variableDraft.label} onChange={(event) => setVariableDraft((form) => ({ ...form, label: event.target.value }))} /></Field>
                    <Field label="Field type">
                      <select
                        className="select"
                        value={variableDraft.fieldType}
                        onChange={(event) => {
                          const nextType = event.target.value as CatalogFieldType;
                          setVariableDraft((form) => ({
                            ...form,
                            fieldType: nextType,
                            lookupSource: nextType === "user_lookup" ? PERSON_SOURCE : nextType === "group_lookup" ? (form.lookupSource ? normalizeLookupSource(form.lookupSource) : DEFAULT_LOOKUP_SOURCE) : form.lookupSource,
                          }));
                        }}
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {FIELD_TYPE_LABELS[type] ?? type.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Section"><select className="select" value={variableDraft.sectionId} onChange={(event) => setVariableDraft((form) => ({ ...form, sectionId: event.target.value }))}><option value="">General</option>{sections.map((section) => <option key={section.sectionId} value={section.sectionId}>{section.name}</option>)}</select></Field>
                    <Field label="Default value"><input className="input" value={variableDraft.defaultValue} onChange={(event) => setVariableDraft((form) => ({ ...form, defaultValue: event.target.value }))} /></Field>
                    <Field label="Placeholder"><input className="input" value={variableDraft.placeholder} onChange={(event) => setVariableDraft((form) => ({ ...form, placeholder: event.target.value }))} /></Field>
                    <Field label="Help text"><input className="input" value={variableDraft.helpText} onChange={(event) => setVariableDraft((form) => ({ ...form, helpText: event.target.value }))} /></Field>
                    {variableDraft.fieldType === "number" && <><Field label="Minimum value"><input className="input" type="number" value={variableDraft.minValue} onChange={(event) => setVariableDraft((form) => ({ ...form, minValue: event.target.value }))} /></Field><Field label="Maximum value"><input className="input" type="number" value={variableDraft.maxValue} onChange={(event) => setVariableDraft((form) => ({ ...form, maxValue: event.target.value }))} /></Field></>}
                    {["text", "textarea"].includes(variableDraft.fieldType) && <Field label="Validation regex"><input className="input" value={variableDraft.validationRegex} onChange={(event) => setVariableDraft((form) => ({ ...form, validationRegex: event.target.value }))} /></Field>}
                    {["date", "datetime"].includes(variableDraft.fieldType) && <><Field label="Minimum date"><input className="input" type="date" value={variableDraft.dateMin} onChange={(event) => setVariableDraft((form) => ({ ...form, dateMin: event.target.value }))} /></Field><Field label="Maximum date"><input className="input" type="date" value={variableDraft.dateMax} onChange={(event) => setVariableDraft((form) => ({ ...form, dateMax: event.target.value }))} /></Field></>}
                    {variableDraft.fieldType === "attachment" && <><Field label="Allowed file types"><input className="input" placeholder=".pdf,.png,.jpg" value={variableDraft.allowedFileTypes} onChange={(event) => setVariableDraft((form) => ({ ...form, allowedFileTypes: event.target.value }))} /></Field><Field label="Maximum file size (MB)"><input className="input" type="number" min="1" value={variableDraft.maxFileSizeMb} onChange={(event) => setVariableDraft((form) => ({ ...form, maxFileSizeMb: event.target.value }))} /></Field></>}
                    {variableDraft.fieldType === "user_lookup" && (
                      <div className="service-request-field">
                        <span className="lbl">Source table</span>
                        <div style={{ fontSize: 13, color: "#1D2939", padding: "8px 12px", background: "#F2F4F7", borderRadius: 6 }}>
                          <strong>User table</strong> — Requesters search and select people from the User directory (name, email, employee ID).
                        </div>
                      </div>
                    )}
                    {variableDraft.fieldType === "group_lookup" && (
                      <Field label="Source table *">
                        <select
                          className="select"
                          required
                          value={variableDraft.lookupSource ? normalizeLookupSource(variableDraft.lookupSource) : DEFAULT_LOOKUP_SOURCE}
                          onChange={(event) => setVariableDraft((form) => ({ ...form, lookupSource: event.target.value }))}
                        >
                          {LOOKUP_SOURCES.map((source) => (
                            <option key={source.key} value={source.key}>
                              {source.label}
                            </option>
                          ))}
                        </select>
                        <span style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, display: "block" }}>
                          Values are picked from this table (Location, Department, Email, etc.).
                        </span>
                      </Field>
                    )}
                    {OPTION_FIELDS.includes(variableDraft.fieldType) && <Field label="Options (one per line: Label|value)" wide><textarea className="textarea" required value={variableDraft.optionsText} onChange={(event) => setVariableDraft((form) => ({ ...form, optionsText: event.target.value }))} /></Field>}
                    <div className="admin-catalog-toggle-row service-request-field-wide">
                      <Toggle checked={variableDraft.isMandatory} onChange={(value) => setVariableDraft((form) => ({ ...form, isMandatory: value }))} label="Required" />
                      <Toggle checked={variableDraft.isVisible} onChange={(value) => setVariableDraft((form) => ({ ...form, isVisible: value }))} label="Visible" />
                      <Toggle checked={variableDraft.readOnly} onChange={(value) => setVariableDraft((form) => ({ ...form, readOnly: value }))} label="Read only" />
                    </div>
                  </div>
                  <div className="service-request-form-actions">
                    {editingVariable && <button type="button" className="btn-ghost" onClick={resetVariableForm}>Cancel edit</button>}
                    <button type="submit" className="btn-primary" disabled={busy}><Save size={14} /> {busy ? "Saving…" : editingVariable ? "Update field" : "Add field"}</button>
                  </div>
                </form>
              </section>
            </>}
          </div>
        )}

        {tab === "Preview" && (
          <section className="card service-request-section admin-catalog-preview">
            <div className="service-request-catalog-title">
              <h3>{draft.catalogName || "New catalog item"}</h3>
              <p>{draft.shortDescription || "No short description provided."}</p>
            </div>
            {draft.iconUrl && <img className="admin-catalog-preview-icon" src={imageUrl(draft.iconUrl)} alt="" />}
            {draft.bannerUrl && <img className="admin-catalog-preview-banner" src={imageUrl(draft.bannerUrl)} alt="" />}
            {draft.description && <p className="admin-catalog-preview-description">{draft.description}</p>}
            <p className="service-request-help">Category: {categories.find((category) => category.serviceCategoryId === draft.serviceCategoryId)?.categoryName ?? "Uncategorized"} · Request type: {draft.requestType ?? "Service"}</p>
            {variables.filter((variable) => variable.isActive && variable.isVisible).length
              ? <div className="service-request-form-content">{sections.map((section) => {
                const fields = variables.filter((variable) => variable.isActive && variable.isVisible && variable.section?.sectionId === section.sectionId);
                if (!fields.length) return null;
                return <fieldset className="service-request-form-section" key={section.sectionId}><legend>{section.name}</legend>{fields.map((variable) => <PreviewVariable key={variable.variableId} variable={variable} />)}</fieldset>;
              })}
                {variables.filter((variable) => variable.isActive && variable.isVisible && !variable.section?.sectionId).length > 0 && <fieldset className="service-request-form-section"><legend>General</legend>{variables.filter((variable) => variable.isActive && variable.isVisible && !variable.section?.sectionId).map((variable) => <PreviewVariable key={variable.variableId} variable={variable} />)}</fieldset>}
              </div>
              : <p className="service-request-help">Add visible fields in Form builder to preview the request form.</p>}
          </section>
        )}

        {tab === "Additional info" && (
          <div className="admin-catalog-panel">
            <section className="card service-request-section">
              <div className="service-request-section-heading"><div><h2>Visibility and availability</h2><p>Control where the item appears and who can request it.</p></div></div>
              <div className="service-request-fields two-column">
                <Field label="Visible to"><select className="select" value={draft.visibleTo ?? "All Users"} onChange={(event) => set("visibleTo", event.target.value)}><option>All Users</option><option>Specific User Groups</option><option>Specific Users</option></select></Field>
                <Field label="Publication status"><select className="select" value={draft.status ?? "published"} onChange={(event) => { const status = event.target.value as CatalogPayload["status"]; setDraft((current) => ({ ...current, status, isActive: status === "published" })); }}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></Field>
                <Field label="User groups (comma separated)"><input className="input" value={(draft.userGroups ?? []).join(", ")} onChange={(event) => setList("userGroups", event.target.value)} /></Field>
                <Field label="Departments (comma separated)"><input className="input" value={(draft.departments ?? []).join(", ")} onChange={(event) => setList("departments", event.target.value)} /></Field>
                <Field label="Locations (comma separated)"><input className="input" value={(draft.locations ?? []).join(", ")} onChange={(event) => setList("locations", event.target.value)} /></Field>
                <Field label="Tags (comma separated)"><input className="input" value={(draft.tags ?? []).join(", ")} onChange={(event) => setList("tags", event.target.value)} /></Field>
                <Field label="Search keywords"><input className="input" value={draft.keywords ?? ""} onChange={(event) => set("keywords", event.target.value)} /></Field>
                <Field label="Tile color"><input className="input" type="color" value={draft.tileColor || "#2563EB"} onChange={(event) => set("tileColor", event.target.value)} /></Field>
              </div>
              <div className="admin-catalog-toggle-row">
                <Toggle checked={!!draft.availableInPortal} onChange={(value) => set("availableInPortal", value)} label="Available in service portal" />
                <Toggle checked={!!draft.availableInMobile} onChange={(value) => set("availableInMobile", value)} label="Available in mobile app" />
                <Toggle checked={!!draft.showInCatalog} onChange={(value) => set("showInCatalog", value)} label="Show in catalog" />
                <Toggle checked={!!draft.showInPopular} onChange={(value) => set("showInPopular", value)} label="Show in popular items" />
                <Toggle checked={!!draft.allowRequestsForOthers} onChange={(value) => set("allowRequestsForOthers", value)} label="Allow requests for others" />
                <Toggle checked={!!draft.requiresApprovalFor} onChange={(value) => set("requiresApprovalFor", value)} label="Requires requested-for person" />
                <Toggle checked={!!draft.enableDiscussion} onChange={(value) => set("enableDiscussion", value)} label="Enable discussion" />
              </div>
            </section>
            <section className="card service-request-section">
              <div className="service-request-section-heading"><div><h2>Catalog attachments</h2><p>Files attached to this catalog item.</p></div></div>
              {!catalog ? <p className="service-request-help">Save the catalog item before attaching files.</p> : <>
                {attachmentQuery.error && <><ErrorBar msg={attachmentQuery.error} /><button type="button" className="btn-ghost" onClick={attachmentQuery.reload}>Retry</button></>}
                <label className="btn-ghost admin-catalog-attachment-upload"><Upload size={14} /> {fileBusy === "attachment" ? "Uploading…" : "Upload files"}<input type="file" multiple hidden disabled={!!fileBusy} onChange={(event) => { void uploadAttachment(event.target.files); event.currentTarget.value = ""; }} /></label>
                <div className="admin-catalog-attachments">
                  {(attachmentQuery.data ?? []).map((attachment) => <div key={attachment.attachmentId}><FileText size={15} /><span>{attachment.fileName}<small>{formatBytes(attachment.size)} · {new Date(attachment.createdAt).toLocaleDateString()}</small></span><a href={imageUrl(attachment.storagePath)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Open</a><button type="button" className="btn-danger btn-sm" disabled={busy} onClick={() => { if (window.confirm(`Remove "${attachment.fileName}"?`)) void runCatalogAction(async () => { await serviceRequestApi.deleteCatalogAttachment(catalog.catalogId, attachment.attachmentId); attachmentQuery.reload(); }, "Attachment removed."); }}><Trash2 size={13} /></button></div>)}
                  {!attachmentQuery.loading && !(attachmentQuery.data ?? []).length && <p className="service-request-help">No attachments yet.</p>}
                </div>
              </>}
            </section>
          </div>
        )}
        <div className="service-request-form-actions admin-catalog-save-actions">
          <button type="button" className="btn-ghost" onClick={onBack} disabled={busy}>Cancel</button>
          {tab !== "Preview" && <button type="button" className="btn-ghost" onClick={() => setTab("Preview")} disabled={busy}><Eye size={14} /> Preview form</button>}
          <button type="button" className="btn-primary" onClick={() => void saveCatalog()} disabled={busy || !draft.catalogName.trim()}><Save size={14} /> {busy ? "Saving…" : catalog ? "Save changes" : "Save catalog item"}</button>
        </div>
      </div>
    </div>
  );
}

function PreviewVariable({ variable }: { variable: CatalogVariable }) {
  const isPerson = variable.fieldType === "user_lookup";
  const isLookup = variable.fieldType === "group_lookup";
  const [lookupValue, setLookupValue] = useState("");
  const lookupSource = isPerson ? PERSON_SOURCE : normalizeLookupSource(variable.lookupSource);
  return <label className="service-request-field admin-catalog-preview-field"><span className="lbl">{variable.label}{variable.isMandatory && <span className="req"> *</span>}</span>
    {variable.fieldType === "info"
      ? <div className="service-request-info">{variable.helpText || variable.defaultValue || "Information"}</div>
      : isPerson
        ? <LookupField source={lookupSource} value={lookupValue} label={lookupValue} onSelect={(option) => setLookupValue(option?.value ?? "")} placeholder={variable.placeholder || "Select a person (User table)…"} ariaLabel={variable.label} />
        : isLookup
          ? <LookupField source={lookupSource} value={lookupValue} label={lookupValue} onSelect={(option) => setLookupValue(option?.value ?? "")} placeholder={variable.placeholder || `Select from ${lookupSourceLabel(lookupSource)} table…`} ariaLabel={variable.label} />
          : <input className="input" disabled placeholder={variable.placeholder || FIELD_TYPE_LABELS[variable.fieldType] || variable.fieldType.replace("_", " ")} />}
    {variable.helpText && variable.fieldType !== "info" && <span className="service-request-help">{variable.helpText}</span>}
  </label>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminCatalogsPage() {
  const catalogsQuery = useAsync(() => serviceRequestApi.allCatalogs(), []);
  const categoriesQuery = useAsync(() => serviceRequestApi.serviceCategories(), []);
  const workflowsQuery = useAsync(() => serviceRequestApi.workflows(), []);
  const groupsQuery = useAsync(() => serviceRequestApi.assignmentGroups(), []);
  const prioritiesQuery = useAsync(() => serviceRequestApi.priorities(), []);
  const impactsQuery = useAsync(() => serviceRequestApi.impacts(), []);
  const urgenciesQuery = useAsync(() => serviceRequestApi.urgencies(), []);
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);
  const [creatingCatalog, setCreatingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const catalogQuery = useAsync(() => selectedCatalogId ? serviceRequestApi.catalog(selectedCatalogId) : Promise.resolve(null), [selectedCatalogId]);
  const lookupErrors = [
    categoriesQuery.error && `Service categories could not be loaded: ${categoriesQuery.error}`,
    workflowsQuery.error && `Workflows could not be loaded: ${workflowsQuery.error}`,
    groupsQuery.error && `Assignment groups could not be loaded: ${groupsQuery.error}`,
    prioritiesQuery.error && `Priorities could not be loaded: ${prioritiesQuery.error}`,
    impactsQuery.error && `Impacts could not be loaded: ${impactsQuery.error}`,
    urgenciesQuery.error && `Urgencies could not be loaded: ${urgenciesQuery.error}`,
  ].filter((message): message is string => Boolean(message));

  const backToList = () => {
    setSelectedCatalogId(null);
    setCreatingCatalog(false);
    setError("");
  };
  const visibleCatalogs = (catalogsQuery.data ?? []).filter((item) =>
    `${item.catalogName} ${item.shortDescription ?? ""}`.toLowerCase().includes(catalogSearch.trim().toLowerCase()),
  );

  const removeCatalog = async (item: ServiceCatalog) => {
    if (!window.confirm(`Delete "${item.catalogName}" and its form fields?`)) return;
    setBusy(true);
    setError("");
    try {
      await serviceRequestApi.deleteCatalog(item.catalogId);
      catalogsQuery.reload();
    } catch (e) {
      setError(errMsg(e, "Unable to delete this catalog item. Existing requests may still reference it."));
    } finally {
      setBusy(false);
    }
  };

  if (creatingCatalog || selectedCatalogId !== null) {
    if (selectedCatalogId !== null && catalogQuery.loading && catalogQuery.data?.catalogId !== selectedCatalogId) {
      return <div className="service-requests-page"><div className="spinner-row">Loading catalog item…</div></div>;
    }
    if (selectedCatalogId !== null && (catalogQuery.error || !catalogQuery.data)) {
      return <div className="service-requests-page"><div className="page-body service-requests-body"><ErrorBar msg={catalogQuery.error || "Catalog item not found."} /><button type="button" className="btn-ghost" onClick={backToList}><ArrowLeft size={14} /> Catalog list</button></div></div>;
    }
    return <CatalogEditor
      key={selectedCatalogId ?? "new-catalog"}
      catalog={catalogQuery.data}
      categories={categoriesQuery.data ?? []}
      workflows={workflowsQuery.data ?? []}
      groups={groupsQuery.data ?? []}
      priorities={prioritiesQuery.data ?? []}
      urgencies={urgenciesQuery.data ?? []}
      lookupErrors={lookupErrors}
      busy={busy}
      onBack={backToList}
      onCreated={(catalogId) => { setSelectedCatalogId(catalogId); setCreatingCatalog(false); catalogsQuery.reload(); }}
      onBusyChange={setBusy}
      onCatalogsChanged={() => { catalogsQuery.reload(); if (selectedCatalogId) catalogQuery.reload(); }}
    />;
  }

  return (
    <div className="service-requests-page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">Administration</div>
          <div className="page-title">Service Catalog Management</div>
          <div className="page-subtitle">Manage catalog items and build their requester forms, workflows, and availability.</div>
        </div>
        <button type="button" className="btn-primary service-request-nav-button" onClick={() => { setCreatingCatalog(true); setError(""); }}><Plus size={14} /> Add catalog item</button>
      </header>
      <div className="page-body service-requests-body">
        {error && <ErrorBar msg={error} />}
        {categoriesQuery.error && <ErrorBar msg={`Service categories could not be loaded: ${categoriesQuery.error}`} />}
        {workflowsQuery.error && <ErrorBar msg={`Workflows could not be loaded: ${workflowsQuery.error}`} />}
        {groupsQuery.error && <ErrorBar msg={`Assignment groups could not be loaded: ${groupsQuery.error}`} />}
        {prioritiesQuery.error && <ErrorBar msg={`Priorities could not be loaded: ${prioritiesQuery.error}`} />}
        {impactsQuery.error && <ErrorBar msg={`Impacts could not be loaded: ${impactsQuery.error}`} />}
        {urgenciesQuery.error && <ErrorBar msg={`Urgencies could not be loaded: ${urgenciesQuery.error}`} />}
        <section className="card service-request-section">
          {catalogsQuery.error && <><ErrorBar msg={catalogsQuery.error} /><button type="button" className="btn-ghost" onClick={catalogsQuery.reload}>Retry</button></>}
          {catalogsQuery.loading && !catalogsQuery.data && <div className="spinner-row">Loading catalog items…</div>}
          {catalogsQuery.data && catalogsQuery.data.length === 0 && <div className="empty-state">No catalog items yet. Create one to add services to the requester portal.</div>}
          {catalogsQuery.data && catalogsQuery.data.length > 0 && <>
            <div className="admin-catalog-list-filters"><input className="input" type="search" aria-label="Search catalog items" placeholder="Search catalog items…" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} /><span>{visibleCatalogs.length} of {catalogsQuery.data.length} items</span></div>
            {!visibleCatalogs.length
              ? <div className="empty-state">No catalog items match your search.</div>
              : <div className="service-request-table-wrap">
              <table className="service-request-table">
                <thead><tr><th>Catalog item</th><th>Category</th><th>Workflow</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>{visibleCatalogs.map((item) => <tr key={item.catalogId}>
                <td><button type="button" className="service-request-table-link" onClick={() => setSelectedCatalogId(item.catalogId)}>{item.catalogName}</button><div className="service-request-help">{item.shortDescription}</div></td>
                <td>{item.serviceCategory?.categoryName || item.category?.categoryName || "Uncategorized"}</td>
                <td>{item.workflow?.workflowName ?? "None"}</td>
                <td><span className={`service-request-status ${item.isActive ? "approved" : "closed"}`}>{item.isActive ? "Active" : "Inactive"}</span></td>
                <td><div className="service-request-row-actions"><button type="button" className="btn-ghost btn-sm" onClick={() => setSelectedCatalogId(item.catalogId)}><Pencil size={13} /> Edit</button><button type="button" className="btn-danger btn-sm" disabled={busy} onClick={() => void removeCatalog(item)}><Trash2 size={13} /> Delete</button></div></td>
              </tr>)}</tbody>
            </table>
          </div>}
        </>}
        </section>
      </div>
    </div>
  );
}

/** Pick a category level by level (up to five levels), so the item can sit under a category at any level. */
function CategoryPicker({ categories, value, onChange }: { categories: ServiceCatalogCategory[]; value: number | null; onChange: (id: number | null) => void }) {
  const byId = new Map(categories.map((c) => [c.serviceCategoryId, c]));
  const chain: ServiceCatalogCategory[] = [];
  for (let cur = value ? byId.get(value) : undefined; cur && chain.length < 6; cur = cur.parentCategoryId ? byId.get(cur.parentCategoryId) : undefined) chain.unshift(cur);
  const childrenOf = (parent: number | null) => categories.filter((c) => (c.parentCategoryId ?? null) === parent);
  const levels = [...chain.map((c) => c.parentCategoryId ?? null), chain.length ? chain[chain.length - 1].serviceCategoryId : null];
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {levels.map((parent, i) => {
        const options = childrenOf(parent);
        if (!options.length && i > 0) return null;
        return (
          <select key={i} className="select" aria-label={`Category level ${i + 1}`} value={chain[i]?.serviceCategoryId ?? ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : (chain[i - 1]?.serviceCategoryId ?? null))}>
            <option value="">{i === 0 ? "Uncategorized" : `Stay at ${chain[i - 1]?.categoryName ?? "level " + i}`}</option>
            {options.map((c) => <option key={c.serviceCategoryId} value={c.serviceCategoryId}>{c.categoryName}{c.isActive === false ? " (inactive)" : ""}</option>)}
          </select>
        );
      })}
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{chain.length ? chain.map((c) => c.categoryName).join(" › ") : "Pick a category, then a sub-category if you want to go deeper."} · <Link to="/config/admin/service-category">Manage categories</Link></div>
    </div>
  );
}
