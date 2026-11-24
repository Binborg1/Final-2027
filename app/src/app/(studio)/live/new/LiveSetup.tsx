"use client";

import { ArrowRight, BookOpen, ClipboardCheck, FileText, Minus, Pencil, Plus, Sparkles, Ticket, Timer, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LiveSteps } from "@/components/live/LiveSteps";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ChoiceChip, CountPill, Tag } from "@/components/ui/Chip";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { LIVE_TYPE_LABEL } from "@/lib/live/questions";
import type { SetupData, SetupQuestion } from "@/lib/live/setup-data";
import { DEFAULT_LIVE_MIX } from "@/lib/live/suggest";
import { defaultBrief, QTYPE_LABEL } from "@/lib/resources/kinds";
import { sanitizeSections } from "@/lib/resources/sanitize";
import type { DifficultyPreset, Item, MixRow } from "@/lib/resources/types";
import { sourceText } from "@/lib/sources/actions";
import { cn } from "@/lib/ui/cn";

/**
 * L1 "Go live". Questions come from this chapter (its bank, plus anything Funza
 * suggests), one of the chapter's sources (Funza suggests from it), a saved quiz,
 * or the exit-ticket preset (3 questions, 3 minutes). The teacher keeps, edits or
 * skips each one and sets one timer for the whole set. Questions Funza wrote or
 * the teacher edited are saved as an approved quiz when the lobby opens.
 */

type Source = "chapter" | "sources" | "quiz" | "exit";
type Row = SetupQuestion & { edited: boolean };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const today = () => new Date().toLocaleDateString("en-CA", { day: "numeric", month: "short" });
const phoneReady = (r: Row) => r.notOnPhones === null;

const ASK: Record<"more" | "easier" | "harder", { label: string; mix: MixRow[]; difficulty: DifficultyPreset }> = {
  more: { label: "3 more", difficulty: "balanced", mix: [{ type: "mcq", count: 2, marks: 1 }, { type: "short", count: 1, marks: 2 }] },
  easier: { label: "Easier", difficulty: "review", mix: [{ type: "mcq", count: 2, marks: 1 }, { type: "tf", count: 1, marks: 1 }] },
  harder: { label: "Harder", difficulty: "challenge", mix: [{ type: "mcq", count: 1, marks: 1 }, { type: "calc", count: 1, marks: 2 }, { type: "short", count: 1, marks: 3 }] },
};

let seq = 0;

export function LiveSetup({ data, preset }: { data: SetupData; preset: "exit" | null }) {
  const router = useRouter();
  const startSource: Source = data.quiz ? "quiz" : preset === "exit" ? "exit" : "chapter";
  const [source, setSource] = useState<Source>(startSource);
  const base = (s: Source): Row[] => (s === "quiz" && data.quiz ? data.quiz.questions : data.bank).map((q) => ({ ...q, edited: false }));
  const [rows, setRows] = useState<Row[]>(() => base(startSource));
  const [kept, setKept] = useState<Set<string>>(() => {
    if (startSource === "quiz") return new Set(base("quiz").filter(phoneReady).map((r) => r.key));
    if (startSource === "exit") return new Set(base("exit").filter(phoneReady).slice(0, 3).map((r) => r.key));
    return new Set();
  });
  const [showSkipped, setShowSkipped] = useState(false);
  const [editing, setEditing] = useState<{ key: string; text: string } | null>(null);
  const [timerS, setTimerS] = useState(startSource === "exit" ? 180 : 300);
  const [title, setTitle] = useState(data.quiz ? data.quiz.title : `${startSource === "exit" ? "Exit ticket" : "Live"} · ${data.chapter?.title ?? data.course?.title ?? ""} · ${today()}`.slice(0, 120));
  const [askStudentNo, setAskStudentNo] = useState(true);
  const [sourceId, setSourceId] = useState(data.sources[0]?.id ?? "");
  const [busy, setBusy] = useState<null | "suggest" | "start">(null);
  const [message, setMessage] = useState<{ tone: "bad" | "info"; text: string; sessions?: SetupData["openSessions"] } | null>(null);
  const [remaining, setRemaining] = useState(data.remaining);

  const keptRows = rows.filter((r) => kept.has(r.key));
  const skipped = rows.filter((r) => !kept.has(r.key));
  const marks = keptRows.reduce((n, r) => n + r.item.marks, 0);
  const fromFunza = rows.filter((r) => r.source === "funza").length;
  const savesNew = keptRows.some((r) => r.bankId === null || r.edited);

  function choose(s: Source) {
    setSource(s);
    setMessage(null);
    if (s === "quiz") return; // the quiz list below picks one
    if (s === "exit") {
      setTimerS(180);
      const pool = rows.filter(phoneReady);
      setKept(new Set(pool.slice(0, 3).map((r) => r.key)));
      setTitle(`Exit ticket · ${data.chapter?.title ?? ""} · ${today()}`.slice(0, 120));
    }
  }

  const go = (q: Record<string, string>) => router.push(`/live/new?${new URLSearchParams(q).toString()}`);

  async function suggest(kind: "start" | keyof typeof ASK) {
    if (!data.course || !data.chapter) return;
    if (data.outcomes.length === 0) {
      setMessage({ tone: "info", text: "Funza suggests questions from a chapter's curriculum outcomes, and this chapter has none. Choose another chapter or a saved quiz." });
      return;
    }
    setBusy("suggest");
    setMessage(null);
    try {
      let material: { name: string; use: "source"; text: string } | null = null;
      if (source === "sources" && sourceId) {
        const s = await sourceText(sourceId);
        if (!s.ok) throw new Error(s.message);
        material = { name: s.title, use: "source", text: s.text.slice(0, 12000) };
      }
      const ask = kind === "start" ? { mix: DEFAULT_LIVE_MIX, difficulty: "balanced" as DifficultyPreset } : ASK[kind];
      const outcomeIds = data.outcomes.map((o) => o.id).slice(0, 6);
      const brief = { ...defaultBrief("quiz", outcomeIds), title, courseId: data.course.id, chapterIds: [data.chapter.id], difficulty: ask.difficulty, mix: ask.mix, material };
      const res = await fetch("/api/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "live-suggest", brief, avoid: rows.map((r) => r.item.prompt).slice(0, 40) }),
      });
      const json = (await res.json().catch(() => null)) as { ok: boolean; reason?: string; message?: string; data?: { sections: unknown; notices?: string[] } } | null;
      if (!json?.ok || !json.data) {
        if (json?.reason === "allowance") setRemaining(0);
        setMessage({ tone: "bad", text: json?.message ?? "Funza couldn't suggest questions. Try again." });
        return;
      }
      const items: Item[] = sanitizeSections(json.data.sections, { allowedOutcomes: new Set(outcomeIds), origin: "ai" }).flatMap((s) => s.items);
      const fresh: Row[] = items.map((item) => ({ key: `funza-${++seq}-${item.id}`, bankId: null, source: "funza", item: { ...item, origin: "ai" }, outcomeCode: data.outcomes.find((o) => item.outcomeIds.includes(o.id))?.code ?? null, notOnPhones: null, percentRight: null, edited: false }));
      setRows((r) => [...r, ...fresh]);
      setKept((k) => new Set([...k, ...fresh.map((f) => f.key)]));
      setRemaining((n) => (n === null ? null : Math.max(0, n - 1)));
      if (json.data.notices?.length) setMessage({ tone: "info", text: json.data.notices[0] });
    } catch (e) {
      setMessage({ tone: "bad", text: e instanceof Error && e.message ? e.message : "Funza couldn't suggest questions. Check your connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  function saveEdit() {
    if (!editing) return;
    const text = editing.text.trim();
    if (text) setRows((rs) => rs.map((r) => (r.key === editing.key ? { ...r, item: { ...r.item, prompt: text }, edited: r.item.prompt !== text || r.edited } : r)));
    setEditing(null);
  }

  async function openLobby() {
    if (!data.course || keptRows.length === 0) return;
    setBusy("start");
    setMessage(null);
    const id = crypto.randomUUID();
    const questions = keptRows.map((r) => (r.bankId && !r.edited ? { questionId: r.bankId } : { item: { ...r.item, origin: r.source === "funza" ? "ai" : r.item.origin } }));
    const allFromQuiz = data.quiz && keptRows.every((r) => r.source === "quiz" && !r.edited);
    try {
      const res = await fetch("/api/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, courseId: data.course.id, chapterId: data.chapter?.id ?? null, resourceVersionId: allFromQuiz ? data.quiz!.versionId : null, title: title.trim() || "Live session", timerS, askStudentNo, questions }),
      });
      const json = (await res.json().catch(() => null)) as { ok: boolean; reason?: string; message?: string; data?: unknown } | null;
      if (!json?.ok) {
        setMessage({ tone: "bad", text: json?.message ?? "Funza couldn't open the lobby. Try again.", sessions: json?.reason === "too-many-open" ? (json.data as SetupData["openSessions"]) : undefined });
        setBusy(null);
        return;
      }
      router.push(`/live/${id}`);
    } catch {
      setMessage({ tone: "bad", text: "Funza couldn't open the lobby. Check your connection and try again." });
      setBusy(null);
    }
  }

  const listTitle =
    source === "quiz" && data.quiz
      ? `${data.quiz.title}: ${rows.length} question${rows.length === 1 ? "" : "s"}`
      : fromFunza > 0
        ? `Funza suggested ${fromFunza} question${fromFunza === 1 ? "" : "s"}`
        : `${data.chapter?.title ?? "This chapter"}: ${rows.length} in the question bank`;

  const crumbs = useMemo(
    () => [
      ...(data.course ? [{ label: data.course.title, href: `/courses/${data.course.id}` }] : []),
      ...(data.course && data.chapter ? [{ label: data.chapter.title, href: `/courses/${data.course.id}/chapters/${data.chapter.id}` }] : []),
      { label: "Go live" },
    ],
    [data.course, data.chapter],
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader crumbs={crumbs} title="Go live" summary={[title, data.course?.title, data.chapter?.title].filter(Boolean).join(" · ")} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-badge font-semibold tracking-wider text-ink-2 uppercase">Source</span>
        <ChoiceChip size="md" selected={source === "chapter"} icon={BookOpen} onClick={() => choose("chapter")}>
          This chapter
        </ChoiceChip>
        <ChoiceChip size="md" selected={source === "sources"} icon={FileText} onClick={() => choose("sources")}>
          Upload a PDF or notes
        </ChoiceChip>
        <ChoiceChip size="md" selected={source === "quiz"} icon={ClipboardCheck} onClick={() => choose("quiz")}>
          A saved quiz
        </ChoiceChip>
        <ChoiceChip size="md" selected={source === "exit"} icon={Ticket} onClick={() => choose("exit")}>
          Exit ticket preset
        </ChoiceChip>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <Card className="flex flex-wrap items-end gap-3 px-5 py-4">
            <Field id="course" label="Course" className="min-w-[180px] flex-1">
              <Select id="course" value={data.course?.id ?? ""} onChange={(e) => go({ course: e.target.value })}>
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="chapter" label="Chapter" className="min-w-[180px] flex-1">
              <Select id="chapter" value={data.chapter?.id ?? ""} onChange={(e) => go({ course: data.course?.id ?? "", chapter: e.target.value })} disabled={data.chapters.length === 0}>
                {data.chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
            {source === "quiz" ? (
              <Field id="quiz" label="Saved quiz" className="min-w-[200px] flex-1">
                <Select id="quiz" value={data.quiz?.id ?? ""} onChange={(e) => e.target.value && go({ quiz: e.target.value })}>
                  <option value="">{data.quizzes.length ? "Choose a quiz" : "No approved quizzes yet"}</option>
                  {data.quizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {source === "sources" ? (
              <Field id="source" label="Source" className="min-w-[200px] flex-1">
                <Select id="source" value={sourceId} onChange={(e) => setSourceId(e.target.value)} disabled={data.sources.length === 0}>
                  {data.sources.length === 0 ? <option value="">No sources with text yet</option> : null}
                  {data.sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </Card>

          {message ? (
            <div role={message.tone === "bad" ? "alert" : "status"} className={cn("rounded-card px-5 py-3 text-row font-medium", message.tone === "bad" ? "bg-red-tint text-red-ink" : "bg-amber-tint text-amber-ink")}>
              {message.text}
              {message.sessions?.length ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {message.sessions.map((s) => (
                    <li key={s.id}>
                      <Link className="font-semibold underline" href={`/live/${s.id}`}>
                        {s.title} ({s.code})
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <Card className="flex flex-col gap-3 px-5 pt-5 pb-4" aria-labelledby="questions-title">
            <CardHeader id="questions-title" title={listTitle} after={keptRows.length ? <CountPill>You kept {keptRows.length}</CountPill> : null} actions={skipped.length ? <button type="button" onClick={() => setShowSkipped((v) => !v)} className="text-body font-semibold text-accent-ink hover:underline">{showSkipped ? "Hide" : "Show"} the {skipped.length} you skipped</button> : null} />
            {source === "sources" && data.sources.length === 0 ? (
              <p className="text-body text-ink-2">
                Add notes or a PDF on the{" "}
                {data.course && data.chapter ? (
                  <Link className="font-semibold text-accent-ink underline" href={`/courses/${data.course.id}/chapters/${data.chapter.id}`}>
                    chapter page
                  </Link>
                ) : (
                  "chapter page"
                )}
                , then Funza can suggest questions from it.
              </p>
            ) : null}
            {rows.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-tile bg-tile px-4 py-5">
                <p className="text-row font-medium text-ink">{source === "quiz" ? "Choose a saved quiz above." : "This chapter's question bank is empty. Funza can suggest questions from its outcomes."}</p>
                {source !== "quiz" ? (
                  <Button variant="secondary" icon={Sparkles} loading={busy === "suggest"} disabled={busy !== null || remaining === 0} onClick={() => suggest("start")}>
                    Suggest 8 questions
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {(showSkipped ? rows : keptRows).map((r) => (
                  <QuestionRow
                    key={r.key}
                    row={r}
                    n={keptRows.indexOf(r) + 1}
                    kept={kept.has(r.key)}
                    quizTitle={data.quiz?.title ?? null}
                    quizId={data.quiz?.id ?? null}
                    editing={editing?.key === r.key ? editing.text : null}
                    onToggle={() => setKept((k) => (k.has(r.key) ? new Set([...k].filter((x) => x !== r.key)) : new Set([...k, r.key])))}
                    onEdit={() => setEditing({ key: r.key, text: r.item.prompt })}
                    onEditText={(text) => setEditing({ key: r.key, text })}
                    onSave={saveEdit}
                    onCancel={() => setEditing(null)}
                  />
                ))}
                {!showSkipped && keptRows.length === 0 ? <li className="py-4 text-body text-ink-2">Tick the questions to use. {skipped.length ? `Show the ${skipped.length} you skipped to choose.` : ""}</li> : null}
              </ul>
            )}
            {source !== "quiz" && rows.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <span className="text-body font-medium text-ink-2">Ask Funza for</span>
                {(Object.keys(ASK) as (keyof typeof ASK)[]).map((k) => (
                  <ChoiceChip key={k} size="sm" icon={k === "more" ? Plus : undefined} disabled={busy !== null || remaining === 0} onClick={() => suggest(k)}>
                    {ASK[k].label}
                  </ChoiceChip>
                ))}
                {busy === "suggest" ? <span className="text-body text-ink-2">Funza is writing…</span> : null}
                {remaining !== null && remaining <= 5 ? <span className="ml-auto text-meta text-ink-2">{remaining} Funza action{remaining === 1 ? "" : "s"} left today</span> : null}
              </div>
            ) : null}
          </Card>
        </div>

        <Card className="flex flex-col gap-4 px-5 pt-5 pb-5 lg:sticky lg:top-4" aria-labelledby="settings-title">
          <CardHeader id="settings-title" title="Session settings" size="sm" />
          <div className="rounded-tile bg-tile px-4 py-3">
            <p className="flex items-center gap-1.5 text-body font-semibold text-ink">
              <Timer aria-hidden size={16} strokeWidth={1.75} /> Timer <span className="font-medium text-ink-2">for the whole set</span>
            </p>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" aria-label="30 seconds less" disabled={timerS <= 60} onClick={() => setTimerS((t) => Math.max(60, t - 30))} className="flex size-11 items-center justify-center rounded-full border border-line-2 bg-white disabled:opacity-40">
                <Minus aria-hidden size={18} />
              </button>
              <output aria-live="polite" className="text-hero font-bold tabular-nums">
                {mmss(timerS)}
              </output>
              <button type="button" aria-label="30 seconds more" disabled={timerS >= 3600} onClick={() => setTimerS((t) => Math.min(3600, t + 30))} className="flex size-11 items-center justify-center rounded-full border border-line-2 bg-white disabled:opacity-40">
                <Plus aria-hidden size={18} />
              </button>
            </div>
          </div>
          <Field id="title" label="Title">
            <Input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div>
            <p className="text-badge font-semibold tracking-wider text-ink-2 uppercase">Students type</p>
            <div className="mt-1 flex items-center justify-between gap-3 border-b border-line py-2">
              <span>
                <span className="block text-body font-semibold">Name</span>
                <span className="block text-meta text-ink-2">Shown to you, never on the projector</span>
              </span>
              <Switch checked label="Name (always asked)" disabled />
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-line py-2">
              <span>
                <span className="block text-body font-semibold">Student number</span>
                <span className="block text-meta text-ink-2">Matches answers to your class list</span>
              </span>
              <Switch checked={askStudentNo} onChange={setAskStudentNo} label="Ask for the student number" />
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-line py-2">
              <span>
                <span className="block text-body font-semibold">Pacing</span>
                <span className="block text-meta text-ink-2">Whole set at once</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="block text-body font-semibold">Leaderboard</span>
                <span className="block text-meta text-ink-2">Off · students see only their own result</span>
              </span>
              <Switch checked={false} label="Leaderboard (not in this version)" disabled />
            </div>
          </div>
          <div className="rounded-tile bg-tile px-4 py-3">
            <p className="text-body font-bold">
              {keptRows.length} question{keptRows.length === 1 ? "" : "s"} · {marks} mark{marks === 1 ? "" : "s"} · {mmss(timerS)}
            </p>
            <p className="mt-1 text-meta text-ink-2">The lobby shows a QR code and a join code on the projector.{savesNew ? " New and edited questions are saved to this chapter's bank as an approved quiz." : ""}</p>
          </div>
          <Button size="lg" iconRight={ArrowRight} loading={busy === "start"} disabled={keptRows.length === 0 || busy !== null} onClick={openLobby}>
            Open the lobby
          </Button>
        </Card>
      </div>

      <LiveSteps current={0} />
    </div>
  );
}

function QuestionRow(props: {
  row: Row;
  n: number;
  kept: boolean;
  quizTitle: string | null;
  quizId: string | null;
  editing: string | null;
  onToggle: () => void;
  onEdit: () => void;
  onEditText: (t: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { row, n, kept, editing } = props;
  const blocked = row.notOnPhones !== null;
  const typeLabel = row.item.type in LIVE_TYPE_LABEL ? LIVE_TYPE_LABEL[row.item.type as keyof typeof LIVE_TYPE_LABEL] : QTYPE_LABEL[row.item.type];
  const from = row.source === "funza" ? "Funza" : row.source === "quiz" ? `from ${props.quizTitle ?? "the quiz"}` : "from your question bank";
  return (
    <li className={cn("flex items-start gap-3 py-3", blocked && "opacity-60")}>
      <Checkbox checked={kept} disabled={blocked} onChange={props.onToggle} aria-label={`Use question: ${row.item.prompt.slice(0, 80)}`} className="mt-0.5" />
      <span className="w-7 shrink-0 pt-0.5 text-body font-bold text-ink-2">{kept && n > 0 ? `Q${n}` : ""}</span>
      <div className="min-w-0 flex-1">
        {editing !== null ? (
          <div className="flex flex-col gap-2">
            <Textarea aria-label="Question wording" value={editing} maxLength={1500} rows={3} onChange={(e) => props.onEditText(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <Button size="sm" onClick={props.onSave}>
                Save wording
              </Button>
              <Button size="sm" variant="ghost" icon={Undo2} onClick={props.onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-row font-medium text-ink">{row.item.prompt}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-2">
          <Tag className="bg-white">{typeLabel}</Tag>
          <span>
            {row.item.marks} mark{row.item.marks === 1 ? "" : "s"}
          </span>
          {row.outcomeCode ? <span>· {row.outcomeCode}</span> : null}
          <span>· {from}</span>
          {row.edited ? <span className="font-semibold text-accent-ink">· Edited</span> : null}
          {row.percentRight !== null ? <span>· {row.percentRight}% right in class</span> : null}
          {blocked ? <span className="font-semibold">· {row.notOnPhones}</span> : null}
        </div>
      </div>
      {!blocked && editing === null ? (
        row.source === "quiz" && props.quizId ? (
          <Link href={`/make/${props.quizId}`} className="shrink-0 rounded-full px-3 py-2 text-body font-semibold text-accent-ink hover:bg-white/60" title="An approved quiz can't change here. Edit it in Review as a new version.">
            Edit in Review
          </Link>
        ) : (
          <button type="button" onClick={props.onEdit} aria-label="Edit the wording" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line-2 bg-white hover:bg-raised">
            <Pencil aria-hidden size={16} strokeWidth={1.75} />
          </button>
        )
      ) : null}
    </li>
  );
}
