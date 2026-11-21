import { findOutcome, isAutomatic, outcomeProblems } from "@/lib/curriculum/catalog";
import { gradeOfLevel } from "@/lib/curriculum/imported";
import { codeOf } from "@/lib/curriculum/sources";
import { isQuestionKind, OUTCOME_VERBS } from "@/lib/resources/kinds";
import type { Calc, CheckRow, Difficulty, Draft, Item, Section, Verb } from "@/lib/resources/types";
import { compileExpr, formatNumber } from "@/lib/math/expr";

/**
 * The checks behind review and approval. Every result is computed from the
 * draft as it is now, and nothing is scored:
 * - structure: complete questions, only the chosen catalog outcomes, rubrics and timings that add up;
 * - answers: recomputed by code wherever a fact is machine-checkable; the rest is listed as not verified;
 * - coverage: every chosen outcome is addressed;
 * - review: what only the teacher can decide, tied to a fingerprint of the exact content.
 */

export function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/* ---------- fingerprints: any meaningful edit voids the review ---------- */

export function itemFp(i: Item) {
  const { type, prompt, options, correctId, tf, answer, pairs, calc, solution, rubric, outcomeIds } = i;
  return hash(JSON.stringify({ type, prompt, options, correctId, tf, answer, pairs, calc, solution, rubric, outcomeIds }));
}
export function sectionFp(s: Section) {
  const { kind, title, body, claim, outcomeIds } = s;
  return hash(JSON.stringify({ kind, title, body, claim, outcomeIds }));
}
export type ReviewState = "unreviewed" | "reviewed" | "changed";
export const itemReview = (i: Item): ReviewState => (i.reviewedFp === null ? "unreviewed" : i.reviewedFp === itemFp(i) ? "reviewed" : "changed");
/** Question sections are reviewed through their questions; text sections are reviewed whole. */
export const sectionReview = (s: Section): ReviewState => (s.reviewedFp === null ? "unreviewed" : s.reviewedFp === sectionFp(s) ? "reviewed" : "changed");

/* ---------- numbering and totals ---------- */

export function numbering(sections: Section[]) {
  const map = new Map<string, number>();
  let n = 0;
  sections.forEach((s) => s.items.forEach((i) => map.set(i.id, ++n)));
  return map;
}
export const allItems = (d: { sections: Section[] }) => d.sections.flatMap((s) => s.items);
export const totalMarks = (d: { sections: Section[] }) => allItems(d).reduce((n, i) => n + i.marks, 0);
export const reviewables = (d: Draft) => [
  ...d.sections.filter((s) => s.kind !== "questions").map((s) => ({ id: s.id, state: sectionReview(s) })),
  ...allItems(d).map((i) => ({ id: i.id, state: itemReview(i) })),
];

/* ---------- answers ---------- */

export function evalCalc(c: Calc): number | null {
  try {
    const v = compileExpr(c.expr, Object.keys(c.vars))(c.vars);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
export const firstNumber = (text: string): number | null => {
  const m = text.replace(/−/g, "-").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.005 * Math.abs(b), 0.01);

export function itemProblems(i: Item): string[] {
  const p: string[] = [];
  if (!i.prompt.trim()) p.push("has no question text");
  if (i.type === "mcq") {
    const filled = i.options.filter((o) => o.text.trim());
    if (filled.length < 2) p.push("needs at least two answer options");
    if (new Set(filled.map((o) => o.text.trim().toLowerCase())).size !== filled.length) p.push("repeats an option");
    if (!i.options.find((o) => o.id === i.correctId)?.text.trim()) p.push("has no correct option marked");
  }
  if (i.type === "tf" && i.tf === null) p.push("has no answer marked");
  if (i.type === "fill") {
    if (!/_{3,}/.test(i.prompt)) p.push("has no blank (use ______)");
    if (!i.answer.trim()) p.push("has no answer in the key");
  }
  if (i.type === "match") {
    const ok = i.pairs.filter((x) => x.left.trim() && x.right.trim());
    if (ok.length < 2) p.push("needs at least two complete pairs");
    if (new Set(ok.map((x) => x.right.trim().toLowerCase())).size !== ok.length) p.push("repeats an answer on the right");
  }
  if (i.type === "calc" && !i.answer.trim()) p.push("has no answer in the key");
  if ((i.type === "short" || i.type === "long") && i.rubric.filter((r) => r.text.trim()).length === 0) p.push("has no marking rubric");
  return p;
}

/* ---------- the checks ---------- */

export function computeChecks(d: Draft): CheckRow[] {
  const rows: CheckRow[] = [];
  const num = numbering(d.sections);
  const items = allItems(d);
  const q = (i: Item) => `Q${num.get(i.id)}`;
  const allowed = new Set(d.outcomeIds);

  /* structure */
  const incomplete = items.filter((i) => itemProblems(i).length > 0);
  incomplete.forEach((i) => rows.push({ id: `complete-${i.id}`, group: "structure", state: "failed", label: `${q(i)} is incomplete`, detail: `It ${itemProblems(i).join(", ")}.`, targetId: i.id }));
  if (items.length > 0 && incomplete.length === 0) rows.push({ id: "complete", group: "structure", state: "passed", label: "Every question is complete", detail: `${items.length} questions have their text, answers and keys.` });

  const stray = [...items, ...d.sections].filter((x) => x.outcomeIds.some((id) => !allowed.has(id)));
  if (stray.length > 0) {
    rows.push({ id: "outcome-allow", group: "structure", state: "failed", label: "Cites an outcome this resource does not use", detail: `${stray.length} part(s) cite outcomes that were not chosen for this resource.` });
  } else if (d.outcomeIds.length > 0) {
    rows.push({ id: "outcome-allow", group: "structure", state: "passed", label: "Outcomes come from Funza's catalog", detail: `Every part cites only ${d.outcomeIds.map(codeOf).join(", ")}, supplied from the catalog. Nothing else can be cited.` });  }
  d.outcomeIds.forEach((id) => {
    const found = findOutcome(id);
    const problems = found ? outcomeProblems(found) : ["It is not in the catalog."];
    rows.push(
      problems.length === 0
        ? { id: `catalog-${id}`, group: "structure", state: "passed", label: `${codeOf(id)} wording is intact`, detail: `Quoted exactly as the catalog holds it (${found!.outcome.fingerprint.slice(0, 15)}…).` }
        : { id: `catalog-${id}`, group: "structure", state: "failed", label: `${codeOf(id)} cannot be used`, detail: problems[0] },
    );
  });

  const rubricItems = items.filter((i) => i.type === "short" || i.type === "long");
  const badRubric = rubricItems.filter((i) => i.rubric.reduce((n, r) => n + r.marks, 0) !== i.marks);
  badRubric.forEach((i) => {
    const sum = i.rubric.reduce((n, r) => n + r.marks, 0);
    rows.push({
      id: `rubric-${i.id}`,
      group: "structure",
      state: "failed",
      label: `${q(i)} rubric adds up to ${sum} marks`,
      detail: `The question is worth ${i.marks} mark${i.marks === 1 ? "" : "s"}.`,
      targetId: i.id,
      fix: { label: `Make it worth ${sum}`, action: { kind: "rubric-total", itemId: i.id, marks: sum } },
    });
  });
  if (rubricItems.length > 0 && badRubric.length === 0) rows.push({ id: "rubric", group: "structure", state: "passed", label: "Rubrics match their marks", detail: `${rubricItems.length} written question(s) checked.` });

  d.sections
    .filter((s) => s.kind !== "questions" && !s.body.trim())
    .forEach((s) => rows.push({ id: `empty-${s.id}`, group: "structure", state: "failed", label: `“${s.title || "Untitled section"}” is empty`, detail: "Add text or remove the section.", targetId: s.id }));
  if (d.sections.length === 0) rows.push({ id: "empty", group: "structure", state: "failed", label: "The resource is empty", detail: "Add at least one part." });

  /* answers */
  items
    .filter((i) => i.calc)
    .forEach((i) => {
      const c = i.calc!;
      const v = evalCalc(c);
      if (v === null) return;
      const shown = `${formatNumber(v)} ${c.unit}`;
      if (i.type === "mcq") {
        const correct = i.options.find((o) => o.id === i.correctId);
        const given = correct ? firstNumber(correct.text) : null;
        const match = i.options.find((o) => firstNumber(o.text) !== null && close(firstNumber(o.text)!, v));
        rows.push(
          given !== null && close(given, v)
            ? { id: `ans-${i.id}`, group: "answers", state: "passed", label: `${q(i)} answer recomputed`, detail: `${c.show} = ${shown}, matching the marked option.`, targetId: i.id }
            : {
                id: `ans-${i.id}`,
                group: "answers",
                state: "failed",
                label: `${q(i)} marked answer is wrong`,
                detail: `${c.show} = ${shown}, but “${correct?.text ?? "nothing"}” is marked correct.`,
                targetId: i.id,
                fix: match ? { label: `Mark “${match.text}” correct`, action: { kind: "use-recomputed", itemId: i.id, value: match.id } } : undefined,
              },
        );
        return;
      }
      const given = firstNumber(i.answer);
      rows.push(
        given !== null && close(given, v)
          ? { id: `ans-${i.id}`, group: "answers", state: "passed", label: `${q(i)} answer recomputed`, detail: `${c.show} = ${shown}, matching the key.`, targetId: i.id }
          : {
              id: `ans-${i.id}`,
              group: "answers",
              state: "failed",
              label: `${q(i)} answer key is wrong`,
              detail: `${c.show} = ${shown}, but the key says “${i.answer || "nothing"}”.`,
              targetId: i.id,
              fix: { label: `Use ${shown}`, action: { kind: "use-recomputed", itemId: i.id, value: shown } },
            },
      );
    });
  d.sections
    .filter((s) => s.claim)
    .forEach((s) => {
      const c = s.claim!;
      const v = evalCalc(c);
      if (v === null) return;
      const shown = `${formatNumber(v)} ${c.unit}`;
      const stillThere = s.body.includes(c.stated);
      const ok = stillThere && firstNumber(c.stated) !== null && close(firstNumber(c.stated)!, v);
      rows.push(
        !stillThere
          ? { id: `claim-${s.id}`, group: "answers", state: "unverifiable", label: `“${s.title}” example changed`, detail: "The worked example was edited, so Funza can no longer find the result it checked. Confirm it as you review.", targetId: s.id }
          : ok
            ? { id: `claim-${s.id}`, group: "answers", state: "passed", label: `“${s.title}” recomputed`, detail: `${c.show} = ${shown}, matching the text.`, targetId: s.id }
            : {
                id: `claim-${s.id}`,
                group: "answers",
                state: "failed",
                label: `“${s.title}” result is wrong`,
                detail: `${c.show} = ${shown}, but the text says ${c.stated}.`,
                targetId: s.id,
                fix: { label: `Use ${shown}`, action: { kind: "use-recomputed-claim", sectionId: s.id, value: shown } },
              },
      );
    });
  const unchecked = items.filter((i) => !i.calc);
  if (unchecked.length > 0)
    rows.push({
      id: "ans-unverifiable",
      group: "answers",
      state: "unverifiable",
      label: `${unchecked.length} answer${unchecked.length === 1 ? "" : "s"} Funza cannot recompute`,
      detail: `${unchecked.map(q).join(", ")}: conceptual answers. You confirm each one as you review it.`,
    });
  const textual = d.sections.filter((s) => s.kind === "text" && !s.claim);
  if (textual.length > 0)
    rows.push({
      id: "text-unverifiable",
      group: "answers",
      state: "unverifiable",
      label: `${textual.length} text section${textual.length === 1 ? "" : "s"} not fact-checked`,
      detail: "Funza does not check prose against a source. You confirm each section as you review it.",
    });

  /* coverage */
  d.outcomeIds.forEach((id) => {
    const its = items.filter((i) => i.outcomeIds.includes(id));
    const secs = d.sections.filter((s) => s.kind !== "questions" && s.outcomeIds.includes(id));
    const marks = its.reduce((n, i) => n + i.marks, 0);
    rows.push(
      its.length > 0 || secs.length > 0
        ? { id: `cov-${id}`, group: "coverage", state: "passed", label: `${codeOf(id)} is covered`, detail: its.length > 0 ? `${its.length} question${its.length === 1 ? "" : "s"}, ${marks} mark${marks === 1 ? "" : "s"}.` : `${secs.length} section${secs.length === 1 ? "" : "s"}.` }
        : {
            id: `cov-${id}`,
            group: "coverage",
            state: "failed",
            label: `Nothing covers ${codeOf(id)}`,
            detail: "The resource claims this outcome but no part addresses it.",
            fix: isQuestionKind(d.kind) ? { label: "Add a question", action: { kind: "add-question", outcomeId: id } } : { label: `Remove ${codeOf(id)}`, action: { kind: "remove-outcome", outcomeId: id } },
          },
    );
  });

  /* review */
  const rv = reviewables(d);
  const fresh = rv.filter((r) => r.state === "unreviewed");
  if (fresh.length > 0)
    rows.push({
      id: "review-fresh",
      group: "review",
      state: "needs-you",
      label: `${fresh.length} part${fresh.length === 1 ? "" : "s"} to review`,
      detail: "Read each one, fix what is wrong, then mark it reviewed. Shortcut: R marks the selected part, N jumps to the next.",
      targetId: fresh[0].id,
    });
  rv.filter((r) => r.state === "changed").forEach((r) => {
    const it = items.find((i) => i.id === r.id);
    rows.push({ id: `changed-${r.id}`, group: "review", state: "stale", label: `${it ? q(it) : `“${d.sections.find((s) => s.id === r.id)?.title}”`} changed after you reviewed it`, detail: "Its checks ran again. Review it once more.", targetId: r.id });
  });
  const found = d.outcomeIds.map((id) => findOutcome(id)).filter((f) => f !== null);
  const grades = [...new Set(found.map((f) => gradeOfLevel(f.outcome.level ?? (f.course.levels?.length === 1 ? f.course.levels[0] : null)) ?? (f.course.origin === "hand" ? f.course.grade : null)))];
  const gradeText = grades.length === 1 && grades[0] ? `Grade ${grades[0]}` : "your grade";
  if (!d.globals.readingLevel) rows.push({ id: "g-reading", group: "review", state: "needs-you", label: `Reading level suits ${gradeText}`, detail: "Funza does not grade reading level. Confirm it for your students." });
  // One confirmation covers what no person has checked in the curriculum text (the global keeps its original name).
  const automatic = found.filter((f) => isAutomatic(f.outcome) || f.outcome.indicatorsStatus === "imported").map((f) => f.outcome.code);
  const pending = found.filter((f) => f.outcome.indicatorsStatus === "pending").map((f) => f.outcome.code);
  if (automatic.length > 0 && !d.globals.indicatorsPending)
    rows.push({
      id: "g-indicators",
      group: "review",
      state: "needs-you",
      label: "Curriculum text was copied automatically",
      detail: `No person has compared ${automatic.join(", ")} with the official page yet${pending.length > 0 ? `, and ${pending.join(", ")} has no indicators in Funza, so alignment there is to the statement only` : ""}. Open the outcome's official page from Curriculum and confirm the wording.`,
    });
  else if (pending.length > 0 && !d.globals.indicatorsPending)
    rows.push({ id: "g-indicators", group: "review", state: "needs-you", label: "Indicators are not in Funza yet", detail: `For ${pending.join(", ")}, alignment is to the outcome statement only. Confirm you accept that.` });
  return rows;
}

export function checkCounts(rows: CheckRow[]) {
  const c = { passed: 0, failed: 0, unverifiable: 0, "needs-you": 0, stale: 0 };
  rows.forEach((r) => c[r.state]++);
  return c;
}

export const approvalBlockers = (rows: CheckRow[]) => rows.filter((r) => r.state === "failed" || r.state === "needs-you" || r.state === "stale");

/* ---------- alignment ---------- */

export function verbCoverage(d: Draft) {
  const num = numbering(d.sections);
  return d.outcomeIds.flatMap((id) =>
    (OUTCOME_VERBS[id] ?? []).map((verb) => {
      const its = allItems(d).filter((i) => i.outcomeIds.includes(id) && i.verbs.includes(verb));
      const secs = d.sections.filter((s) => s.kind !== "questions" && s.outcomeIds.includes(id) && s.verbs.includes(verb));
      return { outcomeId: id, verb, where: [...its.map((i) => `Q${num.get(i.id)}`), ...secs.map((s) => s.title)] };
    }),
  );
}

export function difficultyMarks(d: Draft) {
  const out: Record<Difficulty, number> = { foundational: 0, grade: 0, extending: 0 };
  allItems(d).forEach((i) => (out[i.difficulty] += i.marks));
  return out;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { foundational: "Foundational", grade: "Grade level", extending: "Extending" };
export const verbLabel = (v: Verb) => v[0].toUpperCase() + v.slice(1);
