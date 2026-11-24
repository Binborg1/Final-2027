import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesQuery } from "@/lib/ui/search";

/* The chapter picker's search: words in any order, case and accents ignored. */

test("every word of the search must be in the chapter title, in any order", () => {
  const title = "Module 4A: Digital Citizenship A (Core)";
  assert.equal(matchesQuery(title, ""), true, "an empty search shows everything");
  assert.equal(matchesQuery(title, "   "), true);
  assert.equal(matchesQuery(title, "citizen"), true);
  assert.equal(matchesQuery(title, "4a"), true);
  assert.equal(matchesQuery(title, "core digital"), true);
  assert.equal(matchesQuery(title, "digital law"), false);
});

test("case and accents don't matter", () => {
  assert.equal(matchesQuery("Énergie et mouvement", "energie"), true);
  assert.equal(matchesQuery("Energy and motion", "ÉNERGY"), true);
});
