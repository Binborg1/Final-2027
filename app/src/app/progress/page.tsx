"use client";

import Link from "next/link";
import { BrainMascot } from "@/components/BrainMascot";
import { Item, Rise, Stagger } from "@/components/motion";
import { CourseCompletionChart, DailyActivityChart, KpiRow } from "@/components/progress/ProgressCharts";
import { summarizeCourse } from "@/lib/progress";
import { completedPerDay, computeKpis } from "@/lib/stats";
import { useCourses, useHydrated, useLessons, useProgress } from "@/lib/storage";
import type { Concept, Topic } from "@/lib/types";
import { conceptKey } from "@/lib/types";

type ConceptItem = { topic: Topic; concept: Concept };

export default function ProgressPage() {
  const courses = useCourses();
  const progress = useProgress();
  const lessons = useLessons();
  const hydrated = useHydrated();

  if (!hydrated) return null;

  const summaries = courses.map((course) => ({ course, ...summarizeCourse(course, progress, lessons) }));
  const courseStats = summaries.map((s) => ({
    id: s.course.id,
    name: s.course.name,
    total: s.total,
    completed: s.completed,
    needsPractice: s.needsPractice,
  }));
  const allEntries = summaries.flatMap((s) => Object.values(s.entries));
  const kpis = computeKpis(allEntries, courseStats);
  const days = completedPerDay(allEntries);

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight">Progress</h1>
      <p className="mt-2 text-smoke">
        {courses.length} course{courses.length === 1 ? "" : "s"}, tracked in this browser.
      </p>

      <div className="mt-6">
        <KpiRow kpis={kpis} />
      </div>

      {courses.length === 0 ? (
        <Rise className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center">
          <BrainMascot mood="thinking" size={96} animate />
          <p className="mt-4 text-sm text-smoke">
            No courses yet.{" "}
            <Link href="/" className="font-bold text-coral-dark hover:underline">
              Add a course
            </Link>{" "}
            to start.
          </p>
        </Rise>
      ) : (
        <>
          <Stagger className="mt-5 grid gap-5 lg:grid-cols-2">
            <Item>
              <CourseCompletionChart courses={courseStats} />
            </Item>
            <Item>
              <DailyActivityChart days={days} />
            </Item>
          </Stagger>

          <h2 className="mt-10 text-xl font-extrabold">By course</h2>
          <Stagger className="mt-4 space-y-6">
            {summaries.map(({ course, topics, entries }) => {
              const done: ConceptItem[] = [];
              const practice: ConceptItem[] = [];
              for (const topic of topics) {
                for (const concept of topic.concepts) {
                  const status = entries[conceptKey(topic.id, concept.id)]?.status;
                  if (status === "completed") done.push({ topic, concept });
                  else if (status === "needs-practice") practice.push({ topic, concept });
                }
              }
              return (
                <Item key={course.id}>
                  <section className="rounded-3xl border border-line bg-white p-6 shadow-card md:p-7">
                    <h3 className="text-lg font-extrabold">
                      <Link href={`/courses/${course.id}`} className="transition-colors hover:text-coral-dark">
                        {course.name}
                      </Link>
                    </h3>
                    <div className="mt-4 grid gap-6 md:grid-cols-2">
                      <ConceptList
                        title="Completed"
                        tone="good"
                        items={done}
                        courseId={course.id}
                        empty="Nothing completed yet."
                      />
                      <ConceptList
                        title="Needs more practice"
                        tone="warning"
                        items={practice}
                        courseId={course.id}
                        empty="Nothing to practise."
                      />
                    </div>
                  </section>
                </Item>
              );
            })}
          </Stagger>
        </>
      )}
    </div>
  );
}

function ConceptList({
  title,
  tone,
  items,
  courseId,
  empty,
}: {
  title: string;
  tone: "good" | "warning";
  items: ConceptItem[];
  courseId: string;
  empty: string;
}) {
  const dot = tone === "good" ? "bg-chart-good" : "bg-chart-warning";
  const badge = tone === "good" ? "bg-mint text-mint-dark" : "bg-peach text-peach-dark";
  return (
    <div>
      <h4 className="flex items-center gap-2 text-sm font-extrabold">
        {title}
        <span className={`rounded-full px-2 py-0.5 text-xs ${badge}`}>{items.length}</span>
      </h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-smoke">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map(({ topic, concept }) => (
            <li key={`${topic.id}/${concept.id}`} className="flex items-start gap-2.5">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
              <span>
                <Link
                  href={`/courses/${courseId}/learn/${topic.id}`}
                  className="font-semibold text-charcoal transition-colors hover:text-coral-dark"
                >
                  {concept.title}
                </Link>
                <span className="ml-2 text-xs text-smoke">{topic.title}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
