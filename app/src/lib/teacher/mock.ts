/**
 * Hardcoded sample data for the Teacher Studio prototype screens.
 * Nothing here is generated or saved; it only lets the UI be clicked through.
 */

export type Status = "draft" | "review" | "approved" | "published";
export type MaterialType = "Notes" | "Quiz" | "Flashcards" | "Explanation" | "Study Guide" | "Exam";

export const classes = [
  { id: "bio10", name: "Grade 10 Biology", students: 28, units: 6, accent: "mint" },
  { id: "math11", name: "Grade 11 Pre-Calculus", students: 31, units: 8, accent: "sky" },
  { id: "chem12", name: "Grade 12 Chemistry", students: 24, units: 7, accent: "lavender" },
] as const;

export type Draft = {
  id: string;
  title: string;
  type: MaterialType;
  className: string;
  status: Status;
  source: string;
  items: number;
  updated: string;
};

export const drafts: Draft[] = [
  { id: "d1", title: "Cell Division – Mitosis", type: "Quiz", className: "Grade 10 Biology", status: "draft", source: "Unit 3 Slides, p.4–9", items: 10, updated: "2 min ago" },
  { id: "d2", title: "Photosynthesis key terms", type: "Flashcards", className: "Grade 10 Biology", status: "draft", source: "Ch. 5 Notes", items: 24, updated: "1 h ago" },
  { id: "d3", title: "Quadratic functions", type: "Explanation", className: "Grade 11 Pre-Calculus", status: "review", source: "Unit 2 Handout", items: 1, updated: "Yesterday" },
  { id: "d4", title: "Stoichiometry review", type: "Study Guide", className: "Grade 12 Chemistry", status: "approved", source: "Unit 4 Notes", items: 6, updated: "Yesterday" },
  { id: "d5", title: "Midterm – Units 1–3", type: "Exam", className: "Grade 10 Biology", status: "review", source: "Units 1–3 Notes", items: 30, updated: "2 days ago" },
  { id: "d6", title: "Genetics basics", type: "Notes", className: "Grade 10 Biology", status: "published", source: "Teacher's own notes", items: 1, updated: "Last week" },
];

export const flashcards = [
  { front: "Mitosis", back: "Cell division that produces two identical daughter cells." },
  { front: "Chromatid", back: "One of two identical halves of a replicated chromosome." },
  { front: "Cytokinesis", back: "Division of the cytoplasm at the end of cell division." },
];

export const quiz = [
  { q: "During which phase do chromosomes line up in the middle of the cell?", options: ["Prophase", "Metaphase", "Anaphase", "Telophase"], answer: 1, source: "Slide 6" },
  { q: "How many daughter cells does mitosis produce?", options: ["1", "2", "4", "8"], answer: 1, source: "Slide 4" },
];

export const weakTopics = [
  { topic: "Meiosis vs Mitosis", className: "Grade 10 Biology", score: 48 },
  { topic: "Completing the square", className: "Grade 11 Pre-Calculus", score: 55 },
  { topic: "Limiting reagents", className: "Grade 12 Chemistry", score: 61 },
  { topic: "Photosynthesis inputs", className: "Grade 10 Biology", score: 72 },
];

export const comingSoon = [
  { title: "Differentiation", text: "Same notes at 3 reading levels, ELL and IEP versions." },
  { title: "Lesson Planner", text: "Turn notes into a lesson plan linked to curriculum outcomes." },
  { title: "Rubric Generator", text: "Build marking rubrics for assignments and projects." },
  { title: "Exit Tickets", text: "Three quick questions to check understanding at the end of class." },
  { title: "Parent Summary", text: "A weekly recap of what the class covered." },
  { title: "Source Lock", text: "AI only uses documents you uploaded. Nothing from outside." },
];
