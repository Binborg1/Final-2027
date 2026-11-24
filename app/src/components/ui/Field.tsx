import { Check, ChevronDown } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

/**
 * Labelled form fields. The edge is ink at 50% so the field is visible at 3:1
 * (WCAG 1.4.11); focus adds the terracotta ring. Hints and errors are tied to
 * the control with aria-describedby.
 */

const control =
  "w-full rounded-md border border-line-control bg-field px-4 text-card-sm font-normal text-ink placeholder:text-ink-2 transition-shadow focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent aria-invalid:border-red disabled:opacity-60";

export function Field({ id, label, hint, error, children, className }: { id: string; label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-meta font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-meta font-medium text-red-ink" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-meta font-medium text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string | undefined, error?: boolean, hint?: boolean) => (id ? (error ? `${id}-error` : hint ? `${id}-hint` : undefined) : undefined);

/** `compact` is 46 px tall, the height of a medium button, for the small sign-in cards. */
export function Input({ className, invalid, hasHint, compact, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; hasHint?: boolean; compact?: boolean }) {
  return <input aria-invalid={invalid || undefined} aria-describedby={describedBy(rest.id, invalid, hasHint)} className={cn(control, compact ? "h-[46px]" : "h-[52px]", className)} {...rest} />;
}

export function Textarea({ className, invalid, hasHint, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; hasHint?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} aria-describedby={describedBy(rest.id, invalid, hasHint)} className={cn(control, "min-h-24 py-3 leading-6", className)} {...rest} />;
}

export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <span className={cn("relative block", className)}>
      <select aria-invalid={invalid || undefined} className={cn(control, "h-[52px] appearance-none pr-10")} {...rest}>
        {children}
      </select>
      <ChevronDown aria-hidden size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-2" />
    </span>
  );
}

/** A native checkbox drawn in the Oak style: terracotta with a white tick when checked, a 3:1 edge when not. */
export function Checkbox({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <span className={cn("relative inline-flex size-6 shrink-0", className)}>
      <input
        type="checkbox"
        className="peer size-6 cursor-pointer appearance-none rounded-[7px] border-[1.5px] border-line-control bg-white transition-colors checked:border-accent checked:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        {...rest}
      />
      <Check aria-hidden size={16} strokeWidth={3} className="pointer-events-none absolute top-1 left-1 text-white opacity-0 peer-checked:opacity-100" />
    </span>
  );
}
