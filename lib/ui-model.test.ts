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
  getTileHoverMetadata,
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
  state.activities = { ...state.activities, unlockedBuildings: ["BUILD_FORGE"] };
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
    behavior: "RAID_SEEK",
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
  const expId = state.activities!.expeditions.active.id;
  state.ticks = state.activities!.expeditions.active.returnsAt;
  const expClaim = performExpeditionAction(state, {
    type: "CLAIM_EXPEDITION",
    id: expId,
  });
  assert.equal(expClaim.success, true);
  assert.equal(expClaim.nextState.activities!.expeditions.active, null);
  assert.equal(expClaim.nextState.activities!.expeditions.history.length, 1);
});

test("automated Thoughts & Feelings log records key life events (plump helmet roast, terrifying beast) and aggregates clan anecdotes", async () => {
  const { stepSimulationTick } = await import("./game-engine.ts");
  const { collectClanAnecdotes } = await import("./thoughts.ts");

  let state = createInitialGameState("Thoughts-test");
  // Founding dwarves start with seeded embark anecdotes
  assert.ok(state.dwarves.every((d) => Array.isArray(d.thoughtLog) && d.thoughtLog.length >= 2));

  const initialAnecdotes = collectClanAnecdotes(state.dwarves);
  assert.ok(
    initialAnecdotes.some((a) => a.text.toLowerCase().includes("plump helmet roast")),
  );
  assert.ok(
    initialAnecdotes.some((a) => a.text.toLowerCase().includes("terrifying beast")),
  );

  // Force dwarf-1 to be hungry so they eat a savoury Plump Helmet roast on the next tick
  state.dwarves[0].hunger = 20;
  state.resources.food = 10;

  // Place a Giant Cave Spider near dwarf-2 on Z-3 (Fungal Caverns) so they see a terrifying beast
  state.dwarves[2].quirk = "LONER";
  state.dwarves[2].labors.COMBAT = false;
  state.dwarves[2].z = 3;
  state.hostiles.push({
    id: "beast-test-1",
    name: "Giant Cave Spider",
    kind: "CAVE_SPIDER",
    char: "S",
    color: "#ff0000",
    x: state.dwarves[2].x + 4,
    y: state.dwarves[2].y,
    z: 3,
    hp: 60,
    maxHp: 60,
    attack: 8,
    behavior: "CAVERN_GUARD",
  });

  state = stepSimulationTick(state);

  const dwarf0Log = state.dwarves[0].thoughtLog || [];
  assert.equal(dwarf0Log[0].text, "Ate a savoury Plump Helmet roast.");
  assert.equal(dwarf0Log[0].category, "SUSTENANCE");
  assert.equal(dwarf0Log[0].sentiment, "POSITIVE");

  const dwarf2Log = state.dwarves[2].thoughtLog || [];
  assert.ok(dwarf2Log[0].text.includes("Saw a terrifying beast (Giant Cave Spider)"));
  assert.equal(dwarf2Log[0].category, "BEAST_ENCOUNTER");
  assert.equal(dwarf2Log[0].sentiment, "TERRIFIED");

  // Filter anecdotes by individual dwarf
  const dwarf0Only = collectClanAnecdotes(state.dwarves, { dwarfId: state.dwarves[0].id });
  assert.ok(dwarf0Only.length >= 3);
  assert.ok(dwarf0Only.every((a) => a.dwarfId === state.dwarves[0].id));
});

test("seasonal weather system impacts ASCII surface tile visuals, dwarf movement speed, and mood/thoughts", async () => {
  const {
    getCurrentWeather,
    getWeatherTileVisuals,
    canDwarfStepThisTick,
    applyWeatherExposureToDwarf,
  } = await import("./weather.ts");

  const state = createInitialGameState("Weather-test");
  terrain(state, 0, 5, 5, "GRASS", true);
  terrain(state, 0, 6, 5, "TREE", true);
  terrain(state, 0, 7, 5, "WATER", true);
  terrain(state, 0, 8, 5, "ROCK_FLOOR", true);
  terrain(state, 2, 5, 5, "ROCK_FLOOR", true);

  // 1. Winter Snow transforms Z-0 grass, trees, and water into snow/ice glyphs
  state.season = "Timber (Winter)";
  state.ticks = 10;
  const winterWeather = getCurrentWeather(state);
  assert.equal(winterWeather.id, "WINTER_SNOW");
  assert.equal(winterWeather.glyph, "❄");

  const grassWinterVis = getWeatherTileVisuals(state, state.grid[0][5][5]);
  assert.ok(["*", "·"].includes(grassWinterVis.char), "Winter grass should render snow glyph");
  const treeWinterVis = getWeatherTileVisuals(state, state.grid[0][5][6]);
  assert.equal(treeWinterVis.char, "▲", "Winter tree should render snow-laden conifer");
  const waterWinterVis = getWeatherTileVisuals(state, state.grid[0][5][7]);
  assert.equal(waterWinterVis.char, "≡", "Winter surface water should freeze into ice");

  const hoverWinterGrass = getTileHoverMetadata(state, state.grid[0][5][5]);
  assert.equal(hoverWinterGrass.temperatureStatus, "COLD");
  assert.match(hoverWinterGrass.liquidLevel, /Winter Snowpack/);
  assert.match(hoverWinterGrass.walkableLabel, /50% Speed/);

  // 2. Autumn Rain transforms Z-0 grass/trees and reports rain-slicked mud
  state.season = "Sands (Autumn)";
  const autumnWeather = getCurrentWeather(state);
  assert.equal(autumnWeather.id, "AUTUMN_RAIN");
  const hoverAutumnGrass = getTileHoverMetadata(state, state.grid[0][5][5]);
  assert.match(hoverAutumnGrass.liquidLevel, /Rain-Slicked Mud/);

  // 3. Movement speed: outdoor unpaved Z-0 slows on odd ticks in snow/rain, while underground (Z>0) and paved floors move every tick
  const dwarf = { ...state.dwarves[0], quirk: "SCHOLAR" as const, z: 0, x: 5, y: 5 };
  assert.equal(
    canDwarfStepThisTick(dwarf, state, state.grid[0][5][5], 1),
    false,
    "Unpaved Z-0 tile in rain/snow should pause movement on odd ticks",
  );
  assert.equal(
    canDwarfStepThisTick(dwarf, state, state.grid[0][5][5], 2),
    true,
    "Unpaved Z-0 tile in rain/snow should allow movement on even ticks",
  );
  assert.equal(
    canDwarfStepThisTick(dwarf, state, state.grid[0][5][8], 1),
    true,
    "Paved ROCK_FLOOR on Z-0 should preserve 100% movement speed",
  );
  assert.equal(
    canDwarfStepThisTick({ ...dwarf, z: 2 }, state, state.grid[2][5][5], 1),
    true,
    "Subterranean Z-2 tile should preserve 100% movement speed regardless of surface weather",
  );

  // 4. Mood & Thought impact: exposed outdoor dwarf loses morale in snow; sheltered dwarf gains morale
  const startMorale = dwarf.happiness;
  applyWeatherExposureToDwarf(dwarf, winterWeather, {
    tick: 20,
    year: 251,
    season: "Timber (Winter)",
    isSheltered: false,
  });
  assert.ok(dwarf.happiness < startMorale, "Outdoor winter snow exposure should reduce happiness");
  assert.ok(dwarf.thought.includes("winter snow"));

  const shelteredDwarf = { ...state.dwarves[1], z: 2, happiness: 80 };
  applyWeatherExposureToDwarf(shelteredDwarf, winterWeather, {
    tick: 20,
    year: 251,
    season: "Timber (Winter)",
    isSheltered: true,
  });
  assert.ok(shelteredDwarf.happiness > 80, "Sheltered underground dwarf should gain cozy morale during surface storm");
});

test("building unlock progression gates advanced workshops until stone/metal thresholds are met and persists unlocks", async () => {
  const {
    isBuildingUnlocked,
    getBuildingUnlockStatus,
    syncBuildingUnlocks,
  } = await import("./progression.ts");

  let state = createInitialGameState("Unlock-progression-test");
  // Embark starts with 25 Stone, 20 Wood, 4 Iron Ore, 2 Steel Bars
  assert.equal(isBuildingUnlocked(state, "BUILD_WALL"), true);
  assert.equal(isBuildingUnlocked(state, "BUILD_BED"), true);
  assert.equal(isBuildingUnlocked(state, "BUILD_MASON"), false);
  assert.equal(isBuildingUnlocked(state, "BUILD_SMELTER"), false);
  assert.equal(isBuildingUnlocked(state, "BUILD_FORGE"), false);

  // Collect 28 Stone -> Unlocks Mason's Workshop and Stone Deadfall Trap
  state.resources.stone = 28;
  assert.equal(isBuildingUnlocked(state, "BUILD_MASON"), true);
  assert.equal(isBuildingUnlocked(state, "BUILD_TRAP"), true);

  // Collect 32 Stone & 6 Iron Ore -> Unlocks Smeltery Furnace
  state.resources.stone = 32;
  state.resources.ironOre = 6;
  assert.equal(isBuildingUnlocked(state, "BUILD_SMELTER"), true);
  assert.equal(isBuildingUnlocked(state, "BUILD_FORGE"), false);

  // Collect 36 Stone & 4 Steel Bars -> Unlocks Metalsmith's Forge!
  state.resources.stone = 36;
  state.resources.steelBars = 4;
  assert.equal(isBuildingUnlocked(state, "BUILD_FORGE"), true);

  // Sync unlocks into state.activities.unlockedBuildings and verify persistence even after spending stone
  const synced = syncBuildingUnlocks(state);
  assert.ok(synced.newlyUnlocked.some((u) => u.tool === "BUILD_FORGE"));
  state = synced.nextState;
  state.resources.stone = 5;
  state.resources.steelBars = 0;
  assert.equal(
    isBuildingUnlocked(state, "BUILD_FORGE"),
    true,
    "Once unlocked, Metalsmith's Forge remains permanently unlocked after spending resources",
  );
  assert.equal(getBuildingUnlockStatus(state, "BUILD_FORGE")?.progressPercent, 100);
});

test("tooltip toggle preference, configured migrant jobs, resource economy balance, and building/stockpile tile actuators work deterministically", async () => {
  const { parseUIPreferences, DEFAULT_UI } = await import("./ui-preferences.ts");
  const { createConfiguredMigrantDwarf } = await import("./world-gen.ts");
  const {
    getResourceEconomyBalance,
    getBuildingTileFunctionInfo,
    activateBuildingTileFunction,
  } = await import("./game-engine.ts");

  // 1. Tooltip toggle preference defaults to true and parses false cleanly
  assert.equal(DEFAULT_UI.tooltips, true);
  assert.equal(parseUIPreferences(JSON.stringify({ tooltips: false })).tooltips, false);
  assert.equal(parseUIPreferences(JSON.stringify({ tooltips: true })).tooltips, true);

  // 2. Migrants arrive with specialized configured jobs tailored to least-covered clan labors
  let state = createInitialGameState("Migrant-And-Actuators-Test");
  const migrant = createConfiguredMigrantDwarf({
    existingDwarves: state.dwarves,
    worldWidth: state.world.width,
    worldHeight: state.world.height,
    dwarvenName: state.world.dwarvenName,
    ticks: state.ticks,
    originLabel: "Trade Caravan Charter",
  });
  const activeLaborCount = Object.values(migrant.labors).filter(Boolean).length;
  assert.ok(
    activeLaborCount >= 2 && activeLaborCount <= 4,
    `Migrant should have specialized configured jobs (2-4 active labors), got ${activeLaborCount}`,
  );
  assert.equal(migrant.labors.HAULING, true, "Migrant should have HAULING enabled alongside specialty");
  assert.equal(migrant.labors.FARMING, true, "First migrant should cover least-staffed FARMING labor");
  assert.equal(migrant.skills.FARMING, 3, "First migrant should have level 3 FARMING skill");

  // 3. Resource economy balance & Stockpile capacity
  const econBefore = getResourceEconomyBalance(state);
  assert.ok(econBefore.maxSafeFoodStorage >= 24);
  assert.ok(econBefore.foodPerSeason > 0);
  assert.ok(econBefore.alePerSeason > 0);

  // 4. Stockpile tile and all building tiles expose passive functions & interactive actuators
  const cx = Math.floor(state.world.width / 2);
  const cy = Math.floor(state.world.height / 2);
  const buildingTerrains = [
    "STOCKPILE_TILE",
    "CONSTRUCTED_WALL",
    "DOOR",
    "BED",
    "FARM_PLOT",
    "WORKSHOP_MASON",
    "WORKSHOP_CARPENTER",
    "WORKSHOP_STILL",
    "WORKSHOP_SMELTER",
    "WORKSHOP_FORGE",
    "TAVERN_HALL",
    "TEMPLE_ALTAR",
    "TRADE_DEPOT",
    "TRAP_STONE",
  ] as const;

  // Ensure stockpile & resources are ample so every actuator can fire
  state.resources = {
    ...state.resources,
    stone: 60,
    wood: 60,
    ironOre: 30,
    goldOre: 20,
    steelBars: 20,
    food: 60,
    ale: 60,
    furniture: 20,
    weapons: 10,
    armor: 10,
    wealth: 1000,
  };

  for (let i = 0; i < buildingTerrains.length; i++) {
    const tType = buildingTerrains[i];
    const tx = cx - 6 + i;
    const ty = cy;
    terrain(state, 0, tx, ty, tType, true);
    const tile = state.grid[0][ty][tx];

    const info = getBuildingTileFunctionInfo(state, tile);
    assert.ok(info, `${tType} should have a defined building function info`);
    assert.ok(info.passiveFunction.length > 10, `${tType} should describe its passive function`);
    assert.ok(info.actionLabel.length > 3, `${tType} should expose an actuator action label`);
    assert.equal(info.canActivate, true, `${tType} actuator should be activatable when supplied`);

    const hover = getTileHoverMetadata(state, tile);
    assert.equal(hover.buildingFunction, info.passiveFunction);
    assert.equal(hover.buildingActionLabel, info.actionLabel);

    const actRes = activateBuildingTileFunction(state, tx, ty, 0);
    assert.equal(actRes.triggered, true, `${tType} actuator should execute successfully`);
    assert.ok(actRes.message.length > 5);
    state = actRes.nextState;
  }
});

test("thought log IDs stay strictly unique past MAX_THOUGHT_LOG_ENTRIES cap and AI-driven Goblin raid combat & militia squads work deterministically", async () => {
  const { appendDwarfThought, collectClanAnecdotes } = await import("./thoughts.ts");
  const {
    ensureMilitiaState,
    performMilitiaAction,
    spawnTacticalGoblinRaid,
    getSquadCombatModifiers,
    getSquadOrderDestination,
  } = await import("./militia.ts");
  const { applyAreaDesignation, stepSimulationTick } = await import("./game-engine.ts");

  let state = createInitialGameState("Militia-And-Thought-Key-Test");

  // 1. Regression test for duplicate key `th-dwarf-4-180-16` when log reaches 16 entries
  const dwarf4 = state.dwarves.find((d) => d.id === "dwarf-4") || state.dwarves[0];
  for (let i = 0; i < 25; i++) {
    appendDwarfThought(dwarf4, {
      tick: 180,
      year: state.year,
      season: state.season,
      text: `Recorded unique memory #${i} during tick 180.`,
      category: "FELLOWSHIP",
      sentiment: "POSITIVE",
      moraleDelta: 1,
    });
  }
  const ids = (dwarf4.thoughtLog || []).map((e) => e.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, 16, "Thought log should be capped at 16 entries");
  assert.equal(uniqueIds.size, ids.length, "Every thought log entry ID must be strictly unique");

  const anecdotes = collectClanAnecdotes(state.dwarves);
  const anecdoteIds = new Set(anecdotes.map((a) => a.id));
  assert.equal(anecdoteIds.size, anecdotes.length, "All clan anecdote IDs must be strictly unique");

  // 2. Militia Squad assignments & Armory equipment
  const initialMilitia = ensureMilitiaState(state);
  assert.equal(Object.keys(initialMilitia.squads).length, 2);
  const combatDwarf = state.dwarves.find((d) => d.labors.COMBAT)!;
  assert.equal(combatDwarf.squadId, "squad-1");

  const assignRes = performMilitiaAction(state, {
    type: "ASSIGN_DWARF_SQUAD",
    dwarfId: state.dwarves[2].id,
    squadId: "squad-2",
  });
  assert.equal(assignRes.success, true);
  state = assignRes.nextState;
  assert.equal(state.dwarves[2].squadId, "squad-2");
  assert.equal(state.dwarves[2].labors.COMBAT, true);

  // Equip squad-2 from armory
  state.resources.weapons = 4;
  state.resources.armor = 4;
  const equipRes = performMilitiaAction(state, {
    type: "EQUIP_SQUAD_ARMORY",
    squadId: "squad-2",
  });
  assert.equal(equipRes.success, true);
  state = equipRes.nextState;
  assert.equal(state.dwarves[2].weaponEquipped, true);
  assert.equal(state.dwarves[2].armorEquipped, true);

  // 3. Issue MILITIA_STATION and MILITIA_PATROL orders via ASCII map designation
  state = performMilitiaAction(state, { type: "SELECT_SQUAD", squadId: "squad-1" }).nextState;
  const cx = Math.floor(state.world.width / 2);
  const cy = Math.floor(state.world.height / 2);
  terrain(state, 0, cx - 4, cy, "ROCK_FLOOR", true);
  const stationRes = applyAreaDesignation(
    state,
    0,
    cx - 4,
    cy,
    cx - 4,
    cy,
    "MILITIA_STATION",
  );
  assert.equal(stationRes.count, 1);
  state = stationRes.nextState;
  const squad1AfterStation = ensureMilitiaState(state).squads["squad-1"];
  assert.equal(squad1AfterStation.order.type, "STATION");
  assert.equal(squad1AfterStation.order.x, cx - 4);
  assert.equal(squad1AfterStation.order.y, cy);
  assert.equal(squad1AfterStation.order.z, 0);

  // Verify squad combat modifiers and destination when stationed near target
  const stationedMember = state.dwarves.find((d) => d.squadId === "squad-1")!;
  stationedMember.x = cx - 4;
  stationedMember.y = cy;
  stationedMember.z = 0;
  const mods = getSquadCombatModifiers(
    state.dwarves,
    stationedMember,
    ensureMilitiaState(state),
  );
  assert.equal(mods.stationDefenseMultiplier, 0.75, "Stationed squad member should gain -25% damage shield-wall multiplier");

  // Select squad-2 and designate a MILITIA_PATROL route on the map
  state = performMilitiaAction(state, { type: "SELECT_SQUAD", squadId: "squad-2" }).nextState;
  terrain(state, 0, cx - 6, cy - 2, "ROCK_FLOOR", true);
  terrain(state, 0, cx + 6, cy + 2, "ROCK_FLOOR", true);
  const patrolRes = applyAreaDesignation(
    state,
    0,
    cx - 6,
    cy - 2,
    cx + 6,
    cy + 2,
    "MILITIA_PATROL",
  );
  assert.ok(patrolRes.count >= 1);
  state = patrolRes.nextState;
  const squad2AfterPatrol = ensureMilitiaState(state).squads["squad-2"];
  assert.equal(squad2AfterPatrol.order.type, "PATROL");
  const dest = getSquadOrderDestination(state.dwarves[2], squad2AfterPatrol, 0);
  assert.ok(dest, "Patrolling squad member should have an active patrol waypoint");

  // 4. Spawn AI-driven Tactical Goblin Raid and step simulation combat
  const beforeHostiles = state.hostiles.length;
  state = spawnTacticalGoblinRaid(state);
  assert.ok(state.hostiles.length > beforeHostiles, "Tactical Goblin raid should spawn raiders");
  assert.ok(ensureMilitiaState(state).activeRaidPlan, "Active AI raid battle plan should be recorded");
  assert.ok(state.hostiles.some((h) => Boolean(h.tactic) && Boolean(h.targetCoord)));

  state = stepSimulationTick(state);
  assert.ok(state.dwarves.length > 0);
});


test("locked blueprints cannot be queued from any entry point", () => {
  const state = createInitialGameState("Locked-blueprint");
  terrain(state, 0, 0, 0, "GRASS");
  const preview = getDesignationPreview(state, 0, 0, 0, 0, 0, "BUILD_SMELTER");
  assert.equal(preview.accepted, 0);
  assert.match(preview.tiles[0].reason ?? "", /Locked blueprint/);
  assert.equal(applyAreaDesignation(state, 0, 0, 0, 0, 0, "BUILD_SMELTER").count, 0);

  state.activities = { ...state.activities, unlockedBuildings: ["BUILD_SMELTER"] };
  assert.equal(applyAreaDesignation(state, 0, 0, 0, 0, 0, "BUILD_SMELTER").count, 1);
});

test("building actions recharge before they can be used again", async () => {
  const { activateBuildingTileFunction, getBuildingTileFunctionInfo, BUILDING_ACTION_COOLDOWN_TICKS } =
    await import("./game-engine.ts");
  let state = createInitialGameState("Actuator-cooldown");
  terrain(state, 0, 0, 0, "STOCKPILE_TILE");
  terrain(state, 0, 1, 0, "STOCKPILE_TILE");

  const first = activateBuildingTileFunction(state, 0, 0, 0);
  assert.equal(first.triggered, true);
  state = first.nextState;
  const stoneAfterFirst = state.resources.stone;

  const info = getBuildingTileFunctionInfo(state, state.grid[0][0][1])!;
  assert.equal(info.canActivate, false, "another tile of the same type shares the cooldown");
  assert.equal(info.readyInTicks, BUILDING_ACTION_COOLDOWN_TICKS);
  const second = activateBuildingTileFunction(state, 1, 0, 0);
  assert.equal(second.triggered, false);
  assert.match(second.message, /ready in/);
  assert.equal(second.nextState.resources.stone, stoneAfterFirst);

  state.ticks = state.ticks + BUILDING_ACTION_COOLDOWN_TICKS;
  assert.equal(activateBuildingTileFunction(state, 1, 0, 0).triggered, true);
});

test("multi-level A* pathfinding routes across offset stairwells, and relic/quirk/commission systems scale to the 25,000 goal", async () => {
  const { findPath } = await import("./pathfinding.ts");
  const { stepSimulationTick } = await import("./game-engine.ts");
  const { performGuildAction, refreshSeasonalCommissions } = await import("./guild.ts");
  const { FORTRESS_RANKS, getFortressProgression } = await import("./progression.ts");

  // 1. Goal is 25,000 and includes 9 total milestones up to Sovereign of the Deep Anvil
  assert.equal(FORTRESS_RANKS[FORTRESS_RANKS.length - 1].minScore, 25000);
  let state = createInitialGameState("Improvements-Suite");
  const prog = getFortressProgression(state);
  assert.equal(prog.milestones.length, 9);

  // 2. Offset multi-Z stairwells (Z0->Z1 at 2,2; Z1->Z2 at 6,6)
  for (let z = 0; z < 3; z++) {
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        terrain(state, z, x, y, "ROCK_FLOOR", true);
      }
    }
  }
  terrain(state, 0, 2, 2, "STAIRS_UP_DOWN", true);
  terrain(state, 1, 2, 2, "STAIRS_UP_DOWN", true);
  terrain(state, 1, 6, 6, "STAIRS_UP_DOWN", true);
  terrain(state, 2, 6, 6, "STAIRS_UP_DOWN", true);

  const offsetPath = findPath(
    state.grid,
    { z: 0, y: 0, x: 0 },
    { z: 2, y: 8, x: 8 },
  );
  assert.ok(offsetPath && offsetPath.length > 4, "3D A* should route across offset stairwells on Z-0 -> Z-1 -> Z-2");
  assert.equal(offsetPath![offsetPath!.length - 1].z, 2);

  // 3. Displayed ANCIENT_PICK doubles ore yield & RUNIC_ANVIL discounts forge steel cost
  state.guild.relics.push(
    {
      id: "relic-pick",
      template: "ANCIENT_PICK",
      name: "World-Cleaver Pickaxe",
      discoveredBy: "Test",
      discoveredAt: 0,
      mode: "DISPLAYED",
      history: [],
    },
    {
      id: "relic-anvil",
      template: "RUNIC_ANVIL",
      name: "Anvil of High Hammering",
      discoveredBy: "Test",
      discoveredAt: 0,
      mode: "DISPLAYED",
      history: [],
    },
  );

  // Test seasonal commission replenishment & favor stance upgrade
  const refreshed = refreshSeasonalCommissions(
    {
      ...state.guild,
      commissions: state.guild.commissions.map((c) => ({ ...c, status: "COMPLETED" as const })),
    },
    240,
    252,
  );
  assert.ok(refreshed.addedTitle, "Should replenish a new seasonal commission when fewer than 2 offers remain");
  assert.ok(refreshed.nextGuild.commissions.some((c) => c.status === "OFFERED"));

  // Gifting a relic to Goblins raising favor >= 30 allies them and stops auto-raids
  state.guild.favor.Goblins = 20;
  const giftRes = performGuildAction(state, {
    type: "GIFT_RELIC",
    id: "relic-pick",
    patron: "Goblins",
  });
  assert.equal(giftRes.success, true);
  const goblinCiv = giftRes.nextState.world.civilizations.find((c) => c.race === "Goblins");
  assert.equal(goblinCiv?.stance, "Allied");

  // 4. Mental break TANTRUM topples furniture when stressed
  state.dwarves[0].mentalBreak = { type: "TANTRUM", startedAt: 1, duration: 40 };
  state.resources.furniture = 5;
  state.ticks = 9; // nextTicks = 10
  const afterTantrum = stepSimulationTick(state);
  assert.equal(afterTantrum.resources.furniture, 4, "Tantrum should topple 1 furniture on tick % 10");
});
