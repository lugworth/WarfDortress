import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAreaDesignation,
  applyLaborPreset,
  createInitialGameState,
  executeTradeBarter,
  generateContextAwareEvent,
  resolveNarrativeEvent,
  scanWorldStrata,
  spawnGoblinRaid,
  stepSimulationTick,
} from './game-engine.ts';
import { generateRandomWorldSeed, getSurfaceArchetype } from './world-gen.ts';

test('deterministic world generation creates multi-level strata, biomes, cavern relics, and 7 pioneers', () => {
  const state1 = createInitialGameState('Moria-777');
  const state2 = createInitialGameState('Moria-777');

  assert.equal(state1.world.dwarvenName, state2.world.dwarvenName);
  assert.equal(state1.world.strata.length, 6);
  assert.equal(state1.world.civilizations.length, 4);
  assert.equal(state1.world.history.length, 5);
  assert.equal(state1.dwarves.length, 7);
  assert.equal(state1.grid.length, 6);
  assert.equal(state1.grid[0].length, 42);
  assert.equal(state1.grid[0][0].length, 76);
  assert.ok(state1.hostiles.length >= 2, 'Should spawn initial cavern denizens on Z-3..4');
  assert.ok(state1.alerts.length >= 2, 'Should initialize discovery alerts with coordinates');
});

test('world generator produces diverse surface topographies and randomized cavern layouts across different seeds', () => {
  const archetypesSeen = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const arch = getSurfaceArchetype(`Seed-Diversity-${i * 37}`);
    archetypesSeen.add(arch.id);
  }
  assert.ok(archetypesSeen.size >= 4, 'Should select across multiple distinct surface topographies');

  const seedA = generateRandomWorldSeed();
  const seedB = generateRandomWorldSeed() + '-alt';
  const stateA = createInitialGameState(seedA);
  const stateB = createInitialGameState(seedB);

  let diffTiles = 0;
  for (let y = 0; y < stateA.world.height; y++) {
    for (let x = 0; x < stateA.world.width; x++) {
      if (stateA.grid[0][y][x].terrain !== stateB.grid[0][y][x].terrain) {
        diffTiles++;
      }
    }
  }
  assert.ok(diffTiles > 300, 'Different seeds should generate substantially different 76x42 surface maps');
});

test('applyAreaDesignation marks rock tiles for mining and clears on CANCEL', () => {
  const state = createInitialGameState('Anvil-101');
  const centerX = Math.floor(state.world.width / 2);
  const centerY = Math.floor(state.world.height / 2);

  const { nextState, count } = applyAreaDesignation(
    state,
    0,
    centerX + 5,
    centerY - 1,
    centerX + 7,
    centerY + 1,
    'MINE'
  );

  assert.ok(count > 0, 'Should designate rock/ore tiles on the eastern cliff');
  assert.equal(nextState.grid[0][centerY][centerX + 6].designation, 'MINE');

  const cleared = applyAreaDesignation(
    nextState,
    0,
    centerX + 5,
    centerY - 1,
    centerX + 7,
    centerY + 1,
    'CANCEL'
  );
  assert.equal(cleared.nextState.grid[0][centerY][centerX + 6].designation, undefined);
});

test('simulation step assigns mining tasks to miners and excavates rock into stone/ore', () => {
  let state = createInitialGameState('Deepforge-42');
  const centerX = Math.floor(state.world.width / 2);
  const centerY = Math.floor(state.world.height / 2);
  const initialStone = state.resources.stone;
  const initialWealth = state.resources.wealth;

  const { nextState } = applyAreaDesignation(
    state,
    0,
    centerX + 5,
    centerY,
    centerX + 5,
    centerY,
    'MINE'
  );
  state = nextState;

  for (let i = 0; i < 12; i++) {
    state = stepSimulationTick(state);
  }

  const minedTile = state.grid[0][centerY][centerX + 5];
  assert.equal(minedTile.terrain, 'ROCK_FLOOR');
  assert.equal(minedTile.walkable, true);
  assert.ok(state.resources.wealth > initialWealth, 'Wealth should increase after mining');
  assert.ok(
    state.resources.stone > initialStone || state.resources.ironOre > 4,
    'Stone or Iron Ore should increase after mining'
  );
});

test('narrative event system generates context-aware events and resolves player choices with resource, migrant, diplomatic, and historical rewards', () => {
  let state = createInitialGameState('Caravan-Test');
  const initialHistoryCount = state.world.history.length;
  const caravanEvt = generateContextAwareEvent(state, 'TRADE_CARAVAN');

  assert.equal(caravanEvt.severity, 'TRADE_CARAVAN');
  assert.ok(caravanEvt.choices.length >= 2);
  assert.ok(caravanEvt.triggerReason?.includes('TRADE CARAVAN'));

  state = { ...state, activeEvent: caravanEvt };
  const initialPop = state.dwarves.length;
  const initialFood = state.resources.food;

  const afterChoice = resolveNarrativeEvent(state, 'trade-crafts');
  assert.equal(afterChoice.activeEvent, null);
  assert.equal(afterChoice.eventHistory.length, 1);
  assert.equal(afterChoice.dwarves.length, initialPop + 1, 'Should welcome 1 migrant dwarf');
  assert.ok(afterChoice.resources.food > initialFood, 'Food should increase from caravan trade');
  assert.equal(
    afterChoice.world.history.length,
    initialHistoryCount + 1,
    'Resolved event should be recorded into World Historical Annals'
  );
});

test('narrative event system dynamically triggers supply caravan on low provisions and updates diplomatic stance on envoy treaty', () => {
  let state = createInitialGameState('Diplomacy-Test');
  state = {
    ...state,
    resources: { ...state.resources, food: 10, ale: 10 },
  };

  const autoEvt = generateContextAwareEvent(state);
  assert.equal(
    autoEvt.severity,
    'TRADE_CARAVAN',
    'Low food/ale should dynamically trigger an emergency supply caravan'
  );
  assert.ok(autoEvt.triggerReason?.includes('Low Provisions Alert'));

  const envoyEvt = generateContextAwareEvent(state, 'DIPLOMATIC_ENVOY');
  state = { ...state, activeEvent: envoyEvt };
  const afterEnvoy = resolveNarrativeEvent(state, 'honor-canopy');
  const elfCiv = afterEnvoy.world.civilizations.find((c) => c.race === 'Elves');
  assert.equal(elfCiv?.stance, 'Allied', 'Signing Canopy Accord should ally the Elven civilization');
});

test('smeltery & forge workshops process auto-repeat metallurgy orders and equip militia dwarves', () => {
  let state = createInitialGameState('Forge-Test');
  const cx = Math.floor(state.world.width / 2);
  const cy = Math.floor(state.world.height / 2);

  // Place a Smeltery and Forge directly on Z-0 floor
  state.grid[0][cy + 1][cx + 1].terrain = 'WORKSHOP_SMELTER';
  state.grid[0][cy + 1][cx + 2].terrain = 'WORKSHOP_FORGE';
  state.workOrders = [
    {
      id: 'test-smelt',
      title: 'Smelt Steel Bars',
      workshop: 'WORKSHOP_SMELTER',
      cost: { ironOre: 2, wood: 1 },
      produce: { steelBars: 2, wealth: 40 },
      remaining: 1,
      autoRepeat: true,
    },
  ];

  const initialSteel = state.resources.steelBars;
  for (let i = 0; i < 12; i++) {
    state = stepSimulationTick(state);
  }

  assert.ok(state.resources.steelBars > initialSteel, 'Smeltery should smelt iron ore into steel bars');
  assert.equal(state.workOrders[0].remaining, 1, 'Auto-repeat order should remain active at 1');
});

test('goblin raids, stone traps, and dwarven militia combat engage and defeat hostiles', () => {
  let state = createInitialGameState('Combat-Test');
  const cx = Math.floor(state.world.width / 2);
  const cy = Math.floor(state.world.height / 2);

  state = spawnGoblinRaid(state);
  assert.ok(state.hostiles.some((h) => h.kind === 'GOBLIN_RAIDER'), 'Should spawn goblin raiders on Z-0');

  // Place a goblin raider next to armed militia dwarf on a stone trap
  state.militiaDoctrine = 'SALLY_FORTH';
  state.grid[0][cy][cx + 2].terrain = 'TRAP_STONE';
  state.hostiles.push({
    id: 'test-goblin-close',
    name: 'Test Goblin Scout',
    kind: 'GOBLIN_RAIDER',
    char: 'g',
    color: '#ff0000',
    x: cx + 1,
    y: cy,
    z: 0,
    hp: 15,
    maxHp: 30,
    attack: 4,
    behavior: 'RAID_SEEK',
  });

  const initialWealth = state.resources.wealth;
  state = stepSimulationTick(state);

  assert.ok(
    !state.hostiles.some((h) => h.id === 'test-goblin-close'),
    'Armed militia dwarf should defeat adjacent low-HP goblin raider'
  );
  assert.ok(state.resources.wealth > initialWealth, 'Defeating raider should grant wealth bounty');
});

test('strata scanner, labor presets, and trade depot custom barter work deterministically', () => {
  let state = createInitialGameState('Scanner-Test');
  const scan = scanWorldStrata(state);
  assert.equal(scan.length, 6);
  assert.ok(scan[0].ironTiles > 0, 'Z-0 scan should detect surface iron/copper veins');
  assert.ok(scan[3].relicTiles >= 1, 'Z-3 scan should detect subterranean cavern relic');

  state = applyLaborPreset(state, 'SMITH_FORTIFY');
  assert.ok(state.dwarves.every((d) => d.labors.SMITHING && d.labors.COMBAT));

  const prevFood = state.resources.food;
  const prevPop = state.dwarves.length;
  // A fair charter covers 75g food + 60g ale + 90g recruitment.
  state.resources.stone = 120;
  state = executeTradeBarter(state, { stone: 115 }, { food: 15, ale: 10 }, true);
  assert.equal(state.resources.food, prevFood + 15);
  assert.equal(state.dwarves.length, prevPop + 1, 'Barter with migrant contract should add 1 dwarf');
});
