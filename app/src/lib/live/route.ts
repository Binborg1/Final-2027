import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { teacherForRequest, unauthorized, type ApiTeacher } from "@/lib/auth/api";
import { recordUsage, remainingToday } from "@/lib/ai/allowance";
import { AiError, aiConfig, complete } from "@/lib/ai/server";
import { crossSite, sameOrigin } from "@/lib/origin";
import type { MarkDeps } from "@/lib/live/handlers/mark";
import type { PhoneRequest } from "@/lib/live/handlers/phone";
import { err, UUID, type Deps, type Result } from "@/lib/live/handlers/result";
import type { TeacherDeps } from "@/lib/live/handlers/teacher";
import { ping } from "@/lib/live/ping";
import { phoneStore, teacherStore } from "@/lib/live/store-supabase";

/**
 * Glue between the live route files and the handlers: builds each handler's
 * dependencies (store, clock, pings), checks the teacher and the request's site,
 * and turns a handler's result into a response that is never cached.
 */

export function toResponse(r: Result): NextResponse {
  return NextResponse.json(r.body, { status: r.status, headers: { ...r.headers, "Cache-Control": "no-store" } });
}

const failed = (error: unknown) => {
  console.error("Live request failed:", error instanceof Error ? error.message : "unknown error");
  return err(500, "server", "Something went wrong. Try again.");
};

export const readJson = (request: NextRequest): Promise<unknown> => request.json().catch(() => null);

/* ---------- phones ---------- */

export const phoneRequest = (request: NextRequest): PhoneRequest => ({ headers: request.headers, url: request.url, crossSite: crossSite(request) });

export async function phoneRoute(handler: (deps: Deps) => Promise<Result>): Promise<NextResponse> {
  try {
    return toResponse(await handler({ store: phoneStore(), now: Date.now, ping }));
  } catch (error) {
    return toResponse(failed(error));
  }
}

/* ---------- teachers ---------- */

export const joinOrigin = (request: NextRequest) => new URL(request.url).origin;

/** Runs a teacher handler for /api/live/[id]/…: signed in (401), same site for POSTs (403), a valid id (404). */
export async function teacherRoute(
  request: NextRequest,
  params: Promise<{ id: string }> | null,
  handler: (deps: TeacherDeps, id: string, teacher: ApiTeacher) => Promise<Result>,
): Promise<NextResponse> {
  const teacher = await teacherForRequest(request);
  if (!teacher) return unauthorized();
  if (request.method !== "GET" && !sameOrigin(request)) return teacher.respond(toResponse(err(403, "forbidden", "Cross-site request refused.")));
  const id = params ? (await params).id.toLowerCase() : "";
  if (params && !UUID.test(id)) return teacher.respond(toResponse(err(404, "not-found", "That live session wasn't found.")));
  try {
    const deps: TeacherDeps = { store: teacherStore(teacher.supabase), now: Date.now, ping, teacherId: teacher.id, randomInt: (max) => randomInt(max) };
    return teacher.respond(toResponse(await handler(deps, id, teacher)));
  } catch (error) {
    return teacher.respond(toResponse(failed(error)));
  }
}

/** The AI and the allowance for marking short answers, with the server's real providers. */
export function markDeps(deps: TeacherDeps): MarkDeps {
  return {
    ...deps,
    ai: {
      configured: () => aiConfig() !== null,
      complete: (input) => complete(input),
      isBusy: (e) => e instanceof AiError && (e.code === "rate-limit" || e.code === "timeout"),
      describe: (e) => (e instanceof AiError ? e.message : ""),
    },
    allowance: {
      remaining: () => remainingToday(deps.teacherId),
      record: (call) => recordUsage({ teacherId: deps.teacherId, task: "live-mark", model: call.model, tokensIn: call.tokensIn ?? 0, tokensOut: call.tokensOut ?? 0 }),
    },
    randomId: () => randomBytes(3).toString("hex"),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}
