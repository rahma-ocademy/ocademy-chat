"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Archive, ExternalLink, Link2, Plug, RefreshCw, Save, Send, X } from "lucide-react";
import Link from "next/link";
import { createTemplate, archiveTemplate, refreshTemplateStatuses, submitTemplateToMeta, type TemplateState } from "./actions";
import { InfoTip, SubmitButton } from "@/components/ui";
import { useResultToast, useToast } from "@/components/toast";
import { renderTemplate } from "@/lib/followups/variables";
import { SAMPLE_VARS as SAMPLE, slugTemplateName, toMetaBody } from "@/lib/whatsapp/template-format";

const CATEGORIES = ["Pembayaran", "Pengiriman", "Order", "Penjualan", "Ulasan", "Umum"];

type Mode = "submit" | "link" | "none";

/** Label tombol + apa yang terjadi setelah diklik, per pilihan template WhatsApp. */
const CTA: Record<Mode, { label: string; pending: string; icon: typeof Send; after: string }> = {
  submit: {
    label: "Simpan & ajukan ke Meta",
    pending: "Mengajukan ke Meta…",
    icon: Send,
    after: "Template disimpan lalu dikirim ke Meta untuk direview (biasanya beberapa menit, paling lama 24 jam). Setelah disetujui, bisa dikirim kapan saja.",
  },
  link: {
    label: "Simpan & tautkan",
    pending: "Menyimpan…",
    icon: Link2,
    after: "Template disimpan dan statusnya diambil dari WhatsApp Manager. Pastikan nama dan isinya sama persis.",
  },
  none: {
    label: "Simpan sebagai teks biasa",
    pending: "Menyimpan…",
    icon: Save,
    after: "Tidak diajukan ke Meta: hanya terkirim dalam 24 jam sejak pelanggan terakhir chat. Bisa diajukan nanti dari tabel.",
  },
};

export function TemplateForm({ waConnected }: { waConnected: boolean }) {
  const [state, action] = useActionState<TemplateState, FormData>(createTemplate, {});
  useResultToast(state, "Template tersimpan.");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<Mode>(waConnected ? "submit" : "none");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset kontrol terkontrol setelah submit berhasil
      setBody("");
    }
  }, [state]);

  const preview = renderTemplate(body || "Tulis pesan di sebelah kiri…", SAMPLE);

  return (
    <form ref={formRef} action={action} className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tpl-name" className="label">Nama template</label>
            <input id="tpl-name" name="name" className="field" placeholder="mis. Pengingat bayar" required />
          </div>
          <div>
            <label htmlFor="tpl-cat" className="label">Kategori</label>
            <select id="tpl-cat" name="category" className="field" defaultValue="Pembayaran">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="tpl-body" className="label">Isi pesan</label>
          <div role="toolbar" aria-label="Sisipkan variabel" className="mb-2 flex flex-wrap gap-1.5">
            {Object.keys(SAMPLE).map((v) => (
              <button key={v} type="button" className="btn btn-secondary btn-sm !min-h-8 !rounded-full !px-3 !text-[13px] !font-medium" onClick={() => setBody((b) => `${b}{{${v}}}`)}>
                + {`{{${v}}}`}
              </button>
            ))}
          </div>
          <textarea id="tpl-body" name="body" rows={7} className="field py-3 leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1024} required />
          <p className="hint">{body.length} / 1024 karakter</p>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-line-soft p-4">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <label htmlFor="tpl-mode" className="label !mb-0">Template WhatsApp</label>
              <InfoTip label="Kapan perlu template WhatsApp?">
                <strong className="block font-bold">Kenapa perlu?</strong>
                WhatsApp hanya mengizinkan pesan bebas dalam 24 jam sejak pelanggan terakhir chat. Di luar itu, yang boleh dikirim hanya
                template yang <strong>disetujui Meta</strong>.
                <strong className="mt-2 block font-bold">Diajukan otomatis</strong>
                Isi pesan dikirim ke Meta untuk direview, dengan variabel diubah menjadi {"{{1}}"}, {"{{2}}"}, … sesuai urutan kemunculannya.
              </InfoTip>
            </div>
            <select id="tpl-mode" name="wa_mode" className="field" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="submit" disabled={!waConnected}>Ajukan ke Meta sekarang{waConnected ? "" : " (hubungkan WhatsApp dulu)"}</option>
              <option value="link">Tautkan ke template yang sudah ada di WhatsApp Manager</option>
              <option value="none">Teks biasa (tanpa template, hanya dalam 24 jam)</option>
            </select>
          </div>

          {mode === "submit" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tpl-meta-cat" className="label">Kategori di Meta</label>
                <select id="tpl-meta-cat" name="meta_category" className="field" defaultValue="UTILITY">
                  <option value="UTILITY">Utility (transaksi: tagihan, pengiriman)</option>
                  <option value="MARKETING">Marketing (promosi, penawaran)</option>
                </select>
              </div>
              <div>
                <label htmlFor="tpl-wa" className="label">Nama di WhatsApp <span className="font-normal text-muted">(opsional)</span></label>
                <input id="tpl-wa" name="wa_template_name" className="field font-mono" placeholder="otomatis dari nama template" pattern="[a-z0-9_]*" title="Huruf kecil, angka, dan garis bawah" maxLength={512} />
              </div>
              <p className="hint sm:col-span-2 !mt-0">
                Isi pesan tidak boleh diawali atau diakhiri variabel. Meta menentukan keputusan akhir kategori dan persetujuan; status muncul di tabel.
              </p>
            </div>
          )}

          {mode === "link" && (
            <div>
              <label htmlFor="tpl-wa" className="label">Nama template WhatsApp</label>
              <input id="tpl-wa" name="wa_template_name" className="field font-mono" placeholder="mis. pengingat_bayar" pattern="[a-z0-9_]+" title="Huruf kecil, angka, dan garis bawah" maxLength={512} required />
              <p className="hint">Isinya harus sama dengan template di WhatsApp Manager; variabel {"{{1}}"}, {"{{2}}"}, … sesuai urutan variabel di atas.</p>
            </div>
          )}
        </div>
        <CreateCta mode={mode} waConnected={waConnected} />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-navy">Pratinjau</h3>
        <div className="rounded-xl bg-[#EFEAE2] p-4">
          <div className="max-w-[95%] rounded-lg bg-white px-3 py-2.5 text-sm leading-relaxed whitespace-pre-line shadow-sm">{preview.text}</div>
        </div>
        <p className="hint !mt-0">Diisi dengan data contoh.</p>
        {preview.missing.length > 0 && (
          <p role="status" className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
            Variabel tanpa data contoh: {preview.missing.map((m) => `{{${m}}}`).join(", ")}. Pastikan event pemicu membawa data ini.
          </p>
        )}
      </div>
    </form>
  );
}

function CreateCta({ mode, waConnected }: { mode: Mode; waConnected: boolean }) {
  const cta = CTA[mode];
  const Icon = cta.icon;
  return (
    <div className="flex flex-col gap-2">
      <SubmitButton className="btn btn-primary self-start" pending={cta.pending}>
        <Icon aria-hidden="true" className="size-4" />
        {cta.label}
      </SubmitButton>
      <p className="hint !mt-0">{cta.after}</p>
      {!waConnected && mode !== "submit" && (
        <p className="hint !mt-0">
          Ingin langsung diajukan ke Meta?{" "}
          <Link href="/connected-platforms/new/whatsapp" className="font-semibold text-brand underline">Hubungkan WhatsApp</Link> dulu.
        </p>
      )}
    </div>
  );
}

const WA_MANAGER_URL = "https://business.facebook.com/wa/manage/message-templates/";

/**
 * Aksi per baris tabel template, menyesuaikan status: ajukan ke Meta (belum punya template WhatsApp),
 * perbaiki di WhatsApp Manager (ditolak/tidak ditemukan), dan arsipkan.
 */
export function TemplateRowActions({
  template,
  canSubmit,
  waConnected,
}: {
  template: { id: string; name: string; body: string; waName: string | null; waStatus: string | null };
  canSubmit: boolean;
  waConnected: boolean;
}) {
  const t = template;
  const needsFix = Boolean(t.waName) && ["REJECTED", "NOT_FOUND", "PAUSED", "DISABLED"].includes(t.waStatus ?? "");
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        {!t.waName && canSubmit && t.body.trim() && waConnected && <SubmitToMetaDialog id={t.id} name={t.name} body={t.body} />}
        {needsFix && (
          <a href={WA_MANAGER_URL} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            <ExternalLink aria-hidden="true" className="size-4" />
            Perbaiki di WhatsApp Manager
          </a>
        )}
        <ArchiveButton id={t.id} name={t.name} />
      </div>
      {!t.waName && canSubmit && !t.body.trim() && (
        <p className="max-w-56 text-right text-xs text-muted">Isi preset belum tersedia, jadi belum bisa diajukan ke Meta.</p>
      )}
      {!t.waName && canSubmit && t.body.trim() && !waConnected && (
        <Link href="/connected-platforms/new/whatsapp" className="inline-flex items-center gap-1 text-xs font-semibold text-brand underline">
          <Plug aria-hidden="true" className="size-3.5" />
          Hubungkan WhatsApp untuk mengajukan
        </Link>
      )}
    </div>
  );
}

function ArchiveButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn btn-danger btn-sm"
      disabled={pending}
      aria-label={`Arsipkan ${name}`}
      onClick={() => {
        if (!window.confirm(`Arsipkan "${name}"? Template tidak tampil lagi di sini dan tidak bisa dipilih untuk aturan follow-up baru. Template di Meta tidak terhapus.`)) return;
        start(async () => {
          const r = await archiveTemplate(id);
          if (r.error) toast.error(r.error);
          else toast.success(`Template "${name}" diarsipkan.`);
        });
      }}
    >
      <Archive aria-hidden="true" className="size-4" />
      {pending ? "Mengarsipkan…" : "Arsipkan"}
    </button>
  );
}

/** Modal pengajuan: tampilkan nama, kategori, dan isi persis yang akan dikirim ke Meta sebelum diajukan. */
function SubmitToMetaDialog({ id, name, body }: { id: string; name: string; body: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState<"UTILITY" | "MARKETING">("UTILITY");
  const [pending, start] = useTransition();
  const toast = useToast();
  const waName = slugTemplateName(name);
  const meta = toMetaBody(body);
  const close = () => ref.current?.close();

  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => ref.current?.showModal()} aria-label={`Ajukan ${name} ke Meta`}>
        <Send aria-hidden="true" className="size-4" />
        Ajukan ke Meta
      </button>
      <dialog
        ref={ref}
        aria-labelledby={`dlg-${id}`}
        className="m-auto w-[min(560px,calc(100vw-32px))] rounded-card border border-line-soft bg-surface p-0 text-left shadow-[var(--shadow-pop)] backdrop:bg-navy/40"
        onClick={(e) => { if (e.target === ref.current && !pending) close(); }}
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={`dlg-${id}`} className="text-lg font-bold text-navy">Ajukan “{name}” ke Meta</h2>
              <p className="mt-1 text-sm text-muted">Setelah disetujui, template ini bisa dikirim kapan saja, termasuk di luar 24 jam sejak pelanggan terakhir chat.</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={close} disabled={pending} aria-label="Tutup">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-[140px_1fr]">
            <dt className="text-muted">Nama di WhatsApp</dt>
            <dd><code className="rounded-md bg-bg px-2 py-1 font-mono text-[12px] text-navy">{waName || "—"}</code></dd>
            <dt className="text-muted">Bahasa</dt>
            <dd>Indonesia</dd>
            <dt className="self-center text-muted"><label htmlFor={`cat-${id}`}>Kategori</label></dt>
            <dd>
              <select id={`cat-${id}`} className="field" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
                <option value="UTILITY">Utility (transaksi: tagihan, pengiriman)</option>
                <option value="MARKETING">Marketing (promosi, penawaran)</option>
              </select>
            </dd>
          </dl>

          <div>
            <p className="label">Isi yang dikirim ke Meta</p>
            <pre className="max-h-48 overflow-auto rounded-xl bg-bg p-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-ink">{meta.text}</pre>
            {meta.variables.length > 0 && (
              <p className="hint">
                {meta.variables.map((v, i) => `{{${i + 1}}} = ${v}`).join(" · ")}
              </p>
            )}
          </div>

          <p className="rounded-lg bg-brand-soft px-3.5 py-2.5 text-[13px] text-navy">
            Review biasanya beberapa menit, paling lama 24 jam. Status di tabel berubah otomatis. Kalau ditolak, alasannya tampil di kolom Status Meta.
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={close} disabled={pending}>Batal</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending || !waName}
              onClick={() =>
                start(async () => {
                  const r = await submitTemplateToMeta(id, category);
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success(r.message ?? "Template diajukan ke Meta.");
                    close();
                  }
                })
              }
            >
              <Send aria-hidden="true" className="size-4" />
              {pending ? "Mengajukan…" : "Ajukan sekarang"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Ambil status persetujuan terbaru dari Meta. */
export function RefreshStatusButton() {
  const [state, action, pending] = useActionState<TemplateState>(refreshTemplateStatuses, {});
  useResultToast(state);
  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <button type="submit" className="btn btn-secondary" disabled={pending}>
        <RefreshCw aria-hidden="true" className={`size-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Mengecek…" : "Cek status Meta"}
      </button>
    </form>
  );
}
