import type { NextRequest } from "next/server";
import { teacherForRequest, unauthorized } from "@/lib/auth/api";
import { listCourses } from "@/lib/lms/google";
import { withGoogle } from "@/lib/lms/route";

export const runtime = "nodejs";

/** The teacher's active Classroom classes. */
export async function GET(request: NextRequest) {
  const teacher = await teacherForRequest(request);
  if (!teacher) return unauthorized();
  return withGoogle(request, teacher, (token) => listCourses(token));
}
