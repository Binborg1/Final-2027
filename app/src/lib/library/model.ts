import { HAS_PART } from "@/lib/resources/render";
import type { ResourceKind, Section } from "@/lib/resources/types";
import { matchesQuery } from "@/lib/ui/search";

/**
 * The Library: every material the teacher has approved, with each approved version
 * kept (docs/04_development/05_library.md). It is a read model over resources and
 * resource_versions, so these rules are pure and tested (tests/library.test.ts).
 *
 * A material is in the Library once it has an approved version. `resources.status`
 * isn't used for that: it describes the current version, which goes back to draft
 * when the teacher starts the next version.
 */

export type VersionMeta = { id: string; resourceId: string; number: number; approvedAt: string | null };
export type ApprovedVersion = { id: string; number: number; at: string };

/** The latest approved version of each material, by resource id. */
export function latestApproved(versions: VersionMeta[]): Map<string, ApprovedVersion> {
  const out = new Map<string, ApprovedVersion>();
  for (const v of versions) {
    if (!v.approvedAt) continue;
    const seen = out.get(v.resourceId);
    if (!seen || v.number > seen.number) out.set(v.resourceId, { id: v.id, number: v.number, at: v.approvedAt });
  }
  return out;
}

/**
 * The number of the draft that follows an approval, or null. A new version always
 * starts from the approved one (startMaterialVersion), so when the current version
 * isn't the latest approved one, it is the draft numbered one more.
 */
export function draftAfter(currentVersionId: string | null, approved: ApprovedVersion | undefined): number | null {
  if (!approved || !currentVersionId || currentVersionId === approved.id) return null;
  return approved.number + 1;
}

/* ---------- the Library page ---------- */

export type LibraryRow = {
  id: string;
  title: string;
  kind: ResourceKind;
  courseId: string;
  chapterTitles: string[];
  approved: ApprovedVersion;
  /** The approval date as shown ("Nov 24"), formatted once on the server so the browser shows the same text. */
  approvedOn: string;
  draft: number | null;
  published: boolean;
};
export type LibraryCourse = { id: string; title: string };

export const KIND_FILTERS = [
  { id: "all", label: "All" },
  { id: "notes", label: "Notes" },
  { id: "presentation", label: "Slides" },
  { id: "quiz", label: "Quizzes" },
  { id: "test", label: "Unit tests" },
  { id: "exam", label: "Exams" },
] as const satisfies readonly { id: "all" | ResourceKind; label: string }[];
export type KindFilter = (typeof KIND_FILTERS)[number]["id"];
export const isKindFilter = (v: unknown): v is KindFilter => KIND_FILTERS.some((k) => k.id === v);

/** `course` is a course id or "all". */
export type LibraryFilter = { kind: KindFilter; course: string; q: string };
export const NO_FILTER: LibraryFilter = { kind: "all", course: "all", q: "" };

/** Reads the filters from the address (`?kind=quiz&course=…&q=…`); anything unknown falls back to all. */
export function filterFromParams(sp: Record<string, string | string[] | undefined>, courses: LibraryCourse[]): LibraryFilter {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const kind = one(sp.kind);
  const course = one(sp.course);
  return {
    kind: isKindFilter(kind) ? kind : "all",
    course: courses.some((c) => c.id === course) ? course : "all",
    q: one(sp.q).slice(0, 100),
  };
}

/** The filters as an address query, without the defaults. */
export function filterToQuery(f: LibraryFilter): string {
  const p = new URLSearchParams();
  if (f.kind !== "all") p.set("kind", f.kind);
  if (f.course !== "all") p.set("course", f.course);
  if (f.q.trim()) p.set("q", f.q.trim());
  return p.toString();
}

const inCourseAndSearch = (r: LibraryRow, f: LibraryFilter) => (f.course === "all" || r.courseId === f.course) && (!f.q.trim() || matchesQuery(r.title, f.q));

export function filterRows(rows: LibraryRow[], f: LibraryFilter): LibraryRow[] {
  return rows.filter((r) => (f.kind === "all" || r.kind === f.kind) && inCourseAndSearch(r, f));
}

/** How many rows each kind chip would show, within the chosen course and search. */
export function kindCounts(rows: LibraryRow[], f: LibraryFilter): Record<KindFilter, number> {
  const out = Object.fromEntries(KIND_FILTERS.map((k) => [k.id, 0])) as Record<KindFilter, number>;
  for (const r of rows) {
    if (!inCourseAndSearch(r, f)) continue;
    out.all++;
    out[r.kind]++;
  }
  return out;
}

/** One group per course, in the teacher's course order; newest approvals first inside each. */
export function groupByCourse(rows: LibraryRow[], courses: LibraryCourse[]): { course: LibraryCourse; rows: LibraryRow[] }[] {
  const byCourse = new Map<string, LibraryRow[]>();
  for (const r of rows) (byCourse.get(r.courseId) ?? byCourse.set(r.courseId, []).get(r.courseId)!).push(r);
  return courses
    .filter((c) => byCourse.has(c.id))
    .map((course) => ({ course, rows: [...byCourse.get(course.id)!].sort((a, b) => b.approved.at.localeCompare(a.approved.at)) }));
}

/* ---------- a course's Materials card ---------- */

/** Approved materials first (newest approval first), then drafts never approved, in their own order. */
export function splitMaterials<T extends { approved: { version: number; at: string } | null }>(rows: T[]): { done: T[]; inReview: T[] } {
  const done = rows.filter((r) => r.approved).sort((a, b) => b.approved!.at.localeCompare(a.approved!.at));
  return { done, inReview: rows.filter((r) => !r.approved) };
}

/* ---------- a material's history ---------- */

export type Channel = "page" | "classroom" | "print";
export type PublicationMeta = { versionId: string; channel: Channel; at: string };
export type HistoryEntry = { versionId: string; number: number; approvedAt: string | null; posts: { channel: Channel; at: string }[] };

export const CHANNEL_LABEL: Record<Channel, string> = { classroom: "Posted to Google Classroom", print: "Printed", page: "On the course page" };

/**
 * Every approved version of one material, newest first, each with where it went
 * (the latest time per place). The current version comes first when it is a draft.
 */
export function historyOf(versions: VersionMeta[], publications: PublicationMeta[], currentVersionId: string | null): HistoryEntry[] {
  const posts = new Map<string, Map<Channel, string>>();
  for (const p of publications) {
    const byChannel = posts.get(p.versionId) ?? posts.set(p.versionId, new Map()).get(p.versionId)!;
    const seen = byChannel.get(p.channel);
    if (!seen || p.at > seen) byChannel.set(p.channel, p.at);
  }
  return versions
    .filter((v) => v.approvedAt || v.id === currentVersionId)
    .sort((a, b) => b.number - a.number)
    .map((v) => ({
      versionId: v.id,
      number: v.number,
      approvedAt: v.approvedAt,
      posts: [...(posts.get(v.id) ?? new Map<Channel, string>()).entries()].map(([channel, at]) => ({ channel, at })).sort((a, b) => b.at.localeCompare(a.at)),
    }));
}

/* ---------- reading a material ---------- */

export type TextBlock = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

const SPEAKER_NOTES = /^speaker notes:\s*/i;

/**
 * A section's text as paragraphs and bullet lists ("- " lines), as the student copy
 * prints it (lib/resources/render.ts). With `splitNotes`, a "Speaker notes:" line
 * and everything after it come back apart, for the teacher copy of slides.
 */
export function textBlocks(body: string, splitNotes = false): { blocks: TextBlock[]; speakerNotes: string } {
  const all = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const at = splitNotes ? all.findIndex((l) => SPEAKER_NOTES.test(l)) : -1;
  const lines = at >= 0 ? all.slice(0, at) : all;
  const notes = at >= 0 ? [all[at].replace(SPEAKER_NOTES, ""), ...all.slice(at + 1)].filter(Boolean).join("\n") : "";
  const blocks: TextBlock[] = [];
  for (const l of lines) {
    if (l.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "ul") last.items.push(l.slice(2));
      else blocks.push({ kind: "ul", items: [l.slice(2)] });
    } else blocks.push({ kind: "p", text: l });
  }
  return { blocks, speakerNotes: notes };
}

/** Question numbers as printed: straight through, or restarting in each section when the template says so. */
export function questionNumbers(sections: Section[], perSection: boolean): Map<string, number> {
  const out = new Map<string, number>();
  let n = 0;
  for (const s of sections) {
    if (perSection) n = 0;
    for (const i of s.items) out.set(i.id, ++n);
  }
  return out;
}

/** "Part A: " for the first question section of a quiz, test or exam, as the student copy prints it. */
export function partPrefix(sections: Section[], section: Section, isAssessment: boolean): string {
  if (!isAssessment || section.kind !== "questions" || HAS_PART.test(section.title)) return "";
  const index = sections.filter((s) => s.kind === "questions").indexOf(section);
  return index >= 0 ? `Part ${String.fromCharCode(65 + index)}: ` : "";
}

/* ---------- dates, in Saskatchewan time so the server and the browser agree ---------- */

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { day: "numeric", month: "short", timeZone: "America/Regina" }).format(d);
}

export function longDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Regina" }).format(d);
}

/* ---------- deleting a material ---------- */

/**
 * The bank questions to retire when a material is deleted: those its versions used
 * that no other material still uses. Retired questions stay in the database (and on
 * any template that pins them) but aren't offered for new drafts or Live.
 */
export function questionsToRetire(usedByDeleted: string[], stillUsed: string[]): string[] {
  const keep = new Set(stillUsed);
  return [...new Set(usedByDeleted)].filter((id) => !keep.has(id));
}
