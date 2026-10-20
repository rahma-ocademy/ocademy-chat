import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Data Access Layer: satu pintu untuk "siapa yang login dan bisnis mana yang aktif".
 * Dipanggil di dalam <Suspense> (pembacaan sesi = request-time). Query lanjutan memakai
 * klien `supabase` ini sehingga RLS yang menegakkan isolasi antar bisnis.
 */
export async function requireContext() {
  await connection();
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("business_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let businessId = membership?.business_id as string | undefined;
  let role = (membership?.role as string | undefined) ?? "owner";

  if (!businessId) {
    // Pendaftaran dengan konfirmasi email belum punya sesi saat signUp, jadi bisnis dibuat di login pertama.
    const name = typeof user.user_metadata?.business_name === "string" ? user.user_metadata.business_name : "";
    const { data: id, error } = await supabase.rpc("bootstrap_business", { p_name: name });
    if (error || !id) throw new Error(`Gagal membuat bisnis: ${error?.message ?? "tanpa id"}`);
    businessId = id as string;
    role = "owner";
  }
  return { supabase, user, businessId, role };
}
