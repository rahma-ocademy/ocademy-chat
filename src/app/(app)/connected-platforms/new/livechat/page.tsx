import type { Metadata } from "next";
import { isAdmin, requireContext } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/page";
import { CreateLivechatForm } from "../../forms";

export const metadata: Metadata = { title: "Web Live Chat" };

export default async function NewLivechatPage() {
  const ctx = await requireContext();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader nav="/connected-platforms" back={{ href: "/connected-platforms/new", label: "Pilih platform" }} title="Web Live Chat" description="Widget chat untuk situs Anda. Setelah dibuat, Anda mendapat link widget dan kode sematan." />
      <section className="card p-6">
        {isAdmin(ctx) ? <CreateLivechatForm /> : <Notice tone="info">Hanya owner/admin yang bisa membuat inbox.</Notice>}
      </section>
    </div>
  );
}
