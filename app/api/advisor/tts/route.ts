import { NextRequest, NextResponse } from 'next/server';
import {
  getGeminiClient,
  isModelAvailable,
  isQuotaOrRateLimitError,
  markModelCooldown,
  readJsonBody,
  TTS_MODELS,
} from '@/lib/gemini-server';

export async function POST(req: NextRequest) {
  try {
    const { text } = await readJsonBody(req, 8_000);
    const client = getGeminiClient();
    if (!text || !client) {
      return NextResponse.json({ audio: null, fallback: true }, { status: 200 });
    }

    for (const model of TTS_MODELS) {
      if (!isModelAvailable(model)) continue;
      try {
        const response = await client.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: String(text).slice(0, 420) }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Puck' },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          return NextResponse.json({ audio: base64Audio, modelUsed: model });
        }
      } catch (err) {
        if (isQuotaOrRateLimitError(err)) {
          markModelCooldown(model, 30 * 60 * 1000);
          continue;
        }
        markModelCooldown(model, 60 * 1000);
      }
    }

    return NextResponse.json({ audio: null, fallback: true }, { status: 200 });
  } catch {
    return NextResponse.json({ audio: null, fallback: true }, { status: 200 });
  }
}
