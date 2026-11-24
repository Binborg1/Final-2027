"use client";

import { ArrowLeft, ArrowRight, Check, CircleCheck, CircleMinus, CircleX, LoaderCircle, Timer, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Misc";
import { AnswerQueue, type SaveStatus } from "@/lib/live/answer-queue";
import { useLiveRefresh } from "@/lib/live/listen";
import { numberHint, parseStudentNumber } from "@/lib/live/number";
import type { PhoneResultItem, PhoneState } from "@/lib/live/payload";
import type { PublicQuestion } from "@/lib/live/questions";
import { forgetSeat, pendingKey, savedSeat, submittedKey, type Seat } from "@/lib/live/seat";
import { TOKEN_HEADER } from "@/lib/live/token";
import type { LiveResponse } from "@/lib/live/types";
import { cn } from "@/lib/ui/cn";

/**
 * F5 on a student's phone. The server's clock is the only clock: the phone keeps
 * the difference between its clock and the server's, so a phone set to the wrong
 * time still counts down correctly. Answers save as the student goes; a reload or
 * a dropped connection loses nothing. Submit is the student saying "I'm done": the
 * phone shows a waiting screen until Reveal, and the answers can still be changed
 * until time is up.
 */

const card = "frost frost-auth h-fit w-full max-w-[440px] rounded-auth border border-white/45 shadow-auth";

export function Play({ sessionId }: { sessionId: string }) {
  const [seat, setSeat] = useState<Seat | null | undefined>(undefined);
  const [view, setView] = useState<PhoneState | null>(null);
  const [gone, setGone] = useState(false);
  const [offline, setOffline] = useState(false);
  const offset = useRef(0);
  const lastRev = useRef(-1);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the token lives in this phone's storage, read after hydration
    setSeat(savedSeat(sessionId));
  }, [sessionId]);

  const fetchState = useCallback(async () => {
    if (!seat) return;
    const sent = Date.now();
    try {
      const res = await fetch(`/api/live/state?session=${sessionId}`, { headers: { [TOKEN_HEADER]: seat.token }, cache: "no-store" });
      if (res.status === 401) {
        forgetSeat(sessionId);
        setGone(true);
        return;
      }
      const json = (await res.json()) as { ok: boolean; data?: PhoneState };
      if (!json.ok || !json.data) return;
      setOffline(false);
      if (json.data.rev < lastRev.current) return; // an older reply arriving late
      lastRev.current = json.data.rev;
      const received = Date.now();
      offset.current = Date.parse(json.data.serverNow) - (sent + received) / 2;
      setView(json.data);
    } catch {
      setOffline(true);
    }
  }, [seat, sessionId]);

  useLiveRefresh({ sessionId, topics: ["state"], refresh: fetchState, spread: true, enabled: Boolean(seat) && !gone });

  // While waiting for the teacher (lobby, or time up before Reveal), also ask every 3 seconds,
  // in case Realtime is connected but a ping is lost.
  const waiting = view?.state === "lobby" || view?.state === "closed";
  useEffect(() => {
    if (!waiting || gone) return;
    const t = setInterval(() => void fetchState(), 3_000);
    return () => clearInterval(t);
  }, [waiting, gone, fetchState]);

  if (seat === undefined) return <Waiting text="Opening…" />;
  if (seat === null || gone) return <NotIn />;
  if (!view) return <Waiting text={offline ? "Can’t reach Funza. Check your Wi-Fi." : "Opening…"} />;

  switch (view.state) {
    case "lobby":
      return (
        <div className={cn(card, "px-8 py-10 text-center max-sm:px-5")}>
          <Logo size={32} wordmark className="justify-center" />
          <span className="mx-auto mt-8 flex size-14 items-center justify-center rounded-full bg-sage-tint text-sage-ink">
            <Check aria-hidden size={28} strokeWidth={2} />
          </span>
          <h1 className="mt-5 text-hero font-bold max-sm:text-[28px] max-sm:leading-[34px]">You&rsquo;re in, {view.me.name}.</h1>
          <p className="mt-2 text-card-sm font-medium text-ink-2">Wait for your teacher. The questions appear here when they start.</p>
          <p className="mt-6 text-meta font-semibold text-ink-2">
            {view.total} question{view.total === 1 ? "" : "s"} · {Math.round((view.timerS ?? 0) / 60)} min for the whole set
          </p>
        </div>
      );
    case "open":
      return <Answering key={view.openedAt ?? "open"} sessionId={sessionId} seat={seat} view={view} offset={offset} onTimeUp={fetchState} />;
    case "closed":
      return (
        <div className={cn(card, "px-8 py-10 text-center max-sm:px-5")}>
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-tint text-amber-ink">
            <Timer aria-hidden size={28} strokeWidth={1.75} />
          </span>
          <h1 className="mt-5 text-hero font-bold max-sm:text-[28px] max-sm:leading-[34px]">Time&rsquo;s up.</h1>
          <p className="mt-2 text-card-sm font-medium text-ink-2">
            You answered {view.answered ?? 0} of {view.total}. Your teacher is checking the answers; you&rsquo;ll see your results here when they reveal them.
          </p>
        </div>
      );
    default:
      return view.result ? <Result result={view.result} /> : <Waiting text="This session has ended. Thanks for taking part." done />;
  }
}

/* ---------- answering ---------- */

function useClock(endsAt: string | null | undefined, offset: React.RefObject<number>) {
  const end = endsAt ? Date.parse(endsAt) : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const left = Number.isFinite(end) ? Math.max(0, Math.ceil((end - (now + offset.current)) / 1000)) : 0;
  return left;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Answering({ sessionId, seat, view, offset, onTimeUp }: { sessionId: string; seat: Seat; view: PhoneState; offset: React.RefObject<number>; onTimeUp: () => void }) {
  const questions = useMemo(() => view.questions ?? [], [view.questions]);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const queue = useMemo(
    () =>
      new AnswerQueue({
        key: pendingKey(sessionId),
        storage: typeof window === "undefined" ? null : window.localStorage,
        onChange: rerender,
        send: async (questionId, response) => {
          const res = await fetch("/api/live/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json", [TOKEN_HEADER]: seat.token },
            body: JSON.stringify({ session: sessionId, questionId, response }),
          });
          if (res.ok) return { ok: true };
          const json = (await res.json().catch(() => null)) as { reason?: string } | null;
          return { ok: false, status: res.status, reason: json?.reason, retryAfter: Number(res.headers.get("Retry-After")) || undefined };
        },
      }),
    [sessionId, seat.token],
  );
  useEffect(() => queue.restore(), [queue]);

  // What the student has chosen: the server's copy, overlaid with anything still being saved.
  const [mine, setMine] = useState<Record<string, LiveResponse>>(() => ({ ...(view.mine ?? {}), ...Object.fromEntries(queue.waiting()) }));
  const [index, setIndex] = useState(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Answering only renders in the browser (after the seat is read), so storage is there.
  const [submitted, setSubmitted] = useState(() => window.localStorage.getItem(submittedKey(sessionId)) === "1");
  const [confirming, setConfirming] = useState(false);

  /** Sends now whatever is waiting for a pause in typing. */
  const flushAll = () => {
    for (const [qid, t] of timers.current) {
      clearTimeout(t);
      const r = mine[qid];
      if (r) queue.set(qid, r);
    }
    timers.current.clear();
  };

  const left = useClock(view.endsAt, offset);
  const timeUp = left === 0;
  useEffect(() => {
    if (!timeUp) return;
    // Send whatever is still waiting now; the server accepts it for 2 more seconds.
    flushAll();
    queue.stop();
    const t = setTimeout(onTimeUp, 2_500);
    return () => clearTimeout(t);
  }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps -- runs once, when the clock reaches 0:00

  const choose = (q: PublicQuestion, r: LiveResponse, wait = 0) => {
    if (timeUp) return;
    setMine((m) => ({ ...m, [q.id]: r }));
    const old = timers.current.get(q.id);
    if (old) clearTimeout(old);
    if (wait === 0) {
      timers.current.delete(q.id);
      queue.set(q.id, r);
    } else {
      timers.current.set(q.id, setTimeout(() => {
        timers.current.delete(q.id);
        queue.set(q.id, r);
      }, wait));
    }
  };
  const flush = (qid: string) => {
    const t = timers.current.get(qid);
    if (!t) return;
    clearTimeout(t);
    timers.current.delete(qid);
    const r = mine[qid];
    if (r) queue.set(qid, r);
  };
  const go = (to: number) => {
    const q = questions[index];
    if (q) flush(q.id);
    setConfirming(false);
    setIndex(Math.max(0, Math.min(questions.length, to)));
  };

  const answered = questions.filter((q) => isAnswered(mine[q.id])).length;
  const onReview = index >= questions.length;
  const q = questions[index];

  const submit = () => {
    if (answered < questions.length && !confirming) return setConfirming(true);
    flushAll();
    window.localStorage.setItem(submittedKey(sessionId), "1");
    setConfirming(false);
    setSubmitted(true);
  };
  const reopen = () => {
    window.localStorage.removeItem(submittedKey(sessionId));
    setSubmitted(false);
    setIndex(questions.length);
  };

  if (submitted) {
    const sending = queue.unsent > 0;
    const retrying = questions.some((x) => queue.status(x.id) === "retrying");
    return (
      <div className={cn(card, "px-8 py-10 text-center max-sm:px-5")}>
        <span className={cn("mx-auto flex size-14 items-center justify-center rounded-full", sending ? "bg-raised text-ink-2" : "bg-sage-tint text-sage-ink")}>
          {sending ? <LoaderCircle aria-hidden size={28} className="animate-spin motion-reduce:animate-none" /> : <Check aria-hidden size={28} strokeWidth={2} />}
        </span>
        <h1 aria-live="polite" className="mt-5 text-hero font-bold max-sm:text-[28px] max-sm:leading-[34px]">
          {sending ? "Sending your answers…" : "Your answers are in."}
        </h1>
        <p className="mt-2 text-card-sm font-medium text-ink-2">
          You answered {answered} of {questions.length}. You&rsquo;ll see your results here when your teacher reveals the answers.
        </p>
        {retrying ? (
          <p className="mt-4 rounded-md bg-amber-tint px-4 py-3 text-row font-semibold text-amber-ink">
            <WifiOff aria-hidden size={16} className="mr-1.5 inline align-[-2px]" />
            Not sent yet. Keep this page open; Funza keeps trying.
          </p>
        ) : null}
        <p className="mt-6 text-meta font-semibold text-ink-2 tabular-nums">{timeUp ? "Time’s up." : `${mmss(left)} left for the class`}</p>
        {!timeUp ? (
          <Button variant="ghost" onClick={reopen} className="mt-2">
            Change my answers
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn(card, "flex min-h-[calc(100dvh-2rem)] flex-col px-5 pt-5 pb-4 sm:min-h-[640px] sm:px-6")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-row font-semibold text-ink">{onReview ? "Check your answers" : `Question ${index + 1} of ${questions.length}`}</p>
        <span role="timer" aria-label={`${mmss(left)} left`} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full bg-raised px-3 text-row font-bold tabular-nums", left <= 30 ? "text-red-ink" : "text-ink")}>
          <Timer aria-hidden size={16} strokeWidth={2} className="text-accent" />
          {mmss(left)}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/60" aria-hidden>
        <div className="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none" style={{ width: `${(Math.min(index + 1, questions.length) / Math.max(1, questions.length)) * 100}%` }} />
      </div>

      {timeUp ? (
        <p role="status" className="mt-4 rounded-md bg-amber-tint px-4 py-3 text-row font-semibold text-amber-ink">
          Time&rsquo;s up. Your answers are locked.
        </p>
      ) : null}

      <div className="mt-4 flex-1">
        {onReview ? (
          <Review questions={questions} mine={mine} status={(id) => queue.status(id)} onOpen={(i) => setIndex(i)} answered={answered} />
        ) : q ? (
          <QuestionView q={q} value={mine[q.id]} locked={timeUp} onChoose={(r, wait) => choose(q, r, wait)} onBlur={() => flush(q.id)} />
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {onReview ? (
          <span role={confirming ? "alert" : undefined} className={cn("text-meta font-semibold", confirming ? "text-amber-ink" : "text-ink-2")}>
            {confirming
              ? `${questions.length - answered} question${questions.length - answered === 1 ? " has" : "s have"} no answer. Submit anyway?`
              : `${answered} of ${questions.length} answered`}
          </span>
        ) : q ? (
          <SavedPill status={queue.status(q.id)} answered={isAnswered(mine[q.id])} />
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {index > 0 ? <Button variant="secondary" icon={ArrowLeft} onClick={() => go(index - 1)} aria-label="Back" className="w-[52px] px-0" /> : null}
          {!onReview ? (
            <Button iconRight={ArrowRight} onClick={() => go(index + 1)}>
              {index === questions.length - 1 ? "Check" : "Next"}
            </Button>
          ) : !timeUp ? (
            <Button icon={Check} onClick={submit}>
              {confirming ? "Submit anyway" : "Submit"}
            </Button>
          ) : null}
        </div>
      </div>

      <nav aria-label="Questions" className="mt-3 flex flex-wrap justify-center">
        {questions.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => go(i)}
            aria-label={`Question ${i + 1}${isAnswered(mine[x.id]) ? ", answered" : ""}`}
            aria-current={i === index ? "step" : undefined}
            className="flex size-7 items-center justify-center pointer-coarse:size-9"
          >
            <span className={cn("size-2 rounded-full", i === index ? "bg-accent" : isAnswered(mine[x.id]) ? "bg-ink-2/60" : "bg-white/80 ring-1 ring-ink/15")} />
          </button>
        ))}
      </nav>
    </div>
  );
}

const isAnswered = (r: LiveResponse | undefined) => Boolean(r && ("choice" in r ? r.choice : r.text.trim()));

function QuestionView({ q, value, locked, onChoose, onBlur }: { q: PublicQuestion; value: LiveResponse | undefined; locked: boolean; onChoose: (r: LiveResponse, wait?: number) => void; onBlur: () => void }) {
  const choice = value && "choice" in value ? value.choice : null;
  const text = value && "text" in value ? value.text : "";
  const options = q.type === "tf" ? [{ id: "true", text: "True" }, { id: "false", text: "False" }] : (q.options ?? []);
  const parsed = q.type === "calc" && text.trim() ? parseStudentNumber(text, q.unit ?? "") : null;
  const hint = parsed && !parsed.ok ? numberHint(parsed.reason, q.unit) : "";

  return (
    <div>
      <div className="rounded-card bg-raised px-5 py-4">
        <p className="text-section font-bold whitespace-pre-line">{q.stem}</p>
        <p className="mt-1 text-meta font-medium text-ink-2">
          {q.marks} mark{q.marks === 1 ? "" : "s"}
        </p>
      </div>

      {q.type === "mcq" || q.type === "tf" ? (
        <div role="radiogroup" aria-label="Answers" className="mt-3 flex flex-col gap-2">
          {options.map((o) => {
            const on = choice === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={locked}
                onClick={() => onChoose({ choice: o.id })}
                className={cn(
                  "flex min-h-[52px] w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-card-sm font-semibold transition-colors disabled:opacity-70",
                  on ? "border-accent bg-accent-tint-soft text-ink" : "border-white/70 bg-field text-ink hover:bg-white",
                )}
              >
                <span aria-hidden className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2", on ? "border-accent bg-accent text-white" : "border-line-control")}>
                  {on ? <Check size={14} strokeWidth={3} /> : null}
                </span>
                {o.text}
              </button>
            );
          })}
        </div>
      ) : q.type === "calc" ? (
        <div className="mt-3">
          <label htmlFor="answer" className="text-meta font-semibold text-ink-2">
            Your answer
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="answer"
              value={text}
              disabled={locked}
              inputMode="decimal"
              autoComplete="off"
              maxLength={60}
              onChange={(e) => onChoose({ text: e.target.value }, 700)}
              onBlur={onBlur}
              aria-invalid={hint ? true : undefined}
              aria-describedby={hint ? "answer-hint" : undefined}
              className="h-[52px] w-full min-w-0 rounded-md border border-line-control bg-field px-4 text-card font-semibold tabular-nums text-ink focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent aria-invalid:border-red"
            />
            {q.unit ? <span className="shrink-0 text-card-sm font-semibold text-ink-2">{q.unit}</span> : null}
          </div>
          {hint ? (
            <p id="answer-hint" className="mt-1.5 text-meta font-medium text-red-ink">
              {hint}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-3">
          <label htmlFor="answer" className="text-meta font-semibold text-ink-2">
            Your answer
          </label>
          <Textarea id="answer" value={text} disabled={locked} maxLength={1000} rows={5} onChange={(e) => onChoose({ text: e.target.value }, 700)} onBlur={onBlur} className="mt-1.5 text-card-sm" />
        </div>
      )}
    </div>
  );
}

function SavedPill({ status, answered }: { status: SaveStatus | undefined; answered: boolean }) {
  if (!answered && !status) return <span />;
  const shown =
    status === "saving"
      ? { icon: <LoaderCircle aria-hidden size={14} className="animate-spin motion-reduce:animate-none" />, text: "Saving…", tone: "text-ink-2" }
      : status === "retrying"
        ? { icon: <WifiOff aria-hidden size={14} />, text: "Not saved yet · retrying", tone: "text-amber-ink" }
        : status === "locked"
          ? { icon: <CircleMinus aria-hidden size={14} />, text: "Locked", tone: "text-ink-2" }
          : status === "failed"
            ? { icon: <CircleX aria-hidden size={14} />, text: "Couldn’t save", tone: "text-red-ink" }
            : { icon: <CircleCheck aria-hidden size={14} />, text: "Saved", tone: "text-sage-ink" };
  return (
    <span role="status" className={cn("inline-flex h-9 items-center gap-1.5 rounded-full bg-raised px-3 text-meta font-semibold", shown.tone)}>
      {shown.icon}
      {shown.text}
    </span>
  );
}

function Review({ questions, mine, status, onOpen, answered }: { questions: PublicQuestion[]; mine: Record<string, LiveResponse>; status: (id: string) => SaveStatus | undefined; onOpen: (i: number) => void; answered: number }) {
  return (
    <div>
      <p className="text-card-sm font-medium text-ink-2">
        {answered === questions.length ? "Every question has an answer. You can still change any of them until time is up." : "Tap a question to answer it or change your answer."}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {questions.map((q, i) => {
          const done = isAnswered(mine[q.id]);
          const s = status(q.id);
          return (
            <li key={q.id}>
              <button type="button" onClick={() => onOpen(i)} className="flex min-h-[52px] w-full items-center gap-3 rounded-md bg-raised px-4 py-2 text-left hover:bg-white">
                <span className="w-7 shrink-0 text-row font-bold text-ink-2">{i + 1}</span>
                <span className="line-clamp-1 flex-1 text-row font-medium text-ink">{q.stem}</span>
                <span className={cn("shrink-0 text-meta font-semibold", done ? (s === "retrying" ? "text-amber-ink" : "text-sage-ink") : "text-ink-2")}>{done ? (s === "retrying" ? "Saving" : "Answered") : "Not yet"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- after Reveal ---------- */

function Result({ result }: { result: NonNullable<PhoneState["result"]> }) {
  return (
    <div className={cn(card, "px-5 pt-5 pb-6 sm:px-6")}>
      <div className="rounded-card bg-raised px-5 py-6 text-center">
        <p className="text-row font-semibold text-ink-2">Your result</p>
        <p className="mt-1 text-display font-bold tabular-nums">
          {result.score} of {result.max}
        </p>
        <span className="mt-2 inline-flex rounded-full bg-sage-tint px-3 py-1 text-row font-bold text-sage-ink">{result.percent}%</span>
      </div>
      <ul className="mt-3 flex flex-col divide-y divide-line rounded-card bg-surface px-4">
        {result.items.map((it) => (
          <ResultRow key={it.n} it={it} />
        ))}
      </ul>
      <p className="mt-4 text-center text-meta font-medium text-ink-2">Your teacher will go over the answers now.</p>
    </div>
  );
}

function ResultRow({ it }: { it: PhoneResultItem }) {
  const right = it.verdict === "right";
  const partly = it.verdict === "partly";
  const Icon = right ? CircleCheck : partly ? CircleMinus : CircleX;
  const label = right ? "Right" : partly ? `Partly · ${it.marks} of ${it.max}` : it.yours === null ? "No answer" : it.verdict === "unmarked" ? "Not marked" : "Not quite";
  return (
    <li className="flex items-start gap-3 py-3">
      <Icon aria-hidden size={20} strokeWidth={1.75} className={cn("mt-0.5 shrink-0", right ? "text-sage" : partly ? "text-amber-ink" : "text-red")} />
      <div className="min-w-0 flex-1">
        <p className="text-row font-semibold text-ink">Question {it.n}</p>
        {!right ? (
          <p className="mt-0.5 text-meta font-medium text-ink-2">
            {it.yours !== null ? <>You: {it.yours} · </> : null}Answer: {it.key}
          </p>
        ) : null}
      </div>
      <span className={cn("shrink-0 text-meta font-bold", right ? "text-sage-ink" : partly ? "text-amber-ink" : "text-red-ink")}>{label}</span>
    </li>
  );
}

/* ---------- other screens ---------- */

function Waiting({ text, done = false }: { text: string; done?: boolean }) {
  return (
    <div className={cn(card, "px-8 py-10 text-center max-sm:px-5")}>
      <Logo size={32} wordmark className="justify-center" />
      <p className="mt-6 text-card-sm font-medium text-ink-2" role="status">
        {!done ? <LoaderCircle aria-hidden size={18} className="mr-2 inline animate-spin align-[-3px] motion-reduce:animate-none" /> : null}
        {text}
      </p>
    </div>
  );
}

function NotIn() {
  return (
    <div className={cn(card, "px-8 py-10 text-center max-sm:px-5")}>
      <Logo size={32} wordmark className="justify-center" />
      <h1 className="mt-6 text-section font-bold">This phone isn&rsquo;t in the session.</h1>
      <p className="mt-2 text-card-sm font-medium text-ink-2">Your teacher may have removed you, or the session has ended. Join again with the code on the screen.</p>
      <a href="/join" className="mt-6 inline-flex h-[52px] items-center justify-center rounded-full bg-accent px-7 text-card-sm font-semibold text-on-accent shadow-cta hover:bg-accent-hover">
        Join again
      </a>
    </div>
  );
}
