"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { SubmitButton } from "@/components/ui";
import { CREATIVITY, CREATIVITY_LABEL, STYLE_LABEL, STYLE_PRESETS, MAX_INSTRUCTIONS, type AdditionalInstruction, type AgentConfig, type AgentRouting, type StylePreset } from "@/lib/ai/config";
import { addKnowledge, createAgent, deleteAgent, deleteKnowledge, saveBehavior, saveConfig, saveRouting, type AgentState } from "./actions";

function Status({ state }: { state: AgentState }) {
  if (state.error) return <p role="alert" className="text-sm text-bad">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm text-ok">Tersimpan.</p>;
  return null;
}

export function CreateAgentForm() {
  const [state, action] = useActionState<AgentState, FormData>(createAgent, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <label htmlFor="agent-name" className="label">Nama AI agent</label>
        <input id="agent-name" name="name" className="field" placeholder="mis. CS Toko" required minLength={2} maxLength={60} />
      </div>
      <SubmitButton pending="Membuat…">Buat AI agent</SubmitButton>
      <div className="basis-full"><Status state={state} /></div>
    </form>
  );
}

type Behavior = {
  id: string;
  name: string;
  welcome_message: string | null;
  style_preset: StylePreset;
  communication: string | null;
  conversation_flow: string | null;
  rules: string | null;
  additional_instructions: AdditionalInstruction[];
};

export function BehaviorForm({ agent, readOnly }: { agent: Behavior; readOnly: boolean }) {
  const [state, action] = useActionState<AgentState, FormData>(saveBehavior, {});
  const [rows, setRows] = useState<AdditionalInstruction[]>(agent.additional_instructions);
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={agent.id} />
      <fieldset disabled={readOnly} className="flex flex-col gap-6">
        <div>
          <label htmlFor="b-name" className="label">Nama</label>
          <input id="b-name" name="name" className="field" defaultValue={agent.name} required minLength={2} maxLength={60} />
        </div>

        <section aria-labelledby="h-welcome" className="flex flex-col gap-2">
          <h3 id="h-welcome" className="font-bold text-navy">Pesan sambutan</h3>
          <p className="text-sm text-muted">Dikirim sekali saat pelanggan pertama kali chat.</p>
          <label htmlFor="b-welcome" className="sr-only">Pesan sambutan</label>
          <textarea id="b-welcome" name="welcome_message" className="field min-h-24 py-2.5" maxLength={1000} defaultValue={agent.welcome_message ?? ""} placeholder="Halo Kak! Ada yang bisa kami bantu hari ini?" />
        </section>

        <section aria-labelledby="h-comm" className="flex flex-col gap-4">
          <div>
            <h3 id="h-comm" className="font-bold text-navy">Gaya komunikasi</h3>
            <p className="text-sm text-muted">Nada, alur percakapan, dan aturan yang diikuti AI.</p>
          </div>
          <fieldset>
            <legend className="label">Preset gaya</legend>
            <div className="flex flex-wrap gap-2">
              {STYLE_PRESETS.map((s) => (
                <label key={s} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:font-semibold has-[:checked]:text-navy">
                  <input type="radio" name="style_preset" value={s} defaultChecked={agent.style_preset === s} className="accent-brand" />
                  {STYLE_LABEL[s]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="b-comm" className="label">Cara berkomunikasi</label>
            <textarea id="b-comm" name="communication" className="field min-h-24 py-2.5" maxLength={4000} defaultValue={agent.communication ?? ""} placeholder="mis. Tenang dan empatik saat pelanggan kesal. Akui keluhannya lalu bantu cari solusi." />
          </div>
          <div>
            <label htmlFor="b-flow" className="label">Alur percakapan</label>
            <textarea id="b-flow" name="conversation_flow" className="field min-h-24 py-2.5" maxLength={4000} defaultValue={agent.conversation_flow ?? ""} placeholder="mis. Jawab jelas, arahkan ke langkah berikutnya (cek ongkir → checkout), alihkan ke admin bila perlu." />
          </div>
          <div>
            <label htmlFor="b-rules" className="label">Aturan & batasan</label>
            <textarea id="b-rules" name="rules" className="field min-h-24 py-2.5" maxLength={4000} defaultValue={agent.rules ?? ""} placeholder="mis. Jangan menjanjikan diskon. Jangan membahas topik di luar produk." />
          </div>
        </section>

        <section aria-labelledby="h-extra" className="flex flex-col gap-3">
          <div>
            <h3 id="h-extra" className="font-bold text-navy">Instruksi tambahan</h3>
            <p className="text-sm text-muted">Instruksi yang berlaku saat kondisi tertentu (kosongkan kondisi = selalu berlaku).</p>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-line-soft p-3 sm:grid-cols-[1fr_2fr_auto] sm:items-start">
              <div>
                <label htmlFor={`c-${i}`} className="label">Kondisi</label>
                <input id={`c-${i}`} name="ai_condition" className="field" maxLength={500} defaultValue={r.condition} placeholder="mis. pelanggan bertanya soal retur" />
              </div>
              <div>
                <label htmlFor={`in-${i}`} className="label">Instruksi</label>
                <textarea id={`in-${i}`} name="ai_instruction" className="field min-h-11 py-2.5" maxLength={2000} defaultValue={r.instruction} />
              </div>
              <button type="button" className="btn btn-danger btn-sm sm:mt-7" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Hapus instruksi ${i + 1}`}>Hapus</button>
            </div>
          ))}
          {rows.length < MAX_INSTRUCTIONS && (
            <button type="button" className="btn btn-dashed btn-sm self-start" onClick={() => setRows([...rows, { condition: "", instruction: "" }])}>+ Tambah instruksi</button>
          )}
        </section>
      </fieldset>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending="Menyimpan…">Simpan perilaku</SubmitButton>
          <Status state={state} />
        </div>
      )}
    </form>
  );
}

export function RoutingForm({ id, routing, readOnly }: { id: string; routing: AgentRouting; readOnly: boolean }) {
  const [state, action] = useActionState<AgentState, FormData>(saveRouting, {});
  const items = [
    { key: "transfer", title: "Alihkan ke agen manusia", text: "AI menyerahkan percakapan ke agen manusia saat kondisi terpenuhi.", placeholder: "mis. pelanggan komplain, minta refund, atau minta bicara dengan admin" },
    { key: "label", title: "Beri label percakapan", text: "AI memberi label otomatis sesuai isi percakapan.", placeholder: "mis. label 'Siap beli' bila pelanggan menanyakan cara transfer" },
  ] as const;
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        {items.map((it) => (
          <section key={it.key} className="flex flex-col gap-3 rounded-xl border border-line-soft p-4" aria-labelledby={`h-${it.key}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id={`h-${it.key}`} className="font-bold text-navy">{it.title}</h3>
                <p className="text-sm text-muted">{it.text}</p>
              </div>
              <input type="checkbox" role="switch" className="switch" name={`${it.key}_enabled`} defaultChecked={routing[it.key].enabled} aria-labelledby={`h-${it.key}`} />
            </div>
            <div>
              <label htmlFor={`${it.key}-cond`} className="label">Kondisi</label>
              <textarea id={`${it.key}-cond`} name={`${it.key}_condition`} className="field min-h-20 py-2.5" maxLength={1000} defaultValue={routing[it.key].condition} placeholder={it.placeholder} />
            </div>
          </section>
        ))}
      </fieldset>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending="Menyimpan…">Simpan routing</SubmitButton>
          <Status state={state} />
        </div>
      )}
    </form>
  );
}

export function ConfigForm({ id, config, readOnly }: { id: string; config: AgentConfig; readOnly: boolean }) {
  const [state, action] = useActionState<AgentState, FormData>(saveConfig, {});
  const toggles = [
    { name: "stop_after_transfer", title: "Hentikan AI setelah dialihkan", text: "AI berhenti membalas setelah percakapan di-assign ke agen manusia." },
    { name: "silent_transfer", title: "Alihkan diam-diam", text: "Alihkan ke agen manusia tanpa memberi tahu pelanggan." },
    { name: "session_only_memory", title: "Ingat sesi ini saja", text: "Hanya memakai pesan sesi sekarang; matikan untuk ikut membaca riwayat sebelumnya." },
  ] as const;
  const numbers = [
    { name: "history_limit", title: "Batas riwayat", text: "Jumlah pesan sebelumnya yang dibaca AI sebagai konteks.", min: 1, max: 100 },
    { name: "context_limit", title: "Batas konteks pengetahuan", text: "Jumlah potongan pengetahuan yang dipakai per jawaban.", min: 1, max: 50 },
    { name: "message_await_seconds", title: "Jeda sebelum membalas (detik)", text: "Menunggu pelanggan selesai mengetik beberapa pesan sebelum menjawab.", min: 0, max: 60 },
    { name: "message_limit", title: "Batas pesan AI per percakapan", text: "Setelah batas ini AI berhenti dan percakapan menunggu agen manusia.", min: 1, max: 10000 },
  ] as const;
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        {toggles.map((t) => (
          <label key={t.name} className="flex items-start justify-between gap-4 rounded-xl border border-line-soft p-4">
            <span>
              <span className="block font-bold text-navy">{t.title}</span>
              <span className="text-sm text-muted">{t.text}</span>
            </span>
            <input type="checkbox" role="switch" className="switch mt-1" name={t.name} defaultChecked={config[t.name]} />
          </label>
        ))}
        <div className="grid gap-4 sm:grid-cols-2">
          {numbers.map((n) => (
            <div key={n.name}>
              <label htmlFor={`cfg-${n.name}`} className="label">{n.title}</label>
              <input id={`cfg-${n.name}`} name={n.name} type="number" className="field" min={n.min} max={n.max} defaultValue={config[n.name]} required />
              <p className="hint">{n.text}</p>
            </div>
          ))}
          <div>
            <label htmlFor="cfg-creativity" className="label">Tingkat kreativitas</label>
            <select id="cfg-creativity" name="creativity" className="field" defaultValue={config.creativity}>
              {CREATIVITY.map((c) => <option key={c} value={c}>{CREATIVITY_LABEL[c]}</option>)}
            </select>
            <p className="hint">Konsisten = jawaban lebih bisa ditebak.</p>
          </div>
          <div>
            <label htmlFor="cfg-tz" className="label">Zona waktu</label>
            <select id="cfg-tz" name="timezone" className="field" defaultValue={config.timezone}>
              <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
              <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
              <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
            </select>
            <p className="hint">Dipakai AI untuk jadwal dan aksi berbasis waktu.</p>
          </div>
        </div>
      </fieldset>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending="Menyimpan…">Simpan konfigurasi</SubmitButton>
          <Status state={state} />
        </div>
      )}
    </form>
  );
}

export function KnowledgeForm({ agentId }: { agentId: string }) {
  const [kind, setKind] = useState<"text" | "qa">("text");
  const [state, action] = useActionState<AgentState, FormData>(addKnowledge, {});
  const form = useRef<HTMLFormElement>(null);
  // Setelah tersimpan, kosongkan isian untuk entri berikutnya.
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="flex flex-col gap-4 rounded-xl border border-line-soft p-4">
      <input type="hidden" name="agent_id" value={agentId} />
      <input type="hidden" name="kind" value={kind} />
      <div role="tablist" aria-label="Jenis pengetahuan" className="flex gap-2">
        {(["text", "qa"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setKind(k)}>
            {k === "text" ? "Teks" : "Tanya-jawab"}
          </button>
        ))}
      </div>
      {kind === "text" ? (
        <>
          <div>
            <label htmlFor="k-title" className="label">Judul (opsional)</label>
            <input id="k-title" name="title" className="field" maxLength={120} placeholder="mis. Kebijakan pengiriman" />
          </div>
          <div>
            <label htmlFor="k-content" className="label">Isi</label>
            <textarea id="k-content" name="content" className="field min-h-36 py-2.5" maxLength={20000} required placeholder="Tulis informasi bisnis: produk, harga, jam buka, cara pesan, kebijakan retur…" />
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="k-q" className="label">Pertanyaan</label>
            <input id="k-q" name="question" className="field" maxLength={500} required placeholder="mis. Berapa lama pengiriman ke luar Jawa?" />
          </div>
          <div>
            <label htmlFor="k-a" className="label">Jawaban</label>
            <textarea id="k-a" name="answer" className="field min-h-24 py-2.5" maxLength={4000} required />
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending="Menyimpan…" className="btn btn-primary btn-sm">Tambah pengetahuan</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  );
}

export function DeleteKnowledgeButton({ agentId, id, label }: { agentId: string; id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn btn-danger btn-sm" disabled={pending} aria-label={`Hapus ${label}`} onClick={() => start(async () => { await deleteKnowledge(agentId, id); })}>
      Hapus
    </button>
  );
}

export function DeleteAgentButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-danger btn-sm"
      disabled={pending}
      onClick={() => {
        if (confirm(`Hapus AI agent "${name}"? Inbox yang memakainya akan dilepas.`)) start(async () => { await deleteAgent(id); });
      }}
    >
      Hapus AI agent
    </button>
  );
}
