import React, { useState } from "react";
import { transitionApi, TransitionMatrix } from "../configApi";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, errMsg } from "../components/configKit";

export function StatusTransitionMatrixPage() {
  const { data, loading, error, reload } = useAsync(() => transitionApi.get(), []);
  const [local, setLocal] = useState<TransitionMatrix | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const m = local ?? data;
  const statuses = m?.statuses ?? [];
  const from = selected || statuses[0] || "";
  const allowedFor = (s: string) => (m?.transitions ?? []).filter((t) => t.from === s).map((t) => t.to);

  const toggle = async (to: string, checked: boolean) => {
    if (!m || !from) return;
    const next = checked ? [...new Set([...allowedFor(from), to])] : allowedFor(from).filter((x) => x !== to);
    // Optimistic update ("Changes save immediately"), rolled back on failure.
    const prev = m;
    setLocal({ ...m, transitions: [...m.transitions.filter((t) => t.from !== from), ...next.map((t) => ({ from, to: t }))] });
    setErr("");
    try { setLocal(await transitionApi.setFor(from, next)); }
    catch (e) { setLocal(prev); setErr(errMsg(e, "Unable to save change.")); }
  };

  const reset = async () => {
    if (!window.confirm("Reset every status to the recommended flow?")) return;
    setBusy(true); setErr("");
    try { setLocal(await transitionApi.reset()); reload(); }
    catch (e) { setErr(errMsg(e, "Unable to reset.")); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader crumb="Configuration > Others > Status Transition Matrix" title="Status Transition Matrix"
        subtitle="Pick a status, then choose which statuses it's allowed to move to next." />
      <div className="page-body" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <ErrorBar msg={error ?? err} />
        <div className="card" style={{ flex: 1, maxWidth: 520 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E4E7EC" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#344054", letterSpacing: "0.5px" }}>1. CHOOSE A STATUS</div>
            <button className="btn-ghost" disabled={busy} onClick={reset}>Reset to Recommended Flow</button>
          </div>
          {loading ? <div className="spinner-row">Loading…</div> : statuses.map((s, idx) => {
            const targets = allowedFor(s);
            const sel = s === from;
            return (
              <div key={s} onClick={() => setSelected(s)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #EDEFF2", cursor: "pointer", background: sel ? "#EFF4FC" : "#fff" }}>
                <div className="numbered-badge">{idx + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{s}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {targets.length ? `Can move to: ${targets.join(", ")}` : "No transitions allowed yet"}
                  </div>
                </div>
                <span style={{ minWidth: 24, textAlign: "center", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                  background: targets.length ? "#EFF4FC" : "#F2F4F7", color: targets.length ? "#175CD3" : "#98A2B3" }}>{targets.length}</span>
              </div>
            );
          })}
        </div>

        <div className="card" style={{ flex: 1, maxWidth: 440 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E4E7EC", fontSize: 11, fontWeight: 700, color: "#344054", letterSpacing: "0.5px" }}>2. ALLOWED NEXT STATUSES</div>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 13, color: "#475467", marginBottom: 14 }}>
              From <b>{from || "—"}</b>, tick every status it should be allowed to move to. Changes save immediately.
            </div>
            {statuses.filter((t) => t !== from).map((t) => (
              <label key={t} className="admin-master-check-label" style={{ display: "flex", padding: "8px 0", borderBottom: "1px solid #F2F4F7" }}>
                <input type="checkbox" checked={allowedFor(from).includes(t)} onChange={(e) => void toggle(t, e.target.checked)} />
                {t}
              </label>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
