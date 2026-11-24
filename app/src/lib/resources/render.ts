import { isQuestionKind } from "@/lib/resources/kinds";
import type { ResourceKind, Section } from "@/lib/resources/types";
import type { TemplateStyle } from "@/lib/templates/model";

/**
 * The student copy as simple HTML, which Google Drive converts into a Google Doc
 * for Classroom. Answers, keys, worked solutions and rubrics are never included.
 * Every piece of text is escaped.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("- ") ? `<li>${esc(l.slice(2))}</li>` : `<p>${esc(l)}</p>`))
    .join("")
    .replace(/(<li>.*?<\/li>)+/g, (m) => `<ul>${m}</ul>`);

/**
 * `style` comes from the teacher's template, when the material was made from one:
 * numbering straight through or restarting in each section, marks in brackets, in
 * the margin or not shown, and an optional cover page. Without it, Funza's own layout.
 */
export type StudentDoc = { kind: ResourceKind; title: string; courseName: string; outcomeCodes: string[]; duration: number | null; school: string; sections: Section[]; style?: TemplateStyle | null };

/** A section title that already says which part it is ("Part B: …", "Section 2 …") gets no letter in front. */
export const HAS_PART = /^\s*(part|section)\s+[A-Z0-9]+\b/i;

/** The order of the right-hand column of a matching question, so it never lines up with the left. */
export const matchOrder = (count: number) => Array.from({ length: count }, (_, i) => (i + 1) % Math.max(count, 1));

/** Lines left for a written answer. */
export const answerLines = (type: "short" | "long", marks: number) => (type === "long" ? 8 : Math.min(2 + marks, 6));

export function studentHtml(d: StudentDoc): string {
  const q = isQuestionKind(d.kind);
  const marks = d.sections.reduce((n, s) => n + s.items.reduce((m, i) => m + i.marks, 0), 0);
  const parts = d.sections.filter((s) => s.kind === "questions");
  const style = d.style ?? null;
  const cover = q && style?.cover ? style.cover : null;
  const markText = (m: number) =>
    style?.marksShown === "none"
      ? ""
      : style?.marksShown === "brackets"
        ? ` (${m} mark${m === 1 ? "" : "s"})`
        : style?.marksShown === "margin"
          ? ` <span style="float:right;color:#5d627a">[${m}]</span>`
          : ` <span style="color:#5d627a">[${m}]</span>`;
  let n = 0;
  const body: string[] = [];
  const header = `<p style="color:#5d627a;font-size:9pt">${esc(d.courseName)}${d.outcomeCodes.length ? ` · ${esc(d.outcomeCodes.join(", "))}` : ""}${d.school ? ` · ${esc(d.school)}` : ""}</p>`;
  const nameLine = `<p>Name: ____________________ &nbsp; Date: ____________ &nbsp; Class: ____________</p>`;
  const totals = `<p><b>Total:</b> ${marks} marks${d.duration ? ` &nbsp; <b>Time:</b> ${d.duration} minutes` : ""}</p>`;
  if (cover) {
    // The template's cover page, then the questions on a new page.
    body.push(header, `<h1>${esc(cover.title || d.title)}</h1>`, nameLine, totals);
    if (cover.instructions.length > 0) body.push(`<h2>Instructions</h2><ul>${cover.instructions.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`);
    body.push(`<p style="page-break-after:always;break-after:page"></p>`);
    body.push(`<h1>${esc(d.title)}</h1>`);
  } else {
    body.push(header, `<h1>${esc(d.title)}</h1>`);
    if (q) body.push(nameLine, totals);
  }
  for (const s of d.sections) {
    if (s.kind !== "questions") {
      body.push(`<h2>${esc(s.title)}</h2>`);
      body.push(lines(s.body));
      continue;
    }
    const letter = q && !HAS_PART.test(s.title) ? `Part ${String.fromCharCode(65 + parts.indexOf(s))}: ` : "";
    if (style?.numbering === "per-section") n = 0;
    const sub = s.items.reduce((m, i) => m + i.marks, 0);
    body.push(`<h2>${esc(letter + s.title)}${q ? ` (${sub} marks)` : ""}</h2>`);
    if (s.body) body.push(`<p><i>${esc(s.body)}</i></p>`);
    for (const it of s.items) {
      n++;
      body.push(`<p><b>${n}.</b> ${esc(it.prompt)}${markText(it.marks)}</p>`);
      if (it.type === "mcq") body.push(`<p style="margin-left:24px">${it.options.map((o) => `${esc(o.id)}) ${esc(o.text)}`).join("<br>")}</p>`);
      if (it.type === "tf") body.push(`<p style="margin-left:24px">True &nbsp;&nbsp;&nbsp; False</p>`);
      if (it.type === "match") {
        const order = matchOrder(it.pairs.length);
        body.push(
          `<table style="margin-left:24px;border-collapse:collapse">${it.pairs
            .map((p, i) => `<tr><td style="padding:2px 24px 2px 0">${i + 1}. ${esc(p.left)}</td><td>${String.fromCharCode(65 + i)}. ${esc(it.pairs[order[i]]?.right ?? "")}</td></tr>`)
            .join("")}</table>`,
        );
      }
      if (it.type === "calc") body.push(`<p style="margin-left:24px">Answer: ______________________</p>`);
      if (it.type === "short" || it.type === "long") body.push(`<p style="margin-left:24px">${Array.from({ length: answerLines(it.type, it.marks) }, () => "_".repeat(70)).join("<br>")}</p>`);
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title)}</title></head><body style="font-family:Arial,sans-serif;font-size:11pt">${body.join("")}</body></html>`;
}

/** The text for the Classroom post itself. */
export function postDescription(kind: ResourceKind, title: string, instructions: string) {
  const fallback = isQuestionKind(kind) ? `Complete “${title}”. Show your work for calculations.` : `Read “${title}” before our next class.`;
  return (instructions.trim() || fallback).slice(0, 2000);
}
