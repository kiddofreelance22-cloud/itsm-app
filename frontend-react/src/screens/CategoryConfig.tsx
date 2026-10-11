import React, { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Check, Plus } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, SectionLabel, errMsg } from "../components/configKit";

interface CatNode {
  categoryId: number; categoryName: string; description?: string | null; parentCategoryId?: number | null;
  displayOrder: number; isActive: boolean; defaultAssignmentGroup?: { groupId: number } | null;
  workgroupIds?: number[] | null; locationIds?: number[] | null; memberIds?: number[] | null; children: CatNode[];
}
const MAX_LEVEL = 5;
const MAX_DESC = 500;
const hint: React.CSSProperties = { fontSize: 12, color: "#98A2B3", marginTop: 4 };

export function CategoryConfigPage() {
  const tree = useAsync(() => api.get<CatNode[]>("/categories/tree"), []);
  const groups = useAsync(() => api.get<{ groupId: number; groupName: string }[]>("/assignment-groups"), []);
  const locations = useAsync(() => api.get<{ locationId: number; locationName: string }[]>("/locations").catch(() => []), []);
  const users = useAsync(() => api.get<{ userId: number; fullName: string; isActive?: boolean }[]>("/users").catch(() => []), []);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", parentId: "", displayOrder: 1, routeGroupId: "", workgroupId: "", locationId: "", memberId: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const roots = tree.data ?? [];
  const flat = useMemo(() => {
    const out: { n: CatNode; level: number }[] = [];
    const walk = (nodes: CatNode[], level: number) => nodes.forEach((n) => { out.push({ n, level }); walk(n.children ?? [], level + 1); });
    walk(roots, 1);
    return out;
  }, [roots]);
  const visible = useMemo(() => {
    const out: { n: CatNode; level: number; hasChild: boolean; expanded: boolean }[] = [];
    const walk = (nodes: CatNode[], level: number) => nodes.forEach((n) => {
      const hasChild = (n.children ?? []).length > 0, expanded = !collapsed[n.categoryId];
      out.push({ n, level, hasChild, expanded });
      if (hasChild && expanded) walk(n.children, level + 1);
    });
    walk(roots, 1);
    return out;
  }, [roots, collapsed]);

  const levelOf = (id: number) => flat.find((x) => x.n.categoryId === id)?.level ?? 0;
  const subtreeIds = (n: CatNode): number[] => (n.children ?? []).flatMap((c) => [c.categoryId, ...subtreeIds(c)]);
  const editingEntry = editingId ? flat.find((x) => x.n.categoryId === editingId) : undefined;
  const editingNode = editingEntry?.n;
  const descendantsOfEditing = editingNode ? subtreeIds(editingNode) : [];
  const blocked = new Set<number>(editingNode ? [editingNode.categoryId, ...descendantsOfEditing] : []);
  const subtreeDepth = editingNode
    ? Math.max(0, ...flat.filter((x) => descendantsOfEditing.includes(x.n.categoryId)).map((x) => x.level - (editingEntry?.level ?? 1)))
    : 0;
  const parentChoices = flat.filter((x) =>
    !blocked.has(x.n.categoryId) && x.level + 1 + subtreeDepth <= MAX_LEVEL
  );
  const formLevel = form.parentId ? levelOf(Number(form.parentId)) + 1 : 1;

  const openNew = (parentId?: number) => {
    setEditingId(null); setErr("");
    const siblings = parentId ? (flat.find((x) => x.n.categoryId === parentId)?.n.children.length ?? 0) : roots.length;
    setForm({ name: "", description: "", parentId: parentId ? String(parentId) : "", displayOrder: siblings + 1, routeGroupId: "", workgroupId: "", locationId: "", memberId: "", isActive: true });
    setFormOpen(true);
  };
  const openEdit = (n: CatNode) => {
    setEditingId(n.categoryId); setErr("");
    setForm({
      name: n.categoryName, description: n.description ?? "", parentId: n.parentCategoryId ? String(n.parentCategoryId) : "", displayOrder: n.displayOrder,
      routeGroupId: n.defaultAssignmentGroup ? String(n.defaultAssignmentGroup.groupId) : "",
      workgroupId: String(n.workgroupIds?.[0] ?? ""), locationId: String(n.locationIds?.[0] ?? ""), memberId: String(n.memberIds?.[0] ?? ""),
      isActive: n.isActive,
    });
    setFormOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Category Name is required."); return; }
    if (form.description.length > MAX_DESC) { setErr(`Description can be at most ${MAX_DESC} characters.`); return; }
    setSaving(true); setErr("");
    const body: Record<string, unknown> = {
      categoryName: form.name.trim(), description: form.description.trim() || undefined, displayOrder: Number(form.displayOrder) || 0, isActive: form.isActive,
      workgroupIds: form.workgroupId ? [Number(form.workgroupId)] : undefined,
      locationIds: form.locationId ? [Number(form.locationId)] : undefined,
      memberIds: form.memberId ? [Number(form.memberId)] : undefined,
      defaultAssignmentGroupId: form.routeGroupId ? Number(form.routeGroupId) : undefined,
    };
    try {
      if (editingId) await api.patch(`/categories/${editingId}`, { ...body, parentCategoryId: form.parentId ? Number(form.parentId) : null });
      else await api.post("/categories", { ...body, ...(form.parentId ? { parentCategoryId: Number(form.parentId) } : {}) });
      setFormOpen(false); tree.reload();
    } catch (e2) { setErr(errMsg(e2, "Unable to save category.")); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader crumb="Configuration > Incident Masters > Category" title="Category Configuration"
        subtitle="Manage incident categories as a hierarchy, up to 5 levels deep." />
      <div className="page-body" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* LEFT PANEL: TREE */}
        <div className="card" style={{ flex: 1, maxWidth: 500, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #E4E7EC" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#344054", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>CATEGORY TREE</div>
            <button className="btn-primary" style={{ padding: "6px 12px", height: 32, fontSize: 13 }} onClick={() => openNew()}>+ Add New Category</button>
          </div>
          <div style={{ padding: "12px 16px", minHeight: 600 }}>
            <ErrorBar msg={tree.error ?? ""} />
            {tree.loading ? <div className="spinner-row">Loading…</div> : visible.length === 0 ? <div className="empty-state">No categories yet.</div> : visible.map(({ n, level, hasChild, expanded }) => (
              <div key={n.categoryId} onClick={() => openEdit(n)}
                style={{ display: "flex", alignItems: "center", padding: "8px 0", paddingLeft: (level - 1) * 24, cursor: "pointer", background: editingId === n.categoryId ? "#EFF4FC" : "transparent", opacity: n.isActive ? 1 : 0.65 }}>
                <div onClick={(e) => { e.stopPropagation(); if (hasChild) setCollapsed({ ...collapsed, [n.categoryId]: expanded }); }}
                  style={{ width: 20, display: "flex", justifyContent: "center", cursor: hasChild ? "pointer" : "default", color: "#98A2B3" }}>
                  {hasChild ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ width: 14 }} />}
                </div>
                <div style={{ fontSize: 13.5, color: "#101828", flex: 1, marginLeft: 4, fontWeight: level === 1 ? 500 : 400 }}>{n.categoryName}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ color: "#1570EF", fontSize: 12, fontWeight: 600 }}>L{level}</div>
                  {!n.isActive && <span style={{ background: "#F2F4F7", color: "#667085", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>Inactive</span>}
                  {n.defaultAssignmentGroup && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#ECFDF3", color: "#027A48", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, border: "1px solid #ABEFC6" }}>
                      <Check size={12} strokeWidth={3} /> Configured
                    </div>
                  )}
                  {level < MAX_LEVEL && (
                    <button type="button" title="Add child category" aria-label={`Add under ${n.categoryName}`}
                      onClick={(e) => { e.stopPropagation(); openNew(n.categoryId); }}
                      style={{ border: "none", background: "transparent", color: "#98A2B3", cursor: "pointer", display: "flex", paddingRight: 8 }}>
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL: FORM */}
        <div style={{ flex: 1, maxWidth: 600, paddingBottom: 40 }}>
          {formOpen ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #000", paddingBottom: 12, marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#101828", letterSpacing: "0.5px", textTransform: "uppercase" }}>{editingId ? "EDIT CATEGORY" : "ADD NEW CATEGORY"}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1570EF" }}>Level {formLevel} of {MAX_LEVEL}</div>
              </div>
              <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                <ErrorBar msg={err} />
                <div>
                  <SectionLabel>Category Information</SectionLabel>
                  <label className="field-group"><span className="lbl">Category Name <span className="req">*</span></span>
                    <input className="input" placeholder="e.g. Peripherals" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                  <label className="field-group"><span className="lbl">Description</span>
                    <textarea className="textarea" style={{ height: 80 }} value={form.description} maxLength={MAX_DESC} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    <div style={{ fontSize: 11, color: "#98A2B3", textAlign: "right", marginTop: 4 }}>{form.description.length}/{MAX_DESC} characters</div></label>
                </div>
                <div>
                  <SectionLabel>Configuration</SectionLabel>
                  <div style={{ display: "flex", gap: 16 }}>
                    <label className="field-group" style={{ flex: 2 }}><span className="lbl">Parent Category</span>
                      <select className="select" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                        <option value="">— (Root Category)</option>
                        {parentChoices.map(({ n, level }) => <option key={n.categoryId} value={n.categoryId}>{"— ".repeat(level - 1)}{n.categoryName}</option>)}
                      </select></label>
                    <label className="field-group" style={{ flex: 1 }}><span className="lbl">Display Order</span>
                      <input className="input" type="number" min={0} value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} /></label>
                  </div>
                  <div className="field-group">
                    <span className="lbl">Status</span>
                    <span className="admin-master-check-label">
                      <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
                    </span>
                  </div>
                </div>
                <div>
                  <SectionLabel>Incident Routing</SectionLabel>
                  <div style={{ fontSize: 12.5, color: "#98A2B3", lineHeight: 1.5, marginBottom: 16 }}>
                    Incidents filed under this category (or a descendant that doesn&apos;t set its own) route here automatically. Leave as &quot;Inherit&quot; to fall back to the parent category&apos;s routing, or the system default if none is set anywhere up the tree.
                  </div>
                  <label className="field-group"><span className="lbl">Default Assignment Group</span>
                    <select className="select" value={form.routeGroupId} onChange={(e) => setForm({ ...form, routeGroupId: e.target.value })}>
                      <option value="">Inherit from parent / system default</option>
                      {(groups.data ?? []).map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}
                    </select></label>
                </div>
                <div>
                  <SectionLabel>Assignments (optional)</SectionLabel>
                  <div style={{ fontSize: 12.5, color: "#98A2B3", lineHeight: 1.5, marginBottom: 16 }}>
                    Each category supports exactly one workgroup, one location and one preferred member. Leave blank to inherit the parent category&apos;s assignments.
                  </div>
                  <label className="field-group"><span className="lbl">Workgroup</span>
                    <select className="select" value={form.workgroupId} onChange={(e) => setForm({ ...form, workgroupId: e.target.value })}>
                      <option value="">— None —</option>{(groups.data ?? []).map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}</select>
                    <div style={hint}>Incidents in this category are picked up by this workgroup only.</div></label>
                  <label className="field-group"><span className="lbl">Location</span>
                    <select className="select" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                      <option value="">— None —</option>{(locations.data ?? []).map((l) => <option key={l.locationId} value={l.locationId}>{l.locationName}</option>)}</select>
                    <div style={hint}>On assignment, the requester&apos;s location is matched against a resolver in this same location within the workgroup.</div></label>
                  <label className="field-group"><span className="lbl">Preferred Member</span>
                    <select className="select" value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>
                      <option value="">— None —</option>{(users.data ?? []).filter((u) => u.isActive !== false).map((u) => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}</select>
                    <div style={hint}>Incidents in this category are offered to this member first.</div></label>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
                  <button type="submit" className="btn-primary" style={{ height: 40, padding: "0 20px" }} disabled={saving}>{saving ? "Saving…" : "Save Category"}</button>
                  <button type="button" className="btn-ghost" style={{ border: "1px solid #D0D5DD", background: "#fff", color: "#344054", height: 40, padding: "0 20px" }} onClick={() => setFormOpen(false)}>Cancel</button>
                </div>
              </form>
            </>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#667085", fontSize: 14, background: "#F9FAFB", borderRadius: 8, border: "1px dashed #E4E7EC" }}>
              Select a category from the tree or click <b>+ Add New Category</b> to begin.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
