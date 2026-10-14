"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cardClass, Item, LiftCard, Stagger } from "@/components/motion";

/* ---------- shared pieces ---------- */

/** Hover and keyboard-focus readout for one mark. The value is also reachable in text or the table view. */
function Tip({ children }: { children: ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-charcoal px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white opacity-0 shadow-card transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

function ChartCard({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <figure className={`p-5 md:p-6 ${cardClass}`}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-sm font-extrabold">{title}</h2>
        {aside}
      </figcaption>
      {children}
    </figure>
  );
}

const grow = { type: "spring", stiffness: 180, damping: 26 } as const;

/* ---------- KPI row ---------- */

export type Kpis = {
  completed: number;
  completedLast7: number;
  needsPractice: number;
  firstTryRate: number | null;
  activeDays: number;
};

export function KpiRow({ kpis }: { kpis: Kpis }) {
  const tiles = [
    {
      label: "Concepts completed",
      value: String(kpis.completed),
      delta:
        kpis.completedLast7 > 0
          ? { text: `+${kpis.completedLast7} in the last 7 days`, good: true }
          : { text: "None in the last 7 days", good: false },
    },
    {
      label: "Need more practice",
      value: String(kpis.needsPractice),
      delta: { text: "Answer shown after 3 tries", good: false },
    },
    {
      label: "First-try rate",
      value: kpis.firstTryRate === null ? "–" : `${kpis.firstTryRate}%`,
      delta: { text: "Of completed concepts", good: false },
    },
    {
      label: "Active days",
      value: String(kpis.activeDays),
      delta: { text: "Days with at least one answer", good: false },
    },
  ];
  return (
    <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => (
        <Item key={t.label}>
          <LiftCard className="p-4 md:p-5">
            <p className="text-xs font-bold text-smoke">{t.label}</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight">{t.value}</p>
            <p className={`mt-1 text-xs font-semibold ${t.delta.good ? "text-chart-good" : "text-smoke"}`}>{t.delta.text}</p>
          </LiftCard>
        </Item>
      ))}
    </Stagger>
  );
}

/* ---------- completion by course (stacked bar, part-to-whole) ---------- */

export type CourseStat = { id: string; name: string; total: number; completed: number; needsPractice: number };

const completionSeries = [
  { key: "completed", label: "Completed", swatch: "bg-chart-good" },
  { key: "practice", label: "Needs practice", swatch: "bg-chart-warning" },
  { key: "notStarted", label: "Not started", swatch: "bg-sand" },
] as const;

export function CourseCompletionChart({ courses }: { courses: CourseStat[] }) {
  return (
    <ChartCard
      title="Completion by course"
      aside={
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-smoke" aria-label="Legend">
          {completionSeries.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${s.swatch}`} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      }
    >
      <ul className="mt-5 space-y-4">
        {courses.map((c) => {
          const notStarted = Math.max(0, c.total - c.completed - c.needsPractice);
          const counts = { completed: c.completed, practice: c.needsPractice, notStarted };
          const segments = completionSeries.filter((s) => counts[s.key] > 0);
          const pct = (n: number) => (c.total === 0 ? 0 : (n / c.total) * 100);
          return (
            <li key={c.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-semibold">{c.name}</span>
                <span className="shrink-0 text-xs font-semibold text-smoke">
                  {c.total === 0 ? "No lessons yet" : `${c.completed} of ${c.total} completed`}
                </span>
              </div>
              <div
                className="mt-1.5 flex h-5 w-full gap-0.5 rounded-full shadow-track"
                role="img"
                aria-label={
                  c.total === 0
                    ? `${c.name}: no lessons yet`
                    : `${c.name}: ${c.completed} completed, ${c.needsPractice} need practice, ${notStarted} not started, of ${c.total}`
                }
              >
                {c.total === 0 ? (
                  <div className="h-full w-full rounded-full bg-sand" />
                ) : (
                  segments.map((s, i) => (
                    <motion.div
                      key={s.key}
                      tabIndex={0}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct(counts[s.key])}%` }}
                      transition={{ ...grow, delay: i * 0.08 }}
                      className={`group relative h-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-coral ${s.swatch} ${
                        i === 0 ? "rounded-l-full" : ""
                      } ${i === segments.length - 1 ? "rounded-r-full" : ""}`}
                    >
                      <Tip>
                        <strong>{counts[s.key]}</strong> {s.label.toLowerCase()} · {Math.round(pct(counts[s.key]))}%
                      </Tip>
                    </motion.div>
                  ))
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

/* ---------- concepts completed per day (columns) ---------- */

export type DayStat = { date: string; day: number; month: string; count: number };

function niceMax(max: number) {
  for (const n of [2, 4, 6, 8, 10, 12, 16, 20, 30, 40, 50, 100, 200]) if (n >= max) return n;
  return Math.ceil(max / 100) * 100;
}

export function DailyActivityChart({ days }: { days: DayStat[] }) {
  const max = Math.max(0, ...days.map((d) => d.count));
  const top = niceMax(Math.max(1, max));
  const latestMaxIndex = max === 0 ? -1 : days.map((d) => d.count).lastIndexOf(max);
  const ticks = [0, top / 2, top];

  return (
    <ChartCard title="Concepts completed per day" aside={<span className="text-xs font-semibold text-smoke">Last 14 days</span>}>
      {max === 0 ? (
        <p className="mt-5 rounded-2xl bg-sand px-4 py-6 text-center text-sm text-smoke">
          Complete your first concept to see your daily activity here.
        </p>
      ) : (
        <>
          <div className="relative mt-5 h-40 pl-7">
            {ticks.map((t) => (
              <div key={t} className="absolute right-0 left-7 flex items-center" style={{ bottom: `${(t / top) * 100}%` }}>
                <span className="absolute -left-7 w-6 -translate-y-1/2 text-right text-[11px] font-semibold text-smoke tabular-nums">
                  {t}
                </span>
                <div className="h-px w-full bg-line" />
              </div>
            ))}
            <div className="relative flex h-full items-end gap-1">
              {days.map((d, i) => (
                <div
                  key={d.date}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.day} ${d.month}: ${d.count} completed`}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-coral"
                >
                  {i === latestMaxIndex && <span className="mb-1 text-[11px] font-bold">{d.count}</span>}
                  <motion.div
                    className="w-full max-w-6 rounded-t bg-chart-accent transition-opacity group-hover:opacity-80"
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.count / top) * 100}%` }}
                    transition={{ ...grow, delay: i * 0.03 }}
                  />
                  <Tip>
                    <strong>{d.count}</strong> on {d.day} {d.month}
                  </Tip>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex gap-1 pl-7 text-[11px] font-semibold text-smoke">
            {days.map((d, i) => (
              <div key={d.date} className="flex-1 text-center tabular-nums">
                <div>{d.day}</div>
                {(i === 0 || d.day === 1) && <div className="text-[10px] text-smoke/70">{d.month}</div>}
              </div>
            ))}
          </div>
          <details className="mt-4 text-xs text-smoke">
            <summary className="cursor-pointer font-semibold hover:text-charcoal">Show as table</summary>
            <table className="mt-2 w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase">
                  <th className="py-1 font-bold">Day</th>
                  <th className="py-1 text-right font-bold">Completed</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date} className="border-t border-line">
                    <td className="py-1">
                      {d.day} {d.month}
                    </td>
                    <td className="py-1 text-right tabular-nums">{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </ChartCard>
  );
}
