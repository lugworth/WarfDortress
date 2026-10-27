import type { Tile, TileTerrain } from './types.ts';

export type Grid = Tile[][][];
export type GridLevel = Tile[][];
export type TerrainCounts = ReadonlyMap<TileTerrain, number>;

// Published grids are never mutated: the simulation copies the rows it changes
// (see createGridDraft), so a level's identity is a safe cache key.
const levelCounts = new WeakMap<GridLevel, Map<TileTerrain, number>>();
const gridCounts = new WeakMap<Grid, { total: TerrainCounts; byLevel: TerrainCounts[] }>();

export function getLevelTerrainCounts(level: GridLevel | undefined): TerrainCounts {
  if (!level) return new Map();
  let counts = levelCounts.get(level);
  if (!counts) {
    counts = new Map();
    for (const row of level) {
      for (const tile of row) counts.set(tile.terrain, (counts.get(tile.terrain) ?? 0) + 1);
    }
    levelCounts.set(level, counts);
  }
  return counts;
}

export function getTerrainCounts(grid: Grid): { total: TerrainCounts; byLevel: TerrainCounts[] } {
  let counts = gridCounts.get(grid);
  if (!counts) {
    const byLevel = grid.map(getLevelTerrainCounts);
    const total = new Map<TileTerrain, number>();
    for (const level of byLevel) {
      for (const [terrain, n] of level) total.set(terrain, (total.get(terrain) ?? 0) + n);
    }
    counts = { total, byLevel };
    gridCounts.set(grid, counts);
  }
  return counts;
}

export function countOf(counts: TerrainCounts, ...terrains: TileTerrain[]): number {
  return terrains.reduce((sum, terrain) => sum + (counts.get(terrain) ?? 0), 0);
}

export const WORKSHOP_TERRAINS = [
  'WORKSHOP_MASON',
  'WORKSHOP_CARPENTER',
  'WORKSHOP_STILL',
  'WORKSHOP_SMELTER',
  'WORKSHOP_FORGE',
] as const satisfies readonly TileTerrain[];

/**
 * Copy-on-write editing for one simulation step. Reads see earlier edits from
 * the same step; levels and rows that are never edited keep their identity, so
 * renderers and caches can skip them.
 */
export function createGridDraft(source: Grid) {
  let draft: Grid | null = null;
  const copiedLevels = new Set<number>();
  const copiedRows = new Set<number>();
  return {
    get grid(): Grid {
      return draft ?? source;
    },
    tile(z: number, y: number, x: number): Tile | undefined {
      return (draft ?? source)[z]?.[y]?.[x];
    },
    edit(z: number, y: number, x: number): Tile | undefined {
      if (!(draft ?? source)[z]?.[y]?.[x]) return undefined;
      draft ??= source.slice();
      if (!copiedLevels.has(z)) {
        draft[z] = draft[z].slice();
        copiedLevels.add(z);
      }
      const rowKey = z * 65_536 + y;
      if (!copiedRows.has(rowKey)) {
        draft[z][y] = draft[z][y].map((tile) => ({ ...tile }));
        copiedRows.add(rowKey);
      }
      return draft[z][y][x];
    },
  };
}

export type GridDraft = ReturnType<typeof createGridDraft>;
