"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BrainMascot } from "@/components/BrainMascot";
import { Button, ButtonLink } from "@/components/Button";
import { ClassMissing } from "@/components/classes/ui";
import { accents } from "@/components/CourseCard";
import { Item, LiftCard, Rise, Stagger } from "@/components/motion";
import { SourceBanner } from "@/components/SourceBanner";
import { Spinner } from "@/components/Spinner";
import { leaveClass } from "@/lib/classes/client";
import { classCourseId } from "@/lib/classes/model";
import { formatDay, lectureAsTopic } from "@/lib/classes/study";
import { usePublicClass } from "@/lib/classes/usePublicClass";
import { summarizeTopic } from "@/lib/progress";
import { useProgress } from "@/lib/storage";

export default function ClassPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const state = usePublicClass(code);
  const progress = useProgress();

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-3 text-sm font-semibold text-smoke" role="status">
        <Spinner /> Opening the class...
      </div>
    );
  }
  if (state.status === "not-found") return <ClassMissing code={code.toUpperCase()} />;
  if (state.status === "error") return <ClassMissing code={code.toUpperCase()} message={state.message} />;

  const cls = state.cls;
  const entries = progress[classCourseId(cls.code)] ?? {};

  function onLeave() {
    if (!window.confirm(`Leave ${cls.name}? You can join again with the code.`)) return;
    leaveClass(cls.code);
    router.push("/");
  }

  return (
    <div>
      <nav className="text-sm font-semibold text-smoke" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-charcoal">
          My Courses
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-charcoal">{cls.name}</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-4xl font-extrabold tracking-tight">{cls.name}</h1>
        <p className="mt-2 text-smoke">
          {[cls.professor, cls.term].filter(Boolean).join(" · ")} · {cls.lectures.length} lecture{cls.lectures.length === 1 ? "" : "s"}
        </p>
      </header>

      <div className="mt-6">
        <SourceBanner source="class" by={cls.professor} />
      </div>

      <section className="mt-10" aria-label="Lectures">
        <h2 className="text-xl font-extrabold">Lectures</h2>
        {cls.lectures.length === 0 ? (
          <Rise className="mt-4 flex flex-col items-center rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center">
            <BrainMascot mood="thinking" size={96} animate />
            <p className="mt-4 text-lg font-extrabold">Nothing published yet</p>
            <p className="mt-1 max-w-md text-sm text-smoke">
              Lectures show up here once {cls.professor} reviews and publishes them. You are in the class, so just check back.
            </p>
          </Rise>
        ) : (
          <Stagger className="mt-4 grid gap-4">
            {cls.lectures.map((lecture, i) => {
              const topic = lectureAsTopic(cls, lecture);
              const s = summarizeTopic(topic, entries);
              const accent = accents[i % accents.length];
              const label = s.completed + s.needsPractice === 0 ? "Start learning" : s.completed === s.total ? "Review lecture" : "Continue";
              return (
                <Item key={lecture.id}>
                  <LiftCard className="flex flex-wrap items-center gap-4 p-5 md:p-6">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold shadow-edge ${accent.bg} ${accent.text}`}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-extrabold">{lecture.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-smoke">{topic.summary}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="rounded-full bg-sand px-2.5 py-0.5 text-smoke">{s.total} concepts</span>
                        <span className="rounded-full bg-mint px-2.5 py-0.5 text-mint-dark">{s.completed} completed</span>
                        {s.needsPractice > 0 && (
                          <span className="rounded-full bg-peach px-2.5 py-0.5 text-peach-dark">{s.needsPractice} to practise</span>
                        )}
                        <span className="rounded-full bg-sand px-2.5 py-0.5 text-smoke">Published {formatDay(lecture.publishedAt)}</span>
                      </div>
                    </div>
                    <ButtonLink href={`/class/${cls.code}/lectures/${lecture.id}`}>{label}</ButtonLink>
                  </LiftCard>
                </Item>
              );
            })}
          </Stagger>
        )}
      </section>

      <section className="mt-12 border-t border-line pt-6">
        <Button variant="ghost" onClick={onLeave}>
          Leave class
        </Button>
      </section>
    </div>
  );
}
