"use client";

import { Check, CircleAlert, PenLine, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CountPill } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { deleteTemplate, renameTemplate, type Result } from "@/lib/templates/actions";
import { CATEGORIES, formatLine, LIMITS, type Template } from "@/lib/templates/model";

/** The teacher's templates in the four categories, always in the same order. */
export function TemplateRows({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await action();
      if (!res.ok) return setError(res.message);
      after?.();
      router.refresh();
    });

  return (
    <div className="flex max-w-[880px] flex-col gap-4">
      {error ? (
        <p role="alert" className="flex items-center gap-2 text-body font-medium text-red-ink">
          <CircleAlert aria-hidden size={16} /> {error}
        </p>
      ) : null}
      {CATEGORIES.map((c) => {
        const list = templates.filter((t) => t.category === c.id);
        return (
          <Card key={c.id} className="flex flex-col gap-2 px-5 pt-4 pb-4" aria-labelledby={`cat-${c.id}`}>
            <CardHeader id={`cat-${c.id}`} title={c.label} size="sm" after={<CountPill>{list.length}</CountPill>} />
            {list.length === 0 ? (
              <p className="text-body text-ink-2">
                None yet.{" "}
                <Link href={`/templates/new?category=${c.id}`} className="font-semibold text-accent-ink hover:underline">
                  Add a {c.one.toLowerCase()} template
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {list.map((t) => (
                  <li key={t.id} className="flex min-h-16 items-center gap-1 rounded-tile border border-white/80 bg-tile py-1.5 pr-1.5 pl-4">
                    {editing === t.id ? (
                      <form
                        className="flex min-w-0 flex-1 items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(() => renameTemplate(t.id, draftName), () => setEditing(null));
                        }}
                      >
                        <Input aria-label={`New name for ${t.name}`} value={draftName} maxLength={LIMITS.name} onChange={(e) => setDraftName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEditing(null)} className="h-10" autoFocus />
                        <Button type="submit" size="sm" icon={Check} loading={pending}>
                          Save
                        </Button>
                        <Button variant="ghost" size="sm" icon={X} onClick={() => setEditing(null)} aria-label="Cancel renaming" />
                      </form>
                    ) : (
                      <>
                        <Link href={`/templates/${t.id}`} className="flex min-w-0 flex-1 flex-col py-1 hover:underline">
                          <span className="truncate text-row font-semibold">{t.name}</span>
                          <span className="truncate text-meta text-ink-2">
                            {t.format ? formatLine(t.format) : "This template couldn’t be read. Delete it and make it again."}
                            {t.used > 0 ? ` · used ${t.used}×` : ""}
                          </span>
                        </Link>
                        <RowButton icon={PenLine} label={`Rename ${t.name}`} disabled={pending} onClick={() => { setEditing(t.id); setDraftName(t.name); }} />
                        <RowButton icon={Trash2} label={`Delete ${t.name}`} disabled={pending} onClick={() => setDeleting(t)} />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        labelledBy="delete-template-title"
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="Materials made from it stay as they are."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={pending}>
              Cancel
            </Button>
            <Button icon={Trash2} loading={pending} onClick={() => deleting && run(() => deleteTemplate(deleting.id), () => setDeleting(null))}>
              Delete template
            </Button>
          </>
        }
      />
    </div>
  );
}

function RowButton({ icon: Icon, label, disabled, onClick }: { icon: typeof PenLine; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-white hover:text-ink disabled:opacity-35 pointer-coarse:size-11">
      <Icon aria-hidden size={17} strokeWidth={1.75} />
    </button>
  );
}
