"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/Button";
import { cardClass, Item, lift, spring, Stagger } from "@/components/motion";
import { inputClass, Pills, SourceChip, StatusBadge, StudioHeader } from "@/components/teacher/StudioUI";
import { drafts, type MaterialType } from "@/lib/teacher/mock";
import { motion } from "framer-motion";

const types = ["All", "Notes", "Quiz", "Flashcards", "Explanation", "Study Guide", "Exam"] as const;
const icon: Record<MaterialType, string> = { Notes: "📝", Quiz: "❓", Flashcards: "🃏", Explanation: "💡", "Study Guide": "📘", Exam: "🧾" };

export default function LibraryPage() {
  const [type, setType] = useState<(typeof types)[number]>("All");
  const [q, setQ] = useState("");
  const shown = drafts.filter((d) => (type === "All" || d.type === type) && d.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <StudioHeader title="Library" subtitle="Everything you've made, by class and type. Reuse it next semester." action={<ButtonLink href="/teacher/generate">+ New material</ButtonLink>} />

      <input className={`${inputClass} mb-4`} placeholder="Search materials…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Pills options={types} value={type} onChange={setType} />

      <Stagger key={type + q} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((d) => (
          <Item key={d.id}>
            <motion.div whileHover={lift} transition={spring} className={`h-full p-5 ${cardClass}`}>
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sand text-xl shadow-edge">{icon[d.type]}</span>
                <StatusBadge status={d.status} />
              </div>
              <p className="mt-3 font-extrabold">{d.title}</p>
              <p className="text-sm text-smoke">{d.type} · {d.className}</p>
              <div className="mt-3 flex items-center justify-between">
                <SourceChip source={d.source} />
                <span className="text-xs text-smoke">{d.updated}</span>
              </div>
            </motion.div>
          </Item>
        ))}
      </Stagger>
      {shown.length === 0 && <p className="mt-10 text-center text-sm text-smoke">No materials match.</p>}
    </div>
  );
}
