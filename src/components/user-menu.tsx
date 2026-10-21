import Link from "next/link";
import { ChevronDown, Gauge, LogOut, Users } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";
import { BusinessSwitcher } from "@/components/business-switcher";
import { Dropdown } from "@/components/shell";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", agent: "Agen" };

/** Membaca sesi (request-time) → selalu dirender di dalam <Suspense>. */
export async function UserMenu() {
  const { supabase, user, businessId, businessIds, role } = await requireContext();
  const { data: businesses } = await supabase.from("businesses").select("id, name").in("id", businessIds);
  const biz = businesses?.find((b) => b.id === businessId);
  const bizName = (biz?.name as string | undefined) ?? "Bisnis saya";
  const initial = (bizName || user.email || "?").slice(0, 1).toUpperCase();

  return (
    <Dropdown
      label={`Akun: ${bizName}`}
      triggerClassName="flex items-center gap-2.5 rounded-xl p-1 pr-2 transition hover:bg-bg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent"
      trigger={
        <>
          <Avatar initial={initial} />
          <span className="hidden min-w-0 text-left lg:block">
            <span className="block max-w-[160px] truncate text-sm font-bold text-navy">{bizName}</span>
            <span className="block max-w-[160px] truncate text-xs text-muted">{user.email}</span>
          </span>
          <ChevronDown aria-hidden="true" className="size-4 text-muted" />
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-xl bg-bg p-3">
        <Avatar initial={initial} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-navy">{bizName}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
          <span className="badge badge-info mt-1 !py-0.5">{ROLE_LABEL[role] ?? role}</span>
        </div>
      </div>
      {businesses && businesses.length > 1 && (
        <div className="px-1 pt-3">
          <p className="mb-1.5 px-1 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">Ganti bisnis</p>
          <BusinessSwitcher current={businessId} options={businesses.map((b) => ({ id: b.id as string, name: b.name as string }))} />
        </div>
      )}
      <ul className="mt-2 border-t border-line-soft pt-2">
        <li>
          <Link href="/settings/users" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-bg hover:text-navy">
            <Users aria-hidden="true" className="size-4 text-muted" /> Tim & pengguna
          </Link>
        </li>
        <li>
          <Link href="/usage" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-bg hover:text-navy">
            <Gauge aria-hidden="true" className="size-4 text-muted" /> Paket & pemakaian
          </Link>
        </li>
        <li>
          <form action={logout}>
            <button type="submit" className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-bad hover:bg-bad-soft">
              <LogOut aria-hidden="true" className="size-4" /> Keluar
            </button>
          </form>
        </li>
      </ul>
    </Dropdown>
  );
}

function Avatar({ initial }: { initial: string }) {
  return (
    <span aria-hidden="true" className="bg-brand-gradient flex size-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-sm">
      {initial}
    </span>
  );
}
