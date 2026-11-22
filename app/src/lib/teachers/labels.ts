/** "Grades 10–12", "Grades 10 and 12", "Grade 11", or "" when none are chosen yet. */
export function gradesLabel(grades: number[]): string {
  const g = [...new Set(grades)].filter((x) => [10, 11, 12].includes(x)).sort((a, b) => a - b);
  if (g.length === 0) return "";
  if (g.length === 1) return `Grade ${g[0]}`;
  if (g.length === 3) return "Grades 10–12";
  return `Grades ${g[0]} and ${g[1]}`;
}

/** The grade a course level is taught in: 10 → 10, 20 → 11, 30 → 12. */
export const gradeOfLevel = (level: number | null | undefined): number | null => (level === 10 ? 10 : level === 20 ? 11 : level === 30 ? 12 : null);

/** Today's greeting in Saskatchewan time. */
export function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hourCycle: "h23", timeZone: "America/Regina" }).format(now));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** "Saturday, 21 November" in Saskatchewan time. */
export function todayLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Regina" }).format(now);
}
