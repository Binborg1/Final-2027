#!/usr/bin/env node
// Re-run: node scripts/curriculum/documents/pdftext.mjs 806 && node scripts/curriculum/documents/parse-michif.mjs
// Michif French 10, 20, 30 (2026 PRELIMINARY): "Michif French NN Outcomes and Indicators" -> goal headings
// "Culture (CU)", "Strategies (ST)", "Language Knowledge (LK)", "Applications (AP)" -> outcomes CU10.1 ... -> "Indicators" a., b. ...
import { loadText, wordIndex, joinLines, documentSource, toDocument, writeDocument, FILENAMES } from "./lib.mjs";

const ID = 806;
const doc = loadText(String(ID));
const words = wordIndex(doc);
const notes = [];
const hyphenLog = [];
const units = [];
let level = null, unit = null, cur = null, outcome = null, inInd = false, started = false;
const GOAL = /^(Culture|Strategies|Language Knowledge|Applications) \((CU|ST|LK|AP)\)$/;
const OUT = /^((CU|ST|LK|AP)(10|20|30)\.\d+)\s+(.*)$/;
const footer = (l) => l.y < 60 && /^\d{1,3}$/.test(l.text);
const pageNo = (p) => p.lines.find(footer)?.text ?? null;

function flush() {
  if (!cur) return;
  cur.item.text = joinLines(cur.lines, words, (m) => hyphenLog.push(`${cur.item.outcome ?? cur.item.code}: ${m}`));
  unit.items.push(cur.item);
  cur = null;
}
for (const p of doc.pages) {
  if (p.page < 23 || p.page > 59) continue;
  for (const l of p.lines) {
    if (footer(l)) continue;
    if (/^Assessment and Evaluation of Student Learning$/.test(l.text)) { flush(); started = false; break; }
    const lv = l.text.match(/^Michif French (10|20|30) Outcomes and Indicators$/);
    if (lv) { flush(); level = Number(lv[1]); started = true; unit = null; continue; }
    if (!started) continue;
    const g = l.text.match(GOAL);
    if (g) { flush(); unit = { name: l.text, goal: g[2], level, section: `Michif French ${level} Outcomes and Indicators`, items: [] }; units.push(unit); inInd = false; continue; }
    const om = l.text.match(OUT);
    if (om && l.x < 80) {
      flush();
      if (!unit || unit.goal !== om[2] || unit.level !== Number(om[3])) {
        notes.push(`p${p.page}: ${om[1]} printed without its own goal heading; placed under ${om[2]} ${om[3]} by its code.`);
        unit = units.find((u) => u.goal === om[2] && u.level === Number(om[3])) ?? (units.push({ name: `(${om[2]})`, goal: om[2], level: Number(om[3]), section: `Michif French ${om[3]} Outcomes and Indicators`, items: [] }), units.at(-1));
      }
      outcome = om[1]; inInd = false;
      cur = { item: { code: om[1], type: "outcome", text: "", page: p.page, printedPage: pageNo(p) }, lines: [om[4]] };
      continue;
    }
    if (/^Indicators:?$/.test(l.text)) { flush(); inInd = true; continue; }
    const im = l.text.match(/^([a-z]{1,2})\.\s+(.*)$/);
    if (inInd && im && l.x < 100) { flush(); cur = { item: { code: im[1], type: "indicator", outcome, text: "", page: p.page, printedPage: pageNo(p) }, lines: [im[2]] }; continue; }
    if (cur) cur.lines.push(l.text);
    else notes.push(`p${p.page}: unplaced line "${l.text}"`);
  }
}
flush();

// checks: outcome numbering per goal/level, indicator lettering, and the glance table (p21-22) codes
const all = units.flatMap((u) => u.items);
for (const u of units) {
  const outs = u.items.filter((i) => i.type === "outcome");
  outs.forEach((o, i) => { const want = `${u.goal}${u.level}.${i + 1}`; if (o.code !== want) notes.push(`${o.code} found where ${want} was expected.`); });
  for (const o of outs) {
    const ind = u.items.filter((i) => i.type === "indicator" && i.outcome === o.code);
    const letters = ind.map((x) => x.code);
    if (letters.some((x, i) => x !== String.fromCharCode(97 + i))) {
      const dup = [...new Set(letters.filter((x, i) => letters.indexOf(x) !== i))];
      notes.push(`${o.code}: the PDF letters its indicators ${letters.join(", ")}${dup.length ? ` (letter ${dup.join(", ")} used twice)` : " (out of order)"}. Kept as printed, in printed order; treat the letters of this outcome as unreliable identifiers.`);
    }
    if (!ind.length) notes.push(`${o.code}: no indicators.`);
  }
}
const glanceCodes = new Set();
for (const pg of [21, 22]) for (const l of doc.pages[pg - 1].lines) for (const m of l.text.matchAll(/\b(CU|ST|LK|AP)(10|20|30)\.\d+/g)) glanceCodes.add(m[0]);
const found = new Set(all.filter((i) => i.type === "outcome").map((i) => i.code));
const missing = [...glanceCodes].filter((c) => !found.has(c));
const extra = [...found].filter((c) => !glanceCodes.has(c));
if (missing.length) notes.push(`Codes in 'Outcomes at a Glance' with no outcome page: ${missing.join(", ")}`);
if (extra.length) notes.push(`Outcome pages whose code is not in 'Outcomes at a Glance': ${extra.join(", ")}`);

const url = `https://curriculum.gov.sk.ca/CurriculumFile?id=${ID}`;
const src = documentSource(url);
const out = {
  curriculumId: ID,
  name: "Michif French 10, 20, 30 (2026 PRELIMINARY)",
  levels: [10, 20, 30],
  status: "preliminary (draft) 2026 curriculum; the course page invites feedback until June 1, 2027",
  source: {
    url,
    coursePage: `https://curriculum.gov.sk.ca/CurriculumHome?id=${ID}`,
    documentTitle: "Michif French 10, 20, 30 — 2026 Saskatchewan Curriculum (PRELIMINARY, April 2026)",
    filename: FILENAMES[ID],
    sha256: src.sha256,
    retrievedOn: src.retrievedOn,
    pages: doc.numPages,
    pageNumbering: "`page` is the 1-based PDF page; `printedPage` is the number printed at the foot of the page (PDF page = printed page + 5).",
  },
  kind: "outcomes",
  units: units.map((u) => ({ name: u.name, level: u.level, goal: u.goal, section: u.section, items: u.items })),
  notes: [
    "Structure as printed: one section per level ('Michif French 10/20/30 Outcomes and Indicators'), each grouped under the four goal headings Culture (CU), Strategies (ST), Language Knowledge (LK) and Applications (AP). Units here are those goal headings within a level. Outcome codes: goal + course level + number (legend p. 17 printed). Indicators are lettered a., b., …; bullet sub-lists inside an indicator are kept on their own lines ('• …').",
    "The text mixes English with Michif French words (e.g. 'Lii pleu vyeu', 'la manyair dis prominii'); they are copied as printed, including their spelling and diacritics.",
    "PRELIMINARY: page 2 says 'April, 2026 – Due to the nature of curriculum development this document is regularly under revision.' The course page says: 'The Ministry of Education invites educators to provide feedback on the draft Michif French 10, 20, 30 (2026 PRELIMINARY) curriculum. All feedback must be received by June 1, 2027.'",
    "LK10.1 is printed with a space after the hyphen ('basic context- specific vocabulary') on a single line; kept as printed (LK10.2 has 'context-specific').",
    "Outcome codes were cross-checked against the 'Outcomes at a Glance' table (PDF pp. 21–22): every code there has an outcome page and vice versa. The statements were not compared word by word because the glance table is a three-column layout.",
    ...notes,
  ],
  hyphenDecisions: hyphenLog,
};
const pth = writeDocument(ID, toDocument(out, { extractedBy: "scripts/curriculum/documents/parse-michif.mjs" }));
console.log(pth);
for (const u of out.units) console.log(u.level, u.name, "outcomes", u.items.filter((i) => i.type === "outcome").length, "indicators", u.items.filter((i) => i.type === "indicator").length);
console.log(notes.join("\n"));
console.log(hyphenLog.join("\n"));
