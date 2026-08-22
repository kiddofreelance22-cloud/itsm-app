const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
let BASE_URL = rawApiUrl && rawApiUrl.length > 0 ? rawApiUrl : "http://50.6.45.238:4000";

if (typeof window !== "undefined" && (BASE_URL.includes("50.6.45.238") || BASE_URL.includes("127.0.0.1")) && !window.location.hostname.includes("50.6.45.238") && !window.location.hostname.includes("127.0.0.1")) {
  BASE_URL = `${window.location.protocol}//${window.location.hostname}:4000`;
}

const TOKEN_KEY = "itsm_token";
const USER_KEY = "itsm_user";
const CACHE_TTL_MS = 15_000;
const memoryCache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

export function invalidateApiCache(path?: string): void {
  if (!path) {
    memoryCache.clear();
    return;
  }

  const keys = [...memoryCache.keys()].filter((key) => key.endsWith(`:${path}`) || key.includes(`:${path}`));
  keys.forEach((key) => memoryCache.delete(key));
}

// Token/user may live in localStorage (Remember me checked) or
// sessionStorage (Remember me unchecked, cleared when the tab closes).
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: unknown, remember: boolean): void {
  if (typeof window === "undefined") return;
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));
  // make sure a stale copy isn't left behind in the other store
  other.removeItem(TOKEN_KEY);
  other.removeItem(USER_KEY);
}

export function getStoredUser<T>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const method = (options.method ?? "GET").toUpperCase();
  const isGetRequest = method === "GET";
  const cacheKey = `${method}:${path}`;

  if (isGetRequest && typeof window !== "undefined") {
    const cached = memoryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise as Promise<T>;
    }
  }

  const request = (async () => {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        message = Array.isArray(body?.message)
          ? body.message.join(", ")
          : body?.message ?? message;
      } catch {
        // leave default message
      }
      throw new ApiError(res.status, message);
    }

    // Backend wraps every response: { success: true, data: T }
    const body = await res.json();
    const response = (body?.data ?? body) as T;

    if (method !== "GET") {
      invalidateApiCache();
    }

    return response;
  })();

  if (isGetRequest && typeof window !== "undefined") {
    memoryCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      promise: request,
    });
  }

  return request;
}
