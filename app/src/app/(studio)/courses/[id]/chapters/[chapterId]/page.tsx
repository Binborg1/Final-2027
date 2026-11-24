import { FileUp, Layers, Radio, Sparkles, Target } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CountPill, Tag } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Misc";
import { requireTeacher } from "@/lib/auth/teacher";
import { chapterDetail } from "@/lib/courses/data";
import { idSchema } from "@/lib/courses/model";
import { QTYPE_LABEL } from "@/lib/resources/kinds";
import type { QType } from "@/lib/resources/types";
import { Materials } from "../../../Materials";

export const metadata = { title: "Chapter" };

/**
 * P2 A chapter (Figma F2): its materials, the curriculum outcomes it covers with
 * their official wording, and its question bank. Sources and live sessions arrive
 * with their steps.
 */
export default async function ChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
  const { id, chapterId } = await params;
  await requireTeacher({ next: `/courses/${encodeURIComponent(id)}/chapters/${encodeURIComponent(chapterId)}` });
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(chapterId).success) notFound();
  const detail = await chapterDetail(id, chapterId);
  if (!detail) notFound();
  const { course, chapter, index, total, materials, outcomes, questions } = detail;
  const makeHref = course.curriculumCourseId ? `/make?course=${course.id}&chapter=${chapter.id}` : null;

  const byType = new Map<string, number>();
  for (const q of questions) byType.set(q.type, (byType.get(q.type) ?? 0) + 1);
  const marks = questions.reduce((n, q) => n + q.marks, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[{ label: "Courses", href: "/courses" }, { label: course.title, href: `/courses/${course.id}` }, { label: chapter.title }]}
        title={chapter.title}
        summary={`Chapter ${index + 1} of ${total} · ${outcomes.length} outcome${outcomes.length === 1 ? "" : "s"}${chapter.sourceKind === "custom" ? "" : " · From the Saskatchewan curriculum"}`}
        actions={makeHref ? <ButtonLink href={makeHref} icon={Sparkles}>Make something</ButtonLink> : null}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-5">
          <Materials materials={materials} makeHref={makeHref} empty="Materials made from this chapter appear here." />

          <Card className="flex flex-col gap-3 px-6 pt-5 pb-5" aria-labelledby="outcomes-title">
            <CardHeader id="outcomes-title" title="Outcomes" after={<span className="text-meta text-ink-2">From the official source</span>} />
            {outcomes.length === 0 ? (
              <EmptyState icon={Target} title="No curriculum outcomes">
                This chapter isn’t tied to Saskatchewan curriculum outcomes. Make works from chapters that are.
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {outcomes.map((o) => (
                  <li key={o.id} className="flex items-start gap-3 rounded-tile border border-white/80 bg-tile px-3.5 py-3">
                    <Tag className="mt-0.5 shrink-0">{o.code}</Tag>
                    <p className="text-body leading-[21px]">{o.statement}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-3 px-6 pt-5 pb-5" aria-labelledby="bank-title">
            <CardHeader id="bank-title" title="Question bank" after={<CountPill>{questions.length}</CountPill>} />
            {questions.length === 0 ? (
              <EmptyState icon={Layers} title="No questions yet">
                Questions from quizzes, tests and exams you approve for this chapter are kept here.
              </EmptyState>
            ) : (
              <>
                <p className="text-body text-ink-2">
                  {[...byType.entries()].map(([t, n]) => `${n} ${QTYPE_LABEL[t as QType] ?? t}`).join(" · ")} · {marks} marks in all
                </p>
                <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
                  {questions.map((q) => (
                    <li key={q.id} className="flex flex-col gap-1 rounded-tile border border-white/80 bg-tile px-3.5 py-2.5">
                      <span className="line-clamp-2 text-body font-medium">{q.stem}</span>
                      <span className="text-meta text-ink-2">
                        {QTYPE_LABEL[q.type as QType] ?? q.type} · {q.marks} mark{q.marks === 1 ? "" : "s"}
                        {q.difficulty !== null ? ` · ${Math.round(q.difficulty * 100)}% right in class` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card className="flex flex-col gap-3 px-6 pt-5 pb-5" aria-labelledby="sources-title">
            <CardHeader id="sources-title" title="Sources" />
            <EmptyState icon={FileUp} title="Adding sources arrives next">
              Notes, PDFs and past exams attached to this chapter. For now, attach a file in Make.
            </EmptyState>
          </Card>

          <Card className="flex flex-col gap-3 px-6 pt-5 pb-5" aria-labelledby="live-title">
            <CardHeader id="live-title" title="Live sessions" />
            <EmptyState icon={Radio} title="Arrives with Live mode">
              Results from live quizzes on this chapter appear here.
            </EmptyState>
          </Card>
        </div>
      </div>
    </div>
  );
}
