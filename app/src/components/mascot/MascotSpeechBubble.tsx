"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Speech } from "@/lib/speech/useSpeech";

type Props = {
  /** Identifies the current line so a new one animates in. */
  lineKey: string;
  text: string;
  speech: Speech;
  /** Tutor mode has its own Pause and Exit, so the manual Stop button steps aside. */
  hideStop?: boolean;
};

/** The tutor's words, with the voice controls. Text stays visible whether or not the voice is on. */
export function MascotSpeechBubble({ lineKey, text, speech, hideStop = false }: Props) {
  const { supported, enabled, speaking, error, setEnabled, replay, stop } = speech;

  function toggleVoice() {
    const next = !enabled;
    setEnabled(next);
    if (next) replay();
  }

  return (
    <div className="relative w-full">
      <span
        aria-hidden="true"
        className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-t border-l border-line bg-white"
      />
      <div className="rounded-2xl border border-line bg-white px-4 pt-4 pb-3 shadow-card">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={lineKey}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="max-h-56 overflow-y-auto text-sm leading-6 text-charcoal"
            aria-live="polite"
          >
            {text}
          </motion.p>
        </AnimatePresence>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
          <button
            type="button"
            onClick={toggleVoice}
            disabled={!supported}
            aria-pressed={enabled}
            title={supported ? (enabled ? "Turn the voice off" : "Turn the voice on") : "Voice is not available in this browser"}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors focus-visible:ring-4 focus-visible:ring-coral/30 focus-visible:outline-none disabled:opacity-50 ${
              enabled ? "bg-coral text-white shadow-button" : "bg-sand text-charcoal hover:bg-peach"
            }`}
          >
            <SpeakerIcon muted={!enabled} />
            {supported ? (enabled ? "Voice on" : "Voice off") : "No voice"}
          </button>
          {enabled && (
            <>
              <button
                type="button"
                onClick={replay}
                disabled={!speech.lastText}
                className="rounded-full bg-sand px-3 py-1.5 text-xs font-bold text-charcoal transition-colors hover:bg-peach focus-visible:ring-4 focus-visible:ring-coral/30 focus-visible:outline-none disabled:opacity-50"
              >
                Replay
              </button>
              {!hideStop && (
              <button
                type="button"
                onClick={stop}
                disabled={!speaking}
                className="rounded-full bg-sand px-3 py-1.5 text-xs font-bold text-charcoal transition-colors hover:bg-peach focus-visible:ring-4 focus-visible:ring-coral/30 focus-visible:outline-none disabled:opacity-50"
              >
                Stop
              </button>
              )}
            </>
          )}
          {speaking && (
            <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-coral-dark" aria-live="polite">
              <motion.span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full bg-coral"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
              />
              Speaking
            </span>
          )}
        </div>
        {error && <p className="mt-2 text-[11px] font-semibold text-coral-dark">{error}</p>}
        {enabled && !speaking && !speech.interacted && (
          <p className="mt-2 text-[11px] text-smoke">Click anywhere, or press Replay, to hear this.</p>
        )}
      </div>
    </div>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4z" />
      {muted ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
    </svg>
  );
}
