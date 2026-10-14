/**
 * Reads the text of a PDF in the browser with pdf.js.
 * Output keeps one entry per visual line with its font size, which the lesson
 * generator uses to tell headings from body text.
 */
export type ExtractedLine = { text: string; size: number };
export type ExtractedPage = { page: number; lines: ExtractedLine[] };
export type ExtractedDoc = { fileName: string; pages: ExtractedPage[]; pageCount: number };

/** Keeps extraction quick on long textbooks. */
const MAX_PAGES = 80;

type TextItemLike = { str: string; transform: number[]; width?: number; hasEOL?: boolean };

export async function extractPdf(file: File): Promise<ExtractedDoc> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const pages: ExtractedPage[] = [];
  try {
    const doc = await task.promise;
    const last = Math.min(doc.numPages, MAX_PAGES);
    for (let n = 1; n <= last; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push({ page: n, lines: toLines(content.items) });
      page.cleanup();
    }
    return { fileName: file.name, pages, pageCount: doc.numPages };
  } finally {
    await task.destroy();
  }
}

function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === "object" && item !== null && "str" in item && "transform" in item;
}

export function toLines(items: unknown[]): ExtractedLine[] {
  const lines: ExtractedLine[] = [];
  let parts: string[] = [];
  let size = 0;
  let y = Number.NaN;
  let endX = Number.NaN;

  const flush = () => {
    const text = parts.join("").replace(/\s+/g, " ").trim();
    if (text) lines.push({ text, size });
    parts = [];
    size = 0;
    y = Number.NaN;
    endX = Number.NaN;
  };

  for (const raw of items) {
    if (!isTextItem(raw)) continue;
    const [a, b, , d, x, itemY] = raw.transform;
    const itemSize = Math.abs(d ?? 0) || Math.hypot(a ?? 0, b ?? 0) || 10;
    const sameLine = Number.isFinite(y) && Math.abs(y - itemY) <= Math.max(2, itemSize * 0.5);
    if (!sameLine && parts.length > 0) flush();
    if (parts.length > 0 && Number.isFinite(endX) && x - endX > itemSize * 0.15) {
      const prev = parts[parts.length - 1];
      if (prev && !/\s$/.test(prev) && !/^\s/.test(raw.str)) parts.push(" ");
    }
    parts.push(raw.str);
    size = Math.max(size, itemSize);
    y = itemY;
    endX = x + (raw.width ?? 0);
    if (raw.hasEOL) flush();
  }
  flush();
  return lines;
}
