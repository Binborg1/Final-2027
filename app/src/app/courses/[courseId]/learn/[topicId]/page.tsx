"use client";

import { useParams } from "next/navigation";
import { LessonView } from "@/components/lesson/LessonView";
import { NotFound } from "@/components/NotFound";
import { TeachView } from "@/components/teach/TeachView";
import { getLessonProvider } from "@/lib/lessons/provider";
import { useCourses, useHydrated, useLessons, useProgress, useSources } from "@/lib/storage";
import { conceptKey } from "@/lib/types";

export default function LearnPage() {
  const { courseId, topicId } = useParams<{ courseId: string; topicId: string }>();
  const courses = useCourses();
  const lessons = useLessons();
  const sources = useSources();
  const progress = useProgress();
  const hydrated = useHydrated();

  if (!hydrated) return null;
  const course = courses.find((c) => c.id === courseId);
  if (!course) return <NotFound what="course" />;

  const provider = getLessonProvider(course);
  const topic = provider.getTopic(course, lessons, topicId);
  if (!topic) return <NotFound what="topic" />;

  if (topic.kind === "ai") {
    const sections = (topic.fileName && sources[course.id]?.[topic.fileName]) || [];
    const saved = progress[course.id] ?? {};
    return (
      <TeachView
        key={`${course.id}/${topic.id}`}
        course={course}
        topic={topic}
        sections={sections}
        savedStatus={(id) => saved[conceptKey(topic.id, id)]?.status}
      />
    );
  }

  return <LessonView key={`${course.id}/${topic.id}`} course={course} topic={topic} source={provider.source} />;
}
