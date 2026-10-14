import { clipText, keyStems, stem, tokens } from "@/lib/text";
import type { Topic } from "@/lib/types";

export type Passage = {
  topicId: string;
  topicTitle: string;
  conceptId: string;
  conceptTitle: string;
  text: string;
  matched: string[];
  score: number;
};

/** Finds the concepts from the course's notes whose words overlap most with the question. */
export function findRelevantPassages(questionText: string, topics: Topic[], limit = 3): Passage[] {
  const keys = new Set(tokens(questionText).map(stem));
  if (keys.size === 0) return [];
  const out: Passage[] = [];
  for (const topic of topics) {
    for (const concept of topic.concepts) {
      const body = `${concept.title} ${concept.explanation} ${concept.alternateExplanation}`;
      const bodyStems = new Set(tokens(body).map(stem));
      const matched = [...keys].filter((k) => bodyStems.has(k));
      if (matched.length === 0) continue;
      const titleHit = tokens(concept.title).map(stem).some((s) => keys.has(s)) ? 0.5 : 0;
      out.push({
        topicId: topic.id,
        topicTitle: topic.title,
        conceptId: concept.id,
        conceptTitle: concept.title,
        text: clipText(concept.explanation, 360),
        matched,
        score: matched.length / Math.sqrt(keys.size) + titleHit,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Which of the question's key ideas a piece of writing mentions, and which it misses. */
export function coverage(questionText: string, writing: string, limit = 6) {
  const keys = keyStems(questionText, limit);
  const have = new Set(tokens(writing).map(stem));
  const hit = keys.filter((k) => have.has(k));
  const missed = keys.filter((k) => !have.has(k));
  return { keys, hit, missed, ratio: keys.length === 0 ? 1 : hit.length / keys.length };
}
