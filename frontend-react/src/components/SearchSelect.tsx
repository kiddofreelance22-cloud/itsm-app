import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

export interface SearchOption { value: string; label: string; sub?: string }

interface Props {
  /** Currently selected value ("" = nothing selected). */
  value: string;
  /** Text shown for the selected value while the box is closed. */
  label: string;
  onSelect: (opt: SearchOption | null) => void;
  /** Local options, filtered as the person types. */
  options?: SearchOption[];
  /** Remote search (debounced). Takes precedence over `options`. */
  fetchOptions?: (query: string) => Promise<SearchOption[]>;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  emptyText?: string;
}

/**
 * A text box that searches as you type and picks one result — used instead of a long drop-down
 * wherever the list can be big (callers, categories).
 */
export function SearchSelect({ value, label, onSelect, options, fetchOptions, placeholder, disabled, ariaLabel, emptyText = "No matches found." }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<SearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Remote search, debounced; a stale answer never overwrites a newer one.
  useEffect(() => {
    if (!open || !fetchOptions) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetchOptions(query).then((r) => { if (!cancelled) setRemote(r); }).catch(() => { if (!cancelled) setRemote([]); }).finally(() => { if (!cancelled) setLoading(false); });
    }, query ? 200 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, open, fetchOptions]);

  const shown = useMemo(() => {
    if (fetchOptions) return remote;
    const q = query.trim().toLowerCase();
    const all = options ?? [];
    return (q ? all.filter((o) => `${o.label} ${o.sub ?? ""}`.toLowerCase().includes(q)) : all).slice(0, 100);
  }, [fetchOptions, remote, options, query]);

  useEffect(() => { setActive(0); }, [shown]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) { setOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (o: SearchOption | null) => { onSelect(o); setOpen(false); setQuery(""); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, Math.max(shown.length - 1, 0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open) { e.preventDefault(); if (shown[active]) pick(shown[active]); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          className="input" style={{ paddingRight: 34 }} disabled={disabled} aria-label={ariaLabel} role="combobox" aria-expanded={open}
          autoComplete="off" placeholder={placeholder ?? "Search…"} value={open ? query : label}
          onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onKeyDown={onKeyDown}
        />
        <Search size={14} aria-hidden="true" style={{ position: "absolute", right: 10, color: "#98A2B3", pointerEvents: "none" }} />
      </div>
      {open && !disabled && (
        <div role="listbox" style={{ position: "absolute", zIndex: 40, left: 0, right: 0, top: "calc(100% + 4px)", maxHeight: 260, overflowY: "auto", background: "#fff", border: "1px solid #D0D5DD", borderRadius: 8, boxShadow: "0 8px 24px rgba(16,24,40,0.12)" }}>
          {loading && <div style={{ padding: "10px 12px", fontSize: 12.5, color: "#667085" }}>Searching…</div>}
          {!loading && shown.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12.5, color: "#667085" }}>{fetchOptions && !query.trim() ? "Type to search or select an option…" : emptyText}</div>}
          {shown.map((o, i) => (
            <div key={o.value} role="option" aria-selected={o.value === value} onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}
              style={{ padding: "8px 12px", cursor: "pointer", background: i === active ? "#EFF4FC" : "transparent", borderBottom: "1px solid #F2F4F7" }}>
              <div style={{ fontSize: 13, fontWeight: o.value === value ? 700 : 500, color: "#1D2433" }}>{o.label}</div>
              {o.sub && <div style={{ fontSize: 11.5, color: "#667085" }}>{o.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
