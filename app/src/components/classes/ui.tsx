"use client";

import { useState, type ReactNode } from "react";
import { BrainMascot } from "@/components/BrainMascot";
import { Button, ButtonLink } from "@/components/Button";
import { Rise } from "@/components/motion";
import { Spinner } from "@/components/Spinner";
import type { LectureState } from "@/lib/classes/model";
import type { LoadState, SaveState } from "@/lib/classes/useEditableClass";

/** An input's look without margin or width, for rows that set their own. */
export const fieldBase =
  "rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm leading-6 shadow-[inset_0_1px_1px_rgba(17,24,52,0.04)] outline-none transition-shadow focus:border-coral focus:ring-4 focus:ring-coral/15";

export const fieldClass = `mt-1.5 w-full ${fieldBase}`;

export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this:", text);
    }
  }
  return (
    <Button type="button" variant="secondary" onClick={copy} className={className}>
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}

export function SaveIndicator({ state, error, onRetry }: { state: SaveState; error: string | null; onRetry: () => void }) {
  if (state === "error") {
    return (
      <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-coral-dark" role="status">
        Not saved{error ? `: ${error}` : ""}
        <button type="button" onClick={onRetry} className="rounded-full bg-peach px-2.5 py-1 text-peach-dark hover:bg-peach/70">
          Retry
        </button>
      </span>
    );
  }
  const text = { saved: "All changes saved", unsaved: "Saving soon...", saving: "Saving..." }[state];
  return (
    <span className="flex items-center gap-2 text-xs font-bold text-smoke" role="status">
      {state === "saving" && <Spinner className="h-3 w-3" />}
      {text}
    </span>
  );
}

export function LectureStateChip({ state, pending }: { state: LectureState; pending: number }) {
  if (state === "published") {
    return <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-mint-dark">Published</span>;
  }
  if (state === "changed") {
    return <span className="rounded-full bg-peach px-2.5 py-0.5 text-xs font-bold text-peach-dark">Changes not published</span>;
  }
  return (
    <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-bold text-smoke">
      Draft{pending > 0 ? ` · ${pending} to review` : ""}
    </span>
  );
}

function Panel({ children, mood = "thinking" }: { children: ReactNode; mood?: "thinking" | "sad" }) {
  return (
    <Rise className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center">
      <BrainMascot mood={mood} size={96} animate />
      {children}
    </Rise>
  );
}

/** What a professor sees while their class loads, or when this browser cannot edit it. */
export function ClassGate({ load, code }: { load: LoadState; code: string }) {
  if (load.status === "loading") {
    return (
      <div className="flex items-center gap-3 text-sm font-semibold text-smoke" role="status">
        <Spinner /> Loading class {code}...
      </div>
    );
  }
  if (load.status === "no-key") {
    return (
      <Panel mood="sad">
        <p className="mt-4 text-lg font-bold">This browser can&apos;t edit class {code}</p>
        <p className="mt-1 max-w-md text-sm text-smoke">
          Only the browser that created a class can edit it. Open the private edit link you copied on that browser, or
          ask whoever created the class for it. Students join with the code on the My Courses page instead.
        </p>
        <ButtonLink href="/teach" className="mt-6">
          Go to Teach
        </ButtonLink>
      </Panel>
    );
  }
  if (load.status === "error") {
    return (
      <Panel mood="sad">
        <p className="mt-4 text-lg font-bold">Class {code} could not be loaded</p>
        <p className="mt-1 max-w-md text-sm text-smoke">{load.message}</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </Panel>
    );
  }
  return null;
}

/** A class code, one character per box so it is easy to read off a projector or copy by hand. */
export function ClassCode({ code, size = "lg" }: { code: string; size?: "lg" | "sm" }) {
  const box =
    size === "lg"
      ? "h-14 w-11 rounded-xl border border-line bg-white text-2xl text-charcoal shadow-card sm:h-16 sm:w-12 sm:text-3xl"
      : "h-6 w-5 rounded-md bg-lavender text-xs text-lavender-dark";
  return (
    <span className={`inline-flex ${size === "lg" ? "flex-wrap gap-2" : "shrink-0 gap-0.5"}`}>
      <span className="sr-only">{code}</span>
      {code.split("").map((ch, i) => (
        <span key={i} aria-hidden="true" className={`inline-flex items-center justify-center font-display font-bold ${box}`}>
          {ch}
        </span>
      ))}
    </span>
  );
}

/** A page's title block: optional eyebrow, title, description and actions, consistent across screens. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="mb-2 text-xs font-semibold tracking-wider text-violet uppercase">{eyebrow}</div>}
        <h1 className="text-3xl font-bold tracking-tight md:text-[2.15rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-smoke">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** An honest placeholder for something that is designed but not built. Never shows invented data. */
export function NotBuiltYet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-dashed border-[#cfc7b8] bg-white/70 p-6">
      <p className="inline-flex items-center gap-2 rounded-md bg-sand px-2 py-0.5 text-[11px] font-semibold tracking-wide text-smoke uppercase">
        Planned · not built yet
      </p>
      <h2 className="mt-3 text-lg font-bold">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-smoke">{children}</div>
    </section>
  );
}

export function ClassMissing({ code, message }: { code: string; message?: string }) {
  return (
    <Panel mood="sad">
      <p className="mt-4 text-lg font-bold">{message ?? `There is no class with the code ${code}`}</p>
      {!message && (
        <p className="mt-1 max-w-md text-sm text-smoke">
          Check the code with your professor. Class codes have six letters and numbers, like K7Q2PX.
        </p>
      )}
      <ButtonLink href="/" className="mt-6">
        Go to My Courses
      </ButtonLink>
    </Panel>
  );
}
