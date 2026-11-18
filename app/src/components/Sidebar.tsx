"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { BrainMascot } from "@/components/BrainMascot";
import { spring } from "@/components/motion";

type NavLink = { href: string; label: string; icon: ComponentType; active: (path: string) => boolean; badge?: string };

const isCurriculum = (p: string) => p === "/teach/curriculum" || /^\/teach\/[^/]+\/curriculum/.test(p);
const isInsights = (p: string) => p === "/teach/insights" || /^\/teach\/[^/]+\/insights/.test(p);

const groups: { label: string; links: NavLink[] }[] = [
  {
    label: "Teach",
    links: [
      { href: "/teach", label: "Dashboard", icon: GridIcon, active: (p) => p.startsWith("/teach") && !isCurriculum(p) && !isInsights(p) },
      { href: "/teach/curriculum", label: "Curriculum", icon: CompassIcon, active: isCurriculum },
      { href: "/teach/insights", label: "Insights", icon: PulseIcon, active: isInsights, badge: "Planned" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  // The questionnaire is a standalone page for participants on their phones: no app navigation.
  if (pathname.startsWith("/survey")) return null;

  return (
    <aside
      data-app-sidebar
      className="flex w-full flex-col gap-3 bg-navy-950 px-4 py-3 text-white md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:gap-0 md:px-4 md:py-6"
    >
      <Link href="/" className="flex items-center gap-2.5 rounded-xl px-2 py-1 md:mb-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
          <BrainMascot mood="happy" size={32} />
        </span>
        <span>
          <span className="block font-display text-lg leading-tight font-bold tracking-tight">Funza</span>
          <span className="block text-[11px] font-medium text-navy-300">Teaching studio</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex gap-4 overflow-x-auto pb-1 md:flex-col md:gap-6 md:overflow-visible md:pb-0">
        {groups.map((group) => (
          <div key={group.label} className="flex shrink-0 items-center gap-1 md:flex-col md:items-stretch">
            <p className="hidden px-3 pb-1 text-[11px] font-semibold tracking-wider text-navy-300 uppercase md:block">{group.label}</p>
            {group.links.map(({ href, label, icon: Icon, active, badge }) => {
              const on = active(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={`relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    on ? "text-white" : "text-navy-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {on && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-xl bg-linear-to-r from-[#5b3fd9] to-[#6d52ea] shadow-[0_6px_16px_-8px_rgba(91,63,217,0.9)]"
                      transition={spring}
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <Icon />
                    {label}
                    {badge && (
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-navy-300">{badge}</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <p className="mt-auto hidden px-3 text-[11px] leading-relaxed text-navy-300 md:block">
        Saskatchewan pilot. Curriculum content is quoted from official sources and shown with its verification status.
      </p>
    </aside>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function GridIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </svg>
  );
}
