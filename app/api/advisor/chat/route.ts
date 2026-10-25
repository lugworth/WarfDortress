import { readAiRequest, textField, aiErrorResponse, AiRequestError } from '@/lib/ai-request';
import { CHAT_REQUEST_MAX_BYTES } from '@/lib/advisor-request';
import { NextRequest, NextResponse } from 'next/server';
import { generateWithModelFallback } from '@/lib/gemini-server';

const ALLOWED_MODELS = new Set([
  'gemini-4-argon',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
]);

function buildDeterministicAdvisorReply(
  fortressSummary: Record<string, unknown> | undefined,
  lastUserQuestion: string
): string {
  const name = String(fortressSummary?.fortressName || 'Deep Anvil');
  const year = Number(fortressSummary?.year || 251);
  const season = String(fortressSummary?.season || 'Granite (Spring)');
  const pop = Number(fortressSummary?.population || 7);
  const res = (fortressSummary?.resources as Record<string, number>) || {};
  const stone = res.stone ?? 20;
  const wood = res.wood ?? 18;
  const food = res.food ?? 40;
  const ale = res.ale ?? 25;
  const iron = res.ironOre ?? 0;
  const steel = res.steelBars ?? 0;

  const q = lastUserQuestion.toLowerCase();
  if (q.includes('z-mining') || q.includes('deeper') || q.includes('cavern') || q.includes('stairs')) {
    return `**Subterranean Excavation Counsel for ${name}:**\n- Select **Carve Stairs [X]** and place a stairway inside your main hall on **Z-0**; this automatically links to **Z-1 (Shallow Copper & Iron Seams)**.\n- Use the **[RADAR]** tab to scan **Z-1 through Z-5** for rich Iron (\`£\`), Gold (\`$\`), and Mithril (\`☼\`) veins before committing miners.\n- Keep your **Militia Doctrine** ready when breaching **Z-3 Fungal Caverns** and **Z-5 Magma Chambers**, where Giant Cave Spiders and Forgotten Beasts guard ancient relics!`;
  }
  if (q.includes('lore') || q.includes('legend') || q.includes('history')) {
    return `**From the Annals of ${name} (Year ${year}, ${season}):**\nOur seven founding pioneers struck the earth with ${stone} cut stone and ${wood} timber, determined to carve a seat of Mountainhome wealth. Every relic (\`☼\`) recovered from the deep caverns and every masterwork forged on our anvils inscribes a new chapter in the fortress chronicle!`;
  }

  const priorities: string[] = [];
  if (food < pop * 6 || ale < pop * 4) {
    priorities.push(
      `**1. Sustenance & Morale:** With **${food} Food** and **${ale} Ale** for **${pop} Dwarves**, designate **Plump Helmet Farms (\`=\`)** and a **Brewer's Still (\`&\`)** so thirst never slows our picks.`
    );
  } else {
    priorities.push(
      `**1. Expand Excavation:** Stockpiles hold **${stone} Stone** and **${wood} Wood**. Designate **Mine (D)** along the rich ore cliff outcrops to gather Iron and Gold.`
    );
  }

  if (iron > 0 && steel < 4) {
    priorities.push(
      `**2. Metallurgy & Arms:** You have **${iron} Iron Ore** ready! Construct a **Smeltery (\`£\`)** and **Forge (\`⚒\`)** to smelt **Steel Bars** and equip the militia with Battle Axes.`
    );
  } else {
    priorities.push(
      `**2. Smeltery & Defense:** Place **Stone Fall Traps (\`^\`)** along your fortress entrance and build a **Smeltery (\`£\`)** + **Forge (\`⚒\`)** to arm your squad before Goblin raiders arrive.`
    );
  }

  priorities.push(
    `**3. Civic Halls & Trade:** Construct a **Tavern (\`♫\`)**, **Temple (\`Ψ\`)**, and **Trade Depot (\`¤\`)** to boost clan morale and barter surplus crafts with seasonal caravans.`
  );

  return `**High Chronicler Bomrek’s Assessment (${name} · Y${year}):**\n${priorities.join('\n')}`;
}

export async function POST(req: NextRequest) {
  let body: {
    messages?: Array<{ role: string; parts?: Array<{ text?: string }> }>;
    fortressSummary?: Record<string, unknown>;
    model?: string;
  } = {};

  try {
    const payload = await readAiRequest(req, CHAT_REQUEST_MAX_BYTES);
    if (!Array.isArray(payload.messages) || payload.messages.length === 0 || payload.messages.length > 40) throw new AiRequestError('Expected 1–40 chat messages.');
    payload.messages.forEach((message) => {
      if (!message || !['user', 'model'].includes(message.role) || !Array.isArray(message.parts) || message.parts.length !== 1) throw new AiRequestError('Invalid chat message.');
      textField(message.parts[0]?.text, 4000);
    });
    if (payload.fortressSummary !== undefined && (!payload.fortressSummary || typeof payload.fortressSummary !== 'object' || Array.isArray(payload.fortressSummary))) throw new AiRequestError('Invalid fortress summary.');
    body = payload;
    const { messages = [], fortressSummary, model } = body;
    const preferredModel = ALLOWED_MODELS.has(model || '') ? String(model) : 'gemini-3.1-flash-lite';
    const fallbackOrder = Array.from(
      new Set([preferredModel, 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'])
    );

    const systemInstruction = `You are High Chronicler & Royal Fortress Advisor Bomrek Anvilward, counseling the Overseer of a Dwarven Fortress.
Current Fortress Telemetry:
${JSON.stringify(fortressSummary, null, 2)}

Role & Tone:
- Speak like a seasoned, pragmatic Dwarven engineer and lorekeeper.
- Give concrete, actionable advice tied to the player's actual resources, population, depth Z-level, and workshops.
- Keep responses concise (2-4 short paragraphs or bullet points) so they are easy to read and listen to via TTS.`;

    const result = await generateWithModelFallback({
      models: fallbackOrder,
      contents: messages as never,
      config: {
        systemInstruction,
      },
    });

    if (result?.text) {
      return NextResponse.json({
        text: result.text,
        modelUsed: result.modelUsed,
      });
    }

    const lastUserMsg =
      messages[messages.length - 1]?.parts?.[0]?.text || 'What should our priorities be?';
    return NextResponse.json({
      text: buildDeterministicAdvisorReply(fortressSummary, lastUserMsg),
      modelUsed: 'deterministic-chronicler',
    });
  } catch (error) {
    const invalid = aiErrorResponse(error); if (invalid) return invalid;
    const lastUserMsg =
      body.messages?.[body.messages.length - 1]?.parts?.[0]?.text || '';
    return NextResponse.json(
      {
        text: buildDeterministicAdvisorReply(body.fortressSummary, lastUserMsg),
        modelUsed: 'deterministic-chronicler',
      },
      { status: 200 }
    );
  }
}
