"use client";

import { CircleAlert, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ChoiceChip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Field";
import { saveTemplate } from "@/lib/templates/actions";
import { CATEGORIES, LIMITS, starterFormat, type LearnedFrom, type MaterialChoice, type TemplateCategory, type TemplateFormat } from "@/lib/templates/model";
import { canRead, ExamplePicker, learnedFromOf, readFormat, type Example } from "../ExamplePicker";
import { FormatEditor } from "../FormatEditor";

/**
 * New template (T1, T2, T5): what it's for, an example or a description, then
 * "Read the format". Funza shows the skeleton for a yes before anything is saved;
 * "Set it up yourself" starts from Funza's defaults with no AI.
 */
export function NewTemplate({ initialCategory, returnTo, materials = [] }: { initialCategory: TemplateCategory; returnTo: string | null; materials?: MaterialChoice[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<TemplateCategory>(initialCategory);
  const [examples, setExamples] = useState<Example[]>([]);
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<TemplateFormat | null>(null);
  const [learnedFrom, setLearnedFrom] = useState<LearnedFrom[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  async function read() {
    setError(null);
    setReading(true);
    const res = await readFormat(category, examples, description);
    setReading(false);
    if (!res.ok) return setError(res.message);
    setFormat(res.data.format);
    setNotices(res.data.notices);
    setName((n) => n || res.data.name);
    setSummary((s) => s || res.data.summary);
    setLearnedFrom(learnedFromOf(examples, description));
  }

  /** A Funza quiz, test or exam of the teacher's: its exact structure, no AI. */
  function fromMaterial(f: TemplateFormat, title: string) {
    setError(null);
    setFormat(f);
    setNotices([]);
    setLearnedFrom([{ kind: "material", name: title }]);
    setName((n) => n || `Like ${title}`.slice(0, LIMITS.name));
  }

  function byHand() {
    setError(null);
    setFormat(starterFormat(category));
    setNotices([]);
    setLearnedFrom([{ kind: "controls", name: "Set up by hand" }]);
  }

  function save() {
    if (!format) return;
    if (!name.trim()) return setError("Give the template a name.");
    startSave(async () => {
      setError(null);
      const res = await saveTemplate({ category, name, summary, format, learnedFrom });
      if (!res.ok) return setError(res.message);
      if (returnTo) router.push(`${returnTo}${returnTo.includes("?") ? "&" : "?"}template=${res.id}`);
      else router.push("/templates");
    });
  }

  const read_ = format !== null;
  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <Step n={1} label="For">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <ChoiceChip
              key={c.id}
              selected={category === c.id}
              disabled={reading || saving}
              onClick={() => {
                if (c.id === category) return;
                setCategory(c.id);
                setFormat(null);
                setNotices([]);
              }}
            >
              {c.label}
            </ChoiceChip>
          ))}
        </div>
      </Step>

      <Step n={2} label="Example">
        {read_ ? (
          <p className="flex flex-wrap items-center gap-x-2 pt-2 text-body text-ink-2">
            {learnedFrom[0]?.kind === "controls" ? "Set up by hand from Funza’s defaults." : learnedFrom[0]?.kind === "material" && learnedFrom.length === 1 ? `The exact structure of ${learnedFrom[0].name}.` : `Read from ${learnedFrom.map((l) => l.name).join(", ")}.`}
            <button type="button" onClick={() => setFormat(null)} className="font-semibold text-accent-ink hover:underline">
              Change
            </button>
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <ExamplePicker category={category} examples={examples} onExamples={setExamples} description={description} onDescription={setDescription} disabled={reading} materials={materials} onFormat={fromMaterial} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button size="lg" icon={Sparkles} loading={reading} disabled={!canRead(examples, description)} onClick={() => void read()}>
                {reading ? "Reading the format…" : "Read the format"}
              </Button>
              <button type="button" disabled={reading} onClick={byHand} className="text-body font-semibold text-accent-ink hover:underline disabled:opacity-50">
                or set it up yourself
              </button>
            </div>
          </div>
        )}
      </Step>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-body font-medium text-red-ink">
          <CircleAlert aria-hidden size={16} className="shrink-0" /> {error}
        </p>
      ) : null}

      {format ? (
        <>
          {notices.map((m) => (
            <p key={m} role="status" className="rounded-md bg-amber-tint px-4 py-3 text-body font-semibold text-amber-ink">
              {m}
            </p>
          ))}
          <Step n={3} label="Check">
            <FormatEditor format={format} onChange={setFormat} />
          </Step>
          <Step n={4} label="Name">
            <div className="flex flex-col gap-3">
              <Input aria-label="Template name" value={name} maxLength={LIMITS.name} placeholder="e.g. Chem 30 unit test" onChange={(e) => setName(e.target.value)} className="h-11" />
              <Input aria-label="About this template (optional)" value={summary} maxLength={LIMITS.summary} placeholder="One sentence about it (optional)" onChange={(e) => setSummary(e.target.value)} className="h-11 text-body" />
            </div>
          </Step>
          <div>
            <Button size="lg" loading={saving} onClick={save}>
              Save template
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="flex items-start gap-4 max-sm:flex-col max-sm:gap-2">
      <span className="flex w-28 shrink-0 items-center gap-2 pt-2 text-badge font-bold tracking-[0.06em] text-ink-2 uppercase max-sm:pt-0">
        <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-ink/[0.07] text-[11px] tracking-normal">
          {n}
        </span>
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
