import type { Tile } from './types.ts';

export interface Position { x: number; y: number; z: number }
const key = (p: Position) => `${p.z}:${p.x}:${p.y}`;

export function adjacent(a: Position, b: Position): boolean {
  return a.z === b.z && Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}

// One breadth-first search supplies routes to every reachable work site for a dwarf.
// Diagonal steps cannot cut through the corner of a wall. Vertical edges require
// stairs on both sides; stairs never grant access to an arbitrary solid level.
export function reachableRoutes(grid: Tile[][][], start: Position) {
  const queue: Position[] = [{ ...start }];
  const reached = new Map<string, { position: Position; first: Position; distance: number }>();
  reached.set(key(start), { position: start, first: start, distance: 0 });
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    const route = reached.get(key(p))!;
    const candidates: Position[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (dx && dy && (!grid[p.z]?.[p.y]?.[p.x + dx]?.walkable || !grid[p.z]?.[p.y + dy]?.[p.x]?.walkable)) continue;
      candidates.push({ x: p.x + dx, y: p.y + dy, z: p.z });
    }
    if (grid[p.z]?.[p.y]?.[p.x]?.terrain === 'STAIRS_UP_DOWN') {
      for (const dz of [-1, 1]) {
        if (grid[p.z + dz]?.[p.y]?.[p.x]?.terrain === 'STAIRS_UP_DOWN') candidates.push({ ...p, z: p.z + dz });
      }
    }
    for (const next of candidates) {
      if (!grid[next.z]?.[next.y]?.[next.x]?.walkable || grid[next.z][next.y][next.x].designation === 'BUILD_WALL' || reached.has(key(next))) continue;
      reached.set(key(next), { position: next, first: head === 0 ? next : route.first, distance: route.distance + 1 });
      queue.push(next);
    }
  }
  return {
    toWorkSite(target: Position, excludeTarget = false) {
      let best: { first: Position; distance: number } | undefined;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (excludeTarget && dx === 0 && dy === 0) continue;
        const candidate = reached.get(key({ x: target.x + dx, y: target.y + dy, z: target.z }));
        if (candidate && (!best || candidate.distance < best.distance)) best = candidate;
      }
      return best;
    },
  };
}
