import "server-only";
import { z } from "zod";
import { checkEnv, publicEnvSchema } from "@/lib/env";

/**
 * Server settings and secrets. `instrumentation.ts` checks them once when the
 * server starts, so a missing or malformed variable stops the deployment with a
 * list of names instead of failing later inside a request.
 *
 * Supabase is required. The AI key and Classroom are optional: without them Funza
 * still runs, and says that drafting or Classroom isn't set up.
 */

export const serverEnvSchema = publicEnvSchema
  .extend({
    SUPABASE_SECRET_KEY: z
      .string()
      .startsWith("sb_secret_", { error: "must be the sb_secret_… key (not the legacy service_role key)" }),
    GEMINI_API_KEY: z.string().optional(),
    FUNZA_AI_MODEL: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().endsWith(".apps.googleusercontent.com", { error: "must be an OAuth client ID" }).optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    FUNZA_SESSION_SECRET: z.string().min(32, { error: "must be at least 32 characters" }).optional(),
  })
  .superRefine((env, ctx) => {
    const classroom = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.FUNZA_SESSION_SECRET];
    if (classroom.some(Boolean) && !classroom.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message: "needs GOOGLE_CLIENT_SECRET and FUNZA_SESSION_SECRET too: set all three for Classroom, or none",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const NAMES = Object.keys(serverEnvSchema.shape) as (keyof ServerEnv)[];

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  cached ??= checkEnv(serverEnvSchema, Object.fromEntries(NAMES.map((name) => [name, process.env[name]])));
  return cached;
}
