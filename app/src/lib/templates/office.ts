import { unzipSync, strFromU8 } from "fflate";
import type { Line } from "@/lib/templates/condense";

/**
 * Word (.docx) and PowerPoint (.pptx) files as lines of text, read in the teacher's
 * browser for "Read the format". Both are zip files of XML; only the text and a
 * little structure are kept: headings and slide titles come out as larger lines,
 * list items and bullets start with "- ", and each slide starts with "Slide N".
 * Older .doc and .ppt files aren't zip files and aren't read.
 */

const entity = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

/** The text of every run (<w:t> or <a:t>) in a piece of XML, in order. */
function runs(xml: string, tag: "w:t" | "a:t"): string {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>|<${tag === "w:t" ? "w:tab" : "a:br"}\\s*/>`, "g");
  for (const m of xml.matchAll(re)) out.push(m[1] !== undefined ? entity(m[1]) : " ");
  return out.join("").replace(/\s+/g, " ").trim();
}

export const HEADING_SIZE = 18;
export const BODY_SIZE = 11;

/** A Word document's paragraphs, from word/document.xml. */
export function docxLines(documentXml: string): Line[] {
  const lines: Line[] = [];
  for (const m of documentXml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)) {
    const p = m[0];
    const text = runs(p, "w:t");
    if (!text) continue;
    const style = /<w:pStyle\s+w:val="([^"]+)"/.exec(p)?.[1] ?? "";
    const heading = /^(heading|title|subtitle)/i.test(style);
    const listItem = /<w:numPr>/.test(p) || /^list/i.test(style);
    lines.push({ text: listItem && !heading ? `- ${text}` : text, size: heading ? HEADING_SIZE : BODY_SIZE });
  }
  return lines;
}

/** One slide's lines, from ppt/slides/slideN.xml: its title larger, the rest as bullets. */
export function slideLines(n: number, slideXml: string, hasNotes: boolean): Line[] {
  const lines: Line[] = [{ text: `Slide ${n}`, size: HEADING_SIZE }];
  for (const sp of slideXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
    const shape = sp[0];
    const title = /<p:ph[^>]*type="(?:title|ctrTitle)"/.test(shape);
    for (const para of shape.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)) {
      const text = runs(para[0], "a:t");
      if (!text) continue;
      lines.push(title ? { text, size: HEADING_SIZE - 2 } : { text: `- ${text}`, size: BODY_SIZE });
    }
  }
  if (hasNotes) lines.push({ text: "(This slide has speaker notes.)", size: BODY_SIZE });
  return lines;
}

/** The lines of a .docx or .pptx file, or null when the file isn't one. */
export function officeLines(bytes: Uint8Array, name: string): Line[] | null {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" || /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(f.name) });
  } catch {
    return null;
  }
  if (/\.docx$/i.test(name)) {
    const doc = files["word/document.xml"];
    return doc ? docxLines(strFromU8(doc)) : null;
  }
  if (/\.pptx$/i.test(name)) {
    const slides = Object.keys(files)
      .map((f) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(f))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => Number(m[1]))
      .sort((a, b) => a - b);
    if (slides.length === 0) return null;
    return slides.flatMap((n, i) => slideLines(i + 1, strFromU8(files[`ppt/slides/slide${n}.xml`]), !!files[`ppt/notesSlides/notesSlide${n}.xml`]));
  }
  return null;
}
