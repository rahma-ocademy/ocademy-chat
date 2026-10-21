"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";

const BACK = "/connected-platforms/new/whatsapp";

export function MetaCallback() {
  const params = useSearchParams();
  const error = params.get("error_description") || params.get("error_reason") || params.get("error");
  const code = params.get("code");

  useEffect(() => {
    // Dibuka sebagai popup: serahkan hasilnya ke jendela aplikasi (origin sama saja) lalu tutup.
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: "ocademy_meta_callback", code, error }, window.location.origin);
      } catch {
        /* jendela induk beda origin: abaikan */
      }
      window.close();
      return;
    }
    // Dibuka di tab biasa tanpa galat: kembali ke halaman menghubungkan WhatsApp.
    if (!error) {
      const t = setTimeout(() => window.location.replace(BACK), 1200);
      return () => clearTimeout(t);
    }
  }, [code, error]);

  return (
    <section className="card flex flex-col items-center gap-4 p-8 text-center" aria-live="polite">
      {error ? (
        <>
          <span className="icon-tile icon-tile-lg tone-rose">
            <CircleAlert aria-hidden="true" className="size-6" />
          </span>
          <h1 className="text-xl font-bold text-navy">Login Meta tidak selesai</h1>
          <p className="text-sm leading-relaxed text-muted">{error}</p>
          <Link href={BACK} className="btn btn-primary">Coba lagi</Link>
        </>
      ) : (
        <>
          <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-brand" />
          <h1 className="text-xl font-bold text-navy">Menghubungkan ke Meta…</h1>
          <p className="text-sm text-muted">Jendela ini akan tertutup otomatis. Jika tidak, kembali ke aplikasi.</p>
          <Link href={BACK} className="btn btn-secondary btn-sm">Kembali ke aplikasi</Link>
        </>
      )}
    </section>
  );
}
