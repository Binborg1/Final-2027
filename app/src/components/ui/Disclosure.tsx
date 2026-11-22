import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

/**
 * A collapsed row that opens in place (native <details>, so it works with the
 * keyboard and without JavaScript). Detailed controls start closed: one
 * direction per screen.
 */
export function Disclosure({ title, summary, children, defaultOpen = false, className }: { title: ReactNode; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  return (
    <details open={defaultOpen} className={cn("group/d rounded-tile border border-white/85 bg-tile", className)}>
      <summary className="flex min-h-[64px] cursor-pointer list-none items-center gap-3 rounded-tile px-3.5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col">
          <span className="text-row font-semibold text-ink">{title}</span>
          {summary ? <span className="truncate text-meta text-ink-2">{summary}</span> : null}
        </span>
        <ChevronDown aria-hidden size={18} strokeWidth={1.75} className="ml-auto shrink-0 text-ink-2 transition-transform group-open/d:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-line px-3.5 pt-3 pb-4">{children}</div>
    </details>
  );
}
