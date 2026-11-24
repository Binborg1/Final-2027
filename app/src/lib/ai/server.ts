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

/** A reply's text, the model that wrote it, and its token counts (0 when the provider leaves them out), for `ai_usage`. */
export type CompletionResult = { text: string; model: string; tokensIn: number; tokensOut: number };

/** A token count from a provider reply: a whole number from 0 to the largest Postgres int. */
function tokens(...values: unknown[]): number {
  const sum = values.reduce<number>((total, v) => total + (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0), 0);
  return Math.min(sum, 2_147_483_647);
}

/** The model the provider says answered (an alias can resolve to a newer one), or the one requested. */
function modelName(reported: unknown, requested: string): string {
  return typeof reported === "string" && reported.trim() ? reported.trim() : requested;
}

/** Every caller asks for one JSON object, so the Gemini path requests a JSON reply. */
export async function complete(input: Completion): Promise<CompletionResult> {
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

type OpenAiReply = {
  model?: string;
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

async function openAiCompatible(cfg: AiConfig, defaultBase: string, { system, user, maxTokens }: Completion): Promise<CompletionResult> {
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
  const data = (await res.json()) as OpenAiReply;
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") throw new AiError("truncated", "The AI reply was cut off before it finished. Ask for fewer questions and try again.");
  const text = choice?.message?.content?.trim();
  if (!text) throw new AiError("empty", "The model returned no text.");
  return { text, model: modelName(data.model, cfg.model), tokensIn: tokens(data.usage?.prompt_tokens), tokensOut: tokens(data.usage?.completion_tokens) };
}

type GeminiReply = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};

async function geminiComplete(cfg: AiConfig, { system, user, maxTokens }: Completion): Promise<CompletionResult> {
  // The key goes in a header, never in the URL, so it can't end up in request logs.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const res = await send(cfg.provider, url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens, responseMimeType: "application/json" },
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
  // Thinking tokens are billed as output, so they count with the reply's own.
  const usage = data.usageMetadata;
  return { text, model: modelName(data.modelVersion, cfg.model), tokensIn: tokens(usage?.promptTokenCount), tokensOut: tokens(usage?.candidatesTokenCount, usage?.thoughtsTokenCount) };
}

/**
 * Like `complete`, but reports the reply as it grows (`onText` gets the text so
 * far), so Make can show progress on long drafts. Gemini streams its reply
 * (server-sent events); the other providers answer in one piece and report once.
 * The same checks run on the finished reply.
 */
export async function completeStream(input: Completion, onText: (soFar: string) => void): Promise<CompletionResult> {
  const cfg = aiConfig();
  if (!cfg) throw new AiError("not-configured", "No AI provider is configured on the server.");
  if (cfg.provider !== "gemini") {
    const result = await complete(input);
    onText(result.text);
    return result;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse`;
  const res = await send(cfg.provider, url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts: [{ text: input.user }] }],
      generationConfig: { maxOutputTokens: input.maxTokens, responseMimeType: "application/json" },
    }),
  });
  if (!res.body) throw new AiError("empty", "The model returned no text.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let finish: string | undefined;
  let blocked = false;
  let model: unknown;
  let usage: GeminiReply["usageMetadata"];
  const take = (line: string) => {
    if (!line.startsWith("data:")) return;
    let chunk: GeminiReply;
    try {
      chunk = JSON.parse(line.slice(5).trim()) as GeminiReply;
    } catch {
      return;
    }
    if (chunk.promptFeedback?.blockReason) blocked = true;
    const candidate = chunk.candidates?.[0];
    const part = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (candidate?.finishReason) finish = candidate.finishReason;
    if (chunk.modelVersion) model = chunk.modelVersion;
    if (chunk.usageMetadata) usage = chunk.usageMetadata;
    if (part) {
      text += part;
      onText(text);
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        take(buffer.slice(0, nl).replace(/\r$/, ""));
        buffer = buffer.slice(nl + 1);
      }
    }
    if (buffer) take(buffer.trim());
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) throw new AiError("timeout", "The AI provider took too long to answer. Try again in a moment.");
    throw new AiError("provider", "The AI provider stopped answering part-way. Try again.");
  }

  if (blocked || finish === "SAFETY" || finish === "PROHIBITED_CONTENT" || finish === "BLOCKLIST" || finish === "SPII") {
    throw new AiError("refused", "Gemini declined this request. Try different wording, or start from the question bank.");
  }
  if (finish === "MAX_TOKENS") throw new AiError("truncated", "The AI reply was cut off before it finished. Ask for fewer questions and try again.");
  if (!text.trim()) throw new AiError("empty", "The model returned no text.");
  return { text: text.trim(), model: modelName(model, cfg.model), tokensIn: tokens(usage?.promptTokenCount), tokensOut: tokens(usage?.candidatesTokenCount, usage?.thoughtsTokenCount) };
}

/** How many questions (or sections) a partial JSON reply has started, for progress. */
export function writtenSoFar(text: string, unit: "items" | "sections"): number {
  return (text.match(unit === "items" ? /"prompt"\s*:/g : /"body"\s*:/g) ?? []).length;
}
