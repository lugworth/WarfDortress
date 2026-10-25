import test from "node:test";
import assert from "node:assert/strict";
import { createInitialGameState } from "./game-engine.ts";
import { deserializeFortress, serializeFortress } from "./save-system.ts";
import {
  applyExpeditionAction,
  EXPEDITION_ROUTES,
  expeditionOutcome,
  stepExpeditions,
  validExpeditionState,
} from "./expeditions.ts";
import { getFortressNotices } from "./ui-model.ts";
import { stepGuild } from "./guild.ts";

const launch = (seed = "Scout-Test") =>
  applyExpeditionAction(createInitialGameState(seed), {
    type: "START_EXPEDITION",
    routeId: "RIVER_SUPPLIES",
    approach: "BOLD",
  });
test("expedition departure is atomic and leaves dwarves on duty; an active trip blocks a second charge", () => {
  const state = createInitialGameState("Scout-atomic"),
    before = structuredClone(state);
  const next = applyExpeditionAction(state, {
    type: "START_EXPEDITION",
    routeId: "RIVER_SUPPLIES",
    approach: "CAUTIOUS",
  });
  assert.deepEqual(state, before);
  assert.equal(next.resources.wealth, state.resources.wealth - 35);
  assert.equal(next.resources.food, state.resources.food - 2);
  assert.equal(next.dwarves, state.dwarves);
  assert.equal(next.ticks, state.ticks);
  assert.equal(next.activities?.expeditions.active?.returnsAt, 24);
  assert.equal(
    applyExpeditionAction(next, {
      type: "START_EXPEDITION",
      routeId: "ANCIENT_VAULT",
      approach: "BOLD",
    }),
    next,
  );
  state.resources.wealth = 0;
  assert.equal(
    applyExpeditionAction(state, {
      type: "START_EXPEDITION",
      routeId: "RIVER_SUPPLIES",
      approach: "BOLD",
    }),
    state,
  );
});
test("return and claim use simulation deadlines, produce a notice, and award cargo once across save/load", () => {
  let state = launch();
  const run = state.activities!.expeditions.active!;
  assert.equal(
    applyExpeditionAction(state, { type: "CLAIM_EXPEDITION", id: run.id }),
    state,
  );
  const before = { ...state, ticks: run.returnsAt - 1 };
  assert.equal(stepExpeditions(before), before);
  state = stepExpeditions({ ...state, ticks: run.returnsAt });
  assert.equal(state.activities!.expeditions.active!.status, "READY");
  assert.equal(stepExpeditions(state), state);
  assert.ok(getFortressNotices(state).some((n) => n.action === "ADVENTURE"));
  const reward = expeditionOutcome(state.world.seed, run).reward,
    paid = { ...state.resources };
  state = applyExpeditionAction(deserializeFortress(serializeFortress(state)), {
    type: "CLAIM_EXPEDITION",
    id: run.id,
  });
  for (const [key, amount] of Object.entries(reward))
    assert.equal(
      state.resources[key as keyof typeof paid],
      paid[key as keyof typeof paid] + amount!,
    );
  assert.equal(state.activities!.expeditions.history.length, 1);
  assert.equal(
    applyExpeditionAction(state, { type: "CLAIM_EXPEDITION", id: run.id }),
    state,
  );
  const restored = deserializeFortress(serializeFortress(state));
  assert.equal(
    applyExpeditionAction(restored, { type: "CLAIM_EXPEDITION", id: run.id }),
    restored,
  );
  assert.equal(
    getFortressNotices(restored).some((n) => n.action === "ADVENTURE"),
    false,
  );
});
test("route outcomes are seeded and both success and setbacks preserve the declared rewards", () => {
  for (const route of EXPEDITION_ROUTES)
    for (const approach of ["CAUTIOUS", "BOLD"] as const) {
      const seen = new Set<string>();
      for (let ordinal = 0; ordinal < 100; ordinal++) {
        const run = { ordinal, routeId: route.id, approach };
        const result = expeditionOutcome("Risk-Test", run);
        assert.deepEqual(expeditionOutcome("Risk-Test", run), result);
        assert.deepEqual(
          result.reward,
          result.outcome === "SUCCESS"
            ? route.approaches[approach].reward
            : route.setbackReward,
        );
        seen.add(result.outcome);
      }
      assert.equal(seen.size, 2);
      assert.ok(
        route.approaches.BOLD.setbackChance >
          route.approaches.CAUTIOUS.setbackChance,
      );
    }
});
test("a successful vault returns one named relic with matching stock and durable provenance", () => {
  const routeId = "ANCIENT_VAULT" as const,
    approach = "CAUTIOUS" as const;
  const seed = Array.from({ length: 100 }, (_, i) => `Vault-${i}`).find(
    (s) =>
      expeditionOutcome(s, { ordinal: 0, routeId, approach }).outcome ===
      "SUCCESS",
  )!;
  let state = applyExpeditionAction(createInitialGameState(seed), {
    type: "START_EXPEDITION",
    routeId,
    approach,
  });
  const run = state.activities!.expeditions.active!;
  state = applyExpeditionAction(
    stepExpeditions({ ...state, ticks: run.returnsAt }),
    { type: "CLAIM_EXPEDITION", id: run.id },
  );
  assert.equal(state.resources.relics, 1);
  assert.equal(state.guild.relics.length, 1);
  assert.equal(
    state.activities!.expeditions.history[0].relicId,
    state.guild.relics[0].id,
  );
  assert.deepEqual(
    deserializeFortress(serializeFortress(state)).activities,
    state.activities,
  );
});
test("journey history remains bounded and malformed/forged expeditions are rejected", () => {
  let state = createInitialGameState("Scout-history");
  state.resources.wealth = 10000;
  state.resources.food = 10000;
  for (let i = 0; i < 15; i++) {
    state = applyExpeditionAction(state, {
      type: "START_EXPEDITION",
      routeId: "RIVER_SUPPLIES",
      approach: "BOLD",
    });
    const run = state.activities!.expeditions.active!;
    state = applyExpeditionAction(
      stepExpeditions({ ...state, ticks: run.returnsAt }),
      { type: "CLAIM_EXPEDITION", id: run.id },
    );
  }
  assert.equal(state.activities!.expeditions.history.length, 12);
  assert.ok(validExpeditionState(state.activities!.expeditions, state));
  const saved = JSON.parse(serializeFortress(stepGuild(state)));
  saved.state.activities.expeditions.history[0].reward.food = 100000;
  assert.throws(() => deserializeFortress(JSON.stringify(saved)));
  const pending = launch().activities!.expeditions;
  for (const bad of [
    null,
    [],
    { ...pending, nextOrdinal: -1 },
    { ...pending, active: { ...pending.active, returnsAt: 1 } },
    { ...pending, active: { ...pending.active, routeId: "UNKNOWN" } },
    { ...pending, active: { ...pending.active, status: "READY" } },
  ])
    assert.equal(
      validExpeditionState(bad, createInitialGameState("Scout-Test")),
      false,
    );
});
