"use client";

import { useState, type ReactNode } from "react";
import { outcomeLimitations, type CatalogOutcome } from "@/lib/curriculum/catalog";
import { useRouter, useSearchParams } from "next/navigation";
import { findOutcome as outcomeById } from "@/lib/curriculum/catalog";
import { ALL_OUTCOMES, COURSES, SK, SOURCES, STAGED_INDICATORS, type CourseEntry } from "@/lib/curriculum/sources";
import { clearSelection, startBrief, toggleSelection, useWorkspace as useProto } from "@/lib/resources/store";
import { Crumbs, TopBar } from "./shell";
import { ArrowRight, CheckIcon, ClockIcon, DashedCircleIcon, ExternalIcon, InfoIcon, SearchIcon, XIcon } from "./icons";
import { Button, Card, cx, EmptyState, Eyebrow, inputClass, Notice, OfficialWording, Pill, Segmented, VerificationBadge } from "./ui";

type GradeFilter = "all" | "10" | "11" | "12";
type SubjectFilter = "all" | "Science" | "Mathematics";

export function CurriculumScreen() {
  const s = useProto();
  const router = useRouter();
  const params = useSearchParams();
  const [grade, setGrade] = useState<GradeFilter>("all");
  const [subject, setSubject] = useState<SubjectFilter>("all");
  const [query, setQuery] = useState("");
  const [courseName, setCourseName] = useState("Science 10");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [legend, setLegend] = useState(false);

  const focused = focusId ?? params.get("o") ?? "sk-sci10-fm2";
  const recent = [...new Set([...s.resources].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).flatMap((r) => r.outcomeIds))].slice(0, 4);
  const courses = COURSES.filter((c) => (grade === "all" || String(c.grade) === grade) && (subject === "all" || c.subject === subject));
  const course = COURSES.find((c) => c.name === courseName) ?? COURSES[0];
  const catalogCourse = SK.courses.find((c) => c.id === course.catalogId);
  const terms = query.trim().toLowerCase();
  const matches = terms ? ALL_OUTCOMES.filter((o) => `${o.code} ${o.statement}`.toLowerCase().includes(terms)) : null;
  const courseMatches = terms ? COURSES.filter((c) => c.name.toLowerCase().includes(terms)) : [];

  const createFrom = (ids: string[]) => {
    startBrief(s.brief.kind, ids);
    clearSelection();
    router.push("/create");
  };

  return (
    <>
      <TopBar>
        <Crumbs items={[{ label: "Curriculum" }]} />
      </TopBar>

      <div className="mx-auto max-w-[1360px] px-4 pt-7 pb-28 md:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <Eyebrow>Saskatchewan · Grades 10 to 12</Eyebrow>
            <h1 className="mt-1 text-[28px] font-bold">Curriculum</h1>
            <p className="mt-1 text-[14.5px] text-(--ink-2)">
              Outcomes are quoted exactly from curriculum.gov.sk.ca with their verification status. Funza never writes or rewords an outcome.
            </p>
          </div>
          <Button size="sm" variant="ghost" aria-expanded={legend} onClick={() => setLegend((v) => !v)}>
            <InfoIcon />
            What the badges mean
          </Button>
        </header>

        {legend && <Legend />}

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Segmented
            label="Grade"
            value={grade}
            onChange={setGrade}
            options={[
              { value: "all", label: "All grades" },
              { value: "10", label: "Grade 10" },
              { value: "11", label: "Grade 11" },
              { value: "12", label: "Grade 12" },
            ]}
          />
          <Segmented
            label="Subject"
            value={subject}
            onChange={setSubject}
            options={[
              { value: "all", label: "All subjects" },
              { value: "Science", label: "Science" },
              { value: "Mathematics", label: "Mathematics" },
            ]}
          />
          <div className="relative min-w-[240px] flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--muted)" />
            <input
              type="search"
              aria-label="Search outcomes by code or wording, or courses by name"
              placeholder="Search by code (FM2), words (constant speed) or course"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cx(inputClass, "h-9 pl-9")}
            />
          </div>
        </div>

        {recent.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="font-semibold text-(--muted)">Recently used</span>
            {recent.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setCourseName("Science 10");
                  setFocusId(id);
                  setQuery("");
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-(--line) bg-(--surface) px-2.5 font-semibold hover:border-(--teal-200)"
              >
                {outcomeById(id)?.outcome.code}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 grid items-start gap-5 md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_400px]">
          {/* Courses */}
          <nav aria-label="Courses" className="rounded-(--r-lg) border border-(--line) bg-(--surface) p-3 shadow-(--sh-1) md:sticky md:top-[72px] md:max-h-[calc(100vh-96px)] md:overflow-y-auto">
            {[10, 11, 12].map((g) => {
              const list = courses.filter((c) => c.grade === g);
              if (list.length === 0) return null;
              return (
                <div key={g} className="mb-3 last:mb-0">
                  <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-(--muted) uppercase">
                    Grade {g} · {g === 10 ? "10" : g === 11 ? "20" : "30"}-level
                  </p>
                  <ul className="space-y-0.5">
                    {list.map((c) => (
                      <li key={c.name}>
                        <CourseButton c={c} on={c.name === course.name && !matches} onClick={() => {
                          setCourseName(c.name);
                          setQuery("");
                        }} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <p className="mt-2 border-t border-(--line) px-2 pt-2.5 text-[11.5px] leading-relaxed text-(--muted)">
              Course names as listed on the curriculum.gov.sk.ca home page (read 18 Nov 2026). The site&apos;s search lists Biology, Chemistry and Physics 20 as well; the team will confirm before release.
            </p>
          </nav>

          {/* Outcomes */}
          <section aria-label="Outcomes" className="min-w-0">
            {matches ? (
              <>
                <h2 className="text-[16px] font-bold">
                  {matches.length} outcome{matches.length === 1 ? "" : "s"} match “{query}”
                </h2>
                {courseMatches.length > 0 && (
                  <p className="mt-1 text-[13px] text-(--muted)">
                    Courses: {courseMatches.map((c) => c.name).join(", ")}.{" "}
                    {courseMatches.some((c) => !c.catalogId) && "Some are not in Funza's catalog yet, so they have no outcomes to search."}
                  </p>
                )}
                {matches.length === 0 ? (
                  <div className="mt-3">
                    <EmptyState icon={<SearchIcon className="h-5 w-5" />} title="No outcomes match">
                      Funza searches only outcomes in its catalog: Science 10 · Force and Motion today. Try a code like “FM3”.
                    </EmptyState>
                  </div>
                ) : (
                  <OutcomeList outcomes={matches} focused={focused} onFocus={setFocusId} />
                )}
              </>
            ) : catalogCourse ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[20px] font-bold">{catalogCourse.name}</h2>
                  <a href={catalogCourse.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-(--teal-700) hover:underline">
                    Official page <ExternalIcon className="h-3.5 w-3.5" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </div>
                {catalogCourse.units.map((u) => (
                  <div key={u.id} className="mt-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-bold">{u.name}</h3>
                      <Pill tone="none">{u.outcomes.length} outcomes</Pill>
                    </div>
                    <OutcomeList outcomes={u.outcomes} focused={focused} onFocus={setFocusId} />
                  </div>
                ))}
                <Notice tone="none" icon={<DashedCircleIcon className="h-4 w-4" />}>
                  Other Science 10 units are not in Funza&apos;s catalog yet. They will appear here once a team member has copied and checked them against the official page.
                </Notice>
              </>
            ) : (
              <MissingCourse c={course} />
            )}
          </section>

          {/* Detail */}
          <div className="min-w-0 md:col-span-2 xl:sticky xl:top-[72px] xl:col-span-1">
            <OutcomeDetail id={focused} selected={s.selection.includes(focused)} onCreate={() => createFrom([focused])} />
          </div>
        </div>
      </div>

      {s.selection.length > 0 && (
        <div className="fz-pop-in fixed inset-x-0 bottom-0 z-40 border-t border-(--line) bg-(--surface)/95 backdrop-blur md:left-[76px] lg:left-[248px]">
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-3 px-4 py-3 md:px-6 lg:px-8">
            <p className="text-[13.5px]">
              <span className="font-bold">
                {s.selection.length} outcome{s.selection.length === 1 ? "" : "s"} selected
              </span>
              <span className="text-(--muted)"> · {s.selection.map((id) => outcomeById(id)?.outcome.code).join(", ")}</span>
            </p>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                Clear
              </Button>
              <Button size="sm" variant="primary" onClick={() => createFrom(s.selection)}>
                Create from {s.selection.length === 1 ? "this outcome" : `${s.selection.length} outcomes`}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CourseButton({ c, on, onClick }: { c: CourseEntry; on: boolean; onClick: () => void }) {
  const inFunza = !!c.catalogId;
  return (
    <button
      type="button"
      aria-current={on ? "true" : undefined}
      onClick={onClick}
      className={cx("flex w-full items-start gap-2 rounded-(--r-sm) px-2 py-1.5 text-left text-[13px]", on ? "bg-(--teal-50) text-(--teal-900)" : "text-(--ink-2) hover:bg-(--bg-sunk)")}
    >
      <span className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", inFunza ? "bg-(--teal-700)" : "border border-(--line-strong)")} aria-hidden="true" />
      <span className="min-w-0">
        <span className={cx("block leading-snug", on && "font-semibold")}>{c.name}</span>
        <span className="block text-[11.5px] text-(--muted)">{inFunza ? "1 unit in Funza" : "Not in Funza yet"}</span>
      </span>
    </button>
  );
}

function OutcomeList({ outcomes, focused, onFocus }: { outcomes: CatalogOutcome[]; focused: string; onFocus: (id: string) => void }) {
  const { selection } = useProto();
  return (
    <ul className="mt-3 space-y-2">
      {outcomes.map((o) => {
        const on = o.id === focused;
        const picked = selection.includes(o.id);
        return (
          <li key={o.id} className={cx("flex items-start gap-3 rounded-(--r-lg) border bg-(--surface) px-4 py-3.5 transition-[border-color,box-shadow]", on ? "border-(--teal-700) shadow-[0_0_0_3px_var(--teal-100)]" : "border-(--line) hover:border-(--line-strong)")}>
            <input
              type="checkbox"
              checked={picked}
              onChange={() => toggleSelection(o.id)}
              aria-label={`Select ${o.code}`}
              className="mt-1 h-4 w-4 shrink-0 accent-[#0f766e]"
            />
            <button type="button" onClick={() => onFocus(o.id)} aria-pressed={on} className="min-w-0 flex-1 text-left">
              <span className="flex flex-wrap items-center gap-2">
                <span className="fz-display text-[15px] font-bold tracking-tight">{o.code}</span>
                <VerificationBadge mark={o.status === "verified" ? "verified" : "source-checked"} compact />
                {o.indicatorsStatus === "pending" && <Pill tone="none">Indicators pending</Pill>}
              </span>
              <span className="mt-1 block text-[14px] leading-relaxed text-(--ink)">{o.statement}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MissingCourse({ c }: { c: CourseEntry }) {
  return (
    <div>
      <h2 className="text-[20px] font-bold">{c.name}</h2>
      <p className="mt-0.5 text-[13px] text-(--muted)">
        Grade {c.grade} · {c.subject}
      </p>
      <div className="mt-4">
        <EmptyState
          icon={<DashedCircleIcon className="h-5 w-5" />}
          title="Not in Funza's catalog yet"
          action={
            <a href={SOURCES.home} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-(--r-md) border border-(--line) bg-(--surface) px-3.5 text-sm font-semibold shadow-(--sh-1) hover:bg-(--surface-2)">
              Read it on curriculum.gov.sk.ca <ExternalIcon className="h-4 w-4" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          }
        >
          Funza shows an outcome only after a team member has copied it from the official page and a second person has checked it. Until then there is nothing to align to, so you cannot create from this course in Funza.
        </EmptyState>
      </div>
    </div>
  );
}

function OutcomeDetail({ id, selected, onCreate }: { id: string; selected: boolean; onCreate: () => void }) {
  const found = outcomeById(id);
  if (!found) return null;
  const { outcome, course, unit } = found;
  const staged = STAGED_INDICATORS[outcome.id];
  const limits = outcomeLimitations(found);
  return (
    <Card as="aside" aria-label={`${outcome.code} details`} className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="fz-display text-[20px] font-bold tracking-tight">{outcome.code}</span>
        <VerificationBadge mark={outcome.status === "verified" ? "verified" : "source-checked"} />
      </div>
      <p className="mt-0.5 text-[12.5px] text-(--muted)">
        {course.name} · {unit.name}
      </p>
      <div className="mt-4">
        <OfficialWording statement={outcome.statement} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onCreate}>
          Create from this outcome
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button onClick={() => toggleSelection(outcome.id)} aria-pressed={selected}>
          {selected ? <CheckIcon /> : null}
          {selected ? "Selected" : "Add to selection"}
        </Button>
      </div>

      <section className="mt-6" aria-labelledby="ind-h">
        <div className="flex items-center justify-between gap-2">
          <h3 id="ind-h" className="text-[13px] font-bold">
            Indicators
          </h3>
          <Pill tone="none">Not verified</Pill>
        </div>
        <p className="mt-1 text-[12.5px] text-(--muted)">
          Lessons align to the outcome statement only until a team member verifies the indicators.
        </p>
        {staged ? (
          <div className="mt-3 rounded-(--r-md) border border-dashed border-(--line-strong) bg-(--surface-2) p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <VerificationBadge mark="staged" />
              <a href={staged.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-(--teal-700) hover:underline">
                Source <ExternalIcon className="h-3 w-3" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
            <p className="mt-2 text-[12px] text-(--muted)">Read from the official page on {staged.retrievedOn}. Not usable for alignment until checked.</p>
            <ol className="mt-2 space-y-1.5 text-[12.5px]">
              {staged.items.map((it, i) => (
                <li key={`${it.label}-${i}`} className="flex gap-2">
                  <span className="w-5 shrink-0 font-semibold text-(--muted)">({it.label})</span>
                  <span className={cx("min-w-0", !it.text && "text-(--muted) italic")}>
                    {it.text ?? "Wording not captured yet."}
                    {it.note && <span className="mt-0.5 block text-[11.5px] font-semibold text-(--gold-700) not-italic">{it.note}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="mt-3 rounded-(--r-md) border border-dashed border-(--line-strong) px-3 py-2.5 text-[12.5px] text-(--muted)">No indicators have been copied for {outcome.code} yet.</p>
        )}
      </section>

      <section className="mt-6" aria-labelledby="src-h">
        <h3 id="src-h" className="text-[13px] font-bold">
          Source and checks
        </h3>
        <dl className="mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
          <dt className="text-(--muted)">Publisher</dt>
          <dd>{course.source.publisher}</dd>
          <dt className="text-(--muted)">Page</dt>
          <dd className="min-w-0 truncate">
            <a href={course.source.url} target="_blank" rel="noreferrer" className="font-semibold text-(--teal-700) hover:underline">
              curriculum.gov.sk.ca · id 63
            </a>
          </dd>
          <dt className="text-(--muted)">Version</dt>
          <dd>{course.source.versionLabel ?? "None shown on the page"}</dd>
          <dt className="text-(--muted)">Fingerprint</dt>
          <dd className="truncate font-mono text-[11.5px]" title={outcome.fingerprint}>
            {outcome.fingerprint.slice(0, 22)}…
          </dd>
          <dt className="text-(--muted)">Reuse terms</dt>
          <dd>{course.source.reuseTerms ?? "Not stated; to confirm with the Ministry"}</dd>
        </dl>
        <ol className="mt-4 space-y-2.5 border-l-2 border-(--line) pl-4 text-[12.5px]">
          <Step done icon={<CheckIcon className="h-3 w-3" />} title={`Copied from the official page · ${outcome.checkedOn}`} />
          <Step done={outcome.secondCheck === "done"} icon={<ClockIcon className="h-3 w-3" />} title="Second person compares it with the source" sub={outcome.secondCheck === "done" ? undefined : "Pending"} />
          <Step done={outcome.indicatorsStatus === "verified"} icon={outcome.indicatorsStatus === "verified" ? <CheckIcon className="h-3 w-3" /> : <XIcon className="h-3 w-3" />} title="Indicators verified" sub={outcome.indicatorsStatus === "verified" ? undefined : "Pending"} />
        </ol>
      </section>

      {limits.length > 0 && (
        <details className="mt-5 rounded-(--r-md) bg-(--surface-2) px-3 py-2.5 text-[12.5px]">
          <summary className="cursor-pointer font-semibold">What to know before relying on it ({limits.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-(--ink-2)">
            {limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function Step({ done, icon, title, sub }: { done: boolean; icon: ReactNode; title: string; sub?: string }) {
  return (
    <li className="relative">
      <span
        className={cx("absolute top-0.5 -left-[25px] flex h-4 w-4 items-center justify-center rounded-full", done ? "bg-(--ok) text-white" : "border border-(--line-strong) bg-(--surface) text-(--muted)")}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className={done ? "" : "text-(--ink-2)"}>{title}</span>
      {sub && <span className="ml-1.5 font-semibold text-(--gold-700)">{sub}</span>}
      <span className="sr-only">{done ? " (done)" : " (not done)"}</span>
    </li>
  );
}

function Legend() {
  return (
    <Card className="mt-5 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { mark: "verified" as const, text: "Copied from the official page and checked by a second person. None yet: the first checks are pending." },
        { mark: "source-checked" as const, text: "Copied word for word from the official page; the second check is pending. You can create from it." },
        { mark: "staged" as const, text: "Read from the official page but not checked. Shown for transparency; never used for alignment." },
        { mark: "missing" as const, text: "Listed on the official site but not copied into Funza. Nothing to align to yet." },
      ].map((l) => (
        <div key={l.mark}>
          <VerificationBadge mark={l.mark} />
          <p className="mt-1.5 text-[12.5px] text-(--ink-2)">{l.text}</p>
        </div>
      ))}
    </Card>
  );
}
