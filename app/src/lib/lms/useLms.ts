"use client";

import { useEffect, useSyncExternalStore } from "react";
import { lmsStatus, type LmsStatus } from "@/lib/lms/client";

/** One shared, refreshable view of the Classroom connection for every screen. Null while loading. */

let current: LmsStatus | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function refreshLms() {
  pending = lmsStatus().then((s) => {
    current = s;
    pending = null;
    listeners.forEach((l) => l());
  });
  return pending;
}

export function useLms(): LmsStatus | null {
  const value = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  useEffect(() => {
    if (current === null && !pending) void refreshLms();
  }, []);
  return value;
}
