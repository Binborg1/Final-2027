"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { teachApi } from "@/lib/ai/teach-client";
import { retrieveForConcept } from "@/lib/retrieval/retrieve";
import { aiLessonKey, recordConceptResult, saveAiLesson, useAiLessons } from "@/lib/storage";
import type { AiEvaluation, AiLesson, AiQuestion, Concept, ConceptStatus, Course, SourceSection, Topic } from "@/lib/types";

/**
 * Teaching-state management for the adaptive loop:
 *   explain -> ask -> evaluating -> feedback (hint) | reteach -> verifying -> ask (new question) -> complete -> next
 * The AI writes lessons, judges reasoning and writes verification questions
 * (see teach-client.ts); this hook decides what happens next and keeps progress.
 */
export type TeachPhase = "loading" | "explain" | "ask" | "evaluating" | "feedback" | "reteach" | "verifying" | "complete" | "error" | "finished";

export type QuestionKind = "original" | "verification";

/** After this many missed answers on one concept the student may see the answer and move on. */
export const GIVE_UP_AFTER = 4;

type Inner = {
  index: number;
  phase: Exclude<TeachPhase, "loading">;
  question: AiQuestion | null;
  questionKind: QuestionKind;
  answer: string;
  evaluation: AiEvaluation | null;
  attempts: number;
  misses: number;
  previousPrompts: string[];
  error: string | null;
  failedStep: "lesson" | "evaluate" | "question" | null;
  reloadToken: number;
  results: Record<string, ConceptStatus>;
};

const fresh = (index: number, results: Record<string, ConceptStatus>, reloadToken = 0): Inner => ({
  index,
  phase: "explain",
  question: null,
  questionKind: "original",
  answer: "",
  evaluation: null,
  attempts: 0,
  misses: 0,
  previousPrompts: [],
  error: null,
  failedStep: null,
  reloadToken,
  results,
});

export type TeachingSession = {
  index: number;
  total: number;
  concept: Concept | undefined;
  lesson: AiLesson | undefined;
  phase: TeachPhase;
  question: AiQuestion | null;
  questionKind: QuestionKind;
  answer: string;
  evaluation: AiEvaluation | null;
  attempts: number;
  misses: number;
  error: string | null;
  results: Record<string, ConceptStatus>;
  statusOf: (conceptId: string) => ConceptStatus | undefined;
  ready: () => void;
  setAnswer: (text: string) => void;
  submit: () => void;
  tryAgain: () => void;
  teachDifferently: () => void;
  testMe: () => void;
  giveUp: () => void;
  next: () => void;
  retryStep: () => void;
  skip: () => void;
};

export function useTeachingSession(course: Course, topic: Topic, sections: SourceSection[], savedStatus: (id: string) => ConceptStatus | undefined): TeachingSession {
  const aiLessons = useAiLessons();
  const [s, setS] = useState<Inner>(() => fresh(0, {}));
  const generation = useRef(0);
  const inflight = useRef<string | null>(null);

  const total = topic.concepts.length;
  const concept = s.index < total ? topic.concepts[s.index] : undefined;
  const lessonKey = concept ? aiLessonKey(course.id, topic.id, concept.id) : null;
  const lesson = lessonKey ? aiLessons[lessonKey] : undefined;
  const source = useMemo(() => (concept ? retrieveForConcept(sections, concept).text : ""), [sections, concept]);

  const patch = useCallback((changes: Partial<Inner>) => setS((prev) => ({ ...prev, ...changes })), []);

  // Generate the lesson for a concept once; cached lessons are reused on later visits.
  useEffect(() => {
    if (!concept || !lessonKey || lesson || s.error) return;
    const key = `${lessonKey}#${s.reloadToken}`;
    if (inflight.current === key) return;
    inflight.current = key;
    const mine = ++generation.current;
    void teachApi.lesson({ courseName: course.name, concept: { title: concept.title, objective: concept.objective }, source }).then((res) => {
      if (generation.current !== mine) return;
      inflight.current = null;
      if (res.ok) saveAiLesson(lessonKey, res.data);
      else patch({ phase: "error", error: res.message, failedStep: "lesson" });
    });
  }, [concept, lessonKey, lesson, source, course.name, s.error, s.reloadToken, patch]);

  const question = s.question ?? lesson?.question ?? null;
  const phase: TeachPhase = s.index >= total ? "finished" : s.phase === "error" ? "error" : !lesson ? "loading" : s.phase;
  const conceptRef = useMemo(() => (concept ? { title: concept.title, objective: concept.objective } : null), [concept]);

  const askVerification = useCallback(
    async (prevPrompts: string[], evaluation: AiEvaluation | null) => {
      if (!conceptRef || !lesson) return;
      const mine = ++generation.current;
      patch({ phase: "verifying", evaluation });
      const res = await teachApi.question({ courseName: course.name, concept: conceptRef, explanation: lesson.explanation, previousPrompts: prevPrompts, source });
      if (generation.current !== mine) return;
      if (res.ok) {
        patch({ phase: "ask", question: res.data, questionKind: "verification", answer: "", attempts: 0, previousPrompts: [...prevPrompts, res.data.prompt] });
      } else {
        patch({ phase: "error", error: res.message, failedStep: "question" });
      }
    },
    [conceptRef, lesson, course.name, source, patch],
  );

  const submit = useCallback(async () => {
    if (!concept || !conceptRef || !lesson || !question || phase !== "ask" || !s.answer.trim()) return;
    const mine = ++generation.current;
    patch({ phase: "evaluating" });
    const attempt = s.attempts + 1;
    const res = await teachApi.evaluate({
      courseName: course.name,
      concept: conceptRef,
      explanation: lesson.explanation,
      question,
      answer: s.answer,
      attempt,
      source,
    });
    if (generation.current !== mine) return;
    if (!res.ok) {
      patch({ phase: "error", error: res.message, failedStep: "evaluate" });
      return;
    }
    const evaluation = res.data;
    if (evaluation.verdict === "correct") {
      if (s.questionKind === "original") {
        const prompts = s.previousPrompts.length > 0 ? s.previousPrompts : [lesson.question.prompt];
        await askVerification(prompts, evaluation);
      } else {
        recordConceptResult(course.id, topic.id, concept.id, "completed", s.misses + 1);
        patch({ phase: "complete", evaluation, results: { ...s.results, [concept.id]: "completed" } });
      }
      return;
    }
    patch({ phase: "feedback", evaluation, attempts: attempt, misses: s.misses + 1 });
  }, [concept, conceptRef, lesson, question, phase, s.answer, s.attempts, s.questionKind, s.previousPrompts, s.misses, s.results, course.name, course.id, topic.id, source, patch, askVerification]);

  const ready = useCallback(() => patch({ phase: "ask" }), [patch]);
  const setAnswer = useCallback((text: string) => patch({ answer: text }), [patch]);
  const tryAgain = useCallback(() => patch({ phase: "ask" }), [patch]);
  const teachDifferently = useCallback(() => {
    if (s.evaluation?.reteach) patch({ phase: "reteach" });
  }, [s.evaluation, patch]);
  const testMe = useCallback(() => {
    if (!lesson) return;
    const prompts = s.previousPrompts.length > 0 ? s.previousPrompts : [lesson.question.prompt];
    void askVerification(prompts, s.evaluation);
  }, [lesson, s.previousPrompts, s.evaluation, askVerification]);
  const giveUp = useCallback(() => {
    if (!concept) return;
    recordConceptResult(course.id, topic.id, concept.id, "needs-practice", s.misses);
    patch({ phase: "complete", results: { ...s.results, [concept.id]: "needs-practice" } });
  }, [concept, course.id, topic.id, s.misses, s.results, patch]);
  const next = useCallback(() => {
    generation.current++;
    inflight.current = null;
    setS((prev) => fresh(prev.index + 1, prev.results));
  }, []);
  const skip = next;
  const retryStep = useCallback(() => {
    inflight.current = null;
    if (s.failedStep === "lesson") setS((prev) => ({ ...prev, phase: "explain", error: null, failedStep: null, reloadToken: prev.reloadToken + 1 }));
    else if (s.failedStep === "evaluate") patch({ phase: "ask", error: null, failedStep: null });
    else if (s.failedStep === "question" && lesson) {
      patch({ error: null, failedStep: null });
      const prompts = s.previousPrompts.length > 0 ? s.previousPrompts : [lesson.question.prompt];
      void askVerification(prompts, s.evaluation);
    } else patch({ phase: "explain", error: null, failedStep: null });
  }, [s.failedStep, s.previousPrompts, s.evaluation, lesson, patch, askVerification]);

  const statusOf = useCallback((id: string) => s.results[id] ?? savedStatus(id), [s.results, savedStatus]);

  return {
    index: s.index,
    total,
    concept,
    lesson,
    phase,
    question,
    questionKind: s.questionKind,
    answer: s.answer,
    evaluation: s.evaluation,
    attempts: s.attempts,
    misses: s.misses,
    error: s.error,
    results: s.results,
    statusOf,
    ready,
    setAnswer,
    submit,
    tryAgain,
    teachDifferently,
    testMe,
    giveUp,
    next,
    retryStep,
    skip,
  };
}
