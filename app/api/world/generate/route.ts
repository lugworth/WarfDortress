import { readAiRequest, textField, aiErrorResponse, AiRequestError } from '@/lib/ai-request';
import { Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { generateWithModelFallback } from '@/lib/gemini-server';

const loreCache = new Map<string, { backstory: string; history: unknown[] }>();

export async function POST(req: NextRequest) {
  try {
    const { seed, dwarvenName, name, civilizations } = await readAiRequest(req, 16000);
    textField(seed, 1024); textField(dwarvenName, 80); textField(name, 120);
    const cacheKey = JSON.stringify([seed, dwarvenName, name, civilizations]);

    if (loreCache.has(cacheKey)) {
      return NextResponse.json(loreCache.get(cacheKey));
    }

    const prompt = `Generate a rich Dwarven chronicle backstory and 5 historical events for the procedural fantasy world "${name}" (Dwarven Hold: "${dwarvenName}", Seed: "${seed}").
Civilizations present: ${JSON.stringify(civilizations)}.`;

    const result = await generateWithModelFallback({
      models: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'],
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
    if (typeof parsed.backstory !== 'string' || parsed.backstory.length > 8000 || !Array.isArray(parsed.history) || parsed.history.length > 10 || parsed.history.length === 0 || !parsed.history.every((event: Record<string, unknown>) => event && Number.isSafeInteger(event.year) && ['Age of Myth', 'Age of Stone', 'Age of Anvils'].includes(String(event.era)) && ['FOUNDING', 'WAR', 'ARTIFACT', 'BEAST', 'DISCOVERY'].includes(String(event.category)) && typeof event.title === 'string' && typeof event.description === 'string' && event.title.length < 300 && event.description.length < 2000)) return NextResponse.json({ fallback: true });
    if (parsed.backstory && Array.isArray(parsed.history)) {
      if (loreCache.size >= 100) loreCache.delete(loreCache.keys().next().value!);
      loreCache.set(cacheKey, parsed);
    }
    return NextResponse.json(parsed);
  } catch (error) {
    const invalid = aiErrorResponse(error); if (invalid) return invalid;
    return NextResponse.json({ fallback: true }, { status: 200 });
  }
}
