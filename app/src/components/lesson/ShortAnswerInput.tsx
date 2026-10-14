import type { ShortAnswerQuestion } from "@/lib/types";

const MAX_LENGTH = 300;

type Props = {
  question: ShortAnswerQuestion;
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
};

export function ShortAnswerInput({ question, value, onChange, disabled }: Props) {
  return (
    <div className="mt-4">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_LENGTH))}
        disabled={disabled}
        placeholder={question.placeholder ?? "Type your answer here..."}
        rows={4}
        aria-label={question.prompt}
        className="w-full resize-y rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6 outline-none transition-shadow focus:border-coral focus:ring-4 focus:ring-coral/20 disabled:bg-sand disabled:text-smoke"
      />
      <div className="mt-1 text-right text-xs font-semibold text-smoke/70">
        {value.length}/{MAX_LENGTH}
      </div>
    </div>
  );
}
