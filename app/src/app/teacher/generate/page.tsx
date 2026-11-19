"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { cardClass, spring } from "@/components/motion";
import { AiBadge, Field, inputClass, Pills, SourceChip, StudioHeader, wait } from "@/components/teacher/StudioUI";
import { classes, flashcards, quiz } from "@/lib/teacher/mock";

const types = ["Quiz", "Flashcards", "Explanation", "Study Guide"] as const;
type GenType = (typeof types)[number];
const difficulty = ["Easy", "Mixed", "Challenging"] as const;
const qTypes = ["Multiple choice", "True/False", "Short answer", "Fill in the blank"] as const;

export default function GeneratePage() {
  return (
    <Suspense>
      <Generate />
    </Suspense>
  );
}

function Generate() {
  const initial = useSearchParams().get("type") as GenType | null;
  const [type, setType] = useState<GenType>(initial && types.includes(initial) ? initial : "Quiz");
  const [diff, setDiff] = useState<(typeof difficulty)[number]>("Mixed");
  const [qt, setQt] = useState<(typeof qTypes)[number][]>(["Multiple choice", "Short answer"]);
  const [count, setCount] = useState(10);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  const generate = async () => {
    setState("busy");
    await wait(1300);
    setState("done");
  };

  return (
    <div>
      <StudioHeader title="Generate" subtitle="Create practice material from your uploaded notes. Everything starts as a draft." />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className={`space-y-5 self-start p-5 ${cardClass}`}>
          <Field label="What do you want to make?">
            <Pills options={types} value={type} onChange={(t) => { setType(t); setState("idle"); }} />
          </Field>
          <Field label="Class & source">
            <select className={inputClass}>
              {classes.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
            </select>
            <select className={`${inputClass} mt-2`}>
              <option>Unit 3 – Cell Division (slides).pdf</option>
              <option>Mitosis notes (Note Maker)</option>
            </select>
          </Field>
          <Field label="Difficulty">
            <Pills options={difficulty} value={diff} onChange={setDiff} />
          </Field>
          {type === "Quiz" && (
            <Field label="Question types">
              <Pills options={qTypes} value={qt} onChange={(v) => setQt((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]))} />
            </Field>
          )}
          {(type === "Quiz" || type === "Flashcards") && (
            <Field label={`How many? ${count}`}>
              <input type="range" min={5} max={40} value={count} onChange={(e) => setCount(+e.target.value)} className="w-full accent-coral" />
            </Field>
          )}
          <Button className="w-full" onClick={generate} disabled={state === "busy"}>
            {state === "busy" ? "Generating…" : `✨ Generate ${type}`}
          </Button>
        </div>

        <div className={`min-h-[420px] p-6 ${cardClass}`}>
          <AnimatePresence mode="wait">
            {state === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full flex-col items-center justify-center py-20 text-center">
                <span className="text-5xl" aria-hidden="true">✨</span>
                <p className="mt-3 font-extrabold">Your preview will appear here</p>
                <p className="mt-1 text-sm text-smoke">Pick your options and press Generate.</p>
              </motion.div>
            )}
            {state === "busy" && (
              <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 py-4">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div key={i} className="h-16 rounded-2xl bg-sand" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }} />
                ))}
              </motion.div>
            )}
            {state === "done" && (
              <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <AiBadge />
                  <span className="text-xs font-bold text-smoke">Draft · not visible to students</span>
                </div>
                <Preview type={type} />
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <Button variant="secondary" onClick={generate}>↻ Regenerate</Button>
                  <ButtonLink href="/teacher/review">Send to review →</ButtonLink>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
function Preview({ type }: { type: GenType }) {
  if (type === "Quiz")
    return (
      <ol className="mt-5 space-y-4">
        {quiz.map((q, i) => (
          <li key={q.q} className="rounded-2xl border border-line p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold">{i + 1}. {q.q}</p>
              <SourceChip source={q.source} />
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((o, j) => (
                <li key={o} className={`rounded-xl px-3 py-2 text-sm ${j === q.answer ? "bg-mint font-bold text-mint-dark" : "bg-sand"}`}>
                  {String.fromCharCode(65 + j)}. {o}
                </li>
              ))}
            </ul>
          </li>
        ))}
        <li className="text-center text-sm text-smoke">+ 8 more questions</li>
      </ol>
    );
  if (type === "Flashcards") return <FlashcardDeck />;
  if (type === "Explanation")
    return (
      <div className="mt-5 space-y-3 text-sm leading-6">
        <h3 className="text-xl font-extrabold">Why does mitosis matter?</h3>
        <p>Your body makes millions of new cells every second to grow and repair itself. Each new cell needs a perfect copy of your DNA. <SourceChip source="Slides p.4" /></p>
        <p className="rounded-2xl bg-sky p-3 text-sky-dark"><b>Think of it like:</b> photocopying a whole textbook, then splitting the copies into two binders.</p>
        <p className="rounded-2xl bg-lavender p-3 text-lavender-dark"><b>Common mistake:</b> mixing up mitosis (2 identical cells) with meiosis (4 different sex cells).</p>
      </div>
    );
  return (
    <div className="mt-5 space-y-3 text-sm">
      <h3 className="text-xl font-extrabold">Study Guide: Unit 3</h3>
      {["Learning goals", "Key vocabulary", "Main ideas", "Practice questions", "Self-check"].map((s, i) => (
        <div key={s} className="flex items-center gap-3 rounded-2xl bg-sand px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white font-extrabold">{i + 1}</span>
          <span className="font-bold">{s}</span>
        </div>
      ))}
    </div>
  );
}

function FlashcardDeck() {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = flashcards[i];
  const go = (d: number) => {
    setFlipped(false);
    setI((n) => (n + d + flashcards.length) % flashcards.length);
  };
  return (
    <div className="mt-5 flex flex-col items-center">
      <button type="button" onClick={() => setFlipped((f) => !f)} className="w-full max-w-md [perspective:1000px]" aria-label="Flip card">
        <motion.div animate={{ rotateY: flipped ? 180 : 0 }} transition={spring} className="relative h-52 w-full [transform-style:preserve-3d]">
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-peach p-6 text-2xl font-extrabold text-peach-dark shadow-card [backface-visibility:hidden]">
            {card.front}
          </div>
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-mint p-6 text-center text-mint-dark shadow-card [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {card.back}
          </div>
        </motion.div>
      </button>
      <p className="mt-3 text-xs text-smoke">Tap the card to flip</p>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="secondary" className="px-3 py-1.5" onClick={() => go(-1)}>←</Button>
        <span className="text-sm font-bold">{i + 1} / {flashcards.length}</span>
        <Button variant="secondary" className="px-3 py-1.5" onClick={() => go(1)}>→</Button>
      </div>
    </div>
  );
}
