/**
 * Business-hours arithmetic for SLA Service Windows.
 * A window is a list of { day: 1..7 (Mon..Sun), enabled, from: "HH:mm", to: "HH:mm" } evaluated in the window's time zone.
 */
export interface ServiceWindowDay { day: number; enabled: boolean; from: string; to: string }

/** Labels used by the Service Window screen (and plain IANA names) → IANA zone. */
export function ianaZone(label: string | null | undefined): string {
  const l = (label ?? "UTC").trim();
  const map: Record<string, string> = {
    "UTC": "UTC", "IST": "Asia/Kolkata", "IST (INDIA)": "Asia/Kolkata", "EST": "America/New_York", "EST (US EAST)": "America/New_York",
    "PST": "America/Los_Angeles", "PST (US WEST)": "America/Los_Angeles", "GMT": "Europe/London", "GMT (UK)": "Europe/London",
    "CET": "Europe/Paris", "CET (EUROPE)": "Europe/Paris",
  };
  return map[l.toUpperCase()] ?? l;
}

const hm = (s: string): number => { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

/** Offset (ms) of `zone` from UTC at the given instant. */
function zoneOffsetMs(at: Date, zone: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at).reduce<Record<string, number>>((a, x) => { if (x.type !== "literal") a[x.type] = Number(x.value); return a; }, {});
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Local wall-clock parts of an instant in a zone. */
function localParts(at: Date, zone: string) {
  const off = zoneOffsetMs(at, zone);
  const l = new Date(at.getTime() + off);
  const jsDay = l.getUTCDay();                    // 0=Sun
  return { y: l.getUTCFullYear(), mo: l.getUTCMonth(), d: l.getUTCDate(), minutes: l.getUTCHours() * 60 + l.getUTCMinutes(), day: jsDay === 0 ? 7 : jsDay };
}

/** The instant at which zone-local time is y-mo-d + minutes. */
function fromLocal(y: number, mo: number, d: number, minutes: number, zone: string): Date {
  const guess = Date.UTC(y, mo, d, 0, 0, 0) + minutes * 60000;
  let off = zoneOffsetMs(new Date(guess), zone);
  let t = guess - off;
  off = zoneOffsetMs(new Date(t), zone);          // re-check across a DST edge
  t = guess - off;
  return new Date(t);
}

/** `start` + `minutes` of *business* time. Falls back to plain wall-clock if the window has no working time. */
export function addBusinessMinutes(start: Date, minutes: number, days: ServiceWindowDay[], zoneLabel?: string | null): Date {
  const zone = ianaZone(zoneLabel);
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }); } catch { return new Date(start.getTime() + minutes * 60000); }
  const byDay = new Map<number, { from: number; to: number }>();
  for (const d of days ?? []) if (d.enabled && hm(d.to) > hm(d.from)) byDay.set(d.day, { from: hm(d.from), to: hm(d.to) });
  if (byDay.size === 0) return new Date(start.getTime() + minutes * 60000);

  let remaining = minutes;
  let cursor = start;
  for (let guard = 0; guard < 800 && remaining > 0; guard++) {
    const lp = localParts(cursor, zone);
    const w = byDay.get(lp.day);
    if (w && lp.minutes < w.to) {
      const from = Math.max(lp.minutes, w.from);
      const avail = w.to - from;
      if (remaining <= avail) return fromLocal(lp.y, lp.mo, lp.d, from + remaining, zone);
      remaining -= avail;
    }
    // jump to the start of the next local day
    cursor = fromLocal(lp.y, lp.mo, lp.d + 1, 0, zone);
  }
  return new Date(start.getTime() + minutes * 60000);
}
