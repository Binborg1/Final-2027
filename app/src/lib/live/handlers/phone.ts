import { isValidCode, normalizeCode } from "@/lib/live/code";
import { markExact } from "@/lib/live/mark";
import { phoneView } from "@/lib/live/payload";
import { parseResponse } from "@/lib/live/questions";
import { allowed, clientAddress, retryAfter, type RateKind } from "@/lib/live/rate";
import { canAcceptAnswer, effectiveState } from "@/lib/live/state";
import { formatToken, newSecret, parseToken, TOKEN_HEADER, tokenMatches } from "@/lib/live/token";
import { currentSession, err, isObj, ok, UUID, type Deps, type Result } from "@/lib/live/handlers/result";
import type { StoredParticipant } from "@/lib/live/store";

/**
 * The three public routes a phone uses: join, state and answer. Students have no
 * account; each request after joining carries the student's token, checked
 * against its stored hash before anything is read or written.
 */

export const MAX_STUDENTS = 60;

export type PhoneRequest = { headers: Headers; url: string; crossSite: boolean };

const clean = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

const tooMany = (deps: Deps) => err(429, "rate", "Too many tries. Wait a moment and try again.", { headers: { "Retry-After": String(retryAfter(deps.now())) } });

async function limited(deps: Deps, kind: RateKind, subject: string) {
  return !(await allowed(deps.store.rateHit, kind, subject));
}

const crossSiteRefused = () => err(403, "forbidden", "Cross-site request refused.");

/** POST /api/live/join: {code, name, studentNo?, device} → {session, participantId, token, name}. */
export async function handleJoin(req: PhoneRequest, body: unknown, deps: Deps): Promise<Result> {
  if (req.crossSite) return crossSiteRefused();
  if (!isObj(body)) return err(400, "bad-request", "Invalid request.");
  const address = clientAddress(req.headers);
  const device = clean(body.device, 64) || address;
  if ((await limited(deps, "joinIp", address)) || (await limited(deps, "joinDevice", device))) return tooMany(deps);

  const code = normalizeCode(clean(body.code, 20));
  if (!isValidCode(code)) return err(400, "bad-code", "A code has 6 letters and numbers, like K7QM4P.");
  const name = clean(body.name, 60);
  if (!name) return err(400, "bad-name", "Type your name.");
  const studentNo = clean(body.studentNo, 30) || null;

  const session = await deps.store.openSessionByCode(code);
  if (!session) return err(404, "no-session", "No live session uses that code. Check the code on your teacher's screen.");
  const state = effectiveState(session, deps.now());
  if (state !== "lobby" && state !== "open") return err(409, "closed", "This session has stopped taking answers.");
  if (session.askStudentNo && !studentNo) return err(400, "needs-student-no", "Your teacher asks for your student number.");
  if ((await deps.store.participantCount(session.id)) >= MAX_STUDENTS) return err(409, "full", `This session is full (${MAX_STUDENTS} students).`);

  const { secret, hash } = newSecret();
  const p = await deps.store.addParticipant({ sessionId: session.id, teacherId: session.teacherId, name, studentNo: session.askStudentNo ? studentNo : null, tokenHash: hash });
  deps.ping(session.id, "teacher", "roster", session.rev);
  return ok({ session: session.id, participantId: p.id, token: formatToken(p.id, secret), name: p.name });
}

/** Finds the student a token belongs to, in this session; null for any mismatch. */
async function student(req: PhoneRequest, sessionId: string, deps: Deps, kind: RateKind): Promise<{ me: StoredParticipant } | Result> {
  const token = parseToken(req.headers.get(TOKEN_HEADER));
  if (!token || !UUID.test(sessionId)) return err(401, "unknown-token", "This phone isn't in the session any more. Join again with the code.");
  if (await limited(deps, kind, token.participantId)) return tooMany(deps);
  const me = await deps.store.participant(token.participantId);
  if (!me || me.sessionId !== sessionId.toLowerCase() || !tokenMatches(me.tokenHash, token.secret)) {
    return err(401, "unknown-token", "This phone isn't in the session any more. Join again with the code.");
  }
  return { me };
}

/** GET /api/live/state?session=<id>: what this phone should show now. */
export async function handleState(req: PhoneRequest, sessionId: string, deps: Deps): Promise<Result> {
  const who = await student(req, sessionId, deps, "state");
  if (!("me" in who)) return who;
  const session = await currentSession(deps, who.me.sessionId);
  if (!session) return err(401, "unknown-token", "This session has ended.");
  const [questions, mine] = await Promise.all([deps.store.questions(session.id), session.state === "lobby" ? Promise.resolve([]) : deps.store.answersOf(who.me.id)]);
  return ok(phoneView({ session, questions, me: who.me, mine, now: deps.now() }));
}

/** POST /api/live/answer: {session, questionId, response} → {questionId, savedAt}. Saving again replaces the answer. */
export async function handleAnswer(req: PhoneRequest, body: unknown, deps: Deps): Promise<Result> {
  if (req.crossSite) return crossSiteRefused();
  if (!isObj(body) || typeof body.session !== "string" || typeof body.questionId !== "string") return err(400, "bad-request", "Invalid request.");
  const who = await student(req, body.session, deps, "answer");
  if (!("me" in who)) return who;
  const { me } = who;
  const [session, question] = await Promise.all([currentSession(deps, me.sessionId), UUID.test(body.questionId) ? deps.store.question(me.sessionId, body.questionId.toLowerCase()) : Promise.resolve(null)]);
  if (!session) return err(401, "unknown-token", "This session has ended.");
  const now = deps.now();
  const accept = canAcceptAnswer(session, now);
  if (!accept.ok) return err(409, accept.reason, accept.reason === "not-open" ? "Your teacher hasn't started yet." : "Time is up. Answers are locked.");
  if (!question) return err(404, "no-question", "That question isn't in this session.");

  const response = parseResponse(question.content, body.response);
  if (response === null) return err(400, "bad-response", "That answer couldn't be read.");
  if (response === "empty") {
    await deps.store.deleteAnswer(me.id, question.id);
    deps.ping(session.id, "teacher", "answers", session.rev);
    return ok({ questionId: question.id, savedAt: null });
  }
  const mark = markExact(question.content, response);
  const savedAt = new Date(now).toISOString();
  await deps.store.saveAnswer({
    teacherId: me.teacherId,
    sessionId: session.id,
    participantId: me.id,
    questionId: question.id,
    response,
    correct: mark ? mark.correct : null,
    marks: mark ? mark.marks : null,
    markedBy: mark ? "code" : null,
    savedAt,
  });
  deps.ping(session.id, "teacher", "answers", session.rev);
  return ok({ questionId: question.id, savedAt });
}
