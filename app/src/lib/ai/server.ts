import "server-only";

/**
 * Server-side AI access. Keys live only in environment variables on the server
 * and never reach the browser. Gemini is Funza's provider; an OpenAI-compatible
 * endpoint (Groq, OpenRouter, or a test double through FUNZA_AI_BASE_URL) can
 * stand in during development. One provider is active at a time:
 *   FUNZA_AI_PROVIDER = gemini | groq | openrouter
 *   FUNZA_AI_API_KEY  = the key (or the provider's own variable, see providerKeys)
 *   FUNZA_AI_MODEL    = optional model override
 */
export type Provider = "gemini" | "groq" | "openrouter";

const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
};

/** Gemini first, so it wins when several keys are set. Read on each call. */
function providerKeys(): Record<Provider, string | undefined> {
  return { gemini: process.env.GEMINI_API_KEY, groq: process.env.GROQ_API_KEY, openrouter: process.env.OPENROUTER_API_KEY };
}

/** Long drafts can take a while; anything slower than this is treated as a failure. */
const TIMEOUT_MS = 120_000;

export type AiConfig = { provider: Provider; key: string; model: string };

export function aiConfig(): AiConfig | null {
  const keys = providerKeys();
  const explicit = process.env.FUNZA_AI_PROVIDER as Provider | undefined;
  const detected = (Object.keys(keys) as Provider[]).find((p) => keys[p]);
  const provider = explicit && explicit in DEFAULT_MODELS ? explicit : detected;
  if (!provider) return null;
  const key = process.env.FUNZA_AI_API_KEY || keys[provider];
  if (!key) return null;
  return { provider, key, model: process.env.FUNZA_AI_MODEL || DEFAULT_MODELS[provider] };
}

export type AiErrorCode = "not-configured" | "auth" | "rate-limit" | "refused" | "provider" | "empty" | "truncated" | "timeout";

/** Messages are safe to show a teacher: they never contain provider replies or keys. */
export class AiError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type Completion = { system: string; user: string; maxTokens: number };

export async function complete(input: Completion): Promise<string> {
  const cfg = aiConfig();
  if (!cfg) throw new AiError("not-configured", "No AI provider is configured on the server.");
  switch (cfg.provider) {
    case "gemini":
      return geminiComplete(cfg, input);
    case "groq":
      return openAiCompatible(cfg, "https://api.groq.com/openai/v1", input);
    case "openrouter":
      return openAiCompatible(cfg, "https://openrouter.ai/api/v1", input);
  }
}

async function send(provider: Provider, url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new AiError("timeout", "The AI provider took too long to answer. Try again in a moment.");
    }
    console.error(`${provider} request failed:`, error instanceof Error ? error.message : "unknown error");
    throw new AiError("provider", "The AI provider could not be reached.");
  }
  if (res.ok) return res;
  // The provider's reply is logged on the server only; the teacher gets a plain message.
  const body = await res.text().catch(() => "");
  console.error(`${provider} returned ${res.status}:`, body.slice(0, 500));
  if (res.status === 401 || res.status === 403) throw new AiError("auth", `The ${provider} API key was rejected.`);
  if (res.status === 429) throw new AiError("rate-limit", `Rate limited by ${provider}; try again in a moment.`);
  throw new AiError("provider", `The AI provider returned an error (${res.status}).`);
}

async function openAiCompatible(cfg: AiConfig, defaultBase: string, { system, user, maxTokens }: Completion): Promise<string> {
  // FUNZA_AI_BASE_URL points an OpenAI-compatible provider at another endpoint (a self-hosted model, or a test double).
  const base = (process.env.FUNZA_AI_BASE_URL || defaultBase).replace(/\/+$/, "");
  const res = await send(cfg.provider, `${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") throw new AiError("truncated", "The AI reply was cut off before it finished. Ask for fewer questions and try again.");
  const text = choice?.message?.content?.trim();
  if (!text) throw new AiError("empty", "The model returned no text.");
  return text;
}

type GeminiReply = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

async function geminiComplete(cfg: AiConfig, { system, user, maxTokens }: Completion): Promise<string> {
  // The key goes in a header, never in the URL, so it can't end up in request logs.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const res = await send(cfg.provider, url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  const data = (await res.json()) as GeminiReply;
  if (data.promptFeedback?.blockReason) throw new AiError("refused", "Gemini declined this request. Try different wording, or start from the question bank.");
  const candidate = data.candidates?.[0];
  const finish = candidate?.finishReason;
  if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT" || finish === "BLOCKLIST" || finish === "SPII") {
    throw new AiError("refused", "Gemini declined this request. Try different wording, or start from the question bank.");
  }
  if (finish === "MAX_TOKENS") throw new AiError("truncated", "The AI reply was cut off before it finished. Ask for fewer questions and try again.");
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new AiError("empty", "The model returned no text.");
  return text;
}
