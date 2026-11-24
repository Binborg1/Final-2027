import type { NextRequest } from "next/server";
import { z } from "zod";
import { err } from "@/lib/live/handlers/result";
import { handleStart, MAX_QUESTIONS, startSchema } from "@/lib/live/handlers/teacher";
import { readJson, teacherRoute } from "@/lib/live/route";
import { saveLiveQuiz } from "@/lib/live/save-set";

export const runtime = "nodejs";

/** Bank questions by id, or questions Funza suggested or the teacher edited on the setup screen. */
const requestSchema = startSchema.extend({
  questions: z.array(z.union([z.object({ questionId: z.guid() }), z.object({ item: z.record(z.string(), z.unknown()) })])).min(1).max(MAX_QUESTIONS),
});

/**
 * Opens the lobby: creates a live session from the chosen questions. New or
 * edited questions are first saved as an approved quiz in the chapter, so every
 * live question is a bank question with its key snapshotted.
 */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  return teacherRoute(request, null, async (deps, _id, teacher) => {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return err(400, "bad-request", "Choose a course, a timer and at least one question.");
    const input = parsed.data;
    const existing = await deps.store.session(input.id);
    if (existing) return handleStart({ ...input, questions: [] }, deps);

    const newItems = input.questions.flatMap((q) => ("item" in q ? [q.item] : []));
    let resourceVersionId = input.resourceVersionId;
    let saved: string[] = [];
    if (newItems.length > 0) {
      const set = await saveLiveQuiz(teacher.supabase, teacher.id, { courseId: input.courseId, chapterId: input.chapterId, title: input.title, minutes: Math.round(input.timerS / 60), items: newItems });
      if (!set.ok) return err(set.status, set.reason, set.message);
      saved = set.questionIds;
      if (newItems.length === input.questions.length) resourceVersionId = set.versionId;
    }
    let next = 0;
    const questions = input.questions.map((q) => ("questionId" in q ? { questionId: q.questionId } : { questionId: saved[next++] }));
    return handleStart({ ...input, resourceVersionId, questions }, deps);
  });
}
