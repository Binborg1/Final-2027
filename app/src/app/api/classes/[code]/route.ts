import { NextResponse } from "next/server";
import { ClassValidationError, normalizeCode, publicView, sanitizeRecord } from "@/lib/classes/model";
import { EDIT_KEY_HEADER, keyMatches, readClass, storageConfigured, withoutKey, writeClass } from "@/lib/classes/server";

export const runtime = "nodejs";

/**
 * GET                           the student view: published lectures only.
 * GET  with the edit key header the whole class, drafts included, for its professor.
 * PUT  with the edit key header saves the class the professor's browser sends.
 */

type Context = { params: Promise<{ code: string }> };

const MAX_BODY_CHARS = 1_500_000;

const fail = (status: number, reason: string, message: string) => NextResponse.json({ ok: false, reason, message }, { status });

export async function GET(request: Request, { params }: Context) {
  if (!storageConfigured()) return fail(503, "not-configured", "Class storage is not set up on the server.");
  const code = normalizeCode((await params).code);
  const stored = await readClass(code).catch(() => null);
  if (!stored) return fail(404, "not-found", "There is no class with that code. Check it with your professor.");

  const key = request.headers.get(EDIT_KEY_HEADER);
  if (key !== null) {
    if (!keyMatches(stored, key)) return fail(403, "forbidden", "This browser does not have the edit key for that class.");
    return NextResponse.json({ ok: true, class: withoutKey(stored) }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true, class: publicView(stored) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, { params }: Context) {
  if (!storageConfigured()) return fail(503, "not-configured", "Class storage is not set up on the server.");
  const code = normalizeCode((await params).code);
  const stored = await readClass(code).catch(() => null);
  if (!stored) return fail(404, "not-found", "There is no class with that code.");
  if (!keyMatches(stored, request.headers.get(EDIT_KEY_HEADER))) return fail(403, "forbidden", "This browser does not have the edit key for that class.");

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return fail(413, "too-large", "This class is too large to save.");
  let record;
  try {
    record = sanitizeRecord(JSON.parse(raw), stored, new Date().toISOString());
  } catch (error) {
    return fail(400, "bad-request", error instanceof ClassValidationError ? error.message : "Invalid class.");
  }
  try {
    await writeClass({ ...record, editKeyHash: stored.editKeyHash }, { create: false });
    return NextResponse.json({ ok: true, class: record });
  } catch (error) {
    console.error("Class save failed:", error instanceof Error ? error.message : "unknown error");
    return fail(500, "storage", "The class could not be saved. Try again.");
  }
}
