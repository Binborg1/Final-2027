"use client";

import { ArrowRight, ChevronLeft, ChevronRight, CircleCheck, Eye, Lock, Monitor, Play, RefreshCw, RotateCcw, Square, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LiveSteps } from "@/components/live/LiveSteps";
import { RevealOptions } from "@/components/live/RevealOptions";
import { liveAction, mmss, useSecondsLeft, useSnapshot } from "@/components/live/useSnapshot";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CountPill, Tag } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import type { Verdict } from "@/lib/live/mark";
import type { ConsoleAnswer, ConsoleQuestion, ConsoleSnapshot } from "@/lib/live/payload";
import { LIVE_TYPE_LABEL } from "@/lib/live/questions";
import { GRACE_MS, stepOf } from "@/lib/live/state";
import { cn } from "@/lib/ui/cn";

/**
 * The console follows the session's state: the lobby (join code, names, Start),
 * answering (L2: the clock, who has answered what, End early), check marks (L3:
 * every answer with its mark, Funza's short-answer marks to check, Reveal) and
 * Reveal (L4 in small, stepping through the questions with the projector).
 */

type Confirm = { title: string; text: string; action: string; run: () => Promise<void> } | null;

export function Console({ initial, courseTitle, chapterTitle, qr }: { initial: ConsoleSnapshot; courseTitle: string | null; chapterTitle: string | null; qr: ReactNode }) {
  const router = useRouter();
  const { snap, refresh, accept, offset } = useSnapshot(initial.session.id, initial);
  const { session } = snap;
  const base = `/api/live/${session.id}`;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  async function act(name: string, path: string, body: unknown = {}) {
    setBusy(name);
    setError(null);
    const r = await liveAction<ConsoleSnapshot>(`${base}${path}`, body);
    setBusy(null);
    if (!r.ok) setError(r.message ?? "That didn't work. Try again.");
    else if (r.data && "session" in (r.data as object)) accept(r.data);
    else void refresh();
    return r;
  }

  async function end() {
    setBusy("end");
    const r = await liveAction<{ resultsUrl: string }>(`${base}/end`);
    if (r.ok && r.data) router.push(r.data.resultsUrl);
    else {
      setBusy(null);
      setError(r.message ?? "Funza couldn't end the session. Try again.");
    }
  }

  // One screen, so it can afford to ask every 3 seconds as well, in case a ping is lost.
  useEffect(() => {
    if (session.state === "ended") return;
    const t = setInterval(() => void refresh(), 3_000);
    return () => clearInterval(t);
  }, [session.state, refresh]);

  const openProjector = () => window.open(`/live/${session.id}/screen`, "funza-projector", "noopener");
  const left = useSecondsLeft(session.state === "open" ? session.endsAt : null, offset);

  // At 0:00 (plus the grace for answers in flight) ask again: the server closes the session.
  useEffect(() => {
    if (session.state !== "open" || !session.endsAt) return;
    const wait = Date.parse(session.endsAt) - (Date.now() + offset.current) + GRACE_MS + 200;
    const t = setTimeout(() => void refresh(), Math.max(0, wait));
    return () => clearTimeout(t);
  }, [session.state, session.endsAt, offset, refresh]);

  // Once time is up, Funza marks the short answers (once per question; the server keeps it to one).
  const markStarted = useRef(false);
  const needsMarking = snap.questions.some((q) => q.type === "short" && q.markState === "none" && q.answered > 0);
  useEffect(() => {
    if ((session.state !== "closed" && session.state !== "revealed") || !needsMarking || markStarted.current || !session.endsAt) return;
    const wait = Date.parse(session.endsAt) - (Date.now() + offset.current) + GRACE_MS + 700;
    const t = setTimeout(() => {
      markStarted.current = true;
      void act("mark", "/mark");
    }, Math.max(0, wait));
    return () => clearTimeout(t);
  }, [session.state, needsMarking, session.endsAt]); // eslint-disable-line react-hooks/exhaustive-deps -- act is stable enough; this runs when marking becomes due

  const summary = [courseTitle, chapterTitle].filter(Boolean).join(" · ");
  const crumbs = [{ label: "Live sessions", href: "/live" }, ...(courseTitle ? [{ label: courseTitle }] : []), { label: session.title }];

  return (
    <div className="flex flex-col gap-5">
      {session.state === "lobby" ? (
        <Lobby snap={snap} summary={summary} crumbs={crumbs} qr={qr} busy={busy} onProjector={openProjector} onRemove={(p) => setConfirm({ title: `Remove ${p.name}?`, text: "Their phone leaves the session, and anything they answered is deleted.", action: "Remove", run: async () => void (await act("remove", "/remove", { participantId: p.id })) })} onStart={() => (snap.totals.joined === 0 ? setConfirm({ title: "Nobody has joined yet", text: "Students can still join after you start; they get the time that's left.", action: "Start anyway", run: async () => void (await act("open", "/open")) }) : void act("open", "/open"))} onCancel={() => setConfirm({ title: "Cancel this session?", text: "The lobby closes and the join code stops working.", action: "Cancel session", run: end })} />
      ) : session.state === "open" ? (
        <Answering snap={snap} crumbs={crumbs} left={left} busy={busy} onProjector={openProjector} onEndEarly={() => setConfirm({ title: "End answering now?", text: "Every phone locks. Answers already saved are kept.", action: "End early", run: async () => void (await act("close", "/close")) })} onRemove={(p) => setConfirm({ title: `Remove ${p.name}?`, text: "Their phone leaves the session, and anything they answered is deleted.", action: "Remove", run: async () => void (await act("remove", "/remove", { participantId: p.id })) })} />
      ) : session.state === "closed" ? (
        <CheckMarks snap={snap} crumbs={crumbs} busy={busy} onRetry={() => act("mark", "/mark", { retry: true })} onMark={(a, marks) => act(`mark-${a}`, "/marks", { answerId: a, marks })} onUndo={(a) => act(`mark-${a}`, "/marks", { answerId: a, undo: true })} onReveal={() => {
          const unmarked = snap.questions.reduce((n, q) => n + q.unmarked, 0);
          if (unmarked > 0) setConfirm({ title: `${unmarked} answer${unmarked === 1 ? " has" : "s have"} no mark`, text: "Reveal anyway? Unmarked answers show as “Not marked” and count 0 until you mark them.", action: "Reveal anyway", run: async () => void (await act("reveal", "/reveal")) });
          else void act("reveal", "/reveal");
        }} />
      ) : (
        <Revealed snap={snap} crumbs={crumbs} busy={busy} onProjector={openProjector} onStep={(questionId) => act("step", "/reveal", { questionId })} onMark={(a, marks) => act(`mark-${a}`, "/marks", { answerId: a, marks })} onUndo={(a) => act(`mark-${a}`, "/marks", { answerId: a, undo: true })} onResults={() => setConfirm({ title: "End the session and see results?", text: "Marks become final, and each question's results go into the question bank.", action: "See results", run: end })} />
      )}

      {error ? (
        <p role="alert" className="rounded-card bg-red-tint px-5 py-3 text-row font-medium text-red-ink">
          {error}
        </p>
      ) : null}

      <LiveSteps current={stepOf(session.state)} />

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.text}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Back
            </Button>
            <Button
              loading={busy !== null}
              onClick={async () => {
                const c = confirm;
                setConfirm(null);
                await c?.run();
              }}
            >
              {confirm?.action}
            </Button>
          </>
        }
      />
    </div>
  );
}

type Crumbs = { label: string; href?: string }[];
type Student = ConsoleSnapshot["students"][number];

/* ---------- lobby ---------- */

function Lobby({ snap, summary, crumbs, qr, busy, onProjector, onRemove, onStart, onCancel }: { snap: ConsoleSnapshot; summary: string; crumbs: Crumbs; qr: ReactNode; busy: string | null; onProjector: () => void; onRemove: (p: Student) => void; onStart: () => void; onCancel: () => void }) {
  const { session, totals, questions } = snap;
  const marks = questions.reduce((n, q) => n + q.marks, 0);
  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={session.title}
        summary={`Lobby · ${questions.length} questions · ${marks} marks · ${mmss(session.timerS)} for the whole set${summary ? ` · ${summary}` : ""}`}
        actions={
          <>
            <Button variant="ghost" onClick={onCancel} disabled={busy !== null}>
              Cancel session
            </Button>
            <Button variant="secondary" icon={Monitor} onClick={onProjector}>
              Open projector view
            </Button>
            <Button icon={Play} loading={busy === "open"} disabled={busy !== null} onClick={onStart}>
              Start answering
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="flex flex-col items-center gap-4 px-6 py-6 text-center">
          <p className="text-badge font-semibold tracking-wider text-ink-2 uppercase">Join code</p>
          <p className="text-display font-bold tracking-[0.18em] tabular-nums">{session.code}</p>
          {qr}
          <p className="text-body text-ink-2">
            Students scan the code or go to <span className="font-semibold text-ink">{session.joinUrl.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}</span> and type the code.
          </p>
          <p className="text-meta text-ink-2">{session.askStudentNo ? "They give their name and student number." : "They give their name."} The projector never shows names.</p>
        </Card>
        <Card className="flex flex-col gap-3 px-6 pt-5 pb-5" aria-labelledby="students-title">
          <CardHeader id="students-title" title="Students" after={<CountPill>{totals.joined}</CountPill>} />
          {snap.students.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-row text-ink-2">
              <Users aria-hidden size={18} /> Names appear here as students join.
            </p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
              {snap.students.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-row border border-white/80 bg-raised py-1.5 pr-1.5 pl-3.5">
                  <span className="min-w-0">
                    <span className="block truncate text-row font-semibold">{s.name}</span>
                    {s.studentNo ? <span className="block text-meta text-ink-2">{s.studentNo}</span> : null}
                  </span>
                  <button type="button" aria-label={`Remove ${s.name}`} onClick={() => onRemove(s)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-white hover:text-ink pointer-coarse:size-11">
                    <X aria-hidden size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

/* ---------- answering (L2) ---------- */

function Ring({ left, total }: { left: number; total: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, left / total) : 0;
  return (
    <div className="relative size-[150px] shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-ink/10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} className={left <= 30 ? "text-red" : "text-accent"} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" role="timer" aria-label={`${mmss(left)} left`}>
        <span className="text-hero font-bold tabular-nums">{mmss(left)}</span>
        <span className="text-meta text-ink-2">left of {mmss(total)}</span>
      </div>
    </div>
  );
}

function Answering({ snap, crumbs, left, busy, onProjector, onEndEarly, onRemove }: { snap: ConsoleSnapshot; crumbs: Crumbs; left: number; busy: string | null; onProjector: () => void; onEndEarly: () => void; onRemove: (p: Student) => void }) {
  const { session, totals, questions } = snap;
  const total = session.openedAt && session.endsAt ? Math.round((Date.parse(session.endsAt) - Date.parse(session.openedAt)) / 1000) : session.timerS;
  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={session.title}
        summary={`Students are answering · ${questions.length} questions · ${totals.joined} joined with code ${session.code}`}
        actions={
          <>
            <span className="flex items-center gap-1.5 text-body font-medium text-ink-2">
              <Monitor aria-hidden size={16} /> Projector shows the clock and the join code
            </span>
            <Button variant="secondary" icon={Monitor} onClick={onProjector}>
              Projector
            </Button>
            <Button variant="secondary" icon={Square} loading={busy === "close"} onClick={onEndEarly}>
              End early
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-5">
          <Card className="flex flex-wrap items-center gap-6 px-6 py-5">
            <Ring left={left} total={total} />
            <div className="min-w-[200px] flex-1">
              <p className="text-section font-bold">
                {totals.started} of {totals.joined} answered
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden>
                <div className="h-full rounded-full bg-accent" style={{ width: `${totals.joined ? (totals.started / totals.joined) * 100 : 0}%` }} />
              </div>
              <p className="mt-2 text-body font-medium">
                {totals.answersIn} of {totals.answersPossible} answers in
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-meta text-ink-2">
                <CircleCheck aria-hidden size={14} className="text-sage" /> {totals.finished} finished · {totals.notStarted} not started yet
              </p>
            </div>
          </Card>
          <Card className="flex flex-col gap-3 px-6 pt-5 pb-5" aria-labelledby="per-question">
            <CardHeader id="per-question" title="Answers per question" size="sm" after={<span className="text-meta text-ink-2">Any order · whole set at once</span>} />
            <ul className="flex flex-col gap-2.5">
              {questions.map((q) => (
                <li key={q.id} className="grid grid-cols-[40px_120px_minmax(0,1fr)_52px] items-center gap-3 text-body">
                  <span className="font-bold">Q{q.n}</span>
                  <span className="truncate text-ink-2">{LIVE_TYPE_LABEL[q.type]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden>
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${totals.joined ? (q.answered / totals.joined) * 100 : 0}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">
                    {q.answered}/{totals.joined}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card className="flex flex-col gap-3 px-6 pt-5 pb-4" aria-labelledby="students-title">
          <CardHeader id="students-title" title="Students" after={<CountPill>{totals.joined}</CountPill>} actions={<span className="flex items-center gap-3 text-meta text-ink-2"><span className="flex items-center gap-1"><span className="size-2 rounded-full bg-accent" />Answered</span><span className="flex items-center gap-1"><span className="size-2 rounded-full bg-ink/20" />Not yet</span></span>} />
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
            {snap.students.map((s) => (
              <li key={s.id} className="group relative rounded-row border border-white/80 bg-raised px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-row font-semibold">{s.name}</span>
                  <span className="shrink-0 text-meta text-ink-2">{s.finished ? <CircleCheck aria-label="Finished" size={16} className="text-sage" /> : s.answered.length === 0 ? "Not started" : `${s.answered.length} of ${questions.length}`}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1" aria-hidden>
                  {questions.map((q) => (
                    <span key={q.id} className={cn("size-2 rounded-full", s.answered.includes(q.id) ? "bg-accent" : "bg-ink/15")} />
                  ))}
                </div>
                <button type="button" aria-label={`Remove ${s.name}`} onClick={() => onRemove(s)} className="absolute -top-2 -right-2 hidden size-7 items-center justify-center rounded-full border border-line-2 bg-white text-ink-2 group-hover:flex focus-visible:flex">
                  <X aria-hidden size={14} />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 flex items-center gap-1.5 border-t border-line pt-3 text-meta text-ink-2">
            <Lock aria-hidden size={14} /> Answers stay hidden until you press Reveal. Students can change answers until time is up.
          </p>
        </Card>
      </div>
    </>
  );
}

/* ---------- check marks (L3) ---------- */

const VERDICT: Record<Verdict, { label: string; className: string }> = {
  right: { label: "Correct", className: "bg-sage-tint text-sage-ink" },
  partly: { label: "Partly", className: "bg-amber-tint text-amber-ink" },
  wrong: { label: "Incorrect", className: "bg-red-tint text-red-ink" },
  unmarked: { label: "Not marked", className: "bg-ink/[0.06] text-ink-2" },
};

function questionStatus(q: ConsoleQuestion): { text: string; done: boolean } {
  if (q.type !== "short") return { text: `${q.marks} mark${q.marks === 1 ? "" : "s"} · marked exactly`, done: q.unmarked === 0 };
  if (q.markState === "running") return { text: "Funza is marking…", done: false };
  if (q.markState === "failed") return { text: "Couldn't mark · mark them yourself", done: q.unmarked === 0 };
  if (q.answered === 0) return { text: "No answers", done: true };
  return { text: `${q.marks} mark${q.marks === 1 ? "" : "s"} · check Funza's marks`, done: q.unmarked === 0 };
}

function CheckMarks({ snap, crumbs, busy, onRetry, onMark, onUndo, onReveal }: { snap: ConsoleSnapshot; crumbs: Crumbs; busy: string | null; onRetry: () => void; onMark: (answerId: string, marks: number) => void; onUndo: (answerId: string) => void; onReveal: () => void }) {
  const { questions } = snap;
  const firstShort = questions.find((q) => q.type === "short") ?? questions[0];
  const [selected, setSelected] = useState<string | null>(firstShort?.id ?? null);
  const q = questions.find((x) => x.id === selected) ?? questions[0];
  const done = questions.filter((x) => questionStatus(x).done).length;
  const marking = questions.some((x) => x.markState === "running") || busy === "mark";
  const failed = questions.some((x) => x.markState === "failed");
  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title="Check marks"
        summary={`Funza marked ${snap.answers.length} answers. Multiple choice, true or false and numbers are marked exactly. Check the short answers before you reveal.`}
        actions={
          <>
            {failed ? (
              <Button variant="secondary" icon={RefreshCw} loading={busy === "mark"} onClick={onRetry}>
                Try Funza again
              </Button>
            ) : null}
            <Button icon={Eye} loading={busy === "reveal"} disabled={busy !== null || marking} onClick={onReveal}>
              Reveal
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="flex flex-col gap-2 px-4 pt-5 pb-4" aria-labelledby="q-list">
          <CardHeader id="q-list" title="Questions" size="sm" after={<span className="text-meta text-ink-2">{done} of {questions.length} done</span>} />
          <ul className="flex flex-col gap-1">
            {questions.map((x) => {
              const st = questionStatus(x);
              const on = x.id === q?.id;
              return (
                <li key={x.id}>
                  <button type="button" onClick={() => setSelected(x.id)} aria-current={on ? "true" : undefined} className={cn("flex w-full items-center gap-3 rounded-row border px-3 py-2.5 text-left", on ? "border-accent bg-accent-tint-soft" : "border-transparent hover:bg-white/60")}>
                    <span className="w-7 text-body font-bold">Q{x.n}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-row font-semibold", on && "text-accent-ink")}>{LIVE_TYPE_LABEL[x.type]}</span>
                      <span className="block text-meta text-ink-2">{st.text}</span>
                    </span>
                    {st.done ? <CircleCheck aria-label="Done" size={18} className="shrink-0 text-sage" /> : x.type === "short" && x.answered ? <CountPill>{x.answered}</CountPill> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        {q ? <MarksPanel q={q} snap={snap} busy={busy} onMark={onMark} onUndo={onUndo} /> : null}
      </div>
    </>
  );
}

function MarksPanel({ q, snap, busy, onMark, onUndo }: { q: ConsoleQuestion; snap: ConsoleSnapshot; busy: string | null; onMark: (answerId: string, marks: number) => void; onUndo: (answerId: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);
  const names = useMemo(() => new Map(snap.students.map((s) => [s.id, s.name])), [snap.students]);
  const answers = snap.answers.filter((a) => a.questionId === q.id);
  const shown = showAll ? answers : answers.slice(0, 7);
  return (
    <Card className="flex flex-col gap-4 px-6 pt-5 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tag className="bg-white">Q{q.n}</Tag>
        <Tag className="bg-white">{LIVE_TYPE_LABEL[q.type]}</Tag>
        <Tag className="bg-white">
          {q.marks} mark{q.marks === 1 ? "" : "s"}
        </Tag>
        <span className="ml-auto flex flex-wrap gap-1.5 text-meta font-semibold">
          <span className="rounded-full bg-sage-tint px-2.5 py-1 text-sage-ink">{q.right} correct</span>
          {q.type === "short" ? <span className="rounded-full bg-amber-tint px-2.5 py-1 text-amber-ink">{q.partly} partly</span> : null}
          <span className="rounded-full bg-red-tint px-2.5 py-1 text-red-ink">{q.wrong} incorrect</span>
          {q.unmarked ? <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-ink-2">{q.unmarked} not marked</span> : null}
        </span>
      </div>
      <p className="text-card font-bold">{q.stem}</p>
      {q.key ? (
        <p className="flex items-start gap-2 rounded-tile bg-sage-tint/70 px-4 py-2.5 text-body">
          <CircleCheck aria-hidden size={16} className="mt-0.5 shrink-0 text-sage" />
          <span>
            <span className="font-semibold text-sage-ink">Answer</span> {q.key}
          </span>
        </p>
      ) : null}
      {q.markState === "failed" && q.markNote ? <p className="rounded-tile bg-amber-tint px-4 py-2.5 text-body text-amber-ink">{q.markNote}</p> : null}
      {q.markState === "done" && q.markNote ? <p className="text-body text-ink-2">Funza: {q.markNote}</p> : null}
      {answers.length === 0 ? (
        <p className="py-4 text-row text-ink-2">Nobody answered this question.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-body">
            <thead>
              <tr className="text-badge font-semibold tracking-wider text-ink-2 uppercase">
                <th className="py-2 pr-3 font-semibold">Student</th>
                <th className="py-2 pr-3 font-semibold">Answer</th>
                <th className="py-2 pr-3 font-semibold">{q.type === "short" ? "Funza's mark" : "Mark"}</th>
                <th className="py-2 pr-3 font-semibold">Marks</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((a) => (
                <AnswerRow key={a.id} a={a} q={q} name={names.get(a.participantId) ?? "—"} busy={busy === `mark-${a.id}`} changing={changing === a.id} onChange={() => setChanging(changing === a.id ? null : a.id)} onMark={(m) => { setChanging(null); onMark(a.id, m); }} onUndo={() => onUndo(a.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-meta text-ink-2">
        <span>
          Showing {shown.length} of {answers.length}
          {answers.length > 7 ? (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="ml-2 font-semibold text-accent-ink hover:underline">
              {showAll ? "Show fewer" : `Show all ${answers.length} answers`}
            </button>
          ) : null}
        </span>
        {q.type === "short" ? (
          <span className="flex items-center gap-1.5">
            <Lock aria-hidden size={13} /> Funza marks answers without seeing student names
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function AnswerRow({ a, q, name, busy, changing, onChange, onMark, onUndo }: { a: ConsoleAnswer; q: ConsoleQuestion; name: string; busy: boolean; changing: boolean; onChange: () => void; onMark: (m: number) => void; onUndo: () => void }) {
  const v = VERDICT[a.verdict];
  const changed = a.markedBy === "teacher";
  const options = q.type === "short" ? Array.from({ length: q.marks + 1 }, (_, i) => i) : [0, q.marks];
  return (
    <tr className={cn(changed && "bg-accent-tint-soft/60")}>
      <td className="py-2.5 pr-3 font-semibold whitespace-nowrap">{name}</td>
      <td className="py-2.5 pr-3">{a.text}</td>
      <td className="py-2.5 pr-3">
        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-meta font-semibold", v.className)}>{v.label}</span>
        {changed && a.aiMarks !== null ? <span className="mt-0.5 block text-badge text-accent-ink">Changed by you · Funza gave {a.aiMarks}</span> : changed ? <span className="mt-0.5 block text-badge text-accent-ink">Changed by you</span> : null}
      </td>
      <td className="py-2.5 pr-3 font-bold tabular-nums whitespace-nowrap">{a.marks === null ? "—" : `${a.marks}/${q.marks}`}</td>
      <td className="py-2.5 text-right whitespace-nowrap">
        {changing ? (
          <span className="inline-flex gap-1" role="group" aria-label={`Marks for ${name}`}>
            {options.map((m) => (
              <button key={m} type="button" onClick={() => onMark(m)} className={cn("h-9 min-w-9 rounded-full border px-2 text-body font-semibold", a.marks === m ? "border-accent bg-accent-tint text-accent-ink" : "border-line-2 bg-white hover:bg-raised")}>
                {q.type === "short" ? m : m === 0 ? "Wrong" : "Right"}
              </button>
            ))}
          </span>
        ) : changed ? (
          <Button size="sm" variant="secondary" icon={RotateCcw} loading={busy} onClick={onUndo}>
            Undo
          </Button>
        ) : (
          <Button size="sm" variant="secondary" icon={RotateCcw} loading={busy} onClick={onChange}>
            Change
          </Button>
        )}
      </td>
    </tr>
  );
}

/* ---------- reveal (L4, small) ---------- */

function Revealed({ snap, crumbs, busy, onProjector, onStep, onMark, onUndo, onResults }: { snap: ConsoleSnapshot; crumbs: Crumbs; busy: string | null; onProjector: () => void; onStep: (questionId: string) => void; onMark: (answerId: string, marks: number) => void; onUndo: (answerId: string) => void; onResults: () => void }) {
  const { session, questions } = snap;
  const index = Math.max(0, questions.findIndex((q) => q.id === session.currentQuestionId));
  const q = questions[index];
  const [marking, setMarking] = useState(false);
  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={session.title}
        summary="Answers revealed · each phone shows that student's own result"
        actions={
          <>
            <Button variant="secondary" onClick={() => setMarking((m) => !m)}>
              {marking ? "Hide marks" : "Change a mark"}
            </Button>
            <Button variant="secondary" icon={Monitor} onClick={onProjector}>
              Projector
            </Button>
            <Button iconRight={ArrowRight} loading={busy === "end"} disabled={busy !== null} onClick={onResults}>
              See results
            </Button>
          </>
        }
      />
      {q ? (
        <Card className="flex flex-col gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <p className="text-row font-bold">
              Question {index + 1} of {questions.length}
            </p>
            <Tag className="bg-white">{LIVE_TYPE_LABEL[q.type]}</Tag>
            <span className="ml-auto flex items-center gap-1">
              <button type="button" aria-label="Previous question" disabled={index === 0 || busy === "step"} onClick={() => onStep(questions[index - 1].id)} className="flex size-11 items-center justify-center rounded-full border border-line-2 bg-white disabled:opacity-40">
                <ChevronLeft aria-hidden size={18} />
              </button>
              <span className="w-12 text-center text-body font-semibold tabular-nums">
                {index + 1} / {questions.length}
              </span>
              <button type="button" aria-label="Next question" disabled={index === questions.length - 1 || busy === "step"} onClick={() => onStep(questions[index + 1].id)} className="flex size-11 items-center justify-center rounded-full border border-line-2 bg-white disabled:opacity-40">
                <ChevronRight aria-hidden size={18} />
              </button>
            </span>
          </div>
          <p className="text-[26px] leading-[32px] font-bold">{q.stem}</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <RevealOptions q={q} />
            <div className="flex flex-col justify-center rounded-card bg-raised px-6 py-5">
              <p className="text-title-sm font-bold tabular-nums">{q.percentRight ?? 0}%</p>
              <p className="text-card-sm font-medium">of the class got it right</p>
            </div>
          </div>
          {marking ? <MarksPanel q={q} snap={snap} busy={busy} onMark={onMark} onUndo={onUndo} /> : null}
        </Card>
      ) : null}
    </>
  );
}
