import "server-only";
import type { createSupabaseServer } from "@/lib/supabase/server";
import type { InboxFilters, InboxTab } from "@/lib/inbox/filters";

type Client = Awaited<ReturnType<typeof createSupabaseServer>>;

/** Subset metode filter PostgREST yang dipakai di sini (menghindari tipe parser select yang sangat dalam). */
type Filterable = {
  eq(column: string, value: unknown): Filterable;
  not(column: string, op: string, value: unknown): Filterable;
  is(column: string, value: null): Filterable;
  gt(column: string, value: unknown): Filterable;
  or(filters: string, opts?: { referencedTable?: string }): Filterable;
};

export type ConversationItem = {
  id: string;
  status: "open" | "resolved";
  assignee_id: string | null;
  unread_count: number;
  last_message_at: string;
  last_message_preview: string | null;
  contact: { id: string; name: string | null; phone: string | null };
  inbox: { name: string; type: string } | null;
};

export type MessageRow = {
  id: string;
  direction: "in" | "out";
  sender_type: "contact" | "agent" | "ai" | "system";
  sender_id: string | null;
  is_private: boolean;
  body: string;
  status: string;
  created_at: string;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Satu tempat yang menerjemahkan filter inbox menjadi query (dipakai daftar dan penghitung tab). */
function applyFilters<T>(query: T, f: InboxFilters, tab: InboxTab, userId: string): T {
  let b = query as unknown as Filterable;
  b = b.eq("status", tab === "resolved" ? "resolved" : "open");
  if (tab === "assigned") b = b.not("assignee_id", "is", null);
  if (tab === "unassigned") b = b.is("assignee_id", null);
  if (tab !== "unassigned" && f.agent !== "all") b = b.eq("assignee_id", f.agent === "me" ? userId : f.agent);
  if (f.inbox) b = b.eq("inbox_id", f.inbox);
  if (f.label) b = b.eq("conversation_labels.label_id", f.label);
  if (f.unread) b = b.gt("unread_count", 0);
  // f.q sudah disanitasi oleh parseInboxFilters (tanpa karakter sintaks filter).
  if (f.q) b = b.or(`name.ilike.*${f.q}*,phone.ilike.*${f.q}*`, { referencedTable: "contacts" });
  return b as unknown as T;
}

const embeds = (f: InboxFilters): string =>
  `contacts!inner(id, name, phone), inboxes(name, type)${f.label ? ", conversation_labels!inner(label_id)" : ""}`;

export async function listConversations(supabase: Client, businessId: string, userId: string, f: InboxFilters): Promise<ConversationItem[]> {
  const cols: string = `id, status, assignee_id, unread_count, last_message_at, last_message_preview, ${embeds(f)}`;
  const q = supabase
    .from("conversations")
    .select(cols)
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false })
    .limit(50);
  const { data, error } = await applyFilters(q, f, f.tab, userId);
  if (error) throw new Error(`Gagal memuat percakapan: ${error.message}`);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    status: r.status as ConversationItem["status"],
    assignee_id: (r.assignee_id as string | null) ?? null,
    unread_count: r.unread_count as number,
    last_message_at: r.last_message_at as string,
    last_message_preview: (r.last_message_preview as string | null) ?? null,
    contact: one(r.contacts as ConversationItem["contact"] | ConversationItem["contact"][])!,
    inbox: one(r.inboxes as ConversationItem["inbox"] | ConversationItem["inbox"][]),
  }));
}

export async function countTabs(supabase: Client, businessId: string, userId: string, f: InboxFilters) {
  const count = async (tab: InboxTab) => {
    const cols: string = `id, ${embeds(f)}`;
    const q = supabase.from("conversations").select(cols, { count: "exact", head: true }).eq("business_id", businessId);
    const { count: n } = await applyFilters(q, f, tab, userId);
    return n ?? 0;
  };
  const [assigned, unassigned, resolved] = await Promise.all([count("assigned"), count("unassigned"), count("resolved")]);
  return { assigned, unassigned, resolved };
}

export async function getConversation(supabase: Client, businessId: string, id: string) {
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, status, assignee_id, unread_count, resolved_at, created_at, contacts(id, name, phone, email), inboxes(id, name, type)")
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  if (!conv) return null;

  const [msgs, labels] = await Promise.all([
    supabase
      .from("messages")
      .select("id, direction, sender_type, sender_id, is_private, body, status, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("conversation_labels").select("labels(id, name, color)").eq("conversation_id", id),
  ]);

  return {
    id: conv.id as string,
    status: conv.status as "open" | "resolved",
    assignee_id: (conv.assignee_id as string | null) ?? null,
    unread_count: conv.unread_count as number,
    contact: one(conv.contacts as unknown as { id: string; name: string | null; phone: string | null; email: string | null } | null),
    inbox: one(conv.inboxes as unknown as { id: string; name: string; type: string } | null),
    messages: ((msgs.data ?? []) as MessageRow[]).reverse(),
    labels: (labels.data ?? [])
      .map((r) => one(r.labels as unknown as { id: string; name: string; color: string } | null))
      .filter((l): l is { id: string; name: string; color: string } => Boolean(l)),
  };
}

/** Status onboarding inbox, dihitung dari data nyata (bukan flag terpisah yang bisa basi). */
export async function getSetupState(supabase: Client, businessId: string) {
  const head = { count: "exact" as const, head: true };
  const [inboxes, convs, rules] = await Promise.all([
    supabase.from("inboxes").select("id", head).eq("business_id", businessId),
    supabase.from("conversations").select("id", head).eq("business_id", businessId),
    supabase.from("followup_rules").select("id", head).eq("business_id", businessId).eq("active", true),
  ]);
  return { hasInbox: (inboxes.count ?? 0) > 0, hasConversation: (convs.count ?? 0) > 0, hasActiveRule: (rules.count ?? 0) > 0 };
}

/** Label waktu daftar: jam bila hari ini (WIB), tanggal bila lebih lama. */
export function listTimeLabel(iso: string): string {
  const tz = "Asia/Jakarta";
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: tz });
  return day(d) === day(new Date())
    ? d.toLocaleTimeString("id-ID", { timeZone: tz, hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("id-ID", { timeZone: tz, day: "numeric", month: "short" });
}

export async function getInboxContext(supabase: Client, businessId: string) {
  const [agents, labels, inboxes] = await Promise.all([
    supabase.from("memberships").select("user_id, email, role").eq("business_id", businessId),
    supabase.from("labels").select("id, name, color").eq("business_id", businessId).order("name"),
    supabase.from("inboxes").select("id, name, type, active, widget_key").eq("business_id", businessId).order("created_at"),
  ]);
  return {
    agents: (agents.data ?? []) as { user_id: string; email: string | null; role: string }[],
    labels: (labels.data ?? []) as { id: string; name: string; color: string }[],
    inboxes: (inboxes.data ?? []) as { id: string; name: string; type: string; active: boolean; widget_key: string }[],
  };
}
