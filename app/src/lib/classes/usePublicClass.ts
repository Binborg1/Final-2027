"use client";

import { useEffect, useState } from "react";
import { classApi, rememberJoined } from "@/lib/classes/client";
import type { PublicClass } from "@/lib/classes/model";
import { isValidCode, normalizeCode } from "@/lib/classes/model";

export type PublicState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; cls: PublicClass };

/** Kept for the session, so moving between a class and its lectures does not flash a loading screen. */
const cache = new Map<string, PublicClass>();

/** A class as students see it. Opening one joins it in this browser. */
export function usePublicClass(rawCode: string): PublicState {
  const code = normalizeCode(rawCode);
  const valid = isValidCode(code);
  const [fetched, setFetched] = useState<{ code: string; state: PublicState } | null>(null);

  useEffect(() => {
    if (!valid) return;
    let active = true;
    classApi.loadPublic(code).then((res) => {
      if (!active) return;
      if (res.ok) {
        cache.set(code, res.data);
        rememberJoined(res.data);
        setFetched({ code, state: { status: "ready", cls: res.data } });
      } else {
        setFetched({ code, state: res.reason === "not-found" ? { status: "not-found" } : { status: "error", message: res.message } });
      }
    });
    return () => {
      active = false;
    };
  }, [code, valid]);

  if (!valid) return { status: "not-found" };
  if (fetched?.code === code && fetched.state.status !== "error") return fetched.state;
  const cached = cache.get(code);
  if (cached) return { status: "ready", cls: cached };
  return fetched?.code === code ? fetched.state : { status: "loading" };
}
