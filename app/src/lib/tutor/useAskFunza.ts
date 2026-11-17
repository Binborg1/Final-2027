"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tutorApi, useTutorAiStatus, type TutorAiStatus } from "@/lib/ai/tutor-client";
import type { Speech } from "@/lib/speech/useSpeech";
import { detectIntent, fallbackAnswer, localAnswer, NOTHING_OPEN, type LocalAnswer } from "@/lib/tutor/askFunza";
import type { TutorLine } from "@/lib/tutor/tutorLine";
import { workspaceForPrompt, type WorkspaceContext } from "@/lib/workspace/context";

export type AskFunza = {
  /** The reply, shown in the mascot's bubble in place of the lesson line until the lesson moves on. */
  line: TutorLine | null;
  busy: boolean;
  ai: TutorAiStatus | null;
  ask: (question: string) => Promise<void>;
  /** The same, about one screenshot the student has reviewed and chosen to send. */
  askAboutScreenshot: (question: string, imageDataUrl: string) => Promise<void>;
  clear: () => void;
};

type Options = {
  /** The reply belongs to this lesson state; when it changes, the reply is stale and disappears. */
  clearKey: string;
  /** In tutor mode, speaks through the session so the script picks up again afterwards. */
  interject?: ((text: string) => Promise<void>) | null;
};

/** Everything the box remembers about one lesson state. A different key means a fresh slot. */
type Slot = { key: string; line: TutorLine | null; busy: boolean; hintsAsked: number };

const fresh = (key: string): Slot => ({ key, line: null, busy: false, hintsAsked: 0 });

/**
 * "Ask Funza about this screen": answers from the structured workspace
 * context, locally for the common questions and through the AI tutor for
 * anything else, then speaks the reply with the mascot.
 */
export function useAskFunza(ctx: WorkspaceContext | null, speech: Speech, { clearKey, interject = null }: Options): AskFunza {
  const ai = useTutorAiStatus();
  const [slot, setSlot] = useState<Slot>(() => fresh(clearKey));
  const counter = useRef(0);
  const request = useRef(0);
  const latest = useRef({ ctx, interject, key: clearKey });
  const { speak } = speech;

  useEffect(() => {
    latest.current = { ctx, interject, key: clearKey };
  }, [ctx, interject, clearKey]);

  // The slot only counts while the lesson is still in the state it was made for.
  const current = slot.key === clearKey ? slot : fresh(clearKey);

  const update = useCallback((key: string, patch: (s: Slot) => Partial<Slot>) => {
    setSlot((prev) => {
      const base = prev.key === key ? prev : fresh(key);
      return { ...base, ...patch(base) };
    });
  }, []);

  const deliver = useCallback(
    (key: string, answer: LocalAnswer, spoken = true) => {
      counter.current++;
      const line: TutorLine = { key: `ask-${counter.current}`, state: answer.state, text: answer.text };
      update(key, () => ({ line, busy: false }));
      if (!spoken) return;
      const say = latest.current.interject;
      if (say) void say(answer.text);
      else speak(answer.text);
    },
    [speak, update],
  );

  const ask = useCallback(
    async (question: string) => {
      const { ctx: workspace, key } = latest.current;
      if (!workspace) {
        deliver(key, { text: NOTHING_OPEN, state: "thinking" });
        return;
      }
      const intent = detectIntent(question);
      const local = localAnswer(workspace, intent, { hintsAsked: current.hintsAsked });
      if (local) {
        deliver(key, local);
        if (intent === "hint" || intent === "mistake") update(key, (s) => ({ hintsAsked: s.hintsAsked + 1 }));
        return;
      }
      if (!ai?.configured) {
        deliver(key, fallbackAnswer(workspace, "no-ai"));
        return;
      }
      const mine = ++request.current;
      deliver(key, { text: "Let me look at that...", state: "thinking" }, false);
      update(key, () => ({ busy: true }));
      const result = await tutorApi.ask({ question, context: workspaceForPrompt(workspace), courseName: workspace.course.name });
      if (request.current !== mine || latest.current.key !== key) return; // the lesson moved on, or another question came in
      deliver(key, result.ok ? { text: result.data.text, state: "hinting" } : fallbackAnswer(workspace, "failed"));
    },
    [ai, current.hintsAsked, deliver, update],
  );

  const askAboutScreenshot = useCallback(
    async (question: string, imageDataUrl: string) => {
      const { ctx: workspace, key } = latest.current;
      if (!ai?.configured) {
        deliver(key, { text: "No AI provider is configured, so I can't analyze a screenshot. I can still describe what's open in Funza.", state: "thinking" });
        return;
      }
      const mine = ++request.current;
      deliver(key, { text: "Looking at your screenshot...", state: "thinking" }, false);
      update(key, () => ({ busy: true }));
      const result = await tutorApi.analyzeScreen({
        question,
        context: workspace ? workspaceForPrompt(workspace) : "Nothing is open in Funza right now.",
        courseName: workspace?.course.name ?? "Funza",
        image: imageDataUrl,
      });
      if (request.current !== mine || latest.current.key !== key) return;
      if (result.ok) deliver(key, { text: result.data.text, state: "hinting" });
      else if (result.reason === "no-vision") deliver(key, { text: result.message, state: "thinking" });
      else deliver(key, { text: `I couldn't analyze the screenshot: ${result.message} The image was not kept.`, state: "thinking" });
    },
    [ai, deliver, update],
  );

  const clear = useCallback(() => {
    request.current++;
    setSlot(fresh(latest.current.key));
  }, []);

  return { line: current.line, busy: current.busy, ai, ask, askAboutScreenshot, clear };
}
