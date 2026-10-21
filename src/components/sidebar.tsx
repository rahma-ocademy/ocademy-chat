"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/chat", label: "Inbox" },
  { href: "/inboxes", label: "Channel" },
  { href: "/followups", label: "Followups" },
  { href: "/templates", label: "Template" },
  { href: "/integrations", label: "Integrasi & API" },
  { href: "/usage", label: "Usage & paket" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside aria-label="Menu" className="card w-full shrink-0 py-3 md:w-60">
      <p className="px-5 py-2 text-xs font-bold tracking-wider text-muted uppercase">Chat</p>
      <nav className="flex flex-col">
        {ITEMS.map((i) => {
          const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "border-l-[3px] border-navy bg-tint py-3 pr-5 pl-[17px] text-[15px] font-bold text-navy"
                  : "py-3 pr-5 pl-5 text-[15px] text-ink transition hover:bg-bg"
              }
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
