"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainMascot } from "@/components/BrainMascot";
import { spring } from "@/components/motion";

const links = [
  { href: "/", label: "My Courses", icon: BookIcon },
  { href: "/progress", label: "Progress", icon: ChartIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/courses") : pathname.startsWith(href);

  return (
    <aside className="flex w-full flex-row items-center gap-4 border-b border-line bg-cream px-4 py-3 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:flex-col md:items-stretch md:gap-1 md:border-r md:border-b-0 md:px-5 md:py-7">
      <Link href="/" className="flex items-center gap-2.5 px-2 md:mb-8">
        <BrainMascot mood="happy" size={38} />
        <span className="text-xl font-extrabold tracking-tight">Funza</span>
      </Link>
      <nav className="flex flex-row gap-1.5 md:flex-col" aria-label="Main">
        {links.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-bold transition-colors duration-200 ${
                active ? "text-white" : "text-charcoal hover:bg-peach/70"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-full bg-linear-to-b from-[#ff8c62] to-[#f06f45] shadow-button"
                  transition={spring}
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10 flex items-center gap-3">
                <Icon />
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function BookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5V5.5M20 18v3H6.5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />
    </svg>
  );
}
