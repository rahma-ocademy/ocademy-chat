import { requireContext } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";

/** Membaca sesi (request-time) → selalu dirender di dalam <Suspense>. */
export async function UserMenu() {
  const { supabase, user, businessId } = await requireContext();
  const { data: biz } = await supabase.from("businesses").select("name").eq("id", businessId).maybeSingle();
  const initial = (biz?.name ?? user.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-bold text-navy">{biz?.name ?? "Bisnis saya"}</p>
        <p className="text-xs text-muted">{user.email}</p>
      </div>
      <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-navy text-base font-bold text-white">
        {initial}
      </span>
      <form action={logout}>
        <button type="submit" className="btn btn-ghost btn-sm">Keluar</button>
      </form>
    </div>
  );
}
