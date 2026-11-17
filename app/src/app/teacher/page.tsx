"use client";

import { ButtonLink } from "@/components/Button";
import { cardClass, Item, lift, MotionLink, press, spring, Stagger } from "@/components/motion";
import { StatusBadge, StudioHeader } from "@/components/teacher/StudioUI";
import { classes, comingSoon, drafts } from "@/lib/teacher/mock";

const accent: Record<string, string> = {
  mint: "bg-mint text-mint-dark",
  sky: "bg-sky text-sky-dark",
  lavender: "bg-lavender text-lavender-dark",
};

const actions = [
  { href: "/teacher/notes", title: "Make notes", text: "Upload your documents and get notes in your own teaching style.", icon: "📝", bg: "bg-peach" },
  { href: "/teacher/generate", title: "Generate practice", text: "Quizzes, flashcards, explanations and study guides.", icon: "✨", bg: "bg-sky" },
  { href: "/teacher/exam", title: "Prepare an exam", text: "Blueprint, versions A/B and an answer key.", icon: "🧾", bg: "bg-lavender" },
  { href: "/teacher/review", title: "Review & publish", text: "Nothing reaches students until you approve it.", icon: "✅", bg: "bg-mint" },
];

export default function TeacherDashboard() {
  const pending = drafts.filter((d) => d.status === "draft" || d.status === "review").length;
  return (
    <div>
      <StudioHeader
        title="Good morning, Ms. Rivera"
        subtitle="Create, review and publish materials for your classes."
        action={<ButtonLink href="/teacher/review">{pending} items to review</ButtonLink>}
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => (
          <Item key={a.href}>
            <MotionLink href={a.href} whileHover={lift} whileTap={press} transition={spring} className={`block h-full p-5 ${cardClass}`}>
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl shadow-edge ${a.bg}`} aria-hidden="true">
                {a.icon}
              </span>
              <p className="mt-4 font-extrabold">{a.title}</p>
              <p className="mt-1 text-sm text-smoke">{a.text}</p>
            </MotionLink>
          </Item>
        ))}
      </Stagger>

      <section className="mt-10">
        <h2 className="text-lg font-extrabold">My classes</h2>
        <Stagger className="mt-4 grid gap-4 sm:grid-cols-3">
          {classes.map((c) => (
            <Item key={c.id}>
              <MotionLink href="/teacher/library" whileHover={lift} whileTap={press} transition={spring} className={`block p-5 ${cardClass}`}>
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-extrabold shadow-edge ${accent[c.accent]}`}>
                  {c.name.split(" ").slice(-1)[0].charAt(0)}
                </span>
                <p className="mt-3 font-extrabold">{c.name}</p>
                <p className="mt-1 text-sm text-smoke">
                  {c.students} students · {c.units} units
                </p>
              </MotionLink>
            </Item>
          ))}
        </Stagger>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Recent activity</h2>
          <ButtonLink href="/teacher/review" variant="ghost" className="px-3 py-1.5">
            See all →
          </ButtonLink>
        </div>
        <div className={`mt-4 divide-y divide-line ${cardClass}`}>
          {drafts.slice(0, 4).map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
              <div>
                <p className="font-bold">{d.title}</p>
                <p className="text-xs text-smoke">
                  {d.type} · {d.className} · {d.updated}
                </p>
              </div>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-extrabold">Coming soon</h2>
        <p className="mt-1 text-sm text-smoke">More tools planned for high school teachers.</p>
        <Stagger className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {comingSoon.map((f) => (
            <Item key={f.title} className="rounded-3xl border border-dashed border-line bg-white/60 p-4">
              <div className="flex items-center justify-between">
                <p className="font-extrabold">{f.title}</p>
                <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold uppercase text-smoke">Soon</span>
              </div>
              <p className="mt-1 text-sm text-smoke">{f.text}</p>
            </Item>
          ))}
        </Stagger>
      </section>
    </div>
  );
}
