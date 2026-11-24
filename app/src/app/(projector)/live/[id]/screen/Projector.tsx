"use client";

import { ChevronLeft, ChevronRight, EyeOff, Maximize, Smartphone, Timer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { RevealOptions } from "@/components/live/RevealOptions";
import { liveAction, mmss, useSecondsLeft, useSnapshot } from "@/components/live/useSnapshot";
import { Tag } from "@/components/ui/Chip";
import { Logo } from "@/components/ui/Misc";
import type { ScreenSnapshot } from "@/lib/live/payload";
import { LIVE_TYPE_LABEL } from "@/lib/live/questions";
import { GRACE_MS } from "@/lib/live/state";
import { cn } from "@/lib/ui/cn";

/**
 * The projector, readable from the back of the room: the question at 40 px and
 * the clock at 144 px (NFR-18 asks for 32 and 96). It follows the console through
 * pings; ← and → step through revealed questions, F goes full screen.
 */

const panel = "frost frost-panel w-full max-w-[1200px] rounded-panel border border-white/60 shadow-panel";

export function Projector({ initial, courseTitle, qr }: { initial: ScreenSnapshot; courseTitle: string | null; qr: ReactNode }) {
  const { snap, refresh, offset } = useSnapshot(initial.session.id, initial, "screen");
  const { session, totals, questions } = snap;
  const left = useSecondsLeft(session.state === "open" ? session.endsAt : null, offset);
  const [stepping, setStepping] = useState(false);
  const index = Math.max(0, questions.findIndex((q) => q.id === session.currentQuestionId));

  async function step(to: number) {
    const q = questions[to];
    if (!q || stepping || session.state !== "revealed") return;
    setStepping(true);
    const r = await liveAction(`/api/live/${session.id}/reveal`, { questionId: q.id });
    setStepping(false);
    if (r.ok) void refresh();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") void step(index + 1);
      else if (e.key === "ArrowLeft") void step(index - 1);
      else if (e.key === "f" || e.key === "F") void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // At 0:00 ask again, so the projector switches to "Time's up" even if the console is closed.
  useEffect(() => {
    if (session.state !== "open" || !session.endsAt) return;
    const wait = Date.parse(session.endsAt) - (Date.now() + offset.current) + GRACE_MS + 400;
    const t = setTimeout(() => void refresh(), Math.max(0, wait));
    return () => clearTimeout(t);
  }, [session.state, session.endsAt, offset, refresh]);

  const label = [session.title, courseTitle, session.state === "revealed" ? "Answers revealed" : null].filter(Boolean).join(" · ");
  const host = session.joinUrl.replace(/^https?:\/\//, "").replace(/\?.*$/, "");

  return (
    <>
      <p className="frost frost-bar mb-5 flex items-center gap-2 rounded-full border border-white/70 px-4 py-2 text-body font-semibold">
        <span aria-hidden className="size-2 rounded-full bg-dot" />
        {label}
      </p>

      {session.state === "lobby" ? (
        <div className={cn(panel, "grid grid-cols-1 items-center gap-10 px-12 py-10 md:grid-cols-[auto_minmax(0,1fr)]")}>
          <div className="mx-auto w-full max-w-[min(42vh,420px)]">{qr}</div>
          <div className="flex flex-col gap-6">
            <Logo />
            <div>
              <p className="text-title font-bold">Join on your phone</p>
              <p className="mt-2 text-section font-medium text-ink-2">
                Scan the code, or go to <span className="font-bold text-ink">{host}</span>
              </p>
            </div>
            <p className="text-timer font-bold tracking-[0.12em] tabular-nums" aria-label={`Join code ${session.code.split("").join(" ")}`}>
              {session.code}
            </p>
            <p className="text-title-sm font-bold">
              {totals.joined} joined
            </p>
          </div>
        </div>
      ) : session.state === "open" ? (
        <div className={cn(panel, "flex flex-col items-center gap-6 px-12 py-12 text-center")}>
          <p className="flex items-center gap-3 text-title-sm font-bold text-ink-2">
            <Timer aria-hidden size={36} strokeWidth={1.75} className="text-accent" /> Time left for the whole set
          </p>
          <p role="timer" className={cn("text-timer font-bold tabular-nums", left <= 30 && "text-red-ink")}>
            {mmss(left)}
          </p>
          <p className="text-title font-bold">
            {totals.started} of {totals.joined} answered
          </p>
          <p className="text-section font-medium text-ink-2">
            Joining late? Go to {host} and use code <span className="font-bold tracking-[0.1em] text-ink">{session.code}</span>
          </p>
        </div>
      ) : session.state === "closed" ? (
        <div className={cn(panel, "flex flex-col items-center gap-4 px-12 py-16 text-center")}>
          <p className="text-timer font-bold">Time&rsquo;s up</p>
          <p className="text-title-sm font-medium text-ink-2">Your teacher is checking the answers.</p>
        </div>
      ) : session.state === "revealed" && questions[index] ? (
        <div className={cn(panel, "flex flex-col gap-6 px-10 py-9")}>
          <div className="flex items-center gap-3">
            <p className="text-section font-bold">
              Question {index + 1} of {questions.length}
            </p>
            <Tag className="h-8 bg-white px-3 text-card-sm">{LIVE_TYPE_LABEL[questions[index].type]}</Tag>
            <span className="ml-auto flex gap-1.5" aria-hidden>
              {questions.map((q, i) => (
                <span key={q.id} className={cn("h-2.5 rounded-full", i === index ? "w-7 bg-ink" : "w-2.5 bg-ink/20")} />
              ))}
            </span>
          </div>
          <p className="text-title-sm font-bold">{questions[index].stem}</p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <RevealOptions q={{ ...questions[index], commonWrong: null }} large />
            <div className="flex flex-col justify-center rounded-card bg-raised px-8 py-8">
              <p className="text-[72px] leading-none font-bold tabular-nums">{questions[index].percentRight ?? 0}%</p>
              <p className="mt-3 text-section font-medium">of the class got it right</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-card-sm font-medium text-ink-2">
            <span className="flex items-center gap-2">
              <EyeOff aria-hidden size={18} /> Names are never shown
            </span>
            <span className="flex items-center gap-2">
              <Smartphone aria-hidden size={18} /> Each phone now shows that student&rsquo;s own result
            </span>
          </div>
        </div>
      ) : (
        <div className={cn(panel, "flex flex-col items-center gap-4 px-12 py-16 text-center")}>
          <p className="text-title font-bold">Thanks for taking part</p>
          <p className="text-section font-medium text-ink-2">The results are on your teacher&rsquo;s screen.</p>
        </div>
      )}

      {session.state === "revealed" ? (
        <div className="frost frost-bar mt-5 flex items-center gap-2 rounded-full border border-white/70 px-2 py-1.5 shadow-dock">
          <button type="button" aria-label="Previous question" disabled={index === 0 || stepping} onClick={() => step(index - 1)} className="flex size-11 items-center justify-center rounded-full bg-white disabled:opacity-40">
            <ChevronLeft aria-hidden size={20} />
          </button>
          <span className="w-14 text-center text-body font-bold tabular-nums">
            {index + 1} / {questions.length}
          </span>
          <button type="button" aria-label="Next question" disabled={index === questions.length - 1 || stepping} onClick={() => step(index + 1)} className="flex size-11 items-center justify-center rounded-full bg-white disabled:opacity-40">
            <ChevronRight aria-hidden size={20} />
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}))}
        className="fixed right-4 bottom-4 flex h-10 items-center gap-2 rounded-full bg-white/70 px-4 text-meta font-semibold text-ink-2 hover:bg-white"
      >
        <Maximize aria-hidden size={14} /> Full screen (F)
      </button>
    </>
  );
}
