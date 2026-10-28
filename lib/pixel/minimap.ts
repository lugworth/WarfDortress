import type { GameState, Tile } from '../types';
import { TILE, type Camera } from './camera';
import { MINIMAP_COLORS } from './tiles';

/** Minimap pixels per tile. */
export const MINIMAP_CELL = 2;

const FOG = '#15101c';
const terrainImages = new WeakMap<Tile[][], HTMLCanvasElement>();

function terrainImage(level: Tile[][]): HTMLCanvasElement {
  let image = terrainImages.get(level);
  if (image) return image;
  const rows = level.length;
  const cols = level[0]?.length ?? 0;
  image = Object.assign(document.createElement('canvas'), { width: cols * MINIMAP_CELL, height: rows * MINIMAP_CELL });
  const ctx = image.getContext('2d')!;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = level[y][x];
      ctx.fillStyle = tile.revealed ? MINIMAP_COLORS[tile.terrain] : FOG;
      ctx.fillRect(x * MINIMAP_CELL, y * MINIMAP_CELL, MINIMAP_CELL, MINIMAP_CELL);
    }
  }
  terrainImages.set(level, image);
  return image;
}

/**
 * Draws one level at MINIMAP_CELL pixels per tile, with dwarves, blinking
 * hostiles, and (given a camera) the main view's outline. Terrain is cached per level array.
 */
export function drawMinimap(ctx: CanvasRenderingContext2D, state: GameState, z: number, camera: Camera | null, viewW: number, viewH: number, now: number) {
  const level = state.grid[z];
  if (!level) return;
  const c = MINIMAP_CELL;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(terrainImage(level), 0, 0);
  ctx.fillStyle = '#6dd36a';
  for (const d of state.dwarves) if (d.z === z) ctx.fillRect(d.x * c, d.y * c, c, c);
  if (Math.floor(now / 400) % 2 === 0) {
    ctx.fillStyle = '#ff5a4a';
    for (const h of state.hostiles) if (h.z === z && level[h.y]?.[h.x]?.revealed) ctx.fillRect(h.x * c - 1, h.y * c - 1, c + 2, c + 2);
  }
  if (!camera) return;
  const x = Math.round((camera.x / TILE) * c);
  const y = Math.round((camera.y / TILE) * c);
  const w = Math.round((viewW / camera.scale / TILE) * c);
  const h = Math.round((viewH / camera.scale / TILE) * c);
  ctx.strokeStyle = '#f5c542';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(2, w - 1), Math.max(2, h - 1));
}
