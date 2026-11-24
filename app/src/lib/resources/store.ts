"use client";

import { useSyncExternalStore } from "react";
import { catalogVersion, findOutcome, outcomeProblems, subscribeCatalog } from "@/lib/curriculum/catalog";
import { ensureOutcomes, loadCurriculumCache } from "@/lib/curriculum/client";
import { codeOf, placeOf } from "@/lib/curriculum/sources";
import { bankItem, blankDraft, blankItem, fromBank, newId } from "@/lib/resources/assemble";
import { BANK } from "@/lib/resources/bank";
import { blueprintOf } from "@/lib/resources/blueprint";
import { itemFp, sectionFp } from "@/lib/resources/checks";
import { defaultBrief, isQuestionKind, suggestedTitle } from "@/lib/resources/kinds";
import { approveMaterial, createMaterial, deleteMaterial, loadWorkspaceData, saveMaterial, startMaterialVersion } from "@/lib/resources/actions";
import { sanitizeItem, sanitizeSections } from "@/lib/resources/sanitize";
import { toStoredContent } from "@/lib/resources/stored";
import type { Brief, Delivery, Draft, FixAction, Item, MixRow, QType, Resource, ResourceKind, Section } from "@/lib/resources/types";

/**
 * The teacher's workspace in the browser: the working copy of their materials. Each
 * material is saved in the database (development step 4) through Server Functions
 * in lib/resources/actions.ts: edits are saved a moment after they happen, and
 * creating, approving and starting a new version wait for the server, which runs
 * the review checks again before it approves anything.
 */

type Saved<T = object> = ({ ok: true } & T) | { ok: false; message: string };
const UNREACHABLE = { ok: false as const, message: "Funza could not be reached. Check your connection and try again." };

export type GenStage = { id: string; label: string; detail: string };
export type GenError = { code: string; title: string; message: string; atStage: number };
export type GenerationState = { state: "idle" | "running" | "failed" | "cancelled" | "done"; stage: number; stages: GenStage[]; error: GenError | null; resourceId: string | null; startedAt: number };
export type Toast = { id: string; tone: "ok" | "info" | "bad"; text: string };
/** `remaining`: AI actions left today under the daily allowance (null when unknown). */
export type AiInfo = { known: boolean; configured: boolean; provider: string | null; remaining: number | null };

export type WorkspaceState = {
  hydrated: boolean;
  savedOk: boolean;
  resources: Resource[];
  drafts: Record<string, Draft>;
  settings: { schoolName: string };
  brief: Brief;
  generation: GenerationState;
  selection: string[];
  toasts: Toast[];
  ai: AiInfo;
  /** Changes when imported curriculum courses are loaded, so screens showing outcome codes re-render. */
  catalogVersion: number;
};

const IDLE: GenerationState = { state: "idle", stage: 0, stages: [], error: null, resourceId: null, startedAt: 0 };

const INITIAL: WorkspaceState = {
  hydrated: false,
  savedOk: true,
  resources: [],
  drafts: {},
  settings: { schoolName: "" },
  brief: defaultBrief("quiz", []),
  generation: IDLE,
  selection: [],
  toasts: [],
  ai: { known: false, configured: false, provider: null, remaining: null },
  catalogVersion: 0,
};

let state: WorkspaceState = INITIAL;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
function set(fn: (s: WorkspaceState) => WorkspaceState) {
  state = fn(state);
  listeners.forEach((l) => l());
}
export const getWorkspace = () => state;

export function useWorkspace(): WorkspaceState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}

/* ---------- persistence: the database, through Server Functions ---------- */

const dirty = new Set<string>();
const queues = new Map<string, Promise<unknown>>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Runs one material's server calls in order, so a save never overtakes an earlier one. */
function queue<T>(id: string, task: () => Promise<T>): Promise<T> {
  const next = (queues.get(id) ?? Promise.resolve()).catch(() => undefined).then(task);
  queues.set(id, next);
  void next.finally(() => {
    if (queues.get(id) === next) queues.delete(id);
  });
  return next;
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 600);
}

function saveNow() {
  saveTimer = null;
  for (const id of [...dirty]) {
    dirty.delete(id);
    void queue(id, async () => {
      const r = state.resources.find((x) => x.id === id);
      const d = state.drafts[id];
      if (!r || !d || d.status === "approved") return;
      const res = await saveMaterial({ id, content: toStoredContent(r, d) }).catch(() => UNREACHABLE);
      if (res.ok) {
        if (!state.savedOk) set((s) => ({ ...s, savedOk: true }));
        return;
      }
      dirty.add(id); // tried again with the next change
      if (state.savedOk) {
        set((s) => ({ ...s, savedOk: false }));
        toast(res.message === UNREACHABLE.message ? "Funza could not be reached. Your latest changes aren’t saved yet." : res.message, "bad");
      }
    });
  }
}

/** Waits until this material's changes so far are saved. */
async function flush(id: string) {
  if (saveTimer && dirty.has(id)) {
    clearTimeout(saveTimer);
    saveNow();
  }
  await (queues.get(id) ?? Promise.resolve()).catch(() => undefined);
}

let loaded = false;
/**
 * Called once from the app shell after hydration, with the outcomes of the
 * teacher's first course (the starting point for a new brief). Reads the teacher's
 * materials from the database.
 */
export function loadWorkspace(startOutcomeIds: string[] = []) {
  if (loaded) return;
  loaded = true;
  loadCurriculumCache();
  subscribeCatalog(() => set((s) => ({ ...s, catalogVersion: catalogVersion() })));
  set((s) => ({ ...s, brief: startOutcomeIds.length > 0 ? defaultBrief("quiz", startOutcomeIds) : s.brief, catalogVersion: catalogVersion() }));
  void loadWorkspaceData()
    .catch(() => UNREACHABLE)
    .then((res) => {
      if (!res.ok) {
        set((s) => ({ ...s, hydrated: true }));
        toast(res.message === UNREACHABLE.message ? "Funza couldn’t load your materials. Check your connection and reload." : res.message, "bad");
        return;
      }
      const resources = res.items.map((i) => i.resource);
      const drafts: Record<string, Draft> = Object.fromEntries(res.items.map((i) => [i.resource.id, i.draft]));
      set((s) => ({ ...s, resources, drafts, hydrated: true }));
      void ensureOutcomes([...state.brief.outcomeIds, ...resources.flatMap((r) => r.outcomeIds)]);
    });
  window.addEventListener("beforeunload", (e) => {
    if (dirty.size === 0 && queues.size === 0) return;
    saveNow();
    e.preventDefault();
  });
  fetch("/api/teach", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ configured: boolean; provider?: string; remaining?: number | null }>) : { configured: false }))
    .catch(() => ({ configured: false, provider: undefined }))
    .then((a) => set((s) => ({ ...s, ai: { known: true, configured: !!a.configured, provider: ("provider" in a && a.provider) || null, remaining: "remaining" in a && typeof a.remaining === "number" ? a.remaining : null } })));
}

/* ---------- helpers ---------- */

export function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-CA", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).replace(/\s?([ap])\.?m\.?/i, " $1m");
}

export function toast(text: string, tone: Toast["tone"] = "ok") {
  const id = newId("t");
  set((s) => ({ ...s, toasts: [...s.toasts.slice(-2), { id, tone, text }] }));
  setTimeout(() => dismissToast(id), 5200);
}
export function dismissToast(id: string) {
  set((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function setSchoolName(schoolName: string) {
  set((s) => ({ ...s, settings: { ...s.settings, schoolName: schoolName.slice(0, 120) } }));
}

/* ---------- curriculum selection ---------- */

export function toggleSelection(id: string) {
  set((s) => ({ ...s, selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id] }));
}
export function clearSelection() {
  set((s) => ({ ...s, selection: [] }));
}

/* ---------- the brief ---------- */

export function startBrief(kind: ResourceKind, outcomeIds?: string[]) {
  set((s) => {
    const ids = outcomeIds && outcomeIds.length > 0 ? outcomeIds : s.brief.outcomeIds;
    return { ...s, brief: defaultBrief(kind, ids), generation: IDLE };
  });
}
export function patchBrief(patch: Partial<Brief>) {
  set((s) => {
    const next = { ...s.brief, ...patch };
    if (patch.outcomeIds && s.brief.title === suggestedTitle(s.brief.kind, s.brief.outcomeIds)) next.title = suggestedTitle(next.kind, next.outcomeIds);
    return { ...s, brief: next };
  });
}
export function setKind(kind: ResourceKind) {
  set((s) => {
    const fresh = defaultBrief(kind, s.brief.outcomeIds);
    return { ...s, brief: { ...fresh, material: s.brief.material, reuseId: s.brief.reuseId, instructions: s.brief.instructions } };
  });
}
export function setMixRow(type: QType, patch: Partial<MixRow>) {
  set((s) => ({ ...s, brief: { ...s.brief, mix: s.brief.mix.map((r) => (r.type === type ? { ...r, ...patch } : r)) } }));
}
export function addOutcomeToBrief(id: string) {
  if (!state.brief.outcomeIds.includes(id)) patchBrief({ outcomeIds: [...state.brief.outcomeIds, id] });
}
export function removeOutcomeFromBrief(id: string) {
  patchBrief({ outcomeIds: state.brief.outcomeIds.filter((x) => x !== id) });
}
export function reuseResource(id: string) {
  const r = state.resources.find((x) => x.id === id);
  if (!r) return;
  set((s) => ({ ...s, brief: { ...r.brief, title: `${r.title} (copy)`, reuseId: id }, generation: IDLE }));
}

/* ---------- generation ---------- */

let controller: AbortController | null = null;

const ERROR_TEXT: Record<string, { title: string; message: string; stage: number }> = {
  "not-configured": { title: "AI drafting is not set up", message: "No AI provider is configured on this Funza server. Start from Funza's question bank, or write it yourself from the blueprint.", stage: 2 },
  "rate-limit": { title: "The AI provider is busy", message: "The provider rate-limited the request. Nothing was saved. Your settings are kept, so you can try again in a minute.", stage: 2 },
  auth: { title: "The AI provider refused the key", message: "The server's AI key was rejected. Ask whoever runs this Funza server to check it.", stage: 2 },
  refused: { title: "The AI provider declined the request", message: "The model refused to write this. Try different wording in your note, or start from the question bank.", stage: 2 },
  empty: { title: "The AI provider sent nothing back", message: "Nothing was saved. Try again.", stage: 2 },
  "invalid-response": { title: "The draft did not pass validation", message: "", stage: 3 },
  "invalid-outcome": { title: "That outcome cannot be used", message: "", stage: 0 },
  network: { title: "Funza could not be reached", message: "Check your connection. Nothing was saved.", stage: 2 },
  allowance: { title: "Today’s Funza actions are used up", message: "", stage: 2 },
  "allowance-unavailable": { title: "Funza couldn’t check today’s allowance", message: "", stage: 2 },
};

function stagesFor(b: Brief): GenStage[] {
  const bp = blueprintOf(b);
  const problems = b.outcomeIds.flatMap((id) => {
    const f = findOutcome(id);
    return f ? outcomeProblems(f) : [`${id} is not in the catalog.`];
  });
  return [
    { id: "outcome", label: "Checking the outcomes", detail: problems.length === 0 ? `${b.outcomeIds.map(codeOf).join(", ")}: found in Funza's catalog, wording intact.` : problems[0] },
    { id: "blueprint", label: "Fixing the blueprint", detail: isQuestionKind(b.kind) ? `${bp.questions} questions, ${bp.marks} marks, from your settings.` : `${bp.parts.length} parts, from your settings.` },
    { id: "draft", label: "Funza is drafting", detail: "Funza gets the blueprint and the outcome wording, and may cite only these outcomes." },
    { id: "validate", label: "Validating the reply", detail: "Format, outcome references and marks. Anything that fails is dropped and listed." },
    { id: "recompute", label: "Recomputing answers", detail: "Funza recalculates every answer it can; the AI's arithmetic is not trusted." },
  ];
}

/** Saves a new material (resource, chapters, version 1), then adds it to the workspace. */
async function createResource(b: Brief, draft: Draft): Promise<Saved<{ id: string }>> {
  const now = new Date().toISOString();
  const id = draft.resourceId;
  const place = placeOf(b.outcomeIds);
  const resource: Resource = { id, kind: b.kind, title: b.title, courseName: place.courseName, unitName: place.unitName, outcomeIds: b.outcomeIds, createdAt: now, updatedAt: now, deliveries: [], brief: { ...b, material: b.material ? { ...b.material, text: "" } : null } };
  const full = { ...draft, title: b.title };
  const res = await createMaterial({ id, content: toStoredContent(resource, full) }).catch(() => UNREACHABLE);
  if (!res.ok) return res;
  set((s) => ({ ...s, resources: [resource, ...s.resources], drafts: { ...s.drafts, [id]: full } }));
  return { ok: true, id };
}

/** Without AI: the starter bank or the blueprint laid out empty. */
export async function createWithoutAi(mode: "bank" | "blank"): Promise<Saved<{ id: string }>> {
  const b = state.brief;
  const id = crypto.randomUUID();
  const draft = mode === "bank" ? fromBank(b, id) : blankDraft(b, id);
  set((s) => ({ ...s, generation: IDLE }));
  const res = await createResource(b, draft);
  if (!res.ok) toast(res.message, "bad");
  return res;
}

export async function startGeneration() {
  controller?.abort();
  const b = state.brief;
  const stages = stagesFor(b);
  set((s) => ({ ...s, generation: { state: "running", stage: 0, stages, error: null, resourceId: null, startedAt: Date.now() } }));
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await wait(250);
  if (state.generation.state !== "running") return;
  set((s) => ({ ...s, generation: { ...s.generation, stage: 2 } }));
  controller = new AbortController();
  let json: { ok: boolean; reason?: string; message?: string; data?: { sections: unknown; notices: string[]; provider: string } };
  try {
    const res = await fetch("/api/teach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "resource-draft", brief: b }), signal: controller.signal });
    json = await res.json();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    json = { ok: false, reason: "network" };
  }
  if (state.generation.state !== "running") return;
  if (json.reason === "allowance") set((s) => ({ ...s, ai: { ...s.ai, remaining: 0 } }));
  if (!json.ok || !json.data) {
    const known = ERROR_TEXT[json.reason ?? ""] ?? { title: "The AI request failed", message: "", stage: 2 };
    set((s) => ({ ...s, generation: { ...s.generation, state: "failed", stage: known.stage, error: { code: json.reason ?? "provider", title: known.title, message: known.message || json.message || "Nothing was saved.", atStage: known.stage } } }));
    return;
  }
  set((s) => ({ ...s, ai: { ...s.ai, remaining: s.ai.remaining === null ? null : Math.max(0, s.ai.remaining - 1) }, generation: { ...s.generation, stage: 3 } }));
  const sections = sanitizeSections(json.data.sections, { allowedOutcomes: new Set(b.outcomeIds), origin: "ai" });
  await wait(300);
  set((s) => ({ ...s, generation: { ...s.generation, stage: 4 } }));
  await wait(300);
  if (state.generation.state !== "running") return;
  const id = crypto.randomUUID();
  const draft: Draft = { ...blankDraft(b, id), sections, draftedBy: "ai", provider: json.data.provider, notices: json.data.notices ?? [] };
  const created = await createResource(b, draft);
  if (!created.ok) {
    set((s) => ({ ...s, generation: { ...s.generation, state: "failed", stage: 4, error: { code: "save", title: "The draft couldn’t be saved", message: created.message, atStage: 4 } } }));
    return;
  }
  set((s) => ({ ...s, generation: { ...s.generation, state: "done", stage: s.generation.stages.length, resourceId: id } }));
}

export function cancelGeneration() {
  controller?.abort();
  controller = null;
  set((s) => ({ ...s, generation: { ...s.generation, state: "cancelled" } }));
}
export function resetGeneration() {
  controller?.abort();
  controller = null;
  set((s) => ({ ...s, generation: IDLE }));
}

/* ---------- editing a draft ---------- */

/** Changes a draft in the workspace; `save` (the default) saves it to the database a moment later. */
function patchDraft(id: string, fn: (d: Draft) => Draft, save = true) {
  set((s) => {
    const d = s.drafts[id];
    if (!d) return s;
    const next = fn(d);
    return {
      ...s,
      drafts: { ...s.drafts, [id]: next },
      resources: s.resources.map((r) => (r.id === id ? { ...r, updatedAt: new Date().toISOString(), title: next.title, outcomeIds: next.outcomeIds } : r)),
    };
  });
  if (save && state.drafts[id]) {
    dirty.add(id);
    scheduleSave();
  }
}

const mapItems = (d: Draft, fn: (i: Item) => Item): Draft => ({ ...d, sections: d.sections.map((s) => ({ ...s, items: s.items.map(fn) })) });

export const setTitle = (id: string, title: string) => patchDraft(id, (d) => ({ ...d, title: title.slice(0, 160) }));
export const setDraftOutcomes = (id: string, outcomeIds: string[]) => patchDraft(id, (d) => ({ ...d, outcomeIds }));
export const updateItem = (id: string, itemId: string, patch: Partial<Item>) => patchDraft(id, (d) => mapItems(d, (i) => (i.id === itemId ? { ...i, ...patch } : i)));
export const updateSection = (id: string, sectionId: string, patch: Partial<Section>) => patchDraft(id, (d) => ({ ...d, sections: d.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)) }));
export const setGlobal = (id: string, key: keyof Draft["globals"], value: boolean) => patchDraft(id, (d) => ({ ...d, globals: { ...d.globals, [key]: value } }));
export const dismissNotices = (id: string) => patchDraft(id, (d) => ({ ...d, notices: [] }));

export function markReviewed(id: string, targetId: string, reviewed = true) {
  patchDraft(id, (d) => ({
    ...d,
    sections: d.sections.map((s) => ({
      ...s,
      reviewedFp: s.id === targetId ? (reviewed ? sectionFp(s) : null) : s.reviewedFp,
      items: s.items.map((i) => (i.id === targetId ? { ...i, reviewedFp: reviewed ? itemFp(i) : null } : i)),
    })),
  }));
}

export function moveItem(id: string, itemId: string, dir: -1 | 1) {
  patchDraft(id, (d) => ({
    ...d,
    sections: d.sections.map((s) => {
      const i = s.items.findIndex((x) => x.id === itemId);
      if (i < 0 || i + dir < 0 || i + dir >= s.items.length) return s;
      const items = [...s.items];
      [items[i], items[i + dir]] = [items[i + dir], items[i]];
      return { ...s, items };
    }),
  }));
}
export function moveSection(id: string, sectionId: string, dir: -1 | 1) {
  patchDraft(id, (d) => {
    const i = d.sections.findIndex((s) => s.id === sectionId);
    if (i < 0 || i + dir < 0 || i + dir >= d.sections.length) return d;
    const sections = [...d.sections];
    [sections[i], sections[i + dir]] = [sections[i + dir], sections[i]];
    return { ...d, sections };
  });
}
export function deleteItem(id: string, itemId: string) {
  patchDraft(id, (d) => ({ ...d, sections: d.sections.map((s) => ({ ...s, items: s.items.filter((i) => i.id !== itemId) })).filter((s) => s.kind !== "questions" || s.items.length > 0) }));
}
export function deleteSection(id: string, sectionId: string) {
  patchDraft(id, (d) => ({ ...d, sections: d.sections.filter((s) => s.id !== sectionId) }));
}
export function duplicateItem(id: string, itemId: string): string {
  const copyId = newId("q");
  patchDraft(id, (d) => ({
    ...d,
    sections: d.sections.map((s) => {
      const i = s.items.findIndex((x) => x.id === itemId);
      if (i < 0) return s;
      const items = [...s.items];
      items.splice(i + 1, 0, { ...s.items[i], id: copyId, origin: "teacher", reviewedFp: null });
      return { ...s, items };
    }),
  }));
  return copyId;
}
export function addItem(id: string, sectionId: string, type: QType, afterId: string | null): string {
  const d = state.drafts[id];
  const marks = d?.sections.find((s) => s.id === sectionId)?.items[0]?.marks ?? 1;
  const item = blankItem(type, marks, d?.outcomeIds ?? [], newId("q"));
  patchDraft(id, (dd) => ({
    ...dd,
    sections: dd.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const at = afterId ? s.items.findIndex((x) => x.id === afterId) + 1 : s.items.length;
      const items = [...s.items];
      items.splice(at, 0, item);
      return { ...s, items };
    }),
  }));
  return item.id;
}

export function applyFix(id: string, action: FixAction): string | null {
  const d = state.drafts[id];
  if (!d) return null;
  switch (action.kind) {
    case "use-recomputed": {
      const item = d.sections.flatMap((s) => s.items).find((i) => i.id === action.itemId);
      if (!item) return null;
      if (item.type === "mcq") updateItem(id, item.id, { correctId: action.value });
      else updateItem(id, item.id, { answer: action.value, solution: item.answer && item.solution.includes(item.answer) ? item.solution.split(item.answer).join(action.value) : item.solution });
      return item.id;
    }
    case "use-recomputed-claim": {
      const s = d.sections.find((x) => x.id === action.sectionId);
      if (!s?.claim) return null;
      updateSection(id, s.id, { body: s.body.split(s.claim.stated).join(action.value), claim: { ...s.claim, stated: action.value } });
      return s.id;
    }
    case "rubric-total":
      updateItem(id, action.itemId, { marks: action.marks });
      return action.itemId;
    case "remove-outcome":
      setDraftOutcomes(id, d.outcomeIds.filter((o) => o !== action.outcomeId));
      return null;
    case "add-question": {
      const target = d.sections.find((s) => s.kind === "questions");
      if (!target) return null;
      const newIdValue = addItem(id, target.id, "mcq", null);
      updateItem(id, newIdValue, { outcomeIds: [action.outcomeId] });
      return newIdValue;
    }
  }
}

/** Asks the AI (or, without AI, the starter bank) for one replacement question, shown beside the original. */
export async function regenerateItem(id: string, itemId: string, guidance: string): Promise<{ ok: boolean; message?: string }> {
  const d = state.drafts[id];
  const r = state.resources.find((x) => x.id === id);
  const item = d?.sections.flatMap((s) => s.items).find((i) => i.id === itemId);
  if (!d || !r || !item) return { ok: false, message: "That question no longer exists." };
  const others = d.sections.flatMap((s) => s.items).filter((i) => i.id !== itemId);
  if (state.ai.configured) {
    try {
      const res = await fetch("/api/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "resource-item", brief: { ...r.brief, outcomeIds: d.outcomeIds }, type: item.type, marks: item.marks, difficulty: item.difficulty, outcomeId: item.outcomeIds[0], guidance, avoid: [item.prompt, ...others.map((o) => o.prompt)] }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; data?: { item: unknown } };
      const alt = json.ok && json.data ? sanitizeItem(json.data.item, { allowedOutcomes: new Set(d.outcomeIds), fallbackId: newId("q"), origin: "ai" }) : null;
      if (json.ok) set((s) => ({ ...s, ai: { ...s.ai, remaining: s.ai.remaining === null ? null : Math.max(0, s.ai.remaining - 1) } }));
      if (!alt) return { ok: false, message: json.message ?? "The AI did not return a usable question." };
      patchDraft(id, (dd) => ({ ...dd, pendingAlt: { targetId: itemId, item: { ...alt, id: newId("q"), reviewedFp: null } } }));
      return { ok: true };
    } catch {
      return { ok: false, message: "Funza could not be reached." };
    }
  }
  const used = new Set(d.sections.flatMap((s) => s.items.map((i) => i.id)));
  const alt = BANK.find((p) => p.type === item.type && p.outcomeIds.some((o) => item.outcomeIds.includes(o)) && !used.has(p.id));
  if (!alt) return { ok: false, message: "AI drafting is not set up, and the question bank has no other question of this type for this outcome." };
  patchDraft(id, (dd) => ({ ...dd, pendingAlt: { targetId: itemId, item: bankItem(alt, item.marks, alt.id) } }));
  return { ok: true };
}
export const acceptAlt = (id: string) => patchDraft(id, (d) => (d.pendingAlt ? { ...mapItems(d, (i) => (i.id === d.pendingAlt!.targetId ? d.pendingAlt!.item : i)), pendingAlt: null } : d));
export const discardAlt = (id: string) => patchDraft(id, (d) => ({ ...d, pendingAlt: null }));

/* ---------- approval and versions ---------- */

/** Approves on the server, which runs the review checks again and saves the questions to the chapter's bank. */
export async function approve(id: string): Promise<boolean> {
  await flush(id);
  const res = await queue(id, () => approveMaterial({ id })).catch(() => UNREACHABLE);
  if (!res.ok) {
    toast(res.message, "bad");
    return false;
  }
  patchDraft(id, (d) => ({ ...d, status: "approved", version: res.version, approved: { at: res.at, version: res.version, title: d.title, sections: structuredClone(d.sections) }, pendingAlt: null }), false);
  toast(res.banked > 0 ? `Approved. ${res.banked} question${res.banked === 1 ? "" : "s"} saved to the chapter’s question bank.` : "Approved. This version is ready to publish.");
  return true;
}

export async function startNewVersion(id: string): Promise<boolean> {
  const res = await queue(id, () => startMaterialVersion({ id })).catch(() => UNREACHABLE);
  if (!res.ok) {
    toast(res.message, "bad");
    return false;
  }
  patchDraft(id, (d) => ({ ...d, status: "draft", version: res.version }), false);
  toast(`Editing version ${res.version}. The approved version stays exactly as it was.`, "info");
  return true;
}

export async function deleteResource(id: string): Promise<boolean> {
  dirty.delete(id);
  const res = await queue(id, () => deleteMaterial({ id })).catch(() => UNREACHABLE);
  if (!res.ok) {
    toast(res.message, "bad");
    return false;
  }
  set((s) => {
    const drafts = { ...s.drafts };
    delete drafts[id];
    return { ...s, resources: s.resources.filter((r) => r.id !== id), drafts };
  });
  return true;
}

export function recordDelivery(id: string, delivery: Omit<Delivery, "id" | "at">) {
  const entry: Delivery = { ...delivery, id: newId("d"), at: new Date().toISOString() };
  set((s) => ({ ...s, resources: s.resources.map((r) => (r.id === id ? { ...r, deliveries: [entry, ...r.deliveries] } : r)) }));
  dirty.add(id);
  scheduleSave();
}
