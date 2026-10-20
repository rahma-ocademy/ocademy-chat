import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const APP_PREFIXES = ["/followups", "/templates", "/integrations", "/usage"];
const AUTH_PAGES = ["/login", "/register"];

/**
 * Menyegarkan sesi Supabase dan melakukan pemeriksaan optimistis (redirect).
 * Otorisasi sebenarnya tetap ada di Data Access Layer (src/lib/auth.ts) dan RLS.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  if (!signedIn && APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (signedIn && AUTH_PAGES.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/followups";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // /api memakai autentikasinya sendiri (API key, secret webhook, CRON_SECRET), bukan sesi cookie.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
