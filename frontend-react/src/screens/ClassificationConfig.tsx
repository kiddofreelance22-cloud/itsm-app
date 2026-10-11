import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { ClassificationRow, classificationApi } from "../configApi";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, errMsg } from "../components/configKit";

const MAX_LEVEL = 5;
interface Node extends ClassificationRow { children: Node[] }

function buildTree(rows: ClassificationRow[]): Node[] {
  const byId = new Map<number, Node>(rows.map((r) => [r.classificationId, { ...r, children: [] }]));
  const roots: Node[] = [];
  byId.forEach((n) => (n.parentId && byId.get(n.parentId) ? byId.get(n.parentId)!.children.push(n) : roots.push(n)));
  const sort = (a: Node[]) => { a.sort((x, y) => x.name.localeCompare(y.name)); a.forEach((c) => sort(c.children)); };
  sort(roots);
  return roots;
}
const descendants = (n: Node): number[] => n.children.flatMap((c) => [c.classificationId, ...descendants(c)]);

export function ClassificationConfigPage() {
  const { data, loading, error, reload } = useAsync(() => classificationApi.list(), []);
  const rows = data ?? [];
  const tree = useMemo(() => buildTree(rows), [rows]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.classificationId, r])), [rows]);

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [mode, setMode] = useState<"none" | "new" | "edit">("none");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", parentId: "" as string, isActive: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const flat: Node[] = useMemo(() => {
    const out: Node[] = [];
    const walk = (nodes: Node[]) => nodes.forEach((n) => { out.push(n); walk(n.children); });
    walk(tree);
    return out;
  }, [tree]);

  const selectedNode = selectedId ? flat.find((n) => n.classificationId === selectedId) : undefined;
  // Parents the user may pick: not itself, not its own subtree, and not a level-5 node (children would be level 6).
  const parentChoices = useMemo(() => {
    const blocked = new Set<number>(selectedNode ? [selectedNode.classificationId, ...descendants(selectedNode)] : []);
    const subtreeDepth = selectedNode ? Math.max(...[selectedNode, ...flat.filter((n) => descendants(selectedNode).includes(n.classificationId))].map((n) => n.level)) - selectedNode.level : 0;
    return flat.filter((n) => !blocked.has(n.classificationId) && n.level + 1 + subtreeDepth <= MAX_LEVEL);
  }, [flat, selectedNode]);

  const levelFor = (parentId: string) => (parentId ? (byId.get(Number(parentId))?.level ?? 0) + 1 : 1);

  const openNew = (parentId?: number) => {
    setMode("new"); setSelectedId(null); setFormError("");
    setForm({ name: "", parentId: parentId ? String(parentId) : "", isActive: true });
  };
  const openEdit = (n: Node) => {
    setMode("edit"); setSelectedId(n.classificationId); setFormError("");
    setForm({ name: n.name, parentId: n.parentId ? String(n.parentId) : "", isActive: n.isActive });
  };
  const close = () => { setMode("none"); setSelectedId(null); setFormError(""); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Classification Name is required."); return; }
    setSaving(true); setFormError("");
    try {
      const parentId = form.parentId ? Number(form.parentId) : null;
      if (mode === "new") await classificationApi.create({ name: form.name.trim(), parentId, isActive: form.isActive });
      else if (selectedId) await classificationApi.update(selectedId, { name: form.name.trim(), parentId, isActive: form.isActive });
      close(); reload();
    } catch (err) { setFormError(errMsg(err, "Unable to save.")); }
    finally { setSaving(false); }
  };

  const renderNode = (n: Node): React.ReactNode => {
    const hasKids = n.children.length > 0;
    const isOpen = !collapsed[n.classificationId];
    return (
      <React.Fragment key={n.classificationId}>
        <div
          onClick={() => openEdit(n)}
          style={{
            display: "flex", alignItems: "center", padding: "8px 8px", paddingLeft: 8 + (n.level - 1) * 24, cursor: "pointer", borderRadius: 6,
            background: selectedId === n.classificationId ? "#EFF4FC" : "transparent", opacity: n.isActive ? 1 : 0.65,
          }}
        >
          <div
            onClick={(e) => { e.stopPropagation(); if (hasKids) setCollapsed({ ...collapsed, [n.classificationId]: isOpen }); }}
            style={{ width: 20, display: "flex", justifyContent: "center", color: "#98A2B3", cursor: hasKids ? "pointer" : "default" }}
          >
            {hasKids ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ width: 14 }} />}
          </div>
          <div style={{ fontSize: 13.5, color: "#101828", flex: 1, marginLeft: 4, fontWeight: n.level === 1 ? 500 : 400 }}>{n.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ color: "#1570EF", fontSize: 12, fontWeight: 600 }}>L{n.level}</div>
            {!n.isActive && <span style={{ background: "#F2F4F7", color: "#667085", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>Inactive</span>}
            {n.level < MAX_LEVEL && (
              <button
                type="button" title="Add child classification" aria-label={`Add under ${n.name}`}
                onClick={(e) => { e.stopPropagation(); openNew(n.classificationId); }}
                style={{ border: "none", background: "transparent", color: "#98A2B3", cursor: "pointer", display: "flex" }}
              ><Plus size={14} /></button>
            )}
          </div>
        </div>
        {hasKids && isOpen && n.children.map(renderNode)}
      </React.Fragment>
    );
  };

  return (
    <>
      <PageHeader crumb="Configuration > Incident Masters > Classification" title="Classification Configuration"
        subtitle="Manage incident classifications as a hierarchy, up to 5 levels deep." />
      <div className="page-body" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div className="card" style={{ flex: 1, maxWidth: 500, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #E4E7EC" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#344054", letterSpacing: "0.5px" }}>CLASSIFICATION TREE</div>
            <button className="btn-primary" style={{ padding: "6px 12px", height: 32, fontSize: 13 }} onClick={() => openNew()}>+ Add New Classification</button>
          </div>
          <div style={{ padding: "12px 16px", minHeight: 400 }}>
            <ErrorBar msg={error ?? ""} />
            {loading ? <div className="spinner-row">Loading…</div> : tree.length === 0 ? <div className="empty-state">No classifications yet.</div> : tree.map(renderNode)}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingBottom: 40 }}>
          {mode === "none" ? (
            <div style={{ padding: 40, textAlign: "center", color: "#667085", fontSize: 14, background: "#F9FAFB", borderRadius: 8, border: "1px dashed #E4E7EC" }}>
              <b>No classification selected</b><br />
              Click a classification in the tree to edit it, or use &quot;Add New Classification&quot; / the + icon to create a new one.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #000", paddingBottom: 12, marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#101828", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  {mode === "new" ? "ADD NEW CLASSIFICATION" : "EDIT CLASSIFICATION"}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1570EF" }}>Level {levelFor(form.parentId)} of {MAX_LEVEL}</div>
              </div>
              <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <ErrorBar msg={formError} />
                <label className="field-group">
                  <span className="lbl">Classification Name <span className="req">*</span></span>
                  <input className="input" value={form.name} maxLength={150} autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <label className="field-group">
                  <span className="lbl">Parent Classification</span>
                  <select className="select" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                    <option value="">— (Root Classification)</option>
                    {parentChoices.map((n) => (
                      <option key={n.classificationId} value={n.classificationId}>{"— ".repeat(n.level - 1)}{n.name}</option>
                    ))}
                  </select>
                </label>
                <div className="field-group">
                  <span className="lbl">Status</span>
                  <span className="admin-master-check-label">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, alignItems: "center" }}>
                  <button type="submit" className="btn-primary" style={{ height: 40, padding: "0 20px" }} disabled={saving}>{saving ? "Saving…" : "Save Classification"}</button>
                  <button type="button" className="btn-ghost" style={{ border: "1px solid #D0D5DD", background: "#fff", color: "#344054", height: 40, padding: "0 20px" }} onClick={close}>Cancel</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
