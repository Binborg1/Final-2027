/**
 * Parsers for curriculum.gov.sk.ca pages. Pure functions: no network, no files except the
 * committed HTML5 entity table. Nothing is reworded: tags are stripped, entities decoded and
 * whitespace normalised, exactly as a browser would show the text.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* ---------- entities ---------- */

// The WHATWG named character references (semicolon-terminated), generated from Python's html.entities.html5.
const HTML5 = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "html5-entities.json"), "utf8"));
// The importer's deliberate normalisations win over HTML5: wide and non-breaking spaces become a space,
// invisible formatting characters are removed.
const OVERRIDES = { nbsp: " ", ensp: " ", emsp: " ", thinsp: " ", shy: "", zwnj: "", zwj: "", lrm: "", rlm: "" };

/** Entities seen that are not in the HTML5 table. The importer fails if any is left at the end. */
export const unknownEntities = new Set();
/** Every named entity decoded, with how often (for the report). */
export const decodedEntities = new Map();

export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) return String.fromCodePoint(code);
      unknownEntities.add(e);
      return m;
    }
    const value = e in OVERRIDES ? OVERRIDES[e] : HTML5[e];
    if (value === undefined) {
      unknownEntities.add(e);
      return m;
    }
    decodedEntities.set(e, (decodedEntities.get(e) ?? 0) + 1);
    return value;
  });
}

/** Throws if any entity could not be decoded: official text must never keep raw markup. */
export function assertNoUnknownEntities() {
  if (unknownEntities.size > 0) throw new Error(`Unknown HTML entities (not in the HTML5 table): ${[...unknownEntities].map((e) => `&${e};`).join(", ")}`);
}

/**
 * Visible text of an HTML fragment, as a browser shows it: line breaks in the source are
 * spaces; <br>, list items and paragraphs start new lines. Nothing is reworded.
 */
export function text(fragment) {
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

/* ---------- levels ---------- */

export const LEVEL = /(?:^|[^\d])([AB])?(10|20|30)(?![\d])/;
export function levelsInName(name) {
  const out = new Set();
  for (const m of name.matchAll(/(?:^|[\s,;/(])([AB])?(10|20|30)(?![\d])/g)) out.add(Number(m[2]));
  return [...out].sort();
}
export const gradeOf = (level) => (level === 10 ? 10 : level === 20 ? 11 : level === 30 ? 12 : null);

export function isSecondary(name) {
  if (/K-12|M-12|Treaty Education|Traités|Kindergarten|Prekindergarten|Maternelle/i.test(name)) return false;
  return levelsInName(name).length > 0;
}

/* ---------- the site's error page ---------- */

/**
 * The site answers a missing curriculum page with HTTP 200 and an error page ("Page Not Found").
 * Returns its heading and message, verbatim, or null for a normal page.
 */
export function pageNotFound(html) {
  if (typeof html !== "string" || !/class="errorPage"/.test(html)) return null;
  const heading = text((html.match(/<div class="error">\s*<h1>([\s\S]*?)<\/h1>/) ?? [, ""])[1]);
  const message = text((html.match(/<div class="errorMessage">([\s\S]*?)<\/div>/) ?? [, ""])[1]);
  return { heading, message };
}

/* ---------- course list and menus ---------- */

/**
 * Every curriculum the home page links to: the search list, plus the menus (German,
 * Mandarin and Spanish appear only in the menus). Each menu entry also gives the
 * subject heading it sits under.
 */
export function parseCourseList(home) {
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

/** The curriculum ids a menu (the home page's own menu, or a Megamenu?name=… page) links to. */
export function menuCurriculumIds(html) {
  const start = html.indexOf('id="megamenu_wrapper"');
  const seg = start >= 0 ? html.slice(start, html.indexOf("</nav>", start)) : html;
  return new Set([...seg.matchAll(/href="CurriculumHome\?id=(\d+)(?:&amp;[^"]*)?"/g)].map((m) => Number(m[1])));
}

/**
 * The subject each curriculum sits under in the "Browse by Subject" menu (Megamenu?name=subject):
 * the main heading, or, under "More…", the sub-heading (Catholic Studies, Languages, …).
 */
export function menuSubjects(html) {
  const out = new Map();
  let main = null;
  let sub = null;
  for (const t of html.matchAll(/megamenu__main-item__header[^"]*"[^>]*>([\s\S]*?)<\/div>|megamenu__dropdown__subheader">([\s\S]*?)<\/div>|href="CurriculumHome\?id=(\d+)(?:&amp;[^"]*)?"/g)) {
    if (t[1] !== undefined) {
      main = text(t[1]).replace(/\s+/g, " ") || null;
      sub = null;
    } else if (t[2] !== undefined) sub = text(t[2]) || null;
    else if (!out.has(Number(t[3]))) out.set(Number(t[3]), /^More/.test(main ?? "") ? sub : main);
  }
  return out;
}

/** Other menus a menu page opens (e.g. the English "Core French" entry opens the French site's coreFrench menu). */
export function linkedMenus(html) {
  return [...new Set([...html.matchAll(/href="Home\?language=(\w+)&amp;megamenu=(\w+)"/g)].map((m) => `${m[2]}|${m[1]}`))].map((s) => {
    const [name, language] = s.split("|");
    return { name, language };
  });
}

/* ---------- a course's outcomes page ---------- */

const OC = /[?&](?:amp;)?oc=(\d+)/;
const FILTER_OC = /f_oc_(\d+)=true/;

/** The "Course Configurations" links printed at the top of a module-based course's pages. */
export function configurationLinks(html) {
  const start = html.indexOf('id="cd_web_content"');
  if (start < 0) return [];
  const sec = html.slice(start);
  const end = sec.indexOf("</section>");
  if (end < 0) return [];
  const head = sec.slice(0, end);
  return [...head.matchAll(/href="CurriculumOutcomeContent\?id=(\d+)&amp;occ=(\d+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ curriculumId: Number(m[1]), occ: Number(m[2]), name: text(m[3]) }));
}

/**
 * Reads a course's outcomes page group by group. Each div.outcome-content-homepage__group holds
 * one header (the unit) and its own outcomes; its real extent is found by balancing <div>s.
 * Groups are classified:
 *   "outcomes"  header + outcome links (?oc=N)           -> a unit with outcomes
 *   "themes"    header + resource-filter links (f_oc_N)  -> ELA's suggested thematic units, linked to no outcome
 *   "empty"     header only                              -> e.g. ELA course parts (A10, B10), or units-only courses
 * Pages without groups (most Practical and Applied Arts courses) list every outcome loose.
 */
export function parseOutcomesPage(html, curriculumId) {
  const start = html.indexOf('id="cd_web_content"');
  const body = start >= 0 ? html.slice(start) : html;
  const end = body.search(/id="page-footer"|<footer\b/);
  const list = end >= 0 ? body.slice(0, end) : body;
  const units = [];
  const outcomes = [];
  const themes = [];
  const problems = [];

  const groups = [];
  for (const m of list.matchAll(/<div class="outcome-content-homepage__group">/g)) {
    let depth = 0;
    let endAt = list.length;
    for (const t of list.slice(m.index).matchAll(/<div\b|<\/div\s*>/g)) {
      depth += t[0] === "<div" ? 1 : -1;
      if (depth === 0) {
        endAt = m.index + t.index + t[0].length;
        break;
      }
    }
    const block = list.slice(m.index, endAt);
    const headers = [...block.matchAll(/outcome_content_homepage__group__header">\s*<a href="([^"]*)">([\s\S]*?)<\/a>/g)];
    if (headers.length !== 1) problems.push(`a unit group at offset ${m.index} has ${headers.length} headers`);
    if (/<div class="outcome-content-homepage__group">/.test(block.slice(1))) problems.push(`a unit group at offset ${m.index} contains another group`);
    if (headers.length === 0) continue;
    const unit = { ocId: Number((headers[0][1].match(OC) ?? [])[1]), name: text(headers[0][2]), kind: "empty", outcomeOcIds: [] };
    units.push(unit);
    groups.push({ from: m.index, to: endAt, unit });
  }

  const item = /outcome-content-homepage__sub-list__element__identifier">\s*<a href="([^"]*)">([\s\S]*?)<\/a>[\s\S]*?outcome-content-homepage__sub-list__element__text">([\s\S]*?)<\/div>/g;
  let loose = 0;
  for (const m of list.matchAll(item)) {
    const [, href, label, statement] = m;
    const unit = groups.find((g) => m.index > g.from && m.index < g.to)?.unit ?? null;
    const oc = href.match(OC);
    if (oc) {
      outcomes.push({ ocId: Number(oc[1]), code: text(label), statement: text(statement), unitOcId: unit?.ocId ?? null });
      if (unit) {
        unit.outcomeOcIds.push(Number(oc[1]));
        unit.kind = "outcomes";
      } else loose++;
    } else {
      // ELA "Units": suggested thematic units, published only as resource-list filters (no outcome link).
      const f = href.match(FILTER_OC);
      themes.push({ ocId: f ? Number(f[1]) : null, name: text(label), groupOcId: unit?.ocId ?? null, groupName: unit?.name ?? null });
      if (unit && unit.kind === "empty") unit.kind = "themes";
    }
  }
  // Loose outcomes on a page that has unit groups would mean the markup changed: report, never guess.
  if (groups.length > 0 && loose > 0) problems.push(`${loose} outcome(s) sit outside every unit group`);
  const title = text((html.match(/<title>([\s\S]*?)<\/title>/) ?? [, ""])[1]).replace(/\s*\|\s*Saskatchewan Curriculum\s*$/, "");
  return { title, units, outcomes, themes, problems, configurations: configurationLinks(html), curriculumId };
}

/* ---------- an outcome's own page ---------- */

export function parseOutcomePage(html) {
  const start = html.indexOf('id="cd_web_content"');
  const body = start >= 0 ? html.slice(start) : html;
  const statementMatch = body.match(/outcome_content_text">([\s\S]*?)<\/div>/);
  // The outcome's heading is the last section heading before its text (some pages start with a "Course Configurations" section).
  const headers = [...body.matchAll(/content_section_header">([\s\S]*?)<\/div>/g)].filter((m) => !statementMatch || m.index < statementMatch.index);
  const header = text(headers.at(-1)?.[1] ?? "");

  // Practical and Applied Arts modules: a module name and details, then the outcome under an "Outcome"
  // ("Résultat d’apprentissage") heading. The outcome is the list header followed by a <span>; the
  // indicators' header is followed by a table.
  const moduleName = body.match(/outcome_content_module_name">([\s\S]*?)<\/div>/);
  if (moduleName) {
    const details = [...body.matchAll(/outcome_content_module_metadata__property">([\s\S]*?)<\/div>/g)].map((m) => text(m[1]).replace(/\s*\n\s*/g, " "));
    const outcome = body.match(/outcome_content_child_list_header">[^<]*<\/div>\s*<span>([\s\S]*?)<\/span>/);
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

/* ---------- a course configuration page (&occ=) ---------- */

/**
 * The modules a configuration page lists, in order, split into sections by group headers
 * (e.g. "Optional Modules from the Financial Literacy Curriculum"). Each module keeps the
 * name and "Module Code" exactly as printed, and the outcome it links to (curriculum id and
 * oc), when the site links one.
 */
export function parseConfigurationPage(html) {
  const start = html.indexOf('id="cd_web_content"');
  const body = start >= 0 ? html.slice(start) : html;
  const end = body.search(/id="page-footer"|<footer\b/);
  const list = end >= 0 ? body.slice(0, end) : body;
  const selected = list.match(/cd_web_menu_item--selected"[^>]*>([\s\S]*?)<\/a>/);
  /** @type {{ name: string | null, modules: { code: string, name: string, curriculumId: number | null, ocId: number | null, properties: Record<string, string> }[] }[]} */
  const sections = [{ name: null, modules: [] }];
  const re = /outcome_content_homepage__group__header">([\s\S]*?)<\/div>|<div class="outcome-content-homepage__sub-list__element">/g;
  const marks = [...list.matchAll(re)];
  for (const [k, m] of marks.entries()) {
    if (m[1] !== undefined) {
      sections.push({ name: text(m[1]) || null, modules: [] });
      continue;
    }
    const block = list.slice(m.index, marks[k + 1]?.index ?? list.length);
    const ident = block.match(/__element__identifier">\s*(?:<a href="([^"]*)">([\s\S]*?)<\/a>|([^<]*?))\s*<\/div>/);
    const href = ident?.[1] ?? "";
    const link = href.match(/[?&]id=(\d+)&amp;oc=(\d+)/);
    const props = [...block.matchAll(/__metadata__property__key">([\s\S]*?)<\/div>\s*<div class="[^"]*__metadata__property__value"\s*>([\s\S]*?)<\/div>/g)].map((p) => [text(p[1]), text(p[2])]);
    const codeProp = props.find(([key]) => /^(Module Code|Code de module|Code du module)$/i.test(key)) ?? props[0];
    sections.at(-1).modules.push({
      code: codeProp?.[1] ?? "",
      name: text(ident?.[2] ?? ident?.[3] ?? ""),
      curriculumId: link ? Number(link[1]) : null,
      ocId: link ? Number(link[2]) : null,
      properties: Object.fromEntries(props.filter(([key]) => key !== codeProp?.[0])),
    });
  }
  return { name: selected ? text(selected[1]) : null, sections: sections.filter((s) => s.modules.length || s.name) };
}

/* ---------- Ministry CSV files ---------- */

export function parseCsvList(html) {
  const names = new Set();
  for (const m of html.matchAll(/\/bbcswebdav\/library\/outcomes\/csvFiles\/([^"?#]+\.csv)/gi)) names.add(decodeURIComponent(m[1]));
  return [...names];
}
/** Rows of [type, code, text]. The files are either quoted comma-separated or pipe-delimited. */
export function parseCsv(raw) {
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
export const comparable = (s) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
/**
 * What the course page prints after a statement and the outcome page prints apart from it:
 * process codes ("([C, CN, ME])", "(DM, SI, TPS)") and footnotes ("(* … see Appendix A.)").
 */
export const withoutTrailingBrackets = (s) => s.replace(/\s*(?:\(?\[[^\]]*\]\)?|\((?:[A-Z]{1,4}\s*,?\s*)+\)|\(\*[^)]*\))\s*$/, "");
/** "match": same words. "prefix": the CSV stops early (it shortens long statements). */
export function compareWithCsv(csvText, statement) {
  const a = comparable(csvText);
  const b = comparable(statement);
  if (!a) return "mismatch";
  if (a === b) return "match";
  if (a.length >= 30 && b.startsWith(a)) return "prefix";
  return "mismatch";
}

/* ---------- level of an outcome ---------- */

export function levelOf(code, unitName, courseLevels) {
  const fromCode = code.match(LEVEL);
  if (fromCode) return Number(fromCode[2]);
  const fromUnit = (unitName ?? "").match(LEVEL);
  if (fromUnit) return Number(fromUnit[2]);
  return courseLevels.length === 1 ? courseLevels[0] : null;
}
