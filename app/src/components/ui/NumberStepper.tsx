import { cn } from "@/lib/ui/cn";

/**
 * A number with − and + buttons; typing is allowed and clamped. `sm` is the compact
 * size for narrow panels. Under a coarse pointer the buttons grow to 44 px, and the
 * pill grows with them.
 */
export function NumberStepper({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  size = "md",
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  size?: "md" | "sm";
  className?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const button = cn("flex shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5 disabled:opacity-35 disabled:hover:bg-transparent pointer-coarse:size-11", size === "sm" ? "size-8" : "size-9");
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border border-line-control bg-field pointer-coarse:h-11", size === "sm" ? "h-8" : "h-9", className)}>
      <button type="button" aria-label={`Less: ${label}`} onClick={() => onChange(clamp(value - step))} disabled={value <= min} className={button}>
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
        className={cn("bg-transparent text-center text-body font-semibold tabular-nums outline-none", size === "sm" ? "w-7" : "w-9")}
      />
      {suffix ? <span className="-ml-0.5 text-meta text-ink-2">{suffix}</span> : null}
      <button type="button" aria-label={`More: ${label}`} onClick={() => onChange(clamp(value + step))} disabled={value >= max} className={button}>
        +
      </button>
    </span>
  );
}
