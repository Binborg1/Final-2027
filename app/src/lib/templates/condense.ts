import { LIMITS } from "@/lib/templates/model";

/**
 * An example file as text for "Read the format", extracted in the teacher's browser
 * (PDF or plain text; nothing is uploaded). A long exam is condensed to the lines
 * that show its format: headings (larger type), section, mark, time and
 * instruction lines, the start of each question, and short option lines.
 */

export type Line = { text: string; size: number };

const FORMAT_WORDS = /\b(section|part|question|questions|marks?|points?|minutes?|hours?|time|instructions?|answer|answers|total|name|date|show your work|calculator|formula|booklet|page)\b/i;
const QUESTION_START = /^\s*(?:\(?\d{1,3}[.)]|q\.?\s?\d{1,3}\b|question\s+\d{1,3})/i;
const OPTION = /^\s*\(?[a-eA-E][.)]\s/;

export function condenseLines(lines: Line[], max: number = LIMITS.exampleText): string {
  const clean = lines.map((l) => ({ text: l.text.replace(/\s+/g, " ").trim(), size: l.size })).filter((l) => l.text);
  const full = clean.map((l) => l.text).join("\n");
  if (full.length <= max) return full;

  const sizes = clean.map((l) => l.size).filter((s) => s > 0).sort((a, b) => a - b);
  const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  const out: string[] = [];
  let length = 0;
  let skipped = 0;
  for (const l of clean) {
    let keep: string | null = null;
    if (median > 0 && l.size >= median * 1.15) keep = l.text;
    else if (QUESTION_START.test(l.text)) keep = l.text.slice(0, 120);
    else if (OPTION.test(l.text)) keep = l.text.slice(0, 60);
    else if (FORMAT_WORDS.test(l.text)) keep = l.text.slice(0, 200);
    if (keep === null) {
      skipped++;
      continue;
    }
    if (skipped > 0) {
      out.push(`[${skipped} line${skipped === 1 ? "" : "s"} left out]`);
      skipped = 0;
    }
    if (length + keep.length + 1 > max) break;
    out.push(keep);
    length += keep.length + 1;
  }
  return out.join("\n").slice(0, max);
}

/** The text of one example file, or a sentence saying why it can't be read. */
export async function exampleText(file: File): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const name = file.name.toLowerCase();
  try {
    if (file.type === "application/pdf" || name.endsWith(".pdf")) {
      const { extractPdf } = await import("@/lib/pdf/extract");
      const doc = await extractPdf(file);
      const text = condenseLines(doc.pages.flatMap((p) => p.lines));
      return text.trim() ? { ok: true, text } : { ok: false, message: `Funza couldn’t find any text in ${file.name}. Scanned pages aren’t read yet.` };
    }
    if (file.type.startsWith("text/") || /\.(txt|md)$/.test(name)) {
      const text = condenseLines((await file.text()).split(/\r?\n/).map((t) => ({ text: t, size: 0 })));
      return text.trim() ? { ok: true, text } : { ok: false, message: `${file.name} is empty.` };
    }
    if (/\.(docx?|pptx?)$/.test(name)) return { ok: false, message: `Word and PowerPoint files come in a later update. Save ${file.name} as a PDF and add that.` };
    return { ok: false, message: `${file.name} isn’t a PDF or text file.` };
  } catch {
    return { ok: false, message: `${file.name} couldn’t be read. Try another PDF.` };
  }
}
