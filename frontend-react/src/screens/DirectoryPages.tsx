import React, { useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../api";
import { DirectorySourcePayload, DirectorySourceRow, MappingRow, SyncRun, directoryApi } from "../configApi";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, StatusPill, TH, errMsg, formatDateTime } from "../components/configKit";

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const CRUMB = "Configuration > Directory Integration >";
const typeLabel = (t: string) => (t === "ldap" ? "On-Prem AD / LDAP" : "Azure AD / O365");

// ───────────────────────── Directory Settings ─────────────────────────
export function DirectorySettingsPage() {
  const { data, loading, error, reload } = useAsync(() => directoryApi.sources(), []);
  const roles = useAsync(() => api.get<{ roleName: string }[]>("/roles").catch(() => []), []);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DirectorySourcePayload>({});
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [err, setErr] = useState("");

  const sources = data ?? [];
  const editing = sources.find((s) => s.sourceId === editingId);
  const roleOptions = (roles.data?.length ? roles.data.map((r) => r.roleName) : ["End User", "IT Agent", "Admin"]);

  const open = (s: DirectorySourceRow) => {
    setEditingId(s.sourceId); setSecret(""); setErr("");
    setTestResult(s.lastTestOk == null ? null : { ok: s.lastTestOk, message: s.lastTestMessage ?? "" });
    setForm({
      name: s.name, isActive: s.isActive, autoCreateUsers: s.autoCreateUsers, ldapUrl: s.ldapUrl ?? "", bindDn: s.bindDn ?? "", baseDn: s.baseDn ?? "",
      searchFilter: s.searchFilter ?? "(objectClass=user)", defaultRole: s.defaultRole ?? "End User", tenantId: s.tenantId ?? "", clientId: s.clientId ?? "",
      redirectUri: s.redirectUri ?? "", ssoEnabled: s.ssoEnabled, ssoOnly: s.ssoOnly, allowedDomains: s.allowedDomains ?? "",
    });
  };

  const add = async (type: "ldap" | "azure_ad") => {
    setErr("");
    try { const s = await directoryApi.create(type); reload(); open(s); }
    catch (e) { setErr(errMsg(e, "Unable to add source.")); }
  };

  const persist = async (): Promise<boolean> => {
    if (!editing) return false;
    setSaving(true); setErr("");
    try {
      const body: DirectorySourcePayload = { ...form };
      if (secret) { if (editing.type === "ldap") body.bindPassword = secret; else body.clientSecret = secret; }
      await directoryApi.update(editing.sourceId, body);
      setSecret(""); reload();
      return true;
    } catch (e) { setErr(errMsg(e, "Unable to save.")); return false; }
    finally { setSaving(false); }
  };

  const test = async () => {
    if (!editing) return;
    if (!(await persist())) return;           // test what is actually stored
    setTesting(true); setTestResult(null);
    try { setTestResult(await directoryApi.test(editing.sourceId)); reload(); }
    catch (e) { setTestResult({ ok: false, message: errMsg(e, "Test failed.") }); }
    finally { setTesting(false); }
  };

  const remove = async (s: DirectorySourceRow) => {
    if (!window.confirm(`Remove "${s.name}"? Its attribute mapping and sync history are removed too.`)) return;
    try { await directoryApi.remove(s.sourceId); if (editingId === s.sourceId) setEditingId(null); reload(); }
    catch (e) { setErr(errMsg(e, "Unable to remove.")); }
  };

  const set = <K extends keyof DirectorySourcePayload>(k: K, v: DirectorySourcePayload[K]) => setForm((f) => ({ ...f, [k]: v }));
  const header = (
    <PageHeader crumb={`${CRUMB} Directory Settings`} title="Directory Settings"
      subtitle="Connect an on-prem Active Directory (LDAP/LDAPS) and/or Azure AD / Microsoft 365 (Graph API) to fetch user information and enable single sign-on." />
  );

  if (editing) {
    const isLdap = editing.type === "ldap";
    const tenantBad = !!form.tenantId && !GUID_RE.test(form.tenantId.trim()) && !DOMAIN_RE.test(form.tenantId.trim());
    const clientBad = !!form.clientId && !GUID_RE.test(form.clientId.trim());
    const hasSecret = isLdap ? editing.hasBindPassword : editing.hasClientSecret;
    return (
      <>
        {header}
        <div className="page-body">
          <ErrorBar msg={err} />
          <form className="card admin-master-form-panel" onSubmit={async (e) => { e.preventDefault(); if (await persist()) setEditingId(null); }}>
            <div className="admin-master-form-heading">
              <h2>{typeLabel(editing.type)}</h2>
              <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>← Back to Directory Sources</button>
            </div>
            <div className="admin-master-form-grid">
              <label className="field-group admin-master-wide"><span className="lbl">Configuration Name</span>
                <input className="input" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></label>
              <label className="admin-master-check-label"><input type="checkbox" checked={!!form.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active (used for scheduled/manual sync)</label>
              <label className="admin-master-check-label"><input type="checkbox" checked={!!form.autoCreateUsers} onChange={(e) => set("autoCreateUsers", e.target.checked)} /> Auto-create users on first sync{isLdap ? "" : "/login"}</label>

              {isLdap ? (
                <>
                  <label className="field-group admin-master-wide"><span className="lbl">LDAP / LDAPS URL</span>
                    <input className="input" placeholder="ldaps://dc01.corp.example.com:636" value={form.ldapUrl ?? ""} onChange={(e) => set("ldapUrl", e.target.value)} />
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Use ldaps:// (port 636) for encrypted connections.</div></label>
                  <label className="field-group admin-master-wide"><span className="lbl">Bind DN (service account)</span>
                    <input className="input" value={form.bindDn ?? ""} onChange={(e) => set("bindDn", e.target.value)} /></label>
                  <label className="field-group"><span className="lbl">Bind Password</span>
                    <input className="input" type="password" autoComplete="new-password" value={secret} placeholder={hasSecret ? "•••••••• (leave blank to keep)" : ""} onChange={(e) => setSecret(e.target.value)} /></label>
                  <label className="field-group"><span className="lbl">Base DN</span>
                    <input className="input" value={form.baseDn ?? ""} onChange={(e) => set("baseDn", e.target.value)} /></label>
                  <label className="field-group"><span className="lbl">Search Filter</span>
                    <input className="input" value={form.searchFilter ?? ""} onChange={(e) => set("searchFilter", e.target.value)} /></label>
                  <label className="field-group"><span className="lbl">Default Role for New Users</span>
                    <select className="select" value={form.defaultRole ?? ""} onChange={(e) => set("defaultRole", e.target.value)}>
                      {roleOptions.map((r) => <option key={r}>{r}</option>)}</select></label>
                </>
              ) : (
                <>
                  <label className="admin-master-check-label"><input type="checkbox" checked={!!form.ssoEnabled} onChange={(e) => set("ssoEnabled", e.target.checked)} /> Show &quot;Sign in with Microsoft&quot; on login page</label>
                  <label className="admin-master-check-label"><input type="checkbox" checked={!!form.ssoOnly} onChange={(e) => set("ssoOnly", e.target.checked)} /> Require SSO for these users (block password login for accounts provisioned by this directory)</label>
                  <label className="field-group"><span className="lbl">Directory (Tenant) ID</span>
                    <input className="input" value={form.tenantId ?? ""} onChange={(e) => set("tenantId", e.target.value)} />
                    {tenantBad && <div className="error-text" style={{ fontSize: 12, marginTop: 4 }}>Doesn&apos;t look like a tenant GUID or a verified domain (e.g. contoso.onmicrosoft.com) — double-check it in Azure Portal &gt; Microsoft Entra ID &gt; Overview.</div>}</label>
                  <label className="field-group"><span className="lbl">Application (Client) ID</span>
                    <input className="input" value={form.clientId ?? ""} onChange={(e) => set("clientId", e.target.value)} />
                    {clientBad && <div className="error-text" style={{ fontSize: 12, marginTop: 4 }}>Doesn&apos;t look like a GUID — copy it from the app registration&apos;s Overview page in Azure Portal.</div>}</label>
                  <label className="field-group"><span className="lbl">Client Secret</span>
                    <input className="input" type="password" autoComplete="new-password" value={secret} placeholder={hasSecret ? "•••••••• (leave blank to keep)" : ""} onChange={(e) => setSecret(e.target.value)} /></label>
                  <label className="field-group"><span className="lbl">Redirect URI</span>
                    <input className="input" value={form.redirectUri ?? ""} onChange={(e) => set("redirectUri", e.target.value)} /></label>
                  <label className="field-group admin-master-wide"><span className="lbl">Allowed Email Domains</span>
                    <input className="input" placeholder="example.com, corp.example.com" value={form.allowedDomains ?? ""} onChange={(e) => set("allowedDomains", e.target.value)} /></label>
                  <label className="field-group"><span className="lbl">Default Role for New Users</span>
                    <select className="select" value={form.defaultRole ?? ""} onChange={(e) => set("defaultRole", e.target.value)}>
                      {roleOptions.map((r) => <option key={r}>{r}</option>)}</select></label>
                </>
              )}
            </div>
            {testResult && (
              <div style={{ margin: "12px 0", padding: "10px 14px", borderRadius: 8, fontSize: 13,
                background: testResult.ok ? "#ECFDF3" : "#FEF3F2", color: testResult.ok ? "#067647" : "#B42318", border: `1px solid ${testResult.ok ? "#ABEFC6" : "#FECDCA"}` }}>
                {testResult.ok ? "✓ Last test passed — " : "✕ Last test failed — "}{testResult.message}
              </div>
            )}
            <div className="admin-master-form-actions">
              <button type="button" className="btn-ghost" onClick={test} disabled={testing || saving}>{testing ? "Testing…" : "Test Connection"}</button>
              <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="page-body">
        <ErrorBar msg={error ?? err} />
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="proto-eyebrow-title">DIRECTORY SOURCE</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--muted)", marginRight: 4 }}>Actions</span>
              <button className="btn-ghost" onClick={() => void add("ldap")}><Plus size={13} /> On-Prem AD / LDAP</button>
              <button className="btn-ghost" onClick={() => void add("azure_ad")}><Plus size={13} /> Azure AD / O365</button>
            </div>
          </div>
          {loading ? <div className="spinner-row">Loading…</div> : sources.length === 0 ? <div className="empty-state">No directory sources yet.</div> : (
            <div style={{ padding: "0 20px 20px" }}>
              {sources.map((s) => (
                <div key={s.sourceId} style={{ border: "1px solid #E4E7EC", borderRadius: 8, padding: "14px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--ink)" }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{typeLabel(s.type)}</div>
                    {s.lastTestOk != null && (
                      <div style={{ fontSize: 12, marginTop: 4, color: s.lastTestOk ? "#067647" : "#B42318" }}>
                        {s.lastTestOk ? "✓ Last test passed" : "✕ Last test failed"}
                      </div>
                    )}
                  </div>
                  {s.type === "azure_ad" && s.ssoEnabled && <span className="chip" style={{ fontSize: 11 }}>SSO{s.ssoOnly ? " only" : ""}</span>}
                  <StatusPill active={s.isActive} />
                  <button className="btn-ghost" onClick={() => open(s)}>Edit</button>
                  <button className="btn-danger" onClick={() => void remove(s)}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SourcePicker({ sources, value, onChange }: { sources: DirectorySourceRow[]; value: number | null; onChange: (id: number) => void }) {
  return (
    <label className="field-group" style={{ maxWidth: 360 }}>
      <span className="lbl">Directory</span>
      <select className="select" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
        {sources.map((s) => <option key={s.sourceId} value={s.sourceId}>{s.name} ({s.type === "ldap" ? "LDAP" : "Graph API"})</option>)}
      </select>
    </label>
  );
}

// ───────────────────────── Attribute Mapping ─────────────────────────
export function AttributeMappingPage() {
  const src = useAsync(() => directoryApi.sources(), []);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  const sources = src.data ?? [];
  useEffect(() => { if (sourceId == null && sources.length) setSourceId(sources[0].sourceId); }, [sources, sourceId]);
  useEffect(() => {
    if (sourceId == null) return;
    let live = true; setBusy(true); setErr("");
    directoryApi.mappings(sourceId).then((r) => live && setRows(r)).catch((e) => live && setErr(errMsg(e))).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [sourceId]);

  const current = sources.find((s) => s.sourceId === sourceId);
  const patch = (i: number, p: Partial<MappingRow>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const save = async () => {
    if (sourceId == null) return;
    if (rows.some((r) => !r.localField.trim() || !r.externalAttribute.trim())) { setErr("Every row needs a local field and an external attribute."); return; }
    setSaving(true); setErr("");
    try { setRows(await directoryApi.saveMappings(sourceId, rows)); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    catch (e) { setErr(errMsg(e, "Unable to save mapping.")); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader crumb={`${CRUMB} Attribute Mapping`} title="Attribute Mapping"
        subtitle="Map each local user field to the attribute name your directory actually exposes. Defaults are pre-filled for standard AD / Azure AD schemas." />
      <div className="page-body">
        <ErrorBar msg={src.error ?? err} />
        <div className="card admin-master-table-wrap" style={{ padding: 20 }}>
          {sources.length === 0 && !src.loading ? <div className="empty-state">Add a directory source first (Directory Settings).</div> : (
            <>
              <SourcePicker sources={sources} value={sourceId} onChange={setSourceId} />
              {busy ? <div className="spinner-row">Loading…</div> : (
                <table style={{ marginTop: 16 }}>
                  <thead><tr>
                    <th style={TH}>Local Field</th>
                    <th style={TH}>External Attribute ({current?.type === "ldap" ? "LDAP" : "Graph"})</th>
                    <th style={{ ...TH, width: 80 }}>Active</th><th style={{ width: 44 }} />
                  </tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.mappingId ?? `n${i}`}>
                        <td>{r.isCustom
                          ? <input className="input" value={r.localField} placeholder="Local field" onChange={(e) => patch(i, { localField: e.target.value })} />
                          : <span style={{ fontWeight: 600, fontSize: 13 }}>{r.localField}</span>}</td>
                        <td><input className="input" value={r.externalAttribute} onChange={(e) => patch(i, { externalAttribute: e.target.value })} /></td>
                        <td><input type="checkbox" checked={r.isActive} onChange={(e) => patch(i, { isActive: e.target.checked })} /></td>
                        <td>{r.isCustom && <button className="admin-master-icon-button danger" aria-label="Remove attribute" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>✕</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
                <button className="btn-ghost" onClick={() => setRows([...rows, { localField: "", externalAttribute: "", isActive: true, isCustom: true }])}><Plus size={13} /> Add Attribute</button>
                <button className="btn-primary" disabled={saving || busy} onClick={save}>{saving ? "Saving…" : "Save Mapping"}</button>
                {saved && <span style={{ color: "#067647", fontWeight: 600, fontSize: 13 }}>✓ Saved</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ───────────────────────── Sync History ─────────────────────────
const RUN_STYLE: Record<string, { bg: string; color: string }> = {
  Success: { bg: "#ECFDF3", color: "#067647" }, Partial: { bg: "#FFFAEB", color: "#B54708" },
  Failed: { bg: "#FEF3F2", color: "#B42318" }, Running: { bg: "#EFF4FC", color: "#175CD3" },
};

export function SyncHistoryPage() {
  const src = useAsync(() => directoryApi.sources(), []);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState("");

  const sources = src.data ?? [];
  useEffect(() => { if (sourceId == null && sources.length) setSourceId(sources[0].sourceId); }, [sources, sourceId]);
  const load = async (id: number) => {
    setBusy(true); setErr("");
    try { setRuns(await directoryApi.history(id)); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  useEffect(() => { if (sourceId != null) void load(sourceId); }, [sourceId]);

  const syncNow = async () => {
    if (sourceId == null) return;
    setSyncing(true); setErr("");
    try { await directoryApi.sync(sourceId); await load(sourceId); }
    catch (e) { setErr(errMsg(e, "Sync failed to start.")); }
    finally { setSyncing(false); }
  };

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">{CRUMB} Sync History</div>
          <div className="page-title">Sync History</div>
          <div className="page-subtitle">Trigger an on-demand sync and review the results of past directory syncs.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" disabled={syncing || sourceId == null} onClick={syncNow} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={14} /> {syncing ? "Syncing…" : "Sync Now"}
          </button>
          <button className="btn-ghost" onClick={() => window.history.back()}>Close</button>
        </div>
      </div>
      <div className="page-body">
        <ErrorBar msg={src.error ?? err} />
        <div className="card admin-master-table-wrap" style={{ padding: 20 }}>
          {sources.length === 0 && !src.loading ? <div className="empty-state">Add a directory source first (Directory Settings).</div> : (
            <>
              <SourcePicker sources={sources} value={sourceId} onChange={setSourceId} />
              {busy ? <div className="spinner-row">Loading…</div> : runs.length === 0 ? <div className="empty-state">No syncs have run yet.</div> : (
                <div className="admin-master-table-scroll" style={{ marginTop: 16 }}>
                  <table>
                    <thead><tr>
                      <th style={TH}>Started</th><th style={TH}>Status</th><th style={TH}>Fetched</th><th style={TH}>Created</th>
                      <th style={TH}>Updated</th><th style={TH}>Failed</th><th style={TH}>Triggered By</th><th style={TH}>Message</th>
                    </tr></thead>
                    <tbody>
                      {runs.map((r) => {
                        const st = RUN_STYLE[r.status] ?? RUN_STYLE.Running;
                        return (
                          <tr key={r.runId}>
                            <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.startedAt)}</td>
                            <td><span className="dash-badge" style={{ background: st.bg, color: st.color }}>{r.status}</span></td>
                            <td>{r.fetched}</td><td>{r.created}</td><td>{r.updated}</td><td>{r.failed}</td>
                            <td>{r.triggeredBy}</td><td style={{ color: "var(--muted)" }}>{r.message ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
