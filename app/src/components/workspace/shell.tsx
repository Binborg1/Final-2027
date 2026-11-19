"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FunzaLogo } from "@/components/FunzaLogo";
import { knownOutcomes } from "@/lib/curriculum/sources";
import { useLms } from "@/lib/lms/useLms";
import { KINDS } from "@/lib/resources/kinds";
import { dismissToast, loadWorkspace, startBrief, useWorkspace } from "@/lib/resources/store";
import { CompassIcon, HomeIcon, KeyboardIcon, LibraryIcon, MenuIcon, PlugIcon, PlusIcon, SearchIcon, XIcon } from "./icons";
import { KindIcon } from "./parts";
import { cx, Dialog, IconButton, Kbd, Layer } from "./ui";

const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

type NavItem = { href: string; label: string; icon: ReactNode; active: (p: string) => boolean };
const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: <HomeIcon className="h-[18px] w-[18px]" />, active: (p) => p === "/" },
  { href: "/library", label: "Library", icon: <LibraryIcon className="h-[18px] w-[18px]" />, active: (p) => p.startsWith("/library") || p.startsWith("/resources") },
  { href: "/curriculum", label: "Curriculum", icon: <CompassIcon className="h-[18px] w-[18px]" />, active: (p) => p.startsWith("/curriculum") },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [menu, setMenu] = useState(false);
  const standalone = pathname.startsWith("/survey");

  useEffect(() => {
    if (!standalone) loadWorkspace();
  }, [standalone]);

  useEffect(() => {
    if (standalone) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setShortcuts(true);
      } else if (e.key === "/") {
        e.preventDefault();
        setPalette(true);
      } else if (e.key.toLowerCase() === "c" && !pathname.startsWith("/create") && !pathname.startsWith("/resources")) {
        e.preventDefault();
        router.push("/create");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname, standalone]);

  if (standalone) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a href="#fz-main" className="sr-only z-[90] rounded bg-white px-3 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <NavRail pathname={pathname} onSearch={() => setPalette(true)} onShortcuts={() => setShortcuts(true)} />
      <MobileBar onMenu={() => setMenu(true)} onSearch={() => setPalette(true)} />
      {menu && <MobileMenu pathname={pathname} onClose={() => setMenu(false)} />}
      <main id="fz-main" className="fz-screen-only min-w-0 flex-1" tabIndex={-1}>
        <div key={pathname} className="fz-screen-in">
          {children}
        </div>
      </main>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />
      <Toasts />
    </div>
  );
}

function NavRail({ pathname, onSearch, onShortcuts }: { pathname: string; onSearch: () => void; onShortcuts: () => void }) {
  const ws = useWorkspace();
  const lms = useLms();
  const courses = [...new Set(ws.resources.map((r) => r.courseName))];
  return (
    <aside
      aria-label="Funza"
      className="fz-on-navy fz-screen-only sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col bg-[linear-gradient(180deg,#0b1124_0%,#0e1630_55%,#141c42_100%)] px-3 py-4 text-white md:flex lg:w-[248px] lg:px-4"
    >
      <Link href="/" className="flex flex-col rounded-lg px-1 py-1" aria-label="Funza home">
        <FunzaLogo tone="light" className="hidden h-[54px] w-auto self-start lg:block" />
        <span className="fz-display mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-lg font-extrabold italic lg:hidden">F</span>
        <span className="mt-1 hidden pl-1.5 text-[11px] font-medium tracking-wide text-(--navy-300) lg:block">For Saskatchewan teachers · Grades 10–12</span>
      </Link>

      <Link
        href="/create"
        aria-current={pathname.startsWith("/create") ? "page" : undefined}
        className={cx(
          "mt-6 flex h-10 items-center justify-center gap-2 rounded-(--r-md) bg-(--teal-400) text-sm font-bold text-(--navy-950) shadow-[0_8px_20px_-10px_rgba(44,196,169,0.9)] transition-colors hover:bg-[#45d1b8]",
          pathname.startsWith("/create") && "ring-2 ring-white/60 ring-offset-2 ring-offset-(--navy-950)",
        )}
      >
        <PlusIcon className="h-[18px] w-[18px]" />
        <span className="hidden lg:inline">Create</span>
        <span className="ml-auto hidden rounded bg-(--navy-950)/10 px-1.5 text-[11px] font-semibold lg:mr-3 lg:inline">C</span>
      </Link>

      <button
        type="button"
        onClick={onSearch}
        className="mt-3 flex h-9 items-center gap-2 rounded-(--r-md) border border-white/10 bg-white/[0.04] px-2.5 text-[13px] text-(--navy-300) transition-colors hover:bg-white/[0.08] hover:text-white"
      >
        <SearchIcon className="mx-auto h-4 w-4 lg:mx-0" />
        <span className="hidden lg:inline">Search</span>
        <span className="ml-auto hidden text-[11px] lg:inline">Ctrl K</span>
      </button>

      <nav aria-label="Main" className="mt-6 space-y-0.5">
        {NAV.map((n) => {
          const on = n.active(pathname);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={on ? "page" : undefined}
              title={n.label}
              className={cx("relative flex h-9 items-center gap-3 rounded-(--r-md) px-2.5 text-[13.5px] font-medium transition-colors", on ? "bg-white/[0.08] text-white" : "text-(--navy-300) hover:bg-white/[0.05] hover:text-white")}
            >
              {on && <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-(--teal-400) lg:-left-4" aria-hidden="true" />}
              <span className="mx-auto lg:mx-0">{n.icon}</span>
              <span className="hidden lg:inline">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      {courses.length > 0 && (
        <div className="mt-7 hidden lg:block">
          <p className="px-2.5 text-[10.5px] font-semibold tracking-[0.1em] text-(--navy-300)/80 uppercase">Your courses</p>
          <ul className="mt-1.5 space-y-0.5">
            {courses.map((c) => (
              <li key={c}>
                <Link href={`/library?course=${encodeURIComponent(c)}`} className="flex h-8 items-center gap-2.5 rounded-(--r-md) px-2.5 text-[13px] text-(--navy-300) hover:bg-white/[0.05] hover:text-white">
                  <span className="h-2 w-2 rounded-full bg-(--teal-400)" aria-hidden="true" />
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto space-y-0.5">
        <Link
          href="/integrations"
          aria-current={pathname.startsWith("/integrations") ? "page" : undefined}
          title="Integrations"
          className={cx("flex h-9 items-center gap-3 rounded-(--r-md) px-2.5 text-[13.5px] font-medium", pathname.startsWith("/integrations") ? "bg-white/[0.08] text-white" : "text-(--navy-300) hover:bg-white/[0.05] hover:text-white")}
        >
          <PlugIcon className="mx-auto h-[18px] w-[18px] lg:mx-0" />
          <span className="hidden lg:inline">Integrations</span>
          <span className={cx("ml-auto hidden h-2 w-2 rounded-full lg:inline-block", lms?.connected ? "bg-(--teal-400)" : "bg-white/25")} aria-hidden="true" />
          <span className="sr-only">{lms?.connected ? "(Google Classroom connected)" : "(no platform connected)"}</span>
        </Link>
        <button type="button" onClick={onShortcuts} title="Keyboard shortcuts" className="flex h-9 w-full items-center gap-3 rounded-(--r-md) px-2.5 text-[13.5px] font-medium text-(--navy-300) hover:bg-white/[0.05] hover:text-white">
          <KeyboardIcon className="mx-auto h-[18px] w-[18px] lg:mx-0" />
          <span className="hidden lg:inline">Shortcuts</span>
        </button>
        <p className="mt-3 hidden border-t border-white/10 px-2.5 pt-3 text-[11.5px] leading-snug text-(--navy-300) lg:block">
          Your work is saved in this browser. Teacher accounts come later.
        </p>
      </div>
    </aside>
  );
}

function MobileBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  return (
    <div className="fz-on-navy fz-screen-only sticky top-0 z-40 flex h-14 items-center gap-2 bg-(--navy-950) px-3 text-white md:hidden">
      <IconButton label="Open menu" onClick={onMenu} className="text-white hover:bg-white/10 hover:text-white">
        <MenuIcon className="h-5 w-5" />
      </IconButton>
      <Link href="/" aria-label="Funza home">
        <FunzaLogo tone="light" className="h-9 w-auto" />
      </Link>
      <span className="ml-auto" />
      <IconButton label="Search" onClick={onSearch} className="text-white hover:bg-white/10 hover:text-white">
        <SearchIcon className="h-5 w-5" />
      </IconButton>
      <Link href="/create" className="flex h-9 items-center gap-1.5 rounded-(--r-md) bg-(--teal-400) px-3 text-[13px] font-bold text-(--navy-950)">
        <PlusIcon className="h-4 w-4" />
        Create
      </Link>
    </div>
  );
}

function MobileMenu({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const items = [...NAV, { href: "/integrations", label: "Integrations", icon: <PlugIcon className="h-[18px] w-[18px]" />, active: (p: string) => p.startsWith("/integrations") }];
  return (
    <Dialog open onClose={onClose} title="Menu" width="max-w-sm">
      <nav aria-label="Main" className="-mx-2 space-y-1">
        {items.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={onClose}
            aria-current={n.active(pathname) ? "page" : undefined}
            className={cx("flex h-11 items-center gap-3 rounded-(--r-md) px-3 text-[15px] font-medium", n.active(pathname) ? "bg-(--teal-50) text-(--teal-900)" : "hover:bg-(--bg-sunk)")}
          >
            {n.icon}
            {n.label}
          </Link>
        ))}
      </nav>
    </Dialog>
  );
}

/** The bar at the top of every screen: where you are, and the screen's own actions. */
export function TopBar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <header className="sticky top-14 z-30 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b border-(--line) bg-(--bg)/90 px-4 py-2 backdrop-blur-md md:top-0 md:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px] text-(--muted)">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className={cx("flex min-w-0 items-center gap-1.5", i === items.length - 1 && "text-(--ink)")}>
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.href ? (
              <Link href={c.href} className="truncate hover:text-(--ink) hover:underline">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-semibold" aria-current="page">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ---------- search palette ---------- */

type Cmd = { id: string; group: string; label: string; hint?: string; icon: ReactNode; run: () => void };

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { resources, catalogVersion } = useWorkspace();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const base: Cmd[] = useMemo(() => {
    const create: Cmd[] = KINDS.map((k) => ({
      id: `create-${k.kind}`,
      group: "Create",
      label: `Create ${k.label.toLowerCase()}`,
      icon: <KindIcon kind={k.kind} size="sm" />,
      run: () => {
        startBrief(k.kind);
        router.push("/create");
      },
    }));
    const nav: Cmd[] = [
      { id: "go-curriculum", group: "Go to", label: "Curriculum", icon: <CompassIcon />, run: () => router.push("/curriculum") },
      { id: "go-library", group: "Go to", label: "Library", icon: <LibraryIcon />, run: () => router.push("/library") },
      { id: "go-integrations", group: "Go to", label: "Integrations", icon: <PlugIcon />, run: () => router.push("/integrations") },
    ];
    const res: Cmd[] = resources.map((r) => ({ id: `r-${r.id}`, group: "Resources", label: r.title, icon: <KindIcon kind={r.kind} size="sm" />, run: () => router.push(`/resources/${r.id}`) }));
    return [...res, ...create, ...nav];
  }, [resources, router]);
  // Outcomes this browser has loaded (the list grows as courses load); the Curriculum screen searches all of them.
  const outs: Cmd[] = useMemo(
    () => knownOutcomes().map(({ outcome: o, course }) => ({ id: `o-${o.id}`, group: "Outcomes", label: `${o.code} · ${o.statement} · ${course.name}`, icon: <CompassIcon />, run: () => router.push(`/curriculum?o=${o.id}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- knownOutcomes() changes with catalogVersion
    [router, catalogVersion],
  );
  const cmds = [...base, ...outs];

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = terms.length === 0 ? cmds.filter((c) => c.group !== "Outcomes").slice(0, 12) : cmds.filter((c) => terms.every((t) => `${c.label} ${c.group}`.toLowerCase().includes(t))).slice(0, 14);
  const index = Math.min(active, Math.max(results.length - 1, 0));

  function close() {
    setQ("");
    setActive(0);
    onClose();
  }
  function run(c: Cmd) {
    close();
    c.run();
  }

  return (
    <Dialog open={open} onClose={close} title="Search Funza" width="max-w-xl">
      <div className="-mx-1">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--muted)" />
          <input
            data-autofocus
            role="combobox"
            aria-expanded="true"
            aria-controls="fz-cmd-list"
            aria-activedescendant={results[index] ? `fz-cmd-${results[index].id}` : undefined}
            aria-label="Search resources, outcomes and actions"
            placeholder="Your resources, outcomes (try “FM2”), actions…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[index]) {
                e.preventDefault();
                run(results[index]);
              }
            }}
            className="h-11 w-full rounded-(--r-md) border border-(--line-input) bg-(--surface-2) pr-3 pl-9 text-[15px] outline-none focus:border-(--teal-700) focus:shadow-[0_0_0_3px_var(--teal-100)]"
          />
        </div>
        <ul id="fz-cmd-list" role="listbox" aria-label="Results" className="mt-3 max-h-[52vh] space-y-0.5 overflow-y-auto">
          {results.length === 0 && <li className="px-3 py-6 text-center text-[13.5px] text-(--muted)">Nothing matches “{q}”. Outcomes are searched by code and official wording.</li>}
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`fz-cmd-${c.id}`}
              role="option"
              aria-selected={i === index}
              onMouseMove={() => setActive(i)}
              onClick={() => run(c)}
              className={cx("flex cursor-pointer items-center gap-3 rounded-(--r-md) px-3 py-2 text-[13.5px]", i === index ? "bg-(--teal-50) text-(--teal-900)" : "text-(--ink-2)")}
            >
              <span className="shrink-0 text-(--muted)">{c.icon}</span>
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              <span className="shrink-0 text-[11.5px] text-(--muted)">{c.hint ?? c.group}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-(--line) pt-3 text-[12px] text-(--muted)">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> move
          </span>
          <span>
            <Kbd>Enter</Kbd> open
          </span>
          <span>
            <Kbd>Esc</Kbd> close
          </span>
        </p>
      </div>
    </Dialog>
  );
}

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: [string, string][] = [
    ["Ctrl K  or  /", "Search resources, outcomes and actions"],
    ["C", "Create a resource"],
    ["?", "This list"],
    ["In the editor: J / K", "Next / previous question"],
    ["In the editor: R", "Mark the selected part reviewed"],
    ["In the editor: N", "Jump to the next part that needs you"],
    ["In the editor: [  ]", "Hide or show the outline and the checks"],
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" width="max-w-md">
      <dl className="divide-y divide-(--line)">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2.5 text-[13.5px]">
            <dt className="text-(--ink-2)">{v}</dt>
            <dd className="shrink-0 font-semibold">
              <Kbd>{k}</Kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

function Toasts() {
  const { toasts } = useWorkspace();
  return (
    <Layer>
      <div role="status" aria-live="polite" className="fz-screen-only pointer-events-none fixed inset-x-0 bottom-5 z-[85] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "fz-pop-in pointer-events-auto flex max-w-md items-center gap-3 rounded-(--r-md) px-4 py-2.5 text-[13.5px] font-medium text-white shadow-(--sh-3)",
              t.tone === "bad" ? "bg-[#7a1a12]" : t.tone === "info" ? "bg-(--navy-800)" : "bg-(--navy-950)",
            )}
          >
            <span className={cx("h-2 w-2 shrink-0 rounded-full", t.tone === "bad" ? "bg-[#ff9b8f]" : t.tone === "info" ? "bg-(--navy-300)" : "bg-(--teal-400)")} aria-hidden="true" />
            {t.text}
            <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="ml-1 rounded p-0.5 text-white/70 hover:text-white">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Layer>
  );
}

/** Pages render this until the workspace has been read from browser storage. */
export function Loading() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-9 md:px-6 lg:px-8" aria-busy="true" aria-label="Loading your workspace">
      <span className="fz-skeleton block h-8 w-72" />
      <span className="fz-skeleton mt-3 block h-4 w-96 max-w-full" />
      <span className="fz-skeleton mt-8 block h-40 w-full" />
    </div>
  );
}
