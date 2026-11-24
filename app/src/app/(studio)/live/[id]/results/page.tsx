import { CircleCheck, CircleX, Download, Layers, Lock, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LiveSteps } from "@/components/live/LiveSteps";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CountPill, Tag } from "@/components/ui/Chip";
import { requireTeacher } from "@/lib/auth/teacher";
import { loadDataset } from "@/lib/curriculum/dataset";
import { codeOf } from "@/lib/curriculum/sources";
import { LIVE_TYPE_LABEL } from "@/lib/live/questions";
import { liveResults, mostMissed } from "@/lib/live/results";
import { teacherStore } from "@/lib/live/store-supabase";

export const metadata: Metadata = { title: "Live results" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Bar({ value, tone = "sage" }: { value: number; tone?: "sage" | "accent" }) {
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-ink/10" aria-hidden>
      <span className={tone === "sage" ? "block h-full rounded-full bg-sage" : "block h-full rounded-full bg-accent"} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

/**
 * L5 Results: the class average, percent right by outcome, the most-missed
 * questions with their most common wrong answer (FR-14), each student's score
 * (only the teacher sees it) and the CSV export (FR-15).
 */
export default async function LiveResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireTeacher({ next: `/live/${id}/results` });
  if (!UUID.test(id)) notFound();
  const store = teacherStore(supabase);
  const session = await store.session(id.toLowerCase());
  if (!session) notFound();
  if (session.state !== "ended") redirect(`/live/${session.id}`);
  const [questions, participants, answers, course, chapter] = await Promise.all([
    store.questions(session.id),
    store.participants(session.id),
    store.answers(session.id),
    supabase.from("courses").select("title").eq("id", session.courseId).maybeSingle(),
    session.chapterId ? supabase.from("chapters").select("title").eq("id", session.chapterId).maybeSingle() : Promise.resolve(null),
  ]);
  loadDataset();
  const r = liveResults({ questions, participants, answers, purged: Boolean(session.studentsPurgedAt) });
  const missed = mostMissed(r);
  const notes = questions.filter((q) => q.markState === "done" && q.markNote).map((q) => q.markNote as string);
  const banked = session.revealedAt ? questions.filter((q) => q.questionId).length : 0;
  const date = new Date(session.createdAt).toLocaleDateString("en-CA", { weekday: "short", day: "numeric", month: "short" });
  const chapterHref = session.chapterId ? `/courses/${session.courseId}/chapters/${session.chapterId}` : `/courses/${session.courseId}`;
  const students = [...r.students].sort((a, b) => a.name.localeCompare(b.name));
  const half = Math.ceil(students.length / 2);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[...(course.data ? [{ label: course.data.title, href: `/courses/${session.courseId}` }] : []), { label: "Live sessions", href: "/live" }, { label: session.title }]}
        title={`${session.title} · results`}
        summary={[date, course.data?.title, chapter?.data?.title, `${r.questions.length} questions`, `${r.totalMarks} marks`, `${mmss(session.timerS)} for the whole set`].filter(Boolean).join(" · ")}
        actions={
          <>
            <ButtonLink variant="secondary" icon={Download} href={`/api/live/${session.id}/csv`}>
              Export CSV
            </ButtonLink>
            <Button icon={Sparkles} disabled title="Making practice from weak spots arrives in Release 2.">
              Make practice
            </Button>
          </>
        }
      />

      {r.purged ? (
        <p className="rounded-card bg-amber-tint px-5 py-3 text-row font-medium text-amber-ink">Student names and answers were deleted 30 days after this session. These are the anonymous counts per question that Funza keeps.</p>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
            <Card className="flex flex-col gap-1 px-6 py-5">
              <p className="text-badge font-semibold tracking-wider text-ink-2 uppercase">Class average</p>
              <p className="text-display font-bold tabular-nums">{r.classAverage === null ? "—" : `${r.classAverage}%`}</p>
              <p className="flex items-center gap-1.5 text-meta text-ink-2">
                <CircleCheck aria-hidden size={14} className="text-sage" /> {r.joined} student{r.joined === 1 ? "" : "s"}
              </p>
            </Card>
            <Card className="flex flex-col gap-3 px-6 py-5" aria-labelledby="by-outcome">
              <CardHeader id="by-outcome" title="By outcome" size="sm" after={<span className="text-meta text-ink-2">% right</span>} />
              {r.byOutcome.length === 0 ? (
                <p className="text-body text-ink-2">These questions aren&rsquo;t tied to curriculum outcomes.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {r.byOutcome.map((o) => (
                    <li key={o.outcomeRef} className="grid grid-cols-[110px_minmax(0,1fr)_48px] items-center gap-3 text-body">
                      <span className="font-bold">{codeOf(o.outcomeRef)}</span>
                      <Bar value={o.percentRight} />
                      <span className="text-right font-semibold tabular-nums">{o.percentRight}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {notes.length ? (
            <Card className="flex items-start gap-4 px-6 py-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-tint text-accent">
                <Sparkles aria-hidden size={20} />
              </span>
              <div>
                <p className="text-card-sm font-bold">Funza&rsquo;s summary</p>
                {notes.map((n, i) => (
                  <p key={i} className="mt-1 text-row">
                    {n}
                  </p>
                ))}
              </div>
            </Card>
          ) : null}

          <Card className="flex flex-col gap-3 px-6 pt-5 pb-4" aria-labelledby="most-missed">
            <CardHeader id="most-missed" title="Most missed" after={<span className="text-meta text-ink-2">Lowest percent right first</span>} />
            {missed.length === 0 ? (
              <p className="py-2 text-row text-ink-2">{r.questions.length ? "Everyone who answered got every question right." : "No questions in this session."}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {missed.map((q) => (
                  <li key={q.id} className="grid grid-cols-[64px_minmax(0,1fr)_140px] items-start gap-4 py-3">
                    <span>
                      <Tag className="bg-white">Q{q.n}</Tag>
                      <span className="mt-1 block text-meta text-ink-2">{LIVE_TYPE_LABEL[q.type]}</span>
                    </span>
                    <span>
                      <span className="block text-row font-medium">{q.stem}</span>
                      {q.commonWrong ? (
                        <span className="mt-1 flex items-center gap-1.5 text-meta font-medium text-red-ink">
                          <CircleX aria-hidden size={14} /> Common wrong answer: {q.commonWrong.text} · {q.commonWrong.percent}%
                        </span>
                      ) : null}
                      <span className="mt-1 block text-meta text-ink-2">Answer: {q.key}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1.5">
                      <span className="text-section font-bold tabular-nums">
                        {q.percentRight ?? 0}% <span className="text-meta font-medium text-ink-2">right</span>
                      </span>
                      <Bar value={q.percentRight ?? 0} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {banked > 0 ? (
            <Card className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <span className="flex items-center gap-2 text-row font-medium">
                <Layers aria-hidden size={18} /> Results added to {banked} question{banked === 1 ? "" : "s"} in the bank. Difficulty shows once a question has 10 answers.
              </span>
              <Link href={chapterHref} className="text-row font-semibold text-accent-ink hover:underline">
                Open question bank
              </Link>
            </Card>
          ) : null}
        </div>

        <Card className="flex flex-col gap-3 px-6 pt-5 pb-4" aria-labelledby="scores">
          <CardHeader id="scores" title="Student scores" after={<CountPill>{r.joined}</CountPill>} />
          {students.length === 0 ? (
            <p className="text-body text-ink-2">{r.purged ? "Deleted after 30 days." : "Nobody joined."}</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-6">
              {[students.slice(0, half), students.slice(half)].map((col, i) => (
                <ul key={i} className="flex flex-col divide-y divide-line">
                  {col.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-body">
                      <span className="truncate">{s.name}</span>
                      <span className="font-bold tabular-nums">{s.percent}%</span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          )}
          <p className="mt-1 flex items-center gap-1.5 border-t border-line pt-3 text-meta text-ink-2">
            <Lock aria-hidden size={14} /> Only you see this list. Each student saw only their own result.
          </p>
        </Card>
      </div>

      <LiveSteps current={5} />
    </div>
  );
}
