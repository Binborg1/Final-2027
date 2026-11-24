"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/ui/cn";
import { matchesQuery } from "@/lib/ui/search";

export type MultiSelectItem = { id: string; label: string; hint?: string };

/**
 * A bar that shows what is chosen as small removable chips, with a search box at
 * its end. Clicking or typing in it opens the list underneath: tick as many as
 * you like, and it closes on Escape, Done, or a click anywhere else. An ARIA
 * combobox with a multi-select listbox: arrow keys move, Enter ticks, Backspace
 * in an empty search removes the last chip. `min` keeps at least that many chosen.
 */
export function MultiSelect({
  label,
  items,
  selected,
  onToggle,
  placeholder = "Search",
  min = 0,
  noun = ["item", "items"],
  className,
}: {
  label: string;
  items: MultiSelectItem[];
  selected: string[];
  onToggle: (id: string) => void;
  placeholder?: string;
  min?: number;
  noun?: [string, string];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-o${i}`;

  const chosen = useMemo(() => items.filter((it) => selected.includes(it.id)), [items, selected]);
  const shown = useMemo(() => items.filter((it) => matchesQuery(it.label, query)), [items, query]);
  const canRemove = chosen.length > min;

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  // A press anywhere outside closes the list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const toggle = (id: string) => {
    if (selected.includes(id) && !canRemove) return;
    onToggle(id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (shown.length ? (a + step + shown.length) % shown.length : 0));
    } else if (e.key === "Enter") {
      if (!open || !shown[active]) return;
      e.preventDefault();
      toggle(shown[active].id);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
    } else if (e.key === "Backspace" && query === "" && canRemove && chosen.length > 0) {
      onToggle(chosen[chosen.length - 1].id);
    }
  };

  return (
    <div
      ref={root}
      className={cn("w-full", className)}
      onBlur={(e) => {
        // Tabbing away closes the list; a click inside it does not.
        if (e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) close();
      }}
    >
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            input.current?.focus();
            setOpen(true);
          }
        }}
        className={cn(
          "flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-[22px] border bg-field py-1.5 pr-1.5 pl-2 transition-colors",
          open ? "border-accent outline-2 outline-accent" : "border-line-control hover:border-ink/30",
        )}
      >
        {chosen.map((it) => (
          <span key={it.id} className="inline-flex h-8 max-w-full items-center gap-1 rounded-full bg-accent-tint pl-3 text-body font-semibold text-accent-ink" title={it.label}>
            <span className="truncate">{it.label}</span>
            {canRemove ? (
              <button type="button" aria-label={`Remove ${it.label}`} onClick={() => onToggle(it.id)} className="flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-white/60 pointer-coarse:size-9">
                <X aria-hidden size={14} strokeWidth={2} />
              </button>
            ) : (
              <span className="w-3" />
            )}
          </span>
        ))}
        <span className="flex min-w-[160px] flex-1 items-center gap-2 pl-1">
          <Search aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-ink-2" />
          <input
            ref={input}
            role="combobox"
            aria-label={`Search ${noun[1]}`}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && shown[active] ? optionId(active) : undefined}
            value={query}
            placeholder={chosen.length ? `Add more ${noun[1]}` : placeholder}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            className="h-8 w-full min-w-0 bg-transparent text-card-sm text-ink outline-none placeholder:text-ink-2"
          />
        </span>
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? `Close the ${noun[0]} list` : `Show all ${noun[1]}`}
          onClick={() => (open ? close() : (input.current?.focus(), setOpen(true)))}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-ink/5"
        >
          <ChevronDown aria-hidden size={18} strokeWidth={1.75} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open ? (
        <div className="mt-2 rounded-tile border border-white/85 bg-white/95 p-1.5 shadow-box">
          {shown.length === 0 ? (
            <p className="px-3 py-3 text-body text-ink-2">No {noun[1]} match &ldquo;{query}&rdquo;.</p>
          ) : (
            <ul id={listId} role="listbox" aria-multiselectable="true" aria-label={label} className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {shown.map((it, i) => {
                const on = selected.includes(it.id);
                const locked = on && !canRemove;
                return (
                  <li
                    key={it.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={on}
                    aria-disabled={locked || undefined}
                    title={locked ? `Keep at least ${min} ${min === 1 ? noun[0] : noun[1]}` : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => toggle(it.id)}
                    className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2", i === active && "bg-ink/[0.05]", locked && "cursor-default")}
                  >
                    <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px]", on ? "border-accent bg-accent text-white" : "border-line-control bg-white")}>
                      {on ? <Check size={13} strokeWidth={3} /> : null}
                    </span>
                    <span className={cn("min-w-0 flex-1 text-body", on ? "font-semibold text-ink" : "font-medium text-ink")}>{it.label}</span>
                    {it.hint ? <span className="shrink-0 text-meta text-ink-2">{it.hint}</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-line px-3 pt-2 pb-1">
            <span className="text-meta font-semibold text-ink-2" aria-live="polite">
              {chosen.length} {chosen.length === 1 ? noun[0] : noun[1]} chosen
            </span>
            <button type="button" onClick={close} className="h-8 rounded-full px-3 text-meta font-semibold text-accent-ink hover:bg-ink/5 pointer-coarse:h-11">
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
