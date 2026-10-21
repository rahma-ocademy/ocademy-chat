"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createTemplate, archiveTemplate, refreshTemplateStatuses, type TemplateState } from "./actions";
import { InfoTip, SubmitButton } from "@/components/ui";
import { renderTemplate } from "@/lib/followups/variables";

const SAMPLE: Record<string, string> = {
  customer_name: "Rani",
  order_id: "INV-0192",
  total: "Rp149.000",
  payment_link: "bayar.contoh/INV-0192",
  product_name: "Kelas Dropship",
  courier: "J&T",
  tracking_number: "JT1234567890",
  tracking_link: "lacak.contoh/JT1234567890",
};
const CATEGORIES = ["Pembayaran", "Pengiriman", "Order", "Penjualan", "Ulasan", "Umum"];

export function TemplateForm() {
  const [state, action] = useActionState<TemplateState, FormData>(createTemplate, {});
  const [body, setBody] = useState("");
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
        <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <label htmlFor="tpl-wa" className="label !mb-0">Nama template WhatsApp <span className="font-normal text-muted">(opsional)</span></label>
            <InfoTip label="Kapan perlu nama template WhatsApp?">
              <strong className="block font-bold">Kenapa perlu?</strong>
              WhatsApp hanya mengizinkan pesan bebas dalam 24 jam sejak pelanggan terakhir chat. Di luar itu, yang boleh dikirim hanya
              template yang <strong>disetujui Meta</strong>.
              <strong className="mt-2 block font-bold">Cara pakai</strong>
              Buat template dengan isi yang sama di WhatsApp Manager (variabel ditulis {"{{1}}"}, {"{{2}}"}, … sesuai urutan variabel di atas),
              lalu tulis namanya di sini. Status persetujuannya tampil di tabel.
            </InfoTip>
          </div>
          <input
            id="tpl-wa"
            name="wa_template_name"
            className="field font-mono"
            placeholder="mis. pengingat_bayar"
            pattern="[a-z0-9_]*"
            title="Huruf kecil, angka, dan garis bawah"
            maxLength={512}
            aria-describedby="tpl-wa-hint"
          />
          <p id="tpl-wa-hint" className="hint">Kosongkan bila hanya dipakai dalam 24 jam setelah pelanggan chat.</p>
        </div>
        {state.error && <p role="alert" className="rounded-lg bg-bad-soft px-3.5 py-2.5 text-sm text-[#912018]">{state.error}</p>}
        {state.ok && <p role="status" className="rounded-lg bg-ok-soft px-3.5 py-2.5 text-sm text-ok">Template tersimpan.</p>}
        <SubmitButton className="btn btn-primary self-start">Simpan template</SubmitButton>
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

export function ArchiveButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={archiveTemplate.bind(null, id)}>
      <button type="submit" className="btn btn-danger btn-sm" aria-label={`Arsipkan ${name}`}>Arsipkan</button>
    </form>
  );
}

/** Ambil status persetujuan terbaru dari Meta. */
export function RefreshStatusButton() {
  const [state, action, pending] = useActionState<TemplateState>(refreshTemplateStatuses, {});
  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <button type="submit" className="btn btn-secondary" disabled={pending}>
        <RefreshCw aria-hidden="true" className={`size-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Mengecek…" : "Cek status Meta"}
      </button>
      {state.error && <p role="alert" className="max-w-xs text-right text-[13px] text-bad">{state.error}</p>}
      {state.message && <p role="status" className="text-[13px] text-ok">{state.message}</p>}
    </form>
  );
}
