import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, X } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { BrowsePicker, treeToNodes } from "../components/BrowsePicker";
import { ErrorBar, Eyebrow, PageHeader, SearchBox, StatusPill, TH, errMsg } from "../components/configKit";

type Raw = Record<string, any>;
interface CatNode { categoryId: number; categoryName: string; children?: CatNode[] }
interface Task { taskName: string; taskStatus: string; remarks: string; isActive: boolean }
const TASK_STATUSES = ["Not Applicable", "Mandatory", "Optional"];
const blankTask = (): Task => ({ taskName: "", taskStatus: "Optional", remarks: "", isActive: true });

/** Flatten the category tree into "Hardware › RAM Issue" style options. */
function flattenCats(nodes: CatNode[], trail: string[] = []): { id: number; path: string }[] {
  return nodes.flatMap((n) => {
    const path = [...trail, n.categoryName];
    return [{ id: n.categoryId, path: path.join(" › ") }, ...flattenCats(n.children ?? [], path)];
  });
}

const blankForm = (order: number) => ({
  name: "", description: "", displayOrder: order, isActive: true,
  statusName: "", groupId: "", categoryId: "", includeSubCategories: false, tasks: [blankTask()] as Task[],
});

/**
 * Configuration > Incident Masters > Checklist.
 * A checklist is visible on an incident only when the incident's Status, Workgroup and Category match the
 * template's scope (Workgroup "All" matches every workgroup; "Include Sub-Categories" extends the category match downwards).
 */
export function ChecklistsPage() {
  const crumb = "Configuration > Incident Masters > Checklists";
  const list = useAsync(() => api.get<Raw[]>("/checklists"), []);
  const statuses = useAsync(() => api.get<Raw[]>("/status").catch(() => []), []);
  const groups = useAsync(() => api.get<Raw[]>("/assignment-groups").catch(() => []), []);
  const cats = useAsync(() => api.get<CatNode[]>("/categories/tree").catch(() => []), []);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<"new" | Raw | null>(null);
  const [form, setForm] = useState(blankForm(1));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const items = list.data ?? [];
  const catOptions = useMemo(() => flattenCats(cats.data ?? []), [cats.data]);
  const catLabel = (id?: number | string | null) => catOptions.find((c) => String(c.id) === String(id))?.path ?? "";
  const groupLabel = (id?: number | null) => (id ? (groups.data ?? []).find((g) => g.groupId === id)?.groupName ?? `#${id}` : "All");
  const browseNodes = useMemo(() => treeToNodes(cats.data, "categoryId", "categoryName"), [cats.data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...items].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.id - b.id)
      .filter((i) => !q || `${i.name} ${i.description ?? ""} ${i.statusName ?? ""} ${catLabel(i.categoryId)} ${groupLabel(i.groupId)}`.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, catOptions, groups.data]);

  const openAdd = () => { setForm(blankForm(items.length + 1)); setErr(""); setEditing("new"); };
  const openEdit = (i: Raw) => {
    setForm({
      name: i.name ?? "", description: i.description ?? "", displayOrder: i.displayOrder ?? 0, isActive: i.isActive !== false,
      statusName: i.statusName ?? "", groupId: i.groupId ? String(i.groupId) : "", categoryId: i.categoryId ? String(i.categoryId) : "",
      includeSubCategories: !!i.includeSubCategories, tasks: (i.tasks ?? []).length ? (i.tasks as Task[]).map((t) => ({ ...t })) : [blankTask()],
    });
    setErr(""); setEditing(i);
  };

  const setTask = (idx: number, patch: Partial<Task>) => setForm((f) => ({ ...f, tasks: f.tasks.map((t, i) => (i === idx ? { ...t, ...patch } : t)) }));
  const moveTask = (idx: number, dir: -1 | 1) => setForm((f) => {
    const to = idx + dir; if (to < 0 || to >= f.tasks.length) return f;
    const tasks = [...f.tasks]; [tasks[idx], tasks[to]] = [tasks[to], tasks[idx]];
    return { ...f, tasks };
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("Checklist Name");
    if (!form.tasks.some((t) => t.taskName.trim())) missing.push("at least one Task Name");
    if (missing.length) { setErr(`Please fill in: ${missing.join(", ")}.`); return; }
    const body = {
      name: form.name.trim(), description: form.description.trim() || null, displayOrder: Number(form.displayOrder) || 0, isActive: form.isActive,
      statusName: form.statusName || null, groupId: form.groupId ? Number(form.groupId) : null, categoryId: form.categoryId ? Number(form.categoryId) : null,
      includeSubCategories: form.categoryId ? form.includeSubCategories : false,
      tasks: form.tasks.filter((t) => t.taskName.trim()).map((t) => ({ taskName: t.taskName.trim(), taskStatus: t.taskStatus, remarks: t.remarks.trim(), isActive: t.isActive })),
    };
    setSaving(true); setErr("");
    try {
      if (editing === "new") await api.post("/checklists", body); else if (editing) await api.patch(`/checklists/${editing.id}`, body);
      setEditing(null); list.reload();
    } catch (x) { setErr(errMsg(x, "Unable to save the checklist.")); }
    finally { setSaving(false); }
  };

  if (editing) {
    return (
      <>
        <PageHeader crumb={crumb} title="Checklists" subtitle="Define reusable checklist templates agents can attach while working an incident." />
        <div className="page-body">
          <form className="card admin-master-form-panel" onSubmit={save}>
            <div className="admin-master-form-heading">
              <h2>{editing === "new" ? "Add Checklist" : "Edit Checklist"}</h2>
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>← Back to Checklists</button>
            </div>
            <ErrorBar msg={err} />
            <div className="admin-master-form-grid">
              <label className="field-group admin-master-wide">
                <span className="lbl">Checklist Name <span className="req">*</span></span>
                <input className="input" value={form.name} maxLength={150} autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="field-group admin-master-wide">
                <span className="lbl">Description</span>
                <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>

              <div className="admin-master-wide" style={{ fontSize: 11, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.5px" }}>VISIBILITY — WHERE THIS CHECKLIST APPEARS <span style={{ fontWeight: 400 }}>(leave a field empty to match any)</span></div>
              <label className="field-group">
                <span className="lbl">Status (optional)</span>
                <select className="select" value={form.statusName} onChange={(e) => setForm({ ...form, statusName: e.target.value })}>
                  <option value="">Any status</option>
                  {(statuses.data ?? []).filter((s) => s.isActive !== false).map((s) => <option key={s.statusId ?? s.statusName} value={s.statusName}>{s.statusName}</option>)}
                </select>
              </label>
              <label className="field-group">
                <span className="lbl">Workgroup</span>
                <select className="select" value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
                  <option value="">All workgroups</option>
                  {(groups.data ?? []).filter((g) => g.isActive !== false).map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}
                </select>
              </label>
              <div className="field-group">
                <span className="lbl">Category (optional)</span>
                <BrowsePicker title="Select Category" ariaLabel="Category" value={form.categoryId} label={catLabel(form.categoryId)} clearable nodes={browseNodes}
                  placeholder="Any category — click Browse to narrow down…" onSelect={(n) => setForm({ ...form, categoryId: n?.id ?? "" })} />
              </div>
              <div className="field-group">
                <span className="lbl">Include Sub-Categories</span>
                <span className="admin-master-check-label">
                  <input type="checkbox" disabled={!form.categoryId} checked={form.includeSubCategories} onChange={(e) => setForm({ ...form, includeSubCategories: e.target.checked })} /> Also show for everything nested under this category
                </span>
              </div>

              <label className="field-group">
                <span className="lbl">Display Order</span>
                <input className="input" type="number" min={0} value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
              </label>
              <div className="field-group">
                <span className="lbl">Status</span>
                <span className="admin-master-check-label">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
                </span>
              </div>

              <div className="admin-master-wide">
                <div style={{ fontSize: 11, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.5px", marginBottom: 6 }}>TASKS</div>
                <div style={{ fontSize: 12, color: "#667085", marginBottom: 8 }}>
                  Use the arrows to re-arrange the sequence. <b>Mandatory</b> tasks must be ticked before the incident can be resolved; <b>Not Applicable</b> tasks are hidden from agents.
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ minWidth: 760 }}>
                    <thead><tr>
                      <th style={{ ...TH, width: 90 }}>SEQUENCE</th><th style={TH}>TASK NAME <span className="req">*</span></th>
                      <th style={{ ...TH, width: 160 }}>TASK STATUS</th><th style={{ ...TH, width: 220 }}>REMARKS</th><th style={{ ...TH, width: 70 }}>ACTIVE</th><th style={{ width: 40 }} />
                    </tr></thead>
                    <tbody>
                      {form.tasks.map((t, idx) => (
                        <tr key={idx}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                              <span className="numbered-badge" style={{ marginRight: 6 }}>{idx + 1}</span>
                              <button type="button" className="admin-master-icon-button" aria-label="Move up" disabled={idx === 0} onClick={() => moveTask(idx, -1)}><ArrowUp size={13} /></button>
                              <button type="button" className="admin-master-icon-button" aria-label="Move down" disabled={idx === form.tasks.length - 1} onClick={() => moveTask(idx, 1)}><ArrowDown size={13} /></button>
                            </div>
                          </td>
                          <td><input className="input" aria-label={`Task ${idx + 1} name`} value={t.taskName} maxLength={250} onChange={(e) => setTask(idx, { taskName: e.target.value })} /></td>
                          <td><select className="select" aria-label={`Task ${idx + 1} status`} value={t.taskStatus} onChange={(e) => setTask(idx, { taskStatus: e.target.value })}>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
                          <td><input className="input" aria-label={`Task ${idx + 1} remarks`} value={t.remarks} maxLength={500} onChange={(e) => setTask(idx, { remarks: e.target.value })} /></td>
                          <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={`Task ${idx + 1} active`} checked={t.isActive} onChange={(e) => setTask(idx, { isActive: e.target.checked })} /></td>
                          <td><button type="button" className="admin-master-icon-button danger" aria-label={`Remove task ${idx + 1}`} disabled={form.tasks.length === 1} onClick={() => setForm({ ...form, tasks: form.tasks.filter((_, i) => i !== idx) })}><X size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setForm({ ...form, tasks: [...form.tasks, blankTask()] })}><Plus size={14} aria-hidden="true" /> Add Task</button>
              </div>
            </div>
            <div className="admin-master-form-actions">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
            </div>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader crumb={crumb} title="Checklists" subtitle="Define reusable checklist templates agents can attach while working an incident." />
      <div className="page-body">
        <ErrorBar msg={list.error ?? ""} />
        <div className="card admin-master-table-wrap">
          <Eyebrow title={<>Checklists ( {list.loading ? "…" : items.length} )</>}
            action={<button className="btn-primary admin-master-add" onClick={openAdd}><Plus size={15} aria-hidden="true" /> Add Checklist</button>} />
          <div style={{ padding: "0 20px 14px" }}><SearchBox value={query} onChange={setQuery} placeholder="Search checklists…" /></div>
          {list.loading ? <div className="spinner-row">Loading…</div> : filtered.length === 0 ? (
            <div className="empty-state">{query ? `No checklists match "${query}".` : "No checklists yet."}</div>
          ) : (
            <div style={{ padding: "0 20px 20px", overflowX: "auto" }}>
              <table style={{ minWidth: 820 }}>
                <thead><tr>
                  <th style={{ width: 44 }} /><th style={TH}>CHECKLIST</th><th style={{ ...TH, width: 120 }}>STATUS</th><th style={{ ...TH, width: 150 }}>WORKGROUP</th>
                  <th style={{ ...TH, width: 200 }}>CATEGORY</th><th style={{ ...TH, width: 70 }}>TASKS</th><th style={{ ...TH, width: 100 }}>STATE</th><th style={{ width: 44 }} />
                </tr></thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id}>
                      <td style={{ verticalAlign: "top", paddingTop: 14 }}><div className="numbered-badge">{i.displayOrder ?? 0}</div></td>
                      <td><div style={{ fontWeight: 600, fontSize: 13 }}>{i.name}</div>{i.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{i.description}</div>}</td>
                      <td style={{ fontSize: 12.5 }}>{i.statusName || "Any"}</td>
                      <td style={{ fontSize: 12.5 }}>{groupLabel(i.groupId)}</td>
                      <td style={{ fontSize: 12.5 }}>{i.categoryId ? <>{catLabel(i.categoryId) || `#${i.categoryId}`}{i.includeSubCategories && <span className="chip" style={{ marginLeft: 6, fontSize: 11 }}>+ sub</span>}</> : "Any"}</td>
                      <td style={{ fontSize: 12.5 }}>{(i.tasks ?? []).length}</td>
                      <td><StatusPill active={i.isActive !== false} /></td>
                      <td className="admin-master-actions"><button className="admin-master-icon-button" title="Edit" aria-label={`Edit ${i.name}`} onClick={() => openEdit(i)}><Pencil size={15} aria-hidden="true" /></button></td>
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
