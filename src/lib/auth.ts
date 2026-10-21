import "server-only";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { atLeast, isAdminRole, levelOf, parsePermissions, type Level, type PermissionKey, type Permissions, type Role } from "@/lib/team/permissions";

/** Cookie bisnis aktif (pengguna bisa menjadi anggota beberapa bisnis lewat undangan). */
export const ACTIVE_BUSINESS_COOKIE = "ocb";

export type Context = Awaited<ReturnType<typeof requireContext>>;

/**
 * Data Access Layer: satu pintu untuk "siapa yang login, bisnis mana yang aktif, dan apa perannya".
 * Dipanggil di dalam <Suspense> (pembacaan sesi = request-time). Query lanjutan memakai
 * klien `supabase` ini sehingga RLS yang menegakkan isolasi antar bisnis.
 */
export async function requireContext() {
  await connection();
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("memberships")
    .select("business_id, role, status, permissions")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Gagal memuat keanggotaan: ${error.message}`);

  const all = (rows ?? []).map((r) => ({
    businessId: r.business_id as string,
    role: r.role as Role,
    status: r.status as "active" | "deactivated",
    permissions: parsePermissions(r.permissions),
  }));
  const memberships = all.filter((m) => m.status === "active");

  // Punya keanggotaan tapi semuanya dinonaktifkan: jangan buatkan bisnis baru diam-diam.
  if (all.length > 0 && memberships.length === 0) redirect("/no-access");

  if (memberships.length === 0) {
    // Pendaftaran dengan konfirmasi email belum punya sesi saat signUp, jadi bisnis dibuat di login pertama.
    const name = typeof user.user_metadata?.business_name === "string" ? user.user_metadata.business_name : "";
    const { data: id, error: bootErr } = await supabase.rpc("bootstrap_business", { p_name: name });
    if (bootErr || !id) throw new Error(`Gagal membuat bisnis: ${bootErr?.message ?? "tanpa id"}`);
    memberships.push({ businessId: id as string, role: "owner", status: "active", permissions: parsePermissions(null) });
  }

  const wanted = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
  const active = memberships.find((m) => m.businessId === wanted) ?? memberships[0];

  return {
    supabase,
    user,
    businessId: active.businessId,
    role: active.role,
    permissions: active.permissions as Permissions,
    businessIds: memberships.map((m) => m.businessId),
  };
}

export const isAdmin = (ctx: Pick<Context, "role">) => isAdminRole(ctx.role);

export const hasPermission = (ctx: Pick<Context, "role" | "permissions">, key: PermissionKey, need: Level) =>
  atLeast(levelOf(ctx.role, ctx.permissions, key), need);
