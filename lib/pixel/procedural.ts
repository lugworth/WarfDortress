import type { Frame } from './sprite.ts';

/** Deterministic hash of integer coordinates to [0, 1). */
export function hash01(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Value noise on a lattice of `cell` pixels that wraps every 16 pixels, so tiles repeat seamlessly. */
export function tileNoise(x: number, y: number, seed: number, cell = 4): number {
  const period = 16 / cell;
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const at = (ix: number, iy: number) => hash01(((ix % period) + period) % period, ((iy % period) + period) % period, seed);
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
}

/** Builds a 16x16 frame by asking `pick` for each pixel's character. */
export function generate(pick: (x: number, y: number) => string, size = 16): Frame {
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = '';
    for (let x = 0; x < size; x++) row += pick(x, y);
    rows.push(row);
  }
  return rows;
}

/** Turf with scattered tufts. */
export function grassTile(seed: number, tones = { base: 'h', dark: 'G', light: 'H', glint: 'j' }): Frame {
  return generate((x, y) => {
    const n = tileNoise(x, y, seed, 8);
    const r = hash01(x, y, seed + 7);
    // A tuft is a light pixel with a shadow beneath it.
    if (hash01(x, y + 1, seed + 3) > 0.9) return tones.dark;
    if (hash01(x, y, seed + 3) > 0.9) return r > 0.7 ? tones.glint : tones.light;
    return n < 0.32 ? tones.dark : tones.base;
  });
}

/** Hewn floor: mottled stone with pebbles and the odd crack. */
export function floorTile(seed: number, tones = { base: 'Q', dark: 'q', light: 'E', glint: '4' }): Frame {
  return generate((x, y) => {
    const n = tileNoise(x, y, seed, 4);
    const r = hash01(x, y, seed);
    if (r > 0.96) return tones.glint;
    if (n > 0.72) return tones.light;
    if (n < 0.22 || (r < 0.03 && y % 5 === 0)) return tones.dark;
    return tones.base;
  });
}

/** Loose ground such as sand or soil. */
export function grainTile(seed: number, tones: { base: string; dark: string; light: string }): Frame {
  return generate((x, y) => {
    const n = tileNoise(x, y, seed, 4);
    const r = hash01(x, y, seed + 11);
    if (r > 0.93) return tones.light;
    if (r < 0.06 || n < 0.25) return tones.dark;
    return tones.base;
  });
}

/**
 * Solid rock seen from above (`top`) or its south face (`front`). The front
 * face is darker with horizontal strata and a lit top lip, which gives the map
 * its three-quarter depth.
 */
export function rockTile(seed: number, face: 'top' | 'front', tones = { dark: '1', base: '3', light: '4', glint: '5' }): Frame {
  return generate((x, y) => {
    const n = tileNoise(x, y, seed, 4);
    const r = hash01(x, y, seed + 5);
    if (face === 'front') {
      if (y === 0) return tones.light;
      if (y === 15) return 'k';
      if ((y + Math.floor(n * 3)) % 5 === 0) return tones.dark;
      return n > 0.6 ? tones.base : r > 0.85 ? tones.base : tones.dark === '1' ? '2' : tones.dark;
    }
    if (r > 0.95) return tones.glint;
    if (n > 0.68) return tones.light;
    if (n < 0.25) return tones.dark;
    return tones.base;
  });
}

/** Unexplored rock: near-black with a faint dither so the void reads as solid. */
/** Unexplored rock: a dim, cracked mass, darker than any wall the dwarves have seen. */
export function fogTile(seed: number): Frame {
  return generate((x, y) => {
    if ((x + y * 3) % 7 === 0 && hash01(x, y, seed) > 0.62) return '2';
    return tileNoise(x, y, seed, 4) < 0.32 ? 'K' : '1';
  });
}

/** One frame of rippling water. */
export function waterFrame(frame: number, seed = 3): Frame {
  return generate((x, y) => {
    const n = tileNoise(x, y, seed, 8);
    const wave = (x + frame * 2 + (y >> 2) * 5) % 8;
    if (y % 4 === (frame + (x >> 3)) % 4 && wave < 3) return 'O';
    if (hash01(x, y, seed + frame) > 0.985) return 'c';
    return n < 0.35 ? 'N' : 'o';
  });
}

/** One frame of churning magma; the crust drifts between frames. */
export function magmaFrame(frame: number, seed = 9): Frame {
  return generate((x, y) => {
    const n = tileNoise(x + frame * 2, y + frame, seed, 4);
    const r = hash01(x, y, seed + frame * 17);
    if (n < 0.28) return 'R';
    if (n < 0.34) return 'r';
    if (n > 0.8) return r > 0.5 ? 'y' : 'F';
    if (n > 0.62) return 'f';
    return 'e';
  });
}
