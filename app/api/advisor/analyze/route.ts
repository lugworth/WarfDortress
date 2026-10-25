import { readAiRequest, textField, aiErrorResponse, AiRequestError } from '@/lib/ai-request';
import { NextRequest, NextResponse } from 'next/server';
import { generateWithModelFallback } from '@/lib/gemini-server';

export async function POST(req: NextRequest) {
  try {
    const body = await readAiRequest(req, 3000000);
    const image = textField(body.image, 2_800_000);
    const prompt = textField(body.prompt, 2000, false);
    const mimeType = textField(body.mimeType, 32);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) throw new AiRequestError('Unsupported image format.');

    const result = await generateWithModelFallback({
      models: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-4-argon'],
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt || 'Analyze this image for my fortress.' },
            { inlineData: { mimeType, data: image } },
          ],
        },
      ],
    });

    return NextResponse.json({
      fallback: !result,
      text:
        result?.text ||
        '**Master Architect’s Blueprint Review:** The proportions of this sketch suggest a fortified 7×7 Grand Hall anchored by four granite pillars, flanked by a Smeltery (`£`) and Forge (`⚒`) near the main stair shaft (`X`) with Stone Traps (`^`) guarding the outer choke point.',
    });
  } catch (error) {
    const invalid = aiErrorResponse(error); if (invalid) return invalid;
    return NextResponse.json(
      {
        fallback: true,
        text: '**Master Architect’s Blueprint Review:** The geometry is sturdy! Carve a central 5×5 Stockpile (`#`) flanked by a Smeltery (`£`), Forge (`⚒`), and Tavern (`♫`) to maximize hauling efficiency.',
      },
      { status: 200 }
    );
  }
}
