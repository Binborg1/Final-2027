import "server-only";
import { cache } from "react";
import { currentTeacher, teacherCourses } from "@/lib/auth/teacher";
import { draftAfter, historyOf, latestApproved, shortDate, type ApprovedVersion, type Channel, type HistoryEntry, type LibraryCourse, type LibraryRow } from "@/lib/library/model";
import { KINDS } from "@/lib/resources/kinds";
import { readStoredContent } from "@/lib/resources/stored";
import type { Draft, ResourceKind } from "@/lib/resources/types";
import type { TemplateStyle } from "@/lib/templates/model";

/**
 * What the Library reads (docs/04_development/05_library.md). No table of its own:
 * approved resource versions, their resources, courses and chapters, all through
 * the teacher's own session, so row-level security returns only their rows.
 */

const isKind = (k: string): k is ResourceKind => KINDS.some((x) => x.kind === k);

export type LibraryData = { rows: LibraryRow[]; courses: LibraryCourse[]; waiting: number };

/** Every material with an approved version, and how many materials are waiting for review. */
export const libraryRows = cache(async (): Promise<LibraryData> => {
  const current = await currentTeacher();
  if (!current) return { rows: [], courses: [], waiting: 0 };
  const { supabase } = current;
  const [versions, resources, chapters, courses] = await Promise.all([
    // Without `content`: the list needs only which versions are approved.
    supabase.from("resource_versions").select("id, resource_id, number, approved_at").not("approved_at", "is", null),
    supabase.from("resources").select("id, title, kind, status, course_id, current_version_id, resource_chapters(chapter_id)"),
    supabase.from("chapters").select("id, title"),
    teacherCourses(),
  ]);
  if (versions.error) throw new Error(`Could not read approved versions: ${versions.error.message}`);
  if (resources.error) throw new Error(`Could not read materials: ${resources.error.message}`);
  if (chapters.error) throw new Error(`Could not read chapters: ${chapters.error.message}`);

  const approved = latestApproved(versions.data.map((v) => ({ id: v.id, resourceId: v.resource_id, number: v.number, approvedAt: v.approved_at })));
  const chapterTitle = new Map(chapters.data.map((c) => [c.id, c.title]));
  const rows: LibraryRow[] = [];
  let waiting = 0;
  for (const r of resources.data) {
    const latest = approved.get(r.id);
    if (r.current_version_id && r.current_version_id !== latest?.id) waiting++;
    if (!latest || !isKind(r.kind)) continue;
    rows.push({
      id: r.id,
      title: r.title,
      kind: r.kind,
      courseId: r.course_id,
      chapterTitles: (r.resource_chapters ?? []).map((x) => chapterTitle.get(x.chapter_id)).filter((t): t is string => !!t),
      approved: latest,
      approvedOn: shortDate(latest.at),
      draft: draftAfter(r.current_version_id, latest),
      published: r.status === "published",
    });
  }
  return { rows, courses: courses.map((c) => ({ id: c.id, title: c.title })), waiting };
});

export type LibraryItem = {
  id: string;
  kind: ResourceKind;
  status: string;
  createdAt: string;
  course: LibraryCourse;
  chapters: LibraryCourse[];
  /** The approved version on screen, with its frozen content. */
  shown: { versionId: string; number: number; at: string; draft: Draft; style: TemplateStyle | null };
  latest: ApprovedVersion;
  /** The draft that follows the latest approval, by number. */
  draft: number | null;
  /** The version on screen is the material's current version (so Live and Publish use it). */
  isCurrent: boolean;
  history: HistoryEntry[];
};

/**
 * One material for the read-only view: `wanted` is a version number from the
 * address; when it isn't an approved version, the latest approved one is shown.
 * "unapproved" when the material exists but has never been approved.
 */
export const libraryItem = cache(async (id: string, wanted: number | null): Promise<LibraryItem | "unapproved" | null> => {
  const current = await currentTeacher();
  if (!current) return null;
  const { supabase } = current;
  const [r, versions] = await Promise.all([
    supabase.from("resources").select("id, kind, title, status, course_id, current_version_id, created_at, updated_at, resource_chapters(chapter_id)").eq("id", id).maybeSingle(),
    supabase.from("resource_versions").select("id, resource_id, number, approved_at").eq("resource_id", id),
  ]);
  if (r.error) throw new Error(`Could not read the material: ${r.error.message}`);
  if (versions.error) throw new Error(`Could not read its versions: ${versions.error.message}`);
  const row = r.data;
  if (!row || !isKind(row.kind)) return null;

  const metas = versions.data.map((v) => ({ id: v.id, resourceId: v.resource_id, number: v.number, approvedAt: v.approved_at }));
  const latest = latestApproved(metas).get(row.id);
  if (!latest) return "unapproved";
  const pick = metas.find((v) => v.approvedAt && v.number === wanted) ?? metas.find((v) => v.id === latest.id)!;

  const chapterIds = (row.resource_chapters ?? []).map((x) => x.chapter_id);
  const [content, publications, course, chapters] = await Promise.all([
    supabase.from("resource_versions").select("number, approved_at, content").eq("id", pick.id).single(),
    supabase.from("publications").select("version_id, channel, published_at").in("version_id", metas.map((v) => v.id)),
    supabase.from("courses").select("id, title").eq("id", row.course_id).maybeSingle(),
    chapterIds.length > 0 ? supabase.from("chapters").select("id, title, position").in("id", chapterIds).order("position") : Promise.resolve({ data: [] as { id: string; title: string }[], error: null }),
  ]);
  if (content.error) throw new Error(`Could not read the version: ${content.error.message}`);
  if (publications.error) throw new Error(`Could not read where it was published: ${publications.error.message}`);
  if (course.error || chapters.error) throw new Error("Could not read the course or its chapters.");
  const stored = readStoredContent(row, content.data);
  if (!stored) return null;

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    createdAt: row.created_at,
    course: { id: row.course_id, title: course.data?.title ?? stored.resource.courseName },
    chapters: (chapters.data ?? []).map((c) => ({ id: c.id, title: c.title })),
    shown: { versionId: pick.id, number: pick.number, at: pick.approvedAt!, draft: stored.draft, style: stored.resource.brief.style },
    latest,
    draft: draftAfter(row.current_version_id, latest),
    isCurrent: row.current_version_id === pick.id,
    history: historyOf(
      metas,
      publications.data.map((p) => ({ versionId: p.version_id, channel: p.channel as Channel, at: p.published_at })),
      row.current_version_id,
    ),
  };
});
