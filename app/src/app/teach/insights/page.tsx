"use client";

import Link from "next/link";
import { InsightsPlan } from "@/components/classes/InsightsPlan";
import { PageHeader } from "@/components/classes/ui";
import { useHydrated, useTeaching } from "@/lib/storage";

export default function InsightsOverviewPage() {
  const hydrated = useHydrated();
  const teaching = useTeaching();
  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            Insights <span className="rounded-md bg-sand px-1.5 py-0.5 text-[10px] tracking-normal text-smoke normal-case">Planned</span>
          </span>
        }
        title="Classroom insights"
        description="What your students understood, once Funza records their answers in classes where you turn reporting on. Not built yet."
      />
      <div className="mt-8">
        <InsightsPlan />
      </div>
      {hydrated && teaching.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">Your classes</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {teaching.map((t) => (
              <li key={t.code}>
                <Link href={`/teach/${t.code}/insights`} className="inline-block rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold shadow-card hover:border-[#d3ccbf]">
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
