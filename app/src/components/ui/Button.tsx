import type { LucideIcon } from "lucide-react";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

/**
 * Pill buttons from F · Oak. One primary (terracotta) action per screen; white
 * secondary actions beside it; ghost for links inside cards. Under a coarse
 * pointer every size grows to at least 44 px.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent shadow-cta hover:bg-accent-hover active:bg-accent-pressed aria-disabled:bg-accent/45 aria-disabled:shadow-none disabled:bg-accent/45 disabled:shadow-none",
  secondary: "bg-button-2 text-ink border border-line-2 hover:bg-white active:bg-raised aria-disabled:text-ink-2 disabled:text-ink-2",
  ghost: "text-accent-ink hover:bg-white/55 active:bg-white/75",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 px-4 text-body pointer-coarse:h-11",
  md: "h-[46px] gap-2 px-[22px] text-row",
  lg: "h-[52px] gap-2 px-7 text-card-sm",
};

const ICON: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

type Common = { variant?: ButtonVariant; size?: ButtonSize; icon?: LucideIcon; iconRight?: LucideIcon; loading?: boolean; className?: string; children?: ReactNode };

export function buttonClass({ variant = "primary", size = "md", className }: Pick<Common, "variant" | "size" | "className">) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-semibold transition-colors disabled:cursor-not-allowed aria-disabled:cursor-not-allowed",
    VARIANT[variant],
    SIZE[size],
    variant === "ghost" && "px-3",
    className,
  );
}

function Inner({ icon: Icon, iconRight: IconRight, loading, size = "md", children }: Common) {
  const px = ICON[size];
  return (
    <>
      {loading ? <LoaderCircle aria-hidden size={px} className="animate-spin" /> : Icon ? <Icon aria-hidden size={px} strokeWidth={1.75} /> : null}
      {children}
      {IconRight && !loading ? <IconRight aria-hidden size={px} strokeWidth={1.75} /> : null}
    </>
  );
}

export function Button({ variant, size, icon, iconRight, loading, className, children, disabled, type = "button", ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass({ variant, size, className })} {...rest}>
      <Inner icon={icon} iconRight={iconRight} loading={loading} size={size}>
        {children}
      </Inner>
    </button>
  );
}

/** A link styled as a button. When disabled it renders as text with a reason, not a dead link. */
export function ButtonLink({ href, disabled, title, variant, size, icon, iconRight, className, children }: Common & { href: string; disabled?: boolean; title?: string }) {
  if (disabled) {
    return (
      <span role="link" aria-disabled="true" title={title} className={buttonClass({ variant, size, className })}>
        <Inner icon={icon} iconRight={iconRight} size={size}>
          {children}
        </Inner>
      </span>
    );
  }
  // API routes (such as Classroom connect) are plain links: <Link> would prefetch
  // them as soon as they're on screen, running the route without a click.
  if (href.startsWith("/api/")) {
    return (
      <a href={href} title={title} className={buttonClass({ variant, size, className })}>
        <Inner icon={icon} iconRight={iconRight} size={size}>
          {children}
        </Inner>
      </a>
    );
  }
  return (
    <Link href={href} title={title} className={buttonClass({ variant, size, className })}>
      <Inner icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Inner>
    </Link>
  );
}

/** A 44 px round glass button with an icon and an accessible name. */
export function IconButton({ icon: Icon, label, className, ...rest }: { icon: LucideIcon; label: string; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} className={cn("frost frost-bar inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-white/60 text-ink transition hover:brightness-105 disabled:opacity-50", className)} {...rest}>
      <Icon aria-hidden size={20} strokeWidth={1.6} />
    </button>
  );
}
