#!/usr/bin/env node
// Re-run: node scripts/curriculum/documents/pdftext.mjs 793 && node scripts/curriculum/documents/pdftext.mjs 793 --name=793-split --split=300 && node scripts/curriculum/documents/parse-ela30.mjs
// English Language Arts 30 (2026 PRELIMINARY): "Outcomes and Indicators" — ELA30.n outcomes (some with "including:" bullet lists),
// each followed by "Indicators:" a., b., c. ...
import { loadText, wordIndex, joinLines, documentSource, toDocument, writeDocument, FILENAMES } from "./lib.mjs";

const ID = 793;
const doc = loadText(String(ID));
const words = wordIndex(doc);
const notes = [];
const hyphenLog = [];
const items = [];
const footnotes = [];
let cur = null, outcome = null, inIndicators = false, started = false;
const footer = (l) => /^English Language Arts 30 \| \d+$/.test(l.text) || /^English Language Arts 30$/.test(l.text);
const pageNo = (p) => (p.lines.find((l) => /^English Language Arts 30 \| (\d+)$/.test(l.text))?.text.match(/(\d+)$/) ?? [, null])[1];

function flush() {
  if (!cur) return;
  cur.item.text = joinLines(cur.lines, words, (m) => hyphenLog.push(`${cur.item.outcome ?? cur.item.code}: ${m}`));
  items.push(cur.item);
  cur = null;
}
for (const p of doc.pages) {
  if (p.page < 19 || p.page > 37) continue;
  for (const l of p.lines) {
    if (footer(l)) continue;
    if (/^Outcomes and Indicators$/.test(l.text)) { started = true; continue; }
    if (/^Assessment and Evaluation of Student Learning$/.test(l.text)) { flush(); started = false; break; }
    if (!started) continue;
    if (/^\*/.test(l.text)) { footnotes.push({ outcome, text: l.text, page: p.page }); continue; }
    const om = l.text.match(/^(ELA30\.\d+)\s+(.*)$/);
    if (om && l.x < 80) { flush(); outcome = om[1]; inIndicators = false; cur = { item: { code: om[1], type: "outcome", text: "", page: p.page, printedPage: pageNo(p) }, lines: [om[2]] }; continue; }
    if (/^Indicators:$/.test(l.text)) { flush(); inIndicators = true; continue; }
    const im = l.text.match(/^([a-z]{1,2})\.\s+(.*)$/);
    if (inIndicators && im && l.x < 100) { flush(); cur = { item: { code: im[1], type: "indicator", outcome, text: "", page: p.page, printedPage: pageNo(p) }, lines: [im[2]] }; continue; }
    if (cur) cur.lines.push(l.text);
    else notes.push(`p${p.page}: unplaced line "${l.text}"`);
  }
}
flush();

// checks
const outs = items.filter((i) => i.type === "outcome");
outs.forEach((o, i) => { if (o.code !== `ELA30.${i + 1}`) notes.push(`Outcome ${o.code} found where ELA30.${i + 1} was expected.`); });
for (const o of outs) {
  const ind = items.filter((i) => i.type === "indicator" && i.outcome === o.code);
  ind.forEach((x, i) => { if (x.code !== String.fromCharCode(97 + i)) notes.push(`${o.code}: indicator ${x.code} where ${String.fromCharCode(97 + i)} was expected.`); });
  if (!ind.length) notes.push(`${o.code}: no indicators.`);
}
for (const f of footnotes) {
  const o = items.find((i) => i.type === "outcome" && i.code === f.outcome);
  if (o) (o.footnotes ??= []).push(f.text);
}

// Cross-check against "Outcomes at a Glance" (p17): every outcome statement's first words should appear there.
// Outcome codes sit in the margin of both columns, so they are removed before comparing words.
const glance = loadText("793-split").pages[16].lines.map((l) => l.text).join(" ").replace(/ELA30\.\d+|\|/g, " ");
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
for (const o of outs) {
  const head = o.text.split("\n")[0].replace(/including:$/, "");
  const g = norm(glance), h = norm(head);
  const at = g.indexOf(h.slice(0, 30));
  if (at >= 0 && g.slice(at, at + h.length) !== h) notes.push(`${o.code}: the outcome page and 'Outcomes at a Glance' (p. 13 printed) word this statement differently. Outcome page (kept): "${head}". Glance page reads from: "${glance.replace(/\s+/g, " ").slice(glance.replace(/\s+/g, " ").toLowerCase().indexOf(head.slice(0, 20).toLowerCase()), glance.replace(/\s+/g, " ").toLowerCase().indexOf(head.slice(0, 20).toLowerCase()) + head.length + 12)}…"`);
  if (!g.includes(h.slice(0, 40))) notes.push(`${o.code}: first words not found verbatim in 'Outcomes at a Glance' (page 17, read column by column): "${head.slice(0, 60)}"`);
}

const url = `https://curriculum.gov.sk.ca/CurriculumFile?id=${ID}`;
const src = documentSource(url);
const out = {
  curriculumId: ID,
  name: "English Language Arts 30 (2026 PRELIMINARY)",
  levels: [30],
  status: "preliminary (draft) 2026 curriculum; document says it is 'regularly under revision'",
  source: {
    url,
    coursePage: `https://curriculum.gov.sk.ca/CurriculumHome?id=${ID}`,
    documentTitle: "English Language Arts 30 — 2026 Saskatchewan Curriculum (PRELIMINARY, August 2026)",
    filename: FILENAMES[ID],
    sha256: src.sha256,
    retrievedOn: src.retrievedOn,
    pages: doc.numPages,
    pageNumbering: "`page` is the 1-based PDF page; `printedPage` is the number in the footer 'English Language Arts 30 | n' (PDF page = printed page + 4).",
  },
  kind: "outcomes",
  units: [{ name: "Outcomes and Indicators", items }],
  notes: [
    "The document has no units or strands: 'Outcomes and Indicators' (PDF pp. 19–36) lists ELA30.1–ELA30.18, one per page, each followed by 'Indicators:' a., b., c. … The single unit here is that section heading, not an invented grouping.",
    "Outcome statements that end 'including:' keep their bullet list in `text`, one bullet per line ('• ...'). Footnotes printed under an outcome (e.g. '*Full-length texts include …') are kept in `footnotes`, not in the statement.",
    "The document states (p. 12 printed) that all outcomes are required and that teachers may develop additional indicators that keep the intent of the outcome.",
    "PRELIMINARY: page 2 says 'August 2026 – Due to the nature of curriculum development, this document is regularly under revision.' Re-check the PDF hash before relying on this copy.",
    "The site's 'Outcomes & Indicators' page for this curriculum lists no outcomes (that is why sk.json has none); the PDF is the only source.",
    ...notes,
  ],
  hyphenDecisions: hyphenLog,
};
const p = writeDocument(ID, toDocument(out, { extractedBy: "scripts/curriculum/documents/parse-ela30.mjs" }));
console.log(p, "outcomes", outs.length, "indicators", items.filter((i) => i.type === "indicator").length);
console.log(notes.join("\n"));
console.log(hyphenLog.join("\n"));
