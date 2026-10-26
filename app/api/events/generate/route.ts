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
    } = await req.json();

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

    const raw = JSON.parse(result.text || '{}');
    if (!raw.title || !Array.isArray(raw.choices) || raw.choices.length === 0) {
      return NextResponse.json({ fallback: true }, { status: 200 });
    }

    const formattedEvent = {
      id: `evt-ai-${Date.now()}`,
      title: raw.title,
      severity: raw.severity || requestedSeverity || 'STRANGE_MOOD',
      asciiArt: raw.asciiArt || '  ╔═══════╗\n  ║ ⚒ 👑 ⚒ ║\n  ╚═══════╝',
      narrative: raw.narrative,
      historicalConnection: raw.historicalConnection,
      triggerReason:
        raw.triggerReason ||
        `AI Storyteller analyzed Year ${year} (${season}) stockpiles and world history.`,
      tickTriggered: ticks || 0,
      choices: raw.choices.map((c: Record<string, unknown>, idx: number) => {
        const cost: Record<string, number> = {};
        if (typeof c.stoneCost === 'number' && c.stoneCost > 0 && idx < 2) cost.stone = c.stoneCost;
        if (typeof c.woodCost === 'number' && c.woodCost > 0 && idx < 2) cost.wood = c.woodCost;
        if (typeof c.foodCost === 'number' && c.foodCost > 0 && idx < 2) cost.food = c.foodCost;

        const reward: Record<string, number> = {};
        if (typeof c.stoneReward === 'number' && c.stoneReward > 0) reward.stone = c.stoneReward;
        if (typeof c.foodReward === 'number' && c.foodReward > 0) reward.food = c.foodReward;
        if (typeof c.aleReward === 'number' && c.aleReward > 0) reward.ale = c.aleReward;
        if (typeof c.wealthReward === 'number' && c.wealthReward > 0)
          reward.wealth = c.wealthReward;

        return {
          id: String(c.id || `choice-${idx}`),
          label: String(c.label || `Decree Option ${idx + 1}`),
          description: String(c.description || ''),
          cost: Object.keys(cost).length > 0 ? cost : undefined,
          reward: Object.keys(reward).length > 0 ? reward : { wealth: 50 },
          moraleDelta: typeof c.moraleDelta === 'number' ? c.moraleDelta : 5,
          spawnMigrants: typeof c.spawnMigrants === 'number' ? c.spawnMigrants : 0,
          outcomeLog: String(c.outcomeLog || 'The Overseer’s decree was carried out.'),
        };
      }),
    };

    return NextResponse.json({ event: formattedEvent });
  } catch {
    return NextResponse.json({ fallback: true }, { status: 200 });
  }
}
