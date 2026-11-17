import { illustrationCaptions } from "@/lib/lessons/illustrations";
import type { TeachingSession } from "@/lib/teaching/useTeachingSession";
import { revealedAnswer, type LessonPhase } from "@/lib/tutor/tutorLine";
import type { Concept, Course, Topic } from "@/lib/types";
import type { Player } from "@/lib/visualizations/usePlayer";

/**
 * What the tutor can "see": a structured description of the learning
 * workspace, built from the React state the views already hold. No
 * screenshots are involved; everything here is data the app owns.
 *
 * The answer key (the correct option, the sample answer, "why correct") is
 * left out until the lesson itself has shown it to the student, so neither
 * the local answers nor the AI can leak it.
 */
export type WorkspaceQuestion = {
  kind: "mcq" | "short";
  prompt: string;
  options: { id: string; text: string }[] | null;
  placeholder: string | null;
};

export type WorkspaceVisualization = {
  type: string;
  title: string;
  summary: string;
  status: string;
  step: number;
  stepCount: number;
  caption: string;
  captions: string[];
  checkpoint: { prompt: string; options: { id: string; text: string }[] } | null;
  chosen: string | null;
  answerRight: boolean | null;
  parameters: { label: string; value: string }[];
};

export type WorkspaceContext = {
  screen: "lesson" | "ai-lesson";
  course: { id: string; name: string };
  topic: { id: string; title: string; summary: string };
  concept: {
    id: string;
    title: string;
    index: number;
    total: number;
    explanation: string;
    alternateExplanation: string | null;
    /** Caption of a still illustration on screen, if any. */
    illustration: string | null;
  };
  question: WorkspaceQuestion | null;
  answer: {
    /** What is typed or selected right now. */
    current: string;
    /** The last answer the student checked, if any. */
    lastSubmitted: string | null;
    attempts: number;
    phase: string;
    /** Feedback the lesson has shown for the last attempt. */
    feedback: string | null;
  };
  hints: { given: string[]; remaining: string[] };
  tutor: { mode: "manual" | "tutor-mode"; step: string; paused: boolean };
  visualization: WorkspaceVisualization | null;
  /** Present only once the lesson has shown the answer to the student. */
  revealed: { answer: string; whyCorrect: string } | null;
};

/* ---------- building the context from view state ---------- */

function controlValue(params: Record<string, unknown>, key: string): unknown {
  if (key in params) return params[key];
  const parameters = params.parameters;
  if (Array.isArray(parameters)) return (parameters as { key: string; value: unknown }[]).find((p) => p.key === key)?.value;
  return undefined;
}

export function visualizationWorkspace(player: Player | null): WorkspaceVisualization | null {
  if (!player || !player.type || !player.definition) return null;
  const { title, summary } = player.definition.describe(player.params);
  const parameters = player.definition.controls(player.params).map((c) => {
    const raw = controlValue(player.params, c.key);
    const unit = c.kind === "range" && c.unit ? ` ${c.unit}` : "";
    return { label: c.label, value: raw === null || raw === undefined ? "none" : `${String(raw)}${unit}` };
  });
  return {
    type: player.type,
    title,
    summary,
    status: player.status,
    step: player.state.step,
    stepCount: player.steps.length,
    caption: player.current?.caption ?? "",
    captions: player.steps.map((s) => s.caption),
    checkpoint: player.checkpoint ? { prompt: player.checkpoint.prompt, options: player.checkpoint.options } : null,
    chosen: player.chosen,
    answerRight: player.answerRight,
    parameters,
  };
}

export type LessonWorkspaceInput = {
  course: Course;
  topic: Topic;
  concept: Concept;
  index: number;
  total: number;
  phase: LessonPhase;
  answer: string;
  lastSubmitted: string | null;
  attempts: number;
  notice: string | null;
  visualization: WorkspaceVisualization | null;
  tutor: { active: boolean; step: string; paused: boolean };
};

/** The fixed lesson flow (LessonView). */
export function lessonWorkspace(input: LessonWorkspaceInput): WorkspaceContext {
  const { course, topic, concept, index, total, phase, answer, lastSubmitted, attempts, notice, visualization, tutor } = input;
  const q = concept.question;
  const shownHints = Math.min(attempts, concept.hints.length);
  const seen = phase === "correct" || phase === "revealed";
  return {
    screen: "lesson",
    course: { id: course.id, name: course.name },
    topic: { id: topic.id, title: topic.title, summary: topic.summary },
    concept: {
      id: concept.id,
      title: concept.title,
      index,
      total,
      explanation: concept.explanation,
      alternateExplanation: concept.alternateExplanation || null,
      illustration: concept.illustration && !concept.visualization ? illustrationCaptions[concept.illustration] : null,
    },
    question: q.kind === "mcq" ? { kind: "mcq", prompt: q.prompt, options: q.options, placeholder: null } : { kind: "short", prompt: q.prompt, options: null, placeholder: q.placeholder ?? null },
    answer: { current: answer, lastSubmitted, attempts, phase, feedback: phase === "incorrect" || notice ? notice : null },
    hints: { given: concept.hints.slice(0, shownHints), remaining: concept.hints.slice(shownHints) },
    tutor: { mode: tutor.active ? "tutor-mode" : "manual", step: tutor.step, paused: tutor.paused },
    visualization,
    revealed: seen ? { answer: revealedAnswer(concept), whyCorrect: concept.whyCorrect } : null,
  };
}

/** The adaptive AI flow (TeachView). */
export function teachWorkspace(input: { course: Course; topic: Topic; t: TeachingSession; visualization: WorkspaceVisualization | null }): WorkspaceContext | null {
  const { course, topic, t, visualization } = input;
  const concept = t.concept;
  if (!concept) return null;
  const q = t.question;
  const ev = t.evaluation;
  const done = t.phase === "complete";
  return {
    screen: "ai-lesson",
    course: { id: course.id, name: course.name },
    topic: { id: topic.id, title: topic.title, summary: topic.summary },
    concept: {
      id: concept.id,
      title: concept.title,
      index: t.index,
      total: t.total,
      explanation: t.lesson?.explanation ?? concept.explanation ?? "",
      alternateExplanation: ev?.reteach ?? t.lesson?.supplement ?? null,
      illustration: null,
    },
    question: q ? { kind: q.type, prompt: q.prompt, options: q.options, placeholder: null } : null,
    answer: {
      current: t.answer,
      lastSubmitted: t.attempts > 0 ? t.answer || null : null,
      attempts: t.attempts,
      phase: t.phase,
      feedback: ev ? [ev.feedback, ev.misconception ? `Likely mix-up: ${ev.misconception}` : ""].filter(Boolean).join(" ") : null,
    },
    hints: { given: ev?.hint ? [ev.hint] : [], remaining: [] },
    tutor: { mode: "manual", step: t.phase, paused: false },
    visualization,
    revealed: done && q ? { answer: q.answerSketch, whyCorrect: ev?.feedback ?? "" } : null,
  };
}

/* ---------- the context in words, for the AI ---------- */

const cap = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * A plain-text description for the model. Hints still in reserve are
 * included so guidance can build on them; the answer key is not, unless the
 * student has already seen it.
 */
export function workspaceForPrompt(ctx: WorkspaceContext): string {
  const lines: string[] = [];
  lines.push(`Screen: ${ctx.screen === "lesson" ? "a Funza lesson" : "a Funza lesson taught by the AI from the student's notes"}.`);
  lines.push(`Course: ${ctx.course.name}. Topic: ${ctx.topic.title}. ${cap(ctx.topic.summary, 300)}`);
  lines.push(`Concept ${ctx.concept.index + 1} of ${ctx.concept.total}: ${ctx.concept.title}.`);
  lines.push(`Explanation shown to the student: ${cap(ctx.concept.explanation, 1500)}`);
  if (ctx.concept.alternateExplanation) lines.push(`Another explanation available: ${cap(ctx.concept.alternateExplanation, 800)}`);
  if (ctx.concept.illustration) lines.push(`Picture on screen: ${ctx.concept.illustration}`);
  if (ctx.question) {
    const options = ctx.question.options ? ` Options: ${ctx.question.options.map((o) => `(${o.id}) ${cap(o.text, 200)}`).join(" ")}` : "";
    lines.push(`Question (${ctx.question.kind === "mcq" ? "multiple choice" : "short answer"}): ${cap(ctx.question.prompt, 800)}${options}`);
  }
  const a = ctx.answer;
  const attempts = a.attempts === 0 ? "no attempt checked yet" : `${a.attempts} attempt${a.attempts === 1 ? "" : "s"} checked`;
  lines.push(`Student's answer: ${a.current ? `"${cap(a.current, 600)}"` : "(nothing entered)"}${a.lastSubmitted && a.lastSubmitted !== a.current ? `; last checked: "${cap(a.lastSubmitted, 600)}"` : ""}; ${attempts}; lesson state: ${a.phase}.`);
  if (a.feedback) lines.push(`Feedback shown: ${cap(a.feedback, 600)}`);
  if (ctx.hints.given.length > 0) lines.push(`Hints already given: ${ctx.hints.given.map((h, i) => `${i + 1}) ${cap(h, 300)}`).join(" ")}`);
  if (ctx.hints.remaining.length > 0) lines.push(`Hints not yet given (build on these; do not read them out word for word): ${ctx.hints.remaining.map((h) => cap(h, 300)).join(" | ")}`);
  const v = ctx.visualization;
  if (v) {
    const status =
      v.status === "checkpoint" && v.checkpoint
        ? `stopped for the student's prediction: "${v.checkpoint.prompt}" with options ${v.checkpoint.options.map((o) => `(${o.id}) ${o.text}`).join(" ")}`
        : v.status === "answered"
          ? `the student answered the prediction ${v.answerRight ? "correctly" : "incorrectly"} and can press Continue`
          : v.status === "idle"
            ? "not started yet (Play runs it)"
            : v.status === "done"
              ? "finished"
              : "playing";
    lines.push(`Interactive demo "${v.title}" (${v.type}): ${cap(v.summary, 300)} It is on step ${v.step + 1} of ${v.stepCount}, caption: "${cap(v.caption, 300)}". Status: ${status}.`);
    if (v.parameters.length > 0) lines.push(`Demo settings: ${v.parameters.map((p) => `${p.label} = ${p.value}`).join(", ")}.`);
  }
  lines.push(`Tutor mode: ${ctx.tutor.mode === "tutor-mode" ? `on, at step "${ctx.tutor.step}"${ctx.tutor.paused ? ", paused" : ""}` : "off (the student works at their own pace)"}.`);
  lines.push(
    ctx.revealed
      ? `The lesson has already shown the student the answer: "${cap(ctx.revealed.answer, 600)}". Why: ${cap(ctx.revealed.whyCorrect, 600)}`
      : "The answer key is withheld: the student has not seen the answer, so do not state it.",
  );
  return lines.join("\n");
}
