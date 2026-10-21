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

  return (
    <p className="flex items-center gap-2 self-end text-xs text-muted" role="status">
      <span aria-hidden="true" className={`size-2 rounded-full ${live === "live" ? "bg-ok" : live === "polling" ? "bg-warn" : "bg-line"}`} />
      {live === "live" ? "Realtime aktif" : live === "polling" ? "Realtime tidak tersedia — menyegarkan tiap 10 detik" : "Menghubungkan…"}
    </p>
  );
}
