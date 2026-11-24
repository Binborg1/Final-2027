import { cn } from "@/lib/ui/cn";

/** A number with − and + buttons; typing is allowed and clamped. */
export function NumberStepper({ label, value, min, max, step = 1, suffix, onChange, className }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void; className?: string }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <span className={cn("inline-flex h-9 shrink-0 items-center rounded-full border border-line-control bg-field", className)}>
      <button type="button" aria-label={`Less: ${label}`} onClick={() => onChange(clamp(value - step))} disabled={value <= min} className="flex size-9 items-center justify-center rounded-full text-ink disabled:opacity-40 pointer-coarse:size-11">
        −
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        className="w-9 bg-transparent text-center text-body font-semibold outline-none"
      />
      {suffix ? <span className="-ml-1 text-meta text-ink-2">{suffix}</span> : null}
      <button type="button" aria-label={`More: ${label}`} onClick={() => onChange(clamp(value + step))} disabled={value >= max} className="flex size-9 items-center justify-center rounded-full text-ink disabled:opacity-40 pointer-coarse:size-11">
        +
      </button>
    </span>
  );
}
