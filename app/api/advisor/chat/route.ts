import { NextRequest, NextResponse } from 'next/server';
import { ADVISOR_MODELS, generateWithModelFallback, readJsonBody, textModels } from '@/lib/gemini-server';

const ALLOWED_MODELS = new Set<string>(ADVISOR_MODELS);
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 2000;

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

  const anecdotes = Array.isArray(fortressSummary?.thoughtsAndFeelings)
    ? (fortressSummary.thoughtsAndFeelings as Array<{
        dwarfName?: string;
        dwarfTitle?: string;
        text?: string;
        sentiment?: string;
        category?: string;
        moraleDelta?: number;
      }>)
    : [];

  const q = lastUserQuestion.toLowerCase();
  if (
    q.includes('thought') ||
    q.includes('feeling') ||
    q.includes('tale') ||
    q.includes('anecdote') ||
    q.includes('story') ||
    q.includes('plump helmet') ||
    q.includes('terrifying beast')
  ) {
    const featured = anecdotes.slice(0, 3);
    const lines =
      featured.length > 0
        ? featured.map(
            (a) =>
              `- **${a.dwarfName || 'Urist'}** (*${a.dwarfTitle || 'Pioneer'}*, ${a.sentiment || 'STEADY'}): "${a.text}"`
          )
        : [
            `- **Urist McPick** (*Expedition Leader*): "Ate a plump helmet roast seasoned with cave-salt beside the embark wagon."`,
            `- **Mebzuth Stonehand** (*Deep Delver*): "Saw a terrifying beast silhouette stalking the crags above the mountain pass!"`,
          ];
    return `**Chronicle of Hearts & Minds in ${name} (Year ${year}, ${season}):**\nFrom the candlelit tables of our halls, I have inscribed the personal joys and terrors of our clan:\n${lines.join('\n')}\n\nKeep the **Hearth Tavern (\`♫\`)** stocked with **${ale} Ale** and **${food} Plump Helmet Roasts**, and station armed militia near the caverns so terrifying beasts never break our pioneers' spirit!`;
  }
  if (q.includes('z-mining') || q.includes('deeper') || q.includes('cavern') || q.includes('stairs')) {
    return `**Subterranean Excavation Counsel for ${name}:**\n- Select **Carve Stairs [X]** and place a stairway inside your main hall on **Z-0**; this automatically links to **Z-1 (Shallow Copper & Iron Seams)**.\n- Use the **[RADAR]** tab to scan **Z-1 through Z-5** for rich Iron (\`£\`), Gold (\`$\`), and Mithril (\`☼\`) veins before committing miners.\n- Keep your **Militia Doctrine** ready when breaching **Z-3 Fungal Caverns** and **Z-5 Magma Chambers**, where Giant Cave Spiders and Forgotten Beasts guard ancient relics!`;
  }
  if (q.includes('lore') || q.includes('legend') || q.includes('history')) {
    const topAnecdote = anecdotes[0];
    const personalNote = topAnecdote
      ? `\n\nEven today, **${topAnecdote.dwarfName}** is remembered in the rolls: *"${topAnecdote.text}"*`
      : '';
    return `**From the Annals of ${name} (Year ${year}, ${season}):**\nOur seven founding pioneers struck the earth with ${stone} cut stone and ${wood} timber, determined to carve a seat of Mountainhome wealth. Every relic (\`☼\`) recovered from the deep caverns and every masterwork forged on our anvils inscribes a new chapter in the fortress chronicle!${personalNote}`;
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

  if (anecdotes.length > 0) {
    const recent = anecdotes[0];
    priorities.push(
      `**4. Clan Sentiment (${recent.dwarfName}):** *"${recent.text}"* (${recent.sentiment})`
    );
  }

  return `**High Chronicler Bomrek’s Assessment (${name} · Y${year}):**\n${priorities.join('\n')}`;
}

export async function POST(req: NextRequest) {
  let body: {
    messages?: Array<{ role: string; parts?: Array<{ text?: string }> }>;
    fortressSummary?: Record<string, unknown>;
    model?: string;
  } = {};

  try {
    body = await readJsonBody(req, 128_000);
    const { fortressSummary, model } = body;
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-MAX_MESSAGES).map((m) => ({
      role: m?.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m?.parts?.[0]?.text ?? '').slice(0, MAX_MESSAGE_CHARS) }],
    }));
    const fallbackOrder = textModels(ALLOWED_MODELS.has(model || '') ? model : undefined);

    const systemInstruction = `You are High Chronicler & Royal Fortress Advisor Bomrek Anvilward, counseling the Overseer of a Dwarven Fortress.
Current Fortress Telemetry & Dwarven Thoughts/Feelings Log:
${JSON.stringify(fortressSummary, null, 2)}

Role & Tone:
- Speak like a seasoned, pragmatic Dwarven engineer, chronicler, and storyteller.
- Weave specific dwarves' names and their recent "thoughtsAndFeelings" anecdotes (such as eating a plump helmet roast, seeing a terrifying beast, quaffing ale, or unearthing ore) directly into your counsel and storytelling.
- Give concrete, actionable advice tied to the player's actual resources, population, depth Z-level, and workshops.
- Keep responses concise (2-4 short paragraphs or bullet points) so they are easy to read and listen to via TTS.`;

    const result = await generateWithModelFallback({
      models: fallbackOrder,
      contents: messages,
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
  } catch {
    const lastUserMsg = Array.isArray(body.messages)
      ? String(body.messages[body.messages.length - 1]?.parts?.[0]?.text ?? '').slice(0, MAX_MESSAGE_CHARS)
      : '';
    return NextResponse.json(
      {
        text: buildDeterministicAdvisorReply(body.fortressSummary, lastUserMsg),
      },
      { status: 200 }
    );
  }
}
