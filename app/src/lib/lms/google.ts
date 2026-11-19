import { randomBytes } from "node:crypto";
import type { GoogleConfig, GoogleTokens } from "@/lib/lms/session";

/**
 * Google Classroom and Drive over plain fetch, following the REST references
 * read on 18 Nov 2026 (docs/09_teacher_workspace_design/07_lms_publishing_ux.md).
 * Funza never asks for rosters, submissions or grades.
 */

export const SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.topics.readonly",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials",
  "https://www.googleapis.com/auth/classroom.coursework.students",
  "https://www.googleapis.com/auth/drive.file",
];

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const REVOKE = "https://oauth2.googleapis.com/revoke";
const CLASSROOM = "https://classroom.googleapis.com/v1";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

export type GoogleReason = "expired" | "permission" | "not-found" | "rate-limit" | "invalid" | "platform";

export class GoogleError extends Error {
  reason: GoogleReason;
  constructor(reason: GoogleReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

export function authUrl(cfg: GoogleConfig, redirectUri: string, state: string) {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH}?${q.toString()}`;
}

async function tokenRequest(form: Record<string, string>) {
  const res = await fetch(TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString(), cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new GoogleError(json.error === "invalid_grant" ? "expired" : "platform", json.error_description || json.error || `Google token error ${res.status}`);
  return json;
}

export async function exchangeCode(cfg: GoogleConfig, code: string, redirectUri: string, now = Date.now()): Promise<GoogleTokens> {
  const t = await tokenRequest({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri });
  return { at: t.access_token!, rt: t.refresh_token ?? null, exp: now + (t.expires_in ?? 3600) * 1000 };
}

export async function refreshTokens(cfg: GoogleConfig, tokens: GoogleTokens, now = Date.now()): Promise<GoogleTokens> {
  if (!tokens.rt) throw new GoogleError("expired", "The Classroom connection has expired.");
  const t = await tokenRequest({ client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: "refresh_token", refresh_token: tokens.rt });
  return { at: t.access_token!, rt: t.refresh_token ?? tokens.rt, exp: now + (t.expires_in ?? 3600) * 1000 };
}

export async function revokeToken(token: string) {
  await fetch(`${REVOKE}?${new URLSearchParams({ token }).toString()}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }).catch(() => undefined);
}

/** Maps a Google API error to a reason the interface can explain. */
export function googleErrorFrom(status: number, body: unknown): GoogleError {
  const err = (body && typeof body === "object" ? (body as { error?: { message?: string; status?: string } }).error : undefined) ?? {};
  const message = typeof err.message === "string" ? err.message.slice(0, 300) : `Google returned ${status}.`;
  if (status === 401) return new GoogleError("expired", message);
  if (status === 403) return new GoogleError("permission", message);
  if (status === 404) return new GoogleError("not-found", message);
  if (status === 429) return new GoogleError("rate-limit", message);
  if (status === 400) return new GoogleError("invalid", message);
  return new GoogleError("platform", message);
}

async function api<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store", headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw googleErrorFrom(res.status, body);
  return body as T;
}

export type GClass = { id: string; name: string; section: string; link: string | null };

export async function listCourses(token: string): Promise<GClass[]> {
  const out: GClass[] = [];
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ teacherId: "me", courseStates: "ACTIVE", pageSize: "100" });
    if (pageToken) q.set("pageToken", pageToken);
    const r = await api<{ courses?: { id: string; name: string; section?: string; alternateLink?: string }[]; nextPageToken?: string }>(token, `${CLASSROOM}/courses?${q.toString()}`);
    (r.courses ?? []).forEach((c) => out.push({ id: c.id, name: c.name, section: c.section ?? "", link: c.alternateLink ?? null }));
    if (!r.nextPageToken) break;
    pageToken = r.nextPageToken;
  }
  return out;
}

export async function listTopics(token: string, courseId: string) {
  const r = await api<{ topic?: { topicId: string; name: string }[] }>(token, `${CLASSROOM}/courses/${encodeURIComponent(courseId)}/topics?pageSize=100`);
  return (r.topic ?? []).map((t) => ({ id: t.topicId, name: t.name }));
}

/** The multipart/related body for a Drive upload that converts HTML into a Google Doc. */
export function multipartDoc(name: string, html: string, boundary = `funza_${randomBytes(12).toString("hex")}`) {
  const meta = JSON.stringify({ name, mimeType: "application/vnd.google-apps.document" });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`;
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

export async function uploadDoc(token: string, name: string, html: string): Promise<{ id: string; link: string | null }> {
  const { body, contentType } = multipartDoc(name, html);
  const r = await api<{ id: string; webViewLink?: string }>(token, `${UPLOAD}?uploadType=multipart&fields=id,webViewLink`, { method: "POST", headers: { "Content-Type": contentType }, body });
  return { id: r.id, link: r.webViewLink ?? null };
}

export type PostInput = {
  kind: "material" | "assignment";
  title: string;
  description: string;
  fileId: string;
  state: "DRAFT" | "PUBLISHED";
  topicId?: string;
  scheduledTime?: string;
};

/** The request body for a material or an assignment with the Doc attached, view-only for students. */
export function postBody(p: PostInput) {
  const body: Record<string, unknown> = {
    title: p.title.slice(0, 3000),
    description: p.description.slice(0, 30000),
    materials: [{ driveFile: { driveFile: { id: p.fileId }, shareMode: "VIEW" } }],
    state: p.state,
  };
  if (p.topicId) body.topicId = p.topicId;
  if (p.scheduledTime) body.scheduledTime = p.scheduledTime;
  if (p.kind === "assignment") body.workType = "ASSIGNMENT";
  return body;
}

export async function createPost(token: string, courseId: string, p: PostInput): Promise<{ id: string; link: string | null; state: string }> {
  const path = p.kind === "assignment" ? "courseWork" : "courseWorkMaterials";
  const r = await api<{ id: string; alternateLink?: string; state?: string }>(token, `${CLASSROOM}/courses/${encodeURIComponent(courseId)}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(postBody(p)),
  });
  return { id: r.id, link: r.alternateLink ?? null, state: r.state ?? p.state };
}
