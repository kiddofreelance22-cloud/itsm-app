import React, { useEffect, useMemo, useRef, useState } from "react";

const p2 = (n: number) => String(n).padStart(2, "0");
const toValue = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
const parse = (v?: string) => { if (!v) return null; const d = new Date(v); return isNaN(+d) ? null : d; };
const show = (d: Date | null) => (d ? `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}` : "");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Date and time field with a pop-up calendar. The choice is only applied when OK is pressed (Cancel or a click outside leaves the value as it was),
 * which the browser's built-in picker does not offer. Values use the datetime-local format, "YYYY-MM-DDTHH:mm".
 */
export function DateTimePicker({ value, onChange, min, placeholder = "dd-mm-yyyy --:--", id }: { value: string; onChange: (v: string) => void; min?: string; placeholder?: string; id?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);
  const [view, setView] = useState<Date>(new Date());
  const root = useRef<HTMLDivElement>(null);
  const current = parse(value), minD = parse(min);

  const openIt = () => {
    const base = current ?? (minD && minD > new Date() ? minD : new Date());
    const start = current ?? new Date(base.getFullYear(), base.getMonth(), base.getDate(), base.getHours(), 0);
    setDraft(start); setView(new Date(start.getFullYear(), start.getMonth(), 1)); setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1), lead = first.getDay();
    return Array.from({ length: 42 }, (_, i) => new Date(view.getFullYear(), view.getMonth(), 1 - lead + i));
  }, [view]);
  const pickDay = (d: Date) => { const b = draft ?? new Date(); setDraft(new Date(d.getFullYear(), d.getMonth(), d.getDate(), b.getHours(), b.getMinutes())); };
  const setTime = (h?: number, m?: number) => { const b = draft ?? new Date(); setDraft(new Date(b.getFullYear(), b.getMonth(), b.getDate(), h ?? b.getHours(), m ?? b.getMinutes())); };
  const today = new Date();
  const same = (a: Date, b: Date | null) => !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const tooEarly = (d: Date) => !!minD && new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59) < minD;
  const draftBeforeMin = !!draft && !!minD && draft < minD;
  const ok = () => { if (draft && !draftBeforeMin) { onChange(toValue(draft)); setOpen(false); } };

  return (
    <div className="cm-dtp" ref={root}>
      <button type="button" id={id} className="input cm-dtp-field" onClick={() => (open ? setOpen(false) : openIt())} aria-haspopup="dialog" aria-expanded={open}>
        <span style={{ color: current ? "var(--ink)" : "var(--muted-2)" }}>{current ? show(current) : placeholder}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
      </button>
      {open && (
        <div className="cm-dtp-pop" role="dialog" aria-label="Choose date and time">
          <div style={{ display: "flex" }}>
            <div className="cm-dtp-cal">
              <div className="cm-dtp-nav">
                <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
                <b>{MONTHS[view.getMonth()]} {view.getFullYear()}</b>
                <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} aria-label="Next month">›</button>
              </div>
              <div className="cm-dtp-grid">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d} className="cm-dtp-dow">{d}</span>)}
                {cells.map((d) => (
                  <button key={+d} type="button" disabled={tooEarly(d)} onClick={() => pickDay(d)}
                    className={`cm-dtp-day${d.getMonth() !== view.getMonth() ? " out" : ""}${same(d, draft) ? " sel" : ""}${same(d, today) ? " today" : ""}`}>{d.getDate()}</button>
                ))}
              </div>
            </div>
            <div className="cm-dtp-time">
              <div className="cm-dtp-col" aria-label="Hour">{Array.from({ length: 24 }, (_, h) => <button key={h} type="button" ref={(el) => { if (el && draft?.getHours() === h) el.scrollIntoView?.({ block: "nearest" }); }} className={draft?.getHours() === h ? "sel" : ""} onClick={() => setTime(h, undefined)}>{p2(h)}</button>)}</div>
              <div className="cm-dtp-col" aria-label="Minute">{Array.from({ length: 60 }, (_, m) => <button key={m} type="button" ref={(el) => { if (el && draft?.getMinutes() === m) el.scrollIntoView?.({ block: "nearest" }); }} className={draft?.getMinutes() === m ? "sel" : ""} onClick={() => setTime(undefined, m)}>{p2(m)}</button>)}</div>
            </div>
          </div>
          {draftBeforeMin && <div className="cm-note bad" style={{ margin: "6px 10px 0" }}>Choose a time after {show(minD)}.</div>}
          <div className="cm-dtp-foot">
            <button type="button" className="cm-dtp-link" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
            <button type="button" className="cm-dtp-link" onClick={() => { const n = new Date(); n.setSeconds(0, 0); setDraft(n); setView(new Date(n.getFullYear(), n.getMonth(), 1)); }}>Today</button>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn-primary btn-sm" disabled={!draft || draftBeforeMin} onClick={ok}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
