"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Speech } from "@/lib/speech/useSpeech";
import { tutorScript, vizSignature, type TutorLine, type TutorPlan, type TutorScriptContext, type TutorStep } from "@/lib/tutor/tutorLine";
import type { VisualizationDriver } from "@/lib/visualizations/usePlayer";

export type TutorSession = {
  active: boolean;
  paused: boolean;
  step: TutorStep;
  /** What the tutor is saying or showing right now; null when tutor mode is off. */
  line: TutorLine | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  exit: () => void;
};

type LessonActions = {
  retry: () => void;
  /** The concept's demo, when it has one, so the tutor can start and resume it. */
  visualization?: VisualizationDriver | null;
};

/**
 * Tutor mode: a scripted session that walks the student through the lesson.
 *   idle -> explaining -> asking -> waiting -> evaluating -> feedback -> (next question)
 * with a hint/retry branch after a wrong answer, and for concepts with a demo
 *   explaining -> showing -> predicting -> feedback -> showing -> asking.
 * Each transition waits for the previous speech to finish (speech completion,
 * never timers). The lesson's own state and evaluation stay in charge; this
 * only reacts to them and narrates.
 */
export function useTutorSession(ctx: TutorScriptContext, speech: Speech, actions: LessonActions): TutorSession {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<TutorStep>("off");
  const [line, setLine] = useState<TutorLine | null>(null);
  const generation = useRef(0);
  const counter = useRef(0);
  const lastSignature = useRef<string | null>(null);
  const actionsRef = useRef(actions);
  const { say, stop, pause: pauseSpeech, resume: resumeSpeech, paused, setEnabled } = speech;

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const show = useCallback((step: TutorStep, state: TutorLine["state"], text: string) => {
    counter.current++;
    setStep(step);
    setLine({ key: `tutor-${counter.current}`, state, text });
  }, []);

  const run = useCallback(
    async (plan: TutorPlan) => {
      const mine = ++generation.current;
      if (plan.preStep) setStep(plan.preStep);
      for (const u of plan.utterances) {
        if (generation.current !== mine) return;
        show(u.step, u.state, u.text);
        const finished = await say(u.text);
        if (generation.current !== mine || !finished) return;
      }
      if (generation.current !== mine) return;
      setStep(plan.thenStep);
      if (plan.thenLine) show(plan.thenStep, plan.thenLine.state, plan.thenLine.text);
      const { retry, visualization } = actionsRef.current;
      if (plan.thenAction === "retry") retry();
      else if (plan.thenAction === "viz-start") visualization?.start();
      else if (plan.thenAction === "viz-resume") visualization?.resume();
    },
    [say, show],
  );

  const signature = ctx.finished ? "done" : `${ctx.concept?.id}:${ctx.phase}:${ctx.attempts}:${ctx.notice ? "n" : ""}:${vizSignature(ctx.viz)}`;

  // React to the lesson moving to a new state. While paused, the reaction waits until Resume.
  useEffect(() => {
    if (!active || paused) return;
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    void run(tutorScript(ctx));
  }, [active, paused, signature, run, ctx]);

  const start = useCallback(() => {
    setEnabled(true);
    generation.current++;
    lastSignature.current = null;
    counter.current++;
    actionsRef.current.visualization?.reset(); // the demo is part of the script, so it starts from the top
    setLine({ key: `tutor-${counter.current}`, state: "idle", text: "Starting tutor mode..." });
    setActive(true);
  }, [setEnabled]);

  const exit = useCallback(() => {
    generation.current++;
    lastSignature.current = null;
    stop();
    actionsRef.current.visualization?.pause();
    setActive(false);
    setStep("off");
    setLine(null);
  }, [stop]);

  return { active, paused, step, line, start, pause: pauseSpeech, resume: resumeSpeech, exit };
}
