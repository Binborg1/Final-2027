"use client";

import { RealtimeClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { publicEnv } from "@/lib/env";

/**
 * Keeps a live screen up to date. It listens for Realtime pings on the session's
 * topics and refetches on each one (pings carry no content). If the WebSocket
 * can't connect within 3 seconds (some school networks block it), it asks the
 * server every 2 seconds instead. While connected it still checks every 15
 * seconds, and always when the page comes back into view or the phone back online.
 * It also fetches once as soon as it starts.
 */

export type ListenMode = "connecting" | "live" | "polling";
export type ListenTopic = "state" | "teacher";

const topicName = (sessionId: string, topic: ListenTopic) => (topic === "state" ? `live:${sessionId}` : `live:${sessionId}:teacher`);

let client: RealtimeClient | null = null;
function realtime(): RealtimeClient {
  if (client) return client;
  const env = publicEnv();
  client = new RealtimeClient(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/^http/, "ws")}/realtime/v1`, {
    params: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    heartbeatIntervalMs: 15_000,
  });
  return client;
}

export function useLiveRefresh(opts: {
  sessionId: string | null;
  topics: ListenTopic[];
  refresh: () => void;
  /** Phones spread their requests out after a ping (150–450 ms) so 40 don't arrive at once. */
  spread?: boolean;
  enabled?: boolean;
}): ListenMode {
  const { sessionId, spread = false, enabled = true } = opts;
  const topicsKey = opts.topics.join(",");
  const refresh = useRef(opts.refresh);
  useEffect(() => {
    refresh.current = opts.refresh;
  });
  const [mode, setMode] = useState<ListenMode>("connecting");

  useEffect(() => {
    if (!sessionId || !enabled) return;
    let alive = true;
    let poll: ReturnType<typeof setInterval> | null = null;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const subscribed = new Set<string>();
    const topics = topicsKey.split(",").filter(Boolean) as ListenTopic[];

    const go = () => alive && refresh.current();
    const soon = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        go();
      }, spread ? 150 + Math.floor(Math.random() * 300) : 120);
    };
    const every = (ms: number) => {
      if (poll) clearInterval(poll);
      poll = setInterval(go, ms);
    };
    const to = (m: ListenMode) => alive && setMode(m);

    // Ask once now, then every 2 seconds until the socket is up.
    go();
    every(2_000);
    const rt = realtime();
    const channels = topics.map((t) => {
      const name = topicName(sessionId, t);
      const ch = rt.channel(name, { config: { broadcast: { self: false } } });
      ch.on("broadcast", { event: "*" }, soon);
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          subscribed.add(name);
          if (subscribed.size === topics.length) {
            to("live");
            every(15_000);
            go(); // anything missed while connecting
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          subscribed.delete(name);
          to("polling");
          every(2_000);
        }
      });
      return ch;
    });
    const fallback = setTimeout(() => {
      if (subscribed.size < topics.length) to("polling");
    }, 3_000);

    const onVisible = () => document.visibilityState === "visible" && go();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", go);

    return () => {
      alive = false;
      clearTimeout(fallback);
      if (poll) clearInterval(poll);
      if (pending) clearTimeout(pending);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", go);
      for (const ch of channels) void rt.removeChannel(ch);
    };
  }, [sessionId, topicsKey, spread, enabled]);

  return mode;
}
