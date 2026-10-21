import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin, requireContext } from "@/lib/auth";
import { EmptyState, Notice, PageHeader } from "@/components/page";
import { CreateAgentForm } from "./forms";

export const metadata: Metadata = { title: "AI agent" };

export default async function AiAgentsPage() {
  const ctx = await requireContext();
  const { supabase, businessId } = ctx;
  const [agentsRes, inboxesRes, knowledgeRes] = await Promise.all([
    supabase.from("ai_agents").select("id, name, style_preset, updated_at").eq("business_id", businessId).order("created_at"),
    supabase.from("inboxes").select("name, ai_agent_id").eq("business_id", businessId).not("ai_agent_id", "is", null),
    supabase.from("ai_knowledge").select("agent_id").eq("business_id", businessId),
  ]);
  const agents = agentsRes.data ?? [];
  const inboxesOf = (id: string) => (inboxesRes.data ?? []).filter((i) => i.ai_agent_id === id).map((i) => i.name as string);
  const knowledgeOf = (id: string) => (knowledgeRes.data ?? []).filter((k) => k.agent_id === id).length;
  const admin = isAdmin(ctx);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="AI agent" description="Atur cara AI menjawab pelanggan: gaya bahasa, pengetahuan bisnis, kapan dialihkan ke agen manusia." />
      <Notice tone="info">
        Versi ini menyimpan konfigurasi AI agent dan menghubungkannya ke inbox. Balasan AI otomatis (LLM) belum aktif, jadi pesan tetap dijawab agen manusia.
      </Notice>

      {admin && (
        <section className="card p-6" aria-labelledby="h-new-agent">
          <h2 id="h-new-agent" className="mb-4 text-lg font-bold text-navy">AI agent baru</h2>
          <CreateAgentForm />
        </section>
      )}

      {agents.length === 0 ? (
        <div className="card"><EmptyState title="Belum ada AI agent" text="Buat AI agent pertama, lalu hubungkan ke inbox di Platform terhubung." /></div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => {
            const used = inboxesOf(a.id as string);
            return (
              <li key={a.id}>
                <Link href={`/ai-agents/${a.id}`} className="card flex h-full flex-col gap-2 p-5 transition hover:border-brand hover:shadow-md">
                  <span className="text-[17px] font-bold text-navy">{a.name}</span>
                  <span className="text-sm text-muted">{knowledgeOf(a.id as string)} sumber pengetahuan</span>
                  <span className="text-sm text-muted">{used.length ? `Dipakai di: ${used.join(", ")}` : "Belum dihubungkan ke inbox"}</span>
                  <span className="mt-auto pt-2 text-sm font-semibold text-brand">Pengaturan →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
