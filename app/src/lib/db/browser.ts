import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import { publicEnv } from "@/lib/env";

/**
 * Supabase in the browser: the publishable key plus the teacher's session cookie.
 * Row-level security limits it to the signed-in teacher's own rows, and without a
 * session it can read nothing. Use it in Client Components only.
 */
export function browserClient() {
  const env = publicEnv();
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
