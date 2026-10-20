import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { requireEnv } from "@/lib/env";

function key(): Buffer {
  const k = Buffer.from(requireEnv("APP_ENCRYPTION_KEY"), "base64");
  if (k.length !== 32) throw new Error("APP_ENCRYPTION_KEY harus 32 byte dalam base64 (openssl rand -base64 32).");
  return k;
}

/** AES-256-GCM. Format: base64(iv[12] | tag[16] | ciphertext). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

export const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");
