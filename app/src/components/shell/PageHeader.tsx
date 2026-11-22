import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export type Crumb = { label: string; href?: string };

/** Breadcrumbs, a large title, a one-line summary, and the page's actions (at most one primary). */
export function PageHeader({ crumbs, title, summary, actions, size = "title", className }: { crumbs?: Crumb[]; title: ReactNode; summary?: ReactNode; actions?: ReactNode; size?: "display" | "title" | "title-sm"; className?: string }) {
  return (
    <header className={cn("flex flex-col gap-[18px]", className)}>
      {crumbs && crumbs.length > 0 ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-body font-medium">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 ? <ChevronRight aria-hidden size={14} strokeWidth={2} /> : null}
                {c.href && i < crumbs.length - 1 ? (
                  <Link href={c.href} className="hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={i === crumbs.length - 1 ? "page" : undefined} className={cn(i === crumbs.length - 1 && "font-semibold")}>
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className={cn("font-bold text-ink max-sm:text-[28px] max-sm:leading-[34px]", size === "display" ? "text-display" : size === "title" ? "text-title" : "text-title-sm")}>{title}</h1>
          {summary ? <p className="text-row font-medium text-ink">{summary}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
