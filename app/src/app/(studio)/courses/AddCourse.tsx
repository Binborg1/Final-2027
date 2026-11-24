"use client";

import { ArrowRight, Check, CircleAlert, Plus, Radio, Sparkles, type LucideIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ChoiceChip, Tag } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { SearchList } from "@/components/ui/SearchList";
import { addCourse } from "@/lib/courses/actions";
import { courseRows, OTHER_SUBJECT, type CurriculumCourse } from "@/lib/teachers/setup";

type Added = { id: string; title: string; grade: number | null; chapters: number | null; curriculum: boolean };
type Onward = { href: string; label: string; icon?: LucideIcon; iconRight?: LucideIcon };

const chaptersLabel = (n: number) => `${n} ${n === 1 ? "chapter" : "chapters"}`;

/**
 * "Add a course": a Saskatchewan curriculum course at one level (its chapters come
 * from the curriculum units), or a course of the teacher's own. One direction: pick,
 * then Add. The curriculum list is a search box over a short list, not a select:
 * a grade has dozens of courses. Once saved, the dialog says so and where the
 * course is, with one button onward: open it, or, when the dialog was opened from
 * Make or Go live (`then`), go back there with the new course chosen.
 */
export function AddCourse({ curriculum, grades, openInitially = false, existing, then }: { curriculum: CurriculumCourse[]; grades: number[]; openInitially?: boolean; existing: string[]; then?: "make" | "live" }) {
  const [open, setOpen] = useState(openInitially);
  const [mode, setMode] = useState<"curriculum" | "own">("curriculum");
  const [grade, setGrade] = useState<number>(grades[0] ?? 10);
  const [choice, setChoice] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Added | null>(null);
  const [round, setRound] = useState(0);
  const [pending, start] = useTransition();

  const rows = useMemo(() => courseRows(curriculum, [grade], []).filter((r) => !existing.includes(r.key)), [curriculum, grade, existing]);
  const items = useMemo(() => rows.map((r) => ({ id: r.key, label: r.title, hint: r.subject === OTHER_SUBJECT ? undefined : r.subject })), [rows]);
  const chosen = rows.find((r) => r.key === choice);
  const ready = mode === "curriculum" ? !!chosen : title.trim().length > 0;

  function reset() {
    setAdded(null);
    setChoice("");
    setTitle("");
    setError(null);
    setRound((r) => r + 1);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function submit() {
    setError(null);
    let input: unknown;
    let saved: Omit<Added, "id">;
    if (mode === "curriculum") {
      if (!chosen) return setError("Choose a course from the list.");
      input = { curriculumCourseId: chosen.curriculumCourseId, level: chosen.level };
      saved = { title: chosen.title, grade: chosen.grade, chapters: chosen.units, curriculum: true };
    } else {
      if (!title.trim()) return setError("Give your course a name.");
      input = { title };
      saved = { title: title.trim(), grade: null, chapters: null, curriculum: false };
    }
    start(async () => {
      const res = await addCourse(input);
      if (!res.ok) return setError(res.message);
      // addCourse revalidates the page, so the course list behind the dialog shows it straight away.
      setAdded({ id: res.id, ...saved });
    });
  }

  const onward: Onward | null = added
    ? then && added.curriculum
      ? then === "make"
        ? { href: `/make?course=${added.id}`, label: "Make something for it", icon: Sparkles }
        : { href: `/live/new?course=${added.id}`, label: "Go live with it", icon: Radio }
      : { href: `/courses/${added.id}`, label: "Open course", iconRight: ArrowRight }
    : null;

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>
        Add a course
      </Button>
      <Dialog
        open={open}
        onClose={close}
        labelledBy="add-course-title"
        title={added ? "Course added" : "Add a course"}
        description={
          added
            ? "It’s saved on the Courses page and on Home, under Your courses."
            : mode === "curriculum"
              ? "Its chapters start from the Saskatchewan curriculum units. You can rename, reorder or delete them."
              : "Start with no chapters and add your own."
        }
        footer={
          added && onward ? (
            <>
              <Button variant="secondary" icon={Plus} onClick={reset}>
                Add another
              </Button>
              <ButtonLink href={onward.href} icon={onward.icon} iconRight={onward.iconRight}>
                {onward.label}
              </ButtonLink>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={close} disabled={pending}>
                Cancel
              </Button>
              <Button icon={Plus} loading={pending} disabled={!ready} onClick={submit}>
                Add course
              </Button>
            </>
          )
        }
      >
        {added ? (
          <div role="status" className="flex items-center gap-3.5 rounded-tile border border-white/80 bg-sage-tint px-4 py-3.5">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage text-white">
              <Check size={20} strokeWidth={2.5} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-row font-semibold text-ink">{added.title}</span>
              <span className="text-meta text-sage-ink">
                {added.chapters ? `${chaptersLabel(added.chapters)} from the Saskatchewan curriculum units` : "No chapters yet: add them on the course page"}
              </span>
            </span>
            {added.grade ? <Tag className="bg-white/70">Grade {added.grade}</Tag> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div role="group" aria-label="Kind of course" className="flex flex-wrap gap-2">
              <ChoiceChip selected={mode === "curriculum"} onClick={() => { setMode("curriculum"); setError(null); }}>
                From the curriculum
              </ChoiceChip>
              <ChoiceChip selected={mode === "own"} onClick={() => { setMode("own"); setError(null); }}>
                My own course
              </ChoiceChip>
            </div>
            {mode === "curriculum" ? (
              <>
                <div role="group" aria-label="Grade" className="flex flex-wrap gap-2">
                  {[10, 11, 12].map((g) => (
                    <ChoiceChip key={g} size="sm" selected={grade === g} onClick={() => { setGrade(g); setChoice(""); setError(null); }}>
                      Grade {g}
                    </ChoiceChip>
                  ))}
                </div>
                <Field
                  id="add-course-choice"
                  label="Course"
                  hint={
                    chosen ? (
                      <>
                        <span className="font-semibold text-ink">{chosen.title}</span> · {chosen.units > 0 ? `${chaptersLabel(chosen.units)} from the curriculum units` : "no curriculum units yet, so you add its chapters"}. Press Add course to save it.
                      </>
                    ) : (
                      `${rows.length} Grade ${grade} ${rows.length === 1 ? "course" : "courses"}. Search or scroll, then pick one.`
                    )
                  }
                >
                  <SearchList
                    key={`${grade}-${round}`}
                    id="add-course-choice"
                    label={`Grade ${grade} courses`}
                    items={items}
                    value={choice}
                    onChange={(key) => {
                      setChoice(key);
                      setError(null);
                    }}
                    onEnter={submit}
                    placeholder={`Search Grade ${grade} courses`}
                    describedBy="add-course-choice-hint"
                    disabled={pending}
                    empty={(q) => (
                      <>
                        No Grade {grade} course matches “{q}”.{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setMode("own");
                            setTitle(q.trim());
                          }}
                          className="rounded-sm font-semibold text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          Add it as your own course
                        </button>
                      </>
                    )}
                  />
                </Field>
              </>
            ) : (
              <Field id="add-course-title-input" label="Course name">
                <Input
                  id="add-course-title-input"
                  value={title}
                  maxLength={200}
                  placeholder="Science 10, period 2"
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && ready && !pending) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
              </Field>
            )}
            {error ? (
              <p role="alert" className="flex items-center gap-2 text-body font-medium text-red-ink">
                <CircleAlert aria-hidden size={16} /> {error}
              </p>
            ) : null}
          </div>
        )}
      </Dialog>
    </>
  );
}
