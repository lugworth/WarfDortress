import { NextRequest, NextResponse } from 'next/server';
import { generateWithModelFallback, readJsonBody, textModels } from '@/lib/gemini-server';

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function POST(req: NextRequest) {
  try {
    // The client accepts images up to 2 MB, which is about 2.7 MB as base64.
    const { image, mimeType, prompt } = await readJsonBody(req, 3_000_000);
    if (typeof image !== 'string' || !image) throw new TypeError('Missing image');

    const result = await generateWithModelFallback({
      models: textModels(),
      contents: [
        {
          role: 'user',
          parts: [
            { text: String(prompt || 'Analyze this image for my fortress.').slice(0, 500) },
            { inlineData: { mimeType: IMAGE_TYPES.has(String(mimeType)) ? String(mimeType) : 'image/png', data: image } },
          ],
        },
      ],
    });

    if (result?.text) return NextResponse.json({ text: result.text, modelUsed: result.modelUsed });
    return NextResponse.json({
      fallback: true,
      text: '**Master Architect’s Blueprint Review:** The proportions of this sketch suggest a fortified 7×7 Grand Hall anchored by four granite pillars, flanked by a Smeltery (`£`) and Forge (`⚒`) near the main stair shaft (`X`) with Stone Traps (`^`) guarding the outer choke point.',
    });
  } catch {
    return NextResponse.json(
      {
        fallback: true,
        text: '**Master Architect’s Blueprint Review:** The geometry is sturdy! Carve a central 5×5 Stockpile (`#`) flanked by a Smeltery (`£`), Forge (`⚒`), and Tavern (`♫`) to maximize hauling efficiency.',
      },
      { status: 200 }
    );
  }
}
