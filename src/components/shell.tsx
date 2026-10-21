"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu, PanelLeftClose, PanelLeftOpen, Plus, X } from "lucide-react";
import { NAV, QUICK_CREATE, findNav, isActive } from "@/components/nav";
import { LegalFooter } from "@/components/legal-footer";

type Shell = { collapsed: boolean; closeMobile: () => void };
const ShellContext = createContext<Shell>({ collapsed: false, closeMobile: () => {} });
export const useShell = () => useContext(ShellContext);

const COLLAPSE_KEY = "ocademy_nav_collapsed";

/**
 * Kerangka aplikasi: sidebar (bisa diciutkan jadi rail ikon; drawer di layar kecil) + top bar + konten.
 * Tidak membaca pathname sendiri agar kerangka ini tetap bisa diprerender; bagian yang butuh path ada di
 * komponen kecil di bawah yang masing-masing dibungkus <Suspense> oleh layout.
 */
export function AppShell({
  nav,
  sidebarFooter,
  title,
  userMenu,
  children,
}: {
  nav: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  title: React.ReactNode;
  userMenu: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  // Preferensi hanya ada di browser; dibaca setelah mount supaya HTML server dan klien sama.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hanya tersedia di browser
      if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      /* penyimpanan diblokir: pakai default */
    }
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* abaikan */
      }
      return !c;
    });
  };

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <ShellContext.Provider value={{ collapsed, closeMobile }}>
      <div className="flex min-h-screen">
        {mobileOpen && (
          <button type="button" aria-label="Tutup menu" className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-[2px] md:hidden" onClick={closeMobile} />
        )}
        <aside
          ref={drawerRef}
          id="app-sidebar"
          aria-label="Menu utama"
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line-soft bg-surface md:bg-surface/95 md:backdrop-blur transition-[transform,width] duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${
            mobileOpen ? "translate-x-0 shadow-[var(--shadow-pop)]" : "-translate-x-full"
          } ${collapsed ? "md:w-[76px]" : "md:w-64"}`}
        >
          <div className={`flex h-16 shrink-0 items-center gap-2 border-b border-line-soft ${collapsed ? "md:justify-center md:px-0" : ""} px-5`}>
            <Link href="/chat" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent" onClick={closeMobile}>
              <span aria-hidden="true" className="bg-brand-gradient flex size-9 items-center justify-center rounded-xl text-lg font-bold text-white shadow-[0_6px_16px_rgb(1_127_140/0.35)]">
                o
              </span>
              <span className={`flex items-baseline gap-1 ${collapsed ? "md:sr-only" : ""}`}>
                <span className="text-[19px] font-bold text-navy">ocademy</span>
                <span className="text-sm font-semibold text-brand">chat</span>
              </span>
            </Link>
            <button type="button" className="btn btn-ghost btn-sm ml-auto !px-2 md:hidden" aria-label="Tutup menu" onClick={closeMobile}>
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>

          {/* Saat diciutkan, overflow dibiarkan terlihat supaya tooltip ikon tidak terpotong. */}
          <div className={`min-h-0 flex-1 overflow-y-auto px-3 py-4 ${collapsed ? "md:overflow-visible" : ""}`}>{nav}</div>

          {sidebarFooter && <div className={`shrink-0 px-3 pb-3 ${collapsed ? "md:hidden" : ""}`}>{sidebarFooter}</div>}

          <div className="hidden shrink-0 border-t border-line-soft p-3 md:block">
            <button
              type="button"
              onClick={toggle}
              className={`btn btn-ghost btn-sm w-full ${collapsed ? "!px-0" : "justify-start"}`}
              aria-expanded={!collapsed}
              aria-controls="app-sidebar"
              aria-label={collapsed ? "Lebarkan menu" : "Ciutkan menu"}
              data-tip={collapsed ? "Lebarkan menu" : undefined}
            >
              {collapsed ? <PanelLeftOpen aria-hidden="true" className="size-[18px]" /> : <PanelLeftClose aria-hidden="true" className="size-[18px]" />}
              {!collapsed && "Ciutkan menu"}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line-soft bg-surface/85 px-4 backdrop-blur md:px-6">
            <button
              type="button"
              className="btn btn-ghost btn-sm !px-2 md:hidden"
              aria-label="Buka menu"
              aria-expanded={mobileOpen}
              aria-controls="app-sidebar"
              onClick={() => setMobileOpen(true)}
            >
              <Menu aria-hidden="true" className="size-5" />
            </button>
            <div className="min-w-0 flex-1">{title}</div>
            <QuickCreate />
            {userMenu}
          </header>
          <main id="konten" className="mx-auto w-full max-w-[1440px] min-w-0 flex-1 px-4 py-6 md:px-8">
            {children}
          </main>
          <LegalFooter className="px-4 pb-5" />
        </div>
      </div>
    </ShellContext.Provider>
  );
}

/** Daftar menu berikon dan berkelompok. `badges` diisi server (mis. jumlah belum dibaca). */
export function NavLinks({ badges }: { badges?: Record<string, number> }) {
  return <NavList pathname={usePathname()} badges={badges} />;
}

/** Tanpa hook: dipakai juga sebagai fallback <Suspense> saat path belum tersedia. */
export function NavList({ pathname, badges }: { pathname: string; badges?: Record<string, number> }) {
  const { collapsed, closeMobile } = useShell();
  return (
    <nav className="flex flex-col gap-5">
      {NAV.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-1">
          {g.label && (
            <p className={`px-3 pb-1 text-[11px] font-bold tracking-[0.08em] text-muted uppercase ${collapsed ? "md:sr-only" : ""}`}>{g.label}</p>
          )}
          {g.items.map((i) => {
            const active = isActive(pathname, i.href);
            const Icon = i.icon;
            const badge = badges?.[i.href] ?? 0;
            return (
              <Link
                key={i.href}
                href={i.href}
                onClick={closeMobile}
                aria-current={active ? "page" : undefined}
                data-tip={collapsed ? i.label : undefined}
                aria-label={collapsed ? (badge ? `${i.label}, ${badge} belum dibaca` : i.label) : undefined}
                className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent ${
                  collapsed ? "md:justify-center md:px-0" : ""
                } ${active ? "bg-brand-soft font-bold text-navy" : "text-ink hover:bg-bg hover:text-navy"}`}
              >
                {active && <span aria-hidden="true" className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-brand" />}
                <span className={`icon-tile icon-tile-sm tone-${i.tone} transition ${active ? "shadow-sm" : "opacity-90 group-hover:opacity-100"}`}>
                  <Icon aria-hidden="true" className="size-[18px]" strokeWidth={2.2} />
                </span>
                <span className={`min-w-0 flex-1 truncate ${collapsed ? "md:sr-only" : ""}`}>{i.label}</span>
                {badge > 0 && (
                  <span
                    className={`rounded-full bg-brand px-1.5 py-0.5 text-[11px] leading-none font-bold text-white ${
                      collapsed ? "md:absolute md:top-1 md:right-2" : ""
                    }`}
                    aria-label={collapsed ? undefined : `${badge} belum dibaca`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Judul halaman aktif di top bar: "Otomasi / Follow-up otomatis". */
export function TopTitle() {
  return <TopTitleView pathname={usePathname()} />;
}

export function TopTitleView({ pathname }: { pathname: string }) {
  const hit = findNav(pathname);
  if (!hit) return <span className="text-[15px] font-bold text-navy">ocademy chat</span>;
  const Icon = hit.item.icon;
  return (
    <p className="flex min-w-0 items-center gap-2.5">
      <span className={`icon-tile icon-tile-sm tone-${hit.item.tone} hidden sm:inline-flex`}>
        <Icon aria-hidden="true" className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        {hit.group && <span className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{hit.group}</span>}
        <span className="truncate text-[15px] font-bold text-navy">{hit.item.label}</span>
      </span>
    </p>
  );
}

/** Dropdown ringan: tutup saat klik di luar, Esc, atau memilih item. */
export function Dropdown({
  label,
  trigger,
  triggerClassName = "btn btn-ghost btn-sm",
  align = "right",
  children,
}: {
  label: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" className={triggerClassName} aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          className={`rise absolute top-full z-50 mt-2 w-72 rounded-2xl border border-line-soft bg-surface p-2 shadow-[var(--shadow-pop)] ${align === "right" ? "right-0" : "left-0"}`}
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function QuickCreate() {
  return (
    <Dropdown
      label="Buat baru"
      triggerClassName="btn btn-primary btn-sm !px-3"
      trigger={
        <>
          <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
          <span className="hidden sm:inline">Baru</span>
          <ChevronDown aria-hidden="true" className="hidden size-4 opacity-80 sm:inline" />
        </>
      }
    >
      <p className="px-3 pt-1 pb-2 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">Buat baru</p>
      <ul>
        {QUICK_CREATE.map((q) => {
          const Icon = q.icon;
          return (
            <li key={q.href}>
              <Link href={q.href} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold text-navy transition hover:bg-bg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent">
                <span className={`icon-tile icon-tile-sm tone-${q.tone}`}>
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                {q.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </Dropdown>
  );
}
