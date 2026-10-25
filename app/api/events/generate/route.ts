import { formatGeneratedEvent } from '@/lib/event-validation';
import { readAiRequest, textField, aiErrorResponse, AiRequestError } from '@/lib/ai-request';
import { Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { generateWithModelFallback } from '@/lib/gemini-server';

export async function POST(req: NextRequest) {
  try {
    const {
      worldName,
      dwarvenName,
      year,
      season,
      ticks,
      resources,
      population,
      civilizations,
      history,
      pastEvents,
      requestedSeverity,
    } = await readAiRequest(req, 64000);

    textField(worldName, 120); textField(dwarvenName, 80); textField(season, 40);
    if (!Number.isSafeInteger(year) || !Number.isSafeInteger(ticks) || !Number.isSafeInteger(population)) throw new AiRequestError('Invalid simulation telemetry.');
    const prompt = `Generate a rich, interactive Dwarf Fortress-style narrative event for the fortress "${dwarvenName}" in "${worldName}" (Year ${year}, ${season}, Tick ${ticks}).
Current Fortress State:
- Population: ${population} Dwarves
- Stockpiles: ${JSON.stringify(resources)}
- World Civilizations: ${JSON.stringify(civilizations)}
- World Historical Annals: ${JSON.stringify(history)}
- Past Player Decisions: ${JSON.stringify(pastEvents || [])}
${requestedSeverity ? `- Requested Event Category: ${requestedSeverity}` : ''}

Requirements:
- Tie the event directly to the world's civilizations, historical eras, and current resource stockpiles.
- Explain in triggerReason how the current simulation state or past player choices triggered this event.
- Include a compact 4-line ASCII art emblem (max 24 chars per line).
- Provide 3 distinct player choices:
  1. An ambitious choice that costs some resources (e.g., stone, wood, ironOre, food, or ale) and grants high wealth/morale or a migrant.
  2. A balanced tactical choice with modest cost and reward.
  3. A free/cautious choice with zero cost so the player is never soft-locked.`;

    const result = await generateWithModelFallback({
      models: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'],
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            severity: {
              type: Type.STRING,
              enum: [
                'MINOR_OMEN',
                'STRANGE_MOOD',
                'TRADE_CARAVAN',
                'DIPLOMATIC_ENVOY',
                'MAJOR_CRISIS',
              ],
            },
            asciiArt: { type: Type.STRING },
            narrative: { type: Type.STRING },
            historicalConnection: { type: Type.STRING },
            triggerReason: { type: Type.STRING },
            choices: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  description: { type: Type.STRING },
                  stoneCost: { type: Type.INTEGER },
                  woodCost: { type: Type.INTEGER },
                  foodCost: { type: Type.INTEGER },
                  stoneReward: { type: Type.INTEGER },
                  foodReward: { type: Type.INTEGER },
                  aleReward: { type: Type.INTEGER },
                  wealthReward: { type: Type.INTEGER },
                  moraleDelta: { type: Type.INTEGER },
                  spawnMigrants: { type: Type.INTEGER },
                  outcomeLog: { type: Type.STRING },
                },
                required: ['id', 'label', 'description', 'outcomeLog'],
              },
            },
          },
          required: [
            'title',
            'severity',
            'asciiArt',
            'narrative',
            'historicalConnection',
            'triggerReason',
            'choices',
          ],
        },
      },
    });

    if (!result) {
      return NextResponse.json({ fallback: true, quotaFallback: true }, { status: 200 });
    }

    const formattedEvent = formatGeneratedEvent(JSON.parse(result.text || '{}'), Number(ticks));
    if (!formattedEvent) return NextResponse.json({ fallback: true });

    return NextResponse.json({ event: formattedEvent });
  } catch (error) {
    const invalid = aiErrorResponse(error); if (invalid) return invalid;
    return NextResponse.json({ fallback: true }, { status: 200 });
  }
}
