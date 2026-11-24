"use client";

import { LayoutTemplate, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { isQuestionKind } from "@/lib/resources/kinds";
import { syncTemplateLayout } from "@/lib/resources/store";
import type { Draft, Resource } from "@/lib/resources/types";
import { saveStructureToTemplate } from "@/lib/templates/actions";
import { layoutOfSections, structureChanged } from "@/lib/templates/from";

/**
 * T7: when a material made from a template has had its structure changed in review
 * (a section, a question more or less, other marks or instructions, the time),
 * Funza offers to save that structure back to the template, so the next one starts
 * from the better version. Wording style and cover page stay as they are.
 */
export function TemplateSync({ id, draft, resource }: { id: string; draft: Draft; resource: Resource }) {
  const [hidden, setHidden] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const b = resource.brief;
  if (!b.templateId || !b.layout || !isQuestionKind(draft.kind)) return null;
  // Only the teacher's own changes count (not questions Funza couldn't draft), and only if the result differs from the template.
  const changed = structureChanged(b.drafted ?? b.layout, draft.sections, b.duration, draft.duration) && structureChanged(b.layout, draft.sections, b.duration, draft.duration);
  if (done)
    return (
      <p role="status" className="flex items-center gap-2 rounded-tile bg-sage-tint px-4 py-3 text-body font-semibold text-sage-ink">
        <LayoutTemplate aria-hidden size={18} className="shrink-0" /> Saved to your template. The next one starts from this structure.
      </p>
    );
  if (!changed || hidden) return null;

  const save = () =>
    start(async () => {
      setError(null);
      const sections = layoutOfSections(draft.sections);
      const duration = draft.duration ?? b.duration;
      const res = await saveStructureToTemplate(b.templateId, draft.kind, sections, duration);
      if (!res.ok) return setError(res.message);
      syncTemplateLayout(id, sections, duration);
      setDone(true);
    });

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-tile border border-white/85 bg-tile px-4 py-3">
      <LayoutTemplate aria-hidden size={18} strokeWidth={1.6} className="shrink-0 text-accent" />
      <p className="min-w-0 flex-1 text-body">
        <span className="font-semibold">You changed this material’s structure.</span> Save it to your template so the next one starts from it?
        {error ? <span className="block text-meta font-medium text-red-ink">{error}</span> : null}
      </p>
      <Button variant="secondary" size="sm" loading={pending} onClick={save}>
        Save to template
      </Button>
      <button type="button" onClick={() => setHidden(true)} aria-label="Not now" title="Not now" className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-white/60">
        <X aria-hidden size={16} />
      </button>
    </div>
  );
}
