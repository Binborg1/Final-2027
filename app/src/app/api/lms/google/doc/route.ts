import { NextResponse, type NextRequest } from "next/server";
import { teacherForRequest, unauthorized } from "@/lib/auth/api";
import { uploadDoc } from "@/lib/lms/google";
import { withGoogle } from "@/lib/lms/route";
import { sameOrigin } from "@/lib/origin";
import { isObject } from "@/lib/resources/sanitize";
import { studentCopy } from "@/lib/resources/student-copy";

export const runtime = "nodejs";

const refuse = (message: string, status = 400) => NextResponse.json({ ok: false, reason: "invalid", message }, { status });

/**
 * Creates the student copy as a Google Doc in the teacher's Drive (drive.file:
 * Funza sees only files it created). The browser sends only the material's id:
 * the content is built on the server from the saved, approved version, so nothing
 * unapproved can be posted. Answers, keys and rubrics are never part of it.
 */
export async function POST(request: NextRequest) {
  const teacher = await teacherForRequest(request);
  if (!teacher) return unauthorized();
  if (!sameOrigin(request)) return refuse("Cross-site request refused.", 403);
  const body = (await request.json().catch(() => null)) as unknown;
  if (!isObject(body)) return refuse("Invalid request.");
  const copy = await studentCopy(teacher.supabase, teacher.id, body.resourceId);
  if (!copy.ok) return teacher.respond(refuse(copy.message, copy.status));
  return withGoogle(request, teacher, (token) => uploadDoc(token, `${copy.title} (v${copy.version})`, copy.html));
}
