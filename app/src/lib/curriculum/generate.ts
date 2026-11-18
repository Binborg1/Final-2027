"use client";

import { teachApi } from "@/lib/ai/teach-client";
import { usableOutcome } from "@/lib/curriculum/catalog";
import { curriculumMeta, type BlockKind, type CurriculumBlock } from "@/lib/curriculum/lesson";
import { SCI10_FM2_TITLE, sci10Fm2Template, sci10Fm2TemplateBlock } from "@/lib/curriculum/templates/sci10-fm2";
import { draftFromBlock, type Lecture } from "@/lib/classes/model";
import { slug } from "@/lib/lessons/generate";

export type GeneratedLesson = { lecture: Lecture; notice: string | null };

/**
 * Creates a curriculum lesson for a catalog outcome. With an AI provider the
 * five blocks are written by the model (validated on the server against the
 * outcome Funza supplied); otherwise, or if that fails, they come from Funza's
 * starter template. Either way every block starts as "needs review".
 */
export async function generateCurriculumLesson(outcomeId: string, useAi: boolean): Promise<GeneratedLesson> {
  const usable = usableOutcome(outcomeId);
  if (!usable.ok) throw new Error(usable.reason);
  const found = usable.found;

  let blocks: CurriculumBlock[] = sci10Fm2Template();
  let draftedBy: Lecture["draftedBy"] = "template";
  let notice: string | null = useAi ? null : "No AI provider is set up, so this lesson starts from Funza's starter template. Review it like any draft.";
  if (useAi) {
    const res = await teachApi.curriculumLesson({ outcomeId });
    if (res.ok) {
      blocks = res.data;
      draftedBy = "ai";
    } else {
      notice = `AI drafting did not work (${res.message}), so this lesson starts from Funza's starter template.`;
    }
  }

  const now = new Date().toISOString();
  return {
    lecture: {
      id: `${slug(found.outcome.code)}-${Date.now().toString(36)}`,
      title: SCI10_FM2_TITLE,
      fileName: "",
      draftedBy,
      objectives: [],
      concepts: blocks.map((b) => draftFromBlock(b, "pending")),
      createdAt: now,
      updatedAt: now,
      published: null,
      curriculum: curriculumMeta(found),
    },
    notice,
  };
}

/** A fresh version of one block: rewritten by the AI if available, else reset to the starter version. */
export async function regenerateBlock(outcomeId: string, block: CurriculumBlock, useAi: boolean): Promise<{ block: CurriculumBlock; notice: string | null }> {
  const fromTemplate = (): CurriculumBlock => ({ ...sci10Fm2TemplateBlock(block.kind as BlockKind), id: block.id });
  if (!useAi) return { block: fromTemplate(), notice: "No AI provider is set up, so the block was reset to the starter version." };
  const res = await teachApi.curriculumBlock({ outcomeId, kind: block.kind, blockId: block.id });
  if (res.ok && res.data[0]) return { block: { ...res.data[0], id: block.id }, notice: null };
  return { block: fromTemplate(), notice: `AI rewriting did not work (${res.ok ? "empty reply" : res.message}), so the block was reset to the starter version.` };
}
