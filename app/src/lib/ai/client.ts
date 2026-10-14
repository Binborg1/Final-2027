"use client";

import { useEffect, useState } from "react";
import type { AiQuestion, AiTask } from "@/lib/ai/prompts";

export type AiStatus = { configured: boolean; provider?: string; model?: string };
export type AiResult = { ok: true; text: string } | { ok: false; reason: string; message: string };

let statusPromise: Promise<AiStatus> | null = null;

export function fetchAiStatus(): Promise<AiStatus> {
  statusPromise ??= fetch("/api/ai")
    .then((r) => (r.ok ? (r.json() as Promise<AiStatus>) : { configured: false }))
    .catch(() => ({ configured: false }));
  return statusPromise;
}

/** null while loading. */
export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    let active = true;
    fetchAiStatus().then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, []);
  return status;
}

export async function askAi(input: {
  task: AiTask;
  question: AiQuestion;
  context: string[];
  attempt?: string;
  courseName: string;
}): Promise<AiResult> {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as AiResult;
  } catch {
    return { ok: false, reason: "network", message: "Could not reach the server." };
  }
}
