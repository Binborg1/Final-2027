"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currentCatalog, findOutcome as outcomeById, isAutomatic, outcomeLimitations, type CatalogCourse, type CatalogOutcome } from "@/lib/curriculum/catalog";
import { ensureOutcomes, loadCourse, searchCurriculum, useCatalogVersion, useCourseIndex } from "@/lib/curriculum/client";
import type { CourseSummary, OutcomeHit } from "@/lib/curriculum/imported";
import { SOURCES } from "@/lib/curriculum/sources";
import { clearSelection, startBrief, toggleSelection, useWorkspace as useProto } from "@/lib/resources/store";
import { Crumbs, Loading, TopBar } from "./shell";
import { ArrowRight, CheckIcon, ClockIcon, DashedCircleIcon, ExternalIcon, InfoIcon, SearchIcon, XIcon } from "./icons";
import { Button, Card, cx, EmptyState, Eyebrow, inputClass, markOf, Notice, OfficialWording, Pill, Segmented, Skeleton, Spinner, VerificationBadge } from "./ui";

type GradeFilter = "all" | "10" | "11" | "12";

const DEFAULT_COURSE = 63; // Science 10: the course Funza's starter bank was written for.
const coursesNow = () => currentCatalog().flatMap((j) => j.courses);
const byCurriculum = (curriculumId: number) => coursesNow().find((c) => c.curriculumId === curriculumId) ?? null;
const levelText = (levels: number[]) => levels.join(", ");
const gradeText = (grades: number[]) => (grades.length === 0 ? "" : grades.length === 1 ? `Grade ${grades[0]}` : `Grades ${grades[0]}–${grades[grades.length - 1]}`);

export function CurriculumScreen() {
  const s = useProto();
  const router = useRouter();
  const params = useSearchParams();
  const index = useCourseIndex();
  useCatalogVersion();
  const [grade, setGrade] = useState<GradeFilter>("all");
  const [subject, setSubject] = useState("all");
  const [query, setQuery] = useState("");
  const [pickedCourse, setPickedCourse] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [legend, setLegend] = useState(false);
  const [failed, setFailed] = useState<number[]>([]);

  const focused = focusId ?? params.get("o") ?? "sk-sci10-fm2";
  const focusedFound = outcomeById(focused);
  const paramCourse = Number(params.get("course")) || null;
  const curriculumId = pickedCourse ?? paramCourse ?? focusedFound?.course.curriculumId ?? DEFAULT_COURSE;
  const summary = index.courses.find((c) => c.curriculumId === curriculumId) ?? null;
  const course = byCurriculum(curriculumId);
  const fullyLoaded = course?.origin === "import";

  // The focused outcome may come from a course this browser has not loaded yet.
  useEffect(() => {
    const f = outcomeById(focused);
    if (!f) void ensureOutcomes([focused]);
    // A hand-copied outcome gains its indicators from the imported copy of its course.
    else if (f.course.origin === "hand" && f.course.curriculumId) void loadCourse(`sk-${f.course.curriculumId}`);
  }, [focused]);

  // Load the open course (once); hand-copied entries show until it arrives.
  useEffect(() => {
    if (!summary || summary.outcomes === 0) return;
    let live = true;
    void loadCourse(summary.id).then((c) => {
      if (live && !c) setFailed((f) => (f.includes(summary.curriculumId) ? f : [...f, summary.curriculumId]));
    });
    return () => {
      live = false;
    };
  }, [summary]);

  const subjects = useMemo(() => [...new Set(index.courses.map((c) => c.subject ?? "Other"))].sort((a, b) => a.localeCompare(b, "en")), [index.courses]);
  const listed = index.courses.filter((c) => (grade === "all" || c.grades.includes(Number(grade))) && (subject === "all" || (c.subject ?? "Other") === subject));
  const recent = [...new Set([...s.resources].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).flatMap((r) => r.outcomeIds))].slice(0, 4);
  const terms = query.trim();

  const openCourse = (id: number) => {
    setPickedCourse(id);
    setQuery("");
    // Opening a course that failed to load tries again.
    const c = index.courses.find((x) => x.curriculumId === id);
    if (c && failed.includes(id)) {
      setFailed((f) => f.filter((x) => x !== id));
      void loadCourse(c.id).then((loaded) => {
        if (!loaded) setFailed((f) => (f.includes(id) ? f : [...f, id]));
      });
    }
  };
  const createFrom = (ids: string[]) => {
    startBrief(s.brief.kind, ids);
    clearSelection();
    router.push("/create");
  };

  // Outcomes come from this browser's cache and the server's copy, so render only after hydration.
  if (!s.hydrated) return <Loading />;
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
              Every 10-, 20- and 30-level course on curriculum.gov.sk.ca, quoted word for word with its status
              {index.importedOn ? `, as copied on ${index.importedOn}` : ""}. Funza never writes or rewords an outcome.
            </p>
          </div>
          <Button size="sm" variant="ghost" aria-expanded={legend} onClick={() => setLegend((v) => !v)}>
            <InfoIcon />
            What the badges mean
          </Button>
        </header>

        {legend && <Legend />}

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
          <label className="sr-only" htmlFor="cur-subject">
            Subject
          </label>
          <select id="cur-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={cx(inputClass, "h-9 w-auto max-w-[260px]")}>
            <option value="all">All subjects</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
          <div className="relative min-w-[240px] flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--muted)" />
            <input
              type="search"
              aria-label="Search every outcome by code or wording, or courses by name"
              placeholder="Search by code (FP10.4), words or course"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cx(inputClass, "h-9 pl-9")}
            />
          </div>
        </div>

        {recent.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="font-semibold text-(--muted)">Recently used</span>
            {recent.map((id) => {
              const f = outcomeById(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (f?.course.curriculumId) setPickedCourse(f.course.curriculumId);
                    setFocusId(id);
                    setQuery("");
                  }}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-(--line) bg-(--surface) px-2.5 font-semibold hover:border-(--teal-200)"
                >
                  {f?.outcome.code ?? "…"}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-6 grid items-start gap-5 md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_400px]">
          <CourseNav index={index.status} courses={listed} current={curriculumId} searching={terms.length >= 2} onOpen={openCourse} />

          <section aria-label="Outcomes" className="min-w-0">
            {terms.length >= 2 ? (
              <SearchResults
                query={terms}
                grade={grade}
                subject={subject}
                courses={index.courses}
                focused={focused}
                onOpen={(hit) => {
                  const c = index.courses.find((x) => x.id === hit.courseId);
                  if (c) setPickedCourse(c.curriculumId);
                  setFocusId(hit.id);
                  void loadCourse(hit.courseId);
                }}
              />
            ) : (
              <CourseView summary={summary} course={course} loading={!fullyLoaded && !!summary && summary.outcomes > 0 && !failed.includes(curriculumId)} failed={failed.includes(curriculumId)} indexStatus={index.status} focused={focused} onFocus={setFocusId} />
            )}
          </section>

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
              <span className="text-(--muted)"> · {s.selection.map((id) => outcomeById(id)?.outcome.code ?? id).join(", ")}</span>
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

/* ---------- course list ---------- */

function CourseNav({ index, courses, current, searching, onOpen }: { index: string; courses: CourseSummary[]; current: number; searching: boolean; onOpen: (curriculumId: number) => void }) {
  const groups = [...new Set(courses.map((c) => c.subject ?? "Other"))].sort((a, b) => a.localeCompare(b, "en"));
  return (
    <>
      {/* Small screens: a picker, so the outcomes are not below a list of 134 courses. */}
      <div className="md:hidden">
        <label htmlFor="cur-course" className="mb-1 block text-[12px] font-semibold text-(--muted)">
          Course
        </label>
        <select id="cur-course" value={current} onChange={(e) => onOpen(Number(e.target.value))} className={cx(inputClass, "h-10")} disabled={index !== "ready"}>
          {!courses.some((c) => c.curriculumId === current) && <option value={current}>{index === "ready" ? "Choose a course" : "Loading courses…"}</option>}
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {courses
                .filter((c) => (c.subject ?? "Other") === g)
                .map((c) => (
                  <option key={c.id} value={c.curriculumId}>
                    {c.name}
                    {c.outcomes === 0 ? " (no outcomes)" : ""}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
      <CourseList index={index} courses={courses} groups={groups} current={current} searching={searching} onOpen={onOpen} />
    </>
  );
}

function CourseList({ index, courses, groups, current, searching, onOpen }: { index: string; courses: CourseSummary[]; groups: string[]; current: number; searching: boolean; onOpen: (curriculumId: number) => void }) {
  return (
    <nav aria-label="Courses" className="fz-scroll hidden rounded-(--r-lg) border border-(--line) bg-(--surface) p-3 shadow-(--sh-1) md:sticky md:top-[72px] md:block md:max-h-[calc(100vh-96px)] md:overflow-y-auto">
      {index === "loading" || index === "idle" ? (
        <div className="space-y-2 p-1" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : index === "failed" ? (
        <p className="p-2 text-[12.5px] text-(--bad)">The course list could not be loaded. Reload the page to try again.</p>
      ) : courses.length === 0 ? (
        <p className="p-2 text-[12.5px] text-(--muted)">No course matches these filters.</p>
      ) : (
        groups.map((g) => (
          <div key={g} className="mb-3 last:mb-0">
            <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-(--muted) uppercase">{g}</p>
            <ul className="space-y-0.5">
              {courses
                .filter((c) => (c.subject ?? "Other") === g)
                .map((c) => {
                  const on = c.curriculumId === current && !searching;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        aria-current={on ? "true" : undefined}
                        onClick={() => onOpen(c.curriculumId)}
                        className={cx("flex w-full items-start gap-2 rounded-(--r-sm) px-2 py-1.5 text-left text-[13px]", on ? "bg-(--teal-50) text-(--teal-900)" : "text-(--ink-2) hover:bg-(--bg-sunk)")}
                      >
                        <span className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", c.outcomes > 0 ? "bg-(--teal-700)" : "border border-(--line-strong)")} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className={cx("block leading-snug", on && "font-semibold")}>{c.name}</span>
                          <span className="block text-[11.5px] text-(--muted)">{c.outcomes > 0 ? `${gradeText(c.grades)} · ${c.outcomes} outcomes` : "No outcomes published on the site"}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))
      )}
      <p className="mt-2 border-t border-(--line) px-2 pt-2.5 text-[11.5px] leading-relaxed text-(--muted)">
        Every 10-, 20- and 30-level curriculum listed on curriculum.gov.sk.ca. French immersion and Fransaskois versions are not included yet.
      </p>
    </nav>
  );
}

/* ---------- one course ---------- */

function CourseView({
  summary,
  course,
  loading,
  failed,
  indexStatus,
  focused,
  onFocus,
}: {
  summary: CourseSummary | null;
  course: CatalogCourse | null;
  loading: boolean;
  failed: boolean;
  indexStatus: string;
  focused: string;
  onFocus: (id: string) => void;
}) {
  if (!summary) {
    if (indexStatus === "ready") return <EmptyState icon={<DashedCircleIcon className="h-5 w-5" />} title="Choose a course">Pick a course on the left, or search every outcome above.</EmptyState>;
    return <Skeleton className="h-48 w-full" />;
  }
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[20px] font-bold">{summary.name}</h2>
        <a href={summary.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-(--teal-700) hover:underline">
          Official page <ExternalIcon className="h-3.5 w-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-(--muted)">
        <span>
          {summary.subject ?? "Other"} · {levelText(summary.levels)}-level · {gradeText(summary.grades)}
          {summary.outcomes > 0 && ` · ${summary.outcomes} outcomes · ${summary.indicators} indicators`}
        </span>
        {summary.preliminary && <Pill tone="gold">Preliminary</Pill>}
        {summary.version && !summary.preliminary && <Pill tone="none">{summary.version} version</Pill>}
        {summary.renewal && <Pill tone="none">Renewal</Pill>}
      </p>

      {summary.outcomes === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<DashedCircleIcon className="h-5 w-5" />}
            title="No outcomes are published on the site"
            action={
              <a href={summary.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-(--r-md) border border-(--line) bg-(--surface) px-3.5 text-sm font-semibold shadow-(--sh-1) hover:bg-(--surface-2)">
                Read it on curriculum.gov.sk.ca <ExternalIcon className="h-4 w-4" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            }
          >
            curriculum.gov.sk.ca lists this course but shows no outcomes for it, so there is nothing to align to in Funza.
          </EmptyState>
        </div>
      ) : failed && course?.origin !== "import" ? (
        <div className="mt-4">
          <Notice tone="bad">This course could not be loaded. Check your connection and open it again.</Notice>
        </div>
      ) : (
        <>
          {loading && (
            <p className="mt-3 inline-flex items-center gap-2 text-[12.5px] text-(--muted)" role="status">
              <Spinner /> Loading {summary.outcomes} outcomes…
            </p>
          )}
          {course?.units.map((u) => (
            <div key={u.id} className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-bold">{u.name}</h3>
                {summary.levels.length > 1 && u.level && <Pill tone="none">{u.level}-level</Pill>}
                <Pill tone="none">
                  {u.outcomes.length} outcome{u.outcomes.length === 1 ? "" : "s"}
                </Pill>
              </div>
              <OutcomeList outcomes={u.outcomes} focused={focused} onFocus={onFocus} />
            </div>
          ))}
          {loading && !course && <Skeleton className="mt-4 h-40 w-full" />}
        </>
      )}
    </>
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
            <input type="checkbox" checked={picked} onChange={() => toggleSelection(o.id)} aria-label={`Select ${o.code}`} className="mt-1 h-4 w-4 shrink-0 accent-[#0f766e]" />
            <button type="button" onClick={() => onFocus(o.id)} aria-pressed={on} className="min-w-0 flex-1 text-left">
              <span className="flex flex-wrap items-center gap-2">
                <span className="fz-display text-[15px] font-bold tracking-tight">{o.code}</span>
                <VerificationBadge mark={markOf(o.status)} compact />
                {o.indicatorsStatus === "pending" && <Pill tone="none">No indicators</Pill>}
                {(o.notes?.length ?? 0) > 0 && <Pill tone="gold">Check the note</Pill>}
              </span>
              {/^Module /.test(o.printedWith ?? "") && <span className="mt-0.5 block text-[12.5px] font-semibold text-(--ink-2)">{o.printedWith!.split(" · ")[0]}</span>}
              <span className="mt-1 block text-[14px] leading-relaxed whitespace-pre-line text-(--ink)">{o.statement}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- search ---------- */

function SearchResults({ query, grade, subject, courses, focused, onOpen }: { query: string; grade: string; subject: string; courses: CourseSummary[]; focused: string; onOpen: (hit: OutcomeHit) => void }) {
  const [result, setResult] = useState<{ key: string; hits: OutcomeHit[]; total: number; ok: boolean } | null>(null);
  const key = `${query}|${grade}|${subject}`;
  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => {
      void searchCurriculum(query, { grade, subject }, ctl.signal).then((r) => {
        if (!ctl.signal.aborted) setResult(r.ok ? { key, hits: r.hits, total: r.total, ok: true } : { key, hits: [], total: 0, ok: false });
      });
    }, 220);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [key, query, grade, subject]);

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const courseMatches = courses.filter((c) => words.every((w) => c.name.toLowerCase().includes(w))).slice(0, 8);
  const current = result?.key === key ? result : null;

  return (
    <>
      <h2 className="text-[16px] font-bold" aria-live="polite">
        {current ? `${current.total} outcome${current.total === 1 ? "" : "s"} match “${query}”${current.total > current.hits.length ? ` · showing ${current.hits.length}` : ""}` : `Searching for “${query}”…`}
      </h2>
      {courseMatches.length > 0 && <p className="mt-1 text-[13px] text-(--muted)">Courses: {courseMatches.map((c) => c.name).join(", ")}.</p>}
      {current && !current.ok && (
        <div className="mt-3">
          <Notice tone="bad">Search is not available right now. Try again in a moment.</Notice>
        </div>
      )}
      {current?.ok && current.hits.length === 0 && (
        <div className="mt-3">
          <EmptyState icon={<SearchIcon className="h-5 w-5" />} title="No outcomes match">
            Try a code such as “FP10.4” or “CP20.1”, a few words from the outcome, or clear the grade and subject filters.
          </EmptyState>
        </div>
      )}
      {current && current.hits.length > 0 && (
        <ul className="mt-3 space-y-2">
          {current.hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => onOpen(h)}
                aria-pressed={h.id === focused}
                className={cx("w-full rounded-(--r-lg) border bg-(--surface) px-4 py-3 text-left", h.id === focused ? "border-(--teal-700) shadow-[0_0_0_3px_var(--teal-100)]" : "border-(--line) hover:border-(--line-strong)")}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="fz-display text-[15px] font-bold tracking-tight">{h.code}</span>
                  <VerificationBadge mark={markOf(h.status)} compact />
                  <span className="text-[12px] text-(--muted)">
                    {h.courseName} · {h.unitName}
                  </span>
                </span>
                <span className="mt-1 line-clamp-3 block text-[14px] leading-relaxed whitespace-pre-line">{h.statement}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ---------- one outcome ---------- */

function OutcomeDetail({ id, selected, onCreate }: { id: string; selected: boolean; onCreate: () => void }) {
  const found = outcomeById(id);
  if (!found) return null;
  const { outcome, course, unit } = found;
  const limits = outcomeLimitations(found);
  const auto = isAutomatic(outcome);
  const page = outcome.url ?? course.source.url;
  return (
    <Card as="aside" aria-label={`${outcome.code} details`} className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="fz-display text-[20px] font-bold tracking-tight">{outcome.code}</span>
        <VerificationBadge mark={markOf(outcome.status)} />
      </div>
      <p className="mt-0.5 text-[12.5px] text-(--muted)">
        {course.name} · {unit.name}
      </p>
      <div className="mt-4">
        <OfficialWording statement={outcome.statement} />
        {outcome.printedWith && <p className="mt-1.5 text-[12px] text-(--muted)">Printed with it: {outcome.printedWith}</p>}
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
            Indicators{outcome.indicators.length > 0 ? ` (${outcome.indicators.length})` : ""}
          </h3>
          {outcome.indicatorsStatus === "imported" ? <VerificationBadge mark="imported" compact /> : outcome.indicatorsStatus === "verified" ? <VerificationBadge mark="verified" compact /> : <Pill tone="none">Not in Funza</Pill>}
        </div>
        {outcome.indicators.length > 0 ? (
          <>
            <p className="mt-1 text-[12.5px] text-(--muted)">Copied from the outcome&apos;s official page. Drafts are guided by them; no person has checked them yet.</p>
            <ol className="mt-3 space-y-1.5 text-[12.5px]">
              {outcome.indicators.map((it) => (
                <li key={it.id} className="flex gap-2">
                  <span className="w-7 shrink-0 font-semibold text-(--muted)">({it.label})</span>
                  <span className="min-w-0 whitespace-pre-line">{it.text}</span>
                </li>
              ))}
            </ol>
            {(outcome.guidance?.length ?? 0) > 0 && (
              <div className="mt-3 rounded-(--r-md) bg-(--surface-2) px-3 py-2 text-[12px] text-(--ink-2)">
                <p className="font-semibold">Also printed among the indicators</p>
                {outcome.guidance!.map((g) => (
                  <p key={g} className="mt-1 whitespace-pre-line">
                    {g}
                  </p>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 rounded-(--r-md) border border-dashed border-(--line-strong) px-3 py-2.5 text-[12.5px] text-(--muted)">
            {course.origin === "hand" ? "Loading the indicators from Funza's copy of the official page…" : `The official page prints no indicators for ${outcome.code}. Drafts align to the statement only.`}
          </p>
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
            <a href={page} target="_blank" rel="noreferrer" className="font-semibold text-(--teal-700) hover:underline">
              curriculum.gov.sk.ca · {outcome.code}
              <span className="sr-only"> (opens in a new tab)</span>
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
          <Step done icon={<CheckIcon className="h-3 w-3" />} title={`${auto ? "Copied automatically" : "Copied"} from the official page · ${outcome.checkedOn}`} />
          {auto && (
            <Step
              done={outcome.status === "cross-checked"}
              icon={outcome.status === "cross-checked" ? <CheckIcon className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
              title="Same words in the Ministry's CSV file"
              sub={outcome.status === "cross-checked" ? undefined : "No match"}
            />
          )}
          <Step done={outcome.secondCheck === "done"} icon={<ClockIcon className="h-3 w-3" />} title="A person compares it with the source" sub={outcome.secondCheck === "done" ? undefined : "Pending"} />
          <Step
            done={outcome.indicatorsStatus === "verified"}
            icon={outcome.indicatorsStatus === "verified" ? <CheckIcon className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
            title="Indicators checked by a person"
            sub={outcome.indicatorsStatus === "verified" ? undefined : "Pending"}
          />
        </ol>
      </section>

      {limits.length > 0 && (
        <details className="mt-5 rounded-(--r-md) bg-(--surface-2) px-3 py-2.5 text-[12.5px]" open={(outcome.notes?.length ?? 0) > 0}>
          <summary className="cursor-pointer font-semibold">What to know before relying on it ({limits.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-(--ink-2)">
            {limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-4 text-[11.5px] text-(--muted)">
        Something looks wrong? Compare it with the{" "}
        <a href={page} target="_blank" rel="noreferrer" className="font-semibold text-(--teal-700) hover:underline">
          official page
        </a>{" "}
        or <a href={SOURCES.home} target="_blank" rel="noreferrer" className="font-semibold text-(--teal-700) hover:underline">curriculum.gov.sk.ca</a>; the official page always wins.
      </p>
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
        { mark: "verified" as const, text: "Copied from the official page and checked by a second person. None yet." },
        { mark: "source-checked" as const, text: "Copied by a team member, word for word, from the official page; the second check is pending. Science 10 FM1 to FM4." },
        { mark: "cross-checked" as const, text: "Copied automatically from the official page, and the Ministry's CSV file has the same words. No person has checked it." },
        { mark: "imported" as const, text: "Copied automatically from the official page; no second source agreed (no CSV, or it words it differently). Read the note." },
      ].map((l) => (
        <div key={l.mark}>
          <VerificationBadge mark={l.mark} />
          <p className="mt-1.5 text-[12.5px] text-(--ink-2)">{l.text}</p>
        </div>
      ))}
    </Card>
  );
}
