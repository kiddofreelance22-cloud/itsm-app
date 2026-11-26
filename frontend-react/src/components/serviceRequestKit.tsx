import React, { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { formatDateTime } from "./configKit";
import { requestConfigApi, type RequestApprovalRow, type RequestHistoryEntry, type RequestStatusItem, type ServiceRequest, type SlaState } from "../requestsApi";

export const requestNo = (r: Pick<ServiceRequest, "requestId" | "requestNumber">) =>
  r.requestNumber || `REQ${String(r.requestId).padStart(8, "0")}`;

type Tone = { bg: string; fg: string; border: string };
export const TONES: Record<string, Tone> = {
  amber: { bg: "#FFFAEB", fg: "#B54708", border: "#FEDF89" },
  blue: { bg: "#EFF4FC", fg: "#175CD3", border: "#B2CCFF" },
  violet: { bg: "#F4F3FF", fg: "#5925DC", border: "#D9D6FE" },
  green: { bg: "#ECFDF3", fg: "#067647", border: "#ABEFC6" },
  red: { bg: "#FEF3F2", fg: "#B42318", border: "#FECDCA" },
  gray: { bg: "#F2F4F7", fg: "#475467", border: "#D0D5DD" },
  dark: { bg: "#344054", fg: "#FFFFFF", border: "#344054" },
};

/** Statuses (name, stage, colour) come from Configuration > Request Status; fetched once and shared. */
let statusCache: Promise<RequestStatusItem[]> | null = null;
export const resetRequestStatuses = () => { statusCache = null; };
export function useRequestStatuses(): RequestStatusItem[] {
  const [rows, setRows] = useState<RequestStatusItem[]>([]);
  useEffect(() => {
    let live = true;
    statusCache ??= requestConfigApi.statuses().catch(() => { statusCache = null; return [] as RequestStatusItem[]; });
    void statusCache.then((r) => { if (live) setRows(r); });
    return () => { live = false; };
  }, []);
  return rows;
}

export function Pill({ tone, children, title }: { tone: string; children: React.ReactNode; title?: string }) {
  const t = TONES[tone] ?? TONES.gray;
  return (
    <span title={title} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: t.bg, color: t.fg, border: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function StatusPill({ status, subStatus }: { status: string; subStatus?: string | null }) {
  const rows = useRequestStatuses();
  const tone = (name: string) => rows.find((s) => s.statusName === name)?.color ?? "gray";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <Pill tone={tone(status)}>{status}</Pill>
      {subStatus && <Pill tone={tone(subStatus)}>{subStatus}</Pill>}
    </span>
  );
}

const PRIORITY_TONES: Record<string, Tone> = {
  red: { bg: "#FEF3F2", fg: "#B42318", border: "#FECDCA" },
  amber: { bg: "#FFFAEB", fg: "#B54708", border: "#FEDF89" },
  blue: { bg: "#EFF4FC", fg: "#175CD3", border: "#B2CCFF" },
  gray: { bg: "#F2F4F7", fg: "#475467", border: "#D0D5DD" },
  green: { bg: "#ECFDF3", fg: "#067647", border: "#ABEFC6" },
  purple: { bg: "#F4F3FF", fg: "#5925DC", border: "#D9D6FE" },
};

/** Priority names and colours are configured independently of incident priorities. */
export function PriorityBadge({ name, color }: { name?: string | null; color?: string | null }) {
  if (!name) return <span style={{ color: "var(--muted-2)" }}>—</span>;
  const tone = color ? PRIORITY_TONES[color.toLowerCase()] : undefined;
  return tone
    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`, whiteSpace: "nowrap" }}>{name}</span>
    : <Pill tone="blue">{name}</Pill>;
}

const SLA_LABEL: Record<SlaState, [string, string]> = {
  not_started: ["gray", "Not started"], on_track: ["green", "On track"], at_risk: ["amber", "At risk"],
  breached: ["red", "Breached"], paused: ["gray", "Paused"], met: ["green", "Met"],
};
export function SlaBadge({ state }: { state?: SlaState }) {
  const [tone, label] = SLA_LABEL[state ?? "not_started"];
  return <Pill tone={tone}>{label}</Pill>;
}

export function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span role={onChange ? "radiogroup" : undefined} aria-label="Rating" style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange?.(n)}
          style={{ background: "none", border: 0, padding: 0, cursor: onChange ? "pointer" : "default", fontSize: size, lineHeight: 1, color: n <= value ? "#F79009" : "#D0D5DD" }}>★</button>
      ))}
    </span>
  );
}

/** Approval chain: one row per level with who acted. */
export function ApprovalChain({ approvals, status }: { approvals?: RequestApprovalRow[]; status: string }) {
  const rows = approvals ?? [];
  if (!rows.length) return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No approval was required for this request.</div>;
  const currentLevel = status === "Pending Approval" ? rows.find((r) => r.status === "Pending")?.levelNumber : undefined;
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
      {rows.map((r) => {
        const tone = r.status === "Approved" ? "green" : r.status === "Rejected" ? "red" : r.status === "Info requested" ? "amber" : r.status === "Escalated" ? "blue" : r.levelNumber === currentLevel ? "amber" : "gray";
        return (
          <li key={r.requestApprovalId} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: TONES[tone].bg, border: `1px solid ${TONES[tone].border}`, color: TONES[tone].fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>
              {r.status === "Approved" ? <Check size={13} aria-hidden="true" /> : r.status === "Rejected" ? <X size={13} aria-hidden="true" /> : r.levelNumber}
            </span>
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{r.title} <span style={{ fontWeight: 500, color: "var(--muted)" }}>· {r.status === "Pending" && r.levelNumber === currentLevel ? "Waiting" : r.status}</span></div>
              {(r.actedBy || r.actedAt) && <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.actedBy?.fullName ?? "System"} · {formatDateTime(r.actedAt)}</div>}
              {r.comments && <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }}>{r.comments}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Timeline({ history }: { history: RequestHistoryEntry[] }) {
  if (!history.length) return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No activity yet.</div>;
  return (
    <ul className="sr-timeline">
      {history.map((h) => (
        <li key={h.historyId}>
          <div className="sr-timeline-head"><strong>{h.action === "OnHold" ? "On hold" : h.action}</strong><span>{h.actionBy?.fullName ?? "System"} · {formatDateTime(h.actionAt)}</span></div>
          {h.comments && <div className="sr-timeline-body">{h.comments}</div>}
        </li>
      ))}
    </ul>
  );
}

export function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card sr-panel">
      <div className="sr-panel-head"><h3>{title}</h3>{action}</div>
      {children}
    </section>
  );
}

export function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="sr-facts">
      {rows.map(([k, v]) => (<React.Fragment key={k}><dt>{k}</dt><dd>{v ?? "—"}</dd></React.Fragment>))}
    </dl>
  );
}

export const money = (v?: string | number | null) => (v == null || v === "" ? "—" : Number(v).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }));
