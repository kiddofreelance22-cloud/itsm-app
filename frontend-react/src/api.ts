// Thin fetch wrapper. No axios/React Query available in this build
// environment (see README) — this is a small hand-rolled equivalent:
// attaches the bearer token, throws a typed ApiError on non-2xx, and
// centralizes the base URL.

declare const process: { env: Record<string, string | undefined> };

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

/** Uploaded files come back as "/uploads/<file>" served by the API, not by this app — point the browser at the API host. */
export function assetUrl(path?: string | null): string {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}
const TOKEN_STORAGE_KEY = "meridian_token";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null, remember = true): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    if (token) {
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {
    // Storage unavailable — the session just won't survive a reload.
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => ({})) : undefined;

  if (!res.ok) {
    throw new ApiError(
      typeof body?.message === "string"
        ? body.message
        : Array.isArray(body?.message)
          ? body.message.join(", ")
          : `Request failed (${res.status})`,
      res.status,
      body?.code || body?.error || "unknown_error",
      body?.details
    );
  }
  return body as T;
}

async function upload<T>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  // No Content-Type here: the browser must set the multipart boundary itself.
  const res = await fetch(`${API_BASE_URL}${path}`, { method: "POST", body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const body = res.headers.get("content-type")?.includes("application/json") ? await res.json().catch(() => ({})) : undefined;
  if (!res.ok) {
    throw new ApiError(
      typeof body?.message === "string" ? body.message : Array.isArray(body?.message) ? body.message.join(", ") : `Upload failed (${res.status})`,
      res.status, body?.error || "unknown_error", body?.details,
    );
  }
  return body as T;
}

/** Authenticated file download (the browser can't attach the bearer token to a plain <a href>). */
async function download(path: string, fileName: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(`Download failed (${res.status})`, res.status, "download_failed");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  upload,
  download,
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
