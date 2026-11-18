import { NotBuiltYet } from "@/components/classes/ui";

/** What classroom insights will be, stated as a plan. Shared by the overview and class insights pages. */
export function InsightsPlan() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <NotBuiltYet title="Student results are not collected yet">
        <p>
          Today a student&apos;s answers stay on their own device, and nothing is sent to you or to Funza. Until response capture is built and you
          turn it on for a class, this page will never show student numbers, and it never shows estimates or sample data.
        </p>
      </NotBuiltYet>
      <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
        <p className="text-[11px] font-semibold tracking-wider text-violet uppercase">Planned</p>
        <h2 className="mt-1 text-lg font-bold">What insights will show</h2>
        <ul className="mt-3 space-y-2 text-sm text-smoke">
          <li>· For each published question: how many students answered it and how many were right the first time.</li>
          <li>· Likely misconceptions, counted from wrong options you tagged when you approved the question.</li>
          <li>· Students who may need follow-up, and a way to assign them a practice block you have approved.</li>
        </ul>
        <h3 className="mt-5 text-sm font-semibold text-charcoal">How student data will be protected</h3>
        <ul className="mt-2 space-y-2 text-sm text-smoke">
          <li>· Off by default; you turn reporting on per class, and students are told when they join.</li>
          <li>· Students appear by the roster name you choose; no email, birthdate or password.</li>
          <li>· Nothing identifiable is sent to an AI provider.</li>
        </ul>
        <p className="mt-4 text-xs text-smoke">Design: docs/architecture-evolution/05_classroom_analytics.md</p>
      </section>
    </div>
  );
}
