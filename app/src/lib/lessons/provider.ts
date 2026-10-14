import type { Course, LessonSource, LessonsStore, Topic } from "@/lib/types";
import { sampleTopics } from "./demo-subjects";

/**
 * A LessonProvider turns a course into topics and concepts.
 * Two exist today: the hardcoded sample lessons (one course per subject), and
 * lessons generated on the device from the course's PDFs by `generate.ts`.
 * An AI-backed provider that reads the same extracted text can replace
 * `pdfProvider` without touching the UI.
 */
export interface LessonProvider {
  source: LessonSource;
  /** Short label shown in the interface so students know where lessons come from. */
  label: string;
  listTopics(course: Course, lessons: LessonsStore): Topic[];
  getTopic(course: Course, lessons: LessonsStore, topicId: string): Topic | undefined;
}

const demoProvider: LessonProvider = {
  source: "demo",
  label: "Built-in sample lessons",
  listTopics: (course) => sampleTopics(course.id),
  getTopic: (course, _lessons, topicId) => sampleTopics(course.id).find((t) => t.id === topicId),
};

const pdfProvider: LessonProvider = {
  source: "pdf",
  label: "Lessons generated from your PDFs",
  listTopics: (course, lessons) => lessons[course.id] ?? [],
  getTopic: (course, lessons, topicId) => (lessons[course.id] ?? []).find((t) => t.id === topicId),
};

export function getLessonProvider(course: Course): LessonProvider {
  return course.sample ? demoProvider : pdfProvider;
}
