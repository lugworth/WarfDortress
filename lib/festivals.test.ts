import test from "node:test";
import assert from "node:assert/strict";
import { createInitialGameState } from "./game-engine.ts";
import {
  applyFestivalAction,
  createFestivalState,
  festivalBlockers,
  getFestivalWorkBonus,
  stepFestivals,
  validFestivalState,
} from "./festivals.ts";
import { deserializeFortress, serializeFortress } from "./save-system.ts";

test("a founding supper spends atomically, caps needs, records a seeded story, and rejects repeat starts", () => {
  const state = createInitialGameState("Feast-Test");
  state.dwarves[0].happiness = 98;
  state.dwarves[0].energy = 98;
  const before = structuredClone(state),
    next = applyFestivalAction(state, {
      type: "START_FESTIVAL",
      festival: "FOUNDERS_SUPPER",
    });
  assert.deepEqual(state, before);
  assert.equal(next.resources.food, state.resources.food - 8);
  assert.equal(next.resources.ale, state.resources.ale - 4);
  assert.equal(next.dwarves[0].happiness, 100);
  assert.equal(next.dwarves[0].energy, 100);
  assert.equal(next.activities!.festivals.active!.expiresAt, 24);
  assert.deepEqual(
    next.activities!.festivals.memories,
    applyFestivalAction(state, {
      type: "START_FESTIVAL",
      festival: "FOUNDERS_SUPPER",
    }).activities!.festivals.memories,
  );
  assert.equal(
    applyFestivalAction(next, {
      type: "START_FESTIVAL",
      festival: "FOUNDERS_SUPPER",
    }),
    next,
  );
  state.resources.food = 0;
  assert.equal(
    applyFestivalAction(state, {
      type: "START_FESTIVAL",
      festival: "FOUNDERS_SUPPER",
    }),
    state,
  );
});
test("celebrations require completed buildings rather than queued construction", () => {
  const state = createInitialGameState("Contest-Test");
  state.grid[0][1][1].designation = "BUILD_MASON";
  assert.ok(festivalBlockers(state, "STONECRAFT_CONTEST").length);
  assert.equal(
    applyFestivalAction(state, {
      type: "START_FESTIVAL",
      festival: "STONECRAFT_CONTEST",
    }),
    state,
  );
  state.grid[0][1][1].terrain = "WORKSHOP_MASON";
  const contest = applyFestivalAction(state, {
    type: "START_FESTIVAL",
    festival: "STONECRAFT_CONTEST",
  });
  assert.equal(getFestivalWorkBonus(contest), 1);
  assert.equal(getFestivalWorkBonus({ ...contest, ticks: 24 }), 0);
  assert.equal(getFestivalWorkBonus(state), 0);
  assert.equal(
    applyFestivalAction(state, {
      type: "START_FESTIVAL",
      festival: "TAVERN_TALES",
    }),
    state,
  );
});
test("festival pulses happen once per simulation tick and expired saved effects never replay", () => {
  const state = createInitialGameState("Pulse-Test");
  state.dwarves.forEach((d) => {
    d.happiness = 50;
    d.energy = 50;
  });
  const started = applyFestivalAction(state, {
    type: "START_FESTIVAL",
    festival: "FOUNDERS_SUPPER",
  });
  const pulsed = stepFestivals({ ...started, ticks: 6 });
  assert.equal(pulsed.dwarves[0].happiness, started.dwarves[0].happiness + 1);
  assert.equal(pulsed.dwarves[0].energy, started.dwarves[0].energy + 2);
  assert.equal(stepFestivals(pulsed), pulsed);
  const expired = stepFestivals(
    deserializeFortress(serializeFortress({ ...pulsed, ticks: 30 })),
  );
  assert.equal(expired.activities!.festivals.active, null);
  assert.equal(expired.dwarves[0].happiness, pulsed.dwarves[0].happiness);
  assert.equal(stepFestivals(expired), expired);
  assert.equal(
    applyFestivalAction(expired, {
      type: "START_FESTIVAL",
      festival: "FOUNDERS_SUPPER",
    }),
    expired,
  );
  assert.notEqual(
    applyFestivalAction(
      { ...expired, ticks: 120 },
      { type: "START_FESTIVAL", festival: "FOUNDERS_SUPPER" },
    ),
    expired,
  );
});
test("tavern bonds require nearby attendees rather than linking dwarves across depths", () => {
  const state = createInitialGameState("Tales-Test");
  state.grid[0][10][10].terrain = "TAVERN_HALL";
  state.dwarves.forEach((d, i) => {
    d.x = 10 + i;
    d.y = 10;
    d.z = i < 2 ? 0 : 2;
  });
  const started = applyFestivalAction(state, {
    type: "START_FESTIVAL",
    festival: "TAVERN_TALES",
  });
  const next = stepFestivals({ ...started, ticks: 6 });
  const [a, b] = [state.dwarves[0].id, state.dwarves[1].id].sort();
  const oldScore =
    state.guild.relationships.find((r) => r.a === a && r.b === b)?.score || 0;
  assert.equal(
    next.guild.relationships.find((r) => r.a === a && r.b === b)!.score,
    oldScore + 1,
  );
  assert.ok(
    next.guild.relationships
      .filter((r) => r.reason.includes("tavern celebration"))
      .every((r) => r.a === a && r.b === b),
  );
});
test("festival history stays bounded and validators reject malformed timers or memory payloads", () => {
  let state = createInitialGameState("Memories-Test");
  state.resources.food = 1000;
  state.resources.ale = 1000;
  for (let i = 0; i < 6; i++) {
    state = applyFestivalAction(
      { ...state, ticks: i * 120 },
      { type: "START_FESTIVAL", festival: "FOUNDERS_SUPPER" },
    );
    for (const offset of [6, 12, 18, 24])
      state = stepFestivals({ ...state, ticks: i * 120 + offset });
  }
  assert.equal(state.activities!.festivals.memories.length, 18);
  assert.ok(validFestivalState(state.activities!.festivals, state));
  const empty = createFestivalState();
  for (const bad of [
    null,
    [],
    { ...empty, version: 9 },
    { ...empty, lastStepTick: -1 },
    { ...empty, readyAt: {} },
    {
      ...empty,
      active: { festival: "FOUNDERS_SUPPER", startedAt: 0, expiresAt: 999 },
    },
    { ...empty, memories: Array(19).fill({}) },
    {
      ...empty,
      memories: [
        {
          festival: "FOUNDERS_SUPPER",
          tick: 0,
          dwarfId: "x",
          anecdote: "x".repeat(241),
        },
      ],
    },
  ])
    assert.equal(validFestivalState(bad, state), false);
});
