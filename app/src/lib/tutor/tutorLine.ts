import type { MascotState } from "@/components/mascot/FunzaMascot";
import type { Concept } from "@/lib/types";
import type { VisualizationCheckpoint } from "@/lib/visualizations/types";
import type { VisualizationTutorState } from "@/lib/visualizations/tutorState";

export type LessonPhase = "asking" | "incorrect" | "correct" | "revealed";

/** After this many wrong attempts the student may ask to see the answer. */
export const REVEAL_AFTER_ATTEMPTS = 3;

export type TutorContext = {
  concept?: Concept;
  index: number;
  total: number;
  phase: LessonPhase;
  attempts: number;
  /** A message such as "Choose one option first", shown before an attempt counts. */
  notice: string | null;
  finished: boolean;
  completed: number;
  missed: number;
  /** The concept's interactive demo, when it has one. */
  viz?: VisualizationTutorState | null;
};

export type TutorLine = {
  /** Changes whenever the tutor should say something new. */
  key: string;
  state: MascotState;
  text: string;
  /** Shown but not spoken, because something else (the demo) is already narrating it. */
  silent?: boolean;
};

export function questionSpeech(concept: Concept) {
  const q = concept.question;
  if (q.kind === "mcq") {
    const options = q.options.map((o) => `${o.id.toUpperCase()}: ${o.text}`).join(" ");
    return `${q.prompt} Your options are: ${options}`;
  }
  return `${q.prompt} Put it in your own words, then I'll check it.`;
}

export function hintFor(concept: Concept, attempts: number) {
  return concept.hints[Math.min(Math.max(attempts, 1), concept.hints.length) - 1] ?? "";
}

export function revealedAnswer(concept: Concept) {
  const q = concept.question;
  return q.kind === "mcq" ? (q.options.find((o) => o.id === q.correctOptionId)?.text ?? "") : q.sampleAnswer;
}

/** A prediction question, read aloud with its options. */
export function checkpointSpeech(checkpoint: VisualizationCheckpoint) {
  const options = checkpoint.options.map((o) => `${o.id.toUpperCase()}: ${o.text}`).join(" ");
  return `${checkpoint.prompt} Your options are: ${options}`;
}

/**
 * The part of a lesson state's signature that comes from the demo. It changes
 * only at the moments the tutor reacts to (a prediction, its answer, the end),
 * never from one animation step to the next.
 */
export function vizSignature(viz?: VisualizationTutorState | null): string {
  if (!viz) return "";
  switch (viz.status) {
    case "checkpoint":
      return `cp${viz.checkpointIndex}`;
    case "answered":
      return `cp${viz.checkpointIndex}:${viz.answerRight ? "r" : "w"}`;
    case "idle":
      return viz.started ? "idle:again" : "idle";
    default:
      return viz.status;
  }
}

/** The teaching script for the manual voice: one line per lesson state. Pure. */
export function tutorLine(ctx: TutorContext): TutorLine {
  const { concept, index, total, phase, attempts, notice, finished, completed, missed, viz } = ctx;

  if (finished || !concept) {
    const text =
      missed > 0
        ? `You made it through all ${total}, with ${completed} understood. Want to practise the ${missed} you missed? I'm right here.`
        : `You did it! ${completed} of ${total} understood. Great work. Take a breath, then pick the next topic.`;
    return { key: "finished", state: "celebrating", text };
  }

  const base = `${concept.id}:${phase}:${attempts}`;

  if (phase === "asking") {
    if (notice) return { key: `${base}:notice`, state: "hinting", text: notice };
    if (attempts === 0) {
      const opener =
        index === 0
          ? "Hey! Let's figure this out together. Here's the idea."
          : `Nice, on to the next one: ${concept.title}.`;
      if (viz) {
        const vb = `${base}:viz:${vizSignature(viz)}`;
        switch (viz.status) {
          case "idle":
            return viz.started
              ? { key: vb, state: "idle", text: `Press Play to run the demo again, or go straight to the question. ${questionSpeech(concept)}` }
              : {
                  key: vb,
                  state: "idle",
                  text: `${opener} ${concept.explanation} Press Play on the demo to watch it happen. I'll stop you partway for a quick prediction, and then the question is yours.`,
                };
          case "showing":
            return { key: vb, state: "idle", text: viz.caption, silent: true };
          case "checkpoint":
            return {
              key: vb,
              state: "thinking",
              text: `Quick prediction before I show the next part. ${viz.checkpoint ? checkpointSpeech(viz.checkpoint) : ""}`,
            };
          case "answered":
            return {
              key: vb,
              state: viz.answerRight ? "celebrating" : "hinting",
              text: viz.answerRight
                ? `${viz.checkpoint?.whenRight ?? ""} Press Continue to watch it.`
                : `${viz.checkpoint?.whenWrong ?? ""} Press Continue and watch what really happens.`,
            };
          case "done":
            return { key: vb, state: "idle", text: `${viz.lastCaption} That's the whole demonstration. Now you try. ${questionSpeech(concept)}` };
        }
      }
      return { key: base, state: "idle", text: `${opener} ${concept.explanation} Now you try. ${questionSpeech(concept)}` };
    }
    return { key: base, state: "hinting", text: `Take your time. Remember: ${hintFor(concept, attempts)}` };
  }

  if (phase === "incorrect") {
    if (attempts <= 1) {
      return {
        key: base,
        state: "thinking",
        text: `Hmm, not quite. Here's a hint: ${hintFor(concept, attempts)} Have another look and try again.`,
      };
    }
    return {
      key: base,
      state: "hinting",
      text: `Let me put it another way. ${concept.alternateExplanation} One more hint: ${hintFor(concept, attempts)} Give it another go.`,
    };
  }

  if (phase === "correct") {
    const next = index + 1 < total ? "Ready for the next one?" : "That was the last one. Let's see how you did.";
    return { key: base, state: "celebrating", text: `Yes, that's it! ${concept.whyCorrect} ${next}` };
  }

  return {
    key: base,
    state: "thinking",
    text: `Here's the answer: ${revealedAnswer(concept)} ${concept.whyCorrect} We'll come back to this one later, no worries.`,
  };
}

/* ---------- tutor mode: a scripted session ---------- */

export type TutorStep = "off" | "explaining" | "showing" | "predicting" | "asking" | "waiting" | "evaluating" | "feedback" | "hint" | "complete";

export type TutorUtterance = { step: TutorStep; state: MascotState; text: string };

/** What the tutor does when the lesson reaches a state: things to say in order, then where to settle. */
export type TutorPlan = {
  preStep?: TutorStep;
  utterances: TutorUtterance[];
  thenStep: TutorStep;
  /** Shown, not spoken, once the utterances are done. */
  thenLine?: { state: MascotState; text: string };
  /** A lesson action to take once the utterances are done. */
  thenAction?: "retry" | "viz-start" | "viz-resume";
};

export type TutorScriptContext = TutorContext & { topicTitle: string; learned: string[] };

const YOUR_TURN = "Your turn. Pick an answer and press Check understanding. I'll wait.";

/** The tutor-mode script for one lesson state. Pure. */
export function tutorScript(ctx: TutorScriptContext): TutorPlan {
  const { concept, index, total, phase, attempts, notice, finished, completed, missed, topicTitle, learned, viz } = ctx;

  if (finished || !concept) {
    const recap = learned.length > 0 ? ` Today you worked through: ${learned.join("; ")}.` : "";
    const close =
      missed > 0
        ? ` You understood ${completed} of ${total}; ${missed} ${missed === 1 ? "is" : "are"} marked to practise again. Press Practise when you want another go.`
        : ` You understood all ${total}. Great work!`;
    return {
      utterances: [{ step: "complete", state: "celebrating", text: `That's the end of ${topicTitle}.${recap}${close}` }],
      thenStep: "complete",
    };
  }

  if (phase === "asking") {
    if (notice) {
      return {
        utterances: [{ step: "feedback", state: "hinting", text: notice }],
        thenStep: "waiting",
        thenLine: { state: "idle", text: YOUR_TURN },
      };
    }
    if (attempts > 0) {
      return {
        utterances: [],
        thenStep: "waiting",
        thenLine: { state: "hinting", text: `Hint: ${hintFor(concept, attempts)} Take your time and try again.` },
      };
    }
    const opener =
      index === 0
        ? `Welcome to ${topicTitle}. Let's work through it together. First idea: ${concept.title}.`
        : `Next up: ${concept.title}.`;

    if (viz) return visualizationPlan(viz, concept, `${opener} ${concept.explanation}`);

    return {
      preStep: "explaining",
      utterances: [
        { step: "explaining", state: "idle", text: `${opener} ${concept.explanation}` },
        { step: "asking", state: "idle", text: `Now you try. ${questionSpeech(concept)}` },
      ],
      thenStep: "waiting",
      thenLine: { state: "idle", text: YOUR_TURN },
    };
  }

  if (phase === "incorrect") {
    const canRetry = attempts < REVEAL_AFTER_ATTEMPTS;
    const hint = hintFor(concept, attempts);
    const more = attempts >= 2 ? ` Another way to see it: ${concept.alternateExplanation}` : "";
    return {
      preStep: "evaluating",
      utterances: [
        { step: "feedback", state: "thinking", text: "Hmm, not quite." },
        {
          step: "hint",
          state: "hinting",
          text: `Here's a hint: ${hint}${more}${canRetry ? " Have another go." : " You can try once more, or press Show me the answer."}`,
        },
      ],
      thenStep: "waiting",
      thenLine: { state: "hinting", text: `Hint: ${hint}` },
      thenAction: canRetry ? "retry" : undefined,
    };
  }

  if (phase === "correct") {
    const next = index + 1 < total ? "Press Continue when you're ready for the next one." : "Press Finish topic to see how you did.";
    return {
      preStep: "evaluating",
      utterances: [{ step: "feedback", state: "celebrating", text: `Yes, that's it! ${concept.whyCorrect} ${next}` }],
      thenStep: "feedback",
    };
  }

  return {
    preStep: "evaluating",
    utterances: [
      {
        step: "feedback",
        state: "thinking",
        text: `Here's the answer: ${revealedAnswer(concept)} ${concept.whyCorrect} We'll practise this one again later. Press Continue when you're ready.`,
      },
    ],
    thenStep: "feedback",
  };
}

/**
 * Teaching with a demo: explain, introduce the demo and run it; stop at the
 * prediction and ask; respond; carry on; then ask the lesson's question.
 * The outcome of a prediction is never shown before the student has answered,
 * because the player itself refuses to move past an unanswered checkpoint.
 */
function visualizationPlan(viz: VisualizationTutorState, concept: Concept, explanation: string): TutorPlan {
  switch (viz.status) {
    case "idle":
      if (viz.started) {
        return {
          preStep: "showing",
          utterances: [{ step: "showing", state: "idle", text: "Let's run it again from the top." }],
          thenStep: "showing",
          thenAction: "viz-start",
        };
      }
      return {
        preStep: "explaining",
        utterances: [
          { step: "explaining", state: "idle", text: explanation },
          {
            step: "showing",
            state: "idle",
            text: `Let me show you. ${viz.summary} Watch the demo; I'll stop partway and ask you to predict what happens next.`,
          },
        ],
        thenStep: "showing",
        thenAction: "viz-start",
      };
    case "showing":
      return { utterances: [], thenStep: "showing" };
    case "checkpoint":
      return {
        preStep: "asking",
        utterances: [{ step: "predicting", state: "thinking", text: `Let's pause here. ${viz.checkpoint ? checkpointSpeech(viz.checkpoint) : ""}` }],
        thenStep: "predicting",
        thenLine: { state: "hinting", text: "Pick what you think happens next. It's a prediction, not a test." },
      };
    case "answered":
      return {
        preStep: "evaluating",
        utterances: [
          {
            step: "feedback",
            state: viz.answerRight ? "celebrating" : "hinting",
            text: viz.answerRight ? `${viz.checkpoint?.whenRight ?? ""} Let's watch it happen.` : `${viz.checkpoint?.whenWrong ?? ""} Watch what actually happens.`,
          },
        ],
        thenStep: "showing",
        thenAction: "viz-resume",
      };
    case "done":
      return {
        preStep: "showing",
        utterances: [
          { step: "showing", state: "idle", text: viz.lastCaption },
          { step: "asking", state: "idle", text: `That's the whole demonstration. Now you try. ${questionSpeech(concept)}` },
        ],
        thenStep: "waiting",
        thenLine: { state: "idle", text: YOUR_TURN },
      };
  }
}
