"use client";

import type { DraftContent, PlanResponse } from "@/lib/ai/teach-schema";
import type { BlockKind, CurriculumBlock } from "@/lib/curriculum/lesson";
import type { AiEvaluation, AiLesson, AiQuestion } from "@/lib/types";

export type TeachResult<T> = { ok: true; data: T } | { ok: false; reason: string; message: string };

async function call<T>(body: Record<string, unknown>): Promise<TeachResult<T>> {
  try {
    const res = await fetch("/api/teach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as TeachResult<T>;
  } catch {
    return { ok: false, reason: "network", message: "Could not reach the server." };
  }
}

type ConceptRef = { title: string; objective?: string };

export const teachApi = {
  plan: (input: { courseName: string; fileName: string; outline: string; sectionCount: number }) =>
    call<PlanResponse>({ task: "plan", ...input }),
  lesson: (input: { courseName: string; concept: ConceptRef; source: string }) => call<AiLesson>({ task: "lesson", ...input }),
  /** All five blocks of a curriculum lesson for a catalog outcome; the server looks the outcome up itself. */
  curriculumLesson: (input: { outcomeId: string }) => call<CurriculumBlock[]>({ task: "curriculum-lesson", ...input }),
  /** One block, rewritten. */
  curriculumBlock: (input: { outcomeId: string; kind: BlockKind; blockId: string }) =>
    call<CurriculumBlock[]>({ task: "curriculum-block", ...input }),
  /** A whole concept written up front, for a professor to review before students see it. */
  draft: (input: { courseName: string; concept: ConceptRef; source: string }) => call<DraftContent>({ task: "draft", ...input }),
  evaluate: (input: {
    courseName: string;
    concept: ConceptRef;
    explanation: string;
    question: AiQuestion;
    answer: string;
    attempt: number;
    source: string;
  }) => call<AiEvaluation>({ task: "evaluate", ...input }),
  question: (input: { courseName: string; concept: ConceptRef; explanation: string; previousPrompts: string[]; source: string }) =>
    call<AiQuestion>({ task: "question", ...input }),
};
