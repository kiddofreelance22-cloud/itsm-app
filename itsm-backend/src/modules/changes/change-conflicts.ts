import { ChangeWindow } from "./change-config";

export interface ConflictInput {
  changeId?: number; changeCode?: string; changeType: string; state?: string; businessService?: string | null;
  configurationItems?: string[]; plannedStart?: Date | null; plannedEnd?: Date | null; causesOutage?: boolean;
}
export interface Conflict { kind: "Blackout" | "Change" | "Maintenance"; text: string; ref?: string }

const LIVE = ["New", "Assess", "Authorize", "Scheduled", "Implement"];
const overlaps = (aS: Date, aE: Date, bS: Date, bE: Date) => aS < bE && bS < aE;
const parseLocal = (s: string) => new Date(s.replace(" ", "T"));
const p2 = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

/** Does a window's scope cover this service? "All services" covers everything; a change with no service is only hit by "All services". */
export function scopeCovers(scope: string, service?: string | null): boolean {
  if (/^all services$/i.test(scope.trim())) return true;
  if (!service) return false;
  return scope.split(",").map((s) => s.trim().toLowerCase()).includes(service.toLowerCase());
}

/** Concrete intervals for a window between from and to (recurring maintenance windows are expanded per week). */
export function windowIntervals(w: ChangeWindow, from: Date, to: Date): { start: Date; end: Date }[] {
  if (w.kind === "Blackout") {
    if (!w.start || !w.end) return [];
    const s = parseLocal(w.start), e = parseLocal(w.end);
    return overlaps(s, e, from, to) ? [{ start: s, end: e }] : [];
  }
  if (w.day === undefined || !w.from || !w.to) return [];
  const out: { start: Date; end: Date }[] = [];
  const [fh, fm] = w.from.split(":").map(Number), [th, tm] = w.to.split(":").map(Number);
  const cursor = new Date(from); cursor.setHours(0, 0, 0, 0); cursor.setDate(cursor.getDate() - 1);   // a window starting yesterday may run into today
  for (; cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() !== w.day) continue;
    const s = new Date(cursor); s.setHours(fh, fm, 0, 0);
    const e = new Date(cursor); e.setHours(th, tm, 0, 0);
    if (e <= s) e.setDate(e.getDate() + 1);               // crosses midnight
    if (overlaps(s, e, from, to)) out.push({ start: s, end: e });
  }
  return out;
}

/** All conflicts for one change against the other changes and the blackout / maintenance windows. */
export function findConflicts(c: ConflictInput, others: ConflictInput[], windows: ChangeWindow[]): Conflict[] {
  const out: Conflict[] = [];
  if (!c.plannedStart || !c.plannedEnd) return out;
  const s = new Date(c.plannedStart), e = new Date(c.plannedEnd);

  for (const w of windows.filter((x) => x.kind === "Blackout")) {
    if (c.changeType === "Emergency" && w.allowEmergency) continue;
    if (!scopeCovers(w.scope, c.businessService)) continue;
    if (windowIntervals(w, s, e).length) out.push({ kind: "Blackout", text: `Falls inside the blackout "${w.name}" (${w.start} to ${w.end}).`, ref: w.id });
  }

  const cis = new Set((c.configurationItems ?? []).map((x) => x.toLowerCase()));
  for (const o of others) {
    if (o.changeId === c.changeId || !o.plannedStart || !o.plannedEnd || !LIVE.includes(o.state ?? "New")) continue;
    if (!overlaps(s, e, new Date(o.plannedStart), new Date(o.plannedEnd))) continue;
    const sameService = !!c.businessService && o.businessService?.toLowerCase() === c.businessService.toLowerCase();
    const sharedCi = (o.configurationItems ?? []).find((x) => cis.has(x.toLowerCase()));
    if (sameService || sharedCi) {
      out.push({ kind: "Change", ref: o.changeCode, text: `Overlaps ${o.changeCode} (${fmt(new Date(o.plannedStart))} to ${fmt(new Date(o.plannedEnd))}) on ${sharedCi ? `configuration item ${sharedCi}` : c.businessService}.` });
    }
  }

  if (c.causesOutage && c.businessService) {
    const mw = windows.filter((x) => x.kind === "Maintenance" && scopeCovers(x.scope, c.businessService));
    const inside = mw.some((w) => windowIntervals(w, s, e).some((i) => i.start <= s && i.end >= e));
    if (mw.length && !inside) out.push({ kind: "Maintenance", text: `Causes an outage outside the agreed maintenance windows for ${c.businessService}.` });
  }
  return out;
}
