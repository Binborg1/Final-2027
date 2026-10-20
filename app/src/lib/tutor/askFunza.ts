import type { MascotState } from "@/components/mascot/FunzaMascot";
import type { WorkspaceContext } from "@/lib/workspace/context";

/**
 * Answers about the screen that need no AI: built straight from the
 * structured workspace context, so they work offline and never leak the
 * answer key. Anything else goes to the AI tutor when one is configured.
 */
export type AskIntent = "overview" | "diagram" | "mistake" | "hint" | "another-way" | "other";

export type LocalAnswer = { text: string; state: MascotState };

export const SUGGESTED_QUESTIONS = ["What am I looking at?", "Explain the diagram", "Where did I go wrong?", "Give me a hint", "Show me another way"] as const;

const patterns: [AskIntent, RegExp][] = [
  ["hint", /\bhints?\b|\bclue\b|\bnudge\b|\bstuck\b|\btip\b|help me (start|get started|with this)/i],
  ["mistake", /\bwrong\b|\bmistakes?\b|\berror\b|\bincorrect\b|\bwhy (is|was|isn'?t|wasn'?t) (that|my|it|this)\b|what did i (do|get|miss)|where did i/i],
  ["diagram", /\bdiagram\b|\bpicture\b|\bgraph\b|\bchart\b|\banimation\b|\bdemo\b|\bvisuali[sz]ation\b|\bfigure\b|\billustration\b|\bdrawing\b|\bimage\b/i],
  ["another-way", /another way|different way|other way|explain (it |this |that )?(again|differently|another|more simply)|re-?explain|simpler|don'?t (get|understand|follow)|confus|put it differently/i],
  ["overview", /what am i (looking|working|doing)|what('?s| is) (this|that|here|on (the|my) screen|going on)|can you see|do you see|what i'?m (working|doing|looking)|where am i|what are we (doing|learning|on)|see my (screen|work)|what('?s| is) the question|what do i (do|need to do|have to do)/i],
];

export function detectIntent(question: string): AskIntent {
  const q = question.trim().toLowerCase();
  if (!q) return "overview";
  for (const [intent, re] of patterns) if (re.test(q)) return intent;
  return "other";
}

/* ---------- small text helpers ---------- */

export function firstSentences(text: string, count = 1): string {
  const parts = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
  return parts.slice(0, count).join(" ");
}

function optionText(ctx: WorkspaceContext, id: string): string | null {
  const option = ctx.question?.options?.find((o) => o.id === id.toLowerCase());
  return option ? `(${option.id}) ${option.text}` : null;
}

function demoStatus(v: NonNullable<WorkspaceContext["visualization"]>): string {
  switch (v.status) {
    case "idle":
      return "ready to play";
    case "checkpoint":
      return `paused for your prediction: ${v.checkpoint?.prompt ?? ""}`;
    case "answered":
      return "waiting for you to press Continue";
    case "done":
      return "finished";
    default:
      return `on step ${v.step + 1} of ${v.stepCount}: ${v.caption}`;
  }
}

function progressLine(ctx: WorkspaceContext): string {
  const a = ctx.answer;
  if (a.phase === "correct" || (a.phase === "complete" && ctx.revealed)) return "You've already got this one.";
  if (a.phase === "revealed") return "You asked to see the answer, so this one is marked for practice.";
  if (a.attempts > 0) return `You've made ${a.attempts} attempt${a.attempts === 1 ? "" : "s"} so far${a.feedback ? `; the feedback was: ${firstSentences(a.feedback)}` : ""}.`;
  if (a.current.trim()) return "You've started an answer but haven't checked it yet.";
  return "You haven't answered yet.";
}

/* ---------- the answers ---------- */

function overview(ctx: WorkspaceContext): string {
  const c = ctx.concept;
  const where = `You're in ${ctx.course.name}, on "${ctx.topic.title}", concept ${c.index + 1} of ${c.total}: ${c.title}.`;
  const idea = firstSentences(c.explanation, 2);
  const q = ctx.question
    ? ctx.question.kind === "mcq"
      ? `The question is: ${ctx.question.prompt} There are ${ctx.question.options?.length ?? 0} options to choose from.`
      : `The question asks for a short written answer: ${ctx.question.prompt}`
    : "There's no question on screen yet.";
  const visual = ctx.visualization ? `There's an interactive demo, "${ctx.visualization.title}", ${demoStatus(ctx.visualization)}.` : c.illustration ? `The picture shows this: ${c.illustration}` : "";
  return [where, idea, q, visual, progressLine(ctx), "Ask me for a hint, to explain the diagram, or to put it another way."].filter(Boolean).join(" ");
}

function diagram(ctx: WorkspaceContext): string {
  const v = ctx.visualization;
  if (v) {
    const next =
      v.status === "idle"
        ? "Press Play to run it, or Step to go through it one step at a time."
        : v.status === "checkpoint"
          ? "Pick what you think happens next and I'll show you."
          : v.status === "answered"
            ? "Press Continue to see what happens."
            : v.status === "done"
              ? "You can press Replay to watch it again, or change the settings and run it with different values."
              : "Keep watching, or press Pause to stay on this step.";
    const settings = v.parameters.length > 0 ? ` Current settings: ${v.parameters.map((p) => `${p.label} ${p.value}`).join(", ")}.` : "";
    return `The demo is "${v.title}". ${v.summary} Right now it's ${demoStatus(v)}.${settings} ${next}`;
  }
  if (ctx.concept.illustration) return `The picture shows this: ${ctx.concept.illustration} The explanation above the question says more: ${firstSentences(ctx.concept.explanation, 2)}`;
  return `There's no diagram on this screen. What you're looking at is the explanation of ${ctx.concept.title}, then the question. Want me to put the explanation another way?`;
}

function mistake(ctx: WorkspaceContext, memory: AskMemory): string {
  const a = ctx.answer;
  if (ctx.revealed && (a.phase === "correct" || (a.phase === "complete" && ctx.answer.attempts > 0 && ctx.revealed.whyCorrect && !ctx.revealed.answer))) {
    return `Nothing went wrong there, you got it. ${ctx.revealed.whyCorrect}`;
  }
  if (ctx.revealed && a.phase === "correct") return `Nothing went wrong there, you got it. ${ctx.revealed.whyCorrect}`;
  if (ctx.revealed && (a.phase === "revealed" || a.phase === "complete")) return `You've seen the answer for this one: ${ctx.revealed.answer} ${ctx.revealed.whyCorrect} We'll practise it again later.`;
  if (a.attempts === 0) return "You haven't checked an answer yet, so nothing has gone wrong. Give it a go; if it's not right, I'll point at the gap without giving it away.";
  const submitted = a.lastSubmitted ?? a.current;
  const chosen = ctx.question?.kind === "mcq" && submitted ? optionText(ctx, submitted) : null;
  const what = chosen ? `You picked ${chosen}. That isn't it, and I won't give the answer away.` : submitted ? `Your answer was "${firstSentences(submitted)}". It's missing part of the idea.` : "Your last answer wasn't quite right.";
  const feedback = a.feedback ? ` ${firstSentences(a.feedback, 2)}` : "";
  const hint = nextHint(ctx, memory);
  const other = ctx.concept.alternateExplanation ? ` Another way to think about it: ${firstSentences(ctx.concept.alternateExplanation, 2)}` : "";
  return `${what}${feedback}${hint ? ` Here's a hint: ${hint}` : ""}${other}`;
}

/** The next hint the student has not heard: the lesson's own hints in order, then the alternate explanation. */
function nextHint(ctx: WorkspaceContext, memory: AskMemory): string | null {
  const { given, remaining } = ctx.hints;
  if (memory.hintsAsked < remaining.length) return remaining[memory.hintsAsked];
  const all = [...given, ...remaining];
  if (all.length > 0) return all[all.length - 1];
  return ctx.concept.alternateExplanation ? firstSentences(ctx.concept.alternateExplanation, 2) : null;
}

function hint(ctx: WorkspaceContext, memory: AskMemory): string {
  const a = ctx.answer;
  if (ctx.revealed && (a.phase === "correct" || a.phase === "revealed" || a.phase === "complete")) return `You've finished this one. ${ctx.revealed.whyCorrect}`;
  const h = nextHint(ctx, memory);
  const exhausted = memory.hintsAsked >= ctx.hints.remaining.length && ctx.hints.remaining.length + ctx.hints.given.length > 0;
  if (!h) return `Look again at the key idea: ${firstSentences(ctx.concept.explanation, 2)} Then try the question in your own words.`;
  return exhausted ? `That's the last hint I have: ${h} Try the question with that in mind.` : `Here's a hint: ${h}`;
}

function anotherWay(ctx: WorkspaceContext): string {
  const alt = ctx.concept.alternateExplanation;
  const base = alt ? `Let me put it another way. ${alt}` : `Here's the idea again, more simply: ${firstSentences(ctx.concept.explanation, 2)}`;
  const demo = ctx.visualization ? " You can also run the demo again and watch it step by step." : "";
  return `${base}${demo}`;
}

/** What the student has already been told through the ask box, so hints move forward. */
export type AskMemory = { hintsAsked: number };

/** A local answer for the intents the context can answer by itself; null means the question needs the AI. */
export function localAnswer(ctx: WorkspaceContext, intent: AskIntent, memory: AskMemory = { hintsAsked: 0 }): LocalAnswer | null {
  switch (intent) {
    case "overview":
      return { text: overview(ctx), state: "idle" };
    case "diagram":
      return { text: diagram(ctx), state: "idle" };
    case "mistake":
      return { text: mistake(ctx, memory), state: "hinting" };
    case "hint":
      return { text: hint(ctx, memory), state: "hinting" };
    case "another-way":
      return { text: anotherWay(ctx), state: "hinting" };
    default:
      return null;
  }
}

/** When a free-form question cannot reach the AI: say so, and still describe the screen. */
export function fallbackAnswer(ctx: WorkspaceContext, reason: "no-ai" | "failed"): LocalAnswer {
  const lead =
    reason === "no-ai"
      ? "I can't take free questions without an AI provider set up, but I can still see your screen. "
      : "I couldn't reach the AI tutor just now, but here's what I can tell you myself. ";
  return { text: `${lead}${overview(ctx)}`, state: "thinking" };
}

/** When nothing is open to look at. */
export const NOTHING_OPEN = "Open a lesson first and I'll be able to see what you're working on: the explanation, the question, and any demo on the screen.";
