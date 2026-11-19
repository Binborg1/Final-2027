"use client";

import { useEffect, useSyncExternalStore } from "react";
import { catalogVersion, findOutcome, isRegistered, OUTCOME_ID, registerCourses, registeredCourses, subscribeCatalog, type CatalogCourse } from "@/lib/curriculum/catalog";
import { isCatalogCourse, type CourseSummary, type OutcomeHit } from "@/lib/curriculum/imported";

/**
 * The curriculum in the browser. The full dataset stays on the server; the browser
 * loads the course list, then each course when a teacher opens it, and keeps the
 * last courses it used in this browser's storage so saved resources show their
 * outcomes straight away. Wording is never edited here, and the server checks every
 * outcome again against its own copy before anything is drafted.
 */

const KEY = "funza.curriculum.v1";
const KEEP = 24;

/* ---------- the course list ---------- */

export type CourseIndex = { status: "idle" | "loading" | "ready" | "failed"; importedOn: string | null; courses: CourseSummary[] };
const IDLE_INDEX: CourseIndex = { status: "idle", importedOn: null, courses: [] };
let index: CourseIndex = IDLE_INDEX;
const indexListeners = new Set<() => void>();
const setIndex = (next: CourseIndex) => {
  index = next;
  indexListeners.forEach((l) => l());
};

export function loadCourseIndex(force = false) {
  if (!force && (index.status === "loading" || index.status === "ready")) return;
  setIndex({ ...index, status: "loading" });
  fetch("/api/curriculum")
    .then((r) => (r.ok ? (r.json() as Promise<{ importedOn: string; courses: CourseSummary[] }>) : Promise.reject(new Error(String(r.status)))))
    .then((d) => {
      setIndex({ status: "ready", importedOn: d.importedOn, courses: Array.isArray(d.courses) ? d.courses : [] });
      // Courses kept from an earlier import are fetched again, so old wording never lingers.
      for (const c of registeredCourses()) if (c.origin === "import" && c.source.retrievedOn !== d.importedOn) void loadCourse(c.id, true);
    })
    .catch(() => setIndex({ ...index, status: "failed" }));
}

export function useCourseIndex(): CourseIndex {
  const value = useSyncExternalStore(
    (l) => {
      indexListeners.add(l);
      return () => {
        indexListeners.delete(l);
      };
    },
    () => index,
    () => IDLE_INDEX,
  );
  useEffect(() => loadCourseIndex(), []);
  return value;
}

/** Re-renders when courses are registered. */
export function useCatalogVersion(): number {
  return useSyncExternalStore(subscribeCatalog, catalogVersion, () => 0);
}

/* ---------- courses kept in this browser ---------- */

let recent: string[] = [];
function touch(ids: string[]) {
  recent = [...ids, ...recent.filter((x) => !ids.includes(x))].slice(0, KEEP);
  try {
    const keep = new Set(recent);
    localStorage.setItem(KEY, JSON.stringify({ version: 1, courses: registeredCourses().filter((c) => keep.has(c.id)) }));
  } catch {
    // Storage full or blocked: courses are fetched again when needed.
  }
}

let cacheLoaded = false;
/** Called once, before the workspace reads its saved resources. */
export function loadCurriculumCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as { version?: number; courses?: unknown[] } | null;
    if (raw?.version !== 1 || !Array.isArray(raw.courses)) return;
    const courses = raw.courses.filter(isCatalogCourse);
    registerCourses(courses);
    recent = courses.map((c) => c.id);
  } catch {
    // Unreadable cache: ignore it.
  }
}

const inflight = new Map<string, Promise<CatalogCourse | null>>();

/** Loads one imported course (once, unless forced) and registers it. Resolves to null when it cannot be loaded. */
export function loadCourse(id: string, force = false): Promise<CatalogCourse | null> {
  if (!force && isRegistered(id)) {
    touch([id]);
    return Promise.resolve(registeredCourses().find((c) => c.id === id) ?? null);
  }
  const running = inflight.get(id);
  if (running) return running;
  const p = fetch(`/api/curriculum/courses/${encodeURIComponent(id)}`)
    .then((r) => (r.ok ? (r.json() as Promise<{ course?: unknown }>) : null))
    .then((d) => {
      if (!d || !isCatalogCourse(d.course)) return null;
      registerCourses([d.course]);
      touch([d.course.id]);
      return d.course;
    })
    .catch(() => null)
    .finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

/** Makes sure saved resources can show their outcomes: fetches the courses of any ids this browser does not know. */
export async function ensureOutcomes(ids: string[]): Promise<void> {
  const missing = [...new Set(ids)].filter((id) => OUTCOME_ID.test(id) && !findOutcome(id)).slice(0, 40);
  if (missing.length === 0) return;
  try {
    const r = await fetch(`/api/curriculum/outcomes?ids=${missing.map(encodeURIComponent).join(",")}`);
    if (!r.ok) return;
    const d = (await r.json()) as { courses?: unknown[] };
    const courses = (Array.isArray(d.courses) ? d.courses : []).filter(isCatalogCourse);
    registerCourses(courses);
    touch(courses.map((c) => c.id));
  } catch {
    // Offline: codes show as ids until the next load.
  }
}

/* ---------- search ---------- */

export type SearchResult = { ok: true; hits: OutcomeHit[]; total: number } | { ok: false };

export async function searchCurriculum(q: string, filters: { grade?: string; subject?: string; courseId?: string } = {}, signal?: AbortSignal): Promise<SearchResult> {
  const p = new URLSearchParams({ q });
  if (filters.grade && filters.grade !== "all") p.set("grade", filters.grade);
  if (filters.subject && filters.subject !== "all") p.set("subject", filters.subject);
  if (filters.courseId) p.set("course", filters.courseId);
  try {
    const r = await fetch(`/api/curriculum/search?${p}`, { signal });
    if (!r.ok) return { ok: false };
    const d = (await r.json()) as { hits?: OutcomeHit[]; total?: number };
    return { ok: true, hits: Array.isArray(d.hits) ? d.hits : [], total: typeof d.total === "number" ? d.total : 0 };
  } catch {
    return { ok: false };
  }
}
