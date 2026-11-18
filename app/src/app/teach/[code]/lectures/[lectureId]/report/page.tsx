"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { ClassGate, LectureStateChip, PageHeader } from "@/components/classes/ui";
import { CheckList, FACTUAL_TEXT, ReviewChip, Section } from "@/components/curriculum/AlignmentPanel";
import { OutcomeCard } from "@/components/curriculum/OutcomeCard";
import { curriculumProblems, isCurriculumLesson, lectureState, reviewCounts } from "@/lib/classes/model";
import { formatDay } from "@/lib/classes/study";
import { useEditableClass } from "@/lib/classes/useEditableClass";
import { findOutcome } from "@/lib/curriculum/catalog";
import { checkBlock, lessonContext } from "@/lib/curriculum/checks";
import { BLOCK_LABELS, type CurriculumBlock } from "@/lib/curriculum/lesson";

/**
 * The alignment report for one lesson, computed from its current content each
 * time it is opened. Printable. Deliberately has no overall score: structural
 * checks prove links are real, factual checks recompute what can be computed,
 * and the rest is recorded teacher judgment.
 */
export default function AlignmentReportPage() {
  const { code: rawCode, lectureId } = useParams<{ code: string; lectureId: string }>();
  const { code, load, record } = useEditableClass(rawCode);
  if (load.status !== "ready" || !record) return <ClassGate load={load} code={code} />;
  const lecture = record.lectures.find((l) => l.id === lectureId);
  if (!lecture || !isCurriculumLesson(lecture)) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6">
        <p className="font-semibold">That lesson has no alignment report.</p>
        <ButtonLink href={`/teach/${code}`} className="mt-4">
          Back to the class
        </ButtonLink>
      </div>
    );
  }

  const curriculum = lecture.curriculum ?? null;
  const ctx = lessonContext(curriculum);
  const found = curriculum ? findOutcome(curriculum.outcomeId) : null;
  const blocks = lecture.concepts
    .filter((c) => c.block)
    .map((c) => ({ block: c.block as CurriculumBlock, review: c.review, report: checkBlock(c.block as CurriculumBlock, ctx, curriculum) }));
  const problems = curriculumProblems(lecture);
  const counts = reviewCounts(lecture);
  const generated = new Date().toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });

  return (
    <div>
      <nav className="no-print text-sm font-medium text-smoke" aria-label="Breadcrumb">
        <Link href="/teach" className="hover:text-charcoal">
          Dashboard
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/teach/${code}`} className="hover:text-charcoal">
          {record.name}
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/teach/${code}/lectures/${lecture.id}`} className="hover:text-charcoal">
          Lesson builder
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-charcoal">Alignment report</span>
      </nav>

      <div className="mt-4">
        <PageHeader
          eyebrow="Alignment report"
          title={lecture.title}
          description={`${record.name}${record.term ? ` · ${record.term}` : ""} · generated ${generated} from the lesson's current content.`}
          actions={
            <span className="no-print flex gap-2">
              <Button variant="secondary" onClick={() => window.print()}>
                Print
              </Button>
              <ButtonLink href={`/teach/${code}/lectures/${lecture.id}`}>Back to the builder</ButtonLink>
            </span>
          }
        >
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <LectureStateChip state={lectureState(lecture)} pending={counts.pending} />
            {lecture.published && <span className="text-smoke">Published version from {formatDay(lecture.published.at)}</span>}
          </div>
        </PageHeader>
      </div>

      <div className="mt-6">{found && <OutcomeCard found={found} compact />}</div>

      <section aria-label="Summary" className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card md:p-6">
        <h2 className="text-lg font-bold">Summary by block</h2>
        <p className="mt-1 text-sm text-smoke">There is no overall alignment score. Each column is a separate kind of evidence.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] font-semibold tracking-wider text-smoke uppercase">
                <th className="py-2 pr-3">Block</th>
                <th className="py-2 pr-3">Outcome</th>
                <th className="py-2 pr-3">Indicator</th>
                <th className="py-2 pr-3">Structural</th>
                <th className="py-2 pr-3">Factual</th>
                <th className="py-2 pr-3">Teacher judgment</th>
                <th className="py-2">Review</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map(({ block, review, report }, i) => (
                <tr key={block.id} className="border-b border-line/70 align-top">
                  <td className="py-2.5 pr-3">
                    <span className="font-semibold">
                      {i + 1}. {BLOCK_LABELS[block.kind]}
                    </span>
                    <span className="block text-xs text-smoke">{block.title}</span>
                  </td>
                  <td className="py-2.5 pr-3">{block.outcomeIds.map((id) => findOutcome(id)?.outcome.code ?? id).join(", ") || "None"}</td>
                  <td className="py-2.5 pr-3 text-smoke">{block.indicatorIds.length > 0 ? block.indicatorIds.join(", ") : "Pending verification"}</td>
                  <td className={`py-2.5 pr-3 font-semibold ${report.structuralOk ? "text-mint-dark" : "text-coral-dark"}`}>{report.structuralOk ? "Passed" : "Failed"}</td>
                  <td className={`py-2.5 pr-3 font-semibold ${report.factualSummary === "failed" ? "text-coral-dark" : report.factualSummary === "verified" ? "text-mint-dark" : "text-smoke"}`}>
                    {FACTUAL_TEXT[report.factualSummary]}
                  </td>
                  <td className="py-2.5 pr-3">
                    {report.acknowledged.length} of {report.judgments.length} confirmed
                  </td>
                  <td className="py-2.5">
                    <ReviewChip review={review} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-xl bg-cream px-4 py-3 text-sm">
          <p className="font-semibold">{problems.length === 0 ? "Ready to publish: every requirement is met." : "Not ready to publish yet:"}</p>
          {problems.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-smoke">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="mt-6 space-y-4">
        {blocks.map(({ block, review, report }, i) => (
          <section key={block.id} aria-label={`Block ${i + 1}`} className="break-inside-avoid rounded-2xl border border-line bg-white p-5 shadow-card md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">
                {i + 1}. {BLOCK_LABELS[block.kind]} · <span className="font-semibold">{block.title}</span>
              </h2>
              <ReviewChip review={review} />
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div className="space-y-3">
                <Section title="What the activity teaches">
                  <p>{block.teaches || "Not described."}</p>
                </Section>
                <Section title="How students demonstrate understanding">
                  <p>{block.evidence || "Not described."}</p>
                </Section>
                <Section title="Teacher judgment">
                  <ul className="space-y-1">
                    {report.judgments.map((j) => (
                      <li key={j.id} className="flex items-start gap-2">
                        <span aria-hidden="true" className={report.acknowledged.includes(j.id) ? "text-mint-dark" : "text-smoke"}>
                          {report.acknowledged.includes(j.id) ? "☑" : "☐"}
                        </span>
                        <span>
                          {j.text}
                          <span className="sr-only">{report.acknowledged.includes(j.id) ? " Confirmed." : " Not confirmed."}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>
              <div className="space-y-3">
                <Section title="Structural verification">
                  <CheckList checks={report.structural} />
                </Section>
                <Section title="Factual verification">
                  {report.factual.length > 0 ? <CheckList checks={report.factual} /> : <p className="text-smoke">Nothing in this block can be recomputed.</p>}
                </Section>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
