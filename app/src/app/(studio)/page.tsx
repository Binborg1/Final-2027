import { ArrowRight, BookOpen, Plus, Radio, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Misc";
import { firstName } from "@/lib/auth/teacher-model";
import { requireTeacher, teacherCourses } from "@/lib/auth/teacher";
import { gradeOfLevel, greeting, todayLabel } from "@/lib/teachers/labels";
import { cn } from "@/lib/ui/cn";
import { WaitingForReview } from "./WaitingForReview";

export const metadata = { title: "Home" };

/** F1 Home: the two modes (Prepare first), drafts waiting for review, and the teacher's courses. */
export default async function HomePage() {
  const { teacher } = await requireTeacher({ next: "/" });
  const courses = await teacherCourses();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader size="display" title={`${greeting()}, ${firstName(teacher)}`} summary={todayLabel()} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ModeCard icon={Sparkles} title="Prepare" text="Make notes, slides, quizzes and exams for your courses." href="/make" />
        <ModeCard icon={Radio} title="Go live" text="Run a timed question set in class. Students join on their phones." href="/live/new" />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <WaitingForReview />
        <Card className="flex flex-col gap-1 px-6 pt-5 pb-5" aria-labelledby="courses-title">
          <CardHeader
            id="courses-title"
            title="Your courses"
            actions={
              courses.length > 0 ? (
                <Link href="/courses?add=1" className="inline-flex items-center gap-1.5 text-body font-semibold text-accent-ink hover:underline">
                  <Plus aria-hidden size={16} strokeWidth={2} />
                  Add a course
                </Link>
              ) : null
            }
          />
          {courses.length === 0 ? (
            <EmptyState icon={BookOpen} title="No courses yet" action={<ButtonLink href="/courses?add=1" variant="secondary" icon={Plus} size="sm">Add a course</ButtonLink>}>
              Add a course to start making materials for it.
            </EmptyState>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {courses.map((c, i) => {
                const grade = gradeOfLevel(c.level);
                return (
                  <li key={c.id}>
                    <Link href={`/courses/${c.id}`} className="group flex items-center gap-3 rounded-tile border border-white/80 bg-tile px-3.5 py-3 hover:bg-white/80">
                      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", i % 2 === 0 ? "bg-accent" : "bg-sage")} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-row font-semibold">{c.title}</span>
                        <span className="text-meta text-ink-2">Chapters, materials and question bank</span>
                      </span>
                      {grade ? <Tag>Grade {grade}</Tag> : null}
                      <ArrowRight aria-hidden size={16} className="shrink-0 text-ink-2 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ModeCard({ icon: Icon, title, text, href, soon }: { icon: LucideIcon; title: string; text: string; href?: string; soon?: string }) {
  const body = (
    <>
      <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full text-white", href ? "bg-accent" : "bg-accent/60")}>
        <Icon aria-hidden size={26} strokeWidth={1.6} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[24px] leading-[30px] font-bold">{title}</span>
        <span className="text-row leading-[21px] font-medium text-ink-2">{soon ?? text}</span>
      </span>
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/90">
        <ArrowRight size={20} strokeWidth={1.75} />
      </span>
    </>
  );
  const shape = "flex items-center gap-[18px] rounded-card border border-white/60 bg-surface-soft p-6 shadow-[0_8px_12px_rgb(58_36_20/0.06)] max-sm:p-4";
  if (!href) {
    return (
      <div aria-disabled="true" className={cn(shape, "cursor-not-allowed opacity-80")}>
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className={cn(shape, "transition hover:bg-white/70")}>
      {body}
    </Link>
  );
}
