import { Check, ChevronRight } from "lucide-react";
import { STEPS } from "@/lib/live/state";
import { cn } from "@/lib/ui/cn";

/** The pill under every Live screen (Figma L1–L5): Setup › Lobby › Answering › Marking › Reveal › Results. */
export function LiveSteps({ current }: { current: number }) {
  return (
    <nav aria-label="Live session steps" className="sticky bottom-4 z-10 mx-auto mt-2 w-fit max-w-full overflow-x-auto">
      <ol className="frost frost-bar flex items-center gap-1 rounded-full border border-white/70 p-1.5 shadow-dock">
        {STEPS.map((label, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li key={label} className="flex items-center gap-1" aria-current={now ? "step" : undefined}>
              {i > 0 ? <ChevronRight aria-hidden size={14} strokeWidth={2} className="text-ink-2" /> : null}
              <span className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-body whitespace-nowrap", now ? "bg-white font-bold text-ink shadow-active" : "font-medium text-ink-2", done && "text-ink")}>
                {done ? <Check aria-hidden size={14} strokeWidth={2.5} className="text-sage" /> : null}
                {now && i > 0 && i < STEPS.length - 1 ? <span aria-hidden className="size-2 rounded-full bg-accent" /> : null}
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
