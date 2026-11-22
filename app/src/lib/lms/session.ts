import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * The Google Classroom connection: OAuth tokens live in an encrypted, httpOnly
 * cookie scoped to /api/lms/google. The browser can neither read nor change them;
 * only this server, holding FUNZA_SESSION_SECRET, can. The signed-in teacher's id
 * is sealed in with the tokens, and the cookie is refused for anyone else, so the
 * next teacher on a shared school computer doesn't inherit the connection.
 * Release 2 moves the tokens to the encrypted google_connections table.
 */

export const TOKEN_COOKIE = "funza_gc";
export const STATE_COOKIE = "funza_gc_state";
export const COOKIE_PATH = "/api/lms/google";

export type GoogleConfig = { clientId: string; clientSecret: string; secret: string };
export type GoogleTokens = { rt: string | null; at: string; exp: number };

/** Null unless the server has a Google OAuth client and a session secret of at least 32 characters. */
export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const secret = process.env.FUNZA_SESSION_SECRET?.trim();
  if (!clientId || !clientSecret || !secret || secret.length < 32) return null;
  return { clientId, clientSecret, secret };
}

const keyOf = (secret: string) => createHash("sha256").update(`funza-lms:${secret}`, "utf8").digest();

export function seal(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyOf(secret), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
}

export function unseal<T>(sealed: string | undefined, secret: string): T | null {
  if (!sealed) return null;
  try {
    const buf = Buffer.from(sealed, "base64url");
    if (buf.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyOf(secret), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

/** The token cookie's contents: Google's tokens plus the id of the teacher they belong to. */
type SealedTokens = GoogleTokens & { tid: string };

/** Seals Google's tokens for one teacher. */
export function sealTokens(tokens: GoogleTokens, teacherId: string, secret: string): string {
  const { rt, at, exp } = tokens;
  return seal({ rt, at, exp, tid: teacherId } satisfies SealedTokens, secret);
}

/** The tokens in the cookie, only if they belong to this teacher. A cookie from before teacher sign-in (no id) is refused too. */
export function tokensFor(sealed: string | undefined, teacherId: string, secret: string): GoogleTokens | null {
  const t = unseal<Partial<SealedTokens>>(sealed, secret);
  if (!t || typeof t.tid !== "string" || t.tid !== teacherId || typeof t.at !== "string" || typeof t.exp !== "number") return null;
  return { rt: typeof t.rt === "string" ? t.rt : null, at: t.at, exp: t.exp };
}

/** The consent round trip: a nonce, where to return, when it started, and which teacher started it. */
export type ConnectState = { n: string; r: string; t: number; tid: string };

export function cookieOptions(requestUrl: string, maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: new URL(requestUrl).protocol === "https:", path: COOKIE_PATH, maxAge };
}

/** Only same-site paths are allowed as a place to return to after Google. */
export { safeReturn } from "@/lib/auth/redirect";

export const newNonce = () => randomBytes(18).toString("base64url");
