/**
 * Chapter sources: notes, PDFs and past exams a teacher attaches to a chapter.
 * The file goes to the private "sources" bucket under the teacher's own folder;
 * its text is extracted once, in the browser, and kept with the row.
 */

export const SOURCE_BUCKET = "sources";
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_SOURCE_TEXT = 200_000;
export const SOURCE_KINDS = [
  { kind: "notes", label: "Notes" },
  { kind: "pdf", label: "PDF" },
  { kind: "past_exam", label: "Past exam" },
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number]["kind"];

export const sourceKindLabel = (kind: string) => SOURCE_KINDS.find((k) => k.kind === kind)?.label ?? kind;

/** "Unit 3 notes (final).pdf" → "Unit-3-notes-final.pdf": a safe object name. */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  const base = (dot > 0 ? name.slice(0, dot) : name).normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "file";
  return ext ? `${base}.${ext}` : base;
}

/** Where a source file lives: "<teacher id>/<chapter id>/<random>-<name>". */
export function sourcePath(teacherId: string, chapterId: string, fileName: string, random: string): string {
  return `${teacherId}/${chapterId}/${random}-${safeFileName(fileName)}`;
}

/** Is this a path in the teacher's own folder, for this chapter? */
export function ownsPath(path: string, teacherId: string, chapterId: string): boolean {
  return path.startsWith(`${teacherId}/${chapterId}/`) && /^[0-9a-f-]+\/[0-9a-f-]+\/[A-Za-z0-9-]+-[\w.-]{1,100}$/.test(path) && !path.includes("..");
}

export function kindForFile(name: string): SourceKind {
  return /\.pdf$/i.test(name) ? "pdf" : "notes";
}

export const ACCEPTED_TYPES = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown";
