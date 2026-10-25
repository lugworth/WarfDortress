import test from "node:test";
import assert from "node:assert/strict";
import type { ChronicleEntry, GameState, TileTerrain } from "./types.ts";
import { applyAreaDesignation, createInitialGameState } from "./game-engine.ts";
import { getTerrainVisuals } from "./world-gen.ts";
import { TOOL_KEYS } from "./game-rules.ts";
import {
  getDesignationPreview,
  getFortressNotices,
  getMapPoints,
  groupChronicle,
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
