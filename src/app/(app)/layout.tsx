import { Suspense } from "react";
import { AppShell, NavList, TopTitle, TopTitleView } from "@/components/shell";
import { SetupProgress, SidebarNavWithData } from "@/components/sidebar-data";
import { UserMenu } from "@/components/user-menu";
import { PageSkeleton } from "@/components/page";

// Pembacaan sesi bersifat request-time: setiap bagian berdata dibungkus <Suspense> agar kerangka halaman
// (sidebar, top bar) tetap bisa diprerender dan hanya bagian berdata yang di-stream (Cache Components).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      nav={
        <Suspense fallback={<NavList pathname="" />}>
          <SidebarNavWithData />
        </Suspense>
      }
      sidebarFooter={
        <Suspense fallback={null}>
          <SetupProgress />
        </Suspense>
      }
      title={
        <Suspense fallback={<TopTitleView pathname="" />}>
          <TopTitle />
        </Suspense>
      }
      userMenu={
        <Suspense fallback={<div className="skeleton size-10 rounded-full" aria-hidden="true" />}>
          <UserMenu />
        </Suspense>
      }
    >
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </AppShell>
  );
}
