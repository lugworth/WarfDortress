import type { GameState, TileTerrain } from './types.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialGameState, stepSimulationTick, applyAreaDesignation, canDesignateTile, generateContextAwareEvent, resolveNarrativeEvent, executeTradeBarter } from './game-engine.ts';
import { getTerrainVisuals } from './world-gen.ts';
function fixture() {
  const state = createInitialGameState('Review-251');
  state.hostiles = [];
  state.resources.stone = 100;
  state.workOrders = [];
  state.dwarves = [state.dwarves[0]];
  state.dwarves[0].labors.COMBAT = false;
  state.dwarves[0].quirk = 'BRAVE';
  state.dwarves[0].x = 38;
  state.dwarves[0].y = 21;
  return state;
}
function terrain(state: GameState, z: number, x: number, y: number, value: TileTerrain) {
  Object.assign(state.grid[z][y][x], getTerrainVisuals(value), { terrain: value });
}

test('a repeating brew order must not starve a smelter in a different workshop', () => {
  const state = fixture();
  terrain(state, 0, 35, 21, 'WORKSHOP_STILL');
  terrain(state, 0, 36, 21, 'WORKSHOP_SMELTER');
  state.workOrders = [
    { id: 'brew', title: 'Brew', workshop: 'WORKSHOP_STILL', cost: { food: 2 }, produce: { ale: 5 }, remaining: 1, autoRepeat: true },
    { id: 'smelt', title: 'Smelt', workshop: 'WORKSHOP_SMELTER', cost: { ironOre: 2 }, produce: { steelBars: 2 }, remaining: 1 },
  ];
  state.ticks = 11;
  const next = stepSimulationTick(state);
  assert.equal(next.resources.steelBars, state.resources.steelBars + 2);
});

test('a dwarf must not step into an unmined wall to reach a job', () => {
  let state = fixture();
  terrain(state, 0, 39, 21, 'GRANITE_WALL');
  terrain(state, 0, 40, 21, 'GRANITE_WALL');
  state = applyAreaDesignation(state, 0, 40, 21, 40, 21, 'MINE').nextState;
  const next = stepSimulationTick(state);
  const dwarf = next.dwarves[0];
  assert.equal(next.grid[dwarf.z][dwarf.y][dwarf.x].walkable, true);
});

test('a stair must not teleport a dwarf into an unlinked lower level', () => {
  let state = fixture();
  state.dwarves[0].z = 1;
  terrain(state, 2, 38, 21, 'GRANITE_WALL');
  terrain(state, 3, 39, 21, 'GRANITE_WALL');
  state = applyAreaDesignation(state, 3, 39, 21, 39, 21, 'MINE').nextState;
  const next = stepSimulationTick(state);
  assert.equal(next.dwarves[0].z, 1, 'No paired stair exists at Z-2');
});

test('normal construction must not silently replace an existing workshop', () => {
  const state = fixture();
  terrain(state, 0, 39, 21, 'WORKSHOP_FORGE');
  assert.equal(canDesignateTile(state.grid[0][21][39], 'BUILD_FARM'), false);
});

test('an unaffordable narrative choice must not grant its rewards', () => {
  const state = fixture();
  state.resources.stone = 0;
  state.activeEvent = generateContextAwareEvent(state, 'TRADE_CARAVAN');
  const next = resolveNarrativeEvent(state, 'trade-crafts');
  assert.equal(next.resources.food, state.resources.food);
  assert.equal(next.dwarves.length, state.dwarves.length);
});

test('recruitment must consume equipment issued from the stockpile', () => {
  const state = fixture();
  state.resources.weapons = 1;
  state.resources.armor = 1;
  const next = executeTradeBarter(state, { stone: 50 }, { food: 1 }, true);
  assert.equal(next.resources.weapons, 0);
  assert.equal(next.resources.armor, 0);
});

test('AI event promising three migrants must actually spawn three', () => {
  const state = fixture();
  state.activeEvent = generateContextAwareEvent(state, 'TRADE_CARAVAN');
  state.activeEvent.choices[0].spawnMigrants = 3;
  const next = resolveNarrativeEvent(state, state.activeEvent.choices[0].id);
  assert.equal(next.dwarves.length, state.dwarves.length + 3);
});

test('a dwarf with its mining labor disabled must abandon the mining job', () => {
  let state = fixture();
  terrain(state, 0, 39, 21, 'GRANITE_WALL');
  state = applyAreaDesignation(state, 0, 39, 21, 39, 21, 'MINE').nextState;
  state = stepSimulationTick(state);
  assert.equal(state.dwarves[0].currentTask?.type, 'MINE');
  state.dwarves[0].labors.MINING = false;
  const next = stepSimulationTick(state);
  assert.equal(next.grid[0][21][39].terrain, 'GRANITE_WALL');
});

test('population must stop at the maximum accepted by the save rules', () => {
  const state = fixture();
  state.dwarves = Array.from({ length: 200 }, (_, i) => ({ ...state.dwarves[0], id: `dwarf-${i + 1}` }));
  const next = executeTradeBarter(state, { stone: 50 }, { food: 1 }, true);
  assert.ok(next.dwarves.length <= 200);
});

test('a reachable mining job routes around a blocking wall and actually completes', () => {
  let state = fixture();
  for (let y = 19; y <= 23; y++) for (let x = 36; x <= 42; x++) terrain(state, 0, x, y, 'ROCK_FLOOR');
  terrain(state, 0, 39, 21, 'CONSTRUCTED_WALL');
  terrain(state, 0, 41, 21, 'GRANITE_WALL');
  state = applyAreaDesignation(state, 0, 41, 21, 41, 21, 'MINE').nextState;
  for (let i = 0; i < 10; i++) {
    state = stepSimulationTick(state);
    const dwarf = state.dwarves[0];
    assert.equal(state.grid[dwarf.z][dwarf.y][dwarf.x].walkable, true);
  }
  assert.equal(state.grid[0][21][41].terrain, 'ROCK_FLOOR');
  assert.equal(state.grid[0][21][39].terrain, 'CONSTRUCTED_WALL');
});

test('paired stairs allow reachable underground jobs to complete', () => {
  let state = fixture();
  terrain(state, 1, 40, 21, 'GRANITE_WALL');
  state = applyAreaDesignation(state, 1, 40, 21, 40, 21, 'MINE').nextState;
  for (let i = 0; i < 8; i++) state = stepSimulationTick(state);
  assert.equal(state.grid[1][21][40].terrain, 'ROCK_FLOOR');
});

test('building a wall under the worker first moves them to a safe adjacent cell', () => {
  let state = fixture();
  terrain(state, 0, 39, 21, 'ROCK_FLOOR');
  terrain(state, 0, 38, 21, 'ROCK_FLOOR');
  state = applyAreaDesignation(state, 0, 38, 21, 38, 21, 'BUILD_WALL').nextState;
  for (let i = 0; i < 5; i++) {
    state = stepSimulationTick(state);
    const dwarf = state.dwarves[0];
    assert.equal(state.grid[dwarf.z][dwarf.y][dwarf.x].walkable, true);
  }
  assert.equal(state.grid[0][21][38].terrain, 'CONSTRUCTED_WALL');
});

test('orders competing for one workshop get a fair turn and never exceed capacity', () => {
  let state = fixture();
  terrain(state, 0, 36, 21, 'WORKSHOP_FORGE');
  state.resources.steelBars = 20;
  state.workOrders = [
    { id: 'axes', title: 'Axes', workshop: 'WORKSHOP_FORGE', cost: { steelBars: 1 }, produce: { weapons: 1 }, remaining: 1, autoRepeat: true },
    { id: 'armor', title: 'Armor', workshop: 'WORKSHOP_FORGE', cost: { steelBars: 1 }, produce: { armor: 1 }, remaining: 1, autoRepeat: true },
  ];
  const before = state.resources.weapons + state.resources.armor;
  for (let i = 0; i < 24; i++) state = stepSimulationTick(state);
  assert.equal(state.resources.weapons + state.resources.armor, before + 2);
  assert.equal(state.resources.weapons, 3);
  assert.equal(state.resources.armor, 2);
});

test('unknown decrees and unfair or stale trades are rejected without effects', () => {
  const state = fixture();
  state.activeEvent = generateContextAwareEvent(state, 'TRADE_CARAVAN');
  assert.equal(resolveNarrativeEvent(state, 'not-a-choice'), state);
  assert.equal(executeTradeBarter(state, { stone: 1 }, { food: 99 }), state);
  assert.equal(executeTradeBarter(state, { stone: 101 }, { food: 1 }), state);
});

test('idle wandering cannot move a dwarf onto a wall being finished this tick', () => {
  const state = fixture();
  state.ticks = 4;
  terrain(state, 0, 37, 20, 'ROCK_FLOOR');
  terrain(state, 0, 37, 21, 'ROCK_FLOOR');
  const builder = state.dwarves[0];
  const idle = { ...builder, id: 'idle', x: 37, y: 20, labors: { ...builder.labors, MASONRY: false } };
  state.dwarves = [idle, builder];
  state.grid[0][21][37].designation = 'BUILD_WALL';
  builder.currentTask = { x: 37, y: 21, z: 0, type: 'BUILD_WALL', progress: 1, totalTicks: 2 };

  const next = stepSimulationTick(state);
  assert.equal(next.grid[0][21][37].terrain, 'CONSTRUCTED_WALL');
  for (const dwarf of next.dwarves) assert.equal(next.grid[dwarf.z][dwarf.y][dwarf.x].walkable, true);
});

test('wall completion uses a previous worker’s new position after they leave the site', () => {
  const state = fixture();
  state.ticks = 4;
  terrain(state, 0, 37, 20, 'ROCK_FLOOR');
  terrain(state, 0, 37, 21, 'ROCK_FLOOR');
  const builder = state.dwarves[0];
  const idle = { ...builder, id: 'idle', x: 37, y: 21, labors: { ...builder.labors, MASONRY: false } };
  state.dwarves = [idle, builder];
  state.grid[0][21][37].designation = 'BUILD_WALL';
  builder.currentTask = { x: 37, y: 21, z: 0, type: 'BUILD_WALL', progress: 1, totalTicks: 2 };

  const next = stepSimulationTick(state);
  assert.equal(next.dwarves[0].y, 20);
  assert.equal(next.grid[0][21][37].terrain, 'CONSTRUCTED_WALL');
});
