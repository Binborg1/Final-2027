import { Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

/**
 * The sign-in card's frame, shared by "Choose a new password": a 420 px glass
 * card that sits inside a laptop screen with room around it.
 */
export const AUTH_CARD = "frost frost-auth w-full max-w-[420px] rounded-panel border border-white/45 px-8 pt-7 pb-6 shadow-auth max-sm:px-5 max-sm:pt-6 max-sm:pb-5";
export const AUTH_HEADING = "text-[26px] leading-8 font-bold tracking-[-0.01em]";
export const AUTH_FOOTER = "mt-5 border-t border-line pt-3.5";

/** The Funza mark: a terracotta circle with the letter F, plus the two-line wordmark. */
export function Logo({ size = 40, wordmark = true, className }: { size?: 32 | 40; wordmark?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-logo font-extrabold text-white", size === 40 ? "size-10 text-[20px]" : "size-8 text-[16px]")}>F</div>
      {wordmark ? (
        <div className="flex flex-col leading-none text-ink">
          <span className="text-[20px] leading-6 font-bold">Funza</span>
          <span className="text-meta leading-4 font-medium">Teacher Studio</span>
        </div>
      ) : (
        <span className="sr-only">Funza Teacher Studio</span>
      )}
    </div>
  );
}

/** Google's "G", from Google's sign-in branding guidelines. */
export function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** What a list or card shows when it has nothing yet: an icon, one sentence, and at most one action. */
export function EmptyState({ icon: Icon, title, children, action, className }: { icon: LucideIcon; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-8 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-md bg-accent-tint text-accent">
        <Icon aria-hidden size={22} strokeWidth={1.6} />
      </span>
      <p className="text-row font-semibold text-ink">{title}</p>
      {children ? <p className="max-w-sm text-body text-ink-2">{children}</p> : null}
      {action}
    </div>
  );
}

/** Hover and focus label for icon-only controls. The trigger keeps its own aria-label. */
export function Tooltip({ label, side = "right", children, className }: { label: string; side?: "right" | "bottom"; children: ReactNode; className?: string }) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 rounded-md border border-line-glass-strong bg-popover px-3.5 py-2 text-body font-semibold whitespace-nowrap text-ink opacity-0 shadow-tooltip transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
          side === "right" ? "top-1/2 left-full ml-2 -translate-y-1/2" : "top-full left-1/2 mt-2 -translate-x-1/2",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/** The setup step indicator: done (sage check), current (terracotta pill), next (ring). */
export function Stepper({ steps, current }: { steps: { label: string; note?: string }[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-3" aria-label="Setup steps">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "next";
        return (
          <li key={s.label} className="flex items-center gap-3" aria-current={state === "current" ? "step" : undefined}>
            {i > 0 ? <span aria-hidden className="h-0.5 w-9 rounded-full bg-ink/20" /> : null}
            {state === "current" ? (
              <span className="flex items-center gap-2 rounded-[20px] border border-white/95 bg-raised py-[5px] pr-3.5 pl-[5px]">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-body font-bold text-white">{i + 1}</span>
                <span className="text-body font-bold">{s.label}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {state === "done" ? (
                  <span className="flex size-7 items-center justify-center rounded-full bg-sage text-white">
                    <Check aria-hidden size={16} strokeWidth={2.5} />
                    <span className="sr-only">Done:</span>
                  </span>
                ) : (
                  <span className="flex size-7 items-center justify-center rounded-full border-[1.5px] border-ink/40 text-body font-semibold text-ink-2">{i + 1}</span>
                )}
                <span className="text-body font-medium">{s.label}</span>
                {s.note ? <span className="text-badge font-medium text-ink-2">{s.note}</span> : null}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A horizontal progress bar (never vertical). */
export function Progress({ value, max, label, tone = "sage", className }: { value: number; max: number; label: string; tone?: "sage" | "accent"; className?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={cn("h-1.5 overflow-hidden rounded-full bg-ink/12", className)}>
      <div className={cn("h-full rounded-full transition-[width]", tone === "sage" ? "bg-sage" : "bg-accent")} style={{ width: `${pct}%` }} />
    </div>
  );
}
