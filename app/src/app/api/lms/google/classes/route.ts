import type { NextRequest } from "next/server";
import { listCourses } from "@/lib/lms/google";
import { withGoogle } from "@/lib/lms/route";

export const runtime = "nodejs";

/** The teacher's active Classroom classes. */
export async function GET(request: NextRequest) {
  return withGoogle(request, (token) => listCourses(token));
}
