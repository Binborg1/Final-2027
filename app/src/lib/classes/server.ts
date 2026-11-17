import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { get, put } from "@vercel/blob";
import { isValidCode, makeCode, type ClassRecord } from "@/lib/classes/model";

/**
 * Server-side class storage, one private JSON blob per class in the same
 * Vercel Blob store as the survey. There are no accounts yet: whoever holds a
 * class's edit key can change it, and only a hash of that key is stored.
 * Import from route handlers only.
 */

export type StoredClass = ClassRecord & { editKeyHash: string };

const PREFIX = "classes/";

export const EDIT_KEY_HEADER = "x-funza-edit-key";

export function storageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

const pathFor = (code: string) => `${PREFIX}${code}.json`;

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export function newEditKey(): { key: string; hash: string } {
  const key = randomBytes(24).toString("base64url");
  return { key, hash: hashKey(key) };
}

export function keyMatches(stored: StoredClass, given: string | null): boolean {
  if (!given) return false;
  const a = Buffer.from(hashKey(given), "hex");
  const b = Buffer.from(stored.editKeyHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function readClass(code: string): Promise<StoredClass | null> {
  if (!isValidCode(code)) return null;
  const result = await get(pathFor(code), { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  try {
    const parsed = JSON.parse(await new Response(result.stream).text()) as StoredClass;
    return parsed && typeof parsed === "object" && typeof parsed.editKeyHash === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeClass(record: StoredClass, options: { create: boolean }) {
  await put(pathFor(record.code), JSON.stringify(record), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: !options.create,
  });
}

/** Picks an unused code, stores the new class, and returns it with the edit key (shown once, to its creator). */
export async function createClass(info: { name: string; term: string; professor: string }): Promise<{ record: StoredClass; editKey: string }> {
  const { key, hash } = newEditKey();
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode(randomInt);
    if (await readClass(code)) continue;
    const record: StoredClass = { code, ...info, createdAt: now, updatedAt: now, lectures: [], editKeyHash: hash };
    try {
      await writeClass(record, { create: true });
      return { record, editKey: key };
    } catch {
      // Taken between the check and the write: try another code.
    }
  }
  throw new Error("Could not find a free class code.");
}

/** The class without its key hash, for the professor's own screens. */
export function withoutKey(stored: StoredClass): ClassRecord {
  const copy: Partial<StoredClass> = { ...stored };
  delete copy.editKeyHash;
  return copy as ClassRecord;
}
