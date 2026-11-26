import React from "react";
import { Link } from "../router";
import {
  CHANGE_STATES, RISK_COLOR, STATE_COLOR, typeColor,
  type Change, type ChangeState, type ChangeType, type Conflict, type RiskLevel,
} from "../changeApi";

export const Pill = ({ text, c }: { text: string; c: { bg: string; color: string } }) => (
  <span className="badge" style={{ background: c.bg, color: c.color }}>{text}</span>
);
export const TypePill = ({ t }: { t: ChangeType }) => <Pill text={t} c={typeColor(t)} />;
export const StatePill = ({ s }: { s: ChangeState }) => <Pill text={s} c={STATE_COLOR[s]} />;
export const RiskPill = ({ r }: { r?: RiskLevel | null }) => (r ? <Pill text={`${r} risk`} c={RISK_COLOR[r]} /> : <span style={{ color: "var(--muted)" }}>Not assessed</span>);

export function PageHead({ crumb, title, subtitle, action }: { crumb: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="page-header-row">
      <div className="page-header-left">
        <div className="breadcrumb">{crumb}</div>
        <div className="page-title">{title}</div>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

/** Conflicts found for a window; `ok` is the message shown when there are none. */
export function ConflictList({ conflicts, ok }: { conflicts?: Conflict[]; ok: string }) {
  if (!conflicts?.length) return <div className="cm-note ok">{ok}</div>;
  return (
    <>
      {conflicts.map((c, i) => (
        <div key={i} className={`cm-note ${c.kind === "Maintenance" ? "warn" : "bad"}`}>
          <b>{c.kind === "Maintenance" ? "Maintenance window." : `${c.kind} conflict.`}</b> {c.text}
        </div>
      ))}
    </>
  );
}

const FLOW: ChangeState[] = CHANGE_STATES.filter((s) => s !== "Cancelled");
export function Lifecycle({ state }: { state: ChangeState }) {
  if (state === "Cancelled") return <div className="cm-note bad">This change was cancelled.</div>;
  const at = FLOW.indexOf(state);
  return (
    <div className="cm-lifecycle">
      {FLOW.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`cm-lc-step ${i < at ? "done" : i === at ? "now" : ""}`}>
            <span className="cm-lc-dot">{i < at ? "✓" : i + 1}</span>{s}
          </div>
          {i < FLOW.length - 1 && <div className="cm-lc-line" />}
        </React.Fragment>
      ))}
    </div>
  );
}

export const Field = ({ label, req, hint, full, children }: { label: string; req?: boolean; hint?: string; full?: boolean; children: React.ReactNode }) => (
  <div className={`field-group${full ? " full" : ""}`}>
    <span className="cm-lbl">{label}{req && <span className="req">*</span>}</span>
    {children}
    {hint && <span className="cm-hint">{hint}</span>}
  </div>
);

export const ChangeLink = ({ c }: { c: Pick<Change, "changeId" | "changeCode"> }) => (
  <Link to={`/changes/${c.changeId}`} style={{ fontWeight: 700 }}>{c.changeCode}</Link>
);

export const windowText = (c: Pick<Change, "plannedStart" | "plannedEnd">, f: (s?: string | null) => string) =>
  c.plannedStart && c.plannedEnd ? `${f(c.plannedStart)} → ${f(c.plannedEnd)}` : "No window planned";
