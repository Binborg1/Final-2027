"use client";

import { useParams } from "next/navigation";
import { NotFound } from "@/components/NotFound";
import { QuestionWorkspace } from "@/components/questions/QuestionWorkspace";
import { getLessonProvider } from "@/lib/lessons/provider";
import { useCourses, useHydrated, useLessons, useQuestionSets } from "@/lib/storage";

export default function QuestionSetPage() {
  const { courseId, setId } = useParams<{ courseId: string; setId: string }>();
  const courses = useCourses();
  const lessons = useLessons();
  const questionSets = useQuestionSets();
  const hydrated = useHydrated();

  if (!hydrated) return null;
  const course = courses.find((c) => c.id === courseId);
  if (!course) return <NotFound what="course" />;
  const set = (questionSets[course.id] ?? []).find((s) => s.id === setId);
  if (!set) return <NotFound what="question set" />;

  const topics = getLessonProvider(course).listTopics(course, lessons);
  return <QuestionWorkspace key={set.id} course={course} set={set} topics={topics} />;
}
