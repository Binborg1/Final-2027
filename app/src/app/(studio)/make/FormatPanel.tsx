"use client";

import { Check, ChevronDown, LayoutTemplate, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { ChoiceChip } from "@/components/ui/Chip";
import { categoryInfo, formatLine, isQuestionFormat, rowLine, sectionLetter, type TemplateCategory } from "@/lib/templates/model";
import type { TemplateChoice } from "@/lib/templates/apply";
import { cn } from "@/lib/ui/cn";

export type FormatMode = "adjust" | "template";
export type MakeTemplate = TemplateChoice & { used: number };

/**
 * Make's "how should it look?": Funza's own controls (Adjust), or one of the
 * teacher's templates. The header always shows the choice and its value; the body
 * opens and closes. `open` is null until the page knows the screen width: open on
 * wide screens, closed on narrow ones, with no flash either way.
 */
export function FormatPanel({
  mode,
  onMode,
  open,
  onOpen,
  value,
  adjust,
  category,
  templates,
  chosenId,
  onChoose,
  newHref,
  onSaveSettings,
}: {
  mode: FormatMode;
  onMode: (m: FormatMode) => void;
  open: boolean | null;
  onOpen: (o: boolean) => void;
  value: string;
  adjust: ReactNode;
  category: TemplateCategory;
  templates: MakeTemplate[];
  chosenId: string | null;
  onChoose: (t: MakeTemplate) => void;
  newHref: string;
  onSaveSettings?: () => void;
}) {
  const list = templates.filter((t) => t.category === category);
  const info = categoryInfo(category);
  return (
    <section id="format" aria-label="Format" className="flex flex-col gap-3 rounded-card border border-line-glass bg-surface p-5">
      <button
        type="button"
        aria-expanded={open ?? undefined}
        aria-controls="format-body"
        onClick={() => onOpen(open === null ? !window.matchMedia("(min-width: 1280px)").matches : !open)}
        className="flex items-center gap-2 text-left"
      >
        <h2 className="text-card-sm font-bold text-ink">Format</h2>
        <span className="ml-auto text-meta font-medium text-ink-2">{mode === "template" ? "Your template" : "Optional"}</span>
        <ChevronDown aria-hidden size={18} strokeWidth={1.75} className={cn("shrink-0 text-ink-2 transition-transform", open === true && "rotate-180", open === null && "xl:rotate-180")} />
      </button>
      <div role="radiogroup" aria-label="How Funza lays it out" className="flex flex-wrap gap-2">
        <ChoiceChip size="md" role="radio" aria-checked={mode === "adjust"} selected={mode === "adjust"} onClick={() => onMode("adjust")}>
          Adjust
        </ChoiceChip>
        <ChoiceChip size="md" role="radio" aria-checked={mode === "template"} selected={mode === "template"} onClick={() => onMode("template")}>
          Template
        </ChoiceChip>
      </div>
      <p className="truncate text-meta font-medium text-ink-2" aria-live="polite">
        {value}
      </p>

      <div id="format-body" className={cn("flex flex-col gap-3", open === null ? "max-xl:hidden" : !open && "hidden")}>
        {mode === "adjust" ? (
          <>
            {adjust}
            {onSaveSettings ? (
              <button type="button" onClick={onSaveSettings} className="inline-flex items-center gap-1.5 self-start text-body font-semibold text-accent-ink hover:underline">
                <LayoutTemplate aria-hidden size={16} strokeWidth={1.6} /> Save these settings as a template
              </button>
            ) : null}
          </>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-tile border border-white/85 bg-tile px-4 py-4">
            <span className="flex items-center gap-2.5 text-row font-semibold">
              <LayoutTemplate aria-hidden size={18} strokeWidth={1.6} className="text-accent" />
              No {info.one.toLowerCase()} templates yet
            </span>
            <p className="text-body text-ink-2">Show Funza {info.example} and it makes new ones in the same format.</p>
            <ButtonLink href={newHref} variant="secondary" size="sm" icon={Plus}>
              New template
            </ButtonLink>
          </div>
        ) : (
          <>
            <ul role="radiogroup" aria-label={`Your ${info.label.toLowerCase()} templates`} className="flex flex-col gap-2">
              {list.map((t) => {
                const on = t.id === chosenId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => onChoose(t)}
                      className={cn("flex w-full flex-col gap-1 rounded-tile border px-3.5 py-3 text-left transition-colors", on ? "border-accent bg-accent-tint-soft" : "border-white/85 bg-tile hover:bg-white/80")}
                    >
                      <span className="flex items-center gap-2">
                        {on ? (
                          <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-row font-semibold">{t.name}</span>
                      </span>
                      <span className="text-meta text-ink-2">{formatLine(t.format)}</span>
                      {on && isQuestionFormat(t.format) ? (
                        <span className="mt-1 flex flex-col gap-0.5 border-t border-line pt-2">
                          {t.format.sections.map((s, i) => (
                            <span key={i} className="flex gap-2 text-meta">
                              <span className="w-4 shrink-0 font-bold text-ink-2">{sectionLetter(i)}</span>
                              <span className="min-w-0 flex-1 truncate">{s.title}</span>
                              <span className="shrink-0 text-ink-2">{s.rows.map(rowLine).join(" · ")}</span>
                            </span>
                          ))}
                        </span>
                      ) : on && !isQuestionFormat(t.format) ? (
                        <span className="mt-1 border-t border-line pt-2 text-meta text-ink-2">{t.format.parts.map((p) => p.title).join(" · ")}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between gap-3">
              <Link href={newHref} className="inline-flex items-center gap-1.5 text-body font-semibold text-accent-ink hover:underline">
                <Plus aria-hidden size={16} /> New template
              </Link>
              <Link href="/templates" className="text-body font-semibold text-ink-2 hover:underline">
                Manage
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
