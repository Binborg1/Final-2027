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
  "rounded-2xl border border-line bg-white px-4 py-2.5 text-sm leading-6 shadow-[inset_0_1px_2px_rgba(90,60,30,0.06)] outline-none transition-shadow focus:border-coral focus:ring-4 focus:ring-coral/20";

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
    return <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-extrabold text-mint-dark">Published</span>;
  }
  if (state === "changed") {
    return <span className="rounded-full bg-peach px-2.5 py-0.5 text-xs font-extrabold text-peach-dark">Changes not published</span>;
  }
  return (
    <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-extrabold text-smoke">
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
        <p className="mt-4 text-lg font-extrabold">This browser can&apos;t edit class {code}</p>
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
        <p className="mt-4 text-lg font-extrabold">Class {code} could not be loaded</p>
        <p className="mt-1 max-w-md text-sm text-smoke">{load.message}</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </Panel>
    );
  }
  return null;
}

export function ClassMissing({ code, message }: { code: string; message?: string }) {
  return (
    <Panel mood="sad">
      <p className="mt-4 text-lg font-extrabold">{message ?? `There is no class with the code ${code}`}</p>
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
