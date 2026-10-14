"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useVoiceEnabled, voiceStore } from "@/lib/storage";

export type Speech = {
  /** The browser has the Web Speech API. */
  supported: boolean;
  /** The student turned the voice on (persisted; off by default). */
  enabled: boolean;
  /** The student has clicked or typed on this page, so speech may start automatically. */
  interacted: boolean;
  speaking: boolean;
  paused: boolean;
  error: string | null;
  lastText: string | null;
  setEnabled: (enabled: boolean) => void;
  /** Speaks `text` when the voice is on, always remembering it for replay. */
  speak: (text: string) => void;
  /**
   * Speaks `text` and resolves when playback has finished (true), or when it was
   * interrupted by another utterance, Stop or Exit (false). Resolves true at once
   * when speech is unavailable or fails, so a tutoring flow never gets stuck.
   */
  say: (text: string) => Promise<boolean>;
  /** Speaks even if nothing was spoken automatically yet; used by the speaker and replay buttons. */
  replay: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
};

/* First user interaction on the page, shared by every hook instance. */
let interactedFlag = false;
const interactionListeners = new Set<() => void>();
function markInteracted() {
  if (interactedFlag) return;
  interactedFlag = true;
  interactionListeners.forEach((l) => l());
}
function subscribeInteraction(listener: () => void) {
  interactionListeners.add(listener);
  if (interactionListeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("pointerdown", markInteracted, { passive: true });
    window.addEventListener("click", markInteracted);
    window.addEventListener("keydown", markInteracted);
  }
  return () => {
    interactionListeners.delete(listener);
  };
}

const noop = () => () => {};
const isSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

/** Prefers a natural-sounding English voice; falls back to any English voice, then the first voice. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const english = voices.filter((v) => /^en[-_]/i.test(v.lang));
  const preferred = [/natural/i, /google us english/i, /samantha/i, /aria/i, /jenny/i, /libby/i, /google uk english female/i, /zira/i];
  for (const re of preferred) {
    const match = english.find((v) => re.test(v.name));
    if (match) return match;
  }
  return english.find((v) => v.default) ?? english[0] ?? voices[0] ?? null;
}

/** Long utterances get cut off in some browsers, so speak sentence-sized chunks. */
function chunk(text: string, max = 220): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current && current.length + s.length + 1 > max) {
      out.push(current);
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current) out.push(current);
  return out.filter(Boolean);
}

export function useSpeech(): Speech {
  const supported = useSyncExternalStore(noop, isSupported, () => false);
  const enabled = useVoiceEnabled();
  const interacted = useSyncExternalStore(subscribeInteraction, () => interactedFlag, () => false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastText, setLastText] = useState<string | null>(null);
  const generation = useRef(0);
  const utterances = useRef<SpeechSynthesisUtterance[]>([]); // kept alive so onend fires in Chrome
  const timer = useRef<number | null>(null);
  const settle = useRef<((finished: boolean) => void) | null>(null);

  const stop = useCallback(() => {
    generation.current++;
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (isSupported()) window.speechSynthesis.cancel();
    utterances.current = [];
    settle.current?.(false);
    settle.current = null;
    setSpeaking(false);
    setPaused(false);
  }, []);

  const say = useCallback(
    (text: string): Promise<boolean> => {
      stop();
      const pieces = chunk(text);
      if (!isSupported() || pieces.length === 0) return Promise.resolve(true);
      const gen = ++generation.current;
      setError(null);
      setSpeaking(true);
      return new Promise<boolean>((resolve) => {
        const finish = (finished: boolean) => {
          if (settle.current !== finish) return;
          settle.current = null;
          setSpeaking(false);
          resolve(finished);
        };
        settle.current = finish;
        // A short pause after cancel() lets the engine reset before the next utterance.
        timer.current = window.setTimeout(() => {
          if (generation.current !== gen) return;
          const voice = pickVoice();
          let remaining = pieces.length;
          utterances.current = pieces.map((piece) => {
            const u = new SpeechSynthesisUtterance(piece);
            if (voice) u.voice = voice;
            u.lang = voice?.lang ?? "en-US";
            u.rate = 1;
            u.pitch = 1.05;
            u.onend = () => {
              if (generation.current !== gen) return;
              remaining--;
              if (remaining === 0) finish(true);
            };
            u.onerror = (event) => {
              if (generation.current !== gen) return;
              if (event.error === "interrupted" || event.error === "canceled") {
                finish(false);
                return;
              }
              setError("The browser could not play the voice. The text is still shown.");
              window.speechSynthesis.cancel();
              finish(true); // treat as finished so nothing waits on audio that will never play
            };
            return u;
          });
          for (const u of utterances.current) window.speechSynthesis.speak(u);
        }, 60);
      });
    },
    [stop],
  );

  const speak = useCallback(
    (text: string) => {
      setLastText(text);
      if (!enabled || !interactedFlag) return;
      void say(text);
    },
    [enabled, say],
  );

  const replay = useCallback(() => {
    if (lastText) void say(lastText);
  }, [lastText, say]);

  const pause = useCallback(() => {
    if (isSupported() && window.speechSynthesis.speaking) window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (isSupported()) window.speechSynthesis.resume();
    setPaused(false);
  }, []);

  const setEnabled = useCallback(
    (next: boolean) => {
      voiceStore.set(next);
      if (!next) stop();
    },
    [stop],
  );

  // Remember whatever `say` plays so Replay works in tutor mode too.
  const sayAndRemember = useCallback(
    (text: string) => {
      setLastText(text);
      return say(text);
    },
    [say],
  );

  // Stop on unmount, on navigation away, and when the tab is hidden.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") stop();
    };
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", onHide);
      stop();
    };
  }, [stop]);

  // Voices load asynchronously in some browsers; touching the list makes them available for the first utterance.
  useEffect(() => {
    if (!supported) return;
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  return {
    supported,
    enabled,
    interacted,
    speaking,
    paused,
    error,
    lastText,
    setEnabled,
    speak,
    say: sayAndRemember,
    replay,
    stop,
    pause,
    resume,
  };
}
