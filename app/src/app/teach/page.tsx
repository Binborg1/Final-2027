"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { ClassCode, fieldClass, LectureStateChip, PageHeader } from "@/components/classes/ui";
import { Item, LiftCard, Rise, Stagger } from "@/components/motion";
import { Spinner } from "@/components/Spinner";
import { classApi, rememberTeaching } from "@/lib/classes/client";
import { useTeachingOverview } from "@/lib/classes/useTeachingOverview";
import { CATALOG } from "@/lib/curriculum/catalog";

/** Outcomes a teacher can build a lesson for today, straight from the catalog. */
const templated = CATALOG.flatMap((j) =>
  j.courses.flatMap((c) => c.units.flatMap((u) => u.outcomes.filter((o) => o.lessonTemplate).map((o) => ({ o, c, u, j })))),
);

export default function TeachDashboard() {
  const router = useRouter();
  const { hydrated, classes, lessons, allLoaded } = useTeachingOverview();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [term, setTerm] = useState("");
  const [professor, setProfessor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim() || !professor.trim()) {
      setError("Add the class name and the name students know you by.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await classApi.create({ name, term, professor });
    if (!res.ok) {
      setBusy(false);
      setError(res.message);
      return;
    }
    rememberTeaching(res.data.record.code, res.data.editKey, res.data.record.name);
    router.push(`/teach/${res.data.record.code}`);
  }

  const waiting = lessons.filter((l) => l.waiting > 0);
  const stat = (n: number) => (allLoaded ? String(n) : "…");

  return (
    <div>
      <PageHeader
        eyebrow="Teach"
        title="Dashboard"
        description="Your classes, the lessons waiting for your review, and where to start a new curriculum-aligned lesson."
        actions={
          <>
            <ButtonLink href="/teach/curriculum" variant="secondary">
              Curriculum explorer
            </ButtonLink>
            {!creating && <Button onClick={() => setCreating(true)}>New class</Button>}
          </>
        }
      />

      {creating && (
        <Rise>
          <form onSubmit={onCreate} className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-card md:p-7">
            <h2 className="text-lg font-bold">New class</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block text-sm">
                <span className="font-semibold text-charcoal">Class name</span>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Science 10, period 2" maxLength={80} className={fieldClass} />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-charcoal">Term</span>
                <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Winter 2027" maxLength={40} className={fieldClass} />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-charcoal">Your name, as students see it</span>
                <input value={professor} onChange={(e) => setProfessor(e.target.value)} placeholder="Ms. Sample" maxLength={80} className={fieldClass} />
              </label>
            </div>
            <p className="mt-3 text-xs text-smoke">
              No accounts yet: this browser keeps the key that lets you edit the class. You can copy a private edit link from the class page.
            </p>
            {error && <p className="mt-3 text-sm font-semibold text-coral-dark">{error}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={busy}>
                {busy && <Spinner />}
                {busy ? "Creating class" : "Create class"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        </Rise>
      )}

      {hydrated && classes.length > 0 && (
        <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Classes" value={String(classes.length)} />
          <Stat label="Lessons" value={stat(lessons.length)} />
          <Stat label="Waiting for review" value={stat(waiting.length)} hint="lessons with blocks or concepts to review" tone={waiting.length > 0 ? "violet" : undefined} />
          <Stat label="Published" value={stat(lessons.filter((l) => l.lecture.published).length)} />
        </dl>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <section aria-label="Needs your review">
            <SectionTitle title="Needs your review" />
            {!hydrated ? null : classes.length === 0 ? (
              <Empty>Create a class to start. Its lessons appear here while they wait for your review.</Empty>
            ) : !allLoaded ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-smoke">
                <Spinner className="h-3 w-3" /> Loading your classes...
              </p>
            ) : waiting.length === 0 ? (
              <Empty>Nothing is waiting. Every lesson block and concept has been reviewed.</Empty>
            ) : (
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                {waiting.map((l) => (
                  <li key={`${l.classCode}-${l.lecture.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{l.lecture.title}</p>
                      <p className="mt-0.5 text-xs text-smoke">
                        {l.className}
                        {l.lecture.curriculum ? ` · ${l.lecture.curriculum.code}` : " · from a PDF"}
                      </p>
                    </div>
                    <span className="rounded-full bg-lavender px-2.5 py-0.5 text-xs font-semibold text-lavender-dark">
                      {l.waiting} {l.curriculum ? "block" : "concept"}
                      {l.waiting === 1 ? "" : "s"} to review
                    </span>
                    <ButtonLink href={`/teach/${l.classCode}/lectures/${l.lecture.id}`} className="px-3.5 py-2 text-xs">
                      Review
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Your classes">
            <SectionTitle title="Classes" />
            {hydrated && classes.length === 0 && <Empty>No classes yet.</Empty>}
            <Stagger className="mt-3 grid gap-4 sm:grid-cols-2">
              {classes.map((c) => {
                const own = lessons.filter((l) => l.classCode === c.entry.code);
                return (
                  <Item key={c.entry.code}>
                    <Link href={`/teach/${c.entry.code}`} className="block h-full rounded-2xl focus-visible:ring-4 focus-visible:ring-coral/20 focus-visible:outline-none">
                      <LiftCard className="h-full p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-bold">{c.entry.name}</h3>
                          <ClassCode code={c.entry.code} size="sm" />
                        </div>
                        {c.status === "loading" && <p className="mt-3 text-xs text-smoke">Loading...</p>}
                        {c.status === "error" && <p className="mt-3 text-xs font-semibold text-coral-dark">{c.message}</p>}
                        {c.status === "ready" && (
                          <div className="mt-4 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-sand px-2.5 py-0.5 font-semibold text-smoke">{own.length} lesson{own.length === 1 ? "" : "s"}</span>
                            {own.some((l) => l.state !== "draft") && (
                              <LectureStateChip state="published" pending={0} />
                            )}
                            {own.some((l) => l.waiting > 0) && (
                              <span className="rounded-full bg-lavender px-2.5 py-0.5 font-semibold text-lavender-dark">Review waiting</span>
                            )}
                          </div>
                        )}
                      </LiftCard>
                    </Link>
                  </Item>
                );
              })}
            </Stagger>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <p className="text-xs font-semibold tracking-wider text-violet uppercase">Curriculum</p>
            <h2 className="mt-1 text-lg font-bold">Start from an official outcome</h2>
            <p className="mt-1 text-sm text-smoke">Lessons are available for:</p>
            <ul className="mt-3 space-y-2">
              {templated.map(({ o, c, u, j }) => (
                <li key={o.id} className="rounded-xl bg-cream px-3 py-2.5 text-sm">
                  <span className="font-semibold">{o.code}</span>
                  <span className="block text-xs text-smoke">
                    {j.name} · {c.name} · {u.name}
                  </span>
                </li>
              ))}
            </ul>
            <ButtonLink href="/teach/curriculum" className="mt-4 w-full">
              Open the curriculum explorer
            </ButtonLink>
          </section>
          <section className="rounded-2xl border border-dashed border-[#cfc7b8] bg-white/70 p-5">
            <p className="inline-flex rounded-md bg-sand px-2 py-0.5 text-[11px] font-semibold tracking-wide text-smoke uppercase">Planned · not built yet</p>
            <h2 className="mt-2 font-bold">Classroom insights</h2>
            <p className="mt-1 text-sm text-smoke">
              Funza does not record student answers yet, so there is nothing to report. See what is planned and how it will protect student data.
            </p>
            <Link href="/teach/insights" className="mt-3 inline-block text-sm font-semibold text-violet hover:underline">
              About insights
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "violet" }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5 shadow-card">
      <dt className="text-xs font-medium text-smoke">{label}</dt>
      <dd className={`mt-1 font-display text-2xl font-bold ${tone === "violet" ? "text-violet" : ""}`}>{value}</dd>
      {hint && <p className="mt-0.5 text-[11px] text-smoke">{hint}</p>}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-lg font-bold">{title}</h2>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-2xl border border-dashed border-line bg-white/60 px-5 py-6 text-sm text-smoke">{children}</p>;
}
