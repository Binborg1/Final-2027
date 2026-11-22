#!/usr/bin/env node
/**
 * Splits the imported datasets by grade: 10-level courses are Grade 10, 20-level Grade 11 and
 * 30-level Grade 12.
 *
 *   node scripts/curriculum/split-by-grade.mjs     (the importer runs this at the end)
 *
 * Reads src/data/curriculum/sk.json (and sk-fr.json when it exists) and writes
 *   src/data/curriculum/by-grade/grade-10.json, grade-11.json, grade-12.json
 *   src/data/curriculum/by-grade/fr/grade-10.json, …     (French site)
 *   src/data/curriculum/sk-by-grade.md, sk-fr-by-grade.md
 * Each grade file lists the courses offered at that grade with only that level's units,
 * outcomes (modules), configurations and document units, and keeps every status flag.
 * Nothing is reworded: entries are copied from the dataset.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { APP } from "./fetch.mjs";

const OUT = join(APP, "src", "data", "curriculum");
export const GRADES = [
  { grade: 10, level: 10 },
  { grade: 11, level: 20 },
  { grade: 12, level: 30 },
];
const LEVEL = /(?:^|[^\d])([AB])?(10|20|30)(?![\d])/;

/** The levels an outcome is taught at: the ones the source assigns, else every level of its course. */
export function outcomeLevels(o, course) {
  return o.levels?.length ? o.levels : o.level ? [o.level] : course.levels;
}

const levelOfUnit = (u) => (u.level ?? (u.grade ? { 10: 10, 11: 20, 12: 30 }[u.grade] : null)) || null;

/** One course as offered at one level, or null when the course has no such level. */
export function courseAtLevel(c, level) {
  if (!c.levels.includes(level)) return null;
  const outcomes = c.outcomes
    .filter((o) => outcomeLevels(o, c).includes(level))
    .map((o) => ({ ...o, levelBasis: o.levels?.length || o.level ? "outcome" : "course" }));
  const here = new Set(outcomes.map((o) => o.id));
  // A unit with outcomes is kept when one of them is taught at this level; a unit without any
  // (a heading, ELA's themes list) when it is at this level or has no level.
  const units = c.units
    .filter((u) => (u.outcomeIds.length ? u.outcomeIds.some((id) => here.has(id)) : u.level === level || (u.level === null && u.kind !== "outcomes")))
    .map((u) => ({ ...u, outcomeIds: u.outcomeIds.filter((id) => here.has(id)) }));
  const { themes, configurations, document } = c;
  const out = { ...c, level, units, outcomes };
  delete out.themes;
  delete out.configurations;
  delete out.document;
  if (themes) out.themes = themes.filter((t) => !t.coursePart || Number((t.coursePart.match(LEVEL) ?? [])[2]) === level);
  if (configurations) out.configurations = configurations.filter((cf) => cf.level === level);
  if (document) {
    // Document units at this level, and those printed for the whole course (no level).
    const units = document.units.filter((u) => levelOfUnit(u) === level || levelOfUnit(u) === null);
    const kept = new Set(units);
    out.document = { ...document, units, flags: document.flags.filter((f) => kept.has(document.units[f.unit])).map((f) => ({ ...f, unit: units.indexOf(document.units[f.unit]) })) };
  }
  return out;
}

function splitOne(file, dir, mdFile, label) {
  const dataset = JSON.parse(readFileSync(file, "utf8"));
  mkdirSync(dir, { recursive: true });
  const perGrade = [];
  for (const { grade, level } of GRADES) {
    const courses = dataset.courses.map((c) => courseAtLevel(c, level)).filter(Boolean);
    perGrade.push({ grade, level, courses });
    const out = {
      jurisdiction: dataset.jurisdiction,
      language: dataset.language ?? "en",
      grade,
      level,
      name: `${dataset.name}: Grade ${grade} (${level}-level courses)`,
      importedOn: dataset.importedOn,
      generatedFrom: `src/data/curriculum/${file.replace(/^.*[\\/]/, "")}`,
      generatedBy: "scripts/curriculum/split-by-grade.mjs",
      meaning: {
        levelBasis: "outcome: the source assigns this outcome to this level (its code, unit, course configuration, or a single-level course). course: the source assigns no level, so the outcome is listed at every level its course offers.",
        units: "Only units at this level, or level-less units holding an outcome at this level; outcomeIds keeps only this level's outcomes.",
        configurations: "Only the course configurations for this level.",
        document: "Only the document units at this level (all of them for a single-level course).",
      },
      statusMeaning: dataset.statusMeaning,
      flagsMeaning: dataset.flagsMeaning,
      courses,
    };
    writeFileSync(join(dir, `grade-${grade}.json`), JSON.stringify(out), "utf8");
  }

  const subjects = [...new Set(perGrade.flatMap((g) => g.courses.map((c) => c.subject ?? c.menuSubject ?? "(no subject heading)")))].sort((a, b) => a.localeCompare(b, "en"));
  const docItems = (c) => (c.document ? c.document.units.reduce((n, u) => n + u.items.length, 0) : 0);
  const lines = [
    `# ${label} by grade`,
    "",
    `Generated from \`src/data/curriculum/${file.replace(/^.*[\\/]/, "")}\` (imported ${dataset.importedOn}) by \`scripts/curriculum/split-by-grade.mjs\`. 10-level courses are Grade 10, 20-level Grade 11 and 30-level Grade 12. Generated file: do not edit by hand.`,
    "",
    "| | Grade 10 | Grade 11 | Grade 12 |",
    "|---|---|---|---|",
    `| Courses | ${perGrade.map((g) => g.courses.length).join(" | ")} |`,
    `| …with outcomes online | ${perGrade.map((g) => g.courses.filter((c) => c.outcomes.length).length).join(" | ")} |`,
    `| …with document items | ${perGrade.map((g) => g.courses.filter((c) => docItems(c)).length).join(" | ")} |`,
    `| Outcomes (modules included) | ${perGrade.map((g) => g.courses.reduce((n, c) => n + c.outcomes.length, 0)).join(" | ")} |`,
    `| …listed only because their course offers the level | ${perGrade.map((g) => g.courses.reduce((n, c) => n + c.outcomes.filter((o) => o.levelBasis === "course").length, 0)).join(" | ")} |`,
    `| Indicators | ${perGrade.map((g) => g.courses.reduce((n, c) => n + c.outcomes.reduce((m, o) => m + o.indicators.length, 0), 0)).join(" | ")} |`,
    `| Document items | ${perGrade.map((g) => g.courses.reduce((n, c) => n + docItems(c), 0)).join(" | ")} |`,
    `| Courses not in the site's menus | ${perGrade.map((g) => g.courses.filter((c) => !c.listedInMenu).length).join(" | ")} |`,
    `| Legacy / preliminary / not a curriculum | ${perGrade.map((g) => `${g.courses.filter((c) => c.legacy).length} / ${g.courses.filter((c) => c.preliminary).length} / ${g.courses.filter((c) => c.notACurriculum).length}`).join(" | ")} |`,
    "",
    "## Courses per subject",
    "",
    "| Subject | Grade 10 | Grade 11 | Grade 12 |",
    "|---|---|---|---|",
    ...subjects.map((s) => `| ${s} | ${perGrade.map((g) => g.courses.filter((c) => (c.subject ?? c.menuSubject ?? "(no subject heading)") === s).length).join(" | ")} |`),
    "",
  ];
  for (const g of perGrade) {
    lines.push(`## Grade ${g.grade} (${g.level}-level)`, "", "| Course | Subject | Outcomes | Document items | Flags |", "|---|---|---|---|---|");
    for (const c of [...g.courses].sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const flags = [c.listedInMenu ? null : "not in menus", c.legacy ? "legacy" : null, c.preliminary ? "preliminary" : null, c.notACurriculum ? "not a curriculum" : null, c.document?.status ?? null, c.outcomes.length || docItems(c) ? null : "no outcomes"].filter(Boolean).join(", ");
      lines.push(`| [${c.name}](${c.url}) | ${c.subject ?? c.menuSubject ?? ""} | ${c.outcomes.length} | ${docItems(c) || ""} | ${flags} |`);
    }
    lines.push("");
  }
  writeFileSync(mdFile, lines.join("\n"), "utf8");
  return perGrade.map((g) => g.courses.length);
}

export function splitByGrade() {
  const done = [];
  if (existsSync(join(OUT, "sk.json"))) done.push(["en", splitOne(join(OUT, "sk.json"), join(OUT, "by-grade"), join(OUT, "sk-by-grade.md"), "Saskatchewan Grade 10–12 curricula")]);
  if (existsSync(join(OUT, "sk-fr.json"))) done.push(["fr", splitOne(join(OUT, "sk-fr.json"), join(OUT, "by-grade", "fr"), join(OUT, "sk-fr-by-grade.md"), "Saskatchewan Grade 10–12 curricula (French site)")]);
  for (const [lang, counts] of done) console.log(`By grade (${lang}): ${counts.map((n, i) => `Grade ${10 + i}: ${n} courses`).join(", ")}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) splitByGrade();
