"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { InsightsPlan } from "@/components/classes/InsightsPlan";
import { ClassGate, PageHeader } from "@/components/classes/ui";
import { formatDay } from "@/lib/classes/study";
import { useEditableClass } from "@/lib/classes/useEditableClass";

export default function ClassInsightsPage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const { code, load, record } = useEditableClass(rawCode);
  if (load.status !== "ready" || !record) return <ClassGate load={load} code={code} />;
  const published = record.lectures.filter((l) => l.published);

  return (
    <div>
      <nav className="text-sm font-medium text-smoke" aria-label="Breadcrumb">
        <Link href="/teach" className="hover:text-charcoal">
          Dashboard
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/teach/${code}`} className="hover:text-charcoal">
          {record.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-charcoal">Insights</span>
      </nav>
      <div className="mt-4">
        <PageHeader eyebrow="Insights · planned" title={`Insights for ${record.name}`} description="Nothing is reported for this class yet: Funza does not record student answers." />
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-card md:p-6">
        <h2 className="text-lg font-bold">Published lessons</h2>
        <p className="mt-1 text-sm text-smoke">These are the lessons insights would cover. No student results exist for them.</p>
        {published.length === 0 ? (
          <p className="mt-3 text-sm text-smoke">Nothing is published in this class yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {published.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <span className="font-semibold">{l.title}</span>
                  {l.curriculum && <span className="ml-2 rounded-md bg-lavender px-1.5 py-0.5 text-xs font-semibold text-lavender-dark">{l.curriculum.code}</span>}
                </span>
                <span className="text-xs text-smoke">Published {formatDay(l.published!.at)} · student results not collected</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6">
        <InsightsPlan />
      </div>
    </div>
  );
}
