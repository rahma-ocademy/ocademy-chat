import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { EmptyState } from "@/components/page";
import { Wizard, type TemplateOption } from "./wizard";

export const metadata: Metadata = { title: "Buat follow-up" };

export default async function NewFollowupPage() {
  const { supabase, businessId } = await requireContext();
  const { data } = await supabase
    .from("followup_templates")
    .select("id, name, category, source")
    .eq("business_id", businessId)
    .eq("status", "active")
    .order("name");
  const templates = (data ?? []) as TemplateOption[];

  if (templates.length === 0) {
    return (
      <div className="card">
        <EmptyState
          title="Buat template dulu"
          text="Aturan follow-up memakai template pesan. Buat satu template, atau impor dari OrderOnline."
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <Link href="/templates" className="btn btn-primary">Buat template</Link>
              <Link href="/integrations/orderonline" className="btn btn-secondary">Hubungkan OrderOnline</Link>
            </div>
          }
        />
      </div>
    );
  }
  return <Wizard templates={templates} />;
}
