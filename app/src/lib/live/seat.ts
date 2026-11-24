/**
 * What a phone keeps in localStorage for Live mode: a random device id (for the
 * join rate limit), its place in each session it joined (the token), the last
 * session (for "Rejoin as …"), answers not yet saved, and whether the student
 * pressed Submit (so a reload keeps them on the waiting screen).
 */

export const DEVICE_KEY = "funza.live.device";
export const LAST_KEY = "funza.live.last";
export const seatKey = (session: string) => `funza.live.${session}`;
export const pendingKey = (session: string) => `funza.live.${session}.pending`;
export const submittedKey = (session: string) => `funza.live.${session}.submitted`;

export type Seat = { token: string; participantId: string; name: string };
export type LastSeat = { session: string; name: string };

export function savedSeat(session: string): Seat | null {
  try {
    const seat = JSON.parse(localStorage.getItem(seatKey(session)) ?? "null") as Seat | null;
    return seat && typeof seat.token === "string" && typeof seat.name === "string" ? seat : null;
  } catch {
    return null;
  }
}

/** Forgets a session on this phone (after the teacher removed the student, or it ended). */
export function forgetSeat(session: string) {
  localStorage.removeItem(seatKey(session));
  localStorage.removeItem(pendingKey(session));
  localStorage.removeItem(submittedKey(session));
  try {
    const last = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as LastSeat | null;
    if (last?.session === session) localStorage.removeItem(LAST_KEY);
  } catch {}
}
