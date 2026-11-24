import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { makeRequest, restoreFetch, sessionCookies, setTestEnv, stubAuth, SUPABASE_URL, TEACHER_A } from "./helpers/auth";

/*
 * Templates: "Read the format" on /api/teach (task "template-read"). It passes the
 * daily allowance, is logged as template-read, sends the examples only inside
 * their data tags, and never needs a brief.
 */

const AI_BASE = "https://ai.test/v1";
setTestEnv();
process.env.SUPABASE_SECRET_KEY = "sb_secret_madeUpForTests0000";
const env = { ...process.env };
beforeEach(() => {
  process.env = { ...env };
  for (const k of ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "FUNZA_AI_MODEL", "FUNZA_AI_DAILY_LIMIT"]) delete process.env[k];
  Object.assign(process.env, { FUNZA_AI_PROVIDER: "groq", FUNZA_AI_API_KEY: "test-key", FUNZA_AI_BASE_URL: AI_BASE });
});
afterEach(() => {
  restoreFetch();
  process.env = { ...env };
});

type Fake = { used: number; inserts: Record<string, unknown>[]; aiBodies: string[]; aiReply: unknown };

function stubServices(fake: Fake) {
  stubAuth([TEACHER_A]);
  const auth = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(`${SUPABASE_URL}/rest/v1/ai_usage`)) {
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": `*/${fake.used}` } });
      if (init?.method === "POST") {
        fake.inserts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response(null, { status: 201 });
      }
    }
    if (url === `${AI_BASE}/chat/completions`) {
      fake.aiBodies.push(String(init?.body));
      const reply = { model: "test-model-1", choices: [{ message: { content: typeof fake.aiReply === "string" ? fake.aiReply : JSON.stringify(fake.aiReply) }, finish_reason: "stop" }], usage: { prompt_tokens: 300, completion_tokens: 90 } };
      return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } });
    }
    return auth(input, init);
  }) as typeof fetch;
}

const REPLY = {
  name: "Unit test, three parts",
  summary: "Multiple choice, short answer, then extended response.",
  format: { sections: [{ title: "Part A: Multiple choice", instructions: "Choose the best answer.", rows: [{ type: "mcq", count: 10, marks: 1 }] }], duration: 60, difficulty: "balanced", extras: { answerKey: true, workedSolutions: false, rubric: true }, style: { wording: [], numbering: "continuous", marksShown: "brackets", cover: null } },
};
const EXAMPLE = "PART A MULTIPLE CHOICE (10 marks)\n1. Which of the following best describes a closed system at equilibrium in the lab?";

async function read(cookies: Record<string, string>, body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/teach/route");
  const res = await POST(makeRequest("/api/teach", { method: "POST", cookies, headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ task: "template-read", ...body }) }));
  return { status: res.status, json: (await res.json()) as { ok: boolean; reason?: string; message?: string; data?: { name: string; format: { category: string; sections: unknown[] }; provider: string } } };
}

test("Read the format needs no brief, sends the example only inside its tag, and is logged as template-read", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  const db: Fake = { used: 0, inserts: [], aiBodies: [], aiReply: REPLY };
  stubServices(db);
  const { status, json } = await read(cookies, { category: "exam", examples: [{ name: "midterm.pdf", text: EXAMPLE }] });
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.data?.name, "Unit test, three parts");
  assert.equal(json.data?.format.category, "exam");
  assert.equal(json.data?.provider, "groq");
  const sent = JSON.parse(db.aiBodies[0]) as { messages: { role: string; content: string }[] };
  const user = sent.messages.find((m) => m.role === "user")?.content ?? "";
  const inside = user.slice(user.indexOf('<example name="midterm.pdf">'), user.indexOf("</example>"));
  assert.ok(inside.includes("Which of the following best describes"), "the example is inside its tag");
  assert.equal(user.split("Which of the following best describes").length, 2, "and nowhere else");
  assert.equal(db.inserts.length, 1);
  assert.equal(db.inserts[0].task, "template-read");
  assert.equal(JSON.stringify(db.inserts[0]).includes("equilibrium"), false, "the example text is not logged");
});

test("Read the format is refused when today's allowance is used up, before the AI is called", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  process.env.FUNZA_AI_DAILY_LIMIT = "2";
  const db: Fake = { used: 2, inserts: [], aiBodies: [], aiReply: REPLY };
  stubServices(db);
  const { json } = await read(cookies, { category: "exam", examples: [{ name: "midterm.pdf", text: EXAMPLE }] });
  assert.equal(json.reason, "allowance");
  assert.equal(db.aiBodies.length, 0);
});

test("a request without a usable example is refused, and a reply with no format is reported", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  const db: Fake = { used: 0, inserts: [], aiBodies: [], aiReply: { name: "x", format: { sections: [] } } };
  stubServices(db);
  const empty = await read(cookies, { category: "exam", examples: [{ name: "a.pdf", text: "hi" }] });
  assert.equal(empty.status, 400);
  assert.equal(db.aiBodies.length, 0);
  const bad = await read(cookies, { category: "exam", description: "Section A: 20 multiple choice, 1 mark each." });
  assert.equal(bad.json.ok, false);
  assert.equal(bad.json.reason, "invalid-response");
  assert.equal(db.inserts[0]?.task, "template-read", "the call still counts: its tokens were spent");
});
