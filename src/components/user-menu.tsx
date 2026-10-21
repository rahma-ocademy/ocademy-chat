import { requireContext } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";
import { BusinessSwitcher } from "@/components/business-switcher";

/** Membaca sesi (request-time) → selalu dirender di dalam <Suspense>. */
export async function UserMenu() {
  const { supabase, user, businessId, businessIds } = await requireContext();
  const { data: businesses } = await supabase.from("businesses").select("id, name").in("id", businessIds);
  const biz = businesses?.find((b) => b.id === businessId);
  const initial = (biz?.name ?? user.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {businesses && businesses.length > 1 && (
        <BusinessSwitcher current={businessId} options={businesses.map((b) => ({ id: b.id as string, name: b.name as string }))} />
      )}
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
