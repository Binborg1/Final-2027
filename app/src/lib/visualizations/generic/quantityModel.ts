import { compileExpr, type Numberish } from "../expr";
import type { Quantity, QuantityModelParams, QuantityStage, VisualizationDefinition } from "../types";
import { fail, genericApplyControl, genericCheckpoints, genericControls, genericDescribe, genericSteps, id, isRecord, LIMITS, list, num, numberish, optText, readBase, rec, resolve, text, varsAt } from "./common";

export const QUANTITY_LIMITS = { quantities: 12 } as const;

export function normalizeQuantityModel(raw: Record<string, unknown>): QuantityModelParams {
  const parameterKeys = list(raw.parameters, "parameters", LIMITS.parameters)
    .map((p) => (isRecord(p) && typeof p.key === "string" ? p.key : ""))
    .filter(Boolean);
  const ids = new Set<string>();
  const quantities: Quantity[] = list(raw.quantities, "quantities", QUANTITY_LIMITS.quantities, 1).map((q, i) => {
    const qr = rec(q, `quantities[${i}]`);
    let qid = id(qr.id, "quantity id", `q${i + 1}`);
    while (ids.has(qid)) qid = `${qid}-${i + 1}`;
    ids.add(qid);
    const expression = optText(qr.expression, 200);
    if (expression) {
      try {
        compileExpr(expression, parameterKeys);
      } catch (error) {
        fail(`quantities[${i}]: ${(error as Error).message}`);
      }
    }
    return { id: qid, label: text(qr.label, `quantities[${i}].label`, LIMITS.label, qid), unit: optText(qr.unit, 12), expression, value: num(qr.value, "quantity value", -1e6, 1e6, 0) };
  });

  const base = readBase<QuantityStage>(raw, (s, i, vars) => {
    const values: Record<string, Numberish> = {};
    if (isRecord(s.values)) {
      for (const [k, v] of Object.entries(s.values)) if (ids.has(k)) values[k] = numberish(v, `stages[${i}].values.${k}`, vars);
    }
    const highlight = list(s.highlight, "highlight", QUANTITY_LIMITS.quantities).filter((x): x is string => typeof x === "string" && ids.has(x));
    return { values, highlight };
  });
  const max = raw.max === undefined || raw.max === null ? null : num(raw.max, "max", 1e-6, 1e6);
  return { ...base, quantities, max };
}

/** Every quantity's value at a step: the stage's override, else its formula, else its fixed value. */
export function quantityValues(params: QuantityModelParams, step: number): Record<string, number> {
  const stage = params.stages[Math.min(step, params.stages.length - 1)];
  const vars = varsAt(params.parameters, stage);
  const out: Record<string, number> = {};
  for (const q of params.quantities) {
    if (stage && q.id in stage.values) out[q.id] = resolve(stage.values[q.id], vars, 0);
    else if (q.expression) {
      try {
        const v = compileExpr(q.expression, Object.keys(vars))(vars);
        out[q.id] = Number.isFinite(v) ? v : 0;
      } catch {
        out[q.id] = 0;
      }
    } else out[q.id] = q.value;
  }
  return out;
}

export const quantityModel: VisualizationDefinition<QuantityModelParams> = {
  type: "quantity-model",
  family: "generic",
  title: "Quantities",
  summary: "Named quantities shown as labelled bars that grow, shrink and light up as the sliders move or the steps go on.",
  useWhen: "comparing amounts, showing how one quantity depends on others (a formula with sliders), arrays of values being compared, swapped or sorted, or totals that change over a sequence",
  schemaDoc: `"quantities": 1 to ${QUANTITY_LIMITS.quantities} [{"id", "label", "unit"?, "expression"?: formula over the parameter keys, "value"?: fixed number}], "max"?: top of the bar scale (null fits automatically), and per stage: "values"?: {quantity id: number or formula} overriding values for that step (use this for arrays being sorted), "highlight"?: [quantity ids to light up].`,
  defaults: {
    title: null,
    observe: null,
    parameters: [],
    stages: [{ id: "stage-1", caption: "The quantities.", values: {}, highlight: [] }],
    checkpoints: [],
    quantities: [{ id: "q1", label: "Value", unit: null, expression: null, value: 1 }],
    max: null,
  },
  normalize: normalizeQuantityModel,
  controls: genericControls,
  applyControl: genericApplyControl,
  steps: genericSteps,
  checkpoints: genericCheckpoints,
  describe: (p) => genericDescribe(p, "Quantities", `${p.quantities.map((q) => q.label).join(", ")} shown as bars.`),
};
