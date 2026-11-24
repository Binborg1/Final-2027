import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { KindIcon } from "@/components/materials/KindIcon";
import { Card, CardHeader, Overline } from "@/components/ui/Card";
import { CountPill, StatusChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Misc";
import type { MaterialRow } from "@/lib/courses/data";
import { shortDate, splitMaterials } from "@/lib/library/model";
import { kindInfo } from "@/lib/resources/kinds";

/**
 * The materials of a course or chapter. Approved ones come first and open read-only
 * in the Library, with their latest approved version; drafts never approved come
 * after, under "Still in review", and open in Review.
 */
export function Materials({ courseId, materials, makeHref, empty }: { courseId: string; materials: MaterialRow[]; makeHref: string | null; empty: string }) {
  const { done, inReview } = splitMaterials(materials);
  return (
    <Card className="flex flex-col gap-3 px-6 pt-5 pb-5" aria-labelledby="materials-title">
      <CardHeader
        id="materials-title"
        title="Materials"
        after={done.length > 0 ? <CountPill>{done.length}</CountPill> : null}
        actions={
          done.length > 0 ? (
            <Link href={`/library?course=${courseId}`} className="text-body font-semibold text-accent-ink hover:underline">
              See all in Library
            </Link>
          ) : null
        }
      />
      {materials.length === 0 ? (
        <EmptyState icon={FileText} title="Nothing made yet" action={makeHref ? <Link href={makeHref} className="font-semibold text-accent-ink hover:underline">Make something</Link> : undefined}>
          {empty}
        </EmptyState>
      ) : (
        <>
          {done.length === 0 ? (
            <p className="text-body text-ink-2">Nothing approved yet. Materials you approve in Review are kept here, with every version.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {done.map((m) => (
                <li key={m.id}>
                  <Link href={`/library/${m.id}`} className="group flex items-center gap-3 rounded-tile border border-white/80 bg-tile px-3.5 py-3 hover:bg-white/80">
                    <KindIcon kind={m.kind} className="size-9" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-row font-semibold">{m.title}</span>
                      <span className="text-meta text-ink-2">
                        {kindInfo(m.kind).label} · v{m.approved!.version} · approved {shortDate(m.approved!.at)}
                      </span>
                      {m.draft ? <span className="text-meta font-semibold text-amber-ink">v{m.draft} in review</span> : null}
                    </span>
                    <StatusChip status={m.status === "published" ? "published" : "approved"} />
                    <ArrowRight aria-hidden size={16} className="shrink-0 text-ink-2 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {inReview.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <Overline>Still in review</Overline>
              <ul className="flex flex-col gap-1">
                {inReview.map((m) => (
                  <li key={m.id}>
                    <Link href={`/make/${m.id}`} className="group -mx-2 flex items-center gap-3 rounded-tile px-2 py-2 hover:bg-white/50">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body font-semibold">{m.title}</span>
                        <span className="text-meta text-ink-2">
                          {kindInfo(m.kind).label}
                          {m.version ? ` · v${m.version}` : ""} · {shortDate(m.updatedAt)}
                        </span>
                      </span>
                      <StatusChip status="in-review" />
                      <ArrowRight aria-hidden size={16} className="shrink-0 text-ink-2 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
