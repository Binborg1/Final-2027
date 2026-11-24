import { Radio } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Misc";
import { requireTeacher } from "@/lib/auth/teacher";
import { liveSetupData } from "@/lib/live/setup-data";
import { LiveSetup } from "./LiveSetup";

export const metadata: Metadata = { title: "Go live" };

/**
 * L1 Live setup (Figma "F · Live screens"): choose where the questions come from,
 * keep the ones you want, set one timer for the whole set, and open the lobby.
 */
export default async function GoLivePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireTeacher({ next: "/live/new" });
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const data = await liveSetupData({ course: one("course"), chapter: one("chapter"), quiz: one("quiz") });

  if (!data || data.courses.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Go live" summary="Run a quiz in class: students answer on their phones, no accounts." />
        <Card className="p-6">
          <EmptyState icon={Radio} title="Add a course first" action={<ButtonLink href="/courses?add=1">Add a course</ButtonLink>}>
            Live questions come from a course&rsquo;s chapters, its question bank and its saved quizzes.
          </EmptyState>
        </Card>
      </div>
    );
  }
  return <LiveSetup key={`${data.course?.id}-${data.chapter?.id}-${data.quiz?.id ?? ""}`} data={data} preset={one("preset") === "exit" ? "exit" : null} />;
}
