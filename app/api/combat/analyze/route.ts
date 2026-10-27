import { Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { generateWithModelFallback, readJsonBody, textModels } from '@/lib/gemini-server';

export async function POST(req: NextRequest) {
  try {
    const {
      dwarvenName,
      year,
      season,
      ticks,
      wealth,
      wallCount,
      doorCount,
      trapCount,
      stockpileCount,
      squads,
      goblinCiv,
    } = await readJsonBody<Record<string, unknown> & { goblinCiv?: { name?: string; ruler?: string } }>(req, 32_000);

    const prompt = `You are the AI Combat Director for a Dwarf Fortress-style simulation at "${dwarvenName}" (Year ${year}, ${season}, Tick ${ticks}).
Analyze the fortress defenses and generate an AI-driven Goblin Raid Battle Plan for "${goblinCiv?.name || 'The Fang Scourge'}" led by "${goblinCiv?.ruler || 'Warlord Snagtooth'}":
- Fortress Wealth: ${wealth}
- Constructed Stone Walls: ${wallCount}, Portal Doors: ${doorCount}, Stone Traps: ${trapCount}, Stockpile Tiles: ${stockpileCount}
- Dwarven Militia Squads: ${JSON.stringify(squads || [])}

Select the most fitting raid tactic from:
- GATE_BREAKER (armored troll breaker + pike raiders smashing fortified portals/walls)
- PINCER_FLANK (twin flanking packs bypassing stone traps from North and South)
- SAPPING_SWARM (fast goblin outriders rushing the surface stairs and workers)
- TROPHY_PLUNDER (veteran reavers charging high-wealth stockpiles)

Provide a dramatic warlord battle cry, a concise target summary, and a specific tactical counter-recommendation referencing Station (♦) or Patrol (») squad orders.`;

    const result = await generateWithModelFallback({
      models: textModels('gemini-3.8-flash'),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            raidName: { type: Type.STRING },
            tactic: {
              type: Type.STRING,
              enum: ['GATE_BREAKER', 'PINCER_FLANK', 'SAPPING_SWARM', 'TROPHY_PLUNDER'],
            },
            threatLevel: {
              type: Type.STRING,
              enum: ['MODERATE', 'HIGH', 'SEVERE'],
            },
            warlordQuote: { type: Type.STRING },
            targetSummary: { type: Type.STRING },
            recommendedCounter: { type: Type.STRING },
          },
          required: [
            'raidName',
            'tactic',
            'threatLevel',
            'warlordQuote',
            'targetSummary',
            'recommendedCounter',
          ],
        },
      },
    });

    if (!result) {
      return NextResponse.json({ fallback: true }, { status: 200 });
    }

    const raw = JSON.parse(result.text || '{}');
    if (!raw.raidName || !raw.tactic) {
      return NextResponse.json({ fallback: true }, { status: 200 });
    }

    return NextResponse.json({
      plan: {
        raidName: String(raw.raidName),
        tactic: raw.tactic,
        threatLevel: raw.threatLevel || 'HIGH',
        warlordQuote: String(raw.warlordQuote || '"Sound the iron horns — take the mountain gate!"'),
        targetSummary: String(raw.targetSummary || 'Coordinated goblin assault on the surface gate.'),
        recommendedCounter: String(
          raw.recommendedCounter ||
            'Station Squad 1 (♦) at the gate choke-point and Patrol Squad 2 (») along the flank.'
        ),
        aiGenerated: true,
      },
    });
  } catch {
    return NextResponse.json({ fallback: true }, { status: 200 });
  }
}
