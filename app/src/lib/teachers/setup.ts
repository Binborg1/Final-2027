import { z } from "zod";
import { gradeOfLevel } from "@/lib/teachers/labels";

/**
 * First-time setup: grades, subjects, and courses from the Saskatchewan
 * curriculum. Pure rules shared by the setup screen and its Server Functions;
 * the server checks everything again against its own copy of the curriculum.
 */

/** What setup needs to know about a curriculum course (a subset of CourseSummary). */
export type CurriculumCourse = { id: string; name: string; subject: string | null; levels: number[]; units: number };

/** One row in the course list: a curriculum course at one level ("Accounting 20"). */
export type CourseChoice = { curriculumCourseId: string; level: number };
export type CourseRow = CourseChoice & { key: string; title: string; grade: number; subject: string; units: number };

export const OTHER_SUBJECT = "Other";
export const MAX_COURSES = 20;

const grades = z.array(z.union([z.literal(10), z.literal(11), z.literal(12)])).min(1, { error: "Choose at least one grade." }).max(3);

export const profileSchema = z.object({
  name: z.string().trim().min(1, { error: "Tell Funza your name." }).max(200, { error: "That name is too long." }),
  school: z.string().trim().max(200, { error: "That school name is too long." }).default(""),
  grades,
  subjects: z.array(z.string().trim().min(1).max(80)).min(1, { error: "Choose at least one subject." }).max(40, { error: "Choose at most 40 subjects." }),
});
export type Profile = z.infer<typeof profileSchema>;

export const choicesSchema = z
  .array(z.object({ curriculumCourseId: z.string().regex(/^sk-\d{1,6}$/), level: z.union([z.literal(10), z.literal(20), z.literal(30)]) }))
  .min(1, { error: "Choose at least one course." })
  .max(MAX_COURSES, { error: `Choose at most ${MAX_COURSES} courses.` });

/** The first Zod message, for showing next to the form. */
export const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form and try again.";

export const keyOf = (c: CourseChoice) => `${c.curriculumCourseId}:${c.level}`;

/** "Accounting 10, 20, 30" at level 20 → "Accounting 20". Single-level names stay as they are. */
export function levelTitle(name: string, levels: number[], level: number): string {
  if (levels.length <= 1) return name;
  const base = name.replace(/\s+[AB]?\d0(\s*,\s*[AB]?\d0)*\s*$/, "").trim();
  return base && base !== name ? `${base} ${level}` : `${name} (${level})`;
}

export const subjectOf = (c: Pick<CurriculumCourse, "subject">) => c.subject ?? OTHER_SUBJECT;

/** The subjects taught in the chosen grades, alphabetical, with "Other" last. */
export function subjectOptions(courses: CurriculumCourse[], chosenGrades: number[]): string[] {
  const set = new Set<string>();
  for (const c of courses) if (c.levels.some((l) => chosenGrades.includes(gradeOfLevel(l) ?? 0))) set.add(subjectOf(c));
  return [...set].sort((a, b) => (a === OTHER_SUBJECT ? 1 : b === OTHER_SUBJECT ? -1 : a.localeCompare(b, "en")));
}

/** One row per course and level that fits the chosen grades and subjects. */
export function courseRows(courses: CurriculumCourse[], chosenGrades: number[], chosenSubjects: string[]): CourseRow[] {
  const rows: CourseRow[] = [];
  for (const c of courses) {
    if (chosenSubjects.length > 0 && !chosenSubjects.includes(subjectOf(c))) continue;
    for (const level of c.levels) {
      const grade = gradeOfLevel(level);
      if (!grade || !chosenGrades.includes(grade)) continue;
      rows.push({ curriculumCourseId: c.id, level, key: keyOf({ curriculumCourseId: c.id, level }), title: levelTitle(c.name, c.levels, level), grade, subject: subjectOf(c), units: c.units });
    }
  }
  return rows.sort((a, b) => a.title.localeCompare(b.title, "en", { numeric: true }));
}

/** Checks the choices against the curriculum: each course exists and is offered at that level. */
export function checkCourses(choices: CourseChoice[], courses: CurriculumCourse[]): { ok: true; courses: (CourseChoice & { title: string })[] } | { ok: false; message: string } {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const out: (CourseChoice & { title: string })[] = [];
  const seen = new Set<string>();
  for (const choice of choices) {
    const course = byId.get(choice.curriculumCourseId);
    if (!course) return { ok: false, message: "One of those courses isn’t in the Saskatchewan curriculum list. Reload the page and choose again." };
    if (!course.levels.includes(choice.level)) return { ok: false, message: `${course.name} isn’t offered at level ${choice.level}.` };
    const key = keyOf(choice);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...choice, title: levelTitle(course.name, course.levels, choice.level).slice(0, 200) });
  }
  return { ok: true, courses: out };
}

/** What to add and remove so the teacher's courses match the choices, without duplicates. */
export function planCourseChanges<T extends { id: string; curriculumCourseId: string | null; level: number | null }>(existing: T[], chosen: (CourseChoice & { title: string })[]) {
  const have = new Map(existing.filter((e) => e.curriculumCourseId && e.level).map((e) => [keyOf({ curriculumCourseId: e.curriculumCourseId!, level: e.level! }), e]));
  const want = new Set(chosen.map(keyOf));
  return {
    insert: chosen.filter((c) => !have.has(keyOf(c))),
    remove: [...have.entries()].filter(([k]) => !want.has(k)).map(([, e]) => e.id),
  };
}
