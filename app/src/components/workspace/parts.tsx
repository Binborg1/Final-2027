"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { codeOf } from "@/lib/curriculum/sources";
import { checkCounts, computeChecks, reviewables } from "@/lib/resources/checks";
import { ExamIcon, GraphIcon, HomeworkIcon, NotesIcon, PlanIcon, QuizIcon, SlidesIcon, WorksheetIcon } from "./icons";
import type { Draft, ResourceKind } from "@/lib/resources/types";
import { CheckBadge, cx, Pill } from "./ui";

export const KIND_ICON: Record<ResourceKind, (p: { className?: string }) => ReactNode> = {
  notes: NotesIcon,
  quiz: QuizIcon,
  test: QuizIcon,
  exam: ExamIcon,
  "lesson-plan": PlanIcon,
  worksheet: WorksheetIcon,
  homework: HomeworkIcon,
  presentation: SlidesIcon,
  visualization: GraphIcon,
};

/* Each family gets one quiet tint so a list scans by type without relying on colour. */
const TINT: Record<ResourceKind, string> = {
  notes: "bg-[#e8eefb] text-[#2850a8]",
  quiz: "bg-(--teal-50) text-(--teal-800)",
  test: "bg-(--teal-50) text-(--teal-800)",
  exam: "bg-[#e9e7f8] text-[#4a3fa0]",
  "lesson-plan": "bg-(--gold-50) text-(--gold-700)",
  worksheet: "bg-[#f3ece4] text-[#7a4a1f]",
  homework: "bg-[#f3ece4] text-[#7a4a1f]",
  presentation: "bg-[#eef0f4] text-[#3b4263]",
  visualization: "bg-(--teal-50) text-(--teal-800)",
};

export function KindIcon({ kind, size = "md" }: { kind: ResourceKind; size?: "sm" | "md" | "lg" }) {
  const Icon = KIND_ICON[kind];
  const box = size === "sm" ? "h-7 w-7 rounded-[8px]" : size === "lg" ? "h-11 w-11 rounded-(--r-md)" : "h-9 w-9 rounded-[9px]";
  const icon = size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  return (
    <span className={cx("flex shrink-0 items-center justify-center", box, TINT[kind])} aria-hidden="true">
      <Icon className={icon} />
    </span>
  );
}

export function summarize(d: Draft) {
  const rows = computeChecks(d);
  const c = checkCounts(rows);
  const rv = reviewables(d);
  const reviewed = rv.filter((r) => r.state === "reviewed").length;
  return { rows, counts: c, reviewed, total: rv.length, blockers: c.failed + c["needs-you"] + c.stale };
}

export function ResourceState({ draft, compact = false }: { draft: Draft; compact?: boolean }) {
  if (draft.status === "approved")
    return (
      <Pill tone="ok">
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
        Approved v{draft.approved?.version ?? draft.version}
      </Pill>
    );
  const s = summarize(draft);
  if (compact)
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <Pill tone="gold">Draft · {s.reviewed} of {s.total} reviewed</Pill>
        {s.counts.failed > 0 && <CheckBadge state="failed" count={s.counts.failed} />}
      </span>
    );
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {s.counts.failed > 0 && <CheckBadge state="failed" count={s.counts.failed} />}
      {s.counts["needs-you"] + s.counts.stale > 0 && <CheckBadge state="needs-you" count={s.counts["needs-you"] + s.counts.stale} />}
      {s.blockers === 0 && <Pill tone="teal">Ready to approve</Pill>}
    </span>
  );
}

export function Codes({ ids }: { ids: string[] }) {
  return <span className="font-semibold tracking-tight text-(--ink-2)">{ids.map(codeOf).join(" · ")}</span>;
}

/** A small picture of the document, drawn from its real structure. Gold marks are parts still to review. */
export function DocThumb({ draft }: { draft: Draft }) {
  const rows = draft.sections.flatMap((s) => [{ head: true, gold: false }, ...s.items.slice(0, 4).map((i) => ({ head: false, gold: i.reviewedFp === null }))]).slice(0, 11);
  return (
    <div aria-hidden="true" className="relative h-[124px] w-[96px] shrink-0 rounded-[3px] bg-white p-2.5 shadow-(--sh-paper) ring-1 ring-black/[0.04]">
      <div className="h-1.5 w-12 rounded-full bg-(--ink)/80" />
      <div className="mt-1 h-1 w-8 rounded-full bg-(--line-strong)" />
      <div className="mt-2 space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-1">
            {r.gold ? <span className="h-1 w-1 rounded-full bg-(--gold-400)" /> : <span className="h-1 w-1" />}
            <span className={cx("h-1 rounded-full", r.head ? "w-9 bg-(--teal-700)/70" : "bg-(--line-strong)", !r.head && (i % 3 === 0 ? "w-14" : i % 3 === 1 ? "w-11" : "w-12"))} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A button that opens a short list of actions. Escape and outside clicks close it. */
export function Menu({
  label,
  trigger,
  triggerClass,
  children,
  align = "left",
}: {
  label: string;
  trigger: ReactNode;
  triggerClass: string;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>("[aria-haspopup]")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("[role=menu] [role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={triggerClass}>
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")];
            const i = items.indexOf(document.activeElement as HTMLElement);
            items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
          }}
          className={cx(
            "fz-pop-in absolute top-full z-50 mt-1.5 min-w-[220px] rounded-(--r-md) border border-(--line) bg-(--surface) p-1 shadow-(--sh-3)",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ onSelect, children, disabled, hint }: { onSelect: () => void; children: ReactNode; disabled?: boolean; hint?: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13.5px] text-(--ink-2) hover:bg-(--bg-sunk) hover:text-(--ink) focus:bg-(--bg-sunk) focus:outline-none disabled:opacity-40"
    >
      {children}
      {hint && <span className="ml-auto pl-3 text-[11.5px] text-(--muted)">{hint}</span>}
    </button>
  );
}

/** The quiet orbit from the logo, used once per screen at most. */
export function Orbit({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 200" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="250" cy="110" rx="190" ry="62" transform="rotate(-12 250 110)" fill="none" stroke="var(--teal-400)" strokeOpacity="0.35" strokeWidth="1.6" />
      <circle cx="372" cy="52" r="4.5" fill="var(--teal-400)" />
      <path d="M396 22c.7 6 2.2 7.6 8.6 8.4v.4c-6.4.8-7.9 2.4-8.6 8.6h-.2c-.7-6.2-2.2-7.8-8.6-8.6v-.4c6.4-.8 7.9-2.4 8.6-8.4z" fill="var(--gold-400)" />
    </svg>
  );
}
