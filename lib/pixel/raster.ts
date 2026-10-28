import { hexToRgba, PALETTE, type SlotColors } from './palette.ts';
import type { Frame } from './sprite.ts';

const rgbaCache = new Map<string, [number, number, number, number]>();
function rgbaOf(hex: string) {
  let rgba = rgbaCache.get(hex);
  if (!rgba) rgbaCache.set(hex, (rgba = hexToRgba(hex)));
  return rgba;
}

/** Resolves one art character to a hex color, or null for transparency. */
export function colorOf(char: string, slots?: SlotColors): string | null {
  if (char === '.') return null;
  return (slots as Record<string, string> | undefined)?.[char] ?? PALETTE[char] ?? null;
}

/** Rasterizes a frame into RGBA pixels. Unknown characters render transparent. */
export function rasterize(rows: Frame, slots?: SlotColors): Uint8ClampedArray {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hex = colorOf(rows[y][x], slots);
      if (!hex) continue;
      const [r, g, b, a] = rgbaOf(hex);
      const i = (y * w + x) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = a;
    }
  }
  return out;
}
