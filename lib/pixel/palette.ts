/**
 * "Deep Anvil" palette. Every sprite pixel is one character from this table, so
 * sprites stay readable as text art and every color comes from one place.
 * '.' is transparent.
 */
export const PALETTE: Readonly<Record<string, string>> = {
  // Outline and shadow
  k: '#0d0a12',
  K: '#1b1522',
  // Stone, cool to warm
  1: '#2a2233',
  2: '#3b3145',
  3: '#524658',
  4: '#6e6172',
  5: '#8f8191',
  6: '#b3a6ad',
  // Warm hewn floor
  q: '#2e2529',
  Q: '#3f3236',
  E: '#544347',
  // Earth and timber
  u: '#2b1a14',
  w: '#4a2c1d',
  W: '#74452a',
  b: '#a06a3d',
  B: '#c99a62',
  // Sand
  s: '#d9b679',
  S: '#f0d9a0',
  // Foliage
  g: '#1d3b2a',
  G: '#2f6a3b',
  h: '#4f9a45',
  H: '#8fcf5c',
  j: '#c8ec8a',
  // Water and ice
  n: '#0f1e33',
  N: '#1b3b63',
  o: '#2b6ea8',
  O: '#4fa3dd',
  c: '#9ee3ff',
  C: '#e0fbff',
  // Fire and blood
  r: '#5a1620',
  R: '#a82a2f',
  e: '#e5533d',
  f: '#ff8e3c',
  F: '#ffd25e',
  y: '#fff2a8',
  // Gold
  d: '#7a4f12',
  D: '#c88a1e',
  a: '#f5c542',
  A: '#fff0a0',
  // Ale and magic
  p: '#2c1640',
  P: '#5b2c7e',
  m: '#9a55c9',
  M: '#d7a0ff',
  // Skin
  z: '#8a4e3a',
  Z: '#d08d66',
  x: '#f2c29b',
  // Bone, steel, white
  l: '#e8dfd0',
  L: '#ffffff',
  v: '#5d6877',
  V: '#9aa7b6',
  i: '#dce6ef',
  // Copper patina
  t: '#2f7f74',
  T: '#5fc4ad',
};

/**
 * Recolorable slots. Creature sprites draw clothing and beards with these
 * characters; each dwarf supplies its own colors when its sprite is built.
 */
export const SLOT_KEYS = {
  clothesDark: '7',
  clothes: '8',
  clothesLight: '9',
  beardDark: '%',
  beard: '@',
} as const;

export type SlotColors = Partial<Record<(typeof SLOT_KEYS)[keyof typeof SLOT_KEYS], string>>;

export const DEFAULT_SLOTS: SlotColors = {
  7: '#3a2a5a',
  8: '#5a4290',
  9: '#8a73c4',
  '%': '#5a3418',
  '@': '#9a5a2a',
};

/** Hex color to [r, g, b, a]. */
export function hexToRgba(hex: string): [number, number, number, number] {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  const n = parseInt(full.slice(0, 6), 16);
  const alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) : 255;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

/** Mixes two hex colors; t = 0 gives `a`, t = 1 gives `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgba(a);
  const [br, bg, bb] = hexToRgba(b);
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

/** Derives a dark / main / light clothing ramp from one base color. */
export function clothesRamp(base: string): Pick<SlotColors, '7' | '8' | '9'> {
  return { 7: mixHex(base, '#0d0a12', 0.45), 8: mixHex(base, '#3b3145', 0.15), 9: mixHex(base, '#ffffff', 0.3) };
}
