import { GoogleGenAI, type GenerateContentConfig, type ContentListUnion } from '@google/genai';

// Stable Gemini API model codes, cheapest first. Google recommends 3.5 Flash-Lite
// or 3.8 Flash for new projects: https://ai.google.dev/gemini-api/docs/models
export const TEXT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'] as const;
export const ADVISOR_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-4-argon'] as const;
export const TTS_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'] as const;

/** The fallback chain with `preferred` tried first. */
export function textModels(preferred?: string): string[] {
  return [...new Set([...(preferred ? [preferred] : []), ...TEXT_MODELS])];
}

/**
 * Reads a JSON request body, refusing anything larger than `maxBytes`. These
 * routes spend the server's Gemini key, so they never accept unbounded input.
 */
export async function readJsonBody<T = Record<string, unknown>>(req: Request, maxBytes: number): Promise<T> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new RangeError('Request body too large');
  const text = await req.text();
  if (text.length > maxBytes) throw new RangeError('Request body too large');
  const body = JSON.parse(text);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('Expected a JSON object');
  return body as T;
}

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | undefined;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedKey = apiKey;
  }
  return cachedClient;
}

// Track models that recently hit 429 RESOURCE_EXHAUSTED so we skip them immediately
const modelCooldownUntil = new Map<string, number>();

export function isQuotaOrRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    msg.includes('Quota exceeded')
  );
}

export function markModelCooldown(model: string, durationMs = 15 * 60 * 1000) {
  modelCooldownUntil.set(model, Date.now() + durationMs);
}

export function isModelAvailable(model: string): boolean {
  const until = modelCooldownUntil.get(model);
  if (!until) return true;
  if (Date.now() > until) {
    modelCooldownUntil.delete(model);
    return true;
  }
  return false;
}

export async function generateWithModelFallback(options: {
  models: string[];
  contents: ContentListUnion;
  config?: GenerateContentConfig;
}): Promise<{ text: string; modelUsed: string } | null> {
  const client = getGeminiClient();
  if (!client) {
    return null;
  }

  const candidateModels = options.models.filter(isModelAvailable);
  if (candidateModels.length === 0) {
    return null;
  }

  for (const model of candidateModels) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      if (response.text) {
        return { text: response.text, modelUsed: model };
      }
    } catch (error) {
      if (isQuotaOrRateLimitError(error)) {
        markModelCooldown(model, 30 * 60 * 1000);
        continue;
      }
      // Non-quota error on this model: mark short cooldown and try next model
      markModelCooldown(model, 60 * 1000);
    }
  }

  return null;
}
