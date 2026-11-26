import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, GripVertical, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { assetUrl } from "../api";
import { BrowsePicker, type BrowseNode } from "../components/BrowsePicker";
import {
  LOOKUP_SOURCES,
  PERSON_SOURCE,
  DEFAULT_LOOKUP_SOURCE,
  isLookupSource,
  lookupSourceLabel,
  normalizeLookupSource,
} from "../lookupSources";
import { LookupField } from "../components/LookupField";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, TH, errMsg } from "../components/configKit";
import { serviceRequestApi, type CatalogFieldType, type CatalogVariablePayload, type ServiceCatalog } from "../requestsApi";
import { Link } from "../router";

/** The rules and default a field carries when it is saved. Only the ones that apply to its type are sent. */
function fieldRules(f: DField): Partial<CatalogVariablePayload> {
  const t = f.fieldType; const out: Partial<CatalogVariablePayload> = {};
  if (["text", "textarea", "number", "date", "datetime", "dropdown", "radio", "checkbox"].includes(t)) out.defaultValue = (f.defaultValue ?? "").trim();
  if (t === "text" || t === "textarea") out.maxLength = Number(f.maxLength) > 0 ? Math.min(4000, Math.round(Number(f.maxLength))) : undefined;
  if (t === "number") { out.minValue = (f.minValue ?? "").trim(); out.maxValue = (f.maxValue ?? "").trim(); out.onlyIntegers = !!f.onlyIntegers; }
  if (t === "date" || t === "datetime") out.noPastDates = !!f.noPastDates;
  if (t === "attachment") out.allowedFileTypes = (f.allowedFileTypes ?? "").trim();
  return out;
}

/* ---------- draft model ---------- */
interface DField { key: string; variableId?: number; label: string; fieldType: CatalogFieldType; isMandatory: boolean; helpText: string; placeholder: string; options: string[]; lookupSource: string; defaultValue?: string; minValue?: string; maxValue?: string; onlyIntegers?: boolean; noPastDates?: boolean; maxLength?: string; allowedFileTypes?: string }
interface DBox { key: string; sectionId?: number; title: string; cols: 1 | 2 | 3; newPage?: boolean; fields: DField[] }
interface Basics { name: string; shortDescription: string; categoryId: string; workflowId: string; groupId: string; cost: string; days: string; iconUrl: string; tileColor: string; urgency: string; impact: string; priorityId: string }
type Drag = { kind: "palette"; type: CatalogFieldType } | { kind: "field"; key: string } | { kind: "box"; cols: 1 | 2 | 3 } | null;

const PALETTE: { group: string; items: { type: CatalogFieldType; label: string }[] }[] = [
  { group: "Text", items: [{ type: "text", label: "Single-line text" }, { type: "textarea", label: "Paragraph" }, { type: "text", label: "Email" }, { type: "text", label: "Link" }, { type: "number", label: "Phone number" }] },
  { group: "Date & Time", items: [{ type: "date", label: "Date" }, { type: "datetime", label: "Date & Time" }] },
  { group: "Choice", items: [{ type: "dropdown", label: "Dropdown" }, { type: "radio", label: "Radio buttons" }, { type: "checkbox", label: "Yes / No" }, { type: "checkbox", label: "Checkbox" }, { type: "multi_select", label: "Checkbox group" }, { type: "user_lookup", label: "Person" }, { type: "group_lookup", label: "Lookup" }] },
];
const TYPE_LABEL: Record<string, string> = {
  text: "Single-line text", textarea: "Paragraph", number: "Number", dropdown: "Dropdown", radio: "Radio buttons", checkbox: "Checkbox", multi_select: "Checkbox group", user_lookup: "Person", group_lookup: "Lookup", date: "Date", datetime: "Date & Time", attachment: "Attachment", info: "Info box",
};
const HAS_OPTIONS: CatalogFieldType[] = ["dropdown", "multi_select", "radio"];
const BOXES: { cols: 1 | 2 | 3; label: string }[] = [{ cols: 1, label: "1 column" }, { cols: 2, label: "2 columns" }, { cols: 3, label: "3 columns" }];
const COLS_RE = /^\[cols:(\d)\]/;
const PAGE_RE = /\[page\]/;

let seq = 0;
const nk = () => `k${Date.now()}_${seq++}`;
const newField = (type: CatalogFieldType): DField => ({
  key: nk(),
  label: TYPE_LABEL[type] ?? type,
  fieldType: type,
  isMandatory: false,
  helpText: "",
  placeholder: "",
  defaultValue: "",
  options: HAS_OPTIONS.includes(type) ? ["Option 1", "Option 2"] : [],
  lookupSource: type === "user_lookup" ? PERSON_SOURCE : type === "group_lookup" ? DEFAULT_LOOKUP_SOURCE : "",
});
const newBox = (cols: 1 | 2 | 3 = 1, title = "New container"): DBox => ({ key: nk(), title, cols, fields: [] });
const blankBasics: Basics = { name: "", shortDescription: "", categoryId: "", workflowId: "", groupId: "", cost: "", days: "", iconUrl: "", tileColor: "", urgency: "", impact: "", priorityId: "" };
const MAX_IMAGE_MB = 5;

function toDraft(c: ServiceCatalog): { basics: Basics; boxes: DBox[] } {
  const sections = [...(c.sections ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const vars = [...(c.variables ?? [])].filter((v) => v.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder);
  const toField = (v: (typeof vars)[number]): DField => ({
    key: nk(),
    variableId: v.variableId,
    label: v.label,
    fieldType: v.fieldType,
    isMandatory: v.isMandatory,
    helpText: v.helpText ?? "",
    placeholder: v.placeholder ?? "",
    defaultValue: v.defaultValue ?? "",
    minValue: v.minValue ?? "", maxValue: v.maxValue ?? "", onlyIntegers: !!v.onlyIntegers, noPastDates: !!v.noPastDates, maxLength: v.maxLength ? String(v.maxLength) : "", allowedFileTypes: v.allowedFileTypes ?? "",
    options: (v.options ?? []).sort((a, b) => a.sortOrder - b.sortOrder).map((o) => o.optionLabel),
    lookupSource: v.fieldType === "user_lookup" ? PERSON_SOURCE : v.fieldType === "group_lookup" ? normalizeLookupSource(v.lookupSource) : "",
  });
  const boxes: DBox[] = sections.map((s) => {
    const m = COLS_RE.exec(s.description ?? "");
    const cols = (m ? Math.min(3, Math.max(1, Number(m[1]))) : 1) as 1 | 2 | 3;
    return { key: nk(), sectionId: s.sectionId, title: s.name, cols, newPage: PAGE_RE.test(s.description ?? ""), fields: vars.filter((v) => (v.section?.sectionId ?? null) === s.sectionId).map(toField) };
  });
  const loose = vars.filter((v) => !v.section?.sectionId || !sections.some((s) => s.sectionId === v.section?.sectionId));
  if (loose.length) boxes.unshift({ ...newBox(1, "Details"), fields: loose.map(toField) });
  return {
    basics: { name: c.catalogName, shortDescription: c.shortDescription ?? "", categoryId: c.serviceCategory?.serviceCategoryId ? String(c.serviceCategory.serviceCategoryId) : "", workflowId: c.workflowId ? String(c.workflowId) : c.workflow?.workflowId ? String(c.workflow.workflowId) : "", groupId: c.fulfillmentGroupId ? String(c.fulfillmentGroupId) : c.fulfillmentGroup?.groupId ? String(c.fulfillmentGroup.groupId) : "", cost: c.estimatedCost != null ? String(c.estimatedCost) : "", days: c.deliveryTimeSla != null ? String(c.deliveryTimeSla) : "", iconUrl: c.iconUrl ?? "", tileColor: c.tileColor ?? "", urgency: c.urgency?.urgencyId ? String(c.urgency.urgencyId) : "", impact: c.serviceImpact?.serviceImpactId ? String(c.serviceImpact.serviceImpactId) : "", priorityId: c.priority?.priorityId ? String(c.priority.priorityId) : "" },
    boxes: boxes.length ? boxes : [newBox(1, "Details")],
  };
}

function validate(b: Basics, boxes: DBox[], publish: boolean): string {
  if (!b.name.trim()) return "Give the catalog item a name.";
  if (!b.categoryId) return "Select a category. It is mandatory.";
  if (publish && boxes.every((x) => x.fields.length === 0)) return "Add at least one field before publishing.";
  for (const box of boxes) {
    if (!box.title.trim()) return "Every container needs a title.";
    for (const f of box.fields) {
      if (!f.label.trim()) return `A field in "${box.title}" has no label.`;
      if (HAS_OPTIONS.includes(f.fieldType) && f.options.filter((o) => o.trim()).length < 2) return `"${f.label}" needs at least two options.`;
      if (f.fieldType === "group_lookup" && !isLookupSource(normalizeLookupSource(f.lookupSource))) return `"${f.label}" needs a source table. Open the field and choose where its values come from.`;
    }
  }
  return "";
}

async function persist(id: number | null, b: Basics, boxes: DBox[], status: "draft" | "published", before: ServiceCatalog | null): Promise<number> {
  const payload = {
    catalogName: b.name.trim(), shortDescription: b.shortDescription.trim() || undefined,
    serviceCategoryId: b.categoryId ? Number(b.categoryId) : null, workflowId: b.workflowId ? Number(b.workflowId) : null,
    fulfillmentGroupId: b.groupId ? Number(b.groupId) : null, assignmentGroupId: b.groupId ? Number(b.groupId) : null,
    ...(b.cost.trim() && !Number.isNaN(Number(b.cost)) ? { estimatedCost: Number(b.cost) } : {}),
    ...(b.days.trim() && !Number.isNaN(Number(b.days)) ? { deliveryTimeSla: Number(b.days) } : {}),
    priorityId: b.priorityId ? Number(b.priorityId) : null,
    iconUrl: b.iconUrl || undefined, tileColor: b.tileColor || undefined,
    ...(b.urgency ? { urgencyId: Number(b.urgency) } : {}), ...(b.impact ? { serviceImpactId: Number(b.impact) } : {}),
    status, isActive: status === "published", showInCatalog: status === "published",
    formLayout: boxes.some((x) => x.cols > 1) ? ("two-column" as const) : ("single" as const),
  };
  const catalogId = id ?? (await serviceRequestApi.createCatalog(payload)).catalogId;
  if (id) await serviceRequestApi.updateCatalog(id, payload);
  const keepVars = new Set(boxes.flatMap((x) => x.fields.map((f) => f.variableId).filter(Boolean)));
  for (const v of before?.variables ?? []) if (!keepVars.has(v.variableId)) await serviceRequestApi.deleteVariable(catalogId, v.variableId);
  let sort = 0;
  for (const [bi, box] of boxes.entries()) {
    const body = { name: box.title.trim(), description: `[cols:${box.cols}]${box.newPage && bi > 0 ? "[page]" : ""}`, displayOrder: bi + 1 };
    const sectionId = box.sectionId ? (await serviceRequestApi.updateSection(catalogId, box.sectionId, body), box.sectionId) : (await serviceRequestApi.createSection(catalogId, body)).sectionId;
    box.sectionId = sectionId;
    for (const f of box.fields) {
      const v: CatalogVariablePayload = { sectionId, label: f.label.trim(), fieldType: f.fieldType, isMandatory: f.isMandatory, helpText: f.helpText.trim() || undefined, placeholder: f.placeholder.trim() || undefined, sortOrder: ++sort, ...fieldRules(f), ...(f.fieldType === "user_lookup" ? { lookupSource: PERSON_SOURCE } : f.fieldType === "group_lookup" ? { lookupSource: normalizeLookupSource(f.lookupSource) } : {}), ...(HAS_OPTIONS.includes(f.fieldType) ? { options: f.options.filter((o) => o.trim()).map((o, i) => ({ optionLabel: o.trim(), optionValue: o.trim(), sortOrder: i + 1 })) } : {}) };
      if (f.variableId) await serviceRequestApi.updateVariable(catalogId, f.variableId, v); else await serviceRequestApi.createVariable(catalogId, v);
    }
  }
  const keepSections = new Set(boxes.map((x) => x.sectionId));
  for (const s of before?.sections ?? []) if (!keepSections.has(s.sectionId)) await serviceRequestApi.deleteSection(catalogId, s.sectionId);
  return catalogId;
}

function toTile(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const W = 640, H = 360; const ratio = W / H;
      let sw = img.width, sh = img.height;
      if (sw / sh > ratio) sw = sh * ratio; else sh = sw / ratio;
      const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d"); if (!ctx) { reject(new Error("Your browser could not process the image.")); return; }
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H);
      canvas.toBlob((blob) => (blob ? resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" })) : reject(new Error("Could not resize the image."))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file is not an image the browser can read.")); };
    img.src = url;
  });
}

/* ---------- list page ---------- */
export function ServiceCatalogBuilderPage() {
  const list = useAsync(() => serviceRequestApi.allCatalogs(), []);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<{ id: number | null } | null>(null);
  const [flash, setFlash] = useState("");
  if (open) return <Builder id={open.id} onBack={() => { setOpen(null); list.reload(); }} onFlash={setFlash} />;
  const rows = (list.data ?? []).filter((c) => !q.trim() || `${c.catalogName} ${c.serviceCategory?.categoryName ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <PageHeader crumb="Configuration > Service Catalog Builder" title="Service Catalog Builder" subtitle="Create the items people can request and design the form each one asks for." />
      <div className="page-body">
        <ErrorBar msg={list.error ?? ""} />
        {flash && <div className="sr-notice" style={{ marginBottom: 12 }}>{flash}</div>}
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>Catalog items ({rows.length})</strong>
            <div className="sr-actions">
              <input className="input" style={{ width: 240 }} placeholder="Search items or categories..." aria-label="Search catalog items" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn-primary" onClick={() => { setFlash(""); setOpen({ id: null }); }}><Plus size={14} aria-hidden="true" /> Create catalog item</button>
            </div>
          </div>
          <div style={{ padding: "0 20px 16px", overflowX: "auto" }}>
            {list.loading && !list.data ? <div className="spinner-row">Loading...</div> : rows.length === 0 ? <div className="empty-state">{q ? "No catalog items match your search." : "No catalog items yet."}</div> : (
              <table>
                <thead><tr><th style={TH}>Image</th><th style={TH}>Catalog item</th><th style={TH}>Category</th><th style={TH}>Lifecycle</th><th style={TH}>Workgroup</th><th style={TH}>Fields</th><th style={TH}>Status</th><th style={TH} /></tr></thead>
                <tbody>{rows.map((c) => (
                  <tr key={c.catalogId}>
                    <td style={{ width: 84 }}><div className="cb-tile" style={{ width: 64, height: 36, borderRadius: 5, ...(c.iconUrl ? {} : { background: c.tileColor || "#175CD3" }) }}>{c.iconUrl ? <img src={assetUrl(c.iconUrl)} alt="" /> : <span style={{ fontSize: 15 }}>{(c.catalogName[0] ?? "?").toUpperCase()}</span>}</div></td>
                    <td style={{ fontSize: 13 }}><strong>{c.catalogName}</strong>{c.shortDescription && <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.shortDescription}</div>}</td>
                    <td style={{ fontSize: 12.5 }}>{c.serviceCategory?.categoryName ?? "—"}</td>
                    <td style={{ fontSize: 12.5 }}>{c.workflow?.workflowName ?? <span style={{ color: "var(--muted)" }}>No approval</span>}</td>
                    <td style={{ fontSize: 12.5 }}>{c.fulfillmentGroup?.groupName ?? c.assignmentGroup?.groupName ?? "—"}</td>
                    <td style={{ fontSize: 12.5 }}>{c.variables ? c.variables.length : "—"}</td>
                    <td><span className={`cb-status ${c.status === "published" ? "pub" : ""}`}>{c.status === "published" ? "Published" : c.status === "archived" ? "Archived" : "Draft"}</span></td>
                    <td><button className="admin-master-icon-button" aria-label={`Open ${c.catalogName} in the builder`} onClick={() => { setFlash(""); setOpen({ id: c.catalogId }); }}><Pencil size={14} aria-hidden="true" /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- builder ---------- */
function Builder({ id, onBack, onFlash }: { id: number | null; onBack: () => void; onFlash: (m: string) => void }) {
  const cats = useAsync(() => serviceRequestApi.serviceCategories(), []);
  const wfs = useAsync(() => serviceRequestApi.workflows(), []);
  const groups = useAsync(() => serviceRequestApi.assignmentGroups(), []);
  const urgencies = useAsync(() => serviceRequestApi.urgencies(), []);
  const impacts = useAsync(() => serviceRequestApi.serviceImpacts(), []);
  const priorities = useAsync(() => serviceRequestApi.priorities(), []);
  const [catalogId, setCatalogId] = useState<number | null>(id);
  const [before, setBefore] = useState<ServiceCatalog | null>(null);
  const [basics, setBasics] = useState<Basics>(blankBasics);
  const [boxes, setBoxes] = useState<DBox[]>([newBox(1, "Details")]);
  const [loaded, setLoaded] = useState(id === null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [drag, setDrag] = useState<Drag>(null);
  const [over, setOver] = useState("");
  const [imgBusy, setImgBusy] = useState(false); const [imgError, setImgError] = useState("");
  const [searchField, setSearchField] = useState("");

  const apply = (c: ServiceCatalog) => { const d = toDraft(c); setBefore(c); setBasics(d.basics); setBoxes(d.boxes); };
  const load = useAsync(async () => { if (id === null) return null; const c = await serviceRequestApi.catalog(id); apply(c); setLoaded(true); return c; }, [id]);

  const upBox = (key: string, p: Partial<DBox>) => setBoxes((all) => all.map((b) => (b.key === key ? { ...b, ...p } : b)));
  const upField = (key: string, p: Partial<DField>) => setBoxes((all) => all.map((b) => ({ ...b, fields: b.fields.map((f) => (f.key === key ? { ...f, ...p } : f)) })));
  const moveBox = (i: number, d: -1 | 1) => setBoxes((all) => { const n = [...all]; const j = i + d; if (j < 0 || j >= n.length) return all; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const dropAt = (boxKey: string, index: number) => {
    const d = drag; setDrag(null); setOver(""); if (!d || d.kind === "box") return;
    let moving: DField | undefined; let at = index;
    if (d.kind === "field") {
      const src = boxes.find((b) => b.fields.some((f) => f.key === d.key));
      const si = src ? src.fields.findIndex((f) => f.key === d.key) : -1;
      moving = src?.fields[si];
      if (src && src.key === boxKey && si >= 0 && si < index) at -= 1;
    } else { moving = newField(d.type); setSelected(moving.key); }
    const f = moving; if (!f) return;
    setBoxes((all) => all.map((b) => ({ ...b, fields: b.fields.filter((x) => x.key !== f.key) })).map((b) => (b.key === boxKey ? { ...b, fields: [...b.fields.slice(0, at), f, ...b.fields.slice(at)] } : b)));
  };
  const dropBox = (index: number) => {
    const d = drag; setDrag(null); setOver(""); if (!d || d.kind !== "box") return;
    setBoxes((all) => [...all.slice(0, index), newBox(d.cols), ...all.slice(index)]);
  };
  const clickAdd = (type: CatalogFieldType) => { const f = newField(type); setSelected(f.key); setBoxes((all) => { const t = all.length ? all : [newBox(1, "Details")]; return t.map((b, i) => (i === t.length - 1 ? { ...b, fields: [...b.fields, f] } : b)); }); };

  const save = async (target: "draft" | "published") => {
    const problem = validate(basics, boxes, target === "published");
    if (problem) { setError(problem); return; }
    setError(""); setBusy(true);
    try {
      const copy = boxes.map((b) => ({ ...b, fields: b.fields.map((f) => ({ ...f })) }));
      const cid = await persist(catalogId, basics, copy, target, before);
      setCatalogId(cid);
      const fresh = await serviceRequestApi.catalog(cid); apply(fresh);
      setMsg(target === "published" ? `"${basics.name.trim()}" is saved and published.` : `Draft of "${basics.name.trim()}" saved.`);
      onFlash("");
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return; setImgError("");
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) { setImgError("Choose a PNG, JPG, GIF or WebP image."); return; }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { setImgError(`Image must be under ${MAX_IMAGE_MB} MB.`); return; }
    setImgBusy(true);
    try { const up = await serviceRequestApi.upload(await toTile(file)); setBasics((b) => ({ ...b, iconUrl: up.url })); }
    catch (e) { setImgError(errMsg(e)); } finally { setImgBusy(false); }
  };

  // Category tree for the Browse picker: active categories, nested by parent.
  const catNodes = useMemo<BrowseNode[]>(() => (cats.data ?? []).filter((c) => c.isActive !== false).map((c) => ({ id: String(c.serviceCategoryId), label: c.categoryName, parentId: c.parentCategoryId != null ? String(c.parentCategoryId) : null })), [cats.data]);
  const catPath = (id: string): string => {
    const byId = new Map((cats.data ?? []).map((c) => [String(c.serviceCategoryId), c]));
    const out: string[] = []; let cur = byId.get(id); let guard = 0;
    while (cur && guard++ < 8) { out.unshift(cur.categoryName); cur = cur.parentCategoryId != null ? byId.get(String(cur.parentCategoryId)) : undefined; }
    return out.join(" › ");
  };

  const total = boxes.reduce((n, b) => n + b.fields.length, 0);
  const summary = useMemo(() => [["Item", basics.name || "—"], ["Fields", String(total)], ["Delivery", basics.days ? `${basics.days} day(s)` : "—"], ["Est. cost", basics.cost ? `₹${basics.cost}` : "—"]], [basics, total]);

  if (!loaded || load.loading) return <div className="spinner-row">Loading...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Top bar */}
      <div style={{ borderBottom: "1px solid #E4E7EC", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 48, background: "#fff", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#667085" }}>
          <span>Configuration &gt; Service Request Management &gt; Service Catalog Builder</span>
          <span style={{ color: "#1570EF", fontWeight: 600, background: "#EFF6FF", padding: "2px 8px", borderRadius: 10 }}>{catalogId ? "Edit" : "New item"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn-ghost" style={{ height: 32, fontSize: 12 }} onClick={onBack}><ArrowLeft size={12} /> Back to catalog list</button>
          <button className="btn-ghost" style={{ height: 32, fontSize: 12 }} onClick={() => setPreview((p) => !p)}><Eye size={12} /> {preview ? "Back to editing" : "Preview form"}</button>
          <button className="btn-primary" style={{ height: 32, fontSize: 12 }} disabled={busy} onClick={() => void save(before?.status === "published" ? "published" : "draft")}>Save</button>
          <button className="btn-ghost" style={{ height: 32, fontSize: 12 }} disabled={busy} onClick={() => void save("draft")}>Save draft</button>
          <button className="btn-primary" style={{ height: 32, fontSize: 12 }} disabled={busy} onClick={() => void save("published")}>Publish</button>
        </div>
      </div>

      {/* Name + image bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E4E7EC", padding: "14px 20px", display: "flex", alignItems: "center", gap: 32, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#101828", marginBottom: 2 }}>{catalogId ? basics.name || "Catalog item" : "New catalog item"}</div>
          <div style={{ fontSize: 12, color: "#667085", marginBottom: 12 }}>Drag fields onto the form, click a field's pencil to edit its label, options and rules, then set the category, lifecycle and fulfilment.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="lbl" style={{ marginBottom: 0, whiteSpace: "nowrap" }}>Catalog item name <span className="req">*</span></span>
            <input className="input" style={{ width: 340 }} placeholder="e.g. VPN Access Request" value={basics.name} onChange={(e) => setBasics({ ...basics, name: e.target.value })} />
          </div>
        </div>
        <div>
          <div className="lbl" style={{ marginBottom: 6 }}>Catalog image</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 58, height: 58, borderRadius: 6, flexShrink: 0, background: basics.iconUrl ? "transparent" : "#E4E7EC", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid #E4E7EC" }}>
              {basics.iconUrl ? <img src={assetUrl(basics.iconUrl)} alt="Catalog item" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgError("The saved image could not be loaded. Choose it again.")} /> : <span style={{ fontSize: 10, color: "#98A2B3" }}>No image</span>}
            </div>
            <div>
              <label className="btn-ghost" style={{ cursor: imgBusy ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12.5, fontWeight: 600, height: 32, padding: "0 14px", width: "auto", color: "#1570EF", background: "#EFF6FF", border: "1px solid #84CAFF", borderRadius: 6, whiteSpace: "nowrap" }}>
                <Upload size={14} /> {imgBusy ? "Uploading..." : basics.iconUrl ? "Change image" : "Choose image"}
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden disabled={imgBusy} onChange={(e) => { void pickImage(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <div style={{ fontSize: 11, color: "#98A2B3" }}>Shown on the Service Catalog card and the request form.</div>
              {imgError && <div style={{ fontSize: 11.5, color: "#B42318", marginTop: 2 }}>{imgError}</div>}
            </div>
          </div>
        </div>
      </div>

      <ErrorBar msg={error || load.error || priorities.error || ""} />
      {msg && <div className="sr-notice" style={{ margin: "8px 20px 0" }}>{msg}</div>}

      {preview ? (
        <div style={{ display: "flex", gap: 20, padding: 20, overflowY: "auto", flex: 1 }}>
          <div className="card" style={{ flex: 1, padding: 20 }}>
            <div className="sr-notice" style={{ marginBottom: 14 }}>Form preview. This is the form as a requester will see it, including changes you have not saved yet. Nothing typed here is kept.</div>
            <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>{basics.name || "Untitled item"}</h2>
            {total === 0 && <div className="empty-state">This form has no fields yet. Go back to editing and add some from the Fields list.</div>}
            {boxes.filter((b) => b.fields.length).map((b) => (
              <div key={b.key} style={{ marginBottom: 16 }}>
                <div className="cb-box-title">{b.title}</div>
                <div className="cb-grid" style={{ gridTemplateColumns: `repeat(${b.cols}, minmax(0, 1fr))` }}>{b.fields.map((f) => <div key={f.key}><Mock f={f} /></div>)}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ width: 240, alignSelf: "start", padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Every request form also asks who the request is for, the urgency and impact, and any additional notes. Those standard questions are added automatically and are not shown here.</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Request summary</div>
            <dl className="sr-facts">{summary.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
            <button className="btn-primary" style={{ marginTop: 14, width: "100%" }} disabled>Submit request</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* LEFT palette */}
          <aside style={{ width: 195, flexShrink: 0, borderRight: "1px solid #E4E7EC", background: "#fff", overflowY: "auto", padding: "14px 12px" }} aria-label="Field palette">
            <div style={{ marginBottom: 12 }}>
              <input
                className="input"
                style={{ fontSize: 12, height: 32, padding: "4px 10px", width: "100%", borderRadius: 6 }}
                placeholder="Search fields..."
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
              />
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8, padding: "0 2px" }}>
              FIELDS
            </div>
            {PALETTE.map((g) => {
              const filtered = g.items.filter((i) => !searchField.trim() || i.label.toLowerCase().includes(searchField.toLowerCase()));
              if (filtered.length === 0) return null;
              return (
                <div key={g.group} style={{ marginBottom: 12 }}>
                  <div style={{ padding: "4px 2px", fontSize: 11, fontWeight: 700, color: "#344054", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 9, color: "#667085" }}>▾</span> {g.group}
                    </span>
                    <span style={{ fontSize: 11, color: "#98A2B3", fontWeight: 500 }}>{filtered.length}</span>
                  </div>
                  <div style={{ display: "grid", gap: 5, marginTop: 4 }}>
                    {filtered.map((item) => (
                      <button key={`${g.group}-${item.label}`} type="button"
                        style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px",
                          border: "1px solid #E4E7EC", borderRadius: 6, background: "#fff",
                          cursor: "grab", fontSize: 12, color: "#344054", textAlign: "left",
                          boxShadow: "0 1px 2px rgba(16,24,40,0.02)",
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                        draggable onDragStart={() => setDrag({ kind: "palette", type: item.type })} onDragEnd={() => { setDrag(null); setOver(""); }}
                        onClick={() => clickAdd(item.type)}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#B2CCFF"; (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E4E7EC"; (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
                      >
                        <GripVertical size={13} style={{ color: "#98A2B3", flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </aside>

          {/* CENTER canvas */}
          <section style={{ flex: 1, overflowY: "auto", background: "#F9FAFB", padding: 20 }} aria-label="Request form">
            <div style={{ fontSize: 10, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>REQUEST FORM</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#101828", marginBottom: 2 }}>{basics.name || "Untitled catalog item"}</div>
            <div style={{ fontSize: 11.5, color: "#98A2B3", marginBottom: 16 }}>
              {basics.categoryId ? (cats.data ?? []).find((c) => String(c.serviceCategoryId) === basics.categoryId)?.categoryName : "No category yet"}
            </div>
            {boxes.map((b, bi) => (
              <React.Fragment key={b.key}>
                <div className={`cb-gap ${over === `g${bi}` ? "over" : ""}`}
                  onDragOver={(e) => { if (drag?.kind === "box") { e.preventDefault(); setOver(`g${bi}`); } }}
                  onDragLeave={() => setOver("")} onDrop={(e) => { e.preventDefault(); dropBox(bi); }} />
                <div className="cb-box" style={{ marginBottom: 14 }}>
                  <div className="cb-box-head">
                    <input className="input cb-box-title-input" aria-label="Container title" value={b.title} onChange={(e) => upBox(b.key, { title: e.target.value })} />
                    {bi > 0 && <label className="admin-master-check-label" style={{ whiteSpace: "nowrap", fontSize: 12 }}><input type="checkbox" checked={!!b.newPage} onChange={(e) => upBox(b.key, { newPage: e.target.checked })} /> Starts a new page</label>}
                    <select className="select" style={{ width: 110 }} value={b.cols} onChange={(e) => upBox(b.key, { cols: Number(e.target.value) as 1 | 2 | 3 })}>{BOXES.map((o) => <option key={o.cols} value={o.cols}>{o.label}</option>)}</select>
                    <button className="admin-master-icon-button" disabled={bi === 0} onClick={() => moveBox(bi, -1)}><ArrowUp size={13} /></button>
                    <button className="admin-master-icon-button" disabled={bi === boxes.length - 1} onClick={() => moveBox(bi, 1)}><ArrowDown size={13} /></button>
                    <button className="admin-master-icon-button" disabled={boxes.length === 1} onClick={() => { if (b.fields.length === 0 || window.confirm(`Delete "${b.title}"?`)) setBoxes((all) => all.filter((x) => x.key !== b.key)); }}><Trash2 size={13} /></button>
                  </div>
                  <div className="cb-grid" style={{ gridTemplateColumns: `repeat(${b.cols}, minmax(0, 1fr))` }}>
                    {b.fields.map((f, fi) => (
                      <div key={f.key} className={`cb-field ${selected === f.key ? "sel" : ""} ${over === f.key ? "over" : ""}`} draggable
                        onDragStart={() => setDrag({ kind: "field", key: f.key })} onDragEnd={() => { setDrag(null); setOver(""); }}
                        onDragOver={(e) => { if (drag && drag.kind !== "box") { e.preventDefault(); setOver(f.key); } }}
                        onDragLeave={() => setOver("")} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropAt(b.key, fi); }}>
                        <div className="cb-field-top">
                          <GripVertical size={12} style={{ color: "var(--muted)" }} />
                          <button type="button" className="cb-field-label" onClick={() => setSelected(selected === f.key ? null : f.key)}>{f.label || "Untitled"}{f.isMandatory ? " *" : ""}<span>{TYPE_LABEL[f.fieldType]}</span></button>
                          <button className="admin-master-icon-button" onClick={() => setBoxes((all) => all.map((x) => ({ ...x, fields: x.fields.filter((y) => y.key !== f.key) })))}><Trash2 size={12} /></button>
                        </div>
                        <Mock f={f} />
                        {selected === f.key && <FieldEditor f={f} patch={(p) => upField(f.key, p)} done={() => setSelected(null)} />}
                      </div>
                    ))}
                    <div className={`cb-drop ${over === `e${b.key}` ? "over" : ""}`} style={{ gridColumn: b.fields.length === 0 ? "1 / -1" : undefined }}
                      onDragOver={(e) => { if (drag && drag.kind !== "box") { e.preventDefault(); setOver(`e${b.key}`); } }}
                      onDragLeave={() => setOver("")} onDrop={(e) => { e.preventDefault(); dropAt(b.key, b.fields.length); }}>
                      {b.fields.length === 0 ? "Drop your first field here" : "Drop here to add to the end"}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            ))}
            <div className={`cb-gap ${over === `g${boxes.length}` ? "over" : ""}`} style={{ minHeight: 24 }}
              onDragOver={(e) => { if (drag?.kind === "box") { e.preventDefault(); setOver(`g${boxes.length}`); } }}
              onDragLeave={() => setOver("")} onDrop={(e) => { e.preventDefault(); dropBox(boxes.length); }} />
          </section>

          {/* RIGHT settings */}
          <aside style={{ width: 272, flexShrink: 0, borderLeft: "1px solid #E4E7EC", background: "#fff", overflowY: "auto" }} aria-label="Item settings">
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #E4E7EC" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.5px", textTransform: "uppercase" }}>ITEM SETTINGS</div>
            </div>
            <div style={{ padding: "14px 16px 0" }}>
              <label className="field-group">
                <span className="lbl">Description</span>
                <textarea className="textarea" placeholder="Shown on the catalog card..." value={basics.shortDescription} onChange={(e) => setBasics({ ...basics, shortDescription: e.target.value })} style={{ minHeight: 60, fontSize: 12.5 }} />
              </label>
              <div className="field-group" style={{ marginTop: 12 }}>
                <span className="lbl">Category <span className="req">*</span></span>
                <BrowsePicker title="Select Category" ariaLabel="Category" value={basics.categoryId} label={basics.categoryId ? catPath(basics.categoryId) : ""} nodes={catNodes}
                  placeholder="Click Browse to pick a category…" onSelect={(n) => setBasics((b) => ({ ...b, categoryId: n?.id ?? "" }))} />
                <div style={{ fontSize: 11, color: "#98A2B3", marginTop: 4 }}>Pick where this item sits in the category tree. <Link to="/config/admin/service-category" style={{ color: "#1570EF", fontSize: 11 }}>Manage categories</Link></div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <label className="field-group" style={{ flex: 1 }}>
                  <span className="lbl">Est. cost ($)</span>
                  <input className="input" inputMode="decimal" value={basics.cost} onChange={(e) => setBasics({ ...basics, cost: e.target.value })} />
                </label>
                <label className="field-group" style={{ flex: 1 }}>
                  <span className="lbl">Delivery (days)</span>
                  <input className="input" inputMode="numeric" value={basics.days} onChange={(e) => setBasics({ ...basics, days: e.target.value })} />
                </label>
              </div>
              <label className="field-group" style={{ marginTop: 12 }}>
                <span className="lbl">Lifecycle</span>
                <select className="select" value={basics.workflowId} onChange={(e) => setBasics({ ...basics, workflowId: e.target.value })}>
                  <option value="">No approval</option>
                  {(wfs.data ?? []).map((w) => <option key={w.workflowId} value={w.workflowId}>{w.workflowName}</option>)}
                </select>
                <div style={{ fontSize: 11, color: "#98A2B3", marginTop: 4 }}>Requests for this item go straight to fulfilment. This follows the <Link to="/config/admin/lifecycle" style={{ color: "#1570EF", fontSize: 11 }}>standard lifecycle</Link>. <Link to="/config/admin/lifecycle" style={{ color: "#1570EF", fontSize: 11 }}>Create a lifecycle</Link></div>
              </label>
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #E4E7EC" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10 }}>SERVICE LEVEL</div>
                <label className="field-group">
                  <span className="lbl">Urgency</span>
                  <select className="select" value={basics.urgency} onChange={(e) => setBasics({ ...basics, urgency: e.target.value })}>
                    <option value="">Not set - the form decides</option>
                    {(urgencies.data ?? []).filter((u) => u.urgencyId !== undefined).map((u) => <option key={u.urgencyId} value={u.urgencyId}>{u.urgencyName}</option>)}
                  </select>
                </label>
                <label className="field-group" style={{ marginTop: 10 }}>
                  <span className="lbl">Impact</span>
                  <select className="select" value={basics.impact} onChange={(e) => setBasics({ ...basics, impact: e.target.value })}>
                    <option value="">Not set - the form decides</option>
                    {(impacts.data ?? []).filter((i) => i.isActive !== false).map((i) => <option key={i.serviceImpactId} value={i.serviceImpactId}>{i.impactName}</option>)}
                  </select>
                </label>
                <div style={{ fontSize: 11, color: "#98A2B3", marginTop: 6 }}>Urgency and impact are the values the request form starts with; the requester can change them.</div>
                <label className="field-group" style={{ marginTop: 10 }}>
                  <span className="lbl">Priority</span>
                  <select className="select" value={basics.priorityId} onChange={(e) => setBasics({ ...basics, priorityId: e.target.value })}>
                    <option value="">Use priority matrix</option>
                    {(priorities.data ?? []).filter((p) => p.priorityId !== undefined && (p.isActive !== false || String(p.priorityId) === basics.priorityId)).map((p) => <option key={p.priorityId} value={p.priorityId}>{p.priorityName}</option>)}
                  </select>
                </label>
                <div style={{ fontSize: 11, color: "#98A2B3", marginTop: 6 }}>Choose a priority to override the matrix, or leave it to derive priority from urgency and impact.</div>
                <div style={{ fontSize: 12, color: "#344054", marginTop: 8, lineHeight: 1.5 }}><strong>Service window:</strong> Automatic, by fulfilment workgroup.</div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #E4E7EC" }}>
                <label className="field-group">
                  <span className="lbl">Fulfilment workgroup</span>
                  <select className="select" value={basics.groupId} onChange={(e) => setBasics({ ...basics, groupId: e.target.value })}>
                    <option value="">Not set</option>
                    {(groups.data ?? []).filter((g) => g.groupId !== undefined).map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: "#98A2B3", marginTop: 4 }}>The workgroup that fulfils requests for this item.</div>
                </label>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Mock({ f }: { f: DField }) {
  const opts = f.options.filter((o) => o.trim());
  const [lookupValue, setLookupValue] = useState("");
  if (f.fieldType === "info") return <div style={{ fontSize: 13, fontWeight: 600 }}>{f.label}{f.helpText && <div style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>{f.helpText}</div>}</div>;
  const box = (() => {
    switch (f.fieldType) {
      case "textarea": return <textarea className="textarea" disabled rows={2} placeholder={f.placeholder} />;
      case "dropdown": return <select className="select" disabled><option>Select...</option></select>;
      case "user_lookup":
      case "group_lookup": {
        const source = f.fieldType === "user_lookup" ? PERSON_SOURCE : normalizeLookupSource(f.lookupSource);
        return <LookupField
          source={source}
          value={lookupValue}
          label={lookupValue}
          onSelect={(option) => setLookupValue(option?.value ?? "")}
          placeholder={f.placeholder || (f.fieldType === "user_lookup" ? "Select a person (User table)..." : `Select from ${lookupSourceLabel(source)} table...`)}
          ariaLabel={f.label}
        />;
      }
      case "multi_select": case "radio": return <div style={{ display: "grid", gap: 4 }}>{opts.map((o) => <label key={o} style={{ fontSize: 12.5, display: "flex", gap: 6 }}><input type={f.fieldType === "radio" ? "radio" : "checkbox"} disabled />{o}</label>)}</div>;
      case "checkbox": return <label style={{ fontSize: 12.5, display: "flex", gap: 6 }}><input type="checkbox" disabled />{f.label}</label>;
      case "attachment": return <div className="cb-attach">Choose a file to attach</div>;
      case "date": return <input className="input" type="date" disabled />;
      case "datetime": return <input className="input" type="datetime-local" disabled />;
      case "number": return <input className="input" type="number" disabled placeholder={f.placeholder} />;
      default: return <input className="input" disabled placeholder={f.placeholder} />;
    }
  })();
  return <div className="field-group">{f.fieldType !== "checkbox" && <span className="lbl">{f.label}{f.isMandatory && <span className="req"> *</span>}</span>}{box}{f.helpText && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{f.helpText}</span>}</div>;
}

function FieldEditor({ f, patch, done }: { f: DField; patch: (p: Partial<DField>) => void; done: () => void }) {
  return (
    <div className="sr-form" style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
      <label className="field-group"><span className="lbl">Label <span className="req">*</span></span><input className="input" value={f.label} onChange={(e) => patch({ label: e.target.value })} /></label>
      {f.fieldType !== "info" && f.fieldType !== "attachment" && <label className="field-group"><span className="lbl">Placeholder</span><input className="input" value={f.placeholder} onChange={(e) => patch({ placeholder: e.target.value })} /></label>}
      <label className="field-group"><span className="lbl">{f.fieldType === "info" ? "Note text" : "Help text"}</span><input className="input" value={f.helpText} onChange={(e) => patch({ helpText: e.target.value })} /></label>
      {f.fieldType === "user_lookup" && (
        <div className="field-group">
          <span className="lbl">Source table</span>
          <div style={{ fontSize: 12.5, color: "#344054", padding: "8px 10px", background: "#F2F4F7", borderRadius: 6 }}>
            <strong>User table</strong> — Requesters search and select people from the User directory (name, email, employee ID).
          </div>
        </div>
      )}
      {f.fieldType === "group_lookup" && (
        <label className="field-group"><span className="lbl">Source table <span className="req">*</span></span>
          <select className="select" value={f.lookupSource ? normalizeLookupSource(f.lookupSource) : DEFAULT_LOOKUP_SOURCE} onChange={(e) => patch({ lookupSource: e.target.value })}>
            {LOOKUP_SOURCES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Values are picked from this table (Location, Department, Email, etc.).</span></label>
      )}
      {HAS_OPTIONS.includes(f.fieldType) && (
        <div className="field-group"><span className="lbl">Options <span className="req">*</span></span>
          {f.options.map((o, i) => <div key={i} className="sr-actions" style={{ marginBottom: 4 }}><input className="input" value={o} onChange={(e) => patch({ options: f.options.map((x, j) => (j === i ? e.target.value : x)) })} /><button className="admin-master-icon-button" onClick={() => patch({ options: f.options.filter((_, j) => j !== i) })}><Trash2 size={12} /></button></div>)}
          <button type="button" className="btn-ghost" onClick={() => patch({ options: [...f.options, `Option ${f.options.length + 1}`] })}><Plus size={12} /> Add option</button>
        </div>
      )}
      {["text", "textarea", "number"].includes(f.fieldType) && <label className="field-group"><span className="lbl">Default value</span><input className="input" type={f.fieldType === "number" ? "number" : "text"} value={f.defaultValue ?? ""} onChange={(e) => patch({ defaultValue: e.target.value })} /></label>}
      {f.fieldType === "date" && <label className="field-group"><span className="lbl">Default value</span><input className="input" type="date" value={f.defaultValue ?? ""} onChange={(e) => patch({ defaultValue: e.target.value })} /></label>}
      {f.fieldType === "datetime" && <label className="field-group"><span className="lbl">Default value</span><input className="input" type="datetime-local" value={f.defaultValue ?? ""} onChange={(e) => patch({ defaultValue: e.target.value })} /></label>}
      {(f.fieldType === "dropdown" || f.fieldType === "radio") && f.options.some((o) => o.trim()) && (
        <label className="field-group"><span className="lbl">Default option</span>
          <select className="select" value={f.defaultValue ?? ""} onChange={(e) => patch({ defaultValue: e.target.value })}><option value="">No default</option>{f.options.filter((o) => o.trim()).map((o) => <option key={o} value={o.trim()}>{o}</option>)}</select></label>)}
      {f.fieldType === "checkbox" && <label className="admin-master-check-label"><input type="checkbox" checked={["true", "yes", "1"].includes((f.defaultValue ?? "").toLowerCase())} onChange={(e) => patch({ defaultValue: e.target.checked ? "true" : "" })} /> Ticked by default</label>}
      {(f.fieldType === "dropdown" || f.fieldType === "multi_select") && <label className="admin-master-check-label"><input type="checkbox" checked={f.fieldType === "multi_select"} onChange={(e) => patch({ fieldType: e.target.checked ? "multi_select" : "dropdown", defaultValue: "" })} /> Allow more than one choice</label>}
      {(f.fieldType === "text" || f.fieldType === "textarea") && <label className="field-group"><span className="lbl">Maximum length (characters)</span><input className="input" type="number" min={1} max={4000} style={{ maxWidth: 160 }} value={f.maxLength ?? ""} onChange={(e) => patch({ maxLength: e.target.value })} /></label>}
      {f.fieldType === "number" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label className="field-group" style={{ margin: 0 }}><span className="lbl">Minimum</span><input className="input" type="number" value={f.minValue ?? ""} onChange={(e) => patch({ minValue: e.target.value })} /></label>
          <label className="field-group" style={{ margin: 0 }}><span className="lbl">Maximum</span><input className="input" type="number" value={f.maxValue ?? ""} onChange={(e) => patch({ maxValue: e.target.value })} /></label>
          <label className="admin-master-check-label" style={{ gridColumn: "1 / -1" }}><input type="checkbox" checked={!!f.onlyIntegers} onChange={(e) => patch({ onlyIntegers: e.target.checked })} /> Whole numbers only</label>
        </div>)}
      {(f.fieldType === "date" || f.fieldType === "datetime") && <label className="admin-master-check-label"><input type="checkbox" checked={!!f.noPastDates} onChange={(e) => patch({ noPastDates: e.target.checked })} /> Do not allow past dates</label>}
      {f.fieldType === "attachment" && <label className="field-group"><span className="lbl">Allowed file types</span><input className="input" placeholder=".pdf, .png, .docx" value={f.allowedFileTypes ?? ""} onChange={(e) => patch({ allowedFileTypes: e.target.value })} /><span style={{ fontSize: 11.5, color: "var(--muted)" }}>Leave empty to allow any type.</span></label>}
      {f.fieldType !== "info" && <label className="admin-master-check-label"><input type="checkbox" checked={f.isMandatory} onChange={(e) => patch({ isMandatory: e.target.checked })} /> Required</label>}
      <div><button type="button" className="btn-primary" onClick={done}>Done</button></div>
    </div>
  );
}
