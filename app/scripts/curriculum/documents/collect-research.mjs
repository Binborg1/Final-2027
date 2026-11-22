#!/usr/bin/env node
/**
 * Collects the reviewed research outputs into the committed inputs the importer reads.
 *
 *   node scripts/curriculum/documents/collect-research.mjs
 *
 * Reads (not committed; written by the extraction scripts in this folder and by the research
 * notes under .cache/curriculum/research/):
 *   legacy-and-drafts/<id>.json, social-studies/<id>.json   verbatim document extractions
 *   groupings/groupings.json                                 quoted grouping evidence
 *   unit-mapping/mapping.json                                ELA theme course parts (with citations)
 *   coverage/all-10-12.json                                  French-to-English equivalents
 * Writes:
 *   src/data/curriculum/documents/<id>.json      one per extraction that holds items, keyed by curriculum id and PDF hash
 *   src/data/curriculum/evidence/groupings.json  how each course without website units is grouped, with quotes
 *   src/data/curriculum/evidence/ela-themes.json
 *   src/data/curriculum/evidence/fr-english-equivalents.json
 *   src/data/curriculum/evidence/status.json     legacy and "not a curriculum" evidence
 *
 * Item text is copied unchanged. Only the source block is normalised: the curriculum's own
 * CurriculumFile URL is kept (never the signed storage URL it redirects to), with the PDF's
 * SHA-256 and the filename from the response headers; local file paths are dropped.
 * Treaty Education (481) is extracted directly by parse-treaty.mjs.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APP } from "../fetch.mjs";
import { toDocument } from "./lib.mjs";

const RESEARCH = join(APP, ".cache", "curriculum", "research");
const DOCS = join(APP, "src", "data", "curriculum", "documents");
const EVIDENCE = join(APP, "src", "data", "curriculum", "evidence");
const ALLOWED = /^https:\/\/(curriculum\.gov\.sk\.ca|www\.edonline\.sk\.ca|publications\.saskatchewan\.ca)\//;
mkdirSync(DOCS, { recursive: true });
mkdirSync(EVIDENCE, { recursive: true });
const read = (...p) => JSON.parse(readFileSync(join(RESEARCH, ...p), "utf8"));
const write = (file, obj) => writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");

/** Reasons a document is knowingly incomplete, as the extraction notes state them. */
const PARTIAL = {
  182: (d) => d.notes.find((n) => n.startsWith("Objectives-only OCR")),
};

function assertNoForeignUrls(obj, where) {
  for (const m of JSON.stringify(obj).matchAll(/https?:\/\/[^"\s)]+/g)) if (!ALLOWED.test(m[0])) throw new Error(`${where}: a URL outside the Ministry's sites (${m[0].slice(0, 60)}…) must not be stored.`);
}

/* ---------- documents ---------- */

const written = [];
// The research folders, then the working folder of a re-run of social-studies/*.py (which wins when present).
const SS_SOURCES = JSON.parse(readFileSync(join(APP, "scripts", "curriculum", "documents", "social-studies", "sources.json"), "utf8"));
const FOLDERS = [
  ["legacy-and-drafts", join(RESEARCH, "legacy-and-drafts")],
  ["social-studies", join(RESEARCH, "social-studies")],
  ["social-studies re-run", join(APP, ".cache", "curriculum", "documents", "social-studies")],
];
for (const [folder, dir] of FOLDERS) {
  if (!existsSync(dir)) continue;
  const sources = folder.startsWith("social-studies") ? SS_SOURCES : {};
  for (const f of readdirSync(dir).filter((n) => /^\d+\.json$/.test(n))) {
    const d = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const items = (d.units ?? []).reduce((n, u) => n + (u.items?.length ?? 0), 0);
    if (items === 0 || !d.source?.sha256) continue; // "not available" records: the importer detects those pages itself
    const id = d.curriculumId;
    const src = d.source;
    const url = `https://curriculum.gov.sk.ca/CurriculumFile?id=${id}`;
    if (src.url !== url) throw new Error(`${folder}/${f}: source url ${src.url} is not the CurriculumFile URL.`);
    const filename = src.filename ?? sources[id]?.filename ?? (src.file ? src.file.replace(/^.*\//, "").replace(/^\d+_/, "") : null);
    const partialReason = PARTIAL[id]?.(d) ?? null;
    const out = toDocument({ ...d, source: { ...src, url, filename } }, { extractedBy: `scripts/curriculum/documents/ (copied from the ${folder} research on ${src.retrievedOn})`, partialReason });
    assertNoForeignUrls(out, `${folder}/${f}`);
    write(join(DOCS, `${id}.json`), out);
    written.push(`${id} ${d.name}: ${out.textSource}${partialReason ? ", partial" : ""}, ${items} items`);
  }
}
console.log(`documents: ${written.length}\n  ${written.join("\n  ")}`);

/* ---------- grouping evidence ---------- */

const groupings = read("groupings", "groupings.json");
const evidence = {};
for (const [id, g] of Object.entries(groupings)) {
  const e = { kind: g.kind, name: g.name, evidence: (g.source?.evidence ?? []).filter(Boolean) };
  if (g.outcomeTitles) e.outcomeTitles = { meaning: g.outcomeTitles.meaning, byOutcome: g.outcomeTitles.byOutcome };
  if (g.goalTags) {
    // The PDF may number outcomes differently from the site (Pre-Calculus 30 prints PC30.n for the site's P30.n).
    const swap = (g.codeDiscrepancy ?? "").match(/: ([A-Z]+\d+)\.\d+ → ([A-Z]+\d+)\.\d+/);
    e.goals = {
      meaning: g.goalTags.meaning,
      url: g.source.url,
      byOutcome: Object.fromEntries(Object.entries(g.goalTags.byOutcome).map(([code, v]) => [code, { goals: v.goals, page: v.page, ...(swap && code.startsWith(`${swap[2]}.`) ? { printedCode: code.replace(swap[2], swap[1]) } : {}) }])),
      missing: g.goalTags.missing,
    };
  }
  if (g.suggestedUnits) {
    const s = g.suggestedUnits;
    e.suggestedUnits = { meaning: s.meaning, heading: s.heading, names: s.names, url: g.source.url, page: s.page, evidence: s.evidence, linkedOutcomes: "none: the document assigns no outcomes to these units" };
  }
  // The curriculum PDF's own configuration tables, used by the importer only to cross-check the website's.
  if (g.configurations) {
    e.pdfConfigurations = g.configurations
      .filter((cf) => /CurriculumFile/.test(cf.source?.url ?? ""))
      .map((cf) => ({ name: cf.name, ...(cf.subtitle ? { subtitle: cf.subtitle } : {}), level: cf.level, url: cf.source.url, page: cf.source.page, sections: cf.sections.map((s) => ({ name: s.name, moduleCodes: s.modules.map((m) => m.code), ...(s.modules.some((m) => m.printedAs) ? { printedAs: Object.fromEntries(s.modules.filter((m) => m.printedAs).map((m) => [m.code, m.printedAs])) } : {}) })) }));
  }
  if (g.courseTitle) e.courseTitle = g.courseTitle;
  if (g.learningContexts) e.learningContexts = g.learningContexts;
  evidence[id] = e;
}
assertNoForeignUrls(evidence, "groupings");
write(join(EVIDENCE, "groupings.json"), evidence);
console.log(`grouping evidence: ${Object.keys(evidence).length} courses`);

/* ---------- ELA themes ---------- */

const mapping = read("unit-mapping", "mapping.json");
const themes = {};
for (const [id, m] of Object.entries(mapping)) {
  if (!m.ela) continue;
  themes[id] = {
    name: m.name,
    byCoursePart: m.ela.suggestedUnitsByCoursePart,
    citation: { url: m.ela.curriculumDocument.url, where: m.ela.curriculumDocument.where },
    note: "The document names the themes for each course part; it assigns no outcome to a theme.",
  };
}
write(join(EVIDENCE, "ela-themes.json"), themes);
console.log(`ELA themes: ${Object.keys(themes).join(", ")}`);

/* ---------- French-to-English equivalents ---------- */

const coverage = read("coverage", "all-10-12.json");
const equivalents = {};
for (const c of coverage.curricula.filter((x) => x.language === "fr" && x.curriculumId)) equivalents[c.curriculumId] = c.englishEquivalent ?? null;
write(join(EVIDENCE, "fr-english-equivalents.json"), {
  meaning: "The English curriculum each French (immersion or Fransaskois) curriculum corresponds to, from the coverage research of 2026-11-21 (matched by course, levels and CSV file). null: no English equivalent.",
  equivalents,
});
console.log(`French equivalents: ${Object.keys(equivalents).length} (${Object.values(equivalents).filter((v) => !v).length} without)`);

/* ---------- status evidence ---------- */

const legacyNotes = (id) => read("legacy-and-drafts", `${id}.json`).notes.filter((n) => /Status on the site|superseded|renewed|Browse by Subject|404/.test(n));
const status = {
  meaning: "Evidence for the importer's legacy and notACurriculum flags. Quotes and observations come from the research notes of 2026-11-21.",
  legacy: {
    67: { reason: "1992 guide; not in the site's menus; its 30-level part is replaced by the renewed Biology 30 (id 68)", replacedBy: [68], evidence: legacyNotes(67) },
    70: { reason: "1992 guide; not in the site's menus; its 30-level part is replaced by the renewed Chemistry 30 (id 69)", replacedBy: [69], evidence: legacyNotes(70) },
    71: { reason: "1992 guide; not in the site's menus; its 30-level part is replaced by the renewed Physics 30 (id 72)", replacedBy: [72], evidence: legacyNotes(71) },
    202: { reason: "1994 guide; not in the site's menus, its document link answers HTTP 404, and the menus' physical education entries are Wellness 10, Physical Education 20 and 30", replacedBy: [201, 453, 454], evidence: read("legacy-and-drafts", "202.json").notes },
  },
  notACurriculum: Object.fromEntries(
    [478, 479, 480].map((id) => [id, { reason: "an orphan site entry: its document and outcomes pages answer the site's “Page Not Found” page, and Practical and Applied Arts has no single 10/20/30 curriculum", evidence: read("legacy-and-drafts", `${id}.json`).notes }]),
  ),
  discrepancies: [],
};
write(join(EVIDENCE, "status.json"), status);
console.log("status evidence written");
