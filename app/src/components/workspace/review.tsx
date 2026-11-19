"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityStage } from "@/components/activity/ActivityStage";
import { findOutcome as outcomeById } from "@/lib/curriculum/catalog";
import { codeOf, knownOutcomes } from "@/lib/curriculum/sources";
import { PRESETS } from "@/lib/resources/blueprint";
import { motionGraph } from "@/lib/resources/graph";
import { isQuestionKind, KINDS, QTYPE_LABEL, QTYPE_ORDER } from "@/lib/resources/kinds";
import {
  allItems,
  approvalBlockers,
  checkCounts,
  computeChecks,
  DIFFICULTY_LABEL,
  difficultyMarks,
  itemReview,
  numbering,
  sectionReview,
  totalMarks,
  verbCoverage,
  verbLabel,
  type ReviewState,
} from "@/lib/resources/checks";
import {
  acceptAlt,
  addItem,
  applyFix,
  approve,
  deleteItem,
  deleteResource,
  discardAlt,
  dismissNotices,
  duplicateItem,
  markReviewed,
  moveItem,
  moveSection,
  regenerateItem,
  setDraftOutcomes,
  setGlobal,
  setTitle,
  startNewVersion,
  toast,
  updateItem,
  updateSection,
  useWorkspace as useProto,
} from "@/lib/resources/store";
import type { CheckRow, Difficulty, Draft, Item, QType, Section, Verb } from "@/lib/resources/types";
import { Crumbs, Loading, TopBar } from "./shell";
import {
  ArrowRight,
  CheckIcon,
  ChevronDown,
  ChevronUp,
  CopyIcon,
  LayersIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PlusIcon,
  RefreshIcon,
  SparkIcon,
  TrashIcon,
  XIcon,
} from "./icons";
import { Menu, MenuItem } from "./parts";
import { AiSpark, Button, CHECK_META, CheckBadge, cx, Dialog, EmptyState, IconButton, inputClass, Kbd, Notice, OfficialWording, Pill, Segmented, Stepper, Tabs, VerificationBadge } from "./ui";

type Lens = "student" | "key" | "alignment";

const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
const textArea = "w-full resize-none rounded-(--r-sm) border border-transparent bg-transparent px-1.5 py-1 outline-none [field-sizing:content] hover:border-(--line) focus:border-(--teal-700) focus:bg-white focus:shadow-[0_0_0_3px_var(--teal-100)]";

export function ReviewScreen({ id }: { id: string }) {
  const s = useProto();
  if (!s.hydrated) return <Loading />;
  const d = s.drafts[id];
  if (!d) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={<LayersIcon className="h-5 w-5" />}
          title="This resource is not in this browser"
          action={
            <Link href="/library" className="inline-flex h-9 items-center rounded-(--r-md) border border-(--line) bg-(--surface) px-3.5 text-sm font-semibold shadow-(--sh-1) hover:bg-(--surface-2)">
              Open the library
            </Link>
          }
        >
          Resources are saved in the browser they were made in until teacher accounts arrive. It may have been made on another computer, or deleted.
        </EmptyState>
      </div>
    );
  }
  return <Editor key={id} id={id} d={d} />;
}

function Editor({ id, d }: { id: string; d: Draft }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [lens, setLens] = useState<Lens>("student");
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [outline, setOutline] = useState({ desktop: true, mobile: false });
  const [inspector, setInspector] = useState({ desktop: true, mobile: false });
  const [tab, setTab] = useState<"checks" | "alignment">("checks");
  const [approving, setApproving] = useState(false);
  const [outcomesOpen, setOutcomesOpen] = useState(false);

  const rows = useMemo(() => computeChecks(d), [d]);
  const counts = checkCounts(rows);
  const blockers = approvalBlockers(rows);
  const num = useMemo(() => numbering(d.sections), [d]);
  const locked = d.status === "approved";
  const order = useMemo(() => d.sections.flatMap((sec) => (sec.kind === "questions" ? sec.items.map((i) => i.id) : [sec.id])), [d]);
  const kindLabel = KINDS.find((k) => k.kind === d.kind)?.label ?? "Resource";

  function focusBlock(target: string | undefined) {
    if (!target) return;
    setSelected(target);
    setFlash(target);
    setTimeout(() => setFlash((f) => (f === target ? null : f)), 1600);
    requestAnimationFrame(() => document.getElementById(`blk-${target}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }
  const stateOf = (target: string): ReviewState | null => {
    const item = allItems(d).find((i) => i.id === target);
    if (item) return itemReview(item);
    const sec = d.sections.find((x) => x.id === target);
    return sec ? sectionReview(sec) : null;
  };
  function nextNeedingYou() {
    const start = selected ? order.indexOf(selected) : -1;
    const ring = [...order.slice(start + 1), ...order.slice(0, start + 1)];
    const failing = new Set(rows.filter((r) => r.state === "failed" && r.targetId).map((r) => r.targetId));
    const next = ring.find((t) => stateOf(t) !== "reviewed" || failing.has(t));
    if (next) focusBlock(next);
    else toast("Every part is reviewed.", "info");
  }
  function review(target: string) {
    if (locked) return;
    markReviewed(id, target, stateOf(target) !== "reviewed");
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "j" || k === "k") {
        e.preventDefault();
        const at = selected ? order.indexOf(selected) : -1;
        const next = order[Math.max(0, Math.min(order.length - 1, at + (k === "j" ? 1 : -1)))];
        if (next) focusBlock(next);
      } else if (k === "r" && selected) {
        e.preventDefault();
        review(selected);
      } else if (k === "n") {
        e.preventDefault();
        nextNeedingYou();
      } else if (e.key === "[") setOutline((o) => ({ ...o, desktop: !o.desktop }));
      else if (e.key === "]") setInspector((o) => ({ ...o, desktop: !o.desktop }));
      else if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <TopBar
        actions={
          <>
            <IconButton label="Delete this resource" onClick={() => setDeleting(true)}>
              <TrashIcon />
            </IconButton>
            <Segmented
              size="sm"
              label="View"
              value={lens}
              onChange={setLens}
              options={[
                { value: "student", label: "Student copy" },
                { value: "key", label: "Answer key" },
                { value: "alignment", label: "Alignment" },
              ]}
            />
            {locked ? (
              <>
                <Button size="sm" onClick={() => startNewVersion(id)}>
                  Edit as version {d.version + 1}
                </Button>
                <Button size="sm" variant="primary" onClick={() => router.push(`/resources/${id}/deliver`)}>
                  Publish
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button size="sm" variant="primary" onClick={() => setApproving(true)}>
                <CheckIcon />
                Approve
                {blockers.length > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{blockers.length} left</span>}
              </Button>
            )}
          </>
        }
      >
        <Crumbs items={[{ label: "Library", href: "/library" }, { label: d.courseName, href: `/library?course=${encodeURIComponent(d.courseName)}` }, { label: d.title }]} />
        <span className="hidden sm:inline-flex">{locked ? <Pill tone="ok">Approved v{d.approved?.version ?? d.version}</Pill> : <Pill tone="gold">Draft v{d.version}</Pill>}</span>
        <span className="hidden text-[12px] text-(--muted) xl:inline">Saved in this browser</span>
      </TopBar>

      {/* Small screens: panel toggles */}
      <div className="flex items-center gap-2 border-b border-(--line) bg-(--surface) px-4 py-2 lg:hidden">
        <Button size="sm" onClick={() => setOutline((o) => ({ ...o, mobile: true }))}>
          <PanelLeftIcon /> Outline
        </Button>
        <Button size="sm" onClick={() => setInspector((o) => ({ ...o, mobile: true }))}>
          <PanelRightIcon /> Checks
          {blockers.length > 0 && <Pill tone="gold">{blockers.length}</Pill>}
        </Button>
      </div>

      <div className="lg:flex">
        {/* Outline */}
        <aside
          aria-label="Outline"
          className={cx(
            outline.mobile ? "fixed inset-y-0 left-0 z-50 block w-[86vw] max-w-[320px] bg-(--surface) shadow-(--sh-3)" : "hidden",
            outline.desktop ? "lg:sticky lg:top-14 lg:z-auto lg:block lg:h-[calc(100vh-56px)] lg:w-[256px] lg:shrink-0 lg:shadow-none" : "lg:hidden",
            "fz-scroll overflow-y-auto border-r border-(--line) bg-(--surface-2)",
          )}
        >
          <OutlinePanel d={d} rows={rows} selected={selected} onPick={focusBlock} onNext={nextNeedingYou} onClose={() => setOutline({ desktop: false, mobile: false })} locked={locked} id={id} />
        </aside>

        {/* Canvas */}
        <div className="min-w-0 flex-1 bg-[linear-gradient(180deg,var(--bg-sunk),var(--bg)_240px)]">
          <div className="flex items-center justify-between gap-2 px-4 pt-3 lg:px-6">
            <span className="hidden lg:block">
              <IconButton label={outline.desktop ? "Hide outline ([)" : "Show outline ([)"} onClick={() => setOutline((o) => ({ ...o, desktop: !o.desktop }))}>
                <PanelLeftIcon />
              </IconButton>
            </span>
            <p className="hidden text-[12px] text-(--muted) md:block">
              <Kbd>J</Kbd> <Kbd>K</Kbd> move · <Kbd>R</Kbd> reviewed · <Kbd>N</Kbd> next that needs you
            </p>
            <span className="hidden lg:block">
              <IconButton label={inspector.desktop ? "Hide checks (])" : "Show checks (])"} onClick={() => setInspector((o) => ({ ...o, desktop: !o.desktop }))}>
                <PanelRightIcon />
              </IconButton>
            </span>
          </div>

          <div className="mx-auto max-w-[836px] px-3 pt-3 pb-24 md:px-6">
            {locked && (
              <Notice tone="ok" title={`Version ${d.approved?.version ?? d.version} approved`} action={<Button size="sm" variant="primary" onClick={() => router.push(`/resources/${id}/deliver`)}>Publish it</Button>}>
                This version is locked, so what you publish is exactly what you approved. To change anything, start version {d.version + 1}; this one stays as it is.
              </Notice>
            )}
            {!locked && d.notices.length > 0 && (
              <div className="space-y-2">
                {d.notices.map((n) => (
                  <Notice key={n} tone="gold">
                    {n}
                  </Notice>
                ))}
                <Button size="sm" variant="ghost" onClick={() => dismissNotices(id)}>
                  Dismiss these notes
                </Button>
              </div>
            )}
            {!locked && d.draftedBy !== "teacher" && (
              <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-(--muted)">
                <SparkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--gold-500)" />
                {d.draftedBy === "ai" ? `Drafted by AI${d.provider ? ` (${d.provider})` : ""}.` : "Started from Funza's question bank."} Every part stays marked until you review it.
              </p>
            )}

            <article aria-label="Document" className="fz-paper mt-3 px-5 py-8 sm:px-10 md:px-14 md:py-12">
              <DocHeader d={d} id={id} locked={locked} />
              <div className="mt-8 space-y-9">
                {d.sections.map((sec) => (
                  <SectionBlock
                    key={sec.id}
                    id={id}
                    d={d}
                    sec={sec}
                    num={num}
                    lens={lens}
                    rows={rows}
                    selected={selected}
                    flash={flash}
                    locked={locked}
                    onSelect={setSelected}
                    onReview={review}
                  />
                ))}
              </div>
            </article>
          </div>
        </div>

        {/* Inspector */}
        <aside
          aria-label="Checks and alignment"
          className={cx(
            inspector.mobile ? "fixed inset-y-0 right-0 z-50 block w-[92vw] max-w-[400px] bg-(--surface) shadow-(--sh-3)" : "hidden",
            inspector.desktop ? "lg:sticky lg:top-14 lg:z-auto lg:block lg:h-[calc(100vh-56px)] lg:w-[340px] lg:shrink-0 lg:shadow-none xl:w-[380px]" : "lg:hidden",
            "fz-scroll overflow-y-auto border-l border-(--line) bg-(--surface)",
          )}
        >
          <div className="sticky top-0 z-10 flex items-center bg-(--surface)">
            <div className="flex-1">
              <Tabs
                label="Inspector"
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: "checks", label: <>Checks {blockers.length > 0 && <Pill tone="gold">{blockers.length}</Pill>}</> },
                  { value: "alignment", label: "Alignment" },
                ]}
              />
            </div>
            <IconButton label="Close panel" onClick={() => setInspector({ desktop: false, mobile: false })} className="mr-2">
              <XIcon />
            </IconButton>
          </div>
          {tab === "checks" ? (
            <ChecksPanel id={id} d={d} rows={rows} counts={counts} locked={locked} onJump={focusBlock} />
          ) : (
            <AlignmentPanel id={id} d={d} onChangeOutcomes={() => setOutcomesOpen(true)} locked={locked} />
          )}
        </aside>
      </div>
      {(outline.mobile || inspector.mobile) && (
        <div className="fixed inset-0 z-40 bg-[rgba(11,17,36,0.35)] lg:hidden" aria-hidden="true" onClick={() => {
          setOutline((o) => ({ ...o, mobile: false }));
          setInspector((o) => ({ ...o, mobile: false }));
        }} />
      )}

      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete this resource?"
        description="It is removed from this browser. Anything already posted to Classroom stays there."
        footer={
          <>
            <Button onClick={() => setDeleting(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteResource(id);
                toast("Resource deleted.", "info");
                router.push("/library");
              }}
            >
              <TrashIcon /> Delete
            </Button>
          </>
        }
      />
      <ApproveDialog open={approving} onClose={() => setApproving(false)} d={d} rows={rows} kindLabel={kindLabel} onJump={(t) => {
        setApproving(false);
        focusBlock(t);
      }} onApprove={() => {
        approve(id);
        setApproving(false);
        setSelected(null);
      }} />
      {outcomesOpen && <OutcomesDialog open onClose={() => setOutcomesOpen(false)} id={id} d={d} />}
    </>
  );
}

/* ---------- document ---------- */

function DocHeader({ d, id, locked }: { d: Draft; id: string; locked: boolean }) {
  const { settings } = useProto();
  const minutes = d.duration ?? 30;
  const q = isQuestionKind(d.kind);
  const marks = totalMarks(d);
  return (
    <header>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12px] font-semibold tracking-wide text-(--muted) uppercase">
        <span>
          {d.courseName} · {d.outcomeIds.map(codeOf).join(", ")}
        </span>
        <span>{settings.schoolName}</span>
      </div>
      <label className="sr-only" htmlFor="doc-title">
        Title
      </label>
      <textarea
        id="doc-title"
        value={d.title}
        readOnly={locked}
        rows={1}
        onChange={(e) => setTitle(id, e.target.value.replace(/\s*\n\s*/g, " "))}
        className="fz-display mt-2 -ml-1.5 w-full resize-none rounded-(--r-sm) border border-transparent bg-transparent px-1.5 text-[26px] leading-tight font-bold outline-none [field-sizing:content] hover:border-(--line) focus:border-(--teal-700) read-only:hover:border-transparent"
      />
      {q && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 text-[13.5px] sm:grid-cols-3">
            {["Name", "Date", "Class"].map((f) => (
              <p key={f} className="flex items-end gap-2">
                {f}
                <span className="h-px flex-1 translate-y-[-3px] bg-(--ink)/40" />
              </p>
            ))}
          </div>
          <p className="mt-4 flex flex-wrap gap-x-4 rounded-(--r-sm) bg-(--surface-2) px-3 py-2 text-[13px]">
            <span>
              <b>Total:</b> {marks} marks
            </span>
            <span>
              <b>Time:</b> {minutes} minutes
            </span>
            <span>Answer every question. Show your work for calculations.</span>
          </p>
        </>
      )}
      {d.kind === "lesson-plan" && d.targetMinutes !== null && (
        <p className="mt-3 text-[13px] text-(--muted)">
          {d.targetMinutes}-minute lesson · {d.courseName || "Lesson"} · plan for the teacher, not for students
        </p>
      )}
    </header>
  );
}

function SectionBlock({
  id,
  d,
  sec,
  num,
  lens,
  rows,
  selected,
  flash,
  locked,
  onSelect,
  onReview,
}: {
  id: string;
  d: Draft;
  sec: Section;
  num: Map<string, number>;
  lens: Lens;
  rows: CheckRow[];
  selected: string | null;
  flash: string | null;
  locked: boolean;
  onSelect: (id: string | null) => void;
  onReview: (id: string) => void;
}) {
  const marks = sec.items.reduce((n, i) => n + i.marks, 0);
  const questionParts = d.sections.filter((s) => s.kind === "questions");
  const letter = String.fromCharCode(65 + questionParts.indexOf(sec));

  if (sec.kind !== "questions") return <TextBlock id={id} d={d} sec={sec} lens={lens} rows={rows} selected={selected === sec.id} flash={flash === sec.id} locked={locked} onSelect={onSelect} onReview={onReview} />;

  return (
    <section aria-label={`Part ${letter}: ${sec.title}`}>
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-(--ink) pb-1.5">
        <h3 className="text-[15px] font-bold">
          {isQuestionKind(d.kind) ? `Part ${letter} · ` : ""}
          {sec.title}
        </h3>
        {marks > 0 && <span className="text-[13px] font-semibold tabular-nums">{marks} marks</span>}
      </div>
      {sec.body && (
        <textarea
          aria-label={`Instructions for ${sec.title}`}
          value={sec.body}
          readOnly={locked}
          rows={1}
          onChange={(e) => updateSection(id, sec.id, { body: e.target.value })}
          className={cx(textArea, "mt-2 -ml-1.5 text-[13.5px] text-(--ink-2) italic")}
        />
      )}
      <ol className="mt-2">
        {sec.items.map((item) => (
          <li key={item.id}>
            <ItemBlock id={id} d={d} sec={sec} item={item} n={num.get(item.id) ?? 0} lens={lens} rows={rows.filter((r) => r.targetId === item.id)} selected={selected === item.id} flash={flash === item.id} locked={locked} onSelect={onSelect} onReview={onReview} />
            {!locked && <Inserter id={id} sectionId={sec.id} afterId={item.id} type={item.type} onAdded={onSelect} />}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Inserter({ id, sectionId, afterId, type, onAdded }: { id: string; sectionId: string; afterId: string; type: QType; onAdded: (id: string) => void }) {
  return (
    <div className="group relative flex h-5 items-center">
      <span className="h-px flex-1 bg-transparent group-focus-within:bg-(--teal-200) group-hover:bg-(--teal-200)" aria-hidden="true" />
      <div className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Menu
          label="Add a question here"
          triggerClass="inline-flex h-5 items-center gap-1 rounded-full border border-(--teal-200) bg-white px-2 text-[11px] font-semibold text-(--teal-800)"
          trigger={
            <>
              <PlusIcon className="h-3 w-3" /> Add question
            </>
          }
        >
          {(close) =>
            QTYPE_ORDER.map((t) => (
              <MenuItem
                key={t}
                hint={t === type ? "same type" : undefined}
                onSelect={() => {
                  close();
                  onAdded(addItem(id, sectionId, t, afterId));
                }}
              >
                {QTYPE_LABEL[t]}
              </MenuItem>
            ))
          }
        </Menu>
      </div>
      <span className="h-px flex-1 bg-transparent group-focus-within:bg-(--teal-200) group-hover:bg-(--teal-200)" aria-hidden="true" />
    </div>
  );
}

function Gutter({ state, failed }: { state: ReviewState; failed: boolean }) {
  return (
    <span className="absolute top-3 -left-1 flex w-5 justify-center sm:-left-7">
      {failed ? (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-(--bad) text-white" title="A check failed">
          <XIcon className="h-2.5 w-2.5" />
          <span className="sr-only">A check failed.</span>
        </span>
      ) : state === "unreviewed" ? (
        <AiSpark />
      ) : state === "changed" ? (
        <span className="text-(--info)" title="Changed after you reviewed it">
          <RefreshIcon className="h-3.5 w-3.5" />
          <span className="sr-only">Changed after you reviewed it.</span>
        </span>
      ) : (
        <span className="text-(--teal-700)/60" title="Reviewed by you">
          <CheckIcon className="h-3.5 w-3.5" />
          <span className="sr-only">Reviewed by you.</span>
        </span>
      )}
    </span>
  );
}

function ItemBlock({
  id,
  d,
  sec,
  item,
  n,
  lens,
  rows,
  selected,
  flash,
  locked,
  onSelect,
  onReview,
}: {
  id: string;
  d: Draft;
  sec: Section;
  item: Item;
  n: number;
  lens: Lens;
  rows: CheckRow[];
  selected: boolean;
  flash: boolean;
  locked: boolean;
  onSelect: (id: string | null) => void;
  onReview: (id: string) => void;
}) {
  const state = itemReview(item);
  const failed = rows.filter((r) => r.state === "failed");
  const alt = d.pendingAlt?.targetId === item.id ? d.pendingAlt.item : null;
  const editing = selected && !locked;

  return (
    <div
      id={`blk-${item.id}`}
      className={cx(
        "relative -mx-3 rounded-(--r-md) px-3 py-2.5 transition-[background-color,box-shadow]",
        flash && "fz-flash",
        selected ? "bg-(--surface-2) shadow-[0_0_0_1.5px_var(--teal-700)]" : "hover:bg-(--surface-2)",
      )}
    >
      <Gutter state={state} failed={failed.length > 0} />
      {!editing ? (
        <button
          type="button"
          onClick={() => {
            onSelect(item.id);
            requestAnimationFrame(() => document.getElementById(`p-${item.id}`)?.focus());
          }}
          className="block w-full text-left"
          aria-label={`Question ${n}: ${item.prompt || "empty"}. Select to edit.`}
        >
          <ItemView item={item} n={n} lens={lens} />
        </button>
      ) : (
        <ItemEditor id={id} d={d} item={item} n={n} />
      )}

      {lens === "alignment" && !editing && <ItemTags item={item} rows={rows} state={state} />}

      {failed.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {failed.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-(--r-sm) bg-(--bad-bg) px-2.5 py-1.5 text-[12.5px] text-(--bad)">
              <XIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <b>{r.label}.</b> {r.detail}
              </span>
              {r.fix && !locked && (
                <Button size="sm" variant="danger" className="h-7" onClick={() => applyFix(id, r.fix!.action)}>
                  {r.fix.label}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {alt && (
        <div className="fz-pop-in mt-3 grid gap-3 rounded-(--r-md) border border-(--gold-100) bg-(--gold-50) p-3 md:grid-cols-2">
          <div>
            <p className="text-[11.5px] font-semibold tracking-wide text-(--muted) uppercase">Current</p>
            <div className="mt-1 rounded-(--r-sm) bg-white p-2 opacity-80">
              <ItemView item={item} n={n} lens="key" />
            </div>
          </div>
          <div>
            <p className="flex items-center gap-1 text-[11.5px] font-semibold tracking-wide text-(--gold-700) uppercase">
              <SparkIcon className="h-3 w-3" /> New version · not reviewed
            </p>
            <div className="mt-1 rounded-(--r-sm) bg-white p-2 ring-1 ring-(--gold-100)">
              <ItemView item={alt} n={n} lens="key" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button size="sm" variant="primary" onClick={() => acceptAlt(id)}>
              Use the new version
            </Button>
            <Button size="sm" onClick={() => discardAlt(id)}>
              Keep the current one
            </Button>

          </div>
        </div>
      )}

      {editing && (
        <ItemToolbar
          id={id}
          sec={sec}
          item={item}
          state={state}
          onReview={() => onReview(item.id)}
          onDone={() => onSelect(null)}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function ItemTags({ item, rows, state }: { item: Item; rows: CheckRow[]; state: ReviewState }) {
  const worst = rows.find((r) => r.state === "failed") ?? rows.find((r) => r.state === "passed");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
      {item.outcomeIds.map((o) => (
        <Pill key={o} tone="teal">
          {codeOf(o)}
        </Pill>
      ))}
      {item.verbs.map((v) => (
        <Pill key={v} tone="none">
          {verbLabel(v)}
        </Pill>
      ))}
      <Pill tone="none">{DIFFICULTY_LABEL[item.difficulty]}</Pill>
      <Pill tone="none">
        {item.marks} mark{item.marks === 1 ? "" : "s"}
      </Pill>
      {worst ? <CheckBadge state={worst.state} /> : <CheckBadge state="unverifiable" />}
      {state === "reviewed" ? <Pill tone="ok">Reviewed by you</Pill> : state === "changed" ? <CheckBadge state="stale" /> : <CheckBadge state="needs-you" />}
    </div>
  );
}

/* What students (or the key) show for one question. */
export function ItemView({ item, n, lens }: { item: Item; n: number; lens: Lens }) {
  const key = lens === "key";
  const lines = item.type === "long" ? 8 : item.type === "short" ? Math.min(2 + item.marks, 6) : 0;
  const rightOrder = item.pairs.map((_, i) => (i + 1) % Math.max(item.pairs.length, 1));
  return (
    <div className="flex gap-3 text-[15px] leading-relaxed">
      <span className="w-6 shrink-0 text-right font-semibold tabular-nums">{n}.</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <p className={cx(!item.prompt && "text-(--muted) italic")}>{item.prompt || "Write the question…"}</p>
          <span className="shrink-0 text-[13px] text-(--muted) tabular-nums">[{item.marks}]</span>
        </div>
        {item.type === "mcq" && (
          <ol className="mt-1.5 space-y-0.5">
            {item.options.map((o) => {
              const right = key && o.id === item.correctId;
              return (
                <li key={o.id} className={cx("flex gap-2 rounded px-1", right && "bg-(--teal-50) font-semibold text-(--teal-900)")}>
                  <span className="w-5">{o.id})</span>
                  <span className={cx(!o.text && "text-(--muted) italic")}>{o.text || "Empty option"}</span>
                  {right && <CheckIcon className="mt-1.5 h-3.5 w-3.5" />}
                </li>
              );
            })}
          </ol>
        )}
        {item.type === "tf" && <p className="mt-1.5 text-[14px]">{key ? <Key>{item.tf === null ? "No answer marked" : item.tf ? "True" : "False"}</Key> : "True      False"}</p>}
        {item.type === "fill" && key && (
          <p className="mt-1.5">
            <Key>{item.answer || "No answer in the key"}</Key>
          </p>
        )}
        {item.type === "match" && (
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[14px]">
            {item.pairs.map((p, i) => (
              <div key={`l-${i}`} className="contents">
                <p>
                  {i + 1}. {p.left || <span className="text-(--muted) italic">Empty</span>}
                  {key && (
                    <span className="ml-2 font-semibold text-(--teal-800)">→ {String.fromCharCode(65 + rightOrder.indexOf(i))}</span>
                  )}
                </p>
                <p>
                  {String.fromCharCode(65 + i)}. {item.pairs[rightOrder[i]]?.right || <span className="text-(--muted) italic">Empty</span>}
                </p>
              </div>
            ))}
          </div>
        )}
        {item.type === "calc" &&
          (key ? (
            <div className="mt-1.5 space-y-1">
              <Key>{item.answer || "No answer in the key"}</Key>
              {item.solution && <p className="font-mono text-[13px] text-(--ink-2)">{item.solution}</p>}
            </div>
          ) : (
            <p className="mt-2 flex items-end gap-2 text-[14px]">
              Answer <span className="h-px w-40 translate-y-[-4px] bg-(--ink)/40" />
            </p>
          ))}
        {(item.type === "short" || item.type === "long") &&
          (key ? (
            <table className="mt-2 w-full text-[13px]">
              <caption className="sr-only">Marking rubric</caption>
              <tbody>
                {item.rubric.map((r, i) => (
                  <tr key={i} className="border-t border-(--teal-100)">
                    <td className="py-1 pr-3 text-(--ink-2)">{r.text || <span className="italic">Empty criterion</span>}</td>
                    <td className="py-1 text-right font-semibold whitespace-nowrap text-(--teal-800)">{r.marks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="mt-2 space-y-4" aria-hidden="true">
              {Array.from({ length: lines }, (_, i) => (
                <div key={i} className="h-px bg-(--ink)/20" />
              ))}
            </div>
          ))}
        {key && item.solution && item.type !== "calc" && <p className="mt-1.5 text-[13px] text-(--ink-2)">Why: {item.solution}</p>}
      </div>
    </div>
  );
}

const Key = ({ children }: { children: ReactNode }) => <span className="inline-flex rounded bg-(--teal-50) px-1.5 font-semibold text-(--teal-900)">{children}</span>;

function ItemEditor({ id, d, item, n }: { id: string; d: Draft; item: Item; n: number }) {
  const up = (patch: Partial<Item>) => updateItem(id, item.id, patch);
  const label = "text-[11.5px] font-semibold tracking-wide text-(--muted) uppercase";
  return (
    <div className="space-y-3 pl-9">
      <div className="flex items-center gap-2">
        <span className="-ml-9 w-6 text-right font-semibold tabular-nums">{n}.</span>
        <Pill tone="none">{QTYPE_LABEL[item.type]}</Pill>
        {item.origin === "ai" ? (
          <span className="flex items-center gap-1 text-[12px] text-(--gold-700)">
            <SparkIcon className="h-3 w-3" /> AI draft
          </span>
        ) : (
          <span className="text-[12px] text-(--muted)">Written by you</span>
        )}
      </div>
      <div>
        <label className={label} htmlFor={`p-${item.id}`}>
          Question
        </label>
        <textarea id={`p-${item.id}`} value={item.prompt} onChange={(e) => up({ prompt: e.target.value })} rows={2} className={cx(inputClass, "mt-1 resize-y text-[15px]")} />
      </div>

      {item.type === "mcq" && (
        <fieldset>
          <legend className={label}>Options · choose the correct one</legend>
          <div className="mt-1 space-y-1.5">
            {item.options.map((o, i) => (
              <div key={o.id} className="flex items-center gap-2">
                <input type="radio" name={`c-${item.id}`} checked={item.correctId === o.id} onChange={() => up({ correctId: o.id })} aria-label={`Option ${o.id} is correct`} className="h-4 w-4 accent-[#0f766e]" />
                <span className="w-4 text-[13px] font-semibold">{o.id})</span>
                <input
                  value={o.text}
                  aria-label={`Option ${o.id}`}
                  onChange={(e) => up({ options: item.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                  className={cx(inputClass, "py-1.5")}
                />
                <IconButton label={`Remove option ${o.id}`} disabled={item.options.length <= 2} onClick={() => up({ options: item.options.filter((_, j) => j !== i), correctId: item.correctId === o.id ? item.options[0].id : item.correctId })}>
                  <XIcon />
                </IconButton>
              </div>
            ))}
            {item.options.length < 6 && (
              <Button size="sm" variant="quiet" onClick={() => up({ options: [...item.options, { id: String.fromCharCode(97 + item.options.length), text: "" }] })}>
                <PlusIcon /> Add option
              </Button>
            )}
          </div>
        </fieldset>
      )}
      {item.type === "tf" && (
        <div>
          <p className={label}>Answer</p>
          <div className="mt-1">
            <Segmented
              size="sm"
              label="Answer"
              value={item.tf === null ? "none" : item.tf ? "true" : "false"}
              onChange={(v) => up({ tf: v === "none" ? null : v === "true" })}
              options={[
                { value: "true", label: "True" },
                { value: "false", label: "False" },
              ]}
            />
          </div>
        </div>
      )}
      {(item.type === "fill" || item.type === "calc") && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={label} htmlFor={`a-${item.id}`}>
              Answer key
            </label>
            <input id={`a-${item.id}`} value={item.answer} onChange={(e) => up({ answer: e.target.value })} className={cx(inputClass, "mt-1")} />
          </div>
          {item.type === "calc" && (
            <div>
              <label className={label} htmlFor={`s-${item.id}`}>
                Worked solution
              </label>
              <input id={`s-${item.id}`} value={item.solution} onChange={(e) => up({ solution: e.target.value })} className={cx(inputClass, "mt-1 font-mono text-[13px]")} />
            </div>
          )}
        </div>
      )}
      {item.type === "match" && (
        <fieldset>
          <legend className={label}>Pairs</legend>
          <div className="mt-1 space-y-1.5">
            {item.pairs.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input value={p.left} aria-label={`Left ${i + 1}`} onChange={(e) => up({ pairs: item.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)) })} className={cx(inputClass, "py-1.5")} />
                <input value={p.right} aria-label={`Right ${i + 1}`} onChange={(e) => up({ pairs: item.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)) })} className={cx(inputClass, "py-1.5")} />
                <IconButton label={`Remove pair ${i + 1}`} disabled={item.pairs.length <= 2} onClick={() => up({ pairs: item.pairs.filter((_, j) => j !== i) })}>
                  <XIcon />
                </IconButton>
              </div>
            ))}
            <Button size="sm" variant="quiet" onClick={() => up({ pairs: [...item.pairs, { left: "", right: "" }] })}>
              <PlusIcon /> Add pair
            </Button>
          </div>
        </fieldset>
      )}
      {(item.type === "short" || item.type === "long") && (
        <fieldset>
          <legend className={label}>Marking rubric</legend>
          <div className="mt-1 space-y-1.5">
            {item.rubric.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={r.text} aria-label={`Criterion ${i + 1}`} onChange={(e) => up({ rubric: item.rubric.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} className={cx(inputClass, "py-1.5")} />
                <Stepper label={`Marks for criterion ${i + 1}`} value={r.marks} min={0} max={10} onChange={(v) => up({ rubric: item.rubric.map((x, j) => (j === i ? { ...x, marks: v } : x)) })} />
                <IconButton label={`Remove criterion ${i + 1}`} disabled={item.rubric.length <= 1} onClick={() => up({ rubric: item.rubric.filter((_, j) => j !== i) })}>
                  <XIcon />
                </IconButton>
              </div>
            ))}
            <Button size="sm" variant="quiet" onClick={() => up({ rubric: [...item.rubric, { text: "", marks: 1 }] })}>
              <PlusIcon /> Add criterion
            </Button>
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-t border-(--line) pt-3">
        <div>
          <p className={label}>Marks</p>
          <div className="mt-1">
            <Stepper label="Marks" value={item.marks} min={1} max={20} onChange={(v) => up({ marks: v })} />
          </div>
        </div>
        <div>
          <label className={label} htmlFor={`d-${item.id}`}>
            Difficulty
          </label>
          <select id={`d-${item.id}`} value={item.difficulty} onChange={(e) => up({ difficulty: e.target.value as Difficulty })} className={cx(inputClass, "mt-1 h-9 w-auto py-1")}>
            {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((k) => (
              <option key={k} value={k}>
                {DIFFICULTY_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`o-${item.id}`}>
            Outcome
          </label>
          <select
            id={`o-${item.id}`}
            value={item.outcomeIds[0] ?? ""}
            onChange={(e) => up({ outcomeIds: [e.target.value] })}
            className={cx(inputClass, "mt-1 h-9 w-auto py-1")}
          >
            {d.outcomeIds.map((o) => (
              <option key={o} value={o}>
                {codeOf(o)}
              </option>
            ))}
            {item.outcomeIds.filter((o) => !d.outcomeIds.includes(o)).map((o) => (
              <option key={o} value={o}>
                {codeOf(o)} (not in this resource)
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className={label}>Students must</legend>
          <div className="mt-1 flex gap-1.5">
            {(["investigate", "represent", "explore"] as Verb[]).map((v) => {
              const on = item.verbs.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={on}
                  onClick={() => up({ verbs: on ? item.verbs.filter((x) => x !== v) : [...item.verbs, v] })}
                  className={cx("h-8 rounded-(--r-sm) border px-2 text-[12.5px] font-semibold", on ? "border-(--teal-700) bg-(--teal-50) text-(--teal-900)" : "border-(--line) text-(--muted)")}
                >
                  {verbLabel(v)}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

function ItemToolbar({ id, sec, item, state, onReview, onDone, onSelect }: { id: string; sec: Section; item: Item; state: ReviewState; onReview: () => void; onDone: () => void; onSelect: (id: string | null) => void }) {
  const [regen, setRegen] = useState(false);
  const [guide, setGuide] = useState("");
  const [busy, setBusy] = useState(false);
  const { ai } = useProto();
  const i = sec.items.findIndex((x) => x.id === item.id);
  return (
    <div className="mt-3 border-t border-(--line) pt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant={state === "reviewed" ? "secondary" : "primary"} onClick={onReview}>
          <CheckIcon />
          {state === "reviewed" ? "Reviewed" : "Mark reviewed"}
          <Kbd>R</Kbd>
        </Button>
        <Button size="sm" onClick={() => setRegen((v) => !v)} aria-expanded={regen}>
          <RefreshIcon /> Regenerate
        </Button>
        <IconButton label="Move up" disabled={i === 0} onClick={() => moveItem(id, item.id, -1)}>
          <ChevronUp />
        </IconButton>
        <IconButton label="Move down" disabled={i === sec.items.length - 1} onClick={() => moveItem(id, item.id, 1)}>
          <ChevronDown />
        </IconButton>
        <IconButton label="Duplicate" onClick={() => onSelect(duplicateItem(id, item.id))}>
          <CopyIcon />
        </IconButton>
        <IconButton
          label="Delete question"
          onClick={() => {
            deleteItem(id, item.id);
            onSelect(null);
            toast("Question deleted.", "info");
          }}
        >
          <TrashIcon />
        </IconButton>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onDone}>
          Done
        </Button>
      </div>
      {regen && (
        <div className="fz-pop-in mt-3 rounded-(--r-md) border border-(--line) bg-white p-3">
          <p className="text-[13px] font-semibold">Regenerate only this question</p>
          <p className="text-[12.5px] text-(--muted)">
            The rest of the document stays as it is. You see both versions before anything changes.{" "}
            {ai.configured ? `Written by ${ai.provider ?? "the AI provider"}.` : "AI drafting is not set up, so Funza offers another question from its bank."}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Make it easier", "Make it harder", "Use a different context", "Fix the wording"].map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={guide === g}
                onClick={() => setGuide(guide === g ? "" : g)}
                className={cx("h-7 rounded-full border px-2.5 text-[12px]", guide === g ? "border-(--teal-700) bg-(--teal-50) font-semibold text-(--teal-900)" : "border-(--line) text-(--ink-2)")}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="primary"
              loading={busy}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await regenerateItem(id, item.id, guide);
                setBusy(false);
                if (!res.ok) toast(res.message ?? "No new version was made.", "bad");
                else setRegen(false);
              }}
            >
              {!busy && <SparkIcon className="h-3.5 w-3.5" />} {busy ? "Writing a new version…" : "Generate a new version"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRegen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TextBlock({
  id,
  d,
  sec,
  lens,
  rows,
  selected,
  flash,
  locked,
  onSelect,
  onReview,
}: {
  id: string;
  d: Draft;
  sec: Section;
  lens: Lens;
  rows: CheckRow[];
  selected: boolean;
  flash: boolean;
  locked: boolean;
  onSelect: (id: string | null) => void;
  onReview: (id: string) => void;
}) {
  const state = sectionReview(sec);
  const failed = rows.filter((r) => r.targetId === sec.id && r.state === "failed");
  const viz = motionGraph(sec.motion);
  const i = d.sections.indexOf(sec);
  return (
    <section
      id={`blk-${sec.id}`}
      aria-label={sec.title}
      onFocus={() => onSelect(sec.id)}
      className={cx("relative -mx-3 rounded-(--r-md) px-3 py-2", flash && "fz-flash", selected && "bg-(--surface-2) shadow-[0_0_0_1.5px_var(--teal-700)]")}
    >
      <Gutter state={state} failed={failed.length > 0} />
      <div className="flex items-baseline gap-3">
        <input
          aria-label="Section title"
          value={sec.title}
          readOnly={locked}
          onChange={(e) => updateSection(id, sec.id, { title: e.target.value })}
          className="fz-display -ml-1.5 min-w-0 flex-1 rounded-(--r-sm) border border-transparent bg-transparent px-1.5 text-[17px] font-bold outline-none hover:border-(--line) focus:border-(--teal-700) read-only:hover:border-transparent"
        />
        {sec.minutes !== null && (
          <span className="flex items-center gap-1.5 text-[13px] text-(--muted)">
            {locked ? `${sec.minutes} min` : <Stepper label={`Minutes for ${sec.title}`} value={sec.minutes} min={0} max={120} suffix="min" onChange={(v) => updateSection(id, sec.id, { minutes: v })} />}
          </span>
        )}
      </div>
      {sec.kind === "activity" && viz && (
        <div className="mt-2 overflow-hidden rounded-(--r-md) border border-(--line)">
          <ActivityStage config={viz} />
        </div>
      )}
      <textarea
        aria-label={`Text of ${sec.title}`}
        value={sec.body}
        readOnly={locked}
        rows={2}
        onChange={(e) => updateSection(id, sec.id, { body: e.target.value })}
        placeholder="Write this section…"
        className={cx(textArea, "mt-1 -ml-1.5 text-[15px] leading-relaxed")}
      />
      {sec.kind === "activity" && sec.motion && !locked && selected && (
        <div className="mt-2 flex flex-wrap gap-3 rounded-(--r-md) bg-white p-2.5 text-[12.5px]">
          {sec.motion.objects.map((o, j) => (
            <label key={j} className="flex items-center gap-2">
              {o.label} speed
              <Stepper
                label={`${o.label} speed`}
                value={o.speed}
                min={1}
                max={30}
                suffix="m/s"
                onChange={(v) => updateSection(id, sec.id, { motion: { ...sec.motion!, objects: sec.motion!.objects.map((x, k) => (k === j ? { ...x, speed: v } : x)) } })}
              />
            </label>
          ))}
        </div>
      )}
      {lens === "alignment" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sec.outcomeIds.map((o) => (
            <Pill key={o} tone="teal">
              {codeOf(o)}
            </Pill>
          ))}
          {sec.verbs.map((v) => (
            <Pill key={v} tone="none">
              {verbLabel(v)}
            </Pill>
          ))}
          {sec.claim && <CheckBadge state={rows.find((r) => r.targetId === sec.id)?.state ?? "unverifiable"} />}
        </div>
      )}
      {failed.map((r) => (
        <div key={r.id} className="mt-2 flex flex-wrap items-center gap-2 rounded-(--r-sm) bg-(--bad-bg) px-2.5 py-1.5 text-[12.5px] text-(--bad)">
          <span className="min-w-0 flex-1">
            <b>{r.label}.</b> {r.detail}
          </span>
          {r.fix && !locked && (
            <Button size="sm" variant="danger" className="h-7" onClick={() => applyFix(id, r.fix!.action)}>
              {r.fix.label}
            </Button>
          )}
        </div>
      ))}
      {!locked && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant={state === "reviewed" ? "ghost" : "secondary"} onClick={() => onReview(sec.id)}>
            <CheckIcon /> {state === "reviewed" ? "Reviewed" : "Mark reviewed"}
          </Button>
          <IconButton label="Move section up" disabled={i === 0} onClick={() => moveSection(id, sec.id, -1)}>
            <ChevronUp />
          </IconButton>
          <IconButton label="Move section down" disabled={i === d.sections.length - 1} onClick={() => moveSection(id, sec.id, 1)}>
            <ChevronDown />
          </IconButton>
        </div>
      )}
    </section>
  );
}

/* ---------- outline ---------- */

function OutlinePanel({
  d,
  rows,
  selected,
  onPick,
  onNext,
  onClose,
  locked,
  id,
}: {
  d: Draft;
  rows: CheckRow[];
  selected: string | null;
  onPick: (id: string) => void;
  onNext: () => void;
  onClose: () => void;
  locked: boolean;
  id: string;
}) {
  const num = numbering(d.sections);
  const failing = new Set(rows.filter((r) => r.state === "failed").map((r) => r.targetId));
  const all = [...d.sections.filter((s) => s.kind !== "questions").map((s) => sectionReview(s)), ...allItems(d).map(itemReview)];
  const done = all.filter((x) => x === "reviewed").length;
  const icon = (target: string, st: ReviewState) =>
    failing.has(target) ? (
      <XIcon className="h-3.5 w-3.5 text-(--bad)" />
    ) : st === "reviewed" ? (
      <CheckIcon className="h-3.5 w-3.5 text-(--teal-700)" />
    ) : st === "changed" ? (
      <RefreshIcon className="h-3.5 w-3.5 text-(--info)" />
    ) : (
      <SparkIcon className="h-3 w-3 text-(--gold-500)" />
    );
  return (
    <div className="p-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[13px] font-bold">Outline</h2>
        <IconButton label="Close outline" onClick={onClose}>
          <XIcon />
        </IconButton>
      </div>
      <div className="mt-2 rounded-(--r-md) bg-(--surface) p-2.5 shadow-(--sh-1)">
        <p className="text-[12.5px]">
          <b>{done}</b> of {all.length} parts reviewed
        </p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-(--bg-sunk)" aria-hidden="true">
          <div className="h-full bg-(--teal-700)" style={{ width: `${all.length ? (done / all.length) * 100 : 0}%` }} />
        </div>
        {!locked && done < all.length && (
          <Button size="sm" variant="quiet" className="mt-1.5 -ml-1.5" onClick={onNext}>
            Next that needs you <Kbd>N</Kbd>
          </Button>
        )}
      </div>
      <ol className="mt-3 space-y-3">
        {d.sections.map((sec, si) => (
          <li key={sec.id}>
            <div className="group flex items-center gap-1">
              {sec.kind === "questions" ? (
                <p className="min-w-0 flex-1 truncate px-1 text-[11.5px] font-semibold tracking-wide text-(--muted) uppercase">{sec.title}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => onPick(sec.id)}
                  className={cx("flex min-w-0 flex-1 items-center gap-2 rounded-(--r-sm) px-1.5 py-1 text-left text-[13px] font-semibold", selected === sec.id ? "bg-(--teal-50) text-(--teal-900)" : "hover:bg-(--bg-sunk)")}
                >
                  {icon(sec.id, sectionReview(sec))}
                  <span className="truncate">{sec.title}</span>
                </button>
              )}
              {!locked && (
                <span className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton label={`Move ${sec.title} up`} disabled={si === 0} onClick={() => moveSection(id, sec.id, -1)} className="h-6 w-6">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton label={`Move ${sec.title} down`} disabled={si === d.sections.length - 1} onClick={() => moveSection(id, sec.id, 1)} className="h-6 w-6">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </IconButton>
                </span>
              )}
            </div>
            {sec.items.length > 0 && (
              <ol className="mt-0.5 space-y-px">
                {sec.items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => onPick(it.id)}
                      aria-current={selected === it.id ? "true" : undefined}
                      className={cx("flex w-full items-center gap-2 rounded-(--r-sm) px-1.5 py-1 text-left text-[12.5px]", selected === it.id ? "bg-(--teal-50) text-(--teal-900)" : "text-(--ink-2) hover:bg-(--bg-sunk)")}
                    >
                      <span className="flex w-4 justify-center">{icon(it.id, itemReview(it))}</span>
                      <span className="w-7 shrink-0 font-semibold tabular-nums">Q{num.get(it.id)}</span>
                      <span className="truncate">{it.prompt || "Empty question"}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- checks ---------- */

function ChecksPanel({ id, d, rows, counts, locked, onJump }: { id: string; d: Draft; rows: CheckRow[]; counts: ReturnType<typeof checkCounts>; locked: boolean; onJump: (t: string) => void }) {
  const must = rows.filter((r) => r.state === "failed");
  const you = rows.filter((r) => r.state === "needs-you" || r.state === "stale");
  const cant = rows.filter((r) => r.state === "unverifiable");
  const passed = rows.filter((r) => r.state === "passed");
  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-wrap gap-1.5">
        <CheckBadge state="failed" count={counts.failed} />
        <CheckBadge state="needs-you" count={counts["needs-you"] + counts.stale} />
        <CheckBadge state="unverifiable" count={counts.unverifiable} />
        <CheckBadge state="passed" count={counts.passed} />
      </div>
      <p className="text-[12.5px] text-(--muted)">
        Every result is computed from the document as it is now and runs again on each edit. Funza never scores alignment or confidence. Approval needs nothing failed and nothing waiting on you.
      </p>

      <Group title="Must fix" empty="Nothing has failed." rows={must} onJump={onJump} id={id} locked={locked} />
      <Group title="Needs you" empty="Nothing is waiting on you." rows={you} onJump={onJump} id={id} locked={locked} d={d} />
      <Group title="Funza can't check" empty="Everything here could be checked." rows={cant} onJump={onJump} id={id} locked={locked} />

      <details className="rounded-(--r-md) border border-(--line)">
        <summary className="cursor-pointer px-3 py-2.5 text-[13px] font-semibold">
          Passed <span className="font-normal text-(--muted)">({passed.length})</span>
        </summary>
        <ul className="space-y-2 border-t border-(--line) px-3 py-2.5">
          {passed.map((r) => (
            <CheckLine key={r.id} r={r} onJump={onJump} id={id} locked={locked} />
          ))}
        </ul>
      </details>

    </div>
  );
}

function Group({ title, empty, rows, onJump, id, locked, d }: { title: string; empty: string; rows: CheckRow[]; onJump: (t: string) => void; id: string; locked: boolean; d?: Draft }) {
  return (
    <section aria-label={title}>
      <h3 className="text-[12px] font-semibold tracking-wide text-(--muted) uppercase">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-[12.5px] text-(--muted)">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((r) => (
            <CheckLine key={r.id} r={r} onJump={onJump} id={id} locked={locked} d={d} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CheckLine({ r, onJump, id, locked, d }: { r: CheckRow; onJump: (t: string) => void; id: string; locked: boolean; d?: Draft }) {
  const m = CHECK_META[r.state];
  const global = r.id === "g-reading" ? "readingLevel" : r.id === "g-indicators" ? "indicatorsPending" : null;
  return (
    <li className="rounded-(--r-md) border border-(--line) bg-(--surface) p-2.5 text-[12.5px]">
      <div className="flex items-start gap-2">
        <span className={cx("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full", { ok: "bg-(--ok-bg) text-(--ok)", bad: "bg-(--bad-bg) text-(--bad)", none: "bg-(--none-bg) text-(--none)", gold: "bg-(--gold-50) text-(--gold-700)", info: "bg-(--info-bg) text-(--info)", teal: "", navy: "" }[m.tone])}>
          {m.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-(--ink)">
            {r.label}
            <span className="sr-only"> ({m.word})</span>
          </p>
          <p className="mt-0.5 text-(--ink-2)">{r.detail}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {global && d && !locked && (
              <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-(--ink)">
                <input type="checkbox" checked={d.globals[global]} onChange={(e) => setGlobal(id, global, e.target.checked)} className="h-4 w-4 accent-[#0f766e]" />
                I confirm
              </label>
            )}
            {r.targetId && (
              <button type="button" onClick={() => onJump(r.targetId!)} className="font-semibold text-(--teal-700) hover:underline">
                Show
              </button>
            )}
            {r.fix && !locked && (
              <button type="button" onClick={() => applyFix(id, r.fix!.action)} className="font-semibold text-(--bad) hover:underline">
                {r.fix.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/* ---------- alignment ---------- */

function AlignmentPanel({ id, d, onChangeOutcomes, locked }: { id: string; d: Draft; onChangeOutcomes: () => void; locked: boolean }) {
  const items = allItems(d);
  const total = totalMarks(d);
  const verbs = verbCoverage(d);
  const diff = difficultyMarks(d);
  const ws = useProto();
  const brief = ws.resources.find((r) => r.id === id)?.brief;
  const planned = brief ? brief.mix.reduce((n, r) => n + r.count * r.marks, 0) : null;
  const split = brief ? PRESETS[brief.difficulty].split : null;
  return (
    <div className="space-y-6 p-4">
      <section aria-label="Outcomes">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-semibold tracking-wide text-(--muted) uppercase">Outcomes in this resource</h3>
          {!locked && (
            <Button size="sm" variant="quiet" onClick={onChangeOutcomes}>
              Change
            </Button>
          )}
        </div>
        <div className="mt-2 space-y-3">
          {d.outcomeIds.map((o) => {
            const found = outcomeById(o)?.outcome;
            const its = items.filter((i) => i.outcomeIds.includes(o));
            const marks = its.reduce((n, i) => n + i.marks, 0);
            const secs = d.sections.filter((x) => x.kind !== "questions" && x.outcomeIds.includes(o));
            return (
              <div key={o} className="rounded-(--r-md) border border-(--line) p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{found?.code}</span>
                  <VerificationBadge mark="source-checked" compact />
                </div>
                {found && (
                  <div className="mt-2">
                    <OfficialWording statement={found.statement} small />
                  </div>
                )}
                <p className={cx("mt-2.5 text-[12.5px] font-semibold", its.length + secs.length === 0 ? "text-(--bad)" : "text-(--ink)")}>
                  {its.length > 0 ? `${its.length} question${its.length === 1 ? "" : "s"} · ${marks} of ${total} marks` : secs.length > 0 ? `${secs.length} section${secs.length === 1 ? "" : "s"}` : "Nothing covers this outcome yet"}
                </p>
                <p className="mt-0.5 text-[12px] text-(--muted)">Indicators: not verified yet. Aligned to the statement only.</p>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="What students are asked to do">
        <h3 className="text-[12px] font-semibold tracking-wide text-(--muted) uppercase">What students are asked to do</h3>
        <p className="mt-1 text-[12px] text-(--muted)">Verbs from the official wording, matched to the parts that ask students to do them. Tags were suggested with the draft; change them on any question.</p>
        <ul className="mt-2 space-y-2">
          {verbs.map((v) => (
            <li key={`${v.outcomeId}-${v.verb}`} className="rounded-(--r-md) border border-(--line) p-2.5 text-[12.5px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {verbLabel(v.verb)} <span className="font-normal text-(--muted)">· {codeOf(v.outcomeId)}</span>
                </span>
                {v.where.length > 0 ? <Pill tone="ok">Covered</Pill> : <Pill tone="gold">Weak</Pill>}
              </div>
              <p className="mt-1 text-(--ink-2)">{v.where.length > 0 ? v.where.join(", ") : suggestion(v.verb)}</p>
            </li>
          ))}
        </ul>
      </section>

      {isQuestionKind(d.kind) && (
        <section aria-label="Plan against draft">
          <h3 className="text-[12px] font-semibold tracking-wide text-(--muted) uppercase">Blueprint against draft</h3>
          <table className="mt-2 w-full text-[12.5px]">
            <thead className="text-(--muted)">
              <tr>
                <th scope="col" className="py-1 text-left font-semibold"></th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Planned
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Draft
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-t border-(--line)">
                <th scope="row" className="py-1.5 text-left font-semibold">
                  Marks
                </th>
                <td className="py-1.5 text-right">{planned ?? "–"}</td>
                <td className={cx("py-1.5 text-right font-semibold", planned !== null && planned !== total && "text-(--gold-700)")}>{total}</td>
              </tr>
              {(["foundational", "grade", "extending"] as Difficulty[]).map((k, i) => (
                <tr key={k} className="border-t border-(--line)">
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {DIFFICULTY_LABEL[k]}
                  </th>
                  <td className="py-1.5 text-right">{split && planned !== null ? Math.round((planned * split[i]) / 100) : "–"}</td>
                  <td className="py-1.5 text-right">{diff[k]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[12px] text-(--muted)">Marks, not percentages of confidence. Differences are yours to accept or fix.</p>
        </section>
      )}
    </div>
  );
}

function suggestion(v: Verb) {
  if (v === "investigate") return "No part asks students to investigate. On paper, a long answer that plans an investigation, or a data table to analyse, would cover it.";
  if (v === "represent") return "No part asks students to represent motion. Add a question where they draw or read a graph.";
  return "No part asks students to explore this.";
}

function ApproveDialog({ open, onClose, d, rows, kindLabel, onApprove, onJump }: { open: boolean; onClose: () => void; d: Draft; rows: CheckRow[]; kindLabel: string; onApprove: () => void; onJump: (t: string) => void }) {
  const blockers = approvalBlockers(rows);
  const c = checkCounts(rows);
  const items = allItems(d);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={blockers.length > 0 ? `${blockers.length} thing${blockers.length === 1 ? "" : "s"} before you can approve` : `Approve version ${d.version}?`}
      description={blockers.length > 0 ? "Approval needs nothing failed and nothing waiting on you." : "Approving locks this version. Nothing reaches students until you publish it to your class."}
      footer={
        <>
          <Button onClick={onClose}>{blockers.length > 0 ? "Back to the document" : "Cancel"}</Button>
          <Button variant="primary" disabled={blockers.length > 0} onClick={onApprove}>
            <CheckIcon /> Approve version {d.version}
          </Button>
        </>
      }
    >
      {blockers.length > 0 ? (
        <ul className="space-y-2">
          {blockers.map((r) => (
            <li key={r.id} className="flex items-start gap-2.5 text-[13.5px]">
              <CheckBadge state={r.state} />
              <span className="min-w-0 flex-1">
                <b>{r.label}.</b> <span className="text-(--ink-2)">{r.detail}</span>
              </span>
              {r.targetId && (
                <button type="button" onClick={() => onJump(r.targetId!)} className="shrink-0 font-semibold text-(--teal-700) hover:underline">
                  Show
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13.5px]">
          <dt className="text-(--muted)">Resource</dt>
          <dd className="font-semibold">
            {d.title} · {kindLabel}
          </dd>
          <dt className="text-(--muted)">Outcomes</dt>
          <dd>{d.outcomeIds.map((id) => { const o = outcomeById(id)?.outcome; return o ? `${o.code} (${o.indicatorsStatus === "pending" ? "statement only; indicators pending" : o.indicatorsStatus === "imported" ? "indicators imported, not checked by a person" : "indicators verified"})` : id; }).join(", ")}</dd>
          {items.length > 0 && (
            <>
              <dt className="text-(--muted)">Questions</dt>
              <dd>
                {items.length} questions · {totalMarks(d)} marks
              </dd>
            </>
          )}
          <dt className="text-(--muted)">Checks</dt>
          <dd>
            {c.passed} passed · {c.unverifiable} not machine-checkable, each reviewed by you · 0 failed
          </dd>
        </dl>
      )}
    </Dialog>
  );
}

function OutcomesDialog({ open, onClose, id, d }: { open: boolean; onClose: () => void; id: string; d: Draft }) {
  const [picked, setPicked] = useState<string[]>(d.outcomeIds);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Outcomes for this resource"
      description="Changing outcomes re-runs every check. Questions that cite a removed outcome will be flagged, and a new outcome with no questions shows as a gap."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={picked.length === 0}
            onClick={() => {
              setDraftOutcomes(id, picked);
              onClose();
            }}
          >
            Save outcomes
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="sr-only">Outcomes</legend>
        <ul className="space-y-2">
          {[...new Set([...d.outcomeIds, ...knownOutcomes().filter((f) => d.outcomeIds.some((id) => outcomeById(id)?.course.id === f.course.id)).map((f) => f.outcome.id)])].map((id) => outcomeById(id)?.outcome).filter((o) => !!o).map((o) => (
            <li key={o.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-(--r-md) border border-(--line) p-3 hover:border-(--line-strong)">
                <input
                  type="checkbox"
                  checked={picked.includes(o.id)}
                  onChange={() => setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))}
                  className="mt-1 h-4 w-4 accent-[#0f766e]"
                />
                <span>
                  <span className="block font-semibold">{o.code}</span>
                  <span className="block text-[13px] text-(--ink-2)">{o.statement}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </Dialog>
  );
}
