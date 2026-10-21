import { createHash, randomBytes } from "node:crypto";

// Pola Cekat (POST /rbac/agents/register/send-link → expires_in_seconds, cooldown_in_seconds).
export const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;
export const RESEND_COOLDOWN_SECONDS = 60;

/** Token acak untuk link undangan. Database hanya menyimpan hash-nya. */
export function newInviteToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const INVITE_TOKEN = /^[A-Za-z0-9_-]{32}$/;

export type InviteState = "pending" | "expired" | "accepted" | "revoked";

export function inviteState(i: { expires_at: string; accepted_at: string | null; revoked_at: string | null }, now = new Date()): InviteState {
  if (i.revoked_at) return "revoked";
  if (i.accepted_at) return "accepted";
  return new Date(i.expires_at).getTime() <= now.getTime() ? "expired" : "pending";
}

/** Detik tersisa sebelum undangan boleh dikirim ulang (0 = boleh). */
export function resendWait(lastSentAt: string, now = new Date()): number {
  const elapsed = (now.getTime() - new Date(lastSentAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}

export const sameEmail = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
