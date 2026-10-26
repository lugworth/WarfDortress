import test from "node:test";
import assert from "node:assert/strict";
import type { ChronicleEntry, GameState, TileTerrain } from "./types.ts";
import { applyAreaDesignation, createInitialGameState } from "./game-engine.ts";
import { getTerrainVisuals } from "./world-gen.ts";
import { TOOL_KEYS } from "./game-rules.ts";
import {
  asciiBar,
  getDesignationPreview,
  getFortressNotices,
  getMapPoints,
  getTileHoverMetadata,
  groupChronicle,
  TOOL_GLYPHS,
} from "./ui-model.ts";

function terrain(
  state: GameState,
  z: number,
  x: number,
  y: number,
  value: TileTerrain,
  revealed = true,
) {
  Object.assign(state.grid[z][y][x], getTerrainVisuals(value), {
    terrain: value,
    revealed,
  });
}

test("designation preview agrees with every engine tool on clipped and reversed bounds", () => {
  const state = createInitialGameState("Preview-enum");
  const terrains: TileTerrain[] = [
    "ROCK_WALL",
    "TREE",
    "SHRUB",
    "GRASS",
    "ROCK_FLOOR",
    "STAIRS_UP_DOWN",
    "CAVERN_RELIC",
    "WATER",
    "WORKSHOP_FORGE",
  ];
  terrains.forEach((value, x) => terrain(state, 0, x, 0, value));
  state.grid[0][0][4].designation = "BUILD_BED";
  for (const type of Object.values(TOOL_KEYS)) {
    const preview = getDesignationPreview(state, 0, 8, 0, -3, 0, type);
    const actual = applyAreaDesignation(state, 0, 8, 0, -3, 0, type);
    assert.equal(preview.accepted, actual.count, type);
    assert.equal(preview.accepted + preview.skipped, terrains.length);
    assert.deepEqual(
      preview.tiles.map((tile) => tile.x),
      [0, 1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.deepEqual(
      preview.tiles.filter((tile) => tile.valid).map((tile) => tile.x),
      actual.nextState.grid[0][0].slice(0, 9).flatMap((tile, x) => {
        if (type === "CANCEL")
          return state.grid[0][0][x].designation &&
            tile.designation === undefined
            ? [x]
            : [];
        return tile.designation === type ? [x] : [];
      }),
      type,
    );
  }
});

test("construction preview quotes completion costs without rejecting an unaffordable queue", () => {
  const state = createInitialGameState("Preview-cost");
  terrain(state, 0, 0, 0, "GRASS");
  terrain(state, 0, 1, 0, "ROCK_FLOOR");
  terrain(state, 0, 2, 0, "WATER");
  state.resources.stone = 3;
  state.resources.ironOre = 0;
  const before = JSON.stringify(state.resources);
  const preview = getDesignationPreview(state, 0, 2, 0, 0, 0, "BUILD_FORGE");
  assert.equal(preview.accepted, 2);
  assert.equal(preview.skipped, 1);
  assert.deepEqual(preview.cost, { stone: 8, ironOre: 2 });
  assert.deepEqual(preview.missing, { stone: 5, ironOre: 2 });
  assert.equal(JSON.stringify(state.resources), before);
  assert.equal(state.grid[0][0][0].designation, undefined);
  assert.equal(
    applyAreaDesignation(state, 0, 0, 0, 2, 0, "BUILD_FORGE").count,
    2,
  );
});

test("same queued orders retain engine counts and cancel only clears existing targets", () => {
  const state = createInitialGameState("Preview-queued");
  terrain(state, 0, 0, 0, "GRASS");
  terrain(state, 0, 1, 0, "GRASS");
  state.grid[0][0][0].designation = "BUILD_BED";
  const repeated = getDesignationPreview(state, 0, 0, 0, 0, 0, "BUILD_BED");
  assert.equal(repeated.accepted, 1);
  assert.equal(repeated.alreadyDesignated, 1);
  assert.equal(repeated.tiles[0].alreadyDesignated, true);
  assert.deepEqual(repeated.cost, { wood: 2 });
  const cancel = getDesignationPreview(state, 0, 0, 0, 1, 0, "CANCEL");
  assert.equal(cancel.accepted, 1);
  assert.equal(cancel.skipped, 1);
  assert.deepEqual(cancel.cost, {});
});

test("empty, invalid-depth, and fractional preview rectangles are safely bounded", () => {
  const state = createInitialGameState("Preview-bounds");
  assert.equal(
    getDesignationPreview(state, -1, 0, 0, 1, 1, "MINE").tiles.length,
    0,
  );
  assert.equal(
    getDesignationPreview(state, 6, 0, 0, 1, 1, "MINE").tiles.length,
    0,
  );
  assert.equal(
    getDesignationPreview(state, 0, -5, -5, -1, -1, "MINE").tiles.length,
    0,
  );
  assert.equal(
    getDesignationPreview(state, 0, NaN, 0, 1, 1, "MINE").tiles.length,
    0,
  );
  const fractional = getDesignationPreview(
    state,
    0,
    0.2,
    0.2,
    2.8,
    2.8,
    "MINE",
  );
  assert.deepEqual(
    fractional.tiles.map(({ x, y }) => [x, y]),
    [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
    ],
  );
  assert.equal(
    fractional.accepted,
    applyAreaDesignation(state, 0, 0.2, 0.2, 2.8, 2.8, "MINE").count,
  );
});

test("hidden terrain can receive the same engine order without exposing terrain in its rejection reason", () => {
  const state = createInitialGameState("Preview-hidden");
  terrain(state, 1, 0, 0, "IRON_VEIN", false);
  terrain(state, 1, 1, 0, "WATER", false);
  const preview = getDesignationPreview(state, 1, 0, 0, 1, 0, "MINE");
  assert.equal(preview.accepted, 1);
  assert.equal(
    preview.accepted,
    applyAreaDesignation(state, 1, 0, 0, 1, 0, "MINE").count,
  );
  assert.equal(preview.tiles[1].reason?.includes("WATER"), false);
});

test("map points expose all supported revealed object kinds with stable IDs and no clipping", () => {
  const state = createInitialGameState("Points");
  // Start with an entirely unrevealed map so fixtures control every visible object.
  state.grid.forEach((level) =>
    level.forEach((row) =>
      row.forEach((tile) => {
        tile.revealed = false;
      }),
    ),
  );
  terrain(state, 0, 0, 0, "WORKSHOP_FORGE");
  terrain(state, 0, 1, 0, "STAIRS_UP_DOWN");
  terrain(state, 0, 2, 0, "CAVERN_RELIC");
  terrain(state, 0, 3, 0, "WORKSHOP_SMELTER", false);
  terrain(state, 0, 4, 0, "GRASS");
  terrain(state, 0, 5, 0, "GRASS");
  state.dwarves = state.dwarves.map((d, i) => ({
    ...d,
    x: i === 0 ? 4 : 6,
    y: 0,
    z: 0,
  }));
  state.hostiles = state.hostiles
    .slice(0, 2)
    .map((h, i) => ({ ...h, x: i === 0 ? 5 : 6, y: 0, z: 0 }));
  const points = getMapPoints(state, 0);
  assert.equal(points.length, 5);
  assert.deepEqual(
    new Set(points.map((p) => p.kind)),
    new Set(["DWARF", "HOSTILE", "WORKSHOP", "STAIRS", "RELIC"]),
  );
  assert.ok(!points.some((p) => p.x === 3 || p.x === 6));
  assert.deepEqual(getMapPoints(state, -1), []);
  assert.deepEqual(getMapPoints(state, 0), points);
  state.dwarves.reverse();
  state.hostiles.reverse();
  assert.deepEqual(getMapPoints(state, 0), points);
  for (let x = 10; x < 50; x++) terrain(state, 0, x, 1, "WORKSHOP_MASON");
  assert.equal(getMapPoints(state, 0).length, 45);
});

test("notices use actual supplies, visible threats, current blocked thoughts, and ready commissions", () => {
  const state = createInitialGameState("Notices");
  state.resources.food = 0;
  state.resources.ale = 1;
  const blocked = state.dwarves[0];
  blocked.state = "IDLE";
  blocked.thought = "Work blocked: no connected, walkable route.";
  const moving = state.dwarves[1];
  moving.state = "MOVING";
  moving.thought = blocked.thought;
  state.hostiles[0].z = 0;
  state.hostiles[0].x = 0;
  state.hostiles[0].y = 0;
  terrain(state, 0, 0, 0, "GRASS");
  state.hostiles[1].z = 0;
  state.hostiles[1].x = 1;
  state.hostiles[1].y = 0;
  terrain(state, 0, 1, 0, "GRASS", false);
  const commission = state.guild.commissions[0];
  commission.status = "ACTIVE";
  state.resources[commission.requirement.resource] =
    commission.requirement.amount;
  const notices = getFortressNotices(state);
  assert.ok(
    notices.some(
      (n) => n.id === `threat:${state.hostiles[0].id}` && n.coord?.x === 0,
    ),
  );
  assert.ok(!notices.some((n) => n.id === `threat:${state.hostiles[1].id}`));
  assert.ok(
    notices.some((n) => n.id === "supplies:food" && n.label.includes("0")),
  );
  assert.ok(
    notices.some((n) => n.id === "supplies:ale" && n.label.includes("1")),
  );
  assert.ok(
    notices.some(
      (n) =>
        n.id === `worker:${blocked.id}` && n.label.includes(blocked.thought),
    ),
  );
  assert.ok(!notices.some((n) => n.id === `worker:${moving.id}`));
  assert.ok(
    notices.some(
      (n) => n.id === `commission:${commission.id}` && n.action === "GUILD",
    ),
  );
  state.ticks = commission.deadline;
  assert.ok(
    !getFortressNotices(state).some(
      (n) => n.id === `commission:${commission.id}`,
    ),
  );
  state.ticks = commission.deadline - 1;
  state.resources[commission.requirement.resource]--;
  assert.ok(
    !getFortressNotices(state).some(
      (n) => n.id === `commission:${commission.id}`,
    ),
  );
});

test("chronicle recurrence groups text and type while retaining the latest complete entry", () => {
  const entry = (
    id: string,
    tick: number,
    text: string,
    type: ChronicleEntry["type"],
  ): ChronicleEntry => ({
    id,
    tick,
    text,
    type,
    year: 251,
    season: "Granite (Spring)",
  });
  const entries = [
    entry("old", 2, "Harvested food.", "WORK"),
    entry("combat", 5, "Harvested food.", "COMBAT"),
    entry("new", 8, "Harvested food.", "WORK"),
    entry("same-tick-latest", 8, "Brewed ale.", "CRAFT"),
    entry("same-tick-older", 8, "Brewed ale.", "CRAFT"),
  ];
  const before = JSON.stringify(entries);
  const grouped = groupChronicle(entries);
  assert.deepEqual(
    grouped.map((g) => [g.id, g.count]),
    [
      ["new", 2],
      ["same-tick-latest", 2],
      ["combat", 1],
    ],
  );
  assert.equal(grouped[0].text, "Harvested food.");
  assert.equal(JSON.stringify(entries), before);
  assert.deepEqual(groupChronicle([]), []);
});

test("asciiBar and TOOL_GLYPHS render deterministic tactile block gauges and tool badges", () => {
  assert.equal(asciiBar(0, 100, 6), "[░░░░░░]");
  assert.equal(asciiBar(50, 100, 6), "[███░░░]");
  assert.equal(asciiBar(100, 100, 6), "[██████]");
  assert.equal(asciiBar(-25, 100, 4), "[░░░░]");
  assert.equal(asciiBar(250, 100, 4), "[████]");
  for (const tool of Object.values(TOOL_KEYS)) {
    assert.ok(TOOL_GLYPHS[tool]?.length >= 1, `Missing glyph for ${tool}`);
  }
});

test("getTileHoverMetadata reports material type, occupancy, temperature, and liquid level accurately", () => {
  const state = createInitialGameState("Hover-inspector");

  // 1. Surface water tile & adjacent damp bank
  terrain(state, 0, 10, 10, "WATER", true);
  terrain(state, 0, 11, 10, "GRASS", true);
  const waterMeta = getTileHoverMetadata(state, state.grid[0][10][10]);
  assert.equal(waterMeta.materialType, "Fresh Surface Water");
  assert.equal(waterMeta.liquidDepth, 7);
  assert.match(waterMeta.liquidLevel, /7\/7 Water/);

  const bankMeta = getTileHoverMetadata(state, state.grid[0][10][11]);
  assert.equal(bankMeta.liquidDepth, 1);
  assert.match(bankMeta.liquidLevel, /1\/7 Damp Riverbank/);

  // 2. Magma tile & radiant heat neighbor + dwarf/hostile occupancy
  terrain(state, 5, 20, 20, "MAGMA", true);
  terrain(state, 5, 21, 20, "ROCK_FLOOR", true);
  state.dwarves[0].x = 21;
  state.dwarves[0].y = 20;
  state.dwarves[0].z = 5;
  state.hostiles.push({
    id: "gob-test",
    name: "Goblin Pikeman",
    kind: "GOBLIN_RAIDER",
    char: "g",
    color: "#ff0000",
    x: 21,
    y: 20,
    z: 5,
    hp: 18,
    maxHp: 24,
    attack: 5,
    behavior: "RAID",
  });

  const magmaMeta = getTileHoverMetadata(state, state.grid[5][20][20]);
  assert.equal(magmaMeta.temperatureStatus, "SCORCHING");
  assert.equal(magmaMeta.liquidDepth, 7);
  assert.match(magmaMeta.temperature, /2,190°F/);

  const occupiedMeta = getTileHoverMetadata(state, state.grid[5][20][21]);
  assert.equal(occupiedMeta.temperatureStatus, "SCORCHING");
  assert.ok(occupiedMeta.occupancy.some((o) => o.includes(state.dwarves[0].name)));
  assert.ok(occupiedMeta.occupancy.some((o) => o.includes("Goblin Pikeman")));

  // 3. Unexplored tile hides exact material and occupants
  terrain(state, 2, 5, 5, "GOLD_VEIN", false);
  const hiddenMeta = getTileHoverMetadata(state, state.grid[2][5][5]);
  assert.equal(hiddenMeta.revealed, false);
  assert.equal(hiddenMeta.terrainLabel, "UNEXPLORED STRATA");
  assert.ok(!hiddenMeta.materialType.includes("Gold"));
});

test("progression ranks, milestone rewards, strange mood artifacts, and scouting expeditions work deterministically", async () => {
  const {
    getFortressProgression,
    claimMilestoneReward,
    triggerStrangeMood,
    fulfillStrangeMood,
  } = await import("./progression.ts");
  const { performExpeditionAction } = await import("./expeditions.ts");

  let state = createInitialGameState("Progression-test");
  const initialProg = getFortressProgression(state);
  assert.equal(initialProg.currentRank.tier, 2); // Starting score ~940 -> Delver Hamlet

  // Complete & claim "Strike the Earth" (35+ stone)
  state.resources.stone = 40;
  const beforeWealth = state.resources.wealth;
  const claimRes = claimMilestoneReward(state, "ms-strike-earth");
  assert.equal(claimRes.claimed, true);
  state = claimRes.nextState;
  assert.equal(state.resources.wealth, beforeWealth + 100);
  // Cannot double-claim
  assert.equal(claimMilestoneReward(state, "ms-strike-earth").claimed, false);

  // Trigger and fulfill a Strange Mood to forge a Legendary Artifact
  state.resources.stone = 20;
  state.resources.wood = 20;
  state.resources.ironOre = 10;
  state.resources.steelBars = 10;
  state.resources.ale = 20;
  const moodRes = triggerStrangeMood(state);
  assert.equal(moodRes.triggered, true);
  state = moodRes.nextState;
  assert.ok(state.activities?.strangeMood);

  const fulfillRes = fulfillStrangeMood(state);
  assert.equal(fulfillRes.fulfilled, true);
  state = fulfillRes.nextState;
  assert.equal(state.activities?.strangeMood, null);
  assert.equal(state.guild.relics.length, 1);
  assert.ok(state.dwarves.some((d) => d.title.startsWith("Legendary Artisan")));

  // Start and claim a scouting expedition
  const expStart = performExpeditionAction(state, {
    type: "START_EXPEDITION",
    routeId: "route-foothills",
    approach: "CAUTIOUS",
  });
  assert.equal(expStart.success, true);
  state = expStart.nextState;
  const expId = state.activities.expeditions.active.id;
  state.ticks = state.activities.expeditions.active.returnsAt;
  const expClaim = performExpeditionAction(state, {
    type: "CLAIM_EXPEDITION",
    id: expId,
  });
  assert.equal(expClaim.success, true);
  assert.equal(expClaim.nextState.activities.expeditions.active, null);
  assert.equal(expClaim.nextState.activities.expeditions.history.length, 1);
});

