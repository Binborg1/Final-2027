import { NextResponse, type NextRequest } from "next/server";
import { teacherForRequest } from "@/lib/auth/api";
import { studentCopy } from "@/lib/resources/student-copy";

export const runtime = "nodejs";

const PAGE = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
  body { margin: 0; background: #f6f1ea; font-family: Arial, sans-serif; }
  .bar { position: sticky; top: 0; display: flex; gap: 12px; align-items: center; padding: 12px 20px; background: #fff; border-bottom: 1px solid #e5dccf; font-size: 14px; color: #5e5046; }
  .bar button { margin-left: auto; height: 40px; padding: 0 20px; border: 0; border-radius: 999px; background: #c8501e; color: #fff; font-weight: 600; font-size: 14px; cursor: pointer; }
  .page { max-width: 760px; margin: 24px auto; padding: 48px 56px; background: #fff; box-shadow: 0 8px 24px rgb(58 36 20 / 0.08); }
  @media print { body { background: #fff; } .bar { display: none; } .page { margin: 0; padding: 0; box-shadow: none; max-width: none; } }
</style></head><body>${body}</body></html>`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The student copy, ready to print or save as a PDF from the browser's print
 * dialog. Built on the server from the saved, approved version (as for Classroom);
 * answers and keys are never on it.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await teacherForRequest(request);
  if (!teacher) return NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent(`/make/${id}`)}`, request.url));
  // ?v=N prints that approved version (from the Library); without it, the current version.
  const v = Number(request.nextUrl.searchParams.get("v"));
  const copy = await studentCopy(teacher.supabase, teacher.id, id, Number.isInteger(v) && v > 0 ? v : undefined);
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  if (!copy.ok) {
    return teacher.respond(new NextResponse(PAGE("Can’t print", `<div class="page"><h1>Can’t print this yet</h1><p>${esc(copy.message)}</p></div>`), { status: copy.status, headers }));
  }
  const inner = copy.html.replace(/^[\s\S]*<body[^>]*>/, "").replace(/<\/body>[\s\S]*$/, "");
  const bar = `<div class="bar">Student copy · v${copy.version} · no answers or keys<button type="button" onclick="window.print()">Print or save as PDF</button></div>`;
  return teacher.respond(new NextResponse(PAGE(esc(copy.title), `${bar}<div class="page" style="font-size:11pt">${inner}</div>`), { headers }));
}
