"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/Button";
import { cardClass, spring } from "@/components/motion";
import { AiBadge, Pills, SourceChip, StatusBadge, StudioHeader } from "@/components/teacher/StudioUI";
import { drafts as initial, quiz, type Draft, type Status } from "@/lib/teacher/mock";

const filters = ["All", "Draft", "In review", "Approved", "Published"] as const;
const filterStatus: Record<(typeof filters)[number], Status | null> = {
  All: null, Draft: "draft", "In review": "review", Approved: "approved", Published: "published",
};

export default function ReviewPage() {
  const [items, setItems] = useState<Draft[]>(initial);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [openId, setOpenId] = useState<string | null>(initial[0].id);
  const [toast, setToast] = useState<string | null>(null);

  const shown = items.filter((d) => !filterStatus[filter] || d.status === filterStatus[filter]);
  const open = items.find((d) => d.id === openId);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };
  const update = (id: string, status: Status | "rejected") => {
    setItems((all) => (status === "rejected" ? all.filter((d) => d.id !== id) : all.map((d) => (d.id === id ? { ...d, status } : d))));
    if (status === "rejected") setOpenId(null);
    notify(status === "published" ? "Published to students 🎉" : status === "approved" ? "Approved ✓" : status === "rejected" ? "Rejected and removed" : "Moved to review");
  };
  const publishAll = () => {
    setItems((all) => all.map((d) => (d.status === "approved" ? { ...d, status: "published" } : d)));
    notify("All approved items published 🎉");
  };

  return (
    <div>
      <StudioHeader
        title="Review & Publish"
        subtitle="Students only see material you have approved and published."
        action={<Button onClick={publishAll}>Publish all approved</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold text-smoke">
        {(["draft", "review", "approved", "published"] as Status[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <StatusBadge status={s} /> {i < 3 && "→"}
          </span>
        ))}
      </div>
      <Pills options={filters} value={filter} onChange={setFilter} />

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <motion.ul layout className={`divide-y divide-line self-start overflow-hidden ${cardClass}`}>
          <AnimatePresence initial={false}>
            {shown.map((d) => (
              <motion.li key={d.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }}>
                <button
                  type="button"
                  onClick={() => setOpenId(d.id)}
                  className={`flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left transition-colors ${openId === d.id ? "bg-peach/50" : "hover:bg-sand"}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold">{d.title}</p>
                    <p className="text-xs text-smoke">{d.type} · {d.className}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
          {shown.length === 0 && <li className="px-5 py-10 text-center text-sm text-smoke">Nothing here 🎉</li>}
        </motion.ul>
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key={open.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={spring} className={`p-6 ${cardClass}`}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={open.status} />
                <SourceChip source={open.source} />
              </div>
              <h2 className="mt-3 text-2xl font-extrabold">{open.title}</h2>
              <p className="text-sm text-smoke">{open.type} · {open.items} item(s) · {open.className}</p>

              <div className="mt-5 space-y-3">
                {quiz.map((q) => (
                  <div key={q.q} className="rounded-2xl border border-line p-4 text-sm">
                    <p className="font-bold">{q.q}</p>
                    <p className="mt-1 text-mint-dark">✓ {q.options[q.answer]}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <SourceChip source={q.source} />
                      <button type="button" className="text-xs font-bold text-smoke hover:text-charcoal">✎ Edit</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-sand p-3 text-xs text-smoke">
                <b>Audit trail:</b> AI drafted ({open.updated}) → edited by Ms. Rivera{open.status !== "draft" && " → sent to review"}
                {(open.status === "approved" || open.status === "published") && " → approved"}
                {open.status === "published" && " → published"}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                <AiBadge />
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => update(open.id, "rejected")}>Reject</Button>
                  {open.status === "draft" && <Button variant="secondary" onClick={() => update(open.id, "review")}>Send to review</Button>}
                  {(open.status === "draft" || open.status === "review") && <Button onClick={() => update(open.id, "approved")}>Approve</Button>}
                  {open.status === "approved" && <Button onClick={() => update(open.id, "published")}>Publish to students</Button>}
                  {open.status === "published" && <span className="rounded-full bg-mint px-3 py-2 text-sm font-bold text-mint-dark">Live for students</span>}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex items-center justify-center p-10 text-sm text-smoke ${cardClass}`}>
              Select an item to review
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={spring}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-charcoal px-5 py-2.5 text-sm font-bold text-white shadow-lift"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
