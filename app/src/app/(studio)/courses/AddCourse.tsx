"use client";

import { CircleAlert, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ChoiceChip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { addCourse } from "@/lib/courses/actions";
import { courseRows, type CurriculumCourse } from "@/lib/teachers/setup";

/**
 * "Add a course": a Saskatchewan curriculum course at one level (its chapters come
 * from the curriculum units), or a course of the teacher's own. One direction: pick,
 * then Add.
 */
export function AddCourse({ curriculum, grades, openInitially = false, existing }: { curriculum: CurriculumCourse[]; grades: number[]; openInitially?: boolean; existing: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(openInitially);
  const [mode, setMode] = useState<"curriculum" | "own">("curriculum");
  const [grade, setGrade] = useState<number>(grades[0] ?? 10);
  const [choice, setChoice] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const rows = useMemo(() => courseRows(curriculum, [grade], []).filter((r) => !existing.includes(r.key)), [curriculum, grade, existing]);
  const bySubject = useMemo(() => {
    const groups = new Map<string, typeof rows>();
    for (const r of rows) groups.set(r.subject, [...(groups.get(r.subject) ?? []), r]);
    return [...groups.entries()];
  }, [rows]);

  function close() {
    setOpen(false);
    setError(null);
  }

  function submit() {
    setError(null);
    let input: unknown;
    if (mode === "curriculum") {
      const row = rows.find((r) => r.key === choice);
      if (!row) return setError("Choose a course.");
      input = { curriculumCourseId: row.curriculumCourseId, level: row.level };
    } else {
      if (!title.trim()) return setError("Give your course a name.");
      input = { title };
    }
    start(async () => {
      const res = await addCourse(input);
      if (!res.ok) return setError(res.message);
      setOpen(false);
      router.push(`/courses/${res.id}`);
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
              <Field id="add-course-choice" label="Course">
                <Select id="add-course-choice" value={choice} onChange={(e) => setChoice(e.target.value)}>
                  <option value="">Choose a course…</option>
                  {bySubject.map(([subject, list]) => (
                    <optgroup key={subject} label={subject}>
                      {list.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
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
