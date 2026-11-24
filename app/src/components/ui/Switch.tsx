"use client";

import { cn } from "@/lib/ui/cn";

/** An on/off switch (Figma "Session settings"): sage when on. The whole row is at least 44 px tall to tap. */
export function Switch({ checked, onChange, label, disabled = false, id }: { checked: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className="inline-flex h-11 shrink-0 items-center disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className={cn("flex h-[26px] w-[44px] items-center rounded-full p-[3px] transition-colors motion-reduce:transition-none", checked ? "bg-sage" : "bg-ink/20")}>
        <span className={cn("size-5 rounded-full bg-white shadow-toggle transition-transform motion-reduce:transition-none", checked && "translate-x-[18px]")} />
      </span>
    </button>
  );
}
