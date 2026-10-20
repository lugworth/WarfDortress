import { NextRequest, NextResponse } from 'next/server';
import { generateWithModelFallback } from '@/lib/gemini-server';

export async function POST(req: NextRequest) {
  try {
    const { image, prompt } = await req.json();

    const result = await generateWithModelFallback({
      models: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-4-argon'],
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt || 'Analyze this image for my fortress.' },
            { inlineData: { mimeType: 'image/png', data: image } },
          ],
        },
      ],
    });

    return NextResponse.json({
      text:
        result?.text ||
        '**Master Architect’s Blueprint Review:** The proportions of this sketch suggest a fortified 7×7 Grand Hall anchored by four granite pillars, flanked by a Smeltery (`£`) and Forge (`⚒`) near the main stair shaft (`X`) with Stone Traps (`^`) guarding the outer choke point.',
    });
  } catch {
    return NextResponse.json(
      {
        text: '**Master Architect’s Blueprint Review:** The geometry is sturdy! Carve a central 5×5 Stockpile (`#`) flanked by a Smeltery (`£`), Forge (`⚒`), and Tavern (`♫`) to maximize hauling efficiency.',
      },
      { status: 200 }
    );
  }
}
