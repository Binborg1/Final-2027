"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/ui/cn";

/**
 * The bottom tab dock: the page's sections, plus a "+" for the page's main
 * action. It floats centred on the workspace panel, straddling its bottom edge;
 * the active tab follows the section in view.
 */
export function TabDock({ tabs, plus }: { tabs: { id: string; label: string }[]; plus?: { href: string; label: string } }) {
  const [active, setActive] = useState(tabs[0]?.id);
  useEffect(() => {
    const els = tabs.map((t) => document.getElementById(t.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (seen) setActive(seen.target.id);
    }, { rootMargin: "-20% 0px -55% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [tabs]);
  return (
    <nav aria-label="Sections on this page" className="frost frost-dock fixed bottom-[22px] left-1/2 z-20 hidden -translate-x-1/2 items-center gap-0.5 rounded-[26px] border border-white/70 p-1 shadow-dock md:left-[calc(104px_+_(100vw_-_128px)/2)] md:flex">
      {tabs.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          onClick={() => setActive(t.id)}
          aria-current={active === t.id ? "location" : undefined}
          className={cn("flex h-9 items-center rounded-[18px] px-4 text-body whitespace-nowrap", active === t.id ? "bg-white/95 font-semibold shadow-active" : "font-medium hover:bg-white/60")}
        >
          {t.label}
        </a>
      ))}
      {plus ? (
        <Link href={plus.href} aria-label={plus.label} title={plus.label} className="ml-1.5 flex size-9 items-center justify-center rounded-full bg-ink text-white hover:bg-ink/90">
          <Plus aria-hidden size={18} strokeWidth={2.2} />
        </Link>
      ) : null}
    </nav>
  );
}
