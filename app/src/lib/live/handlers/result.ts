import type { Ping } from "@/lib/live/ping";
import { lazyClose } from "@/lib/live/state";
import type { LiveStore } from "@/lib/live/store";
import type { LiveSession } from "@/lib/live/types";

/**
 * What a live handler returns: a status and a JSON body in the API's usual shape
 * ({ok: true, data} or {ok: false, reason, message}). Route files turn it into a
 * response; tests read it directly.
 */

export type Result = { status: number; body: { ok: true; data: unknown } | { ok: false; reason: string; message: string; data?: unknown }; headers?: Record<string, string> };

export const ok = (data: unknown): Result => ({ status: 200, body: { ok: true, data } });
export const err = (status: number, reason: string, message: string, extra: { headers?: Record<string, string>; data?: unknown } = {}): Result => ({
  status,
  body: extra.data === undefined ? { ok: false, reason, message } : { ok: false, reason, message, data: extra.data },
  headers: extra.headers,
});

export type Deps = { store: LiveStore; now: () => number; ping: Ping };

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads a session and, if it is open past its time with nobody to close it,
 * closes it (the first request after the end time does it) and pings everyone.
 */
export async function currentSession(deps: Deps, id: string): Promise<LiveSession | null> {
  const s = await deps.store.session(id);
  if (!s) return null;
  const close = lazyClose(s, deps.now());
  if (!close) return s;
  const updated = await deps.store.updateSession(id, close.expect, close.patch);
  if (updated) {
    deps.ping(id, "state", "closed", updated.rev);
    deps.ping(id, "teacher", "closed", updated.rev);
    return updated;
  }
  return (await deps.store.session(id)) ?? s;
}

export const conflict = () => err(409, "conflict", "This session just changed on another screen. Try again.");
