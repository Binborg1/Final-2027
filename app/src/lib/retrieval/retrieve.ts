import { stem, tokens } from "@/lib/text";
import type { SourceSection } from "@/lib/types";

/**
 * Document retrieval: picks the sections of the notes a concept should be
 * taught from. Linked sections come first, then the sections whose words
 * overlap the concept most, until the character budget is spent.
 */
export function retrieveForConcept(
  sections: SourceSection[],
  concept: { title: string; objective?: string; sourceIds?: string[] },
  budget = 6000,
): { text: string; sectionIds: string[] } {
  const keys = new Set(tokens(`${concept.title} ${concept.objective ?? ""}`).map(stem));
  const linked = new Set(concept.sourceIds ?? []);
  const ranked = sections
    .map((s) => {
      const words = new Set(tokens(`${s.title} ${s.text}`).map(stem));
      const overlap = [...keys].filter((k) => words.has(k)).length;
      return { s, score: (linked.has(s.id) ? 100 : 0) + overlap };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked: SourceSection[] = [];
  let used = 0;
  for (const { s } of ranked) {
    const cost = s.title.length + s.text.length + 20;
    if (used + cost > budget && picked.length > 0) continue;
    picked.push(s);
    used += cost;
    if (used >= budget) break;
  }
  return {
    text: picked.map((s) => `## ${s.title} (pages ${s.firstPage}-${s.lastPage})\n${s.text}`).join("\n\n"),
    sectionIds: picked.map((s) => s.id),
  };
}

/** The document as the planner sees it: every section title, text trimmed to fit the budget. */
export function outlineForPlanning(sections: SourceSection[], budget = 14000): string {
  const perSection = Math.max(300, Math.floor(budget / Math.max(1, sections.length)));
  return sections
    .map((s, i) => {
      const text = s.text.length <= perSection ? s.text : `${s.text.slice(0, perSection).replace(/\s+\S*$/, "")}...`;
      return `[${i}] ${s.title} (pages ${s.firstPage}-${s.lastPage})\n${text}`;
    })
    .join("\n\n");
}
