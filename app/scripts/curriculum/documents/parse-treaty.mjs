#!/usr/bin/env node
/**
 * Treaty Education, Grades 10–12: "Treaty Education Outcomes and Indicators" (Saskatchewan
 * Ministry of Education, 2013), the PDF the site's "Levels 10, 20, 30" menu links as
 * "Treaty Education Outcomes & Indicators". The site's own outcomes page for Treaty Education
 * (CurriculumOutcomeContent?id=481) answers "Page Not Found", and the Ministry CSV lists the
 * codes with empty statements, so this PDF is the only source of the wording.
 *
 *   node scripts/curriculum/documents/parse-treaty.mjs
 *
 * Each grade's page is a four-column table (TR, SI, HC, TPP): an outcome code with a
 * superscript goal number, the outcome statement, "Indicators:" and bulleted indicators.
 * The text layer is read directly with pdf.js and split at the columns' left edges.
 */

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { APP, cachedBytes, getBytes } from "../fetch.mjs";
import { documentSource, joinLines, writeDocument } from "./lib.mjs";

const URL = "https://www.edonline.sk.ca/bbcswebdav/xid-8784654_1";
const FILENAME = "Treaty Education Outcomes-Grades 10-12.pdf"; // the name its storage path gives (redirect from the xid link)
const CSV = "https://www.edonline.sk.ca/bbcswebdav/library/outcomes/csvFiles/481_Treaty_Education_.csv";

const pdfjs = await import(pathToFileURL(join(APP, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs")).href);
const r = await getBytes(URL);
if (!r.bytes) throw new Error(`${URL}: ${r.error}`);
const doc = await pdfjs.getDocument({ data: new Uint8Array(r.bytes), isEvalSupported: false, verbosity: 0 }).promise;

const GRADES = { Ten: 10, Eleven: 11, Twelve: 12 };
const isBullet = (it) => /^[-]$/.test(it.str) || (it.str.trim() === "" && it.str.length > 0 && it.font === "g_d0_f5");
const notes = [];
const hyphenLog = [];
const pages = [];
const all = [];

// The document's own words for the line-break hyphen decisions.
for (let p = 1; p <= doc.numPages; p++) {
  const tc = await (await doc.getPage(p)).getTextContent();
  pages.push(tc.items.filter((i) => "str" in i).map((i) => ({ x: i.transform[4], y: i.transform[5], size: Math.round(Math.hypot(i.transform[2], i.transform[3]) * 10) / 10, font: i.fontName, str: i.str, w: i.width })));
}
/** Joins the items of one printed line left to right, with a space where the gap between them shows one. */
function joinParts(parts) {
  let out = "";
  let end = null;
  for (const p of [...parts].sort((a, b) => a.x - b.x)) {
    if (end !== null && p.x - end > 1.5 && !/\s$/.test(out) && !/^\s/.test(p.str)) out += " ";
    out += p.str;
    end = p.x + p.w;
  }
  return out.replace(/\s+/g, " ").trim();
}
const words = new Map();
for (const items of pages) for (const it of items) for (const w of it.str.toLowerCase().match(/[\p{L}][\p{L}'’-]*[\p{L}]/gu) ?? []) words.set(w, (words.get(w) ?? 0) + 1);

/** Goals, verbatim from the goals page ("Treaty Relationships (TR)" then "Goal: …"). */
const goals = [];
{
  const p = pages.findIndex((items) => items.some((i) => /^Treaty Relationships \(TR\)$/.test(i.str.trim())));
  // Printed lines (items on one baseline joined left to right), between the running header and the page number.
  const rows = [];
  for (const it of pages[p].filter((i) => i.str.trim() && i.y > 45 && i.y < 735).sort((a, b) => b.y - a.y || a.x - b.x)) {
    let row = rows.find((l) => Math.abs(l.y - it.y) < 2);
    if (!row) rows.push((row = { y: it.y, parts: [] }));
    row.parts.push(it);
  }
  let cur = null;
  for (const row of rows) {
    const t = joinParts(row.parts);
    const h = t.match(/^(.+) \((TR|SI|HC|TPP)\)$/);
    if (h) {
      cur = { code: h[2], name: h[1], lines: [], page: p + 1 };
      goals.push(cur);
    } else if (cur) cur.lines.push(t);
  }
  for (const g of goals) {
    g.text = joinLines(g.lines, words, (m) => hyphenLog.push(`goal ${g.code}: ${m}`));
    delete g.lines;
  }
}

const units = [];
for (const [pi, items] of pages.entries()) {
  const heading = items.find((i) => /^Grade (Ten|Eleven|Twelve): /.test(i.str.trim()));
  if (!heading) continue;
  const grade = GRADES[heading.str.trim().match(/^Grade (\w+):/)[1]];
  const level = { 10: 10, 11: 20, 12: 30 }[grade];
  const keyY = items.find((i) => i.str.trim() === "KEY")?.y ?? 0;
  const body = items.filter((i) => i.y > keyY + 2 && i.y < heading.y - 2);
  const codeItems = body.filter((i) => new RegExp(`^(TR|SI|HC|TPP)${grade}$`).test(i.str.trim()) && i.size >= 10).sort((a, b) => a.x - b.x);
  if (codeItems.length !== 4) throw new Error(`Grade ${grade}: expected 4 outcome codes, found ${codeItems.map((c) => c.str).join(", ")}.`);
  const unit = { name: heading.str.trim(), grade, level, page: pi + 1, items: [] };
  for (const [ci, codeItem] of codeItems.entries()) {
    const left = codeItem.x - 1;
    const right = codeItems[ci + 1]?.x - 1 || Infinity;
    const col = body.filter((i) => i.x >= left && i.x < right && i !== codeItem);
    const sup = col.find((i) => i.size < 8 && Math.abs(i.y - codeItem.y) < 6 && i.x > codeItem.x);
    // Lines of this column, top to bottom; a bullet glyph starts an indicator.
    const lines = [];
    for (const it of col.filter((i) => i !== sup).sort((a, b) => b.y - a.y || a.x - b.x)) {
      let line = lines.find((l) => Math.abs(l.y - it.y) < 2);
      if (!line) lines.push((line = { y: it.y, parts: [] }));
      line.parts.push(it);
    }
    const code = codeItem.str.trim();
    const outcome = { code, type: "outcome", superscript: sup?.str.trim() ?? null, text: "", page: pi + 1 };
    const stmt = [];
    const indicators = [];
    let phase = "statement";
    for (const l of lines) {
      const bullet = l.parts.some(isBullet);
      const t = joinParts(l.parts.filter((x) => !isBullet(x)));
      if (phase === "statement" && /^Indicators:$/.test(t)) {
        phase = "indicators";
        continue;
      }
      if (phase === "statement") stmt.push(t.replace(/^:\s*/, ""));
      else if (bullet) indicators.push([t]);
      else if (indicators.length && t) indicators.at(-1).push(t);
      else if (t) notes.push(`Grade ${grade} ${code}: a line before the first indicator bullet was not placed: “${t}”.`);
    }
    outcome.text = joinLines(stmt, words, (m) => hyphenLog.push(`${code}: ${m}`));
    unit.items.push(outcome);
    for (const ind of indicators) unit.items.push({ code: null, label: null, type: "indicator", outcome: code, bullet: true, text: joinLines(ind, words, (m) => hyphenLog.push(`${code} indicator: ${m}`)), page: pi + 1 });
    all.push({ code, indicators: indicators.length });
  }
  units.push(unit);
}

// Cross-check: the Ministry CSV lists the Grade 10–12 codes (with empty statements).
const csv = cachedBytes(CSV) ? cachedBytes(CSV).toString("utf8") : null;
if (csv) {
  const csvCodes = [...csv.matchAll(/"Outcome","((?:TR|SI|HC|TPP)1[0-2])"/g)].map((m) => m[1]).sort();
  const ours = all.map((a) => a.code).sort();
  if (JSON.stringify(csvCodes) !== JSON.stringify(ours)) notes.push(`The Ministry CSV's Grade 10–12 codes (${csvCodes.join(", ")}) differ from the PDF's (${ours.join(", ")}).`);
  else notes.push(`Every Grade 10–12 code matches the Ministry CSV (${CSV}), which lists the codes with empty statements.`);
}
const src = documentSource(URL);
const out = {
  curriculumId: 481,
  name: "Treaty Education",
  levels: [10, 20, 30],
  grades: [10, 11, 12],
  kind: "outcomes",
  textSource: "text-layer",
  crossCurricular: true,
  source: {
    url: URL,
    filename: FILENAME,
    sha256: src.sha256,
    retrievedOn: src.retrievedOn,
    bytes: src.bytes,
    pages: units.map((u) => u.page),
    pageNumbering: "`page` is the 1-based PDF page.",
    documentTitle: "Treaty Education Outcomes and Indicators (Saskatchewan Ministry of Education, 2013), Grades 10–12",
    coursePage: "https://curriculum.gov.sk.ca/CurriculumHome?id=481",
    linkedFrom: "curriculum.gov.sk.ca, Browse by Grade → Levels 10, 20, 30: “Treaty Education Outcomes & Indicators”",
  },
  extractedBy: "scripts/curriculum/documents/parse-treaty.mjs",
  structure: "One unit per grade (the page heading). Each outcome is followed by its indicators, which the document prints as bullets (no letters).",
  goals,
  hyphenDecisions: hyphenLog,
  units,
  notes: [
    "Treaty Education is organised by grade (10, 11, 12), not by course level, and is meant to be taught within other subjects. `level` gives the matching course level (Grade 10 = 10-level, 11 = 20-level, 12 = 30-level) only so the course can sit beside the others.",
    "Outcome codes are printed with a superscript goal number (TR¹, SI², HC³, TPP⁴, per the page's KEY); the superscript is kept in `superscript`, and `code` is the code as the Ministry CSV lists it.",
    "The site's outcomes page for Treaty Education (https://curriculum.gov.sk.ca/CurriculumOutcomeContent?id=481) and its curriculum document link (https://curriculum.gov.sk.ca/CurriculumFile?id=481) both answer the site's “Page Not Found” page (checked 2026-11-21).",
    ...notes,
  ],
};
const p = writeDocument(481, out);
console.log(p);
for (const u of units) console.log(u.grade, u.name, u.items.filter((i) => i.type === "outcome").map((o) => `${o.code}^${o.superscript} (${u.items.filter((i) => i.outcome === o.code).length})`).join(" "));
console.log(out.notes.slice(3).join("\n"));
console.log(hyphenLog.join("\n"));
