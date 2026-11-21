/**
 * Cookie-authenticated POSTs must come from this site. Browsers send Origin on
 * every POST; when it is missing, only a same-origin Sec-Fetch-Site is accepted.
 * A malformed Origin (such as "null" from a sandboxed frame) is refused, not an error.
 */
export function sameOrigin(request: { headers: Headers; url: string }) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}
