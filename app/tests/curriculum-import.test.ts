import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import type { Dataset, DatasetCourse } from "@/lib/curriculum/imported";
// The importer's own modules (plain JavaScript; importing them does not start a crawl).
import { assertNoUnknownEntities, decode, pageNotFound, parseConfigurationPage, parseOutcomesPage, text, unknownEntities } from "../scripts/curriculum/parse.mjs";
import { courseAtLevel, GRADES, outcomeLevels } from "../scripts/curriculum/split-by-grade.mjs";

const DIR = "src/data/curriculum";
const data = JSON.parse(readFileSync(`${DIR}/sk.json`, "utf8")) as Dataset;
const byId = new Map(data.courses.map((c) => [c.curriculumId, c]));
const SHA = /^[0-9a-f]{64}$/;
const OFFICIAL = /^https:\/\/(curriculum\.gov\.sk\.ca|www\.edonline\.sk\.ca|publications\.saskatchewan\.ca)\//;

/* ---------- entities ---------- */

test("entities decode with the full HTML5 table, keep the importer's whitespace rules, and unknown ones fail", () => {
  assert.equal(decode("n&emacr;hiyaw, k&amacr;-t&omacr;t&amacr;ng; &Amacr;nti, K&imacr;, &Emacr;k&amacr;"), "nēhiyaw, kā-tōtāng; Ānti, Kī, Ēkā");
  assert.equal(decode("a&nbsp;b&ensp;c&emsp;d&thinsp;e"), "a b c d e", "wide and non-breaking spaces become a space");
  assert.equal(decode("in&shy;vis&zwnj;i&zwj;ble&lrm;&rlm;"), "invisible", "invisible formatting characters are removed");
  assert.equal(decode("&lang;x&rang; &le; 3 &#8805; &#x2192;"), "⟨x⟩ ≤ 3 ≥ →");
  assert.equal(text("<p>Speed &amp; velocity &ndash; &#8805; 3&nbsp;m/s</p>"), "Speed & velocity – ≥ 3 m/s");
  unknownEntities.clear();
  assert.equal(decode("&notarealentity;"), "&notarealentity;", "an unknown entity is never guessed");
  assert.throws(() => assertNoUnknownEntities(), /notarealentity/, "and the import fails on it");
  unknownEntities.clear();
  assert.doesNotThrow(() => assertNoUnknownEntities());
});

test("no raw HTML entity is left in any imported text", () => {
  const entity = /&(?:[a-z][a-z0-9]*|#\d+|#x[0-9a-f]+);/i;
  for (const c of data.courses) {
    for (const u of c.units) assert.ok(!entity.test(u.name), `${c.name} unit ${u.name}`);
    for (const o of c.outcomes) {
      assert.ok(!entity.test(o.statement), `${c.name} ${o.code}`);
      for (const i of o.indicators) assert.ok(!entity.test(i.text), `${c.name} ${o.code} (${i.label})`);
    }
  }
  const nehiyawewin = byId.get(2)!;
  assert.ok(nehiyawewin.outcomes.some((o) => o.statement.includes("nēhiyaw")), "macron letters are decoded");
});

/* ---------- unit links ---------- */

test("every unit lists its outcomes, and every outcome's unitId names a unit that lists it", () => {
  for (const c of data.courses) {
    const outcomes = new Map(c.outcomes.map((o) => [o.id, o]));
    const units = new Map(c.units.map((u) => [u.id, u]));
    for (const o of c.outcomes) {
      if (!o.unitId) continue;
      const u = units.get(o.unitId);
      assert.ok(u, `${c.name} ${o.code}: unitId ${o.unitId} resolves`);
      assert.ok(u.outcomeIds?.includes(o.id), `${c.name} ${o.code} is listed by its unit`);
    }
    for (const u of c.units) {
      assert.ok(["outcomes", "themes", "empty"].includes(u.kind ?? ""), `${c.name} ${u.name} has a kind`);
      assert.ok(Array.isArray(u.outcomeIds), `${c.name} ${u.name} lists outcomeIds`);
      for (const id of u.outcomeIds!) assert.equal(outcomes.get(id)?.unitId, u.id, `${c.name} ${u.name}: ${id} points back to the unit`);
      if (u.kind !== "outcomes") assert.equal(u.outcomeIds!.length, 0, `${c.name} ${u.name} (${u.kind}) holds no outcomes`);
    }
    // A page with unit groups leaves no outcome outside them.
    if (c.units.some((u) => u.kind === "outcomes")) assert.ok(c.outcomes.every((o) => o.unitId), `${c.name}: every outcome sits in a unit`);
  }
});

test("ELA's suggested themes are kept apart from the outcome units, tied only to a course part", () => {
  const ela10 = byId.get(37)!;
  assert.deepEqual(
    ela10.units.filter((u) => u.kind !== "outcomes").map((u) => [u.name, u.kind]),
    [
      ["Units", "themes"],
      ["A10", "empty"],
      ["B10", "empty"],
    ],
  );
  const parts = Object.fromEntries((ela10.themes ?? []).map((t) => [t.name, t.coursePart]));
  assert.deepEqual(parts, { "Equity and Ethics": "B10", "The Challenges of Life": "A10", "The Mysteries of Life": "A10", "The World Around and Within Us": "B10" });
  for (const t of ela10.themes ?? []) assert.match(t.citation?.url ?? "", /CurriculumFile\?id=37$/);
  assert.equal(byId.get(791)!.suggestedUnits?.names.join("; "), "The Challenges of Life; The Mysteries of Life");
});

/* ---------- unavailable pages and status flags ---------- */

test("pages the site does not serve are named precisely, and status flags are set from evidence", () => {
  assert.deepEqual(pageNotFound('<div class="errorPage"><div class="error"><h1> Page Not Found</h1></div><div class="errorMessage"><p>The page you are looking for does not exist.</p></div></div>'), { heading: "Page Not Found", message: "The page you are looking for does not exist." });
  assert.equal(pageNotFound("<div id=\"cd_web_content\"></div>"), null);
  for (const id of [478, 479, 480]) {
    const c = byId.get(id)!;
    assert.equal(c.notACurriculum, true, `${c.name} is not a curriculum`);
    assert.equal(c.availability?.outcomesPage, "page-not-found");
    assert.match(c.problem ?? "", /“Page Not Found” page \(HTTP 200\)/);
  }
  assert.match(byId.get(202)!.problem ?? "", /answers HTTP 404/);
  for (const id of [67, 70, 71, 202]) assert.equal(byId.get(id)!.legacy, true, `${id} is legacy`);
  for (const id of [67, 70, 71, 202]) assert.equal(byId.get(id)!.listedInMenu, false, `${id} is not in the menus`);
  assert.equal(byId.get(63)!.listedInMenu, true);
  assert.equal(byId.get(669)!.listedInMenu, true, "Core French is listed through the French site's menu");
  for (const c of data.courses) {
    assert.equal(typeof c.listedInMenu, "boolean", `${c.name} listedInMenu`);
    assert.equal(typeof c.legacy, "boolean", `${c.name} legacy`);
    assert.equal(typeof c.notACurriculum, "boolean", `${c.name} notACurriculum`);
    if (c.legacy) assert.ok(c.legacyEvidence?.reason, `${c.name} says why it is legacy`);
  }
});

/* ---------- configurations ---------- */

test("course configurations come from the site and give modules their levels", () => {
  const html = `<div id="cd_web_content"><a class="cd_web_menu_item--selected" href="x">Welding 20</a>
  <div class="outcome-content-homepage__sub-list__element"><div class="outcome-content-homepage__sub-list__element__identifier"><a href="CurriculumOutcomeContent?id=143&amp;oc=125730&amp;occ=43">Module 2: Intermediate Safety (Core)</a></div>
  <div class="outcome-content-homepage__sub-list__element__metadata__property__key">Module Code</div><div class="outcome-content-homepage__sub-list__element__metadata__property__value">WLDG02</div></div>
  <div class="outcome_content_homepage__group__header">Optional Modules from the Welding Curriculum</div>
  <div class="outcome-content-homepage__sub-list__element"><div class="outcome-content-homepage__sub-list__element__identifier">Module 99B: Extended Study (Optional)</div>
  <div class="outcome-content-homepage__sub-list__element__metadata__property__key">Code de module</div><div class="outcome-content-homepage__sub-list__element__metadata__property__value">WLDG 99B</div></div></div>`;
  const p = parseConfigurationPage(html);
  assert.equal(p.name, "Welding 20");
  assert.deepEqual(
    p.sections.map((s) => [s.name, s.modules.map((m) => [m.code, m.curriculumId, m.ocId])]),
    [
      [null, [["WLDG02", 143, 125730]]],
      ["Optional Modules from the Welding Curriculum", [["WLDG 99B", null, null]]],
    ],
  );

  const configured = data.courses.filter((c) => c.configurations?.length);
  assert.ok(configured.length >= 30, `${configured.length} courses have configurations`);
  const outcomeIds = new Set(data.courses.flatMap((c) => c.outcomes.map((o) => o.id)));
  for (const c of configured)
    for (const cf of c.configurations!) {
      assert.match(cf.url, new RegExp(`CurriculumOutcomeContent\\?id=${c.curriculumId}&occ=${cf.occ}$`));
      assert.ok(cf.level === null || c.levels.includes(cf.level), `${c.name} ${cf.name} level ${cf.level}`);
      for (const s of cf.sections) {
        assert.deepEqual(s.moduleCodes, s.modules.map((m) => m.code));
        for (const m of s.modules) {
          if (m.outcomeId) assert.ok(outcomeIds.has(m.outcomeId), `${c.name} ${m.code} resolves`);
          if (m.datasetCode) assert.ok(m.correction, `${c.name} ${m.code} → ${m.datasetCode} says why`);
          assert.equal(m.inDataset, Boolean(m.outcomeId));
        }
      }
    }
  const modules = data.courses.flatMap((c) => c.outcomes.filter((o) => o.module).map((o) => ({ o, c })));
  assert.ok(modules.filter(({ o }) => o.level !== null).length >= 1800, "most modules now have a level");
  for (const { o, c } of modules) {
    assert.ok((o.levels ?? []).every((l) => c.levels.includes(l)), `${c.name} ${o.code} levels are the course's`);
    assert.equal(o.level, (o.levels ?? []).length === 1 ? o.levels![0] : (o.levels ?? []).length > 1 ? null : o.level, `${c.name} ${o.code}: level is set only when unique`);
  }
  const borrowed = byId.get(660)!.configurations!.flatMap((cf) => cf.sections.flatMap((s) => s.modules)).find((m) => m.code === "WLDG5")!;
  assert.deepEqual([borrowed.datasetCode, borrowed.borrowedFrom], ["WLDG05", 143], "a borrowed, typo-corrected code is flagged");
});

/* ---------- grouping metadata ---------- */

test("each course says how its source groups it, with evidence, and nothing is invented", () => {
  for (const c of data.courses) {
    if (!c.grouping) {
      assert.equal(c.outcomes.length + (c.document?.units.length ?? 0), 0, `${c.name} has nothing to group`);
      continue;
    }
    assert.ok(["unit", "module", "none"].includes(c.grouping.kind), c.name);
    assert.match(c.grouping.evidence.url, OFFICIAL, `${c.name} evidence url`);
    assert.ok(c.grouping.evidence.quote || c.grouping.evidence.observation, `${c.name} evidence says something`);
  }
  assert.equal(byId.get(159)!.grouping?.kind, "none");
  assert.match(byId.get(159)!.grouping?.evidence.quote ?? "", /not grouped according to strands/);
  const pe20 = byId.get(453)!;
  for (const o of pe20.outcomes) assert.ok(o.title && o.statement.startsWith(`${o.title} – `), `${o.code} title is the statement's own opening`);
  const pc30 = byId.get(159)!;
  assert.ok(pc30.outcomes.every((o) => o.goals?.length && o.goalsSource?.page), "every Pre-Calculus 30 outcome carries its goals and page");
});

/* ---------- documents ---------- */

test("every document extraction names its official source, the PDF's hash and date, and keeps OCR apart", () => {
  const files = readdirSync(`${DIR}/documents`).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 22, `${files.length} documents`);
  for (const f of files) {
    const raw = readFileSync(`${DIR}/documents/${f}`, "utf8");
    const d = JSON.parse(raw);
    assert.equal(`${d.curriculumId}.json`, f);
    assert.match(d.source.url, OFFICIAL, `${f} source url`);
    assert.match(d.source.sha256, SHA, `${f} sha256`);
    assert.match(d.source.retrievedOn, /^\d{4}-\d{2}-\d{2}$/, `${f} retrievedOn`);
    assert.ok(["text-layer", "ocr"].includes(d.textSource), `${f} textSource`);
    assert.ok(d.units.some((u: { items: unknown[] }) => u.items.length > 0), `${f} holds items`);
    assert.ok(!/blackboard\.com|prod01-/.test(raw), `${f} stores no signed storage URL`);
  }
  const withDocs = data.courses.filter((c) => c.document);
  assert.ok(withDocs.length >= 22, `${withDocs.length} courses carry a document`);
  for (const c of withDocs) {
    const d = c.document!;
    const file = JSON.parse(readFileSync(d.file.replace(/^src\/data\/curriculum/, DIR), "utf8"));
    assert.equal(d.sha256, file.source.sha256, `${c.name} document hash`);
    assert.equal(d.url, file.source.url, `${c.name} document url`);
    assert.equal(d.status, d.textSource === "ocr" ? "document-ocr-unverified" : "document-extracted", `${c.name} status`);
    assert.equal(c.outcomes.length, 0, `${c.name}: document content stays apart from website outcomes`);
    assert.equal(d.check, "same-hash", `${c.name}: the PDF still has the extracted hash`);
  }
  assert.equal(byId.get(182)!.document?.partial, true, "History 30 is marked partial");
  assert.equal(byId.get(179)!.document?.status, "document-extracted", "Native Studies 10 is a text-layer PDF");
  assert.equal(byId.get(173)!.document?.status, "document-ocr-unverified", "Social Studies 10 (1992) is OCR");
  assert.ok(byId.get(173)!.document!.flags.some((f) => f.flags.some((x) => /^segmentationUncertain/.test(x))), "OCR flags are carried through");
  const treaty = byId.get(481)!;
  assert.deepEqual([treaty.levels, treaty.grades, treaty.crossCurricular], [[10, 20, 30], [10, 11, 12], true]);
  assert.equal(treaty.document!.units.flatMap((u) => u.items).filter((i) => i.type === "outcome").length, 12, "Treaty Education has 12 Grade 10–12 outcomes");
});

/* ---------- by grade ---------- */

function checkByGrade(dataset: Dataset, dir: string) {
  for (const { grade, level } of GRADES) {
    const file = JSON.parse(readFileSync(`${dir}/grade-${grade}.json`, "utf8"));
    assert.equal(file.level, level);
    const courses = new Map<number, DatasetCourse>(file.courses.map((c: DatasetCourse) => [c.curriculumId, c]));
    assert.deepEqual([...courses.keys()].sort(), dataset.courses.filter((c) => c.levels.includes(level)).map((c) => c.curriculumId).sort(), `grade ${grade}: the courses offered at ${level}-level`);
    for (const c of dataset.courses) {
      const g = courses.get(c.curriculumId);
      if (!g) continue;
      for (const k of ["name", "listedInMenu", "legacy", "preliminary", "notACurriculum", "problem"] as const) assert.deepEqual(g[k], c[k], `grade ${grade} ${c.name} keeps ${k}`);
      const ids = new Set(g.outcomes.map((o) => o.id));
      for (const o of c.outcomes) assert.equal(ids.has(o.id), outcomeLevels(o, c).includes(level), `grade ${grade} ${c.name} ${o.code}`);
      for (const o of g.outcomes) {
        const { levelBasis, ...rest } = o as typeof o & { levelBasis: string };
        assert.ok(["outcome", "course"].includes(levelBasis));
        assert.deepEqual(rest, c.outcomes.find((x) => x.id === o.id), `grade ${grade} ${c.name} ${o.code} is copied unchanged`);
      }
      for (const u of g.units) for (const id of u.outcomeIds ?? []) assert.ok(ids.has(id), `grade ${grade} ${c.name} ${u.name}: ${id} is at this level`);
      for (const cf of g.configurations ?? []) assert.equal(cf.level, level);
      assert.deepEqual(g, courseAtLevel(c, level));
    }
  }
}

test("the by-grade files hold every outcome at its level's grade, unchanged", () => {
  checkByGrade(data, `${DIR}/by-grade`);
  for (const c of data.courses) for (const o of c.outcomes) assert.ok(outcomeLevels(o, c).length > 0, `${c.name} ${o.code} appears in at least one grade`);
});

test("the French dataset, when imported, carries English equivalents and splits by grade", { skip: !existsSync(`${DIR}/sk-fr.json`) }, () => {
  const fr = JSON.parse(readFileSync(`${DIR}/sk-fr.json`, "utf8")) as Dataset & { courses: (DatasetCourse & { englishEquivalent?: unknown; program?: string | null })[] };
  assert.equal(fr.language, "fr");
  assert.ok(fr.courses.length >= 150, `${fr.courses.length} French courses`);
  for (const c of fr.courses) assert.ok("englishEquivalent" in c, `${c.name} says its English equivalent (or null)`);
  checkByGrade(fr, `${DIR}/by-grade/fr`);
});

/* ---------- parser ---------- */

test("the outcomes page is read group by group, and themes and empty groups are told apart", () => {
  const page = `<title>X | Saskatchewan Curriculum</title><div id="cd_web_content"><div class="outcome-content-homepage__list">
<div class="outcome-content-homepage__group"><div class="outcome_content_homepage__group__header"><a href="CurriculumOutcomeContent?id=1&amp;oc=10">Unit A</a></div>
<div class="outcome-content-homepage__sub-list"><div class="outcome-content-homepage__sub-list__element"><div class="outcome-content-homepage__sub-list__element__identifier"><a href="CurriculumOutcomeContent?id=1&amp;oc=11">A1</a></div><div class="outcome-content-homepage__sub-list__element__text">First.</div></div></div></div>
<div class="outcome-content-homepage__group"><div class="outcome_content_homepage__group__header"><a href="CurriculumOutcomeContent?id=1&amp;oc=20">Units</a></div>
<div class="outcome-content-homepage__sub-list"><div class="outcome-content-homepage__sub-list__element"><div class="outcome-content-homepage__sub-list__element__identifier"><a href="FullResourceList?id=1#?f_oc_21=true">A Theme</a></div><div class="outcome-content-homepage__sub-list__element__text"></div></div></div></div>
<div class="outcome-content-homepage__group"><div class="outcome_content_homepage__group__header"><a href="CurriculumOutcomeContent?id=1&amp;oc=30">A10</a></div></div>
</div></div><footer id="page-footer"></footer>`;
  const p = parseOutcomesPage(page, 1);
  assert.deepEqual(p.problems, []);
  assert.deepEqual(p.units.map((u: { name: string; kind: string; outcomeOcIds: number[] }) => [u.name, u.kind, u.outcomeOcIds]), [
    ["Unit A", "outcomes", [11]],
    ["Units", "themes", []],
    ["A10", "empty", []],
  ]);
  assert.deepEqual(p.outcomes, [{ ocId: 11, code: "A1", statement: "First.", unitOcId: 10 }]);
  assert.deepEqual(p.themes, [{ ocId: 21, name: "A Theme", groupOcId: 20, groupName: "Units" }]);
});
