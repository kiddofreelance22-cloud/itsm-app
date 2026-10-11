import React, { useState } from "react";

export type Raw = Record<string, any>;

/** What a requester sees: the real status. Only "Open" is shown as "New". */
export function userStatus(s: string): string {
  return s === "Open" ? "New" : s;
}
export const USER_STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  New: { bg: "#F2F4F7", color: "#344054", dot: "#98A2B3" }, "In Progress": { bg: "#EFF4FC", color: "#175CD3", dot: "#175CD3" },
  Assigned: { bg: "#F0F9FF", color: "#026AA2", dot: "#0BA5EC" }, "On Hold": { bg: "#FFFAEB", color: "#B54708", dot: "#F79009" },
  "Pending Customer": { bg: "#FFF6ED", color: "#B93815", dot: "#EF6820" },
  Resolved: { bg: "#ECFDF3", color: "#067647", dot: "#12B76A" }, Closed: { bg: "#F2F4F7", color: "#667085", dot: "#98A2B3" }, Cancelled: { bg: "#F2F4F7", color: "#667085", dot: "#98A2B3" },
};
export const USER_PRIORITY_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  Critical: { bg: "#FEE4E2", color: "#912018", dot: "#B42318" }, High: { bg: "#FEF3F2", color: "#B42318", dot: "#D92D20" },
  Medium: { bg: "#FFFAEB", color: "#B54708", dot: "#F79009" }, Low: { bg: "#F2F4F7", color: "#344054", dot: "#98A2B3" },
};
export function Pill({ text, st }: { text: string; st?: { bg: string; color: string; dot: string } }) {
  const s = st ?? { bg: "#F2F4F7", color: "#344054", dot: "#98A2B3" };
  return <span className="dash-badge" style={{ background: s.bg, color: s.color }}><span className="dot" style={{ background: s.dot }} />{text}</span>;
}

export function StarPicker({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <span role="radiogroup" aria-label="Rating" style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} disabled={disabled}
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => onChange(n)}
          style={{ border: "none", background: "transparent", cursor: disabled ? "default" : "pointer", fontSize: 22, lineHeight: 1, color: n <= (hover || value) ? "#F79009" : "#D0D5DD", padding: 0 }}>★</button>
      ))}
    </span>
  );
}

export const stars = (n?: number | null) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "—");
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
export const fmtShort = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");

/** A requester may close once rated; the closure code is the master entry that says "user confirmed", if one exists. */
export function userClosureCode(codes: Raw[] | null | undefined): string | undefined {
  return (codes ?? []).find((c) => c.isActive !== false && /confirm/i.test(c.closureCodeName))?.closureCodeName;
}
