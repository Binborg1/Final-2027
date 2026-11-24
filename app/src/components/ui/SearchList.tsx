"use client";

import { Check, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { matchesQuery } from "@/lib/ui/search";

export type SearchListItem = { id: string; label: string; hint?: string };

/**
 * Choose one item from a long list: a search box over a short scrolling list, in
 * one frame, instead of a native select that fills the screen. An ARIA combobox:
 * typing filters (words in any order, the hint included), arrow keys move, Enter
 * chooses, Escape clears the search, and the chosen row keeps a tick.
 */
export function SearchList({
  id,
  label,
  items,
  value,
  onChange,
  placeholder = "Search",
  empty,
  describedBy,
  disabled,
  className,
}: {
  id: string;
  label: string;
  items: SearchListItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  empty?: (query: string) => ReactNode;
  describedBy?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-o${i}`;

  const shown = useMemo(() => items.filter((it) => matchesQuery(it.hint ? `${it.label} ${it.hint}` : it.label, query)), [items, query]);
  const current = active < shown.length ? active : -1;

  // Keep the row the arrow keys reach in view.
  useEffect(() => {
    if (current >= 0) list.current?.children[current]?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const search = (text: string) => {
    setQuery(text);
    setActive(text.trim() ? 0 : -1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!shown.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive(current < 0 ? (step > 0 ? 0 : shown.length - 1) : (current + step + shown.length) % shown.length);
    } else if (e.key === "Enter" && current >= 0) {
      e.preventDefault();
      onChange(shown[current].id);
    } else if (e.key === "Escape" && query) {
      // Clears the search first; a second Escape closes the dialog.
      e.preventDefault();
      search("");
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-line-control bg-field transition-shadow focus-within:border-accent focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-accent",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <div className="flex h-11 items-center gap-2.5 border-b border-line pr-1 pl-3.5">
        <Search aria-hidden size={18} strokeWidth={1.75} className="shrink-0 text-ink-2" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? optionId(current) : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          onChange={(e) => search(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-card-sm font-normal text-ink placeholder:text-ink-2 focus-visible:outline-none"
        />
        {query ? (
          <button type="button" aria-label="Clear search" onClick={() => search("")} className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-ink/6 hover:text-ink pointer-coarse:size-11">
            <X aria-hidden size={16} strokeWidth={2} />
          </button>
        ) : null}
      </div>
      <ul ref={list} id={listId} role="listbox" aria-label={label} className={cn("scrollbar-thin max-h-[232px] overflow-y-auto overscroll-contain", shown.length > 0 && "p-1")}>
        {shown.map((it, i) => {
          const selected = it.id === value;
          return (
            <li
              key={it.id}
              id={optionId(i)}
              role="option"
              aria-selected={selected}
              // Keeps focus in the search box, so typing and the arrow keys carry on.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(it.id);
                setActive(i);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-sm px-2.5 py-2 text-row pointer-coarse:min-h-11",
                selected ? (i === current ? "bg-accent-tint font-semibold" : "bg-accent-tint-soft font-semibold") : i === current ? "bg-ink/6" : "hover:bg-ink/4",
              )}
            >
              <span className="min-w-0 flex-1">{it.label}</span>
              {it.hint ? <span className="shrink-0 text-meta font-medium text-ink-2 max-sm:hidden">{it.hint}</span> : null}
              <Check aria-hidden size={16} strokeWidth={2.25} className={cn("shrink-0 text-accent-ink", !selected && "invisible")} />
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? <div className="px-3.5 py-3 text-body text-ink-2">{empty ? empty(query) : "Nothing matches that search."}</div> : null}
    </div>
  );
}
