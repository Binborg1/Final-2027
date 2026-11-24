import { ArrowRight, Check } from "lucide-react";
import { Overline } from "@/components/ui/Card";
import { partPrefix, questionNumbers, textBlocks, type TextBlock } from "@/lib/library/model";
import { isQuestionKind } from "@/lib/resources/kinds";
import { answerLines, matchOrder } from "@/lib/resources/render";
import type { Item, ResourceKind, Section } from "@/lib/resources/types";
import type { TemplateStyle } from "@/lib/templates/model";
import { cn } from "@/lib/ui/cn";

/**
 * An approved version, read-only. The teacher copy shows everything: correct
 * options, answers, worked solutions, rubrics and slide speaker notes. The student
 * copy follows the printed copy (lib/resources/render.ts): no answers, keys,
 * solutions or rubrics, and lines where students write.
 */
export function MaterialDocument({ kind, sections, style, teacher }: { kind: ResourceKind; sections: Section[]; style: TemplateStyle | null; teacher: boolean }) {
  const assessment = isQuestionKind(kind);
  const slides = kind === "presentation";
  const numbers = questionNumbers(sections, style?.numbering === "per-section");
  const marksShown = style?.marksShown ?? "default";

  if (sections.length === 0) return <p className="text-body text-ink-2">This version has no content.</p>;

  return (
    <div className="flex flex-col gap-7">
      {sections.map((s, index) => {
        const sub = s.items.reduce((n, i) => n + i.marks, 0);
        const heading = `${partPrefix(sections, s, assessment)}${s.title || (slides ? `Slide ${index + 1}` : "Section")}`;
        const { blocks, speakerNotes } = textBlocks(s.body, teacher && slides);
        return (
          <section key={s.id} aria-label={heading} className={cn("flex flex-col gap-3", slides && "rounded-tile border border-white/85 bg-white/60 px-5 py-4")}>
            {slides ? <Overline>Slide {index + 1}</Overline> : null}
            <h3 className="text-card font-bold">
              {heading}
              {assessment && s.kind === "questions" ? <span className="font-semibold text-ink-2"> ({sub} marks)</span> : null}
            </h3>
            {s.kind !== "questions" ? <Blocks blocks={blocks} /> : null}
            {s.kind === "questions" && s.body ? <p className="text-body text-ink-2 italic">{s.body}</p> : null}
            {speakerNotes ? (
              <div className="rounded-[14px] bg-white/70 px-4 py-3">
                <Overline>Speaker notes</Overline>
                <p className="mt-1 text-body whitespace-pre-wrap">{speakerNotes}</p>
              </div>
            ) : null}
            {s.items.length > 0 ? (
              <ol className="flex flex-col gap-5">
                {s.items.map((it) => (
                  <li key={it.id}>
                    <Question item={it} number={numbers.get(it.id) ?? 0} teacher={teacher} marksShown={marksShown} />
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function Blocks({ blocks }: { blocks: TextBlock[] }) {
  return (
    <div className="flex flex-col gap-2.5 text-row leading-6">
      {blocks.map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>{b.text}</p>
        ) : (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-6">
            {b.items.map((t, j) => (
              <li key={j}>{t}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

function Question({ item: i, number, teacher, marksShown }: { item: Item; number: number; teacher: boolean; marksShown: TemplateStyle["marksShown"] | "default" }) {
  const marks = marksShown === "none" ? null : marksShown === "brackets" ? `(${i.marks} mark${i.marks === 1 ? "" : "s"})` : `[${i.marks}]`;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex gap-2 text-row leading-6">
        <span className="shrink-0 font-bold">{number}.</span>
        <span className="flex-1 whitespace-pre-wrap">{i.prompt || "This question has no text."}</span>
        {marks ? <span className="shrink-0 font-semibold text-ink-2">{marks}</span> : null}
      </p>
      <div className="flex flex-col gap-2 pl-6">
        <Body item={i} teacher={teacher} />
        {teacher ? <Key item={i} /> : null}
      </div>
    </div>
  );
}

/** The question's options, pairs or answer space. */
function Body({ item: i, teacher }: { item: Item; teacher: boolean }) {
  if (i.type === "mcq") {
    return (
      <ul className="flex flex-col gap-1.5">
        {i.options.map((o, n) => {
          const right = teacher && o.id === i.correctId;
          return (
            <li key={o.id} className={cn("flex items-center gap-3 rounded-[14px] px-3.5 py-2 text-body", right ? "bg-sage-tint font-semibold text-sage-ink" : "bg-white/70")}>
              <span className="w-5 shrink-0 font-semibold">{String.fromCharCode(65 + n)}</span>
              <span className="flex-1">{o.text}</span>
              {right ? (
                <span className="inline-flex items-center gap-1 text-meta font-semibold">
                  <Check aria-hidden size={14} strokeWidth={2.6} /> Correct
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }
  if (i.type === "tf") {
    if (!teacher) return <p className="text-body">True &nbsp;&nbsp;&nbsp; False</p>;
    return null;
  }
  if (i.type === "match") {
    if (teacher) {
      return (
        <ul className="flex flex-col gap-1.5 text-body">
          {i.pairs.map((p, n) => (
            <li key={n} className="flex items-center gap-3 rounded-[14px] bg-white/70 px-3.5 py-2">
              <span className="flex-1">{p.left}</span>
              <ArrowRight aria-label="matches" size={14} className="text-ink-2" />
              <span className="flex-1">{p.right}</span>
            </li>
          ))}
        </ul>
      );
    }
    const order = matchOrder(i.pairs.length);
    return (
      <table className="text-body">
        <tbody>
          {i.pairs.map((p, n) => (
            <tr key={n}>
              <td className="py-0.5 pr-8">
                {n + 1}. {p.left}
              </td>
              <td className="py-0.5">
                {String.fromCharCode(65 + n)}. {i.pairs[order[n]]?.right ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (teacher) return null;
  if (i.type === "calc") return <p className="text-body">Answer: ______________________</p>;
  if (i.type === "short" || i.type === "long") {
    return (
      <div aria-label="Space for the answer" className="flex flex-col">
        {Array.from({ length: answerLines(i.type, i.marks) }, (_, n) => (
          <span key={n} className="h-7 border-b border-line-2" />
        ))}
      </div>
    );
  }
  return null;
}

/** The teacher copy's answer, worked solution and rubric. */
function Key({ item: i }: { item: Item }) {
  const answer = i.type === "tf" ? (i.tf === null ? "" : i.tf ? "True" : "False") : i.type === "mcq" || i.type === "match" ? "" : i.answer;
  if (!answer && !i.solution && i.rubric.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-sage-tint/60 px-4 py-3 text-body">
      {answer ? (
        <p>
          <span className="font-semibold">Answer: </span>
          {answer}
          {i.calc?.unit && !answer.includes(i.calc.unit) ? ` ${i.calc.unit}` : ""}
        </p>
      ) : null}
      {i.solution ? (
        <div>
          <p className="font-semibold">Worked solution</p>
          <p className="whitespace-pre-wrap">{i.solution}</p>
        </div>
      ) : null}
      {i.rubric.length > 0 ? (
        <div>
          <p className="font-semibold">Rubric</p>
          <ul className="mt-1 flex flex-col gap-1">
            {i.rubric.map((r, n) => (
              <li key={n} className="flex gap-3">
                <span className="flex-1">{r.text}</span>
                <span className="font-semibold">{r.marks}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
