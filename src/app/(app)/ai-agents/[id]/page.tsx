import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin, requireContext } from "@/lib/auth";
import { EmptyState, Notice } from "@/components/page";
import { parseConfig, parseInstructions, parseRouting, STYLE_PRESETS, type StylePreset } from "@/lib/ai/config";
import { BehaviorForm, ConfigForm, DeleteAgentButton, DeleteKnowledgeButton, KnowledgeForm, RoutingForm } from "../forms";

export const metadata: Metadata = { title: "Pengaturan AI agent" };

const TABS = [
  { id: "behavior", label: "Perilaku AI" },
  { id: "knowledge", label: "Pengetahuan" },
  { id: "routing", label: "Aksi & routing" },
  { id: "config", label: "Konfigurasi" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function AiAgentPage(props: PageProps<"/ai-agents/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "behavior";
  const ctx = await requireContext();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const { data: agent } = await ctx.supabase.from("ai_agents").select("*").eq("id", id).eq("business_id", ctx.businessId).maybeSingle();
  if (!agent) notFound();
  const [{ data: knowledge }, { data: inboxes }] = await Promise.all([
    tab === "knowledge"
      ? ctx.supabase.from("ai_knowledge").select("id, kind, title, content, question, answer, created_at").eq("agent_id", id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    ctx.supabase.from("inboxes").select("id, name").eq("ai_agent_id", id),
  ]);
  const readOnly = !isAdmin(ctx);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/ai-agents" className="text-sm font-semibold text-brand hover:underline">← AI agent</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-bold text-navy">{agent.name}</h1>
          <p className="mt-1.5 text-[15px] text-muted">
            {inboxes?.length ? `Dipakai di: ${inboxes.map((i) => i.name).join(", ")}` : "Belum dihubungkan ke inbox. "}
            {!inboxes?.length && <Link href="/connected-platforms" className="font-semibold text-brand underline">Hubungkan di Platform terhubung</Link>}
          </p>
        </div>
        {!readOnly && <DeleteAgentButton id={agent.id} name={agent.name} />}
      </div>

      {readOnly && <Notice tone="info">Hanya owner/admin yang bisa mengubah AI agent.</Notice>}

      <nav aria-label="Bagian pengaturan" className="flex flex-wrap gap-1 border-b border-line-soft">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/ai-agents/${id}?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px border-b-[3px] px-4 py-2.5 text-[15px] ${tab === t.id ? "border-navy font-bold text-navy" : "border-transparent text-muted hover:text-navy"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <section className="card p-6">
        {tab === "behavior" && (
          <BehaviorForm
            readOnly={readOnly}
            agent={{
              id: agent.id,
              name: agent.name,
              welcome_message: agent.welcome_message,
              style_preset: (STYLE_PRESETS as readonly string[]).includes(agent.style_preset) ? (agent.style_preset as StylePreset) : "friendly",
              communication: agent.communication,
              conversation_flow: agent.conversation_flow,
              rules: agent.rules,
              additional_instructions: parseInstructions(agent.additional_instructions),
            }}
          />
        )}
        {tab === "routing" && <RoutingForm id={agent.id} routing={parseRouting(agent.routing)} readOnly={readOnly} />}
        {tab === "config" && <ConfigForm id={agent.id} config={parseConfig(agent.config)} readOnly={readOnly} />}
        {tab === "knowledge" && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted">Informasi bisnis yang dipakai AI untuk menjawab. Sumber website, file, dan katalog produk menyusul.</p>
            {!readOnly && <KnowledgeForm agentId={agent.id} />}
            {!knowledge?.length ? (
              <EmptyState title="Belum ada pengetahuan" text="Tambahkan teks atau pasangan tanya-jawab tentang bisnis Anda." />
            ) : (
              <ul className="flex flex-col gap-3">
                {knowledge.map((k) => {
                  const title = k.kind === "qa" ? k.question : k.title || "Teks";
                  return (
                    <li key={k.id} className="flex items-start justify-between gap-4 rounded-xl border border-line-soft p-4">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-semibold text-navy">
                          <span className="badge badge-muted">{k.kind === "qa" ? "Tanya-jawab" : "Teks"}</span>
                          <span className="truncate">{title}</span>
                        </p>
                        <p className="mt-1 line-clamp-3 text-sm whitespace-pre-wrap text-muted">{k.kind === "qa" ? k.answer : k.content}</p>
                      </div>
                      {!readOnly && <DeleteKnowledgeButton agentId={agent.id} id={k.id} label={title ?? "pengetahuan"} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
