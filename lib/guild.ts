import type {
  Civilization,
  DwarfEntity,
  DwarfLabor,
  DwarfQuirk,
  DwarfRelationship,
  GameState,
  GuildAction,
  GuildState,
  NamedRelic,
  RelicTemplate,
  RoyalCommission,
} from './types.ts';
import { createPRNG } from './world-gen.ts';
import { RESOURCE_KEYS, validResourceMap } from './game-rules.ts';

export const SEASON_TICKS = 120;
export const QUIRKS: Record<DwarfQuirk, { name: string; description: string }> =
  {
    STONEWISE: {
      name: 'Stonewise',
      description:
        '+1 progress per mining or masonry work tick; stonework costs 1 extra energy.',
    },
    ALE_LOVER: {
      name: 'Ale enthusiast',
      description:
        '+4 morale when drinking, at the cost of an extra cask when available.',
    },
    BRAVE: { name: 'Brave', description: '+2 damage in close combat.' },
    LONER: {
      name: 'Loner',
      description:
        'Every 20 ticks: +2 morale alone, −1 in a crowd. Clashes with ale enthusiasts in the tavern.',
    },
  };
export const RELIC_TEMPLATES: Record<
  RelicTemplate,
  { name: string; display: string; equip: string }
> = {
  EMBER_CROWN: {
    name: 'Ember Crown',
    display:
      '+2 clan morale every 20 ticks; consumes 1 ale. No ale, no blessing.',
    equip: '+3 melee damage; bearer loses 1 extra energy every 20 ticks.',
  },
  STONE_SONG: {
    name: 'Stone-Song Chisel',
    display:
      '+1 clan morale every 20 ticks; consumes 1 food. No food, no blessing.',
    equip:
      '+1 mining/masonry progress per work tick; bearer loses 1 thirst every 20 ticks.',
  },
  OATH_AXE: {
    name: 'Oathkeeper Axe',
    display:
      '+1 clan morale every 20 ticks; consumes 1 ale. No ale, no blessing.',
    equip:
      '+5 melee damage; battle whispers cost the bearer 1 morale every 20 ticks.',
  },
};
const RACES: Civilization['race'][] = ['Dwarves', 'Elves', 'Humans', 'Goblins'];
const QUIRK_IDS = Object.keys(QUIRKS) as DwarfQuirk[];
const RELIC_IDS = Object.keys(RELIC_TEMPLATES) as RelicTemplate[];
const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));
const distance = (a: DwarfEntity, b: DwarfEntity) =>
  a.z === b.z ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : Infinity;

export function quirkFor(seed: string, dwarfId: string): DwarfQuirk {
  return QUIRK_IDS[
    Math.floor(createPRNG(`${seed}:quirk:${dwarfId}`)() * QUIRK_IDS.length)
  ];
}

export function commissionOffers(
  seed: string,
  ticks: number
): RoyalCommission[] {
  const season = Math.floor(ticks / SEASON_TICKS);
  const amount = Math.min(50, 18 + season * 2);
  const templates: Array<
    Pick<RoyalCommission, 'title' | 'patron' | 'requirement' | 'reward'>
  > = [
    {
      title: 'Stone for the Royal Road',
      patron: 'Dwarves',
      requirement: { resource: 'stone', amount },
      reward: { wealth: 120, favor: 10, relic: 'STONE_SONG' },
    },
    {
      title: 'Axes for the Border Watch',
      patron: 'Humans',
      requirement: { resource: 'weapons', amount: 4 },
      reward: { wealth: 200, favor: 15, relic: 'OATH_AXE' },
    },
    {
      title: 'Ale for the Crown Feast',
      patron: 'Dwarves',
      requirement: { resource: 'ale', amount: 24 },
      reward: { wealth: 140, favor: 12, relic: 'EMBER_CROWN' },
    },
    {
      title: 'Harvest for the Canopy',
      patron: 'Elves',
      requirement: { resource: 'food', amount: 30 },
      reward: { wealth: 150, favor: 12, relic: 'STONE_SONG' },
    },
  ];
  const offset =
    season === 0
      ? 0
      : Math.floor(
          createPRNG(`${seed}:commissions:${season}`)() * templates.length
        );
  return [0, 1].map((i) => ({
    ...templates[(offset + i) % templates.length],
    id: `commission-${season}-${i}`,
    offeredAt: season * SEASON_TICKS,
    deadline: (season + 1) * SEASON_TICKS,
    status: 'OFFERED',
  }));
}

export function makeNamedRelic(
  seed: string,
  serial: number,
  tick: number,
  discoverer: string,
  source: string,
  template?: RelicTemplate
): NamedRelic {
  const rand = createPRNG(`${seed}:relic:${serial}`);
  const kind = template || RELIC_IDS[Math.floor(rand() * RELIC_IDS.length)];
  const epithets = [
    'of the First Hall',
    'of Echoing Embers',
    'of the Seven Pioneers',
    'of the Deep Oath',
    'of the Silver Mountain',
  ];
  const name = `${RELIC_TEMPLATES[kind].name} ${epithets[Math.floor(rand() * epithets.length)]}`;
  return {
    id: `relic-${serial}`,
    name,
    template: kind,
    discoveredBy: discoverer,
    discoveredAt: tick,
    mode: 'STORED',
    history: [{ tick, text: `${discoverer} acquired ${name}: ${source}.` }],
  };
}

export function initializeGuild(
  state: Omit<GameState, 'guild'> & { guild?: GuildState }
): GameState {
  const dwarves = state.dwarves.map((d) => ({
    ...d,
    quirk: d.quirk || quirkFor(state.world.seed, d.id),
  }));
  const guild: GuildState = state.guild || {
    seasonIndex: Math.floor(state.ticks / SEASON_TICKS),
    commissions: commissionOffers(state.world.seed, state.ticks),
    relics: Array.from(
      { length: Math.min(20, state.resources.relics) },
      (_, i) =>
        makeNamedRelic(
          state.world.seed,
          i,
          state.ticks,
          'The founding archive',
          'recovered from the old fortress records'
        )
    ),
    favor: { Dwarves: 0, Elves: 0, Humans: 0, Goblins: 0 },
    relationships: dwarves.slice(1, 7).map((d, i) => {
      const [a, b] = [dwarves[i].id, d.id].sort();
      return {
        a,
        b,
        score: i % 3 === 0 ? -5 : 2,
        lastTick: state.ticks,
        reason:
          i % 3 === 0
            ? 'An old dispute on the embark road.'
            : 'Shared the long journey from Mountainhome.',
      };
    }),
  };
  return { ...state, dwarves, guild };
}

function log(
  state: GameState,
  text: string,
  type: 'LORE' | 'INFO' = 'LORE'
): GameState {
  return {
    ...state,
    chronicle: [
      {
        id: `guild-${crypto.randomUUID()}`,
        tick: state.ticks,
        year: state.year,
        season: state.season,
        text,
        type,
      },
      ...state.chronicle,
    ].slice(0, 60),
  };
}
function remember(relic: NamedRelic, tick: number, text: string): NamedRelic {
  return { ...relic, history: [...relic.history, { tick, text }].slice(-20) };
}
function changeFavor(
  state: GameState,
  patron: Civilization['race'],
  delta: number
): GameState {
  const favor = {
    ...state.guild.favor,
    [patron]: clamp(state.guild.favor[patron] + delta, 0, 100),
  };
  return {
    ...state,
    guild: { ...state.guild, favor },
    world: {
      ...state.world,
      civilizations: state.world.civilizations.map((c) =>
        c.race === patron && favor[patron] >= 30
          ? { ...c, stance: 'Allied' }
          : c.race === patron && c.stance === 'Neutral' && favor[patron] >= 15
            ? { ...c, stance: 'Trade Partner' }
            : c
      ),
    },
  };
}

export function performGuildAction(
  state: GameState,
  action: GuildAction
): GameState {
  if (
    action.type === 'ACCEPT_COMMISSION' ||
    action.type === 'DELIVER_COMMISSION'
  ) {
    const commission = state.guild.commissions.find((c) => c.id === action.id);
    if (!commission || state.ticks >= commission.deadline) return state;
    if (action.type === 'ACCEPT_COMMISSION') {
      if (
        commission.status !== 'OFFERED' ||
        state.guild.commissions.some((c) => c.status === 'ACTIVE')
      )
        return state;
      return log(
        {
          ...state,
          guild: {
            ...state.guild,
            commissions: state.guild.commissions.map((c) =>
              c.id === action.id ? { ...c, status: 'ACTIVE' } : c
            ),
          },
        },
        `Accepted royal commission: ${commission.title}. Delivery is due at tick ${commission.deadline}.`
      );
    }
    const { resource, amount } = commission.requirement;
    if (commission.status !== 'ACTIVE' || state.resources[resource] < amount)
      return state;
    const relic = makeNamedRelic(
      state.world.seed,
      state.guild.relics.length,
      state.ticks,
      'The Overseer',
      `reward for ${commission.title}`,
      commission.reward.relic
    );
    const next = changeFavor(
      {
        ...state,
        resources: {
          ...state.resources,
          [resource]: state.resources[resource] - amount,
          wealth: state.resources.wealth + commission.reward.wealth,
          relics: state.resources.relics + 1,
        },
        guild: {
          ...state.guild,
          commissions: state.guild.commissions.map((c) =>
            c.id === action.id ? { ...c, status: 'COMPLETED' } : c
          ),
          relics: [...state.guild.relics, relic],
        },
      },
      commission.patron,
      commission.reward.favor
    );
    return log(
      next,
      `Delivered ${amount} ${resource} for ${commission.title}: +${commission.reward.wealth} wealth, +${commission.reward.favor} ${commission.patron} favor, and ${relic.name}.`
    );
  }
  const relic = state.guild.relics.find((r) => r.id === action.id);
  if (!relic || relic.mode === 'GIFTED') return state;
  if (action.type === 'GIFT_RELIC') {
    if (!RACES.includes(action.patron) || state.resources.relics < 1)
      return state;
    const gifted = remember(
      { ...relic, mode: 'GIFTED', ownerId: undefined, giftedTo: action.patron },
      state.ticks,
      `Gifted to ${action.patron}; +15 diplomatic favor.`
    );
    return log(
      changeFavor(
        {
          ...state,
          resources: { ...state.resources, relics: state.resources.relics - 1 },
          guild: {
            ...state.guild,
            relics: state.guild.relics.map((r) =>
              r.id === relic.id ? gifted : r
            ),
          },
        },
        action.patron,
        15
      ),
      `${relic.name} was gifted to ${action.patron}. Its story lives on beyond our halls.`
    );
  }
  if (
    action.type !== 'SET_RELIC_MODE' ||
    !['STORED', 'DISPLAYED', 'EQUIPPED'].includes(action.mode)
  )
    return state;
  const owner =
    action.mode === 'EQUIPPED'
      ? state.dwarves.find((d) => d.id === action.ownerId)
      : undefined;
  if (action.mode === 'EQUIPPED' && !owner) return state;
  if (relic.mode === action.mode && relic.ownerId === owner?.id) return state;
  const relics = state.guild.relics.map((r) => {
    if (r.id === relic.id)
      return remember(
        { ...r, mode: action.mode, ownerId: owner?.id },
        state.ticks,
        action.mode === 'EQUIPPED'
          ? `Entrusted to ${owner!.name}.`
          : action.mode === 'DISPLAYED'
            ? 'Placed on public display in the fortress.'
            : 'Returned to the vault.'
      );
    if (owner && r.mode === 'EQUIPPED' && r.ownerId === owner.id)
      return remember(
        { ...r, mode: 'STORED', ownerId: undefined },
        state.ticks,
        `${owner.name} returned it to the vault to carry another relic.`
      );
    return r;
  });
  return log(
    { ...state, guild: { ...state.guild, relics } },
    `${relic.name}: ${action.mode === 'EQUIPPED' ? `carried by ${owner!.name}` : action.mode.toLowerCase()}.`
  );
}

export function addRelationship(
  relationships: DwarfRelationship[],
  aId: string,
  bId: string,
  delta: number,
  reason: string,
  tick: number
): DwarfRelationship[] {
  if (aId === bId) return relationships;
  const [a, b] = [aId, bId].sort();
  const index = relationships.findIndex((r) => r.a === a && r.b === b);
  if (index < 0)
    return relationships.length >= 1000
      ? relationships
      : [
          ...relationships,
          { a, b, score: clamp(delta, -100, 100), reason, lastTick: tick },
        ];
  return relationships.map((r, i) =>
    i === index
      ? {
          ...r,
          score: clamp(r.score + delta, -100, 100),
          reason,
          lastTick: tick,
        }
      : r
  );
}

export function workProgressBonus(
  state: GameState,
  dwarf: DwarfEntity,
  labor: DwarfLabor
): number {
  if (labor !== 'MINING' && labor !== 'MASONRY') return 0;
  return (
    (dwarf.quirk === 'STONEWISE' ? 1 : 0) +
    (state.guild.relics.some(
      (r) =>
        r.mode === 'EQUIPPED' &&
        r.ownerId === dwarf.id &&
        r.template === 'STONE_SONG'
    )
      ? 1
      : 0)
  );
}
export function combatBonus(state: GameState, dwarf: DwarfEntity): number {
  const relic = state.guild.relics.find(
    (r) => r.mode === 'EQUIPPED' && r.ownerId === dwarf.id
  );
  return (
    (dwarf.quirk === 'BRAVE' ? 2 : 0) +
    (relic?.template === 'OATH_AXE'
      ? 5
      : relic?.template === 'EMBER_CROWN'
        ? 3
        : 0)
  );
}

export function stepGuild(state: GameState): GameState {
  let guild: GuildState = { ...state.guild };
  let dwarves = state.dwarves.map((d) => ({
    ...d,
    quirk: d.quirk || quirkFor(state.world.seed, d.id),
  }));
  const resources = { ...state.resources };
  const seasonIndex = Math.floor(state.ticks / SEASON_TICKS);
  const expired = guild.commissions.some(
    (c) =>
      (c.status === 'ACTIVE' || c.status === 'OFFERED') &&
      state.ticks >= c.deadline
  );
  guild.commissions = guild.commissions.map((c) =>
    (c.status === 'ACTIVE' || c.status === 'OFFERED') &&
    state.ticks >= c.deadline
      ? { ...c, status: 'EXPIRED' }
      : c
  );
  if (seasonIndex !== guild.seasonIndex) {
    guild = {
      ...guild,
      seasonIndex,
      commissions: [
        ...commissionOffers(state.world.seed, state.ticks),
        ...guild.commissions.slice(0, 10),
      ],
    };
  }
  if (state.ticks > 0 && state.ticks % 20 === 0) {
    for (const relic of guild.relics) {
      if (relic.mode === 'DISPLAYED') {
        const cost = relic.template === 'STONE_SONG' ? 'food' : 'ale';
        if (resources[cost] > 0) {
          resources[cost]--;
          dwarves = dwarves.map((d) => ({
            ...d,
            happiness: Math.min(
              100,
              d.happiness + (relic.template === 'EMBER_CROWN' ? 2 : 1)
            ),
          }));
        }
      } else if (relic.mode === 'EQUIPPED') {
        dwarves = dwarves.map((d) =>
          d.id !== relic.ownerId
            ? d
            : relic.template === 'EMBER_CROWN'
              ? { ...d, energy: Math.max(15, d.energy - 1) }
              : relic.template === 'STONE_SONG'
                ? { ...d, thirst: Math.max(10, d.thirst - 1) }
                : { ...d, happiness: Math.max(10, d.happiness - 1) }
        );
      }
    }
    const taverns = state.grid
      .flat(2)
      .filter((tile) => tile.terrain === 'TAVERN_HALL');
    const nearTavern = (dwarf: DwarfEntity) =>
      taverns.some(
        (tile) =>
          tile.z === dwarf.z &&
          Math.max(Math.abs(tile.x - dwarf.x), Math.abs(tile.y - dwarf.y)) <= 3
      );
    const pairs = new Set<string>();
    for (const dwarf of dwarves) {
      const nearby = dwarves.filter(
        (d) => d.id !== dwarf.id && distance(dwarf, d) <= 3
      );
      if (dwarf.quirk === 'LONER')
        dwarf.happiness = clamp(
          dwarf.happiness +
            (nearby.length === 0 ? 2 : nearby.length >= 3 ? -1 : 0),
          10,
          100
        );
      if (!nearTavern(dwarf) || dwarf.state === 'FIGHTING') continue;
      const companion = nearby
        .filter((d) => d.state !== 'FIGHTING' && nearTavern(d))
        .sort(
          (a, b) =>
            distance(dwarf, a) - distance(dwarf, b) || a.id.localeCompare(b.id)
        )[0];
      if (!companion) continue;
      const pair = JSON.stringify([dwarf.id, companion.id].sort());
      if (pairs.has(pair)) continue;
      pairs.add(pair);
      const clash =
        (dwarf.quirk === 'LONER' && companion.quirk === 'ALE_LOVER') ||
        (companion.quirk === 'LONER' && dwarf.quirk === 'ALE_LOVER');
      guild.relationships = addRelationship(
        guild.relationships,
        dwarf.id,
        companion.id,
        clash ? -1 : 1,
        clash
          ? 'Quiet solitude clashed with a loud tavern tale.'
          : 'Shared a quiet mug and a story in the tavern.',
        state.ticks
      );
    }
    const morale = new Map(dwarves.map((d) => [d.id, 0]));
    for (const bond of guild.relationships) {
      const a = dwarves.find((d) => d.id === bond.a),
        b = dwarves.find((d) => d.id === bond.b);
      if (!a || !b || distance(a, b) > 3) continue;
      const delta = bond.score >= 5 ? 1 : bond.score <= -5 ? -1 : 0;
      morale.set(a.id, (morale.get(a.id) || 0) + delta);
      morale.set(b.id, (morale.get(b.id) || 0) + delta);
    }
    dwarves = dwarves.map((d) => ({
      ...d,
      happiness: clamp(
        d.happiness + clamp(morale.get(d.id) || 0, -2, 2),
        10,
        100
      ),
    }));
  }
  const next = { ...state, guild, dwarves, resources };
  return expired
    ? log(
        next,
        'The season turned. Undelivered commissions expired without a penalty; new offers await.',
        'INFO'
      )
    : next;
}

export function validGuildState(state: GameState): boolean {
  const guild = state.guild;
  if (
    !guild ||
    !Number.isSafeInteger(guild.seasonIndex) ||
    guild.seasonIndex !== Math.floor(state.ticks / SEASON_TICKS) ||
    !Array.isArray(guild.commissions) ||
    guild.commissions.length > 12 ||
    !Array.isArray(guild.relics) ||
    !Array.isArray(guild.relationships) ||
    guild.relationships.length > 1000 ||
    !guild.favor ||
    !RACES.every(
      (r) =>
        Number.isInteger(guild.favor[r]) &&
        guild.favor[r] >= 0 &&
        guild.favor[r] <= 100
    )
  )
    return false;
  const citizens = new Set(state.dwarves.map((d) => d.id));
  if (!state.dwarves.every((d) => d.quirk && QUIRK_IDS.includes(d.quirk)))
    return false;
  if (guild.commissions.filter((c) => c.status === 'ACTIVE').length > 1)
    return false;
  if (
    !guild.commissions.every(
      (c) =>
        c &&
        typeof c.id === 'string' &&
        typeof c.title === 'string' &&
        RACES.includes(c.patron) &&
        c.requirement &&
        RESOURCE_KEYS.includes(c.requirement.resource) &&
        c.requirement.resource !== 'wealth' &&
        c.requirement.resource !== 'relics' &&
        Number.isSafeInteger(c.requirement.amount) &&
        c.requirement.amount > 0 &&
        c.requirement.amount <= 100 &&
        c.reward &&
        validResourceMap({ wealth: c.reward.wealth }) &&
        Number.isInteger(c.reward.favor) &&
        c.reward.favor >= 0 &&
        c.reward.favor <= 100 &&
        RELIC_IDS.includes(c.reward.relic) &&
        Number.isSafeInteger(c.offeredAt) &&
        c.offeredAt >= 0 &&
        Number.isSafeInteger(c.deadline) &&
        c.deadline > c.offeredAt &&
        ['OFFERED', 'ACTIVE', 'COMPLETED', 'EXPIRED'].includes(c.status)
    )
  )
    return false;
  const owners = new Set<string>();
  for (const r of guild.relics) {
    if (
      !r ||
      typeof r.id !== 'string' ||
      typeof r.name !== 'string' ||
      typeof r.discoveredBy !== 'string' ||
      !Number.isSafeInteger(r.discoveredAt) ||
      r.discoveredAt < 0 ||
      !RELIC_IDS.includes(r.template) ||
      !['STORED', 'DISPLAYED', 'EQUIPPED', 'GIFTED'].includes(r.mode) ||
      !Array.isArray(r.history) ||
      r.history.length > 20 ||
      !r.history.every(
        (h) =>
          h &&
          Number.isSafeInteger(h.tick) &&
          h.tick >= 0 &&
          typeof h.text === 'string'
      )
    )
      return false;
    if (r.mode === 'EQUIPPED') {
      if (!r.ownerId || !citizens.has(r.ownerId) || owners.has(r.ownerId))
        return false;
      owners.add(r.ownerId);
    } else if (r.ownerId !== undefined) return false;
    if (
      r.mode === 'GIFTED'
        ? !r.giftedTo || !RACES.includes(r.giftedTo)
        : r.giftedTo !== undefined
    )
      return false;
  }
  return (
    new Set(guild.relics.map((r) => r.id)).size === guild.relics.length &&
    new Set(guild.commissions.map((c) => c.id)).size ===
      guild.commissions.length &&
    guild.relationships.every(
      (r) =>
        r &&
        typeof r.a === 'string' &&
        typeof r.b === 'string' &&
        r.a < r.b &&
        citizens.has(r.a) &&
        citizens.has(r.b) &&
        Number.isInteger(r.score) &&
        Math.abs(r.score) <= 100 &&
        Number.isSafeInteger(r.lastTick) &&
        r.lastTick >= 0 &&
        typeof r.reason === 'string'
    ) &&
    new Set(guild.relationships.map((r) => JSON.stringify([r.a, r.b]))).size ===
      guild.relationships.length &&
    guild.relics.filter((r) => r.mode !== 'GIFTED').length <=
      state.resources.relics
  );
}
