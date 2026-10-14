import type { VisualizationCheckpoint } from "./types";

/**
 * Playback state for a visualization, as a pure reducer so the tutor flow and
 * the tests can reason about it. Steps advance one at a time; a checkpoint
 * before a step blocks the demo until the student has made their prediction.
 */
export type PlayerState = {
  step: number;
  playing: boolean;
  /** Index of the checkpoint the demo is stopped at, or null. */
  gate: number | null;
  /** The option chosen at each checkpoint index. */
  answers: Record<number, string>;
  /** The demo has been played or stepped at least once (survives Reset). */
  started: boolean;
};

export type PlayerEvent =
  | { type: "play" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "forward" }
  | { type: "tick" }
  | { type: "answer"; option: string };

export type PlayerContext = { stepCount: number; checkpoints: VisualizationCheckpoint[] };

export type PlayerStatus = "idle" | "showing" | "checkpoint" | "answered" | "done";

export const initialPlayer: PlayerState = { step: 0, playing: false, gate: null, answers: {}, started: false };

function lastStep(ctx: PlayerContext) {
  return Math.max(0, ctx.stepCount - 1);
}

function gateBefore(next: number, ctx: PlayerContext, answers: PlayerState["answers"]): number | null {
  const i = ctx.checkpoints.findIndex((c) => c.beforeStep === next);
  return i >= 0 && answers[i] === undefined ? i : null;
}

/** One step on; stops before an unanswered checkpoint and at the end. */
function advance(state: PlayerState, ctx: PlayerContext, keepPlaying: boolean): PlayerState {
  const last = lastStep(ctx);
  if (state.gate !== null) {
    if (state.answers[state.gate] === undefined) return state; // the prediction comes first
    const target = Math.min(ctx.checkpoints[state.gate].beforeStep, last);
    return { ...state, gate: null, step: target, playing: keepPlaying && target < last, started: true };
  }
  if (state.step >= last) return state.playing ? { ...state, playing: false } : state;
  const next = state.step + 1;
  const gate = gateBefore(next, ctx, state.answers);
  if (gate !== null) return { ...state, gate, playing: false, started: true };
  return { ...state, step: next, playing: keepPlaying && next < last, started: true };
}

export function reducePlayer(state: PlayerState, event: PlayerEvent, ctx: PlayerContext): PlayerState {
  switch (event.type) {
    case "play": {
      if (state.gate !== null) return advance(state, ctx, true);
      if (state.step >= lastStep(ctx)) return { ...initialPlayer, playing: true, started: true }; // replay from the top
      return state.playing ? state : { ...state, playing: true, started: true };
    }
    case "pause":
      return state.playing ? { ...state, playing: false } : state;
    case "reset":
      return state.step === 0 && !state.playing && state.gate === null ? state : { ...initialPlayer, started: state.started };
    case "forward":
      return advance(state, ctx, false);
    case "tick":
      return state.playing ? advance(state, ctx, true) : state;
    case "answer":
      if (state.gate === null || state.answers[state.gate] !== undefined) return state;
      return { ...state, answers: { ...state.answers, [state.gate]: event.option } };
  }
}

export function playerStatus(state: PlayerState, ctx: PlayerContext): PlayerStatus {
  if (state.gate !== null) return state.answers[state.gate] === undefined ? "checkpoint" : "answered";
  if (ctx.stepCount > 0 && state.step >= lastStep(ctx)) return "done";
  if (state.step === 0 && !state.playing) return "idle";
  return "showing";
}
