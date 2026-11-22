"use client";

import { Bell, ChevronLeft, ChevronRight, ChevronsUpDown, House, Search, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Kbd } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/Button";
import { Logo, Tooltip } from "@/components/ui/Misc";
import { cn } from "@/lib/ui/cn";
import { Avatar } from "./Avatar";
import { CommandDialog } from "./CommandDialog";
import { isActive, NAV, SIDEBAR_COOKIE, type NavItem } from "./nav";
import { SignOutForm } from "./SignOut";

export type ShellTeacher = { firstName: string; fullName: string; initials: string; gradesLabel: string };
export type ShellCourse = { id: string; title: string };

const ShellContext = createContext<{ openCommand: () => void }>({ openCommand: () => {} });
/** Lets any page open the Ask Funza dialog. */
export const useShell = () => useContext(ShellContext);

/**
 * The F · Oak page shell: photo, glass sidebar, top bar with Ask Funza (Ctrl K),
 * and the frosted workspace panel the page renders into.
 * - Desktop (1024 px and up): sidebar 264 expanded or 64 collapsed, overlaying the
 *   panel, which keeps its place and pads its content instead.
 * - Tablet: the sidebar stays collapsed.
 * - Phone (under 768 px, not drawn in Figma): a bottom bar replaces the sidebar,
 *   and the panel becomes a full-screen frosted layer.
 */
export function ShellFrame({ teacher, courses, initialExpanded, children }: { teacher: ShellTeacher; courses: ShellCourse[]; initialExpanded: boolean; children: ReactNode }) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [commandOpen, setCommandOpen] = useState(false);
  const openCommand = useCallback(() => setCommandOpen(true), []);
  const closeCommand = useCallback(() => setCommandOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "expanded" : "collapsed"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <ShellContext.Provider value={{ openCommand }}>
      <a href="#main" className="sr-only z-50 rounded-full bg-white px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <TopBar teacher={teacher} onAsk={openCommand} />
      <Sidebar teacher={teacher} courses={courses} expanded={expanded} onToggle={toggle} onSearch={openCommand} />
      <BottomBar teacher={teacher} onSearch={openCommand} />
      {/* Phone: the frosted layer the content scrolls over. */}
      <div aria-hidden className="frost frost-panel fixed inset-0 -z-[5] md:hidden" />
      <main
        id="main"
        tabIndex={-1}
        className={cn(
          "frost frost-panel scrollbar-thin outline-none max-md:min-h-dvh max-md:bg-none max-md:px-3 max-md:pt-[76px] max-md:pb-28",
          "md:fixed md:top-[84px] md:right-6 md:bottom-6 md:left-[104px] md:overflow-y-auto md:rounded-panel md:border md:border-white/40 md:pt-[34px] md:pr-10 md:pb-24 md:pl-10 md:shadow-panel",
          expanded && "lg:pl-[216px]",
        )}
      >
        {children}
      </main>
      <CommandDialog open={commandOpen} onClose={closeCommand} />
    </ShellContext.Provider>
  );
}

/* ---------- top bar ---------- */

function TopBar({ teacher, onAsk }: { teacher: ShellTeacher; onAsk: () => void }) {
  const [bellOpen, setBellOpen] = useState(false);
  return (
    <header className="fixed top-5 right-6 left-5 z-30 flex h-11 items-center gap-3 max-md:top-3 max-md:right-3 max-md:left-3">
      <div className="frost frost-bar flex h-11 items-center gap-2.5 rounded-[22px] border border-white/60 py-1 pr-[18px] pl-1">
        <Avatar initials={teacher.initials} />
        <span className="max-w-[40vw] truncate text-body font-semibold">Welcome, {teacher.firstName}</span>
      </div>
      <button
        type="button"
        onClick={onAsk}
        className="frost frost-ask absolute top-0 left-[calc(84px_+_(100%_-_84px)/2)] hidden h-11 w-[min(460px,calc(100vw_-_560px))] -translate-x-1/2 items-center gap-2.5 rounded-[22px] border border-white/60 pr-2 pl-3.5 text-left lg:flex"
      >
        <span aria-hidden className="flex size-[22px] items-center justify-center">
          <span className="size-3.5 rounded-full bg-accent shadow-[0_0_12px_2px_rgb(224_102_47/0.75)]" />
        </span>
        <span className="flex-1 truncate text-body font-normal text-ink-2">Ask Funza…</span>
        <Kbd className="bg-white/80">Ctrl K</Kbd>
      </button>
      <div className="ml-auto flex items-center gap-3">
        <IconButton icon={Search} label="Ask Funza" onClick={onAsk} className="lg:hidden" />
        <div className="relative">
          <IconButton icon={Bell} label="Notifications" aria-expanded={bellOpen} onClick={() => setBellOpen((o) => !o)} />
          {bellOpen ? (
            <Popover onClose={() => setBellOpen(false)} className="right-0 w-64">
              <p className="px-3 py-2.5 text-body text-ink-2">No notifications yet. Funza will tell you here when a draft is ready.</p>
            </Popover>
          ) : null}
        </div>
        <Link href="/settings" aria-label="Settings" title="Settings" className="frost frost-bar flex size-11 items-center justify-center rounded-full border border-white/60 max-md:hidden">
          <Settings aria-hidden size={20} strokeWidth={1.6} />
        </Link>
      </div>
    </header>
  );
}

/* ---------- sidebar (tablet and desktop) ---------- */

function Sidebar({ teacher, courses, expanded, onToggle, onSearch }: { teacher: ShellTeacher; courses: ShellCourse[]; expanded: boolean; onToggle: () => void; onSearch: () => void }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className={cn(
        "frost frost-sidebar fixed top-[84px] bottom-6 left-5 z-20 hidden flex-col rounded-panel border border-white/45 shadow-sidebar md:flex",
        expanded ? "w-16 lg:w-[264px] lg:gap-0.5 lg:px-3 lg:pt-4 lg:pb-3" : "w-16",
        "items-center gap-1 px-2.5 pt-4 pb-3.5",
        expanded && "lg:items-stretch",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={expanded ? "Collapse the sidebar" : "Expand the sidebar"}
        aria-expanded={expanded}
        className="absolute top-6 -right-3.5 hidden size-[30px] items-center justify-center rounded-full bg-white shadow-toggle lg:flex"
      >
        {expanded ? <ChevronLeft aria-hidden size={16} strokeWidth={2.4} /> : <ChevronRight aria-hidden size={16} strokeWidth={2.4} />}
      </button>

      <div className={cn(expanded && "lg:pr-2 lg:pl-1")}>
        <Logo wordmark={false} className={cn(expanded && "lg:hidden")} />
        <Logo className={cn("hidden", expanded && "lg:flex")} />
      </div>

      <div className={cn("mt-1.5", expanded && "lg:mt-2.5")}>
        <Tooltip label="Search pages" className={cn(expanded && "lg:hidden")}>
          <button type="button" onClick={onSearch} aria-label="Search pages" className="flex size-11 items-center justify-center rounded-full hover:bg-white/60">
            <Search aria-hidden size={20} strokeWidth={1.6} />
          </button>
        </Tooltip>
        <button type="button" onClick={onSearch} className={cn("hidden h-10 w-full items-center gap-2 rounded-[20px] border border-white/70 bg-white/50 pr-2 pl-3 text-left", expanded && "lg:flex")}>
          <Search aria-hidden size={18} strokeWidth={1.6} className="text-ink-2" />
          <span className="flex-1 text-body font-normal text-ink-2">Search pages…</span>
          <Kbd className="h-[18px] rounded-[6px] px-1.5">Ctrl K</Kbd>
        </button>
      </div>

      <div className="scrollbar-thin -mx-1 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-1 py-1 lg:items-stretch">
        {NAV.map((section, si) => (
          <div key={si} className={cn("flex flex-col items-center gap-1", expanded && "lg:items-stretch lg:gap-0.5")}>
            {section.label ? (
              <p className={cn("hidden px-3 pt-3.5 pb-1.5 text-badge font-bold tracking-[0.08em] text-ink uppercase", expanded && "lg:block")}>{section.label}</p>
            ) : (
              <span aria-hidden className={cn("my-1.5 h-px w-6 bg-ink/14", expanded && "lg:mx-3 lg:my-2 lg:w-auto lg:bg-ink/10")} />
            )}
            {si === 0 ? <span aria-hidden className={cn("my-1.5 h-px w-6 bg-ink/14", expanded && "lg:hidden")} /> : null}
            {section.items.map((item) => (
              <div key={item.id} className={cn("flex flex-col items-center", expanded && "lg:items-stretch")}>
                <NavLink item={item} active={isActive(item, path)} expanded={expanded} />
                {item.id === "courses" && courses.length > 0 ? (
                  <ul className={cn("hidden flex-col", expanded && "lg:flex")} aria-label="Your courses">
                    {courses.map((c, i) => (
                      <li key={c.id} className="flex h-[34px] items-center gap-2.5 pl-[46px] text-body font-medium text-ink" title="Course pages arrive in the next update">
                        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", i % 2 === 0 ? "bg-accent" : "bg-sage")} />
                        <span className="truncate">{c.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>

      <ProfileMenu teacher={teacher} expanded={expanded} />
    </nav>
  );
}

function NavLink({ item, active, expanded }: { item: NavItem; active: boolean; expanded: boolean }) {
  const Icon = item.icon;
  const body = (
    <>
      <Icon aria-hidden size={20} strokeWidth={1.6} className="shrink-0" />
      <span className={cn("sr-only", expanded && "lg:not-sr-only lg:truncate")}>{item.label}</span>
    </>
  );
  const shape = cn(
    "flex size-11 items-center justify-center rounded-[22px] border text-row",
    expanded && "lg:h-11 lg:w-full lg:justify-start lg:gap-3 lg:px-3",
    active ? "border-white bg-white/85 font-semibold shadow-active lg:bg-white/62 lg:border-white/95" : "border-transparent font-medium",
  );
  const tip = item.href ? item.label : `${item.label}: ${item.soon}`;
  if (!item.href) {
    return (
      <Tooltip label={tip}>
        <span role="link" aria-disabled="true" tabIndex={0} aria-label={tip} className={cn(shape, "cursor-not-allowed text-ink-2 opacity-70")}>
          {body}
        </span>
      </Tooltip>
    );
  }
  return (
    <Tooltip label={item.label} className={cn(expanded && "lg:[&>[role=tooltip]]:hidden")}>
      <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(shape, "text-ink hover:bg-white/60")}>
        {body}
      </Link>
    </Tooltip>
  );
}

function ProfileMenu({ teacher, expanded }: { teacher: ShellTeacher; expanded: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative mt-1 w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${teacher.fullName}: account menu`}
        className={cn("flex w-full items-center justify-center rounded-3xl p-1 hover:bg-white/60", expanded && "lg:justify-start lg:gap-2.5 lg:px-1.5 lg:py-1.5")}
      >
        <Avatar initials={teacher.initials} />
        <span className={cn("hidden min-w-0 flex-1 flex-col text-left", expanded && "lg:flex")}>
          <span className="truncate text-body leading-[18px] font-semibold">{teacher.fullName}</span>
          <span className="truncate text-badge font-medium text-ink-2">{teacher.gradesLabel}</span>
        </span>
        <ChevronsUpDown aria-hidden size={16} className={cn("hidden text-ink-2", expanded && "lg:block")} />
      </button>
      {open ? (
        <Popover onClose={() => setOpen(false)} className="bottom-full left-0 mb-2 w-56">
          <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-row font-medium hover:bg-white/70">
            <Settings aria-hidden size={18} strokeWidth={1.6} />
            Settings
          </Link>
          <SignOutForm />
        </Popover>
      ) : null}
    </div>
  );
}

/* ---------- phone bottom bar ---------- */

function BottomBar({ teacher, onSearch }: { teacher: ShellTeacher; onSearch: () => void }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const item = (active: boolean) => cn("flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-badge", active ? "bg-white/90 font-semibold text-ink shadow-active" : "font-medium text-ink");
  return (
    <nav aria-label="Main" className="frost frost-dock fixed right-3 bottom-3 left-3 z-30 flex items-center gap-1 rounded-[28px] border border-white/70 p-1.5 shadow-dock md:hidden">
      <Link href="/" aria-current={path === "/" ? "page" : undefined} className={item(path === "/")}>
        <House aria-hidden size={20} strokeWidth={1.6} />
        Home
      </Link>
      <Link href="/make" aria-current={path.startsWith("/make") ? "page" : undefined} className={item(path.startsWith("/make"))}>
        <Sparkles aria-hidden size={20} strokeWidth={1.6} />
        Make
      </Link>
      <button type="button" onClick={onSearch} className={item(false)}>
        <Search aria-hidden size={20} strokeWidth={1.6} />
        Ask
      </button>
      <div className="relative flex flex-1">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className={item(path.startsWith("/settings"))}>
          <Avatar initials={teacher.initials} className="size-5 text-[9px]" />
          You
        </button>
        {open ? (
          <Popover onClose={() => setOpen(false)} className="right-0 bottom-full mb-3 w-56">
            <Link href="/settings" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-[14px] px-3 py-2.5 text-row font-medium hover:bg-white/70">
              <Settings aria-hidden size={18} strokeWidth={1.6} />
              Settings
            </Link>
            <SignOutForm className="min-h-11" />
          </Popover>
        ) : null}
      </div>
    </nav>
  );
}

/* ---------- a small glass popover that closes on outside click or Escape ---------- */

function Popover({ onClose, className, children }: { onClose: () => void; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div ref={ref} role="menu" className={cn("absolute z-40 flex flex-col gap-0.5 rounded-[18px] border border-white/90 bg-white/92 p-1.5 shadow-tooltip", className)}>
      {children}
    </div>
  );
}
