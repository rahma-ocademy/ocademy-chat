import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

/** Klien atas nama pengguna yang login (RLS berlaku). Hanya di Server Component / Action / Route Handler. */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Dipanggil dari Server Component (cookie read-only). proxy.ts yang menyegarkan sesi.
          }
        },
      },
    },
  );
}

/** Klien service role: MELEWATI RLS. Hanya untuk kode server tepercaya (webhook, worker, API key). */
export function createSupabaseAdmin() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Admin = ReturnType<typeof createSupabaseAdmin>;
