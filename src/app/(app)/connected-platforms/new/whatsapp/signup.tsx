"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { InfoTip, SubmitButton } from "@/components/ui";
import { useResultToast, useToast } from "@/components/toast";
import { connectWhatsAppEmbedded, connectWhatsAppManual, type FormState } from "../../actions";

type FBLoginResponse = { authResponse?: { code?: string } | null };
type FBSDK = {
  init(opts: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void;
  login(cb: (r: FBLoginResponse) => void, opts: Record<string, unknown>): void;
};
declare global {
  interface Window {
    FB?: FBSDK;
    fbAsyncInit?: () => void;
  }
}

type Session = { phoneNumberId: string; wabaId: string };

/**
 * Meta Embedded Signup. Hasilnya datang dari dua sumber terpisah:
 * - callback FB.login → `code` (ditukar menjadi token di server)
 * - window.postMessage dari facebook.com → `phone_number_id` + `waba_id`
 * Keduanya digabung lalu dikirim ke server action.
 */
export function EmbeddedSignup({ appId, configId, graphVersion, mode }: { appId: string; configId: string; graphVersion: string; mode: "cloud_api" | "coexistence" }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => { if (error) toast.error(error); }, [error, toast]);
  useEffect(() => { if (done) toast.success(done); }, [done, toast]);
  const code = useRef<string | null>(null);
  const session = useRef<Session | null>(null);

  // Muat SDK Facebook sekali.
  useEffect(() => {
    const init = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
      setReady(true);
    };
    if (window.FB) return init();
    window.fbAsyncInit = init;
    if (!document.getElementById("facebook-jssdk")) {
      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.crossOrigin = "anonymous";
      s.onerror = () => setError("SDK Facebook gagal dimuat. Periksa koneksi atau pemblokir iklan.");
      document.body.appendChild(s);
    }
  }, [appId, graphVersion]);

  async function finish() {
    if (!code.current || !session.current) return;
    const res = await connectWhatsAppEmbedded({ code: code.current, ...session.current, mode, pin: mode === "cloud_api" ? pin : undefined });
    code.current = null;
    session.current = null;
    setBusy(false);
    if (res.error) return setError(res.error);
    setDone(res.note ?? "WhatsApp terhubung.");
    router.push(`/connected-platforms?i=${res.inboxId}`);
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      let host = "";
      try { host = new URL(event.origin).hostname; } catch { return; }
      if (host !== "facebook.com" && !host.endsWith(".facebook.com")) return;
      let data: { type?: string; event?: string; data?: { phone_number_id?: string; waba_id?: string; current_step?: string; error_message?: string } };
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (data.event === "CANCEL") {
        setBusy(false);
        setError(data.data?.error_message ? `Dibatalkan: ${data.data.error_message}` : "Proses di jendela Meta dibatalkan sebelum selesai.");
        return;
      }
      if (data.event?.startsWith("FINISH") && data.data?.phone_number_id && data.data?.waba_id) {
        session.current = { phoneNumberId: data.data.phone_number_id, wabaId: data.data.waba_id };
        void finish();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // finish membaca ref + pin terbaru; cukup pasang ulang saat pin/mode berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, mode]);

  function start() {
    setError(null);
    if (mode === "cloud_api" && !/^\d{6}$/.test(pin)) return setError("Isi PIN 6 digit dulu.");
    if (!window.FB) return setError("SDK Facebook belum siap. Tunggu sebentar lalu coba lagi.");
    setBusy(true);
    // Callback FB.login tidak boleh async (dibatasi SDK).
    window.FB.login(
      (r) => {
        const c = r.authResponse?.code;
        if (!c) {
          setBusy(false);
          setError("Login Meta dibatalkan.");
          return;
        }
        code.current = c;
        void finish();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: "3",
          ...(mode === "coexistence" ? { featureType: "whatsapp_business_app_onboarding" } : {}),
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === "cloud_api" && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <label htmlFor="wa-pin" className="label !mb-0">PIN verifikasi 2 langkah (6 digit)</label>
            <InfoTip label="Apa itu PIN verifikasi 2 langkah?">
              <strong className="block font-bold">Untuk apa PIN ini?</strong>
              PIN dipakai untuk mendaftarkan (mengaktifkan) nomor ke WhatsApp Cloud API. Nomor belum punya PIN? Angka yang Anda isi
              otomatis menjadi PIN-nya. Sudah punya? Isi PIN yang sama.
              <strong className="mt-2 block font-bold">Simpan baik-baik</strong>
              PIN diminta lagi saat nomor didaftarkan ulang atau dipindah. Kami tidak menyimpannya. Lupa PIN? Ubah di WhatsApp Manager →
              Nomor telepon → Verifikasi dua langkah.
            </InfoTip>
          </div>
          <input
            id="wa-pin"
            className="field font-mono tracking-[0.3em]"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="••••••"
            aria-describedby="wa-pin-hint"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
          <p id="wa-pin-hint" className="hint">Mengaktifkan nomor di Cloud API. Catat PIN ini, dibutuhkan bila nomor dipindah.</p>
        </div>
      )}
      <button type="button" className="btn btn-primary" onClick={start} disabled={!ready || busy}>
        {busy ? "Menunggu Meta…" : ready ? "Login dengan Facebook" : "Memuat…"}
      </button>
      <p className="hint">Jendela Meta akan terbuka. Jangan tutup halaman ini sampai selesai.</p>
    </div>
  );
}

export function ManualConnectForm() {
  const [state, action] = useActionState<FormState, FormData>(connectWhatsAppManual, {});
  useResultToast(state);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label htmlFor="m-name" className="label">Nama inbox (opsional)</label>
        <input id="m-name" name="name" className="field" maxLength={60} />
      </div>
      <div>
        <label htmlFor="m-pn" className="label">Phone number ID</label>
        <input id="m-pn" name="phone_number_id" className="field font-mono" inputMode="numeric" required />
      </div>
      <div>
        <label htmlFor="m-waba" className="label">WhatsApp Business Account ID</label>
        <input id="m-waba" name="waba_id" className="field font-mono" inputMode="numeric" required />
      </div>
      <div>
        <label htmlFor="m-token" className="label">Access token</label>
        <input id="m-token" name="token" type="password" className="field font-mono" autoComplete="off" required />
        <p className="hint">Disimpan terenkripsi di server dan tidak pernah ditampilkan lagi.</p>
      </div>
      <SubmitButton pending="Memverifikasi…" className="btn btn-secondary">Hubungkan</SubmitButton>
    </form>
  );
}
