import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialGameState,
  stepSimulationTick,
  resolveNarrativeEvent,
  generateContextAwareEvent,
} from './game-engine.ts';
import {
  addRelationship,
  combatBonus,
  initializeGuild,
  makeNamedRelic,
  performGuildAction,
  stepGuild,
  validGuildState,
  workProgressBonus,
} from './guild.ts';
import {
  deserializeFortress,
  restoreCloudSave,
  serializeFortress,
} from './save-system.ts';
import { getTerrainVisuals } from './world-gen.ts';
import type { GameState, TileTerrain } from './types.ts';

function fixture() {
  const state = createInitialGameState('Guild-Test');
  state.hostiles = [];
  state.workOrders = [];
  state.guild.relationships = [];
  state.dwarves.forEach((d) => {
    d.quirk = 'BRAVE';
    d.happiness = 50;
  });
  return state;
}
function tile(
  state: GameState,
  x: number,
  y: number,
  z: number,
  terrain: TileTerrain
) {
  Object.assign(state.grid[z][y][x], {
    terrain,
    ...getTerrainVisuals(terrain),
  });
}
function complete(state: GameState) {
  const offer = state.guild.commissions[0];
  state = performGuildAction(state, {
    type: 'ACCEPT_COMMISSION',
    id: offer.id,
  });
  return performGuildAction(state, {
    type: 'DELIVER_COMMISSION',
    id: offer.id,
  });
}

test('founding quirks and seasonal offers are deterministic; commissioning does not mutate input', () => {
  const a = createInitialGameState('Guild-Seed'),
    b = createInitialGameState('Guild-Seed');
  assert.deepEqual(
    a.dwarves.map((d) => d.quirk),
    b.dwarves.map((d) => d.quirk)
  );
  assert.deepEqual(a.guild.commissions, b.guild.commissions);
  assert.equal(a.guild.commissions.length, 2);
  const next = performGuildAction(a, {
    type: 'ACCEPT_COMMISSION',
    id: a.guild.commissions[0].id,
  });
  assert.equal(a.guild.commissions[0].status, 'OFFERED');
  assert.equal(next.guild.commissions[0].status, 'ACTIVE');
  assert.equal(
    performGuildAction(next, {
      type: 'ACCEPT_COMMISSION',
      id: next.guild.commissions[1].id,
    }),
    next
  );
});

test('commission delivery consumes stock exactly once and awards wealth, favor, and a named relic', () => {
  const initial = fixture();
  const offer = initial.guild.commissions[0];
  const next = complete(initial);
  assert.equal(
    next.resources.stone,
    initial.resources.stone - offer.requirement.amount
  );
  assert.equal(
    next.resources.wealth,
    initial.resources.wealth + offer.reward.wealth
  );
  assert.equal(next.guild.favor.Dwarves, offer.reward.favor);
  assert.equal(next.guild.relics.length, 1);
  assert.equal(next.guild.relics[0].template, offer.reward.relic);
  assert.equal(next.resources.relics, 1);
  assert.equal(
    performGuildAction(next, { type: 'DELIVER_COMMISSION', id: offer.id }),
    next
  );
  assert.equal(validGuildState(next), true);
});

test('unaffordable and expired deliveries do not consume resources or award a prize', () => {
  let state = fixture();
  const id = state.guild.commissions[0].id;
  state = performGuildAction(state, { type: 'ACCEPT_COMMISSION', id });
  state.resources.stone = 0;
  assert.equal(
    performGuildAction(state, { type: 'DELIVER_COMMISSION', id }),
    state
  );
  state.resources.stone = 25;
  state.ticks = 120;
  assert.equal(
    performGuildAction(state, { type: 'DELIVER_COMMISSION', id }),
    state
  );
});

test('the tick-120 boundary expires a charter without penalty and offers two fresh contracts', () => {
  let state = fixture();
  const id = state.guild.commissions[0].id;
  state = performGuildAction(state, { type: 'ACCEPT_COMMISSION', id });
  state.ticks = 119;
  const next = stepSimulationTick(state);
  assert.equal(next.guild.seasonIndex, 1);
  assert.equal(
    next.guild.commissions.filter((c) => c.status === 'OFFERED').length,
    2
  );
  assert.equal(
    next.guild.commissions.find((c) => c.id === id)?.status,
    'EXPIRED'
  );
  assert.equal(next.resources.stone, state.resources.stone);
  assert.equal(next.guild.relics.length, 0);
  assert.equal(
    performGuildAction(next, { type: 'ACCEPT_COMMISSION', id }),
    next
  );
});

test('relic ownership is exclusive, reassignment stores the previous relic, and gifting is permanent', () => {
  let state = complete(fixture());
  state.resources.relics++;
  state.guild.relics.push(
    makeNamedRelic(
      state.world.seed,
      1,
      0,
      'Urist',
      'test discovery',
      'EMBER_CROWN'
    )
  );
  const ownerId = state.dwarves[0].id;
  const [first, second] = state.guild.relics;
  state = performGuildAction(state, {
    type: 'SET_RELIC_MODE',
    id: first.id,
    mode: 'EQUIPPED',
    ownerId,
  });
  state = performGuildAction(state, {
    type: 'SET_RELIC_MODE',
    id: second.id,
    mode: 'EQUIPPED',
    ownerId,
  });
  assert.equal(state.guild.relics[0].mode, 'STORED');
  assert.equal(state.guild.relics[1].ownerId, ownerId);
  assert.equal(
    performGuildAction(state, {
      type: 'SET_RELIC_MODE',
      id: first.id,
      mode: 'EQUIPPED',
      ownerId: 'missing',
    }),
    state
  );
  const before = state.resources.relics;
  state = performGuildAction(state, {
    type: 'GIFT_RELIC',
    id: second.id,
    patron: 'Elves',
  });
  assert.equal(state.guild.favor.Elves, 15);
  assert.equal(
    state.world.civilizations.find((c) => c.race === 'Elves')?.stance,
    'Trade Partner'
  );
  assert.equal(state.resources.relics, before - 1);
  assert.equal(state.guild.relics[1].ownerId, undefined);
  assert.equal(
    performGuildAction(state, {
      type: 'GIFT_RELIC',
      id: second.id,
      patron: 'Elves',
    }),
    state
  );
  assert.equal(
    performGuildAction(state, {
      type: 'SET_RELIC_MODE',
      id: second.id,
      mode: 'DISPLAYED',
    }),
    state
  );
  assert.equal(validGuildState(state), true);
});

test('display blessings charge upkeep only when available and equipped burdens affect the bearer', () => {
  let state = fixture();
  state.resources.relics = 1;
  state.guild.relics = [
    makeNamedRelic(state.world.seed, 0, 0, 'Urist', 'test', 'EMBER_CROWN'),
  ];
  state = performGuildAction(state, {
    type: 'SET_RELIC_MODE',
    id: 'relic-0',
    mode: 'DISPLAYED',
  });
  state.ticks = 20;
  let next = stepGuild(state);
  assert.equal(next.resources.ale, state.resources.ale - 1);
  assert.equal(next.dwarves[0].happiness, 52);
  state.resources.ale = 0;
  next = stepGuild(state);
  assert.equal(next.dwarves[0].happiness, 50);
  state = performGuildAction(state, {
    type: 'SET_RELIC_MODE',
    id: 'relic-0',
    mode: 'EQUIPPED',
    ownerId: state.dwarves[0].id,
  });
  next = stepGuild(state);
  assert.equal(next.dwarves[0].energy, state.dwarves[0].energy - 1);
  assert.equal(combatBonus(state, state.dwarves[0]), 5);
});

test('stonewise quirks and chisel relics accelerate real mining work', () => {
  const state = fixture();
  state.dwarves = [state.dwarves[0]];
  state.dwarves[0].quirk = 'STONEWISE';
  state.resources.relics = 1;
  state.guild.relics = [
    {
      ...makeNamedRelic(state.world.seed, 0, 0, 'Urist', 'test', 'STONE_SONG'),
      mode: 'EQUIPPED',
      ownerId: state.dwarves[0].id,
    },
  ];
  const dwarf = state.dwarves[0];
  tile(state, dwarf.x + 1, dwarf.y, 0, 'GRANITE_WALL');
  state.grid[0][dwarf.y][dwarf.x + 1].designation = 'MINE';
  assert.equal(workProgressBonus(state, dwarf, 'MINING'), 2);
  assert.equal(workProgressBonus(state, dwarf, 'CARPENTRY'), 0);
  const next = stepSimulationTick(state);
  assert.equal(next.grid[0][dwarf.y][dwarf.x + 1].terrain, 'ROCK_FLOOR');
  assert.equal(next.dwarves[0].energy, dwarf.energy - 1);
});

test('cavern recovery and artifact decrees create named relic histories', () => {
  let state = fixture();
  state.dwarves = [state.dwarves[0]];
  const dwarf = state.dwarves[0];
  tile(state, dwarf.x + 1, dwarf.y, 0, 'CAVERN_RELIC');
  state.grid[0][dwarf.y][dwarf.x + 1].designation = 'RECLAIM_RELIC';
  for (let i = 0; i < 2; i++) state = stepSimulationTick(state);
  assert.equal(state.guild.relics.length, 1);
  assert.equal(state.guild.relics[0].discoveredBy, dwarf.name);
  state.activeEvent = generateContextAwareEvent(state, 'STRANGE_MOOD');
  state = resolveNarrativeEvent(state, 'supply-artifact');
  assert.equal(state.guild.relics.length, 2);
  assert.equal(new Set(state.guild.relics.map((r) => r.id)).size, 2);
});

test('tavern friendships and personality clashes require actual shared proximity', () => {
  let state = fixture();
  state.dwarves = state.dwarves.slice(0, 2);
  state.dwarves.forEach((d) => {
    d.x = 38;
    d.y = 21;
  });
  tile(state, 38, 22, 0, 'TAVERN_HALL');
  state.ticks = 20;
  state.guild.relationships = addRelationship(
    [],
    state.dwarves[0].id,
    state.dwarves[1].id,
    4,
    'Old friends',
    0
  );
  const next = stepGuild(state);
  assert.equal(next.guild.relationships[0].score, 5);
  assert.equal(next.dwarves[0].happiness, 51);
  state.dwarves[0].quirk = 'LONER';
  state.dwarves[1].quirk = 'ALE_LOVER';
  state = stepGuild(state);
  assert.equal(state.guild.relationships[0].score, 3);
  state.dwarves.forEach((d) => {
    d.z = 1;
  });
  const underground = stepGuild(state);
  assert.deepEqual(underground.guild.relationships, state.guild.relationships);
});

test('a shared victory improves a bond and records a carried relic’s use', () => {
  const state = fixture();
  state.dwarves = state.dwarves.slice(0, 2);
  const [hero, ally] = state.dwarves;
  hero.x = 38;
  hero.y = 21;
  ally.x = 37;
  ally.y = 21;
  state.resources.relics = 1;
  state.guild.relics = [
    {
      ...makeNamedRelic(state.world.seed, 0, 0, hero.name, 'test', 'OATH_AXE'),
      mode: 'EQUIPPED',
      ownerId: hero.id,
    },
  ];
  state.hostiles = [
    {
      id: 'goblin',
      name: 'Gate Goblin',
      kind: 'GOBLIN_RAIDER',
      char: 'g',
      color: '#f00',
      x: 39,
      y: 21,
      z: 0,
      hp: 1,
      maxHp: 40,
      attack: 1,
      behavior: 'RAID_SEEK',
    },
  ];
  const next = stepSimulationTick(state);
  assert.equal(next.guild.relationships[0].score, 2);
  assert.match(next.guild.relationships[0].reason, /Gate Goblin/);
  assert.match(next.guild.relics[0].history.at(-1)!.text, /victory/);
});

test('guild state survives v2 round trips; v1 and old cloud summaries migrate at later seasons', () => {
  let state = complete(fixture());
  state = performGuildAction(state, {
    type: 'SET_RELIC_MODE',
    id: state.guild.relics[0].id,
    mode: 'EQUIPPED',
    ownerId: state.dwarves[0].id,
  });
  const snapshot = serializeFortress(state);
  const restored = deserializeFortress(snapshot);
  assert.equal(JSON.parse(snapshot).version, 2);
  assert.deepEqual(restored.guild, state.guild);
  const old = JSON.parse(snapshot);
  old.version = 1;
  delete old.state.guild;
  old.state.dwarves.forEach((d: { quirk?: string }) => {
    delete d.quirk;
  });
  old.state.ticks = 480;
  old.state.year = 252;
  const migrated = deserializeFortress(JSON.stringify(old));
  assert.equal(migrated.guild.seasonIndex, 4);
  assert.ok(migrated.dwarves.every((d) => d.quirk));
  const legacy = restoreCloudSave({
    id: 'old',
    seed: state.world.seed,
    ticks: 480,
    year: 252,
    season: 'Granite (Spring)',
    resources: { ...state.resources, relics: 3 },
  });
  assert.equal(legacy.guild.seasonIndex, 4);
  assert.equal(legacy.guild.relics.length, 3);
  assert.equal(initializeGuild(migrated).guild, migrated.guild);
});

test('malformed guild owners, relationships, or statuses cannot enter a saved game', () => {
  const state = complete(fixture());
  const raw = JSON.parse(serializeFortress(state));
  raw.state.guild.relics[0].mode = 'EQUIPPED';
  raw.state.guild.relics[0].ownerId = 'missing';
  assert.throws(() => deserializeFortress(JSON.stringify(raw)));
  raw.state.guild.relics[0].mode = 'STORED';
  delete raw.state.guild.relics[0].ownerId;
  raw.state.guild.relationships = [
    { a: 'missing', b: 'missing2', score: 0, lastTick: 0, reason: 'Invalid' },
  ];
  assert.throws(() => deserializeFortress(JSON.stringify(raw)));
});

test('a goblin alliance stops automatic raids and hostile spontaneous decrees', () => {
  const state = fixture();
  state.world.civilizations.find((c) => c.race === 'Goblins')!.stance =
    'Allied';
  state.resources.wealth = 1000;
  state.ticks = 84;
  const next = stepSimulationTick(state);
  assert.equal(next.hostiles.length, 0);
  state.ticks = 90;
  assert.notEqual(generateContextAwareEvent(state).severity, 'MAJOR_CRISIS');
});
