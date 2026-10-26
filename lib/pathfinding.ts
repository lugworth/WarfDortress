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
 * Find path between two 3D grid positions using A*.
 * Handles different Z levels by finding the nearest stairwell,
 * pathing to it, ascending/descending, then pathing to the goal.
 */
export function findPath(
  grid: Tile[][][],
  start: Node3D,
  goal: Node3D
): Node3D[] | null {
  // Same level: direct A*
  if (start.z === goal.z) {
    return astarSameLevel(grid, start, goal);
  }

  // Different levels: find stairs on current level, path to nearest,
  // then path from stairs on goal level to goal.
  const stairsOnStartLevel = findStairs(grid, start.z);
  const stairsOnGoalLevel = findStairs(grid, goal.z);

  // Try each stair on start level
  for (const stairStart of stairsOnStartLevel) {
    // Path to stair on start level
    const pathToStair = astarSameLevel(grid, start, stairStart);
    if (!pathToStair) continue;

    // Find matching stair on goal level (same x,y)
    const stairOnGoal = stairsOnGoalLevel.find(s => s.x === stairStart.x && s.y === stairStart.y);
    if (!stairOnGoal) continue;

    // Path from stair on goal level to goal
    const pathFromStair = astarSameLevel(grid, stairOnGoal, goal);
    if (!pathFromStair) continue;

    // Combine: pathToStair (drop last step), all intermediate levels, pathFromStair
    const fullPath = [...pathToStair];

    // Add intermediate Z levels (stair by stair)
    const dz = goal.z - start.z;
    const step = dz > 0 ? 1 : -1;
    let curZ = start.z;
    while (curZ !== goal.z) {
      curZ += step;
      const stairAtZ = findStairs(grid, curZ).find(s => s.x === stairStart.x && s.y === stairStart.y);
      if (stairAtZ) {
        fullPath.push(stairAtZ);
      }
    }

    // Drop first step of second path (it's the stair we're already at)
    fullPath.push(...pathFromStair.slice(1));
    return fullPath;
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
