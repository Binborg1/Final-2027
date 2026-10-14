"use client";

import { motion } from "framer-motion";
import { spring } from "@/components/motion";
import type { McqQuestion } from "@/lib/types";

type Props = {
  question: McqQuestion;
  value: string;
  onChange: (optionId: string) => void;
  disabled?: boolean;
};

export function McqInput({ question, value, onChange, disabled }: Props) {
  return (
    <div role="radiogroup" aria-label={question.prompt} className="mt-4 grid gap-2.5">
      {question.options.map((option) => {
        const selected = option.id === value;
        return (
          <motion.button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            whileHover={disabled ? undefined : { y: -1, scale: 1.004 }}
            whileTap={disabled ? undefined : { scale: 0.99 }}
            transition={spring}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-[background-color,border-color,box-shadow] duration-150 disabled:cursor-default ${
              selected
                ? "border-coral bg-peach/60 text-charcoal shadow-card"
                : "border-line bg-white text-charcoal hover:border-coral/60 hover:bg-sand disabled:hover:border-line disabled:hover:bg-white"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                selected ? "border-coral bg-coral" : "border-line bg-white"
              }`}
            >
              {selected && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            {option.text}
          </motion.button>
        );
      })}
    </div>
  );
}
