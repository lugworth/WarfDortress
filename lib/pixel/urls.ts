import type { SlotColors } from './palette.ts';
import { pngDataUrl } from './png.ts';
import { rasterize } from './raster.ts';
import { SPRITES, type SpriteName } from './sprites/index.ts';

// Data URLs for <img> icons and CSS sprite strips. They need no DOM, so server
// rendering and hydration produce the same markup.
const urls = new Map<string, string>();

function cached(key: string, make: () => string): string {
  let url = urls.get(key);
  if (!url) {
    url = make();
    urls.set(key, url);
  }
  return url;
}

/** One frame as a PNG data URL. `slotKey` identifies the recolor in `slots`. */
export function spriteUrl(name: SpriteName, frame = 0, slots?: SlotColors, slotKey = ''): string {
  const def = SPRITES[name];
  const index = ((frame % def.frames.length) + def.frames.length) % def.frames.length;
  return cached(`${name}|${index}|${slotKey}`, () => pngDataUrl(def.w, def.h, rasterize(def.frames[index], slots)));
}

/** Every frame side by side, for CSS steps() animation. */
export function spriteStripUrl(name: SpriteName, slots?: SlotColors, slotKey = ''): string {
  return cached(`strip|${name}|${slotKey}`, () => {
    const def = SPRITES[name];
    const count = def.frames.length;
    const width = def.w * count;
    const strip = new Uint8ClampedArray(width * def.h * 4);
    def.frames.forEach((frame, f) => {
      const pixels = rasterize(frame, slots);
      for (let y = 0; y < def.h; y++) {
        strip.set(pixels.subarray(y * def.w * 4, (y + 1) * def.w * 4), (y * width + f * def.w) * 4);
      }
    });
    return pngDataUrl(width, def.h, strip);
  });
}
