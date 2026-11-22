/**
 * Shared helpers for turning extracted PDF lines into verbatim curriculum items.
 *
 * Pipeline (each step re-runnable):
 *   1. node scripts/curriculum/documents/pdftext.mjs <curriculumId|url> [--name=<name>] [--split=300]
 *        fetches the PDF through the importer's polite cache and writes per-page lines to
 *        .cache/curriculum/documents/text/<name>.json (not committed)
 *   2. node scripts/curriculum/documents/parse-<course>.mjs
 *        writes src/data/curriculum/documents/<curriculumId>.json
 *   3. node scripts/curriculum/documents/flag-symbols.mjs <id> …   (legacy science guides)
 * The Social Studies guides are scans; their OCR pipeline is in social-studies/ (Python).
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APP, CACHE, cacheKey, cachedBytes, sha256 } from "../fetch.mjs";

export const DOCS = join(APP, "src", "data", "curriculum", "documents");
export const TEXT = join(APP, ".cache", "curriculum", "documents", "text");
export const curriculumFile = (id) => `https://curriculum.gov.sk.ca/CurriculumFile?id=${id}`;

export const loadText = (name) => JSON.parse(readFileSync(join(TEXT, `${name}.json`), "utf8"));
export function saveText(name, obj) {
  mkdirSync(TEXT, { recursive: true });
  writeFileSync(join(TEXT, `${name}.json`), JSON.stringify(obj));
}

/** Where a document came from: its official URL, the PDF's SHA-256 and the date it was cached. */
export function documentSource(url) {
  const bytes = cachedBytes(url);
  if (!bytes) throw new Error(`${url} is not cached yet: run pdftext.mjs first.`);
  const file = join(CACHE, `${cacheKey(url)}.bin`);
  return { url, sha256: sha256(bytes), bytes: bytes.length, retrievedOn: statSync(file).mtime.toLocaleDateString("en-CA") };
}

/** A page's printed number: a short numeric/roman line near the bottom of the page. */
// Some pages print the number twice on top of itself ("259259").
const PAGENO = /^([0-9]{1,3}|[ivxlc]{1,6})\1?$/i;
export function printedPage(page) {
  const l = page.lines.find((x) => x.y < 45 && PAGENO.test(x.text));
  return l ? l.text.match(PAGENO)[1] : null;
}
export const isFooter = (l) => l.y < 45 && PAGENO.test(l.text);

/** What curriculum.gov.sk.ca says (and does not say) about the 1992 Biology/Chemistry/Physics 20, 30 guides, checked 2026-11-21. */
export const LEGACY_SCIENCE_NOTES = [
  "Status on the site (2026-11-21): the course page has no notice that the guide is superseded; it offers only the PDF (its 'Outcomes & Indicators' page is empty). The course is reachable only through the site's search list: the 'Browse by Subject' → Sciences menu lists Science 10, Computer Science 20/30, Environmental Science 20, Health Science 20, Physical Science 20, Biology 30, Chemistry 30, Physics 30 and Earth Science 30, and not the 1992 'Biology/Chemistry/Physics 20, 30' entries.",
  "The renewed Health Science 20 curriculum (CurriculumFile?id=74, Health_Science_20_2020.pdf, p. 3) says: 'Saskatchewan has developed science courses at Grade 11 that provide students with opportunities to learn core biology, chemistry and physics disciplinary ideas within interdisciplinary contexts.' and 'The current credit requirements for graduation from Grade 12 are one 10-level credit and one 20-level credit in science.' Neither document names Biology 20, Chemistry 20 or Physics 20 or says they were withdrawn; the authoritative list of courses in effect is the Registrar's Handbook for School Administrators (not checked).",
  "The 30-level parts of this guide are superseded on the site by the renewed Biology 30 / Chemistry 30 / Physics 30 (ids 68, 69, 72), which have outcomes in sk.json.",
];

/** Line-break hyphens checked by eye against the PDF where the document gives no evidence either way. */
export const HYPHEN_OVERRIDES = { "incandes-cence": "incandescence" };

/** Lower-cased word tokens of the whole document (hyphenated words kept whole), for line-break hyphen decisions. */
export function wordIndex(doc) {
  const counts = new Map();
  for (const p of doc.pages) for (const l of p.lines) for (const w of l.text.toLowerCase().match(/[\p{L}][\p{L}'’-]*[\p{L}]/gu) ?? []) counts.set(w, (counts.get(w) ?? 0) + 1);
  return counts;
}

/**
 * Joins the printed lines of one statement. A line ending in "-" before a lower-case letter is a
 * line-break hyphen when the document prints the joined word elsewhere and never the hyphenated
 * form on one line; otherwise the hyphen is kept. Every decision is reported to `log`.
 */
export function joinLines(lines, words, log) {
  let s = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!s) {
      s = line;
      continue;
    }
    const m = s.match(/([\p{L}]+)-$/u);
    const n = line.match(/^([\p{L}]+)/u);
    if (m && n && /^\p{Ll}/u.test(n[1])) {
      const joined = (m[1] + n[1]).toLowerCase();
      const hyph = `${m[1]}-${n[1]}`.toLowerCase();
      const jc = words.get(joined) ?? 0;
      const hc = words.get(hyph) ?? 0;
      if (jc > 0 && hc === 0) {
        s = s.slice(0, -1) + line;
        log?.(`rejoined "${m[1]}-|${n[1]}" as "${m[1]}${n[1]}" (joined form printed ${jc}× elsewhere)`);
        continue;
      }
      if (hc > 0) {
        s = s + line;
        log?.(`kept hyphen in "${m[1]}-${n[1]}" (hyphenated form printed ${hc}× on one line)`);
        continue;
      }
      if (HYPHEN_OVERRIDES[`${m[1]}-${n[1]}`.toLowerCase()]) {
        s = s.slice(0, -1) + line;
        log?.(`rejoined "${m[1]}-|${n[1]}" as "${m[1]}${n[1]}" (manual override after checking the PDF)`);
        continue;
      }
      // Unknown: keep the hyphen but flag it.
      s = s + line;
      log?.(`UNSURE: kept hyphen at line break in "${m[1]}-${n[1]}" (neither form printed elsewhere)`);
      continue;
    }
    if (/\p{L}-$/u.test(s) && /^\p{Lu}/u.test(line)) {
      s = s + line;
      log?.(`kept hyphen before capital in "${s.slice(-25)}"`);
      continue;
    }
    if (/^•/.test(line)) {
      s = s + "\n" + line;
      continue;
    }
    if (/[—–]$/.test(s) || /^[—–]/.test(line)) s = s + line;
    else s = s + " " + line;
  }
  return s
    .split("\n")
    .map((x) => x.replace(/\s+/g, " ").trim())
    .join("\n")
    .trim();
}

/** Filenames the server gave these PDFs (Content-Disposition) when they were fetched on 2026-11-21. */
export const FILENAMES = {
  67: "Biology_20_30_1992.pdf",
  70: "Chemistry_20_30_1992.pdf",
  71: "Physics_20_30_1992.pdf",
  793: "English_language_Arts_30__260828_PRELIMINARY.pdf",
  806: "Michif_French_10_20_30__260408_PRELIMINARY.pdf",
};

/** OCR'd scans are kept apart from text-layer PDFs: their text has not been proofread. */
export function textSourceOf(d) {
  const said = `${d.text ?? ""} ${(d.notes ?? []).join(" ")}`;
  if (/not OCR/i.test(said)) return "text-layer";
  return /\bOCR\b/.test(said) ? "ocr" : "text-layer";
}

/**
 * The committed shape of a document extraction: item text unchanged; the source block keeps the
 * curriculum's own URL (never a signed storage URL), the PDF's SHA-256, the date and the filename.
 */
export function toDocument(d, { extractedBy, partialReason = null } = {}) {
  const src = d.source;
  const source = {
    url: src.url,
    filename: src.filename ?? null,
    sha256: src.sha256,
    retrievedOn: src.retrievedOn,
    ...(src.bytes ? { bytes: src.bytes } : {}),
    pages: src.pages ?? null,
    ...(src.pageNumbering ? { pageNumbering: src.pageNumbering } : {}),
    ...(src.documentTitle ? { documentTitle: src.documentTitle } : {}),
    coursePage: `https://curriculum.gov.sk.ca/CurriculumHome?id=${d.curriculumId}`,
  };
  return {
    curriculumId: d.curriculumId,
    name: d.name,
    levels: d.levels,
    kind: d.kind,
    textSource: textSourceOf(d),
    ...(partialReason ? { partial: true, partialReason } : {}),
    source,
    extractedBy,
    ...Object.fromEntries(Object.entries(d).filter(([k]) => !["curriculumId", "name", "levels", "kind", "source", "status", "units", "notes"].includes(k))),
    units: d.units,
    notes: d.notes ?? [],
  };
}

/** Writes src/data/curriculum/documents/<id>.json (pass `dir` to write elsewhere, e.g. to compare a re-run). */
export function writeDocument(id, obj, dir = process.env.DOCUMENTS_OUT || DOCS) {
  mkdirSync(dir, { recursive: true });
  const p = join(dir, `${id}.json`);
  writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
  return p;
}

export const readDocument = (id, dir = process.env.DOCUMENTS_OUT || DOCS) => (existsSync(join(dir, `${id}.json`)) ? JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) : null);
