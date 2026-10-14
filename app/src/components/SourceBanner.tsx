import type { LessonSource } from "@/lib/types";

/** Tells the student where the lessons on this screen come from. */
export function SourceBanner({ source }: { source: LessonSource | "ai" }) {
  if (source === "ai") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-lavender bg-lavender/60 px-4 py-3 text-sm text-charcoal">
        <span className="rounded-full bg-lavender-dark px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-white">
          ADAPTIVE AI
        </span>
        <span>
          Funza teaches from your PDF and may add explanations from general knowledge; those are marked &ldquo;Beyond
          the PDF&rdquo;. The text of your notes was sent to the configured AI provider when you planned these lessons.
        </span>
      </div>
    );
  }
  if (source === "demo") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-peach bg-peach/60 px-4 py-3 text-sm text-charcoal">
        <span className="rounded-full bg-coral px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-white">
          SAMPLE
        </span>
        <span>
          These lessons are built in, not from a PDF. Add your own course to learn from your files. You can
          remove this sample course at any time.
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky bg-sky/60 px-4 py-3 text-sm text-charcoal">
      <span className="rounded-full bg-sky-dark px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-white">
        FROM YOUR PDFS
      </span>
      <span>
        Lessons were generated on this device from your PDFs by simple rules, not by an AI yet. Questions can
        be rough; every explanation is quoted from the file.
      </span>
    </div>
  );
}
