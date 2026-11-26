import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Link } from "../router";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, errMsg } from "../components/configKit";
import { MAX_CATEGORY_LEVEL, serviceCategoryApi, serviceRequestApi, type ServiceCategoryNode } from "../requestsApi";
import { Pill } from "../components/serviceRequestKit";

interface TreeNode extends ServiceCategoryNode { children: TreeNode[] }
type Mode = { kind: "edit"; id: number } | { kind: "add"; parentId: number | null } | null;

function buildTree(rows: ServiceCategoryNode[]): TreeNode[] {
  const nodes = new Map<number, TreeNode>(rows.map((r) => [r.serviceCategoryId, { ...r, children: [] }]));
  const roots: TreeNode[] = [];
  nodes.forEach((n) => {
    const parent = n.parentCategoryId ? nodes.get(n.parentCategoryId) : undefined;
    (parent ? parent.children : roots).push(n);
  });
  const sort = (list: TreeNode[]) => { list.sort((a, b) => a.sortOrder - b.sortOrder || a.categoryName.localeCompare(b.categoryName)); list.forEach((n) => sort(n.children)); };
  sort(roots);
  return roots;
}

/** Service Category: group catalog items in up to five levels. */
export function ServiceCategoryPage() {
  const cats = useAsync(() => serviceCategoryApi.list(), []);
  const catalogs = useAsync(() => serviceRequestApi.allCatalogs(), []);
  const [mode, setMode] = useState<Mode>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = cats.data ?? [];
  useEffect(() => {
    if (rows.length > 0 && expanded.size === 0) {
      setExpanded(new Set(rows.filter((row) => row.childCount > 0).map((row) => row.serviceCategoryId)));
    }
  }, [rows, expanded.size]);
  const tree = useMemo(() => buildTree(rows), [rows]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.serviceCategoryId, r])), [rows]);
  const selected = mode?.kind === "edit" ? byId.get(mode.id) : undefined;
  const parent = mode?.kind === "add" && mode.parentId ? byId.get(mode.parentId) : undefined;
  const level = mode?.kind === "add" ? (parent ? parent.level + 1 : 1) : selected?.level ?? 1;

  const pathOf = (id?: number | null): string => {
    const parts: string[] = []; let cur = id ? byId.get(id) : undefined;
    for (let i = 0; cur && i < 8; i++) { parts.unshift(cur.categoryName); cur = cur.parentCategoryId ? byId.get(cur.parentCategoryId) : undefined; }
    return parts.join(" › ");
  };

  const items = (catalogs.data ?? []).filter((c) => selected && c.serviceCategory?.serviceCategoryId === selected.serviceCategoryId);

  const pick = (n: ServiceCategoryNode) => {
    setError(""); setMode({ kind: "edit", id: n.serviceCategoryId });
    setName(n.categoryName); setDescription(n.description ?? ""); setActive(n.isActive);
  };
  const startAdd = (parentId: number | null) => {
    setError(""); setMode({ kind: "add", parentId }); setName(""); setDescription(""); setActive(true);
    if (parentId) setExpanded((e) => new Set(e).add(parentId));
  };
  const toggle = (id: number) => setExpanded((e) => { const n = new Set(e); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allIds = rows.filter((r) => r.childCount > 0).map((r) => r.serviceCategoryId);

  const save = async () => {
    if (!mode) return;
    if (!name.trim()) { setError("Give the category a name."); return; }
    setError(""); setBusy(true);
    try {
      if (mode.kind === "add") {
        const created = await serviceCategoryApi.create({ categoryName: name.trim(), description: description.trim() || undefined, isActive: active, parentCategoryId: mode.parentId });
        cats.reload(); setMode({ kind: "edit", id: created.serviceCategoryId });
      } else {
        await serviceCategoryApi.update(mode.id, { categoryName: name.trim(), description: description.trim(), isActive: active });
        cats.reload();
      }
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!selected || !window.confirm(`Delete the category "${selected.categoryName}"?`)) return;
    setError(""); setBusy(true);
    try { await serviceCategoryApi.remove(selected.serviceCategoryId); setMode(null); cats.reload(); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const renderNode = (n: TreeNode): React.ReactNode => {
    const open = expanded.has(n.serviceCategoryId);
    const isSel = mode?.kind === "edit" && mode.id === n.serviceCategoryId;
    const totalItems = n.itemCount;
    return (
      <li key={n.serviceCategoryId} style={{ listStyle: "none" }}>
        <div
          onClick={() => pick(n)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 12px", paddingLeft: 12 + (n.level - 1) * 20,
            cursor: "pointer",
            background: isSel ? "#EFF6FF" : "transparent",
            borderBottom: "1px solid #F2F4F7",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = "#F9FAFB"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = isSel ? "#EFF6FF" : "transparent"; }}
        >
          <button
            type="button"
            aria-label={open ? `Collapse ${n.categoryName}` : `Expand ${n.categoryName}`}
            aria-expanded={open}
            onClick={(e) => { e.stopPropagation(); if (n.childCount > 0) toggle(n.serviceCategoryId); }}
            style={{
              border: 0, background: "none", width: 18, height: 18, padding: 0,
              cursor: n.childCount ? "pointer" : "default",
              color: "#667085", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            {n.childCount > 0 ? (open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />) : <span style={{ width: 13 }} />}
          </button>

          <span style={{
            flex: 1, fontSize: 13.5,
            fontWeight: isSel ? 600 : n.level === 1 ? 500 : 400,
            color: n.isActive ? "#101828" : "#98A2B3",
          }}>
            {n.categoryName}
          </span>

          <span style={{
            fontSize: 11, fontWeight: 700, color: "#1570EF",
            background: "#EFF6FF", borderRadius: 10, padding: "2px 7px", flexShrink: 0,
          }}>
            L{n.level}
          </span>

          {!n.isActive && <Pill tone="gray">Inactive</Pill>}

          <span style={{ fontSize: 11.5, color: "#98A2B3", minWidth: 50, textAlign: "right", flexShrink: 0 }}>
            {totalItems} item{totalItems === 1 ? "" : "s"}
          </span>

          {n.level < MAX_CATEGORY_LEVEL && (
            <button
              type="button"
              title={`Add sub-category under ${n.categoryName}`}
              onClick={(e) => { e.stopPropagation(); startAdd(n.serviceCategoryId); }}
              style={{
                border: "none", background: "none", color: "#98A2B3",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                transition: "color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1570EF"; (e.currentTarget as HTMLButtonElement).style.background = "#EFF6FF"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#98A2B3"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              <Plus size={13} />
            </button>
          )}
        </div>
        {open && n.children.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{n.children.map(renderNode)}</ul>
        )}
      </li>
    );
  };

  const isAdding = mode?.kind === "add";
  const panelTitle = isAdding
    ? (parent ? `New category under "${parent.categoryName}"` : "New L1 Category")
    : selected
    ? pathOf(selected.serviceCategoryId)
    : null;
  const panelSub = isAdding
    ? `Level ${level} of ${MAX_CATEGORY_LEVEL}`
    : selected
    ? `${selected.categoryName} · Level ${level} of ${MAX_CATEGORY_LEVEL}`
    : null;

  return (
    <>
      <PageHeader
        crumb="Configuration > Service Request Management > Service Category"
        title="Service Category"
        subtitle={`Group catalog items in up to ${MAX_CATEGORY_LEVEL} levels. A catalog item can sit under a category at any level.`}
        action={
          <button className="btn-primary" onClick={() => startAdd(null)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} aria-hidden="true" /> Add L1 service category
          </button>
        }
      />

      <div className="page-body">
        <ErrorBar msg={cats.error ?? error} />

        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

          {/* LEFT: TREE */}
          <div className="card" style={{ flex: "0 0 55%", minWidth: 0, overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", borderBottom: "1px solid #E4E7EC",
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#344054", letterSpacing: "0.6px", textTransform: "uppercase" }}>
                Category Tree ({rows.length})
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px", height: 28 }} onClick={() => setExpanded(new Set(allIds))}>
                  Expand all
                </button>
                <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px", height: 28 }} onClick={() => setExpanded(new Set())}>
                  Collapse all
                </button>
              </div>
            </div>

            <div style={{ minHeight: 400 }}>
              {cats.loading && !cats.data
                ? <div className="spinner-row">Loading...</div>
                : tree.length === 0
                ? (
                  <div className="empty-state">
                    No categories yet.{" "}
                    <button
                      className="btn-ghost"
                      style={{ display: "inline", padding: 0, border: 0, color: "#1570EF", cursor: "pointer", background: "none" }}
                      onClick={() => startAdd(null)}
                    >
                      Add an L1 category
                    </button>{" "}to start.
                  </div>
                )
                : <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{tree.map(renderNode)}</ul>
              }
            </div>
          </div>

          {/* RIGHT: DETAILS */}
          <div className="card" style={{ flex: 1, minWidth: 0 }}>
            {!mode ? (
              <div className="empty-state" style={{ padding: "60px 24px" }}>
                Select a category from the tree or click <b>Add L1 category</b> to begin.
              </div>
            ) : (
              <>
                {/* header */}
                <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid #E4E7EC" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 4 }}>
                    Category Details
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#101828", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {panelTitle}
                    </span>
                    <span style={{ fontSize: 12, color: "#1570EF", fontWeight: 600, flexShrink: 0 }}>
                      {panelSub}
                    </span>
                  </div>
                </div>

                {/* fields */}
                <div style={{ padding: "20px 20px 0" }}>
                  <ErrorBar msg={error} />

                  <label className="field-group">
                    <span className="lbl">Category name <span className="req">*</span></span>
                    <input className="input" placeholder="e.g. Access Request" value={name} onChange={(e) => setName(e.target.value)} />
                  </label>

                  <label className="field-group" style={{ marginTop: 14 }}>
                    <span className="lbl">Description</span>
                    <textarea
                      className="textarea"
                      placeholder="What belongs in this category..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      style={{ minHeight: 80 }}
                    />
                  </label>

                  <div style={{ marginTop: 14, marginBottom: 20 }}>
                    <label className="admin-master-check-label" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                      <span style={{ fontSize: 13.5, color: "#344054" }}>Active -- shown in the Service Catalog</span>
                    </label>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    <button className="btn-primary" disabled={busy} onClick={() => void save()} style={{ height: 36, padding: "0 18px", alignSelf: "flex-start" }}>
                      {busy ? "Saving..." : mode.kind === "add" ? "Add category" : "Save category"}
                    </button>
                    {mode.kind === "add" && (
                      <button className="btn-ghost" onClick={() => setMode(null)} style={{ height: 36, padding: "0 14px", alignSelf: "flex-start" }}>Cancel</button>
                    )}
                  </div>
                </div>

                {selected && (
                  <div style={{ padding: "0 20px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                      <button
                        className="btn-ghost"
                        disabled={selected.level >= MAX_CATEGORY_LEVEL}
                        onClick={() => startAdd(selected.serviceCategoryId)}
                        style={{ justifyContent: "flex-start", gap: 6, height: 36, display: "flex", alignItems: "center" }}
                      >
                        <Plus size={13} aria-hidden="true" /> Add sub-category
                      </button>
                      <Link
                        to={`/admin/catalogs?category=${selected.serviceCategoryId}`}
                        className="btn-ghost"
                        style={{ display: "flex", alignItems: "center", gap: 6, height: 36, textDecoration: "none" }}
                      >
                        <Plus size={13} aria-hidden="true" /> Add catalog item here
                      </Link>
                    </div>

                    {selected.level >= MAX_CATEGORY_LEVEL && (
                      <div style={{ fontSize: 12, color: "#98A2B3", marginBottom: 12 }}>
                        Level {MAX_CATEGORY_LEVEL} is the deepest level -- no sub-category can be added here.
                      </div>
                    )}

                    <div style={{ borderTop: "1px solid #E4E7EC", paddingTop: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#344054", letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 10 }}>
                        Catalog items in this category ({items.length})
                      </div>
                      {items.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: "#98A2B3" }}>None directly under this category.</div>
                      ) : (
                        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                          {items.map((c) => (
                            <li key={c.catalogId} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#1570EF", fontWeight: 500 }}>
                              {c.catalogName}
                              {c.status !== "published" && <Pill tone="gray">Draft</Pill>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div style={{ borderTop: "1px solid #E4E7EC", paddingTop: 16, paddingBottom: 20 }}>
                      <button
                        className="btn-ghost"
                        disabled={busy || selected.childCount > 0 || selected.itemCount > 0}
                        onClick={() => void remove()}
                        style={{ color: "#D92D20", borderColor: "#FDA29B", display: "flex", alignItems: "center", gap: 6, height: 36 }}
                      >
                        <Trash2 size={13} aria-hidden="true" /> Delete category
                      </button>
                      {(selected.childCount > 0 || selected.itemCount > 0) && (
                        <div style={{ fontSize: 12, color: "#98A2B3", marginTop: 6 }}>
                          Move or remove its sub-categories and catalog items before deleting it.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}