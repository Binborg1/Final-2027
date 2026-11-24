import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { requireTeacher } from "@/lib/auth/teacher";
import { pinChapters, templateById, templateMaterials } from "@/lib/templates/data";
import { EditTemplate } from "./EditTemplate";

export const metadata = { title: "Template" };

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTeacher({ next: `/templates/${id}` });
  const [template, materials, chapters] = await Promise.all([templateById(id), templateMaterials(), pinChapters()]);
  if (!template || !template.format) notFound();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumbs={[{ label: "Templates", href: "/templates" }, { label: template.name }]} title={template.name} size="title-sm" />
      <EditTemplate key={template.id} template={{ ...template, format: template.format }} materials={materials} chapters={chapters} />
    </div>
  );
}
