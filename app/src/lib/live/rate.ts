import { createHash } from "node:crypto";

/**
 * Rate limits for the public live endpoints (requirements §12), counted in
 * Postgres by rate_hit(). Keys are hashed, so no network address or token is
 * stored. If the counter can't be reached, the request is allowed: a database
 * hiccup must not lock a class out mid-quiz.
 */

export const RATES = {
  /** Join attempts per phone (its random device id). */
  joinDevice: 10,
  /** Join attempts per network address: a class of 30 behind one school address stays well under it. */
  joinIp: 100,
  /** Answer saves per student token. */
  answer: 60,
  /** State fetches per student token: the 2-second polling fallback is 30. */
  state: 60,
} as const;

export type RateKind = keyof typeof RATES;
export const WINDOW_S = 60;

export const rateKey = (kind: RateKind, subject: string) => `${kind}:${createHash("sha256").update(subject, "utf8").digest("hex").slice(0, 32)}`;

/** The caller's network address as Vercel reports it, else "unknown" (local development). */
export function clientAddress(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 64) : "unknown";
}

/** Seconds until the current window ends. */
export const retryAfter = (now: number, windowS = WINDOW_S) => Math.max(1, Math.ceil(windowS - ((now / 1000) % windowS)));

export type RateHit = (key: string, limit: number) => Promise<boolean>;

/** True when the request may go ahead. */
export async function allowed(hit: RateHit, kind: RateKind, subject: string, log: (m: string) => void = console.error): Promise<boolean> {
  try {
    return await hit(rateKey(kind, subject), RATES[kind]);
  } catch (error) {
    log(`Rate limit check failed (${kind}): ${error instanceof Error ? error.message : "unknown error"}`);
    return true;
  }
}
