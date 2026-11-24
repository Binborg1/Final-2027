import "server-only";
import { remainingToday } from "@/lib/ai/allowance";
import { currentTeacher } from "@/lib/auth/teacher";
import { loadDataset } from "@/lib/curriculum/dataset";
import { codeOf } from "@/lib/curriculum/sources";
import { courseDetail, courseList } from "@/lib/courses/data";
import { outcomesOf } from "@/lib/courses/server";
import { isLiveType, itemFromBank, NOT_ON_PHONES } from "@/lib/live/questions";
import { isQuestionKind } from "@/lib/resources/kinds";
import type { Item, QType } from "@/lib/resources/types";

/**
 * What the Live setup screen starts from (FR-6): the teacher's courses and the
 * chosen chapter, its outcomes, its question bank, the course's approved quizzes
 * (and the chosen one's questions), the chapter's sources with text, and what is
 * left of today's AI allowance. Read as the teacher (row-level security).
 */

export type SetupQuestion = {
  key: string;
  /** The bank row it came from; null once edited or when Funza wrote it (saved when the lobby opens). */
  bankId: string | null;
  source: "bank" | "quiz" | "funza";
  item: Item;
  outcomeCode: string | null;
  /** Why it can't be answered on phones, if it can't. */
  notOnPhones: string | null;
  percentRight: number | null;
};

export type SetupData = {
  courses: { id: string; title: string }[];
  course: { id: string; title: string } | null;
  chapters: { id: string; title: string }[];
  chapter: { id: string; title: string } | null;
  outcomes: { id: string; code: string; statement: string }[];
  bank: SetupQuestion[];
  quizzes: { id: string; title: string; versionId: string }[];
  quiz: { id: string; title: string; versionId: string; questions: SetupQuestion[] } | null;
  sources: { id: string; title: string }[];
  remaining: number | null;
  openSessions: { id: string; title: string; code: string; state: string }[];
};

type BankRow = { id: string; type: string; stem: string; options: unknown; answer: unknown; marks: number; outcome_ref: string | null; difficulty: number | null };

function toSetup(row: BankRow, source: SetupQuestion["source"]): SetupQuestion {
  const item = itemFromBank(row);
  return {
    key: `${source}-${row.id}`,
    bankId: row.id,
    source,
    item,
    outcomeCode: row.outcome_ref ? codeOf(row.outcome_ref) || null : null,
    notOnPhones: isLiveType(row.type) ? null : (NOT_ON_PHONES[row.type as QType] ?? "Not on phones yet"),
    percentRight: row.difficulty === null ? null : Math.round(row.difficulty * 100),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pick = (v: string | undefined) => (v && UUID.test(v) ? v.toLowerCase() : null);
const BANK_COLS = "id, type, stem, options, answer, marks, outcome_ref, difficulty";

export async function liveSetupData(q: { course?: string; chapter?: string; quiz?: string }): Promise<SetupData | null> {
  const current = await currentTeacher();
  if (!current) return null;
  const { supabase, teacher } = current;
  loadDataset();

  const courses = (await courseList()).map((c) => ({ id: c.id, title: c.title }));
  const empty: SetupData = { courses, course: null, chapters: [], chapter: null, outcomes: [], bank: [], quizzes: [], quiz: null, sources: [], remaining: null, openSessions: [] };
  const open = await supabase.from("live_sessions").select("id, title, code, state").neq("state", "ended").order("created_at");
  empty.openSessions = open.data ?? [];
  if (courses.length === 0) return empty;

  // A saved quiz brings its own course and chapter.
  let courseId = pick(q.course);
  let chapterId = pick(q.chapter);
  const quizId = pick(q.quiz);
  let quizRow: { id: string; title: string; course_id: string; current_version_id: string | null; kind: string; status: string } | null = null;
  if (quizId) {
    const r = await supabase.from("resources").select("id, title, course_id, current_version_id, kind, status, resource_chapters(chapter_id)").eq("id", quizId).maybeSingle();
    if (r.data && isQuestionKind(r.data.kind as never)) {
      quizRow = r.data;
      courseId = r.data.course_id;
      chapterId = chapterId ?? r.data.resource_chapters?.[0]?.chapter_id ?? null;
    }
  }
  if (!courseId || !courses.some((c) => c.id === courseId)) courseId = courses[0].id;
  const detail = await courseDetail(courseId);
  if (!detail) return empty;
  const chapters = detail.chapters.map((c) => ({ id: c.id, title: c.title }));
  const chapter = detail.chapters.find((c) => c.id === chapterId) ?? detail.chapters[0] ?? null;

  const [bank, quizzes, sources, remaining] = await Promise.all([
    chapter ? supabase.from("questions").select(BANK_COLS).eq("chapter_id", chapter.id).eq("retired", false).order("created_at", { ascending: false }).limit(80) : Promise.resolve({ data: [] as BankRow[], error: null }),
    supabase.from("resources").select("id, title, kind, current_version_id").eq("course_id", detail.course.id).eq("status", "approved").in("kind", ["quiz", "test", "exam"]).order("updated_at", { ascending: false }),
    chapter ? supabase.from("sources").select("id, title, text").eq("chapter_id", chapter.id).not("text", "is", null).order("created_at") : Promise.resolve({ data: [] as { id: string; title: string; text: string | null }[], error: null }),
    remainingToday(teacher.id),
  ]);

  let quiz: SetupData["quiz"] = null;
  if (quizRow?.current_version_id) {
    const links = await supabase.from("version_questions").select("question_id, position").eq("version_id", quizRow.current_version_id).order("position");
    const ids = (links.data ?? []).map((l) => l.question_id);
    const rows = ids.length ? await supabase.from("questions").select(BANK_COLS).in("id", ids) : { data: [] as BankRow[] };
    const byId = new Map((rows.data ?? []).map((r) => [r.id, r as BankRow]));
    quiz = { id: quizRow.id, title: quizRow.title, versionId: quizRow.current_version_id, questions: ids.map((id) => byId.get(id)).filter((r): r is BankRow => !!r).map((r) => toSetup(r, "quiz")) };
  }

  return {
    courses,
    course: { id: detail.course.id, title: detail.course.title },
    chapters,
    chapter: chapter ? { id: chapter.id, title: chapter.title } : null,
    outcomes: chapter ? outcomesOf(detail.course.curriculumCourseId, chapter.outcomeRefs) : [],
    bank: ((bank.data ?? []) as BankRow[]).map((r) => toSetup(r, "bank")),
    quizzes: (quizzes.data ?? []).filter((r) => r.current_version_id).map((r) => ({ id: r.id, title: r.title, versionId: r.current_version_id as string })),
    quiz,
    sources: (sources.data ?? []).map((s) => ({ id: s.id, title: s.title })),
    remaining,
    openSessions: empty.openSessions,
  };
}
