import type { Metadata } from "next";
import { Suspense } from "react";
import { MetaCallback } from "./callback";

export const metadata: Metadata = { title: "Menghubungkan Meta", robots: { index: false } };

/**
 * Redirect URI untuk Facebook Login for Business (Meta App → Valid OAuth Redirect URIs).
 * Embedded Signup memakai popup JS SDK sehingga biasanya tidak mendarat di sini; halaman ini cadangan
 * bila Meta mengarahkan ke redirect URI (mis. alur tanpa popup atau pembatalan).
 */
export default function MetaCallbackPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <Suspense fallback={<div className="card skeleton h-48" aria-hidden="true" />}>
        <MetaCallback />
      </Suspense>
    </main>
  );
}
