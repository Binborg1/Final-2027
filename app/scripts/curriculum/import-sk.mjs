#!/usr/bin/env node
/**
 * Imports every Saskatchewan Grade 10–12 curriculum (10-, 20- and 30-level courses)
 * from the official sources into Funza's curriculum dataset.
 *
 *   node scripts/curriculum/import-sk.mjs            # use cached pages where present
 *   node scripts/curriculum/import-sk.mjs --refresh  # fetch everything again
 *   node scripts/curriculum/import-sk.mjs --only=63,155
 *
 * Sources (both published by the Saskatchewan Ministry of Education):
 *   1. curriculum.gov.sk.ca: the course list, each course's outcomes page (units,
 *      outcome codes and statements) and each outcome's page (its indicators).
 *   2. The Ministry's CSV files on EDonline, which give outcome codes and statements
 *      for most curricula. They are used only to cross-check the website copy.
 *
 * Output:
 *   src/data/curriculum/sk.json        the dataset the app reads
 *   src/data/curriculum/sk-report.md   what was imported, cross-check results, anomalies
 * Raw pages are cached in .cache/curriculum/sk/ (not committed) with their SHA-256.
 *
 * Nothing here is rewritten or summarised: codes, statements and indicators are kept
 * exactly as printed (tags stripped, entities decoded, whitespace normalised).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE = join(APP, ".cache", "curriculum", "sk");
const OUT = join(APP, "src", "data", "curriculum");
const SITE = "https://curriculum.gov.sk.ca";
const CSV_DIR = "https://www.edonline.sk.ca/webapps/cmsmain/webui/library/outcomes/csvFiles?sortDir=ASCENDING&showAll=true&editPaging=false&subaction=view&action=frameset&startIndex=0";
const CSV_FILE = "https://www.edonline.sk.ca/bbcswebdav/library/outcomes/csvFiles/";
const UA = "Mozilla/5.0 (compatible; curriculum-importer/1.0)";
// The site takes about 2 s per page, so two requests at a time with a pause stays under one request a second.
const DELAY_MS = 250;
const WORKERS = 2;

const args = process.argv.slice(2);
const REFRESH = args.includes("--refresh");
const ONLY = (args.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean).map(Number);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(OUT, { recursive: true });
}

const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fetched = 0;
let cached = 0;

/**
 * Fetches a URL politely (one request at a time, delayed, retried), caching the raw bytes
 * on disk. Returns the decoded text: UTF-8, or Windows-1252 for files that are not valid
 * UTF-8 (some Ministry CSV files are saved that way).
 */
async function get(url) {
  const file = join(CACHE, `${sha256(url).slice(0, 24)}.bin`);
  let bytes = null;
  if (!REFRESH && existsSync(file)) {
    cached++;
    bytes = readFileSync(file);
  }
  for (let attempt = 1; !bytes && attempt <= 4; attempt++) {
    await sleep(DELAY_MS * attempt);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return { error: `HTTP ${res.status}` };
      bytes = Buffer.from(await res.arrayBuffer());
      // The site occasionally answers with an empty page; never cache one.
      if (bytes.length === 0) {
        bytes = null;
        throw new Error("empty response");
      }
      writeFileSync(file, bytes);
      fetched++;
      if (fetched % 50 === 0) console.log(`  … ${fetched} pages fetched`);
    } catch (e) {
      if (attempt === 4) return { error: String(e?.message ?? e) };
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/* ---------- text from HTML ---------- */

const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…",
  rarr: "→", larr: "←", harr: "↔", uarr: "↑", darr: "↓", deg: "°", times: "×", divide: "÷", plusmn: "±", le: "≤", ge: "≥", ne: "≠", asymp: "≈", infin: "∞",
  Delta: "Δ", delta: "δ", theta: "θ", pi: "π", sigma: "σ", Sigma: "Σ", mu: "μ", lambda: "λ", alpha: "α", beta: "β", gamma: "γ", omega: "ω", Omega: "Ω", radic: "√",
  sup2: "²", sup3: "³", frac12: "½", frac14: "¼", frac34: "¾", middot: "·", bull: "•", copy: "©", reg: "®", trade: "™", laquo: "«", raquo: "»", iexcl: "¡", iquest: "¿",
  eacute: "é", Eacute: "É", egrave: "è", ecirc: "ê", euml: "ë", aacute: "á", agrave: "à", acirc: "â", auml: "ä", iacute: "í", icirc: "î", iuml: "ï", oacute: "ó", ocirc: "ô",
  ouml: "ö", uacute: "ú", ucirc: "û", uuml: "ü", ccedil: "ç", Ccedil: "Ç", ntilde: "ñ", Ntilde: "Ñ", macr: "¯", shy: "",
  isin: "∈", notin: "∉", ni: "∋", sub: "⊂", sup: "⊃", sube: "⊆", supe: "⊇", cup: "∪", cap: "∩", empty: "∅", forall: "∀", exist: "∃", part: "∂", nabla: "∇",
  prod: "∏", sum: "∑", minus: "−", lowast: "∗", prop: "∝", ang: "∠", and: "∧", or: "∨", int: "∫", there4: "∴", sim: "∼", cong: "≅", equiv: "≡", perp: "⊥",
  sdot: "⋅", oplus: "⊕", otimes: "⊗", prime: "′", Prime: "″", sup1: "¹", ordm: "º", ordf: "ª", micro: "µ", para: "¶", sect: "§", cent: "¢", pound: "£", euro: "€",
  yen: "¥", not: "¬", brvbar: "¦", uml: "¨", acute: "´", cedil: "¸", ensp: " ", emsp: " ", thinsp: " ", zwnj: "", zwj: "", lrm: "", rlm: "", sbquo: "‚", bdquo: "„",
  dagger: "†", Dagger: "‡", permil: "‰", lsaquo: "‹", rsaquo: "›", oline: "‾", frasl: "⁄", weierp: "℘", image: "ℑ", real: "ℜ", alefsym: "ℵ", crarr: "↵",
  lArr: "⇐", uArr: "⇑", rArr: "⇒", dArr: "⇓", hArr: "⇔", lceil: "⌈", rceil: "⌉", lfloor: "⌊", rfloor: "⌋", lang: "〈", rang: "〉", loz: "◊", spades: "♠",
  clubs: "♣", hearts: "♥", diams: "♦", epsilon: "ε", zeta: "ζ", eta: "η", iota: "ι", kappa: "κ", nu: "ν", xi: "ξ", omicron: "ο", rho: "ρ", tau: "τ", upsilon: "υ",
  phi: "φ", chi: "χ", psi: "ψ", Gamma: "Γ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Phi: "Φ", Psi: "Ψ", AElig: "Æ", aelig: "æ", oslash: "ø", Oslash: "Ø",
  aring: "å", Aring: "Å", atilde: "ã", otilde: "õ", szlig: "ß", thorn: "þ", eth: "ð", yacute: "ý", yuml: "ÿ", Agrave: "À", Aacute: "Á", Acirc: "Â", Auml: "Ä",
  Egrave: "È", Ecirc: "Ê", Euml: "Ë", Igrave: "Ì", Iacute: "Í", Icirc: "Î", Iuml: "Ï", igrave: "ì", Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Ouml: "Ö", ograve: "ò",
  Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û", Uuml: "Ü", ugrave: "ù", OElig: "Œ", oelig: "œ", Scaron: "Š", scaron: "š", Yuml: "Ÿ", circ: "ˆ", tilde: "˜",
};
const unknownEntities = new Set();
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    if (e in NAMED) return NAMED[e];
    unknownEntities.add(e);
    return m;
  });
}
/**
 * Visible text of an HTML fragment, as a browser shows it: line breaks in the source are
 * spaces; <br>, list items and paragraphs start new lines. Nothing is reworded.
 */
function text(fragment) {
  const withBreaks = fragment
    .replace(/\s+/g, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\/\s*(p|div|li|tr|h\d|ul|ol)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decode(withBreaks)
    .split("\n")
    .map((l) => l.replace(/[^\S\n]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/* ---------- course list ---------- */

const LEVEL = /(?:^|[^\d])([AB])?(10|20|30)(?![\d])/;
function levelsInName(name) {
  const out = new Set();
  for (const m of name.matchAll(/(?:^|[\s,;/(])([AB])?(10|20|30)(?![\d])/g)) out.add(Number(m[2]));
  return [...out].sort();
}
const gradeOf = (level) => (level === 10 ? 10 : level === 20 ? 11 : level === 30 ? 12 : null);

/**
 * Every curriculum the home page links to: the search list, plus the menus (German,
 * Mandarin and Spanish appear only in the menus). Each menu entry also gives the
 * subject heading it sits under.
 */
function parseCourseList(home) {
  const byId = new Map();
  const a = home.indexOf('name="search_curriculum-record-id"');
  const seg = home.slice(a, home.indexOf("</select>", a));
  for (const m of seg.matchAll(/<option\s+value="(\d+)"[^>]*>([\s\S]*?)<\/option>/g)) {
    byId.set(Number(m[1]), { curriculumId: Number(m[1]), name: text(m[2]), subject: null, inSearchList: true });
  }
  let subject = null;
  for (const t of home.matchAll(/megamenu__dropdown__subheader">([\s\S]*?)<\/div>|<a href="CurriculumHome\?id=(\d+)">([\s\S]*?)<\/a>/g)) {
    if (t[1] !== undefined) {
      subject = text(t[1]) || null;
      continue;
    }
    const id = Number(t[2]);
    const known = byId.get(id);
    if (!known) byId.set(id, { curriculumId: id, name: text(t[3]), subject, inSearchList: false });
    else if (!known.subject) known.subject = subject;
  }
  return [...byId.values()];
}

function isSecondary(name) {
  if (/K-12|Treaty Education|Kindergarten|Prekindergarten/i.test(name)) return false;
  return levelsInName(name).length > 0;
}

/* ---------- a course's outcomes page ---------- */

function parseOutcomesPage(html, curriculumId) {
  const start = html.indexOf('id="cd_web_content"');
  const body = start >= 0 ? html.slice(start) : html;
  const units = [];
  const outcomes = [];
  let unit = null;
  const re =
    /outcome_content_homepage__group__header">\s*<a href="[^"]*?oc=(\d+)[^"]*">([\s\S]*?)<\/a>|outcome-content-homepage__sub-list__element__identifier">\s*<a href="[^"]*?oc=(\d+)[^"]*">([\s\S]*?)<\/a>[\s\S]*?outcome-content-homepage__sub-list__element__text">([\s\S]*?)<\/div>/g;
  for (const m of body.matchAll(re)) {
    if (m[1]) {
      unit = { ocId: Number(m[1]), name: text(m[2]) };
      units.push(unit);
    } else {
      outcomes.push({ ocId: Number(m[3]), code: text(m[4]), statement: text(m[5]), unitOcId: unit?.ocId ?? null });
    }
  }
  const title = text((html.match(/<title>([\s\S]*?)<\/title>/) ?? [, ""])[1]).replace(/\s*\|\s*Saskatchewan Curriculum\s*$/, "");
  return { title, units, outcomes, curriculumId };
}

/* ---------- an outcome's own page ---------- */

function parseOutcomePage(html) {
  const start = html.indexOf('id="cd_web_content"');
  const body = start >= 0 ? html.slice(start) : html;
  const statementMatch = body.match(/outcome_content_text">([\s\S]*?)<\/div>/);
  // The outcome's heading is the last section heading before its text (some pages start with a "Course Configurations" section).
  const headers = [...body.matchAll(/content_section_header">([\s\S]*?)<\/div>/g)].filter((m) => !statementMatch || m.index < statementMatch.index);
  const header = text(headers.at(-1)?.[1] ?? "");

  // Practical and Applied Arts modules: a module name and details, then the outcome under an "Outcome" heading.
  const moduleName = body.match(/outcome_content_module_name">([\s\S]*?)<\/div>/);
  if (moduleName) {
    const details = [...body.matchAll(/outcome_content_module_metadata__property">([\s\S]*?)<\/div>/g)].map((m) => text(m[1]).replace(/\s*\n\s*/g, " "));
    const outcome = body.match(/outcome_content_child_list_header">\s*Outcomes?\s*<\/div>\s*<span>([\s\S]*?)<\/span>/);
    return { header, statement: text(outcome?.[1] ?? ""), printedWith: [text(moduleName[1]), ...details].join(" · "), module: text(moduleName[1]), ...indicatorRows(body) };
  }

  const statement = text(statementMatch?.[1] ?? "");
  // Text printed between the statement and the indicators, e.g. mathematics' process codes "[C, CN, ME, PS, R, V]".
  let printedWith = null;
  if (statementMatch) {
    const after = body.slice(statementMatch.index + statementMatch[0].length);
    const end = after.search(/outcome_content_child_list|<\/section>|content_section_footer/);
    const between = text(after.slice(0, end < 0 ? 0 : end).replace(/<div[^>]*$/, ""));
    printedWith = between || null;
  }
  return { header, statement, printedWith, module: null, ...indicatorRows(body) };
}

function indicatorRows(body) {
  const indicators = [];
  const guidance = [];
  for (const m of body.matchAll(/<tr class="outcome_content_child">\s*<td class="outcome_content_child_identifier">([\s\S]*?)<\/td>\s*<td class="indicator_child_text">([\s\S]*?)<\/td>\s*<\/tr>/g)) {
    const label = text(m[1]).replace(/^\(|\)$/g, "").trim();
    // Rows without a letter are notes printed among the indicators, not indicators.
    if (label) indicators.push({ label, text: text(m[2]) });
    else guidance.push(text(m[2]));
  }
  return { indicators, guidance };
}

/* ---------- Ministry CSV files ---------- */

function parseCsvList(html) {
  const names = new Set();
  for (const m of html.matchAll(/\/bbcswebdav\/library\/outcomes\/csvFiles\/([^"?#]+\.csv)/gi)) names.add(decodeURIComponent(m[1]));
  return [...names];
}
/** Rows of [type, code, text]. The files are either quoted comma-separated or pipe-delimited. */
function parseCsv(raw) {
  const src = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const rows = [];
  if (!src.trimStart().startsWith('"')) {
    for (const line of src.split(/\r?\n/)) if (line.trim()) rows.push(line.split("|"));
  } else {
    // Quoted fields may contain commas, doubled quotes and line breaks.
    let row = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (q) {
        if (c === '"' && src[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && src[i + 1] === "\n") i++;
        row.push(cur);
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
        cur = "";
      } else cur += c;
    }
    row.push(cur);
    if (row.some((x) => x.trim())) rows.push(row);
  }
  // Some files hold HTML (<b>, &ndash;) or JavaScript-style escapes (backslash-u2264): reduce cells to what they show.
  const escaped = new RegExp(String.fromCharCode(92, 92) + "u([0-9a-fA-F]{4})", "g");
  const clean = (c) => text(c.replace(escaped, (_, h) => String.fromCharCode(parseInt(h, 16))));
  return rows.map((r) => r.map(clean));
}
/**
 * For comparison only (the stored text is never changed this way): the words in order,
 * ignoring case, spacing, punctuation, list bullets and quote styles.
 */
const comparable = (s) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
/**
 * What the course page prints after a statement and the outcome page prints apart from it:
 * process codes ("([C, CN, ME])", "(DM, SI, TPS)") and footnotes ("(* … see Appendix A.)").
 */
const withoutTrailingBrackets = (s) => s.replace(/\s*(?:\(?\[[^\]]*\]\)?|\((?:[A-Z]{1,4}\s*,?\s*)+\)|\(\*[^)]*\))\s*$/, "");
/** "match": same words. "prefix": the CSV stops early (it shortens long statements). */
function compareWithCsv(csvText, statement) {
  const a = comparable(csvText);
  const b = comparable(statement);
  if (!a) return "mismatch";
  if (a === b) return "match";
  if (a.length >= 30 && b.startsWith(a)) return "prefix";
  return "mismatch";
}

/* ---------- level of an outcome ---------- */

function levelOf(code, unitName, courseLevels) {
  const fromCode = code.match(LEVEL);
  if (fromCode) return Number(fromCode[2]);
  const fromUnit = (unitName ?? "").match(LEVEL);
  if (fromUnit) return Number(fromUnit[2]);
  return courseLevels.length === 1 ? courseLevels[0] : null;
}

/* ---------- run ---------- */

async function main() {
  console.log("Reading the course list from curriculum.gov.sk.ca …");
  const home = await get(`${SITE}/`);
  if (typeof home !== "string") throw new Error(`Home page: ${home.error}`);
  const all = parseCourseList(home);
  const secondary = all.filter((c) => isSecondary(c.name) && (ONLY.length === 0 || ONLY.includes(c.curriculumId)));
  const excluded = all.filter((c) => !isSecondary(c.name));
  console.log(`  ${all.length} curricula on the site; ${secondary.length} are Grade 10–12 courses.`);

  console.log("Reading the Ministry's CSV file list …");
  const csvList = await get(CSV_DIR);
  const csvNames = typeof csvList === "string" ? parseCsvList(csvList) : [];
  // "_I" files are French immersion and "_F" files Fransaskois versions; Funza reads the English ones.
  const englishCsv = csvNames.filter((n) => !/_[IF]\.csv$/i.test(n));
  console.log(`  ${csvNames.length} CSV files (${englishCsv.length} English).`);

  const courses = [];
  const anomalies = [];
  let skippedTotal = 0;
  for (const [n, c] of secondary.entries()) {
    console.log(`[${n + 1}/${secondary.length}] ${c.name}`);
    const pageUrl = `${SITE}/CurriculumOutcomeContent?id=${c.curriculumId}`;
    const page = await get(pageUrl);
    const levels = levelsInName(c.name);
    const version = (c.name.match(/\((\d{4}(?: PRELIMINARY)?)\)/) ?? [, null])[1];
    const base = {
      id: `sk-${c.curriculumId}`,
      curriculumId: c.curriculumId,
      name: c.name,
      subject: c.subject,
      levels,
      grades: levels.map(gradeOf),
      version,
      preliminary: /PRELIMINARY/i.test(c.name),
      renewal: /Renewal/i.test(c.name),
      url: `${SITE}/CurriculumHome?id=${c.curriculumId}`,
      outcomesUrl: pageUrl,
    };
    if (typeof page !== "string") {
      courses.push({ ...base, pageSha256: null, csvFiles: [], units: [], outcomes: [], problem: `The outcomes page could not be read (${page.error}).` });
      anomalies.push(`${c.name}: outcomes page could not be read (${page.error}).`);
      continue;
    }
    const parsed = parseOutcomesPage(page, c.curriculumId);

    // Cross-check source: the Ministry's English CSV files for this curriculum id.
    const files = englishCsv.filter((f) => f.startsWith(`${c.curriculumId}_`));
    const csvOutcomes = new Map();
    for (const f of files) {
      const raw = await get(CSV_FILE + encodeURIComponent(f));
      if (typeof raw !== "string") {
        anomalies.push(`${c.name}: CSV file ${f} could not be read (${raw.error}).`);
        continue;
      }
      for (const [type, code, statement] of parseCsv(raw)) if (/^(outcome|module)$/i.test(type ?? "") && code) csvOutcomes.set(code.trim(), statement ?? "");
    }

    // Fetch (or read from the cache) every outcome page first, a few at a time.
    const pending = parsed.outcomes.map((o) => `${SITE}/CurriculumOutcomeContent?id=${c.curriculumId}&oc=${o.ocId}`);
    let next = 0;
    await Promise.all(
      Array.from({ length: WORKERS }, async () => {
        while (next < pending.length) await get(pending[next++]);
      }),
    );

    const outcomes = [];
    const withoutStatement = [];
    const seenCodes = new Set();
    for (const o of parsed.outcomes) {
      const url = `${SITE}/CurriculumOutcomeContent?id=${c.curriculumId}&oc=${o.ocId}`;
      const detail = await get(url);
      const notes = [];
      const onCoursePage = withoutTrailingBrackets(o.statement);
      let statement = onCoursePage;
      let printedWith = null;
      let indicators = [];
      let guidance = [];
      // Module pages (Practical and Applied Arts) list the module name where other courses print the code.
      let code = o.code;
      let isModule = false;
      if (typeof detail === "string") {
        const d = parseOutcomePage(detail);
        // The outcome's own page is the fuller copy (it keeps lists the course page may shorten).
        if (d.statement) statement = d.statement;
        printedWith = d.printedWith;
        indicators = d.indicators;
        guidance = d.guidance;
        if (d.module) {
          isModule = true;
          code = d.header || o.code;
          if (d.module !== o.code) notes.push(`The outcome page names the module “${d.module}”; the course page says “${o.code}”.`);
        } else if (d.header && d.header !== o.code) notes.push(`The outcome page is headed “${d.header}”; the course page says “${o.code}”.`);
        if (d.statement && comparable(d.statement) !== comparable(onCoursePage)) notes.push(`The course page words it: “${onCoursePage}”. The outcome page's wording is kept.`);
        const labels = indicators.map((i) => i.label);
        const dup = [...new Set(labels.filter((l, i) => labels.indexOf(l) !== i))];
        if (dup.length > 0) notes.push(`Indicator label${dup.length > 1 ? "s" : ""} ${dup.map((l) => `(${l})`).join(", ")} printed more than once on the official page.`);
        if (indicators.length === 0) notes.push("No indicators are printed for this outcome.");
      } else notes.push(`The outcome's own page could not be read (${detail.error}); indicators are missing.`);
      // Nothing to align to: e.g. Practical and Applied Arts "Extended Study" modules, which teachers design themselves.
      if (!statement) {
        withoutStatement.push(`${code}${printedWith ? ` (${printedWith.split(" · ")[0]})` : ""}`);
        continue;
      }
      if (seenCodes.has(code)) notes.push(`The code ${code} appears more than once in this curriculum.`);
      seenCodes.add(code);
      const unitName = parsed.units.find((u) => u.ocId === o.unitOcId)?.name ?? null;
      // A module's number is not a level (ACCT20 is module 20), and modules are shared by the course's levels.
      const level = isModule ? (levels.length === 1 ? levels[0] : null) : levelOf(code, unitName, levels);
      let csv = "no-file";
      if (files.length > 0) {
        const fromCsv = csvOutcomes.get(code);
        csv = fromCsv === undefined || !comparable(fromCsv) ? "missing" : compareWithCsv(fromCsv, statement);
        if (csv === "mismatch") notes.push(`The Ministry CSV words it: “${fromCsv}”.`);
      }
      outcomes.push({
        id: `sk-${c.curriculumId}-${o.ocId}`,
        ocId: o.ocId,
        code,
        statement,
        printedWith,
        unitId: o.unitOcId ? `sk-${c.curriculumId}-u${o.unitOcId}` : null,
        level,
        grade: gradeOf(level),
        url,
        fingerprint: `sha256:${sha256(statement)}`,
        status: csv === "match" || csv === "prefix" ? "cross-checked" : "imported",
        csv,
        indicators,
        guidance,
        notes,
      });
      notes.forEach((x) => anomalies.push(`${c.name} · ${code}: ${x}`));
    }

    // A unit's level is the level its outcomes share, else one printed in its name.
    const units = parsed.units.map((u) => {
      const own = [...new Set(outcomes.filter((o) => o.unitId === `sk-${c.curriculumId}-u${u.ocId}`).map((o) => o.level))];
      const fromName = u.name.match(LEVEL);
      const level = own.length === 1 && own[0] !== null ? own[0] : fromName ? Number(fromName[2]) : levels.length === 1 ? levels[0] : null;
      return { id: `sk-${c.curriculumId}-u${u.ocId}`, ocId: u.ocId, name: u.name, level, url: `${SITE}/CurriculumOutcomeContent?id=${c.curriculumId}&oc=${u.ocId}` };
    });

    const unmatchedCsv = [...csvOutcomes.keys()].filter((code) => !seenCodes.has(code));
    if (unmatchedCsv.length > 0) anomalies.push(`${c.name}: the CSV lists ${unmatchedCsv.length} outcome code(s) not on the website: ${unmatchedCsv.slice(0, 8).join(", ")}${unmatchedCsv.length > 8 ? "…" : ""}.`);
    if (outcomes.length === 0) anomalies.push(`${c.name}: no outcomes are published on its outcomes page.`);
    const unresolved = outcomes.filter((o) => o.level === null).length;
    if (unresolved > 0) anomalies.push(`${c.name}: the level of ${unresolved} outcome(s) could not be worked out from the code, unit or course name.`);
    if (withoutStatement.length > 0) {
      skippedTotal += withoutStatement.length;
      anomalies.push(`${c.name}: left out ${withoutStatement.length} entr${withoutStatement.length === 1 ? "y" : "ies"} with no outcome statement on the site: ${withoutStatement.join(", ")}.`);
    }
    const unitsOnly = outcomes.length === 0 && units.length > 0;
    courses.push({
      ...base,
      pageSha256: sha256(page),
      csvFiles: files,
      units,
      outcomes,
      problem:
        outcomes.length > 0
          ? null
          : unitsOnly
            ? `The site lists ${units.length} unit names only and says the rest is in the curriculum document.`
            : "No outcomes are published on the site for this curriculum.",
    });
  }

  const today = new Date().toLocaleDateString("en-CA"); // local date, YYYY-MM-DD
  const dataset = {
    jurisdiction: "SK",
    name: "Saskatchewan Grade 10–12 curricula",
    importedOn: today,
    importer: "scripts/curriculum/import-sk.mjs",
    sources: { site: `${SITE}/`, csv: "https://www.edonline.sk.ca/bbcswebdav/library/outcomes/csvFiles" },
    statusMeaning: {
      imported: "Copied automatically from the outcome's official page. Not yet checked by a person.",
      "cross-checked":
        "Copied automatically from the outcome's official page, and the Ministry's CSV file has the same words in the same order (ignoring punctuation and spacing; the CSV shortens some long statements, and then its words must match the start). Not yet checked by a person.",
    },
    csvMeaning: {
      match: "The CSV has the same words.",
      prefix: "The CSV has the same words up to where it stops; it shortens long statements.",
      mismatch: "The CSV words the statement differently (see the outcome's notes).",
      missing: "The curriculum has a CSV file, but this code is not in it or has no wording there.",
      "no-file": "The Ministry has no English CSV file for this curriculum.",
    },
    excluded: excluded.map((c) => ({ curriculumId: c.curriculumId, name: c.name })),
    courses,
  };
  writeFileSync(join(OUT, "sk.json"), JSON.stringify(dataset), "utf8");

  const out = courses.flatMap((c) => c.outcomes);
  const count = (f) => out.filter(f).length;
  const lines = [
    "# Saskatchewan Grade 10–12 curriculum import",
    "",
    `Imported on ${today} by \`scripts/curriculum/import-sk.mjs\` from curriculum.gov.sk.ca, cross-checked against the Ministry's CSV files on EDonline. Generated file: do not edit by hand; re-run the importer.`,
    "",
    "| | Count |",
    "|---|---|",
    `| Curricula on the site | ${all.length} |`,
    `| Grade 10–12 curricula imported | ${courses.length} |`,
    `| …with outcomes published | ${courses.filter((c) => c.outcomes.length > 0).length} |`,
    `| Units | ${courses.reduce((n, c) => n + c.units.length, 0)} |`,
    `| Outcomes | ${out.length} |`,
    `| Indicators | ${out.reduce((n, o) => n + o.indicators.length, 0)} |`,
    `| Outcomes whose wording matches the Ministry CSV | ${count((o) => o.csv === "match")} |`,
    `| Outcomes whose wording matches the start of a shortened CSV statement | ${count((o) => o.csv === "prefix")} |`,
    `| Outcomes whose wording differs from the CSV | ${count((o) => o.csv === "mismatch")} |`,
    `| Outcomes missing from their CSV | ${count((o) => o.csv === "missing")} |`,
    `| Outcomes with no CSV file to check against | ${count((o) => o.csv === "no-file")} |`,
    `| Outcomes checked by a person | 0 |`,
    `| Entries left out because the site prints no outcome statement (e.g. Extended Study modules) | ${skippedTotal} |`,
    "",
    "## Courses",
    "",
    "| Course | Levels | Outcomes | Indicators | Cross-checked | Note |",
    "|---|---|---|---|---|---|",
    ...courses.map((c) => `| [${c.name}](${c.url}) | ${c.levels.join(", ")} | ${c.outcomes.length} | ${c.outcomes.reduce((n, o) => n + o.indicators.length, 0)} | ${c.outcomes.filter((o) => o.status === "cross-checked").length} | ${c.problem ?? (c.csvFiles.length === 0 ? "No CSV file" : "")} |`),
    "",
    "## Things a person should look at",
    "",
    ...(anomalies.length ? anomalies.map((a) => `- ${a}`) : ["- None."]),
    "",
    "## Not imported",
    "",
    `Curricula on the site that are not 10-, 20- or 30-level courses (Kindergarten to Grade 9, K-12 frameworks, Treaty Education): ${excluded.length}.`,
    ...(unknownEntities.size ? ["", `HTML entities left as printed because the importer did not recognise them: ${[...unknownEntities].join(", ")}.`] : []),
    "",
  ];
  writeFileSync(join(OUT, "sk-report.md"), lines.join("\n"), "utf8");
  console.log(`Done: ${courses.length} courses, ${out.length} outcomes, ${out.reduce((n, o) => n + o.indicators.length, 0)} indicators. ${fetched} pages fetched, ${cached} from cache.`);
}

// Run only when executed directly; tests import the parsers below.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { compareWithCsv, comparable, decode, isSecondary, levelsInName, parseCourseList, parseCsv, parseOutcomePage, parseOutcomesPage, text, withoutTrailingBrackets };
