import { BookOpen, ChartColumn, ClipboardCheck, House, Layers, LayoutTemplate, Radio, Settings, type LucideIcon } from "lucide-react";

/**
 * The sidebar, as drawn in F · Oak. Items without an `href` aren't built yet: they
 * show where they will be, disabled, with a note saying when they arrive.
 */
export type NavItem = { id: string; label: string; icon: LucideIcon; href?: string; soon?: string; match?: (path: string) => boolean };
export type NavSection = { label: string | null; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    label: "Prepare",
    items: [
      { id: "home", label: "Home", icon: House, href: "/", match: (p) => p === "/" || p.startsWith("/make") },
      { id: "courses", label: "Courses", icon: BookOpen, soon: "Courses and chapters arrive in the next update" },
      { id: "review", label: "Review", icon: ClipboardCheck, soon: "Drafts waiting for review are on Home for now" },
      { id: "bank", label: "Question bank", icon: Layers, soon: "The question bank arrives with courses" },
      { id: "templates", label: "Templates", icon: LayoutTemplate, soon: "Templates arrive later" },
    ],
  },
  {
    label: "Live",
    items: [
      { id: "live", label: "Go live", icon: Radio, soon: "Arrives with Live mode" },
      { id: "sessions", label: "Live sessions", icon: ChartColumn, soon: "Arrives with Live mode" },
    ],
  },
  { label: null, items: [{ id: "settings", label: "Settings", icon: Settings, href: "/settings", match: (p) => p.startsWith("/settings") }] },
];

export const isActive = (item: NavItem, path: string) => (item.match ? item.match(path) : item.href === path);

export const SIDEBAR_COOKIE = "funza_sidebar";
