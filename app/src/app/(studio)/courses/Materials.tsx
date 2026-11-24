import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { CountPill, StatusChip, type MaterialStatus as ChipStatus } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Misc";
import type { MaterialRow } from "@/lib/courses/data";
import { KINDS } from "@/lib/resources/kinds";

const CHIP: Record<MaterialRow["status"], ChipStatus> = { draft: "draft", in_review: "in-review", approved: "approved", published: "published" };
const kindLabel = (kind: string) => KINDS.find((k) => k.kind === kind)?.label ?? kind;

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA", { day: "numeric", month: "short" });
}

/** The materials of a course or chapter, each opening in Review. */
export function Materials({ materials, makeHref, empty }: { materials: MaterialRow[]; makeHref: string | null; empty: string }) {
  return (
    <Card className="flex flex-col gap-3 px-6 pt-5 pb-5" aria-labelledby="materials-title">
      <CardHeader id="materials-title" title="Materials" after={materials.length > 0 ? <CountPill>{materials.length}</CountPill> : null} />
      {materials.length === 0 ? (
        <EmptyState icon={FileText} title="Nothing made yet" action={makeHref ? <Link href={makeHref} className="font-semibold text-accent-ink hover:underline">Make something</Link> : undefined}>
          {empty}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {materials.map((m) => (
            <li key={m.id}>
              <Link href={`/make/${m.id}`} className="group flex items-center gap-3 rounded-tile border border-white/80 bg-tile px-3.5 py-3 hover:bg-white/80">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-row font-semibold">{m.title}</span>
                  <span className="text-meta text-ink-2">
                    {kindLabel(m.kind)}
                    {m.version ? ` · v${m.version}` : ""} · {when(m.updatedAt)}
                  </span>
                </span>
                <StatusChip status={CHIP[m.status]} />
                <ArrowRight aria-hidden size={16} className="shrink-0 text-ink-2 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
