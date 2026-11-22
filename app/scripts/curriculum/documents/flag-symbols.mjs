#!/usr/bin/env node
// node scripts/curriculum/documents/flag-symbols.mjs <id> [<id> ...]
// Marks items whose source lines contain glyphs from symbol fonts (unreliable Unicode mapping, e.g. an arrow
// printed as "6" or "X") or flattened sub/superscripts, so a person can check them against the PDF.
import { loadText, readDocument, writeDocument } from "./lib.mjs";

const IGNORE = new Set(["•", "—", "−"]);
for (const id of process.argv.slice(2)) {
  const data = readDocument(id);
  const doc = loadText(id);
  let flagged = 0;
  for (const u of data.units) {
    for (const it of u.items) {
      delete it.flags;
      const flags = [];
      for (const pg of [it.page, it.page + 1]) {
        const page = doc.pages[pg - 1];
        if (!page) continue;
        for (const l of page.lines) {
          if (l.text.length < 4 || !it.text.includes(l.text)) continue;
          const sym = (l.sym ?? []).filter((s) => !IGNORE.has(s) && !/^[.)2+&*\/,-]+$/.test(s));
          if (sym.length) flags.push(`symbol-font glyph(s) ${sym.map((s) => JSON.stringify(s)).join(", ")} in "${l.text}" (PDF p${pg}): probably a mis-mapped math/arrow symbol; check the printed page`);
          if (l.scripts) flags.push(`sub/superscript flattened inline in "${l.text}" (PDF p${pg})`);
        }
      }
      if (flags.length) {
        it.flags = [...new Set(flags)];
        flagged++;
      }
    }
  }
  data.notes = data.notes.filter((n) => !n.startsWith("Items with `flags`:"));
  data.notes.push(`Items with \`flags\`: ${flagged}. Each flag names a source line containing a symbol-font glyph or a flattened sub/superscript; check those against the printed page before use.`);
  writeDocument(id, data);
  console.log(id, "flagged", flagged);
  for (const u of data.units) for (const it of u.items) if (it.flags) console.log("  ", u.name.slice(0, 30), "|", it.text.slice(0, 120), "||", it.flags.join(" ; ").slice(0, 200));
}
