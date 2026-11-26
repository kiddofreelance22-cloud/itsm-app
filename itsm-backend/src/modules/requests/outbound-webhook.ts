import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Addresses a lifecycle webhook may not call: this machine, private networks and cloud metadata. */
export function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Throws unless the URL is https and every address it resolves to is public. Set ALLOW_PRIVATE_WEBHOOKS=true to lift this (testing only). */
export async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("The webhook address is not a valid URL"); }
  const lifted = process.env.ALLOW_PRIVATE_WEBHOOKS === "true";
  if (url.protocol !== "https:" && !(lifted && url.protocol === "http:")) throw new Error("The webhook address must start with https://");
  if (lifted) return url;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const lookupWithTimeout = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        lookup(host, { all: true }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("DNS lookup timed out after 3000ms")), 3000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const addrs = isIP(host) ? [host] : (await lookupWithTimeout()).map((a) => a.address);
  if (!addrs.length || addrs.some(isPrivateAddress)) throw new Error("The webhook address points at a private or internal network, which is not allowed");
  return url;
}

/** POSTs JSON. Never follows redirects, gives up after 8 seconds. Returns the HTTP status. */
export async function postJson(raw: string, body: unknown, secret?: string): Promise<number> {
  const url = await assertPublicHttpsUrl(raw);
  const res = await fetch(url, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json", ...(secret ? { "X-Webhook-Secret": secret } : {}) },
    body: JSON.stringify(body),
  });
  return res.status;
}
