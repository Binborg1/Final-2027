"use client";

import { useState } from "react";
import { AddCourseForm } from "@/components/AddCourseForm";
import { BrainMascot } from "@/components/BrainMascot";
import { Button } from "@/components/Button";
import { ClassCard } from "@/components/classes/ClassCard";
import { JoinClassForm } from "@/components/classes/JoinClassForm";
import { CourseCard } from "@/components/CourseCard";
import { Item, Rise, Stagger } from "@/components/motion";
import { sampleCourses } from "@/lib/lessons/sample";
import { addSampleCourse, useCourses, useHydrated, useJoinedClasses, useLessons, useProgress } from "@/lib/storage";

export default function HomePage() {
  const courses = useCourses();
  const progress = useProgress();
  const lessons = useLessons();
  const hydrated = useHydrated();
  const joined = useJoinedClasses();
  const [adding, setAdding] = useState(false);
  const missingSamples = sampleCourses.filter((s) => !courses.some((c) => c.id === s.id));

  return (
    <div>
      <header className="relative flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-3xl bg-linear-to-br from-navy-900 via-navy-800 to-[#3b2a8f] px-6 py-7 text-white shadow-lift md:px-9">
        <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#7c62f5]/30 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-5">
          <span className="hidden h-24 w-24 items-center justify-center rounded-2xl bg-white/10 sm:flex">
            <BrainMascot mood="happy" size={84} animate />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-wider text-navy-300 uppercase">Learn</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">What are we learning today?</h1>
            <p className="mt-2 max-w-xl text-[15px] text-[#d9def0]">Open a class your teacher shared, or study from your own lecture PDFs.</p>
          </div>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)} className="relative">
            Add course
          </Button>
        )}
      </header>

      {adding && <AddCourseForm onCancel={() => setAdding(false)} />}

      <section className="mt-10" aria-label="Your classes">
        <h2 className="text-xl font-bold">Your classes</h2>
        <p className="mt-1 text-sm text-smoke">
          Lessons your teacher reviewed and published. Join with the code they shared.
        </p>
        <div className="mt-4 rounded-2xl border border-line bg-white p-5 shadow-card">
          <JoinClassForm />
        </div>
        {hydrated && joined.length > 0 && (
          <Stagger className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {joined.map((c, index) => (
              <Item key={c.code}>
                <ClassCard href={`/class/${c.code}`} name={c.name} detail={c.professor} code={c.code} index={index} />
              </Item>
            ))}
          </Stagger>
        )}
      </section>

      <h2 className="mt-12 text-xl font-bold">Your own courses</h2>
      <section className="mt-4" aria-label="My courses">
        {!hydrated ? null : courses.length === 0 ? (
          <Rise className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center">
            <BrainMascot mood="thinking" size={96} animate />
            <p className="mt-4 text-lg font-bold">No courses yet</p>
            <p className="mt-1 text-sm text-smoke">Add a course and attach its PDFs to start learning.</p>
            {!adding && (
              <Button className="mt-5" onClick={() => setAdding(true)}>
                Add Course
              </Button>
            )}
          </Rise>
        ) : (
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course, index) => (
              <Item key={course.id}>
                <CourseCard course={course} progress={progress} lessons={lessons} index={index} />
              </Item>
            ))}
          </Stagger>
        )}
      </section>

      {hydrated && missingSamples.length > 0 && (
        <section className="mt-8" aria-label="Sample courses">
          <h2 className="text-sm font-bold text-smoke">Try a built-in sample</h2>
          <p className="mt-1 text-xs text-smoke">Short lessons with interactive demos. Remove them whenever you like.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingSamples.map((sample) => (
              <Button key={sample.id} variant="secondary" className="px-3.5 py-1.5 text-xs" onClick={() => addSampleCourse(sample)}>
                Add {sample.name.replace(/^sample:\s*/i, "")}
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
