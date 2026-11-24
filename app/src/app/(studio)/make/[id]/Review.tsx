"use client";

import { ArrowRight, Check, ChevronDown, ChevronRight, Circle, CircleAlert, CircleCheck, Copy, Ellipsis, FileQuestion, Info, Lock, MoveDown, MoveUp, PenLine, RotateCcw, Sparkles, Trash2, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, Kbd, Overline } from "@/components/ui/Card";
import { ChoiceChip, StatusChip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Field";
import { EmptyState, Progress } from "@/components/ui/Misc";
import { codeOf } from "@/lib/curriculum/sources";
import { approvalBlockers, computeChecks, itemReview, numbering, reviewables, sectionReview, totalMarks, type ReviewState } from "@/lib/resources/checks";
import { kindInfo, QTYPE_LABEL } from "@/lib/resources/kinds";
import { acceptAlt, applyFix, approve, deleteItem, discardAlt, dismissNotices, duplicateItem, markReviewed, moveItem, regenerateItem, setGlobal, setTitle, startNewVersion, updateItem, updateSection, useWorkspace } from "@/lib/resources/store";
import type { CheckRow, Draft, Item, Section } from "@/lib/resources/types";
import { PublishPanel } from "./PublishPanel";
import { cn } from "@/lib/ui/cn";

type Part = { id: string; kind: "item"; item: Item; section: Section; number: number } | { id: string; kind: "section"; section: Section };

function partsOf(d: Draft): Part[] {
  const num = numbering(d.sections);
  return d.sections.flatMap((s): Part[] => (s.kind === "questions" ? s.items.map((item) => ({ id: item.id, kind: "item", item, section: s, number: num.get(item.id) ?? 0 })) : [{ id: s.id, kind: "section", section: s }]));
}
const stateOf = (p: Part): ReviewState => (p.kind === "item" ? itemReview(p.item) : sectionReview(p.section));
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/**
 * P1 Review. The teacher reads each part, fixes it or asks Funza to redo it, and
 * marks it reviewed (R); N jumps to the next part that needs them, J/K move.
 * Approve stays locked until every check passes and every part is reviewed.
 */
export function Review({ id }: { id: string }) {
  const ws = useWorkspace();
  const draft = ws.drafts[id];
  const resource = ws.resources.find((r) => r.id === id);
  const parts = useMemo(() => (draft ? partsOf(draft) : []), [draft]);
  const [selected, setSelected] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvingBusy, setApprovingBusy] = useState(false);
  const rows = useMemo(() => (draft ? computeChecks(draft) : []), [draft, ws.catalogVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const blockers = approvalBlockers(rows);
  const rv = draft ? reviewables(draft) : [];
  const checked = rv.filter((r) => r.state === "reviewed").length;
  const approved = draft?.status === "approved";

  const current = parts.find((p) => p.id === selected) ?? parts.find((p) => stateOf(p) !== "reviewed") ?? parts[0];
  const index = current ? parts.indexOf(current) : -1;

  const nextNeeding = useCallback(() => {
    const order = [...parts.slice(index + 1), ...parts.slice(0, index + 1)];
    const next = order.find((p) => stateOf(p) !== "reviewed");
    if (next) setSelected(next.id);
  }, [parts, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey || !draft || approved) return;
      const k = e.key.toLowerCase();
      if (k === "n") nextNeeding();
      else if (k === "j" && index < parts.length - 1) setSelected(parts[index + 1].id);
      else if (k === "k" && index > 0) setSelected(parts[index - 1].id);
      else if (k === "r" && current) markReviewed(id, current.id, true);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, approved, nextNeeding, index, parts, current, id]);

  if (!ws.hydrated) return <p className="text-body text-ink-2">Loading your draft…</p>;
  if (!draft || !resource) {
    return (
      <Card className="p-6">
        <EmptyState icon={FileQuestion} title="This draft wasn’t found" action={<ButtonLink href="/make" icon={Sparkles}>Make something</ButtonLink>}>
          It may have been deleted, or it belongs to another account.
        </EmptyState>
      </Card>
    );
  }

  const count = parts.filter((p) => p.kind === "item").length;
  const meta = [`${draft.sections.length} section${draft.sections.length === 1 ? "" : "s"}`, count > 0 ? `${count} questions` : null, count > 0 ? `${totalMarks(draft)} marks` : null, draft.duration ? `${draft.duration} min` : null].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: resource.courseName || "Make", href: "/make" }, { label: kindInfo(draft.kind).label }]}
        size="title-sm"
        title={<TitleEditor id={id} title={draft.title} disabled={approved} />}
        summary={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusChip status={approved ? "approved" : "draft"} />
            <span className="inline-flex h-6 items-center rounded-sm border border-white/90 bg-white/55 px-2 text-badge font-semibold">v{draft.version}</span>
            <span className="text-body font-medium">{meta}</span>
            <span className="flex items-center gap-2 text-body font-medium">
              <Progress value={checked} max={rv.length} label="Parts checked" className="w-[120px]" />
              {checked} of {rv.length} parts checked
            </span>
          </span>
        }
        actions={
          approved ? (
            <Button variant="secondary" icon={PenLine} onClick={() => void startNewVersion(id)}>
              Start a new version
            </Button>
          ) : blockers.length > 0 ? (
            <>
              <span className="flex items-center gap-2">
                <Button variant="secondary" icon={Lock} disabled title="Review every part and clear every check first" className="h-11 bg-white/40">
                  Approve
                </Button>
                <span className="inline-flex h-7 items-center rounded-full bg-white/70 px-3 text-meta font-semibold text-ink-2">
                  {blockers.length} to clear
                </span>
              </span>
              <Button iconRight={ArrowRight} onClick={nextNeeding}>
                Next part that needs you <Kbd tone="on-accent" className="ml-1">N</Kbd>
              </Button>
            </>
          ) : (
            <Button icon={Check} onClick={() => setApproving(true)}>
              Approve
            </Button>
          )
        }
      />

      {draft.notices.length > 0 ? (
        <div role="status" className="flex items-start gap-3 rounded-tile bg-amber-tint px-4 py-3 text-body text-amber-ink">
          <Info aria-hidden size={18} className="mt-px shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Funza left some things out:</p>
            <ul className="mt-1 list-disc pl-5">
              {draft.notices.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
          <button type="button" onClick={() => dismissNotices(id)} aria-label="Dismiss" className="flex size-8 items-center justify-center rounded-full hover:bg-white/50">
            <X aria-hidden size={16} />
          </button>
        </div>
      ) : null}

      {approved ? <PublishPanel id={id} title={draft.title} kind={draft.kind} version={draft.version} /> : null}

      {/* Columns follow the panel's width (it narrows when the sidebar is open), not the window's. */}
      <div className="@container">
      <div className="grid grid-cols-1 items-start gap-5 @min-[720px]:grid-cols-[minmax(0,1fr)_300px] @min-[1000px]:grid-cols-[220px_minmax(0,1fr)_300px] @min-[1240px]:grid-cols-[268px_minmax(0,1fr)_392px]">
        <Outline draft={draft} parts={parts} currentId={current?.id ?? null} onSelect={setSelected} className="order-3 @min-[720px]:col-span-2 @min-[1000px]:order-none @min-[1000px]:col-span-1" />
        <div className="order-1 flex min-w-0 flex-col gap-3 @min-[1000px]:order-none">
          {index > 0 ? <Collapsed part={parts[index - 1]} onSelect={setSelected} /> : null}
          {current ? <PartCard key={current.id} draftId={id} draft={draft} part={current} approved={approved} onNext={nextNeeding} /> : <Card className="p-6 text-body text-ink-2">This draft is empty.</Card>}
          {index >= 0 && index < parts.length - 1 ? <Collapsed part={parts[index + 1]} onSelect={setSelected} /> : null}
        </div>
        <Checks draftId={id} rows={rows} onSelect={setSelected} className="order-2 @min-[1000px]:order-none" />
      </div>
      </div>

      <Dialog
        open={approving}
        onClose={() => setApproving(false)}
        title="Approve this version?"
        description={`Approving locks version ${draft.version}. Editing afterwards starts version ${draft.version + 1}, and this one stays exactly as it is.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproving(false)}>
              Cancel
            </Button>
            <Button
              icon={Check}
              loading={approvingBusy}
              onClick={async () => {
                setApprovingBusy(true);
                const ok = await approve(id);
                setApprovingBusy(false);
                if (ok) setApproving(false);
              }}
            >
              Approve version {draft.version}
            </Button>
          </>
        }
      >
        <p className="flex items-start gap-2.5 rounded-tile bg-sage-tint/70 px-4 py-3 text-body font-medium text-sage-ink">
          <CircleCheck aria-hidden size={18} className="mt-px shrink-0" />
          All {rv.length} parts are checked. Funza checks them again before it approves. Nothing reaches students until you print it or post it to Google Classroom.
        </p>
      </Dialog>
    </div>
  );
}

function TitleEditor({ id, title, disabled }: { id: string; title: string; disabled: boolean }) {
  const [editing, setEditing] = useState(false);
  if (editing && !disabled) {
    return (
      <span className="flex items-center gap-2">
        <label htmlFor="title" className="sr-only">
          Title
        </label>
        <Input id="title" autoFocus defaultValue={title} maxLength={160} onBlur={(e) => { setTitle(id, e.target.value.trim() || title); setEditing(false); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} className="h-12 text-title-sm font-bold" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      {title}
      {!disabled ? (
        <button type="button" onClick={() => setEditing(true)} aria-label="Rename" title="Rename" className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-white/60">
          <PenLine aria-hidden size={18} strokeWidth={1.6} />
        </button>
      ) : null}
    </span>
  );
}

/* ---------- outline ---------- */

function Outline({ draft, parts, currentId, onSelect, className }: { draft: Draft; parts: Part[]; currentId: string | null; onSelect: (id: string) => void; className?: string }) {
  return (
    <Card className={cn("flex flex-col gap-2 p-4", className)} aria-labelledby="outline-title">
      <div className="flex items-center gap-2">
        <h2 id="outline-title" className="text-card-sm font-bold">
          Outline
        </h2>
        <span className="ml-auto flex items-center gap-1 text-meta text-ink-2">
          <Kbd>J</Kbd>
          <Kbd>K</Kbd> to move
        </span>
      </div>
      {draft.sections.map((s) => {
        const sp = parts.filter((p) => (p.kind === "item" ? p.section.id === s.id : p.id === s.id));
        const done = sp.filter((p) => stateOf(p) === "reviewed").length;
        return (
          <details key={s.id} open className="group/s rounded-[14px] bg-white/40">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 [&::-webkit-details-marker]:hidden">
              <ChevronDown aria-hidden size={14} className="shrink-0 -rotate-90 transition-transform group-open/s:rotate-0" />
              <span className="min-w-0 flex-1 truncate text-body font-semibold">{s.title || (s.kind === "questions" ? "Questions" : "Section")}</span>
              <span className="text-meta text-ink-2">
                {done} of {sp.length}
              </span>
            </summary>
            <ul className="flex flex-col gap-0.5 px-1 pb-1.5">
              {sp.map((p) => {
                const st = stateOf(p);
                const on = p.id === currentId;
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => onSelect(p.id)} aria-current={on ? "true" : undefined} className={cn("flex w-full items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left pointer-coarse:min-h-11", on ? "bg-accent-tint font-bold text-accent-ink" : "hover:bg-white/60")}>
                      <span className="w-5 shrink-0 text-meta font-semibold">{p.kind === "item" ? p.number : "¶"}</span>
                      <span className="min-w-0 flex-1 truncate text-meta">{p.kind === "item" ? p.item.prompt || "Untitled question" : p.section.title}</span>
                      <StateDot state={st} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
      <p className="flex items-center gap-4 px-1 pt-1 text-meta text-ink-2">
        <span className="flex items-center gap-1.5">
          <StateDot state="reviewed" /> Checked
        </span>
        <span className="flex items-center gap-1.5">
          <StateDot state="unreviewed" /> Needs you
        </span>
      </p>
    </Card>
  );
}

function StateDot({ state }: { state: ReviewState }) {
  if (state === "reviewed") return <CircleCheck aria-label="Checked" size={16} strokeWidth={2} className="shrink-0 text-sage" />;
  return (
    <span aria-label={state === "changed" ? "Changed since you checked" : "Needs you"} className="flex size-4 shrink-0 items-center justify-center">
      <span className={cn("size-2 rounded-full", state === "changed" ? "bg-amber-ink" : "bg-accent")} />
    </span>
  );
}

function Collapsed({ part, onSelect }: { part: Part; onSelect: (id: string) => void }) {
  const st = stateOf(part);
  return (
    <button type="button" onClick={() => onSelect(part.id)} className="flex min-h-[60px] items-center gap-3 rounded-row border border-white/50 bg-surface-soft px-[18px] py-3 text-left hover:bg-white/70">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-meta text-ink-2">{part.kind === "item" ? `Question ${part.number} · ${QTYPE_LABEL[part.item.type]} · ${part.item.marks} mark${part.item.marks === 1 ? "" : "s"}` : "Section"}</span>
        <span className="truncate text-body font-medium">{part.kind === "item" ? part.item.prompt : part.section.title}</span>
      </span>
      <span className={cn("text-meta font-semibold", st === "reviewed" ? "text-sage-ink" : "text-accent-ink")}>{st === "reviewed" ? "Checked" : st === "changed" ? "Changed" : "Needs you"}</span>
      <ChevronRight aria-hidden size={16} className="shrink-0 text-ink-2" />
    </button>
  );
}

/* ---------- the part being reviewed ---------- */

const REDO = [
  { label: "Easier", guidance: "Make it easier, at a foundational level." },
  { label: "Harder", guidance: "Make it harder, at an extending level." },
  { label: "Different context", guidance: "Use a different real-world context, ideally from Saskatchewan." },
];

function PartCard({ draftId, draft, part, approved, onNext }: { draftId: string; draft: Draft; part: Part; approved: boolean; onNext: () => void }) {
  const [editing, setEditing] = useState(false);
  const [redo, setRedo] = useState<string | null>(null);
  const [redoError, setRedoError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const st = stateOf(part);
  const statusText = st === "reviewed" ? "Checked by you" : st === "changed" ? "Changed since you checked" : part.kind === "item" && part.item.origin === "ai" ? "Funza wrote this · not checked yet" : "Not checked yet";
  const alt = part.kind === "item" && draft.pendingAlt?.targetId === part.id ? draft.pendingAlt.item : null;

  async function doRedo(label: string, guidance: string) {
    if (part.kind !== "item") return;
    setRedo(label);
    setRedoError(null);
    const res = await regenerateItem(draftId, part.id, guidance);
    setRedo(null);
    if (!res.ok) setRedoError(res.message ?? "Funza couldn’t redo this question.");
  }

  return (
    <Card className="flex flex-col gap-5 p-6 max-sm:p-4" aria-label={part.kind === "item" ? `Question ${part.number}` : part.section.title}>
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-card font-bold">{part.kind === "item" ? `Question ${part.number}` : part.section.title || "Section"}</h2>
        {part.kind === "item" ? <span className="inline-flex h-6 items-center rounded-[11px] bg-white/80 px-2.5 text-badge font-semibold">{QTYPE_LABEL[part.item.type]}</span> : null}
        <span className={cn("ml-auto inline-flex h-6 items-center gap-1.5 rounded-sm px-2.5 text-badge font-semibold", st === "reviewed" ? "bg-sage-tint text-sage-ink" : st === "changed" ? "bg-amber-tint text-amber-ink" : "border border-line-2 bg-white/70 text-ink")}>
          {st === "reviewed" ? <CircleCheck aria-hidden size={13} /> : <Circle aria-hidden size={10} />}
          {statusText}
        </span>
      </div>

      {editing && !approved ? (
        part.kind === "item" ? <ItemEditor draftId={draftId} item={part.item} /> : <SectionEditor draftId={draftId} section={part.section} />
      ) : part.kind === "item" ? (
        <ItemView item={part.item} />
      ) : (
        <p className="text-row leading-6 whitespace-pre-wrap">{part.section.body}</p>
      )}

      {alt ? (
        <div className="flex flex-col gap-3 rounded-sm bg-accent-tint-soft px-4 py-3">
          <p className="text-meta font-semibold text-accent-ink">Funza’s new version. Keep it or stay with the original.</p>
          <ItemView item={alt} compact />
          <div className="flex gap-2">
            <Button size="sm" icon={Check} onClick={() => acceptAlt(draftId)}>
              Use this version
            </Button>
            <Button size="sm" variant="secondary" onClick={() => discardAlt(draftId)}>
              Keep the original
            </Button>
          </div>
        </div>
      ) : null}

      {!approved && part.kind === "item" && !alt ? (
        <div className="flex flex-wrap items-center gap-2">
          <Overline as="span" className="mr-1">
            Redo
          </Overline>
          {REDO.map((r) => (
            <ChoiceChip key={r.label} size="sm" icon={redo === r.label ? undefined : RotateCcw} disabled={redo !== null} onClick={() => doRedo(r.label, r.guidance)}>
              {redo === r.label ? "Funza is redoing it…" : r.label}
            </ChoiceChip>
          ))}
          {redoError ? (
            <p role="alert" className="basis-full text-meta font-medium text-red-ink">
              {redoError}
            </p>
          ) : null}
        </div>
      ) : null}

      {!approved ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <p className="min-w-[200px] flex-1 text-meta text-ink-2">{st === "reviewed" ? "Checked. N jumps to the next part that needs you." : "Looks right? Mark it reviewed, then N jumps to the next part."}</p>
          <Button variant="ghost" size="sm" icon={PenLine} onClick={() => setEditing((e) => !e)}>
            {editing ? "Done editing" : "Edit"}
          </Button>
          {part.kind === "item" ? (
            <div className="relative">
              <Button variant="ghost" size="sm" icon={Ellipsis} aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)} />
              {menu ? (
                <div role="menu" className="absolute right-0 bottom-full z-20 mb-2 flex w-52 flex-col gap-0.5 rounded-[18px] border border-white/90 bg-white/95 p-1.5 shadow-tooltip">
                  <MenuItem icon={Copy} label="Duplicate" onClick={() => { duplicateItem(draftId, part.id); setMenu(false); }} />
                  <MenuItem icon={MoveUp} label="Move up" onClick={() => { moveItem(draftId, part.id, -1); setMenu(false); }} />
                  <MenuItem icon={MoveDown} label="Move down" onClick={() => { moveItem(draftId, part.id, 1); setMenu(false); }} />
                  <MenuItem icon={Trash2} label="Delete question" danger onClick={() => { if (window.confirm("Delete this question?")) deleteItem(draftId, part.id); setMenu(false); }} />
                </div>
              ) : null}
            </div>
          ) : null}
          {st === "reviewed" ? (
            <Button variant="secondary" size="sm" icon={CircleCheck} onClick={() => markReviewed(draftId, part.id, false)} title="Undo">
              Reviewed
            </Button>
          ) : (
            <Button size="sm" icon={Check} onClick={() => { markReviewed(draftId, part.id, true); onNext(); }}>
              Mark reviewed <Kbd tone="on-accent" className="ml-1">R</Kbd>
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={cn("flex min-h-10 items-center gap-3 rounded-[14px] px-3 text-left text-body font-medium hover:bg-white", danger && "text-red-ink")}>
      <Icon aria-hidden size={16} strokeWidth={1.6} />
      {label}
    </button>
  );
}

function answerOf(i: Item): string {
  if (i.type === "mcq") return i.options.find((o) => o.id === i.correctId)?.text ?? "Not set";
  if (i.type === "tf") return i.tf === null ? "Not set" : i.tf ? "True" : "False";
  if (i.type === "match") return `${i.pairs.length} pairs`;
  if (i.type === "short" || i.type === "long") return i.rubric.length > 0 ? `Rubric, ${i.rubric.length} lines` : i.answer || "Teacher marks it";
  return i.answer || "Not set";
}

function ItemView({ item: i, compact = false }: { item: Item; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <p className={cn("font-semibold whitespace-pre-wrap", compact ? "text-row" : "text-section")}>{i.prompt || "This question has no text yet."}</p>
      {i.type === "mcq" ? (
        <ul className="flex flex-col gap-2">
          {i.options.map((o, n) => {
            const right = o.id === i.correctId;
            return (
              <li key={o.id} className={cn("flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-body", right ? "bg-sage-tint font-semibold text-sage-ink" : "bg-white/70")}>
                <span className="w-5 shrink-0 font-semibold">{String.fromCharCode(65 + n)}</span>
                <span className="flex-1">{o.text}</span>
                {right ? (
                  <span className="inline-flex items-center gap-1 text-meta font-semibold">
                    <Check aria-hidden size={14} strokeWidth={2.6} /> Correct
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {i.type === "match" ? (
        <ul className="flex flex-col gap-1.5 text-body">
          {i.pairs.map((p, n) => (
            <li key={n} className="flex items-center gap-3 rounded-[14px] bg-white/70 px-3.5 py-2">
              <span className="flex-1">{p.left}</span>
              <ArrowRight aria-hidden size={14} className="text-ink-2" />
              <span className="flex-1">{p.right}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {!compact ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_116px_minmax(0,1fr)]">
          <Tile label="Answer" value={answerOf(i)} note={i.calc ? `${i.calc.show}` : undefined} />
          <Tile label="Marks" value={String(i.marks)} />
          <Tile label="Outcome" value={i.outcomeIds.map(codeOf).join(", ") || "None"} />
        </div>
      ) : null}
      {!compact && (i.solution || i.rubric.length > 0) ? (
        <details className="rounded-[14px] bg-white/50 px-4 py-2.5">
          <summary className="cursor-pointer text-body font-semibold">{i.rubric.length > 0 ? "Solution and rubric" : "Worked solution"}</summary>
          {i.solution ? <p className="mt-2 text-body whitespace-pre-wrap">{i.solution}</p> : null}
          {i.rubric.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 text-body">
              {i.rubric.map((r, n) => (
                <li key={n} className="flex gap-3">
                  <span className="flex-1">{r.text}</span>
                  <span className="font-semibold">{r.marks}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-white/85 bg-white/60 px-3.5 py-3">
      <Overline className="text-kbd tracking-[0.06em]">{label}</Overline>
      <p className="truncate text-card font-bold" title={value}>
        {value}
      </p>
      {note ? <p className="truncate text-meta text-ink-2">{note}</p> : null}
    </div>
  );
}

function ItemEditor({ draftId, item: i }: { draftId: string; item: Item }) {
  const patch = (p: Partial<Item>) => updateItem(draftId, i.id, { ...p, origin: "teacher" });
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-semibold text-ink-2">Question</span>
        <Textarea value={i.prompt} onChange={(e) => patch({ prompt: e.target.value })} rows={3} />
      </label>
      {i.type === "mcq" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-meta font-semibold text-ink-2">Options (choose the correct one)</legend>
          {i.options.map((o, n) => (
            <div key={o.id} className="flex items-center gap-3">
              <input type="radio" name={`correct-${i.id}`} checked={i.correctId === o.id} onChange={() => patch({ correctId: o.id })} aria-label={`Option ${String.fromCharCode(65 + n)} is correct`} className="size-5 accent-[var(--color-accent)]" />
              <Input value={o.text} aria-label={`Option ${String.fromCharCode(65 + n)}`} onChange={(e) => patch({ options: i.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })} className="h-11" />
            </div>
          ))}
        </fieldset>
      ) : null}
      {i.type === "tf" ? (
        <div className="flex gap-2" role="group" aria-label="Correct answer">
          <ChoiceChip selected={i.tf === true} onClick={() => patch({ tf: true })}>
            True
          </ChoiceChip>
          <ChoiceChip selected={i.tf === false} onClick={() => patch({ tf: false })}>
            False
          </ChoiceChip>
        </div>
      ) : null}
      {i.type === "fill" || i.type === "calc" ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-semibold text-ink-2">Answer</span>
          <Input value={i.answer} onChange={(e) => patch({ answer: e.target.value })} className="h-11" />
        </label>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-semibold text-ink-2">Worked solution</span>
          <Textarea value={i.solution} onChange={(e) => patch({ solution: e.target.value })} rows={2} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-semibold text-ink-2">Marks</span>
          <Input type="number" min={1} max={50} value={i.marks} onChange={(e) => patch({ marks: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} className="h-11" />
        </label>
      </div>
    </div>
  );
}

function SectionEditor({ draftId, section: s }: { draftId: string; section: Section }) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-semibold text-ink-2">Heading</span>
        <Input value={s.title} onChange={(e) => updateSection(draftId, s.id, { title: e.target.value, origin: "teacher" })} className="h-11" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-semibold text-ink-2">Text</span>
        <Textarea value={s.body} onChange={(e) => updateSection(draftId, s.id, { body: e.target.value, origin: "teacher" })} rows={10} />
      </label>
    </div>
  );
}

/* ---------- checks ---------- */

const CHECK_ICON: Record<CheckRow["state"], { icon: LucideIcon; className: string; label: string }> = {
  passed: { icon: CircleCheck, className: "text-sage", label: "Passed" },
  failed: { icon: CircleAlert, className: "text-red", label: "Failed" },
  "needs-you": { icon: Circle, className: "text-amber-ink", label: "Needs you" },
  stale: { icon: RotateCcw, className: "text-amber-ink", label: "Changed" },
  unverifiable: { icon: Info, className: "text-ink-2", label: "Can’t be checked by code" },
};

function Checks({ draftId, rows, onSelect, className }: { draftId: string; rows: CheckRow[]; onSelect: (id: string) => void; className?: string }) {
  const order = { failed: 0, stale: 1, "needs-you": 2, unverifiable: 3, passed: 4 } as const;
  const sorted = [...rows].sort((a, b) => order[a.state] - order[b.state]);
  return (
    <Card className={cn("flex flex-col gap-3 p-5", className)} aria-labelledby="checks-title">
      <CardHeader id="checks-title" title="Checks" size="sm" actions={<span className="text-meta text-ink-2">Updated after every change</span>} />
      <ul className="flex flex-col">
        {sorted.map((r) => {
          const ic = CHECK_ICON[r.state];
          const confirmKey = r.id === "g-reading" ? "readingLevel" : r.id === "g-indicators" ? "indicatorsPending" : null;
          return (
            <li key={r.id} className="flex items-start gap-2.5 border-b border-line py-2.5 last:border-b-0">
              <ic.icon aria-label={ic.label} size={18} strokeWidth={1.8} className={cn("mt-px shrink-0", ic.className)} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-body font-medium">{r.label}</p>
                {r.state !== "passed" ? <p className="text-meta text-ink-2">{r.detail}</p> : null}
                {r.state !== "passed" ? (
                  <div className="flex flex-wrap gap-2">
                    {r.fix ? (
                      <Button size="sm" variant="secondary" onClick={() => { const target = applyFix(draftId, r.fix!.action); if (target) onSelect(target); }}>
                        {r.fix.label}
                      </Button>
                    ) : null}
                    {confirmKey ? (
                      <Button size="sm" variant="secondary" icon={Check} onClick={() => setGlobal(draftId, confirmKey, true)}>
                        I’ve checked this
                      </Button>
                    ) : null}
                    {r.targetId ? (
                      <Button size="sm" variant="ghost" onClick={() => onSelect(r.targetId!)}>
                        Show me
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
