"use client";

import { useEffect, useState } from "react";
import { classApi } from "@/lib/classes/client";
import { isCurriculumLesson, lectureState, reviewCounts, type ClassRecord, type Lecture } from "@/lib/classes/model";
import { useHydrated, useTeaching, type TeachingEntry } from "@/lib/storage";

export type ClassOverview =
  | { status: "loading"; entry: TeachingEntry }
  | { status: "error"; entry: TeachingEntry; message: string }
  | { status: "ready"; entry: TeachingEntry; record: ClassRecord };

export type LessonSummary = {
  classCode: string;
  className: string;
  lecture: Lecture;
  curriculum: boolean;
  waiting: number;
  state: ReturnType<typeof lectureState>;
};

/** Every class this browser teaches, loaded from the server with its edit key. Counts come from the real records only. */
export function useTeachingOverview() {
  const hydrated = useHydrated();
  const teaching = useTeaching();
  const [loaded, setLoaded] = useState<Record<string, ClassOverview>>({});
  const keyList = teaching.map((t) => `${t.code}:${t.editKey}`).join("|");

  useEffect(() => {
    let active = true;
    for (const entry of teaching) {
      classApi.loadForEdit(entry.code, entry.editKey).then((res) => {
        if (!active) return;
        setLoaded((prev) => ({
          ...prev,
          [entry.code]: res.ok ? { status: "ready", entry, record: res.data } : { status: "error", entry, message: res.message },
        }));
      });
    }
    return () => {
      active = false;
    };
    // keyList captures the entries that matter; `teaching` is a new array on every store read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyList]);

  const classes: ClassOverview[] = teaching.map((entry) => loaded[entry.code] ?? { status: "loading", entry });
  const ready = classes.filter((c): c is Extract<ClassOverview, { status: "ready" }> => c.status === "ready");
  const lessons: LessonSummary[] = ready.flatMap((c) =>
    c.record.lectures.map((lecture) => ({
      classCode: c.record.code,
      className: c.record.name,
      lecture,
      curriculum: isCurriculumLesson(lecture),
      waiting: reviewCounts(lecture).pending,
      state: lectureState(lecture),
    })),
  );
  const allLoaded = hydrated && classes.every((c) => c.status !== "loading");
  return { hydrated, classes, lessons, allLoaded };
}
