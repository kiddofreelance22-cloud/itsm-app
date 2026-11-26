import { ChangeSettings, approvalPath, categoryGroup, categoryPath, categoryTab, defaults, gatesOf, normalizeSettings, scoreRisk, stepType } from "./change-config";
import type { Lifecycle, RiskQuestion } from "./change-config";

const question = (id: string, section: RiskQuestion["section"], opts: [string, number, RiskQuestion["opts"][number]["min"]?][], extra: Partial<RiskQuestion> = {}): RiskQuestion => ({
  id, section, label: id, help: "", type: "single", required: true, active: true, models: [], cats: [], showIf: null,
  opts: opts.map(([t, w, min]) => ({ t, w, min: min ?? "" })), ...extra,
});
const fresh = (): ChangeSettings => {
  const s = defaults();
  s.models = [
    { id: "std", name: "Standard", desc: "", leadDays: 0, color: "green", active: true, base: "Standard", lifecycle: "std", pir: "Never", linkIncident: false },
    { id: "normal", name: "Normal", desc: "", leadDays: 0, color: "blue", active: true, base: "Normal", lifecycle: "normal", pir: "Never", linkIncident: false },
    { id: "emergency", name: "Emergency", desc: "", leadDays: 0, color: "red", active: true, base: "Emergency", lifecycle: "emergency", pir: "Never", linkIncident: true },
  ];
  s.categories = [
    { id: "network", name: "Network", parentId: null, desc: "", group: "", tab: "Network TAB", active: true },
    { id: "firewall", name: "Firewall", parentId: "network", desc: "", group: "", tab: "", active: true },
    { id: "software", name: "Software", parentId: null, desc: "", group: "", tab: "", active: true },
    { id: "application", name: "Application", parentId: null, desc: "", group: "Application Support", tab: "SAP Basis TAB", active: true },
    { id: "sap", name: "SAP", parentId: "application", desc: "", group: "", tab: "", active: true },
    { id: "hana", name: "HANA", parentId: "sap", desc: "", group: "", tab: "", active: true },
    { id: "facilities", name: "Facilities", parentId: null, desc: "", group: "", tab: "", active: true },
  ];
  const lifecycle = (id: string, name: string, steps: Lifecycle["steps"]): Lifecycle => ({ id, name, desc: "", steps });
  s.lifecycles = [
    lifecycle("std", "Standard lifecycle", []),
    lifecycle("normal", "Normal lifecycle", [
      { id: "gate", kind: "Assess", type: "gate", name: "Risk", gate: "risk" },
      { id: "policy", kind: "Authorize", type: "policy", name: "Authorise" },
      { id: "implement", kind: "Implement", type: "implement", name: "Implement" },
      { id: "review", kind: "Review", type: "review", name: "Review" },
      { id: "close", kind: "Close", type: "close", name: "Close" },
    ]),
    lifecycle("emergency", "Emergency lifecycle", []),
  ];
  s.risk.questions = [
    question("rq1", "impact", [["No impact", 0], ["Low impact", 2], ["Moderate impact", 4], ["Critical impact", 6, "High"]]),
    question("rq2", "likelihood", [["Often", 0], ["Sometimes", 1], ["Rarely", 2], ["Never", 4]]),
    question("rq3", "readiness", [["Tested", 0], ["Untested", 2], ["Partial", 3], ["No plan", 5, "High"]]),
    question("rq4", "impact", [["No outage", 0], ["Maintenance", 1], ["Partial", 3], ["Full", 5]]),
    question("rq5", "likelihood", [["One", 0], ["Few", 1], ["Some", 2], ["Many", 3]]),
    question("rq6", "likelihood", [["One team", 0], ["Two teams", 1], ["More teams", 2]]),
    question("rq7", "readiness", [["Yes", 0], ["No", 2]], { type: "yesno", showIf: { q: "rq6", opt: 2 } }),
    question("rq8", "impact", [["No", 0], ["Internal", 2], ["Customer", 4, "High"]], { cats: ["Network"] }),
    question("rq9", "readiness", [["Yes", 0], ["No", 3]], { type: "yesno", models: ["Emergency"] }),
  ];
  s.risk.bands = [{ level: "Low", min: 0, max: 4 }, { level: "Moderate", min: 5, max: 9 }, { level: "High", min: 10, max: 14 }, { level: "Very High", min: 15, max: 99 }];
  s.approval.groups = [
    { id: "cm", name: "Change Management", desc: "", type: "Approval group", email: "", members: [], lead: null, defaultRule: "Any one member", meets: "", meetDay: null, meetTime: "", quorum: 0, active: true },
    { id: "cab", name: "CAB", desc: "", type: "Board", email: "", members: [], lead: null, defaultRule: "Majority of members", meets: "", meetDay: null, meetTime: "", quorum: 0, active: true },
  ];
  s.approval.rules = [
    { id: "low", type: "Normal", risk: "Low", stages: [{ grp: "Change Management", rule: "Any one member" }], active: true },
    { id: "moderate", type: "Normal", risk: "Moderate", stages: [{ grp: "Category TAB", rule: "Any one member" }, { grp: "Change Management", rule: "Any one member" }], active: true },
    { id: "high", type: "Normal", risk: "High", stages: [{ grp: "Change Management", rule: "Any one member" }, { grp: "CAB", rule: "Majority of members" }], active: true },
  ];
  return normalizeSettings(s);
};

describe("risk scoring", () => {
  const base = { rq1: 0, rq2: 0, rq3: 0, rq4: 0, rq5: 0, rq6: 0 };
  it("lets one answer force a minimum level whatever the score", () => {
    const r = scoreRisk(fresh(), { ...base, rq1: 3 }, "Normal", "Software");
    expect(r.base).toBe("Moderate"); expect(r.level).toBe("High"); expect(r.floors).toHaveLength(1);
  });
  it("shows a follow-up only when its trigger answer was chosen", () => {
    expect(scoreRisk(fresh(), { ...base, rq6: 2 }, "Normal", "Software").visible.rq7).toBe(true);
    expect(scoreRisk(fresh(), { ...base, rq6: 0 }, "Normal", "Software").visible.rq7).toBe(false);
  });
  it("asks category- and model-targeted questions only where they apply, including sub-categories", () => {
    expect(scoreRisk(fresh(), {}, "Normal", "Firewall").visible.rq8).toBe(true);   // Firewall sits under Network
    expect(scoreRisk(fresh(), {}, "Normal", "Software").visible.rq8).toBe(false);
    expect(scoreRisk(fresh(), {}, "Emergency", "Software").visible.rq9).toBe(true);
    expect(scoreRisk(fresh(), {}, "Normal", "Software").visible.rq9).toBe(false);
  });
  it("is complete only when every visible required question is answered", () => {
    const all = { rq1: 0, rq2: 0, rq3: 0, rq4: 0, rq5: 0, rq6: 0 };
    expect(scoreRisk(fresh(), all, "Normal", "Software").complete).toBe(true);
    expect(scoreRisk(fresh(), { rq1: 0 }, "Normal", "Software").complete).toBe(false);
    expect(scoreRisk(fresh(), { ...all, rq6: 2 }, "Normal", "Software").complete).toBe(false);   // follow-up now needs an answer
  });
  it("ignores out-of-range answers", () => { expect(scoreRisk(fresh(), { rq1: 99 }, "Normal", "Software").answered).toBe(0); });
  it("supports the Impact x Likelihood matrix", () => {
    const s = fresh(); s.risk.method = "matrix";
    const r = scoreRisk(s, { rq1: 3, rq2: 3, rq3: 3, rq4: 3, rq5: 3, rq6: 2 }, "Normal", "Software");
    expect(["High", "Very High"]).toContain(r.level);
  });
});

describe("category tree", () => {
  it("inherits group and board from the nearest parent", () => {
    const s = fresh();
    expect(categoryGroup(s, "HANA")).toBe("Application Support");
    expect(categoryTab(s, "HANA")).toBe("SAP Basis TAB");
    expect(categoryPath(s, "HANA")).toBe("Application › SAP › HANA");
  });
});

describe("approval path", () => {
  it("expands the approval policy, using the category board and skipping it when none is set", () => {
    const s = fresh();
    expect(approvalPath(s, "Normal", "Moderate", "Firewall").map((p) => p.group)).toEqual(["Network TAB", "Change Management"]);
    expect(approvalPath(s, "Normal", "Moderate", "Facilities").map((p) => p.group)).toEqual(["Change Management"]);
    expect(approvalPath(s, "Standard", "Low")).toHaveLength(0);
  });
  it("applies condition steps and parallel stages", () => {
    const s = fresh();
    s.lifecycles.push({ id: "x", name: "x", desc: "", steps: [
      { id: "1", type: "group", kind: "Authorize", name: "cm", group: "Change Management", rule: "Any one member" },
      { id: "2", type: "condition", kind: "Authorize", name: "high?", match: "all", rules: [{ k: "risk", op: "atLeast", value: "High" }], yes: "next", no: "skip" },
      { id: "3", type: "parallel", kind: "Authorize", name: "par", approvers: ["group:CAB", "role:changeManager"], prule: "all" },
      { id: "4", type: "implement", kind: "Implement", name: "i" }, { id: "5", type: "close", kind: "Close", name: "c" }] });
    s.models.find((m) => m.name === "Normal")!.lifecycle = "x";
    expect(approvalPath(s, "Normal", "Low").map((p) => p.group)).toEqual(["Change Management"]);
    const high = approvalPath(s, "Normal", "High");
    expect(high.map((p) => p.group)).toEqual(["Change Management", "CAB", "Change Management"]);
    expect(high.map((p) => p.stage)).toEqual([1, 2, 2]);   // the parallel approvers share a stage
  });
  it("creates a CAB approval stage at its configured position", () => {
    const s = fresh();
    s.lifecycles.find((l) => l.id === "normal")!.steps = [
      { id: "group", type: "group", kind: "Authorize", name: "Manager", group: "Change Management", rule: "Any one member" },
      { id: "wait", type: "wait", kind: "Authorize", name: "Wait", waitMinutes: 5 },
      { id: "cab", type: "cabAgenda", kind: "Authorize", name: "CAB agenda" },
      { id: "implement", type: "implement", kind: "Implement", name: "Implement" },
      { id: "close", type: "close", kind: "Close", name: "Close" },
    ];
    const path = approvalPath(s, "Normal", "Low");
    expect(path.map((stage) => stage.group)).toEqual(["Change Management", "CAB"]);
    expect(path.map((stage) => stage.stage)).toEqual([1, 2]);
    expect(approvalPath(s, "Normal", "Low", undefined, {}, "cab").map((stage) => stage.group)).toEqual(["CAB"]);
  });
});

describe("older saved settings", () => {
  it("starts with empty change-management data", () => {
    const s = defaults();
    expect(s.models).toHaveLength(0);
    expect(s.categories).toHaveLength(0);
    expect(s.closeCodes).toHaveLength(0);
    expect(s.risk.questions).toHaveLength(0);
    expect(s.templates).toHaveLength(0);
    expect(s.approval.groups).toHaveLength(0);
    expect(s.windows).toHaveLength(0);
    expect(s.lifecycles).toHaveLength(0);
    expect(s.notifications).toHaveLength(0);
    expect(s.stateTransitions).toHaveLength(0);
  });
  it("are upgraded on read", () => {
    const old: any = defaults();
    old.risk = { questions: [{ id: "q", label: "L", active: true, opts: [{ t: "a", w: 0 }, { t: "b", w: 5 }] }], bands: [] };
    old.categories = [{ id: "1", name: "N", group: "", tab: "", active: true }];
    old.lifecycles = [{ id: "l", name: "n", desc: "", steps: [{ id: "1", kind: "Authorize", name: "A", mode: "policy" }, { id: "2", kind: "Implement", name: "I" }, { id: "3", kind: "Close", name: "C" }] }];
    old.notifications = [{ id: "n", grp: "", name: "", when: "", on: false, recipients: [], subject: "", body: "", format: undefined }];
    const n = normalizeSettings(old);
    expect(n.risk.questions[0].section).toBe("impact"); expect(n.risk.method).toBe("sum"); expect(n.categories[0].parentId).toBeNull();
    expect(stepType(n.lifecycles[0].steps[0])).toBe("policy"); expect(n.notifications[0].format).toBe("text");
    expect(n.stateTransitions).toEqual([]);
    expect(gatesOf(fresh(), "Normal")).toEqual(["risk"]);
  });
});
