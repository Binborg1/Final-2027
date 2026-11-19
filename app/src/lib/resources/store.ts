"use client";

import { useSyncExternalStore } from "react";
import { findOutcome, outcomeProblems } from "@/lib/curriculum/catalog";
import { codeOf } from "@/lib/curriculum/sources";
import { bankItem, blankDraft, blankItem, fromBank, newId } from "@/lib/resources/assemble";
import { BANK } from "@/lib/resources/bank";
import { blueprintOf } from "@/lib/resources/blueprint";
import { itemFp, sectionFp } from "@/lib/resources/checks";
import { defaultBrief, isQuestionKind, suggestedTitle } from "@/lib/resources/kinds";
import { isObject, sanitizeDraft, sanitizeItem, sanitizeResource, sanitizeSections } from "@/lib/resources/sanitize";
import type { Brief, Delivery, Draft, FixAction, Item, MixRow, QType, Resource, ResourceKind, Section } from "@/lib/resources/types";

/**
 * The teacher's workspace in the browser. Resources and drafts are saved in this
 * browser's storage (validated again on every load) until teacher accounts and
 * a database arrive. Nothing is sent anywhere except an AI draft request
 * (outcome, brief, optional file text) and an explicit Classroom post.
 */

const STORAGE_KEY = "funza.workspace.v1";

export type GenStage = { id: string; label: string; detail: string };
export type GenError = { code: string; title: string; message: string; atStage: number };
export type GenerationState = { state: "idle" | "running" | "failed" | "cancelled" | "done"; stage: number; stages: GenStage[]; error: GenError | null; resourceId: string | null; startedAt: number };
export type Toast = { id: string; tone: "ok" | "info" | "bad"; text: string };
export type AiInfo = { known: boolean; configured: boolean; provider: string | null };

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
};

const IDLE: GenerationState = { state: "idle", stage: 0, stages: [], error: null, resourceId: null, startedAt: 0 };

const INITIAL: WorkspaceState = {
  hydrated: false,
  savedOk: true,
  resources: [],
  drafts: {},
  settings: { schoolName: "" },
  brief: defaultBrief("quiz", ["sk-sci10-fm2"]),
  generation: IDLE,
  selection: [],
  toasts: [],
  ai: { known: false, configured: false, provider: null },
};

let state: WorkspaceState = INITIAL;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
function set(fn: (s: WorkspaceState) => WorkspaceState, persist = false) {
  state = fn(state);
  listeners.forEach((l) => l());
  if (persist) scheduleSave();
}
export const getWorkspace = () => state;

export function useWorkspace(): WorkspaceState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}

/* ---------- persistence ---------- */

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}
function saveNow() {
  saveTimer = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, resources: state.resources, drafts: state.drafts, settings: state.settings }));
    if (!state.savedOk) set((s) => ({ ...s, savedOk: true }));
  } catch {
    if (state.savedOk) {
      set((s) => ({ ...s, savedOk: false }));
      toast("This browser would not save your work. Free some space or allow site storage.", "bad");
    }
  }
}

function readStored(): Pick<WorkspaceState, "resources" | "drafts" | "settings"> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
    if (!isObject(raw)) return { resources: [], drafts: {}, settings: { schoolName: "" } };
    const resources = (Array.isArray(raw.resources) ? raw.resources : []).map(sanitizeResource).filter((r): r is Resource => r !== null);
    const drafts: Record<string, Draft> = {};
    const rawDrafts = isObject(raw.drafts) ? raw.drafts : {};
    for (const r of resources) {
      const d = sanitizeDraft(rawDrafts[r.id], r);
      if (d) drafts[r.id] = d;
    }
    const settings = isObject(raw.settings) && typeof raw.settings.schoolName === "string" ? { schoolName: raw.settings.schoolName.slice(0, 120) } : { schoolName: "" };
    return { resources: resources.filter((r) => drafts[r.id]), drafts, settings };
  } catch {
    return { resources: [], drafts: {}, settings: { schoolName: "" } };
  }
}

let loaded = false;
/** Called once from the app shell after hydration. */
export function loadWorkspace() {
  if (loaded) return;
  loaded = true;
  set((s) => ({ ...s, ...readStored(), hydrated: true }));
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) set((s) => ({ ...s, ...readStored() }));
  });
  fetch("/api/teach", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ configured: boolean; provider?: string }>) : { configured: false }))
    .catch(() => ({ configured: false, provider: undefined }))
    .then((a) => set((s) => ({ ...s, ai: { known: true, configured: !!a.configured, provider: ("provider" in a && a.provider) || null } })));
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
  set((s) => ({ ...s, settings: { ...s.settings, schoolName: schoolName.slice(0, 120) } }), true);
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
    const ids = outcomeIds && outcomeIds.length > 0 ? outcomeIds : s.brief.outcomeIds.length > 0 ? s.brief.outcomeIds : ["sk-sci10-fm2"];
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
    { id: "draft", label: `Drafting with ${state.ai.provider ?? "the AI provider"}`, detail: "Sends the blueprint and the outcome wording. The model may cite only these outcomes." },
    { id: "validate", label: "Validating the reply", detail: "Format, outcome references and marks. Anything that fails is dropped and listed." },
    { id: "recompute", label: "Recomputing answers", detail: "Funza recalculates every answer it can; the AI's arithmetic is not trusted." },
  ];
}

function createResource(b: Brief, draft: Draft): string {
  const now = new Date().toISOString();
  const id = draft.resourceId;
  const resource: Resource = { id, kind: b.kind, title: b.title, courseName: "Science 10", unitName: "Force and Motion in Our World", outcomeIds: b.outcomeIds, createdAt: now, updatedAt: now, deliveries: [], brief: { ...b, material: b.material ? { ...b.material, text: "" } : null } };
  set((s) => ({ ...s, resources: [resource, ...s.resources], drafts: { ...s.drafts, [id]: { ...draft, title: b.title } } }), true);
  return id;
}

/** Without AI: the starter bank or the blueprint laid out empty. Returns the new resource id. */
export function createWithoutAi(mode: "bank" | "blank"): string {
  const b = state.brief;
  const id = newId("r");
  const draft = mode === "bank" ? fromBank(b, id) : blankDraft(b, id);
  set((s) => ({ ...s, generation: IDLE }));
  return createResource(b, draft);
}

export async function startGeneration() {
  controller?.abort();
  const b = state.brief;
  if (b.kind === "visualization") {
    const id = createWithoutAi("bank");
    set((s) => ({ ...s, generation: { ...IDLE, state: "done", resourceId: id, stages: stagesFor(b).slice(0, 2), stage: 2 } }));
    return;
  }
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
  if (!json.ok || !json.data) {
    const known = ERROR_TEXT[json.reason ?? ""] ?? { title: "The AI request failed", message: "", stage: 2 };
    set((s) => ({ ...s, generation: { ...s.generation, state: "failed", stage: known.stage, error: { code: json.reason ?? "provider", title: known.title, message: known.message || json.message || "Nothing was saved.", atStage: known.stage } } }));
    return;
  }
  set((s) => ({ ...s, generation: { ...s.generation, stage: 3 } }));
  const sections = sanitizeSections(json.data.sections, { allowedOutcomes: new Set(b.outcomeIds), origin: "ai" });
  await wait(300);
  set((s) => ({ ...s, generation: { ...s.generation, stage: 4 } }));
  await wait(300);
  if (state.generation.state !== "running") return;
  const id = newId("r");
  const draft: Draft = { ...blankDraft(b, id), sections, draftedBy: "ai", provider: json.data.provider, notices: json.data.notices ?? [] };
  createResource(b, draft);
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

function patchDraft(id: string, fn: (d: Draft) => Draft) {
  set((s) => {
    const d = s.drafts[id];
    if (!d) return s;
    const next = fn(d);
    return {
      ...s,
      drafts: { ...s.drafts, [id]: next },
      resources: s.resources.map((r) => (r.id === id ? { ...r, updatedAt: new Date().toISOString(), title: next.title, outcomeIds: next.outcomeIds } : r)),
    };
  }, true);
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

export function approve(id: string) {
  patchDraft(id, (d) => ({ ...d, status: "approved", approved: { at: new Date().toISOString(), version: d.version, title: d.title, sections: structuredClone(d.sections) }, pendingAlt: null }));
  toast("Approved. This version is ready to publish.");
}
export function startNewVersion(id: string) {
  patchDraft(id, (d) => ({ ...d, status: "draft", version: d.version + 1 }));
  toast(`Editing version ${state.drafts[id]?.version ?? 2}. The approved version stays exactly as published.`, "info");
}

export function deleteResource(id: string) {
  set((s) => {
    const drafts = { ...s.drafts };
    delete drafts[id];
    return { ...s, resources: s.resources.filter((r) => r.id !== id), drafts };
  }, true);
}

export function recordDelivery(id: string, delivery: Omit<Delivery, "id" | "at">) {
  const entry: Delivery = { ...delivery, id: newId("d"), at: new Date().toISOString() };
  set((s) => ({ ...s, resources: s.resources.map((r) => (r.id === id ? { ...r, deliveries: [entry, ...r.deliveries] } : r)) }), true);
}


