import assert from "node:assert/strict";
import { test } from "node:test";
import { authUrl, googleErrorFrom, multipartDoc, postBody, SCOPES } from "@/lib/lms/google";
import { safeReturn, seal, unseal } from "@/lib/lms/session";

const SECRET = "a-test-secret-that-is-long-enough-123456";
const cfg = { clientId: "client-123.apps.googleusercontent.com", clientSecret: "shh", secret: SECRET };

test("the token cookie is encrypted and authenticated", () => {
  const sealed = seal({ at: "access", rt: "refresh", exp: 1 }, SECRET);
  assert.ok(!sealed.includes("access") && !sealed.includes("refresh"), "nothing readable in the cookie");
  assert.deepEqual(unseal(sealed, SECRET), { at: "access", rt: "refresh", exp: 1 });
  assert.equal(unseal(sealed, "another-secret-that-is-long-enough-000000"), null, "a different server secret cannot read it");
  const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
  assert.equal(unseal(tampered, SECRET), null, "a changed cookie is refused");
  assert.equal(unseal(undefined, SECRET), null);
});

test("only same-site paths are allowed after sign-in", () => {
  assert.equal(safeReturn("/resources/r-1/deliver"), "/resources/r-1/deliver");
  assert.equal(safeReturn("//evil.example/x"), "/integrations");
  assert.equal(safeReturn("https://evil.example"), "/integrations");
  assert.equal(safeReturn("/\\evil"), "/integrations");
  assert.equal(safeReturn(undefined), "/integrations");
});

test("the consent request asks for offline access and only the scopes Funza needs", () => {
  const url = new URL(authUrl(cfg, "https://funza.example/api/lms/google/callback", "nonce-1"));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "nonce-1");
  assert.equal(url.searchParams.get("response_type"), "code");
  const scopes = url.searchParams.get("scope")!.split(" ");
  assert.deepEqual(scopes, SCOPES);
  assert.ok(scopes.every((s) => !/roster|student-submissions|grades|drive$|drive\.readonly/.test(s)), "no roster, grade or full-Drive access");
});

test("posts attach the Doc view-only and are drafts unless asked otherwise", () => {
  const material = postBody({ kind: "material", title: "Quiz", description: "Do it", fileId: "file1", state: "DRAFT" });
  assert.deepEqual(material, { title: "Quiz", description: "Do it", materials: [{ driveFile: { driveFile: { id: "file1" }, shareMode: "VIEW" } }], state: "DRAFT" });
  const assignment = postBody({ kind: "assignment", title: "Quiz", description: "", fileId: "f", state: "PUBLISHED", topicId: "t1", scheduledTime: "2026-12-01T15:00:00.000Z" });
  assert.equal(assignment.workType, "ASSIGNMENT");
  assert.equal(assignment.topicId, "t1");
  assert.equal(assignment.scheduledTime, "2026-12-01T15:00:00.000Z");
});

test("the Drive upload converts HTML into a Google Doc", () => {
  const { body, contentType } = multipartDoc("Quiz (v1)", "<p>Hi</p>", "b1");
  assert.equal(contentType, "multipart/related; boundary=b1");
  assert.ok(body.startsWith("--b1\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"));
  assert.match(body, /"mimeType":"application\/vnd\.google-apps\.document"/);
  assert.match(body, /Content-Type: text\/html; charset=UTF-8\r\n\r\n<p>Hi<\/p>\r\n--b1--$/);
});

test("Google errors become reasons the teacher can act on", () => {
  assert.equal(googleErrorFrom(401, {}).reason, "expired");
  const denied = googleErrorFrom(403, { error: { message: "The caller does not have permission", status: "PERMISSION_DENIED" } });
  assert.equal(denied.reason, "permission");
  assert.equal(denied.message, "The caller does not have permission");
  assert.equal(googleErrorFrom(429, null).reason, "rate-limit");
  assert.equal(googleErrorFrom(500, "nope").reason, "platform");
});
