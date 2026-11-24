import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { AiError, completeStream, writtenSoFar } from "@/lib/ai/server";
import { kindForFile, ownsPath, safeFileName, sourcePath } from "@/lib/sources/model";

/* ---------- chapter sources ---------- */

const TEACHER = "11111111-1111-4111-8111-111111111111";
const CHAPTER = "22222222-2222-4222-8222-222222222222";
const RANDOM = "33333333-3333-4333-8333-333333333333";

test("a source file is stored under the teacher's own folder, with a safe name", () => {
  assert.equal(safeFileName("Unit 3 notes (final).PDF"), "Unit-3-notes-final.pdf");
  const climbing = safeFileName("../../etc/passwd");
  assert.ok(!climbing.includes("/") && !climbing.includes("\\") && !climbing.includes(".."), "no folders or climbing out");
  assert.equal(safeFileName("élan—vital.md"), "elanvital.md");
  assert.equal(safeFileName(".pdf"), "pdf");
  const path = sourcePath(TEACHER, CHAPTER, "Unit 3 notes.pdf", RANDOM);
  assert.equal(path, `${TEACHER}/${CHAPTER}/${RANDOM}-Unit-3-notes.pdf`);
  assert.equal(ownsPath(path, TEACHER, CHAPTER), true);
});

test("the server accepts only paths in the teacher's own folder for that chapter", () => {
  const path = sourcePath(TEACHER, CHAPTER, "notes.pdf", RANDOM);
  assert.equal(ownsPath(path, "44444444-4444-4444-8444-444444444444", CHAPTER), false, "another teacher's folder");
  assert.equal(ownsPath(path, TEACHER, "55555555-5555-4555-8555-555555555555"), false, "another chapter");
  assert.equal(ownsPath(`${TEACHER}/${CHAPTER}/../x.pdf`, TEACHER, CHAPTER), false, "no climbing out");
  assert.equal(ownsPath(`${TEACHER}/${CHAPTER}/x/y.pdf`, TEACHER, CHAPTER), false, "no sub-folders");
});

test("a PDF is filed as a PDF, anything else as notes", () => {
  assert.equal(kindForFile("Exam.PDF"), "pdf");
  assert.equal(kindForFile("notes.md"), "notes");
});

/* ---------- streamed drafts ---------- */

const realFetch = globalThis.fetch;
const env = { ...process.env };
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

function useGemini() {
  for (const k of ["FUNZA_AI_PROVIDER", "FUNZA_AI_API_KEY", "FUNZA_AI_MODEL", "GROQ_API_KEY", "OPENROUTER_API_KEY"]) delete process.env[k];
  process.env.GEMINI_API_KEY = "gemini-secret-key";
}

/** A Gemini server-sent-event stream, split across network chunks at awkward places. */
function fakeStream(events: object[], seen: { url?: string; init?: RequestInit } = {}) {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join("");
  const chunks = [text.slice(0, 7), text.slice(7, 60), text.slice(60)];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    seen.url = String(url);
    seen.init = init;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
        c.close();
      },
    });
    return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  }) as typeof fetch;
  return seen;
}

const ask = { system: "s", user: "u", maxTokens: 100 };

test("a streamed Gemini draft reports its text as it grows, then the whole reply and its tokens", async () => {
  useGemini();
  const seen = fakeStream([
    { candidates: [{ content: { parts: [{ text: '{"items":[{"type":"mcq","prompt":"One"},' }] } }] },
    { candidates: [{ content: { parts: [{ text: '{"type":"tf","prompt":"Two"}]}' }] }, finishReason: "STOP" }], modelVersion: "gemini-2.5-flash-001", usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 20, thoughtsTokenCount: 5 } },
  ]);
  const seenText: string[] = [];
  const out = await completeStream(ask, (t) => seenText.push(t));
  assert.match(seen.url ?? "", /:streamGenerateContent\?alt=sse$/);
  assert.equal(new Headers(seen.init?.headers).get("x-goog-api-key"), "gemini-secret-key", "the key goes in a header");
  assert.equal(seenText.length, 2);
  assert.equal(writtenSoFar(seenText[0], "items"), 1);
  assert.equal(out.text, '{"items":[{"type":"mcq","prompt":"One"},{"type":"tf","prompt":"Two"}]}');
  assert.deepEqual([out.model, out.tokensIn, out.tokensOut], ["gemini-2.5-flash-001", 30, 25]);
});

test("a streamed reply that is cut off or declined fails like a plain one", async () => {
  useGemini();
  fakeStream([{ candidates: [{ content: { parts: [{ text: '{"items":[' }] }, finishReason: "MAX_TOKENS" }] }]);
  await assert.rejects(completeStream(ask, () => {}), (e: unknown) => e instanceof AiError && e.code === "truncated");
  fakeStream([{ promptFeedback: { blockReason: "OTHER" } }]);
  await assert.rejects(completeStream(ask, () => {}), (e: unknown) => e instanceof AiError && e.code === "refused");
  fakeStream([{ candidates: [{ finishReason: "STOP" }] }]);
  await assert.rejects(completeStream(ask, () => {}), (e: unknown) => e instanceof AiError && e.code === "empty");
});

test("progress counts started questions or sections, never content", () => {
  assert.equal(writtenSoFar('{"items":[{"prompt":"a"},{"prompt" : "b', "items"), 2);
  assert.equal(writtenSoFar('{"sections":[{"title":"x","body":"y"},{"title":"z","body":', "sections"), 2);
  assert.equal(writtenSoFar("", "items"), 0);
});
