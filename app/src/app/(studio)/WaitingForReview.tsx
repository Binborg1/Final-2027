"use client";

import { ChevronRight, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CountPill, StatusChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Misc";
import { allItems } from "@/lib/resources/checks";
import { kindInfo } from "@/lib/resources/kinds";
import { formatWhen, useWorkspace } from "@/lib/resources/store";

/** The teacher's materials (saved in the database): those still waiting for review first, then the approved ones. */
export function WaitingForReview() {
  const { hydrated, resources, drafts } = useWorkspace();
  const rows = resources
    .map((r) => ({ r, d: drafts[r.id] }))
    .filter((x) => x.d)
    .sort((a, b) => b.r.updatedAt.localeCompare(a.r.updatedAt));
  const waiting = rows.filter((x) => x.d.status !== "approved");
  const approved = rows.filter((x) => x.d.status === "approved").slice(0, 5);

  return (
    <Card className="flex flex-col gap-1 px-6 pt-5 pb-3" aria-labelledby="waiting-title">
      <CardHeader id="waiting-title" title="Waiting for review" after={waiting.length > 0 ? <CountPill>{waiting.length}</CountPill> : null} />
      {!hydrated ? (
        <p className="py-6 text-body text-ink-2">Loading your drafts…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Sparkles} title="Nothing waiting" action={<ButtonLink href="/make" size="sm" icon={Sparkles}>Make something</ButtonLink>}>
          Make something and it shows up here for you to review.
        </EmptyState>
      ) : (
        <>
          {waiting.length === 0 ? <p className="py-4 text-body text-ink-2">Nothing waiting. Everything you made is approved.</p> : <Rows rows={waiting} />}
          {approved.length > 0 ? (
            <>
              <p className="mt-2 border-t border-line pt-3 text-badge font-bold tracking-[0.06em] text-ink-2 uppercase">Approved</p>
              <Rows rows={approved} />
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}

function Rows({ rows }: { rows: { r: ReturnType<typeof useWorkspace>["resources"][number]; d: ReturnType<typeof useWorkspace>["drafts"][string] }[] }) {
  return (
    <ul className="flex flex-col">
      {rows.map(({ r, d }) => {
        const count = allItems(d).length;
        const meta = [r.courseName, count > 0 ? `${count} question${count === 1 ? "" : "s"}` : `${d.sections.length} part${d.sections.length === 1 ? "" : "s"}`, formatWhen(r.updatedAt)].filter(Boolean).join(" · ");
        return (
          <li key={r.id} className="border-b border-line last:border-b-0">
            <Link href={`/make/${r.id}`} className="group -mx-2 flex items-center gap-3.5 rounded-tile px-2 py-3 hover:bg-white/50">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-white/85 text-accent">
                <FileText size={20} strokeWidth={1.6} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-row font-semibold">
                  {kindInfo(r.kind).label} · {d.title}
                </span>
                <span className="truncate text-meta text-ink-2">{meta}</span>
              </span>
              <StatusChip status={d.status === "approved" ? "approved" : "in-review"} />
              <ChevronRight aria-hidden size={16} className="shrink-0 text-ink-2" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
