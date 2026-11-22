// Prints the course-specific document links on a cached CurriculumHome page (outside the megamenu).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// The importer cache: app/.cache/curriculum/sk.
const CACHE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", ".cache", "curriculum", "sk");
const key = (u) => createHash("sha256").update(u, "utf8").digest("hex").slice(0, 24);
for (const id of process.argv.slice(2)) {
  const u = `https://curriculum.gov.sk.ca/CurriculumHome?id=${id}`;
  const f = join(CACHE, key(u) + ".bin");
  const h = readFileSync(f, "utf8");
  const i = h.lastIndexOf("megamenu");
  const body = h.slice(i);
  const t = (s) => s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  const title = t((h.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
  const links = [];
  for (const m of body.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (/favicon|saskatchewan\.ca\/|mailto|progetudes|resources\.edonline|rover\.|PaaOverview|language=fr|^\/$/.test(m[1])) continue;
    const ctx = t(body.slice(Math.max(0, m.index - 250), m.index)).slice(-90);
    links.push(`   ${m[1]} | ${t(m[2])} | ...${ctx}`);
  }
  console.log(id, title); console.log(links.join("\n"));
}
