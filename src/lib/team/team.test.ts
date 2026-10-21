import { describe, expect, it } from "vitest";
import { atLeast, levelOf, parsePermissions } from "./permissions";
import { INVITE_TOKEN, hashInviteToken, inviteState, newInviteToken, resendWait, sameEmail } from "./invites";

describe("permissions", () => {
  it("parse nilai asing/hilang menjadi none", () => {
    expect(parsePermissions({ user_management: "manage", billing: "root" })).toEqual({ user_management: "manage", billing: "none", security: "none" });
    expect(parsePermissions(null)).toEqual({ user_management: "none", billing: "none", security: "none" });
  });

  it("owner selalu manage", () => {
    const p = parsePermissions({});
    expect(levelOf("owner", p, "security")).toBe("manage");
    expect(levelOf("admin", p, "security")).toBe("none");
  });

  it("urutan level", () => {
    expect(atLeast("manage", "view")).toBe(true);
    expect(atLeast("view", "manage")).toBe(false);
    expect(atLeast("none", "none")).toBe(true);
  });
});

describe("invites", () => {
  it("token sesuai format dan hash deterministik", () => {
    const { token, hash } = newInviteToken();
    expect(token).toMatch(INVITE_TOKEN);
    expect(hashInviteToken(token)).toBe(hash);
  });

  it("status undangan", () => {
    const now = new Date("2026-10-21T00:00:00Z");
    const base = { expires_at: "2026-10-22T00:00:00Z", accepted_at: null, revoked_at: null };
    expect(inviteState(base, now)).toBe("pending");
    expect(inviteState({ ...base, expires_at: "2026-10-21T00:00:00Z" }, now)).toBe("expired");
    expect(inviteState({ ...base, accepted_at: "2026-10-20T00:00:00Z" }, now)).toBe("accepted");
    expect(inviteState({ ...base, revoked_at: "2026-10-20T00:00:00Z", accepted_at: "x" }, now)).toBe("revoked");
  });

  it("cooldown kirim ulang", () => {
    const now = new Date("2026-10-21T00:01:00Z");
    expect(resendWait("2026-10-21T00:00:30Z", now)).toBe(30);
    expect(resendWait("2026-10-21T00:00:00Z", now)).toBe(0);
  });

  it("email dibandingkan tanpa beda huruf besar/kecil", () => {
    expect(sameEmail(" Rani@Toko.id", "rani@toko.id")).toBe(true);
    expect(sameEmail(null, "rani@toko.id")).toBe(false);
  });
});
