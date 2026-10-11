import React, { useEffect, useState } from "react";
import { LogField, logFieldApi } from "../configApi";
import { useAsync } from "../hooks";
import { useRouter } from "../router";
import { ErrorBar, PageHeader, TH, errMsg } from "../components/configKit";

export function LogIncidentPageConfigPage() {
  const { navigate } = useRouter();
  const { data, loading, error, reload } = useAsync(() => logFieldApi.list(), []);
  const [rows, setRows] = useState<LogField[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (data) setRows(data.map((r) => ({ ...r }))); }, [data]);
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(false), 2200); return () => clearTimeout(t); }, [saved]);

  const list = rows ?? [];
  const dirty = !!data && JSON.stringify(data.map((r) => [r.fieldKey, r.visible, r.required])) !== JSON.stringify(list.map((r) => [r.fieldKey, r.visible, r.required]));
  const toggle = (key: string, patch: Partial<Pick<LogField, "visible" | "required">>) =>
    setRows(list.map((r) => {
      if (r.fieldKey !== key) return r;
      const n = { ...r, ...patch };
      if (patch.required) n.visible = true;          // a required field must be visible
      if (patch.visible === false) n.required = false; // hiding clears required
      return n;
    }));

  const save = async () => {
    setSaving(true); setErr("");
    try { await logFieldApi.save(list.map((r) => ({ fieldKey: r.fieldKey, visible: r.visible, required: r.required }))); setSaved(true); reload(); }
    catch (e) { setErr(errMsg(e, "Unable to save.")); }
    finally { setSaving(false); }
  };
  const reset = async () => {
    if (!window.confirm("Reset every field to the recommended defaults?")) return;
    setErr("");
    try { setRows(await logFieldApi.reset()); setSaved(true); reload(); } catch (e) { setErr(errMsg(e, "Unable to reset.")); }
  };

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">Configuration &gt; Incident Masters &gt; Log Incident Page</div>
          <div className="page-title">Log Incident Page</div>
          <div className="page-subtitle">Control which fields End Users see, and which are mandatory, on the New Incident form.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={() => navigate("/new-incident")}>Preview New Incident Form</button>
          <button className="btn-ghost" onClick={() => window.history.back()}>Close</button>
        </div>
      </div>
      <div className="page-body">
        <ErrorBar msg={error ?? err} />
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="proto-eyebrow-title">Fields ( {loading ? "…" : list.length} )</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {saved && <span style={{ color: "#067647", fontWeight: 600, fontSize: 13 }}>✓ Saved</span>}
              {dirty && !saved && <span style={{ color: "#B54708", fontSize: 12.5 }}>Unsaved changes</span>}
              <button className="btn-ghost" onClick={reset}>Reset to Recommended Defaults</button>
              <button className="btn-primary" disabled={saving || !dirty} onClick={save}>{saving ? "Saving…" : "Save Changes"}</button>
            </div>
          </div>
          <div style={{ padding: "0 20px 12px", fontSize: 12.5, color: "var(--muted)" }}>
            Tick <b>Visible</b> to show a field on the New Incident form; tick <b>Required</b> to block submission until it&apos;s filled in. Click <b>Save Changes</b> to apply them.
            Resolvers using &quot;New Incident for User&quot; always see every field.
          </div>
          {loading ? <div className="spinner-row">Loading…</div> : (
            <div style={{ padding: "0 20px 20px" }}>
              <table>
                <thead><tr><th style={TH}>Field</th><th style={TH}>Section</th><th style={{ ...TH, width: 90, textAlign: "center" }}>Visible</th><th style={{ ...TH, width: 90, textAlign: "center" }}>Required</th></tr></thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.fieldKey}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</td>
                      <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{r.section}</td>
                      <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={`${r.name} visible`} checked={r.visible} onChange={(e) => toggle(r.fieldKey, { visible: e.target.checked })} /></td>
                      <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={`${r.name} required`} checked={r.required} onChange={(e) => toggle(r.fieldKey, { required: e.target.checked })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
