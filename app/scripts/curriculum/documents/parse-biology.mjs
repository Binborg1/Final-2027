#!/usr/bin/env node
// Re-run: node scripts/curriculum/documents/pdftext.mjs 67 --split=300 && node scripts/curriculum/documents/parse-biology.mjs && node scripts/curriculum/documents/flag-symbols.mjs 67
// Biology 20, 30 (1992 guide): units -> "Common Essential Learnings Foundational Objectives" (CCT/COM/IL/NUM/PSVS/TL)
// and "Biology Foundational and Learning Objectives" (bold "1." foundational, "1.1" learning objectives).
import { loadText, printedPage, isFooter, wordIndex, joinLines, LEGACY_SCIENCE_NOTES, documentSource, toDocument, writeDocument, FILENAMES } from "./lib.mjs";

const ID = 67;
const doc = loadText(String(ID));
const words = wordIndex(doc);
const notes = [];
const hyphenLog = [];
const units = [];
let level = null, unit = null, section = null, cur = null, pendingName = false;
const CEL = /^(CCT|COM|IL|NUM|PSVS|TL)\s+(.*)$/;
const CONT_HEAD = /^(Foundational Objectives( to)?|Emphasize|Learning Objectives|Which Should be Emphasi[sz]ed?:?)$/i;

function flush() {
  if (!cur) return;
  cur.item.text = joinLines(cur.lines, words, (m) => hyphenLog.push(`${unit.name} ${cur.item.code ?? ""}: ${m}`));
  if (cur.note) (unit.printedNotes ??= []).push(cur.item);
  else unit.items.push(cur.item);
  cur = null;
}
for (const p of doc.pages) {
  if (p.page < 90 || p.page > 147) continue;
  for (const l of p.lines) {
    if (isFooter(l) || /^Figure \d+\./.test(l.text) || /^Note: (see|many other|page)/i.test(l.text)) continue;
    if (l.size >= 20) {
      flush();
      if (/^Biology 20 Units$/.test(l.text)) { level = 20; section = null; unit = null; continue; }
      if (/^Biology 30 Units$/.test(l.text)) { level = 30; section = null; unit = null; continue; }
      const um = l.text.match(/^Unit (\d+)$/);
      if (um) { unit = { number: Number(um[1]), name: "", level, hours: null, pages: [p.page, p.page], factorsEmphasized: [], items: [] }; units.push(unit); pendingName = true; section = null; continue; }
      if (/^Appendi/.test(l.text)) { unit = null; section = null; continue; }
    }
    if (!unit) continue;
    unit.pages[1] = p.page;
    if (pendingName && l.size >= 12 && l.bold) {
      const hm = l.text.match(/^(.*?)\s*\((\d+) hours\)$/);
      if (hm) { unit.name = (unit.name + " " + hm[1]).trim(); unit.hours = Number(hm[2]); pendingName = false; }
      else unit.name = (unit.name + " " + l.text).trim();
      continue;
    }
    if (pendingName && /^\((\d+) hours\)$/.test(l.text)) { unit.hours = Number(l.text.match(/\d+/)[0]); pendingName = false; continue; }
    if (l.size >= 15 && l.bold) {
      if (CONT_HEAD.test(l.text)) continue;
      flush();
      if (/^Factors of Scientific Literacy/i.test(l.text)) section = "factors";
      else if (/^Common Essential Learnings?$/i.test(l.text)) section = "cel";
      else if (/^Biology Foundational and/i.test(l.text)) section = "bio";
      else if (/^Foundational Objectives$/i.test(l.text)) continue;
      else section = null;
      continue;
    }
    if (l.size >= 12 && l.bold && section) { flush(); section = null; continue; }
    if (section === "factors") {
      if (/^[A-G]\d+\s/.test(l.text)) unit.factorsEmphasized.push(l.text);
      else if (/^\p{Ll}/u.test(l.text) && unit.factorsEmphasized.length) unit.factorsEmphasized[unit.factorsEmphasized.length - 1] += " " + l.text;
      else notes.push(`p${p.page}: line in the factors list not kept: "${l.text}"`);
      continue;
    }
    if (section === "cel") {
      const m = l.text.match(CEL);
      if (m) { flush(); cur = { item: { code: m[1], type: "foundational", section: "Common Essential Learnings Foundational Objectives", text: "", page: p.page, printedPage: printedPage(p) }, lines: [m[2]] }; }
      else if (cur) cur.lines.push(l.text);
      else notes.push(`p${p.page}: unplaced CEL line "${l.text}"`);
      continue;
    }
    if (section === "bio") {
      const f = l.text.match(/^(\d+)\.\s+(.*)$/);
      const s = l.text.match(/^(\d+\.\d+)\s+(.*)$/);
      if (/^Note:/.test(l.text)) { flush(); cur = { note: true, item: { text: "", page: p.page, printedPage: printedPage(p) }, lines: [l.text] }; continue; }
      if (s) { flush(); cur = { item: { code: s[1], type: "learning", section: "Biology Foundational and Learning Objectives", parentCode: s[1].split(".")[0], text: "", page: p.page, printedPage: printedPage(p) }, lines: [s[2]] }; }
      else if (f && l.bold) { flush(); cur = { item: { code: f[1], type: "foundational", section: "Biology Foundational and Learning Objectives", text: "", page: p.page, printedPage: printedPage(p) }, lines: [f[2]] }; }
      else if (cur) cur.lines.push(l.text);
      else notes.push(`p${p.page}: unplaced objective line "${l.text}"`);
      continue;
    }
  }
}
flush();

// checks: numbering continuity
for (const u of units) {
  const fs = u.items.filter((i) => i.type === "foundational" && i.section.startsWith("Biology")).map((i) => Number(i.code));
  fs.forEach((n, i) => { if (n !== i + 1) notes.push(`Biology ${u.level} Unit ${u.number}: foundational objective numbered ${n} where ${i + 1} was expected.`); });
  for (const f of fs) {
    const ls = u.items.filter((i) => i.type === "learning" && i.parentCode === String(f)).map((i) => Number(i.code.split(".")[1]));
    ls.forEach((n, i) => { if (n !== i + 1) notes.push(`Biology ${u.level} Unit ${u.number}: learning objective ${f}.${n} where ${f}.${i + 1} was expected.`); });
  }
  const orphan = u.items.filter((i) => i.type === "learning" && !fs.includes(Number(i.parentCode)));
  if (orphan.length) notes.push(`Biology ${u.level} Unit ${u.number}: learning objectives without a printed foundational objective: ${orphan.map((o) => o.code).join(", ")}`);
}

const url = `https://curriculum.gov.sk.ca/CurriculumFile?id=${ID}`;
const src = documentSource(url);
const out = {
  curriculumId: ID,
  name: "Biology 20, 30",
  levels: [20, 30],
  status: "legacy (1992 curriculum guide); see notes on whether it is still offered",
  source: {
    url,
    coursePage: `https://curriculum.gov.sk.ca/CurriculumHome?id=${ID}`,
    documentTitle: "Science: A Curriculum Guide for the Secondary Level — Biology 20/30 (Saskatchewan Education, September 1992)",
    filename: FILENAMES[ID],
    sha256: src.sha256,
    retrievedOn: src.retrievedOn,
    pages: doc.numPages,
    pageNumbering: "`page` is the 1-based PDF page; `printedPage` is the number printed on that page (PDF page = printed page + 5 in the body).",
  },
  kind: "objectives",
  units: units.map((u) => ({ name: u.name, level: u.level, unitNumber: u.number, hours: u.hours, pages: u.pages, factorsEmphasized: u.factorsEmphasized, ...(u.printedNotes ? { printedNotes: u.printedNotes } : {}), items: u.items })),
  notes: [
    "Structure as printed: for each core unit, 'Factors of Scientific Literacy Which Should be Emphasized' (codes defined in the guide's Dimensions of Scientific Literacy section; kept as printed in factorsEmphasized), 'Common Essential Learnings Foundational Objectives' (code = CEL abbreviation as printed), and 'Biology Foundational and Learning Objectives' (bold numbered foundational objectives, decimal-numbered learning objectives).",
    "The guide says learning objectives 'can be selected from those listed or can be developed by the teacher and students' (p. 3 printed); they are not all mandatory.",
    "Biology 20: 4 core units (78 h minimum) + optional time; Biology 30: 5 core units + optional time. Optional Plans pages list suggestions only (no objectives) and are not extracted.",
    "The guide states 'Biology 20 is not a prerequisite for Biology 30' (printed p. 82).",
    "Codes like '1' and '1.1' restart in every unit; they are only unique within a unit (and level).",
    "Text extracted with pdfjs-dist (legacy build) from a 1992 WordPerfect-generated PDF; two-column pages split at x=300. Bullet glyphs (WPTypographicSymbols '!') and box-drawing dashes (WPBoxDrawing ')') were mapped to '•' and '—'.",
    ...LEGACY_SCIENCE_NOTES,
    ...notes,
  ],
  hyphenDecisions: hyphenLog,
};
const p = writeDocument(ID, toDocument(out, { extractedBy: "scripts/curriculum/documents/parse-biology.mjs" }));
console.log(p);
for (const u of out.units) console.log(u.level, u.unitNumber, u.name, u.hours, u.pages.join("-"), "F", u.items.filter((i) => i.type === "foundational" && i.section.startsWith("Biology")).length, "L", u.items.filter((i) => i.type === "learning").length, "CEL", u.items.filter((i) => i.section.startsWith("Common")).length, "factors", u.factorsEmphasized.length);
console.log("notes:", notes);
console.log("hyphen:", hyphenLog.filter((h) => /UNSURE/.test(h)));
