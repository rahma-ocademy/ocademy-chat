"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * Menyegarkan inbox saat ada pesan/percakapan baru (Supabase Realtime, RLS berlaku).
 * Bila Realtime tidak tersedia (mis. tabel belum masuk publikasi), jatuh ke polling 10 detik.
 */
export function Realtime({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [live, setLive] = useState<"connecting" | "live" | "polling">("connecting");

  useEffect(() => {
    const sb = getBrowserSupabase();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const channel = sb
      .channel(`inbox:${businessId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `business_id=eq.${businessId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `business_id=eq.${businessId}` }, refresh)
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setLive("live");
          clearInterval(poll);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setLive("polling");
          clearInterval(poll);
          poll = setInterval(() => router.refresh(), 10_000);
        }
      });
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      void sb.removeChannel(channel);
    };
  }, [businessId, router]);

  const text = live === "live" ? "Realtime aktif" : live === "polling" ? "Menyegarkan tiap 10 detik" : "Menghubungkan…";
  return (
    <p
      className="flex items-center gap-2 border-t border-line-soft px-4 py-2 text-[11px] font-semibold text-muted"
      role="status"
      title={live === "polling" ? "Realtime tidak tersedia, inbox disegarkan tiap 10 detik" : undefined}
    >
      <span aria-hidden="true" className="relative flex size-2">
        {live === "live" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />}
        <span className={`relative inline-flex size-2 rounded-full ${live === "live" ? "bg-accent" : live === "polling" ? "bg-[#E0A100]" : "bg-line"}`} />
      </span>
      {text}
    </p>
  );
}
