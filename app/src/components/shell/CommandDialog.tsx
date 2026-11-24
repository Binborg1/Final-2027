"use client";

import { BookOpen, ChartColumn, CornerDownLeft, House, LayoutTemplate, Library, LogOut, Plus, Radio, Search, Settings, Sparkles, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Kbd } from "@/components/ui/Card";
import { cn } from "@/lib/ui/cn";

type Command = { id: string; label: string; hint?: string; icon: LucideIcon; run: () => void };

/**
 * "Ask Funza…" (Ctrl K). Typed text becomes the start of a Make brief; the rest
 * are shortcuts to the pages that exist. Funza chat itself arrives in Release 2.
 */
export function CommandDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery("");
      setActive(0);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };
    const q = query.trim();
    const all: Command[] = [
      { id: "home", label: "Home", icon: House, run: go("/") },
      { id: "make", label: "Make something", hint: "Notes, a quiz, a test, an exam or slides", icon: Sparkles, run: go("/make") },
      { id: "courses", label: "Courses", hint: "Chapters, materials and question banks", icon: BookOpen, run: go("/courses") },
      { id: "add-course", label: "Add a course", icon: Plus, run: go("/courses?add=1") },
      { id: "library", label: "Library", hint: "Every material you approved, with its versions", icon: Library, run: go("/library") },
      { id: "templates", label: "Templates", hint: "Your own formats for quizzes, exams, notes and slides", icon: LayoutTemplate, run: go("/templates") },
      { id: "new-template", label: "New template", hint: "Funza learns the format of one of yours", icon: Plus, run: go("/templates/new") },
      { id: "go-live", label: "Go live", hint: "Run a quiz in class on students' phones", icon: Radio, run: go("/live/new") },
      { id: "live-sessions", label: "Live sessions", hint: "Open sessions and past results", icon: ChartColumn, run: go("/live") },
      { id: "settings", label: "Settings", icon: Settings, run: go("/settings") },
      {
        id: "sign-out",
        label: "Sign out",
        icon: LogOut,
        run: () => (document.getElementById("command-sign-out") as HTMLFormElement | null)?.requestSubmit(),
      },
    ];
    const matches = q ? all.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())) : all;
    return q ? [{ id: "ask", label: `Make: “${q.slice(0, 80)}”`, hint: "Start a brief with this", icon: Sparkles, run: go(`/make?prompt=${encodeURIComponent(q.slice(0, 500))}`) }, ...matches] : matches;
  }, [query, onClose, router]);

  const current = Math.min(active, commands.length - 1);

  return (
    <dialog
      ref={ref}
      aria-label="Ask Funza"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="mx-auto mt-[12vh] w-[min(560px,calc(100vw-24px))] rounded-box border border-white/90 bg-white/92 p-0 text-ink shadow-dialog backdrop:bg-ink/30"
    >
      <form method="post" action="/auth/sign-out" id="command-sign-out" className="hidden" />
      <div className="flex items-center gap-3 border-b border-line px-5">
        <Search aria-hidden size={18} strokeWidth={1.75} className="text-ink-2" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, commands.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              commands[current]?.run();
            }
          }}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-list"
          aria-activedescendant={commands[current] ? `command-${commands[current].id}` : undefined}
          placeholder="Ask Funza… “a 10-question quiz on …”"
          className="h-14 flex-1 bg-transparent text-card-sm font-normal outline-none placeholder:text-ink-2"
        />
        <Kbd>Esc</Kbd>
      </div>
      <ul id="command-list" role="listbox" aria-label="Commands" className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto p-2">
        {commands.map((c, i) => (
          <li
            key={c.id}
            id={`command-${c.id}`}
            role="option"
            aria-selected={i === current}
            onMouseEnter={() => setActive(i)}
            onClick={() => c.run()}
            className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2", i === current && "bg-accent-tint")}
          >
            <c.icon aria-hidden size={18} strokeWidth={1.6} className={i === current ? "text-accent-ink" : "text-ink-2"} />
            <span className="flex min-w-0 flex-col">
              <span className={cn("truncate text-row", i === current ? "font-semibold text-accent-ink" : "font-medium")}>{c.label}</span>
              {c.hint ? <span className="text-meta text-ink-2">{c.hint}</span> : null}
            </span>
            {i === current ? <CornerDownLeft aria-hidden size={16} className="ml-auto text-accent-ink" /> : null}
          </li>
        ))}
      </ul>
    </dialog>
  );
}
