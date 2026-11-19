"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { spring } from "@/components/motion";
import type { Status } from "@/lib/teacher/mock";

const tabs = [
  { href: "/teacher", label: "Dashboard" },
  { href: "/teacher/notes", label: "Note Maker" },
  { href: "/teacher/generate", label: "Generate" },
  { href: "/teacher/exam", label: "Exam Builder" },
  { href: "/teacher/review", label: "Review & Publish" },
  { href: "/teacher/library", label: "Library" },
  { href: "/teacher/insights", label: "Insights" },
];

/** Page title, prototype notice and the sub-navigation shared by every Teacher Studio screen. */
export function StudioHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mb-8">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-lavender px-3 py-1 text-xs font-bold text-lavender-dark">
        <span className="h-1.5 w-1.5 rounded-full bg-lavender-dark" aria-hidden="true" />
        Teacher Studio · UI prototype, not functional yet
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-2 text-smoke">{subtitle}</p>
        </div>
        {action}
      </div>
      <nav className="-mx-1 mt-6 flex gap-1 overflow-x-auto pb-1" aria-label="Teacher Studio">
        {tabs.map((t) => {
          const active = t.href === "/teacher" ? pathname === "/teacher" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                active ? "text-charcoal" : "text-smoke hover:text-charcoal"
              }`}
            >
              {active && (
                <motion.span layoutId="studio-tab" transition={spring} className="absolute inset-0 rounded-full bg-white shadow-secondary" aria-hidden="true" />
              )}
              <span className="relative z-10">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const statusStyle: Record<Status, string> = {
  draft: "bg-peach text-peach-dark",
  review: "bg-lavender text-lavender-dark",
  approved: "bg-sky text-sky-dark",
  published: "bg-mint text-mint-dark",
};
const statusLabel: Record<Status, string> = { draft: "Draft", review: "In review", approved: "Approved", published: "Published" };

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusStyle[status]}`}>{statusLabel[status]}</span>;
}

/** A row of pill buttons where one (or several, with `multi`) can be selected. */
export function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T | T[];
  onChange: (v: T) => void;
}) {
  const selected = (o: T) => (Array.isArray(value) ? value.includes(o) : value === o);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <motion.button
          key={o}
          type="button"
          whileTap={{ scale: 0.95 }}
          transition={spring}
          onClick={() => onChange(o)}
          aria-pressed={selected(o)}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors ${
            selected(o) ? "border-coral bg-peach text-peach-dark" : "border-line bg-white text-smoke hover:bg-sand"
          }`}
        >
          {o}
        </motion.button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-extrabold">{label}</p>
      {children}
    </div>
  );
}

export function SourceChip({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-0.5 text-xs font-bold text-smoke">
      📎 {source}
    </span>
  );
}

export function AiBadge() {
  return <span className="rounded-full bg-sky px-2.5 py-0.5 text-xs font-bold text-sky-dark">✨ AI-assisted · Teacher reviewed</span>;
}

export const inputClass =
  "w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm shadow-track outline-none focus:border-coral focus:ring-4 focus:ring-coral/20";

/** Fake "generating" helper: flips a flag for a moment so buttons feel alive. */
export function wait(ms = 900) {
  return new Promise((r) => setTimeout(r, ms));
}
