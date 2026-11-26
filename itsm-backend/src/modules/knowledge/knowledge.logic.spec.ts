import {
  escapeLike, healthOf, isPortalAudience, kcsPoints, keywords, matchScore, meetsStructureStandard, parseTags, pct, priorityFor, snippetOf,
} from "./knowledge.logic";

const NOW = new Date("2026-11-17T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("knowledge.logic", () => {
  describe("healthOf", () => {
    it("is Healthy under 90 days", () => {
      expect(healthOf(daysAgo(0), NOW)).toBe("Healthy");
      expect(healthOf(daysAgo(89), NOW)).toBe("Healthy");
    });
    it("is Review Due from 90 through 180 days", () => {
      expect(healthOf(daysAgo(90), NOW)).toBe("Review Due");
      expect(healthOf(daysAgo(180), NOW)).toBe("Review Due");
    });
    it("is Stale beyond 180 days", () => {
      expect(healthOf(daysAgo(181), NOW)).toBe("Stale / Archive");
    });
  });

  describe("pct", () => {
    it("rounds to one decimal", () => expect(pct(2, 3)).toBe(66.7));
    it("is null (not 0 or NaN) when there is nothing to divide by", () => expect(pct(0, 0)).toBeNull());
  });

  it("kcsPoints = 10 per article + 2 per reuse + 1 per helpful vote", () => {
    expect(kcsPoints(3, 10, 5)).toBe(30 + 20 + 5);
    expect(kcsPoints(0, 0, 0)).toBe(0);
  });

  it("calculates article priority from impact and urgency", () => {
    expect(priorityFor("Low", "Low")).toBe("P4 - Low");
    expect(priorityFor("Medium", "High")).toBe("P2 - High");
    expect(priorityFor("Critical", "High")).toBe("P1 - Critical");
  });

  describe("meetsStructureStandard", () => {
    const good = { title: "Resolving VPN timeouts", tags: ["vpn", "gateway", "timeout"], serviceLine: "Network Services", resolution: "Apply the keepalive tweak and reconnect." };
    it("accepts a complete article", () => expect(meetsStructureStandard(good)).toBe(true));
    it.each([
      ["short title", { title: "VPN" }],
      ["fewer than 3 tags", { tags: ["vpn", "gateway"] }],
      ["no service line", { serviceLine: null }],
      ["stub resolution", { resolution: "see ticket" }],
    ])("rejects %s", (_n, patch) => expect(meetsStructureStandard({ ...good, ...patch })).toBe(false));
  });

  describe("keywords / matchScore", () => {
    it("drops stop words and short words", () => {
      expect(keywords("How do I fix the VPN error on my laptop")).toEqual(["fix", "vpn", "laptop"]);
    });
    it("weights tag hits above title hits above body hits", () => {
      const w = ["vpn"];
      const tag = matchScore(w, { title: "x", tags: ["vpn"], resolution: "" });
      const title = matchScore(w, { title: "vpn guide", tags: [], resolution: "" });
      const body = matchScore(w, { title: "x", tags: [], resolution: "use the vpn" });
      expect(tag).toBeGreaterThan(title);
      expect(title).toBeGreaterThan(body);
      expect(body).toBeGreaterThan(0);
    });
  });

  it("parseTags normalises, de-duplicates and caps", () => {
    expect(parseTags("VPN, Gateway ,#GlobalProtect, vpn")).toEqual(["vpn", "gateway", "globalprotect"]);
    expect(parseTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(20);
    expect(parseTags(undefined)).toEqual([]);
  });

  describe("isPortalAudience (what end users may see)", () => {
    it("allows articles with no targeting, or targeted at everyone", () => {
      expect(isPortalAudience(undefined)).toBe(true);
      expect(isPortalAudience({})).toBe(true);
      expect(isPortalAudience({ targetUserGroup: "All Employees (Global)", analystRole: "All Service Desk Analysts" })).toBe(true);
    });
    it("hides articles aimed at a narrower user group", () => {
      expect(isPortalAudience({ targetUserGroup: "VIP Executives Only" })).toBe(false);
      expect(isPortalAudience({ targetUserGroup: "Contractors / Vendors" })).toBe(false);
    });
    it("hides articles restricted to specialist analysts", () => {
      expect(isPortalAudience({ analystRole: "Tier 2 & Tier 3 Specialists Only" })).toBe(false);
      expect(isPortalAudience({ analystRole: "Problem Managers Only" })).toBe(false);
    });
  });

  it("snippetOf collapses whitespace and truncates with an ellipsis", () => {
    expect(snippetOf("a\n\n  b   c", 50)).toBe("a b c");
    expect(snippetOf("x".repeat(300), 10)).toBe("xxxxxxxxxx…");
  });

  it("escapeLike makes wildcards literal", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
