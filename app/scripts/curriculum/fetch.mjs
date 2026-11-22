/**
 * Polite, cached fetching for the curriculum importer and the document-extraction scripts.
 *
 * Raw bytes are cached in .cache/curriculum/sk/<sha256(url).slice(0, 24)>.bin (not committed).
 * Answers that mean "not there" (HTTP 404/410) are remembered in a small .status file, so
 * re-runs do not ask again unless --refresh is given.
 *
 * Only the Ministry's own hosts are ever contacted.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const APP = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CACHE = join(APP, ".cache", "curriculum", "sk");
export const UA = "Mozilla/5.0 (compatible; curriculum-importer/1.0)";
// The site takes about 2 s per page, so two requests at a time with a pause stays under one request a second.
export const DELAY_MS = 250;
export const WORKERS = 2;
const HOSTS = new Set(["curriculum.gov.sk.ca", "www.edonline.sk.ca", "publications.saskatchewan.ca"]);

export const sha256 = (s) => createHash("sha256").update(s, typeof s === "string" ? "utf8" : undefined).digest("hex");
export const cacheKey = (url) => sha256(url).slice(0, 24);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const stats = { fetched: 0, cached: 0 };
let refresh = process.argv.includes("--refresh");
export function setRefresh(v) {
  refresh = v;
}

/** The cached raw bytes for a URL, or null. Never touches the network. */
export function cachedBytes(url) {
  const file = join(CACHE, `${cacheKey(url)}.bin`);
  return existsSync(file) ? readFileSync(file) : null;
}

/**
 * Fetches a URL politely (delayed, retried) and caches the raw bytes. Returns
 * { bytes, status } or { error, status }.
 */
export async function getBytes(url) {
  const host = new URL(url).hostname;
  if (!HOSTS.has(host)) throw new Error(`Refusing to fetch from ${host}: only the Ministry's own sites are allowed.`);
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${cacheKey(url)}.bin`);
  const statusFile = join(CACHE, `${cacheKey(url)}.status`);
  if (!refresh && existsSync(file)) {
    stats.cached++;
    return { bytes: readFileSync(file), status: 200 };
  }
  if (!refresh && existsSync(statusFile)) {
    stats.cached++;
    const status = Number(readFileSync(statusFile, "utf8").trim());
    return { error: `HTTP ${status}`, status };
  }
  // --offline: use the cache only (e.g. while another import is fetching).
  if (process.argv.includes("--offline")) return { error: "not cached (--offline)", status: null };
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(DELAY_MS * attempt);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) {
        if (res.status === 404 || res.status === 410) writeFileSync(statusFile, String(res.status));
        return { error: `HTTP ${res.status}`, status: res.status };
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      // The site occasionally answers with an empty page; never cache one.
      if (bytes.length === 0) throw new Error("empty response");
      writeFileSync(file, bytes);
      stats.fetched++;
      if (stats.fetched % 50 === 0) console.log(`  … ${stats.fetched} pages fetched`);
      return { bytes, status: res.status };
    } catch (e) {
      if (attempt === 4) return { error: String(e?.message ?? e), status: null };
    }
  }
  return { error: "unreachable", status: null };
}

/** Decodes bytes as UTF-8, or Windows-1252 when they are not valid UTF-8 (some Ministry CSV files). */
export function decodeBytes(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Fetches a URL and returns its text, or { error, status }. */
export async function get(url) {
  const r = await getBytes(url);
  return r.bytes ? decodeBytes(r.bytes) : { error: r.error, status: r.status };
}

/** Runs `fn` over `items` with the importer's worker count. */
export async function pool(items, fn, workers = WORKERS) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}
