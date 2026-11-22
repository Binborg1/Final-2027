"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

/**
 * A modal on the native <dialog>: focus is trapped, Escape closes it, and focus
 * returns to the opener. Glass at 0.90 over a warm scrim.
 */
export function Dialog({ open, onClose, title, description, children, footer, className, labelledBy }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; className?: string; labelledBy?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const titleId = labelledBy ?? "dialog-title";
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(600px,calc(100vw-24px))] rounded-box border border-white/90 bg-white/90 p-0 text-ink shadow-dialog backdrop:bg-ink/40 open:flex open:flex-col",
        className,
      )}
    >
      <div className="flex flex-col gap-5 px-8 py-7 max-sm:px-5 max-sm:py-5">
        <div className="flex items-start gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 id={titleId} className="text-[26px] leading-8 font-bold">
              {title}
            </h2>
            {description ? <p className="text-body text-ink-2">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-full border border-line-2 bg-white/80 hover:bg-white pointer-coarse:size-11">
            <X aria-hidden size={18} strokeWidth={1.75} />
          </button>
        </div>
        {children}
        {footer ? <div className="flex flex-wrap items-center justify-end gap-3">{footer}</div> : null}
      </div>
    </dialog>
  );
}
