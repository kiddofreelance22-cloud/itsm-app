import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/** AES-256-GCM at-rest encryption for directory credentials. Key: DIRECTORY_SECRET_KEY, falling back to JWT_SECRET. */
function key(): Buffer {
  const secret = process.env.DIRECTORY_SECRET_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error("Set DIRECTORY_SECRET_KEY (or JWT_SECRET) to store directory credentials.");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(blob: string | null | undefined): string | null {
  if (!blob) return null;
  const [v, iv, tag, data] = blob.split(":");
  if (v !== "v1") return null;
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
