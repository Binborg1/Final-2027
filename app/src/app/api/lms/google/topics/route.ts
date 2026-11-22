import { NextResponse, type NextRequest } from "next/server";
import { teacherForRequest, unauthorized } from "@/lib/auth/api";
import { listTopics } from "@/lib/lms/google";
import { withGoogle } from "@/lib/lms/route";

export const runtime = "nodejs";

/** Topics in one class, for filing the post. */
export async function GET(request: NextRequest) {
  const teacher = await teacherForRequest(request);
  if (!teacher) return unauthorized();
  const course = request.nextUrl.searchParams.get("course") ?? "";
  if (!/^[\w-]{1,64}$/.test(course)) return teacher.respond(NextResponse.json({ ok: false, reason: "invalid", message: "Unknown class." }, { status: 400 }));
  return withGoogle(request, teacher, (token) => listTopics(token, course));
}
