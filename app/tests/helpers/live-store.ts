// An in-memory LiveStore for route tests. It keeps the database's rules that the
// handlers rely on: one open session per join code, one answer per student per
// question, conditional session updates, set_live_marks() and end_live_session().
// A teacher's view (`as: teacherId`) sees only that teacher's sessions, like
// row-level security.
import type { SessionPatch } from "@/lib/live/state";
import type { BankQuestion, LiveStore, MarkBy, NewAnswer, StoredParticipant } from "@/lib/live/store";
import type { LiveAnswer, LiveQuestion, LiveSession } from "@/lib/live/types";

export type MemoryDb = {
  courses: Map<string, string>; // course id → teacher id
  sessions: LiveSession[];
  questions: (LiveQuestion & { sessionId: string })[];
  participants: StoredParticipant[];
  answers: (LiveAnswer & { sessionId: string; teacherId: string })[];
  bank: (BankQuestion & { teacherId: string; answerCount: number; correctCount: number; timesUsed: number })[];
  hits: Map<string, number>;
  /** Ids handed out, in order. */
  seq: number;
};

export const emptyDb = (): MemoryDb => ({ courses: new Map(), sessions: [], questions: [], participants: [], answers: [], bank: [], hits: new Map(), seq: 0 });

const uuid = (db: MemoryDb) => `00000000-0000-4000-8000-${String(++db.seq).padStart(12, "0")}`;

class DbError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function memoryStore(db: MemoryDb, opts: { as?: string; now?: () => number } = {}): LiveStore {
  const now = opts.now ?? Date.now;
  const visible = (s: LiveSession | undefined) => (s && (!opts.as || s.teacherId === opts.as) ? s : undefined);
  const sessionOf = (id: string) => visible(db.sessions.find((s) => s.id === id));
  const toAnswer = ({ sessionId: _s, teacherId: _t, ...a }: MemoryDb["answers"][number]): LiveAnswer => (void _s, void _t, { ...a });
  const toQuestion = ({ sessionId: _s, ...q }: MemoryDb["questions"][number]): LiveQuestion => (void _s, structuredClone(q));

  return {
    async session(id) {
      const s = sessionOf(id);
      return s ? { ...s } : null;
    },
    async openSessionByCode(code) {
      const s = db.sessions.find((x) => x.code === code && x.state !== "ended");
      return s ? { ...s } : null;
    },
    async openSessions(teacherId) {
      return db.sessions.filter((s) => s.teacherId === teacherId && s.state !== "ended").map((s) => ({ ...s }));
    },
    async insertSession(row) {
      if (db.sessions.some((s) => s.id === row.id)) return "exists";
      if (db.courses.get(row.courseId) !== row.teacherId) return "bad-ref";
      if (db.sessions.some((s) => s.code === row.code && s.state !== "ended")) return "code-taken";
      db.sessions.push({
        id: row.id,
        teacherId: row.teacherId,
        courseId: row.courseId,
        chapterId: row.chapterId,
        resourceVersionId: row.resourceVersionId,
        code: row.code,
        title: row.title,
        state: "lobby",
        timerS: row.timerS,
        askStudentNo: row.askStudentNo,
        createdAt: new Date(now()).toISOString(),
        openedAt: null,
        endsAt: null,
        closedAt: null,
        revealedAt: null,
        endedAt: null,
        currentQuestionId: null,
        rev: 0,
        studentsPurgedAt: null,
      });
      return "ok";
    },
    async updateSession(id, expect, patch: SessionPatch) {
      const s = sessionOf(id);
      if (!s || s.state !== expect.state || s.rev !== expect.rev) return null;
      if (patch.state !== undefined) s.state = patch.state;
      if (patch.opened_at !== undefined) s.openedAt = patch.opened_at;
      if (patch.ends_at !== undefined) s.endsAt = patch.ends_at;
      if (patch.closed_at !== undefined) s.closedAt = patch.closed_at;
      if (patch.revealed_at !== undefined) s.revealedAt = patch.revealed_at;
      if (patch.current_question_id !== undefined) s.currentQuestionId = patch.current_question_id;
      s.rev = patch.rev;
      return { ...s };
    },
    async deleteSession(id) {
      db.sessions = db.sessions.filter((s) => s.id !== id || !visible(s));
      db.questions = db.questions.filter((q) => q.sessionId !== id);
    },
    async endSession(id) {
      const s = sessionOf(id);
      if (!s) throw new DbError("P0002", "That session doesn't exist.");
      if (s.state === "ended") return;
      for (const q of db.questions.filter((x) => x.sessionId === id)) {
        const mine = db.answers.filter((a) => a.questionId === q.id);
        q.answerCount = mine.length;
        q.correctCount = mine.filter((a) => a.correct).length;
        if (s.revealedAt && q.questionId) {
          const b = db.bank.find((x) => x.id === q.questionId);
          if (b) {
            b.answerCount += q.answerCount;
            b.correctCount += q.correctCount;
            b.timesUsed++;
          }
        }
      }
      s.state = "ended";
      s.endedAt = new Date(now()).toISOString();
      s.currentQuestionId = null;
      s.rev++;
    },

    async questions(sessionId) {
      if (!db.sessions.some((s) => s.id === sessionId && visible(s))) return [];
      return db.questions.filter((q) => q.sessionId === sessionId).sort((a, b) => a.position - b.position).map(toQuestion);
    },
    async question(sessionId, id) {
      const q = db.questions.find((x) => x.sessionId === sessionId && x.id === id);
      return q && sessionOf(sessionId) ? toQuestion(q) : null;
    },
    async insertQuestions(rows) {
      for (const r of rows) {
        if (db.questions.some((q) => q.sessionId === r.sessionId && q.position === r.position)) throw new DbError("23505", "two live questions cannot share a position");
        db.questions.push({ id: uuid(db), sessionId: r.sessionId, position: r.position, questionId: r.questionId, content: structuredClone(r.content), markState: "none", markStartedAt: null, markNote: null, answerCount: null, correctCount: null });
      }
    },
    async bankQuestions(ids) {
      return db.bank.filter((b) => ids.includes(b.id) && (!opts.as || b.teacherId === opts.as)).map(({ id, type, stem, options, answer, marks, outcome_ref, retired }) => ({ id, type, stem, options, answer, marks, outcome_ref, retired }));
    },
    async claimMarking(sessionId, ids, staleBefore, retryFailed) {
      const won: string[] = [];
      for (const q of db.questions.filter((x) => x.sessionId === sessionId && ids.includes(x.id))) {
        const stale = q.markState === "running" && (q.markStartedAt ?? "") < staleBefore;
        if (q.markState === "none" || stale || (retryFailed && q.markState === "failed")) {
          q.markState = "running";
          q.markStartedAt = new Date(now()).toISOString();
          q.markNote = null;
          won.push(q.id);
        }
      }
      return won;
    },
    async finishMarking(id, state, note) {
      const q = db.questions.find((x) => x.id === id);
      if (q) {
        q.markState = state;
        q.markNote = note;
      }
    },

    async participant(id) {
      const p = db.participants.find((x) => x.id === id);
      return p ? { ...p } : null;
    },
    async participants(sessionId) {
      if (!sessionOf(sessionId)) return [];
      return db.participants.filter((p) => p.sessionId === sessionId).map(({ id, name, studentNo, joinedAt }) => ({ id, name, studentNo, joinedAt }));
    },
    async participantCount(sessionId) {
      return db.participants.filter((p) => p.sessionId === sessionId).length;
    },
    async addParticipant(row) {
      const p: StoredParticipant = { id: uuid(db), name: row.name, studentNo: row.studentNo, joinedAt: new Date(now()).toISOString(), sessionId: row.sessionId, teacherId: row.teacherId, tokenHash: row.tokenHash };
      db.participants.push(p);
      return { id: p.id, name: p.name, studentNo: p.studentNo, joinedAt: p.joinedAt };
    },
    async removeParticipant(sessionId, id) {
      if (!sessionOf(sessionId)) return false;
      const before = db.participants.length;
      db.participants = db.participants.filter((p) => !(p.sessionId === sessionId && p.id === id));
      db.answers = db.answers.filter((a) => a.participantId !== id);
      return db.participants.length < before;
    },

    async answersOf(participantId) {
      return db.answers.filter((a) => a.participantId === participantId).map(toAnswer);
    },
    async answers(sessionId) {
      if (!sessionOf(sessionId)) return [];
      return db.answers.filter((a) => a.sessionId === sessionId).map(toAnswer);
    },
    async answer(sessionId, id) {
      const a = db.answers.find((x) => x.sessionId === sessionId && x.id === id);
      return a && sessionOf(sessionId) ? toAnswer(a) : null;
    },
    async saveAnswer(row: NewAnswer) {
      const existing = db.answers.find((a) => a.participantId === row.participantId && a.questionId === row.questionId);
      const fields = { response: row.response, correct: row.correct, marks: row.marks, markedBy: row.markedBy, aiMarks: null, savedAt: row.savedAt };
      if (existing) Object.assign(existing, fields);
      else db.answers.push({ id: uuid(db), sessionId: row.sessionId, teacherId: row.teacherId, participantId: row.participantId, questionId: row.questionId, ...fields });
    },
    async deleteAnswer(participantId, questionId) {
      db.answers = db.answers.filter((a) => !(a.participantId === participantId && a.questionId === questionId));
    },
    async setMarks(sessionId, by: MarkBy, marks) {
      const s = sessionOf(sessionId);
      if (!s || (s.state !== "closed" && s.state !== "revealed")) throw new DbError("23514", "Marks change only after time is up and before the session ends.");
      let n = 0;
      for (const m of marks) {
        const a = db.answers.find((x) => x.id === m.id && x.sessionId === sessionId);
        const q = a && db.questions.find((x) => x.id === a.questionId);
        if (!a || !q) continue;
        const max = q.content.marks;
        const clamp = (v: number | null) => (v === null ? null : Math.min(Math.max(Math.round(v), 0), max));
        if (by === "ai") {
          a.aiMarks = clamp(m.marks);
          if (a.markedBy !== "teacher") {
            a.marks = a.aiMarks;
            a.markedBy = "ai";
          }
        } else if (by === "undo") {
          a.marks = a.aiMarks;
          a.markedBy = a.aiMarks === null ? null : "ai";
        } else {
          a.marks = clamp(m.marks);
          a.markedBy = by;
        }
        a.correct = a.marks === null ? null : a.marks >= max;
        n++;
      }
      return n;
    },

    async rateHit(key, limit) {
      const minute = Math.floor(now() / 60_000);
      const k = `${key}@${minute}`;
      const n = (db.hits.get(k) ?? 0) + 1;
      db.hits.set(k, n);
      return n <= limit;
    },
  };
}
