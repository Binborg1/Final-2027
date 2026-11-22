/**
 * Where a teacher may be sent back to after signing in or connecting Classroom.
 * Only paths on this site are allowed: anything that a browser could read as
 * another host ("//evil", "/\evil", encoded or with control characters) falls
 * back to the default. Shared by the browser (sign-in page) and the server.
 */

const BASE = "http://funza.invalid";
const CONTROL = /[\u0000-\u001f\u007f]/;

/** A same-site path, or "/" (used for the Classroom return path). */
export function safeReturn(path: unknown): string {
  if (typeof path !== "string" || path.length === 0 || path.length > 300) return "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || CONTROL.test(path)) return "/";
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return "/";
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || CONTROL.test(decoded)) return "/";
  try {
    if (new URL(path, BASE).origin !== BASE) return "/";
  } catch {
    return "/";
  }
  return path;
}

/** Where to land after signing in: a same-site path that isn't the sign-in flow itself. */
export function safeNext(path: unknown): string {
  const p = safeReturn(path);
  const bare = p.split(/[?#]/)[0];
  if (bare === "/sign-in" || bare === "/auth" || bare.startsWith("/auth/") || bare.startsWith("/api/")) return "/";
  return p;
}
