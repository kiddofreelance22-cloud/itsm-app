import React, { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { ConfigPage, Check, Lbl, Panel, Pillish, uid, useDraft } from "../components/changeConfigKit";
import { DAYS, RULES, type ApprovalGroup, type RuleText } from "../changeApi";

interface U { userId: number; fullName?: string; firstName?: string; lastName?: string; username?: string; email?: string }
const nameOf = (u: U) => u.fullName ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || `User ${u.userId}`);
const TYPES: ApprovalGroup["type"][] = ["Approval group", "Board", "Technical board"];

export function ChangeGroupsPage() {
  const d = useDraft("approval");
  const users = useAsync(() => api.get<U[]>("/users/assignable").catch(() => [] as U[]), []).data ?? [];
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const all = d.draft?.groups ?? [];
  const list = all.filter((g) => filter === "All" || g.type === filter);
  const g = all.find((x) => x.id === sel) ?? null;
  const patch = (fn: (g: ApprovalGroup) => void) => d.edit((x) => { const t = x.groups.find((y) => y.id === sel); if (t) fn(t); });
  const usedIn = (name: string) => [
    ...(d.draft?.rules ?? []).filter((r) => r.stages.some((s) => s.grp === name)).map((r) => `Approval rule: ${r.type} / ${r.risk} risk`),
    ...(d.cfg?.lifecycles ?? []).filter((l) => l.steps.some((s) => s.group === name)).map((l) => `Lifecycle: ${l.name}`),
    ...(d.cfg?.categories ?? []).filter((c) => c.tab === name).map((c) => `Category TAB: ${c.name}`),
  ];
  const add = () => { const id = uid("grp"); d.edit((x) => { x.groups.push({ id, name: "", desc: "", type: "Approval group", email: "", members: [], lead: null, defaultRule: "Any one member", meets: "On demand", meetDay: null, meetTime: "", quorum: 0, active: true }); }); setSel(id); };
  const candidates = users.filter((u) => !q.trim() || nameOf(u).toLowerCase().includes(q.trim().toLowerCase()));
  const has = (id: number) => !!g?.members.some((m) => m.userId === id);
  const toggle = (u: U) => patch((x) => {
    if (has(u.userId)) { x.members = x.members.filter((m) => m.userId !== u.userId); if (x.lead === u.userId) x.lead = null; }
    else x.members.push({ userId: u.userId, name: nameOf(u) });
  });
  return (
    <ConfigPage d={d} crumb="Groups" title="Groups" subtitle="The groups that authorise changes (Change Management, CAB, ECAB, technical boards). Only their members can decide an approval stage."
      extra={<button className="btn-ghost" onClick={add}>Create group</button>}>
      <div className="cm-note info" style={{ marginBottom: 12 }}>A group with no members falls back to “any change staff can decide”, so add members to enforce who may approve. Assignment groups (the teams that implement changes) are managed with the other assignment groups in your admin settings.</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{["All", ...TYPES].map((t) => <button key={t} className={filter === t ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setFilter(t)}>{t} ({all.filter((x) => t === "All" || x.type === t).length})</button>)}</div>
      <div className="cm-grid">
        <div className="cm-card" style={{ padding: 0, overflow: "hidden" }}><div className="admin-master-table-scroll">
          <table className="dash-table" style={{ minWidth: 640 }}>
            <thead><tr><th>Group</th><th>Type</th><th>Members</th><th>Used in</th><th>Status</th></tr></thead>
            <tbody>{list.map((x) => (
              <tr key={x.id} onClick={() => setSel(x.id)} style={{ cursor: "pointer", background: sel === x.id ? "var(--blue-light)" : undefined }}>
                <td><b>{x.name || "Unnamed"}</b><div className="cm-hint">{x.desc}</div></td><td>{x.type}</td>
                <td>{x.members.length ? `${x.members.length} member${x.members.length === 1 ? "" : "s"}` : <span style={{ color: "#B54708" }}>None — any staff</span>}</td>
                <td>{usedIn(x.name).length}</td><td><Pillish on={x.active} /></td></tr>))}</tbody>
          </table></div></div>
        <div className="cm-sticky">
          {g ? (
            <Panel title={g.name || "New group"} right={<button className="btn-danger btn-sm" onClick={() => { d.edit((x) => { x.groups.splice(x.groups.findIndex((y) => y.id === g.id), 1); }); setSel(null); }}>Delete</button>}>
              <div className="cm-form-grid" style={{ gridTemplateColumns: "1fr" }}>
                <Lbl label="Group type"><select className="select" value={g.type} onChange={(e) => patch((x) => { x.type = e.target.value as ApprovalGroup["type"]; })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Lbl>
                <Lbl label="Group name" hint="“Change Management” receives escalations, “CAB” runs the weekly meeting and “ECAB” authorises emergencies. Renaming updates the approval rules; lifecycle steps that name this group must be re-selected."><input className="input" value={g.name} onChange={(e) => d.edit((x) => { const t = x.groups.find((y) => y.id === sel); if (!t) return; const old = t.name; t.name = e.target.value; x.rules.forEach((r) => r.stages.forEach((st) => { if (st.grp === old) st.grp = t.name; })); })} /></Lbl>
                <Lbl label="Group e-mail"><input className="input" value={g.email} onChange={(e) => patch((x) => { x.email = e.target.value; })} /></Lbl>
                <Lbl label="Description"><textarea className="textarea" rows={2} value={g.desc} onChange={(e) => patch((x) => { x.desc = e.target.value; })} /></Lbl>
                <Lbl label={`Members (${g.members.length})`}>
                  <input className="input" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
                  <div style={{ maxHeight: 190, overflow: "auto", border: "1px solid var(--border-soft)", borderRadius: 8, padding: 6, marginTop: 6 }}>
                    {candidates.map((u) => <Check key={u.userId} label={nameOf(u)} checked={has(u.userId)} onChange={() => toggle(u)} />)}
                    {!candidates.length && <div className="cm-hint">No people found.</div>}
                  </div>
                </Lbl>
                <Lbl label="Chair / lead" hint="Shown as Chair on the CAB workbench."><select className="select" value={g.lead ?? ""} onChange={(e) => patch((x) => { x.lead = e.target.value ? Number(e.target.value) : null; })}><option value="">None</option>{g.members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select></Lbl>
                <Lbl label="Default decision rule" hint="Suggested when the group is added to an approval stage."><select className="select" value={g.defaultRule} onChange={(e) => patch((x) => { x.defaultRule = e.target.value as RuleText; })}>{RULES.map((r) => <option key={r}>{r}</option>)}</select></Lbl>
                <Lbl label="Meets"><input className="input" value={g.meets} onChange={(e) => patch((x) => { x.meets = e.target.value; })} placeholder="On demand" /></Lbl>
                {g.type === "Board" && <>
                  <Lbl label="Meeting day"><select className="select" value={g.meetDay ?? ""} onChange={(e) => patch((x) => { x.meetDay = e.target.value === "" ? null : Number(e.target.value); })}><option value="">No regular meeting</option>{DAYS.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></Lbl>
                  {g.meetDay !== null && <Lbl label="Meeting time (HH:MM)"><input className="input" value={g.meetTime} onChange={(e) => patch((x) => { x.meetTime = e.target.value; })} /></Lbl>}
                  <Lbl label="Quorum (members present)" hint="0 = more than half."><input type="number" min={0} max={g.members.length} className="input" style={{ width: 100 }} value={g.quorum} onChange={(e) => patch((x) => { x.quorum = Number(e.target.value); })} /></Lbl>
                </>}
                <Check label="Active" checked={g.active} onChange={(v) => patch((x) => { x.active = v; })} />
                {!!usedIn(g.name).length && <div><div className="cm-lbl">Where this group is used</div>{usedIn(g.name).map((u) => <div key={u} className="cm-hint">· {u}</div>)}</div>}
              </div>
            </Panel>
          ) : <Panel title="Select a group"><div className="cm-hint">Choose a group to edit it, or create a new one.</div></Panel>}
        </div>
      </div>
    </ConfigPage>
  );
}
