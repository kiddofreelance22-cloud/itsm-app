import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FolderTree, Search, X, ChevronRight, ChevronDown } from "lucide-react";
import { ApprovalRuleRow, MandatoryRule, ruleApi } from "../configApi";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, errMsg } from "../components/configKit";
import { api } from "../api";

const CONDITION_FIELDS_MANDATORY = ["Status", "Priority", "Category", "Pending Reason", "Classification", "Urgency", "Impact"];
const TARGET_FIELDS = ["Priority", "Impact", "Urgency", "Category", "Classification", "Assignment Group", "Assigned To", "Pending Reason", "On Hold Reason", "Resolution Notes", "Closure Code", "Feedback / Rating"];
const ACTIONS = ["Resolve", "Close", "Reopen"] as const;
const APPROVAL_TYPES = ["Closure Approval", "Change Approval", "Reopen Approval"];
const CONDITION_FIELDS_APPROVAL = ["Any Incident", "Priority", "Category", "Classification", "Impact"];

interface BrowseItem { id: string; label: string; parentId?: string | null }

function flattenTree(tree: any[], idKey = "categoryId", labelKey = "categoryName", parentId: string | null = null): BrowseItem[] {
  return (tree ?? []).flatMap((n) => {
    const id = String(n[idKey]);
    const label = String(n[labelKey]);
    return [{ id, label, parentId }, ...flattenTree(n.children ?? [], idKey, labelKey, id)];
  });
}

function TreeBrowseMultiModal({
  title,
  isOpen,
  onClose,
  nodes,
  selected,
  onApply,
}: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  nodes: BrowseItem[];
  selected: string[];
  onApply: (selected: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Set<string>>(new Set(selected));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setDraft(new Set(selected));
      setQuery("");
      setCollapsed(new Set());
    }
  }, [isOpen, selected]);

  const kids = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    const m = new Map<string | null, BrowseItem[]>();
    nodes.forEach((n) => {
      const p = n.parentId && ids.has(n.parentId) ? n.parentId : null;
      m.set(p, [...(m.get(p) ?? []), n]);
    });
    return m;
  }, [nodes]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { n: BrowseItem; depth: number; hasKids: boolean }[] = [];
    if (q) {
      nodes.filter((n) => n.label.toLowerCase().includes(q)).forEach((n) => out.push({ n, depth: 0, hasKids: false }));
      return out;
    }
    const walk = (parent: string | null, depth: number) => (kids.get(parent) ?? []).forEach((n) => {
      const c = kids.get(n.id) ?? [];
      out.push({ n, depth, hasKids: c.length > 0 });
      if (c.length && !collapsed.has(n.id)) walk(n.id, depth + 1);
    });
    walk(null, 0);
    return out;
  }, [nodes, kids, query, collapsed]);

  if (!isOpen) return null;

  const toggleSelect = (label: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div className="card" style={{ width: 560, maxWidth: "94vw", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E4E7EC" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{draft.size} item{draft.size === 1 ? "" : "s"} selected</div>
          </div>
          <button type="button" className="admin-master-icon-button" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: "12px 16px 8px", position: "relative" }}>
          <Search size={14} aria-hidden="true" style={{ position: "absolute", left: 28, top: 23, color: "#98A2B3" }} />
          <input className="input" autoFocus placeholder="Search by name…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>

        <div style={{ display: "flex", gap: 10, padding: "0 16px 8px", fontSize: 12 }}>
          <button type="button" className="btn-ghost" style={{ padding: "2px 8px", fontSize: 11.5 }}
            onClick={() => setDraft(new Set(rows.map((r) => r.n.label)))}>Select visible</button>
          <button type="button" className="btn-ghost" style={{ padding: "2px 8px", fontSize: 11.5 }}
            onClick={() => setDraft(new Set())}>Clear selection</button>
        </div>

        <div style={{ padding: "4px 12px 12px", overflow: "auto", flex: 1, minHeight: 200 }} role="listbox">
          {rows.length === 0 ? <div className="empty-state">No matching items.</div> : rows.map(({ n, depth, hasKids }) => {
            const isChecked = draft.has(n.label);
            return (
              <div key={n.id} onClick={() => toggleSelect(n.label)} role="option" aria-selected={isChecked}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", paddingLeft: 10 + depth * 20,
                  cursor: "pointer", borderRadius: 6, background: isChecked ? "#EFF4FC" : "transparent",
                  color: isChecked ? "#175CD3" : "#1D2433", fontWeight: isChecked ? 600 : 400, fontSize: 13,
                }}>
                {hasKids ? (
                  <button type="button" aria-label={collapsed.has(n.id) ? "Expand" : "Collapse"} className="admin-master-icon-button"
                    style={{ width: 20, height: 20 }} onClick={(e) => { e.stopPropagation(); toggleCollapse(n.id); }}>
                    {collapsed.has(n.id) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  </button>
                ) : <span style={{ width: 20, display: "inline-block" }} />}
                <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(n.label)} onClick={(e) => e.stopPropagation()} style={{ cursor: "pointer" }} />
                <span>{n.label}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 20px", borderTop: "1px solid #E4E7EC" }}>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => { onApply(Array.from(draft)); onClose(); }}>Apply Selection ({draft.size})</button>
        </div>
      </div>
    </div>
  );
}

function ChipMulti({ options, value, onChange, empty }: { options: string[]; value: string[]; onChange: (v: string[]) => void; empty?: string }) {
  if (!options.length) return <span style={{ fontSize: 12, color: "var(--muted)" }}>{empty ?? "No options configured."}</span>;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            style={{
              padding: "3px 10px", borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${on ? "#175CD3" : "#D0D5DD"}`, background: on ? "#EFF4FC" : "#fff", color: on ? "#175CD3" : "#475467",
            }}>{o}</button>
        );
      })}
    </span>
  );
}

const ruleCard: React.CSSProperties = { border: "1px solid #E4E7EC", borderRadius: 8, padding: "14px 16px", marginBottom: 12, background: "#fff" };
const sentence: React.CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 13, color: "#344054", marginTop: 10 };

function useSavedFlash() {
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(false), 2500); return () => clearTimeout(t); }, [saved]);
  return [saved, setSaved] as const;
}

// ───────────────────────── Mandatory Field Rules ─────────────────────────
export function MandatoryFieldRulesPage() {
  const rules = useAsync(() => ruleApi.mandatory(), []);
  const opts = useAsync(() => ruleApi.options(), []);
  const [list, setList] = useState<MandatoryRule[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useSavedFlash();
  const [picker, setPicker] = useState<{ ruleIndex: number; field: "Category" | "Classification" } | null>(null);

  const catTree = useAsync(() => api.get<any[]>("/categories/tree").catch(() => []), []);
  const clsData = useAsync(() => api.get<any[]>("/classifications").catch(() => []), []);

  const categoryNodes = useMemo(() => flattenTree(catTree.data ?? [], "categoryId", "categoryName"), [catTree.data]);
  const classificationNodes = useMemo(() => {
    return (clsData.data ?? []).filter((c: any) => c.isActive !== false).map((c: any) => ({
      id: String(c.classificationId),
      label: String(c.name),
      parentId: c.parentId ? String(c.parentId) : null,
    }));
  }, [clsData.data]);

  const rows = list ?? rules.data ?? [];
  const update = (i: number, patch: Partial<MandatoryRule>) => setList(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const activeCount = rows.filter((r) => r.isActive).length;

  const save = async () => {
    setSaving(true); setErr("");
    try {
      setList(await ruleApi.saveMandatory(rows)); setSaved(true);
    } catch (e) { setErr(errMsg(e, "Unable to save rules.")); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader crumb="Configuration > Incident Masters > Mandatory Field Rules" title="Mandatory Field Rules"
        subtitle="Define conditions under which a field becomes required on the incident record. For example: when Status is In Progress, Assignment Group becomes mandatory before the record can be saved." />
      <div className="page-body">
        <ErrorBar msg={rules.error ?? err} />
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div className="proto-eyebrow-title">Rules</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{activeCount} of {rows.length} active</div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
            Each rule reads as a sentence: <i>if [field] is [value], then [field] is mandatory</i>. Inactive rules are kept but not enforced.
          </div>

          {rules.loading ? <div className="spinner-row">Loading…</div> : rows.length === 0 && (
            <div className="empty-state">No mandatory field rules configured yet.</div>
          )}
          {rows.map((r, i) => (
            <div key={r.ruleId ?? `n${i}`} style={{ ...ruleCard, opacity: r.isActive ? 1 : 0.65 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input className="input" style={{ flex: 1 }} placeholder="Rule name (optional)" value={r.name} maxLength={200} onChange={(e) => update(i, { name: e.target.value })} />
                <label className="admin-master-check-label"><input type="checkbox" checked={r.isActive} onChange={(e) => update(i, { isActive: e.target.checked })} /> Active</label>
                <button type="button" className="admin-master-icon-button danger" title="Remove" aria-label="Remove rule" onClick={() => setList(rows.filter((_, idx) => idx !== i))}><Trash2 size={15} /></button>
              </div>
              <div style={sentence}>
                <b>If</b>
                <select className="select" style={{ width: 170 }} value={r.conditionField} onChange={(e) => update(i, { conditionField: e.target.value, conditionValues: [] })}>
                  {CONDITION_FIELDS_MANDATORY.map((f) => <option key={f}>{f}</option>)}
                </select>
                <b>is</b>
                {r.conditionField === "Category" || r.conditionField === "Classification" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    {r.conditionValues.map((val) => (
                      <span key={val} style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 14,
                        fontSize: 12, fontWeight: 600, border: "1px solid #175CD3", background: "#EFF4FC", color: "#175CD3",
                      }}>
                        {val}
                        <button type="button" aria-label={`Remove ${val}`} onClick={() => update(i, { conditionValues: r.conditionValues.filter((x) => x !== val) })}
                          style={{ border: "none", background: "none", cursor: "pointer", padding: 0, display: "flex", color: "#175CD3" }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <button type="button" className="btn-ghost" onClick={() => setPicker({ ruleIndex: i, field: r.conditionField as any })}
                      style={{ padding: "4px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <FolderTree size={13} /> Browse {r.conditionField}…
                    </button>
                  </span>
                ) : (
                  <ChipMulti options={opts.data?.[r.conditionField] ?? []} value={r.conditionValues} onChange={(v) => update(i, { conditionValues: v })}
                    empty={`No ${r.conditionField} values configured yet.`} />
                )}
              </div>
              <div style={sentence}>
                <b>then</b>
                <ChipMulti options={TARGET_FIELDS} value={r.targetFields} onChange={(v) => update(i, { targetFields: v })} />
                <b>is mandatory</b>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
            <button type="button" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => setList([...rows, { name: "", conditionField: "Status", conditionValues: [], targetFields: [], isActive: true }])}>
              <Plus size={14} /> Add Rule
            </button>
            <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Rules"}</button>
            {saved && <span style={{ color: "#067647", fontWeight: 600, fontSize: 13 }}>✓ Saved</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 14 }}>
            These rules are enforced by the server on every incident update: when a rule&apos;s condition matches and its target field is empty, the save is rejected until that field is filled in.
          </div>
        </div>
      </div>
      <TreeBrowseMultiModal
        title={picker?.field === "Category" ? "Browse & Select Categories" : "Browse & Select Classifications"}
        isOpen={picker !== null}
        onClose={() => setPicker(null)}
        nodes={picker?.field === "Category" ? categoryNodes : classificationNodes}
        selected={picker !== null ? (rows[picker.ruleIndex]?.conditionValues ?? []) : []}
        onApply={(selected) => {
          if (picker !== null) update(picker.ruleIndex, { conditionValues: selected });
        }}
      />
    </>
  );
}

// ───────────────────────── Approval Configuration ─────────────────────────
export function ApprovalConfigurationPage() {
  const rules = useAsync(() => ruleApi.approval(), []);
  const opts = useAsync(() => ruleApi.options(), []);
  const [list, setList] = useState<ApprovalRuleRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useSavedFlash();
  const [picker, setPicker] = useState<{ ruleIndex: number; field: "Category" | "Classification" } | null>(null);

  const catTree = useAsync(() => api.get<any[]>("/categories/tree").catch(() => []), []);
  const clsData = useAsync(() => api.get<any[]>("/classifications").catch(() => []), []);

  const categoryNodes = useMemo(() => flattenTree(catTree.data ?? [], "categoryId", "categoryName"), [catTree.data]);
  const classificationNodes = useMemo(() => {
    return (clsData.data ?? []).filter((c: any) => c.isActive !== false).map((c: any) => ({
      id: String(c.classificationId),
      label: String(c.name),
      parentId: c.parentId ? String(c.parentId) : null,
    }));
  }, [clsData.data]);

  const rows = list ?? rules.data ?? [];
  const update = (i: number, patch: Partial<ApprovalRuleRow>) => setList(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const activeCount = rows.filter((r) => r.isActive).length;

  const save = async () => {
    setSaving(true); setErr("");
    try { setList(await ruleApi.saveApproval(rows)); setSaved(true); }
    catch (e) { setErr(errMsg(e, "Unable to save rules.")); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader crumb="Configuration > Others > Approval Configuration" title="Approval Configuration"
        subtitle="Define when an incident must get sign-off before it can be Resolved, Closed, or Reopened. For example: Close requires Closure Approval when Priority is 1 - High." />
      <div className="page-body">
        <ErrorBar msg={rules.error ?? err} />
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div className="proto-eyebrow-title">Rules</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{activeCount} of {rows.length} active</div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
            Each rule reads as a sentence: <i>[Action] requires [Approval Type] when [field] is [value(s)]</i>. Inactive rules are kept but not enforced.
            These rules are checked on the Incident Record before Resolve, Close, or Reopen goes through.
          </div>

          {rules.loading ? <div className="spinner-row">Loading…</div> : rows.length === 0 && (
            <div className="empty-state">No approval rules configured yet — every incident can be Resolved, Closed, and Reopened without sign-off.</div>
          )}
          {rows.map((r, i) => (
            <div key={r.ruleId ?? `n${i}`} style={{ ...ruleCard, opacity: r.isActive ? 1 : 0.65 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input className="input" style={{ flex: 1 }} placeholder="Rule name (optional)" value={r.name} maxLength={200} onChange={(e) => update(i, { name: e.target.value })} />
                <label className="admin-master-check-label"><input type="checkbox" checked={r.isActive} onChange={(e) => update(i, { isActive: e.target.checked })} /> Active</label>
                <button type="button" className="admin-master-icon-button danger" title="Remove" aria-label="Remove rule" onClick={() => setList(rows.filter((_, idx) => idx !== i))}><Trash2 size={15} /></button>
              </div>
              <div style={sentence}>
                <select className="select" style={{ width: 120 }} value={r.action} onChange={(e) => update(i, { action: e.target.value as ApprovalRuleRow["action"] })}>
                  {ACTIONS.map((a) => <option key={a}>{a}</option>)}
                </select>
                <b>requires</b>
                <select className="select" style={{ width: 180 }} value={r.approvalType} onChange={(e) => update(i, { approvalType: e.target.value })}>
                  {APPROVAL_TYPES.map((a) => <option key={a}>{a}</option>)}
                </select>
                <b>when</b>
                <select className="select" style={{ width: 160 }} value={r.conditionField} onChange={(e) => update(i, { conditionField: e.target.value, conditionValues: [] })}>
                  {CONDITION_FIELDS_APPROVAL.map((f) => <option key={f}>{f}</option>)}
                </select>
                {r.conditionField === "Any Incident" ? <span style={{ color: "var(--muted)" }}>(every incident)</span> : (
                  <>
                    <b>is</b>
                    {r.conditionField === "Category" || r.conditionField === "Classification" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                        {r.conditionValues.map((val) => (
                          <span key={val} style={{
                            display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 14,
                            fontSize: 12, fontWeight: 600, border: "1px solid #175CD3", background: "#EFF4FC", color: "#175CD3",
                          }}>
                            {val}
                            <button type="button" aria-label={`Remove ${val}`} onClick={() => update(i, { conditionValues: r.conditionValues.filter((x) => x !== val) })}
                              style={{ border: "none", background: "none", cursor: "pointer", padding: 0, display: "flex", color: "#175CD3" }}>
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                        <button type="button" className="btn-ghost" onClick={() => setPicker({ ruleIndex: i, field: r.conditionField as any })}
                          style={{ padding: "4px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <FolderTree size={13} /> Browse {r.conditionField}…
                        </button>
                      </span>
                    ) : (
                      <ChipMulti options={opts.data?.[r.conditionField] ?? []} value={r.conditionValues} onChange={(v) => update(i, { conditionValues: v })}
                        empty={`No ${r.conditionField} values configured yet.`} />
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
            <button type="button" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => setList([...rows, { name: "", action: "Close", approvalType: "Closure Approval", conditionField: "Any Incident", conditionValues: [], isActive: true }])}>
              <Plus size={14} /> Add Rule
            </button>
            <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Rules"}</button>
            {saved && <span style={{ color: "#067647", fontWeight: 600, fontSize: 13 }}>✓ Saved</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 14 }}>
            When a rule&apos;s condition matches on the Incident Record, that action is blocked and a request of the matching Approval Type is auto-submitted to Approve Incident Records.
            The action becomes available again as soon as that request is Approved there.
          </div>
        </div>
      </div>
      <TreeBrowseMultiModal
        title={picker?.field === "Category" ? "Browse & Select Categories" : "Browse & Select Classifications"}
        isOpen={picker !== null}
        onClose={() => setPicker(null)}
        nodes={picker?.field === "Category" ? categoryNodes : classificationNodes}
        selected={picker !== null ? (rows[picker.ruleIndex]?.conditionValues ?? []) : []}
        onApply={(selected) => {
          if (picker !== null) update(picker.ruleIndex, { conditionValues: selected });
        }}
      />
    </>
  );
}
