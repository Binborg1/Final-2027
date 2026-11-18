"use client";

import { ActivityStage } from "@/components/activity/ActivityStage";
import { Button } from "@/components/Button";
import { TextField } from "@/components/classes/ConceptReviewCard";
import { ReviewChip } from "@/components/curriculum/AlignmentPanel";
import { ItemsEditor, MotionEditor } from "@/components/curriculum/BlockEditors";
import type { ReviewStatus } from "@/lib/classes/model";
import type { BlockReport } from "@/lib/curriculum/checks";
import { BLOCK_LABELS, motionVisualization, type CurriculumBlock } from "@/lib/curriculum/lesson";

const BODY_LABEL: Record<CurriculumBlock["kind"], string> = {
  objective: "Learning objective",
  explanation: "Explanation",
  graph: "Introduction to the graph",
  prediction: "Prediction task",
  assessment: "Instructions",
};

type Props = {
  block: CurriculumBlock;
  review: ReviewStatus;
  index: number;
  total: number;
  report: BlockReport;
  regenerating: boolean;
  onChange: (block: CurriculumBlock, review: ReviewStatus) => void;
  onRegenerate: () => void;
  onSelect: (index: number) => void;
};

/** The active block: what students will see, editable while it waits for review. */
export function BlockWorkspace({ block, review, index, total, report, regenerating, onChange, onRegenerate, onSelect }: Props) {
  const edit = (patch: Partial<CurriculumBlock>) => onChange({ ...block, ...patch, approvedFingerprint: null }, "pending");
  const approved = review === "approved";
  const viz = block.kind === "graph" || block.kind === "prediction" ? motionVisualization(block) : null;

  return (
    <article aria-label={`Block ${index + 1}: ${BLOCK_LABELS[block.kind]}`} className="rounded-2xl border border-line bg-white shadow-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 md:px-6">
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <p className="text-[11px] font-semibold tracking-wider text-violet uppercase">
            Block {index + 1} of {total} · {BLOCK_LABELS[block.kind]}
          </p>
          <h2 className={`mt-0.5 truncate text-xl font-bold ${review === "removed" ? "text-smoke line-through" : ""}`}>{block.title || "Untitled block"}</h2>
        </div>
        <ReviewChip review={review} />
        <div className="flex gap-1">
          <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => onSelect(index - 1)} disabled={index === 0} aria-label="Previous block">
            ← Prev
          </Button>
          <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => onSelect(index + 1)} disabled={index >= total - 1} aria-label="Next block">
            Next →
          </Button>
        </div>
      </header>

      <div className="space-y-5 px-5 py-5 md:px-6">
        {review === "removed" ? (
          <p className="text-sm text-smoke">
            Rejected: students will not see this block. The lesson needs an approved {BLOCK_LABELS[block.kind].toLowerCase()} block before it can be published,
            so restore it or regenerate a new version.
          </p>
        ) : approved ? (
          <ApprovedSummary block={block} />
        ) : (
          <div>
            <TextField label="Title" value={block.title} max={140} single onChange={(title) => edit({ title })} compact />
            <TextField label={BODY_LABEL[block.kind]} hint="Students read this first." value={block.body} max={3000} rows={5} onChange={(body) => edit({ body })} />
            <TextField label="Another way to think about it" hint="Shown after a wrong answer." value={block.secondLook} max={2000} rows={2} onChange={(secondLook) => edit({ secondLook })} />
          </div>
        )}

        {review !== "removed" && block.motion && !approved && <MotionEditor kind={block.kind} motion={block.motion} onChange={(motion) => edit({ motion })} />}

        {review !== "removed" && viz && (
          <section aria-label="Student preview">
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-smoke uppercase">Student preview · interactive</p>
            <ActivityStage key={JSON.stringify(viz)} config={viz} />
          </section>
        )}

        {review === "pending" && (
          <>
            <div className="grid gap-x-4 md:grid-cols-2">
              <TextField label="What this block teaches" hint="For you and the report." value={block.teaches} max={600} rows={2} onChange={(teaches) => edit({ teaches })} />
              <TextField label="How students show understanding" value={block.evidence} max={600} rows={2} onChange={(evidence) => edit({ evidence })} />
            </div>
            <ItemsEditor block={block} onChange={(items) => edit({ items })} />
          </>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4 md:px-6">
        {review === "removed" ? (
          <>
            <Button variant="secondary" onClick={() => onChange({ ...block, approvedFingerprint: null }, "pending")}>
              Restore for review
            </Button>
            <Button variant="secondary" onClick={onRegenerate} disabled={regenerating}>
              {regenerating ? "Regenerating..." : "Regenerate"}
            </Button>
          </>
        ) : approved ? (
          <>
            <Button variant="secondary" onClick={() => onChange({ ...block, approvedFingerprint: null }, "pending")}>
              Edit
            </Button>
            <Button variant="ghost" onClick={() => onChange({ ...block, approvedFingerprint: null }, "removed")}>
              Reject
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => onChange({ ...block, approvedFingerprint: report.fingerprint }, "approved")} disabled={report.approvalProblems.length > 0}>
              Approve block
            </Button>
            <Button variant="ghost" onClick={() => onChange({ ...block, approvedFingerprint: null }, "removed")}>
              Reject
            </Button>
            <Button
              variant="secondary"
              disabled={regenerating}
              onClick={() => {
                if (window.confirm("Replace this block with a fresh version? Your edits to it will be lost.")) onRegenerate();
              }}
            >
              {regenerating ? "Regenerating..." : "Regenerate"}
            </Button>
          </>
        )}
        {review === "pending" && report.approvalProblems.length > 0 && (
          <ul className="mt-2 w-full space-y-1 text-xs font-medium text-coral-dark">
            {report.approvalProblems.map((p) => (
              <li key={p}>Before approving: {p}</li>
            ))}
          </ul>
        )}
      </footer>
    </article>
  );
}

function ApprovedSummary({ block }: { block: CurriculumBlock }) {
  return (
    <div>
      <p className="text-[15px] leading-7 text-charcoal/90">{block.body}</p>
      <ol className="mt-4 space-y-3">
        {block.items.map((item, i) => (
          <li key={item.id} className="rounded-xl border border-line bg-cream/60 px-4 py-3 text-sm">
            <p className="font-semibold">
              {block.items.length > 1 ? `${i + 1}. ` : ""}
              {item.prompt}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {item.options.map((o) => (
                <li key={o.id} className={o.id === item.correctOptionId ? "font-semibold text-mint-dark" : "text-smoke"}>
                  {o.id === item.correctOptionId ? "✓ " : ""}
                  {o.text}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
