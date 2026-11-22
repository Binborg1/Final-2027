import { NextResponse, type NextRequest } from "next/server";
import { teacherForRequest, unauthorized } from "@/lib/auth/api";
import { uploadDoc } from "@/lib/lms/google";
import { withGoogle } from "@/lib/lms/route";
import { sameOrigin } from "@/lib/origin";
import { KINDS } from "@/lib/resources/kinds";
import { studentHtml } from "@/lib/resources/render";
import { isObject, sanitizeSections, str } from "@/lib/resources/sanitize";

export const runtime = "nodejs";

const refuse = (message: string, status = 400) => NextResponse.json({ ok: false, reason: "invalid", message }, { status });

/**
 * Creates the student copy as a Google Doc in the teacher's Drive (drive.file:
 * Funza sees only files it created). The content is rebuilt from validated
 * sections on the server; answers, keys and rubrics are never part of it.
 */
export async function POST(request: NextRequest) {
  const teacher = await teacherForRequest(request);
  if (!teacher) return unauthorized();
  if (!sameOrigin(request)) return refuse("Cross-site request refused.", 403);
  const body = (await request.json().catch(() => null)) as unknown;
  if (!isObject(body)) return refuse("Invalid request.");
  const kind = KINDS.find((k) => k.kind === body.kind);
  if (!kind) return refuse("Unknown resource type.");
  if (!kind.forStudents) return refuse("This material is for teachers only and is not posted to students.");
  const sections = sanitizeSections(body.sections);
  const title = str(body.title, 160);
  if (!title || sections.length === 0) return refuse("Nothing to post.");
  const version = typeof body.version === "number" && body.version >= 1 ? Math.round(body.version) : 1;
  const html = studentHtml({
    kind: kind.kind,
    title,
    courseName: str(body.courseName, 120) || "Science 10",
    outcomeCodes: (Array.isArray(body.outcomeCodes) ? body.outcomeCodes : []).map((c) => str(c, 20)).filter(Boolean).slice(0, 6),
    duration: typeof body.duration === "number" ? Math.round(body.duration) : null,
    school: str(body.school, 120),
    sections,
  });
  return withGoogle(request, teacher, (token) => uploadDoc(token, `${title} (v${version})`, html));
}
