import { NextResponse } from "next/server";
import { ClassValidationError, sanitizeInfo } from "@/lib/classes/model";
import { createClass, storageConfigured, withoutKey } from "@/lib/classes/server";

export const runtime = "nodejs";

/**
 * POST { name, term, professor }  creates a class and returns it with its edit key.
 * The key is returned only here; the professor's browser keeps it.
 */
export async function POST(request: Request) {
  if (!storageConfigured()) {
    return NextResponse.json({ ok: false, reason: "not-configured", message: "Class storage is not set up on the server." });
  }
  let info;
  try {
    info = sanitizeInfo(await request.json());
  } catch (error) {
    const message = error instanceof ClassValidationError ? error.message : "Invalid request.";
    return NextResponse.json({ ok: false, reason: "bad-request", message }, { status: 400 });
  }
  try {
    const { record, editKey } = await createClass(info);
    return NextResponse.json({ ok: true, class: withoutKey(record), editKey });
  } catch (error) {
    console.error("Class create failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ ok: false, reason: "storage", message: "The class could not be created. Try again." }, { status: 500 });
  }
}
