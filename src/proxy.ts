import { createServerClient, type CookieOptions } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);
const DASHBOARD = new RegExp(`^/(${routing.locales.join("|")})/(student|agent|admin)(/|$)`);

// Adds the locale prefix and refreshes the Supabase session cookie.
// The redirect below only saves a round trip; dashboards check the role on the server (src/lib/auth.ts).
export async function proxy(request: NextRequest) {
  const refreshed: { name: string; value: string; options: CookieOptions }[] = [];
  let noCache: Record<string, string> = {};
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list, headers) {
          for (const c of list) {
            request.cookies.set(c.name, c.value);
            refreshed.push(c);
          }
          noCache = headers;
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims();

  const path = request.nextUrl.pathname.match(DASHBOARD);
  const response = path && !data?.claims ? NextResponse.redirect(new URL(`/${path[1]}/login`, request.url)) : intl(request);
  for (const { name, value, options } of refreshed) response.cookies.set(name, value, options);
  // A response that sets a session cookie must never be cached by a CDN.
  for (const [k, v] of Object.entries(noCache)) response.headers.set(k, v);
  return response;
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
