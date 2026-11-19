"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityStage } from "@/components/activity/ActivityStage";
import { findOutcome } from "@/lib/curriculum/catalog";
import { ALL_OUTCOMES, codeOf } from "@/lib/curriculum/sources";
import { extractPdf } from "@/lib/pdf/extract";
import { bankGaps, blueprintOf, PRESETS } from "@/lib/resources/blueprint";
import { motionGraph } from "@/lib/resources/graph";
import { isQuestionKind, KINDS, NOTES_STYLES, QTYPE_LABEL } from "@/lib/resources/kinds";
import {
  addOutcomeToBrief,
  cancelGeneration,
  createWithoutAi,
  patchBrief,
  removeOutcomeFromBrief,
  resetGeneration,
  setKind,
  setMixRow,
  startBrief,
  startGeneration,
  toast,
  useWorkspace,
} from "@/lib/resources/store";
import type { Brief, ResourceKind } from "@/lib/resources/types";
import { ArrowRight, CheckIcon, CompassIcon, FileIcon, PlusIcon, SparkIcon, UploadIcon, XIcon } from "./icons";
import { KindIcon, Menu, MenuItem } from "./parts";
import { Crumbs, Loading, TopBar } from "./shell";
import { Button, Card, cx, Eyebrow, Field, inputClass, Notice, OutcomeChip, Segmented, Skeleton, Spinner, Stepper, Switch } from "./ui";

const GROUPS: { id: "notes" | "assessment" | "classroom"; label: string }[] = [
  { id: "notes", label: "Teaching notes" },
  { id: "assessment", label: "Assessments" },
  { id: "classroom", label: "Classroom resources" },
];

const SUGGESTIONS = ["Use Saskatchewan examples where they fit.", "Keep sentences short for EAL learners.", "Include one question with a data table.", "Avoid trick questions."];

export function CreateScreen() {
  const ws = useWorkspace();
  const params = useSearchParams();
  const typeParam = params.get("type");
  const outcomeParam = params.get("outcome");
  useEffect(() => {
    const kind = KINDS.find((k) => k.kind === typeParam)?.kind;
    if (kind || (outcomeParam && findOutcome(outcomeParam))) startBrief(kind ?? "quiz", outcomeParam && findOutcome(outcomeParam) ? [outcomeParam] : undefined);
  }, [typeParam, outcomeParam]);
  if (!ws.hydrated) return <Loading />;
  return (
    <>
      <TopBar>
        <Crumbs items={[{ label: "Home", href: "/" }, { label: "Create" }]} />
      </TopBar>
      {ws.generation.state === "idle" ? <BriefView fromFile={params.get("from") === "file"} /> : <GenerationView />}
    </>
  );
}

function BriefView({ fromFile }: { fromFile: boolean }) {
  const ws = useWorkspace();
  const router = useRouter();
  const b = ws.brief;
  const bp = blueprintOf(b);
  const q = isQuestionKind(b.kind);
  const gaps = bankGaps(b.outcomeIds, b.kind);
  const bankHelps = gaps.length < b.outcomeIds.length;
  const blocked = b.outcomeIds.length === 0 || (q && bp.questions === 0);
  const aiReady = ws.ai.known && ws.ai.configured;
  const make = (mode: "bank" | "blank") => router.push(`/resources/${createWithoutAi(mode)}`);

  return (
    <div className="mx-auto grid max-w-[1240px] items-start gap-6 px-4 py-7 md:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-8">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold">Create a resource</h1>
        <p className="mt-1 text-[14.5px] text-(--ink-2)">Choose what you need. Funza drafts it from the outcome you pick and checks it. Nothing reaches students until you approve it and post it.</p>

        <form className="mt-6 space-y-5" onSubmit={(e) => e.preventDefault()} aria-label="Resource settings">
          <Step n={1} title="What are you making?" done>
            <div role="radiogroup" aria-label="Resource type" className="space-y-4">
              {GROUPS.map((grp) => (
                <div key={grp.id}>
                  <p className="mb-2 text-[12px] font-semibold text-(--muted)">{grp.label}</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {KINDS.filter((k) => k.group === grp.id).map((k) => (
                      <TypeCard key={k.kind} kind={k.kind} label={k.label} blurb={k.blurb} on={b.kind === k.kind} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {b.kind === "notes" && (
              <div className="mt-4">
                <p className="mb-2 text-[12px] font-semibold text-(--muted)">Style</p>
                <div role="radiogroup" aria-label="Notes style" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {NOTES_STYLES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      role="radio"
                      aria-checked={b.notesStyle === st.id}
                      onClick={() => patchBrief({ notesStyle: st.id })}
                      className={cx(
                        "rounded-(--r-md) border px-3 py-2.5 text-left transition-[border-color,box-shadow]",
                        b.notesStyle === st.id ? "border-(--teal-700) bg-(--teal-50) shadow-[0_0_0_3px_var(--teal-100)]" : "border-(--line) bg-(--surface) hover:border-(--line-strong)",
                      )}
                    >
                      <span className="block text-[13.5px] font-semibold">{st.label}</span>
                      <span className="block text-[12px] text-(--muted)">{st.blurb}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Step>

          <Step n={2} title="Which outcomes?" done={b.outcomeIds.length > 0}>
            <div className="flex flex-wrap items-center gap-2">
              {b.outcomeIds.map((id) => (
                <OutcomeChip key={id} code={codeOf(id)} onRemove={() => removeOutcomeFromBrief(id)} />
              ))}
              <Menu
                label="Add an outcome"
                triggerClass="inline-flex h-7 items-center gap-1 rounded-(--r-sm) border border-dashed border-(--line-strong) px-2 text-[12.5px] font-semibold text-(--ink-2) hover:border-(--teal-700) hover:text-(--teal-800)"
                trigger={
                  <>
                    <PlusIcon className="h-3.5 w-3.5" /> Add outcome
                  </>
                }
              >
                {(close) => (
                  <>
                    {ALL_OUTCOMES.filter((o) => !b.outcomeIds.includes(o.id)).map((o) => (
                      <MenuItem
                        key={o.id}
                        onSelect={() => {
                          addOutcomeToBrief(o.id);
                          close();
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold">{o.code}</span>
                          <span className="block max-w-[280px] truncate text-[12px] text-(--muted)">{o.statement}</span>
                        </span>
                      </MenuItem>
                    ))}
                    <MenuItem
                      onSelect={() => {
                        close();
                        router.push("/curriculum");
                      }}
                    >
                      <CompassIcon className="h-4 w-4" /> Browse the curriculum…
                    </MenuItem>
                  </>
                )}
              </Menu>
            </div>
            {b.outcomeIds.length === 0 ? (
              <p className="mt-3 text-[13px] text-(--bad)">Choose at least one outcome. Funza only creates from outcomes in its catalog.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {b.outcomeIds.map((id) => {
                  const o = findOutcome(id)?.outcome;
                  return (
                    <li key={id} className="fz-official text-[13.5px]">
                      <span className="font-semibold">{o?.code}</span> “{o?.statement}”
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-[12.5px] text-(--muted)">Indicators for these outcomes are not verified yet, so the draft aligns to the outcome statements only.</p>
          </Step>

          <Step n={3} title="Details" done>
            <Details b={b} />
          </Step>

          {b.kind !== "visualization" && (
            <Step n={4} title="Your own material" optional done={!!b.material || !!b.reuseId}>
              <Material b={b} highlight={fromFile} />
            </Step>
          )}

          {b.kind !== "visualization" && (
            <Step n={5} title="Anything else?" optional done={!!b.instructions.trim()}>
              <label htmlFor="fz-instr" className="sr-only">
                Extra instructions
              </label>
              <textarea
                id="fz-instr"
                rows={3}
                maxLength={600}
                value={b.instructions}
                onChange={(e) => patchBrief({ instructions: e.target.value })}
                placeholder="For example: my class has just finished the walking lab, so refer to it."
                className={cx(inputClass, "resize-y")}
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {SUGGESTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={b.instructions.includes(t)}
                    onClick={() => patchBrief({ instructions: `${b.instructions.trim()} ${t}`.trim() })}
                    className="h-7 rounded-full border border-(--line) bg-(--surface) px-2.5 text-[12px] text-(--ink-2) hover:border-(--teal-200) disabled:opacity-40"
                  >
                    + {t}
                  </button>
                ))}
                <span className="ml-auto text-[11.5px] text-(--muted)">{b.instructions.length}/600</span>
              </div>
              <p className="mt-2 text-[12px] text-(--muted)">Optional, in plain words. Funza still uses only the outcomes above, whatever you write here.</p>
            </Step>
          )}
        </form>
      </div>

      <aside aria-label="Blueprint" className="lg:sticky lg:top-[72px]">
        <Card className="fz-scroll overflow-hidden lg:max-h-[calc(100vh-92px)] lg:overflow-y-auto">
          <div className="border-b border-(--line) bg-(--surface-2) px-5 py-4">
            <Eyebrow>Blueprint · computed from your choices</Eyebrow>
            <p className="fz-display mt-1.5 text-[16px] leading-snug font-bold">{bp.sentence}</p>
            {b.kind === "visualization" ? (
              <Button variant="primary" size="lg" className="mt-4 w-full" disabled={!b.outcomeIds.includes("sk-sci10-fm2")} onClick={() => make("bank")}>
                Build the graph
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : !ws.ai.known ? (
              <Button variant="primary" size="lg" className="mt-4 w-full" disabled>
                <Spinner /> Checking AI drafting…
              </Button>
            ) : aiReady ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  className="mt-4 w-full"
                  disabled={blocked}
                  onClick={() => {
                    void startGeneration();
                    window.scrollTo({ top: 0 });
                  }}
                >
                  <SparkIcon className="h-4 w-4 text-(--gold-100)" />
                  Generate draft
                </Button>
                <p className="mt-2 text-center text-[11.5px] text-(--muted)">Drafted by {ws.ai.provider ?? "the configured AI provider"}. Usually under a minute.</p>
              </>
            ) : (
              <div className="mt-4 space-y-2">
                <Notice tone="none" title="AI drafting is not set up on this server">
                  No AI provider key is configured. You can still start from Funza&apos;s question bank or write it yourself.
                </Notice>
                {bankHelps && (
                  <Button variant="primary" size="lg" className="w-full" disabled={blocked} onClick={() => make("bank")}>
                    Start from Funza&apos;s question bank
                  </Button>
                )}
                <Button variant={bankHelps ? "secondary" : "primary"} size="lg" className="w-full" disabled={blocked} onClick={() => make("blank")}>
                  Write it yourself from the blueprint
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-5 px-5 py-4">
            {q && (
              <dl className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Questions" value={bp.questions} />
                <Stat label="Marks" value={bp.marks} />
                <Stat label="Est. minutes" value={bp.estMinutes ?? 0} hint="Rule of thumb: 1 min per multiple-choice, 3 per calculation, 4 per short answer, 10 per long answer" />
              </dl>
            )}
            <div>
              <p className="text-[12px] font-semibold text-(--muted)">{q ? "Parts" : "Outline"}</p>
              <ol className="mt-1.5 divide-y divide-(--line) rounded-(--r-md) border border-(--line)">
                {bp.parts.length === 0 && <li className="px-3 py-2.5 text-[13px] text-(--muted)">Nothing to make yet.</li>}
                {bp.parts.map((p, i) => (
                  <li key={`${p.title}-${i}`} className="flex items-baseline justify-between gap-3 px-3 py-2 text-[13px]">
                    <span className="min-w-0">
                      <span className="font-semibold">{p.title}</span>
                      {p.detail && <span className="ml-1.5 text-(--muted)">{p.detail}</span>}
                    </span>
                    {p.marks !== null && <span className="shrink-0 font-semibold tabular-nums">{p.marks}</span>}
                  </li>
                ))}
              </ol>
            </div>
            {q && bp.spec.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-(--muted)">Planned marks by outcome and difficulty</p>
                <table className="mt-1.5 w-full text-[12.5px]">
                  <thead>
                    <tr className="text-(--muted)">
                      <th scope="col" className="py-1 text-left font-semibold">
                        Outcome
                      </th>
                      <th scope="col" className="py-1 text-right font-semibold">
                        Found.
                      </th>
                      <th scope="col" className="py-1 text-right font-semibold">
                        Grade
                      </th>
                      <th scope="col" className="py-1 text-right font-semibold">
                        Ext.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {bp.spec.map((r) => (
                      <tr key={r.outcomeId} className="border-t border-(--line)">
                        <th scope="row" className="py-1.5 text-left font-semibold">
                          {r.code}
                        </th>
                        {r.cells.map((c, i) => (
                          <td key={i} className="py-1.5 text-right">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[11.5px] text-(--muted)">A target for the draft; the review screen compares the two.</p>
              </div>
            )}
            {bp.includes.length > 0 && (
              <ul className="space-y-1 text-[13px]">
                {bp.includes.map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--teal-700)" />
                    {x}
                  </li>
                ))}
              </ul>
            )}
            {bp.warnings.map((w) => (
              <Notice key={w} tone="gold">
                {w}
              </Notice>
            ))}
            {!aiReady && ws.ai.known && gaps.length > 0 && bankHelps && b.kind !== "visualization" && (
              <Notice tone="gold">The question bank has nothing for {gaps.map(codeOf).join(", ")}. Those parts start empty for you to write.</Notice>
            )}
            <div className="rounded-(--r-md) bg-(--surface-2) p-3 text-[12.5px] text-(--ink-2)">
              <p className="font-semibold text-(--ink)">What Funza does with this</p>
              <ul className="mt-1.5 space-y-1">
                <li>· Cites only {b.outcomeIds.map(codeOf).join(" and ") || "the outcomes you choose"}; any other code is rejected.</li>
                <li>· Recalculates every answer it can instead of trusting the AI.</li>
                <li className="flex items-center gap-1">
                  · Marks AI-written parts <SparkIcon className="h-3 w-3 text-(--gold-500)" /> until you review them.
                </li>
                <li>· Posts nothing until you approve it and publish it to your class.</li>
              </ul>
            </div>
          </div>
        </Card>
      </aside>
    </div>
  );
}

function Step({ n, title, optional, done, children }: { n: number; title: string; optional?: boolean; done: boolean; children: ReactNode }) {
  return (
    <Card as="section" aria-labelledby={`step-${n}`} className="p-5">
      <h2 id={`step-${n}`} className="flex items-center gap-2.5 text-[15.5px] font-bold">
        <span className={cx("flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold", done ? "bg-(--teal-700) text-white" : "bg-(--bg-sunk) text-(--muted)")} aria-hidden="true">
          {done ? <CheckIcon className="h-3.5 w-3.5" /> : n}
        </span>
        {title}
        {optional && <span className="text-[12px] font-medium text-(--muted)">Optional</span>}
      </h2>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function TypeCard({ kind, label, blurb, on }: { kind: ResourceKind; label: string; blurb: string; on: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => setKind(kind)}
      className={cx(
        "flex items-start gap-3 rounded-(--r-md) border p-3 text-left transition-[border-color,box-shadow,background-color]",
        on ? "border-(--teal-700) bg-(--teal-50)/60 shadow-[0_0_0_3px_var(--teal-100)]" : "border-(--line) bg-(--surface) hover:border-(--line-strong)",
      )}
    >
      <KindIcon kind={kind} />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold">{label}</span>
        <span className="block text-[12px] leading-snug text-(--muted)">{blurb}</span>
      </span>
    </button>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-(--r-md) bg-(--surface-2) px-2 py-2.5" title={hint}>
      <dd className="fz-display text-[22px] leading-none font-bold tabular-nums">{value}</dd>
      <dt className="mt-1 text-[11.5px] text-(--muted)">{label}</dt>
    </div>
  );
}

function Details({ b }: { b: Brief }) {
  const q = isQuestionKind(b.kind);
  const total = b.mix.reduce((n, r) => n + r.count * r.marks, 0);
  return (
    <div className="space-y-5">
      <Field label="Title" htmlFor="fz-title" hint="Shown at the top of the document.">
        <input id="fz-title" value={b.title} maxLength={120} onChange={(e) => patchBrief({ title: e.target.value })} className={inputClass} />
      </Field>

      {q && (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <p className="text-[13px] font-semibold">Time allowed</p>
              <div className="mt-1.5">
                <Stepper label="Minutes allowed" value={b.duration} min={5} max={180} suffix="min" onChange={(v) => patchBrief({ duration: v })} />
              </div>
            </div>
            <div>
              <p className="text-[13px] font-semibold">Question order</p>
              <div className="mt-1.5">
                <Segmented
                  size="sm"
                  label="Question order"
                  value={b.ordering}
                  onChange={(v) => patchBrief({ ordering: v })}
                  options={[
                    { value: "by-type", label: "By type" },
                    { value: "by-difficulty", label: "Easiest first" },
                    { value: "by-outcome", label: "By outcome" },
                  ]}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[13px] font-semibold">Question mix</p>
            <div className="mt-1.5 overflow-x-auto rounded-(--r-md) border border-(--line)">
              <table className="w-full min-w-[440px] text-[13px]">
                <thead className="bg-(--surface-2) text-[11.5px] text-(--muted)">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">
                      Type
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">
                      How many
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">
                      Marks each
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Marks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--line)">
                  {b.mix.map((r) => (
                    <tr key={r.type} className={r.count === 0 ? "text-(--muted)" : ""}>
                      <th scope="row" className="px-3 py-1.5 text-left font-semibold">
                        {QTYPE_LABEL[r.type]}
                      </th>
                      <td className="px-3 py-1.5">
                        <Stepper label={`${QTYPE_LABEL[r.type]} questions`} value={r.count} max={20} onChange={(v) => setMixRow(r.type, { count: v })} />
                      </td>
                      <td className="px-3 py-1.5">
                        <Stepper label={`Marks per ${QTYPE_LABEL[r.type]} question`} value={r.marks} min={1} max={12} onChange={(v) => setMixRow(r.type, { marks: v })} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{r.count * r.marks}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-(--line) bg-(--surface-2)">
                    <th scope="row" colSpan={3} className="px-3 py-2 text-left font-semibold">
                      Total
                    </th>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div>
            <p className="text-[13px] font-semibold">Difficulty</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <Segmented
                size="sm"
                label="Difficulty"
                value={b.difficulty}
                onChange={(v) => patchBrief({ difficulty: v })}
                options={(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => ({ value: k, label: PRESETS[k].label }))}
              />
              <SplitBar split={PRESETS[b.difficulty].split} />
            </div>
          </div>

          <div className="divide-y divide-(--line) rounded-(--r-md) border border-(--line) px-3">
            <Switch label="Answer key" hint="Correct answers for every question, kept for you only." checked={b.answerKey} onChange={(v) => patchBrief({ answerKey: v })} />
            <Switch label="Worked solutions" hint="Step-by-step working for calculations." checked={b.workedSolutions} onChange={(v) => patchBrief({ workedSolutions: v })} />
            <Switch label="Marking rubric" hint="Criteria and marks for written answers." checked={b.rubric} onChange={(v) => patchBrief({ rubric: v })} />
          </div>
        </>
      )}

      {b.kind === "notes" && (
        <div className="divide-y divide-(--line) rounded-(--r-md) border border-(--line) px-3">
          <Switch label="Key terms" hint="A short glossary at the end." checked={b.keyTerms} onChange={(v) => patchBrief({ keyTerms: v })} />
          <Switch label="Interactive distance–time graph" hint="Shown in Funza for you to use in class. SCI10-FM2 only." checked={b.includeGraph} onChange={(v) => patchBrief({ includeGraph: v })} />
          <Switch label="Check-your-understanding questions" checked={b.checkQuestions} onChange={(v) => patchBrief({ checkQuestions: v })} />
        </div>
      )}

      {b.kind === "lesson-plan" && (
        <>
          <div>
            <p className="text-[13px] font-semibold">Class length</p>
            <div className="mt-1.5">
              <Stepper label="Class length in minutes" value={b.planMinutes} min={30} max={120} suffix="min" onChange={(v) => patchBrief({ planMinutes: v })} />
            </div>
          </div>
          <div className="rounded-(--r-md) border border-(--line) px-3">
            <Switch label="Adaptations" hint="Supports and extensions for different learners." checked={b.adaptations} onChange={(v) => patchBrief({ adaptations: v })} />
          </div>
        </>
      )}

      {b.kind === "presentation" && (
        <>
          <div>
            <p className="text-[13px] font-semibold">Slides</p>
            <div className="mt-1.5">
              <Stepper label="Number of slides" value={b.slides} min={3} max={20} onChange={(v) => patchBrief({ slides: v })} />
            </div>
          </div>
          <div className="rounded-(--r-md) border border-(--line) px-3">
            <Switch label="Speaker notes" checked={b.speakerNotes} onChange={(v) => patchBrief({ speakerNotes: v })} />
          </div>
          <Notice tone="none">Funza makes a slide-by-slide outline, posted to Classroom as a document. Building PowerPoint or Google Slides files is not available yet.</Notice>
        </>
      )}

      {b.kind === "visualization" && <GraphPreview />}
    </div>
  );
}

function SplitBar({ split }: { split: readonly number[] }) {
  const labels = ["Foundational", "Grade level", "Extending"];
  const tones = ["bg-(--teal-200)", "bg-(--teal-600)", "bg-(--navy-800)"];
  return (
    <div className="min-w-[220px] flex-1">
      <div className="flex h-2 overflow-hidden rounded-full" aria-hidden="true">
        {split.map((p, i) => (
          <span key={i} className={tones[i]} style={{ width: `${p}%` }} />
        ))}
      </div>
      <p className="mt-1 text-[11.5px] text-(--muted)">{split.map((p, i) => `${labels[i]} ${p}%`).join(" · ")} of marks</p>
    </div>
  );
}

function GraphPreview() {
  const viz = motionGraph({ objects: [{ label: "Rider A", speed: 6 }, { label: "Rider B", speed: 4 }], duration: 10 });
  return (
    <div>
      <p className="text-[13px] font-semibold">Live preview</p>
      <p className="mt-0.5 text-[12.5px] text-(--muted)">Rendered by Funza&apos;s visualization registry, for you to step through with the class. You can change the riders after it is built.</p>
      <div className="mt-2 overflow-hidden rounded-(--r-md) border border-(--line)">
        <ActivityStage config={viz} />
      </div>
    </div>
  );
}

async function readText(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const doc = await extractPdf(file);
    return doc.pages.map((p) => p.lines.map((l) => l.text).join("\n")).join("\n\n");
  }
  return file.text();
}

function Material({ b, highlight }: { b: Brief; highlight: boolean }) {
  const ws = useWorkspace();
  const [drag, setDrag] = useState(false);
  const [reading, setReading] = useState(false);
  async function accept(f: File | undefined) {
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".txt")) {
      toast("Funza can read PDF and plain-text files for now. Save Word or PowerPoint files as PDF first.", "bad");
      return;
    }
    setReading(true);
    try {
      const text = (await readText(f)).replace(/[ \t]+/g, " ").trim();
      if (!text) toast("No text could be read from that file. Scanned pages are images, not text.", "bad");
      else patchBrief({ material: { name: f.name.slice(0, 120), use: "source", text: text.slice(0, 12000) } });
    } catch {
      toast("That file could not be read.", "bad");
    } finally {
      setReading(false);
    }
  }
  return (
    <div className="space-y-3">
      {b.material ? (
        <div className="flex flex-wrap items-center gap-3 rounded-(--r-md) border border-(--line) bg-(--surface-2) px-3 py-2.5">
          <FileIcon className="h-5 w-5 text-(--muted)" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold">{b.material.name}</p>
            <p className="text-[12px] text-(--muted)">
              {b.material.text.length.toLocaleString()} characters read in your browser{b.material.text.length >= 12000 ? " (first 12,000 kept)" : ""}. Only this text is sent, when you generate.
            </p>
          </div>
          <Segmented
            size="sm"
            label="How to use the file"
            value={b.material.use}
            onChange={(use) => patchBrief({ material: { ...b.material!, use } })}
            options={[
              { value: "source", label: "Stick to it" },
              { value: "inspiration", label: "Use as ideas" },
            ]}
          />
          <button type="button" onClick={() => patchBrief({ material: null })} aria-label="Remove file" className="rounded p-1 text-(--muted) hover:bg-(--bg-sunk) hover:text-(--ink)">
            <XIcon />
          </button>
        </div>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void accept(e.dataTransfer.files[0]);
          }}
          className={cx(
            "flex cursor-pointer flex-col items-center rounded-(--r-md) border-2 border-dashed px-4 py-6 text-center transition-colors focus-within:border-(--teal-700)",
            drag || highlight ? "border-(--teal-700) bg-(--teal-50)" : "border-(--line-strong) hover:border-(--teal-200)",
          )}
        >
          {reading ? <Spinner className="h-6 w-6 text-(--teal-700)" /> : <UploadIcon className="h-6 w-6 text-(--muted)" />}
          <span className="mt-2 text-[13.5px] font-semibold">{reading ? "Reading your file…" : "Drop your notes or an old test here"}</span>
          <span className="mt-0.5 text-[12.5px] text-(--muted)">PDF or plain text · or click to choose. Read in your browser.</span>
          <input type="file" accept=".pdf,.txt,application/pdf,text/plain" className="sr-only" autoFocus={highlight} onChange={(e) => void accept(e.target.files?.[0])} />
        </label>
      )}
      {!ws.ai.configured && b.material && <p className="text-[12.5px] text-(--gold-700)">Your file is used only by AI drafting, which is not set up on this server.</p>}
      {ws.resources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <label htmlFor="fz-reuse" className="font-semibold">
            Or build on something in your library
          </label>
          <select id="fz-reuse" value={b.reuseId ?? ""} onChange={(e) => patchBrief({ reuseId: e.target.value || null })} className={cx(inputClass, "h-9 w-auto max-w-full py-1")}>
            <option value="">Nothing</option>
            {ws.resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/* ---------- generating ---------- */

function GenerationView() {
  const ws = useWorkspace();
  const router = useRouter();
  const g = ws.generation;
  const b = ws.brief;
  const bp = blueprintOf(b);
  const [now, setNow] = useState(g.startedAt);
  useEffect(() => {
    if (g.state !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [g.state]);
  const seconds = Math.max(0, Math.round((now - g.startedAt) / 1000));
  const draft = g.resourceId ? ws.drafts[g.resourceId] : null;
  const kindLabel = KINDS.find((k) => k.kind === b.kind)?.label.toLowerCase() ?? "resource";
  const bankHelps = bankGaps(b.outcomeIds, b.kind).length < b.outcomeIds.length;
  const make = (mode: "bank" | "blank") => router.push(`/resources/${createWithoutAi(mode)}`);
  const heading = g.state === "running" ? `Drafting your ${kindLabel}` : g.state === "done" ? "Your draft is ready to review" : g.state === "cancelled" ? "Generation stopped" : (g.error?.title ?? "Something went wrong");

  return (
    <div className="mx-auto grid max-w-[1180px] items-start gap-6 px-4 py-7 md:px-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:px-8">
      <Card className="p-5" aria-labelledby="gen-h">
        <div aria-live="polite">
          <h1 id="gen-h" className="text-[20px] font-bold">
            {heading}
          </h1>
          <p className="mt-1 text-[13.5px] text-(--muted)">
            {g.state === "running" && `${seconds} s · usually under a minute. Keep this tab open.`}
            {g.state === "done" && "Every AI-written part is marked for your review. Nothing has been posted."}
            {(g.state === "cancelled" || g.state === "failed") && "Nothing was saved. Your settings are kept."}
          </p>
        </div>

        <ol className="mt-5 space-y-3.5" aria-label="Progress">
          {g.stages.map((st, i) => {
            const failedHere = g.state === "failed" && i === g.stage;
            const done = g.state === "done" || i < g.stage;
            const running = g.state === "running" && i === g.stage;
            return (
              <li key={st.id} className="flex gap-3">
                <span
                  className={cx(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    failedHere ? "bg-(--bad) text-white" : done ? "bg-(--teal-700) text-white" : running ? "text-(--teal-700)" : "border border-(--line-strong) text-transparent",
                  )}
                  aria-hidden="true"
                >
                  {failedHere ? <XIcon className="h-3 w-3" /> : done ? <CheckIcon className="h-3 w-3" /> : running ? <Spinner className="h-4 w-4" /> : null}
                </span>
                <div className="min-w-0">
                  <p className={cx("text-[13.5px] font-semibold", !done && !running && !failedHere && "text-(--muted)")}>
                    {st.label}
                    <span className="sr-only">{failedHere ? " (failed)" : done ? " (done)" : running ? " (in progress)" : " (waiting)"}</span>
                  </p>
                  {(done || running || failedHere) && <p className="text-[12.5px] text-(--muted)">{st.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>

        {g.state === "failed" && g.error && (
          <div className="mt-5">
            <Notice tone="bad" title={g.error.title}>
              {g.error.message}
            </Notice>
          </div>
        )}
        {g.state === "done" && draft && draft.notices.length > 0 && (
          <div className="mt-5 space-y-2">
            {draft.notices.map((n) => (
              <Notice key={n} tone="gold">
                {n}
              </Notice>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {g.state === "running" && <Button onClick={cancelGeneration}>Cancel</Button>}
          {g.state === "done" && g.resourceId && (
            <Button
              variant="primary"
              onClick={() => {
                const id = g.resourceId!;
                resetGeneration();
                router.push(`/resources/${id}`);
              }}
            >
              Open the draft
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {(g.state === "failed" || g.state === "cancelled") && (
            <>
              {g.error?.code !== "not-configured" && g.error?.code !== "invalid-outcome" && (
                <Button variant="primary" onClick={() => void startGeneration()}>
                  {g.state === "cancelled" ? "Generate again" : "Try again"}
                </Button>
              )}
              {bankHelps && <Button onClick={() => make("bank")}>Start from the question bank</Button>}
              <Button onClick={() => make("blank")}>Write it yourself</Button>
              <Button variant="ghost" onClick={resetGeneration}>
                Back to settings
              </Button>
            </>
          )}
        </div>
      </Card>

      <section aria-label="Draft preview" className="min-w-0">
        <div className="fz-paper mx-auto max-w-[680px] px-8 py-9 md:px-12">
          <p className="text-[12px] font-semibold tracking-wide text-(--muted) uppercase">Science 10 · {b.outcomeIds.map(codeOf).join(", ")}</p>
          <h2 className="mt-1 text-[22px] font-bold">{b.title}</h2>
          {isQuestionKind(b.kind) && (
            <p className="mt-1 text-[13px] text-(--muted)">
              {bp.questions} questions · {bp.marks} marks · {b.duration} minutes
            </p>
          )}
          <div className="mt-6 space-y-6">
            {bp.parts.map((p, i) => (
              <div key={`${p.title}-${i}`}>
                <p className="text-[14px] font-bold">{p.title}</p>
                {g.state === "done" ? (
                  <p className="mt-1 text-[13px] text-(--ok)">Drafted and checked</p>
                ) : g.state === "running" ? (
                  <div className="mt-2 space-y-2">
                    <Skeleton className="h-2.5 w-[92%]" />
                    <Skeleton className="h-2.5 w-[78%]" />
                    <Skeleton className="h-2.5 w-[64%]" />
                  </div>
                ) : (
                  <p className="mt-1 text-[13px] text-(--muted)">Not drafted</p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-8 border-t border-(--line) pt-3 text-[12px] text-(--muted)">Funza shows the draft only after it has been validated and its answers recomputed. Unchecked text is never displayed.</p>
        </div>
      </section>
    </div>
  );
}
