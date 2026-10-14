"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { initialPlayer, playerStatus, reducePlayer, type PlayerEvent, type PlayerState, type PlayerStatus } from "./player";
import { definitionOf } from "./registry";
import type { VisualizationCheckpoint, VisualizationConfig, VisualizationDefinition, VisualizationStep, VisualizationType } from "./types";

/** How long a step stays on screen while playing, unless the step says otherwise. */
export const DEFAULT_HOLD = 2600;

export type PlayerOptions = {
  /** Playback and parameters start over whenever this changes (for example the concept id). */
  key?: string;
  /**
   * Speaks a caption and resolves when it has been said. When set, a playing
   * step waits for its caption to be spoken (and for its hold time) before moving on.
   */
  narrate?: (text: string) => Promise<boolean>;
  /** Freezes playback without changing state, for example while the tutor is paused. */
  held?: boolean;
};

/** The handle the tutor session uses to drive a demo. */
export type VisualizationDriver = {
  /** From the top, playing. */
  start: () => void;
  /** Carries on after an answered prediction (or from a pause). */
  resume: () => void;
  pause: () => void;
  reset: () => void;
};

export type Player = {
  type: VisualizationType | null;
  definition: VisualizationDefinition<Record<string, unknown>> | null;
  params: Record<string, unknown>;
  steps: VisualizationStep[];
  checkpoints: VisualizationCheckpoint[];
  state: PlayerState;
  status: PlayerStatus;
  current: VisualizationStep | null;
  /** The prediction question the demo is stopped at, if any. */
  checkpoint: VisualizationCheckpoint | null;
  checkpointIndex: number | null;
  /** The option chosen at that checkpoint, and whether it was the right one. */
  chosen: string | null;
  answerRight: boolean | null;
  play: () => void;
  pause: () => void;
  reset: () => void;
  forward: () => void;
  answer: (option: string) => void;
  setParam: (key: string, value: unknown) => void;
  driver: VisualizationDriver;
};

const noParams: Record<string, unknown> = {};

/**
 * Owns playback for one visualization: the current step, play/pause/step/reset,
 * the prediction checkpoints, and the parameters the student can change.
 * Pass `null` to get an inert player (so the hook can always be called).
 */
export function usePlayer(config: VisualizationConfig | null, options: PlayerOptions = {}): Player {
  const { key = "", narrate, held = false } = options;
  const type = config?.type ?? null;
  const definition = useMemo(() => (type ? definitionOf(type) : null), [type]);

  const [params, setParams] = useState<Record<string, unknown>>(config?.params ?? noParams);
  const [state, setState] = useState<PlayerState>(initialPlayer);

  // A new key (a new concept) or a new type starts the demo over with the config's own parameters.
  const resetKey = `${key}|${type ?? ""}`;
  const [trackedKey, setTrackedKey] = useState(resetKey);
  if (trackedKey !== resetKey) {
    setTrackedKey(resetKey);
    setParams(config?.params ?? noParams);
    setState(initialPlayer);
  }

  const steps = useMemo(() => (definition ? definition.steps(params) : []), [definition, params]);
  const checkpoints = useMemo(() => (definition ? definition.checkpoints(params) : []), [definition, params]);
  const stepCount = steps.length;

  const dispatch = useCallback(
    (event: PlayerEvent) => setState((prev) => reducePlayer(prev, event, { stepCount, checkpoints })),
    [stepCount, checkpoints],
  );

  // While playing: narrate the step (when a voice is given), keep it on screen for its hold time, then move on.
  useEffect(() => {
    if (!state.playing || held || steps.length === 0) return;
    const step = steps[Math.min(state.step, steps.length - 1)];
    const hold = step.hold ?? DEFAULT_HOLD;
    const begun = Date.now();
    let cancelled = false;
    let timer: number | undefined;
    (async () => {
      if (narrate) await narrate(step.caption); // an interrupted voice still lets the demo continue
      if (cancelled) return;
      const remaining = hold - (Date.now() - begun);
      if (remaining > 0) {
        await new Promise<void>((resolve) => {
          timer = window.setTimeout(resolve, remaining);
        });
      }
      if (cancelled) return;
      dispatch({ type: "tick" });
    })();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [state.playing, state.step, state.gate, held, steps, narrate, dispatch]);

  const play = useCallback(() => dispatch({ type: "play" }), [dispatch]);
  const pause = useCallback(() => dispatch({ type: "pause" }), [dispatch]);
  const reset = useCallback(() => dispatch({ type: "reset" }), [dispatch]);
  const forward = useCallback(() => dispatch({ type: "forward" }), [dispatch]);
  const answer = useCallback((option: string) => dispatch({ type: "answer", option }), [dispatch]);

  const setParam = useCallback(
    (name: string, value: unknown) => {
      if (!definition) return;
      setParams((prev) => definition.applyControl(prev, name, value));
      setState((prev) => ({ ...initialPlayer, started: prev.started })); // a new scenario starts over
    },
    [definition],
  );

  const driver = useMemo<VisualizationDriver>(
    () => ({
      start: () => {
        dispatch({ type: "reset" });
        dispatch({ type: "play" });
      },
      resume: () => dispatch({ type: "play" }),
      pause: () => dispatch({ type: "pause" }),
      reset: () => dispatch({ type: "reset" }),
    }),
    [dispatch],
  );

  const status = playerStatus(state, { stepCount, checkpoints });
  const checkpoint = state.gate !== null ? (checkpoints[state.gate] ?? null) : null;
  const chosen = state.gate !== null ? (state.answers[state.gate] ?? null) : null;

  return {
    type,
    definition,
    params,
    steps,
    checkpoints,
    state,
    status,
    current: steps[Math.min(state.step, Math.max(0, steps.length - 1))] ?? null,
    checkpoint,
    checkpointIndex: state.gate,
    chosen,
    answerRight: checkpoint && chosen !== null ? chosen === checkpoint.correctId : null,
    play,
    pause,
    reset,
    forward,
    answer,
    setParam,
    driver,
  };
}
