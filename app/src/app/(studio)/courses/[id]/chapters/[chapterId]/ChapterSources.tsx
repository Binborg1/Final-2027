"use client";

import { CircleAlert, ExternalLink, FileText, FileUp, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CountPill, Tag } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/Misc";
import { browserClient } from "@/lib/db/browser";
import { addSource, deleteSource, sourceLink } from "@/lib/sources/actions";
import { ACCEPTED_TYPES, kindForFile, MAX_SOURCE_BYTES, MAX_SOURCE_TEXT, SOURCE_BUCKET, sourceKindLabel, sourcePath, type SourceKind } from "@/lib/sources/model";

export type SourceItem = { id: string; title: string; kind: string; hasText: boolean; createdAt: string };

async function textOf(file: File): Promise<string> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const { extractPdf } = await import("@/lib/pdf/extract");
    const doc = await extractPdf(file);
    return doc.pages.map((p) => p.lines.map((l) => l.text).join("\n")).join("\n\n");
  }
  return file.text();
}

/**
 * P2 Sources: notes, PDFs and past exams attached to the chapter. The file goes to
 * the teacher's own folder in Storage; its text is read once, here, and kept so
 * Make can use it as "my notes".
 */
export function ChapterSources({ teacherId, chapterId, sources }: { teacherId: string; chapterId: string; sources: SourceItem[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<SourceKind | "auto">("auto");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SourceItem | null>(null);
  const [pending, start] = useTransition();

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_SOURCE_BYTES) return setError("That file is over 20 MB. Choose a smaller one.");
    if (!/\.(pdf|txt|md)$/i.test(file.name)) return setError("Attach a PDF or a text file.");
    setBusy(`Reading ${file.name}…`);
    let text = "";
    try {
      text = (await textOf(file)).slice(0, MAX_SOURCE_TEXT);
    } catch {
      setBusy(null);
      return setError("That file couldn’t be read. Try another PDF.");
    }
    setBusy(`Uploading ${file.name}…`);
    const path = sourcePath(teacherId, chapterId, file.name, crypto.randomUUID());
    const contentType = /\.pdf$/i.test(file.name) ? "application/pdf" : /\.md$/i.test(file.name) ? "text/markdown" : "text/plain";
    const up = await browserClient().storage.from(SOURCE_BUCKET).upload(path, file, { contentType, upsert: false });
    if (up.error) {
      setBusy(null);
      return setError("The upload didn’t work. Check your connection and try again.");
    }
    const res = await addSource({ chapterId, kind: kind === "auto" ? kindForFile(file.name) : kind, title: file.name.slice(0, 300), filePath: path, text });
    setBusy(null);
    if (!res.ok) return setError(res.message);
    if (!text.trim()) setError("Added. Funza found no text in it (scanned pages aren’t read yet), so Make can’t use it as notes.");
    router.refresh();
  }

  async function open(id: string) {
    const res = await sourceLink(id);
    if (res.ok) window.open(res.url, "_blank", "noopener");
    else setError(res.message);
  }

  return (
    <Card className="flex flex-col gap-3 px-6 pt-5 pb-5" aria-labelledby="sources-title">
      <CardHeader id="sources-title" title="Sources" after={sources.length > 0 ? <CountPill>{sources.length}</CountPill> : null} />
      {sources.length === 0 ? (
        <EmptyState icon={FileUp} title="No sources yet">
          Attach notes, PDFs or past exams. Make can use their text as your notes.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 rounded-tile border border-white/80 bg-tile py-2 pr-2 pl-3.5">
              <FileText aria-hidden size={18} className="shrink-0 text-ink-2" />
              <button type="button" onClick={() => void open(s.id)} className="flex min-w-0 flex-1 flex-col text-left hover:underline">
                <span className="truncate text-body font-semibold">{s.title}</span>
                <span className="text-meta text-ink-2">{s.hasText ? "Text ready for Make" : "No text found"}</span>
              </button>
              <Tag>{sourceKindLabel(s.kind)}</Tag>
              <ExternalLink aria-hidden size={14} className="shrink-0 text-ink-2" />
              <button type="button" aria-label={`Delete ${s.title}`} title={`Delete ${s.title}`} onClick={() => setDeleting(s)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-white hover:text-ink pointer-coarse:size-11">
                <Trash2 aria-hidden size={16} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="flex items-start gap-2 text-body font-medium text-red-ink">
          <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <label htmlFor="source-kind" className="sr-only">
          What it is
        </label>
        <select id="source-kind" value={kind} onChange={(e) => setKind(e.target.value as SourceKind | "auto")} className="h-11 rounded-full border border-line-control bg-field px-3 text-body" disabled={!!busy}>
          <option value="auto">Notes or PDF</option>
          <option value="past_exam">Past exam</option>
        </select>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
        <Button variant="secondary" icon={busy ? LoaderCircle : FileUp} disabled={!!busy} onClick={() => fileRef.current?.click()} className={busy ? "[&_svg]:animate-spin" : undefined}>
          {busy ?? "Add a source"}
        </Button>
      </div>

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        labelledBy="delete-source-title"
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="The file and its text are deleted. Materials already made from it are kept."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              icon={Trash2}
              loading={pending}
              onClick={() =>
                deleting &&
                start(async () => {
                  const res = await deleteSource(deleting.id);
                  setDeleting(null);
                  if (!res.ok) return setError(res.message);
                  router.refresh();
                })
              }
            >
              Delete source
            </Button>
          </>
        }
      />
    </Card>
  );
}
