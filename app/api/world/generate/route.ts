import { Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { generateWithModelFallback, readJsonBody, textModels } from '@/lib/gemini-server';

// Seeds come from players, so the cache is bounded (oldest entries leave first).
const MAX_CACHED_WORLDS = 200;
const loreCache = new Map<string, { backstory: string; history: unknown[] }>();

export async function POST(req: NextRequest) {
  try {
    const { seed, dwarvenName, name, civilizations } = await readJsonBody(req, 16_000);
    const cacheKey = String(seed || name || 'default').slice(0, 64);

    if (loreCache.has(cacheKey)) {
      return NextResponse.json(loreCache.get(cacheKey));
    }

    const prompt = `Generate a rich Dwarven chronicle backstory and 5 historical events for the procedural fantasy world "${name}" (Dwarven Hold: "${dwarvenName}", Seed: "${seed}").
Civilizations present: ${JSON.stringify(civilizations)}.`;

    const result = await generateWithModelFallback({
      models: textModels(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            backstory: {
              type: Type.STRING,
              description:
                '2-3 atmospheric sentences describing the geology, ancient history, and stakes of the embark.',
            },
            history: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  year: { type: Type.INTEGER },
                  era: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  category: { type: Type.STRING },
                },
                required: ['year', 'era', 'title', 'description', 'category'],
              },
            },
          },
          required: ['backstory', 'history'],
        },
      },
    });

    if (!result) {
      return NextResponse.json({ fallback: true, quotaFallback: true }, { status: 200 });
    }

    const parsed = JSON.parse(result.text || '{}');
    if (parsed.backstory && Array.isArray(parsed.history)) {
      if (loreCache.size >= MAX_CACHED_WORLDS) loreCache.delete(loreCache.keys().next().value!);
      loreCache.set(cacheKey, parsed);
    }
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ fallback: true }, { status: 200 });
  }
}
