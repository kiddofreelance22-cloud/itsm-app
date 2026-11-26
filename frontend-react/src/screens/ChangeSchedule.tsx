import React, { useMemo, useState } from "react";
import { Link } from "../router";
import { useAsync } from "../hooks";
import { ErrorBar } from "../components/configKit";
import { ChangeLink, PageHead, RiskPill, StatePill, TypePill } from "../components/changeKit";
import { changeApi, fmtDT, typeColor, type Change } from "../changeApi";

const p2 = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const time = (iso?: string | null) => (iso ? `${p2(new Date(iso).getHours())}:${p2(new Date(iso).getMinutes())}` : "");
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ChangeSchedulePage() {
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [view, setView] = useState<"Month" | "List">("Month");
  const [type, setType] = useState("");
  const [service, setService] = useState("");
  const cfg = useAsync(() => changeApi.config(), []).data;

  // The grid: whole weeks (Mon-first) covering the month.
  const days = useMemo(() => {
    const first = new Date(month); const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0); const end = new Date(last); end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
    const out: Date[] = []; for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(new Date(d));
    return out;
  }, [month]);
  const from = days[0], to = new Date(days[days.length - 1].getTime() + 86400000);
  const q = useAsync(() => changeApi.schedule(from.toISOString(), to.toISOString()), [from.getTime(), to.getTime()]);

  const changes = (q.data?.changes ?? []).filter((c) => (!type || c.changeType === type) && (!service || c.businessService === service));
  const services = Array.from(new Set((q.data?.changes ?? []).map((c) => c.businessService).filter(Boolean) as string[])).sort();
  const todayKey = dayKey(new Date());
  const monthLabel = month.toLocaleString("en", { month: "long", year: "numeric" });

  const byDay = useMemo(() => {
    const m = new Map<string, Change[]>();
    for (const c of changes) {
      const s = new Date(c.plannedStart!), e = new Date(c.plannedEnd!);
      for (const d = new Date(s.getFullYear(), s.getMonth(), s.getDate()); d <= e; d.setDate(d.getDate() + 1)) {
        const k = dayKey(d); m.set(k, [...(m.get(k) ?? []), c]);
      }
    }
    return m;
  }, [changes]);
  const blackoutDays = useMemo(() => {
    const s = new Set<string>();
    for (const w of q.data?.windows ?? []) if (w.kind === "Blackout") {
      for (const d = new Date(new Date(w.start).getFullYear(), new Date(w.start).getMonth(), new Date(w.start).getDate()); d <= new Date(w.end); d.setDate(d.getDate() + 1)) s.add(dayKey(d));
    }
    return s;
  }, [q.data]);
  const mwDays = useMemo(() => new Set((q.data?.windows ?? []).filter((w) => w.kind === "Maintenance").map((w) => dayKey(new Date(w.start)))), [q.data]);
  const conflicted = changes.filter((c) => c.conflicts?.length);
  const sorted = [...changes].sort((a, b) => +new Date(a.plannedStart!) - +new Date(b.plannedStart!));
  const shift = (n: number) => { const d = new Date(month); d.setMonth(d.getMonth() + n); setMonth(d); };

  const windowWhen = (w: NonNullable<typeof cfg>["windows"][number]) => w.kind === "Blackout" ? `${w.start} to ${w.end}` : `Every ${DOW[w.day ?? 0]} ${w.from}–${w.to}`;

  return (
    <>
      <PageHead crumb="Manage Changes > Change Schedule" title="Change Schedule" subtitle="The forward schedule of change, with blackout and maintenance windows, so clashes are visible before they happen." />
      <div className="page-body">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <button className="btn-ghost btn-sm" onClick={() => shift(-1)}>‹</button>
          <div style={{ fontWeight: 800, minWidth: 140, textAlign: "center" }}>{monthLabel}</div>
          <button className="btn-ghost btn-sm" onClick={() => shift(1)}>›</button>
          <button className="btn-ghost btn-sm" onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setMonth(d); }}>Today</button>
          {(["Month", "List"] as const).map((v) => <button key={v} className={view === v ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setView(v)}>{v}</button>)}
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{(cfg?.models ?? []).map((m) => <option key={m.name}>{m.name}</option>)}</select>
          <select className="select" value={service} onChange={(e) => setService(e.target.value)}><option value="">All services</option>{services.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <ErrorBar msg={q.error ?? ""} />
        <div className="cm-hint" style={{ marginBottom: 8 }}>
          {(cfg?.models ?? []).map((m) => <span key={m.name} className="cm-ev" style={{ display: "inline-block", marginRight: 4, background: typeColor(m.name).bg, color: typeColor(m.name).color }}>{m.name}</span>)}
          {" "}· <span style={{ background: "#FEF3F2", padding: "1px 6px", borderRadius: 4 }}>Blackout day</span> · <b>MW</b> Maintenance window · <span style={{ outline: "1.5px solid var(--red)", padding: "0 4px" }}>Has a conflict</span>
        </div>

        {view === "Month" ? (
          <div className="cm-cal">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="cm-cal-head">{d}</div>)}
            {days.map((d) => {
              const k = dayKey(d), evs = byDay.get(k) ?? [];
              return (
                <div key={k} className={`cm-cal-cell${d.getMonth() !== month.getMonth() ? " out" : ""}${blackoutDays.has(k) ? " blackout" : ""}${k === todayKey ? " today" : ""}`}>
                  <span className="cm-cal-d">{d.getDate()}</span>{mwDays.has(k) && <b style={{ marginLeft: 4, color: "var(--muted)" }} title="Maintenance window">MW</b>}
                  {evs.slice(0, 4).map((c) => (
                    <Link key={c.changeId} to={`/changes/${c.changeId}`} className={`cm-ev${c.conflicts?.length ? " conflict" : ""}`} style={{ background: typeColor(c.changeType).bg, color: typeColor(c.changeType).color }}>
                      {dayKey(new Date(c.plannedStart!)) === k ? time(c.plannedStart) : "↔"} {c.changeCode.slice(-6)}
                    </Link>
                  ))}
                  {evs.length > 4 && <div className="cm-hint">+{evs.length - 4} more</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="cm-card" style={{ padding: 0, overflow: "hidden" }}><div className="admin-master-table-scroll">
            <table className="dash-table" style={{ minWidth: 900 }}>
              <thead><tr><th>Window</th><th>Change</th><th>Service / CIs</th><th>Type / risk</th><th>State</th></tr></thead>
              <tbody>
                {q.loading ? <tr><td colSpan={5} className="spinner-row">Loading…</td></tr>
                  : sorted.length ? sorted.map((c) => (
                    <tr key={c.changeId}><td>{fmtDT(c.plannedStart)}<div className="cm-hint">to {fmtDT(c.plannedEnd)}</div></td>
                      <td><ChangeLink c={c} />{c.conflicts?.length ? <span style={{ color: "var(--red)", fontWeight: 700 }}> · Conflict</span> : null}<div>{c.shortDescription}</div></td>
                      <td>{c.businessService ?? "—"}<div className="cm-hint">{c.configurationItems?.join(", ")}</div></td>
                      <td><TypePill t={c.changeType} /> <RiskPill r={c.riskLevel} /></td><td><StatePill s={c.state} /></td></tr>
                  )) : <tr><td colSpan={5} className="spinner-row">No changes planned in this period.</td></tr>}
              </tbody></table></div></div>
        )}

        <div className="cm-grid" style={{ marginTop: 18 }}>
          <div className="cm-card">
            <div className="cm-card-title">Conflicts ({conflicted.length})</div>
            {conflicted.length ? conflicted.map((c) => (
              <div key={c.changeId} className="cm-note bad"><ChangeLink c={c} /> — {c.conflicts!.map((x) => x.text).join(" ")}</div>
            )) : <div className="cm-note ok">No open changes clash with a blackout or with each other.</div>}
          </div>
          <div className="cm-card">
            <div className="cm-card-title">Windows in force</div>
            {cfg?.windows.filter((w) => w.active).map((w) => (
              <div key={w.id} style={{ padding: "6px 0", borderTop: "1px solid #EDEFF2", fontSize: 12.5 }}>
                <b>{w.name}</b> <span className="badge" style={{ background: w.kind === "Blackout" ? "#FEF3F2" : "#EFF8FF", color: w.kind === "Blackout" ? "#B42318" : "#175CD3" }}>{w.kind}</span>
                <div className="cm-hint">{windowWhen(w)} · {w.scope}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
