import type { Metadata } from "next";
import { logout } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Akses dinonaktifkan", robots: { index: false } };

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <section className="card flex flex-col gap-4 p-7">
        <h1 className="text-2xl font-bold text-navy">Akses Anda dinonaktifkan</h1>
        <p className="text-sm leading-relaxed text-muted">
          Akun Anda sudah tidak aktif di bisnis mana pun di ocademy chat. Hubungi admin bisnis Anda bila ini keliru.
        </p>
        <form action={logout}>
          <button type="submit" className="btn btn-secondary w-full">Keluar</button>
        </form>
      </section>
    </main>
  );
}
