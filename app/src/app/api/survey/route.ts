import { timingSafeEqual } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { sanitizeAnswers, sanitizeParticipant, toCsv, type SurveyResponse } from "@/lib/survey/questionnaire";

export const runtime = "nodejs";

/**
 * The usability questionnaire's store.
 *   POST { participant?, answers }  saves one sanitized response as a private blob.
 *   GET ?key=SURVEY_ADMIN_KEY        downloads every response as CSV (add &format=json for JSON).
 * Responses hold no names or emails unless a participant types one into a free-text box.
 */

const PREFIX = "responses/";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

function keyMatches(given: string | null): boolean {
  const expected = process.env.SURVEY_ADMIN_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json({ ok: false, reason: "not-configured", message: "Response storage is not set up on the server. Please use a paper copy." });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, reason: "bad-request", message: "Invalid JSON." }, 400);
  }
  const answers = sanitizeAnswers(body.answers);
  if (!answers) return json({ ok: false, reason: "bad-request", message: "Answer at least one question before sending." }, 400);
  const response: SurveyResponse = {
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    participant: sanitizeParticipant(body.participant),
    answers,
  };
  try {
    const name = `${PREFIX}${response.submittedAt.replace(/[:.]/g, "-")}-${response.id.slice(0, 8)}.json`;
    await put(name, JSON.stringify(response), { access: "private", contentType: "application/json", addRandomSuffix: false });
    return json({ ok: true, id: response.id });
  } catch (error) {
    console.error("Survey store failed:", error instanceof Error ? error.message : "unknown error");
    return json({ ok: false, reason: "storage", message: "Your answers could not be saved. Please try again, or ask for a paper copy." }, 500);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!keyMatches(url.searchParams.get("key"))) return json({ ok: false, reason: "unauthorized", message: "A valid key is required." }, 401);
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json({ ok: false, reason: "not-configured", message: "Response storage is not set up on the server." });
  const responses = await loadAll();
  if (url.searchParams.get("format") === "json") return json({ ok: true, count: responses.length, responses });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(responses), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="funza-survey-${stamp}.csv"`, "Cache-Control": "no-store" },
  });
}

async function loadAll(): Promise<SurveyResponse[]> {
  const out: SurveyResponse[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      const result = await get(blob.pathname, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) continue;
      try {
        const parsed = JSON.parse(await new Response(result.stream).text()) as SurveyResponse;
        if (parsed && typeof parsed === "object" && parsed.answers) out.push(parsed);
      } catch {
        // a damaged file is skipped, not fatal
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}
