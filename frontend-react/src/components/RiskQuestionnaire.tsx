import React from "react";
import { SECTIONS } from "../riskEval";
import type { RiskQuestion } from "../changeApi";

/** The questionnaire as a requester sees it. Questions that do not apply (other model/category, follow-up not triggered) are left out. */
export function RiskQuestionnaire({ questions, visible, answers, onAnswer, disabled }: {
  questions: RiskQuestion[]; visible: Record<string, boolean>; answers: Record<string, string | number>; onAnswer: (id: string, idx: number) => void; disabled?: boolean;
}) {
  const shown = questions.filter((q) => q.active && visible[q.id]);
  if (!shown.length) return <div className="cm-hint">No risk questions apply to this change.</div>;
  return (
    <>
      {SECTIONS.map((sec) => {
        const qs = shown.filter((q) => q.section === sec.id);
        if (!qs.length) return null;
        return (
          <div key={sec.id} style={{ marginBottom: 6 }}>
            <div className="cm-risk-sec"><span className="badge" style={{ background: sec.bg, color: sec.color }}>{sec.label}</span><span className="cm-hint">{sec.desc}</span></div>
            {qs.map((q) => {
              const cur = answers[q.id] === undefined || answers[q.id] === "" ? -1 : Number(answers[q.id]);
              return (
                <div key={q.id} className={`cm-risk-q${q.showIf ? " followup" : ""}`}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{q.label}{q.required && <span className="req" style={{ color: "var(--red)" }}> *</span>}</div>
                  {q.help && <div className="cm-hint" style={{ margin: "2px 0 6px" }}>{q.help}</div>}
                  {q.type === "dropdown" ? (
                    <select className="select" disabled={disabled} value={cur >= 0 ? String(cur) : ""} onChange={(e) => e.target.value !== "" && onAnswer(q.id, Number(e.target.value))}>
                      <option value="">Select…</option>{q.opts.map((o, i) => <option key={i} value={i}>{o.t}</option>)}
                    </select>
                  ) : q.type === "yesno" ? (
                    <div className="cm-seg">{q.opts.map((o, i) => <button key={i} type="button" disabled={disabled} className={cur === i ? "on" : ""} onClick={() => onAnswer(q.id, i)}>{o.t}</button>)}</div>
                  ) : q.opts.map((o, i) => (
                    <label key={i} className={`cm-opt-box${cur === i ? " on" : ""}`}>
                      <input type="radio" name={q.id} disabled={disabled} checked={cur === i} onChange={() => onAnswer(q.id, i)} /><span>{o.t}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
