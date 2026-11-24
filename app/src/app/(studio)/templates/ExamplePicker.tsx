"use client";

import { FileText, Lock, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { materialExample } from "@/lib/templates/actions";
import { exampleText } from "@/lib/templates/condense";
import { categoryInfo, LIMITS, type LearnedFrom, type MaterialChoice, type TemplateCategory, type TemplateFormat } from "@/lib/templates/model";
import { cn } from "@/lib/ui/cn";

/** An example: a file read in this browser, or one of the teacher's Funza materials as text. */
export type Example = { name: string; text: string; material?: boolean };
export type ReadData = { format: TemplateFormat; name: string; summary: string; notices: string[] };

/** "Read the format": the examples go to Funza once, for this request only. */
export async function readFormat(category: TemplateCategory, examples: Example[], description: string): Promise<{ ok: true; data: ReadData } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/teach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "template-read", category, examples, description }) });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: ReadData; message?: string } | null;
    if (json?.ok && json.data) return { ok: true, data: json.data };
    return { ok: false, message: json?.message ?? "Funza couldn’t read the format. Try again in a moment." };
  } catch {
    return { ok: false, message: "Funza couldn’t be reached. Check your connection and try again." };
  }
}

export const learnedFromOf = (examples: Example[], description: string): LearnedFrom[] => [
  ...examples.map((e) => ({ kind: e.material ? ("material" as const) : ("file" as const), name: e.name })),
  ...(description.trim() ? [{ kind: "description" as const, name: "Your description" }] : []),
];

export const canRead = (examples: Example[], description: string) => examples.some((e) => e.text.trim().length >= 40) || description.trim().length >= 20;

/**
 * Up to three examples (PDF, Word, PowerPoint or text files, read in this browser,
 * or the teacher's own Funza materials) and an optional description. A Funza quiz,
 * test or exam gives its exact structure straight away (`onFormat`), with no AI.
 */
export function ExamplePicker({
  category,
  examples,
  onExamples,
  description,
  onDescription,
  disabled,
  materials = [],
  onFormat,
}: {
  category: TemplateCategory;
  examples: Example[];
  onExamples: (e: Example[]) => void;
  description: string;
  onDescription: (d: string) => void;
  disabled?: boolean;
  materials?: MaterialChoice[];
  onFormat?: (format: TemplateFormat, name: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [describe, setDescribe] = useState(description.length > 0);
  const [over, setOver] = useState(false);
  const [pickMaterial, setPickMaterial] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const pool = materials.filter((m) => categoryInfo(category).kinds.includes(m.kind));

  async function addMaterial() {
    if (!materialId) return;
    setReading(true);
    const res = await materialExample(materialId, category);
    setReading(false);
    if (!res.ok) return setErrors([res.message]);
    setErrors([]);
    if (res.format && onFormat) return onFormat(res.format, res.name);
    if (examples.length >= LIMITS.examples) return setErrors([`Up to ${LIMITS.examples} examples. Remove one first.`]);
    onExamples([...examples, { name: res.name, text: res.text, material: true }]);
    setMaterialId("");
  }

  async function add(files: FileList | File[]) {
    setReading(true);
    const next = [...examples];
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      if (next.length >= LIMITS.examples) {
        problems.push(`Up to ${LIMITS.examples} examples. ${file.name} was left out.`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        problems.push(`${file.name} is larger than 20 MB.`);
        continue;
      }
      const res = await exampleText(file);
      if (res.ok) next.push({ name: file.name.slice(0, 120), text: res.text });
      else problems.push(res.message);
    }
    onExamples(next);
    setErrors(problems);
    setReading(false);
  }

  const info = categoryInfo(category);
  return (
    <div className={cn("flex flex-col gap-2.5", disabled && "pointer-events-none opacity-60")}>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) void add(e.dataTransfer.files);
        }}
        className={cn("flex cursor-pointer items-center gap-3 rounded-tile border border-dashed px-4 py-4 transition-colors", over ? "border-accent bg-accent-tint-soft" : "border-ink/20 bg-white/50 hover:bg-white/70")}
      >
        <Upload aria-hidden size={20} strokeWidth={1.6} className="shrink-0 text-accent" />
        <span className="flex flex-col">
          <span className="text-row font-semibold">{reading ? "Reading…" : `Drop ${info.example} here, or choose a file`}</span>
          <span className="text-meta text-ink-2">PDF, Word, PowerPoint or text · up to {LIMITS.examples}</span>
        </span>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.docx,.pptx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) void add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {examples.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {examples.map((e, i) => (
            <li key={`${e.name}-${i}`} className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-accent-tint pl-3 text-meta font-semibold text-accent-ink">
              <FileText aria-hidden size={14} className="shrink-0" />
              <span className="truncate">{e.name}</span>
              <button type="button" aria-label={`Remove ${e.name}`} onClick={() => onExamples(examples.filter((_, j) => j !== i))} className="flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-white/60">
                <X aria-hidden size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {errors.map((m) => (
        <p key={m} role="alert" className="text-meta font-medium text-red-ink">
          {m}
        </p>
      ))}
      {describe ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-semibold text-ink-2">Describe the format</span>
          <Textarea
            rows={3}
            value={description}
            maxLength={LIMITS.description}
            onChange={(e) => onDescription(e.target.value)}
            placeholder={category === "notes" ? "e.g. Cornell notes: a key terms box, then the notes, then three check-your-understanding questions" : category === "slides" ? "e.g. 10 slides, a title and up to four bullets each, a summary slide at the end" : "e.g. Section A: 20 multiple choice, 1 mark each. Section B: 5 short answers, 4 marks each. 90 minutes."}
            className="min-h-0 text-body"
          />
        </label>
      ) : (
        <button type="button" onClick={() => setDescribe(true)} className="self-start text-body font-semibold text-accent-ink hover:underline">
          Or describe it in words
        </button>
      )}
      {pool.length > 0 ? (
        pickMaterial ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="One of your Funza materials" value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="min-w-[220px] flex-1 [&_select]:h-11">
              <option value="">Choose one of your materials</option>
              {pool.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                  {m.status === "approved" || m.status === "published" ? " · approved" : ""}
                </option>
              ))}
            </Select>
            <Button variant="secondary" size="sm" loading={reading} disabled={!materialId} onClick={() => void addMaterial()}>
              Use it
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => setPickMaterial(true)} className="self-start text-body font-semibold text-accent-ink hover:underline">
            Or start from one of your Funza materials
          </button>
        )
      ) : null}
      <p className="flex items-center gap-2 text-meta text-ink-2">
        <Lock aria-hidden size={14} strokeWidth={1.6} className="shrink-0" />
        Funza reads it once to learn the format. The file isn&rsquo;t kept.
      </p>
    </div>
  );
}
