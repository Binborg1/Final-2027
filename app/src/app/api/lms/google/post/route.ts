import { NextResponse, type NextRequest } from "next/server";
import { createPost } from "@/lib/lms/google";
import { withGoogle } from "@/lib/lms/route";
import { sameOrigin } from "@/lib/origin";
import { isObject, str } from "@/lib/resources/sanitize";

export const runtime = "nodejs";

const refuse = (message: string, status = 400) => NextResponse.json({ ok: false, reason: "invalid", message }, { status });

/** Creates one post (material or assignment) in one class with the Doc attached view-only. Drafts unless told otherwise. */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return refuse("Cross-site request refused.", 403);
  const b = (await request.json().catch(() => null)) as unknown;
  if (!isObject(b)) return refuse("Invalid request.");
  const courseId = str(b.courseId, 64);
  const fileId = str(b.fileId, 128);
  const title = str(b.title, 160);
  if (!/^[\w-]+$/.test(courseId) || !/^[\w-]+$/.test(fileId) || !title) return refuse("Missing class, file or title.");
  const scheduledTime = typeof b.scheduledTime === "string" && !Number.isNaN(Date.parse(b.scheduledTime)) ? new Date(b.scheduledTime).toISOString() : undefined;
  const topicId = typeof b.topicId === "string" && /^[\w-]{1,64}$/.test(b.topicId) ? b.topicId : undefined;
  return withGoogle(request, (token) =>
    createPost(token, courseId, {
      kind: b.kind === "assignment" ? "assignment" : "material",
      title,
      description: str(b.description, 2000),
      fileId,
      state: b.state === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      topicId,
      scheduledTime,
    }),
  );
}
