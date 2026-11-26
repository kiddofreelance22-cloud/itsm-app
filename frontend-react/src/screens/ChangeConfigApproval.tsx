import React, { useState } from "react";
import { Link } from "../router";
import { ConfigPage, Check, Lbl, Panel, uid, useDraft } from "../components/changeConfigKit";
import { RULES, type ApprovalRule, type RuleText } from "../changeApi";

export function ChangeApprovalPolicyPage() {
  const d = useDraft("approval");
  const [tab, setTab] = useState<"rules" | "settings">("rules");
  const a = d.draft;
  const models = d.cfg?.models ?? [];
  const risks = ["Any", ...(d.cfg?.risk.bands.map((band) => band.level) ?? [])];
  const groups = (a?.groups ?? []).filter((g) => g.active);
  const setRule = (id: string, fn: (r: ApprovalRule) => void) => d.edit((x) => { const r = x.rules.find((y) => y.id === id); if (r) fn(r); });
  return (
    <ConfigPage d={d} crumb="Approval Policy & CAB" title="Approval Policy & CAB" subtitle="Who must authorise a change, decided by its model and risk level. The boards and their members are managed in Groups."
      extra={tab === "rules" ? <button className="btn-ghost" onClick={() => d.edit((x) => { x.rules.push({ id: uid("pr"), type: models[0]?.name ?? "", risk: "Any", stages: [], active: true }); })}>Add rule</button> : undefined}>
      <div className="cm-tabs" style={{ marginTop: 0 }}>
        <button className={tab === "rules" ? "on" : ""} onClick={() => setTab("rules")}>Approval rules</button>
        <button className={tab === "settings" ? "on" : ""} onClick={() => setTab("settings")}>Settings</button>
      </div>
      {tab === "rules" ? <>
        <div className="cm-note info" style={{ marginBottom: 12 }}>Stages run in order: the next is requested only when the one before it is approved. “Category TAB” sends the change to the technical board set on its category (skipped if the category has none). A model's lifecycle decides whether its changes are authorised by this policy at all. Manage who is in each group under <Link to="/config/admin/groups">Groups</Link>.</div>
        {(a?.rules ?? []).map((r) => (
          <div key={r.id} className="cm-card">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select className="select" value={r.type} onChange={(e) => setRule(r.id, (x) => { x.type = e.target.value; })}>{models.map((m) => <option key={m.id}>{m.name}</option>)}</select>
              <select className="select" value={r.risk} onChange={(e) => setRule(r.id, (x) => { x.risk = e.target.value as ApprovalRule["risk"]; })}>{risks.map((o) => <option key={o}>{o}</option>)}</select>
              <span className="cm-hint">risk</span><div style={{ flex: 1 }} />
              <Check label="Rule active" checked={r.active} onChange={(v) => setRule(r.id, (x) => { x.active = v; })} />
              <button className="btn-ghost btn-sm" onClick={() => d.edit((x) => { x.rules.splice(x.rules.findIndex((y) => y.id === r.id), 1); })}>Remove rule</button>
            </div>
            <div style={{ marginTop: 10 }}>
              {r.stages.length ? r.stages.map((st, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
                  <span className="cm-step-num">{i + 1}</span>
                  <select className="select" value={st.grp} onChange={(e) => setRule(r.id, (x) => { x.stages[i].grp = e.target.value; })}><option>Category TAB</option>{groups.map((g) => <option key={g.id}>{g.name}</option>)}</select>
                  <select className="select" value={st.rule} onChange={(e) => setRule(r.id, (x) => { x.stages[i].rule = e.target.value as RuleText; })}>{RULES.map((o) => <option key={o}>{o}</option>)}</select>
                  <button className="btn-ghost btn-sm" onClick={() => setRule(r.id, (x) => { x.stages.splice(i, 1); })}>Remove</button>
                </div>)) : <div className="cm-hint">Pre-approved — no approval stages.</div>}
              <button className="btn-ghost btn-sm" onClick={() => setRule(r.id, (x) => { x.stages.push({ grp: groups[0]?.name ?? "", rule: groups[0]?.defaultRule ?? RULES[0] }); })}>Add approval stage</button>
            </div>
          </div>))}
      </> : (
        <Panel title="Approval settings">
          <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
            <Check label="Block self-approval — the requester and the change owner cannot approve their own change" checked={a?.settings.noSelf ?? true} onChange={(v) => d.edit((x) => { x.settings.noSelf = v; })} />
            <Check label="Ask for approval again if the planned window, CIs, service or plans change after approval" checked={a?.settings.reapprove ?? false} onChange={(v) => d.edit((x) => { x.settings.reapprove = v; })} />
            <Lbl label="Remind approvers after (hours, 0 = never)"><input type="number" min={0} className="input" style={{ width: 120 }} value={a?.settings.remindHours ?? 0} onChange={(e) => d.edit((x) => { x.settings.remindHours = Number(e.target.value); })} /></Lbl>
            <Lbl label="Escalate to the Change Management group after (hours, 0 = never)" hint="Must be later than the reminder. Reminders and escalations are sent by e-mail (see E-mail Notification → Approval reminder)."><input type="number" min={0} className="input" style={{ width: 120 }} value={a?.settings.escalateHours ?? 0} onChange={(e) => d.edit((x) => { x.settings.escalateHours = Number(e.target.value); })} /></Lbl>
          </div>
        </Panel>
      )}
      {tab === "rules" && <div className="cm-hint">Active groups: {groups.map((g) => g.name).join(", ")}</div>}
    </ConfigPage>
  );
}
