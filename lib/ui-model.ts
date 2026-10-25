import type {
  ChronicleEntry,
  DesignationType,
  FortressResources,
  GameState,
  Tile,
  TileTerrain,
} from "./types.ts";
import { canDesignateTile, getConstructionCost } from "./game-engine.ts";

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
  action?: "GUILD";
}

export function getFortressNotices(state: GameState): FortressNotice[] {
  const notices: FortressNotice[] = [];
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
