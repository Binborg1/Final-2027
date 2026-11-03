/**
 * The usability questionnaire, as data: the same items as
 * docs/06_usability_bazaar/03_usability_questionnaire.md, so phone and paper
 * answers line up column for column. Pure, so it is tested.
 */
export type SurveyItem =
  | { id: string; kind: "text"; label: string; placeholder?: string }
  | { id: string; kind: "choice"; label: string; options: string[]; multi?: boolean; other?: boolean }
  | { id: string; kind: "likert"; label: string }
  | { id: string; kind: "rank"; label: string; options: string[] }
  | { id: string; kind: "long"; label: string };

export type SurveySection = { id: string; title: string; intro?: string; items: SurveyItem[] };

export const LIKERT = ["1", "2", "3", "4", "5"] as const;

export const RANK_OPTIONS = [
  "Hints and retries instead of being given the answer",
  "A talking mascot that explains things out loud",
  "Interactive demos that stop and ask me to predict what happens next",
  "Lessons and questions made from my own lecture PDFs",
  "A tutor that can see what I am working on (and, if I choose, my shared screen)",
];

export const SURVEY: SurveySection[] = [
  {
    id: "A",
    title: "Part A — About you",
    items: [
      { id: "A1", kind: "text", label: "Program and year", placeholder: "e.g. Software Systems Engineering, year 3" },
      {
        id: "A2",
        kind: "choice",
        label: "How do you usually study from lecture PDFs? Tick all that apply.",
        options: ["Re-read the slides", "Make my own notes or flashcards", "Ask ChatGPT or a similar tool to explain things", "Do past papers or tutorial questions", "Study with other people"],
        multi: true,
        other: true,
      },
      {
        id: "A3",
        kind: "choice",
        label: "How often do you use AI tools (ChatGPT, Copilot, Gemini and so on) for studying?",
        options: ["Never", "Sometimes", "Most weeks", "Almost every day"],
      },
    ],
  },
  {
    id: "B",
    title: "Part B — Overall (System Usability Scale)",
    intro: "1 = strongly disagree, 5 = strongly agree.",
    items: [
      { id: "B1", kind: "likert", label: "I think I would like to use Funza frequently." },
      { id: "B2", kind: "likert", label: "I found Funza unnecessarily complex." },
      { id: "B3", kind: "likert", label: "I thought Funza was easy to use." },
      { id: "B4", kind: "likert", label: "I think I would need help from a technical person to use Funza." },
      { id: "B5", kind: "likert", label: "I found the different parts of Funza worked well together." },
      { id: "B6", kind: "likert", label: "I thought there was too much inconsistency in Funza." },
      { id: "B7", kind: "likert", label: "I imagine most students would learn to use Funza very quickly." },
      { id: "B8", kind: "likert", label: "I found Funza very awkward to use." },
      { id: "B9", kind: "likert", label: "I felt confident using Funza." },
      { id: "B10", kind: "likert", label: "I needed to learn a lot of things before I could get going with Funza." },
    ],
  },
  {
    id: "C",
    title: "Part C — Design directions",
    intro: "Same scale. Skip a line if you did not try that part.",
    items: [
      { id: "C1", kind: "likert", label: "The talking mascot made the lesson feel like a tutor rather than a quiz." },
      { id: "C2", kind: "likert", label: "I would turn the voice on when studying alone." },
      { id: "C3", kind: "likert", label: "Getting a hint instead of the answer was helpful, not annoying." },
      { id: "C4", kind: "likert", label: "Having to try three times before I could see the answer felt fair." },
      { id: "C5", kind: "likert", label: "The interactive demo helped me understand the idea better than the text alone." },
      { id: "C6", kind: "likert", label: "Being asked to predict what happens next made me think." },
      { id: "C7", kind: "likert", label: "I always knew what to do next." },
      { id: "C8", kind: "likert", label: "I understood where each lesson came from (built-in sample, or my own PDF)." },
      { id: "C9", kind: "likert", label: "I would trust questions that Funza made from my own lecture PDF." },
      { id: "C10", kind: "likert", label: "Asking Funza \"What am I looking at?\" gave a useful answer." },
      { id: "C11", kind: "likert", label: "The look and feel (colours, mascot, layout) suits a study app." },
      { id: "C12", kind: "likert", label: "I would use Funza to prepare for a midterm." },
    ],
  },
  {
    id: "D",
    title: "Part D — What matters most",
    intro: "Rank these five ideas from 1 (most important to you) to 5 (least important). Use each number once.",
    items: [{ id: "D", kind: "rank", label: "Rank the ideas", options: RANK_OPTIONS }],
  },
  {
    id: "E",
    title: "Part E — In your own words",
    items: [
      { id: "E1", kind: "long", label: "What was the most confusing moment? What were you expecting to happen?" },
      { id: "E2", kind: "long", label: "Was there a moment you nearly gave up? What caused it?" },
      { id: "E3", kind: "long", label: "What is one thing Funza would need before you used it for a real course?" },
      { id: "E4", kind: "long", label: "What is one thing you would remove or turn off?" },
      { id: "E5", kind: "choice", label: "Would you let a study app see your screen?", options: ["Yes", "Only a single screenshot that I check first", "No"], other: true },
      { id: "E6", kind: "text", label: "Describe Funza in one word", placeholder: "one word" },
    ],
  },
];

/** What a submitted form holds: one value per item id (ranks are option index to rank). */
export type SurveyAnswers = Record<string, string | string[] | number | Record<string, number>>;

export type SurveyResponse = { id: string; submittedAt: string; participant: string; answers: SurveyAnswers };

const items = () => SURVEY.flatMap((s) => s.items);

const LIMITS = { short: 200, long: 2000, participant: 40, options: 8 } as const;

/**
 * Cleans an untrusted submission: only known items, strings capped, Likert
 * values as integers 1 to 5, choices from the list (plus one free "other"),
 * ranks as a permutation-ish map. Unknown or malformed fields are dropped.
 * Returns null when nothing usable was submitted.
 */
export function sanitizeAnswers(raw: unknown): SurveyAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const out: SurveyAnswers = {};
  for (const item of items()) {
    const v = input[item.id];
    if (v === undefined || v === null || v === "") continue;
    switch (item.kind) {
      case "text":
        if (typeof v === "string" && v.trim()) out[item.id] = v.trim().slice(0, LIMITS.short);
        break;
      case "long":
        if (typeof v === "string" && v.trim()) out[item.id] = v.trim().slice(0, LIMITS.long);
        break;
      case "likert": {
        const n = typeof v === "number" ? v : Number(v);
        if (Number.isInteger(n) && n >= 1 && n <= 5) out[item.id] = n;
        break;
      }
      case "choice": {
        const list = (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, LIMITS.short));
        const kept = list.filter((x) => item.options.includes(x) || item.other).slice(0, LIMITS.options);
        if (kept.length > 0) out[item.id] = item.multi ? kept : kept[0];
        break;
      }
      case "rank": {
        if (!v || typeof v !== "object" || Array.isArray(v)) break;
        const ranks: Record<string, number> = {};
        for (const [k, r] of Object.entries(v as Record<string, unknown>)) {
          const idx = Number(k);
          const n = typeof r === "number" ? r : Number(r);
          if (Number.isInteger(idx) && idx >= 0 && idx < item.options.length && Number.isInteger(n) && n >= 1 && n <= item.options.length) ranks[String(idx)] = n;
        }
        if (Object.keys(ranks).length > 0) out[item.id] = ranks;
        break;
      }
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function sanitizeParticipant(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, LIMITS.participant) : "";
}

/** The flat column list for the CSV export: ranks become one column per idea. */
export function surveyColumns(): string[] {
  const cols: string[] = ["id", "submittedAt", "participant", "sus"];
  for (const item of items()) {
    if (item.kind === "rank") item.options.forEach((_, i) => cols.push(`${item.id}_rank_${i + 1}`));
    else cols.push(item.id);
  }
  return cols;
}

/** System Usability Scale score (0 to 100) from B1 to B10, or null when any item is missing. */
export function susScore(answers: SurveyAnswers): number | null {
  let total = 0;
  for (let i = 1; i <= 10; i++) {
    const v = answers[`B${i}`];
    if (typeof v !== "number") return null;
    total += i % 2 === 1 ? v - 1 : 5 - v;
  }
  return total * 2.5;
}

function cell(v: unknown): string {
  const s = Array.isArray(v) ? v.join("; ") : v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(responses: SurveyResponse[]): string {
  const cols = surveyColumns();
  const rows = responses.map((r) => {
    const flat: Record<string, unknown> = { id: r.id, submittedAt: r.submittedAt, participant: r.participant, sus: susScore(r.answers) ?? "" };
    for (const item of items()) {
      const v = r.answers[item.id];
      if (item.kind === "rank") {
        const ranks = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, number>;
        item.options.forEach((_, i) => {
          flat[`${item.id}_rank_${i + 1}`] = ranks[String(i)] ?? "";
        });
      } else flat[item.id] = v;
    }
    return cols.map((c) => cell(flat[c])).join(",");
  });
  return [cols.join(","), ...rows].join("\r\n") + "\r\n";
}
