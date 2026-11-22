import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

/** A white glass card inside the workspace panel: radius 22, no shadow. */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section className={cn("rounded-card border border-line-glass bg-surface", className)} {...rest}>
      {children}
    </section>
  );
}

/** The card's heading row: title, an optional count or note, and actions pushed to the right. */
export function CardHeader({ title, after, actions, id, level = 2, size = "lg" }: { title: ReactNode; after?: ReactNode; actions?: ReactNode; id?: string; level?: 2 | 3; size?: "lg" | "sm" }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className="flex items-center gap-2.5">
      <H id={id} className={cn("font-bold text-ink", size === "lg" ? "text-card" : "text-card-sm")}>
        {title}
      </H>
      {after}
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Small uppercase label above a group. */
export function Overline({ children, className, as: As = "p" }: { children: ReactNode; className?: string; as?: "p" | "h2" | "h3" | "span" | "legend" }) {
  return <As className={cn("text-badge font-bold tracking-[0.06em] text-ink-2 uppercase", className)}>{children}</As>;
}

/** A keyboard key hint. On a terracotta button, use tone="on-accent". */
export function Kbd({ children, className, tone = "default" }: { children: ReactNode; className?: string; tone?: "default" | "on-accent" }) {
  return (
    <kbd className={cn("inline-flex h-5 items-center rounded-[7px] border px-1.5 font-sans text-kbd font-semibold", tone === "on-accent" ? "border-white/35 bg-white/20 text-white" : "border-line-2 bg-white/85 text-ink-2", className)}>
      {children}
    </kbd>
  );
}
