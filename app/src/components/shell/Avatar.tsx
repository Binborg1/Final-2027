import { cn } from "@/lib/ui/cn";

/** The teacher's initials on the terracotta tint. */
export function Avatar({ initials, size = 36, className }: { initials: string; size?: 36 | 56; className?: string }) {
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full border border-white/90 bg-accent-tint font-bold text-accent-ink", size === 36 ? "size-9 text-meta" : "size-14 text-card", className)}>
      {initials}
    </span>
  );
}
