"use client";

import type { ClassRecord, Lecture, PublicClass } from "@/lib/classes/model";
import { joinedClassesStore, teachingStore } from "@/lib/storage";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; reason: string; message: string };

const EDIT_KEY_HEADER = "x-funza-edit-key";

async function call<T>(url: string, init: RequestInit, pick: (body: Record<string, unknown>) => T): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    const body = (await res.json()) as Record<string, unknown>;
    if (body.ok) return { ok: true, data: pick(body) };
    return {
      ok: false,
      reason: typeof body.reason === "string" ? body.reason : "error",
      message: typeof body.message === "string" ? body.message : "Something went wrong.",
    };
  } catch {
    return { ok: false, reason: "network", message: "Could not reach the server. Check your connection." };
  }
}

export const classApi = {
  create: (info: { name: string; term: string; professor: string }) =>
    call(
      "/api/classes",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(info) },
      (b) => ({ record: b.class as ClassRecord, editKey: b.editKey as string }),
    ),
  loadForEdit: (code: string, editKey: string) =>
    call(`/api/classes/${encodeURIComponent(code)}`, { headers: { [EDIT_KEY_HEADER]: editKey } }, (b) => b.class as ClassRecord),
  save: (record: ClassRecord, editKey: string) =>
    call(
      `/api/classes/${encodeURIComponent(record.code)}`,
      { method: "PUT", headers: { "Content-Type": "application/json", [EDIT_KEY_HEADER]: editKey }, body: JSON.stringify(record) },
      (b) => b.class as ClassRecord,
    ),
  loadPublic: (code: string) => call(`/api/classes/${encodeURIComponent(code)}`, {}, (b) => b.class as PublicClass),
};

/**
 * Adds a lesson to a class this browser teaches: loads the latest version,
 * appends, saves. Used where no editing session for that class is open.
 */
export async function addLectureToClass(code: string, lecture: Lecture): Promise<ApiResult<ClassRecord>> {
  const key = editKeyFor(code);
  if (!key) return { ok: false, reason: "no-key", message: "This browser cannot edit that class." };
  const loaded = await classApi.loadForEdit(code, key);
  if (!loaded.ok) return loaded;
  return classApi.save({ ...loaded.data, lectures: [...loaded.data.lectures, lecture] }, key);
}

/* ---------- this browser's classes ---------- */

export function editKeyFor(code: string): string | null {
  return teachingStore.get().find((t) => t.code === code)?.editKey ?? null;
}

export function rememberTeaching(code: string, editKey: string, name: string) {
  teachingStore.update((prev) => {
    const existing = prev.find((t) => t.code === code);
    if (existing) return prev.map((t) => (t.code === code ? { ...t, editKey, name: name || t.name } : t));
    return [...prev, { code, editKey, name, addedAt: new Date().toISOString() }];
  });
}

export function forgetTeaching(code: string) {
  teachingStore.update((prev) => prev.filter((t) => t.code !== code));
}

export function rememberJoined(cls: PublicClass) {
  joinedClassesStore.update((prev) => {
    const entry = { code: cls.code, name: cls.name, professor: cls.professor };
    if (prev.some((c) => c.code === cls.code)) {
      const unchanged = prev.every((c) => c.code !== cls.code || (c.name === entry.name && c.professor === entry.professor));
      return unchanged ? prev : prev.map((c) => (c.code === cls.code ? { ...c, ...entry } : c));
    }
    return [...prev, { ...entry, joinedAt: new Date().toISOString() }];
  });
}

export function leaveClass(code: string) {
  joinedClassesStore.update((prev) => prev.filter((c) => c.code !== code));
}

/** The link that opens a class for editing on another device. The key sits after "#", so it never reaches a server log. */
export function editLink(code: string, editKey: string): string {
  return `${window.location.origin}/teach/${code}#key=${encodeURIComponent(editKey)}`;
}