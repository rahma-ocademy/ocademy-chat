import { Suspense } from "react";
import { Sidebar, SidebarNav } from "@/components/sidebar";
import { UserMenu } from "@/components/user-menu";
import { PageSkeleton } from "@/components/page";

// Pembacaan sesi bersifat request-time: dibungkus <Suspense> agar kerangka halaman tetap bisa
// diprerender dan hanya bagian berdata yang di-stream (Cache Components).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line-soft bg-surface">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[22px] font-bold text-navy">ocademy</span>
            <span className="text-sm font-medium text-brand">chat</span>
          </div>
          <Suspense fallback={<div className="h-11 w-48" aria-hidden="true" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-start gap-6 px-6 py-6">
        <Suspense fallback={<SidebarNav pathname="" />}>
          <Sidebar />
        </Suspense>
        <main className="min-w-0 flex-[999_1_560px]">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
