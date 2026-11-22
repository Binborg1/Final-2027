#!/usr/bin/env node
// Re-run: node scripts/curriculum/documents/pdftext.mjs 70 --split=300 && node scripts/curriculum/documents/parse-chemistry.mjs && node scripts/curriculum/documents/flag-symbols.mjs 70
// Chemistry 20, 30 (1992 guide): each unit has "Foundational Objectives for Chemistry and the Common Essential Learnings":
// bold statements are foundational objectives (CEL ones end with "(COM)", "(NUM)", ...); "•" bullets under them are learning objectives.
import { loadText, printedPage, isFooter, wordIndex, joinLines, LEGACY_SCIENCE_NOTES, documentSource, toDocument, writeDocument, FILENAMES } from "./lib.mjs";

const ID = 70;
const doc = loadText(String(ID));
const words = wordIndex(doc);
const notes = [];
const hyphenLog = [];
const units = [];
let level = null, unit = null, section = null, cur = null, lastFound = -1, prev = null;
const CELRE = /\((CCT|COM|IL|NUM|PSVS|TL)\)\s*$/;

function flush() {
  if (!cur) return;
  cur.item.text = joinLines(cur.lines, words, (m) => hyphenLog.push(`${unit.name}: ${m}`));
  if (cur.item.type === "foundational") {
    const c = cur.item.text.match(CELRE);
    cur.item.cel = c ? c[1] : null;
    unit.items.push(cur.item);
    lastFound = unit.items.length - 1;
  } else {
    cur.item.parent = lastFound >= 0 ? lastFound : null;
    unit.items.push(cur.item);
  }
  cur = null;
}
for (const p of doc.pages) {
  if (p.page < 80 || p.page > 169) continue;
  prev = null;
  for (const l of p.lines) {
    if (isFooter(l)) continue;
    if (l.size >= 20) {
      flush();
      const lm = l.text.match(/^Chemistry (20|30)$/);
      if (lm) { level = Number(lm[1]); unit = null; section = null; continue; }
      if (/^Appendix/.test(l.text)) { level = null; unit = null; section = null; continue; }
    }
    if (!level) continue;
    if (l.size >= 15 && l.bold) {
      flush();
      unit = { name: l.text, level, pages: [p.page, p.page], factorsEmphasized: [], items: [] };
      units.push(unit); section = null; lastFound = -1; prev = null;
      continue;
    }
    if (!unit) continue;
    unit.pages[1] = p.page;
    if ((l.size >= 11.5 && l.bold) || (l.bold && /^Factors of scientific literacy/i.test(l.text))) {
      flush();
      section = /^Foundational Objectives for Chemistry/.test(l.text) ? "fo" : /^Factors of scientific literacy/i.test(l.text) ? "factors" : null;
      prev = null;
      continue;
    }
    // Factor codes ("A1 public/private") belong to the factor list even when the right-hand column is read after the objectives heading.
    if ((section === "factors" || section === "fo") && !l.bold && /^[A-G]\d{1,2} \S/.test(l.text)) { unit.factorsEmphasized.push(l.text); continue; }
    // Other lines read while in the factor list are the right-hand column of the Unit Overview (column order), not factors.
    if (section === "factors") continue;
    if (section !== "fo") continue;
    const gap = prev && prev.col === l.col ? prev.y - l.y : 0;
    if (/^•/.test(l.text)) {
      flush();
      cur = { item: { code: null, type: "learning", text: "", page: p.page, printedPage: printedPage(p) }, lines: [l.text.replace(/^•\s*/, "")] };
    } else if (l.bold) {
      if (!cur || cur.item.type !== "foundational" || gap > 16 || (prev && prev.col !== l.col && /[.)]$/.test(cur.lines.at(-1)))) {
        flush();
        cur = { item: { code: null, type: "foundational", text: "", page: p.page, printedPage: printedPage(p) }, lines: [l.text] };
      } else cur.lines.push(l.text);
    } else if (cur && cur.item.type === "learning" && gap <= 16) cur.lines.push(l.text);
    else if (cur && cur.item.type === "learning" && prev && prev.col !== l.col && !/[.)]$/.test(cur.lines.at(-1))) cur.lines.push(l.text);
    else {
      notes.push(`p${p.page}: non-bold, non-bullet line in the objectives section kept as continuation of the previous item: "${l.text}"`);
      if (cur) cur.lines.push(l.text);
    }
    prev = l;
  }
}
flush();
for (const u of units) {
  if (u.items.length === 0) notes.push(`Chemistry ${u.level} "${u.name}": no foundational objectives section found.`);
  const orphan = u.items.filter((i) => i.type === "learning" && i.parent === null);
  if (orphan.length) notes.push(`Chemistry ${u.level} "${u.name}": ${orphan.length} learning objective(s) before any foundational objective.`);
}

const url = `https://curriculum.gov.sk.ca/CurriculumFile?id=${ID}`;
const src = documentSource(url);
const out = {
  curriculumId: ID,
  name: "Chemistry 20, 30",
  levels: [20, 30],
  status: "legacy (1992 curriculum guide); see notes on whether it is still offered",
  source: {
    url,
    coursePage: `https://curriculum.gov.sk.ca/CurriculumHome?id=${ID}`,
    documentTitle: "Science: A Curriculum Guide for the Secondary Level — Chemistry 20/30 (Saskatchewan Education, 1992)",
    filename: FILENAMES[ID],
    sha256: src.sha256,
    retrievedOn: src.retrievedOn,
    pages: doc.numPages,
    pageNumbering: "`page` is the 1-based PDF page; `printedPage` is the number printed on that page.",
  },
  kind: "objectives",
  units: units.map((u) => ({ name: u.name, level: u.level, optional: /^Optional:/.test(u.name), pages: u.pages, factorsEmphasized: u.factorsEmphasized, items: u.items })),
  notes: [
    "Structure as printed: each unit has one heading 'Foundational Objectives for Chemistry and the Common Essential Learnings'. Bold statements are foundational objectives; the Common Essential Learnings ones end with the CEL abbreviation in brackets, e.g. '(COM)' (also copied into `cel`). Bulleted statements under each are learning objectives (`parent` = index of their foundational objective in the unit's items). Nothing is numbered in the source, so `code` is null.",
    "Units whose heading starts 'Optional:' are optional units as printed.",
    "Text extracted with pdfjs-dist (legacy build) from a 1992 WordPerfect-generated PDF; two-column pages split at x=300. Bullet glyphs (WPTypographicSymbols '!') mapped to '•' (and stripped from the start of learning objectives); WPBoxDrawing ')' used as a dash mapped to '—' (in sub/superscripts, where it is a minus sign, to '−'). Subscripts/superscripts (e.g. chemical formulas) are flattened inline, so 'H2O' may appear where the print has H₂O.",
    ...LEGACY_SCIENCE_NOTES,
    ...notes,
  ],
  hyphenDecisions: hyphenLog,
};
const p = writeDocument(ID, toDocument(out, { extractedBy: "scripts/curriculum/documents/parse-chemistry.mjs" }));
console.log(p);
for (const u of out.units) console.log(u.level, u.name, u.pages.join("-"), "factors", u.factorsEmphasized.length, "F", u.items.filter((i) => i.type === "foundational").length, "CEL", u.items.filter((i) => i.cel).length, "L", u.items.filter((i) => i.type === "learning").length);
console.log(notes.join("\n"));
console.log(hyphenLog.filter((h) => /UNSURE/.test(h)).join("\n"));
