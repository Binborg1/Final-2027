#!/usr/bin/env node
/**
 * node scripts/curriculum/documents/pdftext.mjs <curriculumId|url> [--name=<name>] [--split=X]
 *
 * Fetches a curriculum PDF through the importer's polite cache and writes per-page lines to
 * .cache/curriculum/documents/text/<name>.json:
 *   {url, sha256, numPages, fonts, pages:[{page, label, lines:[{col, y, x, size, font, bold, italic, text, scripts?, sym?}]}]}
 * using the pdfjs-dist legacy build. --split=X puts text starting at x>=X in a second column,
 * emitted after the first (two-column layouts). Small-font items (sub/superscripts) are joined
 * to the line they belong to, in x order, without a space.
 */

import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { APP, getBytes, sha256 } from "../fetch.mjs";
import { curriculumFile, saveText } from "./lib.mjs";

const arg = process.argv[2];
if (!arg) throw new Error("usage: pdftext.mjs <curriculumId|url> [--name=<name>] [--split=X]");
const url = /^\d+$/.test(arg) ? curriculumFile(arg) : arg;
const name = (process.argv.find((a) => a.startsWith("--name=")) ?? `--name=${/^\d+$/.test(arg) ? arg : "document"}`).slice(7);
const split = Number((process.argv.find((a) => a.startsWith("--split=")) ?? "--split=0").slice(8));

const pdfjs = await import(pathToFileURL(join(APP, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs")).href);
const r = await getBytes(url);
if (!r.bytes) throw new Error(`${url}: ${r.error}`);
if (r.bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`${url} did not answer with a PDF.`);
const doc = await pdfjs.getDocument({ data: new Uint8Array(r.bytes), isEvalSupported: false, verbosity: 0 }).promise;
let labels = null;
try {
  labels = await doc.getPageLabels();
} catch {
  labels = null;
}
const fonts = {};
const pages = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  await page.getOperatorList();
  const tc = await page.getTextContent();
  const items = tc.items.filter((i) => "str" in i && (i.str !== "" || i.hasEOL)).map((i) => ({ x: i.transform[4], y: i.transform[5], size: Math.round(Math.hypot(i.transform[2], i.transform[3]) * 10) / 10, font: i.fontName, str: i.str, w: i.width }));
  for (const it of items) {
    if (!(it.font in fonts)) {
      let info = null;
      try {
        const f = page.commonObjs.get(it.font);
        info = { name: f.name ?? f.loadedName ?? null, bold: !!(f.bold || f.black), italic: !!f.italic };
      } catch {
        info = null;
      }
      fonts[it.font] = info;
    }
    // WordPerfect symbol fonts: "!" in WPTypographicSymbols is a bullet; ")" in WPBoxDrawing is a horizontal rule used as a dash.
    const fn = fonts[it.font]?.name ?? "";
    if (fn === "WPTypographicSymbols" && it.str === "!") it.str = "•";
    // ...but in a superscript (e.g. "L)1", "OH)") the same glyph is a minus sign.
    if (fn === "WPBoxDrawing" && it.str === ")") it.str = it.size < 8 ? "−" : "—";
  }
  const sizes = items
    .filter((i) => i.str.trim())
    .map((i) => i.size)
    .sort((a, b) => a - b);
  const body = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 10;
  const cols = split ? [items.filter((i) => i.x < split), items.filter((i) => i.x >= split)] : [items];
  const lines = [];
  for (const [ci, colItems] of cols.entries()) {
    // Whitespace-only items are dropped: spaces are re-derived from the gaps between items.
    const normal = colItems.filter((i) => i.str.trim() && i.size >= body * 0.75);
    const small = colItems.filter((i) => i.str.trim() && i.size < body * 0.75);
    for (const it of normal) {
      let line = lines.find((l) => l.col === ci && Math.abs(l.y - it.y) < 2);
      if (!line) {
        line = { col: ci, y: it.y, parts: [] };
        lines.push(line);
      }
      line.parts.push(it);
    }
    for (const it of small) {
      // nearest line in this column within 6 pt vertically that spans this x
      let best = null;
      for (const l of lines) {
        if (l.col !== ci) continue;
        const dy = Math.abs(l.y - it.y);
        if (dy > 6) continue;
        const minX = Math.min(...l.parts.map((q) => q.x)) - 5;
        const maxX = Math.max(...l.parts.map((q) => q.x + q.w)) + 15;
        if (it.x < minX || it.x > maxX) continue;
        if (!best || dy < best.dy) best = { l, dy };
      }
      if (best) best.l.parts.push({ ...it, script: true });
      else lines.push({ col: ci, y: it.y, parts: [it] });
    }
    // Remember where whitespace items sit, so a space after a sub/superscript is kept.
    for (const it of colItems.filter((i) => !i.str.trim() && i.str.length)) {
      const l = lines.find((x) => x.col === ci && Math.abs(x.y - it.y) < 4);
      if (l) (l.spaces ??= []).push(it.x);
    }
  }
  lines.sort((a, b) => a.col - b.col || b.y - a.y);
  const out = lines
    .map((l) => {
      l.parts.sort((a, b) => a.x - b.x);
      let s = "";
      let lastEnd = null;
      let lastScript = false;
      for (const pt of l.parts) {
        const gap = lastEnd === null ? 0 : pt.x - lastEnd;
        const spaceBetween = lastEnd !== null && (l.spaces ?? []).some((x) => x >= lastEnd - 1 && x <= pt.x + 0.5);
        if (lastEnd !== null && !pt.script && (gap > (lastScript ? 0.6 : 1.5) || (lastScript && spaceBetween)) && !s.endsWith(" ") && !pt.str.startsWith(" ")) s += gap > 25 ? "  |  " : " ";
        s += pt.str;
        lastEnd = pt.x + pt.w;
        lastScript = !!pt.script;
      }
      const main = l.parts.filter((q) => !q.script && q.str.trim());
      const big = (main.length ? main : l.parts).reduce((a, b) => (b.str.trim().length > a.str.trim().length ? b : a));
      const fi = fonts[big.font] ?? {};
      // Glyphs from unnamed/embedded symbol fonts (e.g. arrows drawn as "X" or "6") whose Unicode mapping is unreliable.
      const isSym = (q) => {
        const n = fonts[q.font]?.name ?? q.font;
        return /^g_d\d+_f\d+$|Symbol|Math|Wingding|Dingbat|^WP(?!TypographicSymbols$|BoxDrawing$)/i.test(n) || (/^WP/.test(n) && !["•", "—"].includes(q.str));
      };
      const sym = l.parts.filter((q) => q.str.trim() && isSym(q)).map((q) => q.str);
      return { col: l.col, y: Math.round(l.y), x: Math.round(Math.min(...l.parts.map((q) => q.x))), size: big.size, font: big.font, bold: !!fi.bold, italic: !!fi.italic, text: s.replace(/\s+/g, " ").trim(), scripts: l.parts.some((q) => q.script) || undefined, sym: sym.length ? sym : undefined };
    })
    .filter((l) => l.text);
  pages.push({ page: p, label: labels?.[p - 1] ?? null, lines: out });
  page.cleanup();
}
saveText(name, { url, sha256: sha256(r.bytes), numPages: doc.numPages, fonts, pages });
console.log(`${name}: pages ${doc.numPages}, lines ${pages.reduce((n, p) => n + p.lines.length, 0)}, empty pages ${pages.filter((p) => p.lines.length === 0).length}`);
