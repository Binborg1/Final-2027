import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * The Google Classroom connection without accounts: OAuth tokens live in an
 * encrypted, httpOnly cookie scoped to /api/lms/google. The browser can neither
 * read nor change them; only this server, holding FUNZA_SESSION_SECRET, can.
 * When teacher accounts arrive (C03), the tokens move to the database.
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

export function cookieOptions(requestUrl: string, maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: new URL(requestUrl).protocol === "https:", path: COOKIE_PATH, maxAge };
}

/** Only same-site paths are allowed as a place to return to after Google. */
export function safeReturn(path: unknown): string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path.slice(0, 300) : "/integrations";
}

export const newNonce = () => randomBytes(18).toString("base64url");
