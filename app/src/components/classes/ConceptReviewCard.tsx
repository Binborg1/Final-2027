"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { fieldBase, fieldClass } from "@/components/classes/ui";
import { conceptProblems, LIMITS, type DraftConcept } from "@/lib/classes/model";
import type { McqQuestion, ShortAnswerQuestion } from "@/lib/types";

type Props = { concept: DraftConcept; index: number; onChange: (next: DraftConcept) => void };

const OPTION_IDS = "abcdef".split("");

/**
 * One drafted concept in review. Waiting concepts are open for editing;
 * approved ones show what students will get; removed ones collapse.
 */
export function ConceptReviewCard({ concept, index, onChange }: Props) {
  const set = (patch: Partial<DraftConcept>) => onChange({ ...concept, ...patch });

  if (concept.review === "removed") {
    return (
      <article className="flex flex-wrap items-center gap-3 rounded-3xl border border-dashed border-line bg-white/50 px-5 py-4">
        <ConceptNumber index={index} muted />
        <p className="min-w-0 flex-1 font-bold text-smoke line-through">{concept.title || "Untitled concept"}</p>
        <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-extrabold text-smoke">Removed</span>
        <Button variant="secondary" className="px-4 py-2 text-xs" onClick={() => set({ review: "pending" })}>
          Restore
        </Button>
      </article>
    );
  }

  if (concept.review === "approved") {
    const q = concept.question;
    return (
      <article className="rounded-3xl border border-mint bg-white p-5 shadow-card md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <ConceptNumber index={index} />
          <h3 className="min-w-0 flex-1 text-lg font-extrabold">{concept.title}</h3>
          <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-extrabold text-mint-dark">Approved</span>
        </div>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-charcoal/85">{concept.explanation}</p>
        <div className="mt-4 rounded-2xl bg-sand/70 px-4 py-3 text-sm">
          <p className="font-bold">{q.prompt}</p>
          {q.kind === "mcq" ? (
            <ul className="mt-2 space-y-1">
              {q.options
                .filter((o) => o.text.trim())
                .map((o) => (
                  <li key={o.id} className={o.id === q.correctOptionId ? "font-bold text-mint-dark" : "text-smoke"}>
                    {o.id === q.correctOptionId ? "✓ " : ""}
                    {o.text}
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-2 text-smoke">Model answer: {q.sampleAnswer}</p>
          )}
        </div>
        <p className="mt-3 text-xs font-semibold text-smoke">
          {concept.hints.filter((h) => h.trim()).length} hint{concept.hints.filter((h) => h.trim()).length === 1 ? "" : "s"}
          {concept.alternateExplanation.trim() ? " · a second explanation" : ""}
          {concept.whyCorrect.trim() ? " · why it's right" : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" className="px-4 py-2 text-xs" onClick={() => set({ review: "pending" })}>
            Edit
          </Button>
          <Button variant="ghost" className="px-4 py-2 text-xs" onClick={() => set({ review: "removed" })}>
            Remove
          </Button>
        </div>
      </article>
    );
  }

  const problems = conceptProblems(concept);
  return (
    <article className="rounded-3xl border border-line bg-white p-5 shadow-card md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <ConceptNumber index={index} />
        <span className="rounded-full bg-peach px-2.5 py-0.5 text-xs font-extrabold text-peach-dark">Needs your review</span>
      </div>

      <TextField label="Title" value={concept.title} max={LIMITS.title} onChange={(title) => set({ title })} single />
      <TextField
        label="Explanation"
        hint="Students read this first."
        value={concept.explanation}
        max={LIMITS.explanation}
        rows={6}
        onChange={(explanation) => set({ explanation })}
      />
      <TextField
        label="Another way to think about it"
        hint="Shown after a wrong answer."
        value={concept.alternateExplanation}
        max={LIMITS.alternate}
        rows={3}
        onChange={(alternateExplanation) => set({ alternateExplanation })}
      />

      <fieldset className="mt-6 rounded-2xl border border-line bg-cream/60 p-4">
        <legend className="px-1 text-sm font-extrabold">Question</legend>
        <TextField
          label="Question text"
          value={concept.question.prompt}
          max={LIMITS.prompt}
          rows={2}
          onChange={(prompt) => set({ question: { ...concept.question, prompt } })}
          compact
        />
        {concept.question.kind === "mcq" ? (
          <McqEditor question={concept.question} groupName={`correct-${concept.id}`} onChange={(question) => set({ question })} />
        ) : (
          <ShortEditor question={concept.question} onChange={(question) => set({ question })} />
        )}
      </fieldset>

      <HintsEditor hints={concept.hints} onChange={(hints) => set({ hints })} />
      <TextField
        label="Why it's right"
        hint="Shown after a correct answer, or when a student gives up."
        value={concept.whyCorrect}
        max={LIMITS.whyCorrect}
        rows={2}
        onChange={(whyCorrect) => set({ whyCorrect })}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button onClick={() => set({ review: "approved" })} disabled={problems.length > 0}>
          Approve
        </Button>
        <Button variant="ghost" onClick={() => set({ review: "removed" })}>
          Remove
        </Button>
        {problems.length > 0 && <p className="text-xs font-semibold text-coral-dark">Before approving: {problems.join(" ")}</p>}
      </div>
    </article>
  );
}

function ConceptNumber({ index, muted = false }: { index: number; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold shadow-edge ${muted ? "bg-sand text-smoke" : "bg-lavender text-lavender-dark"}`}
    >
      {index + 1}
    </span>
  );
}

function TextField({
  label,
  hint,
  value,
  max,
  rows = 3,
  single = false,
  compact = false,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  max: number;
  rows?: number;
  single?: boolean;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className={compact ? "mt-1" : "mt-4"}>
      <label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-bold text-charcoal">{label}</span>
        {hint && <span className="text-xs text-smoke">{hint}</span>}
      </label>
      {single ? (
        <input id={id} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className={`${fieldClass} font-bold`} />
      ) : (
        <textarea id={id} value={value} maxLength={max} rows={rows} onChange={(e) => onChange(e.target.value)} className={`${fieldClass} resize-y`} />
      )}
    </div>
  );
}

function McqEditor({ question, groupName, onChange }: { question: McqQuestion; groupName: string; onChange: (q: McqQuestion) => void }) {
  const setOption = (id: string, text: string) => onChange({ ...question, options: question.options.map((o) => (o.id === id ? { ...o, text } : o)) });
  const remove = (id: string) => {
    const options = question.options.filter((o) => o.id !== id);
    onChange({ ...question, options, correctOptionId: question.correctOptionId === id ? (options[0]?.id ?? "a") : question.correctOptionId });
  };
  const free = OPTION_IDS.find((id) => !question.options.some((o) => o.id === id));
  return (
    <div className="mt-4">
      <p className="text-sm font-bold text-charcoal">
        Answer options <span className="text-xs font-normal text-smoke">Select the correct one.</span>
      </p>
      <ul className="mt-2 space-y-2">
        {question.options.map((o, i) => (
          <li key={o.id} className="flex items-center gap-2">
            <input
              type="radio"
              name={groupName}
              checked={question.correctOptionId === o.id}
              onChange={() => onChange({ ...question, correctOptionId: o.id })}
              aria-label={`Option ${i + 1} is the correct answer`}
              className="h-5 w-5 shrink-0 accent-[#ea6a3f]"
            />
            <input
              value={o.text}
              maxLength={LIMITS.option}
              onChange={(e) => setOption(o.id, e.target.value)}
              aria-label={`Option ${i + 1}`}
              className={`${fieldBase} w-full min-w-0`}
            />
            <span className={`w-14 shrink-0 text-xs font-extrabold text-mint-dark ${question.correctOptionId === o.id ? "" : "invisible"}`}>
              Correct
            </span>
            {question.options.length > 2 && (
              <button
                type="button"
                onClick={() => remove(o.id)}
                aria-label={`Remove option ${i + 1}`}
                className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-bold text-smoke hover:bg-sand hover:text-charcoal"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {free && question.options.length < LIMITS.options && (
        <button
          type="button"
          onClick={() => onChange({ ...question, options: [...question.options, { id: free, text: "" }] })}
          className="mt-2 rounded-full px-3 py-1.5 text-xs font-bold text-smoke hover:bg-sand hover:text-charcoal"
        >
          + Add option
        </button>
      )}
    </div>
  );
}

function ShortEditor({ question, onChange }: { question: ShortAnswerQuestion; onChange: (q: ShortAnswerQuestion) => void }) {
  // Kept as typed, so commas and new lines are not tidied away mid-word.
  const [ideas, setIdeas] = useState(() => question.keywordGroups.map((g) => g.join(", ")).join("\n"));
  const groupsFrom = (text: string) =>
    text
      .split("\n")
      .map((line) => line.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean))
      .filter((g) => g.length > 0)
      .slice(0, LIMITS.keywordGroups);
  const groups = question.keywordGroups.length;
  return (
    <div>
      <TextField
        label="Model answer"
        hint="Shown when a student gives up."
        value={question.sampleAnswer}
        max={LIMITS.whyCorrect}
        rows={2}
        onChange={(sampleAnswer) => onChange({ ...question, sampleAnswer })}
      />
      <Field label="Key ideas the answer must mention" hint="One idea per line. Separate words that count the same with commas.">
        {(id) => (
          <textarea
            id={id}
            value={ideas}
            rows={3}
            onChange={(e) => {
              setIdeas(e.target.value);
              const keywordGroups = groupsFrom(e.target.value);
              onChange({ ...question, keywordGroups, minGroups: Math.min(Math.max(question.minGroups, 1), Math.max(keywordGroups.length, 1)) });
            }}
            className={`${fieldClass} resize-y`}
          />
        )}
      </Field>
      {groups > 1 && (
        <Field label="A correct answer mentions at least">
          {(id) => (
            <select
              id={id}
              value={Math.min(question.minGroups, groups)}
              onChange={(e) => onChange({ ...question, minGroups: Number(e.target.value) })}
              className={`mt-1.5 ${fieldBase}`}
            >
              {Array.from({ length: groups }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} of {groups} ideas
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
    </div>
  );
}

function HintsEditor({ hints, onChange }: { hints: string[]; onChange: (hints: string[]) => void }) {
  const list = hints.length > 0 ? hints : [""];
  return (
    <div className="mt-4">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-bold text-charcoal">Hints</span>
        <span className="text-xs text-smoke">One per wrong answer, from gentle to specific. Never give the answer away.</span>
      </p>
      <ol className="mt-1.5 space-y-2">
        {list.map((hint, i) => (
          <li key={i} className="flex items-start gap-2">
            <textarea
              value={hint}
              rows={2}
              maxLength={LIMITS.hint}
              aria-label={`Hint ${i + 1}`}
              onChange={(e) => onChange(list.map((h, j) => (j === i ? e.target.value : h)))}
              className={`${fieldBase} w-full min-w-0 resize-y`}
            />
            {list.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(list.filter((_, j) => j !== i))}
                aria-label={`Remove hint ${i + 1}`}
                className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-bold text-smoke hover:bg-sand hover:text-charcoal"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ol>
      {list.length < LIMITS.hints && (
        <button
          type="button"
          onClick={() => onChange([...list, ""])}
          className="mt-2 rounded-full px-3 py-1.5 text-xs font-bold text-smoke hover:bg-sand hover:text-charcoal"
        >
          + Add hint
        </button>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="mt-4">
      <label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-bold text-charcoal">{label}</span>
        {hint && <span className="text-xs text-smoke">{hint}</span>}
      </label>
      {children(id)}
    </div>
  );
}
