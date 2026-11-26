import React, { useMemo, useState } from "react";
import { ConfigPage, Check, Lbl, uid, useDraft } from "../components/changeConfigKit";
import { RiskQuestionnaire } from "../components/RiskQuestionnaire";
import { RISK_COLOR, type RiskConfig, type RiskLevel, type RiskQuestion } from "../changeApi";
import { SECTIONS, evaluateRisk, sectionOf } from "../riskEval";

const LEVELS: RiskLevel[] = ["Low", "Moderate", "High", "Very High"];
const IMP = ["Minor", "Moderate", "Major", "Severe"], LIK = ["Rare", "Unlikely", "Possible", "Likely"];
type Tab = "questions" | "scoring" | "settings" | "preview";
const maxW = (q: RiskQuestion) => Math.max(0, ...q.opts.map((o) => o.w));
const minW = (q: RiskQuestion) => Math.min(...q.opts.map((o) => o.w));
const blankQ = (type: RiskQuestion["type"]): RiskQuestion => ({
  id: uid("rq"), section: "likelihood", label: "", help: "", type, required: true, active: true, models: [], cats: [], showIf: null,
  opts: type === "yesno" ? [{ t: "Yes", w: 0, min: "" }, { t: "No", w: 2, min: "" }] : [{ t: "", w: 0, min: "" }, { t: "", w: 2, min: "" }, { t: "", w: 4, min: "" }],
});

export function ChangeRiskPage() {
  const d = useDraft("risk");
  const [tab, setTab] = useState<Tab>("questions");
  const [filter, setFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<{ isNew: boolean; q: RiskQuestion; step: 1 | 2 | 3; err: string } | null>(null);
  const [pv, setPv] = useState<{ model: string; cat: string; answers: Record<string, string | number> }>({ model: "", cat: "", answers: {} });
  const r = d.draft;
  const models = (d.cfg?.models ?? []).filter((m) => m.active);
  const cats = d.cfg?.categories ?? [];
  const qs = r?.questions ?? [];

  const stats = useMemo(() => {
    const act = qs.filter((q) => q.active);
    return { active: act.length, inactive: qs.length - act.length, follow: act.filter((q) => q.showIf).length, targeted: act.filter((q) => q.models.length || q.cats.length).length, max: act.reduce((n, q) => n + maxW(q), 0) };
  }, [qs]);
  const shown = qs.filter((q) => (!filter || q.section === filter) && (!search.trim() || (q.label + q.help + q.opts.map((o) => o.t).join(" ")).toLowerCase().includes(search.trim().toLowerCase())));
  const edit = (fn: (c: RiskConfig) => void) => d.edit(fn);
  const move = (id: string, by: number) => edit((c) => { const i = c.questions.findIndex((q) => q.id === id), j = i + by; if (i < 0 || j < 0 || j >= c.questions.length) return; [c.questions[i], c.questions[j]] = [c.questions[j], c.questions[i]]; });
  const dependents = (id: string) => qs.filter((q) => q.showIf?.q === id);

  // ───── drawer ─────
  const dq = drawer?.q;
  const setDq = (fn: (q: RiskQuestion) => void) => setDrawer((p) => { if (!p) return p; const q = JSON.parse(JSON.stringify(p.q)) as RiskQuestion; fn(q); return { ...p, q, err: "" }; });
  const myIndex = drawer ? (drawer.isNew ? qs.length : qs.findIndex((x) => x.id === drawer.q.id)) : 0;
  const earlier = qs.slice(0, Math.max(0, myIndex)).filter((x) => x.id !== dq?.id);
  const draftErr = (q: RiskQuestion): { step: 1 | 2 | 3; text: string } | null =>
    !q.label.trim() ? { step: 1, text: "Write the question." } : q.opts.length < 2 ? { step: 2, text: "Give the question at least two answers." }
      : q.opts.some((o) => !o.t.trim()) ? { step: 2, text: "Every answer needs text." } : q.showIf && !(q.showIf.opt >= 0 && q.showIf.opt < (qs.find((x) => x.id === q.showIf!.q)?.opts.length ?? 0)) ? { step: 3, text: "Choose which answer shows this follow-up." } : null;
  const apply = () => {
    if (!drawer) return;
    const err = draftErr(drawer.q);
    if (err) { setDrawer({ ...drawer, step: err.step, err: err.text }); return; }
    const q = { ...drawer.q, label: drawer.q.label.trim() };
    edit((c) => { if (!c.bands.length) setupBands(c); if (drawer.isNew) c.questions.push(q); else c.questions = c.questions.map((x) => (x.id === q.id ? q : x)); });
    setDrawer(null);
  };
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const bandErr = (c: RiskConfig) => { const b = [...c.bands].sort((x, y) => x.min - y.min); if (!b.length) return "Configure score bands before assessing risk."; if (b[0].min !== 0) return "The lowest level must start at 0."; for (let i = 0; i < b.length; i++) { if (b[i].min > b[i].max) return `${b[i].level}: “from” is above “to”.`; if (i && b[i].min !== b[i - 1].max + 1) return `Levels must follow on with no gap or overlap (${b[i - 1].level} ends at ${b[i - 1].max}, ${b[i].level} starts at ${b[i].min}).`; } return ""; };
  const setupBands = (c: RiskConfig) => { c.bands = LEVELS.map((level, i) => ({ level, min: i, max: i === LEVELS.length - 1 ? 99 : i })); };
  const setupMatrix = (c: RiskConfig) => {
    if (!c.impFrom.length) c.impFrom = [0, 1, 2, 3];
    if (!c.likFrom.length) c.likFrom = [0, 1, 2, 3];
    if (!c.matrix.length) c.matrix = LEVELS.map(() => LEVELS.map(() => "Low"));
  };
  const pvEval = d.cfg && r ? evaluateRisk({ risk: r, categories: cats }, pv.answers, pv.model, pv.cat || null) : null;

  return (
    <ConfigPage d={d} crumb="Risk Assessment" title="Risk Assessment"
      subtitle="Configure the questionnaire a change answers on Create Change: the questions, who sees them, how answers are scored and how the score becomes a risk level. The score is always worked out on the server.">
      <div className="cm-tabs" style={{ marginTop: 0 }}>
        {([["questions", `Questions (${qs.length})`], ["scoring", "Scoring & risk levels"], ["settings", "Settings"], ["preview", "Preview"]] as [Tab, string][]).map(([k, label]) =>
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>)}
      </div>

      {r && tab === "questions" && (
        <>
          <div className="cm-stats">
            <div className="cm-stat"><span>Active questions</span><b>{stats.active}</b><i>{stats.inactive} inactive</i></div>
            <div className="cm-stat"><span>Follow-up questions</span><b>{stats.follow}</b><i>Shown only after a specific answer</i></div>
            <div className="cm-stat"><span>Targeted questions</span><b>{stats.targeted}</b><i>Limited to some models or categories</i></div>
            <div className="cm-stat"><span>Maximum score</span><b>{stats.max}</b><i>{r.method === "matrix" ? "Impact × Likelihood matrix" : "Sum of the highest answers"}</i></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
            <input className="input" style={{ width: 280 }} placeholder="Search questions or answers…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className={`cm-chip${filter === "" ? " on" : ""}`} onClick={() => setFilter("")}>All sections ({qs.length})</button>
            {SECTIONS.map((s) => <button key={s.id} className={`cm-chip${filter === s.id ? " on" : ""}`} onClick={() => setFilter(filter === s.id ? "" : s.id)}>{s.label} ({qs.filter((q) => q.section === s.id).length})</button>)}
            <div style={{ flex: 1 }} />
            <button className="btn-ghost" onClick={() => setDrawer({ isNew: true, q: blankQ("yesno"), step: 1, err: "" })}>Add yes / no question</button>
            <button className="btn-primary" onClick={() => setDrawer({ isNew: true, q: blankQ("single"), step: 1, err: "" })}>+ Add question</button>
          </div>
          <div className="cm-card" style={{ padding: 0, overflow: "hidden" }}>
            {shown.length === 0 && <div className="cm-hint" style={{ padding: 18 }}>No questions match.</div>}
            {shown.map((q) => {
              const n = qs.indexOf(q) + 1, sec = sectionOf(q.section), dep = q.showIf ? qs.find((x) => x.id === q.showIf!.q) : null;
              return (
                <div key={q.id} className={`cm-qrow${q.active ? "" : " off"}`}>
                  <div className="cm-mv"><button disabled={n === 1 || !!search || !!filter} title="Move up" onClick={() => move(q.id, -1)}>▲</button><button disabled={n === qs.length || !!search || !!filter} title="Move down" onClick={() => move(q.id, 1)}>▼</button></div>
                  <span className="cm-qnum">{n}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <button className="cm-qtext" onClick={() => setDrawer({ isNew: false, q: JSON.parse(JSON.stringify(q)), step: 1, err: "" })}>{q.label || "Untitled question"}</button>
                    {q.help && <div className="cm-hint">{q.help}</div>}
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
                      <span className="badge" style={{ background: sec.bg, color: sec.color }}>{sec.label}</span>
                      {q.opts.some((o) => o.min) && <span className="cm-tag floor">Can force {q.opts.find((o) => o.min)!.min}</span>}
                      {dep && <span className="cm-tag cond">Follow-up of Q{qs.indexOf(dep) + 1}</span>}
                      {q.models.length > 0 && <span className="cm-tag">Models: {q.models.join(", ")}</span>}
                      {q.cats.length > 0 && <span className="cm-tag">Categories: {q.cats.join(", ")}</span>}
                      {!q.required && <span className="cm-tag">Optional</span>}
                    </div>
                  </div>
                  <div className="cm-hint" style={{ width: 130, textAlign: "right" }}><b style={{ color: "var(--ink)" }}>{q.type === "yesno" ? "Yes / No" : q.type === "dropdown" ? "Drop-down list" : "Single choice"} · {q.opts.length}</b><br />Weight {minW(q)}–{maxW(q)}</div>
                  <button className="btn-ghost btn-sm" onClick={() => setDrawer({ isNew: false, q: JSON.parse(JSON.stringify(q)), step: 1, err: "" })}>Edit</button>
                  <button className="btn-ghost btn-sm" title="Duplicate" onClick={() => edit((c) => { const i = c.questions.findIndex((x) => x.id === q.id); c.questions.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(q)), id: uid("rq"), label: `${q.label} (copy)`, showIf: null }); })}>Copy</button>
                  <button className="btn-ghost btn-sm" title="Delete" disabled={dependents(q.id).length > 0} onClick={() => edit((c) => { c.questions = c.questions.filter((x) => x.id !== q.id); })}>Delete</button>
                  <label className="cm-switch" title={q.active ? "Active" : "Inactive"}><input type="checkbox" checked={q.active} onChange={(e) => edit((c) => { const x = c.questions.find((y) => y.id === q.id); if (x) x.active = e.target.checked; })} /><span /></label>
                </div>
              );
            })}
          </div>
          <div className="cm-hint">Changing questions does not re-score changes already raised. A question that has follow-ups cannot be deleted until its follow-ups are removed.</div>
        </>
      )}

      {r && tab === "scoring" && (
        <div className="cm-grid" style={{ gridTemplateColumns: "minmax(0,1fr) 340px" }}>
          <div className="cm-card">
            <div className="cm-card-title">How the risk level is worked out</div>
            <div className="cm-seg" style={{ marginBottom: 12 }}>
              <button className={r.method === "sum" ? "on" : ""} onClick={() => edit((c) => { c.method = "sum"; })}>Sum of scores</button>
              <button className={r.method === "matrix" ? "on" : ""} onClick={() => edit((c) => { c.method = "matrix"; setupMatrix(c); })}>Impact × Likelihood matrix</button>
            </div>
            {r.method === "sum" ? (
              <>
                <div className="cm-hint" style={{ marginBottom: 8 }}>All answer scores are added up and the total picks the level. Highest possible score with the active questions: <b>{stats.max}</b>.</div>
                {!r.bands.length && <button className="btn-ghost btn-sm" onClick={() => edit(setupBands)}>Set up score bands</button>}
                {r.bands.map((b, i) => (
                  <div key={b.level} style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
                    <span className="badge" style={{ background: RISK_COLOR[b.level].bg, color: RISK_COLOR[b.level].color, width: 84, textAlign: "center" }}>{b.level}</span>
                    <input type="number" min={0} className="input" style={{ width: 80 }} value={b.min} onChange={(e) => edit((c) => { c.bands[i].min = Number(e.target.value); })} />
                    <span>to</span>
                    <input type="number" min={0} className="input" style={{ width: 80 }} value={b.max} onChange={(e) => edit((c) => { c.bands[i].max = Number(e.target.value); })} />
                  </div>))}
                {bandErr(r) ? <div className="cm-note bad">{bandErr(r)}</div> : <div className="cm-note ok">The levels follow on from each other with no gaps.</div>}
                <div className="cm-hint" style={{ marginTop: 8 }}>Very High should end above the highest possible score, so no set of answers falls outside a level.</div>
              </>
            ) : (
              <>
                <div className="cm-hint" style={{ marginBottom: 10 }}>The Impact score and the Likelihood + Readiness score each fall in one of four levels; the matrix gives the risk level for each pair.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {([["Impact", IMP, "impFrom"], ["Likelihood + Readiness", LIK, "likFrom"]] as const).map(([title, names, key]) => (
                    <div key={key}><div className="cm-lbl">{title}: level starts at score</div>
                      {names.map((nm, i) => <div key={nm} style={{ display: "flex", gap: 8, alignItems: "center", margin: "5px 0" }}><span style={{ width: 80, fontSize: 12.5 }}>{nm}</span><input type="number" min={0} className="input" style={{ width: 80 }} disabled={i === 0} value={r[key][i]} onChange={(e) => edit((c) => { c[key][i] = Number(e.target.value); })} /></div>)}
                    </div>))}
                </div>
                <table className="cm-matrix"><thead><tr><th>Impact ↓ / Likelihood →</th>{LIK.map((l) => <th key={l}>{l}</th>)}</tr></thead>
                  <tbody>{IMP.map((im, i) => <tr key={im}><th>{im}</th>{LIK.map((l, j) => (
                    <td key={l} style={{ background: RISK_COLOR[r.matrix[i][j]].bg }}><select className="select" style={{ color: RISK_COLOR[r.matrix[i][j]].color, fontWeight: 700 }} value={r.matrix[i][j]} onChange={(e) => edit((c) => { c.matrix[i][j] = e.target.value as RiskLevel; })}>{LEVELS.map((lv) => <option key={lv}>{lv}</option>)}</select></td>))}</tr>)}</tbody></table>
              </>
            )}
          </div>
          <div className="cm-card cm-sticky">
            <div className="cm-card-title">Minimum levels</div>
            <div className="cm-hint">An answer can force a minimum level whatever the score (shown as “Can force High” on the question). Set it in the question’s “Answers &amp; scoring” step.</div>
            <div style={{ marginTop: 10 }}>{qs.filter((q) => q.opts.some((o) => o.min)).map((q) => <div key={q.id} className="cm-hint" style={{ padding: "3px 0" }}>Q{qs.indexOf(q) + 1}: {q.opts.filter((o) => o.min).map((o) => `“${o.t}” → ${o.min}`).join("; ")}</div>)}
              {!qs.some((q) => q.opts.some((o) => o.min)) && <div className="cm-hint">No question forces a level.</div>}</div>
          </div>
        </div>
      )}

      {r && tab === "settings" && (
        <div className="cm-card" style={{ maxWidth: 760 }}>
          <div className="cm-card-title">When the questionnaire applies</div>
          <div className="cm-lbl" style={{ marginBottom: 4 }}>Required before submitting for these change models</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>{models.map((m) => <Check key={m.id} label={m.name} checked={r.settings.requiredFor.includes(m.name)} onChange={(v) => edit((c) => { c.settings.requiredFor = v ? [...c.settings.requiredFor, m.name] : c.settings.requiredFor.filter((x) => x !== m.name); })} />)}</div>
          <Check label="Emergency changes may complete the questionnaire after submitting" hint="Lets an emergency be raised first and assessed afterwards." checked={r.settings.emgAfter} onChange={(v) => edit((c) => { c.settings.emgAfter = v; })} />
          <Check label="Show the score to requesters" hint="Otherwise they see only the risk level." checked={r.settings.showScore} onChange={(v) => edit((c) => { c.settings.showScore = v; })} />
          <div className="cm-card-title" style={{ marginTop: 18 }}>Overrides and reviews</div>
          <Check label="Allow the change manager to override the risk level" checked={r.settings.override} onChange={(v) => edit((c) => { c.settings.override = v; })} />
          <Check label="An override needs a reason" checked={r.settings.overrideReason} onChange={(v) => edit((c) => { c.settings.overrideReason = v; })} />
          <Check label="An override may only lower the level" checked={r.settings.overrideDownOnly} onChange={(v) => edit((c) => { c.settings.overrideDownOnly = v; })} />
          <Check label="Re-assess when the plan changes after approval" checked={r.settings.reassess} onChange={(v) => edit((c) => { c.settings.reassess = v; })} />
          <Check label="Keep a history of each assessment" checked={r.settings.history} onChange={(v) => edit((c) => { c.settings.history = v; })} />
          <Lbl label="Review the questionnaire every (months, 0 = never)"><input type="number" min={0} max={60} className="input" style={{ width: 100 }} value={r.settings.reviewMonths} onChange={(e) => edit((c) => { c.settings.reviewMonths = Number(e.target.value); })} /></Lbl>
          <div className="cm-note info">“Required for”, “after submitting” and “show the score” are applied now. The override, re-assess, history and review options are saved with the questionnaire but not enforced yet.</div>
        </div>
      )}

      {r && tab === "preview" && pvEval && (
        <div className="cm-grid">
          <div className="cm-card">
            <div className="cm-form-grid" style={{ marginBottom: 12 }}>
              <Lbl label="Change model"><select className="select" value={pv.model} onChange={(e) => setPv({ ...pv, model: e.target.value, answers: {} })}>{models.map((m) => <option key={m.id}>{m.name}</option>)}</select></Lbl>
              <Lbl label="Category"><select className="select" value={pv.cat} onChange={(e) => setPv({ ...pv, cat: e.target.value, answers: {} })}><option value="">Any</option>{cats.filter((c) => c.active).map((c) => <option key={c.id}>{c.name}</option>)}</select></Lbl>
            </div>
            <RiskQuestionnaire questions={qs} visible={pvEval.visible} answers={pv.answers} onAnswer={(id, i) => setPv((p) => ({ ...p, answers: { ...p.answers, [id]: i } }))} />
          </div>
          <div className="cm-card cm-sticky">
            <div className="cm-card-title">Result</div>
            {pvEval.level ? <span className="badge" style={{ background: RISK_COLOR[pvEval.level].bg, color: RISK_COLOR[pvEval.level].color, fontSize: 14 }}>{pvEval.level} risk</span> : <span className="cm-hint">Answer a question to see the level.</span>}
            <div className="cm-hint" style={{ marginTop: 8 }}>Score {pvEval.score} of {pvEval.max} · {pvEval.answered} of {pvEval.total} answered</div>
            {r.method === "matrix" && <div className="cm-hint">Impact {pvEval.sections.impact} · Likelihood {pvEval.sections.likelihood} · Readiness {pvEval.sections.readiness}</div>}
            {pvEval.floors.map((f) => <div key={f} className="cm-note warn">{f}</div>)}
            {!pvEval.complete && pvEval.answered > 0 && <div className="cm-note info">{pvEval.missing.length} required question{pvEval.missing.length === 1 ? "" : "s"} still to answer.</div>}
            <button className="btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setPv({ ...pv, answers: {} })}>Clear answers</button>
          </div>
        </div>
      )}

      {drawer && dq && (
        <>
          <button className="cm-scrim" aria-label="Close" onClick={() => setDrawer(null)} />
          <div className="cm-drawer" role="dialog" aria-modal="true">
            <div className="cm-drawer-head">
              <div className="cm-hint" style={{ fontWeight: 800, textTransform: "uppercase" }}>{drawer.isNew ? "New question" : `Question ${myIndex + 1}`}</div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{drawer.isNew ? "Add a question" : "Edit question"}</div>
              <div className="cm-tabs" style={{ margin: "8px 0 0" }}>{(["Question", "Answers & scoring", "Who sees it"] as const).map((t, i) => <button key={t} className={drawer.step === i + 1 ? "on" : ""} onClick={() => setDrawer({ ...drawer, step: (i + 1) as 1 | 2 | 3 })}>{i + 1}. {t}</button>)}</div>
            </div>
            <div className="cm-drawer-body">
              {drawer.step === 1 && (<>
                <Lbl label="Question"><textarea className="textarea" rows={2} value={dq.label} onChange={(e) => setDq((q) => { q.label = e.target.value; })} /></Lbl>
                <Lbl label="Help text (optional)"><input className="input" value={dq.help} onChange={(e) => setDq((q) => { q.help = e.target.value; })} /></Lbl>
                <Lbl label="Section" hint={sectionOf(dq.section).desc}><select className="select" value={dq.section} onChange={(e) => setDq((q) => { q.section = e.target.value as RiskQuestion["section"]; })}>{SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Lbl>
                <Lbl label="Answer style"><select className="select" value={dq.type} onChange={(e) => setDq((q) => { q.type = e.target.value as RiskQuestion["type"]; })}><option value="single">Single choice (radio buttons)</option><option value="yesno">Yes / No</option><option value="dropdown">Drop-down list</option></select></Lbl>
                <Check label="Required" hint="An optional question can be left unanswered." checked={dq.required} onChange={(v) => setDq((q) => { q.required = v; })} />
              </>)}
              {drawer.step === 2 && (<>
                <div className="cm-hint">Each answer adds its score. Set a minimum level on an answer to force at least that level whatever the total.</div>
                {dq.opts.map((o, j) => (
                  <div key={j} style={{ display: "grid", gridTemplateColumns: "1fr 64px 110px auto", gap: 8, alignItems: "center" }}>
                    <input className="input" placeholder="Answer" value={o.t} onChange={(e) => setDq((q) => { q.opts[j].t = e.target.value; })} />
                    <input className="input" type="number" min={0} title="Score" value={o.w} onChange={(e) => setDq((q) => { q.opts[j].w = Number(e.target.value); })} />
                    <select className="select" title="Minimum level" value={o.min} onChange={(e) => setDq((q) => { q.opts[j].min = e.target.value as RiskQuestion["opts"][number]["min"]; })}><option value="">No minimum</option>{LEVELS.slice(1).map((lv) => <option key={lv} value={lv}>At least {lv}</option>)}</select>
                    <button className="btn-ghost btn-sm" disabled={dq.opts.length <= 2 || dq.type === "yesno"} onClick={() => setDq((q) => { q.opts.splice(j, 1); })}>Remove</button>
                  </div>))}
                {dq.type !== "yesno" && <div><button className="btn-ghost btn-sm" onClick={() => setDq((q) => { q.opts.push({ t: "", w: maxW(q) + 1, min: "" }); })}>Add answer</button></div>}
              </>)}
              {drawer.step === 3 && (<>
                <div className="cm-lbl">Only for these change models (none ticked = all)</div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{models.map((m) => <Check key={m.id} label={m.name} checked={dq.models.includes(m.name)} onChange={() => setDq((q) => { q.models = toggle(q.models, m.name); })} />)}</div>
                <div className="cm-lbl" style={{ marginTop: 8 }}>Only for these categories (none ticked = all; sub-categories count too)</div>
                <div className="cm-chips">{cats.filter((c) => c.active).map((c) => <button key={c.id} type="button" className={`cm-chip${dq.cats.includes(c.name) ? " on" : ""}`} onClick={() => setDq((q) => { q.cats = toggle(q.cats, c.name); })}>{c.name}</button>)}</div>
                <div className="cm-lbl" style={{ marginTop: 8 }}>Follow-up</div>
                <Check label="Show only after a specific answer to an earlier question" checked={!!dq.showIf} onChange={(v) => setDq((q) => { q.showIf = v && earlier[0] ? { q: earlier[0].id, opt: 0 } : null; })} />
                {dq.showIf && (
                  <div className="cm-form-grid">
                    <Lbl label="Earlier question"><select className="select" value={dq.showIf.q} onChange={(e) => setDq((q) => { q.showIf = { q: e.target.value, opt: 0 }; })}>{earlier.map((x) => <option key={x.id} value={x.id}>Q{qs.indexOf(x) + 1}. {x.label.slice(0, 48)}</option>)}</select></Lbl>
                    <Lbl label="Shown when answered"><select className="select" value={dq.showIf.opt} onChange={(e) => setDq((q) => { q.showIf = { q: q.showIf!.q, opt: Number(e.target.value) }; })}>{(qs.find((x) => x.id === dq.showIf!.q)?.opts ?? []).map((o, i) => <option key={i} value={i}>{o.t}</option>)}</select></Lbl>
                  </div>)}
                {!earlier.length && <div className="cm-hint">There is no earlier question to depend on yet.</div>}
              </>)}
            </div>
            <div className="cm-drawer-foot">
              {drawer.err && <span className="cm-note bad" style={{ margin: 0, flex: 1 }}>{drawer.err}</span>}
              <span style={{ flex: drawer.err ? 0 : 1 }} />
              <button className="btn-ghost" onClick={() => setDrawer(null)}>Cancel</button>
              {drawer.step > 1 && <button className="btn-ghost" onClick={() => setDrawer({ ...drawer, step: (drawer.step - 1) as 1 | 2 | 3 })}>Back</button>}
              {drawer.step < 3 && <button className="btn-ghost" onClick={() => setDrawer({ ...drawer, step: (drawer.step + 1) as 1 | 2 | 3 })}>Next</button>}
              <button className="btn-primary" onClick={apply}>{drawer.isNew ? "Add question" : "Apply changes"}</button>
            </div>
          </div>
        </>
      )}
    </ConfigPage>
  );
}
