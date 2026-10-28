import { clothesRamp, type SlotColors } from './palette.ts';
import { hash01 } from './procedural.ts';

const CLOTHES = ['#9a3b2c', '#3b5f96', '#3f7340', '#8f6a2a', '#6a3f8c', '#2f7272', '#8c4a6a', '#5c6b3a'];
const BEARDS = ['#3a2418', '#6a3a1a', '#b0562a', '#d2a65a', '#8d8a88', '#24201f', '#e2ddd5', '#7a2f1e'];

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}

/** Stable clothing and beard colors for a dwarf, so each one is recognizable on the map. */
export function dwarfSlots(id: string): { slots: SlotColors; key: string } {
  const seed = seedOf(id);
  // Modulo keeps sequentially numbered dwarves in different outfits.
  const clothes = CLOTHES[((seed % CLOTHES.length) + CLOTHES.length) % CLOTHES.length];
  const beard = BEARDS[Math.floor(hash01(seed, 2, 11) * BEARDS.length)];
  return {
    slots: { ...clothesRamp(clothes), '@': beard, '%': mix(beard) },
    key: `${clothes}${beard}`,
  };
}

function mix(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const d = (v: number) => Math.round(v * 0.62).toString(16).padStart(2, '0');
  return `#${d((n >> 16) & 255)}${d((n >> 8) & 255)}${d(n & 255)}`;
}
