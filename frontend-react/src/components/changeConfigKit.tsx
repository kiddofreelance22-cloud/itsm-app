import React, { useEffect, useState } from "react";
import { useAsync } from "../hooks";
import { useAuth } from "../AuthContext";
import { ErrorBar, errMsg } from "./configKit";
import { PageHead } from "./changeKit";
import { changeApi, type ChangeConfig, type ConfigKey } from "../changeApi";

const clone = <T,>(v: T): T => v === undefined ? v : JSON.parse(JSON.stringify(v));
export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Draft editing for one configuration section: edits go to a local copy, Save sends the whole section to the server,
 * which validates it (and refuses removals that existing changes still depend on).
 */
export function useDraft<K extends ConfigKey>(key: K) {
  const q = useAsync(() => changeApi.config(), []);
  const [draft, setDraft] = useState<ChangeConfig[K] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (q.data && !dirty) setDraft(clone(q.data[key])); }, [q.data, dirty, key]);

  const edit = (fn: (d: ChangeConfig[K]) => void) => {
    setDraft((prev) => { const c = clone(prev as ChangeConfig[K]); fn(c); return c; });
    setDirty(true); setMsg(""); setErr("");
  };
  const save = async () => {
    setSaving(true); setErr(""); setMsg("");
    try { await changeApi.saveConfig(key, draft); setDirty(false); setMsg("Saved."); q.reload(); }
    catch (e) { setErr(errMsg(e, "Unable to save.")); }
    finally { setSaving(false); }
  };
  const discard = () => { if (q.data) setDraft(clone(q.data[key])); setDirty(false); setErr(""); setMsg(""); };
  return { cfg: q.data ?? undefined, draft, edit, save, discard, dirty, saving, msg, err, loading: q.loading, loadError: q.error };
}
export type Draft<K extends ConfigKey> = ReturnType<typeof useDraft<K>>;

/** Page chrome for a configuration screen: title, Save / Discard, saved and error messages. */
export function ConfigPage<K extends ConfigKey>({ d, crumb, title, subtitle, children, extra }: {
  d: Draft<K>; crumb: string; title: string; subtitle: string; children: React.ReactNode; extra?: React.ReactNode;
}) {
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  return (
    <>
      <PageHead crumb={`Configuration > ${crumb}`} title={title} subtitle={subtitle} action={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {d.dirty && <span className="cm-hint">Unsaved changes</span>}
          {extra}
          <button className="btn-ghost" disabled={!d.dirty || d.saving} onClick={d.discard}>Discard</button>
          <button className="btn-primary" disabled={!d.dirty || d.saving || !admin} onClick={d.save}>{d.saving ? "Saving…" : "Save"}</button>
        </div>} />
      <div className="page-body">
        {!admin && <div className="cm-note warn" style={{ marginBottom: 12 }}>Only an administrator can save changes on this screen.</div>}
        {d.msg && <div className="cm-note ok" style={{ marginBottom: 12 }}>{d.msg}</div>}
        <ErrorBar msg={d.err || d.loadError || ""} />
        {d.loading || !d.draft ? <div className="spinner-row">Loading…</div> : children}
      </div>
    </>
  );
}

export const Panel = ({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) => (
  <div className="cm-card"><div className="cm-card-title" style={{ justifyContent: "space-between" }}><span>{title}</span>{right}</div>{children}</div>
);
export const Check = ({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) => (
  <label className="cm-opt"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{label}{hint && <div className="cm-hint">{hint}</div>}</span></label>
);
export const Lbl = ({ label, hint, children, full }: { label: string; hint?: string; children: React.ReactNode; full?: boolean }) => (
  <div className="field-group" style={full ? { gridColumn: "1 / -1" } : undefined}><span className="cm-lbl">{label}</span>{children}{hint && <span className="cm-hint">{hint}</span>}</div>
);
export const Pillish = ({ on, onText = "Active", offText = "Inactive" }: { on: boolean; onText?: string; offText?: string }) => (
  <span className="badge" style={on ? { background: "#ECFDF3", color: "#027A48" } : { background: "#F2F4F7", color: "#667085" }}>{on ? onText : offText}</span>
);
/** Move an item up or down within a list. */
export function move<T>(list: T[], i: number, by: number) {
  const j = i + by; if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}
