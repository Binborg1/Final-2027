/** A model reply that cannot be used. The message is shown to the teacher. */
export class SchemaError extends Error {}

/** A reply that isn't readable JSON at all: usually a one-off slip by the model, so worth one more try. */
export class JsonSyntaxError extends SchemaError {}

/** Pulls the first JSON object out of a model reply, tolerating code fences and chatter. */
export function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new JsonSyntaxError("The model did not return JSON.");
  try {
    const value = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new SchemaError("Expected a JSON object.");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SchemaError) throw error;
    throw new JsonSyntaxError("The model returned invalid JSON.");
  }
}
