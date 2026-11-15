"use client";

import { teachApi } from "@/lib/ai/teach-client";
import type { DraftContent } from "@/lib/ai/teach-schema";
import type { DraftConcept, Lecture } from "@/lib/classes/model";
import { LIMITS } from "@/lib/classes/model";
import { extractSections, generateLessons, slug } from "@/lib/lessons/generate";
import { extractPdf } from "@/lib/pdf/extract";
import { outlineForPlanning, retrieveForConcept } from "@/lib/retrieval/retrieve";

/** Rule-drafted lectures stop here, so a long PDF does not bury the professor in review. */
const MAX_RULE_CONCEPTS = 10;
const AI_CONCURRENCY = 2;

export type DraftResult = { lecture: Lecture; notice: string | null };

export class DraftError extends Error {}

/**
 * Reads a lecture PDF in the browser and drafts its concepts for review.
 * With an AI provider: plan the concepts, then write each one in full
 * (explanation, second explanation, question, hints, why it's right).
 * Without one, or if the AI fails: the on-device rules, which are rougher.
 * Nothing is shown to students until the professor approves and publishes.
 */
export async function draftLecture(input: {
  file: File;
  className: string;
  useAi: boolean;
  onProgress: (message: string) => void;
}): Promise<DraftResult> {
  const { file, className, useAi, onProgress } = input;
  onProgress(`Reading ${file.name}...`);
  let doc;
  try {
    doc = await extractPdf(file);
  } catch {
    throw new DraftError(`Funza could not read ${file.name}. Check that it is a PDF that opens normally.`);
  }

  let notice: string | null = null;
  if (useAi) {
    const sections = extractSections(doc);
    if (sections.length > 0) {
      const drafted = await draftWithAi(file.name, className, sections, onProgress);
      if (drafted.ok) return { lecture: drafted.lecture, notice: drafted.skipped > 0 ? `${drafted.skipped} concept${drafted.skipped === 1 ? "" : "s"} could not be drafted and ${drafted.skipped === 1 ? "was" : "were"} left out.` : null };
      notice = `AI drafting did not work (${drafted.message}), so these drafts come from simple rules and will be rougher.`;
    }
  }

  onProgress("Drafting concepts from the headings...");
  const concepts = generateLessons(doc)
    .flatMap((t) => t.concepts)
    .slice(0, MAX_RULE_CONCEPTS)
    .map((c): DraftConcept => ({ ...c, review: "pending" }));
  if (concepts.length === 0) {
    throw new DraftError(`Funza could not find headings and text it can use in ${file.name}. Scanned PDFs are not supported yet.`);
  }
  return {
    lecture: newLecture(baseName(file.name), file.name, "rules", [], concepts),
    notice: notice ?? (useAi ? null : "No AI provider is set up, so these drafts come from simple rules and will be rough. Edit them freely."),
  };
}

type AiDraft = { ok: true; lecture: Lecture; skipped: number } | { ok: false; message: string };

async function draftWithAi(
  fileName: string,
  className: string,
  sections: ReturnType<typeof extractSections>,
  onProgress: (message: string) => void,
): Promise<AiDraft> {
  onProgress("Finding the key concepts...");
  const plan = await teachApi.plan({ courseName: className, fileName, outline: outlineForPlanning(sections), sectionCount: sections.length });
  if (!plan.ok) return { ok: false, message: plan.message };

  const planned = plan.data.concepts.slice(0, LIMITS.conceptsPerLecture);
  const results: (DraftContent | null)[] = new Array(planned.length).fill(null);
  let done = 0;
  let lastError = "";
  const queue = planned.map((_, i) => i);
  const worker = async () => {
    for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
      const c = planned[i];
      const source = retrieveForConcept(sections, {
        title: c.title,
        objective: c.objective,
        sourceIds: c.sectionIndexes.map((n) => sections[n]?.id).filter((id): id is string => Boolean(id)),
      }).text;
      const res = await teachApi.draft({ courseName: className, concept: { title: c.title, objective: c.objective }, source });
      if (res.ok) results[i] = res.data;
      else lastError = res.message;
      done++;
      onProgress(`Drafting concepts: ${done} of ${planned.length} done...`);
    }
  };
  onProgress(`Drafting concepts: 0 of ${planned.length} done...`);
  await Promise.all(Array.from({ length: Math.min(AI_CONCURRENCY, planned.length) }, worker));

  const concepts = planned.flatMap((c, i): DraftConcept[] => {
    const d = results[i];
    if (!d) return [];
    return [{ id: `${i + 1}-${slug(c.title).slice(0, 40) || "concept"}`, title: c.title, objective: c.objective, ...d, review: "pending" }];
  });
  if (concepts.length === 0) return { ok: false, message: lastError || "no concept could be drafted" };
  return {
    ok: true,
    lecture: newLecture(plan.data.topicTitle, fileName, "ai", plan.data.objectives, concepts),
    skipped: planned.length - concepts.length,
  };
}

function baseName(fileName: string) {
  return fileName.replace(/\.pdf$/i, "").trim() || fileName;
}

function newLecture(title: string, fileName: string, draftedBy: Lecture["draftedBy"], objectives: string[], concepts: DraftConcept[]): Lecture {
  const now = new Date().toISOString();
  return {
    id: `${slug(title).slice(0, 40) || "lecture"}-${Date.now().toString(36)}`,
    title: title.slice(0, LIMITS.title),
    fileName,
    draftedBy,
    objectives,
    concepts,
    createdAt: now,
    updatedAt: now,
    published: null,
  };
}
