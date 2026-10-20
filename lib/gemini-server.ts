import { GoogleGenAI, GenerateContentConfig, ContentListUnion } from '@google/genai';

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
