import { isQuestionKind } from "@/lib/resources/kinds";
import type { ResourceKind, Section } from "@/lib/resources/types";

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

export type StudentDoc = { kind: ResourceKind; title: string; courseName: string; outcomeCodes: string[]; duration: number | null; school: string; sections: Section[] };

export function studentHtml(d: StudentDoc): string {
  const q = isQuestionKind(d.kind);
  const marks = d.sections.reduce((n, s) => n + s.items.reduce((m, i) => m + i.marks, 0), 0);
  const parts = d.sections.filter((s) => s.kind === "questions");
  let n = 0;
  const body: string[] = [];
  body.push(`<p style="color:#5d627a;font-size:9pt">${esc(d.courseName)}${d.outcomeCodes.length ? ` · ${esc(d.outcomeCodes.join(", "))}` : ""}${d.school ? ` · ${esc(d.school)}` : ""}</p>`);
  body.push(`<h1>${esc(d.title)}</h1>`);
  if (q) {
    body.push(`<p>Name: ____________________ &nbsp; Date: ____________ &nbsp; Class: ____________</p>`);
    body.push(`<p><b>Total:</b> ${marks} marks${d.duration ? ` &nbsp; <b>Time:</b> ${d.duration} minutes` : ""}</p>`);
  }
  for (const s of d.sections) {
    if (s.kind !== "questions") {
      body.push(`<h2>${esc(s.title)}</h2>`);
      body.push(lines(s.body));
      continue;
    }
    const letter = q ? `Part ${String.fromCharCode(65 + parts.indexOf(s))}: ` : "";
    const sub = s.items.reduce((m, i) => m + i.marks, 0);
    body.push(`<h2>${esc(letter + s.title)}${q ? ` (${sub} marks)` : ""}</h2>`);
    if (s.body) body.push(`<p><i>${esc(s.body)}</i></p>`);
    for (const it of s.items) {
      n++;
      body.push(`<p><b>${n}.</b> ${esc(it.prompt)} <span style="color:#5d627a">[${it.marks}]</span></p>`);
      if (it.type === "mcq") body.push(`<p style="margin-left:24px">${it.options.map((o) => `${esc(o.id)}) ${esc(o.text)}`).join("<br>")}</p>`);
      if (it.type === "tf") body.push(`<p style="margin-left:24px">True &nbsp;&nbsp;&nbsp; False</p>`);
      if (it.type === "match") {
        const order = it.pairs.map((_, i) => (i + 1) % Math.max(it.pairs.length, 1));
        body.push(
          `<table style="margin-left:24px;border-collapse:collapse">${it.pairs
            .map((p, i) => `<tr><td style="padding:2px 24px 2px 0">${i + 1}. ${esc(p.left)}</td><td>${String.fromCharCode(65 + i)}. ${esc(it.pairs[order[i]]?.right ?? "")}</td></tr>`)
            .join("")}</table>`,
        );
      }
      if (it.type === "calc") body.push(`<p style="margin-left:24px">Answer: ______________________</p>`);
      if (it.type === "short" || it.type === "long") body.push(`<p style="margin-left:24px">${Array.from({ length: it.type === "long" ? 8 : Math.min(2 + it.marks, 6) }, () => "_".repeat(70)).join("<br>")}</p>`);
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title)}</title></head><body style="font-family:Arial,sans-serif;font-size:11pt">${body.join("")}</body></html>`;
}

/** The text for the Classroom post itself. */
export function postDescription(kind: ResourceKind, title: string, instructions: string) {
  const fallback = isQuestionKind(kind) ? `Complete “${title}”. Show your work for calculations.` : `Read “${title}” before our next class.`;
  return (instructions.trim() || fallback).slice(0, 2000);
}
