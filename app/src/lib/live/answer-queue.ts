import type { LiveResponse } from "@/lib/live/types";

/**
 * A phone's answers on their way to the server. Each question has at most one
 * save in flight; a newer answer replaces an older one still waiting, so the last
 * thing the student chose is what gets saved. Answers not yet saved are kept in
 * localStorage, so a reload or a dropped Wi-Fi connection loses nothing (FR-11).
 * A question shows "Saved" only after the server confirmed its newest answer.
 */

export type SaveStatus = "saving" | "saved" | "retrying" | "locked" | "failed";
/** An empty text clears the answer on the server. */
export type Outgoing = LiveResponse;
export type SendResult = { ok: true } | { ok: false; status: number; reason?: string; retryAfter?: number };
export type Sender = (questionId: string, response: Outgoing) => Promise<SendResult>;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const BACKOFF = [500, 1000, 2000, 4000, 8000];

export class AnswerQueue {
  private pending = new Map<string, Outgoing>();
  private states = new Map<string, SaveStatus>();
  private running = new Set<string>();
  private stopped = false;
  private send: Sender;
  private storage: Store | null;
  private key: string;
  private onChange: () => void;
  private sleep: (ms: number) => Promise<void>;
  /** Set when the server says this phone is no longer in the session. */
  gone = false;

  constructor(opts: { send: Sender; key: string; onChange?: () => void; storage?: Store | null; sleep?: (ms: number) => Promise<void> }) {
    this.send = opts.send;
    this.key = opts.key;
    this.storage = opts.storage ?? null;
    this.onChange = opts.onChange ?? (() => {});
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Answers left unsent by an earlier page (a reload, a closed tab), sent again now. */
  restore(): void {
    const raw = this.storage?.getItem(this.key);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Record<string, Outgoing>;
      for (const [qid, r] of Object.entries(saved)) if (!this.pending.has(qid)) this.set(qid, r);
    } catch {
      this.storage?.removeItem(this.key);
    }
  }

  set(questionId: string, response: Outgoing): void {
    if (this.stopped || this.states.get(questionId) === "locked") return;
    this.pending.set(questionId, response);
    this.persist();
    this.mark(questionId, "saving");
    void this.run(questionId);
  }

  status(questionId: string): SaveStatus | undefined {
    return this.states.get(questionId);
  }

  /** The answers still waiting, by question (to keep them on screen over the server's older copy). */
  waiting(): Map<string, Outgoing> {
    return new Map(this.pending);
  }

  get unsent(): number {
    return this.pending.size;
  }

  /** At 0:00: nothing new can be set; what is waiting is still sent (the server allows a 2-second grace). */
  stop(): void {
    this.stopped = true;
  }

  private mark(questionId: string, s: SaveStatus) {
    if (this.states.get(questionId) === s) return;
    this.states.set(questionId, s);
    this.onChange();
  }

  private persist() {
    if (!this.storage) return;
    if (this.pending.size === 0) this.storage.removeItem(this.key);
    else this.storage.setItem(this.key, JSON.stringify(Object.fromEntries(this.pending)));
  }

  private async run(questionId: string) {
    if (this.running.has(questionId)) return; // the running loop picks up the newest answer
    this.running.add(questionId);
    try {
      let tries = 0;
      while (this.pending.has(questionId) && !this.gone) {
        const response = this.pending.get(questionId)!;
        let result: SendResult;
        try {
          result = await this.send(questionId, response);
        } catch {
          result = { ok: false, status: 0 };
        }
        const newer = this.pending.get(questionId) !== response;
        if (result.ok) {
          if (!newer) {
            this.pending.delete(questionId);
            this.persist();
            this.mark(questionId, "saved");
          }
          tries = 0;
          continue;
        }
        if (result.status === 409) {
          // Locked (time is up) or not open yet: nothing more to send for this question.
          this.pending.delete(questionId);
          this.persist();
          this.mark(questionId, result.reason === "not-open" ? "failed" : "locked");
          return;
        }
        if (result.status === 401) {
          this.gone = true;
          this.mark(questionId, "failed");
          return;
        }
        if (result.status === 400 || result.status === 404) {
          if (!newer) {
            this.pending.delete(questionId);
            this.persist();
            this.mark(questionId, "failed");
          }
          continue;
        }
        // Offline, a server error or too many requests: wait, then try again.
        this.mark(questionId, "retrying");
        const wait = result.status === 429 && result.retryAfter ? result.retryAfter * 1000 : BACKOFF[Math.min(tries, BACKOFF.length - 1)];
        tries++;
        await this.sleep(wait);
        if (this.pending.has(questionId)) this.mark(questionId, "saving");
      }
    } finally {
      this.running.delete(questionId);
    }
  }
}
