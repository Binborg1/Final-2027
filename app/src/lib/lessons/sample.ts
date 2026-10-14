import type { Course } from "@/lib/types";

export const SAMPLE_COURSE_ID = "sample-computer-networks";

/**
 * The built-in courses. They exist so the lesson flow and the visual
 * demonstrations can be tried before any PDF is added, one per subject, and
 * the student can delete any of them like any other course.
 */
export const sampleCourses: Course[] = [
  { id: SAMPLE_COURSE_ID, name: "Sample: Computer Networks", files: [], createdAt: "2026-10-13T00:00:00.000Z", sample: true },
  { id: "sample-mathematics", name: "Sample: Mathematics", files: [], createdAt: "2026-10-14T00:00:00.000Z", sample: true },
  { id: "sample-physics", name: "Sample: Physics", files: [], createdAt: "2026-10-14T00:00:00.000Z", sample: true },
  { id: "sample-computer-science", name: "Sample: Computer Science", files: [], createdAt: "2026-10-14T00:00:00.000Z", sample: true },
  { id: "sample-biology", name: "Sample: Biology", files: [], createdAt: "2026-10-14T00:00:00.000Z", sample: true },
];

/** The original networking sample, kept for code that refers to it by name. */
export const sampleCourse = sampleCourses[0];
