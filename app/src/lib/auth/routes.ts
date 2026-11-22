/**
 * Which requests need a signed-in teacher. The proxy uses this for its optimistic
 * redirect; the real check is `requireTeacher()` (pages, Server Functions) and
 * `teacherForRequest()` (API routes), which every teacher route calls itself.
 *
 * - public: the sign-in flow, the student pages and two read-only APIs. Students
 *   never sign in. The curriculum API serves the published Saskatchewan
 *   curriculum (no teacher or student data) with a public cache header.
 * - api: every other API route. The proxy never redirects these; the route
 *   answers 401 itself.
 * - teacher-page: everything else.
 */

export type RouteKind = "public" | "teacher-page" | "api";

const PUBLIC_EXACT = new Set(["/sign-in", "/auth", "/join", "/play", "/c", "/api/health", "/api/curriculum"]);
const PUBLIC_PREFIXES = ["/auth/", "/join/", "/play/", "/c/", "/api/curriculum/"];

export function routeKind(pathname: string): RouteKind {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (PUBLIC_EXACT.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return "public";
  if (path === "/api" || path.startsWith("/api/")) return "api";
  return "teacher-page";
}
