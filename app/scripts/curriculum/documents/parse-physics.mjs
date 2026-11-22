#!/usr/bin/env node
// Re-run: node scripts/curriculum/documents/pdftext.mjs 71 --split=300 && node scripts/curriculum/documents/parse-physics.mjs && node scripts/curriculum/documents/flag-symbols.mjs 71
// Physics 20, 30 (1992 guide): each unit has "Foundational Objectives for Physics and the Common Essential Learnings"
// (unnumbered statements separated by blank lines; CEL ones end "(COM)" etc.), then topics "A. ...", sometimes
// subtopics "1. ...", each with "Learning Outcomes" numbered 1, 2, 3 ...
import { loadText, printedPage, isFooter, wordIndex, joinLines, LEGACY_SCIENCE_NOTES, documentSource, toDocument, writeDocument, FILENAMES } from "./lib.mjs";

const ID = 71;
const doc = loadText(String(ID));
const words = wordIndex(doc);
const notes = [];
const hyphenLog = [];
const units = [];
const unitByKey = new Map();
let level = null, unit = null, section = null, cur = null, prev = null, topic = null, subtopic = null;
const CELRE = /\((CCT|COM|IL|NUM|PSVS|TL)\)\s*$/;
const UNITRE = /^(Core|Optional) Unit ([IVX]+): (.+)$/;
const SUSPECT = /[ðºÿ]|(^|\s)'(\s|$)|\s['^]\s/; // symbol-font glyphs seen in this PDF's equations (' for =, ð for π, º for λ)

function flush() {
  if (!cur) return;
  cur.item.text = joinLines(cur.lines, words, (m) => hyphenLog.push(`${unit.name}: ${m}`));
  if (cur.item.type === "foundational") { const c = cur.item.text.match(CELRE); cur.item.cel = c ? c[1] : null; }
  if (SUSPECT.test(cur.item.text)) notes.push(`Physics ${unit.level} ${unit.key}${cur.item.code ? ` ${cur.item.topic ?? ""} ${cur.item.subtopic ?? ""} #${cur.item.code}` : ""}: text contains a symbol-font glyph that may be a mis-mapped math symbol: "${cur.item.text}"`);
  unit.items.push(cur.item);
  cur = null;
}
function getUnit(kind, num, name, page) {
  const key = `${kind} Unit ${num}`;
  const k = `${level}|${key}`;
  if (!unitByKey.has(k)) {
    const u = { key, name: `${key}: ${name}`, level, optional: kind === "Optional", pages: [page, page], factorsEmphasized: [], runningHeaders: new Set(), items: [] };
    unitByKey.set(k, u);
    units.push(u);
  }
  return unitByKey.get(k);
}
for (const p of doc.pages) {
  if (p.page < 85 || p.page > 280) continue;
  prev = null;
  for (const l of p.lines) {
    if (isFooter(l)) continue;
    const um = l.text.match(UNITRE);
    if (l.size >= 20) {
      const lm = l.text.match(/^Physics (20|30)$/);
      if (lm) { flush(); level = Number(lm[1]); unit = null; section = null; continue; }
      if (um && level) { flush(); unit = getUnit(um[1], um[2], um[3], p.page); topic = subtopic = null; section = null; prev = null; continue; }
    }
    if (!level) continue;
    if (um && l.size >= 15 && l.bold) {
      flush();
      const u = getUnit(um[1], um[2], um[3], p.page);
      if (u !== unit) { unit = u; topic = subtopic = null; notes.push(`Physics ${level} ${u.key}: no unit opening page; first seen as running header on PDF page ${p.page}.`); }
      unit.runningHeaders.add(l.text);
      section = null; prev = null;
      continue;
    }
    if (!unit) continue;
    unit.pages[1] = p.page;
    if (l.size >= 15 && l.bold) {
      const tm = l.text.match(/^([A-H])\.\s+(.+)$/);
      if (tm) { flush(); if (topic !== l.text) subtopic = null; topic = l.text; section = null; prev = null; continue; }
      if (/^Foundational Objectives/.test(l.text)) { flush(); section = "fo"; prev = null; continue; }
      if (/^(for )?Physics and( the)?$|^Common Essential Learnings$|^the Common Essential Learnings$/.test(l.text)) continue;
      if (/^Factors of Scientific Literacy/i.test(l.text)) { flush(); section = "factors"; continue; }
      if (/^(to be Emphasized|which should be emphasized)$/i.test(l.text)) continue;
      flush(); section = null; continue;
    }
    if (l.size >= 11.5 && l.bold) {
      const sm = l.text.match(/^(\d+)\.\s+(.+)$/);
      if (sm) { flush(); subtopic = l.text; section = null; continue; }
      flush();
      section = /^Learning Outcomes$/.test(l.text) ? "lo" : null;
      prev = null;
      continue;
    }
    if (section === "factors") { if (/^[A-G]\d{1,2} \S/.test(l.text)) unit.factorsEmphasized.push(l.text); continue; }
    if (section === "fo") {
      if (/^In this unit students will increase their abilities to:?$/.test(l.text)) { prev = l; continue; }
      if (/^[A-G]\d{1,2} \S/.test(l.text) && !l.bold) { unit.factorsEmphasized.push(l.text); continue; }
      const gap = prev && prev.col === l.col ? prev.y - l.y : null;
      const newItem = !cur || (gap !== null ? gap > 16 : /[.)]$/.test(cur.lines.at(-1)) && /^\p{Lu}/u.test(l.text));
      if (newItem) { flush(); cur = { item: { code: null, type: "foundational", text: "", page: p.page, printedPage: printedPage(p) }, lines: [l.text] }; }
      else cur.lines.push(l.text);
      prev = l;
      continue;
    }
    if (section === "lo") {
      if (/^Students will increase their abilities to:?$/.test(l.text)) continue;
      const m = l.text.match(/^(\d+)\.\s+(.*)$/);
      if (m && (!cur || Number(m[1]) === Number(cur.item.code) + 1 || Number(m[1]) === 1)) {
        flush();
        cur = { item: { code: m[1], type: "learning", topic, subtopic, text: "", page: p.page, printedPage: printedPage(p) }, lines: [m[2]] };
      } else if (cur) cur.lines.push(l.text);
      else notes.push(`p${p.page}: unplaced learning-outcome line "${l.text}"`);
      continue;
    }
  }
}
flush();

for (const u of units) {
  const fo = u.items.filter((i) => i.type === "foundational");
  if (fo.length === 0) notes.push(`Physics ${u.level} ${u.name}: no 'Foundational Objectives for Physics and the Common Essential Learnings' section in the PDF.`);
  // numbering check per topic/subtopic group
  const groups = new Map();
  for (const i of u.items.filter((i) => i.type === "learning")) {
    const g = `${i.topic}|${i.subtopic}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(i);
  }
  for (const [g, list] of groups) {
    // A topic can have several "Learning Outcomes" blocks (one per subtopic); numbering restarts at 1 in each.
    let expect = 1;
    for (const i of list) {
      const n = Number(i.code);
      if (n === 1) expect = 1;
      if (n !== expect) notes.push(`Physics ${u.level} ${u.key} ${g.replace("|null", "")}: learning outcome ${n} where ${expect} was expected.`);
      expect = n + 1;
    }
  }
}

const url = `https://curriculum.gov.sk.ca/CurriculumFile?id=${ID}`;
const src = documentSource(url);
const out = {
  curriculumId: ID,
  name: "Physics 20, 30",
  levels: [20, 30],
  status: "legacy (1992 curriculum guide); see notes on whether it is still offered",
  source: {
    url,
    coursePage: `https://curriculum.gov.sk.ca/CurriculumHome?id=${ID}`,
    documentTitle: "Science: A Curriculum Guide for the Secondary Level — Physics 20/30 (Saskatchewan Education, 1992)",
    filename: FILENAMES[ID],
    sha256: src.sha256,
    retrievedOn: src.retrievedOn,
    pages: doc.numPages,
    pageNumbering: "`page` is the 1-based PDF page; `printedPage` is the number printed on that page.",
  },
  kind: "objectives",
  units: units.map((u) => ({ name: u.name, level: u.level, optional: u.optional, pages: u.pages, runningHeaders: [...u.runningHeaders].filter((h) => h !== u.name), factorsEmphasized: u.factorsEmphasized, items: u.items })),
  notes: [
    "Structure as printed: each unit opens with 'Foundational Objectives for Physics and the Common Essential Learnings' introduced by 'In this unit students will increase their abilities to:' — unnumbered statements (type foundational; CEL ones end with '(COM)', '(NUM)', '(CCT)', '(TL)', '(IL)', '(PSVS)', also copied into `cel`). Each topic ('A. ...') or subtopic ('1. ...') then has 'Learning Outcomes' introduced by 'Students will increase their abilities to:', numbered from 1 in each block (type learning; `code` is that number, unique only within its topic/subtopic).",
    "Physics 20: 4 core units + choose one of 2 optional units (Sound, Optics). Physics 30: 4 core units + optional units V–VIII (see the 'Physics 30 Optional Units' page for how many to choose).",
    "Text extracted with pdfjs-dist (legacy build) from a 1992 WordPerfect-generated PDF; two-column pages split at x=300. Equations use symbol fonts that pdf.js maps to wrong characters (e.g. \"'\" for '=', 'ð' for π, 'º' for λ); items containing such glyphs are listed below and need checking against the printed page.",
    ...LEGACY_SCIENCE_NOTES,
    ...notes,
  ],
  hyphenDecisions: hyphenLog,
};
const p = writeDocument(ID, toDocument(out, { extractedBy: "scripts/curriculum/documents/parse-physics.mjs" }));
console.log(p);
for (const u of out.units) console.log(u.level, u.name, u.pages.join("-"), "factors", u.factorsEmphasized.length, "F", u.items.filter((i) => i.type === "foundational").length, "CEL", u.items.filter((i) => i.cel).length, "L", u.items.filter((i) => i.type === "learning").length, "topics", new Set(u.items.map((i) => i.topic).filter(Boolean)).size);
console.log(notes.join("\n"));
console.log(hyphenLog.filter((h) => /UNSURE/.test(h)).join("\n"));
