import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { resourcePrompt, type PromptOutcome } from "@/lib/ai/resource-prompts";
import { loadDataset } from "@/lib/curriculum/dataset";
import { validateResourceReply } from "@/lib/resources/ai-reply";
import { blankDraft } from "@/lib/resources/assemble";
import { defaultBrief } from "@/lib/resources/kinds";
import { sanitizeBrief } from "@/lib/resources/sanitize";
import type { Brief, Item } from "@/lib/resources/types";
import { aiLayout, applyTemplate, fittingPins, type TemplateChoice } from "@/lib/templates/apply";
import { sanitizeFormat, type QuestionFormat, type TemplateFormat, type TemplatePin } from "@/lib/templates/model";
import { pinsOf } from "@/lib/templates/pins";
import { makeRequest, restoreFetch, sessionCookies, setTestEnv, stubAuth, SUPABASE_URL, TEACHER_A } from "./helpers/auth";

/*
 * Pinned questions (T4): a bank question pinned to a section of a template goes into
 * every material made from it, unchanged; Funza writes the rest of that section.
 */

loadDataset();
const FM2 = "sk-63-110477";
const T1 = "11111111-2222-4333-8444-555555555555";
const Q1 = "aaaaaaaa-1111-4222-8333-444444444444";
const OUTCOMES: PromptOutcome[] = [{ id: FM2, code: "FM2", statement: "Investigate the relationships among displacement, velocity and time.", course: "Science 10", unit: "Force and Motion" }];

const EXAM = sanitizeFormat("exam", {
  sections: [
    { title: "Part A: Multiple choice", instructions: "Choose the best answer.", rows: [{ type: "mcq", count: 2, marks: 1 }] },
    { title: "Part B: Written response", instructions: "Show your work.", rows: [{ type: "short", count: 2, marks: 4 }] },
  ],
  duration: 60,
}) as TemplateFormat;

const BANK_ROW = { id: Q1, type: "short", stem: "Describe what a horizontal line on a position-time graph shows.", options: null, answer: { rubric: [{ text: "Object at rest", marks: 3 }] }, marks: 3, outcome_ref: FM2 };
const PIN: TemplatePin = pinsOf([{ section: 1, position: 0, questions: BANK_ROW }])[0];
const choice = (pins: TemplatePin[]): TemplateChoice => ({ id: T1, category: "exam", name: "Unit test", format: EXAM, pins });

const MCQ = (n: number, section?: number) => ({ type: "mcq", section, prompt: `Which is faster, ${n}?`, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctId: "a", difficulty: "grade", outcomeIds: [FM2], verbs: [], solution: "Steeper." });
const SHORT = (section?: number) => ({ type: "short", section, prompt: "Explain what a steep line shows.", rubric: [{ text: "Fast", marks: 4 }], difficulty: "grade", outcomeIds: [FM2], verbs: [], solution: "Fast." });

test("a stored pin becomes the bank question, unchanged, in its section", () => {
  assert.equal(PIN.section, 1);
  assert.equal(PIN.item.prompt, BANK_ROW.stem);
  assert.equal(PIN.item.marks, 3, "a pinned question keeps its own marks");
  assert.equal(PIN.item.origin, "bank");
  assert.equal(PIN.item.id, `pin-${Q1}`);
  assert.deepEqual(pinsOf([{ section: 0, position: 0, questions: null }, "junk"]), []);
});

test("only pins that still fit the layout are used; Funza writes what is left", () => {
  const wrongType = { ...PIN, section: 0 };
  const tooMany = [PIN, { ...PIN, questionId: "x", item: { ...PIN.item, id: "pin-x" } }, { ...PIN, questionId: "y", item: { ...PIN.item, id: "pin-y" } }];
  assert.deepEqual(fittingPins((EXAM as QuestionFormat).sections, [wrongType]), [], "a short-answer pin can't go in a multiple-choice section");
  assert.equal(fittingPins((EXAM as QuestionFormat).sections, tooMany).length, 2, "no more pins than the section's count");
  const b = applyTemplate(defaultBrief("exam", [FM2]), choice([PIN, wrongType]));
  assert.equal(b.pinned?.length, 1);
  assert.deepEqual(aiLayout(b.layout!, b.pinned).map((s) => s.rows.map((r) => r.count)), [[2], [1]]);
});

test("the prompt asks Funza only for the rest, and names the pinned question so it isn't repeated", () => {
  const b = applyTemplate(defaultBrief("exam", [FM2]), choice([PIN]));
  const { user } = resourcePrompt(b, OUTCOMES, { name: "Unit test", style: EXAM.style, perSlide: null });
  assert.match(user, /Section 2: "Part B: Written response"[^\n]*\n- short \(Short answer\): exactly 1, each worth 4 marks\nAlready in this section, the teacher's own question \(don't write it again\):\n\* Describe what a horizontal line/);
});

test("the draft has the pinned question first in its section, and Funza's around it", () => {
  const b = applyTemplate(defaultBrief("exam", [FM2]), choice([PIN]));
  const { sections } = validateResourceReply(b, { items: [MCQ(1, 1), MCQ(2, 1), SHORT(2), SHORT(2)] });
  assert.deepEqual(sections[1].items.map((i: Item) => i.prompt), [BANK_ROW.stem, "Explain what a steep line shows."], "one written by Funza, the extra dropped");
  assert.equal(sections[1].items[0].marks, 3);
  const blank = blankDraft(b, "r1");
  assert.equal(blank.sections[1].items[0].prompt, BANK_ROW.stem);
  assert.equal(blank.sections[1].items.length, 2);
});

test("pins travel in the brief, cleaned, only with a template", () => {
  const b = applyTemplate(defaultBrief("exam", [FM2]), choice([PIN]));
  const back = sanitizeBrief(JSON.parse(JSON.stringify(b)))!;
  assert.equal(back.pinned?.[0].item.prompt, BANK_ROW.stem);
  assert.equal(sanitizeBrief({ ...b, templateId: null })!.pinned, null);
});

/* ---------- the server uses the stored pins ---------- */

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

test("a draft from a template includes the stored pins, not ones the browser sends", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  const prompts: string[] = [];
  stubAuth([TEACHER_A]);
  const auth = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(`${SUPABASE_URL}/rest/v1/templates`)) return new Response(JSON.stringify([{ id: T1, kind: "exam", name: "Unit test", format: EXAM, template_pins: [{ section: 1, position: 0, questions: BANK_ROW }] }]), { status: 200, headers: { "content-type": "application/json" } });
    if (url.startsWith(`${SUPABASE_URL}/rest/v1/ai_usage`)) return init?.method === "HEAD" ? new Response(null, { status: 200, headers: { "content-range": "*/0" } }) : new Response(null, { status: 201 });
    if (url === `${AI_BASE}/chat/completions`) {
      prompts.push(String(init?.body));
      const content = JSON.stringify({ items: [MCQ(1, 1), MCQ(2, 1), SHORT(2)] });
      return new Response(JSON.stringify({ model: "m", choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return auth(input, init);
  }) as typeof fetch;
  const forged: Brief = { ...applyTemplate(defaultBrief("exam", [FM2]), choice([])), pinned: [{ section: 1, item: { ...PIN.item, prompt: "FORGED PIN" } }] };
  const { POST } = await import("@/app/api/teach/route");
  const res = await POST(makeRequest("/api/teach", { method: "POST", cookies, headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ task: "resource-draft", brief: forged }) }));
  const json = (await res.json()) as { ok: boolean; data: { sections: { items: { prompt: string }[] }[] } };
  assert.equal(json.ok, true);
  assert.equal(prompts[0].includes("FORGED PIN"), false);
  assert.match(prompts[0], /Describe what a horizontal line/);
  assert.equal(json.data.sections[1].items[0].prompt, BANK_ROW.stem);
});
