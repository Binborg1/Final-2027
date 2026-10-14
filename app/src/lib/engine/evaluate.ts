import type { Question } from "@/lib/types";

export type Evaluation = {
  correct: boolean;
  /** Short feedback that never reveals the answer. */
  message: string;
  /** True when no real answer was given; the attempt should not count. */
  incomplete?: boolean;
};

function normalize(text: string) {
  return ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/** Counts how many synonym groups appear in the answer as whole words or phrases. */
export function countMatchedGroups(answer: string, groups: string[][]) {
  const text = normalize(answer);
  return groups.filter((group) => group.some((word) => text.includes(` ${word.toLowerCase()} `))).length;
}

export function evaluateAnswer(question: Question, answer: string): Evaluation {
  if (question.kind === "mcq") {
    if (!answer) {
      return { correct: false, incomplete: true, message: "Choose one option first." };
    }
    return answer === question.correctOptionId
      ? { correct: true, message: "Correct." }
      : { correct: false, message: "Not quite. Read the hint, then try another option." };
  }

  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 3) {
    return {
      correct: false,
      incomplete: true,
      message: "Write at least a short sentence so Funza can check your thinking.",
    };
  }
  const matched = countMatchedGroups(answer, question.keywordGroups);
  if (matched >= question.minGroups) {
    return { correct: true, message: "Good explanation." };
  }
  return {
    correct: false,
    message:
      matched === 0
        ? "Your answer does not mention the key ideas from this concept yet."
        : `You have covered ${matched} of the ${question.minGroups} key ideas. Add what is missing.`,
  };
}
