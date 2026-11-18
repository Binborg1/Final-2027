import { allowedIndicatorIds, findOutcome, usableOutcome } from "@/lib/curriculum/catalog";
import {
  BLOCK_KINDS,
  BLOCK_LABELS,
  blockFingerprint,
  ITEM_COUNT,
  motionVisualization,
  type BlockItem,
  type BlockKind,
  type CurriculumBlock,
  type LessonCurriculum,
} from "@/lib/curriculum/lesson";
import { compileExpr, formatNumber } from "@/lib/visualizations/expr";

/**
 * The checks behind an alignment report. Three kinds, kept apart on purpose:
 * - structural: is the alignment well formed (real, supplied outcome ids; required content)?
 * - factual: are the answers right, recomputed by code wherever a fact is machine-checkable?
 * - judgment: what only a teacher can decide; listed, never scored.
 * All checks are pure and run again on every edit, so an edited block can
 * never carry results that were computed for its old content.
 */

export type Check = { id: string; label: string; ok: boolean; detail: string };
export type FactualSummary = "verified" | "failed" | "not-checkable";
export type Judgment = { id: string; text: string };

export type BlockContext = { allowedOutcomeIds: ReadonlySet<string>; allowedIndicatorIds: ReadonlySet<string> };

export type BlockReport = {
  fingerprint: string;
  structural: Check[];
  structuralOk: boolean;
  factual: Check[];
  factualSummary: FactualSummary;
  judgments: Judgment[];
  /** Judgments the teacher confirmed for this exact content. */
  acknowledged: string[];
  /** True when the teacher had confirmed judgments for an earlier version of the content. */
  acknowledgementsCleared: boolean;
  /** Everything that stops the block from being approved now. */
  approvalProblems: string[];
};

/** The lesson's outcome, when it is still usable, is the only one a block may cite. */
export function lessonContext(curriculum: LessonCurriculum | null): BlockContext {
  if (!curriculum) return { allowedOutcomeIds: new Set(), allowedIndicatorIds: new Set() };
  const usable = usableOutcome(curriculum.outcomeId);
  if (!usable.ok || usable.found.outcome.fingerprint !== curriculum.fingerprint) {
    return { allowedOutcomeIds: new Set(), allowedIndicatorIds: new Set() };
  }
  return { allowedOutcomeIds: new Set([curriculum.outcomeId]), allowedIndicatorIds: allowedIndicatorIds(usable.found.outcome) };
}

const check = (id: string, label: string, ok: boolean, detail: string): Check => ({ id, label, ok, detail });

function itemProblems(item: BlockItem, n: number): string[] {
  const p: string[] = [];
  const filled = item.options.filter((o) => o.text.trim());
  if (!item.prompt.trim()) p.push(`question ${n} has no wording`);
  if (filled.length < 2) p.push(`question ${n} needs at least two answer options`);
  if (new Set(filled.map((o) => o.text.trim().toLowerCase())).size !== filled.length) p.push(`question ${n} repeats an option`);
  if (!item.options.find((o) => o.id === item.correctOptionId)?.text.trim()) p.push(`question ${n} has no correct option marked`);
  if (!item.hints.some((h) => h.trim())) p.push(`question ${n} needs a hint`);
  if (!item.whyCorrect.trim()) p.push(`question ${n} needs an explanation of the answer`);
  return p;
}

function codeOf(id: string) {
  return findOutcome(id)?.outcome.code ?? id;
}

/* ---------- structural ---------- */

function structuralChecks(block: CurriculumBlock, ctx: BlockContext): Check[] {
  const out: Check[] = [];

  const unknown = block.outcomeIds.filter((id) => !ctx.allowedOutcomeIds.has(id));
  out.push(
    block.outcomeIds.length === 0
      ? check("outcome", "Cites the lesson's outcome", false, "The block does not cite any curriculum outcome.")
      : unknown.length > 0
        ? check("outcome", "Cites the lesson's outcome", false, `Cites ${unknown.map((id) => `"${id}"`).join(", ")}, which Funza did not supply for this lesson.`)
        : check("outcome", "Cites the lesson's outcome", true, `Cites ${block.outcomeIds.map(codeOf).join(", ")} from the verified catalog.`),
  );

  const badIndicators = block.indicatorIds.filter((id) => !ctx.allowedIndicatorIds.has(id));
  out.push(
    badIndicators.length > 0
      ? check("indicators", "Indicators are verified", false, `Cites ${badIndicators.join(", ")}, which is not a verified indicator.`)
      : check(
          "indicators",
          "Indicators are verified",
          true,
          block.indicatorIds.length > 0 ? `Cites ${block.indicatorIds.length} verified indicator(s).` : "Cites no indicators (none are verified yet for this outcome).",
        ),
  );

  const missing = [
    !block.title.trim() && "a title",
    !block.body.trim() && "the main text",
    !block.teaches.trim() && "what it teaches",
    !block.evidence.trim() && "how students show understanding",
  ].filter(Boolean);
  out.push(check("content", "Required text is present", missing.length === 0, missing.length === 0 ? "Title, text, purpose and evidence are filled in." : `Missing ${missing.join(", ")}.`));

  const range = ITEM_COUNT[block.kind];
  const countOk = block.items.length >= range.min && block.items.length <= range.max;
  const problems = block.items.flatMap((item, i) => itemProblems(item, i + 1));
  out.push(
    check(
      "questions",
      "Questions are complete",
      countOk && problems.length === 0,
      !countOk
        ? `A ${BLOCK_LABELS[block.kind].toLowerCase()} block needs ${range.min === range.max ? range.min : `${range.min} to ${range.max}`} question(s); it has ${block.items.length}.`
        : problems.length > 0
          ? `${problems[0][0].toUpperCase()}${problems.slice(0, 3).join("; ").slice(1)}.`
          : `${block.items.length} complete question(s) with hints and answers.`,
    ),
  );

  if (block.kind === "graph" || block.kind === "prediction") out.push(activityCheck(block));
  return out;
}

function activityCheck(block: CurriculumBlock): Check {
  const label = block.kind === "graph" ? "Interactive graph is valid" : "Prediction activity is valid";
  const m = block.motion;
  if (!m) return check("activity", label, false, "No motion is set up.");
  const speeds = m.objects.map((o) => o.speed);
  if (m.objects.some((o) => !o.label.trim())) return check("activity", label, false, "Every moving object needs a name.");
  if (speeds.some((v) => !(v > 0 && v <= 100))) return check("activity", label, false, "Speeds must be between 0 and 100 m/s.");
  if (!(m.duration >= 2 && m.duration <= 120)) return check("activity", label, false, "The graph must run for 2 to 120 seconds.");
  if (block.kind === "graph") {
    if (m.objects.length < 2 || m.objects.length > 3) return check("activity", label, false, "The graph compares 2 or 3 objects.");
    if (new Set(speeds).size !== speeds.length) return check("activity", label, false, "Give each object a different speed so the graph has something to compare.");
  } else {
    if (m.objects.length !== 1) return check("activity", label, false, "A prediction follows exactly one object.");
    if (m.askTime === null || !(m.askTime > 0 && m.askTime <= m.duration)) return check("activity", label, false, "The prediction time must fall inside the graph.");
  }
  if (!motionVisualization(block)) return check("activity", label, false, "The graph could not be built from this setup.");
  return check("activity", label, true, "Builds a validated distance-time graph from the registered function-graph type.");
}

/* ---------- factual ---------- */

const firstNumber = (text: string): number | null => {
  const m = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.005 * Math.abs(b), 0.01);

function factChecks(block: CurriculumBlock): Check[] {
  const out: Check[] = [];
  const m = block.motion;

  if (m && motionVisualization(block)) {
    // Recompute the graph from its own formulas: a constant speed must give a straight line whose slope is the speed.
    const viz = motionVisualization(block);
    const curves = viz && viz.type === "function-graph" ? viz.params.curves : [];
    const bad = m.objects.find((o, i) => {
      const expression = curves[i]?.expression;
      if (!expression) return true;
      const f = compileExpr(expression, ["x"]);
      const T = m.duration;
      const d1 = f({ x: T / 2 }) - f({ x: 0 });
      const d2 = f({ x: T }) - f({ x: T / 2 });
      return !close(d1, d2) || !close((f({ x: T }) - f({ x: 0 })) / T, o.speed);
    });
    out.push(
      check(
        "graph",
        "Graph matches the stated speeds",
        !bad,
        bad ? `The line for ${bad.label} does not rise at ${formatNumber(bad.speed)} m/s.` : "Each line was recomputed: straight, with a slope equal to the stated speed.",
      ),
    );
  }

  block.items.forEach((item, i) => {
    const fact = item.fact;
    if (!fact) return;
    const correct = item.options.find((o) => o.id === item.correctOptionId);
    const label = `Question ${i + 1} answer`;
    if (!correct) {
      out.push(check(`item-${item.id}`, label, false, "No correct option is marked."));
      return;
    }
    if (fact.kind === "fastest" || fact.kind === "slowest") {
      if (!m || m.objects.length < 2) {
        out.push(check(`item-${item.id}`, label, false, `Asks for the ${fact.kind} object, but the block has no objects to compare.`));
        return;
      }
      const sorted = [...m.objects].sort((a, b) => b.speed - a.speed);
      const target = fact.kind === "fastest" ? sorted[0] : sorted[sorted.length - 1];
      const mentions = (text: string) => text.toLowerCase().includes(target.label.toLowerCase());
      const ok = mentions(correct.text) && !item.options.some((o) => o.id !== correct.id && mentions(o.text));
      out.push(
        check(
          `item-${item.id}`,
          label,
          ok,
          ok
            ? `Recomputed: ${target.label} is ${fact.kind} at ${formatNumber(target.speed)} m/s, and only the marked answer names it.`
            : `Recomputed: ${target.label} is ${fact.kind} at ${formatNumber(target.speed)} m/s, but the marked answer is "${correct.text}".`,
        ),
      );
      return;
    }
    const [expected, unit, how] =
      fact.kind === "distance"
        ? [fact.speed * fact.time, "m", `${formatNumber(fact.speed)} m/s × ${formatNumber(fact.time)} s`]
        : fact.kind === "speed"
          ? [fact.distance / fact.time, "m/s", `${formatNumber(fact.distance)} m ÷ ${formatNumber(fact.time)} s`]
          : [fact.distance / fact.speed, "s", `${formatNumber(fact.distance)} m ÷ ${formatNumber(fact.speed)} m/s`];
    const given = firstNumber(correct.text);
    const clash = item.options.find((o) => o.id !== correct.id && firstNumber(o.text) !== null && close(firstNumber(o.text) as number, expected));
    const ok = given !== null && close(given, expected) && !clash;
    out.push(
      check(
        `item-${item.id}`,
        label,
        ok,
        given === null || !close(given, expected)
          ? `Recomputed ${how} = ${formatNumber(expected)} ${unit}, but the marked answer is "${correct.text}".`
          : clash
            ? `Recomputed ${how} = ${formatNumber(expected)} ${unit}, but another option ("${clash.text}") has the same value.`
            : `Recomputed ${how} = ${formatNumber(expected)} ${unit}, matching the marked answer.`,
      ),
    );
  });
  return out;
}

/* ---------- judgment ---------- */

function judgments(block: CurriculumBlock, curriculum: LessonCurriculum | null): Judgment[] {
  const out: Judgment[] = [
    { id: "accurate", text: "The text is accurate and suitable for Grade 10 students." },
    {
      id: "supports-outcome",
      text: curriculum ? `This block helps students meet ${curriculum.code}: “${curriculum.statement}”` : "This block helps students meet the lesson's outcome.",
    },
  ];
  if (block.indicatorIds.length === 0) out.push({ id: "indicators-pending", text: "No verified indicators are available; alignment here is to the outcome statement only." });
  block.items.forEach((item, i) => {
    if (!item.fact) out.push({ id: `answer-${item.id}`, text: `The marked answer to question ${i + 1} is correct; Funza cannot recompute it.` });
  });
  if (block.origin === "ai") out.push({ id: "ai-written", text: "This block was written by an AI model; I have read it in full." });
  return out;
}

/* ---------- the block report ---------- */

export function checkBlock(block: CurriculumBlock, ctx: BlockContext, curriculum: LessonCurriculum | null): BlockReport {
  const fingerprint = blockFingerprint(block);
  const structural = structuralChecks(block, ctx);
  const factual = factChecks(block);
  const js = judgments(block, curriculum);
  const ackValid = block.acknowledged?.fingerprint === fingerprint;
  const acknowledged = ackValid ? js.map((j) => j.id).filter((id) => block.acknowledged?.ids.includes(id)) : [];
  const approvalProblems = [
    ...structural.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`),
    ...factual.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`),
    ...(js.length > acknowledged.length ? [`Confirm the ${js.length - acknowledged.length} teacher judgment item(s).`] : []),
  ];
  return {
    fingerprint,
    structural,
    structuralOk: structural.every((c) => c.ok),
    factual,
    factualSummary: factual.some((c) => !c.ok) ? "failed" : factual.length > 0 ? "verified" : "not-checkable",
    judgments: js,
    acknowledged,
    acknowledgementsCleared: !!block.acknowledged && !ackValid && block.acknowledged.ids.length > 0,
    approvalProblems,
  };
}

/** An approval stands only if it was given to this exact content and the content still passes. */
export function approvalStillValid(block: CurriculumBlock, ctx: BlockContext, curriculum: LessonCurriculum | null): boolean {
  const report = checkBlock(block, ctx, curriculum);
  return block.approvedFingerprint === report.fingerprint && report.approvalProblems.length === 0;
}

/** What stops a curriculum lesson from being published. Empty means it may be published. */
export function lessonPublishProblems(
  curriculum: LessonCurriculum | null,
  blocks: { block: CurriculumBlock; review: "pending" | "approved" | "removed" }[],
): string[] {
  if (!curriculum) return ["The lesson is not linked to a curriculum outcome."];
  const usable = usableOutcome(curriculum.outcomeId);
  if (!usable.ok) return [`The lesson's outcome can no longer be used: ${usable.reason}`];
  if (usable.found.outcome.fingerprint !== curriculum.fingerprint) return [`The official wording of ${curriculum.code} changed since this lesson was created; review the lesson against the new wording.`];
  const ctx = lessonContext(curriculum);
  const problems: string[] = [];
  const pending = blocks.filter((b) => b.review === "pending").length;
  if (pending > 0) problems.push(`Approve or reject the ${pending} block(s) still waiting.`);
  for (const kind of BLOCK_KINDS as readonly BlockKind[]) {
    if (!blocks.some((b) => b.block.kind === kind && b.review === "approved")) problems.push(`The lesson needs an approved ${BLOCK_LABELS[kind].toLowerCase()} block.`);
  }
  for (const b of blocks) {
    if (b.review === "approved" && !approvalStillValid(b.block, ctx, curriculum)) problems.push(`"${b.block.title || BLOCK_LABELS[b.block.kind]}" changed or failed a check after approval.`);
  }
  return problems;
}
