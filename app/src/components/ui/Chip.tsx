import { Check, CircleCheck, Clock, PenLine, Send, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

/* ---------- status chips: the four material states ---------- */

export type MaterialStatus = "draft" | "in-review" | "approved" | "published";

const STATUS: Record<MaterialStatus, { label: string; icon: LucideIcon; className: string }> = {
  draft: { label: "Draft", icon: PenLine, className: "bg-white/70 text-ink border border-line-2" },
  "in-review": { label: "In review", icon: Clock, className: "bg-amber-tint text-amber-ink" },
  approved: { label: "Approved", icon: CircleCheck, className: "bg-sage-tint text-sage-ink" },
  published: { label: "Published", icon: Send, className: "bg-accent-tint text-accent-ink" },
};

/** Colour plus an icon and the word: never colour alone, and never a bar in front. */
export function StatusChip({ status, className }: { status: MaterialStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-sm px-2.5 text-badge font-semibold whitespace-nowrap", s.className, className)}>
      <s.icon aria-hidden size={13} strokeWidth={2} />
      {s.label}
    </span>
  );
}

/* ---------- choice and quick-prompt chips ---------- */

export type ChipSize = "lg" | "md" | "sm";
const CHIP_SIZE: Record<ChipSize, string> = {
  lg: "h-9 px-3.5 text-body", // 36 px: choice rows (Type, Chapters, grades)
  md: "h-8 px-3.5 text-body", // 32 px: quick prompts, outcome chips
  sm: "h-[30px] px-3 text-meta", // 30 px: Redo chips
};

/**
 * A toggle chip. Selected = tint, a solid terracotta border and a check, the one
 * "selected" recipe used across F · Oak. Under a coarse pointer it grows to 44 px.
 */
export function ChoiceChip({
  selected = false,
  size = "lg",
  icon: Icon,
  suffix,
  className,
  children,
  ...rest
}: { selected?: boolean; size?: ChipSize; icon?: LucideIcon; suffix?: ReactNode; className?: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const LeadIcon = selected ? Check : Icon;
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border transition-colors pointer-coarse:min-h-11 disabled:cursor-not-allowed disabled:opacity-50",
        CHIP_SIZE[size],
        selected ? "border-accent bg-accent-tint font-semibold text-accent-ink" : "border-line-2 bg-chip font-medium text-ink hover:bg-white",
        LeadIcon && "pl-2.5",
        className,
      )}
      {...rest}
    >
      {LeadIcon ? <LeadIcon aria-hidden size={16} strokeWidth={selected ? 2.2 : 1.75} className={selected ? "text-accent" : "text-ink-2"} /> : null}
      <span>{children}</span>
      {suffix ? <span className="text-badge font-medium text-ink-2">{suffix}</span> : null}
    </button>
  );
}

/** A small neutral label (grade tags, type pills). Not interactive. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-[26px] items-center rounded-[13px] bg-ink/[0.06] px-2.5 text-badge font-semibold whitespace-nowrap text-ink", className)}>{children}</span>;
}

/** A count in a tinted pill. */
export function CountPill({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[11px] bg-accent-tint px-2 text-meta font-bold text-accent-ink">{children}</span>;
}
