"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { findOutcome } from "@/lib/curriculum/catalog";
import { useCourseIndex } from "@/lib/curriculum/client";
import { knownOutcomes } from "@/lib/curriculum/sources";
import { useLms } from "@/lib/lms/useLms";
import { KINDS, kindInfo } from "@/lib/resources/kinds";
import { formatWhen, startBrief, useWorkspace } from "@/lib/resources/store";
import type { ResourceKind } from "@/lib/resources/types";
import { ArrowRight, CompassIcon, ExternalIcon, LibraryIcon, PlugIcon, UploadIcon } from "./icons";
import { Codes, DocThumb, KindIcon, Menu, MenuItem, Orbit, ResourceState, summarize } from "./parts";
import { Loading, TopBar } from "./shell";
import { Card, cx, Eyebrow, LinkButton, markOf, Pill, VerificationBadge } from "./ui";

const QUICK: { kind: ResourceKind; label: string; sub: string }[] = [
  { kind: "notes", label: "Notes", sub: "Teaching notes" },
  { kind: "quiz", label: "Quiz", sub: "10–25 marks" },
  { kind: "exam", label: "Exam", sub: "With marking guide" },
  { kind: "lesson-plan", label: "Lesson plan", sub: "Timed phases" },
  { kind: "worksheet", label: "Worksheet", sub: "Practice + key" },
];

export function HomeScreen() {
  const ws = useWorkspace();
  const router = useRouter();
  const lms = useLms();
  const index = useCourseIndex();
  const [picked, setOutcome] = useState<string | null>(null);
  if (!ws.hydrated) return <Loading />;

  const drafts = ws.resources.filter((r) => ws.drafts[r.id]?.status === "draft");
  const byRecent = [...ws.resources].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const current = byRecent.find((r) => ws.drafts[r.id]?.status === "draft");
  const waiting = drafts.filter((r) => r.id !== current?.id);
  const recentOutcomes = [...new Set(byRecent.flatMap((r) => r.outcomeIds))].slice(0, 3);
  const outcome = picked ?? ws.brief.outcomeIds[0] ?? recentOutcomes[0] ?? "sk-sci10-fm2";
  // The outcome being used, those used recently, then the rest this browser knows (hand-copied first).
  const choices = [...new Set([outcome, ...recentOutcomes, ...knownOutcomes().map((f) => f.outcome.id)])].map((id) => findOutcome(id)).filter((f) => f !== null).slice(0, 14);
  const create = (kind: ResourceKind) => {
    startBrief(kind, [outcome]);
    router.push("/create");
  };

  return (
    <>
      <TopBar>
        <p className="text-[13px] text-(--muted)">Home</p>
      </TopBar>

      <div className="mx-auto max-w-[1180px] px-4 py-7 md:px-6 lg:px-8 lg:py-9">
        <header>
          <h1 className="text-[28px] leading-tight font-bold md:text-[32px]">{ws.resources.length === 0 ? "Welcome to Funza" : "Welcome back"}</h1>
          <p className="mt-1.5 text-[15px] text-(--ink-2)">
            {ws.resources.length === 0
              ? "Pick an official outcome, say what you need, review what Funza drafts, then post it to your class."
              : drafts.length === 0
                ? "Everything you made is approved. Make something new below."
                : `${drafts.length} draft${drafts.length === 1 ? "" : "s"} waiting for your review.`}
          </p>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Card aria-labelledby="create-h" className="relative overflow-hidden p-5 md:p-6">
              <Orbit className="pointer-events-none absolute -top-12 -right-20 hidden h-[130px] w-[280px] opacity-60 md:block" />
              <div className="relative">
                <h2 id="create-h" className="text-[18px] font-bold">
                  What do you want to make?
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13.5px] text-(--ink-2)">
                  <label htmlFor="home-outcome">For</label>
                  <select
                    id="home-outcome"
                    value={outcome}
                    onChange={(e) => (e.target.value === "__browse" ? router.push("/curriculum") : setOutcome(e.target.value))}
                    className="h-8 max-w-full rounded-(--r-sm) border border-(--teal-200) bg-(--teal-50) px-2 text-[13px] font-semibold text-(--teal-900) outline-none focus:border-(--teal-700)"
                  >
                    {choices.map(({ outcome: o, course }) => (
                      <option key={o.id} value={o.id}>
                        {course.name} · {o.code}
                      </option>
                    ))}
                    <option value="__browse">Browse the curriculum…</option>
                  </select>
                  <span className="hidden text-(--muted) sm:inline">— {findOutcome(outcome)?.outcome.statement}</span>
                </div>

                <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
                  {QUICK.map((q) => (
                    <li key={q.kind}>
                      <button
                        type="button"
                        onClick={() => create(q.kind)}
                        className="group flex h-full w-full flex-col items-start rounded-(--r-md) border border-(--line) bg-(--surface) p-3 text-left shadow-(--sh-1) transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-(--teal-200) hover:shadow-(--sh-2)"
                      >
                        <KindIcon kind={q.kind} />
                        <span className="mt-2.5 text-[14px] font-semibold">{q.label}</span>
                        <span className="text-[12px] text-(--muted)">{q.sub}</span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <Menu
                      label="More resource types"
                      align="right"
                      triggerClass="flex h-full min-h-[104px] w-full flex-col items-start rounded-(--r-md) border border-dashed border-(--line-strong) bg-(--surface-2) p-3 text-left hover:border-(--teal-200) hover:bg-(--surface)"
                      trigger={
                        <>
                          <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-(--bg-sunk) text-lg font-semibold text-(--muted)" aria-hidden="true">
                            +
                          </span>
                          <span className="mt-2.5 text-[14px] font-semibold">More</span>
                          <span className="text-[12px] text-(--muted)">Test, slides, graph…</span>
                        </>
                      }
                    >
                      {(close) =>
                        KINDS.filter((k) => !QUICK.some((q) => q.kind === k.kind)).map((k) => (
                          <MenuItem
                            key={k.kind}
                            onSelect={() => {
                              close();
                              create(k.kind);
                            }}
                          >
                            <KindIcon kind={k.kind} size="sm" />
                            {k.label}
                          </MenuItem>
                        ))
                      }
                    </Menu>
                  </li>
                </ul>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-(--line) pt-3.5 text-[13px]">
                  <Link href="/create?from=file" className="inline-flex items-center gap-1.5 font-semibold text-(--teal-700) hover:underline">
                    <UploadIcon className="h-4 w-4" />
                    Start from a file you already have
                  </Link>
                  {ws.resources.length > 0 && (
                    <Link href="/library?reuse=1" className="inline-flex items-center gap-1.5 font-semibold text-(--teal-700) hover:underline">
                      <LibraryIcon className="h-4 w-4" />
                      Reuse a resource
                    </Link>
                  )}
                  <Link href="/curriculum" className="inline-flex items-center gap-1.5 font-semibold text-(--teal-700) hover:underline">
                    <CompassIcon className="h-4 w-4" />
                    Browse outcomes
                  </Link>
                </div>
              </div>
            </Card>

            {current && ws.drafts[current.id] && (
              <section aria-labelledby="continue-h">
                <Eyebrow>Pick up where you left off</Eyebrow>
                <Card className="mt-2 flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
                  <DocThumb draft={ws.drafts[current.id]} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="none">{kindInfo(current.kind).label}</Pill>
                      <span className="text-[12.5px] text-(--muted)">Edited {formatWhen(current.updatedAt)}</span>
                    </div>
                    <h2 id="continue-h" className="mt-1.5 text-[19px] leading-snug font-bold">
                      {current.title}
                    </h2>
                    <p className="mt-0.5 text-[13px] text-(--muted)">
                      {current.courseName} · <Codes ids={current.outcomeIds} />
                    </p>
                    <Progress id={current.id} />
                  </div>
                  <LinkButton href={`/resources/${current.id}`} variant="primary" className="self-start sm:self-center">
                    Continue reviewing
                    <ArrowRight className="h-4 w-4" />
                  </LinkButton>
                </Card>
              </section>
            )}

            {waiting.length > 0 && (
              <section aria-labelledby="waiting-h">
                <h2 id="waiting-h" className="text-[16px] font-bold">
                  Also waiting for review
                </h2>
                <ul className="mt-2 divide-y divide-(--line) overflow-hidden rounded-(--r-lg) border border-(--line) bg-(--surface) shadow-(--sh-1)">
                  {waiting.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                      <KindIcon kind={r.kind} />
                      <div className="min-w-0 flex-[1_1_14rem]">
                        <p className="truncate font-semibold">{r.title}</p>
                        <p className="text-[12.5px] text-(--muted)">
                          <Codes ids={r.outcomeIds} /> · {formatWhen(r.updatedAt)}
                        </p>
                      </div>
                      {ws.drafts[r.id] && <ResourceState draft={ws.drafts[r.id]} />}
                      <LinkButton href={`/resources/${r.id}`} size="sm">
                        Review
                      </LinkButton>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {byRecent.length > 0 ? (
              <section aria-labelledby="recent-h">
                <div className="flex items-baseline justify-between">
                  <h2 id="recent-h" className="text-[16px] font-bold">
                    Recently edited
                  </h2>
                  <Link href="/library" className="text-[13px] font-semibold text-(--teal-700) hover:underline">
                    Open library
                  </Link>
                </div>
                <div className="mt-2 overflow-x-auto rounded-(--r-lg) border border-(--line) bg-(--surface) shadow-(--sh-1)">
                  <table className="w-full min-w-[620px] text-left text-[13.5px]">
                    <thead className="bg-(--surface-2) text-[11.5px] font-semibold tracking-wide text-(--muted) uppercase">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 font-semibold">
                          Resource
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-semibold">
                          Outcomes
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-semibold">
                          Status
                        </th>
                        <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                          Edited
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-(--line)">
                      {byRecent.slice(0, 6).map((r) => (
                        <tr key={r.id} className="hover:bg-(--surface-2)">
                          <td className="px-4 py-2.5">
                            <Link href={`/resources/${r.id}`} className="flex items-center gap-2.5 font-semibold hover:underline">
                              <KindIcon kind={r.kind} size="sm" />
                              {r.title}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-[12.5px]">
                            <Codes ids={r.outcomeIds} />
                          </td>
                          <td className="px-3 py-2.5">{ws.drafts[r.id] && <ResourceState draft={ws.drafts[r.id]} compact />}</td>
                          <td className="px-4 py-2.5 text-right text-[12.5px] whitespace-nowrap text-(--muted)">{formatWhen(r.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section aria-label="How Funza works" className="grid gap-3 sm:grid-cols-3">
                {[
                  ["1", "Pick an outcome", "Official Saskatchewan wording, with its verification status."],
                  ["2", "Review the draft", "Funza recalculates answers and marks what needs your judgment."],
                  ["3", "Post to your class", "Approved versions go to Google Classroom as drafts you release."],
                ].map(([n, t, d]) => (
                  <Card key={n} className="p-4">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--navy-900) text-[12px] font-bold text-white">{n}</span>
                    <p className="mt-2.5 text-[14.5px] font-bold">{t}</p>
                    <p className="mt-1 text-[13px] text-(--muted)">{d}</p>
                  </Card>
                ))}
              </section>
            )}
          </div>

          <aside className="space-y-5" aria-label="Context">
            {recentOutcomes.length > 0 && (
              <Card className="p-5" aria-labelledby="outcomes-h">
                <h2 id="outcomes-h" className="text-[15px] font-bold">
                  Outcomes you used recently
                </h2>
                <ul className="mt-3 space-y-3">
                  {recentOutcomes.map((id) => {
                    const o = findOutcome(id)?.outcome;
                    if (!o) return null;
                    return (
                      <li key={id} className="rounded-(--r-md) border border-(--line) p-3">
                        <span className="text-[13.5px] font-bold">{o.code}</span>
                        <p className="mt-1 line-clamp-2 text-[12.5px] text-(--ink-2)">{o.statement}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <VerificationBadge mark={markOf(o.status)} compact />
                          <button
                            type="button"
                            onClick={() => {
                              startBrief(ws.brief.kind, [o.id]);
                              router.push("/create");
                            }}
                            className="text-[12.5px] font-semibold text-(--teal-700) hover:underline"
                          >
                            Create from this
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            <Card className="p-5" aria-labelledby="deliver-h">
              <div className="flex items-center gap-2">
                <PlugIcon className="h-4 w-4 text-(--muted)" />
                <h2 id="deliver-h" className="text-[15px] font-bold">
                  Where your students get it
                </h2>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 rounded-(--r-md) bg-(--surface-2) px-3 py-2.5">
                <span className="text-[13.5px] font-semibold">Google Classroom</span>
                <span className={cx("inline-flex items-center gap-1.5 text-[12px] font-semibold", lms?.connected ? "text-(--ok)" : "text-(--muted)")}>
                  <span className={cx("h-2 w-2 rounded-full", lms?.connected ? "bg-(--ok)" : "bg-(--line-strong)")} aria-hidden="true" />
                  {lms === null ? "Checking…" : lms.connected ? "Connected" : lms.configured ? "Not connected" : "Not set up on this server"}
                </span>
              </div>
              <p className="mt-2.5 text-[12.5px] text-(--muted)">Everything you publish goes to your school&apos;s platform. Teams, Canvas and Moodle are planned.</p>
              <LinkButton href="/integrations" size="sm" className="mt-3 w-full">
                Manage connections
              </LinkButton>
            </Card>

            <Card className="p-5" aria-labelledby="catalog-h">
              <h2 id="catalog-h" className="text-[15px] font-bold">
                What Funza covers today
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-(--ink-2)">
                {index.status === "ready"
                  ? `${index.courses.filter((c) => c.outcomes > 0).length} Saskatchewan Grade 10–12 courses, ${index.courses.reduce((n, c) => n + c.outcomes, 0).toLocaleString("en-CA")} outcomes and ${index.courses.reduce((n, c) => n + c.indicators, 0).toLocaleString("en-CA")} indicators, copied word for word from curriculum.gov.sk.ca on ${index.importedOn}. Copied automatically: no person has checked them yet, and each one says so.`
                  : "Saskatchewan Grade 10–12 courses, copied word for word from curriculum.gov.sk.ca."}
              </p>
              <a href="https://curriculum.gov.sk.ca/" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-(--teal-700) hover:underline">
                curriculum.gov.sk.ca <ExternalIcon className="h-3.5 w-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}

function Progress({ id }: { id: string }) {
  const ws = useWorkspace();
  const d = ws.drafts[id];
  if (!d) return null;
  const sum = summarize(d);
  const pct = sum.total === 0 ? 0 : Math.round((sum.reviewed / sum.total) * 100);
  return (
    <div className="mt-3">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
        <span className="font-semibold">
          {sum.reviewed} of {sum.total} parts reviewed
        </span>
        {sum.counts.failed > 0 && <span className="font-semibold text-(--bad)">· {sum.counts.failed} check failed</span>}
      </p>
      <div className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-(--bg-sunk)" role="progressbar" aria-valuemin={0} aria-valuemax={sum.total} aria-valuenow={sum.reviewed} aria-label="Parts reviewed">
        <div className="h-full rounded-full bg-(--teal-700)" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
