import type { LiveSession, LiveState } from "@/lib/live/types";

/**
 * The session's states and the rules between them. The server's clock is the only
 * clock: answers are accepted until ends_at plus a 2-second grace, and the first
 * request after that closes the session if the console is gone ("lazy close").
 * Every change raises `rev` and is written as a conditional update on the state and
 * rev the change was planned from, so two tabs can't both apply it.
 */

export const GRACE_MS = 2000;

/** The stepper under every Live screen. */
export const STEPS = ["Setup", "Lobby", "Answering", "Marking", "Reveal", "Results"] as const;

const STEP_OF: Record<LiveState, number> = { lobby: 1, open: 2, closed: 3, revealed: 4, ended: 5 };
export const stepOf = (state: LiveState) => STEP_OF[state];

export const LIVE_STATES: readonly LiveState[] = ["lobby", "open", "closed", "revealed", "ended"];
export const isLiveState = (s: unknown): s is LiveState => typeof s === "string" && (LIVE_STATES as readonly string[]).includes(s);

const at = (iso: string | null) => (iso ? Date.parse(iso) : NaN);
const iso = (ms: number) => new Date(ms).toISOString();

type Clocked = Pick<LiveSession, "state" | "endsAt">;

/** Open, but past the end time and its grace: the session should be closed. */
export function needsLazyClose(s: Clocked, now: number): boolean {
  return s.state === "open" && Number.isFinite(at(s.endsAt)) && now > at(s.endsAt) + GRACE_MS;
}

/** The state to show: an open session past its time is shown as closed. */
export const effectiveState = (s: Clocked, now: number): LiveState => (needsLazyClose(s, now) ? "closed" : s.state);

export type AcceptAnswer = { ok: true } | { ok: false; reason: "not-open" | "locked" };

/** Answers save while the clock runs, and up to 2 seconds after it ends (also after End early). */
export function canAcceptAnswer(s: Clocked, now: number): AcceptAnswer {
  if (s.state === "lobby") return { ok: false, reason: "not-open" };
  if (s.state !== "open" && s.state !== "closed") return { ok: false, reason: "locked" };
  const end = at(s.endsAt);
  if (!Number.isFinite(end) || now > end + GRACE_MS) return { ok: false, reason: "locked" };
  return { ok: true };
}

/** Seconds left on the clock, never negative. */
export function secondsLeft(s: Clocked, now: number): number {
  const end = at(s.endsAt);
  return Number.isFinite(end) ? Math.max(0, Math.ceil((end - now) / 1000)) : 0;
}

export type SessionPatch = {
  state?: LiveState;
  opened_at?: string;
  ends_at?: string;
  closed_at?: string;
  revealed_at?: string;
  current_question_id?: string | null;
  rev: number;
};

export type Plan =
  | { ok: true; noop: true }
  | { ok: true; noop?: false; expect: { state: LiveState; rev: number }; patch: SessionPatch }
  | { ok: false; status: 409; reason: string; message: string };

const refuse = (reason: string, message: string): Plan => ({ ok: false, status: 409, reason, message });

type Plannable = Pick<LiveSession, "state" | "endsAt" | "rev" | "timerS" | "currentQuestionId">;

/** Closing patch: the clock stops at whichever comes first, now or the end time. */
function closePatch(s: Plannable, now: number): SessionPatch {
  const end = Math.min(Number.isFinite(at(s.endsAt)) ? at(s.endsAt) : now, now);
  return { state: "closed", ends_at: iso(end), closed_at: iso(end), rev: s.rev + 1 };
}

/**
 * What a teacher action changes. "open" starts the clock for the whole set;
 * "close" ends it early (or records the end once time is up); "reveal" shows the
 * answers, starting at the first question; "step" moves the projector to another
 * question. Ending is done by the database (end_live_session).
 */
export function plan(
  action: "open" | "close" | "reveal" | "step",
  s: Plannable,
  now: number,
  extra: { firstQuestionId?: string | null; questionId?: string | null } = {},
): Plan {
  const expect = { state: s.state, rev: s.rev };
  switch (action) {
    case "open":
      if (s.state !== "lobby") return s.state === "open" ? { ok: true, noop: true } : refuse("state", "This session has already started.");
      return { ok: true, expect, patch: { state: "open", opened_at: iso(now), ends_at: iso(now + s.timerS * 1000), rev: s.rev + 1 } };
    case "close":
      if (s.state === "closed" || s.state === "revealed") return { ok: true, noop: true };
      if (s.state !== "open") return refuse("state", s.state === "lobby" ? "Students haven't started yet." : "This session has ended.");
      return { ok: true, expect, patch: closePatch(s, now) };
    case "reveal":
      if (s.state === "revealed") return { ok: true, noop: true };
      if (s.state === "open" && needsLazyClose(s, now)) {
        return { ok: true, expect, patch: { ...closePatch(s, now), state: "revealed", revealed_at: iso(now), current_question_id: extra.firstQuestionId ?? null } };
      }
      if (s.state !== "closed") return refuse("state", s.state === "open" ? "Wait until time is up, or end early first." : "There is nothing to reveal yet.");
      return { ok: true, expect, patch: { state: "revealed", revealed_at: iso(now), current_question_id: extra.firstQuestionId ?? null, rev: s.rev + 1 } };
    case "step":
      if (s.state !== "revealed") return refuse("state", "Reveal the answers first.");
      if (!extra.questionId) return refuse("bad-request", "Choose a question.");
      if (extra.questionId === s.currentQuestionId) return { ok: true, noop: true };
      return { ok: true, expect, patch: { current_question_id: extra.questionId, rev: s.rev + 1 } };
  }
}

/** The patch a lazy close writes; null when the session doesn't need it. */
export function lazyClose(s: Plannable, now: number): { expect: { state: LiveState; rev: number }; patch: SessionPatch } | null {
  return needsLazyClose(s, now) ? { expect: { state: s.state, rev: s.rev }, patch: closePatch(s, now) } : null;
}
