"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { cardClass, spring } from "@/components/motion";
import { AiBadge, Field, inputClass, Pills, StudioHeader, wait } from "@/components/teacher/StudioUI";
import { classes, quiz } from "@/lib/teacher/mock";

const units = ["Unit 1 – Cells", "Unit 2 – Transport", "Unit 3 – Cell Division", "Unit 4 – Genetics"] as const;
const sections = [
  { name: "Multiple choice", count: 15, marks: 15, color: "bg-peach text-peach-dark" },
  { name: "Short answer", count: 6, marks: 18, color: "bg-sky text-sky-dark" },
  { name: "Long answer", count: 2, marks: 12, color: "bg-lavender text-lavender-dark" },
];

export default function ExamBuilderPage() {
  const [picked, setPicked] = useState<(typeof units)[number][]>(["Unit 1 – Cells", "Unit 2 – Transport", "Unit 3 – Cell Division"]);
  const [easy, setEasy] = useState(30);
  const hard = 20;
  const [version, setVersion] = useState<"A" | "B">("A");
  const [showKey, setShowKey] = useState(false);
  const [built, setBuilt] = useState(false);
  const [busy, setBusy] = useState(false);
  const total = sections.reduce((s, x) => s + x.marks, 0);

  const build = async () => {
    setBusy(true);
    await wait(1400);
    setBusy(false);
    setBuilt(true);
  };

  return (
    <div>
      <StudioHeader title="Exam Builder" subtitle="Plan the exam, let AI draft it from your notes, then review every question." />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className={`space-y-5 self-start p-5 ${cardClass}`}>
          <Field label="Exam title">
            <input className={inputClass} defaultValue="Biology Midterm – Units 1–3" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Class">
              <select className={inputClass}>{classes.map((c) => <option key={c.id}>{c.name}</option>)}</select>
            </Field>
            <Field label="Time limit">
              <select className={inputClass} defaultValue="75 min">{["45 min", "60 min", "75 min", "90 min"].map((t) => <option key={t}>{t}</option>)}</select>
            </Field>
          </div>
          <Field label="Units covered">
            <Pills options={units} value={picked} onChange={(u) => setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : [...p, u]))} />
          </Field>
          <Field label="Difficulty mix">
            <div className="flex h-3 overflow-hidden rounded-full shadow-track">
              <motion.div layout className="bg-mint-dark" style={{ width: `${easy}%` }} />
              <motion.div layout className="bg-coral" style={{ width: `${100 - easy - hard}%` }} />
              <motion.div layout className="bg-lavender-dark" style={{ width: `${hard}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs font-bold text-smoke">
              <span>Easy {easy}%</span><span>Medium {100 - easy - hard}%</span><span>Hard {hard}%</span>
            </div>
            <input type="range" min={10} max={70} value={easy} onChange={(e) => setEasy(+e.target.value)} className="mt-2 w-full accent-coral" aria-label="Easy percentage" />
          </Field>
          <Field label="Blueprint">
            <div className="space-y-2">
              {sections.map((s) => (
                <div key={s.name} className="flex items-center justify-between rounded-2xl bg-sand px-3 py-2 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.color}`}>{s.name}</span>
                  <span className="font-bold">{s.count} Q · {s.marks} marks</span>
                </div>
              ))}
              <p className="text-right text-sm font-extrabold">Total: {total} marks</p>
            </div>
          </Field>
          <Button className="w-full" onClick={build} disabled={busy || picked.length === 0}>
            {busy ? "Drafting exam…" : built ? "↻ Rebuild exam" : "🧾 Build exam"}
          </Button>
        </div>
        <div className={`p-6 ${cardClass}`}>
          <AnimatePresence mode="wait">
            {!built ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-24 text-center">
                <span className="text-5xl" aria-hidden="true">🧾</span>
                <p className="mt-3 font-extrabold">{busy ? "Choosing questions from your notes…" : "Your exam preview will appear here"}</p>
                <p className="mt-1 text-sm text-smoke">Includes versions A/B and an answer key.</p>
              </motion.div>
            ) : (
              <motion.div key="exam" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex rounded-full bg-sand p-1">
                    {(["A", "B"] as const).map((v) => (
                      <button key={v} type="button" onClick={() => setVersion(v)} className="relative rounded-full px-4 py-1 text-sm font-bold">
                        {version === v && <motion.span layoutId="exam-version" transition={spring} className="absolute inset-0 rounded-full bg-white shadow-secondary" />}
                        <span className="relative">Version {v}</span>
                      </button>
                    ))}
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} className="accent-coral" /> Show answer key
                  </label>
                </div>

                <div className="mt-5 rounded-2xl border border-line bg-cream p-6">
                  <div className="border-b border-line pb-3 text-center">
                    <p className="text-lg font-extrabold">Biology Midterm – Units 1–3 (Version {version})</p>
                    <p className="text-xs text-smoke">Name: ____________ · Time: 75 min · Total: {total} marks</p>
                  </div>
                  <p className="mt-4 text-sm font-extrabold">Part A: Multiple choice</p>
                  <ol className="mt-2 space-y-3 text-sm">
                    {(version === "A" ? quiz : [...quiz].reverse()).map((q, i) => (
                      <li key={q.q}>
                        <p className="font-bold">{i + 1}. {q.q}</p>
                        <p className="mt-1 text-smoke">
                          {q.options.map((o, j) => (
                            <span key={o} className={`mr-3 ${showKey && j === q.answer ? "rounded bg-mint px-1 font-bold text-mint-dark" : ""}`}>
                              {String.fromCharCode(97 + j)}) {o}
                            </span>
                          ))}
                        </p>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-5 text-sm font-extrabold">Part B: Short answer</p>
                  <p className="mt-2 text-sm">3. Explain why cells need to divide. Give one example from the human body. <span className="text-smoke">(3 marks)</span></p>
                  {showKey && <p className="mt-1 rounded-xl bg-mint px-3 py-2 text-xs text-mint-dark">Key: growth, repair, replacement; e.g. skin healing a cut.</p>}
                  <p className="mt-4 text-center text-xs text-smoke">… 20 more questions</p>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  <AiBadge />
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => window.print()}>🖨 Print / PDF</Button>
                    <ButtonLink href="/teacher/review">Send to review →</ButtonLink>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
