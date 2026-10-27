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
      choices: raw.choices.slice(0, 4).map((c: Record<string, unknown>, idx: number) => {
        // Model output is untrusted: keep costs, rewards, and migrants in game-sized ranges.
        const amount = (value: unknown, max: number) =>
          typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0;
        const cost: Record<string, number> = {};
        if (idx < 2) {
          if (amount(c.stoneCost, 30)) cost.stone = amount(c.stoneCost, 30);
          if (amount(c.woodCost, 30)) cost.wood = amount(c.woodCost, 30);
          if (amount(c.foodCost, 30)) cost.food = amount(c.foodCost, 30);
        }

        const reward: Record<string, number> = {};
        if (amount(c.stoneReward, 40)) reward.stone = amount(c.stoneReward, 40);
        if (amount(c.foodReward, 40)) reward.food = amount(c.foodReward, 40);
        if (amount(c.aleReward, 40)) reward.ale = amount(c.aleReward, 40);
        if (amount(c.wealthReward, 400)) reward.wealth = amount(c.wealthReward, 400);

        return {
          id: String(c.id || `choice-${idx}`).slice(0, 60),
          label: String(c.label || `Decree Option ${idx + 1}`).slice(0, 160),
          description: String(c.description || '').slice(0, 400),
          cost: Object.keys(cost).length > 0 ? cost : undefined,
          reward: Object.keys(reward).length > 0 ? reward : { wealth: 50 },
          moraleDelta:
            typeof c.moraleDelta === 'number' && Number.isFinite(c.moraleDelta)
              ? Math.max(-15, Math.min(15, Math.round(c.moraleDelta)))
              : 5,
          spawnMigrants: amount(c.spawnMigrants, 2),
          outcomeLog: String(c.outcomeLog || 'The Overseer’s decree was carried out.').slice(0, 400),
        };
      }),
    };

    return NextResponse.json({ event: formattedEvent });
  } catch {
    return NextResponse.json({ fallback: true }, { status: 200 });
  }
}
