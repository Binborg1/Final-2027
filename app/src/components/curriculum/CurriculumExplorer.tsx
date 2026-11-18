"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { fieldClass, PageHeader } from "@/components/classes/ui";
import { OutcomeCard } from "@/components/curriculum/OutcomeCard";
import { Spinner } from "@/components/Spinner";
import { useAiStatus } from "@/lib/ai/client";
import { addLectureToClass } from "@/lib/classes/client";
import { CATALOG, findOutcome, usableOutcome, type CatalogOutcome } from "@/lib/curriculum/catalog";
import { generateCurriculumLesson } from "@/lib/curriculum/generate";
import { BLOCK_KINDS, BLOCK_LABELS } from "@/lib/curriculum/lesson";
import { useHydrated, useTeaching } from "@/lib/storage";

const STATUS_LABEL: Record<CatalogOutcome["status"], string> = {
  verified: "Verified",
  "source-checked": "From official source",
  unverified: "Unverified",
};

/**
 * Browse the curriculum catalog and start a lesson. Three panes on wide
 * screens (catalog, outcomes, details), one column on small ones. Only
 * catalog content is shown; nothing here is generated.
 */
export function CurriculumExplorer({ fixedClassCode }: { fixedClassCode?: string }) {
  const router = useRouter();
  const ai = useAiStatus();
  const hydrated = useHydrated();
  const teaching = useTeaching();
  const [courseId, setCourseId] = useState(CATALOG[0].courses[0].id);
  const [unitId, setUnitId] = useState(CATALOG[0].courses[0].units[0].id);
  const [outcomeId, setOutcomeId] = useState("sk-sci10-fm2");
  const [classCode, setClassCode] = useState<string>(fixedClassCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const course = CATALOG.flatMap((j) => j.courses).find((c) => c.id === courseId) ?? CATALOG[0].courses[0];
  const unit = course.units.find((u) => u.id === unitId) ?? course.units[0];
  const found = findOutcome(outcomeId);
  const usable = usableOutcome(outcomeId);
  const target = classCode || (teaching.length === 1 ? teaching[0].code : "");
  const targetName = teaching.find((t) => t.code === target)?.name;

  async function onCreate() {
    if (busy || !usable.ok || !target) return;
    setBusy(true);
    setError(null);
    try {
      const { lecture } = await generateCurriculumLesson(outcomeId, ai?.configured === true);
      const res = await addLectureToClass(target, lecture);
      if (!res.ok) throw new Error(res.message);
      router.push(`/teach/${target}/lectures/${lecture.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The lesson could not be created.");
      setBusy(false);
    }
  }

  return (
    <div>
      {fixedClassCode && (
        <nav className="mb-4 text-sm font-medium text-smoke" aria-label="Breadcrumb">
          <Link href="/teach" className="hover:text-charcoal">
            Dashboard
          </Link>
          <span className="mx-1.5">/</span>
          <Link href={`/teach/${fixedClassCode}`} className="hover:text-charcoal">
            {targetName ?? fixedClassCode}
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-charcoal">Curriculum</span>
        </nav>
      )}
      <PageHeader
        eyebrow="Curriculum"
        title="Curriculum explorer"
        description="Official outcomes, quoted exactly from their source, with what has and has not been verified. Pick one to build a lesson your class will only see once you approve it."
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)] wide:grid-cols-[230px_minmax(0,1fr)_minmax(0,420px)]">
        {/* Catalog */}
        <nav aria-label="Curriculum catalog" className="rounded-2xl border border-line bg-white p-4 shadow-card lg:self-start">
          {CATALOG.map((j) => (
            <div key={j.id}>
              <p className="px-2 text-xs font-semibold tracking-wider text-smoke uppercase">{j.name}</p>
              <ul className="mt-2 space-y-3">
                {j.courses.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCourseId(c.id);
                        setUnitId(c.units[0].id);
                      }}
                      aria-pressed={c.id === courseId}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm font-semibold ${c.id === courseId ? "text-charcoal" : "text-smoke hover:text-charcoal"}`}
                    >
                      {c.name} <span className="font-normal text-smoke">· Grade {c.grade}</span>
                    </button>
                    <ul className="mt-1 space-y-1 border-l border-line pl-2">
                      {c.units.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCourseId(c.id);
                              setUnitId(u.id);
                            }}
                            aria-pressed={u.id === unitId}
                            className={`w-full rounded-lg px-2.5 py-2 text-left text-sm ${
                              u.id === unitId ? "bg-lavender font-semibold text-lavender-dark" : "text-smoke hover:bg-sand hover:text-charcoal"
                            }`}
                          >
                            {u.name}
                            <span className="block text-xs font-normal opacity-80">{u.outcomes.length} outcomes</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="mt-4 border-t border-line px-2 pt-3 text-xs leading-relaxed text-smoke">
            Only courses that have been checked against their official source are listed. More are added as they are verified.
          </p>
        </nav>

        {/* Outcomes */}
        <section aria-label="Outcomes" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">{unit.name}</h2>
            <p className="text-xs text-smoke">{course.name}</p>
          </div>
          <fieldset className="mt-3">
            <legend className="sr-only">Choose an outcome</legend>
            <div className="grid gap-2.5">
              {unit.outcomes.map((o) => {
                const selected = o.id === outcomeId;
                return (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-card transition-colors ${
                      selected ? "border-violet ring-4 ring-violet/10" : "border-line hover:border-[#d3ccbf]"
                    }`}
                  >
                    <input type="radio" name="outcome" checked={selected} onChange={() => setOutcomeId(o.id)} className="mt-1 h-4 w-4 shrink-0 accent-[#5b3fd9]" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-bold">{o.code}</span>
                        <span className="rounded-md bg-sand px-1.5 py-0.5 text-[11px] font-semibold text-smoke">{STATUS_LABEL[o.status]}</span>
                        {o.lessonTemplate ? (
                          <span className="rounded-md bg-mint px-1.5 py-0.5 text-[11px] font-semibold text-mint-dark">Lesson available</span>
                        ) : (
                          <span className="rounded-md bg-sand px-1.5 py-0.5 text-[11px] font-semibold text-smoke">Lesson not available yet</span>
                        )}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed">{o.statement}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </section>

        {/* Details and create */}
        <div className="min-w-0 space-y-4 lg:col-span-2 wide:col-span-1">
          {found && <OutcomeCard found={found} compact />}

          <section aria-label="Create a lesson" className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="text-lg font-bold">Create a lesson</h2>
            <p className="mt-1 text-sm text-smoke">Five blocks, each linked to {found?.outcome.code} and checked before you review it:</p>
            <ol className="mt-3 grid gap-1.5 text-sm">
              {BLOCK_KINDS.map((k, i) => (
                <li key={k} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-lavender text-[11px] font-bold text-lavender-dark">{i + 1}</span>
                  {BLOCK_LABELS[k]}
                </li>
              ))}
            </ol>

            {fixedClassCode ? (
              <p className="mt-4 text-sm">
                Adds the lesson to <span className="font-semibold">{targetName ?? fixedClassCode}</span>.
              </p>
            ) : hydrated && teaching.length === 0 ? (
              <p className="mt-4 rounded-xl bg-cream px-3 py-2.5 text-sm text-smoke">
                Lessons belong to a class. <Link href="/teach" className="font-semibold text-violet hover:underline">Create a class</Link> first.
              </p>
            ) : (
              <label className="mt-4 block text-sm">
                <span className="font-semibold">Add it to</span>
                <select value={target} onChange={(e) => setClassCode(e.target.value)} className={`${fieldClass} py-2`}>
                  {teaching.length > 1 && <option value="">Choose a class</option>}
                  {teaching.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <p className="mt-3 text-xs leading-relaxed text-smoke">
              {ai === null
                ? " "
                : ai.configured
                  ? `Written by ${ai.provider}. Funza supplies the outcome from its catalog; the AI can only cite it.`
                  : "No AI provider is set up, so the lesson starts from Funza's starter template for this outcome."}
            </p>
            {!usable.ok && <p className="mt-2 text-sm font-semibold text-coral-dark">{usable.reason}</p>}
            {error && <p className="mt-2 text-sm font-semibold text-coral-dark">{error}</p>}
            <Button className="mt-4 w-full" onClick={onCreate} disabled={busy || !usable.ok || !target || ai === null}>
              {busy && <Spinner />}
              {busy ? "Creating lesson" : "Create lesson"}
            </Button>
            {fixedClassCode && (
              <ButtonLink href={`/teach/${fixedClassCode}`} variant="ghost" className="mt-2 w-full">
                Back to the class
              </ButtonLink>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
