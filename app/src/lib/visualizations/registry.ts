import { ExprError } from "./expr";
import { SHARED_SCHEMA_DOC } from "./generic/common";
import { functionGraph } from "./generic/functionGraph";
import { geometryScene } from "./generic/geometryScene";
import { nodeDiagram } from "./generic/nodeDiagram";
import { processSequence } from "./generic/processSequence";
import { quantityModel } from "./generic/quantityModel";
import { packetTransmission } from "./packetTransmission";
import { pcmSampling } from "./pcmSampling";
import { protocolLayers } from "./protocolLayers";
import { VISUALIZATION_TYPES, VisualizationSchemaError, type VisualizationConfig, type VisualizationDefinition, type VisualizationParams, type VisualizationType } from "./types";

/**
 * Every visualization Funza can show, by name. Five are generic building blocks
 * whose content comes from the lesson or the AI; three are specialized
 * networking demonstrations whose content is computed. Adding one means a
 * definition here and a scene in `src/components/visualizations/scenes/`;
 * the tutor, the AI prompts and the validation below pick it up from this map.
 */
export const registry: { [K in VisualizationType]: VisualizationDefinition<VisualizationParams[K]> } = {
  "function-graph": functionGraph,
  "node-diagram": nodeDiagram,
  "process-sequence": processSequence,
  "quantity-model": quantityModel,
  "geometry-scene": geometryScene,
  "packet-transmission": packetTransmission,
  "pcm-sampling": pcmSampling,
  "protocol-layers": protocolLayers,
};

export function isVisualizationType(value: unknown): value is VisualizationType {
  return typeof value === "string" && (VISUALIZATION_TYPES as readonly string[]).includes(value);
}

/** The definition behind a type, typed loosely for code that handles any visualization. */
export function definitionOf(type: VisualizationType): VisualizationDefinition<Record<string, unknown>> {
  return registry[type] as unknown as VisualizationDefinition<Record<string, unknown>>;
}

/**
 * Turns an untrusted request ({ type, params }) into a validated config, or null
 * when it cannot be shown: an unknown type, or a config the type's schema
 * rejects. Values in range pass through; out-of-range numbers are clamped and
 * missing optional fields take defaults. The caller falls back to an ordinary
 * explanation on null; nothing in the request is ever executed.
 */
export function validateVisualization(raw: unknown): VisualizationConfig | null {
  const result = checkVisualization(raw);
  return result.ok ? result.config : null;
}

/** Like validateVisualization, but says why a request was refused (for tests and logs). */
export function checkVisualization(raw: unknown): { ok: true; config: VisualizationConfig } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "not an object" };
  const { type, params } = raw as { type?: unknown; params?: unknown };
  if (!isVisualizationType(type)) return { ok: false, reason: `unsupported type ${JSON.stringify(type)}` };
  const given = params && typeof params === "object" && !Array.isArray(params) ? (params as Record<string, unknown>) : {};
  const def = definitionOf(type);
  try {
    const normalized = def.family === "specialized" ? def.normalize({ ...def.defaults, ...given }) : def.normalize(given);
    return { ok: true, config: { type, params: normalized } as VisualizationConfig };
  } catch (error) {
    if (error instanceof VisualizationSchemaError || error instanceof ExprError) return { ok: false, reason: `${type}: ${error.message}` };
    throw error;
  }
}

/** The catalogue in words, for the AI lesson prompt. */
export function describeVisualizationsForPrompt(): string {
  const lines = VISUALIZATION_TYPES.map((type) => {
    const def = definitionOf(type);
    return `- "${type}": use for ${def.useWhen}. Params: ${def.schemaDoc}`;
  });
  return `${SHARED_SCHEMA_DOC}\nTypes (the generic ones take the shared fields plus their own; the networking ones take only their params):\n${lines.join("\n")}`;
}
