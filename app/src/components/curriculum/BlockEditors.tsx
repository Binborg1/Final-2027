"use client";

import { useId } from "react";
import { HintsEditor, McqEditor, TextField } from "@/components/classes/ConceptReviewCard";
import { fieldBase } from "@/components/classes/ui";
import { emptyItem, ITEM_COUNT, type BlockItem, type CurriculumBlock, type ItemFact, type MotionSetup } from "@/lib/curriculum/lesson";

/** The editing controls for a curriculum block's structured parts: motion, questions and their answer checks. */

const smallButton = "rounded-lg px-2.5 py-1.5 text-xs font-semibold text-smoke hover:bg-sand hover:text-charcoal";

export function NumberField({ label, value, unit, onChange }: { label: string; value: number | null; unit: string; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-charcoal">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.5"
          value={value ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`${fieldBase} w-24 py-1.5`}
        />
        <span className="text-xs text-smoke">{unit}</span>
      </div>
    </div>
  );
}

export function MotionEditor({ kind, motion, onChange }: { kind: CurriculumBlock["kind"]; motion: MotionSetup; onChange: (m: MotionSetup) => void }) {
  const setObject = (i: number, patch: Partial<MotionSetup["objects"][number]>) =>
    onChange({ ...motion, objects: motion.objects.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  return (
    <fieldset className="rounded-2xl border border-line bg-cream/70 p-4">
      <legend className="px-1 text-sm font-semibold">{kind === "graph" ? "Objects on the graph" : "The moving object"}</legend>
      <ul className="space-y-3">
        {motion.objects.map((o, i) => (
          <li key={i} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[8rem] flex-1">
              <label className="block text-xs font-semibold text-charcoal" htmlFor={`obj-${kind}-${i}`}>
                Name
              </label>
              <input
                id={`obj-${kind}-${i}`}
                value={o.label}
                maxLength={40}
                onChange={(e) => setObject(i, { label: e.target.value.replace(/[{}]/g, "") })}
                className={`${fieldBase} mt-1 w-full py-1.5`}
              />
            </div>
            <NumberField label="Speed" value={o.speed} unit="m/s" onChange={(speed) => setObject(i, { speed })} />
            {kind === "graph" && motion.objects.length > 2 && (
              <button type="button" onClick={() => onChange({ ...motion, objects: motion.objects.filter((_, j) => j !== i) })} className={smallButton}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {kind === "graph" && motion.objects.length < 3 && (
        <button
          type="button"
          onClick={() => onChange({ ...motion, objects: [...motion.objects, { label: `Object ${motion.objects.length + 1}`, speed: motion.objects.length + 1 }] })}
          className={`mt-2 ${smallButton}`}
        >
          + Add an object
        </button>
      )}
      <div className="mt-3 flex flex-wrap gap-4">
        <NumberField label="Graph length" value={motion.duration} unit="s" onChange={(duration) => onChange({ ...motion, duration })} />
        {kind === "prediction" && <NumberField label="Predict at" value={motion.askTime} unit="s" onChange={(askTime) => onChange({ ...motion, askTime })} />}
      </div>
    </fieldset>
  );
}

const FACT_KINDS: { value: string; label: string }[] = [
  { value: "none", label: "Teacher judgment (Funza cannot recompute it)" },
  { value: "distance", label: "Distance = speed × time" },
  { value: "speed", label: "Speed = distance ÷ time" },
  { value: "time", label: "Time = distance ÷ speed" },
  { value: "fastest", label: "Names the fastest object on the graph" },
  { value: "slowest", label: "Names the slowest object on the graph" },
];

export function FactEditor({ fact, onChange }: { fact: ItemFact | null; onChange: (f: ItemFact | null) => void }) {
  const id = useId();
  const choose = (kind: string) => {
    if (kind === "distance") onChange({ kind, speed: 1, time: 1 });
    else if (kind === "speed") onChange({ kind, distance: 1, time: 1 });
    else if (kind === "time") onChange({ kind, distance: 1, speed: 1 });
    else if (kind === "fastest" || kind === "slowest") onChange({ kind });
    else onChange(null);
  };
  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-3">
      <label htmlFor={id} className="block text-xs font-semibold text-charcoal">
        How Funza checks the marked answer
      </label>
      <select id={id} value={fact?.kind ?? "none"} onChange={(e) => choose(e.target.value)} className={`${fieldBase} mt-1 w-full py-1.5`}>
        {FACT_KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
      {fact && fact.kind === "distance" && (
        <div className="mt-2 flex flex-wrap gap-4">
          <NumberField label="Speed" value={fact.speed} unit="m/s" onChange={(speed) => onChange({ ...fact, speed })} />
          <NumberField label="Time" value={fact.time} unit="s" onChange={(time) => onChange({ ...fact, time })} />
        </div>
      )}
      {fact && fact.kind === "speed" && (
        <div className="mt-2 flex flex-wrap gap-4">
          <NumberField label="Distance" value={fact.distance} unit="m" onChange={(distance) => onChange({ ...fact, distance })} />
          <NumberField label="Time" value={fact.time} unit="s" onChange={(time) => onChange({ ...fact, time })} />
        </div>
      )}
      {fact && fact.kind === "time" && (
        <div className="mt-2 flex flex-wrap gap-4">
          <NumberField label="Distance" value={fact.distance} unit="m" onChange={(distance) => onChange({ ...fact, distance })} />
          <NumberField label="Speed" value={fact.speed} unit="m/s" onChange={(speed) => onChange({ ...fact, speed })} />
        </div>
      )}
    </div>
  );
}

export function ItemsEditor({ block, onChange }: { block: CurriculumBlock; onChange: (items: BlockItem[]) => void }) {
  const range = ITEM_COUNT[block.kind];
  const setItem = (i: number, patch: Partial<BlockItem>) => onChange(block.items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-4">
      {block.items.map((item, i) => (
        <fieldset key={item.id} className="rounded-2xl border border-line bg-cream/70 p-4">
          <legend className="px-1 text-sm font-semibold">{block.items.length > 1 ? `Question ${i + 1}` : "Question"}</legend>
          <TextField label="Question text" value={item.prompt} max={1200} rows={2} onChange={(prompt) => setItem(i, { prompt })} compact />
          <McqEditor
            question={{ kind: "mcq", prompt: item.prompt, options: item.options, correctOptionId: item.correctOptionId }}
            groupName={`correct-${block.id}-${item.id}`}
            onChange={(q) => setItem(i, { options: q.options, correctOptionId: q.correctOptionId })}
          />
          <HintsEditor hints={item.hints} onChange={(hints) => setItem(i, { hints })} />
          <TextField label="Why it's right" value={item.whyCorrect} max={1500} rows={2} onChange={(whyCorrect) => setItem(i, { whyCorrect })} />
          <FactEditor fact={item.fact} onChange={(fact) => setItem(i, { fact })} />
          {block.items.length > range.min && (
            <button type="button" onClick={() => onChange(block.items.filter((_, j) => j !== i))} className={`mt-3 ${smallButton}`}>
              Remove this question
            </button>
          )}
        </fieldset>
      ))}
      {block.items.length < range.max && (
        <button type="button" onClick={() => onChange([...block.items, emptyItem(`q${Date.now().toString(36)}`)])} className={smallButton}>
          + Add a question
        </button>
      )}
    </div>
  );
}
