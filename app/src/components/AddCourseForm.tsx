"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { importPdfs } from "@/lib/lessons/import";
import { formatBytes } from "@/lib/progress";
import { addCourse, toCourseFiles } from "@/lib/storage";

export function isPdfFile(file: { name: string; type: string }) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

const fieldClass =
  "mt-1.5 w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm shadow-[inset_0_1px_2px_rgba(90,60,30,0.06)] outline-none transition-shadow focus:border-coral focus:ring-4 focus:ring-coral/20";

export function AddCourseForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function onFilesChosen(list: FileList | null) {
    if (!list) return;
    const chosen = Array.from(list).filter(isPdfFile);
    setError(chosen.length !== list.length ? "Only PDF files are attached; other files were skipped." : null);
    setFiles((prev) => [...prev, ...chosen]);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError("Give the course a name.");
      return;
    }
    const course = addCourse(name, toCourseFiles(files));
    if (files.length > 0) {
      setBusy("Preparing lessons...");
      await importPdfs(course.id, files, 0, setBusy);
    }
    router.push(`/courses/${course.id}`);
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mt-6 rounded-3xl border border-line bg-white p-6 shadow-card md:p-8"
    >
      <h2 className="text-xl font-extrabold">New course</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-bold text-charcoal">Course name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Computer Networks"
            disabled={busy !== null}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-bold text-charcoal">Course PDFs</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={busy !== null}
            onChange={(e) => onFilesChosen(e.target.files)}
            className="mt-1.5 block w-full text-sm text-smoke file:mr-3 file:rounded-full file:border file:border-line file:bg-sand file:px-4 file:py-2 file:text-sm file:font-bold file:text-charcoal file:transition-colors hover:file:bg-peach"
          />
          <span className="mt-1.5 block text-xs text-smoke">
            Lecture slides, chapters or notes with selectable text. Lessons are built from them on this device; the
            files are never uploaded.
          </span>
        </label>
      </div>

      {files.length > 0 && (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line text-sm">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 bg-white px-4 py-2.5">
              <span className="truncate font-semibold">{file.name}</span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-smoke">
                {formatBytes(file.size)}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  className="rounded-full px-2 py-0.5 font-bold text-smoke transition-colors hover:bg-sand hover:text-charcoal disabled:opacity-50"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-coral-dark">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy !== null}>
          {busy ? <Spinner /> : null}
          {busy ? "Creating course" : "Create course"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy !== null}>
          Cancel
        </Button>
        {busy && <span className="text-sm font-semibold text-smoke">{busy}</span>}
      </div>
    </motion.form>
  );
}
