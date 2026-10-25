import test from "node:test";
import assert from "node:assert/strict";
import type { GameState, TileTerrain } from "./types.ts";
import { createInitialGameState, stepSimulationTick } from "./game-engine.ts";
import {
  initializeActivities,
  performActivityAction,
  stepActivities,
} from "./activities.ts";
import {
  applyResearchAction,
  createResearchState,
  stepResearch,
} from "./research.ts";
import { applyFestivalAction } from "./festivals.ts";
import { deserializeFortress, serializeFortress } from "./save-system.ts";
import { getTerrainVisuals } from "./world-gen.ts";

function tile(state: GameState, x: number, y: number, terrain: TileTerrain) {
  Object.assign(state.grid[0][y][x], getTerrainVisuals(terrain), {
    terrain,
    designation: undefined,
    revealed: true,
  });
}
function quiet(): GameState {
  const state = initializeActivities(
    createInitialGameState("Activities-Integration"),
  );
  state.hostiles = [];
  state.workOrders = [];
  state.activeEvent = null;
  state.dwarves.forEach((d) => {
    d.hunger = 100;
    d.thirst = 100;
    d.energy = 100;
    d.happiness = 80;
    d.currentTask = undefined;
  });
  return state;
}
function mining() {
  const state = quiet();
  state.dwarves = [state.dwarves[0]];
  const dwarf = state.dwarves[0];
  dwarf.x = 38;
  dwarf.y = 21;
  dwarf.z = 0;
  dwarf.quirk = "BRAVE";
  dwarf.labors.COMBAT = false;
  dwarf.labors.MINING = true;
  tile(state, 38, 21, "GRASS");
  tile(state, 39, 21, "GRANITE_WALL");
  state.grid[0][21][39].designation = "MINE";
  dwarf.currentTask = {
    x: 39,
    y: 21,
    z: 0,
    type: "MINE",
    progress: 0,
    totalTicks: 10,
  };
  return state;
}
test("research and contests change actual mining progress rather than only a displayed stat", () => {
  let upgraded = applyResearchAction(mining(), {
    type: "START_RESEARCH",
    projectId: "PICK_TECHNIQUES",
  });
  upgraded = stepResearch({ ...upgraded, ticks: 18 });
  const baseline = structuredClone(upgraded);
  baseline.activities!.research = createResearchState();
  assert.equal(
    stepSimulationTick(upgraded).dwarves[0].currentTask!.progress,
    stepSimulationTick(baseline).dwarves[0].currentTask!.progress + 1,
  );
  tile(baseline, 2, 2, "WORKSHOP_MASON");
  const contest = applyFestivalAction(baseline, {
    type: "START_FESTIVAL",
    festival: "STONECRAFT_CONTEST",
  });
  assert.ok(contest.activities!.festivals.active);
  assert.equal(
    stepSimulationTick(contest).dwarves[0].currentTask!.progress,
    stepSimulationTick(baseline).dwarves[0].currentTask!.progress + 1,
  );
});
test("mushroom cellar adds one food per actual farm harvest", () => {
  const start = quiet();
  tile(start, 2, 2, "FARM_PLOT");
  tile(start, 3, 2, "FARM_PLOT");
  tile(start, 4, 2, "WORKSHOP_CARPENTER");
  let state = applyResearchAction(start, {
    type: "START_RESEARCH",
    projectId: "MUSHROOM_CELLAR",
  });
  state = stepResearch({ ...state, ticks: 24 });
  const baseline = structuredClone(state);
  baseline.activities!.research = createResearchState();
  assert.equal(
    stepSimulationTick(state).resources.food,
    stepSimulationTick(baseline).resources.food + 2,
  );
});
test("watch drills add one real militia damage without changing untrained defenders", () => {
  const start = quiet();
  tile(start, 2, 2, "WORKSHOP_FORGE");
  start.dwarves = [start.dwarves[0]];
  const dwarf = start.dwarves[0];
  dwarf.labors.COMBAT = true;
  dwarf.quirk = "BRAVE";
  dwarf.x = 38;
  dwarf.y = 21;
  dwarf.z = 0;
  tile(start, 38, 21, "GRASS");
  tile(start, 39, 21, "GRASS");
  let state = applyResearchAction(start, {
    type: "START_RESEARCH",
    projectId: "WATCH_DRILLS",
  });
  state = stepResearch({ ...state, ticks: 24 });
  state.hostiles = [
    {
      id: "training-enemy",
      name: "Armored raider",
      kind: "GOBLIN_RAIDER",
      behavior: "RAID_SEEK",
      char: "g",
      color: "#ff0000",
      x: 39,
      y: 21,
      z: 0,
      hp: 1000,
      maxHp: 1000,
      attack: 1,
    },
  ];
  const baseline = structuredClone(state);
  baseline.activities!.research = createResearchState();
  assert.equal(
    stepSimulationTick(state).hostiles[0].hp,
    stepSimulationTick(baseline).hostiles[0].hp - 1,
  );
  state.dwarves[0].labors.COMBAT = false;
  baseline.dwarves[0].labors.COMBAT = false;
  assert.equal(
    stepSimulationTick(state).hostiles[0].hp,
    stepSimulationTick(baseline).hostiles[0].hp,
  );
});
test("old v1/v2/full saves initialize empty activities while active trips, cooldowns, and research roundtrip", () => {
  let state = quiet();
  state = performActivityAction(state, {
    type: "START_EXPEDITION",
    routeId: "RIVER_SUPPLIES",
    approach: "BOLD",
  });
  state = performActivityAction(state, {
    type: "START_FESTIVAL",
    festival: "FOUNDERS_SUPPER",
  });
  state = performActivityAction(state, {
    type: "START_RESEARCH",
    projectId: "PICK_TECHNIQUES",
  });
  const modern = serializeFortress(state);
  assert.deepEqual(deserializeFortress(modern).activities, state.activities);
  const snapshot = JSON.parse(modern);
  delete snapshot.state.activities;
  for (const version of [1, 2]) {
    const restored = deserializeFortress(
      JSON.stringify({ ...snapshot, version }),
    );
    assert.equal(restored.activities!.expeditions.active, null);
    assert.deepEqual(restored.activities!.research.completed, []);
    assert.equal(restored.resources.wealth, state.resources.wealth);
  }
  const legacy = JSON.parse(JSON.stringify(state));
  delete legacy.activities;
  assert.equal(
    deserializeFortress(JSON.stringify(legacy)).activities!.festivals.active,
    null,
  );
  const broken = JSON.parse(modern);
  broken.state.activities.version = 999;
  assert.throws(() => deserializeFortress(JSON.stringify(broken)));
  broken.state.activities = null;
  assert.throws(() => deserializeFortress(JSON.stringify(broken)));
});
test("real simulation ticks finish projects and trips once; render-only activity stepping cannot duplicate rewards", () => {
  let state = quiet();
  state = performActivityAction(state, {
    type: "START_EXPEDITION",
    routeId: "RIVER_SUPPLIES",
    approach: "BOLD",
  });
  state = performActivityAction(state, {
    type: "START_RESEARCH",
    projectId: "PICK_TECHNIQUES",
  });
  for (let i = 0; i < 18; i++) state = stepSimulationTick(state);
  assert.equal(state.activities!.research.completed.length, 1);
  assert.equal(state.activities!.expeditions.active!.status, "READY");
  const logCount = state.chronicle.filter((e) =>
    e.id.startsWith("research-complete-"),
  ).length;
  assert.equal(logCount, 1);
  const repeated = stepActivities(state);
  assert.deepEqual(repeated.resources, state.resources);
  assert.equal(repeated.activities!.research.completed.length, 1);
  assert.equal(
    repeated.chronicle.filter((e) => e.id.startsWith("research-complete-"))
      .length,
    1,
  );
});
