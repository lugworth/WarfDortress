import test from "node:test";
import assert from "node:assert/strict";
import { createInitialGameState } from "./game-engine.ts";
import { initializeActivities } from "./activities.ts";
import {
  applyResearchAction,
  createResearchState,
  getResearchBonuses,
  RESEARCH_PROJECTS,
  researchBlockers,
  stepResearch,
  validResearchState,
} from "./research.ts";
import type { ResearchProjectId, ResearchState } from "./research.ts";
import type { GameState, TileTerrain } from "./types.ts";

const fixture = () =>
  initializeActivities(createInitialGameState("Research-Test"));
const start = (state: GameState, projectId: ResearchProjectId) =>
  applyResearchAction(state, { type: "START_RESEARCH", projectId });
function build(state: GameState, x: number, terrain: TileTerrain) {
  state.grid[0][1][x].terrain = terrain;
  state.grid[0][1][x].designation = undefined;
}
function complete(state: GameState, projectId: ResearchProjectId) {
  const working = start(state, projectId);
  assert.ok(working.activities?.research.active);
  return stepResearch({
    ...working,
    ticks: working.activities.research.active.completesAt,
  });
}

test("camp research starts atomically from a fresh fortress, pays once, and leaves input unchanged", () => {
  const state = fixture();
  const before = structuredClone(state);
  assert.deepEqual(researchBlockers(state, "PICK_TECHNIQUES"), []);
  const next = start(state, "PICK_TECHNIQUES");
  assert.deepEqual(state, before);
  assert.equal(next.resources.stone, state.resources.stone - 6);
  assert.equal(next.resources.wood, state.resources.wood - 2);
  assert.equal(next.resources.ironOre, state.resources.ironOre - 1);
  assert.equal(next.activities?.expeditions, state.activities.expeditions);
  assert.equal(next.activities?.festivals, state.activities.festivals);
  assert.deepEqual(next.activities?.research.active, {
    projectId: "PICK_TECHNIQUES",
    startedAt: 0,
    completesAt: 18,
  });
  assert.equal(start(next, "PICK_TECHNIQUES"), next);
  assert.equal(start(next, "MUSHROOM_CELLAR"), next);
  assert.deepEqual(getResearchBonuses(next), {
    mining: 0,
    foodPerFarm: 0,
    combat: 0,
  });
});

test("unaffordable and unknown projects spend nothing; built prerequisites exclude queued orders", () => {
  const state = fixture();
  state.resources.ironOre = 0;
  assert.equal(start(state, "PICK_TECHNIQUES"), state);
  assert.equal(start(state, "NOT_REAL" as ResearchProjectId), state);
  assert.equal(
    applyResearchAction(state, {
      type: "OTHER",
      projectId: "PICK_TECHNIQUES",
    } as never),
    state,
  );
  state.grid[0][1][1].designation = "BUILD_FARM";
  state.grid[0][1][2].designation = "BUILD_CARPENTER";
  assert.equal(start(state, "MUSHROOM_CELLAR"), state);
  build(state, 1, "FARM_PLOT");
  assert.equal(start(state, "MUSHROOM_CELLAR"), state);
  build(state, 2, "WORKSHOP_CARPENTER");
  assert.notEqual(start(state, "MUSHROOM_CELLAR"), state);
});

test("watch drills require an actual forge and a living militia member", () => {
  const state = fixture();
  state.resources.weapons = 1;
  state.dwarves.forEach((d) => {
    d.labors.COMBAT = false;
  });
  state.grid[0][1][1].designation = "BUILD_FORGE";
  assert.equal(start(state, "WATCH_DRILLS"), state);
  build(state, 1, "WORKSHOP_FORGE");
  assert.equal(start(state, "WATCH_DRILLS"), state);
  state.dwarves[0].labors.COMBAT = true;
  state.dwarves[0].hp = 0;
  assert.equal(start(state, "WATCH_DRILLS"), state);
  state.dwarves[0].hp = 1;
  const next = start(state, "WATCH_DRILLS");
  assert.equal(next.resources.weapons, 0);
  assert.ok(next.activities?.research.active);
});

test("research finishes at its exact deadline, unlocks once, and cannot be bought again", () => {
  const state = start(fixture(), "PICK_TECHNIQUES");
  const before = { ...state, ticks: 17 };
  assert.equal(stepResearch(before), before);
  const deadline = { ...state, ticks: 18 };
  const done = stepResearch(deadline);
  assert.equal(state.activities?.research.completed.length, 0);
  assert.equal(done.activities?.research.active, null);
  assert.equal(done.activities?.research.completed.length, 1);
  assert.deepEqual(getResearchBonuses(done), {
    mining: 1,
    foodPerFarm: 0,
    combat: 0,
  });
  assert.equal(stepResearch(done), done);
  assert.equal(start(done, "PICK_TECHNIQUES"), done);
  assert.ok(validResearchState(done.activities?.research, done));
});

test("future deadlines survive JSON saves deterministically and tick skips complete at the nominal deadline", () => {
  const a = start({ ...fixture(), ticks: 100 }, "PICK_TECHNIQUES");
  const b = start({ ...fixture(), ticks: 100 }, "PICK_TECHNIQUES");
  assert.deepEqual(a.activities?.research, b.activities?.research);
  const saved = JSON.parse(
    JSON.stringify(a.activities!.research),
  ) as ResearchState;
  assert.ok(validResearchState(saved, a));
  const restored = { ...a, activities: { ...a.activities!, research: saved } };
  assert.equal(stepResearch(restored), restored);
  const skipped = stepResearch({ ...restored, ticks: 300 });
  assert.equal(skipped.activities?.research.completed[0].completedAt, 118);
  assert.ok(validResearchState(skipped.activities?.research, skipped));
  assert.equal(stepResearch(skipped), skipped);
  assert.equal(validResearchState(saved, { ...a, ticks: 99 }), false);
  assert.equal(
    validResearchState(skipped.activities?.research, { ...a, ticks: 117 }),
    false,
  );
});

test("all finite projects give bounded nonstacking bonuses and a bounded journal", () => {
  let state: GameState = fixture();
  build(state, 1, "FARM_PLOT");
  build(state, 2, "WORKSHOP_CARPENTER");
  build(state, 3, "WORKSHOP_FORGE");
  state.resources.weapons = 1;
  state.resources.ale = 20;
  state.dwarves[0].labors.COMBAT = true;
  for (const project of RESEARCH_PROJECTS) state = complete(state, project.id);
  assert.deepEqual(getResearchBonuses(state), {
    mining: 1,
    foodPerFarm: 1,
    combat: 1,
  });
  assert.equal(state.activities?.research.completed.length, 3);
  assert.equal(state.activities?.research.history.length, 6);
  for (const project of RESEARCH_PROJECTS)
    assert.equal(start(state, project.id), state);
  assert.ok(validResearchState(state.activities?.research, state));
});

test("strict validator rejects malformed, duplicate, overlapping, unbounded and forged saved records", () => {
  const done = complete(fixture(), "PICK_TECHNIQUES");
  const good = done.activities!.research;
  const corruptions: unknown[] = [
    null,
    [],
    { ...createResearchState(), version: 2 },
    { ...good, bonus: 999 },
    { ...good, history: good.history.slice(0, 1) },
    { ...good, history: Array(7).fill(good.history[0]) },
    { ...good, completed: [...good.completed, good.completed[0]] },
    {
      ...good,
      active: { projectId: "PICK_TECHNIQUES", startedAt: 18, completesAt: 36 },
    },
    {
      ...good,
      active: { projectId: "WATCH_DRILLS", startedAt: 17, completesAt: 41 },
    },
  ];
  for (const startedAt of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    corruptions.push({
      ...createResearchState(),
      active: {
        projectId: "WATCH_DRILLS",
        startedAt,
        completesAt: startedAt + 24,
      },
    });
  for (const bad of corruptions)
    assert.equal(validResearchState(bad, done), false);
  const altered = structuredClone(good);
  altered.completed[0].completedAt++;
  assert.equal(validResearchState(altered, done), false);
  const unknown = structuredClone(good);
  unknown.completed[0].projectId = "HACK" as ResearchProjectId;
  assert.equal(validResearchState(unknown, done), false);
  const forged = {
    ...done,
    activities: {
      ...done.activities!,
      research: { ...good, completed: [...good.completed, good.completed[0]] },
    },
  };
  assert.deepEqual(getResearchBonuses(forged), {
    mining: 0,
    foodPerFarm: 0,
    combat: 0,
  });
  assert.equal(start(forged, "WATCH_DRILLS"), forged);
  assert.ok(validResearchState(createResearchState()));
});
