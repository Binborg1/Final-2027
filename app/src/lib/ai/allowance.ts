import "server-only";
import { adminClient } from "@/lib/db/admin";
import { serverEnvSchema } from "@/lib/env-server";

/**
 * The daily AI allowance (FR-30). Each teacher gets FUNZA_AI_DAILY_LIMIT AI
 * actions a day (40 when unset). Every successful AI call is one row in
 * `ai_usage`, written with the secret key because teachers can only read their
 * rows. A day starts at midnight in Saskatchewan, which is UTC−6 all year.
 */

export const DEFAULT_DAILY_LIMIT = 40;

/** Read on each call, like the AI settings. A malformed value stops the server at start-up (instrumentation.ts); here it falls back to the default. */
export function dailyLimit(): number {
  const raw = process.env.FUNZA_AI_DAILY_LIMIT;
  if (!raw?.trim()) return DEFAULT_DAILY_LIMIT;
  const parsed = serverEnvSchema.shape.FUNZA_AI_DAILY_LIMIT.safeParse(raw);
  return parsed.success && parsed.data ? parsed.data : DEFAULT_DAILY_LIMIT;
}

const SASKATCHEWAN_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The last midnight in Saskatchewan (UTC−6, no daylight saving time) at or before `now`. */
export function startOfDaySaskatchewan(now: Date): Date {
  const local = now.getTime() - SASKATCHEWAN_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS + SASKATCHEWAN_OFFSET_MS);
}

/** How many AI actions the teacher has used since midnight. Throws when the database can't answer. */
export async function usedToday(teacherId: string, now = new Date()): Promise<number> {
  const { count, error } = await adminClient()
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .gte("created_at", startOfDaySaskatchewan(now).toISOString());
  if (error) throw new Error(`Could not count today's AI usage: ${error.message}`);
  return count ?? 0;
}

/** AI actions left today (never below 0), or null when the database can't say. */
export async function remainingToday(teacherId: string): Promise<number | null> {
  try {
    return Math.max(0, dailyLimit() - (await usedToday(teacherId)));
  } catch (error) {
    console.error("AI allowance check failed:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

export type Usage = { teacherId: string; task: string; model: string; tokensIn: number; tokensOut: number };

/** The table's checks: task 1–100 characters, model 1–200, token counts whole and not negative. */
const text = (s: string, max: number) => s.slice(0, max) || "unknown";
const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 2_147_483_647) : 0);

/** Logs one AI call. Never throws: the teacher already has their reply, so a failed log is only reported on the server. */
export async function recordUsage({ teacherId, task, model, tokensIn, tokensOut }: Usage): Promise<void> {
  try {
    const { error } = await adminClient()
      .from("ai_usage")
      .insert({ teacher_id: teacherId, task: text(task, 100), model: text(model, 200), tokens_in: whole(tokensIn), tokens_out: whole(tokensOut) });
    if (error) console.error("Could not log AI usage:", error.message);
  } catch (error) {
    console.error("Could not log AI usage:", error instanceof Error ? error.message : "unknown error");
  }
}

/** What a teacher reads when the allowance is used up: how many, and when it resets. */
export function allowanceMessage(limit: number): string {
  return `You’ve used today’s ${limit} Funza actions. They reset at midnight, Saskatchewan time.`;
}
