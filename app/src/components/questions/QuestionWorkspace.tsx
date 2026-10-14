"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { BrainMascot } from "@/components/BrainMascot";
import { Button } from "@/components/Button";
import { cardClass, spring } from "@/components/motion";
import { Spinner } from "@/components/Spinner";
import { askAi, useAiStatus, type AiStatus } from "@/lib/ai/client";
import type { AiTask } from "@/lib/ai/prompts";
import { questionFullText } from "@/lib/questions/extract";
import { coverage, findRelevantPassages, type Passage } from "@/lib/questions/relevance";
import { scaffoldFor } from "@/lib/questions/scaffold";
import { clipText } from "@/lib/text";
import type { Course, QuestionItem, QuestionSet, Topic, WorkMode } from "@/lib/types";

type QuestionState = {
  restate: string;
  restateNote: string | null;
  attempt: string;
  feedback: string | null;
  hint: string | null;
  solution: string | null;
  revealed: boolean;
  busy: AiTask | null;
  error: string | null;
  planDone: boolean[];
};

const emptyState = (): QuestionState => ({
  restate: "",
  restateNote: null,
  attempt: "",
  feedback: null,
  hint: null,
  solution: null,
  revealed: false,
  busy: null,
  error: null,
  planDone: [],
});

type Props = { course: Course; set: QuestionSet; topics: Topic[] };

/**
 * Works through a question PDF in one of two modes: guidance (hints, a plan
 * and the matching notes, answers only on request) or answers (pick a
 * question and have it solved).
 */
export function QuestionWorkspace({ course, set, topics }: Props) {
  const ai = useAiStatus();
  const [mode, setMode] = useState<WorkMode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(set.questions[0]?.id ?? null);
  const [jump, setJump] = useState("");
  const [jumpNote, setJumpNote] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, QuestionState>>({});

  const selected = set.questions.find((q) => q.id === selectedId) ?? null;
  const state = selected ? (states[selected.id] ?? emptyState()) : null;

  function patch(id: string, changes: Partial<QuestionState>) {
    setStates((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyState()), ...changes } }));
  }

  function jumpTo(event: FormEvent) {
    event.preventDefault();
    const m = jump.match(/(\d+)/);
    if (!m) {
      setJumpNote("Type a question number, for example 3.");
      return;
    }
    const q = set.questions.find((item) => item.number === m[1]);
    if (!q) {
      setJumpNote(`There is no question ${m[1]} in this set.`);
      return;
    }
    setSelectedId(q.id);
    setJump("");
    setJumpNote(null);
  }

  async function runAi(q: QuestionItem, task: AiTask) {
    patch(q.id, { busy: task, error: null });
    const passages = findRelevantPassages(questionFullText(q), topics, 3);
    const result = await askAi({
      task,
      question: { label: q.label, text: q.text, parts: q.parts },
      context: passages.map((p) => `${p.conceptTitle}: ${p.text}`),
      attempt: states[q.id]?.attempt,
      courseName: course.name,
    });
    if (result.ok) {
      patch(q.id, { busy: null, [task === "solve" ? "solution" : task]: result.text });
    } else {
      patch(q.id, { busy: null, error: result.message });
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link
          href={`/courses/${course.id}`}
          className="rounded-full px-3 py-1.5 font-bold text-smoke transition-colors hover:bg-sand hover:text-charcoal"
        >
          &larr; {course.name}
        </Link>
        <AiBadge status={ai} />
      </div>
      <header className="mt-3">
        <h1 className="text-3xl font-extrabold tracking-tight">{set.title}</h1>
        <p className="mt-1 text-smoke">
          {set.questions.length} question{set.questions.length === 1 ? "" : "s"} from {set.fileName}
        </p>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {mode === null ? (
          <motion.div key="chooser" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ModeChooser onPick={setMode} />
          </motion.div>
        ) : (
          <motion.div
            key="work"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]"
          >
            <aside className="space-y-4">
              <ModeSwitch mode={mode} onChange={setMode} />
              <form onSubmit={jumpTo} className={`p-4 ${cardClass}`}>
                <label className="block text-xs font-bold text-smoke" htmlFor="jump">
                  Jump to a question
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="jump"
                    value={jump}
                    onChange={(e) => setJump(e.target.value)}
                    placeholder="e.g. question 3"
                    className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-coral focus:ring-4 focus:ring-coral/20"
                  />
                  <Button type="submit" variant="secondary" className="px-4">
                    Go
                  </Button>
                </div>
                {jumpNote && <p className="mt-2 text-xs font-semibold text-coral-dark">{jumpNote}</p>}
              </form>
              <nav className={`max-h-[60vh] overflow-y-auto p-2 ${cardClass}`} aria-label="Questions">
                <ul className="space-y-1">
                  {set.questions.map((q) => {
                    const active = q.id === selectedId;
                    const done = states[q.id]?.solution || states[q.id]?.feedback;
                    return (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(q.id)}
                          aria-current={active ? "true" : undefined}
                          className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors ${
                            active ? "bg-peach/70 text-charcoal" : "hover:bg-sand"
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                              active ? "bg-coral text-white" : done ? "bg-mint text-mint-dark" : "bg-sand text-smoke"
                            }`}
                          >
                            {q.number}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-bold">{q.label}</span>
                            <span className="block text-xs text-smoke">{clipText(q.text || q.parts[0]?.text || "", 70)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </aside>

            <div className="min-w-0">
              {selected && state ? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${selected.id}-${mode}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <QuestionCard question={selected} />
                    {mode === "guide" ? (
                      <GuidancePanel
                        question={selected}
                        state={state}
                        topics={topics}
                        ai={ai}
                        onPatch={(changes) => patch(selected.id, changes)}
                        onAi={(task) => runAi(selected, task)}
                      />
                    ) : (
                      <AnswerPanel
                        question={selected}
                        state={state}
                        topics={topics}
                        ai={ai}
                        onSolve={() => runAi(selected, "solve")}
                        onGuide={() => setMode("guide")}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <p className="text-sm text-smoke">Pick a question from the list.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- mode ---------- */

function ModeChooser({ onPick }: { onPick: (mode: WorkMode) => void }) {
  const options: { mode: WorkMode; title: string; body: string; mood: "thinking" | "celebrating" }[] = [
    {
      mode: "guide",
      title: "Guide me",
      body: "Hints, a plan and the matching parts of your notes. You do the solving; answers only when you ask for them.",
      mood: "thinking",
    },
    {
      mode: "answers",
      title: "I need the answers",
      body: "Pick a question, like question 3, and get it solved step by step, with the reasoning shown.",
      mood: "celebrating",
    },
  ];
  return (
    <section className="mt-8">
      <h2 className="text-xl font-extrabold">Do you want guidance, or the answers right away?</h2>
      <p className="mt-1 text-sm text-smoke">You can switch at any time.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {options.map((o) => (
          <motion.button
            key={o.mode}
            type="button"
            onClick={() => onPick(o.mode)}
            whileHover={{ y: -4, scale: 1.012 }}
            whileTap={{ scale: 0.985 }}
            transition={spring}
            className={`flex items-start gap-4 p-6 text-left ${cardClass}`}
          >
            <BrainMascot mood={o.mood} size={72} />
            <span>
              <span className="block text-lg font-extrabold">{o.title}</span>
              <span className="mt-1 block text-sm leading-6 text-smoke">{o.body}</span>
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

function ModeSwitch({ mode, onChange }: { mode: WorkMode; onChange: (mode: WorkMode) => void }) {
  const items: { mode: WorkMode; label: string }[] = [
    { mode: "guide", label: "Guide me" },
    { mode: "answers", label: "Answers" },
  ];
  return (
    <div className="flex rounded-full border border-line bg-white p-1 shadow-track" role="tablist" aria-label="Mode">
      {items.map((item) => {
        const active = item.mode === mode;
        return (
          <button
            key={item.mode}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.mode)}
            className={`relative flex-1 rounded-full px-3 py-2 text-sm font-bold transition-colors ${
              active ? "text-white" : "text-smoke hover:text-charcoal"
            }`}
          >
            {active && (
              <motion.span
                layoutId="mode-active"
                className="absolute inset-0 rounded-full bg-linear-to-b from-[#ff8c62] to-[#f06f45] shadow-button"
                transition={spring}
                aria-hidden="true"
              />
            )}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function AiBadge({ status }: { status: AiStatus | null }) {
  if (status === null) return null;
  return status.configured ? (
    <span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-mint-dark" title={`${status.provider} · ${status.model}`}>
      AI tutor on ({status.provider})
    </span>
  ) : (
    <span className="rounded-full bg-sand px-3 py-1 text-xs font-bold text-smoke" title="Add an API key to app/.env.local to enable solving">
      AI tutor off
    </span>
  );
}

/* ---------- question ---------- */

function QuestionCard({ question }: { question: QuestionItem }) {
  return (
    <article className={`p-6 md:p-7 ${cardClass}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className="rounded-full bg-lavender px-3 py-1 text-lavender-dark">{question.label}</span>
        {question.marks && <span className="rounded-full bg-sand px-3 py-1 text-smoke">{question.marks}</span>}
        <span className="rounded-full bg-sand px-3 py-1 text-smoke">Page {question.page}</span>
      </div>
      {question.text && <p className="mt-4 text-base leading-7 text-charcoal">{question.text}</p>}
      {question.parts.length > 0 && (
        <ol className="mt-3 space-y-2">
          {question.parts.map((p) => (
            <li key={p.label} className="flex gap-3 text-base leading-7">
              <span className="font-extrabold text-smoke">({p.label})</span>
              <span>{p.text}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

/* ---------- guidance ---------- */

type GuidanceProps = {
  question: QuestionItem;
  state: QuestionState;
  topics: Topic[];
  ai: AiStatus | null;
  onPatch: (changes: Partial<QuestionState>) => void;
  onAi: (task: AiTask) => void;
};

function GuidancePanel({ question, state, topics, ai, onPatch, onAi }: GuidanceProps) {
  const full = questionFullText(question);
  const passages = findRelevantPassages(full, topics, 3);
  const plan = scaffoldFor(full);
  const aiOn = ai?.configured === true;

  function checkRestate() {
    const c = coverage(full, state.restate, 5);
    if (state.restate.trim().split(/\s+/).length < 4) {
      onPatch({ restateNote: "Write a full sentence so Funza can compare it with the question." });
    } else if (c.ratio >= 0.4) {
      onPatch({ restateNote: `Good. You have the key ideas: ${c.hit.join(", ")}.` });
    } else {
      onPatch({
        restateNote: `You are partly there. The question also involves: ${c.missed.slice(0, 3).join(", ")}. Add those and try again.`,
      });
    }
  }

  function localFeedback() {
    const c = coverage(full, state.attempt, 6);
    const nextStep = plan.steps[state.planDone.findIndex((d) => !d) === -1 ? 0 : state.planDone.findIndex((d) => !d)];
    const parts = [
      c.hit.length > 0 ? `Your attempt uses ${c.hit.join(", ")}.` : "Your attempt does not yet use the key terms from the question.",
      c.missed.length > 0 ? `It still needs to deal with: ${c.missed.slice(0, 3).join(", ")}.` : "It touches every key idea in the question.",
      `Next step from the plan: ${nextStep}`,
    ];
    onPatch({ feedback: parts.join(" ") });
  }

  function localHint() {
    const idx = state.planDone.findIndex((d) => !d);
    const step = plan.steps[idx === -1 ? 0 : idx];
    const passage = passages[0];
    onPatch({
      hint: passage
        ? `${step} Your notes on "${passage.conceptTitle}" cover this: ${clipText(passage.text, 160)}`
        : step,
    });
  }

  return (
    <div className="mt-5 space-y-4">
      <Step n={1} title="Say it in your own words">
        <p className="text-sm text-smoke">What is this question really asking you to do?</p>
        <textarea
          value={state.restate}
          onChange={(e) => onPatch({ restate: e.target.value, restateNote: null })}
          rows={2}
          placeholder="This question asks me to..."
          className={fieldClass}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={checkRestate}>
            Check
          </Button>
          {state.restateNote && <p className="text-sm font-semibold text-charcoal">{state.restateNote}</p>}
        </div>
      </Step>

      <Step n={2} title="From your notes">
        <PassageList passages={passages} courseId={topics.length > 0 ? undefined : undefined} />
      </Step>

      <Step n={3} title={`Plan it (${plan.type})`}>
        <ul className="space-y-2">
          {plan.steps.map((s, i) => (
            <li key={s}>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={state.planDone[i] ?? false}
                  onChange={(e) => {
                    const next = [...state.planDone];
                    next[i] = e.target.checked;
                    onPatch({ planDone: next });
                  }}
                  className="mt-1 h-4 w-4 accent-coral"
                />
                <span className={state.planDone[i] ? "text-smoke line-through" : ""}>{s}</span>
              </label>
            </li>
          ))}
        </ul>
      </Step>

      <Step n={4} title="Try it">
        <textarea
          value={state.attempt}
          onChange={(e) => onPatch({ attempt: e.target.value })}
          rows={6}
          placeholder="Work through the question here..."
          className={fieldClass}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => (aiOn ? onAi("feedback") : localFeedback())}
            disabled={state.busy !== null || state.attempt.trim().length === 0}
          >
            {state.busy === "feedback" && <Spinner />}
            Get feedback
          </Button>
          <Button variant="secondary" onClick={() => (aiOn ? onAi("hint") : localHint())} disabled={state.busy !== null}>
            {state.busy === "hint" && <Spinner />}
            Give me a hint
          </Button>
          {!aiOn && <span className="text-xs text-smoke">Rule-based feedback; add an AI key for deeper help.</span>}
        </div>
        <AnimatePresence initial={false}>
          {state.hint && (
            <Note key="hint" tone="sky" title="Hint">
              {state.hint}
            </Note>
          )}
          {state.feedback && (
            <Note key="feedback" tone="lavender" title="Feedback on your attempt">
              {state.feedback}
            </Note>
          )}
          {state.error && (
            <Note key="error" tone="peach" title="That did not work">
              {state.error}
            </Note>
          )}
        </AnimatePresence>
      </Step>

      <Step n={5} title="Still stuck?">
        {state.revealed ? (
          <AnswerBody
            question={question}
            state={state}
            passages={passages}
            ai={ai}
            onSolve={() => onAi("solve")}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => onPatch({ revealed: true })}>
              Show me the answer
            </Button>
            <span className="text-xs text-smoke">Try the steps above first; the answer stays available.</span>
          </div>
        )}
      </Step>
    </div>
  );
}

/* ---------- answers ---------- */

type AnswerProps = {
  question: QuestionItem;
  state: QuestionState;
  topics: Topic[];
  ai: AiStatus | null;
  onSolve: () => void;
  onGuide: () => void;
};

function AnswerPanel({ question, state, topics, ai, onSolve, onGuide }: AnswerProps) {
  const passages = findRelevantPassages(questionFullText(question), topics, 3);
  return (
    <div className="mt-5 space-y-4">
      <section className={`p-5 md:p-6 ${cardClass}`}>
        <AnswerBody question={question} state={state} passages={passages} ai={ai} onSolve={onSolve} onGuide={onGuide} />
      </section>
      <section className={`p-5 md:p-6 ${cardClass}`}>
        <h3 className="text-sm font-extrabold">From your notes</h3>
        <div className="mt-3">
          <PassageList passages={passages} />
        </div>
      </section>
    </div>
  );
}

function AnswerBody({
  question,
  state,
  passages,
  ai,
  onSolve,
  onGuide,
}: {
  question: QuestionItem;
  state: QuestionState;
  passages: Passage[];
  ai: AiStatus | null;
  onSolve: () => void;
  onGuide?: () => void;
}) {
  const aiOn = ai?.configured === true;
  return (
    <div className="space-y-4">
      {question.providedAnswer && (
        <Note tone="mint" title="Answer printed in the PDF">
          {question.providedAnswer}
        </Note>
      )}
      {state.solution ? (
        <Note tone="mint" title={`Worked solution for ${question.label.toLowerCase()}`}>
          <div className="whitespace-pre-wrap">{state.solution}</div>
          <p className="mt-3 text-xs text-smoke">Generated by the AI tutor from the question and your notes. Check each step against your material.</p>
        </Note>
      ) : aiOn ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onSolve} disabled={state.busy !== null}>
            {state.busy === "solve" && <Spinner />}
            Solve {question.label.toLowerCase()}
          </Button>
          <span className="text-xs text-smoke">Step-by-step reasoning, then the final answer.</span>
        </div>
      ) : (
        <Note tone="peach" title="The AI tutor is not set up on this computer">
          <p>
            Solving needs an AI model. Add one free key to <code className="rounded bg-white/70 px-1">app/.env.local</code> (see{" "}
            <code className="rounded bg-white/70 px-1">.env.example</code>; Groq, Gemini and OpenRouter have free tiers) and restart the app.
          </p>
          {passages.length > 0 && (
            <p className="mt-2">Until then, the passages from your notes below are the material this question is built on.</p>
          )}
          {onGuide && (
            <div className="mt-3">
              <Button variant="secondary" onClick={onGuide}>
                Guide me through it instead
              </Button>
            </div>
          )}
        </Note>
      )}
      {state.error && (
        <Note tone="peach" title="That did not work">
          {state.error}
        </Note>
      )}
    </div>
  );
}

/* ---------- shared ---------- */

const fieldClass =
  "mt-3 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6 shadow-track outline-none transition-shadow focus:border-coral focus:ring-4 focus:ring-coral/20";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className={`p-5 md:p-6 ${cardClass}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-[#ff8c62] to-[#f06f45] text-xs font-extrabold text-white shadow-button">
          {n}
        </span>
        <h3 className="text-base font-extrabold">{title}</h3>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Note({ tone, title, children }: { tone: "sky" | "lavender" | "mint" | "peach"; title: string; children: ReactNode }) {
  const styles = {
    sky: "border-sky bg-sky/60 [&_h4]:text-sky-dark",
    lavender: "border-lavender bg-lavender/60 [&_h4]:text-lavender-dark",
    mint: "border-mint bg-mint/70 [&_h4]:text-mint-dark",
    peach: "border-peach bg-peach/60 [&_h4]:text-peach-dark",
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={`mt-3 rounded-2xl border px-4 py-3.5 text-sm leading-6 text-charcoal ${styles}`}
    >
      <h4 className="font-extrabold">{title}</h4>
      <div className="mt-1">{children}</div>
    </motion.div>
  );
}

function PassageList({ passages }: { passages: Passage[]; courseId?: string }) {
  if (passages.length === 0) {
    return (
      <p className="text-sm text-smoke">
        No matching passages. Add this course&apos;s lecture notes as a PDF and Funza will pull the relevant parts in here.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {passages.map((p) => (
        <li key={`${p.topicId}/${p.conceptId}`} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm shadow-[0_1px_2px_rgba(90,60,30,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-extrabold">{p.conceptTitle}</span>
            <span className="text-xs font-semibold text-smoke">{p.topicTitle}</span>
          </div>
          <p className="mt-1 leading-6 text-charcoal/85">{p.text}</p>
          <p className="mt-1 text-xs text-smoke">Matches: {p.matched.join(", ")}</p>
        </li>
      ))}
    </ul>
  );
}
