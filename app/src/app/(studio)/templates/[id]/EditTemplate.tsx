"use client";

import { CircleAlert, Copy, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Disclosure } from "@/components/ui/Disclosure";
import { Input } from "@/components/ui/Field";
import { deleteTemplate, duplicateTemplate, saveTemplate } from "@/lib/templates/actions";
import { categoryInfo, LIMITS, type LearnedFrom, type MaterialChoice, type Template, type TemplateFormat } from "@/lib/templates/model";
import { canRead, ExamplePicker, learnedFromOf, readFormat, type Example } from "../ExamplePicker";
import { FormatEditor } from "../FormatEditor";

/** One template: check and change its skeleton, rename it, read another example, or delete it. */
export function EditTemplate({ template, materials = [] }: { template: Template & { format: TemplateFormat }; materials?: MaterialChoice[] }) {
  const router = useRouter();
  const [format, setFormat] = useState<TemplateFormat>(template.format);
  const [name, setName] = useState(template.name);
  const [summary, setSummary] = useState(template.summary);
  const [learnedFrom, setLearnedFrom] = useState<LearnedFrom[]>(template.learnedFrom);
  const [examples, setExamples] = useState<Example[]>([]);
  const [description, setDescription] = useState("");
  const [notices, setNotices] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, start] = useTransition();

  const original = JSON.stringify([template.format, template.name, template.summary]);
  const dirty = JSON.stringify([format, name, summary]) !== original || learnedFrom !== template.learnedFrom;

  async function readAgain() {
    setError(null);
    setReading(true);
    const res = await readFormat(template.category, examples, description);
    setReading(false);
    if (!res.ok) return setError(res.message);
    setFormat(res.data.format);
    setNotices(res.data.notices);
    setLearnedFrom(learnedFromOf(examples, description));
    setExamples([]);
    setDescription("");
    setSaved(false);
  }

  function save() {
    start(async () => {
      setError(null);
      const res = await saveTemplate({ id: template.id, category: template.category, name, summary, format, learnedFrom });
      if (!res.ok) return setError(res.message);
      setSaved(true);
      router.refresh();
    });
  }

  const from = learnedFrom.length ? learnedFrom.map((l) => (l.kind === "controls" ? "set up by hand" : l.name)).join(", ") : null;
  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <p className="text-body text-ink-2">
        {categoryInfo(template.category).one}
        {from ? ` · learned from ${from}` : ""}
        {template.used > 0 ? ` · used for ${template.used} material${template.used === 1 ? "" : "s"}` : ""}
      </p>

      <div className="flex flex-col gap-3">
        <Input aria-label="Template name" value={name} maxLength={LIMITS.name} onChange={(e) => (setName(e.target.value), setSaved(false))} className="h-11 font-semibold" />
        <Input aria-label="About this template (optional)" value={summary} maxLength={LIMITS.summary} placeholder="One sentence about it (optional)" onChange={(e) => (setSummary(e.target.value), setSaved(false))} className="h-11 text-body" />
      </div>

      {notices.map((m) => (
        <p key={m} role="status" className="rounded-md bg-amber-tint px-4 py-3 text-body font-semibold text-amber-ink">
          {m}
        </p>
      ))}

      <FormatEditor format={format} onChange={(f) => (setFormat(f), setSaved(false))} />

      <Disclosure title="Read another example" summary="Replace this skeleton with one Funza reads from another file">
        <ExamplePicker
          category={template.category}
          examples={examples}
          onExamples={setExamples}
          description={description}
          onDescription={setDescription}
          disabled={reading}
          materials={materials}
          onFormat={(f, title) => {
            setFormat(f);
            setNotices([]);
            setLearnedFrom([{ kind: "material", name: title }]);
            setSaved(false);
          }}
        />
        <div>
          <Button variant="secondary" icon={Sparkles} loading={reading} disabled={!canRead(examples, description)} onClick={() => void readAgain()}>
            Read the format
          </Button>
        </div>
      </Disclosure>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-body font-medium text-red-ink">
          <CircleAlert aria-hidden size={16} className="shrink-0" /> {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" loading={pending} disabled={!dirty || saved} onClick={save}>
          {saved ? "Saved" : "Save changes"}
        </Button>
        <ButtonLink href={`/make?template=${template.id}`} variant="secondary">
          Use in Make
        </ButtonLink>
        <Button
          variant="ghost"
          icon={Copy}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await duplicateTemplate(template.id);
              if (!res.ok) return setError(res.message);
              router.push(`/templates/${res.id}`);
            })
          }
        >
          Duplicate
        </Button>
        <Button variant="ghost" icon={Trash2} className="ml-auto text-red-ink" onClick={() => setDeleting(true)}>
          Delete template
        </Button>
      </div>

      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        labelledBy="delete-template-title"
        title={`Delete “${template.name}”?`}
        description="Materials made from it stay as they are."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              icon={Trash2}
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteTemplate(template.id);
                  if (!res.ok) {
                    setDeleting(false);
                    return setError(res.message);
                  }
                  router.push("/templates");
                })
              }
            >
              Delete template
            </Button>
          </>
        }
      />
    </div>
  );
}
