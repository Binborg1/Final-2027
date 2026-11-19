import { placeOf } from "@/lib/curriculum/sources";
import { ADAPTATIONS, BANK, LESSON_PLAN, NOTES } from "@/lib/resources/bank";
import { FM2, scaleMinutes } from "@/lib/resources/blueprint";
import { isQuestionKind, QTYPE_LABEL, QTYPE_ORDER } from "@/lib/resources/kinds";
import type { BankItem, Brief, Difficulty, Draft, Item, Origin, QType, Section } from "@/lib/resources/types";

/** Building blocks shared by every way a draft is made: AI, starter bank, or by hand. */

export const INSTRUCTIONS: Record<QType, string> = {
  mcq: "Choose the best answer.",
  tf: "Write True or False.",
  fill: "Fill in each blank with one word or phrase.",
  match: "Match each item on the left with one on the right.",
  calc: "Show your work and include units in your answer.",
  short: "Answer in complete sentences.",
  long: "Plan your answer before you write. Marks are given for each part of the rubric.",
};

const DIFF_RANK: Record<Difficulty, number> = { foundational: 0, grade: 1, extending: 2 };

let seq = 0;
/** Unique ids for parts created in this session. */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(++seq).toString(36)}`;

export function rubricFor(lines: string[], marks: number) {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  if (marks < clean.length) return clean.slice(0, Math.max(1, marks)).map((text) => ({ text, marks: 1 }));
  const base = Math.floor(marks / clean.length);
  let extra = marks - base * clean.length;
  return clean.map((text) => ({ text, marks: base + (extra-- > 0 ? 1 : 0) }));
}

export function bankItem(p: BankItem, marks: number, id: string, origin: Origin = "bank"): Item {
  const { rubricLines, ...rest } = p;
  return { ...rest, id, marks, rubric: p.type === "short" || p.type === "long" ? rubricFor(rubricLines, marks) : [], origin, reviewedFp: null };
}

export const emptySection = (s: Partial<Section> & Pick<Section, "id" | "kind" | "title">): Section => ({
  body: "",
  items: [],
  minutes: null,
  motion: null,
  claim: null,
  outcomeIds: [],
  verbs: [],
  origin: "bank",
  reviewedFp: null,
  ...s,
});

export function blankItem(type: QType, marks: number, outcomeIds: string[], id: string): Item {
  return {
    id,
    type,
    prompt: type === "fill" ? "______" : "",
    options: type === "mcq" ? ["a", "b", "c", "d"].map((o) => ({ id: o, text: "" })) : [],
    correctId: type === "mcq" ? "a" : null,
    tf: null,
    answer: "",
    pairs: type === "match" ? [{ left: "", right: "" }, { left: "", right: "" }] : [],
    calc: null,
    solution: "",
    rubric: type === "short" || type === "long" ? [{ text: "", marks }] : [],
    marks,
    difficulty: "grade",
    outcomeIds: outcomeIds.slice(0, 1),
    verbs: [],
    origin: "teacher",
    reviewedFp: null,
  };
}

/** Groups items into one section per question type, in the blueprint's order. */
export function questionSections(b: Brief, items: Item[]): Section[] {
  return QTYPE_ORDER.flatMap((type) => {
    let list = items.filter((i) => i.type === type);
    if (list.length === 0) return [];
    if (b.ordering === "by-difficulty") list = [...list].sort((x, y) => DIFF_RANK[x.difficulty] - DIFF_RANK[y.difficulty]);
    if (b.ordering === "by-outcome") list = [...list].sort((x, y) => b.outcomeIds.indexOf(x.outcomeIds[0]) - b.outcomeIds.indexOf(y.outcomeIds[0]));
    return [emptySection({ id: `s-${type}`, kind: "questions", title: QTYPE_LABEL[type], body: INSTRUCTIONS[type], items: list, outcomeIds: [...new Set(list.flatMap((i) => i.outcomeIds))], origin: list[0].origin })];
  });
}

export function graphSection(origin: Origin): Section {
  return emptySection({
    id: "s-graph",
    kind: "activity",
    title: "Two riders, one graph",
    body: "Rider A and Rider B leave the school at the same time and ride at constant speeds. Step through the graph and compare the lines.",
    motion: { objects: [{ label: "Rider A", speed: 6 }, { label: "Rider B", speed: 4 }], duration: 10 },
    outcomeIds: [FM2],
    verbs: ["investigate", "represent"],
    origin,
  });
}

export function draftShell(b: Brief, resourceId: string, sections: Section[], draftedBy: Origin, provider: string | null, notices: string[]): Draft {
  return {
    resourceId,
    kind: b.kind,
    title: b.title,
    courseName: placeOf(b.outcomeIds).courseName,
    outcomeIds: b.outcomeIds,
    sections,
    targetMinutes: b.kind === "lesson-plan" ? b.planMinutes : null,
    duration: isQuestionKind(b.kind) ? b.duration : null,
    draftedBy,
    provider,
    version: 1,
    status: "draft",
    approved: null,
    notices,
    globals: { readingLevel: false, indicatorsPending: false },
    pendingAlt: null,
  };
}

function interleave(outcomeIds: string[], type: QType) {
  const lists = outcomeIds.map((id) => BANK.filter((p) => p.type === type && p.outcomeIds.includes(id)));
  const out: BankItem[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

/** A draft assembled from Funza's starter bank. Shortfalls are reported, never padded. */
export function fromBank(b: Brief, resourceId: string): Draft {
  const notices: string[] = [];
  let sections: Section[] = [];

  if (isQuestionKind(b.kind)) {
    const items: Item[] = [];
    for (const row of b.mix) {
      if (row.count === 0) continue;
      const picked = interleave(b.outcomeIds, row.type).slice(0, row.count);
      if (picked.length < row.count) notices.push(`The bank has ${picked.length} of the ${row.count} ${QTYPE_LABEL[row.type].toLowerCase()} question${row.count === 1 ? "" : "s"} you asked for. Add the rest yourself or generate them with AI.`);
      picked.forEach((p) => items.push(bankItem(p, row.marks, p.id)));
    }
    if (b.kind === "worksheet") {
      const src = b.outcomeIds.map((id) => NOTES[id]?.find((n) => n.claim)).find(Boolean);
      if (src) sections.push(emptySection({ id: "s-example", kind: "text", title: "Worked example", body: src.body, claim: src.claim ?? null, outcomeIds: b.outcomeIds.filter((id) => NOTES[id]?.includes(src)) }));
    }
    sections.push(...questionSections(b, items));
  } else if (b.kind === "lesson-plan") {
    const id = b.outcomeIds.find((o) => LESSON_PLAN[o]);
    const phases = id ? LESSON_PLAN[id] : [];
    const mins = scaleMinutes(phases.map((p) => p.minutes), b.planMinutes);
    sections = phases.map((p, i) => emptySection({ id: `s-phase-${i + 1}`, kind: "text", title: p.title, body: p.body, minutes: mins[i], outcomeIds: id ? [id] : [], verbs: p.verbs }));
    if (b.adaptations && id) sections.push(emptySection({ id: "s-adapt", kind: "text", title: "Adaptations", body: ADAPTATIONS, outcomeIds: [id] }));
  } else if (b.kind === "visualization") {
    if (b.outcomeIds.includes(FM2)) {
      sections.push(graphSection("bank"));
      const qs = ["f2-mc2", "f2-tf2"].map((pid) => bankItem(BANK.find((p) => p.id === pid)!, 1, pid));
      sections.push(emptySection({ id: "s-discuss", kind: "questions", title: "Ask while the class explores", body: "Ask these before revealing each step.", items: qs, outcomeIds: [FM2] }));
    }
  } else {
    const slide = b.kind === "presentation";
    b.outcomeIds.forEach((id) => {
      (NOTES[id] ?? []).forEach((n, i) => {
        sections.push(
          emptySection({
            id: `s-${id}-${i}`,
            kind: "text",
            title: slide ? `Slide · ${n.title}` : n.title,
            body: slide ? n.body.split("\n").map((l) => (l.startsWith("- ") ? l : `- ${l}`)).join("\n") : n.body,
            claim: n.claim ?? null,
            outcomeIds: [id],
            verbs: n.title.includes("graph") ? ["represent"] : [],
          }),
        );
        if (!slide && id === FM2 && i === 2 && b.includeGraph) sections.push({ ...graphSection("bank"), id: "s-notes-graph", title: "Interactive: two riders" });
      });
    });
    if (slide) sections = sections.slice(0, Math.max(1, b.slides));
    if (b.kind === "notes" && b.checkQuestions) {
      const qs = b.outcomeIds.flatMap((id) => BANK.filter((p) => p.type === "mcq" && p.outcomeIds.includes(id)).slice(0, 1)).map((p) => bankItem(p, 1, p.id));
      if (qs.length > 0) sections.push(emptySection({ id: "s-check", kind: "questions", title: "Check your understanding", body: INSTRUCTIONS.mcq, items: qs, outcomeIds: b.outcomeIds }));
    }
    if (b.kind === "notes" && b.notesStyle !== "comprehensive") notices.push("The bank has one version of these notes; adjust it to the style you chose, or generate with AI.");
  }
  if (sections.length === 0) notices.push("The bank has nothing for these outcomes yet. Write the resource yourself from the outline, or generate it with AI.");
  return draftShell(b, resourceId, sections, "bank", null, notices);
}

/** The blueprint laid out as empty parts for the teacher to write. */
export function blankDraft(b: Brief, resourceId: string): Draft {
  const notices = ["Written by you: the blueprint is laid out as empty parts. The checks work the same way."];
  if (isQuestionKind(b.kind)) {
    const items = b.mix.flatMap((r) => Array.from({ length: r.count }, (_, i) => blankItem(r.type, r.marks, b.outcomeIds, `q-${r.type}-${i + 1}`)));
    return draftShell(b, resourceId, questionSections(b, items).map((s) => ({ ...s, origin: "teacher" })), "teacher", null, notices);
  }
  if (b.kind === "lesson-plan") {
    const titles = ["Hook", "Investigate", "Represent", "Explain", "Check"];
    const mins = scaleMinutes(titles.map(() => 12), b.planMinutes);
    return draftShell(b, resourceId, titles.map((title, i) => emptySection({ id: `s-phase-${i + 1}`, kind: "text", title, minutes: mins[i], outcomeIds: b.outcomeIds.slice(0, 1), origin: "teacher" })), "teacher", null, notices);
  }
  if (b.kind === "visualization") return draftShell(b, resourceId, b.outcomeIds.includes(FM2) ? [graphSection("teacher")] : [], "teacher", null, notices);
  const titles = b.kind === "presentation" ? Array.from({ length: b.slides }, (_, i) => `Slide ${i + 1}`) : ["Key idea", "Explanation", "Worked example"];
  return draftShell(b, resourceId, titles.map((title, i) => emptySection({ id: `s-${i + 1}`, kind: "text", title, outcomeIds: b.outcomeIds.slice(0, 1), origin: "teacher" })), "teacher", null, notices);
}
