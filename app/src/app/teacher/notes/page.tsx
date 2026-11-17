"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { cardClass, spring } from "@/components/motion";
import { AiBadge, Field, inputClass, Pills, SourceChip, StudioHeader, wait } from "@/components/teacher/StudioUI";
import { classes } from "@/lib/teacher/mock";

const steps = ["Your style", "Documents", "Preview"] as const;
const tones = ["Friendly", "Formal", "Story-driven", "Straight to the point"] as const;
const levels = ["Grade 9", "Grade 10", "Grade 11", "Grade 12"] as const;
const formats = ["Bullet points", "Cornell notes", "Q&A", "Outline", "Mind map"] as const;
const extras = ["Real-life examples", "Key vocabulary box", "Diagrams", "Check-your-understanding", "Summary"] as const;

export default function NoteMakerPage() {
  const [step, setStep] = useState(0);
  const [tone, setTone] = useState<(typeof tones)[number]>("Friendly");
  const [level, setLevel] = useState<(typeof levels)[number]>("Grade 10");
  const [format, setFormat] = useState<(typeof formats)[number]>("Cornell notes");
  const [extra, setExtra] = useState<(typeof extras)[number][]>(["Real-life examples", "Key vocabulary box"]);
  const [files, setFiles] = useState(["Unit 3 – Cell Division (slides).pdf", "Mitosis worksheet.docx"]);
  const [busy, setBusy] = useState(false);

  const next = async () => {
    if (step === 1) {
      setBusy(true);
      await wait(1200);
      setBusy(false);
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  return (
    <div>
      <StudioHeader title="Note Maker" subtitle="Tell us how you teach, add your documents, and get notes that sound like you." />

      <ol className="mb-6 flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${
                i === step ? "bg-charcoal text-white" : i < step ? "bg-mint text-mint-dark" : "bg-sand text-smoke"
              }`}
            >
              <span>{i < step ? "✓" : i + 1}</span> {s}
            </button>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={spring}
          className={`p-6 ${cardClass}`}
        >
          {step === 0 && (
            <div className="space-y-6">
              <Field label="Class">
                <select className={inputClass} defaultValue={classes[0].id}>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tone">
                <Pills options={tones} value={tone} onChange={setTone} />
              </Field>
              <Field label="Reading level">
                <Pills options={levels} value={level} onChange={setLevel} />
              </Field>
              <Field label="Format">
                <Pills options={formats} value={format} onChange={setFormat} />
              </Field>
              <Field label="Include">
                <Pills options={extras} value={extra} onChange={(v) => setExtra((e) => (e.includes(v) ? e.filter((x) => x !== v) : [...e, v]))} />
              </Field>
              <Field label="Anything else about your style? (optional)">
                <textarea className={`${inputClass} h-24 resize-none`} placeholder="e.g. I always start with a question, use hockey examples, and end with a 3-point summary." />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-line bg-cream p-10 text-center">
                <span className="text-4xl" aria-hidden="true">📄</span>
                <p className="mt-3 font-extrabold">Drop your documents here</p>
                <p className="mt-1 text-sm text-smoke">PDF, Word, PowerPoint. Only your own materials are used.</p>
                <Button variant="secondary" className="mt-4" onClick={() => setFiles((f) => [...f, `Extra notes ${f.length + 1}.pdf`])}>
                  Browse files
                </Button>
              </div>
              <ul className="mt-5 space-y-2">
                <AnimatePresence>
                  {files.map((f) => (
                    <motion.li
                      key={f}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center justify-between rounded-2xl bg-sand px-4 py-2.5 text-sm"
                    >
                      <span className="font-bold">📎 {f}</span>
                      <button type="button" className="text-smoke hover:text-charcoal" onClick={() => setFiles((all) => all.filter((x) => x !== f))} aria-label={`Remove ${f}`}>
                        ✕
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm text-mint-dark">
                🔒 Source Lock is on. The AI only uses these documents and cites where each part comes from.
              </p>
            </div>
          )}
          {step === 2 && (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <AiBadge />
                <span className="rounded-full bg-peach px-2.5 py-0.5 text-xs font-bold text-peach-dark">
                  {tone} · {level} · {format}
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-extrabold">Cell Division: Mitosis</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="rounded-2xl bg-sand p-4 text-sm font-bold text-smoke">
                  <p>Cues</p>
                  <ul className="mt-2 space-y-2 font-normal">
                    <li>Why do cells divide?</li>
                    <li>What are the 4 phases?</li>
                    <li>Mitosis vs cytokinesis?</li>
                  </ul>
                </div>
                <div className="space-y-3 text-sm leading-6">
                  <p>
                    Ever wondered how a cut on your hand heals? Your cells copy themselves! <b>Mitosis</b> is how one cell becomes two identical cells.{" "}
                    <SourceChip source="Slides p.4" />
                  </p>
                  <p>
                    The four phases are <b>Prophase, Metaphase, Anaphase, Telophase</b> (remember: “PMAT”). <SourceChip source="Slides p.6" />
                  </p>
                  <div className="rounded-2xl bg-sky p-3 text-sky-dark">
                    <b>Key vocabulary:</b> chromosome, chromatid, centromere, spindle fibres
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-lavender p-3 text-sm text-lavender-dark">
                <b>Summary:</b> One cell → two identical cells, in four phases, followed by cytokinesis.
              </div>

              <p className="mt-6 text-sm font-extrabold">Turn these notes into…</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["Quiz", "Flashcards", "Explanation", "Study Guide"].map((t) => (
                  <ButtonLink key={t} variant="secondary" href={`/teacher/generate?type=${encodeURIComponent(t)}`} className="px-4 py-2">
                    ✨ {t}
                  </ButtonLink>
                ))}
                <ButtonLink variant="secondary" href="/teacher/exam" className="px-4 py-2">
                  🧾 Exam
                </ButtonLink>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
          ← Back
        </Button>
        {step < 2 ? (
          <Button onClick={next} disabled={busy}>
            {busy ? "Writing your notes…" : step === 1 ? "✨ Generate notes" : "Next →"}
          </Button>
        ) : (
          <ButtonLink href="/teacher/review">Send to review →</ButtonLink>
        )}
      </div>
    </div>
  );
}
