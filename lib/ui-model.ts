import type {
  ChronicleEntry,
  DesignationType,
  FortressResources,
  GameState,
  Tile,
  TileTerrain,
} from "./types.ts";
import {
  canDesignateTile,
  getBuildingTileFunctionInfo,
  getConstructionCost,
} from "./game-engine.ts";
import {
  getCurrentWeather,
  getWeatherTileVisuals,
  isShelteredOrPavedTile,
} from "./weather.ts";


export interface PreviewTile {
  x: number;
  y: number;
  z: number;
  valid: boolean;
  reason?: string;
  alreadyDesignated?: boolean;
}
export interface DesignationPreview {
  tiles: PreviewTile[];
  accepted: number;
  skipped: number;
  alreadyDesignated: number;
  /** Estimated cost when the marked jobs complete; placement does not spend it. */
  cost: Partial<FortressResources>;
  missing: Partial<FortressResources>;
}

function rejectionReason(tile: Tile, type: DesignationType): string {
  if (type === "CANCEL") return "No queued order to clear.";
  if (!tile.revealed) return "This unexplored tile does not accept that order.";
  if (type === "MINE") return "Mining needs unmined rock or an ore vein.";
  if (type === "CHOP") return "Timber felling needs a tree.";
  if (type === "GATHER") return "Foraging needs a shrub.";
  if (type === "RECLAIM_RELIC")
    return "Relic recovery needs an unclaimed cavern relic.";
  if (type === "STAIRS") return "Stairs need rock, soil, rock floor, or grass.";
  return "Construction or zoning needs an empty floor tile.";
}

export function getDesignationPreview(
  state: GameState,
  z: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  type: DesignationType,
): DesignationPreview {
  const preview: DesignationPreview = {
    tiles: [],
    accepted: 0,
    skipped: 0,
    alreadyDesignated: 0,
    cost: {},
    missing: {},
  };
  if (
    ![z, x1, y1, x2, y2].every(Number.isFinite) ||
    !Number.isInteger(z) ||
    z < 0 ||
    z >= state.world.depth
  )
    return preview;
  // The engine compares integer tile indices against the clipped rectangle.
  const minX = Math.ceil(Math.max(0, Math.min(x1, x2)));
  const maxX = Math.floor(Math.min(state.world.width - 1, Math.max(x1, x2)));
  const minY = Math.ceil(Math.max(0, Math.min(y1, y2)));
  const maxY = Math.floor(Math.min(state.world.height - 1, Math.max(y1, y2)));
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const tile = state.grid[z]?.[y]?.[x];
      if (!tile) continue;
      const valid = canDesignateTile(tile, type);
      const alreadyDesignated =
        valid && type !== "CANCEL" && tile.designation === type;
      preview.tiles.push({
        x,
        y,
        z,
        valid,
        ...(alreadyDesignated
          ? {
              alreadyDesignated: true,
              reason:
                "This order is already queued; it will not be duplicated.",
            }
          : !valid
            ? { reason: rejectionReason(tile, type) }
            : {}),
      });
      if (valid) preview.accepted++;
      else preview.skipped++;
      if (alreadyDesignated) preview.alreadyDesignated++;
    }
  // Queue eligibility is independent of affordability. Existing engine orders
  // reserve no material at placement and only consume resources on completion.
  for (const [key, amount] of Object.entries(getConstructionCost(type))) {
    const resource = key as keyof FortressResources;
    const total = (amount || 0) * preview.accepted;
    if (!total) continue;
    preview.cost[resource] = total;
    const missing = Math.max(0, total - state.resources[resource]);
    if (missing) preview.missing[resource] = missing;
  }
  return preview;
}

export interface MapPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  kind: "DWARF" | "HOSTILE" | "WORKSHOP" | "STAIRS" | "RELIC";
}
const STRUCTURES: Partial<Record<TileTerrain, string>> = {
  WORKSHOP_MASON: "Mason's workshop",
  WORKSHOP_CARPENTER: "Carpenter's workshop",
  WORKSHOP_STILL: "Brewer's still",
  WORKSHOP_SMELTER: "Smeltery",
  WORKSHOP_FORGE: "Metalsmith forge",
  TAVERN_HALL: "Tavern hall",
  TEMPLE_ALTAR: "Temple altar",
  TRADE_DEPOT: "Trade depot",
};
function isRevealed(
  state: GameState,
  p: { x: number; y: number; z: number },
): boolean {
  return Boolean(state.grid[p.z]?.[p.y]?.[p.x]?.revealed);
}

export function getMapPoints(state: GameState, z: number): MapPoint[] {
  if (!Number.isInteger(z) || z < 0 || z >= state.world.depth) return [];
  const points: MapPoint[] = [];
  for (const dwarf of state.dwarves) {
    if (dwarf.z === z && isRevealed(state, dwarf))
      points.push({
        id: `dwarf:${dwarf.id}`,
        label: dwarf.name,
        x: dwarf.x,
        y: dwarf.y,
        z,
        kind: "DWARF",
      });
  }
  for (const hostile of state.hostiles) {
    if (hostile.z === z && hostile.hp > 0 && isRevealed(state, hostile))
      points.push({
        id: `hostile:${hostile.id}`,
        label: hostile.name,
        x: hostile.x,
        y: hostile.y,
        z,
        kind: "HOSTILE",
      });
  }
  for (const row of state.grid[z])
    for (const tile of row) {
      if (!tile.revealed) continue;
      const kind =
        tile.terrain === "STAIRS_UP_DOWN"
          ? "STAIRS"
          : tile.terrain === "CAVERN_RELIC"
            ? "RELIC"
            : STRUCTURES[tile.terrain]
              ? "WORKSHOP"
              : null;
      if (kind)
        points.push({
          id: `tile:${z}:${tile.x}:${tile.y}:${tile.terrain}`,
          label:
            kind === "STAIRS"
              ? "Up/down stairs"
              : kind === "RELIC"
                ? "Ancient cavern relic"
                : STRUCTURES[tile.terrain]!,
          x: tile.x,
          y: tile.y,
          z,
          kind,
        });
    }
  const rank: Record<MapPoint["kind"], number> = {
    HOSTILE: 0,
    DWARF: 1,
    RELIC: 2,
    STAIRS: 3,
    WORKSHOP: 4,
  };
  return points.sort(
    (a, b) =>
      rank[a.kind] - rank[b.kind] ||
      a.y - b.y ||
      a.x - b.x ||
      a.id.localeCompare(b.id),
  );
}

export interface FortressNotice {
  id: string;
  label: string;
  severity: "DANGER" | "WARN" | "INFO" | "DISCOVERY";
  coord?: { x: number; y: number; z: number };
  action?: "GUILD" | "ADVENTURE";
}

export function getFortressNotices(state: GameState): FortressNotice[] {
  const notices: FortressNotice[] = [];
  const expedition = state.activities?.expeditions.active;
  if (expedition && state.ticks >= expedition.returnsAt) notices.push({ id: `expedition:${expedition.id}`, label: 'Your scouts have returned. Claim their cargo in the Adventure Hall.', severity: 'DISCOVERY', action: 'ADVENTURE' });
  for (const hostile of [...state.hostiles].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (hostile.hp > 0 && isRevealed(state, hostile))
      notices.push({
        id: `threat:${hostile.id}`,
        label: `${hostile.name} spotted on Z-${hostile.z}.`,
        severity: "DANGER",
        coord: { x: hostile.x, y: hostile.y, z: hostile.z },
      });
  }
  const population = state.dwarves.length;
  for (const [resource, label] of [
    ["food", "Food"],
    ["ale", "Ale"],
  ] as const) {
    if (state.resources[resource] < Math.max(1, population * 2))
      notices.push({
        id: `supplies:${resource}`,
        label: `${label} stock is low: ${state.resources[resource]} for ${population} dwarves.`,
        severity: "WARN",
      });
  }
  for (const dwarf of [...state.dwarves].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (
      dwarf.state === "IDLE" &&
      !dwarf.currentTask &&
      /^(Work waiting:|Work blocked:)/.test(dwarf.thought)
    )
      notices.push({
        id: `worker:${dwarf.id}`,
        label: `${dwarf.name}: ${dwarf.thought}`,
        severity: "INFO",
        coord: { x: dwarf.x, y: dwarf.y, z: dwarf.z },
      });
  }
  for (const commission of state.guild.commissions) {
    if (
      commission.status === "ACTIVE" &&
      state.ticks < commission.deadline &&
      state.resources[commission.requirement.resource] >=
        commission.requirement.amount
    )
      notices.push({
        id: `commission:${commission.id}`,
        label: `Ready to deliver: ${commission.title} (${commission.requirement.amount} ${commission.requirement.resource}).`,
        severity: "DISCOVERY",
        action: "GUILD",
      });
  }
  return notices;
}

export type GroupedChronicleEntry = ChronicleEntry & { count: number };
export function groupChronicle(
  entries: ChronicleEntry[],
): GroupedChronicleEntry[] {
  const groups = new Map<
    string,
    { entry: ChronicleEntry; count: number; index: number }
  >();
  entries.forEach((entry, index) => {
    const key = JSON.stringify([entry.type, entry.text]);
    const previous = groups.get(key);
    if (!previous) groups.set(key, { entry, count: 1, index });
    else {
      previous.count++;
      if (entry.tick > previous.entry.tick) {
        previous.entry = entry;
        previous.index = index;
      }
    }
  });
  return [...groups.values()]
    .sort((a, b) => b.entry.tick - a.entry.tick || a.index - b.index)
    .map(({ entry, count }) => ({ ...entry, count }));
}

export function asciiBar(value: number, max = 100, width = 6): string {
  const safeMax = Math.max(1, max);
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const filled = Math.round(ratio * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}]`;
}

export const TOOL_GLYPHS: Record<DesignationType, string> = {
  MINE: '⛏',
  CHOP: '♠',
  GATHER: '"',
  STAIRS: 'X',
  STOCKPILE: '≡',
  RECLAIM_RELIC: '☼',
  BUILD_WALL: '#',
  BUILD_DOOR: '+',
  BUILD_TRAP: '^',
  BUILD_BED: '⌂',
  BUILD_MASON: 'M',
  BUILD_CARPENTER: 'C',
  BUILD_STILL: 'S',
  BUILD_SMELTER: '£',
  BUILD_FORGE: '⚒',
  BUILD_TAVERN: '♫',
  BUILD_TEMPLE: 'Ψ',
  BUILD_DEPOT: '¤',
  BUILD_FARM: '≈',
  MILITIA_STATION: '♦',
  MILITIA_PATROL: '»',
  CANCEL: '×',
};

export interface TileHoverMetadata {
  x: number;
  y: number;
  z: number;
  revealed: boolean;
  char: string;
  fg: string;
  terrainLabel: string;
  materialType: string;
  occupancy: string[];
  temperature: string;
  temperatureStatus: "COLD" | "TEMPERATE" | "WARM" | "SCORCHING";
  liquidLevel: string;
  liquidDepth: number; // 0..7 scale
  walkableLabel: string;
  yieldLabel: string | null;
  designationLabel: string | null;
  buildingFunction: string | null;
  buildingActionLabel: string | null;
}

const MATERIAL_BY_TERRAIN: Record<TileTerrain, string> = {
  EMPTY_AIR: "Open Cavern Air",
  WATER: "Fresh Surface Water",
  GRASS: "Alluvial Loam & Meadow Turf",
  TREE: "Surface Timber (Conifer & Oak)",
  SHRUB: "Wild Surface Flora & Berries",
  SAND: "Silica Riverbank Sand",
  SOIL: "Subterranean Clay & Loam",
  ROCK_WALL: "Strata Bedrock",
  LIMESTONE_WALL: "Sedimentary Limestone (CaCO3)",
  GRANITE_WALL: "Igneous Crystalline Granite",
  IRON_VEIN: "Hematite & Magnetite Iron Seam",
  COPPER_VEIN: "Malachite & Native Copper Seam",
  GOLD_VEIN: "Auriferous Quartz Gold Vein",
  MITHRIL_VEIN: "Abyssal True-Silver Mithril Vein",
  MAGMA: "Molten Basaltic Magma",
  ROCK_FLOOR: "Hewn Strata Stone Floor",
  CONSTRUCTED_WALL: "Dressed Ashlar Stone Block",
  DOOR: "Iron-Bound Stone Portal",
  BED: "Joined Seasoned Timber Frame",
  WORKSHOP_MASON: "Chiseled Stonework Bench",
  WORKSHOP_CARPENTER: "Sawbuck & Joinery Timber",
  WORKSHOP_STILL: "Copper-Coiled Fermentation Vat",
  WORKSHOP_SMELTER: "Firebrick Blast Furnace",
  WORKSHOP_FORGE: "Hardened Iron Anvil & Hearth",
  TAVERN_HALL: "Oak Trestle & Feast Hearth",
  TEMPLE_ALTAR: "Carved Runic Monolith",
  TRADE_DEPOT: "Paved Caravan Exchange",
  TRAP_STONE: "Counterweighted Deadfall Mechanism",
  CAVERN_RELIC: "Ancient Runic Artifact Alloy",
  FARM_PLOT: "Furrowed Plump-Helmet Silt",
  STAIRS_UP_DOWN: "Carved Spiral Stone Steps",
  STOCKPILE_TILE: "Marked Stone Storage Yard",
};

export function getTileHoverMetadata(
  state: GameState,
  tile: Tile,
): TileHoverMetadata {
  const stratum =
    state.world.strata[tile.z] ||
    state.world.strata[0] || {
      name: "Surface",
      primaryRock: "Granite",
    };

  if (!tile.revealed) {
    return {
      x: tile.x,
      y: tile.y,
      z: tile.z,
      revealed: false,
      char: "·",
      fg: "#808080",
      terrainLabel: "UNEXPLORED STRATA",
      materialType: `Unprobed ${stratum.primaryRock} Formation`,
      occupancy: ["Unexplored (Fog of War)"],
      temperature: `${52 + tile.z * 8}°F (Geothermal Est.)`,
      temperatureStatus: tile.z >= 4 ? "WARM" : "TEMPERATE",
      liquidLevel: "0/7 (Unknown)",
      liquidDepth: 0,
      walkableLabel: "Unexplored",
      yieldLabel: null,
      designationLabel: tile.designation ? tile.designation.replaceAll("_", " ") : null,
      buildingFunction: null,
      buildingActionLabel: null,
    };
  }

  // Material Type: enrich generic rock wall/floor with stratum's primaryRock
  let materialType = MATERIAL_BY_TERRAIN[tile.terrain] || "Rough Stone";
  if (
    tile.terrain === "ROCK_WALL" ||
    tile.terrain === "ROCK_FLOOR" ||
    tile.terrain === "STAIRS_UP_DOWN"
  ) {
    materialType = `${stratum.primaryRock} (${materialType})`;
  }

  // Occupancy: Dwarves, Hostiles, Structures
  const occupancy: string[] = [];
  const dwarvesHere = state.dwarves.filter(
    (d) => d.z === tile.z && d.x === tile.x && d.y === tile.y,
  );
  for (const d of dwarvesHere) {
    occupancy.push(`☺ ${d.name} (${d.state})`);
  }
  const hostilesHere = state.hostiles.filter(
    (h) => h.z === tile.z && h.x === tile.x && h.y === tile.y && h.hp > 0,
  );
  for (const h of hostilesHere) {
    occupancy.push(`${h.char} ${h.name} (${h.hp}/${h.maxHp} HP)`);
  }
  if (STRUCTURES[tile.terrain]) {
    occupancy.push(`⚒ ${STRUCTURES[tile.terrain]}`);
  } else if (tile.terrain === "CAVERN_RELIC") {
    occupancy.push("☼ Unclaimed Cavern Relic");
  } else if (tile.terrain === "BED") {
    occupancy.push("⌂ Dwarven Quarters");
  } else if (tile.terrain === "TRAP_STONE") {
    occupancy.push("^ Armed Stonefall Trap");
  }
  if (occupancy.length === 0) {
    occupancy.push(tile.walkable ? "Clear (Passable)" : "Solid Obstacle");
  }

  // Check proximity to Magma or Water on the same Z-level
  const level = state.grid[tile.z];
  let nearMagma = false;
  let nearWater = false;
  if (level) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const neighbor = level[tile.y + dy]?.[tile.x + dx];
        if (!neighbor) continue;
        if (neighbor.terrain === "MAGMA") nearMagma = true;
        if (
          neighbor.terrain === "WATER" &&
          Math.abs(dx) + Math.abs(dy) === 1
        ) {
          nearWater = true;
        }
      }
    }
  }

  const weather = getCurrentWeather(state);
  const weatherVis = getWeatherTileVisuals(state, tile);

  // Liquid Level (0/7 to 7/7 scale)
  let liquidDepth = 0;
  let liquidLevel = "0/7 Dry";
  if (tile.terrain === "MAGMA") {
    liquidDepth = 7;
    liquidLevel = "7/7 Magma (Full Flow)";
  } else if (tile.terrain === "WATER") {
    liquidDepth = 7;
    liquidLevel =
      tile.z === 0 &&
      (weather.precipitation === "SNOW" || weather.precipitation === "BLIZZARD")
        ? "7/7 Frozen River Ice"
        : "7/7 Water (Channel)";
  } else if (tile.terrain === "FARM_PLOT") {
    liquidDepth = 2;
    liquidLevel = "2/7 Irrigated Loam";
  } else if (
    nearWater &&
    (tile.terrain === "GRASS" ||
      tile.terrain === "SOIL" ||
      tile.terrain === "SAND" ||
      tile.terrain === "ROCK_FLOOR")
  ) {
    liquidDepth = 1;
    liquidLevel = "1/7 Damp Riverbank";
  } else if (
    tile.z === 0 &&
    !isShelteredOrPavedTile(tile) &&
    tile.walkable
  ) {
    if (weather.precipitation === "BLIZZARD") {
      liquidDepth = 3;
      liquidLevel = "3/7 Deep Snowdrift";
    } else if (weather.precipitation === "SNOW") {
      liquidDepth = 2;
      liquidLevel = "2/7 Winter Snowpack";
    } else if (weather.precipitation === "RAIN") {
      liquidDepth = 2;
      liquidLevel = "2/7 Rain-Slicked Mud";
    }
  }

  // Temperature calculation
  let tempF = 56;
  let temperatureStatus: TileHoverMetadata["temperatureStatus"] = "TEMPERATE";
  let tempNote = "Ambient";

  if (tile.terrain === "MAGMA") {
    tempF = 2190;
    temperatureStatus = "SCORCHING";
    tempNote = "10998 Urist · Molten";
  } else if (nearMagma) {
    tempF = 188;
    temperatureStatus = "SCORCHING";
    tempNote = "Magma Radiant";
  } else if (
    tile.terrain === "WORKSHOP_SMELTER" ||
    tile.terrain === "WORKSHOP_FORGE"
  ) {
    tempF = 145;
    temperatureStatus = "WARM";
    tempNote = "Furnace Draft";
  } else if (tile.z === 0) {
    tempF = weather.surfaceTempF;
    if (tempF <= 48) {
      temperatureStatus = "COLD";
    } else if (tempF >= 80) {
      temperatureStatus = "WARM";
    } else {
      temperatureStatus = "TEMPERATE";
    }
    tempNote = weather.label;
    if (tile.terrain === "WATER") {
      tempF -= 6;
      if (tempF <= 45) temperatureStatus = "COLD";
      tempNote =
        weather.precipitation === "SNOW" || weather.precipitation === "BLIZZARD"
          ? "Frozen River"
          : "River Current";
    }
  } else {
    tempF = 52 + tile.z * 9;
    if (tempF >= 85) {
      temperatureStatus = "WARM";
      tempNote = "Deep Geothermal";
    } else {
      temperatureStatus = "TEMPERATE";
      tempNote = "Cavern Ambient";
    }
  }

  const isOutdoorSlowed =
    tile.z === 0 &&
    tile.walkable &&
    !isShelteredOrPavedTile(tile) &&
    weather.surfaceStepInterval > 1;

  const bldgFn = getBuildingTileFunctionInfo(state, tile);

  return {
    x: tile.x,
    y: tile.y,
    z: tile.z,
    revealed: true,
    char: weatherVis.char,
    fg: weatherVis.fg,
    terrainLabel: weatherVis.weatherNote
      ? `${tile.terrain.replaceAll("_", " ")} (${weatherVis.weatherNote})`
      : tile.terrain.replaceAll("_", " "),
    materialType,
    occupancy,
    temperature: `${tempF.toLocaleString("en-US")}°F (${tempNote})`,
    temperatureStatus,
    liquidLevel,
    liquidDepth,
    walkableLabel: !tile.walkable
      ? "Solid Wall"
      : isOutdoorSlowed
        ? `Passable (${weather.surfaceSpeedPct}% Speed · ${weather.shortLabel})`
        : "Passable (100% Speed)",
    yieldLabel: tile.resourceDrop
      ? `+${tile.resourceDrop.amount} ${tile.resourceDrop.type}`
      : null,
    designationLabel: tile.designation
      ? tile.designation.replaceAll("_", " ")
      : null,
    buildingFunction: bldgFn ? bldgFn.passiveFunction : null,
    buildingActionLabel: bldgFn ? bldgFn.actionLabel : null,
  };
}


