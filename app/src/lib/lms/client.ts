"use client";

/** Browser calls to the Google Classroom routes. Tokens never reach the browser. */

export type LmsResult<T> = { ok: true; data: T } | { ok: false; reason: string; message: string };
export type LmsStatus = { configured: boolean; connected: boolean };
export type LmsClass = { id: string; name: string; section: string; link: string | null };

async function call<T>(url: string, init?: RequestInit): Promise<LmsResult<T>> {
  try {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const json = (await res.json().catch(() => null)) as LmsResult<T> | null;
    return json && typeof json === "object" && "ok" in json ? json : { ok: false, reason: "platform", message: `Funza's server answered ${res.status}.` };
  } catch {
    return { ok: false, reason: "network", message: "Funza could not be reached. Check your connection." };
  }
}

export async function lmsStatus(): Promise<LmsStatus> {
  try {
    const res = await fetch("/api/lms/google/status", { cache: "no-store" });
    return res.ok ? ((await res.json()) as LmsStatus) : { configured: false, connected: false };
  } catch {
    return { configured: false, connected: false };
  }
}

export const connectUrl = (returnTo: string) => `/api/lms/google/connect?returnTo=${encodeURIComponent(returnTo)}`;
export const lmsClasses = () => call<LmsClass[]>("/api/lms/google/classes");
export const lmsTopics = (courseId: string) => call<{ id: string; name: string }[]>(`/api/lms/google/topics?course=${encodeURIComponent(courseId)}`);
export const lmsDisconnect = () => call<null>("/api/lms/google/disconnect", { method: "POST", body: "{}" });

/** The server builds the Doc from the material's saved, approved version; only its id is sent. */
export const lmsCreateDoc = (doc: { resourceId: string }) => call<{ id: string; link: string | null }>("/api/lms/google/doc", { method: "POST", body: JSON.stringify(doc) });

export const lmsPost = (p: { courseId: string; fileId: string; kind: "material" | "assignment"; title: string; description: string; state: "DRAFT" | "PUBLISHED"; topicId?: string; scheduledTime?: string }) =>
  call<{ id: string; link: string | null; state: string }>("/api/lms/google/post", { method: "POST", body: JSON.stringify(p) });
