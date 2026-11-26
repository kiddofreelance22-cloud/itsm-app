import type { Category, ChangeConfig, RiskLevel, RiskSection } from "./changeApi";

const LEVELS: RiskLevel[] = ["Low", "Moderate", "High", "Very High"];
export interface RiskEval {
  score: number; max: number; level: RiskLevel | ""; base: RiskLevel | ""; answered: number; total: number; complete: boolean; missing: string[];
  floors: string[]; sections: Record<RiskSection, number>; visible: Record<string, boolean>;
}
const chain = (cats: Category[], name?: string | null): string[] => {
  const out: string[] = []; let cur = cats.find((c) => c.name === name);
  while (cur && out.length < 6) { out.push(cur.name); const pid: string | null = cur.parentId; cur = pid ? cats.find((c) => c.id === pid) : undefined; }
  return out;
};

/**
 * Same rules the server applies (the server's answer is the one that counts): inactive questions, questions for other models or categories and
 * follow-ups whose trigger answer was not chosen are ignored; an answer with a minimum level raises the result to at least that level.
 */
export function evaluateRisk(cfg: Pick<ChangeConfig, "risk" | "categories">, answers: Record<string, string | number>, model?: string, category?: string | null): RiskEval {
  const risk = cfg.risk, qs = risk.questions.filter((q) => q.active), cats = chain(cfg.categories, category);
  const visible: Record<string, boolean> = {};
  const idx = (q: (typeof qs)[number]) => { const raw = answers[q.id]; const i = raw === undefined || raw === null || raw === "" ? -1 : Number(raw); return Number.isInteger(i) && i >= 0 && i < q.opts.length ? i : -1; };
  for (const q of qs) {
    let v = (!q.models.length || !model || q.models.includes(model)) && (!q.cats.length || q.cats.some((c) => cats.includes(c)));
    if (v && q.showIf) { const dep = qs.find((x) => x.id === q.showIf!.q); v = !!dep && visible[dep.id] === true && idx(dep) === Number(q.showIf.opt); }
    visible[q.id] = v;
  }
  const sections: Record<RiskSection, number> = { impact: 0, likelihood: 0, readiness: 0 };
  let score = 0, max = 0, answered = 0, total = 0, need = 0, got = 0, floor = -1; const floors: string[] = [], missing: string[] = [];
  for (const q of qs) {
    if (!visible[q.id]) continue;
    total++; max += Math.max(0, ...q.opts.map((o) => o.w)); if (q.required) need++;
    const i = idx(q);
    if (i < 0) { if (q.required) missing.push(q.label); continue; }
    const o = q.opts[i]; score += o.w; sections[q.section] += o.w; answered++; if (q.required) got++;
    if (o.min && LEVELS.indexOf(o.min) > floor) floor = LEVELS.indexOf(o.min);
    if (o.min) floors.push(`“${o.t}” raises the risk to at least ${o.min}.`);
  }
  let base: RiskLevel | "" = "";
  if (answered) {
    if (risk.method === "matrix") {
      const lv = (from: number[], v: number) => { let k = 0; from.forEach((f, j) => { if (v >= f) k = j; }); return k; };
      base = risk.matrix[lv(risk.impFrom, sections.impact)]?.[lv(risk.likFrom, sections.likelihood + sections.readiness)] ?? "Low";
    } else {
      const bands = [...risk.bands].sort((a, b) => a.min - b.min);
      base = (bands.find((b) => score >= b.min && score <= b.max) ?? bands[bands.length - 1])?.level ?? "Low";
    }
  }
  const level = base ? LEVELS[Math.max(LEVELS.indexOf(base), floor)] : "";
  return { score, max, level, base, answered, total, complete: got === need, missing, floors, sections, visible };
}

export const SECTIONS: { id: RiskSection; label: string; desc: string; bg: string; color: string }[] = [
  { id: "impact", label: "Impact", desc: "How bad it would be if the change failed.", bg: "#F4F3FF", color: "#5925DC" },
  { id: "likelihood", label: "Likelihood", desc: "How likely the change is to fail.", bg: "#ECFDFF", color: "#0E6A82" },
  { id: "readiness", label: "Readiness", desc: "How well prepared the team is.", bg: "#EFF8FF", color: "#175CD3" },
];
export const sectionOf = (id: string) => SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
