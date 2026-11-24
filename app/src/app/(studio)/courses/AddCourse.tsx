"use client";

import { CircleAlert, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ChoiceChip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { SearchList } from "@/components/ui/SearchList";
import { addCourse } from "@/lib/courses/actions";
import { courseRows, OTHER_SUBJECT, type CurriculumCourse } from "@/lib/teachers/setup";

/**
 * "Add a course": a Saskatchewan curriculum course at one level (its chapters come
 * from the curriculum units), or a course of the teacher's own. One direction: pick,
 * then Add. The curriculum list is a search box over a short list, not a select:
 * a grade has dozens of courses. `then` sends the teacher back to Make or Go live.
 */
export function AddCourse({ curriculum, grades, openInitially = false, existing, then }: { curriculum: CurriculumCourse[]; grades: number[]; openInitially?: boolean; existing: string[]; then?: "make" | "live" }) {
  const router = useRouter();
  const [open, setOpen] = useState(openInitially);
  const [mode, setMode] = useState<"curriculum" | "own">("curriculum");
  const [grade, setGrade] = useState<number>(grades[0] ?? 10);
  const [choice, setChoice] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const rows = useMemo(() => courseRows(curriculum, [grade], []).filter((r) => !existing.includes(r.key)), [curriculum, grade, existing]);
  const items = useMemo(() => rows.map((r) => ({ id: r.key, label: r.title, hint: r.subject === OTHER_SUBJECT ? undefined : r.subject })), [rows]);
  const chosen = rows.find((r) => r.key === choice);

  function close() {
    setOpen(false);
    setError(null);
  }

  function submit() {
    setError(null);
    let input: unknown;
    if (mode === "curriculum") {
      if (!chosen) return setError("Choose a course.");
      input = { curriculumCourseId: chosen.curriculumCourseId, level: chosen.level };
    } else {
      if (!title.trim()) return setError("Give your course a name.");
      input = { title };
    }
    start(async () => {
      const res = await addCourse(input);
      if (!res.ok) return setError(res.message);
      setOpen(false);
      // Opened from Make or Go live with no course: go back there with the new one chosen.
      // A course of the teacher's own has no chapters yet, so it opens on its page.
      router.push(then && mode === "curriculum" ? `${then === "make" ? "/make" : "/live/new"}?course=${res.id}` : `/courses/${res.id}`);
    });
  }

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>
        Add a course
      </Button>
      <Dialog
        open={open}
        onClose={close}
        labelledBy="add-course-title"
        title="Add a course"
        description={mode === "curriculum" ? "Its chapters start from the Saskatchewan curriculum units. You can rename, reorder or delete them." : "Start with no chapters and add your own."}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button icon={Plus} loading={pending} onClick={submit}>
              Add course
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div role="group" aria-label="Kind of course" className="flex flex-wrap gap-2">
            <ChoiceChip selected={mode === "curriculum"} onClick={() => setMode("curriculum")}>
              From the curriculum
            </ChoiceChip>
            <ChoiceChip selected={mode === "own"} onClick={() => setMode("own")}>
              My own course
            </ChoiceChip>
          </div>
          {mode === "curriculum" ? (
            <>
              <div role="group" aria-label="Grade" className="flex flex-wrap gap-2">
                {[10, 11, 12].map((g) => (
                  <ChoiceChip key={g} size="sm" selected={grade === g} onClick={() => { setGrade(g); setChoice(""); }}>
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
                      <span className="font-semibold text-ink">{chosen.title}</span> · {chosen.units > 0 ? `${chosen.units} ${chosen.units === 1 ? "chapter" : "chapters"} from the curriculum units` : "no curriculum units yet, so you add its chapters"}
                    </>
                  ) : (
                    `${rows.length} Grade ${grade} ${rows.length === 1 ? "course" : "courses"}. Type to narrow the list.`
                  )
                }
              >
                <SearchList
                  id="add-course-choice"
                  label={`Grade ${grade} courses`}
                  items={items}
                  value={choice}
                  onChange={(key) => {
                    setChoice(key);
                    setError(null);
                  }}
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
              <Input id="add-course-title-input" value={title} maxLength={200} placeholder="Science 10, period 2" onChange={(e) => setTitle(e.target.value)} />
            </Field>
          )}
          {error ? (
            <p role="alert" className="flex items-center gap-2 text-body font-medium text-red-ink">
              <CircleAlert aria-hidden size={16} /> {error}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
