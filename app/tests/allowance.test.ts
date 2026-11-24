import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { allowanceMessage, dailyLimit, DEFAULT_DAILY_LIMIT, startOfDaySaskatchewan } from "@/lib/ai/allowance";
import { defaultBrief } from "@/lib/resources/kinds";
import { makeRequest, restoreFetch, sessionCookies, setTestEnv, stubAuth, SUPABASE_URL, TEACHER_A } from "./helpers/auth";
import { loadDataset } from "@/lib/curriculum/dataset";

// Outcomes come from the imported dataset, as on the server.
loadDataset();

/*
 * Development step 4: the daily AI allowance (FR-30). Each teacher gets
 * FUNZA_AI_DAILY_LIMIT AI actions a day, counted in ai_usage from midnight in
 * Saskatchewan (UTC−6 all year). Only finished AI calls are logged.
 */

const AI_BASE = "https://ai.test/v1";

setTestEnv();
process.env.SUPABASE_SECRET_KEY = "sb_secret_madeUpForTests0000";
const env = { ...process.env };
beforeEach(() => {
  process.env = { ...env };
  for (const k of ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "FUNZA_AI_MODEL", "FUNZA_AI_DAILY_LIMIT"]) delete process.env[k];
  // An OpenAI-compatible test double stands in for the AI provider.
  Object.assign(process.env, { FUNZA_AI_PROVIDER: "groq", FUNZA_AI_API_KEY: "test-key", FUNZA_AI_BASE_URL: AI_BASE });
});
afterEach(() => {
  restoreFetch();
  process.env = { ...env };
});

/* ---------- the day and the limit ---------- */

test("a Saskatchewan day starts at 06:00 UTC, all year", () => {
  assert.equal(startOfDaySaskatchewan(new Date("2026-11-24T05:59:00Z")).toISOString(), "2026-11-23T06:00:00.000Z", "a minute before midnight is still the 23rd");
  assert.equal(startOfDaySaskatchewan(new Date("2026-11-24T06:00:00Z")).toISOString(), "2026-11-24T06:00:00.000Z", "midnight starts the 24th");
  assert.equal(startOfDaySaskatchewan(new Date("2026-11-24T23:30:00Z")).toISOString(), "2026-11-24T06:00:00.000Z");
  assert.equal(startOfDaySaskatchewan(new Date("2026-07-01T05:00:00Z")).toISOString(), "2026-06-30T06:00:00.000Z", "no daylight saving time in summer");
});

test("the daily limit is 40 unless FUNZA_AI_DAILY_LIMIT sets another whole number", () => {
  assert.equal(DEFAULT_DAILY_LIMIT, 40);
  assert.equal(dailyLimit(), 40);
  process.env.FUNZA_AI_DAILY_LIMIT = "12";
  assert.equal(dailyLimit(), 12);
  process.env.FUNZA_AI_DAILY_LIMIT = "  ";
  assert.equal(dailyLimit(), 40, "blank counts as unset");
  for (const bad of ["lots", "0", "-3", "2.5"]) {
    process.env.FUNZA_AI_DAILY_LIMIT = bad;
    assert.equal(dailyLimit(), 40, `"${bad}" falls back to the default`);
  }
});

test("the refusal says how many and when they reset", () => {
  assert.equal(allowanceMessage(40), "You’ve used today’s 40 Funza actions. They reset at midnight, Saskatchewan time.");
});

/* ---------- /api/teach ---------- */

const FM2 = "sk-63-110477";
const ITEM = { type: "mcq", prompt: "Which is faster?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctId: "a", difficulty: "grade", outcomeIds: [FM2], verbs: [], solution: "Steeper." };

type Fake = { used: number | "down"; aiStatus?: number; counts: string[]; inserts: Record<string, unknown>[]; aiCalls: number; aiReply?: unknown; aiBodies?: string[] };

/** Supabase Auth (from the shared helper), the ai_usage table, and the AI provider, all offline. */
function stubServices(fake: Fake) {
  stubAuth([TEACHER_A]);
  const auth = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(`${SUPABASE_URL}/rest/v1/ai_usage`)) {
      if (init?.method === "HEAD") {
        fake.counts.push(decodeURIComponent(url));
        if (fake.used === "down") return new Response(JSON.stringify({ message: "database unavailable" }), { status: 500 });
        return new Response(null, { status: 200, headers: { "content-range": `*/${fake.used}` } });
      }
      if (init?.method === "POST") {
        fake.inserts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response(null, { status: 201 });
      }
    }
    if (url === `${AI_BASE}/chat/completions`) {
      fake.aiCalls++;
      fake.aiBodies?.push(String(init?.body));
      if (fake.aiStatus) return new Response("busy", { status: fake.aiStatus });
      const reply = { model: "test-model-1", choices: [{ message: { content: JSON.stringify(fake.aiReply ?? { item: ITEM }) }, finish_reason: "stop" }], usage: { prompt_tokens: 120, completion_tokens: 45 } };
      return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } });
    }
    return auth(input, init);
  }) as typeof fetch;
}

const fake = (used: Fake["used"], extra: Partial<Fake> = {}): Fake => ({ used, counts: [], inserts: [], aiCalls: 0, ...extra });

async function regenerate(cookies: Record<string, string>) {
  const { POST } = await import("@/app/api/teach/route");
  const body = { task: "resource-item", type: "mcq", marks: 1, brief: defaultBrief("quiz", [FM2]) };
  const res = await POST(makeRequest("/api/teach", { method: "POST", cookies, headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) }));
  return { status: res.status, json: (await res.json()) as { ok: boolean; reason?: string; message?: string; data?: { provider: string } } };
}

async function status(cookies: Record<string, string>) {
  const { GET } = await import("@/app/api/teach/route");
  return (await GET(makeRequest("/api/teach", { cookies }))).json();
}

/** Runs `fn` with console.error silenced, for the paths that log a server-side error on purpose. */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
}

test("a teacher who has used today's allowance is refused before the AI is called", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  process.env.FUNZA_AI_DAILY_LIMIT = "3";
  const db = fake(3);
  stubServices(db);
  const { status: code, json } = await regenerate(cookies);
  assert.equal(code, 200);
  assert.deepEqual(json, { ok: false, reason: "allowance", message: "You’ve used today’s 3 Funza actions. They reset at midnight, Saskatchewan time." });
  assert.equal(db.aiCalls, 0, "nothing was sent to the AI");
  assert.deepEqual(db.inserts, [], "a refusal is not logged");
  assert.equal(db.counts.length, 1);
  assert.match(db.counts[0], new RegExp(`teacher_id=eq\\.${TEACHER_A.id}`), "only this teacher's rows count");
  assert.match(db.counts[0], /created_at=gte\.\d{4}-\d{2}-\d{2}T06:00:00\.000Z/, "counted from midnight in Saskatchewan");
});

test("under the limit, the call goes through and is logged with its model and tokens", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  process.env.FUNZA_AI_DAILY_LIMIT = "3";
  const db = fake(2);
  stubServices(db);
  const { json } = await regenerate(cookies);
  assert.equal(json.ok, true, json.message);
  assert.equal(json.data?.provider, "groq");
  assert.equal(db.aiCalls, 1);
  assert.deepEqual(db.inserts, [{ teacher_id: TEACHER_A.id, task: "resource-item", model: "test-model-1", tokens_in: 120, tokens_out: 45 }]);
});

test("a failed AI call is not counted", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  const db = fake(0, { aiStatus: 429 });
  stubServices(db);
  const { json } = await quietly(() => regenerate(cookies));
  assert.equal(json.reason, "rate-limit");
  assert.equal(db.aiCalls, 1);
  assert.deepEqual(db.inserts, []);
});

test("if today's usage can't be read, nothing is sent to the AI", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  const db = fake("down");
  stubServices(db);
  const { json } = await quietly(() => regenerate(cookies));
  assert.equal(json.ok, false);
  assert.equal(json.reason, "allowance-unavailable");
  assert.match(json.message ?? "", /allowance/);
  assert.equal(db.aiCalls, 0);
});

test("GET tells a signed-in teacher how many actions are left today", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  stubServices(fake(15));
  assert.deepEqual(await status(cookies), { configured: true, provider: "groq", remaining: 25 });
  stubServices(fake(52));
  assert.deepEqual(await status(cookies), { configured: true, provider: "groq", remaining: 0 }, "never below 0");
  stubServices(fake("down"));
  assert.deepEqual(await quietly(() => status(cookies)), { configured: true, provider: "groq", remaining: null }, "unknown when the database can't say");
});

/* ---------- Live mode: "Funza suggests" (development step 5) ---------- */

test("Funza's live suggestions ask only for phone types, avoid the set's questions, and are logged as live-suggest", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  const fill = { type: "fill", prompt: "Speed is ______.", answer: "distance over time", difficulty: "grade", outcomeIds: [FM2], verbs: [], solution: "" };
  const db = fake(0, { aiReply: { items: [ITEM, fill] }, aiBodies: [] });
  stubServices(db);
  const { POST } = await import("@/app/api/teach/route");
  const body = { task: "live-suggest", brief: defaultBrief("quiz", [FM2]), avoid: ["Which force keeps a puck sliding?"] };
  const res = await POST(makeRequest("/api/teach", { method: "POST", cookies, headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) }));
  const json = (await res.json()) as { ok: boolean; data: { sections: { items: { type: string }[] }[] } };
  assert.equal(json.ok, true);
  assert.deepEqual(json.data.sections.flatMap((sec) => sec.items.map((i) => i.type)), ["mcq"], "a fill-in question in the reply is dropped");
  const prompt = db.aiBodies?.[0] ?? "";
  assert.match(prompt, /answered on students' phones/);
  assert.match(prompt, /Which force keeps a puck sliding\?/);
  assert.equal(/fill-in|Matching/i.test(prompt.split("Questions:")[1]?.split("Item shapes")[0] ?? ""), false, "no fill-in or matching questions are asked for");
  assert.equal(db.inserts[0]?.task, "live-suggest");
});

test("/api/teach refuses a draft request from another site", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  stubServices(fake(0));
  const { POST } = await import("@/app/api/teach/route");
  const res = await POST(makeRequest("/api/teach", { method: "POST", cookies, headers: { origin: "https://evil.example", "content-type": "text/plain" }, body: JSON.stringify({ task: "resource-draft", brief: defaultBrief("quiz", [FM2]) }) }));
  assert.equal(res.status, 403);
});
