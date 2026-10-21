import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { countUnread, getSetupState } from "@/lib/inbox/queries";
import { NavLinks } from "@/components/shell";
import { setupSteps } from "@/components/setup-steps";

/** Menu dengan badge belum dibaca (request-time → selalu di dalam <Suspense>). */
export async function SidebarNavWithData() {
  const { supabase, businessId } = await requireContext();
  const unread = await countUnread(supabase, businessId);
  return <NavLinks badges={{ "/chat": unread }} />;
}

/** Kartu "Progres setup" di bawah sidebar; hilang setelah semua langkah selesai. */
export async function SetupProgress() {
  const { supabase, businessId } = await requireContext();
  const steps = setupSteps(await getSetupState(supabase, businessId));
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (!next) return null;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="rounded-2xl border border-[#CDEBEF] bg-[linear-gradient(160deg,#F2FAFB,#FFFFFF)] p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-navy">
        <Rocket aria-hidden="true" className="size-4 text-brand" />
        Progres setup
        <span className="ml-auto text-xs font-semibold text-muted">{done}/{steps.length}</span>
      </p>
      <div className="progress mt-2.5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progres setup">
        <span className="bg-brand-gradient" style={{ width: `${Math.max(pct, 6)}%` }} />
      </div>
      <Link href={next.href} className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-[#01606A] hover:underline">
        Berikutnya: {next.title}
        <ArrowRight aria-hidden="true" className="size-3.5" />
      </Link>
    </div>
  );
}
