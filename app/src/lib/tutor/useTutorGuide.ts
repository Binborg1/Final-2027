"use client";

import { useEffect, useRef } from "react";
import type { Speech } from "@/lib/speech/useSpeech";
import { tutorLine, type TutorContext, type TutorLine } from "@/lib/tutor/tutorLine";

/**
 * Turns lesson state into the tutor's current line and speaks each new line
 * once (when the voice is on and the student has interacted with the page).
 * With `enabled` false (tutor mode running) it still tracks lines but stays quiet.
 * A `silent` line is shown but left for the demo to narrate.
 */
export function useTutorGuide(ctx: TutorContext, speech: Speech, enabled = true): TutorLine {
  const line = tutorLine(ctx);
  const spokenKey = useRef<string | null>(null);
  const { speak } = speech;

  useEffect(() => {
    if (spokenKey.current === line.key) return;
    spokenKey.current = line.key;
    if (enabled && !line.silent) speak(line.text);
  }, [line.key, line.text, line.silent, speak, enabled]);

  return line;
}

/** Speaks any line when it changes; the TeachView uses this with its own script. */
export function useSpokenLine(line: TutorLine, speech: Speech) {
  const spokenKey = useRef<string | null>(null);
  const { speak } = speech;
  useEffect(() => {
    if (spokenKey.current === line.key) return;
    spokenKey.current = line.key;
    if (!line.silent) speak(line.text);
  }, [line.key, line.text, line.silent, speak]);
}
