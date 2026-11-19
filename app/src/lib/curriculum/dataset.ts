import { readFileSync } from "node:fs";
import path from "node:path";
import { registerCourses, type CatalogCourse } from "@/lib/curriculum/catalog";
import { gradeOfLevel, summarize, toCatalogCourse, type CourseSummary, type Dataset, type OutcomeHit } from "@/lib/curriculum/imported";

/**
 * Server only. Reads the imported Saskatchewan Grade 10–12 dataset once per server
 * process and registers every course in the catalog, so `findOutcome` on the server
 * knows all of them. The browser never receives the whole file: it asks the
 * /api/curriculum routes for the course list, single courses and search results.
 */

const FILE = path.join(process.cwd(), "src/data/curriculum/sk.json");

type Loaded = { dataset: Dataset; courses: Map<string, CatalogCourse>; summaries: CourseSummary[] };
let loaded: Loaded | null = null;

export function loadDataset(): Loaded {
  if (loaded) return loaded;
  const dataset = JSON.parse(readFileSync(FILE, "utf8")) as Dataset;
  const courses = new Map<string, CatalogCourse>();
  for (const c of dataset.courses) if (c.outcomes.length > 0) courses.set(c.id, toCatalogCourse(c, dataset.importedOn));
  registerCourses([...courses.values()]);
  const summaries = dataset.courses.map(summarize).sort((a, b) => a.name.localeCompare(b.name, "en"));
  loaded = { dataset, courses, summaries };
  return loaded;
}

export function importedCourse(id: string): CatalogCourse | null {
  return loadDataset().courses.get(id) ?? null;
}

/** The courses that hold any of these outcome ids. */
export function coursesWithOutcomes(ids: string[]): CatalogCourse[] {
  const want = new Set(ids);
  const out: CatalogCourse[] = [];
  for (const c of loadDataset().courses.values()) if (c.units.some((u) => u.outcomes.some((o) => want.has(o.id)))) out.push(c);
  return out;
}

export type SearchFilters = { grade?: number | null; subject?: string | null; courseId?: string | null };

/**
 * Every word must appear in the outcome's code, wording, unit or course name.
 * An exact code match ranks first, then codes that start with the query.
 */
export function searchOutcomes(query: string, filters: SearchFilters = {}, limit = 60): { hits: OutcomeHit[]; total: number } {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  if (terms.length === 0) return { hits: [], total: 0 };
  const q = query.trim().toLowerCase();
  const scored: { hit: OutcomeHit; score: number }[] = [];
  for (const c of loadDataset().courses.values()) {
    if (filters.courseId && c.id !== filters.courseId) continue;
    if (filters.subject && c.subject !== filters.subject) continue;
    for (const u of c.units) {
      for (const o of u.outcomes) {
        // Outcomes without a level (Practical and Applied Arts modules) belong to every level of their course.
        const grades = o.level ? [gradeOfLevel(o.level)] : (c.levels ?? []).map(gradeOfLevel);
        if (filters.grade && !grades.includes(filters.grade)) continue;
        const code = o.code.toLowerCase();
        const hay = `${code} ${o.statement} ${u.name} ${c.name}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) continue;
        const score = code === q ? 0 : code.startsWith(q) || code.endsWith(q) ? 1 : code.includes(q) ? 2 : 3;
        scored.push({ score, hit: { courseId: c.id, courseName: c.name, unitName: u.name, id: o.id, code: o.code, statement: o.statement, status: o.status, level: o.level ?? null } });
      }
    }
  }
  scored.sort((a, b) => a.score - b.score || a.hit.courseName.localeCompare(b.hit.courseName, "en") || a.hit.code.localeCompare(b.hit.code, "en", { numeric: true }));
  return { hits: scored.slice(0, limit).map((s) => s.hit), total: scored.length };
}
