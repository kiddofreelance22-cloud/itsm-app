import React, { useMemo, useState } from "react";
import { ConfigPage, Check, Lbl, uid, useDraft } from "../components/changeConfigKit";
import { useAsync } from "../hooks";
import { changeApi, categoryRows, MAX_CATEGORY_DEPTH, type Category } from "../changeApi";

/** Categories of changes, as a tree of up to five levels (same layout as Service Category). */
export function ChangeCategoriesPage() {
  const d = useDraft("categories");
  const wg = useAsync(() => changeApi.workgroups().catch(() => [] as { groupId: number; groupName: string }[]), []);
  const used = useAsync(() => changeApi.list().then((rows) => { const m: Record<string, number> = {}; rows.forEach((c) => { if (c.category) m[c.category] = (m[c.category] ?? 0) + 1; }); return m; }).catch(() => ({} as Record<string, number>)), []);
  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [local, setLocal] = useState("");

  const list = d.draft ?? [];
  const boards = d.cfg?.approval.groups.filter((g) => g.active) ?? [];
  const workgroups = wg.data ?? [];
  const byParent = useMemo(() => { const m = new Map<string | null, Category[]>(); list.forEach((c) => m.set(c.parentId ?? null, [...(m.get(c.parentId ?? null) ?? []), c])); return m; }, [list]);
  const depthOf = (id: string | null): number => { let n = 0, cur = list.find((c) => c.id === id); while (cur && n < 8) { n++; cur = cur.parentId ? list.find((c) => c.id === cur!.parentId) : undefined; } return n; };
  const descendants = (id: string): Set<string> => { const out = new Set<string>(); const walk = (x: string) => (byParent.get(x) ?? []).forEach((c) => { out.add(c.id); walk(c.id); }); walk(id); return out; };
  const subtreeHeight = (id: string): number => 1 + Math.max(0, ...(byParent.get(id) ?? []).map((c) => subtreeHeight(c.id)));
  const itemsUnder = (c: Category) => (used.data?.[c.name] ?? 0) + [...descendants(c.id)].reduce((n, x) => n + (used.data?.[list.find((y) => y.id === x)?.name ?? ""] ?? 0), 0);

  const visible = categoryRows(list).filter(({ c }) => { let p = c.parentId; while (p) { if (!open.has(p)) return false; p = list.find((x) => x.id === p)?.parentId ?? null; } return true; });
  const cur = list.find((c) => c.id === sel) ?? null;
  const set = (id: string, fn: (c: Category) => void) => d.edit((l) => { const c = l.find((x) => x.id === id); if (c) fn(c); });

  const add = (parentId: string | null) => {
    if (parentId && depthOf(parentId) >= MAX_CATEGORY_DEPTH) { setLocal(`Categories can be at most ${MAX_CATEGORY_DEPTH} levels deep.`); return; }
    const id = uid("cat"); setLocal("");
    d.edit((l) => { l.push({ id, name: "", parentId, desc: "", group: "", tab: "", active: true }); });
    if (parentId) setOpen((o) => new Set(o).add(parentId));
    setSel(id);
  };
  const remove = (c: Category) => {
    if (byParent.get(c.id)?.length) { setLocal(`"${c.name || "This category"}" has sub-categories. Move or delete them first.`); return; }
    setLocal(""); d.edit((l) => { l.splice(l.findIndex((x) => x.id === c.id), 1); }); setSel(null);
  };
  const allIds = list.filter((c) => byParent.get(c.id)?.length).map((c) => c.id);
  // Possible parents: not itself or a descendant, and shallow enough that the whole branch stays within the depth limit.
  const parentOptions = (c: Category) => { const bad = descendants(c.id); return categoryRows(list).filter(({ c: p, depth }) => p.id !== c.id && !bad.has(p.id) && depth + subtreeHeight(c.id) <= MAX_CATEGORY_DEPTH); };

  return (
    <ConfigPage d={d} crumb="Change Management > Categories" title="Change Categories" subtitle={`Group changes in up to ${MAX_CATEGORY_DEPTH} levels. A category supplies the default assignment group and technical board; a sub-category inherits them from its parent when left blank.`}
      extra={<button className="btn-ghost" onClick={() => add(null)}>Add category</button>}>
      {local && <div className="cm-note warn" style={{ marginBottom: 12 }}>{local}</div>}
      <div className="cm-grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <div className="cm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="cm-tree-head">
            <span>CATEGORY TREE ({list.length})</span>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost btn-sm" onClick={() => setOpen(new Set(allIds))}>Expand all</button>
              <button className="btn-ghost btn-sm" onClick={() => setOpen(new Set())}>Collapse all</button>
            </span>
          </div>
          {visible.length === 0 && <div className="cm-hint" style={{ padding: 18 }}>No categories yet. Use “Add category”.</div>}
          {visible.map(({ c, depth }) => {
            const kids = byParent.get(c.id)?.length ?? 0;
            return (
              <div key={c.id} className={`cm-tree-row${sel === c.id ? " on" : ""}${c.active ? "" : " off"}`} style={{ paddingLeft: 14 + (depth - 1) * 22 }} onClick={() => setSel(c.id)}>
                <button type="button" className="cm-tree-caret" aria-label={open.has(c.id) ? "Collapse" : "Expand"} style={{ visibility: kids ? "visible" : "hidden" }}
                  onClick={(e) => { e.stopPropagation(); setOpen((o) => { const n = new Set(o); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; }); }}>{open.has(c.id) ? "▾" : "▸"}</button>
                <span className="cm-tree-name">{c.name || <i>New category</i>}{!c.active && <span className="cm-hint"> (inactive)</span>}</span>
                <span className="badge" style={{ background: "#EFF8FF", color: "#175CD3" }}>L{depth}</span>
                <span className="cm-hint" style={{ width: 70, textAlign: "right" }}>{itemsUnder(c)} {itemsUnder(c) === 1 ? "change" : "changes"}</span>
                <button type="button" className="cm-tree-add" title="Add a sub-category" onClick={(e) => { e.stopPropagation(); add(c.id); }}>+</button>
              </div>
            );
          })}
        </div>

        <div className="cm-card">
          {!cur ? <div className="cm-hint" style={{ textAlign: "center", padding: "28px 0" }}>Select a category from the tree to edit it.</div> : (
            <>
              <div className="cm-card-title">Edit category</div>
              <div className="cm-form-grid" style={{ gridTemplateColumns: "1fr" }}>
                <Lbl label="Category name"><input className="input" value={cur.name} onChange={(e) => set(cur.id, (x) => { x.name = e.target.value; })} /></Lbl>
                <Lbl label="Description"><textarea className="textarea" rows={2} value={cur.desc} onChange={(e) => set(cur.id, (x) => { x.desc = e.target.value; })} /></Lbl>
                <Lbl label="Parent category" hint={`Level ${depthOf(cur.id)} of ${MAX_CATEGORY_DEPTH}.`}>
                  <select className="select" value={cur.parentId ?? ""} onChange={(e) => set(cur.id, (x) => { x.parentId = e.target.value || null; })}>
                    <option value="">None (top level)</option>
                    {parentOptions(cur).map(({ c, depth }) => <option key={c.id} value={c.id}>{"— ".repeat(depth - 1)}{c.name || "(unnamed)"}</option>)}
                  </select>
                </Lbl>
                <Lbl label="Default assignment group" hint={`Chosen from Configuration → Workgroup.${cur.group ? "" : " Blank: inherited from the parent category."}`}>
                  <select className="select" value={cur.group} onChange={(e) => set(cur.id, (x) => { x.group = e.target.value; })}>
                    <option value="">{wg.loading ? "Loading…" : "None / inherit"}</option>
                    {cur.group && !workgroups.some((g) => g.groupName === cur.group) && <option value={cur.group}>{cur.group} (not a workgroup)</option>}
                    {workgroups.map((g) => <option key={g.groupId} value={g.groupName}>{g.groupName}</option>)}
                  </select>
                </Lbl>
                <Lbl label="Technical board (Category TAB)" hint="Used by the “Category TAB” stage of the approval policy.">
                  <select className="select" value={cur.tab} onChange={(e) => set(cur.id, (x) => { x.tab = e.target.value; })}>
                    <option value="">None / inherit</option>{boards.map((g) => <option key={g.id}>{g.name}</option>)}
                  </select>
                </Lbl>
                <Check label="Active" hint="An inactive category is no longer offered on new changes." checked={cur.active} onChange={(v) => set(cur.id, (x) => { x.active = v; })} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button className="btn-ghost btn-sm" onClick={() => add(cur.id)}>Add sub-category</button>
                <button className="btn-danger btn-sm" onClick={() => remove(cur)}>Delete</button>
              </div>
              <div className="cm-hint" style={{ marginTop: 10 }}>A category used by existing changes can be deactivated but not deleted. Names must be unique across the whole tree.</div>
            </>
          )}
        </div>
      </div>
    </ConfigPage>
  );
}
