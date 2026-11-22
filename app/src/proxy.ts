import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routeKind } from "@/lib/auth/routes";
import { publicEnv } from "@/lib/env";

/**
 * Runs before every page and API request (static files excluded below):
 * 1. Refreshes the Supabase session cookie when the access token is about to expire.
 * 2. Sends a signed-out visitor on a teacher page to sign-in (an optimistic check
 *    from the cookie only). The real check is in each page, Server Function and API
 *    route (`lib/auth/`); API routes are never redirected here, they answer 401.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = publicEnv();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Verifies the token and refreshes it if needed; nothing should run between
  // creating the client and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = typeof data?.claims?.sub === "string";

  if (!signedIn && routeKind(request.nextUrl.pathname) === "teacher-page") {
    const url = new URL("/sign-in", request.url);
    const back = request.nextUrl.pathname + request.nextUrl.search;
    if (back !== "/") url.searchParams.set("next", back);
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|brand/|backgrounds/|pdf\\.worker\\.min\\.mjs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|map|webmanifest)$).*)",
  ],
};
