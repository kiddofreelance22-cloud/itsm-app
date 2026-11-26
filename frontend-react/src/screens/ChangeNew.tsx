import React, { useEffect, useMemo, useState } from "react";
import { Link, useRouteParams, useRouter } from "../router";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useAsync } from "../hooks";
import { ErrorBar, errMsg } from "../components/configKit";
import { ConflictList, Field, PageHead } from "../components/changeKit";
import { DateTimePicker } from "../components/DateTimePicker";
import { RiskQuestionnaire } from "../components/RiskQuestionnaire";
import { SearchSelect, type SearchOption } from "../components/SearchSelect";
import { evaluateRisk } from "../riskEval";
import {
  categoryGroup, categoryRows, changeApi, fmtDT, fromLocalInput, toLocalInput, typeColor,
  type Change, type ChangeModel, type ChangePreview, type ChangeType,
} from "../changeApi";

interface Form {
  changeType: ChangeType; template: string; shortDescription: string; category: string; businessService: string; cis: string;
  assignmentGroup: string; assignedToId: string; incident: string; description: string; justification: string;
  impact: string; urgency: string; riskAnswers: Record<string, string>;
  plannedStart: string; plannedEnd: string; causesOutage: boolean; expectedOutage: string;
  implementationPlan: string; backoutPlan: string; testPlan: string; communicationPlan: string;
}
interface IncidentSearchRow { incidentId: string; incidentCode?: string | null; title: string; status: string }
const blank: Form = {
  changeType: "", template: "", shortDescription: "", category: "", businessService: "", cis: "", assignmentGroup: "", assignedToId: "",
  incident: "", description: "", justification: "", impact: "", urgency: "", riskAnswers: {}, plannedStart: "", plannedEnd: "",
  causesOutage: false, expectedOutage: "", implementationPlan: "", backoutPlan: "", testPlan: "", communicationPlan: "",
};
const cisOf = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
const toForm = (c: Change): Form => ({
  changeType: c.changeType, template: c.templateId ?? "", shortDescription: c.shortDescription, category: c.category ?? "", businessService: c.businessService ?? "",
  cis: (c.configurationItems ?? []).join(", "), assignmentGroup: c.assignmentGroup ?? "", assignedToId: c.assignedTo ? String(c.assignedTo.userId) : "",
  incident: c.relatedRecords?.find((r) => r.kind === "Incident")?.number ?? "", description: c.description ?? "", justification: c.justification ?? "",
  impact: c.impact ?? "", urgency: c.urgency ?? "", riskAnswers: c.riskAnswers ?? {}, plannedStart: toLocalInput(c.plannedStart), plannedEnd: toLocalInput(c.plannedEnd),
  causesOutage: c.causesOutage, expectedOutage: c.expectedOutage ?? "", implementationPlan: c.implementationPlan ?? "", backoutPlan: c.backoutPlan ?? "",
  testPlan: c.testPlan ?? "", communicationPlan: c.communicationPlan ?? "",
});

function payload(f: Form, standard: boolean, existing?: Change) {
  const others = (existing?.relatedRecords ?? []).filter((r) => r.kind !== "Incident");
  return {
    shortDescription: f.shortDescription.trim(), description: f.description || undefined, category: f.category || undefined,
    businessService: f.businessService || undefined, configurationItems: cisOf(f.cis), assignmentGroup: f.assignmentGroup || undefined,
    assignedToId: f.assignedToId ? Number(f.assignedToId) : undefined, impact: f.impact || undefined, urgency: f.urgency || undefined,
    justification: f.justification || undefined, riskAnswers: standard ? {} : f.riskAnswers,
    plannedStart: fromLocalInput(f.plannedStart), plannedEnd: fromLocalInput(f.plannedEnd), causesOutage: f.causesOutage,
    expectedOutage: f.causesOutage ? f.expectedOutage || undefined : undefined,
    implementationPlan: f.implementationPlan || undefined, backoutPlan: f.backoutPlan || undefined,
    testPlan: f.testPlan || undefined, communicationPlan: f.communicationPlan || undefined,
    relatedRecords: [...(f.incident.trim() ? [{ kind: "Incident", number: f.incident.trim() }] : []), ...others],
  };
}

/** Everything that must be filled in before the change can be submitted. */
function missing(f: Form, model?: ChangeModel): string[] {
  const m: string[] = [];
  const standard = model?.base === "Standard";
  if (!f.changeType) m.push("change model");
  if (standard && !f.template) m.push("an approved standard change template");
  if (!f.shortDescription.trim()) m.push("short description");
  if (!f.category) m.push("category");
  if (!f.businessService) m.push("affected business service");
  if (!cisOf(f.cis).length) m.push("configuration items");
  if (model?.linkIncident && !f.incident.trim()) m.push("related incident");
  if (!f.description.trim()) m.push("description");
  if (!f.plannedStart || !f.plannedEnd) m.push("planned start and end");
  else if (new Date(f.plannedEnd) <= new Date(f.plannedStart)) m.push("a planned end after the planned start");
  if (!standard) {
    if (!f.implementationPlan.trim()) m.push("implementation plan");
    if (!f.backoutPlan.trim()) m.push("backout plan");
  }
  return m;
}

export function ChangeNewPage({ editing }: { editing?: boolean }) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const params = useRouteParams("/changes/:id/edit");
  const editId = editing ? Number(params?.id) : 0;
  const cfgQ = useAsync(() => changeApi.config(), []);
  const existingQ = useAsync(() => (editId ? changeApi.get(editId) : Promise.resolve(null)), [editId]);
  const incidentRoute = user?.role === "ADMIN" ? "/incidents/admin-list" : user?.role === "END_USER" ? "/incidents/mine" : "/incidents/workgroup";
  const incidentsQ = useAsync(() => user ? api.get<IncidentSearchRow[]>(incidentRoute) : Promise.resolve([]), [user?.role]);
  // Assignment groups come only from Configuration → Workgroup.
  const groupsQ = useAsync(() => changeApi.workgroups().catch(() => [] as { groupId: number; groupName: string }[]), []);
  const usersQ = useAsync(() => api.get<{ userId: number; fullName?: string; firstName?: string; lastName?: string; username?: string }[]>("/users/assignable").catch(() => []), []);

  const [f, setF] = useState<Form>(blank);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<ChangePreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Change | null>(null);
  const cfg = cfgQ.data;
  const models = (cfg?.models ?? []).filter((m) => m.active || m.name === existingQ.data?.changeType);
  const model = cfg?.models.find((m) => m.name === f.changeType);
  const standard = model?.base === "Standard";
  const lifecycle = cfg?.lifecycles.find((l) => l.id === model?.lifecycle);
  const needsRisk = !standard && (!cfg || !lifecycle ? true : lifecycle.steps.some((x) => x.type === "gate" && (x.gate ?? "risk") === "risk") || cfg.risk.settings.requiredFor.includes(f.changeType) || model?.base === "Emergency");
  const questions = cfg?.risk.questions ?? [];
  const riskNow = cfg ? evaluateRisk(cfg, f.riskAnswers, f.changeType, f.category || null) : null;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { if (existingQ.data && !loaded) { setF(toForm(existingQ.data)); setLoaded(true); } }, [existingQ.data, loaded]);
  // New change: honour ?type=<model> (from the overview shortcuts), else start on the first active model.
  const [typeChosen, setTypeChosen] = useState(false);
  useEffect(() => {
    if (editId || !cfg || typeChosen) return;
    const wanted = new URLSearchParams(window.location.search).get("type");
    const pick = cfg.models.find((m) => m.active && m.name === wanted) ?? cfg.models.find((m) => m.active);
    if (pick) setF((p) => ({ ...p, changeType: pick.name }));
    setTypeChosen(true);
  }, [cfg, editId, typeChosen]);

  // Live risk / approval path / conflict summary — computed by the server so the form never disagrees with the rules.
  const key = JSON.stringify([f.changeType, f.category, f.riskAnswers, f.businessService, f.cis, f.impact, f.urgency, f.plannedStart, f.plannedEnd, f.causesOutage]);
  useEffect(() => {
    if (!cfg || !f.changeType) { setPreview(null); return; }
    const t = setTimeout(() => {
      changeApi.preview({
        changeId: editId || undefined, changeType: f.changeType, riskAnswers: f.riskAnswers, businessService: f.businessService || undefined,
        configurationItems: cisOf(f.cis), category: f.category || undefined, impact: f.impact || undefined, urgency: f.urgency || undefined,
        plannedStart: fromLocalInput(f.plannedStart), plannedEnd: fromLocalInput(f.plannedEnd), causesOutage: f.causesOutage,
      }).then(setPreview).catch(() => setPreview(null));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const steps = useMemo(() => (needsRisk ? ["Change model", "What is changing", "Risk assessment", "Schedule and plans"] : ["Change model", "What is changing", "Schedule and plans"]), [needsRisk]);
  const cur = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;
  const gaps = missing(f, model);
  // Only a draft can be submitted; a change already in assessment/approval/scheduled is just saved.
  const canSubmit = !editing || existingQ.data?.state === "New";
  const groupOptions = (groupsQ.data ?? []).map((g) => g.groupName);
  const incidentOptions: SearchOption[] = [
    { value: "", label: "No incident linked" },
    ...(incidentsQ.data ?? []).map((i) => ({
      value: i.incidentCode || i.incidentId,
      label: i.incidentCode || i.incidentId,
      sub: [i.title, i.status].filter(Boolean).join(" · "),
    })),
  ];

  const pickType = (t: ChangeType) => { setF((p) => ({ ...p, changeType: t, template: cfg?.models.find((m) => m.name === t)?.base === "Standard" ? p.template : "" })); setStep(0); };
  const pickTemplate = (id: string) => {
    const t = cfg?.templates.find((x) => x.id === id); if (!t) return;
    setF((p) => ({ ...p, template: id, shortDescription: p.shortDescription || t.name, category: t.category, businessService: t.service, assignmentGroup: groupOptions.includes(t.group) ? t.group : p.assignmentGroup,
      description: t.description, implementationPlan: t.implementationPlan, backoutPlan: t.backoutPlan, testPlan: t.testPlan }));
  };
  const pickCategory = (name: string) => setF((p) => {
    const def = cfg ? categoryGroup(cfg.categories, name) : "";
    return { ...p, category: name, assignmentGroup: p.assignmentGroup || (groupOptions.includes(def) ? def : "") };
  });

  const save = async (submit: boolean) => {
    if (!f.changeType) { setErr("Choose a change model first."); return; }
    if (!f.shortDescription.trim()) { setErr("Enter a short description first."); return; }
    if (submit && gaps.length) { setErr(`Complete before submitting: ${gaps.join(", ")}.`); return; }
    setSaving(true); setErr("");
    try {
      let c: Change;
      if (editId) { c = await changeApi.update(editId, payload(f, standard, existingQ.data ?? undefined)); if (submit && canSubmit) c = await changeApi.submit(editId); }
      else c = await changeApi.create({ ...payload(f, standard), changeType: f.changeType, templateId: f.template || undefined, submit });
      if (editId) navigate(`/changes/${editId}`); else setDone(c);
    } catch (e) { setErr(errMsg(e, "Unable to save the change.")); }
    finally { setSaving(false); }
  };

  const inputStyle = { width: "100%" };
  if (cfgQ.loading || (editId && existingQ.loading)) return <div className="spinner-row">Loading…</div>;
  if (!cfg) return <ErrorBar msg={cfgQ.error ?? "Unable to load change settings."} />;
  if (done) {
    return (
      <>
        <PageHead crumb="Change Management > Create Change" title="Create Change" />
        <div className="page-body"><div className="cm-card" style={{ maxWidth: 560 }}>
          <div className="cm-card-title">{done.changeCode} created</div>
          <div className="cm-note ok">{done.state === "New" ? "Saved as a draft. Submit it from the change record when it is ready."
            : done.state === "Scheduled" ? "This standard change is pre-approved and is now scheduled."
            : "Submitted. Approvals have been requested."}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Link to={`/changes/${done.changeId}`} className="btn-primary">Open change record</Link>
            <button className="btn-ghost" onClick={() => { setDone(null); setF(blank); setStep(0); setErr(""); setTypeChosen(false); }}>Create another change</button>
            <Link to="/changes" className="btn-ghost">Go to change list</Link>
          </div>
        </div></div>
      </>
    );
  }

  const section = (num: number, title: string, body: React.ReactNode) => (
    <div className="cm-card"><div className="cm-card-title"><span className="cm-step-num">{num}</span>{title}</div>{body}</div>
  );

  return (
    <>
      <PageHead crumb={`Change Management > ${editing ? "Edit change" : "Create Change"}`} title={editing ? `Edit ${existingQ.data?.changeCode ?? "change"}` : "Create Change — Request for Change"}
        subtitle="Pick the change model, describe the change, assess its risk and plan the window. The approval path follows from the model and risk." />
      <div className="page-body">
        <div className="cm-steps">{steps.map((s, i) => <button key={s} className={i === step ? "on" : i < step ? "done" : ""} onClick={() => setStep(i)}>{i + 1}. {s}</button>)}</div>
        <div className="cm-grid">
          <div>
            {cur === "Change model" && section(1, "Change model", <>
              <div className="cm-type-cards">
                {models.map((m) => (
                  <button key={m.name} type="button" disabled={!!editing} className={`cm-type-card${f.changeType === m.name ? " on" : ""}`} onClick={() => pickType(m.name)}>
                    <div style={{ fontWeight: 800 }}><span className="badge" style={{ background: typeColor(m.name).bg, color: typeColor(m.name).color }}>{m.name}</span></div>
                    <div style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 8px" }}>{m.desc}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{m.leadDays ? `${m.leadDays}-day lead time` : "No lead time"}{m.linkIncident ? " · Linked incident required" : ""}</div>
                  </button>
                ))}
              </div>
              {standard && (
                <div style={{ marginTop: 14 }}>
                  <span className="cm-lbl">Choose an authorised standard change template<span className="req">*</span></span>
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {cfg.templates.filter((t) => t.status === "Active" || t.id === f.template).map((t) => (
                      <button key={t.id} type="button" className={`cm-type-card${f.template === t.id ? " on" : ""}`} onClick={() => pickTemplate(t.id)}>
                        <b>{t.name}</b> <span className="badge" style={{ background: "#ECFDF3", color: "#027A48" }}>Pre-approved</span>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.category} · {t.service} · {t.group}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {model?.base === "Emergency" && <div className="cm-note bad">Emergency changes skip the lead time and are authorised by the emergency board. Use this model only to restore service or close an urgent security exposure{model.linkIncident ? ", and link the incident" : ""}.</div>}
            </>)}

            {cur === "What is changing" && section(2, "What is changing", (
              <div className="cm-form-grid">
                <Field label="Short description" req full><input className="input" style={inputStyle} maxLength={255} value={f.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} /></Field>
                <Field label="Category" req><select className="select" value={f.category} onChange={(e) => pickCategory(e.target.value)}><option value="">Select</option>{categoryRows(cfg.categories).filter(({ c }) => c.active || c.name === f.category).map(({ c, depth }) => <option key={c.id} value={c.name}>{"\u00A0\u00A0".repeat(depth - 1)}{depth > 1 ? "› " : ""}{c.name}</option>)}</select></Field>
                <Field label="Affected business service" req><input className="input" style={inputStyle} value={f.businessService} onChange={(e) => set("businessService", e.target.value)} /></Field>
                <Field label="Configuration items" req full hint="Comma-separated. Used for conflict detection and impact analysis."><input className="input" style={inputStyle} value={f.cis} onChange={(e) => set("cis", e.target.value)} placeholder="e.g. core-sw-01, core-sw-02" /></Field>
                <Field label="Assignment group" hint="Chosen from the workgroups. Defaults from the category."><select className="select" value={f.assignmentGroup} onChange={(e) => set("assignmentGroup", e.target.value)}><option value="">{groupsQ.loading ? "Loading…" : "Select a workgroup"}</option>{f.assignmentGroup && !groupOptions.includes(f.assignmentGroup) && <option value={f.assignmentGroup}>{f.assignmentGroup} (not a workgroup)</option>}{groupOptions.map((g) => <option key={g}>{g}</option>)}</select></Field>
                <Field label="Change owner"><select className="select" value={f.assignedToId} onChange={(e) => set("assignedToId", e.target.value)}><option value="">Unassigned</option>{(usersQ.data ?? []).map((u) => <option key={u.userId} value={u.userId}>{u.fullName ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.username)}</option>)}</select></Field>
                <Field label="Related incident" req={!!model?.linkIncident}>
                  {incidentsQ.error && <ErrorBar msg={incidentsQ.error} />}
                  <SearchSelect
                    ariaLabel="Related incident"
                    value={f.incident}
                    label={f.incident ? incidentOptions.find((i) => i.value === f.incident)?.label ?? f.incident : "No incident linked"}
                    options={incidentOptions}
                    placeholder="Search by incident number or title…"
                    emptyText="No incidents match your search."
                    onSelect={(option) => set("incident", option?.value ?? "")}
                  />
                </Field>
                <div />
                <Field label="Description" req full><textarea className="textarea" rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
                <Field label="Business justification" full><textarea className="textarea" rows={3} value={f.justification} onChange={(e) => set("justification", e.target.value)} /></Field>
                <Field label="Impact"><select className="select" value={f.impact} onChange={(e) => set("impact", e.target.value)}><option value="">Select</option>{cfg.impacts.map((o) => <option key={o}>{o}</option>)}</select></Field>
                <Field label="Urgency"><select className="select" value={f.urgency} onChange={(e) => set("urgency", e.target.value)}><option value="">Select</option>{cfg.urgencies.map((o) => <option key={o}>{o}</option>)}</select></Field>
              </div>
            ))}

            {cur === "Risk assessment" && section(3, "Risk assessment", <>
              <div className="cm-hint" style={{ marginBottom: 6 }}>{riskNow?.answered ?? 0} of {riskNow?.total ?? 0} questions answered{model?.base === "Emergency" && cfg.risk.settings.emgAfter ? " — may be completed after implementation" : ""}.{riskNow && !riskNow.complete && riskNow.answered > 0 ? ` ${riskNow.missing.length} required still to answer.` : ""}</div>
              <RiskQuestionnaire questions={questions} visible={riskNow?.visible ?? {}} answers={f.riskAnswers} onAnswer={(id, i) => set("riskAnswers", { ...f.riskAnswers, [id]: String(i) })} />
              {preview?.risk.floors.map((x) => <div key={x} className="cm-note warn">{x}</div>)}
            </>)}

            {cur === "Schedule and plans" && <>
              {section(needsRisk ? 4 : 3, "Schedule and outage", (
                <div className="cm-form-grid">
                  <Field label="Planned start" req><DateTimePicker value={f.plannedStart} onChange={(v) => set("plannedStart", v)} /></Field>
                  <Field label="Planned end" req><DateTimePicker value={f.plannedEnd} min={f.plannedStart || undefined} onChange={(v) => set("plannedEnd", v)} /></Field>
                  <label className="cm-opt full" style={{ gridColumn: "1 / -1" }}><input type="checkbox" checked={f.causesOutage} onChange={(e) => set("causesOutage", e.target.checked)} />This change causes a service outage or degradation</label>
                  {f.causesOutage && <Field label="Expected outage" full><input className="input" style={inputStyle} value={f.expectedOutage} onChange={(e) => set("expectedOutage", e.target.value)} placeholder="e.g. 20 minutes of network downtime" /></Field>}
                </div>
              ))}
              {section(needsRisk ? 5 : 4, "Plans", (
                <div className="cm-form-grid">
                  <Field label="Implementation plan" req={!standard} full><textarea className="textarea" rows={4} value={f.implementationPlan} onChange={(e) => set("implementationPlan", e.target.value)} /></Field>
                  <Field label="Backout plan" req={!standard} full><textarea className="textarea" rows={3} value={f.backoutPlan} onChange={(e) => set("backoutPlan", e.target.value)} /></Field>
                  <Field label="Test and verification plan" full><textarea className="textarea" rows={3} value={f.testPlan} onChange={(e) => set("testPlan", e.target.value)} /></Field>
                  <Field label="Communication plan" full><textarea className="textarea" rows={3} value={f.communicationPlan} onChange={(e) => set("communicationPlan", e.target.value)} /></Field>
                </div>
              ))}
              {gaps.length > 0 && <div className="cm-note warn"><b>Complete these before submitting:</b>{gaps.map((g) => <div key={g}>· {g}</div>)}</div>}
            </>}

            <ErrorBar msg={err} />
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <Link to={editing ? `/changes/${editId}` : "/changes"} className="btn-ghost">Cancel</Link>
              {step > 0 && <button className="btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
              {canSubmit && <button className="btn-ghost" disabled={saving} onClick={() => save(false)}>Save as draft</button>}
              <div style={{ flex: 1 }} />
              {!last ? <button className="btn-primary" onClick={() => setStep(step + 1)}>Next: {steps[step + 1]}</button>
                : <button className="btn-primary" disabled={saving} onClick={() => save(true)}>{!canSubmit ? "Save changes" : standard ? "Submit standard change" : "Submit for assessment"}</button>}
            </div>
          </div>

          <div className="cm-sticky">
            <div className="cm-card">
              <div className="cm-card-title">Summary</div>
              <dl className="cm-kv" style={{ gridTemplateColumns: "100px 1fr" }}>
                <dt>Model</dt><dd>{f.changeType}</dd>
                <dt>Priority</dt><dd>{preview?.priority ?? "—"}</dd>
                <dt>Risk score</dt><dd>{standard ? "Inherited from template" : preview?.risk.score != null ? (cfg.risk.settings.showScore ? `${preview.risk.score} of ${preview.risk.max}` : "Hidden") : "—"}</dd>
                <dt>Risk level</dt><dd>{preview?.risk.level ?? (standard ? "Low" : "—")}</dd>
              </dl>
              <div className="cm-lbl" style={{ margin: "14px 0 6px" }}>Approval path</div>
              {preview?.approvalPath.length ? preview.approvalPath.map((p, i) => (
                <div key={i} style={{ fontSize: 12.5, padding: "4px 0" }}><b>{i + 1}. {p.group}</b><div className="cm-hint">{p.rule} · {p.members ? `${p.members} member${p.members === 1 ? "" : "s"}` : "no members set — any change staff"}</div></div>
              )) : <div className="cm-hint">{standard || (preview && !preview.approvalPath.length && preview.risk.level) ? "No approval needed — goes straight to Scheduled." : "Set the risk to see the approval path."}</div>}
              <div className="cm-hint" style={{ marginTop: 6 }}>From the {f.changeType} lifecycle and the approval policy{preview?.risk.level ? ` at ${preview.risk.level} risk` : ""}.</div>
            </div>
            <div className="cm-card">
              <div className="cm-card-title">Schedule checks</div>
              {preview && preview.leadDays > 0 && (
                <div className={`cm-note ${preview.leadTimeOk || !f.plannedStart ? "info" : "bad"}`}>{f.changeType} changes need {preview.leadDays} days' notice{f.plannedStart && !preview.leadTimeOk ? " — the planned start is too soon." : "."}</div>
              )}
              <ConflictList conflicts={preview?.conflicts} ok={f.plannedStart && f.plannedEnd ? "No blackout or configuration item conflicts." : "Conflicts are checked once a window and CIs are entered."} />
              <div style={{ marginTop: 8 }}><Link to="/changes/schedule">View change schedule</Link></div>
              {f.plannedStart && <div className="cm-hint" style={{ marginTop: 6 }}>Window: {fmtDT(fromLocalInput(f.plannedStart))} → {f.plannedEnd ? fmtDT(fromLocalInput(f.plannedEnd)) : "…"}</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
