"use client";

import type { ReactNode } from "react";
import type { ReviewStatus } from "@/lib/classes/model";
import { findOutcome } from "@/lib/curriculum/catalog";
import type { BlockReport, Check, FactualSummary } from "@/lib/curriculum/checks";
import type { CurriculumBlock } from "@/lib/curriculum/lesson";

/** Every result shown here is computed from the block's current content; nothing is estimated or scored. */

export const FACTUAL_TEXT: Record<FactualSummary, string> = {
  verified: "Recomputed by Funza",
  failed: "A check failed",
  "not-checkable": "Nothing to recompute",
};

const FACTUAL_TONE: Record<FactualSummary, string> = {
  verified: "bg-mint text-mint-dark",
  failed: "bg-[#fde4e1] text-coral-dark",
  "not-checkable": "bg-sand text-smoke",
};

export function ReviewChip({ review }: { review: ReviewStatus }) {
  if (review === "approved") return <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold text-mint-dark">Approved</span>;
  if (review === "removed") return <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-smoke">Rejected</span>;
  return <span className="rounded-full bg-lavender px-2 py-0.5 text-[11px] font-semibold text-lavender-dark">Needs review</span>;
}

export function StatusDot({ ok, label }: { ok: boolean | null; label: string }) {
  const tone = ok === null ? "bg-[#c9c2b4]" : ok ? "bg-teal" : "bg-coral-dark";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-smoke">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone}`} />
      {label}
    </span>
  );
}

export function Section({ title, badge, children }: { title: string; badge?: [string, string]; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <h3 className="flex flex-wrap items-center gap-2 font-sans text-[11px] font-semibold tracking-wider text-smoke uppercase">
        {title}
        {badge && <span className={`rounded-full px-2 py-0.5 text-[10px] tracking-normal normal-case ${badge[1]}`}>{badge[0]}</span>}
      </h3>
      <div className="mt-1.5 text-sm">{children}</div>
    </section>
  );
}

export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="space-y-1.5">
      {checks.map((c) => (
        <li key={c.id} className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${c.ok ? "bg-teal" : "bg-coral-dark"}`}
          >
            {c.ok ? "✓" : "!"}
          </span>
          <span>
            <span className="font-semibold">{c.label}.</span> <span className={c.ok ? "text-smoke" : "text-coral-dark"}>{c.detail}</span>
            <span className="sr-only">{c.ok ? " Passed." : " Failed."}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The verification for one block: alignment evidence, check results and the teacher-judgment checklist. */
export function AlignmentPanel({
  block,
  report,
  editable,
  onAcknowledge,
}: {
  block: CurriculumBlock;
  report: BlockReport;
  editable: boolean;
  onAcknowledge: (ids: string[]) => void;
}) {
  const outcomes = block.outcomeIds.map((id) => findOutcome(id)?.outcome ?? null);
  return (
    <div className="space-y-3">
      <Section title="Intended outcome">
        {outcomes.length === 0 ? (
          <p className="text-coral-dark">None cited.</p>
        ) : (
          outcomes.map((o, i) =>
            o ? (
              <p key={o.id}>
                <span className="font-semibold">{o.code}</span> · “{o.statement}”
              </p>
            ) : (
              <p key={i} className="font-semibold text-coral-dark">
                “{block.outcomeIds[i]}” is not in the catalog.
              </p>
            ),
          )
        )}
      </Section>
      <Section title="Indicator">
        <p>{block.indicatorIds.length > 0 ? block.indicatorIds.join(", ") : "None: indicators for this outcome are not verified yet."}</p>
      </Section>
      <Section title="What the activity teaches">
        <p>{block.teaches || <span className="text-coral-dark">Not described.</span>}</p>
      </Section>
      <Section title="How students demonstrate understanding">
        <p>{block.evidence || <span className="text-coral-dark">Not described.</span>}</p>
      </Section>
      <Section title="Structural verification" badge={report.structuralOk ? ["Passed", "bg-mint text-mint-dark"] : ["Failed", "bg-[#fde4e1] text-coral-dark"]}>
        <CheckList checks={report.structural} />
      </Section>
      <Section title="Factual verification" badge={[FACTUAL_TEXT[report.factualSummary], FACTUAL_TONE[report.factualSummary]]}>
        {report.factual.length > 0 ? (
          <CheckList checks={report.factual} />
        ) : (
          <p className="text-smoke">No answer in this block is a calculation Funza can recompute; see the judgment items.</p>
        )}
      </Section>
      <Section title="Needs your judgment">
        {report.acknowledgementsCleared && (
          <p className="mb-2 rounded-lg bg-peach px-3 py-2 text-xs font-semibold text-peach-dark">
            The content changed, so the checks ran again and your earlier confirmations were cleared.
          </p>
        )}
        <ul className="space-y-2">
          {report.judgments.map((j) => {
            const checked = report.acknowledged.includes(j.id);
            return (
              <li key={j.id}>
                <label className={`flex items-start gap-2 ${editable ? "cursor-pointer" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!editable}
                    onChange={() => onAcknowledge(checked ? report.acknowledged.filter((id) => id !== j.id) : [...report.acknowledged, j.id])}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#0f766e]"
                  />
                  <span>{j.text}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {!editable && <p className="mt-2 text-xs text-smoke">Approved. Choose Edit in the workspace to change anything.</p>}
      </Section>
      <p className="font-mono text-[11px] text-smoke">Checked content · {report.fingerprint}</p>
    </div>
  );
}
