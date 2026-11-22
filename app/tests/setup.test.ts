import assert from "node:assert/strict";
import { test } from "node:test";
import { gradesLabel, gradeOfLevel } from "@/lib/teachers/labels";
import { checkCourses, choicesSchema, courseRows, levelTitle, planCourseChanges, profileSchema, subjectOptions, type CurriculumCourse } from "@/lib/teachers/setup";

const COURSES: CurriculumCourse[] = [
  { id: "sk-1", name: "Accounting 10, 20, 30", subject: null, levels: [10, 20, 30], units: 0 },
  { id: "sk-2", name: "Physics 30", subject: "Sciences", levels: [30], units: 4 },
  { id: "sk-3", name: "Science 10", subject: "Sciences", levels: [10], units: 4 },
  { id: "sk-4", name: "Agriculture Production A10, B10, A20, B20, A30, B30", subject: "Additional", levels: [10, 20, 30], units: 0 },
];

test("a multi-level course becomes one course per level, named for that level", () => {
  assert.equal(levelTitle("Accounting 10, 20, 30", [10, 20, 30], 20), "Accounting 20");
  assert.equal(levelTitle("Agriculture Production A10, B10, A20, B20, A30, B30", [10, 20, 30], 30), "Agriculture Production 30");
  assert.equal(levelTitle("Physics 30", [30], 30), "Physics 30");
  assert.equal(levelTitle("Wellness", [10, 20], 20), "Wellness (20)", "no level list in the name");
  assert.equal(gradeOfLevel(20), 11);
});

test("the course list shows only the chosen grades and subjects", () => {
  const rows = courseRows(COURSES, [10, 12], ["Sciences", "Other"]);
  assert.deepEqual(
    rows.map((r) => `${r.title} · Grade ${r.grade}`),
    ["Accounting 10 · Grade 10", "Accounting 30 · Grade 12", "Physics 30 · Grade 12", "Science 10 · Grade 10"],
  );
  assert.deepEqual(subjectOptions(COURSES, [11]), ["Additional", "Other"], "only subjects taught in grade 11, Other last");
});

test("setup refuses a bad grade, no subjects, and too many subjects", () => {
  assert.equal(profileSchema.safeParse({ name: "Sam", grades: [9], subjects: ["Sciences"] }).success, false);
  assert.equal(profileSchema.safeParse({ name: "Sam", grades: [], subjects: ["Sciences"] }).success, false);
  assert.equal(profileSchema.safeParse({ name: "Sam", grades: [10], subjects: [] }).success, false);
  assert.equal(profileSchema.safeParse({ name: "Sam", grades: [10], subjects: Array.from({ length: 41 }, (_, i) => `S${i}`) }).success, false);
  assert.equal(profileSchema.safeParse({ name: "  ", grades: [10], subjects: ["Sciences"] }).success, false, "a name is needed");
  assert.equal(profileSchema.safeParse({ name: "Sam", grades: [10, 12], subjects: ["Sciences"] }).success, true);
});

test("course choices must be real curriculum courses at a level they offer", () => {
  assert.equal(choicesSchema.safeParse([{ curriculumCourseId: "sk-2", level: 25 }]).success, false);
  assert.equal(choicesSchema.safeParse([{ curriculumCourseId: "not-a-course", level: 30 }]).success, false);
  assert.equal(choicesSchema.safeParse([]).success, false, "at least one course");
  assert.equal(checkCourses([{ curriculumCourseId: "sk-9", level: 30 }], COURSES).ok, false, "unknown course");
  assert.equal(checkCourses([{ curriculumCourseId: "sk-2", level: 20 }], COURSES).ok, false, "Physics 30 isn't offered at level 20");
  const ok = checkCourses([{ curriculumCourseId: "sk-1", level: 20 }, { curriculumCourseId: "sk-1", level: 20 }], COURSES);
  assert.ok(ok.ok);
  assert.deepEqual(ok.courses, [{ curriculumCourseId: "sk-1", level: 20, title: "Accounting 20" }], "duplicates collapse");
});

test("finishing setup again adds no duplicates and removes what was unticked", () => {
  const existing = [
    { id: "c1", curriculumCourseId: "sk-2", level: 30 },
    { id: "c2", curriculumCourseId: "sk-1", level: 10 },
    { id: "c3", curriculumCourseId: null, level: null }, // a course of the teacher's own: never touched
  ];
  const chosen = [
    { curriculumCourseId: "sk-2", level: 30, title: "Physics 30" },
    { curriculumCourseId: "sk-3", level: 10, title: "Science 10" },
  ];
  assert.deepEqual(planCourseChanges(existing, chosen), { insert: [chosen[1]], remove: ["c2"] });
  assert.deepEqual(planCourseChanges([...existing.slice(0, 1), { id: "c4", curriculumCourseId: "sk-3", level: 10 }], chosen), { insert: [], remove: [] });
});

test("grades read naturally", () => {
  assert.equal(gradesLabel([12, 10, 11]), "Grades 10–12");
  assert.equal(gradesLabel([12, 10]), "Grades 10 and 12");
  assert.equal(gradesLabel([11]), "Grade 11");
  assert.equal(gradesLabel([]), "");
});
