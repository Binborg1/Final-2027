import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/db/types";
import { publicEnv } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] };

/**
 * Supabase in a Route Handler, acting as the teacher who sent the request. It
 * reads the session from the request's cookies (not `next/headers`), and keeps
 * any cookies Supabase refreshes so the handler can put them on its response with
 * `respond(res)`. Create one per request.
 */
export function routeClient(request: NextRequest) {
  const env = publicEnv();
  let pending: CookieToSet[] = [];
  let headers: Record<string, string> = {};
  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        const names = new Set(cookiesToSet.map((c) => c.name));
        pending = [...pending.filter((c) => !names.has(c.name)), ...cookiesToSet];
        headers = { ...headers, ...cacheHeaders };
      },
    },
  });
  return {
    supabase,
    /** Copies the refreshed or cleared auth cookies (and their no-cache headers) onto a response. */
    respond<T extends NextResponse>(res: T): T {
      for (const { name, value, options } of pending) res.cookies.set(name, value, options);
      for (const [key, value] of Object.entries(headers)) res.headers.set(key, value);
      return res;
    },
  };
}
