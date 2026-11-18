"use client";

import { ReviewChip, StatusDot } from "@/components/curriculum/AlignmentPanel";
import type { ReviewStatus } from "@/lib/classes/model";
import type { BlockReport } from "@/lib/curriculum/checks";
import { BLOCK_LABELS, type CurriculumBlock } from "@/lib/curriculum/lesson";

export type NavEntry = { block: CurriculumBlock; review: ReviewStatus; report: BlockReport };

/** The lesson's blocks with their review status and check results. A column on wide screens, a scroller on small ones. */
export function BlockNav({ entries, selected, onSelect }: { entries: NavEntry[]; selected: number; onSelect: (index: number) => void }) {
  return (
    <nav aria-label="Lesson blocks" className="rounded-2xl border border-line bg-white p-2 shadow-card">
      <p className="hidden px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-smoke uppercase lg:block">Lesson blocks</p>
      <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
        {entries.map(({ block, review, report }, i) => {
          const active = i === selected;
          return (
            <li key={block.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={active ? "step" : undefined}
                className={`flex w-56 items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors lg:w-full ${
                  active ? "bg-lavender ring-1 ring-violet/25" : "hover:bg-cream"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    review === "approved" ? "bg-teal text-white" : active ? "bg-violet text-white" : "bg-sand text-smoke"
                  }`}
                  aria-hidden="true"
                >
                  {review === "approved" ? "✓" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium text-smoke">{BLOCK_LABELS[block.kind]}</span>
                  <span className={`block truncate text-sm font-semibold ${review === "removed" ? "text-smoke line-through" : ""}`}>{block.title || "Untitled"}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <ReviewChip review={review} />
                    <StatusDot ok={report.structuralOk} label="Structure" />
                    <StatusDot ok={report.factualSummary === "not-checkable" ? null : report.factualSummary === "verified"} label="Facts" />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
