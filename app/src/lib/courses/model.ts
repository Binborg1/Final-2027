import { z } from "zod";

/**
 * Rules for courses and chapters, shared by the course pages and their Server
 * Functions (which check everything again).
 */

export const nameSchema = z.string().trim().min(1, { error: "Give it a name." }).max(200, { error: "Keep the name under 200 characters." });
export const idSchema = z.guid({ error: "That item wasn’t found." });

export const addCourseSchema = z.union([
  z.object({ curriculumCourseId: z.string().regex(/^sk-\d{1,6}$/), level: z.union([z.literal(10), z.literal(20), z.literal(30)]) }),
  z.object({ title: nameSchema }),
]);
export type AddCourseInput = z.infer<typeof addCourseSchema>;

/**
 * The order after moving one item up (-1) or down (+1), or null when it can't move.
 * Positions are rewritten 0..n-1, so gaps and ties from older rows disappear.
 */
export function moved(ids: string[], id: string, dir: -1 | 1): string[] | null {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** A chapter as Make shows it: a chip, and the outcomes it stands for. */
export type ChapterChoice = { id: string; title: string; outcomeRefs: string[] };
