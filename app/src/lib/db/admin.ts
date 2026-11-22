import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { serverEnv } from "@/lib/env-server";

/**
 * Supabase with the secret key. It bypasses row-level security, so it is for the
 * few writes no teacher session can make: students (who have no account) joining
 * and answering, AI usage rows, and scheduled work. Every caller must check who
 * is asking before using it. Server only: a browser import fails the build.
 */
let client: SupabaseClient<Database> | null = null;

export function adminClient(): SupabaseClient<Database> {
  if (client) return client;
  const env = serverEnv();
  client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
