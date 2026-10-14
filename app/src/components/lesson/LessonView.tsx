"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { TutorPanel } from "@/components/mascot/TutorPanel";
import { SourceBanner } from "@/components/SourceBanner";
import { LearningVisualization } from "@/components/visualizations/LearningVisualization";
import { evaluateAnswer } from "@/lib/engine/evaluate";
import { useSpeech } from "@/lib/speech/useSpeech";
import { recordConceptResult, useProgress } from "@/lib/storage";
import { REVEAL_AFTER_ATTEMPTS, type LessonPhase } from "@/lib/tutor/tutorLine";
import { useTutorGuide } from "@/lib/tutor/useTutorGuide";
import { useTutorSession } from "@/lib/tutor/useTutorSession";
import type { Concept, ConceptStatus, Course, LessonSource, Topic } from "@/lib/types";
import { conceptKey } from "@/lib/types";
import { tutorStateOf } from "@/lib/visualizations/tutorState";
import { usePlayer, type Player } from "@/lib/visualizations/usePlayer";
import { Illustration } from "./Illustration";
import { McqInput } from "./McqInput";
import { ShortAnswerInput } from "./ShortAnswerInput";

type Phase = LessonPhase;

type Props = { course: Course; topic: Topic; source: LessonSource };

const cardSwap = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.25, ease: "easeOut" },
} as const;

/**
 * Runs one topic as a sequence of concepts:
 * introduce, explain, ask, evaluate, hint or confirm, continue.
 * The tutor mascot narrates each step and reacts to the answers. A concept
 * with a visualization also gets a demo the tutor runs and asks about.
 */
export function LessonView({ course, topic, source }: Props) {
  const progress = useProgress();
  const [queue, setQueue] = useState<Concept[]>(topic.concepts);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("asking");
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionResults, setSessionResults] = useState<Record<string, ConceptStatus>>({});

  const total = queue.length;
  const finished = index >= total;
  const concept = finished ? undefined : queue[index];
  const saved = progress[course.id] ?? {};
  const statusOf = (conceptId: string): ConceptStatus | undefined =>
    sessionResults[conceptId] ?? saved[conceptKey(topic.id, conceptId)]?.status;
  const completedCount = topic.concepts.filter((c) => statusOf(c.id) === "completed").length;
  const missed = topic.concepts.filter((c) => sessionResults[c.id] === "needs-practice");

  const speech = useSpeech();
  // The concept's demo. With the voice on it narrates its own captions; the tutor pauses it when it pauses.
  const player = usePlayer(concept?.visualization ?? null, {
    key: concept?.id ?? "",
    narrate: speech.enabled ? speech.say : undefined,
    held: speech.paused,
  });
  const viz = tutorStateOf(player);
  const tutorCtx = { concept, index, total, phase, attempts, notice, finished, completed: completedCount, missed: missed.length, viz };
  const learned = topic.concepts.filter((c) => sessionResults[c.id] === "completed").map((c) => c.title);
  const session = useTutorSession({ ...tutorCtx, topicTitle: topic.title, learned }, speech, {
    retry,
    visualization: player.type ? player.driver : null,
  });
  const guideLine = useTutorGuide(tutorCtx, speech, !session.active);
  // While the demo runs, the bubble mirrors its caption in both modes.
  const line = session.active && session.line && viz?.status !== "showing" ? session.line : guideLine;

  function resetConceptState() {
    setPhase("asking");
    setAnswer("");
    setAttempts(0);
    setNotice(null);
  }

  function check() {
    if (!concept || phase !== "asking") return; // one submission per attempt
    player.pause(); // the demo stops so it does not talk over the feedback
    const result = evaluateAnswer(concept.question, answer);
    setNotice(result.message);
    if (result.incomplete) return;
    if (result.correct) {
      setPhase("correct");
      setSessionResults((prev) => ({ ...prev, [concept.id]: "completed" }));
      recordConceptResult(course.id, topic.id, concept.id, "completed", attempts + 1);
    } else {
      setAttempts((n) => n + 1);
      setPhase("incorrect");
    }
  }

  function retry() {
    if (!concept) return;
    setPhase("asking");
    setNotice(null);
    if (concept.question.kind === "mcq") setAnswer("");
  }

  function reveal() {
    if (!concept) return;
    setPhase("revealed");
    setNotice(null);
    setSessionResults((prev) => ({ ...prev, [concept.id]: "needs-practice" }));
    recordConceptResult(course.id, topic.id, concept.id, "needs-practice", attempts);
  }

  function next() {
    setIndex((i) => i + 1);
    resetConceptState();
  }

  function practiseMissed() {
    setQueue(topic.concepts.filter((c) => sessionResults[c.id] === "needs-practice"));
    setIndex(0);
    resetConceptState();
  }

  const percent = total === 0 ? 100 : Math.round((Math.min(index, total) / total) * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_272px] lg:grid-rows-[auto_1fr]">
      <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link
            href={`/courses/${course.id}`}
            className="rounded-full px-3 py-1.5 font-bold text-smoke transition-colors hover:bg-sand hover:text-charcoal"
          >
            &larr; {course.name}
          </Link>
          <span className="rounded-full bg-sand px-3 py-1 text-xs font-bold text-smoke">
            {finished ? "Topic complete" : `Concept ${index + 1} of ${total}`}
          </span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-sand shadow-track" aria-hidden="true">
          <motion.div
            className="h-full rounded-full bg-coral"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ type: "spring", stiffness: 160, damping: 26 }}
          />
        </div>
        <div className="mt-4">
          <SourceBanner source={source} />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {concept ? (
            <motion.div key={concept.id} {...cardSwap}>
              <ConceptCard
                topic={topic}
                concept={concept}
                phase={phase}
                answer={answer}
                attempts={attempts}
                notice={notice}
                isLast={index + 1 >= total}
                player={player}
                onAnswer={setAnswer}
                onCheck={check}
                onRetry={retry}
                onReveal={reveal}
                onNext={next}
              />
            </motion.div>
          ) : (
            <motion.div key="summary" {...cardSwap}>
              <Summary
                course={course}
                topic={topic}
                statusOf={statusOf}
                missed={missed}
                completed={completedCount}
                onPractiseMissed={practiseMissed}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="order-first lg:order-none lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6 lg:self-start">
        <TutorPanel line={line} speech={speech} session={session} />
      </div>

      <aside className="space-y-4 lg:col-start-2 lg:row-start-2">
        <section className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <h2 className="text-sm font-extrabold">In this topic</h2>
          <ol className="mt-3 space-y-2.5 text-sm">
            {topic.concepts.map((c) => {
              const current = concept?.id === c.id;
              return (
                <li
                  key={c.id}
                  className={`flex items-start gap-2.5 ${current ? "font-bold text-charcoal" : "font-semibold text-smoke"}`}
                >
                  <StatusDot status={statusOf(c.id)} current={current} />
                  <span>{c.title}</span>
                </li>
              );
            })}
          </ol>
        </section>
        <section className="rounded-3xl border border-sky bg-sky/50 p-5">
          <h2 className="text-sm font-extrabold text-sky-dark">About this topic</h2>
          <p className="mt-2 text-sm leading-6 text-charcoal">{topic.whyItMatters}</p>
        </section>
      </aside>
    </div>
  );
}

type ConceptCardProps = {
  topic: Topic;
  concept: Concept;
  phase: Phase;
  answer: string;
  attempts: number;
  notice: string | null;
  isLast: boolean;
  player: Player;
  onAnswer: (value: string) => void;
  onCheck: () => void;
  onRetry: () => void;
  onReveal: () => void;
  onNext: () => void;
};

function ConceptCard({
  topic,
  concept,
  phase,
  answer,
  attempts,
  notice,
  isLast,
  player,
  onAnswer,
  onCheck,
  onRetry,
  onReveal,
  onNext,
}: ConceptCardProps) {
  const locked = phase !== "asking";
  const hint = concept.hints[Math.min(Math.max(attempts, 1), concept.hints.length) - 1];
  const question = concept.question;
  const revealedAnswer =
    question.kind === "mcq"
      ? question.options.find((o) => o.id === question.correctOptionId)?.text
      : question.sampleAnswer;

  return (
    <article className="mt-6 rounded-3xl border border-line bg-linear-to-b from-white to-[#fffaf2] p-6 shadow-card md:p-8">
      <span className="inline-flex rounded-full bg-lavender px-3 py-1 text-xs font-extrabold text-lavender-dark">
        {topic.title}
      </span>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{concept.title}</h1>
      <p className="mt-3 text-base leading-7 text-charcoal/85">{concept.explanation}</p>
      {concept.visualization ? (
        <div className="mt-5">
          <LearningVisualization player={player} />
        </div>
      ) : (
        concept.illustration && (
          <div className="mt-5">
            <Illustration id={concept.illustration} />
          </div>
        )
      )}

      <section className="mt-8 border-t border-line pt-6">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-[#ff8c62] to-[#f06f45] text-sm font-extrabold text-white shadow-button">
            ?
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold">Apply it</h2>
            <p className="mt-1 text-sm leading-6 text-charcoal/85">{concept.question.prompt}</p>

            {concept.question.kind === "mcq" ? (
              <McqInput question={concept.question} value={answer} onChange={onAnswer} disabled={locked} />
            ) : (
              <ShortAnswerInput question={concept.question} value={answer} onChange={onAnswer} disabled={locked} />
            )}

            <AnimatePresence initial={false}>
              {phase === "asking" && notice && (
                <motion.p
                  key="notice"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 text-sm font-semibold text-smoke"
                >
                  {notice}
                </motion.p>
              )}

              {phase === "incorrect" && (
                <motion.div key="incorrect" className="mt-4 space-y-3" {...feedbackMotion}>
                  <FeedbackBox tone="hint" title="Not quite. Here's a hint">
                    {notice && <p className="text-smoke">{notice}</p>}
                    <p className={notice ? "mt-1" : ""}>{hint}</p>
                  </FeedbackBox>
                  <FeedbackBox tone="alternate" title="Another way to think about it">
                    {concept.alternateExplanation}
                  </FeedbackBox>
                </motion.div>
              )}

              {phase === "correct" && (
                <motion.div key="correct" className="mt-4" {...feedbackMotion}>
                  <FeedbackBox tone="success" title="Correct. Here's why">
                    {concept.whyCorrect}
                  </FeedbackBox>
                </motion.div>
              )}

              {phase === "revealed" && (
                <motion.div key="revealed" className="mt-4" {...feedbackMotion}>
                  <FeedbackBox tone="reveal" title="The answer">
                    <p className="font-bold text-charcoal">{revealedAnswer}</p>
                    <p className="mt-2">{concept.whyCorrect}</p>
                    <p className="mt-2 text-xs font-semibold text-smoke">
                      This concept is marked for more practice. You can come back to it from the Progress page.
                    </p>
                  </FeedbackBox>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {phase === "asking" && <Button onClick={onCheck}>Check understanding</Button>}
              {phase === "incorrect" && (
                <>
                  <Button onClick={onRetry}>Try again</Button>
                  {attempts >= REVEAL_AFTER_ATTEMPTS ? (
                    <Button variant="secondary" onClick={onReveal}>
                      Show me the answer and mark for practice
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold text-smoke">
                      Attempt {attempts} of {REVEAL_AFTER_ATTEMPTS} before you can ask to see the answer.
                    </span>
                  )}
                </>
              )}
              {(phase === "correct" || phase === "revealed") && (
                <Button onClick={onNext}>{isLast ? "Finish topic" : "Continue"}</Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}

const feedbackMotion = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
  transition: { type: "spring", stiffness: 380, damping: 30 },
} as const;

type SummaryProps = {
  course: Course;
  topic: Topic;
  statusOf: (conceptId: string) => ConceptStatus | undefined;
  missed: Concept[];
  completed: number;
  onPractiseMissed: () => void;
};

function Summary({ course, topic, statusOf, missed, completed, onPractiseMissed }: SummaryProps) {
  return (
    <article className="mt-6 rounded-3xl border border-line bg-linear-to-b from-white to-[#fffaf2] p-6 shadow-card md:p-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Topic complete</h1>
        <p className="mx-auto mt-2 max-w-md text-charcoal/85">
          You showed understanding of {completed} of {topic.concepts.length} concepts
          {missed.length > 0 ? `; ${missed.length} marked for more practice.` : "."}
        </p>
      </div>
      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line text-sm">
        {topic.concepts.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 bg-white px-4 py-3">
            <span className="font-semibold">{c.title}</span>
            <StatusLabel status={statusOf(c.id)} />
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {missed.length > 0 && (
          <Button onClick={onPractiseMissed}>
            Practise the {missed.length} I missed
          </Button>
        )}
        <ButtonLink href={`/courses/${course.id}`} variant={missed.length > 0 ? "secondary" : "primary"}>
          Back to course
        </ButtonLink>
        <ButtonLink href="/progress" variant="secondary">
          See progress
        </ButtonLink>
      </div>
    </article>
  );
}

function FeedbackBox({
  tone,
  title,
  children,
}: {
  tone: "hint" | "alternate" | "success" | "reveal";
  title: string;
  children: ReactNode;
}) {
  const styles = {
    hint: { box: "border-sky bg-sky/60", title: "text-sky-dark" },
    alternate: { box: "border-lavender bg-lavender/60", title: "text-lavender-dark" },
    success: { box: "border-mint bg-mint/70", title: "text-mint-dark" },
    reveal: { box: "border-peach bg-peach/60", title: "text-peach-dark" },
  }[tone];
  return (
    <div className={`rounded-2xl border px-4 py-3.5 text-sm leading-6 text-charcoal shadow-[0_1px_2px_rgba(90,60,30,0.05)] ${styles.box}`}>
      <p className={`font-extrabold ${styles.title}`}>{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function StatusDot({ status, current }: { status?: ConceptStatus; current: boolean }) {
  if (status === "completed") {
    return (
      <span
        aria-label="Completed"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-dark text-[11px] font-extrabold text-white"
      >
        &#10003;
      </span>
    );
  }
  if (status === "needs-practice") {
    return (
      <span
        aria-label="Needs practice"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-peach text-[11px] font-extrabold text-peach-dark"
      >
        !
      </span>
    );
  }
  return (
    <span
      aria-label={current ? "Current" : "Not started"}
      className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 ${current ? "border-coral bg-peach/60" : "border-line bg-white"}`}
    />
  );
}

function StatusLabel({ status }: { status?: ConceptStatus }) {
  if (status === "completed") {
    return <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-extrabold text-mint-dark">Completed</span>;
  }
  if (status === "needs-practice") {
    return <span className="rounded-full bg-peach px-2.5 py-0.5 text-xs font-extrabold text-peach-dark">Needs practice</span>;
  }
  return <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-bold text-smoke">Not started</span>;
}
