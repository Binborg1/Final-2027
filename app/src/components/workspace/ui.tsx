"use client";

import Link, { type LinkProps } from "next/link";
import { useEffect, useId, useRef, useSyncExternalStore, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CheckState } from "@/lib/resources/types";
import { AlertIcon, CheckIcon, DashedCircleIcon, PersonCheckIcon, RefreshIcon, ShieldCheckIcon, ShieldHalfIcon, SparkIcon, XIcon } from "./icons";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------- buttons ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "bright" | "quiet";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-(--teal-700) text-white shadow-(--sh-teal) hover:bg-(--teal-800) active:translate-y-px",
  secondary: "border border-(--line) bg-(--surface) text-(--ink) shadow-(--sh-1) hover:border-(--line-strong) hover:bg-(--surface-2) active:translate-y-px",
  ghost: "text-(--ink-2) hover:bg-(--bg-sunk) hover:text-(--ink)",
  quiet: "text-(--teal-700) hover:bg-(--teal-50) hover:text-(--teal-800)",
  danger: "border border-(--line) bg-(--surface) text-(--bad) hover:border-[#f0c4bf] hover:bg-(--bad-bg)",
  bright: "bg-(--teal-400) text-(--navy-950) shadow-[0_6px_16px_-8px_rgba(44,196,169,0.8)] hover:bg-[#45d1b8] active:translate-y-px",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-(--r-sm) px-2.5 text-[13px]",
  md: "h-9 gap-2 rounded-(--r-md) px-3.5 text-sm",
  lg: "h-11 gap-2 rounded-(--r-md) px-5 text-[15px]",
};

export function btn(variant: Variant = "secondary", size: Size = "md", className = "") {
  return cx(
    "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:active:translate-y-0",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button type={type} className={btn(variant, size, className)} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function LinkButton({ variant = "secondary", size = "md", className = "", children, ...rest }: LinkProps & { variant?: Variant; size?: Size; className?: string; children: ReactNode }) {
  return (
    <Link className={btn(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function IconButton({ label, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-(--r-sm) text-(--muted) transition-colors hover:bg-(--bg-sunk) hover:text-(--ink) disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <span aria-hidden="true" className={cx("fz-spin inline-block rounded-full border-2 border-current border-r-transparent", className)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[5px] border border-(--line) bg-(--surface) px-1.5 py-px font-sans text-[11px] font-semibold text-(--muted) shadow-[0_1px_0_var(--line)]">{children}</kbd>;
}

/* ---------- status ---------- */

type Tone = "ok" | "bad" | "info" | "none" | "gold" | "teal" | "navy";
const TONE: Record<Tone, string> = {
  ok: "bg-(--ok-bg) text-(--ok)",
  bad: "bg-(--bad-bg) text-(--bad)",
  info: "bg-(--info-bg) text-(--info)",
  none: "bg-(--none-bg) text-(--none)",
  gold: "bg-(--gold-50) text-(--gold-700) ring-1 ring-(--gold-100) ring-inset",
  teal: "bg-(--teal-50) text-(--teal-800)",
  navy: "bg-(--navy-900) text-white",
};

export function Pill({ tone = "none", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold whitespace-nowrap", TONE[tone], className)}>{children}</span>;
}

export const CHECK_META: Record<CheckState, { tone: Tone; word: string; icon: ReactNode }> = {
  passed: { tone: "ok", word: "Passed", icon: <CheckIcon className="h-3 w-3" /> },
  failed: { tone: "bad", word: "Failed", icon: <XIcon className="h-3 w-3" /> },
  unverifiable: { tone: "none", word: "Not verified", icon: <DashedCircleIcon className="h-3 w-3" /> },
  "needs-you": { tone: "gold", word: "Needs you", icon: <PersonCheckIcon className="h-3 w-3" /> },
  stale: { tone: "info", word: "Changed", icon: <RefreshIcon className="h-3 w-3" /> },
};

export function CheckBadge({ state, count }: { state: CheckState; count?: number }) {
  const m = CHECK_META[state];
  return (
    <Pill tone={m.tone}>
      {m.icon}
      {count !== undefined && <span>{count}</span>}
      {m.word}
    </Pill>
  );
}

/** Curriculum verification, shown the same way on every screen. */
export type CurriculumMark = "verified" | "source-checked" | "staged" | "missing";
export function VerificationBadge({ mark, compact = false }: { mark: CurriculumMark; compact?: boolean }) {
  if (mark === "verified")
    return (
      <Pill tone="teal" className="ring-1 ring-(--teal-200) ring-inset">
        <ShieldCheckIcon className="h-3.5 w-3.5" />
        Verified
      </Pill>
    );
  if (mark === "source-checked")
    return (
      <Pill tone="teal">
        <ShieldHalfIcon className="h-3.5 w-3.5" />
        {compact ? "Official source" : "From official source · 2nd check pending"}
      </Pill>
    );
  if (mark === "staged")
    return (
      <Pill tone="none" className="border border-dashed border-(--line-strong)">
        <DashedCircleIcon className="h-3.5 w-3.5" />
        Awaiting team review
      </Pill>
    );
  return <Pill tone="none">Not in Funza yet</Pill>;
}

export function AiSpark({ label = "AI draft: not reviewed yet" }: { label?: string }) {
  return (
    <span className="inline-flex items-center text-(--gold-500)" title={label}>
      <SparkIcon />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function OutcomeChip({ code, onRemove, title }: { code: string; onRemove?: () => void; title?: string }) {
  return (
    <span title={title} className="inline-flex h-7 items-center gap-1.5 rounded-(--r-sm) border border-(--teal-200) bg-(--teal-50) pr-1 pl-2 text-[12.5px] font-bold tracking-tight text-(--teal-900)">
      <ShieldHalfIcon className="h-3.5 w-3.5 text-(--teal-700)" />
      {code}
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Remove ${code}`} className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-(--teal-800) hover:bg-(--teal-100)">
          <XIcon className="h-3 w-3" />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </span>
  );
}

export function OfficialWording({ code, statement, small = false }: { code?: string; statement: string; small?: boolean }) {
  return (
    <figure className="m-0">
      <figcaption className="mb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-(--muted) uppercase">{code ? `${code} · official wording` : "Official wording"}</figcaption>
      <blockquote className={cx("fz-official m-0", small && "text-[13.5px]")}>“{statement}”</blockquote>
    </figure>
  );
}

/* ---------- surfaces ---------- */

export function Card({ children, className = "", as: As = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "aside"; "aria-label"?: string; "aria-labelledby"?: string }) {
  return (
    <As className={cx("rounded-(--r-lg) border border-(--line) bg-(--surface) shadow-(--sh-2)", className)} {...rest}>
      {children}
    </As>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-[11px] font-semibold tracking-[0.08em] text-(--muted) uppercase", className)}>{children}</p>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={cx("fz-skeleton block", className)} />;
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-(--r-lg) border border-dashed border-(--line-strong) bg-(--surface-2) px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-(--surface) text-(--muted) shadow-(--sh-1)">{icon}</span>
      <p className="fz-display mt-3 text-[15px] font-bold">{title}</p>
      <div className="mt-1 max-w-sm text-[13.5px] text-(--muted)">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", title, children, action, icon }: { tone?: "info" | "gold" | "bad" | "ok" | "none"; title?: string; children: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  const t = { info: "border-[#cddbf5] bg-(--info-bg)", gold: "border-(--gold-100) bg-(--gold-50)", bad: "border-[#f3c9c4] bg-(--bad-bg)", ok: "border-[#c7e6d3] bg-(--ok-bg)", none: "border-(--line) bg-(--surface-2)" }[tone];
  const fg = { info: "text-(--info)", gold: "text-(--gold-700)", bad: "text-(--bad)", ok: "text-(--ok)", none: "text-(--muted)" }[tone];
  return (
    <div className={cx("flex items-start gap-3 rounded-(--r-md) border px-3.5 py-3 text-[13.5px]", t)} role={tone === "bad" ? "alert" : undefined}>
      <span className={cx("mt-0.5 shrink-0", fg)}>{icon ?? <AlertIcon className="h-4 w-4" />}</span>
      <div className="min-w-0 flex-1 text-(--ink-2) [overflow-wrap:anywhere]">
        {title && <p className={cx("font-semibold", fg)}>{title}</p>}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
        {action && <div className="mt-2.5 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

/* ---------- form controls ---------- */

export const inputClass =
  "w-full rounded-(--r-md) border border-(--line-input) bg-(--surface) px-3 py-2 text-sm text-(--ink) shadow-(--sh-1) outline-none transition-[border-color,box-shadow] placeholder:text-[#6c7086] hover:border-(--muted) focus:border-(--teal-700) focus:shadow-[0_0_0_3px_var(--teal-100)]";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  function onKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    const at = enabled.indexOf(index);
    const next = enabled[(at + step + enabled.length) % enabled.length];
    onChange(options[next].value);
    const buttons = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=radio]");
    buttons?.[next]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-(--r-md) border border-(--line) bg-(--bg-sunk) p-0.5">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx(
              "rounded-[8px] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] disabled:opacity-40",
              size === "sm" ? "px-2.5 py-1 text-[12.5px]" : "px-3 py-1.5 text-[13px]",
              on ? "bg-(--surface) text-(--ink) shadow-(--sh-1)" : "text-(--muted) hover:text-(--ink)",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="min-w-0">
        <span id={`${id}-l`} className="block text-[13.5px] font-medium">
          {label}
        </span>
        {hint && (
          <span id={`${id}-h`} className="block text-[12.5px] text-(--muted)">
            {hint}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        aria-describedby={hint ? `${id}-h` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors disabled:opacity-45",
          checked ? "bg-(--teal-700)" : "bg-(--line-strong)",
        )}
      >
        <span className={cx("absolute h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-150", checked ? "translate-x-[18px]" : "translate-x-[2px]")} />
      </button>
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, label, suffix }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; suffix?: string }) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="inline-flex h-8 items-center rounded-(--r-sm) border border-(--line-input) bg-(--surface) shadow-(--sh-1)">
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - 1))} className="flex h-full w-7 items-center justify-center text-(--muted) hover:text-(--ink) disabled:opacity-30">
        −
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
        className="h-full w-8 border-x border-(--line) bg-transparent text-center text-[13px] font-semibold tabular-nums outline-none focus:bg-(--teal-50)"
      />
      {suffix && <span className="px-1.5 text-[12px] text-(--muted)">{suffix}</span>}
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + 1))} className="flex h-full w-7 items-center justify-center text-(--muted) hover:text-(--ink) disabled:opacity-30">
        +
      </button>
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="block">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-(--ink)">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-[12.5px] text-(--muted)">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/* ---------- overlays ---------- */

const noop = () => () => {};
export function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** Overlays render into <body> so no transformed ancestor can shift them; `.fz-layer` carries the design tokens. */
export function Layer({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(<div className="fz-layer">{children}</div>, document.body);
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const id = useId();
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const box = ref.current;
    const first = box?.querySelector<HTMLElement>("[data-autofocus]") ?? box?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key !== "Tab" || !box) return;
      const els = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (els.length === 0) return;
      const [a, z] = [els[0], els[els.length - 1]];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      before?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return (
    <Layer>
      <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
        <div className="fz-fade-in absolute inset-0 bg-[rgba(11,17,36,0.42)] backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-t`}
          aria-describedby={description ? `${id}-d` : undefined}
          className={cx("fz-pop-in relative flex max-h-[92vh] w-full flex-col rounded-t-(--r-xl) border border-(--line) bg-(--surface) shadow-(--sh-3) sm:rounded-(--r-xl)", width)}
        >
          <div className="flex items-start gap-3 border-b border-(--line) px-5 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <h2 id={`${id}-t`} className="text-[17px] font-bold">
                {title}
              </h2>
              {description && (
                <div id={`${id}-d`} className="mt-1 text-[13.5px] text-(--muted)">
                  {description}
                </div>
              )}
            </div>
            <IconButton label="Close" onClick={onClose}>
              <XIcon />
            </IconButton>
          </div>
          {children && <div className="fz-scroll overflow-y-auto px-5 py-4">{children}</div>}
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-(--line) bg-(--surface-2) px-5 py-3.5 sm:rounded-b-(--r-xl)">{footer}</div>}
        </div>
      </div>
    </Layer>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, label }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode }[]; label: string }) {
  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-(--line) px-1">
      {tabs.map((t, i) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx("relative -mb-px inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold", on ? "text-(--ink)" : "text-(--muted) hover:text-(--ink)")}
          >
            {t.label}
            {on && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-(--teal-700)" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
