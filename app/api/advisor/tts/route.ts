import { readAiRequest, textField, aiErrorResponse, AiRequestError } from '@/lib/ai-request';
import { NextRequest, NextResponse } from 'next/server';
import {
  getGeminiClient,
  isModelAvailable,
  isQuotaOrRateLimitError,
  markModelCooldown,
} from '@/lib/gemini-server';

const TTS_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];

export async function POST(req: NextRequest) {
  try {
    const body = await readAiRequest(req, 4000);
    const text = textField(body.text, 420);
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
            httpOptions: { timeout: 15_000 },
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Puck' },
              },
            },
          },
        });

        const audioPart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
        const base64Audio = audioPart?.data;
        if (base64Audio) {
          return NextResponse.json({ audio: base64Audio, mimeType: audioPart?.mimeType, modelUsed: model });
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
  } catch (error) {
    const invalid = aiErrorResponse(error); if (invalid) return invalid;
    return NextResponse.json({ audio: null, fallback: true }, { status: 200 });
  }
}
