/**
 * Image support for the tutor: which configured models can read a screenshot,
 * and what an incoming image payload must look like. Pure, so it is tested.
 */
export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";
export type ImageInput = { mediaType: ImageMediaType; data: string };

/** A 1280-pixel-wide JPEG screenshot is a few hundred kilobytes; this leaves room, not a loophole. */
export const MAX_IMAGE_BASE64_CHARS = 6_000_000;

/**
 * Whether the provider's model accepts images. `override` is FUNZA_AI_VISION
 * ("true" or "false") for models the heuristics do not know.
 */
export function supportsVision(provider: string, model: string, override?: string): boolean {
  if (override === "true") return true;
  if (override === "false") return false;
  const m = model.toLowerCase();
  switch (provider) {
    case "anthropic":
      return true;
    case "gemini":
      return !/embedding|aqa|tts|audio/.test(m);
    case "groq":
      return /llama-4|vision|scout|maverick/.test(m);
    case "openrouter":
      return /gpt-4o|gpt-4\.1|gpt-5|\bo[34]\b|claude|gemini|gemma-3|llama-4|llama-3\.2-(11|90)b-vision|pixtral|qwen[^/]*vl|vision|grok-4|nova/.test(m);
    default:
      return false;
  }
}

const MEDIA_TYPES: ImageMediaType[] = ["image/jpeg", "image/png", "image/webp"];
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Accepts a data URL ("data:image/jpeg;base64,...") or { mediaType, data } and
 * returns the parts, or null for anything else: wrong type, not base64, too big.
 */
export function parseImagePayload(raw: unknown): ImageInput | null {
  let mediaType: string | undefined;
  let data: string | undefined;
  if (typeof raw === "string") {
    const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(raw.trim());
    if (!m) return null;
    mediaType = m[1].toLowerCase();
    data = m[2];
  } else if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.mediaType === "string" && typeof o.data === "string") {
      mediaType = o.mediaType.toLowerCase();
      data = o.data;
    }
  }
  if (!mediaType || !data) return null;
  if (!(MEDIA_TYPES as string[]).includes(mediaType)) return null;
  const clean = data.replace(/\s+/g, "");
  if (clean.length < 64 || clean.length > MAX_IMAGE_BASE64_CHARS || !BASE64.test(clean)) return null;
  return { mediaType: mediaType as ImageMediaType, data: clean };
}
