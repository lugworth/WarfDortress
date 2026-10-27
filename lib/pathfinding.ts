// A* pathfinding for WarfDortress 3D grid
// Grid layout: grid[z][y][x] where each cell has a walkable property
// Handles multi-level movement via stairs (STAIRS_UP_DOWN terrain)

import type { Tile } from './types.ts';

interface Node3D {
  z: number;
  y: number;
  x: number;
}

interface OpenNode extends Node3D {
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: OpenNode | null;
}

function manhattan3D(a: Node3D, b: Node3D): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) * 4;
}

function isOpenNode(n: any): n is OpenNode {
  return n && typeof n.g === 'number' && typeof n.h === 'number';
}

function nodeKey(n: Node3D): string {
  return `${n.z}:${n.y}:${n.x}`;
}

function getTile(grid: Tile[][][], z: number, y: number, x: number): Tile | null {
  if (z < 0 || y < 0 || x < 0) return null;
  const level = grid[z];
  if (!level) return null;
  const row = level[y];
  if (!row) return null;
  return row[x] ?? null;
}

function findStairs(grid: Tile[][][], z: number): Node3D[] {
  const stairs: Node3D[] = [];
  const level = grid[z];
  if (!level) return stairs;
  for (let y = 0; y < level.length; y++) {
    for (let x = 0; x < level[y].length; x++) {
      if (level[y][x].terrain === 'STAIRS_UP_DOWN') {
        stairs.push({ z, y, x });
      }
    }
  }
  return stairs;
}

function astarSameLevel(
  grid: Tile[][][],
  start: Node3D,
  goal: Node3D
): Node3D[] | null {
  const z = start.z;
  const openList: OpenNode[] = [
    { ...start, g: 0, h: manhattan3D(start, goal), f: manhattan3D(start, goal), parent: null },
  ];
  const closed = new Set<string>();
  const cameFrom = new Map<string, OpenNode | null>();
  const gScores = new Map<string, number>();
  cameFrom.set(nodeKey(start), null);
  gScores.set(nodeKey(start), 0);

  while (openList.length > 0) {
    // Find node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[bestIdx].f) bestIdx = i;
    }
    const current = openList.splice(bestIdx, 1)[0];

    if (current.x === goal.x && current.y === goal.y && current.z === goal.z) {
      // Reconstruct path
      const path: Node3D[] = [];
      let node: OpenNode | null = current;
      while (node !== null) {
        path.unshift({ z: node.z, y: node.y, x: node.x });
        node = node.parent;
      }
      return path;
    }

    closed.add(nodeKey(current));

    // 8 neighbors + 4 diagonal
    const dirs = [
      { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },                  { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },  { dx: 0, dy: 1 }, { dx: 1, dy: 1 },
    ];

    for (const d of dirs) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;
      const nk = `${z}:${ny}:${nx}`;
      if (closed.has(nk)) continue;

      const tile = getTile(grid, z, ny, nx);
      if (!tile || !tile.walkable) continue;

      // Diagonal cost is 1.414
      const moveCost = d.dx !== 0 && d.dy !== 0 ? 1.414 : 1;
      const tentativeG = current.g + moveCost;

      if (gScores.has(nk) && tentativeG >= gScores.get(nk)!) {
        continue;
      }

      const neighbor: OpenNode = {
        z, y: ny, x: nx,
        g: tentativeG,
        h: manhattan3D({ z, y: ny, x: nx }, goal),
        f: tentativeG + manhattan3D({ z, y: ny, x: nx }, goal),
        parent: current,
      };

      cameFrom.set(nk, neighbor);
      gScores.set(nk, tentativeG);
      openList.push(neighbor);
    }
  }

  return null;
}

/**
 * Find path between two 3D grid positions using A* across all 3D walkable tiles
 * and vertical STAIRS_UP_DOWN connections (including offset multi-stairwell routes).
 */
export function findPath(
  grid: Tile[][][],
  start: Node3D,
  goal: Node3D
): Node3D[] | null {
  // Fast path for same Z level
  if (start.z === goal.z) {
    return astarSameLevel(grid, start, goal);
  }

  const openList: OpenNode[] = [
    { ...start, g: 0, h: manhattan3D(start, goal), f: manhattan3D(start, goal), parent: null },
  ];
  const closed = new Set<string>();
  const gScores = new Map<string, number>();
  gScores.set(nodeKey(start), 0);

  const dirs = [
    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },                     { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 },
  ];

  while (openList.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[bestIdx].f) bestIdx = i;
    }
    const current = openList.splice(bestIdx, 1)[0];

    if (current.x === goal.x && current.y === goal.y && current.z === goal.z) {
      const path: Node3D[] = [];
      let node: OpenNode | null = current;
      while (node !== null) {
        path.unshift({ z: node.z, y: node.y, x: node.x });
        node = node.parent;
      }
      return path;
    }

    const ck = nodeKey(current);
    if (closed.has(ck)) continue;
    closed.add(ck);

    // 1. Same-Z neighbors
    for (const d of dirs) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;
      const nk = `${current.z}:${ny}:${nx}`;
      if (closed.has(nk)) continue;

      const tile = getTile(grid, current.z, ny, nx);
      if (!tile || !tile.walkable) continue;

      const moveCost = d.dx !== 0 && d.dy !== 0 ? 1.414 : 1;
      const tentativeG = current.g + moveCost;
      if (gScores.has(nk) && tentativeG >= gScores.get(nk)!) continue;

      const h = manhattan3D({ z: current.z, y: ny, x: nx }, goal);
      gScores.set(nk, tentativeG);
      openList.push({
        z: current.z,
        y: ny,
        x: nx,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: current,
      });
    }

    // 2. Vertical stair transitions (STAIRS_UP_DOWN on current and adjacent Z)
    const curTile = getTile(grid, current.z, current.y, current.x);
    if (curTile && curTile.terrain === 'STAIRS_UP_DOWN') {
      for (const dz of [-1, 1]) {
        const nz = current.z + dz;
        const nk = `${nz}:${current.y}:${current.x}`;
        if (closed.has(nk)) continue;

        const adjTile = getTile(grid, nz, current.y, current.x);
        if (!adjTile || !adjTile.walkable || adjTile.terrain !== 'STAIRS_UP_DOWN') continue;

        const tentativeG = current.g + 2;
        if (gScores.has(nk) && tentativeG >= gScores.get(nk)!) continue;

        const h = manhattan3D({ z: nz, y: current.y, x: current.x }, goal);
        gScores.set(nk, tentativeG);
        openList.push({
          z: nz,
          y: current.y,
          x: current.x,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        });
      }
    }
  }

  return null;
}

/**
 * Get the next step along a path (relative to current position).
 * Returns null if at goal or path is exhausted.
 */
export function nextStepAlongPath(
  path: Node3D[],
  current: Node3D
): Node3D | null {
  // Find our position in the path
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (p.x === current.x && p.y === current.y && p.z === current.z) {
      // Return next step
      if (i + 1 < path.length) {
        return path[i + 1];
      }
      return null; // At end of path
    }
  }

  // Not on path — recompute would be better, but return first step
  if (path.length > 0) {
    return path[0];
  }
  return null;
}
