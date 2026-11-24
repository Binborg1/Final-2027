import { CircleCheck } from "lucide-react";
import type { ConsoleQuestion } from "@/lib/live/payload";
import { cn } from "@/lib/ui/cn";

/** The options with how many chose each, the correct one in sage; for typed answers, the answer and the most common wrong one. */
export function RevealOptions({ q, large = false }: { q: Pick<ConsoleQuestion, "type" | "options" | "key" | "commonWrong" | "percentRight">; large?: boolean }) {
  if (q.options) {
    const correctText = q.key;
    return (
      <ul className="flex flex-col gap-3">
        {q.options.map((o) => {
          const right = o.text === correctText;
          return (
            <li key={o.id} className={cn("rounded-card border px-5 py-3", right ? "border-sage bg-sage-tint" : "border-white/80 bg-raised")}>
              <div className="flex items-center gap-3">
                {right ? <CircleCheck aria-hidden size={large ? 24 : 20} className="shrink-0 text-sage" /> : null}
                <span className={cn("flex-1 font-bold", large ? "text-[24px] leading-[30px]" : "text-card")}>{o.text}</span>
                {right ? <span className={cn("rounded-full bg-sage px-3 py-1 font-semibold text-white", large ? "text-card-sm" : "text-meta")}>Correct answer</span> : null}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/10" aria-hidden>
                  <span className={cn("block h-full rounded-full", right ? "bg-sage" : "bg-ink-2/60")} style={{ width: `${o.percent}%` }} />
                </span>
                <span className={cn("w-14 text-right font-bold tabular-nums", large ? "text-card" : "text-body")}>{o.percent}%</span>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-card border border-sage bg-sage-tint px-5 py-4">
        <p className={cn("font-semibold text-sage-ink", large ? "text-card-sm" : "text-meta")}>Answer</p>
        <p className={cn("font-bold", large ? "text-[24px] leading-[30px]" : "text-card")}>{q.key}</p>
      </div>
      {q.commonWrong ? (
        <div className="rounded-card border border-white/80 bg-raised px-5 py-4">
          <p className={cn("font-semibold text-ink-2", large ? "text-card" : "text-meta")}>Most common wrong answer · {q.commonWrong.percent}%</p>
          <p className={cn("font-bold", large ? "text-section" : "text-card")}>{q.commonWrong.text}</p>
        </div>
      ) : null}
    </div>
  );
}
