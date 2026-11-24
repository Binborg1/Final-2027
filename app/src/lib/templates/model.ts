import { defaultBrief, NOTES_STYLES, QTYPE_LABEL, QTYPE_ORDER } from "@/lib/resources/kinds";
import type { DifficultyPreset, NotesStyle, QType, ResourceKind } from "@/lib/resources/types";

/**
 * Templates (FR-20, FR-21): a teacher's own format, learned from an example or set
 * up by hand. A template is a format without its content: sections, question
 * types, counts, marks, time and wording style for quizzes, tests and exams; the
 * parts every handout has for notes; the slide pattern for slides.
 *
 * Every string in a format is one line without angle brackets, so a format can be
 * put inside a prompt tag later without breaking out of it. `sanitizeFormat`
 * rebuilds a format from untrusted JSON (an AI reply, a browser, a stored row)
 * field by field, clamping every number and list.
 */

export type TemplateCategory = "quiz" | "exam" | "notes" | "slides";

export const CATEGORIES: { id: TemplateCategory; label: string; one: string; kinds: ResourceKind[]; example: string }[] = [
  { id: "quiz", label: "Quizzes & tests", one: "Quiz or test", kinds: ["quiz", "test"], example: "a past quiz or test" },
  { id: "exam", label: "Exams", one: "Exam", kinds: ["exam"], example: "a past exam" },
  { id: "notes", label: "Notes", one: "Notes", kinds: ["notes"], example: "a handout you already use" },
  { id: "slides", label: "Slides", one: "Slides", kinds: ["presentation"], example: "a slide deck saved as PDF" },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const categoryInfo = (c: TemplateCategory) => CATEGORIES.find((x) => x.id === c)!;
export const isCategory = (v: unknown): v is TemplateCategory => CATEGORY_IDS.includes(v as TemplateCategory);

/** The template category a kind of material uses: tests share quizzes' templates; slides are "presentation" materials. */
export function categoryOf(kind: ResourceKind): TemplateCategory {
  return kind === "test" ? "quiz" : kind === "presentation" ? "slides" : kind;
}

export type TemplateRow = { type: QType; count: number; marks: number };
export type TemplateSection = { title: string; instructions: string; rows: TemplateRow[] };
export type TemplatePart = { title: string; detail: string };
export type TemplateStyle = {
  /** How questions or text are worded, in general terms ("Questions start with a command verb"). */
  wording: string[];
  numbering: "continuous" | "per-section";
  marksShown: "brackets" | "margin" | "none";
  cover: { title: string; instructions: string[] } | null;
};
export type QuestionFormat = {
  v: 1;
  category: "quiz" | "exam";
  sections: TemplateSection[];
  duration: number;
  difficulty: DifficultyPreset;
  extras: { answerKey: boolean; workedSolutions: boolean; rubric: boolean };
  style: TemplateStyle;
};
export type NotesFormat = { v: 1; category: "notes"; parts: TemplatePart[]; notesStyle: NotesStyle | null; keyTerms: boolean; checkQuestions: boolean; style: TemplateStyle };
export type SlidesFormat = { v: 1; category: "slides"; slides: number; perSlide: { maxBullets: number; pattern: string }; parts: TemplatePart[]; speakerNotes: boolean; style: TemplateStyle };
export type TemplateFormat = QuestionFormat | NotesFormat | SlidesFormat;

/** What a draft's prompt needs from a template beyond its layout or parts: its wording style and, for slides, the slide pattern. */
export type TemplateGuide = { name: string; style: TemplateStyle; perSlide: { maxBullets: number; pattern: string } | null };

export const isQuestionFormat = (f: TemplateFormat): f is QuestionFormat => f.category === "quiz" || f.category === "exam";

export type LearnedFrom = { kind: "file" | "description" | "material" | "controls"; name: string };

/** A saved template as the app uses it. `format` is null when the stored row can't be read. */
export type Template = { id: string; category: TemplateCategory; name: string; summary: string; format: TemplateFormat | null; learnedFrom: LearnedFrom[]; used: number; updatedAt: string };

export const LIMITS = {
  name: 80,
  summary: 160,
  sections: 8,
  rows: 7,
  count: 25,
  marks: 20,
  questions: 60,
  sectionTitle: 80,
  instructions: 300,
  parts: 12,
  partTitle: 80,
  partDetail: 200,
  wording: 8,
  wordingLine: 120,
  coverLines: 6,
  coverLine: 160,
  examples: 3,
  exampleText: 12000,
  description: 1500,
  perTeacher: 100,
} as const;

const DIFFICULTIES: readonly DifficultyPreset[] = ["balanced", "review", "challenge"];
const NUMBERING = ["continuous", "per-section"] as const;
const MARKS_SHOWN = ["brackets", "margin", "none"] as const;
const LEARNED_KINDS = ["file", "description", "material", "controls"] as const;
const NOTES_STYLE_IDS = NOTES_STYLES.map((s) => s.id) as readonly NotesStyle[];

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const int = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T => (values.includes(v as T) ? (v as T) : fallback);

/** One line of text: no line breaks, no angle brackets, no null characters, single spaces. */
export function line(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/[\u0000<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

export const sectionLetter = (i: number) => String.fromCharCode(65 + (i % 26));

function sanitizeStyle(raw: unknown): TemplateStyle {
  const s = isObject(raw) ? raw : {};
  const cover = isObject(s.cover) ? s.cover : null;
  const coverOut = cover
    ? {
        title: line(cover.title, LIMITS.coverLine),
        instructions: list(cover.instructions)
          .map((x) => line(x, LIMITS.coverLine))
          .filter(Boolean)
          .slice(0, LIMITS.coverLines),
      }
    : null;
  return {
    wording: list(s.wording)
      .map((x) => line(x, LIMITS.wordingLine))
      .filter(Boolean)
      .slice(0, LIMITS.wording),
    numbering: oneOf(s.numbering, NUMBERING, "continuous"),
    marksShown: oneOf(s.marksShown, MARKS_SHOWN, "brackets"),
    cover: coverOut && (coverOut.title || coverOut.instructions.length > 0) ? coverOut : null,
  };
}

export function sanitizeParts(raw: unknown): TemplatePart[] {
  return list(raw)
    .filter(isObject)
    .map((p) => ({ title: line(p.title, LIMITS.partTitle), detail: line(p.detail, LIMITS.partDetail) }))
    .filter((p) => p.title)
    .slice(0, LIMITS.parts);
}

export function sanitizeLayout(raw: unknown): TemplateSection[] {
  let room: number = LIMITS.questions;
  const out: TemplateSection[] = [];
  for (const s of list(raw).filter(isObject).slice(0, LIMITS.sections)) {
    const rows: TemplateRow[] = [];
    for (const r of list(s.rows).filter(isObject)) {
      const type = QTYPE_ORDER.find((t) => t === r.type);
      if (!type || rows.some((x) => x.type === type) || rows.length >= LIMITS.rows || room <= 0) continue;
      const count = Math.min(room, int(r.count, 1, LIMITS.count, 1));
      room -= count;
      rows.push({ type, count, marks: int(r.marks, 1, LIMITS.marks, 1) });
    }
    if (rows.length === 0) continue;
    out.push({ title: line(s.title, LIMITS.sectionTitle) || `Section ${sectionLetter(out.length)}`, instructions: line(s.instructions, LIMITS.instructions), rows });
  }
  return out;
}

/**
 * A format rebuilt from untrusted JSON for the given category, or null when nothing
 * usable is in it (no question sections for a quiz or exam, no parts for notes).
 */
export function sanitizeFormat(category: TemplateCategory, raw: unknown): TemplateFormat | null {
  const f = isObject(raw) ? raw : {};
  const style = sanitizeStyle(f.style);
  if (category === "quiz" || category === "exam") {
    const sections = sanitizeLayout(f.sections);
    if (sections.length === 0) return null;
    const extras = isObject(f.extras) ? f.extras : {};
    return {
      v: 1,
      category,
      sections,
      duration: int(f.duration, 5, 240, category === "exam" ? 90 : 30),
      difficulty: oneOf(f.difficulty, DIFFICULTIES, "balanced"),
      extras: { answerKey: bool(extras.answerKey, true), workedSolutions: bool(extras.workedSolutions, false), rubric: bool(extras.rubric, true) },
      style,
    };
  }
  const parts = sanitizeParts(f.parts);
  if (category === "notes") {
    if (parts.length === 0) return null;
    return { v: 1, category, parts, notesStyle: NOTES_STYLE_IDS.includes(f.notesStyle as NotesStyle) ? (f.notesStyle as NotesStyle) : null, keyTerms: bool(f.keyTerms, true), checkQuestions: bool(f.checkQuestions, true), style };
  }
  const per = isObject(f.perSlide) ? f.perSlide : {};
  return { v: 1, category, slides: int(f.slides, 3, 30, 8), perSlide: { maxBullets: int(per.maxBullets, 1, 8, 5), pattern: line(per.pattern, 160) }, parts, speakerNotes: bool(f.speakerNotes, true), style };
}

export function sanitizeLearnedFrom(raw: unknown): LearnedFrom[] {
  return list(raw)
    .filter(isObject)
    .map((x) => ({ kind: oneOf(x.kind, LEARNED_KINDS, "file"), name: line(x.name, 120) }))
    .filter((x) => x.name)
    .slice(0, 5);
}

export function totals(sections: TemplateSection[]) {
  let questions = 0;
  let marks = 0;
  for (const s of sections) for (const r of s.rows) {
    questions += r.count;
    marks += r.count * r.marks;
  }
  return { questions, marks };
}

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The one-line value shown wherever a template appears: worked out from the format, never stored. */
export function formatLine(f: TemplateFormat): string {
  if (isQuestionFormat(f)) {
    const t = totals(f.sections);
    return [n(f.sections.length, "section"), n(t.questions, "question"), n(t.marks, "mark"), `${f.duration} min`].join(" · ");
  }
  if (f.category === "notes") return [n(f.parts.length, "part"), f.keyTerms && "Key terms", f.checkQuestions && "Check questions"].filter(Boolean).join(" · ");
  return [n(f.slides, "slide"), `up to ${n(f.perSlide.maxBullets, "bullet")}`, f.speakerNotes && "Speaker notes"].filter(Boolean).join(" · ");
}

/** How one row reads: "20 multiple choice × 1 mark". */
export function rowLine(r: TemplateRow): string {
  return `${r.count} ${QTYPE_LABEL[r.type].toLowerCase()} × ${n(r.marks, "mark")}`;
}

const EMPTY_STYLE: TemplateStyle = { wording: [], numbering: "continuous", marksShown: "brackets", cover: null };

/** A starting format for "set it up yourself": Funza's own defaults for that category. */
export function starterFormat(category: TemplateCategory): TemplateFormat {
  if (category === "quiz" || category === "exam") {
    const b = defaultBrief(category === "exam" ? "exam" : "quiz");
    const sections = b.mix.filter((r) => r.count > 0).map((r, i) => ({ title: `Part ${sectionLetter(i)}: ${QTYPE_LABEL[r.type]}`, instructions: "", rows: [{ type: r.type, count: r.count, marks: r.marks }] }));
    return { v: 1, category, sections, duration: b.duration, difficulty: "balanced", extras: { answerKey: true, workedSolutions: b.workedSolutions, rubric: true }, style: { ...EMPTY_STYLE } };
  }
  if (category === "notes") {
    return {
      v: 1,
      category,
      parts: [
        { title: "Learning goals", detail: "What students will be able to do, as I can statements" },
        { title: "Key ideas", detail: "The main explanation, in short paragraphs" },
        { title: "Worked example", detail: "One example solved step by step" },
        { title: "Key terms", detail: "Each new word with a one-line meaning" },
        { title: "Check your understanding", detail: "Three short questions" },
      ],
      notesStyle: null,
      keyTerms: true,
      checkQuestions: true,
      style: { ...EMPTY_STYLE },
    };
  }
  return {
    v: 1,
    category,
    slides: 8,
    perSlide: { maxBullets: 5, pattern: "A short title, three to five bullets and one example" },
    parts: [
      { title: "Title slide", detail: "The lesson title and the course" },
      { title: "Learning goals", detail: "What students will learn today" },
      { title: "Content", detail: "One idea per slide" },
      { title: "Summary", detail: "The key points again" },
    ],
    speakerNotes: true,
    style: { ...EMPTY_STYLE },
  };
}
