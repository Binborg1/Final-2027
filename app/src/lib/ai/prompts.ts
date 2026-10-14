export type AiTask = "solve" | "feedback" | "hint";

export type AiQuestion = { label: string; text: string; parts: { label: string; text: string }[] };

const SYSTEM =
  "You are Funza, a patient university tutor. Be accurate and concrete. Write plain text with short numbered steps where useful; no markdown headings, no tables, no emoji. If the question is ambiguous or missing information, say what you assumed in one line.";

export function buildPrompt(task: AiTask, question: AiQuestion, context: string[], attempt: string | undefined, courseName: string) {
  const q = [`${question.label}: ${question.text}`, ...question.parts.map((p) => `(${p.label}) ${p.text}`)].join("\n");
  const notes =
    context.length > 0
      ? `Relevant excerpts from the student's own course notes, which define the expected terminology and methods:\n${context
          .map((c, i) => `[${i + 1}] ${c}`)
          .join("\n\n")}`
      : "No matching course notes were found; rely on standard knowledge of the subject.";

  let user: string;
  switch (task) {
    case "solve":
      user = `Solve the following question completely for a student in the course "${courseName}". Show the reasoning step by step, then give the final answer clearly on its own line starting with "Final answer:". If the question has parts, answer each part in order and label it.\n\n${q}\n\n${notes}`;
      break;
    case "feedback":
      user = `The student is working on this question and has written an attempt. Do NOT give the final answer and do NOT complete the solution for them. In at most 120 words: say what is correct, what is missing or wrong, and the single next step they should take. End with one guiding question.\n\nQuestion:\n${q}\n\nStudent's attempt:\n${attempt ?? "(empty)"}\n\n${notes}`;
      break;
    case "hint":
      user = `Give one short hint, at most 40 words, that moves the student toward solving this question without revealing the answer or the final result.\n\nQuestion:\n${q}\n\n${notes}`;
      break;
  }
  return { system: SYSTEM, user };
}
