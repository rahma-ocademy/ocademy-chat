import { describe, expect, it } from "vitest";
import { inboxHref, parseInboxFilters, sanitizeSearch } from "@/lib/inbox/filters";

const ID = "3f2b7c1e-8a4d-4c2b-9e1f-0a1b2c3d4e5f";

describe("parseInboxFilters", () => {
  it("nilai bawaan", () => {
    expect(parseInboxFilters({})).toEqual({ tab: "assigned", agent: "all", q: "", inbox: null, label: null, unread: false, c: null });
  });
  it("menerima nilai valid dan menolak yang tidak valid", () => {
    const f = parseInboxFilters({ tab: "resolved", agent: "me", inbox: ID, label: "bukan-uuid", unread: "1", c: ID });
    expect(f).toMatchObject({ tab: "resolved", agent: "me", inbox: ID, label: null, unread: true, c: ID });
    expect(parseInboxFilters({ tab: "hapus", agent: "drop table" })).toMatchObject({ tab: "assigned", agent: "all" });
  });
  it("mengambil nilai pertama dari parameter ganda", () => {
    expect(parseInboxFilters({ tab: ["unassigned", "resolved"] }).tab).toBe("unassigned");
  });
});

describe("sanitizeSearch", () => {
  it("membuang karakter sintaks filter PostgREST", () => {
    expect(sanitizeSearch("rani),status.eq.(open")).toBe("rani status eq open");
    expect(sanitizeSearch("%*'\"\\")).toBe("");
  });
  it("membatasi panjang", () => {
    expect(sanitizeSearch("a".repeat(100))).toHaveLength(60);
  });
});

describe("inboxHref", () => {
  const base = parseInboxFilters({});
  it("tidak menulis nilai bawaan", () => {
    expect(inboxHref(base)).toBe("/chat");
  });
  it("menggabungkan perubahan", () => {
    expect(inboxHref(base, { tab: "unassigned", agent: "me", c: ID })).toBe(`/chat?tab=unassigned&agent=me&c=${ID}`);
  });
  it("bolak-balik parse → href stabil", () => {
    const href = inboxHref(base, { q: "rani", unread: true, label: ID });
    const sp = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(inboxHref(parseInboxFilters(sp))).toBe(href);
  });
});
