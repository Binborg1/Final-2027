"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { classApi, editKeyFor, rememberTeaching } from "@/lib/classes/client";
import type { ClassRecord } from "@/lib/classes/model";
import { normalizeCode } from "@/lib/classes/model";

export type LoadState = { status: "loading" } | { status: "no-key" } | { status: "error"; message: string } | { status: "ready" };
export type SaveState = "saved" | "unsaved" | "saving" | "error";

const SAVE_DELAY_MS = 800;

/** The key from an edit link (".../teach/CODE#key=..."), else the one this browser kept. */
function findEditKey(code: string): string | null {
  const fromLink = new URLSearchParams(window.location.hash.slice(1)).get("key");
  if (fromLink) {
    window.history.replaceState(null, "", window.location.pathname);
    return fromLink;
  }
  return editKeyFor(code);
}

/**
 * A class as its professor edits it. Changes apply on screen at once and are
 * saved to the server shortly after, so the professor never presses Save.
 */
export function useEditableClass(rawCode: string) {
  const code = normalizeCode(rawCode);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [record, setRecord] = useState<ClassRecord | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const recordRef = useRef<ClassRecord | null>(null);
  const keyRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.resolve(findEditKey(code))
      .then((key) => {
        keyRef.current = key;
        return key ? classApi.loadForEdit(code, key).then((res) => ({ key, res })) : null;
      })
      .then((result) => {
        if (!active) return;
        if (!result) return setLoad({ status: "no-key" });
        const { key, res } = result;
        if (!res.ok) return setLoad(res.reason === "forbidden" ? { status: "no-key" } : { status: "error", message: res.message });
        rememberTeaching(code, key, res.data.name);
        recordRef.current = res.data;
        setRecord(res.data);
        setEditKey(key);
        setLoad({ status: "ready" });
      });
    return () => {
      active = false;
    };
  }, [code]);

  /** Saves now; resolves true once the server has the latest version. Waits for a save already running. */
  const save = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    while (inflight.current) await inflight.current;
    if (!dirty.current) return true;
    const key = keyRef.current;
    if (!key) return false;
    const run = (async () => {
      setSaveState("saving");
      let ok = true;
      do {
        dirty.current = false;
        const current = recordRef.current;
        if (!current) break;
        const res = await classApi.save(current, key);
        if (!res.ok) {
          dirty.current = true;
          ok = false;
          setSaveError(res.message);
          break;
        }
      } while (dirty.current); // edited while that save was in flight: save the newer version too
      if (ok) setSaveError(null);
      setSaveState(ok ? "saved" : "error");
      return ok;
    })();
    inflight.current = run;
    try {
      return await run;
    } finally {
      inflight.current = null;
    }
  }, []);

  const update = useCallback(
    (fn: (prev: ClassRecord) => ClassRecord) => {
      const prev = recordRef.current;
      if (!prev) return;
      const next = fn(prev);
      recordRef.current = next;
      setRecord(next);
      dirty.current = true;
      setSaveState("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
    },
    [save],
  );

  // Leaving the page with an edit waiting: save it now, and warn if the tab itself is closing.
  useEffect(() => {
    const pending = timer;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current || inflight.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (pending.current && dirty.current) void save();
    };
  }, [save]);

  return { code, load, record, update, save, saveState, saveError, editKey };
}
