"use client";

import { useEffect, useState } from "react";

export type TutorAiStatus = { configured: boolean; vision: boolean; provider?: string; model?: string };

export type TutorResult = { ok: true; data: { text: string } } | { ok: false; reason: string; message: string };

let statusPromise: Promise<TutorAiStatus> | null = null;

export function fetchTutorAiStatus(): Promise<TutorAiStatus> {
  statusPromise ??= fetch("/api/tutor")
    .then((r) => (r.ok ? (r.json() as Promise<TutorAiStatus>) : { configured: false, vision: false }))
    .catch(() => ({ configured: false, vision: false }));
  return statusPromise;
}

/** null while loading. */
export function useTutorAiStatus(): TutorAiStatus | null {
  const [status, setStatus] = useState<TutorAiStatus | null>(null);
  useEffect(() => {
    let active = true;
    fetchTutorAiStatus().then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, []);
  return status;
}

async function call(body: Record<string, unknown>): Promise<TutorResult> {
  try {
    const res = await fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as TutorResult;
  } catch {
    return { ok: false, reason: "network", message: "Could not reach the server." };
  }
}

export const tutorApi = {
  /** A question about the in-app workspace, described as text. */
  ask: (input: { question: string; context: string; courseName: string }) => call({ task: "ask", ...input }),
  /** A question about one screenshot the student chose to share (a base64 data URL), plus the in-app context. */
  analyzeScreen: (input: { question: string; context: string; courseName: string; image: string }) => call({ task: "vision", ...input }),
};
