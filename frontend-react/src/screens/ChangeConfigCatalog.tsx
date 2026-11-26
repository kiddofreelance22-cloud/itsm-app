import React, { useState } from "react";
import { ConfigPage, Lbl, Panel, uid, useDraft } from "../components/changeConfigKit";
import { useAsync } from "../hooks";
import { changeApi, type StandardTemplate } from "../changeApi";

const STATUSES: StandardTemplate["status"][] = ["Proposed", "Active", "Under review", "Retired"];
const COLOR: Record<string, { bg: string; color: string }> = {
  Proposed: { bg: "#F2F4F7", color: "#344054" }, Active: { bg: "#ECFDF3", color: "#027A48" }, "Under review": { bg: "#FFFAEB", color: "#B54708" }, Retired: { bg: "#F2F4F7", color: "#667085" },
};
const today = () => new Date().toISOString().slice(0, 10);

export function ChangeCatalogPage() {
  const d = useDraft("templates");
  const wgQ = useAsync(() => changeApi.workgroups().catch(() => [] as { groupId: number; groupName: string }[]), []);
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const all = d.draft ?? [];
  const list = all.filter((t) => filter === "All" || t.status === filter);
  const t = all.find((x) => x.id === sel) ?? null;
  const cfg = d.cfg;
  const patch = (fn: (t: StandardTemplate) => void) => d.edit((l) => { const x = l.find((y) => y.id === sel); if (x) fn(x); });
  const dueSoon = (x: StandardTemplate) => x.status === "Active" && x.nextReview && x.nextReview <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const add = () => { const id = uid("std"); d.edit((l) => { l.push({ id, name: "", category: "", service: "", group: "", owner: "", status: "Proposed", description: "", implementationPlan: "", backoutPlan: "", testPlan: "", authorised: "", nextReview: "", uses: 0, failed: 0 }); }); setSel(id); };
  return (
    <ConfigPage d={d} crumb="Standard Change Catalog" title="Standard Change Catalog" subtitle="Pre-authorised templates for low-risk, repeatable changes. A template is proposed, authorised once, and reviewed every year."
      extra={<button className="btn-ghost" onClick={add}>Propose new template</button>}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {["All", ...STATUSES].map((s) => <button key={s} className={filter === s ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setFilter(s)}>{s} ({all.filter((x) => s === "All" || x.status === s).length})</button>)}
      </div>
      <div className="cm-grid">
        <div>
          <div className="cm-card" style={{ padding: 0, overflow: "hidden" }}><div className="admin-master-table-scroll">
            <table className="dash-table" style={{ minWidth: 760 }}>
              <thead><tr><th>Template</th><th>Category / service</th><th>Status</th><th>Authorised</th><th>Next review</th><th>Uses</th><th>Failed</th></tr></thead>
              <tbody>{list.map((x) => (
                <tr key={x.id} onClick={() => setSel(x.id)} style={{ cursor: "pointer", background: sel === x.id ? "var(--blue-light)" : undefined }}>
                  <td><b>{x.name || "Unnamed"}</b><div className="cm-hint">{x.group} · owner {x.owner || "—"}</div></td>
                  <td>{x.category}<div className="cm-hint">{x.service}</div></td>
                  <td><span className="badge" style={COLOR[x.status]}>{x.status}</span></td>
                  <td>{x.authorised || "—"}</td>
                  <td>{x.nextReview || "—"}{dueSoon(x) && <div style={{ color: "#B54708", fontSize: 11.5, fontWeight: 700 }}>Review due</div>}</td>
                  <td>{x.uses}</td><td>{x.failed}</td></tr>))}
                {!list.length && <tr><td colSpan={7} className="spinner-row">No templates.</td></tr>}</tbody>
            </table></div></div>
          <div className="cm-hint">If any change raised from a template fails, the template moves to “Under review” automatically and cannot be used until someone sets it back to Active.</div>
        </div>
        <div className="cm-sticky">
          {t ? (
            <Panel title={t.name || "New template"} right={<button className="btn-danger btn-sm" onClick={() => { d.edit((l) => { l.splice(l.findIndex((x) => x.id === t.id), 1); }); setSel(null); }}>Delete</button>}>
              <div className="cm-form-grid" style={{ gridTemplateColumns: "1fr" }}>
                <Lbl label="Template name"><input className="input" value={t.name} onChange={(e) => patch((x) => { x.name = e.target.value; })} /></Lbl>
                <Lbl label="Category"><select className="select" value={t.category} onChange={(e) => patch((x) => { x.category = e.target.value; })}><option value="">Select</option>{cfg?.categories.filter((c) => c.active).map((c) => <option key={c.id}>{c.name}</option>)}</select></Lbl>
                <Lbl label="Service"><select className="select" value={t.service} onChange={(e) => patch((x) => { x.service = e.target.value; })}><option value="">Select</option>{cfg?.services.map((s) => <option key={s}>{s}</option>)}</select></Lbl>
                <Lbl label="Assignment group" hint="Chosen from Configuration → Workgroup."><select className="select" value={t.group} onChange={(e) => patch((x) => { x.group = e.target.value; })}><option value="">Select a workgroup</option>{t.group && !(wgQ.data ?? []).some((g) => g.groupName === t.group) && <option value={t.group}>{t.group} (not a workgroup)</option>}{(wgQ.data ?? []).map((g) => <option key={g.groupId}>{g.groupName}</option>)}</select></Lbl>
                <Lbl label="Template owner"><input className="input" value={t.owner} onChange={(e) => patch((x) => { x.owner = e.target.value; })} /></Lbl>
                <Lbl label="Scope — what the template covers"><textarea className="textarea" rows={2} value={t.description} onChange={(e) => patch((x) => { x.description = e.target.value; })} /></Lbl>
                <Lbl label="Implementation steps"><textarea className="textarea" rows={4} value={t.implementationPlan} onChange={(e) => patch((x) => { x.implementationPlan = e.target.value; })} /></Lbl>
                <Lbl label="Backout plan"><textarea className="textarea" rows={2} value={t.backoutPlan} onChange={(e) => patch((x) => { x.backoutPlan = e.target.value; })} /></Lbl>
                <Lbl label="Verification"><textarea className="textarea" rows={2} value={t.testPlan} onChange={(e) => patch((x) => { x.testPlan = e.target.value; })} /></Lbl>
                <Lbl label="Status" hint="Only Active templates can be used on Create Change. Active needs implementation steps and a backout plan."><select className="select" value={t.status} onChange={(e) => patch((x) => { x.status = e.target.value as StandardTemplate["status"]; if (x.status === "Active" && !x.authorised) { x.authorised = today(); x.nextReview = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10); } })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Lbl>
                <Lbl label="Authorised on"><input type="date" className="input" value={t.authorised} onChange={(e) => patch((x) => { x.authorised = e.target.value; })} /></Lbl>
                <Lbl label="Next review"><input type="date" className="input" value={t.nextReview} onChange={(e) => patch((x) => { x.nextReview = e.target.value; })} /></Lbl>
                <div className="cm-hint">Used {t.uses} time(s) · {t.failed} failed. Counters are kept by the system.</div>
              </div>
            </Panel>
          ) : <Panel title="Select a template"><div className="cm-hint">Choose a template to edit it, or propose a new one.</div></Panel>}
        </div>
      </div>
    </ConfigPage>
  );
}
