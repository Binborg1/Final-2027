import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findOutcome } from "@/lib/curriculum/catalog";
import { loadDataset } from "@/lib/curriculum/dataset";
import { placeOf } from "@/lib/curriculum/sources";
import type { Database } from "@/lib/db/types";
import { isLiveType } from "@/lib/live/questions";
import { draftShell, questionSections } from "@/lib/resources/assemble";
import { approveStored, insertMaterial, sha256 } from "@/lib/resources/approve-core";
import { canonicalOf } from "@/lib/resources/bank-rows";
import { approvalBlockers, computeChecks, itemFp } from "@/lib/resources/checks";
import { defaultBrief } from "@/lib/resources/kinds";
import { isObject, sanitizeItem } from "@/lib/resources/sanitize";
import { toStoredContent } from "@/lib/resources/stored";
import type { Item, Origin, QType, Resource } from "@/lib/resources/types";

/**
 * Questions Funza suggested, or that the teacher edited, on the Live setup screen
 * become an approved quiz ("Live · Motion · 26 Nov") when the lobby opens. Keeping
 * a question on that screen is the teacher's review of it; every other check
 * still runs, as for any approval. The questions go into the chapter's bank, and
 * the quiz can be run again or printed later.
 */

type Db = SupabaseClient<Database>;
export type SaveSetResult = { ok: true; resourceId: string; versionId: string; questionIds: string[] } | { ok: false; status: number; reason: string; message: string };

const refuse = (reason: string, message: string, status = 400): SaveSetResult => ({ ok: false, status, reason, message });
const ORIGINS: Origin[] = ["ai", "bank", "teacher"];

export async function saveLiveQuiz(supabase: Db, teacherId: string, input: { courseId: string; chapterId: string | null; title: string; minutes: number; items: unknown[] }): Promise<SaveSetResult> {
  loadDataset(); // the outcome checks need the whole catalog
  const items: Item[] = [];
  for (const [i, raw] of input.items.entries()) {
    const origin = isObject(raw) && ORIGINS.includes(raw.origin as Origin) ? (raw.origin as Origin) : "teacher";
    const item = sanitizeItem(raw, { fallbackId: `live-${i + 1}`, origin });
    if (!item || !item.prompt.trim()) return refuse("bad-question", `Question ${i + 1} couldn't be read. Remove it or write it again.`);
    if (!isLiveType(item.type)) return refuse("not-on-phones", `Question ${i + 1} can't be answered on phones yet.`);
    const outcomeIds = item.outcomeIds.filter((id) => findOutcome(id));
    const fixed = { ...item, id: `live-${i + 1}`, outcomeIds };
    items.push({ ...fixed, reviewedFp: itemFp(fixed) });
  }
  const outcomeIds = [...new Set(items.flatMap((i) => i.outcomeIds))];
  if (outcomeIds.length > 6) return refuse("too-many-outcomes", "These questions cover more than 6 outcomes. Keep questions from at most 6.");

  const brief = {
    ...defaultBrief("quiz", outcomeIds),
    title: input.title.slice(0, 160),
    courseId: input.courseId,
    chapterIds: input.chapterId ? [input.chapterId] : [],
    duration: Math.max(5, Math.min(240, input.minutes)),
    mix: (["mcq", "tf", "calc", "short"] as QType[]).map((type) => ({ type, count: items.filter((i) => i.type === type).length, marks: items.find((i) => i.type === type)?.marks ?? 1 })),
  };
  const id = randomUUID();
  const draft = {
    ...draftShell(brief, id, questionSections(brief, items), items.some((i) => i.origin === "ai") ? ("ai" as const) : ("teacher" as const), null, []),
    // Keeping the set on the setup screen confirms its reading level and curriculum wording.
    globals: { readingLevel: true, indicatorsPending: true },
  };
  const blockers = approvalBlockers(computeChecks(draft));
  if (blockers.length > 0) {
    const first = blockers.slice(0, 2).map((b) => b.label).join("; ");
    return refuse("blocked", `Funza can't save these questions yet: ${first}. Fix or remove them, then open the lobby.`);
  }

  const now = new Date().toISOString();
  const place = placeOf(outcomeIds);
  const resource: Resource = { id, kind: "quiz", title: brief.title, courseName: place.courseName, unitName: place.unitName, outcomeIds, createdAt: now, updatedAt: now, deliveries: [], brief };
  const content = toStoredContent(resource, draft);
  const saved = await insertMaterial(supabase, teacherId, id, content);
  if (!saved.ok) return refuse(saved.code === "course" ? "bad-course" : "save-failed", saved.message, saved.code === "course" ? 400 : 500);
  const approved = await approveStored(supabase, { resourceId: id, courseId: input.courseId, versionId: saved.versionId, number: 1, stored: content });
  if (!approved.ok) return refuse("save-failed", approved.message, 500);

  // The bank rows, found by each question's fingerprint, in the order the teacher chose.
  const fps = items.map((i) => sha256(canonicalOf(i)));
  const { data, error } = await supabase.from("questions").select("id, fingerprint").in("fingerprint", fps);
  if (error) return refuse("save-failed", "Funza couldn't find the saved questions. Try again.", 500);
  const byFp = new Map((data ?? []).map((r) => [r.fingerprint, r.id]));
  const questionIds = fps.map((fp) => byFp.get(fp));
  if (questionIds.some((q) => !q)) return refuse("save-failed", "Funza couldn't find the saved questions. Try again.", 500);
  return { ok: true, resourceId: id, versionId: saved.versionId, questionIds: questionIds as string[] };
}
