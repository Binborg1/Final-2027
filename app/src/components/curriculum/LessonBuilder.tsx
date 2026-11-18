"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { LectureStateChip, SaveIndicator } from "@/components/classes/ui";
import { AlignmentPanel } from "@/components/curriculum/AlignmentPanel";
import { BlockNav } from "@/components/curriculum/BlockNav";
import { BlockWorkspace } from "@/components/curriculum/BlockWorkspace";
import { useAiStatus } from "@/lib/ai/client";
import {
  canPublish,
  curriculumProblems,
  draftFromBlock,
  lectureState,
  LIMITS,
  publishLecture,
  reviewCounts,
  unpublishLecture,
  type ClassRecord,
  type Lecture,
  type ReviewStatus,
} from "@/lib/classes/model";
import { formatDay } from "@/lib/classes/study";
import type { SaveState } from "@/lib/classes/useEditableClass";
import { checkBlock, lessonContext } from "@/lib/curriculum/checks";
import { regenerateBlock } from "@/lib/curriculum/generate";
import type { CurriculumBlock } from "@/lib/curriculum/lesson";

type Props = {
  code: string;
  record: ClassRecord;
  lecture: Lecture;
  update: (fn: (prev: ClassRecord) => ClassRecord) => void;
  save: () => Promise<boolean>;
  saveState: SaveState;
  saveError: string | null;
  onDeleted: () => void;
};

/**
 * The lesson builder: lesson blocks (left), the active block's workspace
 * (centre) and its curriculum verification with publishing (right). Two
 * columns on medium screens, one on small screens.
 */
export function LessonBuilder({ code, record, lecture, update, save, saveState, saveError, onDeleted }: Props) {
  const ai = useAiStatus();
  const [selected, setSelected] = useState(0);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const curriculum = lecture.curriculum ?? null;
  const ctx = useMemo(() => lessonContext(curriculum), [curriculum]);
  const entries = lecture.concepts
    .filter((c) => c.block)
    .map((c) => ({ block: c.block as CurriculumBlock, review: c.review, report: checkBlock(c.block as CurriculumBlock, ctx, curriculum) }));
  const index = Math.min(selected, Math.max(entries.length - 1, 0));
  const active = entries[index];
  const counts = reviewCounts(lecture);
  const state = lectureState(lecture);
  const problems = curriculumProblems(lecture);
  const ready = canPublish(lecture);

  const updateLecture = (fn: (l: Lecture) => Lecture) =>
    update((prev) => ({ ...prev, lectures: prev.lectures.map((l) => (l.id === lecture.id ? { ...fn(l), updatedAt: new Date().toISOString() } : l)) }));
  const setBlock = (blockId: string, next: CurriculumBlock, review: ReviewStatus) =>
    updateLecture((l) => ({ ...l, concepts: l.concepts.map((c) => (c.block?.id === blockId ? draftFromBlock(next, review) : c)) }));

  async function onRegenerate(block: CurriculumBlock) {
    if (!curriculum || regenerating) return;
    setRegenerating(block.id);
    setNotice(null);
    const res = await regenerateBlock(curriculum.outcomeId, block, ai?.configured === true);
    setBlock(block.id, res.block, "pending");
    setNotice(res.notice);
    setRegenerating(null);
  }

  function publish() {
    updateLecture((l) => publishLecture(l, new Date().toISOString()));
    void save();
  }

  function unpublish() {
    if (!window.confirm("Unpublish this lesson? Students will no longer see it. Your blocks stay here.")) return;
    updateLecture((l) => unpublishLecture(l, new Date().toISOString()));
    void save();
  }

  async function deleteLesson() {
    if (!window.confirm(`Delete "${lecture.title}"? Students lose access to it too. This cannot be undone.`)) return;
    update((prev) => ({ ...prev, lectures: prev.lectures.filter((l) => l.id !== lecture.id) }));
    if (await save()) onDeleted();
  }

  return (
    <div className="page-wide">
      <nav className="text-sm font-medium text-smoke" aria-label="Breadcrumb">
        <Link href="/teach" className="hover:text-charcoal">
          Dashboard
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/teach/${code}`} className="hover:text-charcoal">
          {record.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-charcoal">Lesson builder</span>
      </nav>

      <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <label className="block">
            <span className="sr-only">Lesson title</span>
            <input
              value={lecture.title}
              maxLength={LIMITS.title}
              onChange={(e) => updateLecture((l) => ({ ...l, title: e.target.value }))}
              className="-ml-2 w-full rounded-xl border border-transparent bg-transparent px-2 py-1 font-display text-2xl font-bold tracking-tight outline-none transition-colors hover:border-line focus:border-coral focus:bg-white focus:ring-4 focus:ring-coral/15 md:text-3xl"
            />
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-smoke">
            {curriculum && <span className="rounded-md bg-violet px-2 py-0.5 text-xs font-bold text-white">{curriculum.code}</span>}
            <LectureStateChip state={state} pending={counts.pending} />
            <span>{lecture.draftedBy === "ai" ? "Drafted by AI" : "Started from Funza's template"}</span>
            <SaveIndicator state={saveState} error={saveError} onRetry={() => void save()} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/teach/${code}/lectures/${lecture.id}/report`} variant="secondary">
            Alignment report
          </ButtonLink>
          {lecture.published && (
            <ButtonLink href={`/class/${code}/lectures/${lecture.id}`} variant="secondary">
              Student view
            </ButtonLink>
          )}
        </div>
      </header>

      {lecture.draftedBy === "template" && (
        <p className="mt-4 rounded-xl border border-sky bg-sky/70 px-4 py-2.5 text-sm">
          <span className="font-semibold text-sky-dark">Starter template.</span> This lesson started from Funza&apos;s own template for this outcome, not
          from an AI. Read it, change what does not fit your class, and approve each block yourself.
        </p>
      )}
      {notice && <p className="mt-3 rounded-xl bg-peach px-4 py-2.5 text-sm font-medium text-peach-dark">{notice}</p>}
      {!curriculum && (
        <p className="mt-3 rounded-xl bg-[#fde4e1] px-4 py-2.5 text-sm font-semibold text-coral-dark">
          This lesson&apos;s outcome is not in Funza&apos;s curriculum catalog, so none of its blocks can be approved.
        </p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[236px_minmax(0,1fr)] wide:grid-cols-[236px_minmax(0,1fr)_360px]">
        <div className="min-w-0 lg:sticky lg:top-6 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start wide:row-span-1">
          <BlockNav entries={entries} selected={index} onSelect={(i) => setSelected(i)} />
          <dl className="mt-3 hidden grid-cols-3 gap-2 text-center lg:grid">
            <Count label="Approved" value={counts.approved} tone="bg-mint text-mint-dark" />
            <Count label="Waiting" value={counts.pending} tone="bg-lavender text-lavender-dark" />
            <Count label="Rejected" value={counts.removed} tone="bg-sand text-smoke" />
          </dl>
        </div>

        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          {active ? (
            <BlockWorkspace
              key={active.block.id}
              block={active.block}
              review={active.review}
              index={index}
              total={entries.length}
              report={active.report}
              regenerating={regenerating === active.block.id}
              onChange={(next, r) => setBlock(active.block.id, next, r)}
              onRegenerate={() => void onRegenerate(active.block)}
              onSelect={(i) => setSelected(Math.max(0, Math.min(entries.length - 1, i)))}
            />
          ) : (
            <p className="rounded-2xl border border-line bg-white p-6 text-sm text-smoke">This lesson has no blocks.</p>
          )}
        </div>

        <aside
          aria-label="Curriculum verification"
          className="min-w-0 space-y-4 lg:col-start-2 lg:row-start-2 wide:sticky wide:top-6 wide:col-start-3 wide:row-start-1 wide:self-start"
        >
          {active && (
            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 className="text-base font-bold">Curriculum verification</h2>
              <p className="mt-0.5 mb-4 text-xs text-smoke">For block {index + 1}. Re-checked on every edit.</p>
              <AlignmentPanel
                block={active.block}
                report={active.report}
                editable={active.review === "pending"}
                onAcknowledge={(ids) => setBlock(active.block.id, { ...active.block, acknowledged: { fingerprint: active.report.fingerprint, ids } }, active.review)}
              />
            </section>
          )}

          <section aria-label="Publishing" className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="text-base font-bold">Publishing</h2>
            {state === "published" ? (
              <Button className="mt-3 w-full" disabled>
                Published
              </Button>
            ) : (
              <Button className="mt-3 w-full" onClick={publish} disabled={!ready}>
                {state === "changed" ? "Publish changes" : "Publish to students"}
              </Button>
            )}
            {!ready && problems.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs leading-5 text-smoke">
                {problems.slice(0, 7).map((p) => (
                  <li key={p}>· {p}</li>
                ))}
              </ul>
            )}
            {ready && state !== "published" && <p className="mt-2 text-xs text-smoke">Students get exactly the approved blocks, and nothing else.</p>}
            {lecture.published && (
              <div className="mt-4 border-t border-line pt-3 text-xs text-smoke">
                <p>
                  Students see the version published {formatDay(lecture.published.at)}
                  {state === "changed" ? "; newer changes are not published." : "."}
                </p>
                <Button variant="ghost" className="mt-2 px-2.5 py-1.5 text-xs" onClick={unpublish}>
                  Unpublish
                </Button>
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="mt-12 border-t border-line pt-6">
        <Button variant="ghost" onClick={deleteLesson} className="text-coral-dark hover:bg-[#fde4e1] hover:text-coral-dark">
          Delete lesson
        </Button>
      </section>
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-xl px-2 py-2 ${tone}`}>
      <dt className="text-[10px] font-semibold uppercase">{label}</dt>
      <dd className="font-display text-lg font-bold">{value}</dd>
    </div>
  );
}
