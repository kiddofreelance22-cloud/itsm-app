import { getApiBaseUrl, getToken, ApiError } from "./client";

export interface UploadResult {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
}

/**
 * Uploads a single file to POST /uploads. Deliberately doesn't go through
 * apiFetch — that helper always sets Content-Type: application/json, which
 * breaks multipart/form-data (the browser needs to set its own boundary).
 * Used by the Item Details icon/banner picker, the Attachments tab, and the
 * "Attachment" catalog-variable type on the requester-facing form.
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${getApiBaseUrl()}/uploads`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message ?? message;
    } catch {
      // leave default message
    }
    throw new ApiError(res.status, message);
  }

  const body = await res.json();
  return (body?.data ?? body) as UploadResult;
}
