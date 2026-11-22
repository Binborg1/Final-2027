#!/usr/bin/env node
/**
 * Imports every Saskatchewan Grade 10–12 curriculum (10-, 20- and 30-level courses)
 * from the official sources into Funza's curriculum dataset.
 *
 *   node scripts/curriculum/import-sk.mjs              # English site; cached pages where present
 *   node scripts/curriculum/import-sk.mjs --lang=fr    # French site (immersion and Fransaskois)
 *   node scripts/curriculum/import-sk.mjs --refresh    # fetch everything again
 *   node scripts/curriculum/import-sk.mjs --only=63,155
 *   node scripts/curriculum/import-sk.mjs --offline    # cache only: never touch the network
 *
 * Sources (all published by the Saskatchewan Ministry of Education):
 *   1. curriculum.gov.sk.ca: the course list and menus, each course's outcomes page (units,
 *      outcome codes and statements), each outcome's page (its indicators) and, for
 *      module-based courses, each "Course Configuration" page (&occ=).
 *   2. The Ministry's CSV files on EDonline, used only to cross-check the website copy.
 *   3. Curriculum documents (PDF) for courses whose outcomes are not published online:
 *      verbatim extractions committed in src/data/curriculum/documents/<curriculumId>.json
 *      (made by scripts/curriculum/documents/), checked here against the PDF's SHA-256.
 *   4. src/data/curriculum/evidence/: quoted evidence for how each course is grouped, the
 *      ELA theme-to-course-part citations, course status evidence and the French-to-English
 *      course equivalents.
 *
 * Output (English; --lang=fr writes sk-fr.json and sk-fr-report.md):
 *   src/data/curriculum/sk.json        the dataset the app reads
 *   src/data/curriculum/sk-report.md   what was imported, cross-check results, anomalies
 *   src/data/curriculum/by-grade/      the same courses split by grade (scripts/curriculum/split-by-grade.mjs)
 * Raw pages are cached in .cache/curriculum/sk/ (not committed).
 *
 * Nothing here is rewritten or summarised: codes, statements and indicators are kept
 * exactly as printed (tags stripped, entities decoded, whitespace normalised).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { APP, get, getBytes, pool, sha256, stats } from "./fetch.mjs";
import {
  assertNoUnknownEntities,
  comparable,
  compareWithCsv,
  decode,
  decodedEntities,
  gradeOf,
  isSecondary,
  LEVEL,
  levelOf,
  levelsInName,
  linkedMenus,
  menuCurriculumIds,
  menuSubjects,
  pageNotFound,
  parseConfigurationPage,
  parseCourseList,
  parseCsv,
  parseCsvList,
  parseOutcomePage,
  parseOutcomesPage,
  text,
  withoutTrailingBrackets,
} from "./parse.mjs";
import { splitByGrade } from "./split-by-grade.mjs";

const OUT = join(APP, "src", "data", "curriculum");
const DOCS = join(OUT, "documents");
const EVIDENCE = join(OUT, "evidence");
const SITE = "https://curriculum.gov.sk.ca";
const CSV_DIR = "https://www.edonline.sk.ca/webapps/cmsmain/webui/library/outcomes/csvFiles?sortDir=ASCENDING&showAll=true&editPaging=false&subaction=view&action=frameset&startIndex=0";
const CSV_FILE = "https://www.edonline.sk.ca/bbcswebdav/library/outcomes/csvFiles/";

const args = process.argv.slice(2);
const ONLY = (args.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean).map(Number);
const LANG = (args.find((a) => a.startsWith("--lang=")) ?? "--lang=en").slice(7);

const SITES = {
  en: {
    home: `${SITE}/`,
    // "Browse by Subject"; the home page itself carries "Browse by Grade".
    menus: [`${SITE}/Megamenu?name=subject`],
    csv: (name) => !/_[IF]\.csv$/i.test(name),
    out: "sk",
    name: "Saskatchewan Grade 10–12 curricula",
  },
  fr: {
    home: `${SITE}/Home?language=fr`,
    menus: [`${SITE}/Megamenu?name=immersion`, `${SITE}/Megamenu?name=fransaskois`, `${SITE}/Megamenu?name=coreFrench&language=fr`],
    // "_I" files are French immersion and "_F" files Fransaskois versions.
    csv: (name) => /_[IF]\.csv$/i.test(name),
    out: "sk-fr",
    name: "Saskatchewan Grade 10–12 curricula (French: immersion and Fransaskois)",
  },
};
const SITE_CONFIG = SITES[LANG];
if (!SITE_CONFIG) throw new Error(`Unknown --lang=${LANG}; use en or fr.`);

const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback);

/* ---------- committed inputs ---------- */

/** Verbatim document extractions, keyed by curriculum id. */
function loadDocuments() {
  if (!existsSync(DOCS)) return new Map();
  const out = new Map();
  for (const f of readdirSync(DOCS).filter((n) => /^\d+\.json$/.test(n))) {
    const d = JSON.parse(readFileSync(join(DOCS, f), "utf8"));
    if (d.curriculumId !== Number(f.slice(0, -5))) throw new Error(`documents/${f} holds curriculum ${d.curriculumId}.`);
    out.set(d.curriculumId, d);
  }
  return out;
}

/** Item fields that mark a line a person should check against the printed page. */
function itemFlags(it) {
  const out = [];
  for (const f of it.flags ?? []) out.push(f);
  if (it.segmentationUncertain) out.push("segmentationUncertain: the extraction may have split or joined this item wrongly");
  if (it.ocrLowConfidence) out.push("ocrLowConfidence: at least one OCR line scored low or was split at a column edge");
  if (it.ocrSuspect) out.push("ocrSuspect: characters typical of OCR misreads");
  if (typeof it.textLayerCheck === "string" && it.textLayerCheck !== "exact") out.push(`textLayerCheck: ${it.textLayerCheck} (compared with the PDF's own text layer)`);
  return out;
}

/** The course-level `document` block: the committed extraction plus where it came from. */
function documentBlock(doc, check) {
  const flags = [];
  doc.units.forEach((u, ui) =>
    u.items.forEach((it, ii) => {
      const f = itemFlags(it);
      if (f.length) flags.push({ unit: ui, item: ii, code: it.code ?? it.label ?? null, flags: f });
    }),
  );
  const units = doc.units.map((u) => {
    const { items, ...meta } = u;
    return { ...meta, name: u.name ?? null, items };
  });
  return {
    status: doc.textSource === "ocr" ? "document-ocr-unverified" : "document-extracted",
    textSource: doc.textSource,
    url: doc.source.url,
    filename: doc.source.filename ?? null,
    sha256: doc.source.sha256,
    retrievedOn: doc.source.retrievedOn,
    pages: doc.source.pages ?? null,
    kind: doc.kind,
    ...(doc.partial ? { partial: true, partialReason: doc.partialReason } : {}),
    file: `src/data/curriculum/documents/${doc.curriculumId}.json`,
    check,
    units,
    flags,
    notes: doc.notes ?? [],
  };
}

/** Outcome pages the import leaves out because they print no statement ("curriculumId:oc"). */
const leftOut = new Set();

/** How a course's `problem` names the document its outcomes or objectives come from. */
function documentText(doc, fileUrl, curriculumFile) {
  const what = doc.kind === "outcomes" ? "outcomes" : "objectives";
  const fileNote = curriculumFile === "page-not-found" ? `its curriculum document link (${fileUrl}) answers the same “Page Not Found” page; ` : curriculumFile === "http-404" ? `its curriculum document link (${fileUrl}) answers HTTP 404; ` : "";
  const which = doc.source.url === fileUrl ? "its curriculum document" : "the curriculum document the site's menus link";
  return `${fileNote}the ${what} are taken from ${which} (${doc.source.url}); see \`document\`${doc.textSource === "ocr" ? " (OCR text, not yet proofread)" : ""}`;
}

/* ---------- configurations (module-based courses) ---------- */

const DESIGNATION = /\((Core|Optional|principal|facultatif|optionnel)\)\s*$/i;
const isExtendedStudy = (code, name) => /99[A-Z]?$/.test(code.replace(/\s/g, "")) || /Extended Study|Étude approfondie/i.test(name ?? "");

/**
 * Resolves a module printed on a configuration page to an outcome in the dataset. The site's
 * link (curriculum id + oc) is the authority; an entry without a link is matched by its code,
 * and a code that matches nothing is tried against the printing slips the research found
 * (a dropped leading zero, transposed prefix letters, a letter dropped from the code but shown
 * in the module label). Every correction is flagged; nothing is corrected silently.
 */
function resolveModule(m, courseId, byOc, byCode, courseCodes) {
  const out = { code: m.code, name: m.name, ocId: m.ocId, curriculumId: m.curriculumId };
  const designation = (m.name.match(DESIGNATION) ?? [])[1];
  if (designation) out.designation = designation;
  let target = null;
  if (m.curriculumId && m.ocId) {
    target = byOc.get(`${m.curriculumId}:${m.ocId}`) ?? null;
    if (!target) out.note = isExtendedStudy(m.code, m.name) ? "Extended Study: the site prints no outcome statement for it, so the dataset leaves it out." : leftOut.has(`${m.curriculumId}:${m.ocId}`) ? "The site links an outcome page that prints no outcome statement, so the dataset leaves it out." : "The site links an outcome page that is not in the dataset.";
  } else {
    const printed = m.code.replace(/\s+/g, "");
    if (printed !== m.code) out.printedWithSpace = true;
    target = courseCodes.get(printed) ?? byCode.get(printed) ?? null;
    if (target) out.matchedBy = "code (the site does not link this entry)";
    else {
      const [, pre, num, suf] = printed.match(/^([A-Z]+)(\d+)([A-Z]?)$/) ?? [];
      const candidates = [];
      if (pre) {
        for (const [code, o] of courseCodes) {
          const [, p2, n2, s2] = code.match(/^([A-Z]+)(\d+)([A-Z]?)$/) ?? [];
          if (!p2) continue;
          if (p2 === pre && Number(n2) === Number(num) && s2 === suf && n2 !== num) candidates.push([o, "printed without the leading zero of the dataset code"]);
          if (p2 !== pre && [...p2].sort().join("") === [...pre].sort().join("") && n2 === num && s2 === suf) candidates.push([o, "printed with the letters of the code prefix transposed"]);
        }
        for (const [code, o] of byCode) {
          const [, p2, n2, s2] = code.match(/^([A-Z]+)(\d+)([A-Z]?)$/) ?? [];
          if (p2 === pre && Number(n2) === Number(num) && s2 === suf && n2 !== num && !courseCodes.has(code)) candidates.push([o, "printed without the leading zero of the dataset code"]);
        }
        const label = m.name.match(/^Module (\d+)([A-Z])\b/);
        if (label && !suf && label[1] === num && courseCodes.has(printed + label[2])) candidates.push([courseCodes.get(printed + label[2]), `printed without the letter its label carries (Module ${label[1]}${label[2]})`]);
      }
      if (candidates.length === 1) {
        [target, out.correction] = candidates[0];
      } else if (isExtendedStudy(m.code, m.name)) out.note = "Extended Study: the site prints no outcome statement for it, so the dataset leaves it out.";
      else out.note = candidates.length > 1 ? "The printed code could match more than one dataset code; left unresolved." : "No outcome in the dataset has this code.";
    }
  }
  if (target) {
    out.outcomeId = target.id;
    if (target.curriculumId !== courseId) out.borrowedFrom = target.curriculumId;
    if (target.code !== m.code) {
      out.datasetCode = target.code;
      if (!out.correction) out.correction = m.curriculumId ? "the site links this entry to the outcome page of the dataset code" : "printed with a space inside the code";
    }
  }
  out.inDataset = Boolean(target);
  return out;
}

/* ---------- run ---------- */

async function main() {
  mkdirSync(OUT, { recursive: true });
  const documents = LANG === "en" ? loadDocuments() : new Map();
  const groupingEvidence = LANG === "en" ? readJson(join(EVIDENCE, "groupings.json"), {}) : {};
  const elaThemes = LANG === "en" ? readJson(join(EVIDENCE, "ela-themes.json"), {}) : {};
  const statusEvidence = readJson(join(EVIDENCE, "status.json"), { legacy: {}, notACurriculum: {}, discrepancies: [] });
  const equivalents = LANG === "fr" ? (readJson(join(EVIDENCE, "fr-english-equivalents.json"), {}).equivalents ?? {}) : {};

  console.log(`Reading the course list from ${SITE_CONFIG.home} …`);
  const home = await get(SITE_CONFIG.home);
  if (typeof home !== "string") throw new Error(`Home page: ${home.error}`);
  const all = parseCourseList(home);

  // Which curricula the site's menus list (the home page's own "Browse by Grade" menu and the menu pages).
  const menuIds = new Set(menuCurriculumIds(home));
  // Documents the menus link directly (e.g. "Treaty Education Outcomes & Indicators").
  const menuDocuments = new Set();
  const addDocumentLinks = (html) => {
    for (const m of html.matchAll(/href="(https:\/\/www\.edonline\.sk\.ca\/bbcswebdav\/xid-[^"]+)"/g)) menuDocuments.add(m[1]);
  };
  addDocumentLinks(home.slice(0, home.indexOf("</nav>")));
  const menuUrls = [...SITE_CONFIG.menus];
  const subjectOf = new Map();
  for (let i = 0; i < menuUrls.length; i++) {
    const page = await get(menuUrls[i]);
    if (typeof page !== "string") throw new Error(`Menu ${menuUrls[i]}: ${page.error}`);
    for (const id of menuCurriculumIds(page)) menuIds.add(id);
    addDocumentLinks(page);
    if (/name=subject$/.test(menuUrls[i])) for (const [id, s] of menuSubjects(page)) subjectOf.set(id, s);
    for (const m of linkedMenus(page)) {
      const url = `${SITE}/Megamenu?name=${m.name}&language=${m.language}`;
      if (!menuUrls.includes(url)) menuUrls.push(url);
    }
  }

  // Curricula outside 10/20/30 naming that have a committed Grade 10–12 document (Treaty Education).
  const fromDocuments = all.filter((c) => !isSecondary(c.name) && documents.get(c.curriculumId)?.levels?.length);
  const secondary = all.filter((c) => (isSecondary(c.name) || fromDocuments.includes(c)) && (ONLY.length === 0 || ONLY.includes(c.curriculumId)));
  const excluded = all.filter((c) => !isSecondary(c.name) && !fromDocuments.includes(c));
  console.log(`  ${all.length} curricula on the site; ${secondary.length} are Grade 10–12 courses.`);

  console.log("Reading the Ministry's CSV file list …");
  const csvList = await get(CSV_DIR);
  const csvNames = typeof csvList === "string" ? parseCsvList(csvList) : [];
  const ownCsv = csvNames.filter(SITE_CONFIG.csv);
  console.log(`  ${csvNames.length} CSV files (${ownCsv.length} for this site).`);

  const courses = [];
  const anomalies = [];
  const pageProblems = [];
  let skippedTotal = 0;
  for (const [n, c] of secondary.entries()) {
    console.log(`[${n + 1}/${secondary.length}] ${c.name}`);
    const pageUrl = `${SITE}/CurriculumOutcomeContent?id=${c.curriculumId}`;
    const fileUrl = `${SITE}/CurriculumFile?id=${c.curriculumId}`;
    const page = await get(pageUrl);
    const doc = documents.get(c.curriculumId) ?? null;
    const levels = levelsInName(c.name).length ? levelsInName(c.name) : (doc?.levels ?? []);
    const version = (c.name.match(/\((\d{4}(?: PRELIMINARY| PRÉLIMINAIRE)?)\)/) ?? [, null])[1];
    const legacy = statusEvidence.legacy[c.curriculumId];
    const notACurriculum = statusEvidence.notACurriculum[c.curriculumId];
    const base = {
      id: `sk-${c.curriculumId}`,
      curriculumId: c.curriculumId,
      name: c.name,
      subject: c.subject,
      ...(subjectOf.has(c.curriculumId) ? { menuSubject: subjectOf.get(c.curriculumId) } : {}),
      levels,
      grades: levels.map(gradeOf),
      version,
      preliminary: /PRELIMINARY|PRÉLIMINAIRE/i.test(c.name),
      renewal: /Renewal/i.test(c.name),
      listedInMenu: menuIds.has(c.curriculumId) || (doc !== null && menuDocuments.has(doc.source.url)),
      ...(!menuIds.has(c.curriculumId) && doc !== null && menuDocuments.has(doc.source.url) ? { menuLink: doc.source.url } : {}),
      legacy: Boolean(legacy),
      ...(legacy ? { legacyEvidence: legacy } : {}),
      notACurriculum: Boolean(notACurriculum),
      ...(notACurriculum ? { notACurriculumEvidence: notACurriculum } : {}),
      ...(doc?.crossCurricular ? { crossCurricular: true } : {}),
      ...(LANG === "fr"
        ? {
            language: "fr",
            program: /\(Immersion\)\s*$/.test(c.name) ? "immersion" : /\(Fransaskois\)\s*$/.test(c.name) ? "fransaskois" : null,
            englishEquivalent: equivalents[c.curriculumId] ?? null,
          }
        : {}),
      url: `${SITE}/CurriculumHome?id=${c.curriculumId}`,
      outcomesUrl: pageUrl,
    };

    // The curriculum document: checked against the committed extraction's hash, or probed when the site publishes nothing.
    let documentInfo = null;
    const checkDocument = async (url) => {
      const r = await getBytes(url);
      if (!r.bytes) return { state: r.status === 404 ? "http-404" : "unreadable", detail: r.error };
      const html = r.bytes.subarray(0, 5).toString("latin1") === "%PDF-" ? null : r.bytes.toString("utf8");
      if (html && pageNotFound(html)) return { state: "page-not-found", detail: pageNotFound(html) };
      if (html) return { state: "not-a-pdf" };
      return { state: "pdf", sha256: sha256(r.bytes) };
    };

    if (typeof page !== "string") {
      courses.push({ ...base, pageSha256: null, csvFiles: [], units: [], outcomes: [], availability: { outcomesPage: "unreadable" }, problem: `The outcomes page could not be read (${page.error}).` });
      anomalies.push(`${c.name}: outcomes page could not be read (${page.error}).`);
      continue;
    }
    const notFound = pageNotFound(page);
    const parsed = notFound ? { units: [], outcomes: [], themes: [], problems: [], configurations: [] } : parseOutcomesPage(page, c.curriculumId);
    if (parsed.problems.length) throw new Error(`${c.name}: the outcomes page's unit groups are not as expected: ${parsed.problems.join("; ")}`);

    // Cross-check source: the Ministry's CSV files for this curriculum id.
    const files = ownCsv.filter((f) => f.startsWith(`${c.curriculumId}_`));
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
    const outcomeUrl = (oc) => `${SITE}/CurriculumOutcomeContent?id=${c.curriculumId}&oc=${oc}`;
    await pool(parsed.outcomes, (o) => get(outcomeUrl(o.ocId)));

    const outcomes = [];
    const withoutStatement = [];
    const seenCodes = new Set();
    for (const o of parsed.outcomes) {
      const url = outcomeUrl(o.ocId);
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
        leftOut.add(`${c.curriculumId}:${o.ocId}`);
        withoutStatement.push(`${code}${printedWith ? ` (${printedWith.split(" · ")[0]})` : ""}`);
        continue;
      }
      if (seenCodes.has(code)) notes.push(`The code ${code} appears more than once in this curriculum.`);
      seenCodes.add(code);
      const unitName = parsed.units.find((u) => u.ocId === o.unitOcId)?.name ?? null;
      // A module's number is not a level (ACCT20 is module 20); modules get their levels from the course configurations below.
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
        levels: level ? [level] : [],
        grade: gradeOf(level),
        url,
        fingerprint: `sha256:${sha256(statement)}`,
        status: csv === "match" || csv === "prefix" ? "cross-checked" : "imported",
        csv,
        indicators,
        guidance,
        notes,
        ...(isModule ? { module: true } : {}),
      });
    }

    // A unit's level is the level its outcomes share, else one printed in its name. Units carry their outcomes explicitly.
    const kept = new Set(outcomes.map((o) => o.ocId));
    const units = parsed.units.map((u) => {
      const id = `sk-${c.curriculumId}-u${u.ocId}`;
      const own = [...new Set(outcomes.filter((o) => o.unitId === id).map((o) => o.level))];
      const fromName = u.name.match(LEVEL);
      const level = own.length === 1 && own[0] !== null ? own[0] : fromName ? Number(fromName[2]) : levels.length === 1 ? levels[0] : null;
      const outcomeIds = u.outcomeOcIds.filter((oc) => kept.has(oc)).map((oc) => `sk-${c.curriculumId}-${oc}`);
      if (u.kind === "outcomes" && outcomeIds.length === 0) anomalies.push(`${c.name}: the unit “${u.name}” lists only entries without an outcome statement (e.g. Extended Study modules), so it holds no outcomes.`);
      return { id, ocId: u.ocId, name: u.name, level, url: `${SITE}/CurriculumOutcomeContent?id=${c.curriculumId}&oc=${u.ocId}`, kind: u.kind, outcomeIds };
    });
    // Invariant: every outcome's unitId names a unit that lists it.
    for (const o of outcomes) {
      if (!o.unitId) continue;
      const u = units.find((x) => x.id === o.unitId);
      if (!u || !u.outcomeIds.includes(o.id)) throw new Error(`${c.name} ${o.code}: unitId ${o.unitId} does not resolve to a unit that lists the outcome.`);
    }

    // ELA's "Units" group: suggested thematic units, verbatim from the site, tied to a course part by the curriculum document only.
    const themeEvidence = elaThemes[c.curriculumId];
    const themes = parsed.themes.map((t) => {
      const part = themeEvidence ? Object.entries(themeEvidence.byCoursePart).find(([, names]) => names.some((x) => comparable(x) === comparable(t.name))) : null;
      if (themeEvidence && !part) anomalies.push(`${c.name}: the theme “${t.name}” is not named in the curriculum document's course parts.`);
      return {
        ocId: t.ocId,
        name: t.name,
        groupOcId: t.groupOcId,
        url: t.ocId ? `${SITE}/FullResourceList?id=${c.curriculumId}#?f_oc_${t.ocId}=true` : null,
        coursePart: part?.[0] ?? null,
        ...(part ? { documentName: part[1].find((x) => comparable(x) === comparable(t.name)), citation: themeEvidence.citation } : {}),
        linkedOutcomes: "none: the curriculum assigns themes to a course part, never to particular outcomes",
      };
    });

    const unmatchedCsv = [...csvOutcomes.keys()].filter((code) => !seenCodes.has(code));
    if (unmatchedCsv.length > 0) anomalies.push(`${c.name}: the CSV lists ${unmatchedCsv.length} outcome code(s) not on the website: ${unmatchedCsv.slice(0, 8).join(", ")}${unmatchedCsv.length > 8 ? "…" : ""}.`);
    const unresolved = outcomes.filter((o) => o.level === null && !o.module).length;
    if (unresolved > 0) anomalies.push(`${c.name}: the level of ${unresolved} outcome(s) could not be worked out from the code, unit or course name.`);
    if (withoutStatement.length > 0) {
      skippedTotal += withoutStatement.length;
      anomalies.push(`${c.name}: left out ${withoutStatement.length} entr${withoutStatement.length === 1 ? "y" : "ies"} with no outcome statement on the site: ${withoutStatement.join(", ")}.`);
    }

    // Why a course has no outcomes, said precisely.
    let problem = null;
    const availability = { outcomesPage: notFound ? "page-not-found" : outcomes.length > 0 ? "published" : units.length > 0 ? "unit-names-only" : "empty" };
    if (outcomes.length === 0) {
      if (doc) {
        const check = await checkDocument(doc.source.url);
        documentInfo = documentBlock(doc, check.state === "pdf" ? (check.sha256 === doc.source.sha256 ? "same-hash" : "changed") : `not-checked (${check.state})`);
        if (documentInfo.check === "changed") anomalies.push(`${c.name}: the curriculum document's SHA-256 (${check.sha256}) differs from the extracted copy's (${doc.source.sha256}): document changed, re-extract.`);
        availability.document = check.state;
        if (doc.source.url !== fileUrl) availability.curriculumFile = (await checkDocument(fileUrl)).state;
      } else {
        const check = await checkDocument(fileUrl);
        availability.document = check.state;
      }
      const notFoundText = notFound ? `The site's outcomes page answers with its “${notFound.heading}” page (HTTP 200): “${notFound.message}”` : null;
      const fileText =
        availability.document === "http-404"
          ? `its curriculum document link (${fileUrl}) answers HTTP 404`
          : availability.document === "page-not-found"
            ? `its curriculum document link (${fileUrl}) answers the same “Page Not Found” page (HTTP 200)`
            : availability.document === "pdf"
              ? doc
                ? documentText(doc, fileUrl, availability.curriculumFile)
                : `its outcomes are only in the curriculum document (${fileUrl}), which has not been extracted`
              : `its curriculum document link (${fileUrl}) could not be read`;
      if (notFoundText) problem = `${notFoundText} ${fileText[0].toUpperCase()}${fileText.slice(1)}.`;
      else if (units.length > 0) problem = `The site lists ${units.length} unit names only and says the rest is in the curriculum document; ${fileText}.`;
      else problem = `No outcomes are published on the site for this curriculum; ${fileText}.`;
      if (notFound || availability.document === "http-404" || availability.document === "page-not-found") pageProblems.push(`${c.name}: ${problem}`);
    }

    // Grouping: how the official source groups this course's outcomes (never invented).
    const ev = groupingEvidence[c.curriculumId];
    let grouping = null;
    if (units.some((u) => u.kind === "outcomes")) {
      grouping = { kind: "unit", evidence: { url: pageUrl, observation: `The outcomes page groups the outcomes under ${units.filter((u) => u.kind === "outcomes").length} unit headings.` } };
    } else if (ev) {
      const first = ev.evidence.find((e) => e.quote) ?? ev.evidence[0];
      grouping = { kind: ev.kind, evidence: first, allEvidence: ev.evidence };
    } else if (parsed.configurations.length > 0) {
      grouping = { kind: "module", evidence: { url: pageUrl, observation: "Each entry on the outcomes page is one module with its own module code; the site lists the course levels under its course configurations." } };
    } else if (units.length > 0) {
      grouping = { kind: "unit", evidence: { url: pageUrl, observation: `The outcomes page lists ${units.length} unit names, with no outcomes under them.` } };
    } else if (documentInfo) {
      const named = documentInfo.units.filter((u) => u.name);
      grouping =
        named.length > 1
          ? { kind: "unit", evidence: { url: documentInfo.url, observation: `The curriculum document groups its ${doc.kind === "outcomes" ? "outcomes" : "objectives"} under ${named.length} headings: ${named.map((u) => `“${u.name}”`).join(", ")}.` } }
          : { kind: "none", evidence: { url: documentInfo.url, observation: `The curriculum document lists its ${doc.kind === "outcomes" ? "outcomes" : "objectives"} under a single heading${named[0] ? ` (“${named[0].name}”)` : ""}.` } };
    }

    // Short official titles (Physical Education), printed before " – " in the statement and in "Outcomes at a Glance".
    if (ev?.outcomeTitles) {
      for (const o of outcomes) {
        const t = (o.statement.match(/^(.+?) – /) ?? [])[1];
        if (!t) continue;
        o.title = t;
        const expected = ev.outcomeTitles.byOutcome[o.code];
        if (expected !== undefined && expected !== t) anomalies.push(`${c.name} ${o.code}: the title “${t}” on the site differs from the curriculum document's “${expected}”.`);
      }
    }
    // The K-12 mathematics goals printed above each outcome's table in the curriculum document.
    if (ev?.goals) {
      for (const o of outcomes) {
        const g = ev.goals.byOutcome[o.code];
        if (!g) continue;
        o.goals = g.goals;
        o.goalsSource = { url: ev.goals.url, page: g.page, ...(g.printedCode && g.printedCode !== o.code ? { printedCode: g.printedCode } : {}) };
      }
    }

    courses.push({
      ...base,
      pageSha256: sha256(page),
      csvFiles: files,
      units,
      ...(themes.length ? { themes } : {}),
      outcomes,
      ...(ev?.suggestedUnits ? { suggestedUnits: ev.suggestedUnits } : {}),
      grouping,
      availability,
      ...(documentInfo ? { document: documentInfo } : {}),
      configurationLinks: parsed.configurations,
      problem,
    });
  }

  /* ---------- course configurations (second pass: modules may be borrowed from other courses) ---------- */

  console.log("Reading course configuration pages …");
  const byOc = new Map();
  const byCode = new Map();
  for (const c of courses)
    for (const o of c.outcomes) {
      const ref = { id: o.id, code: o.code, curriculumId: c.curriculumId };
      byOc.set(`${c.curriculumId}:${o.ocId}`, ref);
      if (!byCode.has(o.code)) byCode.set(o.code, ref);
    }
  const occUrl = (id, occ) => `${SITE}/CurriculumOutcomeContent?id=${id}&occ=${occ}`;
  const allLinks = courses.flatMap((c) => c.configurationLinks.map((l) => occUrl(l.curriculumId, l.occ)));
  await pool(allLinks, (u) => get(u));
  const configIssues = [];
  for (const c of courses) {
    const links = c.configurationLinks ?? [];
    delete c.configurationLinks;
    if (links.length === 0) continue;
    const courseCodes = new Map(c.outcomes.map((o) => [o.code, { id: o.id, code: o.code, curriculumId: c.curriculumId }]));
    c.configurations = [];
    for (const l of links) {
      const url = occUrl(l.curriculumId, l.occ);
      const html = await get(url);
      if (typeof html !== "string") {
        anomalies.push(`${c.name}: configuration page “${l.name}” could not be read (${html.error}).`);
        continue;
      }
      const p = parseConfigurationPage(html);
      const name = p.name ?? l.name;
      const lv = levelsInName(name);
      const config = {
        occ: l.occ,
        name,
        level: lv.length === 1 ? lv[0] : null,
        url,
        sections: p.sections.map((s) => {
          const modules = s.modules.map((m) => resolveModule(m, c.curriculumId, byOc, byCode, courseCodes));
          return { name: s.name, moduleCodes: modules.map((m) => m.code), modules };
        }),
      };
      if (config.level === null) config.note = "No single 10-, 20- or 30-level in its name (e.g. a middle-level survey course suggestion); not used for levels.";
      // Cross-check only: the curriculum PDF's table of the same name (the website stays the authority).
      const pdfConfigs = groupingEvidence[c.curriculumId]?.pdfConfigurations;
      if (pdfConfigs) {
        const siteNames = new Set(links.map((x) => x.name));
        const whole = pdfConfigs.find((p) => p.name === name || (p.subtitle && `${p.name} - ${p.subtitle}` === name));
        const asSection = whole ? null : pdfConfigs.flatMap((p) => p.sections.filter((s) => s.name === name).map((s) => ({ p, s })))[0];
        if (whole || asSection) {
          // PDF sections the website prints as configuration pages of their own are compared there.
          const sections = whole ? whole.sections.filter((s) => !s.name || !siteNames.has(s.name) || s.name === name) : [asSection.s];
          const pdfCodes = sections.flatMap((s) => s.moduleCodes);
          const siteCodes = config.sections.flatMap((s) => s.modules.map((m) => m.datasetCode ?? m.code.replace(/\s+/g, "")));
          const onlyOnSite = siteCodes.filter((x) => !pdfCodes.includes(x));
          const onlyInPdf = pdfCodes.filter((x) => !siteCodes.includes(x));
          const p = whole ?? asSection.p;
          config.pdfCheck = { url: p.url, page: p.page, sameModules: onlyOnSite.length + onlyInPdf.length === 0, sameOrder: JSON.stringify(siteCodes) === JSON.stringify(pdfCodes), ...(onlyOnSite.length ? { onlyOnSite } : {}), ...(onlyInPdf.length ? { onlyInPdf } : {}) };
          if (!config.pdfCheck.sameModules) configIssues.push(`${c.name} · ${name}: the curriculum PDF (p. ${p.page}) differs from the website${onlyOnSite.length ? `; only on the website: ${onlyOnSite.join(", ")}` : ""}${onlyInPdf.length ? `; only in the PDF: ${onlyInPdf.join(", ")}` : ""}. The website is kept.`);
        } else config.pdfCheck = { url: pdfConfigs[0]?.url ?? null, sameModules: null, note: "The curriculum PDF has no configuration of this name." };
      }
      if (p.name && p.name !== l.name) anomalies.push(`${c.name}: the configuration link reads “${l.name}”; its page is headed “${p.name}”.`);
      for (const s of config.sections)
        for (const m of s.modules) {
          if (m.correction) configIssues.push(`${c.name} · ${name}: “${m.code}” → ${m.datasetCode} (${m.correction}).`);
          if (!m.inDataset && !/Extended Study/.test(m.note ?? "")) configIssues.push(`${c.name} · ${name}: “${m.code}” — ${m.note}`);
        }
      c.configurations.push(config);
    }
    // Levels of this course's own modules: the configured levels that include them.
    const configured = new Map();
    for (const cf of c.configurations) {
      if (!cf.level) continue;
      for (const s of cf.sections) for (const m of s.modules) if (m.outcomeId && !m.borrowedFrom) (configured.get(m.outcomeId) ?? configured.set(m.outcomeId, new Set()).get(m.outcomeId)).add(cf.level);
    }
    for (const o of c.outcomes) {
      const set = configured.get(o.id);
      if (!set) {
        if (o.module && c.levels.length > 1) anomalies.push(`${c.name} ${o.code}: the module is in none of the course's 10-, 20- or 30-level configurations, so it has no level.`);
        continue;
      }
      o.levels = [...set].sort();
      o.level = o.levels.length === 1 ? o.levels[0] : null;
      o.grade = gradeOf(o.level);
      o.levelSource = "course configurations";
    }
  }

  /* ---------- write ---------- */

  assertNoUnknownEntities();
  const today = new Date().toLocaleDateString("en-CA"); // local date, YYYY-MM-DD
  const courseIds = new Set(courses.map((c) => c.curriculumId));
  const dataset = {
    jurisdiction: "SK",
    language: LANG,
    name: SITE_CONFIG.name,
    importedOn: today,
    importer: `scripts/curriculum/import-sk.mjs${LANG === "en" ? "" : ` --lang=${LANG}`}`,
    sources: { site: SITE_CONFIG.home, csv: "https://www.edonline.sk.ca/bbcswebdav/library/outcomes/csvFiles", ...(LANG === "en" ? { documents: "src/data/curriculum/documents/", evidence: "src/data/curriculum/evidence/" } : {}) },
    statusMeaning: {
      imported: "Copied automatically from the outcome's official page. Not yet checked by a person.",
      "cross-checked":
        "Copied automatically from the outcome's official page, and the Ministry's CSV file has the same words in the same order (ignoring punctuation and spacing; the CSV shortens some long statements, and then its words must match the start). Not yet checked by a person.",
      "document-extracted": "A course's `document`: copied from the text layer of the official curriculum document (PDF) by scripts/curriculum/documents/. Not yet checked by a person.",
      "document-ocr-unverified": "A course's `document`: read by OCR from a scanned official curriculum document (PDF) and not proofread. Check every item against the printed page before use.",
    },
    csvMeaning: {
      match: "The CSV has the same words.",
      prefix: "The CSV has the same words up to where it stops; it shortens long statements.",
      mismatch: "The CSV words the statement differently (see the outcome's notes).",
      missing: "The curriculum has a CSV file, but this code is not in it or has no wording there.",
      "no-file": "The Ministry has no CSV file for this curriculum.",
    },
    flagsMeaning: {
      listedInMenu: "The site's Browse by Subject or Browse by Grade menus link to the course (otherwise it is reachable only through the search list).",
      legacy: "An older curriculum that a renewed one replaces; see legacyEvidence.",
      preliminary: "A draft (PRELIMINARY or PRÉLIMINAIRE) curriculum.",
      notACurriculum: "A site entry with no curriculum behind it; see notACurriculumEvidence.",
    },
    excluded: excluded.filter((c) => !courseIds.has(c.curriculumId)).map((c) => ({ curriculumId: c.curriculumId, name: c.name })),
    courses,
  };
  writeFileSync(join(OUT, `${SITE_CONFIG.out}.json`), JSON.stringify(dataset), "utf8");
  writeFileSync(join(OUT, `${SITE_CONFIG.out}-report.md`), report({ dataset, all, anomalies, pageProblems, configIssues, skippedTotal, statusEvidence, documents }), "utf8");
  const out = courses.flatMap((c) => c.outcomes);
  console.log(`Done: ${courses.length} courses, ${out.length} outcomes, ${out.reduce((n, o) => n + o.indicators.length, 0)} indicators. ${stats.fetched} pages fetched, ${stats.cached} from cache.`);
  splitByGrade();
}

/* ---------- report ---------- */

function report({ dataset, all, anomalies, pageProblems, configIssues, skippedTotal, statusEvidence, documents }) {
  const { courses, importedOn } = dataset;
  const out = courses.flatMap((c) => c.outcomes);
  const count = (f) => out.filter(f).length;
  const docCourses = courses.filter((c) => c.document);
  const docItems = (c) => c.document.units.reduce((n, u) => n + u.items.length, 0);
  const modules = out.filter((o) => o.module);
  const lines = [
    `# Saskatchewan Grade 10–12 curriculum import${LANG === "fr" ? " (French site)" : ""}`,
    "",
    `Imported on ${importedOn} by \`${dataset.importer}\` from ${dataset.sources.site}, cross-checked against the Ministry's CSV files on EDonline. Generated file: do not edit by hand; re-run the importer.`,
    "",
    "| | Count |",
    "|---|---|",
    `| Curricula on the site | ${all.length} |`,
    `| Grade 10–12 curricula imported | ${courses.length} |`,
    `| …with outcomes published online | ${courses.filter((c) => c.outcomes.length > 0).length} |`,
    `| …with outcomes or objectives from a curriculum document | ${docCourses.length} |`,
    `| …listed in the site's menus | ${courses.filter((c) => c.listedInMenu).length} |`,
    `| Units | ${courses.reduce((n, c) => n + c.units.length, 0)} (${courses.reduce((n, c) => n + c.units.filter((u) => u.outcomeIds.length > 0).length, 0)} with outcome links) |`,
    `| Outcomes | ${out.length} |`,
    `| Indicators | ${out.reduce((n, o) => n + o.indicators.length, 0)} |`,
    `| Outcomes whose wording matches the Ministry CSV | ${count((o) => o.csv === "match")} |`,
    `| Outcomes whose wording matches the start of a shortened CSV statement | ${count((o) => o.csv === "prefix")} |`,
    `| Outcomes whose wording differs from the CSV | ${count((o) => o.csv === "mismatch")} |`,
    `| Outcomes missing from their CSV | ${count((o) => o.csv === "missing")} |`,
    `| Outcomes with no CSV file to check against | ${count((o) => o.csv === "no-file")} |`,
    `| Outcomes checked by a person | 0 |`,
    `| Modules (Practical and Applied Arts style) | ${modules.length} (${modules.filter((o) => o.level !== null).length} with a single level, ${modules.filter((o) => o.levels.length > 1).length} in several levels, ${modules.filter((o) => o.levels.length === 0).length} with none) |`,
    `| Entries left out because the site prints no outcome statement (e.g. Extended Study modules) | ${skippedTotal} |`,
    "",
    "## Courses",
    "",
    `| Course | Levels | Outcomes | Indicators | Cross-checked | Flags | Note |`,
    "|---|---|---|---|---|---|---|",
    ...courses.map((c) => {
      const flags = [c.listedInMenu ? null : "not in menus", c.legacy ? "legacy" : null, c.preliminary ? "preliminary" : null, c.notACurriculum ? "not a curriculum" : null, c.document ? c.document.status : null].filter(Boolean).join(", ");
      const note = c.problem ?? (c.csvFiles.length === 0 ? "No CSV file" : "");
      return `| [${c.name}](${c.url}) | ${c.levels.join(", ")} | ${c.outcomes.length} | ${c.outcomes.reduce((n, o) => n + o.indicators.length, 0)} | ${c.outcomes.filter((o) => o.status === "cross-checked").length} | ${flags} | ${note.replace(/\|/g, "\\|")} |`;
    }),
    "",
    "## Status flags",
    "",
    `- Not listed in the site's menus (search list only): ${courses.filter((c) => !c.listedInMenu).map((c) => c.name).join("; ") || "none"}.`,
    `- Legacy: ${courses.filter((c) => c.legacy).map((c) => `${c.name} (${c.legacyEvidence.reason})`).join("; ") || "none"}.`,
    `- Preliminary: ${courses.filter((c) => c.preliminary).map((c) => c.name).join("; ") || "none"}.`,
    `- Not a curriculum: ${courses.filter((c) => c.notACurriculum).map((c) => `${c.name} (${c.notACurriculumEvidence.reason})`).join("; ") || "none"}.`,
    ...(LANG === "fr" ? [`- Without an English equivalent in the coverage research: ${courses.filter((c) => !c.englishEquivalent).map((c) => c.name).join("; ") || "none"}.`] : []),
    "",
    "## Pages the site does not serve",
    "",
    ...(pageProblems.length ? pageProblems.map((p) => `- ${p}`) : ["- None."]),
    "",
    "## Unit links",
    "",
    `Every unit lists its outcomes (\`outcomeIds\`), and every outcome's \`unitId\` names a unit that lists it (the import fails otherwise).`,
    "",
    `- Units of kind "outcomes": ${courses.reduce((n, c) => n + c.units.filter((u) => u.kind === "outcomes").length, 0)}; "themes": ${courses.reduce((n, c) => n + c.units.filter((u) => u.kind === "themes").length, 0)}; "empty": ${courses.reduce((n, c) => n + c.units.filter((u) => u.kind === "empty").length, 0)}.`,
    ...courses
      .filter((c) => c.themes)
      .map((c) => `- ${c.name}: suggested themes (linked to no outcome) — ${c.themes.map((t) => `${t.name}${t.coursePart ? ` [${t.coursePart}]` : ""}`).join("; ")}.`),
    "",
    "## Course configurations",
    "",
    `Read from the site's course configuration pages (the authority); ${courses.reduce((n, c) => n + (c.configurations?.length ?? 0), 0)} configurations in ${courses.filter((c) => c.configurations).length} courses. ${modules.filter((o) => o.levelSource).length} modules take their level(s) from them.`,
    "",
    ...courses
      .filter((c) => c.configurations)
      .map((c) => {
        const borrowed = c.configurations.flatMap((cf) => cf.sections.flatMap((s) => s.modules.filter((m) => m.borrowedFrom).map((m) => m.code)));
        return `- ${c.name}: ${c.configurations.map((cf) => `${cf.name}${cf.level ? "" : " (no level)"} — ${cf.sections.reduce((n, s) => n + s.modules.length, 0)} modules`).join("; ")}${borrowed.length ? `. Borrowed from other curricula: ${[...new Set(borrowed)].join(", ")}` : ""}.`;
      }),
    "",
    "Codes printed differently on the configuration pages (kept as printed in `moduleCodes`; the resolution is in `modules[].datasetCode` and `correction`), and entries not in the dataset:",
    "",
    ...(configIssues.length ? configIssues.map((x) => `- ${x}`) : ["- None."]),
    "",
    "## Groupings",
    "",
    ...["unit", "module", "none"].map((k) => `- ${k}: ${courses.filter((c) => c.grouping?.kind === k).length} courses${k === "none" ? ` (${courses.filter((c) => c.grouping?.kind === k).map((c) => c.name).join("; ")})` : ""}.`),
    `- No grouping recorded (nothing published): ${courses.filter((c) => !c.grouping).map((c) => c.name).join("; ") || "none"}.`,
    `- Outcome titles (Physical Education): ${count((o) => o.title)}. Mathematics goal tags: ${count((o) => o.goals)}. Suggested units: ${courses.filter((c) => c.suggestedUnits).map((c) => `${c.name} (${c.suggestedUnits.names.join("; ")})`).join("; ") || "none"}.`,
    "",
    "## Documents",
    "",
    `${docCourses.length} courses take their outcomes or objectives from a committed extraction of the curriculum document (\`course.document\`), ${docCourses.reduce((n, c) => n + docItems(c), 0)} items in all.`,
    "",
    "| Course | Status | Items | Flagged items | PDF check | Partial |",
    "|---|---|---|---|---|---|",
    ...docCourses.map((c) => `| ${c.name} | ${c.document.status} | ${docItems(c)} | ${c.document.flags.length} | ${c.document.check} | ${c.document.partial ? c.document.partialReason.replace(/\|/g, "\\|") : ""} |`),
    "",
    ...(LANG === "en" ? [`Committed extractions not attached to an imported course: ${[...documents.keys()].filter((id) => !courses.some((c) => c.curriculumId === id && c.document)).join(", ") || "none"}.`, ""] : []),
    "Flagged items (check against the printed page before use):",
    "",
    ...docCourses.flatMap((c) => {
      const kinds = {};
      for (const f of c.document.flags) for (const x of f.flags) kinds[x.split(":")[0].split(" ")[0]] = (kinds[x.split(":")[0].split(" ")[0]] ?? 0) + 1;
      return Object.keys(kinds).length ? [`- ${c.name}: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(", ")}.`] : [];
    }),
    "",
    "## Source typos and discrepancies (kept as printed)",
    "",
    ...sourceDiscrepancies(courses, statusEvidence).map((x) => `- ${x}`),
    "",
    "## Decoded HTML entities",
    "",
    `Decoded with the full HTML5 named-entity table (scripts/curriculum/html5-entities.json); the import fails on any entity it does not know. Named entities decoded in this run: ${[...decodedEntities.entries()].sort((a, b) => b[1] - a[1]).map(([e, n]) => `&${e}; ×${n}`).join(", ") || "none"}.`,
    "",
    "## Things a person should look at",
    "",
    ...(anomalies.length ? anomalies.map((a) => `- ${a}`) : ["- None."]),
    "",
    "## Not imported",
    "",
    `Curricula on the site that are not 10-, 20- or 30-level courses (Kindergarten to Grade 9, K-12 frameworks): ${dataset.excluded.length}.`,
    "",
  ];
  return lines.join("\n");
}

/** Printing slips and disagreements between sources. Recorded, never corrected. */
function sourceDiscrepancies(courses, statusEvidence) {
  const out = [...(statusEvidence.discrepancies ?? [])];
  for (const c of courses) {
    // A space inside a code where the course's other codes have none (e.g. "CE 30.4" beside "CE30.1").
    const spaced = c.outcomes.filter((o) => /[A-Z] \d/.test(o.code));
    if (spaced.length > 0 && spaced.length < c.outcomes.length / 2) for (const o of spaced) out.push(`${c.name}: the site prints the code “${o.code}” with a space, unlike the course's other codes.`);
    const renumbered = c.outcomes.filter((o) => o.goalsSource?.printedCode);
    if (renumbered.length) out.push(`${c.name}: the curriculum document prints ${renumbered.map((o) => `${o.goalsSource.printedCode} (site: ${o.code})`).join(", ")}.`);
    if (!c.document) continue;
    // Slips the extraction notes record between two printings in the same document, or OCR misreads kept as read.
    const slip = /word this statement differently|is printed as [A-Z]{2}\d|\bprints '|used twice|out of order|\bmisreads?\b|printed with a space|while the guide’s contents list/;
    for (const n of c.document.notes) if (slip.test(n)) out.push(`${c.name} (document): ${n}`);
    for (const u of c.document.units) {
      if (u.siteUnitName && u.name && comparable(u.name.replace(/^Unit\s+[\w]+\s*:\s*/i, "")) !== comparable(u.siteUnitName)) out.push(`${c.name}: the document names a unit “${u.name}”; the site says “${u.siteUnitName}”.`);
      for (const it of u.items) if (it.glanceCode && it.glanceCode !== it.code) out.push(`${c.name}: ${it.code} is printed as ${it.glanceCode} in Outcomes at a Glance.`);
    }
  }
  return [...new Set(out)];
}

// Run only when executed directly; tests import the parsers below.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { compareWithCsv, comparable, decode, isSecondary, levelsInName, pageNotFound, parseConfigurationPage, parseCourseList, parseCsv, parseOutcomePage, parseOutcomesPage, resolveModule, text, withoutTrailingBrackets };
