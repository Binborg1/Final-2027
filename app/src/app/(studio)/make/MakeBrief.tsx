"use client";

import { BookOpen, Check, CircleAlert, FileText, LayoutTemplate, LoaderCircle, Lock, Paperclip, RotateCcw, Sparkles, Target, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceChip } from "@/components/ui/Chip";
import { Checkbox, Input } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";
import { Disclosure } from "@/components/ui/Disclosure";
import { EmptyState } from "@/components/ui/Misc";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { ToggleRow } from "@/components/ui/ToggleRow";
import type { TeacherCourse } from "@/lib/auth/teacher";
import type { CatalogCourse } from "@/lib/curriculum/catalog";
import { loadCourse } from "@/lib/curriculum/client";
import type { ChapterChoice } from "@/lib/courses/model";
import { composeInstructions, type AddPromptId } from "@/lib/make/chapters";
import { blueprintOf, PRESETS } from "@/lib/resources/blueprint";
import { sourceText } from "@/lib/sources/actions";
import { defaultBrief, isQuestionKind, NOTES_STYLES, QTYPE_LABEL } from "@/lib/resources/kinds";
import { cancelGeneration, createWithoutAi, patchBrief, resetGeneration, setKind, setMixRow, startGeneration, useWorkspace } from "@/lib/resources/store";
import type { ResourceKind } from "@/lib/resources/types";
import { saveTemplate } from "@/lib/templates/actions";
import { applyTemplate, clearTemplate, controlsOf, type Controls } from "@/lib/templates/apply";
import { formatFromBrief } from "@/lib/templates/from";
import { categoryInfo, categoryOf } from "@/lib/templates/model";
import { FormatPanel, type FormatMode, type MakeTemplate } from "./FormatPanel";
import { cn } from "@/lib/ui/cn";

/** The server keeps at most six outcomes on a brief. */
const MAX_OUTCOMES = 6;

const TYPES: { kind: ResourceKind; label: string }[] = [
  { kind: "notes", label: "Notes" },
  { kind: "quiz", label: "Quiz" },
  { kind: "test", label: "Test" },
  { kind: "exam", label: "Exam" },
  { kind: "presentation", label: "Slides" },
];

/**
 * F3 Make, "What do you want to make?". One direction: describe it, pick what and
 * from which chapter, then "Make draft". Everything detailed starts collapsed
 * under Adjust. Funza drafts; the teacher reviews and approves on the next screen.
 */
export function MakeBrief({
  courses,
  chapters,
  sources = {},
  templates = [],
  initialPrompt,
  initialCourseId,
  initialChapterIds = [],
  initialTemplateId = null,
}: {
  courses: TeacherCourse[];
  chapters: Record<string, ChapterChoice[]>;
  sources?: Record<string, { id: string; title: string }[]>;
  templates?: MakeTemplate[];
  initialPrompt: string;
  initialCourseId: string | null;
  initialChapterIds?: string[];
  initialTemplateId?: string | null;
}) {
  const router = useRouter();
  const ws = useWorkspace();
  const { brief, generation, ai } = ws;

  const [courseId, setCourseId] = useState(() => courses.find((c) => c.id === initialCourseId)?.id ?? courses[0]?.id ?? null);
  const course = courses.find((c) => c.id === courseId) ?? null;
  const [catalog, setCatalog] = useState<{ id: string; course: CatalogCourse | null } | null>(null);
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [request, setRequest] = useState(initialPrompt);
  const [chips, setChips] = useState<AddPromptId[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const startChapters = useRef(initialChapterIds);
  const startTemplate = useRef(initialTemplateId);
  const [formatMode, setFormatMode] = useState<FormatMode>("adjust");
  const [panelOpen, setPanelOpen] = useState<boolean | null>(null);
  // The teacher's own Adjust settings, kept aside while a template is in use.
  const adjustControls = useRef<Controls | null>(null);
  // "Save these settings as a template": the dialog, and the new template to use once the page has it.
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedPending = useRef<string | null>(null);
  const courseChapters = useMemo(() => (course ? chapters[course.id] ?? [] : []), [chapters, course]);
  const chapterItems = useMemo(
    () => courseChapters.map((c) => ({ id: c.id, label: c.title, hint: c.outcomeRefs.length > 0 ? `${c.outcomeRefs.length} outcome${c.outcomeRefs.length === 1 ? "" : "s"}` : "No outcomes" })),
    [courseChapters],
  );

  // Load the course's curriculum (once per course) for the outcome wording and checks.
  useEffect(() => {
    if (!course?.curriculumCourseId) return;
    let live = true;
    void loadCourse(course.curriculumCourseId).then((c) => {
      if (live) setCatalog({ id: course.id, course: c });
    });
    return () => {
      live = false;
    };
  }, [course?.id, course?.curriculumCourseId]);

  // Start from the chapter in the link, else the course's first chapter with outcomes.
  useEffect(() => {
    if (!course) return;
    const list = chapters[course.id] ?? [];
    const fromLink = list.filter((c) => startChapters.current.includes(c.id));
    startChapters.current = [];
    const first = list.find((c) => c.outcomeRefs.length > 0) ?? list[0];
    const picked = fromLink.length > 0 ? fromLink : first ? [first] : [];
    const ids = picked.map((c) => c.id);
    setChapterIds(ids);
    patchBrief({ courseId: course.id, chapterIds: ids, outcomeIds: [...new Set(picked.flatMap((c) => c.outcomeRefs))].slice(0, MAX_OUTCOMES) });
  }, [course, chapters]);

  // The panel starts open on wide screens and closed on narrow ones.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the screen width is known only in the browser
    setPanelOpen(window.matchMedia("(min-width: 1280px)").matches);
  }, []);

  // A template named in the link (back from "New template", or "Use in Make"): switch to its kind, then use it.
  useEffect(() => {
    const id = startTemplate.current;
    if (!id) return;
    const t = templates.find((x) => x.id === id);
    if (!t) {
      startTemplate.current = null;
      return;
    }
    if (categoryOf(brief.kind) !== t.category) return setKind(categoryInfo(t.category).kinds[0]);
    if (!brief.courseId) return;
    startTemplate.current = null;
    adjustControls.current = controlsOf(brief);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- applying the link once, after the course is set
    setFormatMode("template");
    patchBrief(applyTemplate(brief, t));
  }, [brief, templates]);

  // With Template chosen, a change of kind picks that category's most-used template (or none).
  const category = categoryOf(brief.kind);
  useEffect(() => {
    adjustControls.current = null;
  }, [category]);
  useEffect(() => {
    if (formatMode !== "template" || brief.templateId || startTemplate.current) return;
    const best = templates.filter((t) => t.category === category).sort((a, b) => b.used - a.used)[0];
    if (best) {
      adjustControls.current = adjustControls.current ?? controlsOf(brief);
      patchBrief(applyTemplate(brief, best));
    }
  }, [formatMode, category, brief, templates]);

  // The template just saved from these settings, once the refreshed page lists it.
  useEffect(() => {
    const id = savedPending.current;
    const t = id ? templates.find((x) => x.id === id) : undefined;
    if (!t || categoryOf(brief.kind) !== t.category) return;
    savedPending.current = null;
    adjustControls.current = controlsOf(brief);
    setFormatMode("template");
    patchBrief(applyTemplate(brief, t));
  }, [templates, brief]);

  async function saveSettings() {
    const format = formatFromBrief(brief);
    if (!format) return setSaveError("Add at least one question first.");
    setSaving(true);
    setSaveError(null);
    const res = await saveTemplate({ category, name: saveName, summary: "", format, learnedFrom: [{ kind: "controls", name: "Make settings" }] });
    setSaving(false);
    if (!res.ok) return setSaveError(res.message);
    savedPending.current = res.id;
    setSaveOpen(false);
    router.refresh();
  }

  function chooseTemplate(t: MakeTemplate) {
    if (!brief.templateId) adjustControls.current = controlsOf(brief);
    patchBrief(applyTemplate(brief, t));
  }

  function chooseMode(m: FormatMode) {
    setFormatMode(m);
    if (m === "adjust" && brief.templateId) {
      patchBrief(clearTemplate(brief, adjustControls.current ?? controlsOf(defaultBrief(brief.kind, brief.outcomeIds))));
      adjustControls.current = null;
    }
  }

  // The request and the quick prompts become the brief's instructions.
  useEffect(() => patchBrief({ instructions: composeInstructions(request, chips) }), [request, chips]);

  // When a draft is ready, go and review it.
  useEffect(() => {
    if (generation.state === "done" && generation.resourceId) {
      const id = generation.resourceId;
      resetGeneration();
      router.push(`/make/${id}`);
    }
  }, [generation.state, generation.resourceId, router]);

  const loadingCourse = !!course && catalog?.id !== course.id;
  const bp = useMemo(() => (ws.hydrated ? blueprintOf(brief) : null), [brief, ws.hydrated, ws.catalogVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const questionKind = isQuestionKind(brief.kind);
  const busy = generation.state === "running";

  const chosenOutcomes = useMemo(() => {
    if (!catalog?.course) return [];
    const want = new Set(courseChapters.filter((c) => chapterIds.includes(c.id)).flatMap((c) => c.outcomeRefs));
    return catalog.course.units.flatMap((u) => u.outcomes).filter((o) => want.has(o.id));
  }, [catalog, courseChapters, chapterIds]);

  function toggleChapter(id: string) {
    const next = chapterIds.includes(id) ? chapterIds.filter((x) => x !== id) : [...chapterIds, id];
    if (next.length === 0) return;
    setChapterIds(next);
    const outcomeIds = [...new Set(courseChapters.filter((c) => next.includes(c.id)).flatMap((c) => c.outcomeRefs))].slice(0, MAX_OUTCOMES);
    patchBrief({ chapterIds: next, outcomeIds });
  }

  function toggleOutcome(id: string) {
    const next = brief.outcomeIds.includes(id) ? brief.outcomeIds.filter((x) => x !== id) : [...brief.outcomeIds, id];
    if (next.length === 0) return;
    patchBrief({ outcomeIds: next });
  }

  /** A source already attached to one of the chosen chapters, used as the teacher's notes. */
  const chapterSources = useMemo(() => chapterIds.flatMap((id) => sources[id] ?? []).slice(0, 4), [chapterIds, sources]);
  async function pickSource(id: string) {
    setAttachError(null);
    const res = await sourceText(id);
    if (!res.ok) return setAttachError(res.message);
    patchBrief({ material: { name: res.title.slice(0, 120), use: "source", text: res.text.slice(0, 60000) } });
    setChips((c) => (c.includes("notes") ? c : [...c, "notes"]));
  }

  async function attach(file: File) {
    setAttachError(null);
    try {
      let text = "";
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const { extractPdf } = await import("@/lib/pdf/extract");
        const doc = await extractPdf(file);
        text = doc.pages.map((p) => p.lines.map((l) => l.text).join("\n")).join("\n\n");
      } else if (file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name)) {
        text = await file.text();
      } else {
        setAttachError("Attach a PDF or a text file.");
        return;
      }
      if (!text.trim()) {
        setAttachError("Funza couldn’t find any text in that file. Scanned pages aren’t read yet.");
        return;
      }
      patchBrief({ material: { name: file.name.slice(0, 120), use: "source", text: text.slice(0, 60000) } });
      setChips((c) => (c.includes("notes") ? c : [...c, "notes"]));
    } catch {
      setAttachError("That file couldn’t be read. Try another PDF.");
    }
  }

  if (courses.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="What do you want to make?" size="title-sm" />
        <Card className="p-6">
          <EmptyState icon={BookOpen} title="Add a course first">
            Make starts from a course’s curriculum. Courses come from first-time setup; adding more arrives in the next update.
          </EmptyState>
        </Card>
      </div>
    );
  }

  const crumbs = [{ label: "Home", href: "/" }, { label: course?.title ?? "Make" }, { label: "Make" }];
  const summary = bp
    ? questionKind
      ? `${bp.parts.length} section${bp.parts.length === 1 ? "" : "s"} · ${bp.questions} questions · ${bp.marks} marks · ${brief.duration} min · ${PRESETS[brief.difficulty].label}`
      : brief.kind === "notes"
        ? `${NOTES_STYLES.find((s) => s.id === brief.notesStyle)?.label ?? "Notes"} · ${brief.outcomeIds.length} outcome${brief.outcomeIds.length === 1 ? "" : "s"}`
        : `${brief.slides} slides${brief.speakerNotes ? " with speaker notes" : ""}`
    : "…";
  const chosenTemplate = templates.find((t) => t.id === brief.templateId) ?? null;
  const formatValue = formatMode === "template" ? (chosenTemplate ? `Template · ${chosenTemplate.name}` : "Choose a template, or switch to Adjust") : summary;
  const back = new URLSearchParams();
  if (courseId) back.set("course", courseId);
  if (chapterIds.length > 0) back.set("chapters", chapterIds.join(","));
  if (request.trim()) back.set("prompt", request.trim().slice(0, 500));
  const newTemplateHref = `/templates/new?category=${category}&return=${encodeURIComponent(`/make?${back.toString()}`)}`;

  return (
    // On wide screens the Format panel is its own glass layer on the right, like the sidebar on the left;
    // the page keeps clear of it.
    <div className="flex flex-col gap-[22px] xl:pr-[364px]">
      <PageHeader crumbs={crumbs} title="What do you want to make?" size="title-sm" />

      <div className="grid grid-cols-1 items-start gap-5">
        {/* The Make box */}
        <section aria-label="Your brief" className="flex flex-col gap-5 rounded-box border border-white/60 bg-surface p-7 shadow-box max-sm:p-4">
          {busy || generation.state === "failed" || generation.state === "cancelled" ? (
            <Drafting />
          ) : (
            <div className="flex flex-col gap-2.5 rounded-[20px] border border-ink/10 bg-white/92 px-5 pt-[18px] pb-3.5">
              <label htmlFor="request" className="sr-only">
                Describe what you want
              </label>
              <textarea
                id="request"
                value={request}
                maxLength={500}
                onChange={(e) => setRequest(e.target.value)}
                rows={3}
                placeholder="Describe it, e.g. “a unit test on uniform motion, a bit harder than last time”"
                className="min-h-[84px] w-full resize-none bg-transparent text-section font-medium text-ink caret-accent outline-none placeholder:font-normal placeholder:text-ink-2 max-sm:text-card"
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                {brief.material ? (
                  <span className="mr-auto inline-flex h-8 items-center gap-2 rounded-full bg-accent-tint pr-1 pl-3 text-meta font-semibold text-accent-ink">
                    <FileText aria-hidden size={14} />
                    <span className="max-w-[220px] truncate">{brief.material.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${brief.material.name}`}
                      onClick={() => {
                        patchBrief({ material: null });
                        setChips((c) => c.filter((x) => x !== "notes"));
                      }}
                      className="flex size-6 items-center justify-center rounded-full hover:bg-white/60"
                    >
                      <X aria-hidden size={14} />
                    </button>
                  </span>
                ) : (
                  chapterSources.map((s) => (
                    <button key={s.id} type="button" onClick={() => void pickSource(s.id)} title="Use this chapter source as your notes" className="inline-flex h-8 max-w-[240px] items-center gap-1.5 rounded-full border border-ink/12 bg-white/60 px-3 text-meta font-semibold text-ink hover:bg-white pointer-coarse:h-11">
                      <FileText aria-hidden size={14} className="shrink-0" />
                      <span className="truncate">Use {s.title}</span>
                    </button>
                  ))
                )}
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" className="sr-only" tabIndex={-1} onChange={(e) => e.target.files?.[0] && attach(e.target.files[0])} />
                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-meta font-semibold text-ink-2 hover:bg-ink/5 pointer-coarse:h-11">
                  <Paperclip aria-hidden size={16} strokeWidth={1.5} />
                  {brief.material ? "Replace source" : "Attach a source"}
                </button>
              </div>
              {attachError ? (
                <p role="alert" className="text-meta font-medium text-red-ink">
                  {attachError}
                </p>
              ) : null}
            </div>
          )}

          <div className={cn("flex flex-col gap-3.5", busy && "pointer-events-none opacity-60")} aria-disabled={busy || undefined}>
            {courses.length > 1 ? (
              <ChoiceRow label="Course">
                {courses.map((c) => (
                  <ChoiceChip key={c.id} selected={c.id === courseId} onClick={() => setCourseId(c.id)}>
                    {c.title}
                  </ChoiceChip>
                ))}
              </ChoiceRow>
            ) : null}
            <ChoiceRow label="Type">
              {TYPES.map((t) => (
                <ChoiceChip key={t.kind} selected={brief.kind === t.kind} onClick={() => setKind(t.kind)}>
                  {t.label}
                </ChoiceChip>
              ))}
            </ChoiceRow>
            <ChoiceRow label="Chapters">
              {courseChapters.length === 0 ? (
                <span className="pt-2 text-body text-ink-2">
                  This course has no chapters yet.{" "}
                  {course ? (
                    <Link href={`/courses/${course.id}`} className="font-semibold text-accent-ink hover:underline">
                      Add one on the course page
                    </Link>
                  ) : null}
                </span>
              ) : (
                <MultiSelect
                  label="Chapters"
                  noun={["chapter", "chapters"]}
                  placeholder="Search chapters"
                  min={1}
                  items={chapterItems}
                  selected={chapterIds}
                  onToggle={toggleChapter}
                />
              )}
              {loadingCourse ? (
                <span className="inline-flex h-9 items-center gap-2 text-body text-ink-2">
                  <LoaderCircle aria-hidden size={16} className="animate-spin" /> Loading the curriculum…
                </span>
              ) : null}
            </ChoiceRow>
          </div>

          <div className="flex items-center gap-2.5 rounded-tile border border-white/80 bg-white/60 px-4 py-3">
            <Sparkles aria-hidden size={18} strokeWidth={1.5} className="shrink-0 text-accent" />
            <p className="min-w-0 flex-1 text-row font-semibold" aria-live="polite">
              {chosenTemplate ? `${chosenTemplate.name} · ${summary}` : summary}
            </p>
            <button
              type="button"
              onClick={() => {
                setPanelOpen(true);
                document.getElementById("format")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="shrink-0 text-meta font-semibold text-accent-ink hover:underline xl:hidden"
            >
              Change
            </button>
          </div>

          <MakeActions aiKnown={ai.known} aiConfigured={ai.configured} disabled={brief.outcomeIds.length === 0 || loadingCourse || (formatMode === "template" && !brief.templateId)} busy={busy} onMake={() => void startGeneration()} />
          {ai.configured && ai.remaining !== null && ai.remaining <= 5 ? (
            <p role="status" className="text-meta font-medium text-ink-2">
              {ai.remaining === 0 ? "You’ve used today’s Funza actions. They reset at midnight, Saskatchewan time. You can still start from the question bank." : `${ai.remaining} Funza action${ai.remaining === 1 ? "" : "s"} left today.`}
            </p>
          ) : null}
        </section>

        {/* Format (Adjust or a template) and "Funza will use": on wide screens one panel that scrolls on its own */}
        <aside
          aria-label="Format and what Funza will use"
          className={cn(
            "flex flex-col gap-4",
            // Wide screens: a fixed glass panel from the top of the workspace to its bottom, scrolling on its own.
            "xl:frost xl:frost-sidebar xl:scrollbar-thin xl:fixed xl:top-[84px] xl:right-6 xl:bottom-6 xl:z-20 xl:w-[380px] xl:overflow-y-auto xl:overscroll-contain xl:rounded-panel xl:border xl:border-white/45 xl:p-4 xl:pb-5 xl:shadow-sidebar",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <FormatPanel
            mode={formatMode}
            onMode={chooseMode}
            open={panelOpen}
            onOpen={setPanelOpen}
            value={formatValue}
            category={category}
            templates={templates}
            chosenId={brief.templateId}
            onChoose={chooseTemplate}
            newHref={newTemplateHref}
            onSaveSettings={() => {
              setSaveName("");
              setSaveError(null);
              setSaveOpen(true);
            }}
            adjust={
              <>
                {questionKind ? (
                  <>
                    <Disclosure title="Sections and questions" summary={bp ? `${bp.parts.length} section${bp.parts.length === 1 ? "" : "s"} · ${bp.questions} questions` : ""}>
                      <p className="text-meta text-ink-2">For each type: how many questions (q), and the marks for each (m).</p>
                      <ul className="flex flex-col divide-y divide-line">
                        {brief.mix.map((row) => (
                          <li key={row.type} className={cn("flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0", row.count === 0 && "opacity-70")}>
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="text-body font-medium">{QTYPE_LABEL[row.type]}</span>
                              <span className="shrink-0 text-meta text-ink-2 tabular-nums">{row.count > 0 ? `${row.count * row.marks} mark${row.count * row.marks === 1 ? "" : "s"}` : "None"}</span>
                            </span>
                            <span className="flex flex-wrap gap-2">
                              <NumberStepper size="sm" label={`${QTYPE_LABEL[row.type]}: questions`} value={row.count} min={0} max={25} onChange={(count) => setMixRow(row.type, { count })} suffix="q" />
                              <NumberStepper size="sm" label={`${QTYPE_LABEL[row.type]}: marks each`} value={row.marks} min={1} max={20} onChange={(marks) => setMixRow(row.type, { marks })} suffix="m" />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Disclosure>
                    <Disclosure title="Marks and time" summary={bp ? `${bp.marks} marks · ${brief.duration} minutes` : ""}>
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-body font-medium">Time allowed</span>
                        <NumberStepper size="sm" label="Minutes" value={brief.duration} min={5} max={180} step={5} onChange={(duration) => patchBrief({ duration })} suffix="min" />
                      </div>
                      <p className="text-meta text-ink-2">Marks add up from the questions above: {bp?.marks ?? 0} in total.</p>
                    </Disclosure>
                    <Disclosure title="Difficulty" summary={PRESETS[brief.difficulty].label}>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
                          <ChoiceChip key={k} size="md" selected={brief.difficulty === k} onClick={() => patchBrief({ difficulty: k })} suffix={`${PRESETS[k].split.join("/")}`}>
                            {PRESETS[k].label}
                          </ChoiceChip>
                        ))}
                      </div>
                      <p className="text-meta text-ink-2">Foundational / grade level / extending, as a percent of marks.</p>
                    </Disclosure>
                    <Disclosure title="Extras" summary={[brief.answerKey && "Answer key", brief.workedSolutions && "Worked solutions", brief.rubric && "Rubric"].filter(Boolean).join(" · ") || "None"}>
                      <ToggleRow label="Answer key" checked={brief.answerKey} onChange={(answerKey) => patchBrief({ answerKey })} />
                      <ToggleRow label="Worked solutions" checked={brief.workedSolutions} onChange={(workedSolutions) => patchBrief({ workedSolutions })} />
                      <ToggleRow label="Rubric for written answers" checked={brief.rubric} onChange={(rubric) => patchBrief({ rubric })} />
                    </Disclosure>
                  </>
                ) : brief.kind === "notes" ? (
                  <>
                    <Disclosure title="Style" summary={NOTES_STYLES.find((s) => s.id === brief.notesStyle)?.label}>
                      <div className="flex flex-wrap gap-2">
                        {NOTES_STYLES.map((s) => (
                          <ChoiceChip key={s.id} size="md" selected={brief.notesStyle === s.id} onClick={() => patchBrief({ notesStyle: s.id })} title={s.blurb}>
                            {s.label}
                          </ChoiceChip>
                        ))}
                      </div>
                    </Disclosure>
                    <Disclosure title="Extras" summary={[brief.keyTerms && "Key terms", brief.checkQuestions && "Check questions"].filter(Boolean).join(" · ") || "None"}>
                      <ToggleRow label="Key terms" checked={brief.keyTerms} onChange={(keyTerms) => patchBrief({ keyTerms })} />
                      <ToggleRow label="Check-your-understanding questions" checked={brief.checkQuestions} onChange={(checkQuestions) => patchBrief({ checkQuestions })} />
                    </Disclosure>
                  </>
                ) : (
                  <Disclosure title="Slides" summary={`${brief.slides} slides${brief.speakerNotes ? " · speaker notes" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className="flex-1 text-body font-medium">Number of slides</span>
                      <NumberStepper size="sm" label="Slides" value={brief.slides} min={3} max={20} onChange={(slides) => patchBrief({ slides })} />
                    </div>
                    <ToggleRow label="Speaker notes" checked={brief.speakerNotes} onChange={(speakerNotes) => patchBrief({ speakerNotes })} />
                  </Disclosure>
                )}
              </>
            }
          />

          <Card className="flex flex-col gap-3 p-5" aria-labelledby="uses-title">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="size-2.5 rounded-full bg-accent shadow-[0_0_8px_1px_rgb(224_102_47/0.7)]" />
              <h2 id="uses-title" className="text-row font-bold">
                Funza will use
              </h2>
            </div>
            {chosenTemplate ? (
              <p className="flex items-start gap-2.5 text-body font-medium">
                <LayoutTemplate aria-hidden size={18} strokeWidth={1.35} className="mt-px shrink-0 text-accent" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">Your template “{chosenTemplate.name}”</span>
                  <span className="text-meta text-ink-2">Its format and wording style, never its content</span>
                </span>
              </p>
            ) : null}
            {brief.material ? (
              <p className="flex items-center gap-2.5 text-body font-medium">
                <FileText aria-hidden size={18} strokeWidth={1.35} className="shrink-0 text-accent" />
                <span className="truncate">{brief.material.name}</span>
              </p>
            ) : null}
            <details className="group/o">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 text-body font-medium [&::-webkit-details-marker]:hidden">
                <Target aria-hidden size={18} strokeWidth={1.35} className="shrink-0 text-accent" />
                <span>
                  {brief.outcomeIds.length} curriculum outcome{brief.outcomeIds.length === 1 ? "" : "s"}
                </span>
                <span className="ml-auto text-meta font-semibold text-accent-ink group-open/o:hidden">Choose</span>
              </summary>
              <ul className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto">
                {chosenOutcomes.map((o) => (
                  <li key={o.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-[14px] px-2 py-2 hover:bg-white/60">
                      <Checkbox checked={brief.outcomeIds.includes(o.id)} onChange={() => toggleOutcome(o.id)} className="mt-0.5" />
                      <span className="flex flex-col">
                        <span className="text-meta font-bold">{o.code}</span>
                        <span className="text-meta text-ink-2">{o.statement}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
            <p className="flex items-center gap-2.5 text-body font-medium">
              <BookOpen aria-hidden size={18} strokeWidth={1.35} className="shrink-0 text-accent" />
              The official Saskatchewan wording
            </p>
          </Card>
        </aside>
      </div>

      <Dialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        labelledBy="save-settings-title"
        title="Save these settings as a template"
        description={`Your ${categoryInfo(category).one.toLowerCase()} settings, ready to use again on any chapter. You can change it on the Templates page.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} disabled={!saveName.trim()} onClick={() => void saveSettings()}>
              Save template
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-semibold text-ink-2">Name</span>
          <Input value={saveName} maxLength={80} placeholder="e.g. My weekly quiz" onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName.trim() && void saveSettings()} autoFocus />
        </label>
        {saveError ? (
          <p role="alert" className="text-body font-medium text-red-ink">
            {saveError}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}

function ChoiceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-start gap-3 max-sm:flex-col max-sm:gap-2">
      <span className="w-24 shrink-0 pt-2.5 text-badge font-bold tracking-[0.06em] text-ink-2 uppercase max-sm:pt-0">{label}</span>
      <div className="flex flex-1 flex-wrap gap-2">{children}</div>
    </div>
  );
}

function MakeActions({ aiKnown, aiConfigured, disabled, busy, onMake }: { aiKnown: boolean; aiConfigured: boolean; disabled: boolean; busy: boolean; onMake: () => void }) {
  const router = useRouter();
  const withoutAi = async (mode: "bank" | "blank") => {
    const res = await createWithoutAi(mode);
    if (res.ok) router.push(`/make/${res.id}`);
  };
  if (aiKnown && !aiConfigured) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="flex items-start gap-2 text-body text-ink-2">
          <CircleAlert aria-hidden size={18} className="mt-px shrink-0 text-amber-ink" />
          AI drafting isn’t switched on for this Funza server yet. Start from the question bank, or lay it out and write it yourself.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button icon={Sparkles} disabled={disabled} onClick={() => withoutAi("bank")}>
            Start from the question bank
          </Button>
          <Button variant="secondary" disabled={disabled} onClick={() => withoutAi("blank")}>
            Start blank
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2.5 text-center">
      <Button icon={Sparkles} disabled={disabled || !aiKnown} loading={busy} onClick={onMake}>
        Make draft
      </Button>
      <p className="flex items-center gap-2 text-meta font-medium text-ink-2">
        <Lock aria-hidden size={16} strokeWidth={1.2} className="shrink-0" />
        Funza drafts it. You review and approve it before students see anything.
      </p>
    </div>
  );
}

/** The drafting state (not drawn in Figma): the store's stages, then errors with a way forward. */
function Drafting() {
  const { generation } = useWorkspace();
  const router = useRouter();
  const failed = generation.state === "failed" || generation.state === "cancelled";
  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-ink/10 bg-white/92 px-5 py-5" aria-live="polite">
      <ol className="flex flex-col gap-2.5">
        {generation.stages.map((s, i) => {
          const done = i < generation.stage;
          const current = i === generation.stage && !failed;
          const broke = failed && generation.error?.atStage === i;
          return (
            <li key={s.id} className="flex items-start gap-3">
              <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", done ? "bg-sage text-white" : broke ? "bg-red-tint text-red" : current ? "text-accent" : "border-[1.5px] border-ink/30")}>
                {done ? <Check aria-hidden size={13} strokeWidth={3} /> : broke ? <X aria-hidden size={12} /> : current ? <LoaderCircle aria-hidden size={18} className="animate-spin" /> : null}
              </span>
              <span className="flex flex-col">
                <span className={cn("text-body", current || broke ? "font-semibold" : "font-medium", !done && !current && !broke && "text-ink-2")}>{s.label}</span>
                {current || broke ? <span className="text-meta text-ink-2">{s.detail}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {generation.state === "running" ? (
        <div>
          <Button variant="secondary" size="sm" icon={X} onClick={cancelGeneration}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-tile bg-red-tint/60 p-4">
          <p className="text-row font-semibold text-red-ink">{generation.state === "cancelled" ? "Drafting cancelled" : generation.error?.title}</p>
          {generation.state === "failed" ? <p className="text-body text-ink">{generation.error?.message}</p> : <p className="text-body text-ink">Nothing was saved. Your brief is kept.</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={RotateCcw} onClick={() => void startGeneration()}>
              Try again
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const res = await createWithoutAi("bank");
                if (res.ok) router.push(`/make/${res.id}`);
              }}
            >
              Start from the question bank
            </Button>
            <Button variant="secondary" size="sm" onClick={resetGeneration}>
              Back to the brief
            </Button>
          </div>
        </div>
      )}
      <ButtonLink href="/" variant="ghost" size="sm" className="self-start px-0">
        Keep working; Funza finishes in the background
      </ButtonLink>
    </div>
  );
}
