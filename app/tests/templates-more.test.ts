import assert from "node:assert/strict";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { blankDraft } from "@/lib/resources/assemble";
import { studentHtml } from "@/lib/resources/render";
import { defaultBrief } from "@/lib/resources/kinds";
import type { Draft } from "@/lib/resources/types";
import { applyTemplate } from "@/lib/templates/apply";
import { formatFromBrief, formatFromDraft, layoutOfSections, materialText, structureChanged } from "@/lib/templates/from";
import { formatLine, isQuestionFormat, sanitizeFormat, type QuestionFormat, type TemplateFormat } from "@/lib/templates/model";
import { docxLines, HEADING_SIZE, officeLines, slideLines } from "@/lib/templates/office";

/*
 * Templates, more ways in: Word and PowerPoint files read in the browser, a Funza
 * material's exact structure, and Make's own settings saved as a template.
 */

const FM2 = "sk-63-110477";

/* ---------- Word and PowerPoint ---------- */

const DOCX = `<w:document><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Part A: Multiple choice</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Choose the best answer. </w:t></w:r><w:r><w:t>(20 marks)</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Which &amp; why?</w:t></w:r></w:p>
<w:p><w:r><w:t></w:t></w:r></w:p>
</w:body></w:document>`;

const SLIDE = `<p:sld><p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Learning goals</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:txBody><a:p><a:r><a:t>First point</a:t></a:r></a:p><a:p><a:r><a:t>Second</a:t></a:r><a:br/><a:r><a:t>point</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

test("a Word file's headings come out larger, list items as bullets, entities decoded, empty paragraphs dropped", () => {
  assert.deepEqual(docxLines(DOCX), [
    { text: "Part A: Multiple choice", size: HEADING_SIZE },
    { text: "Choose the best answer. (20 marks)", size: 11 },
    { text: "- Which & why?", size: 11 },
  ]);
});

test("each slide starts with its number, the title larger, the rest as bullets, and says when it has speaker notes", () => {
  assert.deepEqual(slideLines(2, SLIDE, true), [
    { text: "Slide 2", size: HEADING_SIZE },
    { text: "Learning goals", size: HEADING_SIZE - 2 },
    { text: "- First point", size: 11 },
    { text: "- Second point", size: 11 },
    { text: "(This slide has speaker notes.)", size: 11 },
  ]);
});

test("a .docx or .pptx file is unzipped in the browser; slides are read in their number order", () => {
  const docx = zipSync({ "word/document.xml": strToU8(DOCX), "[Content_Types].xml": strToU8("<Types/>") });
  assert.equal(officeLines(docx, "exam.docx")?.[0].text, "Part A: Multiple choice");
  const pptx = zipSync({ "ppt/slides/slide10.xml": strToU8(SLIDE.replace("Learning goals", "Last")), "ppt/slides/slide2.xml": strToU8(SLIDE), "ppt/notesSlides/notesSlide2.xml": strToU8("<n/>") });
  const lines = officeLines(pptx, "deck.pptx") ?? [];
  assert.deepEqual(lines.filter((l) => l.size === HEADING_SIZE).map((l) => l.text), ["Slide 1", "Slide 2"]);
  assert.equal(lines[1].text, "Learning goals", "slide2.xml comes before slide10.xml");
  assert.ok(lines.some((l) => l.text === "(This slide has speaker notes.)"));
  assert.equal(officeLines(strToU8("not a zip"), "old.docx"), null);
  assert.equal(officeLines(docx, "deck.pptx"), null, "a Word file named .pptx has no slides");
});

/* ---------- a Funza material's exact structure ---------- */

function exam(): Draft {
  const tpl = sanitizeFormat("exam", {
    sections: [
      { title: "Part A: Multiple choice", instructions: "Choose the best answer.", rows: [{ type: "mcq", count: 3, marks: 1 }] },
      { title: "Part B: Written", instructions: "Show your work.", rows: [{ type: "short", count: 2, marks: 4 }, { type: "calc", count: 1, marks: 3 }] },
    ],
    duration: 80,
  }) as TemplateFormat;
  const b = applyTemplate(defaultBrief("exam", [FM2]), { id: "11111111-2222-4333-8444-555555555555", category: "exam", name: "Unit test", format: tpl });
  return blankDraft(b, "r1");
}

test("a Funza exam gives its exact structure: sections, instructions, types in order, counts and usual marks", () => {
  const d = exam();
  d.sections[0].items[2] = { ...d.sections[0].items[2], marks: 2 };
  const f = formatFromDraft(d, defaultBrief("exam", [FM2])) as QuestionFormat;
  assert.equal(f.category, "exam");
  assert.deepEqual(f.sections.map((s) => [s.title, s.instructions]), [["Part A: Multiple choice", "Choose the best answer."], ["Part B: Written", "Show your work."]]);
  assert.deepEqual(f.sections[0].rows, [{ type: "mcq", count: 3, marks: 1 }], "the usual mark wins over one odd question");
  assert.deepEqual(f.sections[1].rows, [{ type: "short", count: 2, marks: 4 }, { type: "calc", count: 1, marks: 3 }]);
  assert.equal(f.duration, 80);
  assert.deepEqual(layoutOfSections([{ ...d.sections[0], items: [] }]), [], "an empty section is left out");
});

test("notes and slides from Funza are read as text, with titles and question starts but no answers", () => {
  const d = exam();
  d.sections[0].items[0] = { ...d.sections[0].items[0], prompt: "Which is faster?", correctId: "b", solution: "The steeper line." };
  assert.equal(formatFromDraft({ ...d, kind: "notes" }, defaultBrief("notes", [FM2])), null);
  const text = materialText(d);
  assert.match(text, /## Part A: Multiple choice/);
  assert.match(text, /1\. Which is faster\? \(1 mark\)/);
  assert.equal(text.includes("The steeper line"), false, "no solutions or keys");
});

/* ---------- printing in the template's style ---------- */

test("a printed copy follows the template: numbering per section, marks in brackets, a cover page, no doubled part letters", () => {
  const d = exam();
  d.sections.forEach((s) => s.items.forEach((it, i) => Object.assign(it, { prompt: `Question ${s.id}-${i}`, options: it.options.map((o) => ({ ...o, text: "x" })) })));
  const base = { kind: "exam" as const, title: "Unit test", courseName: "Science 10", outcomeCodes: ["FM2"], duration: 80, school: "", sections: d.sections };
  const plain = studentHtml(base);
  assert.match(plain, /<h2>Part A: Multiple choice \(3 marks\)<\/h2>/, "a title that names its part gets no second letter");
  assert.match(plain, /<b>4\.<\/b>/, "numbered straight through by default");
  assert.match(plain, /\[1\]<\/span>/);
  assert.equal(plain.includes("page-break"), false);

  const styled = studentHtml({ ...base, style: { wording: [], numbering: "per-section", marksShown: "brackets", cover: { title: "Science 10 Unit Test", instructions: ["Write your name on every page", "Calculators allowed"] } } });
  assert.match(styled, /<h1>Science 10 Unit Test<\/h1>/);
  assert.match(styled, /<li>Calculators allowed<\/li>/);
  assert.match(styled, /page-break-after:always/);
  assert.equal(styled.match(/Name: ____/g)?.length, 1, "the name line is on the cover only");
  const partB = styled.slice(styled.indexOf("Part B: Written"));
  assert.match(partB, /<b>1\.<\/b>/, "numbering restarts in Part B");
  assert.match(styled, /\(1 mark\)<\/p>/);
  assert.match(styled, /\(4 marks\)<\/p>/);
  const none = studentHtml({ ...base, style: { wording: [], numbering: "continuous", marksShown: "none", cover: null } });
  assert.equal(/\[\d\]|\(\d marks?\)<\/p>/.test(none), false, "marks not shown on questions");
  assert.equal(studentHtml({ ...base, style: { wording: [], numbering: "continuous", marksShown: "margin", cover: null } }).includes("float:right"), true);
});

/* ---------- saving review changes back to the template (T7) ---------- */

test("a structure counts as changed only after the teacher changes it, and differently from the template", () => {
  const d = exam();
  const layout = d.sections.map((s, k) => ({ title: s.title, instructions: k === 0 ? "Choose the best answer." : "Show your work.", rows: layoutOfSections([s])[0].rows }));
  const drafted = layoutOfSections(d.sections);
  assert.equal(structureChanged(drafted, d.sections, 80, 80), false, "as drafted: nothing to offer");
  // Funza drafted one question short: not the teacher's change.
  const short = { ...d, sections: [{ ...d.sections[0], items: d.sections[0].items.slice(0, 2) }, d.sections[1]] };
  const shortDrafted = layoutOfSections(short.sections);
  assert.equal(structureChanged(shortDrafted, short.sections, 80, 80), false);
  // The teacher adds a question to Part B and changes the time.
  const more = { ...d, sections: [d.sections[0], { ...d.sections[1], items: [...d.sections[1].items, { ...d.sections[1].items[0], id: "new" }] }] };
  assert.equal(structureChanged(drafted, more.sections, 80, 80), true);
  assert.equal(structureChanged(layout, more.sections, 80, 80), true);
  assert.deepEqual(layoutOfSections(more.sections)[1].rows[0], { type: "short", count: 3, marks: 4 });
  assert.equal(structureChanged(drafted, d.sections, 80, 90), true, "a new time counts too");
});

/* ---------- Make's settings as a template ---------- */

test("Make's settings become a template: one part per question type, with the time, difficulty and extras", () => {
  const b = { ...defaultBrief("quiz", [FM2]), duration: 25, difficulty: "review" as const };
  const f = formatFromBrief(b);
  assert.ok(f && isQuestionFormat(f));
  assert.deepEqual(f.sections.map((s) => s.title), ["Part A: Multiple choice", "Part B: True or false", "Part C: Fill in the blank", "Part D: Matching", "Part E: Calculation", "Part F: Short answer"]);
  assert.equal(f.duration, 25);
  assert.equal(f.difficulty, "review");
  const notes = formatFromBrief({ ...defaultBrief("notes", [FM2]), notesStyle: "summary", keyTerms: false });
  assert.ok(notes && notes.category === "notes");
  assert.equal(notes.notesStyle, "summary");
  assert.equal(formatLine(notes), "5 parts · Check questions");
  const slides = formatFromBrief({ ...defaultBrief("presentation", [FM2]), slides: 12 });
  assert.equal(slides && formatLine(slides), "12 slides · up to 5 bullets · Speaker notes");
  assert.equal(formatFromBrief({ ...defaultBrief("quiz", [FM2]), mix: defaultBrief("quiz").mix.map((r) => ({ ...r, count: 0 })) }), null, "nothing to save without a question");
});
