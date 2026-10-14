import type { ProcessSequenceParams, ProcessStage, VisualizationDefinition } from "../types";
import { genericApplyControl, genericCheckpoints, genericControls, genericDescribe, genericSteps, LIMITS, list, readBase, rec, text } from "./common";

export const PROCESS_LIMITS = { facts: 5 } as const;

export function normalizeProcessSequence(raw: Record<string, unknown>): ProcessSequenceParams {
  return readBase<ProcessStage>(raw, (s, i) => ({
    title: text(s.title, `stages[${i}].title`, 28, `Step ${i + 1}`),
    facts: list(s.facts, "facts", PROCESS_LIMITS.facts).map((f, j) => {
      const fr = rec(f, `stages[${i}].facts[${j}]`);
      return { label: text(fr.label, "fact label", LIMITS.label), value: text(fr.value, "fact value", LIMITS.label) };
    }),
  }));
}

export const processSequence: VisualizationDefinition<ProcessSequenceParams> = {
  type: "process-sequence",
  family: "generic",
  title: "Process",
  summary: "A process as a chain of named steps; the current step lights up and a short list of facts describes the state at that step.",
  useWhen: "a procedure, life cycle, pipeline, algorithm outline or any ordered series of stages where what matters is the order and what changes at each stage",
  schemaDoc: `per stage: "title": the step's short name (shown in its box), "facts"?: up to ${PROCESS_LIMITS.facts} [{"label", "value"}] describing the state at that step (values may embed {formulas}).`,
  defaults: {
    title: null,
    observe: null,
    parameters: [],
    stages: [
      { id: "stage-1", caption: "The first step.", title: "Start", facts: [] },
      { id: "stage-2", caption: "The second step.", title: "Next", facts: [] },
    ],
    checkpoints: [],
  },
  normalize: normalizeProcessSequence,
  controls: genericControls,
  applyControl: genericApplyControl,
  steps: genericSteps,
  checkpoints: genericCheckpoints,
  describe: (p) => genericDescribe(p, "Process", `A process in ${p.stages.length} steps: ${p.stages.map((s) => s.title).join(", ")}.`),
};
