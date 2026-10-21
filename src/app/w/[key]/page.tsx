import type { Metadata } from "next";
import { Suspense } from "react";
import { LivechatWidget } from "./widget";

export const metadata: Metadata = { title: "Chat", robots: { index: false } };

export default function WidgetPage({ params }: { params: Promise<{ key: string }> }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col p-3 sm:p-6">
      <Suspense fallback={<div className="card flex-1 animate-pulse" aria-hidden="true" />}>
        <LivechatWidget params={params} />
      </Suspense>
    </main>
  );
}
