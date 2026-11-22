"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useEffect } from "react";
import { dismissToast, loadWorkspace, useWorkspace } from "@/lib/resources/store";
import { cn } from "@/lib/ui/cn";

/** Loads this teacher's drafts from this browser once, and shows the store's toasts. */
export function WorkspaceBoot({ teacherId }: { teacherId: string }) {
  useEffect(() => loadWorkspace(teacherId), [teacherId]);
  const { toasts } = useWorkspace();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex w-[min(440px,calc(100vw-24px))] -translate-x-1/2 flex-col items-center gap-2 md:left-[calc(104px_+_(100vw_-_128px)/2)]">
      {toasts.map((t) => {
        const Icon = t.tone === "bad" ? CircleAlert : t.tone === "ok" ? CircleCheck : Info;
        return (
          <div key={t.id} role={t.tone === "bad" ? "alert" : "status"} className="pointer-events-auto flex items-start gap-2.5 rounded-[18px] border border-white/90 bg-white/92 py-2.5 pr-2 pl-3.5 shadow-tooltip">
            <Icon aria-hidden size={18} strokeWidth={1.75} className={cn("mt-px shrink-0", t.tone === "bad" ? "text-red" : t.tone === "ok" ? "text-sage" : "text-amber-ink")} />
            <p className={cn("text-body font-semibold", t.tone === "bad" ? "text-red-ink" : t.tone === "ok" ? "text-sage-ink" : "text-ink")}>{t.text}</p>
            <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="ml-1 flex size-6 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-ink/5 pointer-coarse:size-9">
              <X aria-hidden size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
