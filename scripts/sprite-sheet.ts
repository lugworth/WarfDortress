/**
 * Writes a labelled PNG contact sheet of every sprite frame for art review.
 *   node --experimental-strip-types scripts/sprite-sheet.ts out.png [scale] [name-filter]
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { clothesRamp } from '../lib/pixel/palette.ts';
import { rasterize } from '../lib/pixel/raster.ts';
import { SPRITES } from '../lib/pixel/sprites/index.ts';

const [out = 'sprites.png', scaleArg = '4', filter = ''] = process.argv.slice(2);
const scale = Number(scaleArg);

// 3x5 label font.
const GLYPHS: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', _: '000000000000111', '-': '000000111000000',
};

const entries = Object.entries(SPRITES).filter(([name]) => name.includes(filter));
const maxFrames = Math.max(...entries.map(([, s]) => s.frames.length));
const cellW = Math.max(Math.max(...entries.map(([, s]) => s.w)) * maxFrames + maxFrames + 2, Math.max(...entries.map(([n]) => n.length)) * 4 + 2);
const labelH = 7;
const cellH = Math.max(...entries.map(([, s]) => s.h)) + labelH + 3;
const columns = Math.max(1, Math.min(6, Math.floor(1600 / (cellW * scale))));
const rows = Math.ceil(entries.length / columns);
const W = columns * cellW;
const H = rows * cellH;
const pixels = new Uint8ClampedArray(W * H * 4);

const put = (x: number, y: number, r: number, g: number, b: number) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const v = ((x >> 2) + (y >> 2)) % 2 ? 40 : 52;
  put(x, y, v, v - 4, v + 6);
}
const sampleSlots = { ...clothesRamp('#b0402a'), '%': '#5a3418', '@': '#c07a3a' };

entries.forEach(([name, def], index) => {
  const ox = (index % columns) * cellW + 1;
  const oy = Math.floor(index / columns) * cellH + 1;
  def.frames.forEach((frame, f) => {
    const data = rasterize(frame, sampleSlots);
    const fx = ox + f * (def.w + 1);
    for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
      const i = (y * def.w + x) * 4;
      if (data[i + 3]) put(fx + x, oy + y, data[i], data[i + 1], data[i + 2]);
    }
  });
  [...name.toUpperCase()].forEach((ch, c) => {
    const glyph = GLYPHS[ch];
    if (!glyph) return;
    for (let i = 0; i < 15; i++) if (glyph[i] === '1') put(ox + c * 4 + (i % 3), oy + Math.max(...entries.map(([, s]) => s.h)) + 2 + Math.floor(i / 3), 230, 220, 200);
  });
});

// Nearest-neighbour upscale and PNG encode.
const SW = W * scale;
const SH = H * scale;
const raw = Buffer.alloc((SW * 4 + 1) * SH);
for (let y = 0; y < SH; y++) {
  raw[y * (SW * 4 + 1)] = 0;
  for (let x = 0; x < SW; x++) {
    const s = (Math.floor(y / scale) * W + Math.floor(x / scale)) * 4;
    pixels.slice(s, s + 4).forEach((v, k) => (raw[y * (SW * 4 + 1) + 1 + x * 4 + k] = v));
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SW, 0); ihdr.writeUInt32BE(SH, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(out, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]));
console.log(`${entries.length} sprites -> ${out} (${SW}x${SH})`);
