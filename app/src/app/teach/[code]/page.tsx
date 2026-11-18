"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { isPdfFile } from "@/components/AddCourseForm";
import { BrainMascot } from "@/components/BrainMascot";
import { Button, ButtonLink } from "@/components/Button";
import { ClassCode, ClassGate, CopyButton, LectureStateChip, PageHeader, SaveIndicator } from "@/components/classes/ui";
import { accents } from "@/components/CourseCard";
import { Item, Rise, Stagger } from "@/components/motion";
import { Spinner } from "@/components/Spinner";
import { useAiStatus } from "@/lib/ai/client";
import { editLink } from "@/lib/classes/client";
import { DraftError, draftLecture } from "@/lib/classes/draft";
import { lectureState, LIMITS, reviewCounts } from "@/lib/classes/model";
import { useEditableClass } from "@/lib/classes/useEditableClass";

export default function TeachClassPage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const router = useRouter();
  const { code, load, record, update, save, saveState, saveError, editKey } = useEditableClass(rawCode);
  const ai = useAiStatus();
  const fileInput = useRef<HTMLInputElement>(null);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  if (load.status !== "ready" || !record) return <ClassGate load={load} code={code} />;

  async function onFileChosen(list: FileList | null) {
    const file = list ? Array.from(list).find(isPdfFile) : undefined;
    if (!file || drafting || !record) return;
    if (record.lectures.length >= LIMITS.lectures) {
      setDraftError(`A class can hold ${LIMITS.lectures} lectures for now.`);
      return;
    }
    setDraftError(null);
    setDrafting("Starting...");
    try {
      const { lecture } = await draftLecture({ file, className: record.name, useAi: ai?.configured === true, onProgress: setDrafting });
      update((prev) => ({ ...prev, lectures: [...prev.lectures, lecture] }));
      if (await save()) {
        router.push(`/teach/${code}/lectures/${lecture.id}`);
        return;
      }
      setDraftError("The draft is on this page but could not be saved yet. Use Retry next to the save status, then open it.");
      setDrafting(null);
    } catch (error) {
      setDraftError(error instanceof DraftError ? error.message : "Drafting failed. Try again.");
      setDrafting(null);
    }
  }

  const studentLink = `${typeof window === "undefined" ? "" : window.location.origin}/class/${code}`;

  return (
    <div>
      <nav className="text-sm font-medium text-smoke" aria-label="Breadcrumb">
        <Link href="/teach" className="transition-colors hover:text-charcoal">
          Dashboard
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-charcoal">{record.name}</span>
      </nav>

      <div className="mt-4">
        <PageHeader
          eyebrow="Class"
          title={record.name}
          description={[record.term, record.professor].filter(Boolean).join(" · ")}
          actions={
            <>
              <SaveIndicator state={saveState} error={saveError} onRetry={() => void save()} />
              <ButtonLink href={`/teach/${code}/insights`} variant="secondary">
                Insights
              </ButtonLink>
            </>
          }
        />
      </div>

      <section aria-label="Join code" className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-card md:p-7">
        <h2 className="text-sm font-semibold text-smoke">Students join with this code</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-5">
          <ClassCode code={code} />
          <div className="flex flex-wrap gap-2">
            <CopyButton text={code} label="Copy code" />
            <CopyButton text={studentLink} label="Copy join link" />
          </div>
        </div>
        <p className="mt-3 text-sm text-smoke">
          Put it on UR Courses or a slide. Students type it under &ldquo;Your classes&rdquo; on Funza&apos;s home page and see only
          the lectures you publish.
        </p>
      </section>

      <section className="mt-10" aria-label="Lectures">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Lessons</h2>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/teach/${code}/curriculum`} variant="secondary">
              Curriculum lesson
            </ButtonLink>
            <Button onClick={() => fileInput.current?.click()} disabled={drafting !== null}>
              Add a lecture PDF
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-smoke">
          {ai === null
            ? " "
            : ai.configured
              ? `Funza sends the text of the PDF to ${ai.provider} once to draft it. The file itself is not stored.`
              : "No AI provider is set up on this server, so drafts come from simple rules and will be rough. Add a key to app/.env.local for better drafts."}
        </p>

        {drafting && (
          <Rise className="mt-4 flex items-center gap-4 rounded-3xl border border-lavender bg-lavender/50 p-5" role="status">
            <BrainMascot mood="thinking" size={64} animate />
            <div>
              <p className="font-bold">Drafting your lecture</p>
              <p className="mt-0.5 flex items-center gap-2 text-sm text-smoke">
                <Spinner className="h-3 w-3" /> {drafting}
              </p>
            </div>
          </Rise>
        )}
        {draftError && <p className="mt-3 text-sm font-semibold text-coral-dark">{draftError}</p>}

        {record.lectures.length === 0 && !drafting ? (
          <Rise className="mt-4 flex flex-col items-center rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center">
            <BrainMascot mood="thinking" size={96} animate />
            <p className="mt-4 text-lg font-bold">No lessons yet</p>
            <p className="mt-1 max-w-md text-sm text-smoke">
              Build a curriculum lesson from an official outcome, or add the PDF of one lecture. Either way you review
              every part before students see it.
            </p>
          </Rise>
        ) : (
          <Stagger className="mt-4 grid gap-4">
            {record.lectures.map((lecture, i) => {
              const counts = reviewCounts(lecture);
              const state = lectureState(lecture);
              const accent = accents[i % accents.length];
              return (
                <Item key={lecture.id}>
                  <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-white p-5 shadow-card md:p-6">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-lg font-bold ${accent.bg} ${accent.text}`}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold">{lecture.title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
                        <LectureStateChip state={state} pending={counts.pending} />
                        <span className="rounded-full bg-sand px-2.5 py-0.5 text-smoke">
                          {counts.approved} of {counts.kept} approved
                        </span>
                        {lecture.curriculum ? (
                          <span className="rounded-full bg-mint px-2.5 py-0.5 text-mint-dark">
                            {lecture.curriculum.course} · {lecture.curriculum.code}
                          </span>
                        ) : (
                          <span className="rounded-full bg-sky px-2.5 py-0.5 text-sky-dark">{lecture.fileName}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {lecture.published && (
                        <ButtonLink href={`/class/${code}/lectures/${lecture.id}`} variant="secondary">
                          Student view
                        </ButtonLink>
                      )}
                      <ButtonLink href={`/teach/${code}/lectures/${lecture.id}`}>{counts.pending > 0 ? "Review" : "Open"}</ButtonLink>
                    </div>
                  </div>
                </Item>
              );
            })}
          </Stagger>
        )}
      </section>

      {editKey && (
        <section aria-label="Private edit link" className="mt-12 rounded-3xl border border-line bg-white/60 p-6">
          <h2 className="font-bold">Private edit link</h2>
          <p className="mt-1 max-w-2xl text-sm text-smoke">
            This browser holds the key to edit this class. To edit it on another computer, open this link there. Anyone
            with the link can change the class, so keep it to yourself.
          </p>
          <CopyButton text={editLink(code, editKey)} label="Copy private edit link" className="mt-4" />
        </section>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          void onFileChosen(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
