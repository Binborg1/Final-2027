import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-side AI access. Keys live only in environment variables on the
 * server, never in the browser, matching the project's "server proxy holds the
 * keys" design. One provider is active at a time:
 *   FUNZA_AI_PROVIDER = anthropic | groq | openrouter | gemini
 *   FUNZA_AI_API_KEY  = the key (or the provider's own variable, see below)
 *   FUNZA_AI_MODEL    = optional model override
 */
export type Provider = "anthropic" | "groq" | "openrouter" | "gemini";

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-opus-5-5",
  groq: "llama-3.3-70b-versatile",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
  gemini: "gemini-2.5-flash",
};

const PROVIDER_KEYS: Record<Provider, string | undefined> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  groq: process.env.GROQ_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
};

export type AiConfig = { provider: Provider; key: string; model: string };

export function aiConfig(): AiConfig | null {
  const explicit = process.env.FUNZA_AI_PROVIDER as Provider | undefined;
  const detected = (Object.keys(PROVIDER_KEYS) as Provider[]).find((p) => PROVIDER_KEYS[p]);
  const provider = explicit && explicit in DEFAULT_MODELS ? explicit : detected;
  if (!provider) return null;
  const key = process.env.FUNZA_AI_API_KEY || PROVIDER_KEYS[provider];
  if (!key) return null;
  return { provider, key, model: process.env.FUNZA_AI_MODEL || DEFAULT_MODELS[provider] };
}

export class AiError extends Error {
  constructor(
    public code: "not-configured" | "auth" | "rate-limit" | "refused" | "provider" | "empty",
    message: string,
  ) {
    super(message);
  }
}

type Completion = { system: string; user: string; maxTokens: number };

export async function complete(input: Completion): Promise<string> {
  const cfg = aiConfig();
  if (!cfg) throw new AiError("not-configured", "No AI provider is configured on the server.");
  switch (cfg.provider) {
    case "anthropic":
      return anthropicComplete(cfg, input);
    case "gemini":
      return geminiComplete(cfg, input);
    case "groq":
      return openAiCompatible(cfg, "https://api.groq.com/openai/v1", input);
    case "openrouter":
      return openAiCompatible(cfg, "https://openrouter.ai/api/v1", input);
  }
}

async function anthropicComplete(cfg: AiConfig, { system, user, maxTokens }: Completion): Promise<string> {
  const client = new Anthropic({ apiKey: cfg.key });
  // Server-side refusal fallback routes a declined request to a sibling model inside the same call.
  const supportsFallback = /^claude-(opus-5-5|opus-5|sonnet-5-5|fable-5-1)$/.test(cfg.model);
  try {
    const response = supportsFallback
      ? await client.beta.messages.create({
          model: cfg.model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        })
      : await client.messages.create({
          model: cfg.model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        });
    if (response.stop_reason === "refusal") {
      throw new AiError("refused", "The model declined to answer this question.");
    }
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) throw new AiError("empty", "The model returned no text.");
    return text;
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new AiError("auth", "The Anthropic API key was rejected.");
    if (error instanceof Anthropic.RateLimitError) throw new AiError("rate-limit", "Rate limited by Anthropic; try again in a moment.");
    if (error instanceof Anthropic.APIError) throw new AiError("provider", `Anthropic error ${error.status}: ${error.message}`);
    throw error;
  }
}

async function openAiCompatible(cfg: AiConfig, defaultBase: string, { system, user, maxTokens }: Completion): Promise<string> {
  // FUNZA_AI_BASE_URL points an OpenAI-compatible provider at another endpoint (a self-hosted model, or a test double).
  const base = (process.env.FUNZA_AI_BASE_URL || defaultBase).replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
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
  await throwForStatus(res, cfg.provider);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AiError("empty", "The model returned no text.");
  return text;
}

async function geminiComplete(cfg: AiConfig, { system, user, maxTokens }: Completion): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  await throwForStatus(res, cfg.provider);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new AiError("empty", "The model returned no text.");
  return text;
}

async function throwForStatus(res: Response, provider: Provider) {
  if (res.ok) return;
  const body = await res.text().catch(() => "");
  if (res.status === 401 || res.status === 403) throw new AiError("auth", `The ${provider} API key was rejected.`);
  if (res.status === 429) throw new AiError("rate-limit", `Rate limited by ${provider}; try again in a moment.`);
  throw new AiError("provider", `${provider} error ${res.status}: ${body.slice(0, 200)}`);
}
