import { NextResponse, type NextRequest } from "next/server";
import { listTopics } from "@/lib/lms/google";
import { withGoogle } from "@/lib/lms/route";

export const runtime = "nodejs";

/** Topics in one class, for filing the post. */
export async function GET(request: NextRequest) {
  const course = request.nextUrl.searchParams.get("course") ?? "";
  if (!/^[\w-]{1,64}$/.test(course)) return NextResponse.json({ ok: false, reason: "invalid", message: "Unknown class." }, { status: 400 });
  return withGoogle(request, (token) => listTopics(token, course));
}
