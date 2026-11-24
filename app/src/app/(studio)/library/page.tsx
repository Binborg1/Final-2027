import { Library, Sparkles } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Misc";
import { requireTeacher } from "@/lib/auth/teacher";
import { libraryRows } from "@/lib/library/data";
import { filterFromParams } from "@/lib/library/model";
import { LibraryBrowser } from "./LibraryBrowser";

export const metadata = { title: "Library" };

/**
 * The Library: every material the teacher has approved, in every course, each
 * with its versions kept. Drafts stay in Review until they're approved.
 */
export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [, sp] = await Promise.all([requireTeacher({ next: "/library" }), searchParams]);
  const { rows, courses, waiting } = await libraryRows();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Library"
        summary="Every material you approved, by course, with each version kept."
        actions={
          <ButtonLink href="/make" icon={Sparkles}>
            Make something
          </ButtonLink>
        }
      />
      {rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Library}
            title="Nothing approved yet"
            action={
              waiting > 0 ? (
                <Link href="/" className="font-semibold text-accent-ink hover:underline">
                  {waiting} {waiting === 1 ? "draft is" : "drafts are"} waiting for review
                </Link>
              ) : undefined
            }
          >
            When you approve a material in Review, it’s kept here with every version.
          </EmptyState>
        </Card>
      ) : (
        <LibraryBrowser rows={rows} courses={courses} initial={filterFromParams(sp, courses)} />
      )}
    </div>
  );
}
