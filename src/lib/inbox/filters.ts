export type InboxTab = "assigned" | "unassigned" | "resolved";

export type InboxFilters = {
  tab: InboxTab;
  /** "all" | "me" | uuid agen */
  agent: string;
  q: string;
  inbox: string | null;
  label: string | null;
  unread: boolean;
  /** percakapan yang sedang dibuka */
  c: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABS: InboxTab[] = ["assigned", "unassigned", "resolved"];
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Kata kunci pencarian dipakai di filter PostgREST (`ilike`), jadi karakter yang punya arti di sintaks
 * filter (koma, kurung, titik, titik dua, wildcard, kutip, backslash) dibuang di sini, satu-satunya tempat.
 */
export function sanitizeSearch(q: string | undefined): string {
  return (q ?? "").replace(/[,().:*%"'\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export function parseInboxFilters(sp: Params): InboxFilters {
  const tab = one(sp.tab);
  const agent = one(sp.agent);
  return {
    tab: TABS.includes(tab as InboxTab) ? (tab as InboxTab) : "assigned",
    agent: agent === "me" || isUuid(agent) ? agent : "all",
    q: sanitizeSearch(one(sp.q)),
    inbox: isUuid(one(sp.inbox)) ? one(sp.inbox)! : null,
    label: isUuid(one(sp.label)) ? one(sp.label)! : null,
    unread: one(sp.unread) === "1",
    c: isUuid(one(sp.c)) ? one(sp.c)! : null,
  };
}

/** URL /chat dengan filter saat ini + perubahan. Nilai bawaan tidak ditulis agar URL tetap pendek. */
export function inboxHref(f: InboxFilters, patch: Partial<InboxFilters> = {}): string {
  const n = { ...f, ...patch };
  const p = new URLSearchParams();
  if (n.tab !== "assigned") p.set("tab", n.tab);
  if (n.agent !== "all") p.set("agent", n.agent);
  if (n.q) p.set("q", n.q);
  if (n.inbox) p.set("inbox", n.inbox);
  if (n.label) p.set("label", n.label);
  if (n.unread) p.set("unread", "1");
  if (n.c) p.set("c", n.c);
  const s = p.toString();
  return s ? `/chat?${s}` : "/chat";
}
