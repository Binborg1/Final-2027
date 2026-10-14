import type { CourseStat, DayStat, Kpis } from "@/components/progress/ProgressCharts";
import type { ConceptProgress } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Local calendar day of an ISO timestamp, as YYYY-MM-DD. */
function localDay(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function computeKpis(entries: ConceptProgress[], courses: CourseStat[]): Kpis {
  const now = Date.now();
  const weekAgo = now - 7 * 864e5;
  const completedEntries = entries.filter((e) => e.status === "completed");
  const completedLast7 = completedEntries.filter((e) => Date.parse(e.updatedAt) >= weekAgo).length;
  const firstTry = completedEntries.filter((e) => e.attempts <= 1).length;
  return {
    completed: courses.reduce((n, c) => n + c.completed, 0),
    completedLast7,
    needsPractice: courses.reduce((n, c) => n + c.needsPractice, 0),
    firstTryRate: completedEntries.length === 0 ? null : Math.round((firstTry / completedEntries.length) * 100),
    activeDays: new Set(entries.map((e) => localDay(e.updatedAt))).size,
  };
}

/** Concepts completed per local day over the last `span` days, ending today. */
export function completedPerDay(entries: ConceptProgress[], span = 14): DayStat[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.status !== "completed") continue;
    const key = localDay(e.updatedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const days: DayStat[] = [];
  const today = new Date();
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = localDay(d.toISOString());
    days.push({ date: key, day: d.getDate(), month: MONTHS[d.getMonth()], count: counts.get(key) ?? 0 });
  }
  return days;
}
