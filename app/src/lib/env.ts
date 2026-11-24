import { z } from "zod";

/**
 * Environment variables, checked with Zod. A problem is reported by the variable's
 * name and what is wrong with it; a value never appears in a message or a log.
 *
 * This file holds only what browsers may see (NEXT_PUBLIC_*). Server settings and
 * secrets are checked in `env-server.ts`, which browsers can't import.
 */

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/, error: "must be the Supabase project URL" }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .startsWith("sb_publishable_", { error: "must be the sb_publishable_… key (not the legacy anon key)" }),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export class EnvError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Funza's environment variables need attention:\n${problems.map((p) => `- ${p}`).join("\n")}\nSee app/.env.example.`);
    this.name = "EnvError";
    this.problems = problems;
  }
}

/** Parses an environment against a schema. Empty values count as unset. */
export function checkEnv<T extends z.ZodType>(schema: T, source: Record<string, string | undefined>): z.infer<T> {
  const set = Object.fromEntries(Object.entries(source).filter(([, v]) => typeof v === "string" && v.trim() !== ""));
  const parsed = schema.safeParse(set);
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues.map((issue) => {
    const name = issue.path.map(String).join(".") || "environment";
    // A set value of the wrong type (a number setting that isn't a number) is malformed, not missing.
    return issue.code === "invalid_type" && !(name in set) ? `${name} is missing` : `${name} ${issue.message}`;
  });
  throw new EnvError(problems);
}

let cached: PublicEnv | null = null;

/** The public settings. Each NEXT_PUBLIC_ variable is named in full so Next can inline it into browser code. */
export function publicEnv(): PublicEnv {
  cached ??= checkEnv(publicEnvSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return cached;
}
