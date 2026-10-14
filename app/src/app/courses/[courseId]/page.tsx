"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { isPdfFile } from "@/components/AddCourseForm";
import { BrainMascot } from "@/components/BrainMascot";
import { Button, ButtonLink } from "@/components/Button";
import { accents } from "@/components/CourseCard";
import { Item, LiftCard, Rise, Stagger } from "@/components/motion";
import { NotFound } from "@/components/NotFound";
import { SourceBanner } from "@/components/SourceBanner";
import { Spinner } from "@/components/Spinner";
import { useAiStatus } from "@/lib/ai/client";
import { cachedExtraction, importPdfs, reclassifyFile } from "@/lib/lessons/import";
import { getLessonProvider } from "@/lib/lessons/provider";
import { formatBytes, summarizeTopic } from "@/lib/progress";
import {
  addFilesToCourse,
  removeCourse,
  removeFileFromCourse,
  toCourseFiles,
  useCourses,
  useHydrated,
  useLessons,
  useProgress,
  useQuestionSets,
  useSources,
} from "@/lib/storage";
import { planAiTopic } from "@/lib/teaching/planTopic";
import type { CourseFile } from "@/lib/types";

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const courses = useCourses();
  const progress = useProgress();
  const lessons = useLessons();
  const questionSets = useQuestionSets();
  const allSources = useSources();
  const ai = useAiStatus();
  const hydrated = useHydrated();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const course = courses.find((c) => c.id === courseId);
  if (!hydrated) return null;
  if (!course) return <NotFound what="course" />;

  const provider = getLessonProvider(course);
  const topics = provider.listTopics(course, lessons);
  const sets = course.sample ? [] : (questionSets[course.id] ?? []);
  const sources = allSources[course.id] ?? {};
  const entries = progress[course.id] ?? {};
  const conceptCount = topics.reduce((n, t) => n + t.concepts.length, 0);
  const questionCount = sets.reduce((n, s) => n + s.questions.length, 0);
  const notesWithSources = course.sample
    ? []
    : course.files.filter((f) => f.kind === "notes" && f.status === "ready" && (sources[f.name]?.length ?? 0) > 0);
  const plannedFiles = new Set(topics.filter((t) => t.kind === "ai").map((t) => t.fileName));

  async function onFilesChosen(list: FileList | null) {
    if (!list || !course || busy) return;
    const chosen = Array.from(list).filter(isPdfFile);
    if (chosen.length === 0) return;
    const startIndex = addFilesToCourse(course.id, toCourseFiles(chosen));
    setBusy("Preparing lessons...");
    await importPdfs(course.id, chosen, startIndex, setBusy);
    setBusy(null);
  }

  function onReclassify(index: number, kind: "notes" | "questions") {
    if (!course) return;
    const ok = reclassifyFile(course.id, index, kind);
    setNotice(ok ? null : "That PDF's text is no longer in memory. Remove it and add it again to change how it is read.");
  }

  async function onPlan(fileName: string) {
    if (!course || aiBusy) return;
    const provider = ai?.provider ?? "the configured AI provider";
    const ok = window.confirm(
      `Plan AI lessons from "${fileName}"?\n\nThis sends the extracted text of this PDF to ${provider} to identify concepts and learning objectives. The file itself stays on this device.`,
    );
    if (!ok) return;
    setAiBusy(fileName);
    setAiNotice(null);
    const res = await planAiTopic(course, fileName, sources[fileName] ?? []);
    setAiBusy(null);
    if (!res.ok) setAiNotice(res.message);
  }

  function onRemoveCourse() {
    if (!course) return;
    if (window.confirm(`Remove "${course.name}" and its progress?`)) {
      removeCourse(course.id);
      router.push("/");
    }
  }

  return (
    <div>
      <nav className="text-sm font-semibold text-smoke" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-charcoal">
          My Courses
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-charcoal">{course.name}</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-4xl font-extrabold tracking-tight">{course.name}</h1>
        <p className="mt-2 text-smoke">
          {topics.length} topic{topics.length === 1 ? "" : "s"} · {conceptCount} concept{conceptCount === 1 ? "" : "s"}
          {sets.length > 0 ? ` · ${sets.length} question set${sets.length === 1 ? "" : "s"} (${questionCount} questions)` : ""}
        </p>
      </header>

      <div className="mt-6">
        <SourceBanner source={provider.source} />
      </div>

      <section className="mt-10" aria-label="Topics">
        <h2 className="text-xl font-extrabold">Topics</h2>
        {topics.length === 0 ? (
          <Rise className="mt-4 flex flex-col items-center rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center">
            <BrainMascot mood="thinking" size={96} animate />
            <p className="mt-4 text-lg font-extrabold">No lessons yet</p>
            <p className="mt-1 max-w-md text-sm text-smoke">
              Add a PDF of lecture notes with selectable text and Funza will build topics from its headings. Add a
              sheet of questions and it becomes a question set below instead.
            </p>
            <Button className="mt-5" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
              Add PDFs
            </Button>
          </Rise>
        ) : (
          <Stagger className="mt-4 grid gap-4">
            {topics.map((topic, i) => {
              const s = summarizeTopic(topic, entries);
              const accent = accents[i % accents.length];
              const label =
                s.completed + s.needsPractice === 0 ? "Start learning" : s.completed === s.total ? "Review topic" : "Continue";
              return (
                <Item key={topic.id}>
                  <LiftCard className="flex flex-wrap items-center gap-4 p-5 md:p-6">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold shadow-edge ${accent.bg} ${accent.text}`}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-extrabold">{topic.title}</h3>
                      <p className="mt-1 text-sm text-smoke">{topic.summary}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
                        {topic.kind === "ai" && (
                          <span className="rounded-full bg-lavender px-2.5 py-0.5 text-lavender-dark">Adaptive AI</span>
                        )}
                        <span className="rounded-full bg-sand px-2.5 py-0.5 text-smoke">{s.total} concepts</span>
                        <span className="rounded-full bg-mint px-2.5 py-0.5 text-mint-dark">{s.completed} completed</span>
                        {s.needsPractice > 0 && (
                          <span className="rounded-full bg-peach px-2.5 py-0.5 text-peach-dark">{s.needsPractice} to practise</span>
                        )}
                        {topic.fileName && (
                          <span className="rounded-full bg-sky px-2.5 py-0.5 text-sky-dark">{topic.fileName}</span>
                        )}
                      </div>
                    </div>
                    <ButtonLink href={`/courses/${course.id}/learn/${topic.id}`}>{label}</ButtonLink>
                  </LiftCard>
                </Item>
              );
            })}
          </Stagger>
        )}
      </section>

      {notesWithSources.length > 0 && (
        <section className="mt-10" aria-label="Adaptive AI lessons">
          <h2 className="text-xl font-extrabold">Adaptive AI lessons</h2>
          <p className="mt-1 text-sm text-smoke">
            Funza plans concepts and objectives from a notes PDF, then teaches each one: explain, ask, check your
            reasoning, hint or reteach, and verify with a new question before moving on.
          </p>
          {ai === null ? null : !ai.configured ? (
            <p className="mt-3 rounded-2xl border border-line bg-white/60 px-4 py-3 text-sm text-smoke">
              Add an AI key to <code className="rounded bg-sand px-1">app/.env.local</code> (see{" "}
              <code className="rounded bg-sand px-1">.env.example</code>) and restart to turn this on.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {notesWithSources.map((f) => (
                <li
                  key={f.name}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm shadow-card"
                >
                  <span className="min-w-0 truncate font-semibold">{f.name}</span>
                  {plannedFiles.has(f.name) ? (
                    <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-mint-dark">Planned, see Topics</span>
                  ) : (
                    <Button variant="secondary" className="px-4 py-2 text-xs" onClick={() => onPlan(f.name)} disabled={aiBusy !== null}>
                      {aiBusy === f.name && <Spinner />}
                      {aiBusy === f.name ? "Planning..." : "Plan AI lessons"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {aiNotice && <p className="mt-2 text-xs font-semibold text-coral-dark">{aiNotice}</p>}
          <p className="mt-2 text-xs text-smoke">
            Planning sends the text of that PDF to the AI provider once, after you confirm. The file itself never
            leaves this device.
          </p>
        </section>
      )}

      {sets.length > 0 && (
        <section className="mt-10" aria-label="Question sets">
          <h2 className="text-xl font-extrabold">Question sets</h2>
          <p className="mt-1 text-sm text-smoke">
            PDFs of questions are kept apart from notes. Open one to choose between guidance and answers.
          </p>
          <Stagger className="mt-4 grid gap-4">
            {sets.map((set, i) => {
              const accent = accents[(i + 2) % accents.length];
              return (
                <Item key={set.id}>
                  <LiftCard className="flex flex-wrap items-center gap-4 p-5 md:p-6">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold shadow-edge ${accent.bg} ${accent.text}`}
                      aria-hidden="true"
                    >
                      ?
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-extrabold">{set.title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="rounded-full bg-sand px-2.5 py-0.5 text-smoke">
                          {set.questions.length} question{set.questions.length === 1 ? "" : "s"}
                        </span>
                        {set.questions.some((q) => q.providedAnswer) && (
                          <span className="rounded-full bg-mint px-2.5 py-0.5 text-mint-dark">Includes answers</span>
                        )}
                        <span className="rounded-full bg-sky px-2.5 py-0.5 text-sky-dark">{set.fileName}</span>
                      </div>
                    </div>
                    <ButtonLink href={`/courses/${course.id}/questions/${set.id}`}>Work through it</ButtonLink>
                  </LiftCard>
                </Item>
              );
            })}
          </Stagger>
        </section>
      )}

      {course.sample ? (
        <section className="mt-12 rounded-3xl border border-line bg-white/60 p-6 text-sm text-smoke">
          This sample course has no PDFs. Create your own course from the home page to learn from your files.
        </section>
      ) : (
        <section className="mt-12" aria-label="Course PDFs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold">Course PDFs</h2>
            <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
              {busy ? <Spinner /> : null}
              {busy ?? "Add PDFs"}
            </Button>
          </div>
          {course.files.length === 0 ? (
            <p className="mt-3 text-sm text-smoke">No PDFs attached yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white text-sm shadow-card">
              {course.files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{file.name}</span>
                    <FileStatus file={file} />
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-smoke">
                    {formatBytes(file.size)}
                    {file.kind && file.status !== "error" && (
                      <button
                        type="button"
                        disabled={busy !== null || !cachedExtraction(course.id, file.name)}
                        onClick={() => onReclassify(index, file.kind === "notes" ? "questions" : "notes")}
                        title={
                          cachedExtraction(course.id, file.name)
                            ? undefined
                            : "Remove and re-add this PDF to change how it is read"
                        }
                        className="rounded-full px-2 py-0.5 font-bold text-smoke transition-colors hover:bg-sand hover:text-charcoal disabled:opacity-50"
                      >
                        {file.kind === "notes" ? "Treat as questions" : "Treat as notes"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => removeFileFromCourse(course.id, index)}
                      className="rounded-full px-2 py-0.5 font-bold text-smoke transition-colors hover:bg-sand hover:text-charcoal disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {notice && <p className="mt-2 text-xs font-semibold text-coral-dark">{notice}</p>}
          <p className="mt-2 text-xs text-smoke">
            PDFs are read on this device to build lessons or question sets. Their text is only sent to an AI provider
            when you choose to plan AI lessons or use the AI tutor.
          </p>
        </section>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFilesChosen(e.target.files);
          e.target.value = "";
        }}
      />

      <section className="mt-12 border-t border-line pt-6">
        <Button variant="ghost" onClick={onRemoveCourse} className="text-coral-dark hover:bg-peach/70 hover:text-coral-dark">
          Remove course
        </Button>
      </section>
    </div>
  );
}

function FileStatus({ file }: { file: CourseFile }) {
  const base = "mt-1 mr-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold";
  const kind =
    file.kind === "questions" ? (
      <span className={`${base} bg-lavender text-lavender-dark`}>
        Questions{file.confidence === "low" ? " (not sure)" : ""}
      </span>
    ) : file.kind === "notes" ? (
      <span className={`${base} bg-sky text-sky-dark`}>Notes{file.confidence === "low" ? " (not sure)" : ""}</span>
    ) : null;
  switch (file.status) {
    case "ready":
      return (
        <>
          {kind}
          <span className={`${base} bg-mint text-mint-dark`}>
            {file.kind === "questions"
              ? `${file.questions} question${file.questions === 1 ? "" : "s"}`
              : `${file.concepts} concept${file.concepts === 1 ? "" : "s"}`}{" "}
            from {file.pages} page{file.pages === 1 ? "" : "s"}
          </span>
        </>
      );
    case "no-text":
      return (
        <>
          {kind}
          <span className={`${base} bg-peach text-peach-dark`}>
            {file.kind === "questions"
              ? "No numbered questions could be found."
              : "No selectable text found. Scanned pages are not supported yet."}
          </span>
        </>
      );
    case "error":
      return <span className={`${base} bg-peach text-peach-dark`}>Could not read this file.</span>;
    default:
      return <span className={`${base} bg-sand text-smoke`}>Reading...</span>;
  }
}
