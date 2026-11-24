import { resourcePrompt, type PromptOutcome } from "@/lib/ai/resource-prompts";
import type { Brief, MixRow, QType } from "@/lib/resources/types";

/**
 * "Funza suggests" on the Live setup screen (FR-6): a quiz draft limited to the
 * four types a phone can answer, short enough for class, with the questions
 * already in the set listed so Funza doesn't repeat them. It runs through
 * /api/teach like any draft (outcome checks, allowance, validation), logged as
 * "live-suggest".
 */

export const MAX_SUGGEST = 20;
const PHONE_TYPES: QType[] = ["mcq", "tf", "calc", "short"];
/** Eight questions, 13 marks: the Figma's "Uniform motion check". */
export const DEFAULT_LIVE_MIX: MixRow[] = [
  { type: "mcq", count: 4, marks: 1 },
  { type: "tf", count: 2, marks: 1 },
  { type: "calc", count: 1, marks: 2 },
  { type: "short", count: 1, marks: 3 },
];

/** The brief with only phone types, a short answer worth at most 3 marks, and no more than 20 questions. */
export function liveBrief(b: Brief): Brief {
  const mix: MixRow[] = PHONE_TYPES.map((type) => {
    const row = b.mix.find((r) => r.type === type) ?? { type, count: 0, marks: 1 };
    return { type, count: Math.max(0, row.count), marks: type === "short" ? Math.min(3, Math.max(1, row.marks)) : Math.max(1, row.marks) };
  });
  let total = mix.reduce((n, r) => n + r.count, 0);
  while (total > MAX_SUGGEST) {
    const biggest = mix.reduce((a, r) => (r.count > a.count ? r : a));
    biggest.count--;
    total--;
  }
  return { ...b, kind: "quiz", mix: total === 0 ? DEFAULT_LIVE_MIX.map((r) => ({ ...r })) : mix };
}

const oneLine = (s: string) => s.replace(/[\r\n<>]+/g, " ").trim().slice(0, 200);

export function livePrompt(brief: Brief, outcomes: PromptOutcome[], avoid: string[]): { system: string; user: string } {
  const { system, user } = resourcePrompt(brief, outcomes);
  const lines = [
    "These questions are answered on students' phones during class, the whole set in a few minutes.",
    "Keep every question short: one or two sentences. Multiple choice has 4 options. A number answer is one number with its unit. A short answer needs one or two sentences.",
  ];
  const repeats = avoid.map(oneLine).filter(Boolean).slice(0, 40);
  if (repeats.length) lines.push(`These questions are already in the set. Don't repeat them or reword them closely:\n${repeats.map((q) => `- ${q}`).join("\n")}`);
  return { system, user: `${user}\n\n${lines.join("\n")}` };
}
