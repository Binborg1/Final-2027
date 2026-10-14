"use client";

import { teachApi, type TeachResult } from "@/lib/ai/teach-client";
import { hash, slug } from "@/lib/lessons/generate";
import { outlineForPlanning } from "@/lib/retrieval/retrieve";
import { addTopics } from "@/lib/storage";
import type { Course, SourceSection, Topic } from "@/lib/types";

/**
 * Lesson generation, step one: asks the AI to plan a topic (concepts and
 * objectives) from a notes PDF's sections and saves it as an "ai" topic.
 * Each concept's lesson is written later, when the student opens it.
 */
export async function planAiTopic(course: Course, fileName: string, sections: SourceSection[]): Promise<TeachResult<Topic>> {
  const res = await teachApi.plan({
    courseName: course.name,
    fileName,
    outline: outlineForPlanning(sections),
    sectionCount: sections.length,
  });
  if (!res.ok) return res;
  const plan = res.data;
  const base = fileName.replace(/\.pdf$/i, "").trim() || fileName;
  const topic: Topic = {
    id: `ai-${slug(base).slice(0, 40)}-${hash(fileName).toString(36)}`,
    kind: "ai",
    title: plan.topicTitle,
    summary: plan.objectives[0] ?? `Adaptive lessons planned from ${fileName}.`,
    whyItMatters: `Planned by the AI tutor from ${fileName}. Each concept is taught, questioned and verified before moving on.`,
    objectives: plan.objectives,
    fileName,
    concepts: plan.concepts.map((c, i) => ({
      id: `${i + 1}-${slug(c.title).slice(0, 40) || "concept"}`,
      title: c.title,
      objective: c.objective,
      sourceIds: c.sectionIndexes.map((n) => sections[n]?.id).filter((id): id is string => Boolean(id)),
      explanation: c.objective,
      alternateExplanation: "",
      question: { kind: "short", prompt: "", keywordGroups: [], minGroups: 0, sampleAnswer: "" },
      whyCorrect: "",
      hints: [],
    })),
  };
  addTopics(course.id, [topic]);
  return { ok: true, data: topic };
}
