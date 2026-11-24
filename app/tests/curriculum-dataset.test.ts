import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { currentCatalog, findOutcome, outcomeLimitations, outcomeProblems, OUTCOME_ID } from "@/lib/curriculum/catalog";
import { loadDataset, searchOutcomes } from "@/lib/curriculum/dataset";
import { isCatalogCourse, toCatalogCourse, type Dataset } from "@/lib/curriculum/imported";
import { outcomeList } from "@/lib/resources/sanitize";
// The importer's own parsers (plain JavaScript; importing it does not start a crawl).
import { compareWithCsv, isSecondary, levelsInName, parseCsv, parseOutcomePage, text, withoutTrailingBrackets } from "../scripts/curriculum/import-sk.mjs";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const data = JSON.parse(readFileSync("src/data/curriculum/sk.json", "utf8")) as Dataset;
const OFFICIAL = "curriculum.gov.sk.ca";

/* ---------- the imported file ---------- */

test("every imported course and outcome carries its official source and an exact fingerprint", () => {
  assert.match(data.importedOn, /^\d{4}-\d{2}-\d{2}$/);
  const ids = new Set<string>();
  for (const c of data.courses) {
    assert.equal(c.id, `sk-${c.curriculumId}`);
    assert.equal(new URL(c.url).hostname, OFFICIAL, c.name);
    assert.ok(c.levels.length > 0 && c.levels.every((l) => [10, 20, 30].includes(l)), `${c.name} has 10/20/30 levels`);
    assert.deepEqual(c.grades, c.levels.map((l) => (l === 10 ? 10 : l === 20 ? 11 : 12)), c.name);
    // Treaty Education is a K-12 curriculum taught within other subjects; its Grade 10–12 part is imported as a course.
    assert.ok(isSecondary(c.name) || c.crossCurricular, `${c.name} is a Grade 10–12 course`);
    for (const o of c.outcomes) {
      const where = `${c.name} ${o.code}`;
      assert.ok(o.code.trim() && o.statement.trim(), `${where} has a code and wording`);
      assert.equal(o.fingerprint, `sha256:${sha256(o.statement)}`, `${where} fingerprint`);
      const u = new URL(o.url);
      assert.equal(u.hostname, OFFICIAL, where);
      assert.equal(u.searchParams.get("id"), String(c.curriculumId), where);
      assert.equal(u.searchParams.get("oc"), String(o.ocId), where);
      assert.ok(["cross-checked", "imported"].includes(o.status), where);
      assert.equal(o.status === "cross-checked", o.csv === "match" || o.csv === "prefix", `${where}: cross-checked only when the CSV agrees`);
      assert.ok(o.level === null || c.levels.includes(o.level), `${where} level ${o.level} is one of the course's`);
      for (const i of o.indicators) assert.ok(i.label && i.text.trim(), `${where} indicator (${i.label})`);
      assert.ok(!/<[a-z/][^>]*>/i.test(o.statement + o.indicators.map((i) => i.text).join(" ")), `${where} has no HTML left in it`);
      assert.ok(!ids.has(o.id), `${o.id} is unique`);
      ids.add(o.id);
      assert.match(o.id, OUTCOME_ID);
    }
  }
});

test("the import covers the Grade 10–12 courses teachers expect", () => {
  const byId = new Map(data.courses.map((c) => [c.curriculumId, c]));
  for (const [id, name] of [
    [63, "Science 10"],
    [155, "Foundations of Mathematics and Pre-calculus 10"],
    [163, "Calculus 30"],
    [37, "English Language Arts 10"],
    [609, "Arts Education 10, 20, 30"],
    [687, "Spanish 10, 20, 30"],
  ] as const) {
    assert.equal(byId.get(id)?.name, name, `${name} is imported`);
  }
  assert.ok(data.courses.length >= 130, `${data.courses.length} courses imported`);
  assert.ok(data.courses.filter((c) => c.outcomes.length > 0).length >= 95, "most courses publish outcomes");
  for (const c of data.courses.filter((x) => x.outcomes.length === 0)) assert.ok(c.problem, `${c.name} says why it has no outcomes`);
  assert.match(byId.get(173)!.problem ?? "", /unit names only/, "older Social Studies lists units only on the site");
  const all = data.courses.flatMap((c) => c.outcomes);
  assert.ok(all.filter((o) => o.status === "cross-checked").length / all.length > 0.95, "nearly every outcome matches the Ministry CSV");
  const acct1 = byId.get(526)!.outcomes.find((o) => o.code === "ACCT1")!;
  assert.equal(acct1.statement, "Investigate the need for accounting in business.", "module pages give the module's code and its outcome");
  assert.match(acct1.printedWith ?? "", /^Module 1: Introduction to Accounting/);
  // A module's number is not a level: its level comes from the course configuration that includes it.
  assert.equal(acct1.level, 10, "ACCT1 is configured into Accounting 10");
  const acct20 = byId.get(526)!.outcomes.find((o) => o.code === "ACCT20")!;
  assert.deepEqual([acct20.level, acct20.levels], [30, [30]], "module 20 is configured into Accounting 30, not 20");
  assert.equal(acct20.levelSource, "course configurations");
  assert.ok(!all.some((o) => /^Module \d/.test(o.code)), "no module name stands in for a code");
  assert.ok(!data.courses.some((c) => /\b(Mathematics|Science) [1-9]$/.test(c.name)), "no Kindergarten to Grade 9 course");
  const sci10 = byId.get(63)!;
  assert.equal(sci10.outcomes.length, 13, "Science 10 has 13 outcomes on the official page");
  assert.ok(sci10.outcomes.every((o) => o.status === "cross-checked"), "every Science 10 outcome matches the Ministry CSV");
});

/* ---------- conversion into the catalog ---------- */

test("imported outcomes keep the dataset's id and wording and carry their indicators", () => {
  const sci10 = toCatalogCourse(data.courses.find((c) => c.curriculumId === 63)!, data.importedOn);
  const fm2 = sci10.units.flatMap((u) => u.outcomes).find((o) => o.code === "SCI10-FM2")!;
  assert.equal(fm2.id, "sk-63-110477");
  assert.equal(fm2.status, "cross-checked");
  assert.equal(fm2.statement, "Investigate and represent the motion of objects that travel at a constant speed in a straight line.");
  assert.equal(fm2.indicatorsStatus, "imported");
  assert.ok(fm2.indicators.length >= 8 && fm2.indicators.every((i) => i.status === "imported"));
  assert.equal(new Set(fm2.indicators.map((i) => i.id)).size, fm2.indicators.length, "indicator ids stay unique where the page prints (b) twice");
  assert.ok((fm2.notes ?? []).some((n) => /\(b\)/.test(n)), "the doubled (b) is flagged for a person");
  assert.ok(isCatalogCourse(sci10));
  assert.equal(isCatalogCourse({ ...sci10, units: [{ id: "u", name: "x", outcomes: [{ id: 1 }] }] }), false);
});

test("loading the dataset registers every course, and every outcome passes the catalog checks", () => {
  const { courses } = loadDataset();
  assert.ok(courses.size >= 1);
  const found = findOutcome("sk-63-110477")!;
  assert.equal(found.course.origin, "import", "Science 10 now comes from the import");
  assert.equal(currentCatalog()[0].courses.filter((c) => c.curriculumId === 63).length, 1, "Science 10 is registered once");
  for (const c of courses.values())
    for (const u of c.units)
      for (const o of u.outcomes) {
        const f = findOutcome(o.id)!;
        assert.equal(f.outcome, o);
        assert.deepEqual(outcomeProblems(f, sha256), [], `${c.name} ${o.code}`);
      }
  const imported = [...courses.values()].flatMap((c) => c.units.flatMap((u) => u.outcomes)).find((o) => o.status === "cross-checked")!;
  assert.ok(outcomeLimitations(findOutcome(imported.id)!).some((l) => /automatically/.test(l)), "automatic copies say so");
});

test("search finds outcomes by code and by words, and respects the grade filter", () => {
  loadDataset();
  assert.equal(searchOutcomes("SCI10-FM2").hits[0]?.id, "sk-63-110477");
  assert.ok(searchOutcomes("constant speed").hits.some((h) => h.id === "sk-63-110477"));
  assert.equal(searchOutcomes("constant speed", { grade: 12 }).hits.some((h) => h.id === "sk-63-110477"), false);
  assert.equal(searchOutcomes("   ").total, 0);
  assert.ok(searchOutcomes("trigonometric ratios").hits.some((h) => h.code === "FP10.4"));
});

test("only well-formed outcome ids survive sanitising; the server still checks each one", () => {
  assert.deepEqual(outcomeList(["sk-63-110477", "sk-155-111596", "SCI10-FM2", "<script>", 42, "sk-"]), ["sk-63-110477", "sk-155-111596"]);
});

/* ---------- the importer's parsers ---------- */

test("the importer keeps official text as printed, minus markup", () => {
  assert.equal(text("<p>Demonstrate understanding of SI units including:\n<ul><li>linear measurement</li><li>volume</li></ul></p>"), "Demonstrate understanding of SI units including:\n- linear measurement\n- volume");
  assert.equal(text("Speed &amp; velocity &ndash; &#8805; 3&nbsp;m/s"), "Speed & velocity – ≥ 3 m/s");
  assert.equal(withoutTrailingBrackets("Solve problems.\n([C, CN, PS])"), "Solve problems.");
  assert.deepEqual(levelsInName("Agriculture Production A10, B10, A20, B20, A30, B30"), [10, 20, 30]);
  assert.deepEqual(levelsInName("Instructional Physical Education 20/30 (1994)"), [20, 30]);
  assert.deepEqual(levelsInName("English Language Arts 10 (2026)"), [10]);
  assert.equal(isSecondary("Mathematics 9"), false);
  assert.equal(isSecondary("Aboriginal Languages K-12"), false);
});

test("the CSV cross-check compares words, and accepts the CSV's shortened statements", () => {
  assert.deepEqual(parseCsv('"Outcome","FP10.4","Develop and apply the ""primary"" ratios."\n'), [["Outcome", "FP10.4", 'Develop and apply the "primary" ratios.']]);
  assert.equal(compareWithCsv("Investigate use of own and others' artistic voice.", "Investigate use of own and others’ artistic voice."), "match");
  assert.equal(compareWithCsv("Demonstrate understanding of SI and imperial units of measurement including:", "Demonstrate understanding of SI and imperial units of measurement including:\n- linear measurement"), "prefix");
  assert.equal(compareWithCsv("Investigate career paths", "Investigate the motion of objects."), "mismatch");
  assert.equal(compareWithCsv("Short", "Short and longer"), "mismatch", "a very short CSV text is not enough to agree");
});

test("indicator rows without a letter are kept as notes, not indicators", () => {
  const page = `<div id="cd_web_content"><div class="content_section_header"> FP10.3</div><div class="outcome_content_text"><p>Statement.</p></div><p>[C, ME]</p><div class="outcome_content_child_list"><table>
<tr class="outcome_content_child"><td class="outcome_content_child_identifier"> </td><td class="indicator_child_text">A note.</td></tr>
<tr class="outcome_content_child"><td class="outcome_content_child_identifier"><strong>(a)</strong></td><td class="indicator_child_text"><p>First.</p></td></tr>
</table></div></div>`;
  const d = parseOutcomePage(page);
  assert.equal(d.header, "FP10.3");
  assert.equal(d.statement, "Statement.");
  assert.equal(d.printedWith, "[C, ME]");
  assert.deepEqual(d.indicators, [{ label: "a", text: "First." }]);
  assert.deepEqual(d.guidance, ["A note."]);
});
