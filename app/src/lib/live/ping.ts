import "server-only";
import { after } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Realtime pings. After each change the server tells everyone listening that
 * something changed; the ping carries only the session's revision number, never a
 * question, an answer or a name. Anyone holding the publishable key can send on a
 * public channel, but a fake ping only makes screens ask the server again.
 *
 * Two topics, both named by the session's random id (never the join code):
 * - "state" (live:<id>): phones, the console and the projector;
 * - "teacher" (live:<id>:teacher): answers, the roster, marks and the projector's
 *   step, for the console and the projector only, so 40 phones aren't woken by
 *   every answer.
 */

export type Topic = "state" | "teacher";
export type Ping = (sessionId: string, topic: Topic, event: string, rev?: number) => void;

export const topicOf = (sessionId: string, topic: Topic) => (topic === "state" ? `live:${sessionId}` : `live:${sessionId}:teacher`);

/** Sends one ping; never throws (a missed ping is covered by polling). */
export async function sendPing(sessionId: string, topic: Topic, event: string, rev = 0): Promise<void> {
  try {
    const env = publicEnv();
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: topicOf(sessionId, topic), event, payload: { r: rev }, private: false }] }),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) console.error(`Live ping failed: HTTP ${res.status}`);
    await res.body?.cancel();
  } catch (error) {
    console.error("Live ping failed:", error instanceof Error ? error.message : "unknown error");
  }
}

/** Runs work after the response is sent (Vercel keeps the function alive for it); outside a request, runs it now. */
export function defer(task: () => Promise<unknown>): void {
  try {
    after(task);
  } catch {
    void task().catch(() => {});
  }
}

/** The production ping: sent after the response, so the request isn't slowed. */
export const ping: Ping = (sessionId, topic, event, rev) => defer(() => sendPing(sessionId, topic, event, rev));
