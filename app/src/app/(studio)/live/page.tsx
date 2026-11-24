import { ChartColumn, Radio } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CountPill } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Misc";
import { requireTeacher } from "@/lib/auth/teacher";

export const metadata: Metadata = { title: "Live sessions" };

const STATE_LABEL: Record<string, string> = { lobby: "Lobby", open: "Answering", closed: "Marking", revealed: "Revealed", ended: "Ended" };
const countOf = (v: unknown) => (Array.isArray(v) && v[0] && typeof v[0] === "object" && "count" in v[0] ? Number(v[0].count) || 0 : 0);

/** Every live session: open ones first (with their console), then past ones and their results. */
export default async function LiveSessionsPage() {
  const { supabase } = await requireTeacher({ next: "/live" });
  const { data, error } = await supabase
    .from("live_sessions")
    .select("id, title, code, state, created_at, courses(title), participants(count), live_questions(count)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not read live sessions: ${error.message}`);
  const open = data.filter((s) => s.state !== "ended");
  const past = data.filter((s) => s.state === "ended");
  const when = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { weekday: "short", day: "numeric", month: "short" });

  const row = (s: (typeof data)[number], href: string, action: string) => (
    <li key={s.id}>
      <Link href={href} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-row px-3 py-3 hover:bg-white/60">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-row font-semibold">{s.title}</span>
          <span className="block text-meta text-ink-2">
            {when(s.created_at)} · {(s.courses as { title: string } | null)?.title ?? "Course"} · {countOf(s.live_questions)} questions · {countOf(s.participants)} students
          </span>
        </span>
        <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-meta font-semibold">{STATE_LABEL[s.state] ?? s.state}</span>
        <span className="text-body font-semibold text-accent-ink">{action}</span>
      </Link>
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Live sessions" summary="Quizzes run in class. Student names and answers are deleted 30 days after a session." actions={<ButtonLink href="/live/new" icon={Radio}>Go live</ButtonLink>} />
      {data.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={ChartColumn} title="No live sessions yet" action={<ButtonLink href="/live/new">Go live</ButtonLink>}>
            Run a quiz in class: students join on their phones with a code, no accounts.
          </EmptyState>
        </Card>
      ) : null}
      {open.length ? (
        <Card className="flex flex-col gap-2 px-5 pt-5 pb-3" aria-labelledby="open-title">
          <CardHeader id="open-title" title="Open now" after={<CountPill>{open.length}</CountPill>} />
          <ul className="flex flex-col divide-y divide-line">{open.map((s) => row(s, `/live/${s.id}`, `Open console · ${s.code}`))}</ul>
        </Card>
      ) : null}
      {past.length ? (
        <Card className="flex flex-col gap-2 px-5 pt-5 pb-3" aria-labelledby="past-title">
          <CardHeader id="past-title" title="Past sessions" after={<CountPill>{past.length}</CountPill>} />
          <ul className="flex flex-col divide-y divide-line">{past.map((s) => row(s, `/live/${s.id}/results`, "Results"))}</ul>
        </Card>
      ) : null}
    </div>
  );
}
