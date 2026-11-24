"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { matchesQuery } from "@/lib/ui/search";

export type SearchListItem = { id: string; label: string; hint?: string };

/**
 * Choose one item from a long list: a search box over a short scrolling list, in
 * one frame, instead of a native select that fills the screen. An ARIA combobox.
 * Typing filters (words in any order, the hint included); arrow keys move; Enter
 * or a click chooses. Choosing fills the box with the item's name and folds the
 * list away; clicking the box opens it again with every item and the chosen one
 * ticked. With the list folded, Enter calls `onEnter` (the dialog's main action).
 */
export function SearchList({
  id,
  label,
  items,
  value,
  onChange,
  onEnter,
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
  onEnter?: () => void;
  placeholder?: string;
  empty?: (query: string) => ReactNode;
  describedBy?: string;
  disabled?: boolean;
  className?: string;
}) {
  const chosen = items.find((it) => it.id === value);
  const [query, setQuery] = useState(chosen?.label ?? "");
  const [open, setOpen] = useState(!chosen);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-o${i}`;

  // While the box shows the chosen item's name, the list shows everything.
  const filter = chosen && query === chosen.label ? "" : query;
  const shown = useMemo(() => items.filter((it) => matchesQuery(it.hint ? `${it.label} ${it.hint}` : it.label, filter)), [items, filter]);
  const current = open && active < shown.length ? active : -1;

  // Keep the row the arrow keys reach in view.
  useEffect(() => {
    if (current >= 0) list.current?.children[current]?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const choose = (it: SearchListItem) => {
    onChange(it.id);
    setQuery(it.label);
    setOpen(false);
    setActive(-1);
  };

  const search = (text: string) => {
    setQuery(text);
    setOpen(true);
    setActive(text.trim() ? 0 : -1);
    // The box no longer names the chosen item, so nothing is chosen.
    if (chosen && text !== chosen.label) onChange("");
  };

  const reopen = () => {
    if (open) return;
    setOpen(true);
    setActive(chosen ? items.indexOf(chosen) : -1);
    input.current?.select();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return reopen();
      if (!shown.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive(current < 0 ? (step > 0 ? 0 : shown.length - 1) : (current + step + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      if (current >= 0) {
        e.preventDefault();
        choose(shown[current]);
      } else if (!open && chosen && onEnter) {
        e.preventDefault();
        onEnter();
      }
    } else if (e.key === "Escape" && open && (chosen || query)) {
      // Folds the list back, or clears the search; with neither, Escape closes the dialog.
      e.preventDefault();
      if (chosen) {
        setQuery(chosen.label);
        setOpen(false);
      } else search("");
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
      <div className={cn("flex h-11 items-center gap-2.5 pr-1 pl-3.5", open && "border-b border-line")}>
        {chosen && !open ? <Check aria-hidden size={18} strokeWidth={2.25} className="shrink-0 text-sage" /> : <Search aria-hidden size={18} strokeWidth={1.75} className="shrink-0 text-ink-2" />}
        <input
          ref={input}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? optionId(current) : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint={open ? "search" : "done"}
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          onChange={(e) => search(e.target.value)}
          onClick={reopen}
          onKeyDown={onKeyDown}
          className={cn("h-full min-w-0 flex-1 bg-transparent text-card-sm text-ink placeholder:text-ink-2 focus-visible:outline-none", chosen && !open ? "font-semibold" : "font-normal")}
        />
        {chosen && !open ? (
          <button type="button" aria-label="Show the list" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => { input.current?.focus(); reopen(); }} className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-ink/6 hover:text-ink pointer-coarse:size-11">
            <ChevronDown aria-hidden size={18} strokeWidth={2} />
          </button>
        ) : query ? (
          <button type="button" aria-label="Clear search" onClick={() => { search(""); input.current?.focus(); }} className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-ink/6 hover:text-ink pointer-coarse:size-11">
            <X aria-hidden size={16} strokeWidth={2} />
          </button>
        ) : null}
      </div>
      <ul ref={list} id={listId} role="listbox" aria-label={label} hidden={!open} className={cn("scrollbar-thin max-h-[232px] overflow-y-auto overscroll-contain", shown.length > 0 && "p-1")}>
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
              onClick={() => choose(it)}
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
      {open && shown.length === 0 ? <div className="px-3.5 py-3 text-body text-ink-2">{empty ? empty(query) : "Nothing matches that search."}</div> : null}
    </div>
  );
}
