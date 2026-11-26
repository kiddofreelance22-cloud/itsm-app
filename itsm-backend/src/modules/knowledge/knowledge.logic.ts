/** Pure rules for the SKMS, kept free of the database so they can be unit-tested. */

export type HealthStatus = "Healthy" | "Review Due" | "Stale / Archive";

export const FRESH_DAYS = 90;
export const STALE_DAYS = 180;
const DAY_MS = 86_400_000;

export const daysSince = (d: Date | string, now = new Date()): number =>
  Math.floor((now.getTime() - new Date(d).getTime()) / DAY_MS);

/** < 90 days since last review is healthy, 90-180 is due for review, beyond that the article is stale. */
export function healthOf(lastReviewedAt: Date | string, now = new Date()): HealthStatus {
  const age = daysSince(lastReviewedAt, now);
  if (age < FRESH_DAYS) return "Healthy";
  if (age <= STALE_DAYS) return "Review Due";
  return "Stale / Archive";
}

export const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : null;

const PRIORITY_MATRIX: Record<string, Record<string, string>> = {
  Low: { Low: "P4 - Low", Medium: "P3 - Medium", High: "P3 - Medium" },
  Medium: { Low: "P3 - Medium", Medium: "P3 - Medium", High: "P2 - High" },
  High: { Low: "P3 - Medium", Medium: "P2 - High", High: "P1 - Critical" },
  Critical: { Low: "P2 - High", Medium: "P1 - Critical", High: "P1 - Critical" },
};

export function priorityFor(impact: string, urgency: string): string {
  return PRIORITY_MATRIX[impact]?.[urgency] ?? "P3 - Medium";
}

/**
 * KCS points = 10 per published article + 2 per time one of the author's articles was reused
 * + 1 per helpful vote (the quality part of "Capture + Reuse + Quality").
 */
export const kcsPoints = (created: number, reused: number, helpful: number): number => created * 10 + reused * 2 + helpful;

/** KCS structure standard: a title, at least 3 tags, a service line and a real resolution (not a stub). */
export function meetsStructureStandard(a: { title: string; tags: string[]; serviceLine: string | null; resolution: string }): boolean {
  return a.title.trim().length >= 10 && a.tags.length >= 3 && !!a.serviceLine && a.resolution.trim().length >= 20;
}

const STOP = new Set(
  "the a an and or of to in on for is are was be how do i my me can what where when with from it this that at as by not during after before error issue fails failed failing".split(" "),
);

/** Lower-cased keywords (>= 3 chars) from free text, used to match a ticket to articles. */
export function keywords(text: string): string[] {
  const out = new Set<string>();
  for (const w of (text || "").toLowerCase().split(/[^a-z0-9/]+/)) {
    if (w.length >= 3 && !STOP.has(w)) out.add(w);
  }
  return [...out];
}

/** Relevance of an article to a ticket: a title/tag keyword hit counts more than a hit in the resolution. */
export function matchScore(ticketWords: string[], a: { title: string; tags: string[]; resolution: string }): number {
  const title = a.title.toLowerCase();
  const tags = a.tags.map((t) => t.toLowerCase());
  const body = a.resolution.toLowerCase();
  let s = 0;
  for (const w of ticketWords) {
    if (tags.includes(w)) s += 3;
    if (title.includes(w)) s += 2;
    else if (body.includes(w)) s += 1;
  }
  return s;
}

/** "vpn, Gateway ,#GlobalProtect" -> ["vpn","gateway","globalprotect"]. */
export function parseTags(input: string | string[] | undefined): string[] {
  const list = Array.isArray(input) ? input : (input ?? "").split(",");
  return [...new Set(list.map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))].slice(0, 20);
}

/**
 * Portal visibility. The end-user Knowledge Base only shows articles written for everyone: anything aimed at a
 * narrower group (VIPs, Tier 2/3 specialists, Problem Managers...) stays inside the staff workspace.
 * These lists are the single source of truth: the SQL filter and isPortalAudience() both use them.
 */
export const PORTAL_TARGET_GROUPS = ["", "All Employees (Global)"];
export const PORTAL_ANALYST_ROLES = ["", "All Service Desk Analysts"];

export function isPortalAudience(audience?: { targetUserGroup?: string; analystRole?: string } | null): boolean {
  return (
    PORTAL_TARGET_GROUPS.includes(audience?.targetUserGroup ?? "") &&
    PORTAL_ANALYST_ROLES.includes(audience?.analystRole ?? "")
  );
}

/** Whitespace-collapsed excerpt for list rows. */
export function snippetOf(text: string, max = 200): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

/** Escapes LIKE wildcards so user input is matched literally. */
export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);
