import React from "react";
import { Link } from "../router";

export interface BadgeMeta { label: string; bg: string; color: string; dot: string }

// ---- colours copied from the design boards ----
const PRIORITY: Record<string, BadgeMeta> = {
  Critical: { label: "1 — Critical", bg: "#FEE4E2", color: "#912018", dot: "#B42318" },
  High:     { label: "1 — High",     bg: "#FEF3F2", color: "#B42318", dot: "#D92D20" },
  Medium:   { label: "2 — Medium",   bg: "#FFFAEB", color: "#B54708", dot: "#F79009" },
  Low:      { label: "3 — Low",      bg: "#EFF4FC", color: "#175CD3", dot: "#175CD3" },
};
// End-user board shows plain High / Medium / Low with a grey "Low".
const USER_PRIORITY: Record<string, BadgeMeta> = {
  Critical: { label: "Critical", bg: "#FEE4E2", color: "#912018", dot: "#B42318" },
  High:     { label: "High",     bg: "#FEF3F2", color: "#B42318", dot: "#D92D20" },
  Medium:   { label: "Medium",   bg: "#FFFAEB", color: "#B54708", dot: "#F79009" },
  Low:      { label: "Low",      bg: "#F2F4F7", color: "#344054", dot: "#98A2B3" },
};
const STATUS: Record<string, BadgeMeta> = {
  Open:          { label: "New",         bg: "#F2F4F7", color: "#344054", dot: "#98A2B3" },
  Assigned:      { label: "Assigned",    bg: "#F0F9FF", color: "#026AA2", dot: "#0BA5EC" },
  "In Progress": { label: "In Progress", bg: "#EFF4FC", color: "#175CD3", dot: "#175CD3" },
  "On Hold":     { label: "On Hold",     bg: "#FFFAEB", color: "#B54708", dot: "#F79009" },
  Resolved:      { label: "Resolved",    bg: "#ECFDF3", color: "#067647", dot: "#12B76A" },
  Closed:        { label: "Closed",      bg: "#F2F4F7", color: "#667085", dot: "#98A2B3" },
};
// End users see the real status; only "Open" is labelled "New" (already so in STATUS).
const USER_STATUS: Record<string, BadgeMeta> = {
  ...STATUS,
  "Pending Customer": { label: "Pending Customer", bg: "#FFF6ED", color: "#B93815", dot: "#EF6820" },
};
export const priorityMeta = (p?: string | null) => PRIORITY[p ?? ""] ?? PRIORITY.Low;
export const userPriorityMeta = (p?: string | null) => USER_PRIORITY[p ?? ""] ?? USER_PRIORITY.Low;
export const statusMeta = (s?: string | null) => STATUS[s ?? ""] ?? STATUS.Open;
export const userStatusMeta = (s?: string | null) => USER_STATUS[s ?? ""] ?? USER_STATUS.Open;

export function slaMeta(label: string): BadgeMeta {
  if (label === "Breached") return { label, bg: "#FEF3F2", color: "#B42318", dot: "#D92D20" };
  if (label === "Paused") return { label, bg: "#FFFAEB", color: "#B54708", dot: "#F79009" };
  if (label.startsWith("Due")) return { label, bg: "#FFF6ED", color: "#B93815", dot: "#EF6820" };
  return { label, bg: "#ECFDF3", color: "#067647", dot: "#12B76A" };
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function stars(n: number): string {
  return n ? "★".repeat(n) + "☆".repeat(5 - n) : "—";
}

export function Badge({ meta }: { meta: BadgeMeta }) {
  return (
    <span className="dash-badge" style={{ background: meta.bg, color: meta.color }}>
      <span className="dot" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

export function Crumb({ group, page }: { group: string; page: string }) {
  return (
    <div className="dash-crumb">
      {group} <span className="sep">&gt;</span> <span className="cur">{page}</span>
    </div>
  );
}

export function StatStrip({ items }: { items: { value: React.ReactNode; label: string; color?: string }[] }) {
  return (
    <div className="dash-stats">
      {items.map((s) => (
        <div className="dash-stat" key={s.label}>
          <div className="dash-stat-num" style={s.color ? { color: s.color } : undefined}>{s.value}</div>
          <div className="dash-stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export function Card({ title, icon, link, children, style }: {
  title: React.ReactNode; icon?: React.ReactNode; link?: { to: string; label: string };
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div className="dash-card" style={style}>
      <div className="dash-card-head">
        <div className="dash-card-title">{icon}{title}</div>
        {link && <Link to={link.to} className="dash-card-link">{link.label}</Link>}
      </div>
      {children}
    </div>
  );
}

export function QuickLinks({ links }: { links: { to: string; label: string; icon: React.ReactNode }[] }) {
  return (
    <Card title="Quick Links">
      {links.map((l) => (
        <Link key={l.to + l.label} to={l.to} className="dash-quick">{l.icon}{l.label}</Link>
      ))}
    </Card>
  );
}
