import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * A student's private token for one session. Joining returns
 * "<participant id>.<secret>"; only the SHA-256 of the secret is stored, and it is
 * compared in constant time. The phone sends it in a header on every request.
 */

export const TOKEN_HEADER = "x-funza-token";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SECRET = /^[A-Za-z0-9_-]{32,64}$/;

export const hashSecret = (secret: string) => createHash("sha256").update(secret, "utf8").digest("hex");

export function newSecret(): { secret: string; hash: string } {
  const secret = randomBytes(32).toString("base64url");
  return { secret, hash: hashSecret(secret) };
}

export function tokenMatches(storedHash: string, secret: string | null | undefined): boolean {
  if (!secret) return false;
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const formatToken = (participantId: string, secret: string) => `${participantId}.${secret}`;

export function parseToken(header: string | null | undefined): { participantId: string; secret: string } | null {
  if (!header || header.length > 200) return null;
  const dot = header.indexOf(".");
  if (dot < 0) return null;
  const participantId = header.slice(0, dot).toLowerCase();
  const secret = header.slice(dot + 1);
  return UUID.test(participantId) && SECRET.test(secret) ? { participantId, secret } : null;
}
