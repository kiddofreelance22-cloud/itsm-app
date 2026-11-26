import React, { useState } from "react";
import { ConfigPage, Check, Lbl, Panel, Pillish, uid, useDraft } from "../components/changeConfigKit";
import { COLORS, PIR_RULES, colorSet, type ChangeModel } from "../changeApi";

export function ChangeModelsPage() {
  const d = useDraft("models");
  const [sel, setSel] = useState<string | null>(null);
  const models = d.draft ?? [];
  const m = models.find((x) => x.id === sel) ?? null;
  const lifecycles = d.cfg?.lifecycles ?? [];
  const patch = (fn: (m: ChangeModel) => void) => d.edit((l) => { const t = l.find((x) => x.id === sel); if (t) fn(t); });
  const add = () => { const id = uid("mod"); d.edit((l) => l.push({ id, name: "", desc: "", leadDays: 5, color: "blue", active: true, base: "Normal", lifecycle: lifecycles.find((x) => /normal/i.test(x.name))?.id ?? lifecycles[0]?.id ?? "", pir: "High risk and unsuccessful changes", linkIncident: false })); setSel(id); };

  return (
    <ConfigPage d={d} crumb="Change Models" title="Change Models" subtitle="Each change type follows a model: how far ahead it must be raised, which lifecycle it follows, and when it needs a review."
      extra={<button className="btn-ghost" onClick={add}>Add change model</button>}>
      <div className="cm-grid">
        <div>
          {models.map((x) => (
            <div key={x.id} className="cm-card" style={{ cursor: "pointer", borderColor: sel === x.id ? "var(--blue)" : undefined }} onClick={() => setSel(x.id)}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="badge" style={{ background: colorSet(x.color).bg, color: colorSet(x.color).color }}>{x.name || "Unnamed"}</span>
                <Pillish on={x.active} /> <span className="cm-hint">behaves like {x.base}</span>
              </div>
              <div style={{ fontSize: 12.5, margin: "6px 0" }}>{x.desc}</div>
              <dl className="cm-kv" style={{ gridTemplateColumns: "170px 1fr" }}>
                <dt>Lifecycle</dt><dd>{lifecycles.find((l) => l.id === x.lifecycle)?.name ?? "—"}</dd>
                <dt>Lead time</dt><dd>{x.leadDays ? `${x.leadDays} days` : "None"}</dd>
                <dt>Post-implementation review</dt><dd>{x.pir}</dd>
              </dl>
            </div>
          ))}
        </div>
        <div className="cm-sticky">
          {m ? (
            <Panel title={m.name || "New model"} right={<button className="btn-danger btn-sm" onClick={() => { d.edit((l) => { l.splice(l.findIndex((x) => x.id === m.id), 1); }); setSel(null); }}>Delete</button>}>
              <div className="cm-form-grid" style={{ gridTemplateColumns: "1fr" }}>
                <Lbl label="Model name"><input className="input" value={m.name} onChange={(e) => patch((t) => { t.name = e.target.value; })} /></Lbl>
                <Lbl label="When to use it"><textarea className="textarea" rows={3} value={m.desc} onChange={(e) => patch((t) => { t.desc = e.target.value; })} /></Lbl>
                <Lbl label="Behaves like" hint="Standard: pre-approved from a template. Emergency: skips lead time. Normal: everything else."><select className="select" value={m.base} onChange={(e) => patch((t) => { t.base = e.target.value as ChangeModel["base"]; })}><option>Standard</option><option>Normal</option><option>Emergency</option></select></Lbl>
                <Lbl label="Minimum lead time (days)"><input type="number" min={0} className="input" value={m.leadDays} onChange={(e) => patch((t) => { t.leadDays = Number(e.target.value); })} /></Lbl>
                <Lbl label="Colour"><select className="select" value={m.color} onChange={(e) => patch((t) => { t.color = e.target.value; })}>{COLORS.map((c) => <option key={c}>{c}</option>)}</select></Lbl>
                <Lbl label="Lifecycle" hint="The steps every change of this model follows. Edit them in Change Lifecycle."><select className="select" value={m.lifecycle} onChange={(e) => patch((t) => { t.lifecycle = e.target.value; })}>{lifecycles.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Lbl>
                <Lbl label="Post-implementation review"><select className="select" value={m.pir} onChange={(e) => patch((t) => { t.pir = e.target.value as ChangeModel["pir"]; })}>{PIR_RULES.map((p) => <option key={p}>{p}</option>)}</select></Lbl>
                <Check label="Must be linked to an incident" checked={m.linkIncident} onChange={(v) => patch((t) => { t.linkIncident = v; })} />
                <Check label="Active — offered on Create Change" checked={m.active} onChange={(v) => patch((t) => { t.active = v; })} />
              </div>
            </Panel>
          ) : <Panel title="Select a model"><div className="cm-hint">Choose a model to edit it, or add a new one.</div></Panel>}
          <div className="cm-hint">Who authorises a change follows from its lifecycle and the approval policy. Whether risk is assessed follows from the lifecycle's Assess step.</div>
        </div>
      </div>
    </ConfigPage>
  );
}
