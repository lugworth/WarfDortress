import type { SlotColors } from './palette';
import { rasterize } from './raster';
import { SPRITES, type SpriteName } from './sprites';

// Browser-only caches of rasterized frames for the map canvas. Sprites are tiny, so one canvas per
// frame (and per dwarf recolor) is simpler than packing an atlas.
const frames = new Map<string, HTMLCanvasElement>();
const flashes = new Map<string, HTMLCanvasElement>();

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** A rasterized sprite frame. `slotKey` identifies the recolor in `slots`. */
export function spriteFrame(name: SpriteName, frame = 0, slots?: SlotColors, slotKey = ''): HTMLCanvasElement {
  const def = SPRITES[name];
  const index = ((frame % def.frames.length) + def.frames.length) % def.frames.length;
  const key = `${name}|${index}|${slotKey}`;
  let c = frames.get(key);
  if (!c) {
    c = canvas(def.w, def.h);
    const ctx = c.getContext('2d')!;
    const image = ctx.createImageData(def.w, def.h);
    image.data.set(rasterize(def.frames[index], slots));
    ctx.putImageData(image, 0, 0);
    frames.set(key, c);
  }
  return c;
}

/** A white silhouette of a frame, for hit flashes. */
export function spriteFlash(name: SpriteName, frame = 0, slots?: SlotColors, slotKey = ''): HTMLCanvasElement {
  const source = spriteFrame(name, frame, slots, slotKey);
  const key = `${name}|${frame}|${slotKey}`;
  let c = flashes.get(key);
  if (!c) {
    c = canvas(source.width, source.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    flashes.set(key, c);
  }
  return c;
}
