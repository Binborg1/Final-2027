"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveRefresh, type ListenMode } from "@/lib/live/listen";

/**
 * The console's (or the projector's) copy of a session, kept fresh by Realtime
 * pings with polling as the fallback. Also keeps the difference between this
 * computer's clock and the server's, so the countdown is the server's.
 */
export function useSnapshot<T extends { session: { rev: number; serverNow: string } }>(id: string, initial: T, view: "console" | "screen" = "console") {
  const [snap, setSnap] = useState<T>(initial);
  const offset = useRef(0);
  const rev = useRef(initial.session.rev);
  useEffect(() => {
    // The server rendered this snapshot moments ago; the first fetch refines the offset.
    offset.current = Date.parse(initial.session.serverNow) - Date.now();
  }, [initial.session.serverNow]);

  const refresh = useCallback(async () => {
    const sent = Date.now();
    try {
      const res = await fetch(`/api/live/${id}${view === "screen" ? "?view=screen" : ""}`, { cache: "no-store" });
      const json = (await res.json()) as { ok: boolean; data?: T };
      if (!json.ok || !json.data) return;
      if (json.data.session.rev < rev.current) return;
      rev.current = json.data.session.rev;
      offset.current = Date.parse(json.data.session.serverNow) - (sent + Date.now()) / 2;
      setSnap(json.data);
    } catch {
      // Offline for a moment: the next ping or poll tries again.
    }
  }, [id, view]);

  const mode: ListenMode = useLiveRefresh({ sessionId: id, topics: ["state", "teacher"], refresh });

  /** Applies a snapshot an action returned, unless a newer one has arrived. */
  const accept = useCallback((next: T) => {
    if (next.session.rev < rev.current) return;
    rev.current = next.session.rev;
    setSnap(next);
  }, []);

  return { snap, refresh, accept, offset, mode };
}

/** Seconds left on the server's clock, updated four times a second. */
export function useSecondsLeft(endsAt: string | null, offset: React.RefObject<number>): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(endsAt) - (now + offset.current)) / 1000));
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/** POSTs a live action and returns the JSON reply. */
export async function liveAction<T = unknown>(path: string, body: unknown = {}): Promise<{ ok: boolean; reason?: string; message?: string; data?: T }> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return ((await res.json().catch(() => null)) as { ok: boolean; reason?: string; message?: string; data?: T } | null) ?? { ok: false, message: "Funza didn't answer. Try again." };
  } catch {
    return { ok: false, message: "Can't reach Funza. Check your connection and try again." };
  }
}
