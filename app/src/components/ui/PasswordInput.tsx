"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/ui/cn";

/** A password field with a show/hide button inside its right edge (44 px tap target). */
export function PasswordInput({ className, invalid, hasHint, compact, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean; hasHint?: boolean; compact?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="relative block">
      <Input type={shown ? "text" : "password"} invalid={invalid} hasHint={hasHint} compact={compact} className={cn("pr-14", className)} {...rest} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        disabled={rest.disabled}
        className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
      >
        {shown ? <EyeOff aria-hidden size={20} strokeWidth={1.75} /> : <Eye aria-hidden size={20} strokeWidth={1.75} />}
      </button>
    </span>
  );
}
