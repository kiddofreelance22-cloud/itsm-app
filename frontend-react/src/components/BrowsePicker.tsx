import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";

export interface BrowseNode { id: string; label: string; parentId?: string | null; disabled?: boolean }

interface Props {
  /** Dialog title, e.g. "Select Incident Category". */
  title: string;
  /** Currently selected id ("" = nothing). */
  value: string;
  /** Text shown in the box for the selected value. */
  label: string;
  /** Flat list of nodes; hierarchy comes from parentId. */
  nodes: BrowseNode[];
  onSelect: (node: BrowseNode | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Show a Clear button (use for optional fields). */
  clearable?: boolean;
  ariaLabel?: string;
}

/** Builds BrowseNodes out of a nested tree such as /categories/tree. */
export function treeToNodes(tree: any[] | null | undefined, idKey: string, labelKey: string, childKey = "children", parentId: string | null = null): BrowseNode[] {
  return (tree ?? []).flatMap((n) => {
    const id = String(n[idKey]);
    return [{ id, label: String(n[labelKey]), parentId } as BrowseNode, ...treeToNodes(n[childKey] as any[] | undefined, idKey, labelKey, childKey, id)];
  });
}

/**
 * "Browse" field: a read-only box plus a Browse button that opens a searchable, expandable list.
 * Use this instead of a <select> when the list is a hierarchy or can get long (Category, Classification).
 */
export function BrowsePicker({ title, value, label, nodes, onSelect, placeholder, disabled, clearable, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string>("");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const kids = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    const m = new Map<string | null, BrowseNode[]>();
    nodes.forEach((n) => {
      const p = n.parentId && ids.has(n.parentId) ? n.parentId : null;
      m.set(p, [...(m.get(p) ?? []), n]);
    });
    return m;
  }, [nodes]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { n: BrowseNode; depth: number; hasKids: boolean }[] = [];
    if (q) {
      // While searching show a flat list of matches.
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

  const openPicker = () => { if (disabled) return; setPending(value); setQuery(""); setCollapsed(new Set()); setOpen(true); };
  const toggle = (id: string) => setCollapsed((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });

  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <input className="input" readOnly aria-label={ariaLabel ?? title} value={label} placeholder={placeholder ?? "Click Browse to select…"} disabled={disabled}
          onClick={openPicker} style={{ cursor: disabled ? "not-allowed" : "pointer" }} />
        <button type="button" className="btn-ghost" disabled={disabled} onClick={openPicker}>Browse</button>
        {clearable && value && !disabled && <button type="button" className="btn-ghost" aria-label={`Clear ${ariaLabel ?? title}`} onClick={() => onSelect(null)}>Clear</button>}
      </div>
      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}
          style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
          <div className="card" style={{ width: 520, maxWidth: "94vw", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E4E7EC" }}>
              <div style={{ fontWeight: 700 }}>{title}</div>
              <button type="button" className="admin-master-icon-button" aria-label="Close" onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: "10px 16px 0", position: "relative" }}>
              <Search size={14} aria-hidden="true" style={{ position: "absolute", left: 26, top: 21, color: "#98A2B3" }} />
              <input className="input" autoFocus placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 32 }} aria-label="Search options" />
            </div>
            <div style={{ padding: "8px 12px", overflow: "auto" }} role="listbox">
              {rows.length === 0 ? <div className="empty-state">{query ? "No matches found." : "Nothing to choose from."}</div> : rows.map(({ n, depth, hasKids }) => {
                const sel = pending === n.id;
                return (
                  <div key={n.id} role="option" aria-selected={sel} onClick={() => { if (!n.disabled) setPending(n.id); }} onDoubleClick={() => { if (!n.disabled) { onSelect(n); setOpen(false); } }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", paddingLeft: 12 + depth * 20, cursor: n.disabled ? "not-allowed" : "pointer", borderRadius: 6,
                      background: sel ? "#EFF4FC" : "transparent", color: sel ? "#175CD3" : "#1D2433", fontWeight: sel ? 600 : 400, fontSize: 13.5, opacity: n.disabled ? 0.5 : 1 }}>
                    {hasKids
                      ? <button type="button" aria-label={collapsed.has(n.id) ? "Expand" : "Collapse"} className="admin-master-icon-button" style={{ width: 20, height: 20 }} onClick={(e) => { e.stopPropagation(); toggle(n.id); }}>
                          {collapsed.has(n.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
                      : <span style={{ width: 20, display: "inline-block" }} />}
                    <span>{n.label}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 20px", borderTop: "1px solid #E4E7EC" }}>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary" disabled={!pending} onClick={() => { onSelect(nodes.find((n) => n.id === pending) ?? null); setOpen(false); }}>Select and Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
