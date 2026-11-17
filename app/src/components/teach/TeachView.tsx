"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { AskFunza } from "@/components/mascot/AskFunza";
import { FunzaMascot } from "@/components/mascot/FunzaMascot";
import { MascotSpeechBubble } from "@/components/mascot/MascotSpeechBubble";
import { SourceBanner } from "@/components/SourceBanner";
import { Spinner } from "@/components/Spinner";
import { LearningVisualization } from "@/components/visualizations/LearningVisualization";
import { useSpeech } from "@/lib/speech/useSpeech";
import { GIVE_UP_AFTER, useTeachingSession, type TeachingSession } from "@/lib/teaching/useTeachingSession";
import { checkpointSpeech, vizSignature, type TutorLine } from "@/lib/tutor/tutorLine";
import { useAskFunza } from "@/lib/tutor/useAskFunza";
import { useSpokenLine } from "@/lib/tutor/useTutorGuide";
import type { ConceptStatus, Course, SourceSection, Topic } from "@/lib/types";
import { tutorStateOf, type VisualizationTutorState } from "@/lib/visualizations/tutorState";
import { usePlayer, type Player } from "@/lib/visualizations/usePlayer";
import { teachWorkspace, visualizationWorkspace } from "@/lib/workspace/context";

type Props = { course: Course; topic: Topic; sections: SourceSection[]; savedStatus: (id: string) => ConceptStatus | undefined };

const swap = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.22, ease: "easeOut" },
} as const;

/** The adaptive teaching loop for one AI-planned topic: explain, ask, evaluate, hint or reteach, verify, continue. */
export function TeachView({ course, topic, sections, savedStatus }: Props) {
  const t = useTeachingSession(course, topic, sections, savedStatus);
  const speech = useSpeech();
  // A demo the model asked for (already validated against the registry), narrated when the voice is on.
  const player = usePlayer(t.lesson?.visualization ?? null, { key: t.concept?.id ?? "", narrate: speech.enabled ? speech.say : undefined });
  const viz = tutorStateOf(player);
  const line = teachLine(t, topic, viz);
  useSpokenLine(line, speech);
  // What the tutor can see of this screen, and the "ask Funza" box that answers from it.
  const workspace = teachWorkspace({ course, topic, t, visualization: visualizationWorkspace(player) });
  const ask = useAskFunza(workspace, speech, { clearKey: `${t.concept?.id ?? "none"}:${t.phase}:${t.attempts}:${vizSignature(viz)}` });
  const shown = ask.line ?? line;
  const percent = t.total === 0 ? 100 : Math.round((Math.min(t.index, t.total) / t.total) * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_272px] lg:grid-rows-[auto_1fr]">
      <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href={`/courses/${course.id}`} className="rounded-full px-3 py-1.5 font-bold text-smoke transition-colors hover:bg-sand hover:text-charcoal">
            &larr; {course.name}
          </Link>
          <span className="rounded-full bg-sand px-3 py-1 text-xs font-bold text-smoke">
            {t.phase === "finished" ? "Topic complete" : `Concept ${t.index + 1} of ${t.total}`}
          </span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-sand shadow-track" aria-hidden="true">
          <motion.div className="h-full rounded-full bg-coral" initial={false} animate={{ width: `${percent}%` }} transition={{ type: "spring", stiffness: 160, damping: 26 }} />
        </div>
        <div className="mt-4">
          <SourceBanner source="ai" />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {t.phase === "finished" ? (
            <motion.div key="finished" {...swap}>
              <Finished course={course} topic={topic} statusOf={t.statusOf} />
            </motion.div>
          ) : t.concept ? (
            <motion.div key={t.concept.id} {...swap}>
              <ConceptStage t={t} topic={topic} player={player} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="order-first lg:order-none lg:col-start-2 lg:row-start-1 lg:self-start">
        <section aria-label="Funza tutor" className="flex flex-col items-center">
          <FunzaMascot state={shown.state} talking={speech.speaking} size={112} />
          <div className="mt-1 w-full">
            <MascotSpeechBubble lineKey={shown.key} text={shown.text} speech={speech} />
          </div>
          <AskFunza ask={ask} />
        </section>
      </div>

      <aside className="space-y-4 lg:col-start-2 lg:row-start-2">
        <section className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <h2 className="text-sm font-extrabold">In this topic</h2>
          <ol className="mt-3 space-y-2.5 text-sm">
            {topic.concepts.map((c, i) => {
              const status = t.statusOf(c.id);
              const current = i === t.index && t.phase !== "finished";
              return (
                <li key={c.id} className={`flex items-start gap-2.5 ${current ? "font-bold text-charcoal" : "font-semibold text-smoke"}`}>
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                      status === "completed" ? "bg-mint-dark text-white" : status === "needs-practice" ? "bg-peach text-peach-dark" : current ? "border-2 border-coral bg-peach/60" : "border-2 border-line bg-white"
                    }`}
                  >
                    {status === "completed" ? "✓" : status === "needs-practice" ? "!" : ""}
                  </span>
                  <span>{c.title}</span>
                </li>
              );
            })}
          </ol>
        </section>
        {topic.objectives && topic.objectives.length > 0 && (
          <section className="rounded-3xl border border-sky bg-sky/50 p-5">
            <h2 className="text-sm font-extrabold text-sky-dark">Learning objectives</h2>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-charcoal">
              {topic.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}

/* ---------- one concept ---------- */

function ConceptStage({ t, topic, player }: { t: TeachingSession; topic: Topic; player: Player }) {
  const concept = t.concept!;
  const lesson = t.lesson;
  const q = t.question;
  const ev = t.evaluation;
  const busy = t.phase === "evaluating" || t.phase === "verifying";

  return (
    <article className="mt-6 rounded-3xl border border-line bg-linear-to-b from-white to-[#fffaf2] p-6 shadow-card md:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-lavender px-3 py-1 text-xs font-extrabold text-lavender-dark">{topic.title}</span>
        <span className="rounded-full bg-sand px-3 py-1 text-xs font-bold text-smoke">Adaptive AI</span>
      </div>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{concept.title}</h1>
      {concept.objective && <p className="mt-1 text-sm font-semibold text-smoke">Goal: {concept.objective}</p>}

      {t.phase === "loading" && (
        <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-smoke">
          <Spinner /> Preparing this concept from your notes...
        </p>
      )}

      {t.phase === "error" && (
        <Box tone="peach" title="The AI tutor could not continue">
          <p>{t.error}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={t.retryStep}>Try again</Button>
            <Button variant="secondary" onClick={t.skip}>
              Skip this concept
            </Button>
          </div>
        </Box>
      )}

      {lesson && t.phase !== "error" && (
        <>
          <Label>From your notes</Label>
          <p className="mt-1 text-base leading-7 whitespace-pre-line text-charcoal/85">{lesson.explanation}</p>
          {lesson.supplement && (
            <Box tone="lavender" title="Beyond the PDF" badge="Not from your notes">
              <p className="whitespace-pre-line">{lesson.supplement}</p>
            </Box>
          )}
          {lesson.example && (
            <Box tone="sand" title="Example" badge={lesson.example.fromPdf ? "From your notes" : "Not from your notes"}>
              <p className="whitespace-pre-line">{lesson.example.text}</p>
            </Box>
          )}
          {lesson.visualization && (
            <>
              <Label>See it happen</Label>
              <LearningVisualization player={player} className="mt-1" />
            </>
          )}

          {t.phase === "explain" && (
            <div className="mt-6">
              <Button
                onClick={() => {
                  player.pause();
                  t.ready();
                }}
              >
                I&apos;m ready for the question
              </Button>
            </div>
          )}

          {q && t.phase !== "explain" && t.phase !== "complete" && (
            <section className="mt-8 border-t border-line pt-6">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-[#ff8c62] to-[#f06f45] text-sm font-extrabold text-white shadow-button">?</span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-extrabold">{t.questionKind === "verification" ? "One more, to be sure" : "Your turn"}</h2>
                  {t.questionKind === "verification" && <p className="text-xs font-semibold text-smoke">A new question on the same idea.</p>}
                  <p className="mt-2 text-sm leading-6 text-charcoal/85">{q.prompt}</p>

                  {q.type === "mcq" && q.options ? (
                    <div role="radiogroup" aria-label={q.prompt} className="mt-4 grid gap-2.5">
                      {q.options.map((o) => {
                        const selected = t.answer === o.id;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={t.phase !== "ask"}
                            onClick={() => t.setAnswer(o.id)}
                            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors disabled:cursor-default ${
                              selected ? "border-coral bg-peach/60" : "border-line bg-white hover:border-coral/60 hover:bg-sand"
                            }`}
                          >
                            <span className="font-extrabold text-smoke">({o.id})</span>
                            {o.text}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      value={t.answer}
                      onChange={(e) => t.setAnswer(e.target.value.slice(0, 1500))}
                      disabled={t.phase !== "ask"}
                      rows={4}
                      placeholder="Explain your reasoning, or work it out step by step..."
                      className="mt-4 w-full resize-y rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6 shadow-track outline-none transition-shadow focus:border-coral focus:ring-4 focus:ring-coral/20 disabled:bg-sand disabled:text-smoke"
                    />
                  )}

                  {busy && (
                    <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-smoke">
                      <Spinner /> {t.phase === "evaluating" ? "Reading your answer..." : "Writing a new question to check..."}
                    </p>
                  )}

                  <AnimatePresence initial={false}>
                    {(t.phase === "feedback" || t.phase === "reteach" || t.phase === "verifying") && ev && (
                      <motion.div key={`fb-${t.attempts}-${t.phase}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <Box tone={ev.verdict === "correct" ? "mint" : ev.verdict === "partial" ? "sky" : "peach"} title={ev.verdict === "correct" ? "That's right" : ev.verdict === "partial" ? "Partly there" : "Not yet"}>
                          <p>{ev.feedback}</p>
                        </Box>
                        {t.phase === "feedback" && ev.misconception && (
                          <Box tone="peach" title="The likely mix-up">
                            <p>{ev.misconception}</p>
                          </Box>
                        )}
                        {t.phase === "feedback" && ev.hint && (
                          <Box tone="sky" title="Hint">
                            <p>{ev.hint}</p>
                          </Box>
                        )}
                        {t.phase === "reteach" && ev.reteach && (
                          <Box tone="lavender" title="Another way to see it">
                            <p className="whitespace-pre-line">{ev.reteach}</p>
                          </Box>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {t.phase === "ask" && (
                      <Button onClick={t.submit} disabled={!t.answer.trim()}>
                        Check my answer
                      </Button>
                    )}
                    {t.phase === "feedback" && (
                      <>
                        <Button onClick={t.tryAgain}>Try again</Button>
                        {ev?.reteach && (
                          <Button variant="secondary" onClick={t.teachDifferently}>
                            Teach me differently
                          </Button>
                        )}
                        {t.misses >= GIVE_UP_AFTER && (
                          <Button variant="ghost" onClick={t.giveUp}>
                            Show the answer and move on
                          </Button>
                        )}
                        {t.misses < GIVE_UP_AFTER && (
                          <span className="text-xs font-semibold text-smoke">
                            Attempt {t.misses} of {GIVE_UP_AFTER} before you can see the answer.
                          </span>
                        )}
                      </>
                    )}
                    {t.phase === "reteach" && <Button onClick={t.testMe}>Got it, test me</Button>}
                  </div>
                </div>
              </div>
            </section>
          )}

          {t.phase === "complete" && (
            <section className="mt-8 border-t border-line pt-6">
              {t.statusOf(concept.id) === "completed" ? (
                <Box tone="mint" title={`You've shown you understand: ${concept.title}`}>
                  <p>{ev?.feedback}</p>
                </Box>
              ) : (
                <Box tone="peach" title="Marked for more practice">
                  <p className="font-bold">The answer: {q?.answerSketch}</p>
                  <p className="mt-2">We&apos;ll come back to this concept later from the Progress page.</p>
                </Box>
              )}
              <div className="mt-5">
                <Button onClick={t.next}>{t.index + 1 < t.total ? "Continue" : "Finish topic"}</Button>
              </div>
            </section>
          )}
        </>
      )}
    </article>
  );
}

function Finished({ course, topic, statusOf }: { course: Course; topic: Topic; statusOf: (id: string) => ConceptStatus | undefined }) {
  const completed = topic.concepts.filter((c) => statusOf(c.id) === "completed").length;
  return (
    <article className="mt-6 rounded-3xl border border-line bg-linear-to-b from-white to-[#fffaf2] p-6 shadow-card md:p-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Topic complete</h1>
        <p className="mx-auto mt-2 max-w-md text-charcoal/85">
          You showed understanding of {completed} of {topic.concepts.length} concepts.
        </p>
      </div>
      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line text-sm">
        {topic.concepts.map((c) => {
          const status = statusOf(c.id);
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 bg-white px-4 py-3">
              <span className="font-semibold">{c.title}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                  status === "completed" ? "bg-mint text-mint-dark" : status === "needs-practice" ? "bg-peach text-peach-dark" : "bg-sand text-smoke"
                }`}
              >
                {status === "completed" ? "Understood" : status === "needs-practice" ? "Needs practice" : "Not started"}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href={`/courses/${course.id}`}>Back to course</ButtonLink>
        <ButtonLink href="/progress" variant="secondary">
          See progress
        </ButtonLink>
      </div>
    </article>
  );
}

/* ---------- pieces ---------- */

function Label({ children }: { children: ReactNode }) {
  return <p className="mt-5 text-[11px] font-extrabold tracking-wide text-smoke uppercase">{children}</p>;
}

function Box({ tone, title, badge, children }: { tone: "mint" | "sky" | "peach" | "lavender" | "sand"; title: string; badge?: string; children: ReactNode }) {
  const styles = {
    mint: "border-mint bg-mint/70 [&_h3]:text-mint-dark",
    sky: "border-sky bg-sky/60 [&_h3]:text-sky-dark",
    peach: "border-peach bg-peach/60 [&_h3]:text-peach-dark",
    lavender: "border-lavender bg-lavender/60 [&_h3]:text-lavender-dark",
    sand: "border-line bg-sand [&_h3]:text-charcoal",
  }[tone];
  return (
    <div className={`mt-4 rounded-2xl border px-4 py-3.5 text-sm leading-6 text-charcoal ${styles}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-extrabold">{title}</h3>
        {badge && <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-smoke uppercase">{badge}</span>}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/* ---------- what the mascot says ---------- */

function teachLine(t: TeachingSession, topic: Topic, viz: VisualizationTutorState | null): TutorLine {
  const c = t.concept;
  const q = t.question;
  if (t.phase === "finished" || !c) {
    const done = topic.concepts.filter((x) => t.statusOf(x.id) === "completed").length;
    return { key: "finished", state: "celebrating", text: `That's ${topic.title} done. You showed understanding of ${done} of ${topic.concepts.length} concepts.` };
  }
  const base = `${c.id}:${t.phase}:${t.questionKind}:${t.attempts}`;
  switch (t.phase) {
    case "loading":
      return { key: base, state: "thinking", text: "Give me a moment, I'm preparing this concept from your notes." };
    case "explain": {
      const intro = `${c.title}. ${t.lesson?.explanation ?? ""}${t.lesson?.supplement ? " I've also added a note from beyond your PDF." : ""}`;
      const ready = "When you're ready, press the button and I'll ask you a question.";
      if (viz) return demoLine(viz, `${base}:viz:${vizSignature(viz)}`, intro, ready);
      return { key: base, state: "idle", text: `${intro} ${ready}` };
    }
    case "ask": {
      const options = q?.options ? ` Your options: ${q.options.map((o) => `${o.id.toUpperCase()}, ${o.text}`).join(". ")}` : "";
      const lead = t.questionKind === "verification" ? "One more to make sure it stuck." : "Here's my question.";
      return { key: base, state: "idle", text: `${lead} ${q?.prompt ?? ""}${options}` };
    }
    case "evaluating":
      return { key: base, state: "thinking", text: "Let me read that..." };
    case "feedback": {
      const ev = t.evaluation;
      const parts = [ev?.feedback ?? "", ev?.misconception ? `I think the mix-up is: ${ev.misconception}` : "", ev?.hint ? `Hint: ${ev.hint}` : ""].filter(Boolean);
      return { key: base, state: ev?.hint ? "hinting" : "thinking", text: parts.join(" ") };
    }
    case "reteach":
      return { key: base, state: "hinting", text: `Let me explain it another way. ${t.evaluation?.reteach ?? ""}` };
    case "verifying":
      return { key: base, state: "celebrating", text: `${t.evaluation?.feedback ?? "Good."} Now a new question to check it stuck.` };
    case "complete":
      return {
        key: base,
        state: t.statusOf(c.id) === "completed" ? "celebrating" : "thinking",
        text: t.statusOf(c.id) === "completed" ? `You've shown you understand ${c.title}. Press Continue.` : `Here's the answer: ${q?.answerSketch ?? ""} We'll practise this one again later.`,
      };
    case "error":
      return { key: base, state: "thinking", text: "Something went wrong on my side. Press Try again, or skip this concept." };
    default:
      return { key: base, state: "idle", text: "" };
  }
}

/** The mascot around the demo: introduce it, mirror its captions, ask the prediction, respond, wrap up. */
function demoLine(viz: VisualizationTutorState, key: string, intro: string, ready: string): TutorLine {
  switch (viz.status) {
    case "idle":
      return viz.started
        ? { key, state: "idle", text: `Press Play to run the demo again. ${ready}` }
        : { key, state: "idle", text: `${intro} There's a short demo under the lesson: press Play to watch it, and I'll stop you for a quick prediction. ${ready}` };
    case "showing":
      return { key, state: "idle", text: viz.caption, silent: true };
    case "checkpoint":
      return { key, state: "thinking", text: `Quick prediction before I show the next part. ${viz.checkpoint ? checkpointSpeech(viz.checkpoint) : ""}` };
    case "answered":
      return {
        key,
        state: viz.answerRight ? "celebrating" : "hinting",
        text: `${(viz.answerRight ? viz.checkpoint?.whenRight : viz.checkpoint?.whenWrong) ?? ""} Press Continue to watch it.`,
      };
    case "done":
      return { key, state: "idle", text: `${viz.lastCaption} That's the demo. ${ready}` };
  }
}
