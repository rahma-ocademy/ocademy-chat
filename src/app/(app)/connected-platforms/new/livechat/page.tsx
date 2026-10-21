import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin, requireContext } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/page";
import { CreateLivechatForm } from "../../forms";

export const metadata: Metadata = { title: "Web Live Chat" };

export default async function NewLivechatPage() {
  const ctx = await requireContext();
  return (
    <div className="flex flex-col gap-6">
      <Link href="/connected-platforms/new" className="text-sm font-semibold text-brand hover:underline">← Pilih platform</Link>
      <PageHeader title="Web Live Chat" description="Widget chat untuk situs Anda. Setelah dibuat, Anda mendapat link widget dan kode sematan." />
      <section className="card p-6">
        {isAdmin(ctx) ? <CreateLivechatForm /> : <Notice tone="info">Hanya owner/admin yang bisa membuat inbox.</Notice>}
      </section>
    </div>
  );
}
