/**
 * The teacher workspace's resource model. A resource is a document made of
 * sections; question sections hold items. A draft becomes an approved version
 * whose content is frozen; delivery always uses the approved snapshot.
 * Design: docs/09_teacher_workspace_design/08_implementation_plan.md, section 4.
 */

export type ResourceKind = "notes" | "quiz" | "test" | "exam" | "lesson-plan" | "worksheet" | "homework" | "presentation" | "visualization";

export type NotesStyle = "comprehensive" | "summary" | "worked" | "simplified" | "revision";

export type QType = "mcq" | "tf" | "fill" | "match" | "calc" | "short" | "long";
export type Difficulty = "foundational" | "grade" | "extending";
/** Action verbs from an outcome statement, used to show what students are asked to do. */
export type Verb = "investigate" | "represent" | "explore";

/** A machine-checkable fact behind an answer: Funza recomputes `expr` and compares it with the key. */
export type Calc = { expr: string; vars: Record<string, number>; unit: string; show: string };

export type Option = { id: string; text: string };
export type Pair = { left: string; right: string };
export type RubricLine = { text: string; marks: number };

/** Who wrote a part: the AI, Funza's hand-written starter bank, or the teacher. */
export type Origin = "ai" | "bank" | "teacher";

export type Item = {
  id: string;
  type: QType;
  prompt: string;
  options: Option[];
  correctId: string | null;
  tf: boolean | null;
  /** The key for fill-in and calculation questions, as written. */
  answer: string;
  pairs: Pair[];
  calc: Calc | null;
  solution: string;
  rubric: RubricLine[];
  marks: number;
  difficulty: Difficulty;
  outcomeIds: string[];
  verbs: Verb[];
  origin: Origin;
  /** Fingerprint of the content the teacher reviewed; any edit makes it stale. */
  reviewedFp: string | null;
};

/** A question as stored in the starter bank, before the blueprint sets its marks. */
export type BankItem = Omit<Item, "marks" | "rubric" | "origin" | "reviewedFp"> & { rubricLines: string[] };

export type MotionSetup = { objects: { label: string; speed: number }[]; duration: number };

export type SectionKind = "questions" | "text" | "activity";

export type Section = {
  id: string;
  kind: SectionKind;
  title: string;
  /** Instructions above the questions, or the text of a text section. */
  body: string;
  items: Item[];
  minutes: number | null;
  motion: MotionSetup | null;
  /** A calculation stated in the text (a worked example) that Funza can recompute. */
  claim: (Calc & { stated: string }) | null;
  outcomeIds: string[];
  verbs: Verb[];
  origin: Origin;
  reviewedFp: string | null;
};

export type MixRow = { type: QType; count: number; marks: number };
export type DifficultyPreset = "balanced" | "review" | "challenge";
export type Ordering = "by-type" | "by-difficulty" | "by-outcome";

/** Everything the teacher sets on the Create screen. Nothing here is a prompt. */
export type Brief = {
  kind: ResourceKind;
  title: string;
  outcomeIds: string[];
  mix: MixRow[];
  duration: number;
  difficulty: DifficultyPreset;
  ordering: Ordering;
  answerKey: boolean;
  workedSolutions: boolean;
  rubric: boolean;
  notesStyle: NotesStyle;
  keyTerms: boolean;
  checkQuestions: boolean;
  includeGraph: boolean;
  planMinutes: number;
  adaptations: boolean;
  slides: number;
  speakerNotes: boolean;
  /** The teacher's own file: only its name and extracted text are kept. */
  material: { name: string; use: "source" | "inspiration"; text: string } | null;
  reuseId: string | null;
  instructions: string;
};

export type ResourceStatus = "draft" | "approved";

export type Delivery = {
  id: string;
  at: string;
  version: number;
  what: string;
  where: string;
  state: "done" | "failed";
  detail?: string;
  link?: string;
};

export type Resource = {
  id: string;
  kind: ResourceKind;
  title: string;
  courseName: string;
  unitName: string;
  outcomeIds: string[];
  createdAt: string;
  updatedAt: string;
  deliveries: Delivery[];
  brief: Brief;
};

export type Draft = {
  resourceId: string;
  kind: ResourceKind;
  title: string;
  courseName: string;
  outcomeIds: string[];
  sections: Section[];
  /** For lesson plans: the class length the phases must add up to. */
  targetMinutes: number | null;
  /** Minutes allowed, printed in the header of assessments. */
  duration: number | null;
  draftedBy: Origin;
  provider: string | null;
  version: number;
  status: ResourceStatus;
  /** The frozen content of the last approved version; deliveries use only this. */
  approved: { at: string; version: number; title: string; sections: Section[] } | null;
  notices: string[];
  /** Global judgments the teacher confirmed. */
  globals: { readingLevel: boolean; indicatorsPending: boolean };
  /** A regenerated question shown beside the original until the teacher picks one. */
  pendingAlt: { targetId: string; item: Item } | null;
};

export type CheckState = "passed" | "failed" | "unverifiable" | "needs-you" | "stale";
export type CheckGroup = "structure" | "answers" | "coverage" | "review";

export type FixAction =
  | { kind: "use-recomputed"; itemId: string; value: string }
  | { kind: "use-recomputed-claim"; sectionId: string; value: string }
  | { kind: "remove-outcome"; outcomeId: string }
  | { kind: "add-question"; outcomeId: string }
  | { kind: "rubric-total"; itemId: string; marks: number };

export type CheckRow = {
  id: string;
  group: CheckGroup;
  state: CheckState;
  label: string;
  detail: string;
  targetId?: string;
  fix?: { label: string; action: FixAction };
};
