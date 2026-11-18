import { outcomeLimitations, type FoundOutcome } from "@/lib/curriculum/catalog";

const STATUS_TEXT = {
  verified: { label: "Verified against source", tone: "bg-mint text-mint-dark" },
  "source-checked": { label: "Copied from official source · second check pending", tone: "bg-peach text-peach-dark" },
  unverified: { label: "Not verified", tone: "bg-sand text-smoke" },
} as const;

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

/** The official outcome as the catalog holds it: wording, source, verification status and limitations. */
export function OutcomeCard({ found, compact = false }: { found: FoundOutcome; compact?: boolean }) {
  const { jurisdiction, course, unit, outcome } = found;
  const status = STATUS_TEXT[outcome.status];
  const limitations = outcomeLimitations(found);
  return (
    <section aria-label={`Outcome ${outcome.code}`} className="rounded-2xl border border-line bg-white p-5 shadow-card md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-violet px-2.5 py-1 font-display text-sm font-bold text-white">{outcome.code}</span>
        <span className="text-xs font-bold text-smoke">
          {jurisdiction.name} · {course.name} · {unit.name}
        </span>
      </div>
      <blockquote className={`mt-3 border-l-4 border-violet pl-4 font-display ${compact ? "text-lg" : "text-xl"} leading-snug font-semibold`}>
        “{outcome.statement}”
      </blockquote>
      <p className="mt-1 pl-5 text-xs text-smoke">Official wording, quoted exactly.</p>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold text-smoke">Source</dt>
          <dd>
            {course.source.publisher} ·{" "}
            <a href={course.source.url} target="_blank" rel="noreferrer" className="font-semibold text-sky-dark underline">
              curriculum.gov.sk.ca
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-smoke">Retrieved</dt>
          <dd>
            {formatDate(course.source.retrievedOn)}
            {course.source.versionLabel ? ` · ${course.source.versionLabel}` : " · no version shown on the page"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-smoke">Verification</dt>
          <dd>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.tone}`}>{status.label}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-smoke">Indicators</dt>
          <dd>{outcome.indicatorsStatus === "verified" ? `${outcome.indicators.length} verified` : "Not yet verified, so none are shown"}</dd>
        </div>
        {!compact && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-bold text-smoke">Wording fingerprint</dt>
            <dd className="font-mono text-xs break-all text-smoke">{outcome.fingerprint}</dd>
          </div>
        )}
      </dl>

      {limitations.length > 0 && (
        <div className="mt-4 rounded-2xl border border-peach bg-peach/40 px-4 py-3 text-sm">
          <p className="font-bold text-peach-dark">Know before you rely on it</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
