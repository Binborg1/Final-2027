"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ChoiceChip } from "@/components/ui/Chip";
import { Disclosure } from "@/components/ui/Disclosure";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { ToggleRow } from "@/components/ui/ToggleRow";
import { PRESETS } from "@/lib/resources/blueprint";
import { NOTES_STYLES, QTYPE_LABEL, QTYPE_ORDER } from "@/lib/resources/kinds";
import type { QType } from "@/lib/resources/types";
import { formatLine, isQuestionFormat, LIMITS, rowLine, sectionLetter, type NotesFormat, type QuestionFormat, type SlidesFormat, type TemplateFormat, type TemplatePart, type TemplateStyle } from "@/lib/templates/model";

/**
 * The skeleton of a template, ready to check and change. Every row starts collapsed
 * and shows its value, so the whole format reads at a glance (T1, "skeleton first").
 */
export function FormatEditor({ format, onChange }: { format: TemplateFormat; onChange: (f: TemplateFormat) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-row font-bold">Skeleton</h2>
        <span className="text-meta font-semibold text-ink-2">{formatLine(format)}</span>
      </div>
      {isQuestionFormat(format) ? <QuestionEditor f={format} onChange={onChange} /> : format.category === "notes" ? <NotesEditor f={format} onChange={onChange} /> : <SlidesEditor f={format} onChange={onChange} />}
      <StyleRows style={format.style} questions={isQuestionFormat(format)} onChange={(style) => onChange({ ...format, style })} />
    </div>
  );
}

/* ---------- quizzes, tests and exams ---------- */

function QuestionEditor({ f, onChange }: { f: QuestionFormat; onChange: (f: TemplateFormat) => void }) {
  const setSections = (sections: QuestionFormat["sections"]) => onChange({ ...f, sections });
  const move = (i: number, by: number) => {
    const next = [...f.sections];
    const [s] = next.splice(i, 1);
    next.splice(i + by, 0, s);
    setSections(next);
  };
  return (
    <>
      {f.sections.map((s, i) => (
        <Disclosure key={i} title={`${sectionLetter(i)} · ${s.title || "Untitled section"}`} summary={s.rows.map(rowLine).join(" · ")}>
          <label className="flex flex-col gap-1.5">
            <span className="text-meta font-semibold text-ink-2">Title</span>
            <Input value={s.title} maxLength={LIMITS.sectionTitle} onChange={(e) => setSections(f.sections.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="h-11" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-meta font-semibold text-ink-2">Instructions to students</span>
            <Textarea rows={2} value={s.instructions} maxLength={LIMITS.instructions} placeholder="e.g. Answer all questions. Show your work." onChange={(e) => setSections(f.sections.map((x, j) => (j === i ? { ...x, instructions: e.target.value } : x)))} className="min-h-0" />
          </label>
          <ul className="flex flex-col gap-2">
            {s.rows.map((r, k) => (
              <li key={r.type} className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Question type"
                  value={r.type}
                  onChange={(e) => setSections(f.sections.map((x, j) => (j === i ? { ...x, rows: x.rows.map((y, m) => (m === k ? { ...y, type: e.target.value as QType } : y)) } : x)))}
                  className="min-w-[170px] flex-1 [&_select]:h-10"
                >
                  {QTYPE_ORDER.filter((t) => t === r.type || !s.rows.some((y) => y.type === t)).map((t) => (
                    <option key={t} value={t}>
                      {QTYPE_LABEL[t]}
                    </option>
                  ))}
                </Select>
                <NumberStepper label={`${QTYPE_LABEL[r.type]}: questions`} value={r.count} min={1} max={LIMITS.count} suffix="q" onChange={(count) => setSections(f.sections.map((x, j) => (j === i ? { ...x, rows: x.rows.map((y, m) => (m === k ? { ...y, count } : y)) } : x)))} />
                <NumberStepper label={`${QTYPE_LABEL[r.type]}: marks each`} value={r.marks} min={1} max={LIMITS.marks} suffix="m" onChange={(marks) => setSections(f.sections.map((x, j) => (j === i ? { ...x, rows: x.rows.map((y, m) => (m === k ? { ...y, marks } : y)) } : x)))} />
                <IconButton icon={X} label={`Remove ${QTYPE_LABEL[r.type].toLowerCase()}`} disabled={s.rows.length === 1} onClick={() => setSections(f.sections.map((x, j) => (j === i ? { ...x, rows: x.rows.filter((_, m) => m !== k) } : x)))} />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-1">
            {s.rows.length < LIMITS.rows ? (
              <Button
                variant="ghost"
                size="sm"
                icon={Plus}
                onClick={() => {
                  const type = QTYPE_ORDER.find((t) => !s.rows.some((y) => y.type === t));
                  if (type) setSections(f.sections.map((x, j) => (j === i ? { ...x, rows: [...x.rows, { type, count: 1, marks: 1 }] } : x)));
                }}
              >
                Question type
              </Button>
            ) : null}
            <span className="ml-auto flex items-center">
              <IconButton icon={ArrowUp} label="Move section up" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton icon={ArrowDown} label="Move section down" disabled={i === f.sections.length - 1} onClick={() => move(i, 1)} />
              <IconButton icon={Trash2} label="Remove section" disabled={f.sections.length === 1} onClick={() => setSections(f.sections.filter((_, j) => j !== i))} />
            </span>
          </div>
        </Disclosure>
      ))}
      {f.sections.length < LIMITS.sections ? (
        <Button variant="ghost" size="sm" icon={Plus} className="self-start" onClick={() => setSections([...f.sections, { title: `Part ${sectionLetter(f.sections.length)}`, instructions: "", rows: [{ type: "short", count: 1, marks: 2 }] }])}>
          Add a section
        </Button>
      ) : null}
      <Disclosure title="Time and difficulty" summary={`${f.duration} min · ${PRESETS[f.difficulty].label}`}>
        <div className="flex items-center gap-3">
          <span className="flex-1 text-body font-medium">Time allowed</span>
          <NumberStepper label="Minutes" value={f.duration} min={5} max={240} step={5} suffix="min" onChange={(duration) => onChange({ ...f, duration })} />
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
            <ChoiceChip key={k} size="md" selected={f.difficulty === k} onClick={() => onChange({ ...f, difficulty: k })} suffix={PRESETS[k].split.join("/")}>
              {PRESETS[k].label}
            </ChoiceChip>
          ))}
        </div>
      </Disclosure>
      <Disclosure title="Extras" summary={[f.extras.answerKey && "Answer key", f.extras.workedSolutions && "Worked solutions", f.extras.rubric && "Rubric"].filter(Boolean).join(" · ") || "None"}>
        <ToggleRow label="Answer key" checked={f.extras.answerKey} onChange={(answerKey) => onChange({ ...f, extras: { ...f.extras, answerKey } })} />
        <ToggleRow label="Worked solutions" checked={f.extras.workedSolutions} onChange={(workedSolutions) => onChange({ ...f, extras: { ...f.extras, workedSolutions } })} />
        <ToggleRow label="Rubric for written answers" checked={f.extras.rubric} onChange={(rubric) => onChange({ ...f, extras: { ...f.extras, rubric } })} />
      </Disclosure>
    </>
  );
}

/* ---------- notes and slides ---------- */

function PartsRow({ parts, onChange }: { parts: TemplatePart[]; onChange: (p: TemplatePart[]) => void }) {
  const move = (i: number, by: number) => {
    const next = [...parts];
    const [p] = next.splice(i, 1);
    next.splice(i + by, 0, p);
    onChange(next);
  };
  return (
    <Disclosure title="Parts" summary={parts.map((p) => p.title).filter(Boolean).join(" · ") || "None"}>
      <ol className="flex flex-col gap-2">
        {parts.map((p, i) => (
          <li key={i} className="flex flex-col gap-1.5 rounded-[14px] bg-white/55 p-2.5">
            <div className="flex items-center gap-1">
              <Input aria-label={`Part ${i + 1}: title`} value={p.title} maxLength={LIMITS.partTitle} placeholder="Title" onChange={(e) => onChange(parts.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="h-10" />
              <IconButton icon={ArrowUp} label="Move part up" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton icon={ArrowDown} label="Move part down" disabled={i === parts.length - 1} onClick={() => move(i, 1)} />
              <IconButton icon={Trash2} label="Remove part" disabled={parts.length === 1} onClick={() => onChange(parts.filter((_, j) => j !== i))} />
            </div>
            <Input aria-label={`Part ${i + 1}: what goes here`} value={p.detail} maxLength={LIMITS.partDetail} placeholder="What goes here" onChange={(e) => onChange(parts.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))} className="h-10 text-body" />
          </li>
        ))}
      </ol>
      {parts.length < LIMITS.parts ? (
        <Button variant="ghost" size="sm" icon={Plus} className="self-start" onClick={() => onChange([...parts, { title: "", detail: "" }])}>
          Add a part
        </Button>
      ) : null}
    </Disclosure>
  );
}

function NotesEditor({ f, onChange }: { f: NotesFormat; onChange: (f: TemplateFormat) => void }) {
  return (
    <>
      <PartsRow parts={f.parts} onChange={(parts) => onChange({ ...f, parts })} />
      <Disclosure title="Style" summary={NOTES_STYLES.find((s) => s.id === f.notesStyle)?.label ?? "Follow the parts"}>
        <div className="flex flex-wrap gap-2">
          <ChoiceChip size="md" selected={f.notesStyle === null} onClick={() => onChange({ ...f, notesStyle: null })}>
            Follow the parts
          </ChoiceChip>
          {NOTES_STYLES.map((s) => (
            <ChoiceChip key={s.id} size="md" selected={f.notesStyle === s.id} onClick={() => onChange({ ...f, notesStyle: s.id })} title={s.blurb}>
              {s.label}
            </ChoiceChip>
          ))}
        </div>
      </Disclosure>
      <Disclosure title="Extras" summary={[f.keyTerms && "Key terms", f.checkQuestions && "Check questions"].filter(Boolean).join(" · ") || "None"}>
        <ToggleRow label="Key terms" checked={f.keyTerms} onChange={(keyTerms) => onChange({ ...f, keyTerms })} />
        <ToggleRow label="Check-your-understanding questions" checked={f.checkQuestions} onChange={(checkQuestions) => onChange({ ...f, checkQuestions })} />
      </Disclosure>
    </>
  );
}

function SlidesEditor({ f, onChange }: { f: SlidesFormat; onChange: (f: TemplateFormat) => void }) {
  return (
    <>
      <Disclosure title="Slides" summary={`${f.slides} slides · up to ${f.perSlide.maxBullets} bullets${f.speakerNotes ? " · speaker notes" : ""}`}>
        <div className="flex items-center gap-3">
          <span className="flex-1 text-body font-medium">Slides in a deck</span>
          <NumberStepper label="Slides" value={f.slides} min={3} max={30} onChange={(slides) => onChange({ ...f, slides })} />
        </div>
        <div className="flex items-center gap-3">
          <span className="flex-1 text-body font-medium">Most bullets on a slide</span>
          <NumberStepper label="Bullets" value={f.perSlide.maxBullets} min={1} max={8} onChange={(maxBullets) => onChange({ ...f, perSlide: { ...f.perSlide, maxBullets } })} />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-semibold text-ink-2">A content slide has</span>
          <Input value={f.perSlide.pattern} maxLength={160} placeholder="e.g. A short title, three to five bullets and one example" onChange={(e) => onChange({ ...f, perSlide: { ...f.perSlide, pattern: e.target.value } })} className="h-11" />
        </label>
        <ToggleRow label="Speaker notes" checked={f.speakerNotes} onChange={(speakerNotes) => onChange({ ...f, speakerNotes })} />
      </Disclosure>
      <PartsRow parts={f.parts} onChange={(parts) => onChange({ ...f, parts })} />
    </>
  );
}

/* ---------- wording style and cover page (every category) ---------- */

const NUMBERING_LABEL: Record<TemplateStyle["numbering"], string> = { continuous: "Numbered straight through", "per-section": "Numbering restarts in each section" };
const MARKS_LABEL: Record<TemplateStyle["marksShown"], string> = { brackets: "Marks in brackets", margin: "Marks in the margin", none: "Marks not shown" };

function StyleRows({ style, questions, onChange }: { style: TemplateStyle; questions: boolean; onChange: (s: TemplateStyle) => void }) {
  const rules = style.wording.filter((w) => w.trim()).length;
  return (
    <>
      <Disclosure title="Wording style" summary={[rules ? `${rules} rule${rules === 1 ? "" : "s"}` : "No rules", questions && MARKS_LABEL[style.marksShown].toLowerCase()].filter(Boolean).join(" · ")}>
        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-semibold text-ink-2">One rule per line, up to {LIMITS.wording}</span>
          <Textarea
            rows={4}
            value={style.wording.join("\n")}
            placeholder={"e.g. Questions start with a command verb (Calculate, Explain)\nSI units throughout"}
            onChange={(e) => onChange({ ...style, wording: e.target.value.split("\n").slice(0, LIMITS.wording) })}
            className="min-h-0 text-body"
          />
        </label>
        {questions ? (
          <>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(NUMBERING_LABEL) as TemplateStyle["numbering"][]).map((k) => (
                <ChoiceChip key={k} size="md" selected={style.numbering === k} onClick={() => onChange({ ...style, numbering: k })}>
                  {NUMBERING_LABEL[k]}
                </ChoiceChip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MARKS_LABEL) as TemplateStyle["marksShown"][]).map((k) => (
                <ChoiceChip key={k} size="md" selected={style.marksShown === k} onClick={() => onChange({ ...style, marksShown: k })}>
                  {MARKS_LABEL[k]}
                </ChoiceChip>
              ))}
            </div>
          </>
        ) : null}
      </Disclosure>
      <Disclosure title="Cover page" summary={style.cover ? `${style.cover.instructions.filter((x) => x.trim()).length} instructions` : "None"}>
        <ToggleRow label="Has a cover page" checked={!!style.cover} onChange={(on) => onChange({ ...style, cover: on ? { title: "", instructions: [] } : null })} />
        {style.cover ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-meta font-semibold text-ink-2">Title on the cover</span>
              <Input value={style.cover.title} maxLength={LIMITS.coverLine} placeholder="e.g. Unit test" onChange={(e) => onChange({ ...style, cover: { ...style.cover!, title: e.target.value } })} className="h-11" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-meta font-semibold text-ink-2">Instructions, one per line</span>
              <Textarea rows={3} value={style.cover.instructions.join("\n")} placeholder={"e.g. Write your name on every page\nCalculators are allowed"} onChange={(e) => onChange({ ...style, cover: { ...style.cover!, instructions: e.target.value.split("\n").slice(0, LIMITS.coverLines) } })} className="min-h-0 text-body" />
            </label>
          </>
        ) : null}
      </Disclosure>
    </>
  );
}

function IconButton({ icon: Icon, label, disabled, onClick }: { icon: typeof X; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-white hover:text-ink disabled:opacity-35 pointer-coarse:size-11">
      <Icon aria-hidden size={16} strokeWidth={1.75} />
    </button>
  );
}
