"use client";

import { useParams } from "next/navigation";
import { ClassMissing } from "@/components/classes/ui";
import { LessonView } from "@/components/lesson/LessonView";
import { Spinner } from "@/components/Spinner";
import { classAsCourse, lectureAsTopic } from "@/lib/classes/study";
import { usePublicClass } from "@/lib/classes/usePublicClass";

/**
 * A published lecture in the usual lesson screen. Only text the professor
 * approved is shown; the live "ask Funza" box is off here for that reason.
 */
export default function ClassLecturePage() {
  const { code, lectureId } = useParams<{ code: string; lectureId: string }>();
  const state = usePublicClass(code);

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-3 text-sm font-semibold text-smoke" role="status">
        <Spinner /> Opening the lecture...
      </div>
    );
  }
  if (state.status === "not-found") return <ClassMissing code={code.toUpperCase()} />;
  if (state.status === "error") return <ClassMissing code={code.toUpperCase()} message={state.message} />;

  const cls = state.cls;
  const lecture = cls.lectures.find((l) => l.id === lectureId);
  if (!lecture) return <ClassMissing code={cls.code} message="That lecture is not published in this class" />;

  return (
    <LessonView
      key={`${cls.code}/${lecture.id}/${lecture.publishedAt}`}
      course={classAsCourse(cls)}
      topic={lectureAsTopic(cls, lecture)}
      source="class"
      backHref={`/class/${cls.code}`}
      reviewedBy={cls.professor}
      outcome={lecture.outcome ?? null}
      allowAsk={false}
    />
  );
}
