import { getLessonProvider } from "@/lib/lessons/provider";
import type { ConceptProgress, Course, LessonsStore, ProgressStore, Topic } from "@/lib/types";
import { conceptKey } from "@/lib/types";

export type TopicSummary = { total: number; completed: number; needsPractice: number };

export function summarizeTopic(topic: Topic, entries: Record<string, ConceptProgress>): TopicSummary {
  let completed = 0;
  let needsPractice = 0;
  for (const concept of topic.concepts) {
    const status = entries[conceptKey(topic.id, concept.id)]?.status;
    if (status === "completed") completed++;
    else if (status === "needs-practice") needsPractice++;
  }
  return { total: topic.concepts.length, completed, needsPractice };
}

export function summarizeCourse(course: Course, progress: ProgressStore, lessons: LessonsStore) {
  const topics = getLessonProvider(course).listTopics(course, lessons);
  const entries = progress[course.id] ?? {};
  const summary = { total: 0, completed: 0, needsPractice: 0 };
  for (const topic of topics) {
    const t = summarizeTopic(topic, entries);
    summary.total += t.total;
    summary.completed += t.completed;
    summary.needsPractice += t.needsPractice;
  }
  return { ...summary, topics, entries };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
