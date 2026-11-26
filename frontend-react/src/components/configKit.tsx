import React from "react";
import { ApiError } from "../api";

export const errMsg = (e: unknown, fallback = "Something went wrong.") =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : fallback;

export function PageHeader({ crumb, title, subtitle, onClose, action }: { crumb: string; title: string; subtitle?: string; onClose?: () => void; action?: React.ReactNode }) {
  return (
    <div className="page-header-row">
      <div className="page-header-left">
        <div className="breadcrumb">{crumb}</div>
        <div className="page-title">{title}</div>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 10, flexShrink: 0 }}>
        {action}
        <button className="btn-ghost" onClick={onClose ?? (() => window.history.back())}>Close</button>
      </div>
    </div>
  );
}

export const ErrorBar = ({ msg }: { msg: string }) => (msg ? <div className="admin-master-error" role="alert">{msg}</div> : null);

export const StatusPill = ({ active, on = "Active", off = "Inactive" }: { active: boolean; on?: string; off?: string }) => (
  <span className={`status-pill ${active ? "active" : "inactive"}`}>{active ? on : off}</span>
);

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="proto-search-wrap">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
        style={{ position: "absolute", left: 10, color: "var(--muted-2)", pointerEvents: "none" }}>
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input className="proto-search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export const TH: React.CSSProperties = { textTransform: "uppercase", fontSize: 11, letterSpacing: "0.5px" };

export const Eyebrow = ({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) => (
  <div style={{ padding: "16px 20px" }}>
    <div className="proto-eyebrow"><div className="proto-eyebrow-title">{title}</div>{action}</div>
  </div>
);

/** Section label used inside the design's forms. */
export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "#98A2B3", letterSpacing: "0.5px", marginBottom: 12, textTransform: "uppercase" }}>{children}</div>
);

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
