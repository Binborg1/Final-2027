import type { VisualizationConfig } from "@/lib/visualizations/types";

export type IllustrationId = "packets" | "routes" | "handshake" | "layers";

export type McqOption = { id: string; text: string };

export type McqQuestion = {
  kind: "mcq";
  prompt: string;
  options: McqOption[];
  correctOptionId: string;
};

export type ShortAnswerQuestion = {
  kind: "short";
  prompt: string;
  placeholder?: string;
  /** Each inner array is a group of synonyms; a group counts once if any of its words appears. */
  keywordGroups: string[][];
  /** How many groups must be matched for the answer to count as correct. */
  minGroups: number;
  /** Shown only when the student asks to see it after repeated attempts. */
  sampleAnswer: string;
};

export type Question = McqQuestion | ShortAnswerQuestion;

export type Concept = {
  id: string;
  title: string;
  /** For AI-taught concepts: the learning objective, and the source sections it draws on. */
  objective?: string;
  sourceIds?: string[];
  explanation: string;
  /** A different angle on the same idea, shown after a wrong answer. */
  alternateExplanation: string;
  illustration?: IllustrationId;
  /** An interactive demo from the visualization registry; shown instead of the still illustration. */
  visualization?: VisualizationConfig;
  question: Question;
  /** Why the correct answer is correct, shown after success or reveal. */
  whyCorrect: string;
  /** Progressive hints, one per wrong attempt. */
  hints: string[];
};

export type TopicKind = "rules" | "ai";

export type Topic = {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  concepts: Concept[];
  /** Set when the topic was generated from one of the course's PDFs. */
  fileName?: string;
  /** "ai": taught by the adaptive loop in TeachView; default "rules": the fixed lesson flow. */
  kind?: TopicKind;
  objectives?: string[];
};

export type LessonSource = "demo" | "pdf";

export type CourseFileStatus = "ready" | "no-text" | "error";
export type CourseFileKind = "notes" | "questions";

export type CourseFile = {
  name: string;
  size: number;
  type: string;
  status?: CourseFileStatus;
  /** Notes become lessons; question sheets become question sets. */
  kind?: CourseFileKind;
  /** How sure the classifier was; low means the student may want to override it. */
  confidence?: "high" | "medium" | "low";
  pages?: number;
  concepts?: number;
  questions?: number;
};

export type Course = {
  id: string;
  name: string;
  files: CourseFile[];
  createdAt: string;
  /** The built-in sample course; its lessons are hardcoded, not generated. */
  sample?: boolean;
};

export type ConceptStatus = "completed" | "needs-practice";

export type ConceptProgress = {
  status: ConceptStatus;
  attempts: number;
  updatedAt: string;
};

/** courseId -> "topicId/conceptId" -> progress */
export type ProgressStore = Record<string, Record<string, ConceptProgress>>;

/** courseId -> topics generated from that course's PDFs */
export type LessonsStore = Record<string, Topic[]>;

/* ---------- question PDFs ---------- */

export type QuestionPart = { label: string; text: string };

export type QuestionItem = {
  id: string;
  /** As printed in the PDF, e.g. "3". */
  number: string;
  label: string;
  text: string;
  parts: QuestionPart[];
  marks?: string;
  page: number;
  /** An answer printed in the PDF itself, when the sheet includes solutions. */
  providedAnswer?: string;
};

export type QuestionSet = {
  id: string;
  fileName: string;
  title: string;
  questions: QuestionItem[];
  createdAt: string;
};

/** courseId -> question sets extracted from that course's question PDFs */
export type QuestionsStore = Record<string, QuestionSet[]>;

/** How the student wants to work through a question set. */
export type WorkMode = "guide" | "answers";

/* ---------- adaptive AI teaching ---------- */

/** A section of a notes PDF, kept on the device as the reference the AI teaches from. */
export type SourceSection = { id: string; title: string; text: string; firstPage: number; lastPage: number };

/** courseId -> fileName -> sections */
export type SourcesStore = Record<string, Record<string, SourceSection[]>>;

export type AiQuestion = {
  type: "short" | "mcq";
  prompt: string;
  options: { id: string; text: string }[] | null;
  /** The points a correct answer must show; used by the evaluator, never shown as-is. */
  expectedReasoning: string[];
  /** A model answer, shown only when the student gives up. */
  answerSketch: string;
};

export type AiLesson = {
  /** Grounded in the PDF excerpts. */
  explanation: string;
  /** From the model's general knowledge; always labelled as not from the PDF. May be null. */
  supplement: string | null;
  example: { text: string; fromPdf: boolean } | null;
  /** A registered demo the model asked for, validated; null when none fits (or the request was unsupported). */
  visualization?: VisualizationConfig | null;
  question: AiQuestion;
  generatedAt: string;
};

export type AiEvaluation = {
  verdict: "correct" | "partial" | "incorrect";
  feedback: string;
  misconception: string | null;
  hint: string | null;
  reteach: string | null;
  nextAction: "continue" | "retry" | "reteach" | "verify";
};

/** `${courseId}:${topicId}/${conceptId}` -> generated lesson (cached so a concept is generated once) */
export type AiLessonStore = Record<string, AiLesson>;

export function conceptKey(topicId: string, conceptId: string) {
  return `${topicId}/${conceptId}`;
}
