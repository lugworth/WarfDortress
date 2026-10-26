import type {
  DwarfEntity,
  DwarfQuirk,
  DwarfThoughtEntry,
  FortressResources,
  HostileEntity,
  ThoughtCategory,
  ThoughtSentiment,
} from './types.ts';

export const MAX_THOUGHT_LOG_ENTRIES = 16;

export interface ClanAnecdote extends DwarfThoughtEntry {
  dwarfId: string;
  dwarfName: string;
  dwarfTitle: string;
  dwarfColor: string;
  dwarfQuirk?: DwarfQuirk;
  dwarfHappiness: number;
  dwarfZ: number;
}

export interface RecordThoughtInput {
  tick: number;
  year: number;
  season: string;
  text: string;
  category: ThoughtCategory;
  sentiment: ThoughtSentiment;
  moraleDelta?: number;
}

let thoughtSeqCounter = 1;

function shortThoughtHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 5);
}

/**
 * Mutates `dwarf.thought` and prepends a structured entry to `dwarf.thoughtLog`
 * if it differs from the most recent recorded thought text.
 */
export function appendDwarfThought(
  dwarf: DwarfEntity,
  input: RecordThoughtInput
): DwarfThoughtEntry {
  const existingLog = Array.isArray(dwarf.thoughtLog) ? dwarf.thoughtLog : [];
  const trimmedText = input.text.trim();
  dwarf.thought = trimmedText;

  if (existingLog.length > 0 && existingLog[0].text === trimmedText) {
    return existingLog[0];
  }

  const moraleDelta = input.moraleDelta ?? 0;
  if (moraleDelta !== 0) {
    dwarf.happiness = Math.max(5, Math.min(100, dwarf.happiness + moraleDelta));
  }

  const seq = thoughtSeqCounter++;
  const hash = shortThoughtHash(`${trimmedText}:${input.category}`);
  const baseId = `th-${dwarf.id}-${input.tick}-${seq}-${hash}`;
  const existingIds = new Set(existingLog.map((e) => e.id));
  const uniqueId = existingIds.has(baseId) ? `${baseId}-${ existingLog.length }` : baseId;

  const entry: DwarfThoughtEntry = {
    id: uniqueId,
    tick: input.tick,
    year: input.year,
    season: input.season,
    text: trimmedText,
    category: input.category,
    sentiment: input.sentiment,
    moraleDelta,
  };

  const dedupedExisting = existingLog.filter((e) => e.id !== entry.id);
  dwarf.thoughtLog = [entry, ...dedupedExisting].slice(0, MAX_THOUGHT_LOG_ENTRIES);
  return entry;
}

/**
 * Pure immutable version of `appendDwarfThought`.
 */
export function withDwarfThought(
  dwarf: DwarfEntity,
  input: RecordThoughtInput
): DwarfEntity {
  const clone: DwarfEntity = {
    ...dwarf,
    labors: { ...dwarf.labors },
    skills: { ...dwarf.skills },
    thoughtLog: Array.isArray(dwarf.thoughtLog) ? [...dwarf.thoughtLog] : [],
  };
  appendDwarfThought(clone, input);
  return clone;
}

const EMBARK_ANECDOTES: ReadonlyArray<{
  text: string;
  category: ThoughtCategory;
  sentiment: ThoughtSentiment;
  moraleDelta: number;
}> = [
  {
    text: 'Ate a plump helmet roast seasoned with cave-salt beside the embark wagon.',
    category: 'SUSTENANCE',
    sentiment: 'POSITIVE',
    moraleDelta: 5,
  },
  {
    text: 'Saw a terrifying beast silhouette stalking the crags above the mountain pass!',
    category: 'BEAST_ENCOUNTER',
    sentiment: 'TERRIFIED',
    moraleDelta: -6,
  },
  {
    text: 'Shared a foaming tankard of Dwarven Ale and sang ballads of the Mountainhome.',
    category: 'FELLOWSHIP',
    sentiment: 'EUPHORIC',
    moraleDelta: 8,
  },
  {
    text: 'Tested the weight of a newly forged pickaxe against a seam of native iron.',
    category: 'CRAFT_DELVE',
    sentiment: 'POSITIVE',
    moraleDelta: 4,
  },
  {
    text: 'Heard a haunting cavern echo rising from the deep limestone fissures.',
    category: 'OMEN',
    sentiment: 'NEGATIVE',
    moraleDelta: -3,
  },
  {
    text: 'Swore a blood-oath at the frontier cairn to defend the seven pioneers.',
    category: 'COMBAT',
    sentiment: 'EUPHORIC',
    moraleDelta: 7,
  },
  {
    text: 'Feasted on a warm plump helmet roast and toasted the High King.',
    category: 'SUSTENANCE',
    sentiment: 'POSITIVE',
    moraleDelta: 5,
  },
];

export function createInitialThoughtLog(
  dwarfId: string,
  initialThought: string,
  index = 0
): DwarfThoughtEntry[] {
  const seedA = EMBARK_ANECDOTES[index % EMBARK_ANECDOTES.length];
  const seedB = EMBARK_ANECDOTES[(index + 1) % EMBARK_ANECDOTES.length];

  return [
    {
      id: `th-${dwarfId}-0-2`,
      tick: 0,
      year: 251,
      season: 'Granite (Spring)',
      text: initialThought,
      category: 'CRAFT_DELVE',
      sentiment: 'POSITIVE',
      moraleDelta: 3,
    },
    {
      id: `th-${dwarfId}-0-1`,
      tick: 0,
      year: 251,
      season: 'Granite (Spring)',
      text: seedA.text,
      category: seedA.category,
      sentiment: seedA.sentiment,
      moraleDelta: seedA.moraleDelta,
    },
    {
      id: `th-${dwarfId}-0-0`,
      tick: 0,
      year: 251,
      season: 'Granite (Spring)',
      text: seedB.text,
      category: seedB.category,
      sentiment: seedB.sentiment,
      moraleDelta: seedB.moraleDelta,
    },
  ];
}

/**
 * Evaluates ambient/environmental triggers on a simulation tick (such as spotting a
 * terrifying beast nearby, suffering hunger/thirst shortages, or experiencing a
 * quirk-driven reflection).
 */
export function evaluateAmbientDwarfThoughts(
  dwarf: DwarfEntity,
  context: {
    tick: number;
    year: number;
    season: string;
    hostiles: HostileEntity[];
    resources: FortressResources;
    tavernCount: number;
    templeCount: number;
  }
): void {
  const { tick, year, season, hostiles, resources, tavernCount, templeCount } = context;

  // 1. Check if the dwarf sees a terrifying beast or hostile raider within sight range (9 tiles on same Z)
  const nearbyBeast = hostiles.find(
    (h) =>
      h.hp > 0 &&
      h.z === dwarf.z &&
      Math.max(Math.abs(h.x - dwarf.x), Math.abs(h.y - dwarf.y)) <= 9
  );

  if (nearbyBeast && dwarf.state !== 'FIGHTING') {
    const isFearless = dwarf.quirk === 'HOTHEAD' || dwarf.quirk === 'IRON_BORN';
    if (isFearless) {
      appendDwarfThought(dwarf, {
        tick,
        year,
        season,
        text: `Saw a terrifying ${nearbyBeast.name} at Z-${dwarf.z} and gripped my weapon with fierce resolve!`,
        category: 'BEAST_ENCOUNTER',
        sentiment: 'POSITIVE',
        moraleDelta: 2,
      });
    } else {
      appendDwarfThought(dwarf, {
        tick,
        year,
        season,
        text: `Saw a terrifying beast (${nearbyBeast.name}) lurking in the shadows at Z-${dwarf.z}!`,
        category: 'BEAST_ENCOUNTER',
        sentiment: 'TERRIFIED',
        moraleDelta: -5,
      });
    }
    return;
  }

  // 2. Check acute shortages when hungry or thirsty
  if (dwarf.hunger <= 20 && resources.food <= 0 && tick % 8 === 0) {
    appendDwarfThought(dwarf, {
      tick,
      year,
      season,
      text: 'Gnawing hunger pains — the fortress food stockpiles are empty!',
      category: 'SUSTENANCE',
      sentiment: 'NEGATIVE',
      moraleDelta: -4,
    });
    return;
  }

  if (dwarf.thirst <= 20 && resources.ale <= 0 && tick % 8 === 0) {
    appendDwarfThought(dwarf, {
      tick,
      year,
      season,
      text: 'Throat dry as granite dust — not a single barrel of Dwarven Ale remains!',
      category: 'SUSTENANCE',
      sentiment: 'NEGATIVE',
      moraleDelta: -5,
    });
    return;
  }

  // 3. Periodic Quirk & Fellowship anecdotes every 18 ticks
  if (tick > 0 && tick % 18 === 0) {
    if (dwarf.quirk === 'DEEP_MINER' && dwarf.z >= 1) {
      appendDwarfThought(dwarf, {
        tick,
        year,
        season,
        text: `Exhilarated by the crushing silence and gleaming ore seams at Depth Z-${dwarf.z}.`,
        category: 'CRAFT_DELVE',
        sentiment: 'EUPHORIC',
        moraleDelta: 4,
      });
    } else if (dwarf.quirk === 'DRUNKARD' && tavernCount > 0) {
      appendDwarfThought(dwarf, {
        tick,
        year,
        season,
        text: 'Heard the tavern lute echoing down the corridor and smiled warmly.',
        category: 'FELLOWSHIP',
        sentiment: 'POSITIVE',
        moraleDelta: 3,
      });
    } else if (dwarf.quirk === 'PIOUS' && templeCount > 0) {
      appendDwarfThought(dwarf, {
        tick,
        year,
        season,
        text: 'Whispered a prayer of gratitude before the Runed Temple Altar.',
        category: 'OMEN',
        sentiment: 'POSITIVE',
        moraleDelta: 3,
      });
    } else if (dwarf.quirk === 'SCHOLAR') {
      appendDwarfThought(dwarf, {
        tick,
        year,
        season,
        text: 'Studied the ancient geological strata and sketched a chronicle note.',
        category: 'CRAFT_DELVE',
        sentiment: 'POSITIVE',
        moraleDelta: 2,
      });
    }
  }
}

/**
 * Collects and sorts individual dwarves' `thoughtLog` entries across the clan
 * so the AdvisorPanel and AI storyteller can surface personal anecdotes.
 */
export function collectClanAnecdotes(
  dwarves: DwarfEntity[],
  options?: {
    dwarfId?: string;
    category?: ThoughtCategory | 'ALL';
    limit?: number;
  }
): ClanAnecdote[] {
  const filterDwarfId = options?.dwarfId || 'ALL';
  const filterCategory = options?.category || 'ALL';
  const limit = options?.limit ?? 40;

  const list: ClanAnecdote[] = [];

  for (const d of dwarves) {
    if (filterDwarfId !== 'ALL' && d.id !== filterDwarfId) continue;
    const entries =
      Array.isArray(d.thoughtLog) && d.thoughtLog.length > 0
        ? d.thoughtLog
        : [
            {
              id: `th-fallback-${d.id}`,
              tick: 0,
              year: 251,
              season: 'Granite (Spring)',
              text: d.thought || 'Ready to strike the earth.',
              category: 'CRAFT_DELVE' as ThoughtCategory,
              sentiment: 'POSITIVE' as ThoughtSentiment,
              moraleDelta: 0,
            },
          ];

    const seenEntryIds = new Set<string>();
    entries.forEach((entry, idx) => {
      if (filterCategory !== 'ALL' && entry.category !== filterCategory) return;
      const safeId = seenEntryIds.has(entry.id)
        ? `${entry.id}-dup-${idx}`
        : entry.id;
      seenEntryIds.add(safeId);
      list.push({
        ...entry,
        id: safeId,
        dwarfId: d.id,
        dwarfName: d.name,
        dwarfTitle: d.title,
        dwarfColor: d.color,
        dwarfQuirk: d.quirk,
        dwarfHappiness: d.happiness,
        dwarfZ: d.z,
      });
    });
  }

  list.sort((a, b) => {
    if (b.tick !== a.tick) return b.tick - a.tick;
    return b.id.localeCompare(a.id);
  });

  return list.slice(0, limit);
}

export function getSentimentBadge(sentiment: ThoughtSentiment): {
  glyph: string;
  label: string;
  colorClass: string;
} {
  switch (sentiment) {
    case 'EUPHORIC':
      return { glyph: '☼', label: 'EUPHORIC', colorClass: 'text-[#00ffff]' };
    case 'POSITIVE':
      return { glyph: '♥', label: 'CONTENT', colorClass: 'text-[#33ff00]' };
    case 'NEUTRAL':
      return { glyph: '·', label: 'STEADY', colorClass: 'text-[#d0d0d0]' };
    case 'NEGATIVE':
      return { glyph: '!', label: 'TROUBLED', colorClass: 'text-[#ff9900]' };
    case 'TERRIFIED':
      return { glyph: '☠', label: 'TERRIFIED', colorClass: 'text-[#ff0000]' };
  }
}
