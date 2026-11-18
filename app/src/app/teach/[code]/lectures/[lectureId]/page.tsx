"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BrainMascot } from "@/components/BrainMascot";
import { Button, ButtonLink } from "@/components/Button";
import { ConceptReviewCard } from "@/components/classes/ConceptReviewCard";
import { ClassGate, LectureStateChip, SaveIndicator } from "@/components/classes/ui";
import { Rise } from "@/components/motion";
import { LessonBuilder } from "@/components/curriculum/LessonBuilder";
import {
  canPublish,
  isCurriculumLesson,
  lectureState,
  LIMITS,
  publishLecture,
  reviewCounts,
  unpublishLecture,
  type DraftConcept,
  type Lecture,
} from "@/lib/classes/model";
import { formatDay } from "@/lib/classes/study";
import { useEditableClass } from "@/lib/classes/useEditableClass";

export default function ReviewLecturePage() {
  const { code: rawCode, lectureId } = useParams<{ code: string; lectureId: string }>();
  const router = useRouter();
  const { code, load, record, update, save, saveState, saveError } = useEditableClass(rawCode);

  if (load.status !== "ready" || !record) return <ClassGate load={load} code={code} />;
  const lecture = record.lectures.find((l) => l.id === lectureId);
  if (!lecture) {
    return (
      <Rise className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center">
        <BrainMascot mood="sad" size={96} animate />
        <p className="mt-4 text-lg font-bold">That lecture is not in {record.name}</p>
        <ButtonLink href={`/teach/${code}`} className="mt-6">
          Back to the class
        </ButtonLink>
      </Rise>
    );
  }

  if (isCurriculumLesson(lecture)) {
    return (
      <LessonBuilder
        code={code}
        record={record}
        lecture={lecture}
        update={update}
        save={save}
        saveState={saveState}
        saveError={saveError}
        onDeleted={() => router.push(`/teach/${code}`)}
      />
    );
  }

  const updateLecture = (fn: (l: Lecture) => Lecture) =>
    update((prev) => ({ ...prev, lectures: prev.lectures.map((l) => (l.id === lecture.id ? { ...fn(l), updatedAt: new Date().toISOString() } : l)) }));
  const setConcept = (next: DraftConcept) => updateLecture((l) => ({ ...l, concepts: l.concepts.map((c) => (c.id === next.id ? next : c)) }));

  const counts = reviewCounts(lecture);
  const state = lectureState(lecture);
  const ready = canPublish(lecture);
  const percent = counts.kept === 0 ? 0 : Math.round((counts.approved / counts.kept) * 100);

  function publish() {
    updateLecture((l) => publishLecture(l, new Date().toISOString()));
    void save();
  }

  function unpublish() {
    if (!window.confirm("Unpublish this lecture? Students will no longer see it. Your drafts stay here.")) return;
    updateLecture((l) => unpublishLecture(l, new Date().toISOString()));
    void save();
  }

  async function deleteLecture() {
    if (!window.confirm(`Delete "${lecture?.title}" and all its drafts? Students lose access to it too. This cannot be undone.`)) return;
    update((prev) => ({ ...prev, lectures: prev.lectures.filter((l) => l.id !== lectureId) }));
    if (await save()) router.push(`/teach/${code}`);
  }

  return (
    <div>
      <nav className="text-sm font-semibold text-smoke" aria-label="Breadcrumb">
        <Link href="/teach" className="transition-colors hover:text-charcoal">
          Teach
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/teach/${code}`} className="transition-colors hover:text-charcoal">
          {record.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-charcoal">Review</span>
      </nav>

      <header className="mt-4">
        <label className="block">
          <span className="sr-only">Lecture title</span>
          <input
            value={lecture.title}
            maxLength={LIMITS.title}
            onChange={(e) => updateLecture((l) => ({ ...l, title: e.target.value }))}
            className="w-full rounded-2xl border border-transparent bg-transparent px-2 py-1 text-3xl font-bold tracking-tight outline-none transition-colors hover:border-line focus:border-coral focus:bg-white focus:ring-4 focus:ring-coral/20 md:text-4xl"
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-2 text-sm text-smoke">
          <LectureStateChip state={state} pending={counts.pending} />
          <span>
            Drafted {lecture.draftedBy === "ai" ? "by AI" : "by simple rules"} from <span className="font-semibold text-charcoal">{lecture.fileName}</span>
          </span>
          <SaveIndicator state={saveState} error={saveError} onRetry={() => void save()} />
        </div>
      </header>

      {lecture.draftedBy === "rules" && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-sky bg-sky/60 px-4 py-3 text-sm text-charcoal">
          <span className="rounded-full bg-sky-dark px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white">ROUGH DRAFT</span>
          <span className="min-w-0 flex-1">
            No AI was used: these drafts come from simple rules applied to the PDF&apos;s headings and sentences, so expect
            awkward questions. Rewrite or remove anything that is not right.
          </span>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_288px]">
        <div className="min-w-0">
          {lecture.objectives.length > 0 && (
            <section aria-label="Learning objectives" className="mb-6 rounded-3xl border border-lavender bg-lavender/40 p-5">
              <h2 className="text-sm font-bold text-lavender-dark">Learning objectives Funza found</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
                {lecture.objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </section>
          )}

          <h2 className="text-xl font-bold">Concepts</h2>
          <p className="mt-1 text-sm text-smoke">
            Approve each concept once it is right. Editing an approved concept sends it back for review.
          </p>
          <div className="mt-4 space-y-4">
            {lecture.concepts.map((concept, i) => (
              <ConceptReviewCard key={concept.id} concept={concept} index={i} onChange={setConcept} />
            ))}
          </div>

          <section className="mt-12 border-t border-line pt-6">
            <Button variant="ghost" onClick={deleteLecture} className="text-coral-dark hover:bg-peach/70 hover:text-coral-dark">
              Delete lecture
            </Button>
          </section>
        </div>

        <aside className="order-first lg:order-none lg:sticky lg:top-6 lg:self-start">
          <section aria-label="Review progress" className="rounded-3xl border border-line bg-white p-5 shadow-card">
            <h2 className="font-bold">Review</h2>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-sand shadow-track" aria-hidden="true">
              <div className="h-full rounded-full bg-mint-dark transition-[width] duration-300" style={{ width: `${percent}%` }} />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold text-smoke">
              <div className="rounded-2xl bg-mint/60 py-2">
                <dt>Approved</dt>
                <dd className="text-lg font-bold text-charcoal">{counts.approved}</dd>
              </div>
              <div className="rounded-2xl bg-peach/60 py-2">
                <dt>Waiting</dt>
                <dd className="text-lg font-bold text-charcoal">{counts.pending}</dd>
              </div>
              <div className="rounded-2xl bg-sand py-2">
                <dt>Removed</dt>
                <dd className="text-lg font-bold text-charcoal">{counts.removed}</dd>
              </div>
            </dl>

            {state === "published" ? (
              <Button className="mt-5 w-full" disabled>
                Published
              </Button>
            ) : (
              <Button className="mt-5 w-full" onClick={publish} disabled={!ready}>
                {state === "changed" ? "Publish changes" : "Publish to students"}
              </Button>
            )}
            <p className="mt-2 text-xs leading-5 text-smoke">
              {!ready && counts.pending > 0
                ? `Approve or remove the ${counts.pending} concept${counts.pending === 1 ? "" : "s"} still waiting first.`
                : !ready
                  ? "Approve at least one concept to publish."
                  : state === "changed"
                    ? "Students still see the last version you published."
                    : state === "draft"
                      ? `Students get the ${counts.approved} approved concept${counts.approved === 1 ? "" : "s"}, and nothing else.`
                      : ""}
            </p>

            {lecture.published && (
              <div className="mt-4 border-t border-line pt-4 text-sm">
                <p className="text-smoke">
                  Students see the version published {formatDay(lecture.published.at)}: {lecture.published.concepts.length} concept
                  {lecture.published.concepts.length === 1 ? "" : "s"}.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonLink href={`/class/${code}/lectures/${lecture.id}`} variant="secondary" className="px-4 py-2 text-xs">
                    Student view
                  </ButtonLink>
                  <Button variant="ghost" className="px-4 py-2 text-xs" onClick={unpublish}>
                    Unpublish
                  </Button>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
