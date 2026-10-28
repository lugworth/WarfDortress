/**
 * Sprites are text art: one character per pixel, looked up in PALETTE (or a
 * creature's slot colors). '.' is transparent. Frames are arrays of rows.
 */
export type Frame = readonly string[];

export interface SpriteDef {
  w: number;
  h: number;
  frames: readonly Frame[];
  /** Milliseconds per frame for looping animations. Omit for static or state-driven sprites. */
  frameMs?: number;
}

/** Parses template-literal art. Blank lines and indentation are ignored; spaces are not allowed in art. */
export function art(text: string): Frame {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function sprite(w: number, h: number, frames: readonly (string | Frame)[], frameMs?: number): SpriteDef {
  const parsed = frames.map((frame) => (typeof frame === 'string' ? art(frame) : frame));
  parsed.forEach((rows, index) => {
    if (rows.length !== h || rows.some((row) => row.length !== w)) {
      const sizes = rows.map((row) => row.length).join(',');
      throw new Error(`Sprite frame ${index} is ${rows.length} rows of [${sizes}], expected ${h} rows of ${w}.`);
    }
  });
  return { w, h, frames: parsed, frameMs };
}

/** Mirrors a frame left to right. */
export function mirror(rows: Frame): Frame {
  return rows.map((row) => [...row].reverse().join(''));
}

/** Moves a frame by (dx, dy), filling exposed pixels with transparency. */
export function shift(rows: Frame, dx: number, dy: number): Frame {
  const w = rows[0]?.length ?? 0;
  return rows.map((_, y) => {
    const source = rows[y - dy];
    let out = '';
    for (let x = 0; x < w; x++) out += source?.[x - dx] ?? '.';
    return out;
  });
}

/** Draws `top` over `base`; transparent pixels in `top` keep the base. */
export function overlay(base: Frame, top: Frame): Frame {
  return base.map((row, y) => {
    let out = '';
    for (let x = 0; x < row.length; x++) {
      const t = top[y]?.[x] ?? '.';
      out += t === '.' ? row[x] : t;
    }
    return out;
  });
}

/** Replaces palette characters, e.g. to make a winter variant. */
export function recolor(rows: Frame, map: Readonly<Record<string, string>>): Frame {
  return rows.map((row) => [...row].map((c) => map[c] ?? c).join(''));
}

/** Frame index for a looping animation at time `ms`, offset per instance by `phase`. */
export function frameAt(def: SpriteDef, ms: number, phase = 0): number {
  if (def.frames.length <= 1 || !def.frameMs) return 0;
  return Math.floor(ms / def.frameMs + phase) % def.frames.length;
}
