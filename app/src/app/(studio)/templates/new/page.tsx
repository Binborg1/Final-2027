import { PageHeader } from "@/components/shell/PageHeader";
import { requireTeacher } from "@/lib/auth/teacher";
import { isCategory } from "@/lib/templates/model";
import { NewTemplate } from "./NewTemplate";

export const metadata = { title: "New template" };

/** Only Make may be the page a new template goes back to. */
function safeReturn(v: unknown): string | null {
  if (typeof v !== "string" || !v.startsWith("/make") || v.startsWith("//") || /[\\\s]/.test(v) || v.length > 1500) return null;
  return v;
}

export default async function NewTemplatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [, sp] = await Promise.all([requireTeacher({ next: "/templates/new" }), searchParams]);
  const category = isCategory(sp.category) ? sp.category : "exam";
  const returnTo = safeReturn(sp.return);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumbs={[{ label: "Templates", href: "/templates" }, { label: "New template" }]} title="New template" size="title-sm" summary="Show Funza one of yours. It learns how it’s made, never what’s in it." />
      <NewTemplate initialCategory={category} returnTo={returnTo} />
    </div>
  );
}
