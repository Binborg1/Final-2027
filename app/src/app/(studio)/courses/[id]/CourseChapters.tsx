"use client";

import { ArrowDown, ArrowUp, Check, CircleAlert, PenLine, Plus, RotateCcw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CountPill } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { Checkbox, Input } from "@/components/ui/Field";
import { addChapter, deleteChapter, moveChapter, renameChapter, restoreChapters, type Result } from "@/lib/courses/actions";
import type { RemovedChapter } from "@/lib/courses/data";
import { cn } from "@/lib/ui/cn";

export type ChapterItem = { id: string; title: string; outcomes: number; fromCurriculum: boolean };

/**
 * The course's chapters: open, rename, reorder, delete, and add one (FR-3). Deleting
 * removes the chapter from this teacher's course only; curriculum chapters they
 * deleted can be brought back from `removed`.
 */
export function CourseChapters({ courseId, chapters, removed }: { courseId: string; chapters: ChapterItem[]; removed: RemovedChapter[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [deleting, setDeleting] = useState<ChapterItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const run = (action: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await action();
      if (!res.ok) return setError(res.message);
      after?.();
      router.refresh();
    });

  return (
    <Card className="flex flex-col gap-3 px-6 pt-5 pb-5" aria-labelledby="chapters-title">
      <CardHeader id="chapters-title" title="Chapters" after={<CountPill>{chapters.length}</CountPill>} />
      {error ? (
        <p role="alert" className="flex items-center gap-2 text-body font-medium text-red-ink">
          <CircleAlert aria-hidden size={16} /> {error}
        </p>
      ) : null}
      <ol className="flex flex-col gap-2">
        {chapters.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 rounded-tile border border-white/80 bg-tile py-2 pr-2 pl-3.5">
            <span aria-hidden className="w-6 shrink-0 text-meta font-semibold text-ink-2 tabular-nums">
              {i + 1}
            </span>
            {editing === c.id ? (
              <form
                className="flex min-w-0 flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => renameChapter(c.id, draftTitle), () => setEditing(null));
                }}
              >
                <Input aria-label={`New name for ${c.title}`} value={draftTitle} maxLength={200} onChange={(e) => setDraftTitle(e.target.value)} className="h-10" autoFocus />
                <Button type="submit" size="sm" icon={Check} loading={pending} aria-label="Save the name">
                  Save
                </Button>
                <Button variant="ghost" size="sm" icon={X} onClick={() => setEditing(null)} aria-label="Cancel renaming" />
              </form>
            ) : (
              <>
                <Link href={`/courses/${courseId}/chapters/${c.id}`} className="flex min-w-0 flex-1 flex-col py-1 hover:underline">
                  <span className="truncate text-row font-semibold">{c.title}</span>
                  <span className="text-meta text-ink-2">{c.outcomes > 0 ? `${c.outcomes} outcome${c.outcomes === 1 ? "" : "s"}${c.fromCurriculum ? " · from the curriculum" : ""}` : "No curriculum outcomes"}</span>
                </Link>
                <RowButton icon={PenLine} label={`Rename ${c.title}`} disabled={pending} onClick={() => { setEditing(c.id); setDraftTitle(c.title); }} />
                <RowButton icon={ArrowUp} label={`Move ${c.title} up`} disabled={pending || i === 0} onClick={() => run(() => moveChapter(c.id, -1))} />
                <RowButton icon={ArrowDown} label={`Move ${c.title} down`} disabled={pending || i === chapters.length - 1} onClick={() => run(() => moveChapter(c.id, 1))} />
                <RowButton icon={Trash2} label={`Delete ${c.title}`} disabled={pending} onClick={() => setDeleting(c)} />
              </>
            )}
          </li>
        ))}
      </ol>
      {chapters.length === 0 ? <p className="text-body text-ink-2">No chapters. Add one below{removed.length > 0 ? ", or bring back the curriculum’s" : ""}.</p> : null}
      {removed.length > 0 ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setPicked(removed.map((r) => r.key));
            setRestoring(true);
          }}
          className="inline-flex items-center gap-2 self-start rounded-full px-1 text-body font-semibold text-accent-ink hover:underline disabled:opacity-50"
        >
          <RotateCcw aria-hidden size={16} strokeWidth={1.75} />
          Bring back curriculum chapters ({removed.length})
        </button>
      ) : null}
      <form
        className="flex items-center gap-2 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newTitle.trim()) return setError("Give the chapter a name.");
          run(() => addChapter(courseId, newTitle), () => setNewTitle(""));
        }}
      >
        <Input aria-label="New chapter name" placeholder="Add a chapter" value={newTitle} maxLength={200} onChange={(e) => setNewTitle(e.target.value)} className="h-11" />
        <Button type="submit" variant="secondary" icon={Plus} disabled={pending}>
          Add
        </Button>
      </form>

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        labelledBy="delete-chapter-title"
        title={`Delete “${deleting?.title ?? ""}”?`}
        description={
          deleting?.fromCurriculum
            ? "It’s removed from your course only; the Saskatchewan curriculum doesn’t change, and you can bring it back later. Its questions are retired from your bank. Materials made from it are kept."
            : "It’s removed from your course for good. Its questions are retired from your bank. Materials made from it are kept."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={pending}>
              Cancel
            </Button>
            <Button icon={Trash2} loading={pending} onClick={() => deleting && run(() => deleteChapter(deleting.id), () => setDeleting(null))}>
              Delete chapter
            </Button>
          </>
        }
      />

      <Dialog
        open={restoring}
        onClose={() => setRestoring(false)}
        labelledBy="restore-chapters-title"
        title="Bring back curriculum chapters"
        description="These chapters from the Saskatchewan curriculum were deleted from this course. The ones you choose come back at the end of the list, with their outcomes. Their old questions stay retired."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestoring(false)} disabled={pending}>
              Cancel
            </Button>
            <Button icon={RotateCcw} loading={pending} disabled={picked.length === 0} onClick={() => run(() => restoreChapters(courseId, picked), () => setRestoring(false))}>
              Bring back {picked.length === 1 ? "1 chapter" : `${picked.length} chapters`}
            </Button>
          </>
        }
      >
        <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
          {removed.map((r) => {
            const on = picked.includes(r.key);
            return (
              <li key={r.key}>
                <label className="flex cursor-pointer items-center gap-3 rounded-tile px-2 py-2 hover:bg-white/60">
                  <Checkbox checked={on} onChange={() => setPicked((p) => (on ? p.filter((k) => k !== r.key) : [...p, r.key]))} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-row font-semibold">{r.title}</span>
                    <span className="text-meta text-ink-2">{r.outcomes > 0 ? `${r.outcomes} outcome${r.outcomes === 1 ? "" : "s"}` : "No curriculum outcomes"}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </Card>
  );
}

function RowButton({ icon: Icon, label, disabled, onClick }: { icon: typeof PenLine; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-white hover:text-ink disabled:opacity-35 pointer-coarse:size-11")}>
      <Icon aria-hidden size={17} strokeWidth={1.75} />
    </button>
  );
}
