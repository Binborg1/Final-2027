import type { AiQuestion } from "@/lib/types";
import { describeVisualizationsForPrompt } from "@/lib/visualizations/registry";

/** Prompts for the adaptive teaching loop. Every task asks for one JSON object and nothing else. */

const TEACHER =
  "You are Funza, a patient university tutor. You teach from the student's own course notes (the PDF excerpts you are given) and treat them as the primary reference. You may add explanations and examples from general knowledge, but only where the format provides a separate field for them, so they can be labelled as not coming from the PDF. Write plain text: short sentences, numbered steps where useful, no markdown headings, no emoji. Never invent facts about the notes.";

const JSON_ONLY = "Respond with a single JSON object and nothing else: no prose before or after, no code fences.";

export function planPrompt(courseName: string, fileName: string, outline: string) {
  return {
    system: `${TEACHER} ${JSON_ONLY}`,
    user: `Course: ${courseName}\nDocument: ${fileName}\n\nPlan how to teach this document. Identify the learning topic and 4 to 8 key concepts a student must understand, in teaching order. Each concept needs a short title, one learning objective that starts with a verb (Explain, Calculate, Compare, Describe...), and the indexes of the document sections it draws on.\n\nJSON shape:\n{"topicTitle": string, "objectives": [string, ...] (3 to 6 objectives for the whole topic), "concepts": [{"title": string, "objective": string, "sectionIndexes": [number, ...]}]}\n\nDocument sections, each marked [index]:\n\n${outline}`,
  };
}

export function lessonPrompt(courseName: string, concept: { title: string; objective?: string }, source: string) {
  return {
    system: `${TEACHER} ${JSON_ONLY}`,
    user: `Course: ${courseName}\nConcept: ${concept.title}\nObjective: ${concept.objective ?? "Understand the concept"}\n\nWrite a short lesson for this concept.\n- "explanation": 100 to 180 words grounded in the PDF excerpts below. Teach the idea, do not summarise the document.\n- "supplement": an explanation or analogy from your general knowledge that the excerpts do not contain, or null if none is needed. It will be labelled as not from the PDF.\n- "example": one concrete worked example or scenario, with "fromPdf" true only if the excerpts contain it. For technical material prefer a small calculation with numbers.\n- "question": an ORIGINAL question that tests the objective and requires reasoning. Do not copy a question from the excerpts. Prefer "short" (answered in one to three sentences, or a short calculation). Use "mcq" only if a choice question tests reasoning better; then give 3 or 4 options and no "all of the above". Include "expectedReasoning": 2 to 4 points a correct answer must show, and "answerSketch": a model answer in 1 to 3 sentences.\n- "visualization": an interactive demonstration Funza will render from this data (never code), or null. Include one only when the concept is genuinely about something one of the types below can show accurately and completely; for most concepts answer null. Choose the type, give its params, and for a generic type write "observe" (what the student should watch for), 3 to 8 "stages" whose captions explain what is on screen step by step, and exactly one checkpoint placed just before the key moment so the student predicts it first. Any type or field outside this list is dropped and the concept is taught with the explanation alone.\n${describeVisualizationsForPrompt()}\n\nJSON shape:\n{"explanation": string, "supplement": string | null, "example": {"text": string, "fromPdf": boolean} | null, "visualization": {"type": string, "params": object} | null, "question": {"type": "short" | "mcq", "prompt": string, "options": [{"id": "a", "text": string}, ...] | null, "expectedReasoning": [string, ...], "answerSketch": string}}\n\nPDF excerpts:\n\n${source}`,
  };
}

export function evaluatePrompt(input: {
  courseName: string;
  concept: { title: string; objective?: string };
  explanation: string;
  question: AiQuestion;
  answer: string;
  attempt: number;
  source: string;
}) {
  const { courseName, concept, explanation, question, answer, attempt, source } = input;
  const options = question.options ? `\nOptions: ${question.options.map((o) => `(${o.id}) ${o.text}`).join(" ")}` : "";
  return {
    system: `${TEACHER} You are now evaluating a student's answer. Judge the reasoning, not the wording: an answer that shows the key points in different words is correct; one that shows some of them is partial. ${JSON_ONLY}`,
    user: `Course: ${courseName}\nConcept: ${concept.title}\nObjective: ${concept.objective ?? ""}\n\nLesson explanation the student read:\n${explanation}\n\nQuestion: ${question.prompt}${options}\nPoints a correct answer must show: ${question.expectedReasoning.map((p, i) => `(${i + 1}) ${p}`).join(" ")}\nModel answer (for you only): ${question.answerSketch}\n\nStudent's answer (attempt ${attempt}): ${answer}\n\nReturn:\n- "verdict": "correct", "partial" or "incorrect".\n- "feedback": at most 60 words, speaking to the student. If correct, say what they got right. If not, say what is right and what is missing, WITHOUT giving the answer away.\n- "misconception": when the answer is partial or incorrect, the most likely misunderstanding behind it in one sentence; otherwise null.\n- "hint": when not correct, one hint that moves them forward without revealing the answer. Attempt 1: a gentle nudge. Attempt 2 or later: a more specific pointer. Null if correct.\n- "reteach": when attempt is 2 or more and the answer is still not correct, explain the concept in a different way than the lesson did, with one new concrete example (you may use general knowledge; if so start with "Beyond your notes:"). Otherwise null.\n- "nextAction": "verify" if correct, "reteach" if you gave a reteach, else "retry".\n\nPDF excerpts for reference:\n${source}`,
  };
}

export function questionPrompt(input: {
  courseName: string;
  concept: { title: string; objective?: string };
  explanation: string;
  previousPrompts: string[];
  source: string;
}) {
  const { courseName, concept, explanation, previousPrompts, source } = input;
  return {
    system: `${TEACHER} ${JSON_ONLY}`,
    user: `Course: ${courseName}\nConcept: ${concept.title}\nObjective: ${concept.objective ?? ""}\n\nLesson explanation the student read:\n${explanation}\n\nWrite ONE new original question to verify the student now understands this concept. It must test the same objective but differ from these earlier questions:\n${previousPrompts.map((p) => `- ${p}`).join("\n") || "- (none)"}\nPrefer an applied scenario or a small calculation with new numbers. Same JSON shape as before:\n{"type": "short" | "mcq", "prompt": string, "options": [{"id": "a", "text": string}, ...] | null, "expectedReasoning": [string, ...], "answerSketch": string}\n\nPDF excerpts for reference:\n${source}`,
  };
}
