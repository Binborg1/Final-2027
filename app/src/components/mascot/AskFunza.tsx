"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { useScreenShare } from "@/lib/screen/useScreenShare";
import { screenLocalOnlyStore, useScreenLocalOnly } from "@/lib/storage";
import { SUGGESTED_QUESTIONS } from "@/lib/tutor/askFunza";
import type { AskFunza as AskFunzaState } from "@/lib/tutor/useAskFunza";

const small = "px-3 py-1.5 text-xs";
const chip =
  "rounded-full bg-sand px-2.5 py-1 text-[11px] font-bold text-charcoal transition-colors hover:bg-peach focus-visible:ring-4 focus-visible:ring-coral/30 focus-visible:outline-none disabled:opacity-50";

/**
 * "Ask Funza about this screen": a question box wired to the structured
 * workspace context, and the optional, student-started screen sharing with
 * its review step. Everything the student types or shares is explicit; nothing
 * is captured in the background.
 */
export function AskFunza({ ask }: { ask: AskFunzaState }) {
  const [question, setQuestion] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [review, setReview] = useState<{ image: string; question: string } | null>(null);
  const { status: shareStatus, label: shareLabel, notice: shareNotice, start: startShare, stop: stopShare, capture, attachPreview } = useScreenShare();
  const localOnly = useScreenLocalOnly();
  const ai = ask.ai;

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = question.trim();
    if (!q) return;
    void ask.ask(q);
    setQuestion("");
  }

  async function analyze() {
    setCaptureNotice(null);
    setCapturing(true);
    const image = await capture();
    setCapturing(false);
    if (!image) {
      setCaptureNotice("Could not take a screenshot. Is the shared window still open?");
      return;
    }
    setReview({ image, question: question.trim() || "What am I looking at here, and where should I start?" });
  }

  const canAnalyze = shareStatus === "sharing" && !localOnly && !!ai?.configured && ai.vision;
  const analyzeNote = localOnly
    ? "Local-only mode is on: screenshots stay on this device and are never analyzed."
    : ai === null
      ? ""
      : !ai.configured
        ? "No AI provider is configured, so screenshots cannot be analyzed. Funza can still describe what is open in the app."
        : !ai.vision
          ? `The configured model (${ai.model ?? "unknown"}) cannot read images, so screenshots cannot be analyzed.`
          : "";

  return (
    <section aria-label="Ask Funza about this screen" className="mt-3 w-full rounded-2xl border border-line bg-white p-3 shadow-card">
      <form onSubmit={submit} className="flex gap-1.5">
        <label htmlFor="ask-funza" className="sr-only">
          Ask Funza about this screen
        </label>
        <input
          id="ask-funza"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this screen..."
          maxLength={600}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold shadow-track outline-none focus:border-coral focus:ring-4 focus:ring-coral/20"
        />
        <Button type="submit" className={small} disabled={ask.busy || !question.trim()}>
          Ask
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Suggested questions">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button key={q} type="button" className={chip} disabled={ask.busy} onClick={() => void ask.ask(q)}>
            {q}
          </button>
        ))}
      </div>
      {ask.busy && (
        <p className="mt-2 text-[11px] font-semibold text-smoke" aria-live="polite">
          Funza is thinking...
        </p>
      )}

      <details className="mt-3 border-t border-line pt-2 text-xs">
        <summary className="cursor-pointer font-bold text-smoke">Share a screen (optional)</summary>
        <p className="mt-1.5 text-[11px] leading-4 text-smoke">
          Share a tab, window or screen so Funza can look at work outside this app. Nothing is recorded. One screenshot is taken only when you press
          Analyze, and you see it before anything is sent.
        </p>
        {shareStatus === "unsupported" && <p className="mt-2 text-[11px] font-semibold text-smoke">Screen sharing is not available in this browser.</p>}
        {shareStatus === "idle" && (
          <Button variant="secondary" className={`${small} mt-2`} onClick={() => void startShare()}>
            Share screen
          </Button>
        )}
        {shareStatus === "requesting" && <p className="mt-2 text-[11px] font-semibold text-smoke">Waiting for you to pick what to share...</p>}
        {shareStatus === "sharing" && (
          <div className="mt-2 rounded-xl border border-coral bg-peach/50 p-2" role="status" aria-live="polite">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-peach-dark">
              <span className="h-2 w-2 rounded-full bg-coral motion-safe:animate-pulse" aria-hidden="true" />
              Sharing {shareLabel}
            </p>
            <video ref={attachPreview} muted playsInline aria-label="Live preview of what you are sharing" className="mt-1.5 w-full rounded-lg border border-line bg-charcoal" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button className={small} onClick={() => void analyze()} disabled={!canAnalyze || capturing || ask.busy}>
                {capturing ? "Capturing..." : "Analyze current screen"}
              </Button>
              <Button variant="secondary" className={small} onClick={stopShare}>
                Stop sharing
              </Button>
            </div>
            {analyzeNote && <p className="mt-1.5 text-[11px] leading-4 text-smoke">{analyzeNote}</p>}
            {captureNotice && <p className="mt-1.5 text-[11px] font-semibold text-coral-dark">{captureNotice}</p>}
          </div>
        )}
        {shareNotice && (
          <p className="mt-1.5 text-[11px] font-semibold text-coral-dark" role="status">
            {shareNotice}
          </p>
        )}
        <label className="mt-2 flex items-start gap-2 text-[11px] leading-4 font-semibold text-smoke">
          <input type="checkbox" checked={localOnly} onChange={(e) => screenLocalOnlyStore.set(e.target.checked)} className="mt-0.5 accent-coral" />
          Keep screenshots on this device: never send them to the AI provider.
        </label>
      </details>

      {review && (
        <ScreenshotReview
          image={review.image}
          initialQuestion={review.question}
          provider={ai?.provider}
          onSend={(q) => {
            const image = review.image;
            setReview(null);
            void ask.askAboutScreenshot(q, image);
          }}
          onRetake={() => {
            setReview(null);
            void analyze();
          }}
          onDiscard={() => setReview(null)}
        />
      )}
    </section>
  );
}

/** The student sees exactly what would be sent, is warned about private content, and must agree before it goes. */
function ScreenshotReview({
  image,
  initialQuestion,
  provider,
  onSend,
  onRetake,
  onDiscard,
}: {
  image: string;
  initialQuestion: string;
  provider?: string;
  onSend: (question: string) => void;
  onRetake: () => void;
  onDiscard: () => void;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [consent, setConsent] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    field.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDiscard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDiscard]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 p-4" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-white p-5 shadow-card">
        <h2 id="review-title" className="text-lg font-extrabold">
          Check this screenshot before it is sent
        </h2>
        <p className="mt-1 text-sm text-smoke">This is the only image that would leave your device, and only if you press Send. It is not saved anywhere.</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL held in memory for review; nothing to optimize or fetch */}
        <img src={image} alt="The screenshot you are about to send" className="mt-3 w-full rounded-xl border border-line" />
        <div className="mt-3 rounded-2xl border border-peach bg-peach/60 px-4 py-3 text-sm leading-6 text-charcoal">
          <p className="font-extrabold text-peach-dark">Look for anything private</p>
          <p>
            Screenshots can show names, messages, passwords, email, and course material you are not allowed to share with an AI provider. If you see any,
            close it and press Retake, or press Discard.
          </p>
        </div>
        <label htmlFor="review-question" className="mt-3 block text-sm font-bold">
          Your question about this screenshot
        </label>
        <textarea
          id="review-question"
          ref={field}
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 600))}
          rows={2}
          className="mt-1 w-full resize-y rounded-2xl border border-line bg-white px-4 py-2.5 text-sm leading-6 shadow-track outline-none focus:border-coral focus:ring-4 focus:ring-coral/20"
        />
        <label className="mt-3 flex items-start gap-2 text-sm leading-6">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1.5 accent-coral" />
          <span>I am allowed to share this content with {provider ? `the ${provider} AI service` : "the AI provider"}, and it shows nothing I want to keep private.</span>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => onSend(question.trim() || initialQuestion)} disabled={!consent || !question.trim()}>
            Send to Funza
          </Button>
          <Button variant="secondary" onClick={onRetake}>
            Retake
          </Button>
          <Button variant="ghost" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </div>
    </div>
  );
}
