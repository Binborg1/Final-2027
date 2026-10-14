"use client";

import { useState } from "react";
import { AddCourseForm } from "@/components/AddCourseForm";
import { BrainMascot } from "@/components/BrainMascot";
import { Button } from "@/components/Button";
import { CourseCard } from "@/components/CourseCard";
import { Item, Rise, Stagger } from "@/components/motion";
import { sampleCourses } from "@/lib/lessons/sample";
import { addSampleCourse, useCourses, useHydrated, useLessons, useProgress } from "@/lib/storage";

export default function HomePage() {
  const courses = useCourses();
  const progress = useProgress();
  const lessons = useLessons();
  const hydrated = useHydrated();
  const [adding, setAdding] = useState(false);
  const missingSamples = sampleCourses.filter((s) => !courses.some((c) => c.id === s.id));

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <BrainMascot mood="happy" size={112} animate className="hidden sm:block" />
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">What are we learning today?</h1>
            <p className="mt-2 text-smoke">Pick a course to continue, or add one with your lecture PDFs.</p>
          </div>
        </div>
        {!adding && <Button onClick={() => setAdding(true)}>Add Course</Button>}
      </header>

      {adding && <AddCourseForm onCancel={() => setAdding(false)} />}

      <section className="mt-10" aria-label="My courses">
        {!hydrated ? null : courses.length === 0 ? (
          <Rise className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center">
            <BrainMascot mood="thinking" size={96} animate />
            <p className="mt-4 text-lg font-extrabold">No courses yet</p>
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
          <h2 className="text-sm font-extrabold text-smoke">Try a built-in sample</h2>
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
