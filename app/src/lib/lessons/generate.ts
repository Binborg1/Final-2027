import type { ExtractedDoc, ExtractedLine } from "@/lib/pdf/extract";
import type { Concept, McqQuestion, ShortAnswerQuestion, SourceSection, Topic } from "@/lib/types";
import { escapeRegExp, stem, tokens } from "@/lib/text";

/**
 * Turns the extracted text of one PDF into topics, concepts and questions
 * using rules only (no AI). Two document shapes are handled:
 * - flowing text (chapters, reports): headings open sections, the text under
 *   a heading is the explanation, sentences feed the questions;
 * - slide decks: each slide is a section, its first line the title, its
 *   bullet lines the explanation and the question material.
 * Rough by design; an AI provider can replace it behind the same interface.
 */

const MAX_CONCEPTS_PER_FILE = 24;
const CONCEPTS_PER_TOPIC = 6;
const EXPLANATION_CHARS = 420;
const ALTERNATE_CHARS = 300;

type Section = {
  title: string;
  /** Body lines in reading order, bullets stripped. */
  lines: string[];
  text: string;
  firstPage: number;
  lastPage: number;
  slide: boolean;
};
type Term = { term: string; display: string; score: number };

export function generateLessons(doc: ExtractedDoc): Topic[] {
  const sections = buildSections(doc);
  if (sections.length === 0) return [];

  const df = documentFrequency(sections);
  const termsBySection = sections.map((s) => keyTerms(s, df, sections.length, 6));
  const concepts: Concept[] = [];
  sections.forEach((section, i) => {
    if (concepts.length >= MAX_CONCEPTS_PER_FILE) return;
    const terms = termsBySection[i];
    if (terms.length < 2) return;
    const others = termsBySection
      .filter((_, j) => j !== i)
      .flatMap((list) => list.slice(0, 2).map((t) => t.display));
    const concept = buildConcept(section, terms, others, concepts.length);
    if (concept) concepts.push(concept);
  });
  if (concepts.length === 0) return [];

  const base = doc.fileName.replace(/\.pdf$/i, "").trim() || doc.fileName;
  const chunks = chunk(concepts, CONCEPTS_PER_TOPIC);
  const firstPage = sections[0].firstPage;
  const lastPage = sections[sections.length - 1].lastPage;
  return chunks.map((list, i) => ({
    id: `${slug(base).slice(0, 40)}-${hash(doc.fileName).toString(36)}-${i + 1}`,
    title: chunks.length === 1 ? base : `${base} (part ${i + 1} of ${chunks.length})`,
    summary: clip(list[0].explanation, 140),
    whyItMatters: `Generated on this device from ${doc.fileName}, pages ${firstPage} to ${lastPage}. Every question is taken from the text itself, so the explanation above each one holds the answer.`,
    concepts: list,
    fileName: doc.fileName,
  }));
}

/* ---------- sections ---------- */

/** The document's sections, trimmed, for the on-device sources store that the AI teaches from. */
export function extractSections(doc: ExtractedDoc, maxChars = 2500, maxTotal = 120000): SourceSection[] {
  const out: SourceSection[] = [];
  let total = 0;
  buildSections(doc).forEach((s, i) => {
    if (total >= maxTotal) return;
    const text = s.text.length <= maxChars ? s.text : `${s.text.slice(0, maxChars).replace(/\s+\S*$/, "")}...`;
    total += text.length;
    out.push({ id: `s${i + 1}`, title: s.title, text, firstPage: s.firstPage, lastPage: s.lastPage });
  });
  return out;
}


type CleanPage = { page: number; lines: ExtractedLine[] };

function buildSections(doc: ExtractedDoc): Section[] {
  const rawPages = doc.pages.filter((p) => p.lines.length > 0);
  if (rawPages.length === 0) return [];

  // Lines repeated on many pages are headers or footers.
  const lineCounts = new Map<string, number>();
  for (const p of rawPages) {
    for (const key of new Set(p.lines.map((l) => normalizeKey(l.text)))) {
      lineCounts.set(key, (lineCounts.get(key) ?? 0) + 1);
    }
  }
  const repeated = (text: string) => {
    const c = lineCounts.get(normalizeKey(text)) ?? 0;
    return rawPages.length >= 3 && c >= 3 && c >= rawPages.length * 0.3;
  };
  const isNoise = (l: ExtractedLine) =>
    l.text.length < 2 ||
    /^\s*\d+\s*$/.test(l.text) ||
    /^(page|slide)\s*\d+(\s*(of|\/)\s*\d+)?$/i.test(l.text) ||
    repeated(l.text);

  const pages: CleanPage[] = rawPages
    .map((p) => ({ page: p.page, lines: p.lines.filter((l) => !isNoise(l)) }))
    .filter((p) => p.lines.length > 0);
  if (pages.length === 0) return [];

  // The most common font size (by characters) is the body size; bigger lines are headings.
  const sizeChars = new Map<number, number>();
  for (const p of pages) {
    for (const l of p.lines) {
      const s = Math.round(l.size * 2) / 2;
      sizeChars.set(s, (sizeChars.get(s) ?? 0) + l.text.length);
    }
  }
  let bodySize = 10;
  let best = -1;
  for (const [s, c] of sizeChars) {
    if (c > best) {
      best = c;
      bodySize = s;
    }
  }
  const isHeading = (l: ExtractedLine) => {
    const t = stripBullet(l.text);
    if (t.length < 3 || t.length > 90) return false;
    const letters = (t.match(/[A-Za-z]/g) ?? []).length;
    if (letters < 3) return false;
    if (/[.;,]$/.test(t)) return false;
    const big = l.size >= bodySize * 1.15;
    const caps = letters >= 4 && t.length <= 60 && (t.match(/[A-Z]/g) ?? []).length / letters >= 0.7;
    const numbered = /^\d+(\.\d+)*\.?\s+[A-Za-z]/.test(t) && t.length <= 70 && l.size >= bodySize;
    return big || caps || numbered;
  };

  const totalChars = pages.reduce((n, p) => n + p.lines.reduce((m, l) => m + l.text.length, 0), 0);
  const avgChars = totalChars / pages.length;
  const avgLines = pages.reduce((n, p) => n + p.lines.length, 0) / pages.length;
  const slideMode = avgChars < 700 || (avgLines < 14 && avgChars < 1200);

  return slideMode ? slideSections(pages, isHeading) : flowingSections(pages, isHeading);
}

/** One section per slide: first heading-like line (or the first line) is the title, the rest is the body. */
function slideSections(pages: CleanPage[], isHeading: (l: ExtractedLine) => boolean): Section[] {
  const sections: Section[] = [];
  for (const p of pages) {
    const titleIndex = Math.max(0, p.lines.findIndex(isHeading));
    const title = cleanTitle(p.lines[titleIndex]?.text ?? `Slide ${p.page}`);
    const body = p.lines.filter((_, i) => i !== titleIndex).map((l) => stripBullet(l.text)).filter((t) => t.length > 0);
    const text = body.join(" ");
    const prev = sections[sections.length - 1];
    if (text.length < 80 && prev) {
      // A near-empty slide (section divider, image slide): fold its words into the previous section.
      prev.lines.push(...body);
      prev.text = [prev.text, text].filter(Boolean).join(" ");
      prev.lastPage = p.page;
      continue;
    }
    sections.push({ title, lines: body, text, firstPage: p.page, lastPage: p.page, slide: true });
  }
  return sections.filter((s) => s.text.length >= 80 && s.lines.some((l) => l.length >= 20));
}

/** Headings open sections; everything until the next heading is the body. */
function flowingSections(pages: CleanPage[], isHeading: (l: ExtractedLine) => boolean): Section[] {
  const MIN_CHARS = 160;
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const p of pages) {
    for (const l of p.lines) {
      if (isHeading(l)) {
        const title = cleanTitle(l.text);
        if (current && current.text.length === 0) {
          // A multi-line title: fold it into the heading already opened.
          const combined = `${current.title} ${title}`;
          current.title = combined.length <= 90 ? combined : title;
          continue;
        }
        if (current && current.title === title) continue;
        current = { title, lines: [], text: "", firstPage: p.page, lastPage: p.page, slide: false };
        sections.push(current);
      } else {
        if (!current) {
          current = { title: `Page ${p.page}`, lines: [], text: "", firstPage: p.page, lastPage: p.page, slide: false };
          sections.push(current);
        }
        const line = stripBullet(l.text);
        current.lines.push(line);
        current.text = joinLine(current.text, line);
        current.lastPage = p.page;
      }
    }
  }
  const merged: Section[] = [];
  for (const s of sections) {
    const prev = merged[merged.length - 1];
    if (s.text.length < MIN_CHARS && prev) {
      prev.lines.push(...s.lines);
      prev.text = joinLine(prev.text, s.text);
      prev.lastPage = s.lastPage;
    } else {
      merged.push(s);
    }
  }
  return merged.filter((s) => s.text.length >= MIN_CHARS);
}

function joinLine(a: string, b: string) {
  if (!a) return b;
  if (!b) return a;
  if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
  return `${a} ${b}`;
}

function stripBullet(text: string) {
  return text
    .replace(/^[\s•·▪◦●○■□➢➤►▶\-–—*]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(text: string) {
  const t = stripBullet(text)
    .replace(/[…]+/g, " ")
    .replace(/\.{3,}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[:\s]+$/, "")
    .trim();
  return t.length <= 80 ? t : `${t.slice(0, 80).replace(/\s+\S*$/, "")}...`;
}

function normalizeKey(text: string) {
  return text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

/* ---------- terms ---------- */

function documentFrequency(sections: Section[]) {
  const df = new Map<string, number>();
  for (const s of sections) {
    for (const t of new Set(tokens(s.text).map(stem))) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return df;
}

function keyTerms(section: Section, df: Map<string, number>, sectionCount: number, limit: number): Term[] {
  const tf = new Map<string, number>();
  for (const t of tokens(section.text).map(stem)) tf.set(t, (tf.get(t) ?? 0) + 1);
  const titleTerms = new Set(tokens(section.title).map(stem));
  const minCount = section.slide ? 1 : 2;
  const scored: Term[] = [];
  for (const [term, count] of tf) {
    const inTitle = titleTerms.has(term);
    if (count < minCount && !inTitle) continue;
    const rarity = Math.log(1 + sectionCount / (df.get(term) ?? 1));
    const score = count * (0.4 + rarity) * (inTitle ? 1.6 : 1) * (term.length >= 6 ? 1.2 : 1);
    const display = displayForm(section.text, term);
    if (!display) continue;
    scored.push({ term, display, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** The term as it appears in the text (keeps the original casing). */
function displayForm(text: string, term: string): string | null {
  const re = new RegExp(`\\b(${escapeRegExp(term)}[a-z]?)\\b`, "i");
  const m = text.match(re);
  return m ? m[1] : null;
}

/* ---------- sentences ---------- */

/** The units a question can be built from: sentences in flowing text, bullet lines on slides. */
function unitsOf(section: Section): string[] {
  const units = section.slide
    ? section.lines.filter((l) => l.length >= 20).map((l) => (l.length <= 240 ? l : `${l.slice(0, 240).replace(/\s+\S*$/, "")}...`))
    : splitSentences(section.text);
  // Links, emails and ID-like strings make meaningless questions.
  return units.filter((u) => !/https?:\/\/|www\.|\S+@\S+\.\S+|\b\d{6,}\b/.test(u));
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9("])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
}

function takeChars(units: string[], limit: number, slide: boolean): { text: string; used: number } {
  const out: string[] = [];
  let used = 0;
  for (const u of units) {
    const piece = slide ? u.replace(/[.;:]?$/, ".") : u;
    if (out.length > 0 && out.join(" ").length + piece.length + 1 > limit) break;
    out.push(piece);
    used++;
    if (out.join(" ").length >= limit) break;
  }
  if (out.length === 0) return { text: "", used: 0 };
  let text = out.join(" ");
  if (text.length > limit + 80) text = `${text.slice(0, limit).replace(/\s+\S*$/, "")}...`;
  return { text, used };
}

function keyUnits(units: string[], terms: Term[], n: number): string[] {
  const scored = units
    .map((s, i) => ({
      s,
      i,
      score: terms.reduce((acc, t) => acc + (containsTerm(s, t.term) ? 1 : 0), 0),
    }))
    .filter((x) => x.s.length >= 30 && x.s.length <= 260);
  return scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

function containsTerm(sentence: string, term: string) {
  return new RegExp(`\\b${escapeRegExp(term)}[a-z]?\\b`, "i").test(sentence);
}

function clip(text: string, max: number) {
  const s = splitSentences(text)[0] ?? text;
  return s.length <= max ? s : `${s.slice(0, max).replace(/\s+\S*$/, "")}...`;
}

/* ---------- concepts and questions ---------- */

function buildConcept(section: Section, terms: Term[], others: string[], index: number): Concept | null {
  const units = unitsOf(section);
  if (units.length === 0) return null;

  const explanation = takeChars(units, EXPLANATION_CHARS, section.slide);
  if (!explanation.text) return null;
  const rest = units.slice(explanation.used);
  const alternate = takeChars(rest, ALTERNATE_CHARS, section.slide).text;
  const key = keyUnits(units, terms, 2);
  const seed = hash(`${section.title}|${index}`);

  // Alternate question types; fall back to the other kind when one cannot be built.
  const preferCloze = index % 2 === 0;
  const cloze = clozeQuestion(units, terms, others, seed);
  const useCloze = cloze !== null && (preferCloze || terms.length < 3);

  const id = `${index + 1}-${slug(section.title).slice(0, 40) || "section"}`;
  const alternateExplanation =
    alternate ||
    (key[0] ? `The key line in the source is: "${key[0]}"` : "Re-read the explanation above slowly, one sentence at a time.");

  if (useCloze && cloze) {
    return {
      id,
      title: section.title,
      explanation: explanation.text,
      alternateExplanation,
      question: cloze.question,
      whyCorrect: `The source says: "${cloze.sentence}"`,
      hints: [
        `The missing word is in the explanation above. Look near the part about ${terms[1]?.display ?? section.title}.`,
        `It starts with "${cloze.answer[0]}" and has ${cloze.answer.length} letters.`,
      ],
    };
  }

  const short = shortQuestion(section.title, terms, key);
  return {
    id,
    title: section.title,
    explanation: explanation.text,
    alternateExplanation,
    question: short,
    whyCorrect: key.length > 0 ? `From the source: ${key.join(" ")}` : "Your answer covers the key terms of this section.",
    hints: [
      `Try to use the words "${terms[0].display}" and "${terms[1].display}", and say how they relate.`,
      "Re-read the first sentence of the explanation and restate it in your own words.",
    ],
  };
}

function clozeQuestion(
  units: string[],
  terms: Term[],
  others: string[],
  seed: number,
): { question: McqQuestion; sentence: string; answer: string } | null {
  const candidates = units.filter((s) => s.length >= 30 && s.length <= 220);
  for (const t of terms) {
    const re = new RegExp(`\\b(${escapeRegExp(t.term)}[a-z]?)\\b`, "i");
    const sentence = candidates.find((s) => re.test(s));
    if (!sentence) continue;
    const answer = sentence.match(re)?.[1];
    if (!answer) continue;
    const blanked = sentence.replace(re, "_____");
    const distractors = pickDistractors(answer, sentence, others, seed);
    if (distractors.length < 2) continue;
    const texts = shuffle([answer, ...distractors], seed);
    const options = texts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
    const correct = options.find((o) => o.text === answer);
    if (!correct) continue;
    return {
      question: { kind: "mcq", prompt: `Fill in the blank: ${blanked}`, options, correctOptionId: correct.id },
      sentence,
      answer,
    };
  }
  return null;
}

function pickDistractors(answer: string, sentence: string, others: string[], seed: number): string[] {
  const answerStem = stem(answer.toLowerCase());
  const capitalized = /^[A-Z]/.test(answer);
  const seen = new Set<string>([answerStem]);
  const pool: string[] = [];
  for (const o of others) {
    const s = stem(o.toLowerCase());
    if (seen.has(s) || containsTerm(sentence, s)) continue;
    seen.add(s);
    pool.push(capitalized ? o.charAt(0).toUpperCase() + o.slice(1) : o.toLowerCase());
  }
  return shuffle(pool, seed)
    .sort((a, b) => Math.abs(a.length - answer.length) - Math.abs(b.length - answer.length))
    .slice(0, 3);
}

function shortQuestion(title: string, terms: Term[], key: string[]): ShortAnswerQuestion {
  const top = terms.slice(0, 4);
  const groups = top.map((t) => variants(t.term));
  return {
    kind: "short",
    prompt: `In one or two sentences, explain "${title}" in your own words.`,
    placeholder: "Use your own words...",
    keywordGroups: groups,
    minGroups: Math.min(2, Math.max(1, groups.length)),
    sampleAnswer: key.join(" ") || `${title}: ${top.map((t) => t.display).join(", ")}.`,
  };
}

function variants(term: string): string[] {
  const set = new Set<string>([term, `${term}s`]);
  if (/(s|x|ch|sh)$/.test(term)) set.add(`${term}es`);
  if (term.endsWith("y")) set.add(`${term.slice(0, -1)}ies`);
  if (term.endsWith("s")) set.add(term.slice(0, -1));
  return [...set];
}

/* ---------- utilities ---------- */

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(list: T[], seed: number): T[] {
  const out = [...list];
  let s = seed || 1;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
