import { LayoutTemplate, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Misc";
import { requireTeacher } from "@/lib/auth/teacher";
import { templateList } from "@/lib/templates/data";
import { TemplateRows } from "./TemplateRows";

export const metadata = { title: "Templates" };

/** Templates (FR-20, FR-21): the teacher's own formats, by category. */
export default async function TemplatesPage() {
  await requireTeacher({ next: "/templates" });
  const templates = await templateList();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Templates"
        summary="Your own formats. Funza copies how they’re made, never what’s in them."
        actions={
          <ButtonLink href="/templates/new" icon={Plus}>
            New template
          </ButtonLink>
        }
      />
      {templates.length === 0 ? (
        <Card className="max-w-[880px] p-6">
          <EmptyState icon={LayoutTemplate} title="No templates yet">
            Show Funza a past exam, a quiz, your notes or a slide deck. It learns the format, and every new one you make on another chapter comes out the same way.
          </EmptyState>
        </Card>
      ) : (
        <TemplateRows templates={templates} />
      )}
    </div>
  );
}
