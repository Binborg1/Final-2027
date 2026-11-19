"use client";

import { motion } from "framer-motion";
import { ButtonLink } from "@/components/Button";
import { cardClass, Item, Stagger } from "@/components/motion";
import { StudioHeader } from "@/components/teacher/StudioUI";
import { weakTopics } from "@/lib/teacher/mock";

const stats = [
  { label: "Active students", value: "83", bg: "bg-mint text-mint-dark" },
  { label: "Avg. quiz score", value: "71%", bg: "bg-sky text-sky-dark" },
  { label: "Materials published", value: "24", bg: "bg-lavender text-lavender-dark" },
  { label: "Hours saved this month", value: "11", bg: "bg-peach text-peach-dark" },
];

export default function InsightsPage() {
  return (
    <div>
      <StudioHeader title="Class Insights" subtitle="See where students struggle, then create targeted practice in one click." />

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Item key={s.label} className={`p-5 ${cardClass}`}>
            <span className={`inline-block rounded-2xl px-3 py-1 text-2xl font-extrabold ${s.bg}`}>{s.value}</span>
            <p className="mt-2 text-sm font-bold text-smoke">{s.label}</p>
          </Item>
        ))}
      </Stagger>

      <section className={`mt-8 p-6 ${cardClass}`}>
        <h2 className="text-lg font-extrabold">Topics that need attention</h2>
        <p className="text-sm text-smoke">Based on quiz results from published materials.</p>
        <ul className="mt-5 space-y-4">
          {weakTopics.map((t, i) => (
            <li key={t.topic} className="flex flex-wrap items-center gap-4">
              <div className="w-56 min-w-0">
                <p className="truncate font-bold">{t.topic}</p>
                <p className="text-xs text-smoke">{t.className}</p>
              </div>
              <div className="h-3 min-w-32 flex-1 overflow-hidden rounded-full bg-sand shadow-track">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${t.score}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                  className={`h-full rounded-full ${t.score < 60 ? "bg-chart-warning" : t.score < 70 ? "bg-coral" : "bg-chart-good"}`}
                />
              </div>
              <span className="w-10 text-right text-sm font-extrabold">{t.score}%</span>
              <ButtonLink href="/teacher/generate?type=Quiz" variant="secondary" className="px-3 py-1.5 text-xs">
                ✨ Make practice
              </ButtonLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
