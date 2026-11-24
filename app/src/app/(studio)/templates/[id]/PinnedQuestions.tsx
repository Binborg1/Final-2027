"use client";

import { CircleAlert, Pin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { Select } from "@/components/ui/Field";
import { QTYPE_LABEL } from "@/lib/resources/kinds";
import type { QType } from "@/lib/resources/types";
import { bankForChapter, pinQuestion, unpinQuestion, type BankChoice } from "@/lib/templates/actions";
import { MAX_PINS, sectionLetter, type QuestionFormat, type TemplatePin } from "@/lib/templates/model";
import { cn } from "@/lib/ui/cn";

/**
 * T4: pin questions from the bank to a section of the template. Every material made
 * from it includes them unchanged, and Funza writes the rest of that section around
 * them. Pins are saved straight away; they follow the saved template's sections.
 */
export function PinnedQuestions({ templateId, format, pins, chapters }: { templateId: string; format: QuestionFormat; pins: TemplatePin[]; chapters: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState("");
  const [bank, setBank] = useState<BankChoice[] | null>(null);
  const [questionId, setQuestionId] = useState("");
  const [section, setSection] = useState<number | null>(null);

  const types = new Set(format.sections.flatMap((s) => s.rows.map((r) => r.type)));
  const chosen = bank?.find((q) => q.id === questionId) ?? null;
  const fits = chosen ? format.sections.map((s, k) => ({ s, k })).filter(({ s }) => s.rows.some((r) => r.type === chosen.type)) : [];

  async function openChapter(id: string) {
    setChapterId(id);
    setQuestionId("");
    setSection(null);
    setBank(null);
    if (!id) return;
    const res = await bankForChapter(id);
    if (!res.ok) return setError(res.message);
    setBank(res.questions.filter((q) => types.has(q.type as QType)));
  }

  const run = (action: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await action();
      if (!res.ok) return setError(res.message ?? "Funza couldn’t save that.");
      after?.();
      router.refresh();
    });

  return (
    <Disclosure title="Pinned questions" summary={pins.length > 0 ? `${pins.length} pinned` : "None: Funza writes every question"}>
      <p className="text-meta text-ink-2">Every material made from this template includes these unchanged. Funza writes the rest of each section around them.</p>
      {pins.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {pins.map((p) => (
            <li key={p.questionId} className="flex items-center gap-2 rounded-[14px] bg-white/55 py-1.5 pr-1 pl-3">
              <span className="w-4 shrink-0 text-meta font-bold text-ink-2">{sectionLetter(p.section)}</span>
              <span className="min-w-0 flex-1 truncate text-body">{p.item.prompt}</span>
              <span className="shrink-0 text-meta text-ink-2">
                {QTYPE_LABEL[p.item.type]} · {p.item.marks}m
              </span>
              <button type="button" aria-label="Unpin" title="Unpin" disabled={pending} onClick={() => run(() => unpinQuestion(templateId, p.questionId))} className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-white disabled:opacity-40 pointer-coarse:size-11">
                <X aria-hidden size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {pins.length < MAX_PINS ? (
        <div className="flex flex-col gap-2.5">
          <Select aria-label="Chapter to pin from" value={chapterId} onChange={(e) => void openChapter(e.target.value)} className="[&_select]:h-11">
            <option value="">Pin a question from a chapter’s bank…</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          {bank !== null ? (
            bank.length === 0 ? (
              <p className="text-meta text-ink-2">This chapter’s bank has no questions of the types this template uses.</p>
            ) : (
              <ul role="radiogroup" aria-label="Questions in this chapter's bank" className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                {bank.map((q) => {
                  const on = q.id === questionId;
                  const taken = pins.some((p) => p.questionId === q.id);
                  return (
                    <li key={q.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={taken}
                        onClick={() => {
                          setQuestionId(q.id);
                          const first = format.sections.findIndex((s) => s.rows.some((r) => r.type === q.type));
                          setSection(first >= 0 ? first : null);
                        }}
                        className={cn("flex w-full items-center gap-2 rounded-[12px] border px-3 py-2 text-left disabled:opacity-45", on ? "border-accent bg-accent-tint-soft" : "border-transparent hover:bg-white/70")}
                      >
                        <span className="min-w-0 flex-1 truncate text-body">{q.stem}</span>
                        <span className="shrink-0 text-meta text-ink-2">
                          {QTYPE_LABEL[q.type as QType] ?? q.type} · {q.marks}m{taken ? " · pinned" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
          {chosen && fits.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select aria-label="Section" value={section ?? ""} onChange={(e) => setSection(Number(e.target.value))} className="min-w-[200px] flex-1 [&_select]:h-11">
                {fits.map(({ s, k }) => (
                  <option key={k} value={k}>
                    {sectionLetter(k)} · {s.title}
                  </option>
                ))}
              </Select>
              <Button
                variant="secondary"
                size="sm"
                icon={Pin}
                loading={pending}
                disabled={section === null}
                onClick={() =>
                  section !== null &&
                  run(
                    () => pinQuestion(templateId, chosen.id, section),
                    () => {
                      setQuestionId("");
                      setSection(null);
                    },
                  )
                }
              >
                Pin it
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="flex items-center gap-2 text-meta font-medium text-red-ink">
          <CircleAlert aria-hidden size={14} className="shrink-0" /> {error}
        </p>
      ) : null}
    </Disclosure>
  );
}
