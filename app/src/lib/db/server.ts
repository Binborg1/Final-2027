import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/types";
import { publicEnv } from "@/lib/env";

/**
 * Supabase on the server, acting as the teacher who sent the request: it reads
 * their session from the request cookies, so row-level security applies exactly
 * as in the browser. Create one per request (Server Components, Route Handlers,
 * Server Functions); never share it between requests.
 */
export async function serverClient() {
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies. Refreshing the session cookie is
          // the proxy's job (added with teacher sign-in), so nothing is lost here.
        }
      },
    },
  });
}
