import { useSyncExternalStore } from "react";
import { sampleCourses } from "@/lib/lessons/sample";
import type {
  AiLesson,
  AiLessonStore,
  ConceptStatus,
  Course,
  CourseFile,
  LessonsStore,
  ProgressStore,
  QuestionSet,
  QuestionsStore,
  SourceSection,
  SourcesStore,
  Topic,
} from "@/lib/types";
import { conceptKey } from "@/lib/types";

const COURSES_KEY = "funza.courses.v1";
const PROGRESS_KEY = "funza.progress.v1";
const LESSONS_KEY = "funza.lessons.v1";
const QUESTIONS_KEY = "funza.questions.v1";
const SOURCES_KEY = "funza.sources.v1";
const AI_LESSONS_KEY = "funza.ai-lessons.v1";

type Listener = () => void;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private window, quota): state stays in memory for this session.
  }
}

/** A tiny localStorage-backed store that React components subscribe to. */
class LocalStore<T> {
  private cache: T | undefined;
  private listeners = new Set<Listener>();

  constructor(
    private key: string,
    private fallback: T,
  ) {}

  get = (): T => {
    if (this.cache === undefined) this.cache = readJson(this.key, this.fallback);
    return this.cache;
  };

  getServer = (): T => this.fallback;

  set = (next: T) => {
    this.cache = next;
    writeJson(this.key, next);
    this.listeners.forEach((listener) => listener());
  };

  update = (fn: (prev: T) => T) => this.set(fn(this.get()));

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === this.key) {
        this.cache = undefined;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      this.listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };
}

/** New browsers start with the sample courses; once one is removed, the saved list no longer has it and it stays gone. */
export const coursesStore = new LocalStore<Course[]>(COURSES_KEY, sampleCourses);
export const progressStore = new LocalStore<ProgressStore>(PROGRESS_KEY, {});
export const lessonsStore = new LocalStore<LessonsStore>(LESSONS_KEY, {});
export const questionsStore = new LocalStore<QuestionsStore>(QUESTIONS_KEY, {});
/** Extracted notes text, kept on this device so the AI can teach from it. */
export const sourcesStore = new LocalStore<SourcesStore>(SOURCES_KEY, {});
/** AI-generated lessons, cached per concept. */
export const aiLessonStore = new LocalStore<AiLessonStore>(AI_LESSONS_KEY, {});
/** Whether the tutor voice is on. Off until the student turns it on. */
export const voiceStore = new LocalStore<boolean>("funza.voice.v1", false);
/** Local-only screen sharing: screenshots stay on this device and are never sent to the AI provider. */
export const screenLocalOnlyStore = new LocalStore<boolean>("funza.screen-local-only.v1", false);

export function useScreenLocalOnly() {
  return useSyncExternalStore(screenLocalOnlyStore.subscribe, screenLocalOnlyStore.get, screenLocalOnlyStore.getServer);
}

export function useCourses() {
  return useSyncExternalStore(coursesStore.subscribe, coursesStore.get, coursesStore.getServer);
}

export function useProgress() {
  return useSyncExternalStore(progressStore.subscribe, progressStore.get, progressStore.getServer);
}

export function useLessons() {
  return useSyncExternalStore(lessonsStore.subscribe, lessonsStore.get, lessonsStore.getServer);
}

export function useQuestionSets() {
  return useSyncExternalStore(questionsStore.subscribe, questionsStore.get, questionsStore.getServer);
}

export function useVoiceEnabled() {
  return useSyncExternalStore(voiceStore.subscribe, voiceStore.get, voiceStore.getServer);
}

export function useSources() {
  return useSyncExternalStore(sourcesStore.subscribe, sourcesStore.get, sourcesStore.getServer);
}

export function useAiLessons() {
  return useSyncExternalStore(aiLessonStore.subscribe, aiLessonStore.get, aiLessonStore.getServer);
}

const noopSubscribe = () => () => {};

/** False during server render and hydration, true once the browser owns the page. */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
}

export function toCourseFiles(files: FileList | File[]): CourseFile[] {
  return Array.from(files).map((file) => ({ name: file.name, size: file.size, type: file.type }));
}

export function addCourse(name: string, files: CourseFile[]): Course {
  const course: Course = {
    id: makeId(),
    name: name.trim(),
    files,
    createdAt: new Date().toISOString(),
  };
  coursesStore.update((prev) => [...prev, course]);
  return course;
}

/** Puts a built-in sample course (back) on the list, for browsers that already had courses before it existed. */
export function addSampleCourse(course: Course) {
  coursesStore.update((prev) => (prev.some((c) => c.id === course.id) ? prev : [...prev, course]));
}

/** Appends files and returns the index of the first one in the course's list. */
export function addFilesToCourse(courseId: string, files: CourseFile[]): number {
  const course = coursesStore.get().find((c) => c.id === courseId);
  const startIndex = course?.files.length ?? 0;
  coursesStore.update((prev) => prev.map((c) => (c.id === courseId ? { ...c, files: [...c.files, ...files] } : c)));
  return startIndex;
}

export function updateCourseFile(courseId: string, fileIndex: number, patch: Partial<CourseFile>) {
  coursesStore.update((prev) =>
    prev.map((c) =>
      c.id === courseId ? { ...c, files: c.files.map((f, i) => (i === fileIndex ? { ...f, ...patch } : f)) } : c,
    ),
  );
}

export function removeFileFromCourse(courseId: string, fileIndex: number) {
  const course = coursesStore.get().find((c) => c.id === courseId);
  const file = course?.files[fileIndex];
  coursesStore.update((prev) =>
    prev.map((c) => (c.id === courseId ? { ...c, files: c.files.filter((_, i) => i !== fileIndex) } : c)),
  );
  if (file) {
    removeLessonsForFile(courseId, file.name);
    removeQuestionSetsForFile(courseId, file.name);
    removeSourcesForFile(courseId, file.name);
  }
}

export function removeCourse(courseId: string) {
  coursesStore.update((prev) => prev.filter((course) => course.id !== courseId));
  aiLessonStore.update((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith(`${courseId}:`))));
  for (const store of [progressStore, lessonsStore, questionsStore, sourcesStore] as LocalStore<Record<string, unknown>>[]) {
    store.update((prev) => {
      const next = { ...prev };
      delete next[courseId];
      return next;
    });
  }
}

export function appendCourseLessons(courseId: string, topics: Topic[]) {
  lessonsStore.update((prev) => ({ ...prev, [courseId]: [...(prev[courseId] ?? []), ...topics] }));
}

export function removeLessonsForFile(courseId: string, fileName: string) {
  const removedTopicIds = new Set(
    (lessonsStore.get()[courseId] ?? []).filter((t) => t.fileName === fileName).map((t) => t.id),
  );
  if (removedTopicIds.size === 0) return;
  lessonsStore.update((prev) => ({
    ...prev,
    [courseId]: (prev[courseId] ?? []).filter((t) => !removedTopicIds.has(t.id)),
  }));
  progressStore.update((prev) => {
    const entries = prev[courseId];
    if (!entries) return prev;
    const kept = Object.fromEntries(Object.entries(entries).filter(([key]) => !removedTopicIds.has(key.split("/")[0])));
    return { ...prev, [courseId]: kept };
  });
  aiLessonStore.update((prev) =>
    Object.fromEntries(
      Object.entries(prev).filter(([key]) => !removedTopicIds.has(key.slice(courseId.length + 1).split("/")[0])),
    ),
  );
}

export function addTopics(courseId: string, topics: Topic[]) {
  lessonsStore.update((prev) => ({ ...prev, [courseId]: [...(prev[courseId] ?? []), ...topics] }));
}

export function saveSources(courseId: string, fileName: string, sections: SourceSection[]) {
  sourcesStore.update((prev) => ({ ...prev, [courseId]: { ...(prev[courseId] ?? {}), [fileName]: sections } }));
}

export function removeSourcesForFile(courseId: string, fileName: string) {
  sourcesStore.update((prev) => {
    const files = { ...(prev[courseId] ?? {}) };
    delete files[fileName];
    return { ...prev, [courseId]: files };
  });
}

export function aiLessonKey(courseId: string, topicId: string, conceptId: string) {
  return `${courseId}:${conceptKey(topicId, conceptId)}`;
}

export function saveAiLesson(key: string, lesson: AiLesson) {
  aiLessonStore.update((prev) => ({ ...prev, [key]: lesson }));
}

export function addQuestionSet(courseId: string, set: QuestionSet) {
  questionsStore.update((prev) => ({ ...prev, [courseId]: [...(prev[courseId] ?? []), set] }));
}

export function removeQuestionSetsForFile(courseId: string, fileName: string) {
  const sets = questionsStore.get()[courseId] ?? [];
  if (!sets.some((s) => s.fileName === fileName)) return;
  questionsStore.update((prev) => ({
    ...prev,
    [courseId]: (prev[courseId] ?? []).filter((s) => s.fileName !== fileName),
  }));
}

export function recordConceptResult(
  courseId: string,
  topicId: string,
  conceptId: string,
  status: ConceptStatus,
  attempts: number,
) {
  progressStore.update((prev) => ({
    ...prev,
    [courseId]: {
      ...(prev[courseId] ?? {}),
      [conceptKey(topicId, conceptId)]: { status, attempts, updatedAt: new Date().toISOString() },
    },
  }));
}
