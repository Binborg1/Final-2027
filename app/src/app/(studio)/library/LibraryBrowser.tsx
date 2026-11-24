"use client";

import { ArrowRight, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { KindIcon } from "@/components/materials/KindIcon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceChip, StatusChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Misc";
import { filterRows, filterToQuery, KIND_FILTERS, kindCounts, newestFirst, NO_FILTER, type LibraryFilter, type LibraryRow } from "@/lib/library/model";
import { kindInfo } from "@/lib/resources/kinds";

/**
 * The Library's second step: one course's documents, with a title search and kind
 * chips. Everything is already loaded, so filtering is instant; the filters are
 * kept in the address with the course, so Back returns to them.
 */
export function LibraryBrowser({ rows, initial }: { rows: LibraryRow[]; initial: LibraryFilter }) {
  const [filter, setFilter] = useState(initial);
  const set = (patch: Partial<LibraryFilter>) => setFilter((f) => ({ ...f, ...patch }));

  useEffect(() => {
    const query = filterToQuery(filter);
    const next = query ? `?${query}` : window.location.pathname;
    if (next !== `${window.location.search || window.location.pathname}`) window.history.replaceState(null, "", next);
  }, [filter]);

  const counts = useMemo(() => kindCounts(rows, filter), [rows, filter]);
  const list = useMemo(() => newestFirst(filterRows(rows, filter)), [rows, filter]);
  // A chip for each kind this course has at all, so chips don't come and go while typing.
  const present = useMemo(() => kindCounts(rows, NO_FILTER), [rows]);
  const kinds = KIND_FILTERS.filter((k) => k.id === "all" || k.id === filter.kind || present[k.id] > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <label className="relative max-w-[420px] min-w-[220px]">
          <span className="sr-only">Search titles</span>
          <Search aria-hidden size={18} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-2" />
          <input
            type="search"
            placeholder="Search titles"
            value={filter.q}
            maxLength={100}
            onChange={(e) => set({ q: e.target.value })}
            className="h-[52px] w-full rounded-md border border-line-control bg-field pr-4 pl-11 text-card-sm font-normal text-ink transition-shadow placeholder:text-ink-2 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
          />
        </label>
        <div role="group" aria-label="Kind" className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <ChoiceChip key={k.id} selected={filter.kind === k.id} suffix={counts[k.id]} onClick={() => set({ kind: k.id })}>
              {k.label}
            </ChoiceChip>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={SearchX}
            title="Nothing matches"
            action={
              <Button variant="secondary" size="sm" onClick={() => setFilter({ ...NO_FILTER, course: filter.course })}>
                Clear filters
              </Button>
            }
          >
            Try another word, or another kind.
          </EmptyState>
        </Card>
      ) : (
        <Card className="px-6 pt-5 pb-5 max-sm:px-4" aria-label="Documents">
          <ul className="flex flex-col gap-2">
            {list.map((r) => (
              <li key={r.id}>
                <Row row={r} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Row({ row: r }: { row: LibraryRow }) {
  const meta = [kindInfo(r.kind).label, `v${r.approved.number}`, `approved ${r.approvedOn}`, r.chapterTitles.join(", ")].filter(Boolean).join(" · ");
  return (
    <Link href={`/library/${r.id}`} className="group flex items-center gap-3.5 rounded-tile border border-white/80 bg-tile px-3.5 py-3 hover:bg-white/80">
      <KindIcon kind={r.kind} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-row font-semibold">{r.title}</span>
        <span className="truncate text-meta text-ink-2">{meta}</span>
        {r.draft ? <span className="text-meta font-semibold text-amber-ink">v{r.draft} in review</span> : null}
      </span>
      <StatusChip status={r.published ? "published" : "approved"} />
      <ArrowRight aria-hidden size={16} className="shrink-0 text-ink-2 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
