"use client";

import { motion } from "framer-motion";
import { cardClass, lift, MotionLink, press, spring } from "@/components/motion";
import type { Course, LessonsStore, ProgressStore } from "@/lib/types";
import { summarizeCourse } from "@/lib/progress";

/** Pastel accents cycle through courses so each card feels distinct. */
export const accents = [
  { bg: "bg-mint", text: "text-mint-dark" },
  { bg: "bg-sky", text: "text-sky-dark" },
  { bg: "bg-lavender", text: "text-lavender-dark" },
  { bg: "bg-peach", text: "text-peach-dark" },
];

export function CourseCard({
  course,
  progress,
  lessons,
  index = 0,
}: {
  course: Course;
  progress: ProgressStore;
  lessons: LessonsStore;
  index?: number;
}) {
  const { total, completed, needsPractice } = summarizeCourse(course, progress, lessons);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const accent = accents[index % accents.length];
  return (
    <MotionLink
      href={`/courses/${course.id}`}
      whileHover={lift}
      whileTap={press}
      transition={spring}
      className={`block p-5 ${cardClass}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold shadow-edge ${accent.bg} ${accent.text}`}
          aria-hidden="true"
        >
          {course.name.replace(/^sample:\s*/i, "").trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base leading-tight font-extrabold">
            <span>{course.name}</span>
            {course.sample && (
              <span className="shrink-0 rounded-full bg-peach px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-peach-dark">
                SAMPLE
              </span>
            )}
          </h3>
          <p className="text-sm text-smoke">
            {course.sample
              ? "Built-in lessons"
              : `${course.files.length} PDF${course.files.length === 1 ? "" : "s"} attached`}
          </p>
        </div>
      </div>
      <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-sand shadow-track">
        <motion.div
          className="h-full rounded-full bg-coral"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ type: "spring", stiffness: 160, damping: 26 }}
        />
      </div>
      <p className="mt-2 text-xs font-semibold text-smoke">
        {total === 0
          ? "No lessons yet"
          : `${completed} of ${total} concepts completed${needsPractice > 0 ? ` · ${needsPractice} to practise` : ""}`}
      </p>
    </MotionLink>
  );
}
