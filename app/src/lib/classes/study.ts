import { classCourseId, type PublicClass, type PublicLecture } from "@/lib/classes/model";
import type { Course, Topic } from "@/lib/types";

/** A published class in the shapes the existing lesson screen and progress helpers already use. */
export function classAsCourse(cls: PublicClass): Course {
  return { id: classCourseId(cls.code), name: cls.name, files: [], createdAt: cls.createdAt };
}

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function lectureAsTopic(cls: PublicClass, lecture: PublicLecture): Topic {
  const n = lecture.concepts.length;
  const aligned = lecture.outcome ? ` This lesson is aligned to ${lecture.outcome.code}: “${lecture.outcome.statement}”` : "";
  return {
    id: lecture.id,
    title: lecture.title,
    summary: lecture.outcome ? `${lecture.outcome.code} · ${lecture.outcome.statement}` : lecture.concepts.map((c) => c.title).join(" · "),
    whyItMatters: `${cls.professor} reviewed and published these ${n} part${n === 1 ? "" : "s"} on ${formatDay(lecture.publishedAt)}. Nothing here was written live by an AI.${aligned}`,
    concepts: lecture.concepts,
  };
}
