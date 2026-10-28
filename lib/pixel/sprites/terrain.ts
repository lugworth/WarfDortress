import { fogTile, floorTile, grainTile, grassTile, generate, hash01, magmaFrame, rockTile, waterFrame } from '../procedural.ts';
import { overlay, recolor, sprite, type Frame, type SpriteDef } from '../sprite.ts';

const T = 16;
const one = (frame: Frame) => sprite(T, T, [frame]);
const many = (frames: Frame[], frameMs?: number) => sprite(T, T, frames, frameMs);

// ---------------------------------------------------------------- ground ---

const GRASS = [1, 2, 3, 4].map((seed) => grassTile(seed));
const FLOOR = [11, 12, 13].map((seed) => floorTile(seed));
const SAND = [21, 22].map((seed) => grainTile(seed, { base: 's', dark: 'b', light: 'S' }));
const FOG = [31, 32].map((seed) => fogTile(seed));

/** Snow-covered ground for winter weather. */
const SNOW = [41, 42].map((seed) =>
  generate((x, y) => {
    const r = hash01(x, y, seed);
    if (r > 0.93) return 'c';
    if (r < 0.05) return 'V';
    return (x * 7 + y * 3 + seed) % 11 === 0 ? 'i' : 'C';
  }),
);

const VOID = generate((x, y) => {
  const r = hash01(x, y, 51);
  if (r > 0.985) return '2';
  return y > 11 ? 'k' : (x + y) % 6 === 0 && r > 0.6 ? 'K' : 'k';
});

// ----------------------------------------------------------------- walls ---

const STONE = { dark: '2', base: '4', light: '5', glint: '6' };
const LIMESTONE = { dark: '4', base: '5', light: '6', glint: 'l' };
const GRANITE = { dark: '1', base: '2', light: '3', glint: '6' };
const EARTH = { dark: 'w', base: 'W', light: 'b', glint: 'B' };

function wallPair(seed: number, tones: typeof STONE) {
  return { top: one(rockTile(seed, 'top', tones)), front: one(rockTile(seed + 1, 'front', tones)) };
}

/** Speckles granite with pale feldspar. */
function speckle(rows: Frame, seed: number, char = 'l'): Frame {
  return rows.map((row, y) => [...row].map((c, x) => (hash01(x, y, seed) > 0.93 && c !== 'k' ? char : c)).join(''));
}

const graniteTop = speckle(rockTile(61, 'top', GRANITE), 63, '6');
const graniteFront = speckle(rockTile(62, 'front', GRANITE), 64, '4');

/** Ore nuggets scattered as small clusters, drawn over a wall face. */
function oreOverlay(seed: number, dark: string, base: string, light: string): Frame {
  const centers = [0, 1, 2].map((i) => [2 + Math.floor(hash01(i, 0, seed) * 11), 2 + Math.floor(hash01(i, 1, seed) * 11)]);
  return generate((x, y) => {
    for (const [cx, cy] of centers) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx === 0 && dy === 0) return light;
      if (Math.abs(dx) + Math.abs(dy) === 1) return base;
      if (dx === 1 && dy === 1) return dark;
    }
    return '.';
  });
}

const BRICK_TOP = `
  4444444444444444
  4555555545555555
  4555555545555555
  3333333333333333
  5554555555545555
  5554555555545555
  3333333333333333
  4444444544444445
  4555555545555555
  3333333333333333
  5554555555545555
  5554555555545555
  3333333333333333
  4444444544444445
  4555555545555555
  3333333333333333`;

const BRICK_FRONT = `
  5555555555555555
  4444444434444444
  3333333323333333
  2222222222222222
  4443444444434444
  3332333333323333
  2222222222222222
  4444444434444444
  3333333323333333
  2222222222222222
  4443444444434444
  3332333333323333
  2222222222222222
  1111111111111111
  1111111111111111
  kkkkkkkkkkkkkkkk`;

// ------------------------------------------------------------- vegetation ---

const PINE = `
  .......kk.......
  ......kGGk......
  .....kGhHGk.....
  .....kGGhGk.....
  ....kGhHGGGk....
  ....kGGGhHGk....
  ...kGhHGGGGGk...
  ...kGGGGhHGGk...
  ..kGhHGGGGGhGk..
  ..kgGGGGhHGGGk..
  .kgGGhHGGGGGGGk.
  .kggGGGGGGGgggk.
  ..kkggggggggkk..
  ......kwWk......
  ......kwWk......
  .....kkwWkk.....`;

const OAK = `
  .....kkkkkk.....
  ...kkGhHhGGkk...
  ..kGhHjHGGhHGk..
  .kGhHHhGGhHjHGk.
  .kGGhGGGGGhHhGk.
  kGhHGGhHGGGGGGGk
  kGGGGhHjHGGhHGGk
  kgGGGGhhGGGhHGgk
  .kgGGGGGGGGGGgk.
  .kggGgGGGgGggk..
  ..kkggkggkggkk..
  .....kkWbkk.....
  ......kWbk......
  ......kWbk......
  .....kWWbbk.....
  ....kkkkkkkk....`;

const BERRY_BUSH = `
  ................
  ................
  ................
  ................
  ......kkkk......
  ....kkGhHGkk....
  ...kGhHGhRGGk...
  ..kGRhGGHGhGGk..
  ..kGhGGRhGGRGk..
  .kGGhHGGGhHGGGk.
  .kGRGGhGRGGhRGk.
  .kgGGhHGGGGGGgk.
  ..kggGGgGGgggk..
  ...kkkggggkkk...
  ......kkkk......
  ................`;

const FERN = `
  ................
  ................
  ................
  ................
  ................
  .......k........
  ..k...kHk...k...
  .kHk..kHk..kHk..
  ..kHk.kHk.kHk...
  ...kHkGHkkHk....
  .kk.kHGHGHk.kk..
  kHHkkGHhHGkkHHk.
  .kGHHGhhhGHHGk..
  ..kkGGhhhGGkk...
  ....kkggggk.....
  ................`;

// ------------------------------------------------------------ structures ---

const DOOR = `
  kkkkkkkkkkkkkkkk
  k44kkkkkkkkkk44k
  k3kwWWbWWbWWwk3k
  k3kwWbBWWbBWwk3k
  k3kwWbWWWbWWwk3k
  k3kvvvvvvvvvvk3k
  k3kwWbWWWbWWwk3k
  k3kwWbWWWbWWwk3k
  k3kwWbWWaabWwk3k
  k3kwWbWWadbWwk3k
  k3kwWbWWWbWWwk3k
  k3kvvvvvvvvvvk3k
  k3kwWbWWWbWWwk3k
  k3kwWbWWWbWWwk3k
  k2kwwwwwwwwwwk2k
  kkkkkkkkkkkkkkkk`;

const BED = `
  ................
  ..kkkkkkkkkkkk..
  ..kWbbbbbbbbWk..
  ..kWkkkkkkkkWk..
  ..kWkllllllkWk..
  ..kWklLLLLlkWk..
  ..kWkkkkkkkkWk..
  ..kWkPmmmmPkWk..
  ..kWkmMmmmmkWk..
  ..kWkPmmmMmkWk..
  ..kWkmmmmmmkWk..
  ..kWkPmMmmPkWk..
  ..kWkPPPPPPkWk..
  ..kWkkkkkkkkWk..
  ..kwWk....kWwk..
  ..kkkk....kkkk..`;

const TRAP = `
  ................
  ..kkkkkkkkkkkk..
  ..k3333333333k..
  ..k3k4k4k4k43k..
  ..k34k4k4k4k3k..
  ..k3k4k4k4k43k..
  ..k34k4k4k4k3k..
  ..k3k4k4k4k43k..
  ..k34k4k4k4k3k..
  ..k3k4k4k4k43k..
  ..k34k4k4k4k3k..
  ..k3333333333k..
  ..kkVkkkkkkVkk..
  ...kik....kik...
  ....k......k....
  ................`;

const STAIRS = `
  kkkkkkkkkkkkkkkk
  k66666666666666k
  k55555555555555k
  k33333333333333k
  kkkkkkkkkkkkkkkk
  k3k5555555555k3k
  k3k4444444444k3k
  k2k2222222222k2k
  k2kkkkkkkkkkkk2k
  k2k3k555555k3k2k
  k1k3k444444k3k1k
  k1k2k222222k2k1k
  k1k2kkkkkkkk2k1k
  k1k1k2kKKk2k1k1k
  k1k1k1kkkk1k1k1k
  kkkkkkkkkkkkkkkk`;

const STOCKPILE_MARK = `
  aa............aa
  a..............a
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  a..............a
  aa............aa`;

const CRATE = `
  ................
  ................
  ................
  ................
  ................
  ....kkkkkkkk....
  ....kBBBBBBk....
  ....kbWbbWbk....
  ....kbbWWbbk....
  ....kbWbbWbk....
  ....kbbbbbbk....
  ....kWWWWWWk....
  ....kkkkkkkk....
  ................
  ................
  ................`;

const SACKS = `
  ................
  ................
  ................
  ................
  ................
  ................
  ......kkk.......
  .....kSlSk.kkk..
  ....kSSSSskSlSk.
  ....kSsSSskSSssk
  ...kkSsssskSssSk
  ..kSlSkssk.kssk.
  ..kSSSsk..kkkk..
  ..kssssk........
  ...kkkk.........
  ................`;

const BARREL = `
  ................
  ................
  ................
  ................
  ................
  ......kkkk......
  .....kWbbWk.....
  .....kvvvvk.....
  .....kWbbWk.....
  .....kWbbWk.....
  .....kvvvvk.....
  .....kWbbWk.....
  ......kkkk......
  ................
  ................
  ................`;

const FARM = `
  wWWwwWWwwWWwwWWw
  WbbWWbbWWbbWWbbW
  wWWwwWWwwWWwwWWw
  ..kk....kk....kk
  .kRRk..kRRk..kRR
  kRMRRkkRMRRkkRMR
  .klk....klk....k
  wWlWwWWwWlWwWWwW
  WbbWWbbWWbbWWbbW
  wWWwwWWwwWWwwWWw
  ....kk....kk....
  ...kRRk..kRRk...
  ..kRMRRkkRMRRk..
  ...klk....klk...
  wWWlWWwwWWlWWwwW
  WbbWWbbWWbbWWbbW`;

const MASON = `
  ................
  ................
  .kkkkkkkkkkkkkk.
  .k666666666666k.
  .k655555555556k.
  .kkkkkkkkkkkkkk.
  .kWbkk...kkWbk..
  .kWbk4kkkk4kbk..
  .kWbk555555kbk..
  .kWbk544445kbk..
  .kWbk533335kbk..
  .kWbkkkkkkkkbk..
  .kWbk.kVk...bk..
  .kwwk.kiVk.wwk..
  .kkkk..kvVkkkk..
  ........kk......`;

const CARPENTER = `
  ................
  ..kkkkkkkkkkkk..
  ..kBBBBBBBBBBk..
  ..kbbbbbbbbbbk..
  ..kkkkkkkkkkkk..
  ..kWk.kVVVk.Wk..
  ..kWk.kViVk.Wk..
  ..kWkkkvvvkkWk..
  ..kWk..kWk..Wk..
  ..kwk..kWk..wk..
  ..kkk..kkk..kk..
  .kkkkkkkkkkk....
  .kbBbBbBbBbbk...
  .kWWWWWWWWWWk...
  ..kkkkkkkkkk....
  ................`;

function still(frame: number): Frame {
  const bubbles = [
    ['................', '......M.........'],
    ['.....M..........', '................'],
    ['......L.........', '.....M..........'],
  ][frame];
  return [
    ...bubbles,
    '....kkkkk.......',
    '...kTttttk......',
    '..kTttTttTk.kk..',
    '..kttttttttkTk..',
    '..kTtttttttkTk..',
    '..ktTttttTtkTk..',
    '..kkkkkkkkkkTk..',
    '..kmmMmmmmmkTk..',
    '..kmMmmmmMmkTk..',
    '..kmmmmMmmmkkk..',
    '..kfFfFfFfFk....',
    '..keffeffefk....',
    '..kkkkkkkkkk....',
    '..k1k....k1k....',
  ];
}

function furnace(frame: number): Frame {
  const flame = [
    ['..F.f.', '.fFfFf', 'fFyFFe'],
    ['.f.F..', '.FfFyf', 'efFyFF'],
    ['...f.F', '.fyFfF', 'fFFyfe'],
  ][frame];
  return [
    '....kkkkkkkk....',
    '....k333333k....',
    '....k322223k....',
    '..kkkkkkkkkkkk..',
    '..k4444444444k..',
    '..k4kkkkkkkk4k..',
    `..k3k${flame[0]}k3k..`,
    `..k3k${flame[1]}k3k..`,
    `..k3k${flame[2]}k3k..`,
    '..k3keeeeeek3k..',
    '..k3kkkkkkkk3k..',
    '..k5555555555k..',
    '..k4343434343k..',
    '..k3434343434k..',
    '..kkkkkkkkkkkk..',
    '................',
  ];
}

function forge(frame: number): Frame {
  const glow = ['fFf', 'FyF', 'fFe'][frame];
  const spark = ['..y.....', '.....y..', '...y..y.'][frame];
  return [
    `${spark}........`,
    '................',
    '..kkkkkk........',
    '..k3333k........',
    `..k3${glow}3k.kkkkk.`,
    '..k3eee3k.kViiVk',
    '.kk33333kkvvVVvk',
    '.k5555555kkkvvkk',
    '.k4444444k..kvk.',
    '.k3333333k.kkvkk',
    '.kkkkkkkkk.kvvvk',
    '...........kkkkk',
    '................',
    '................',
    '................',
    '................',
  ];
}

function altar(frame: number): Frame {
  const r = ['m', 'M', 'L'][frame];
  return [
    '......kkkk......',
    '.....k5555k.....',
    '....k566665k....',
    `....k5${r}55${r}5k....`,
    `....k55${r}${r}55k....`,
    `....k5${r}55${r}5k....`,
    `....k555${r}55k....`,
    `....k55${r}555k....`,
    '....k555555k....',
    '...kk444444kk...',
    '..k5555555555k..',
    '..k4444444444k..',
    '.k555555555555k.',
    '.k333333333333k.',
    '.kkkkkkkkkkkkkk.',
    '................',
  ];
}

function relic(frame: number): Frame {
  const glints = [
    ['.....A..........', '..........A.....'],
    ['...........A....', '...A............'],
    ['........A.......', '............A...'],
    ['................', '....A...........'],
  ][frame];
  return [
    ...glints,
    '.......kk.......',
    '......kcCk......',
    '.....kcCLCk.....',
    '....kcCcCcck....',
    '....kOcCcOck....',
    '.....kOccOk.....',
    '......kOOk......',
    '.......kk.......',
    '......kaak......',
    '.....kDaaDk.....',
    '....kdDDDDdk....',
    '...k55555555k...',
    '..k4444444444k..',
    '..kkkkkkkkkkkk..',
  ];
}

const TAVERN = `
  ................
  .kkkk...........
  kWbbWk..........
  kvvvvk...kk.kk..
  kWbbWk..klLklLk.
  kWbbWk..kaakaak.
  kvvvvk..kDDkDDk.
  kWbbWk...kk.kk..
  .kkkk...........
  ..kkkkkkkkkkkkk.
  ..kBBBBBBBBBBBk.
  ..kbbbbbbbbbbbk.
  ..kkkkkkkkkkkkk.
  ...kWk.....kWk..
  ...kwk.....kwk..
  ...kkk.....kkk..`;

const DEPOT = `
  ..kkkkkkkkkkkk..
  .kRlRlRlRlRlRlk.
  kRlRlRlRlRlRlRlk
  kkkkkkkkkkkkkkkk
  .kWk........kWk.
  .kWk........kWk.
  .kWk.kkkkkk.kWk.
  .kWk.kaAaak.kWk.
  .kWk.kDaaDk.kWk.
  .kWkkkkkkkkkkWk.
  .kBBBBBBBBBBBBk.
  .kbbbbbbbbbbbbk.
  .kkkkkkkkkkkkkk.
  .kkkk.kkkk.kkkk.
  .kWbk.kbWk.kWbk.
  .kkkk.kkkk.kkkk.`;

// -------------------------------------------------------------- helpers ---

/** Like art() but for frames assembled with string interpolation. */
function art2(text: string): Frame {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const onFloor = (rows: Frame, seed = 11) => overlay(floorTile(seed), rows);
const onGrass = (rows: Frame, seed = 1) => overlay(grassTile(seed), rows);

/** Winter recolor for vegetation drawn over snow. */
const FROST: Record<string, string> = { G: 'V', g: 'v', h: 'i', H: 'C', j: 'L', R: 'R' };

export const TERRAIN_SPRITES = {
  fog_0: one(FOG[0]),
  fog_1: one(FOG[1]),
  void: one(VOID),
  grass_0: one(GRASS[0]),
  grass_1: one(GRASS[1]),
  grass_2: one(GRASS[2]),
  grass_3: one(GRASS[3]),
  snow_0: one(SNOW[0]),
  snow_1: one(SNOW[1]),
  floor_0: one(FLOOR[0]),
  floor_1: one(FLOOR[1]),
  floor_2: one(FLOOR[2]),
  sand_0: one(SAND[0]),
  sand_1: one(SAND[1]),
  water: many([0, 1, 2, 3].map((f) => waterFrame(f)), 280),
  ice: one(recolor(waterFrame(0), { N: 'c', o: 'C', O: 'L' })),
  magma: many([0, 1, 2, 3].map((f) => magmaFrame(f)), 240),

  rock_top: wallPair(71, STONE).top,
  rock_front: wallPair(71, STONE).front,
  limestone_top: wallPair(81, LIMESTONE).top,
  limestone_front: wallPair(81, LIMESTONE).front,
  granite_top: one(graniteTop),
  granite_front: one(graniteFront),
  soil_top: wallPair(91, EARTH).top,
  soil_front: wallPair(91, EARTH).front,
  brick_top: sprite(T, T, [BRICK_TOP]),
  brick_front: sprite(T, T, [BRICK_FRONT]),

  ore_iron: one(oreOverlay(101, 'r', 'z', 'e')),
  ore_copper: one(oreOverlay(102, 't', 'f', 'T')),
  ore_gold: one(oreOverlay(103, 'd', 'D', 'A')),
  ore_mithril: many([oreOverlay(104, 'O', 'c', 'C'), oreOverlay(104, 'O', 'c', 'L'), oreOverlay(104, 'O', 'C', 'L')], 360),

  tree_pine: one(onGrass(art2(PINE), 2)),
  tree_oak: one(onGrass(art2(OAK), 3)),
  tree_pine_snow: one(overlay(SNOW[0], recolor(art2(PINE), FROST))),
  tree_oak_snow: one(overlay(SNOW[1], recolor(art2(OAK), FROST))),
  shrub_berry: one(onGrass(art2(BERRY_BUSH), 4)),
  shrub_fern: one(onGrass(art2(FERN), 1)),
  shrub_snow: one(overlay(SNOW[0], recolor(art2(BERRY_BUSH), FROST))),

  door: one(onFloor(art2(DOOR))),
  bed: one(onFloor(art2(BED), 12)),
  trap: one(onFloor(art2(TRAP), 13)),
  stairs: one(art2(STAIRS)),
  stockpile_0: one(onFloor(overlay(art2(STOCKPILE_MARK), art2(CRATE)), 11)),
  stockpile_1: one(onFloor(overlay(art2(STOCKPILE_MARK), art2(SACKS)), 12)),
  stockpile_2: one(onFloor(overlay(art2(STOCKPILE_MARK), art2(BARREL)), 13)),
  farm: one(art2(FARM)),
  mason: one(onFloor(art2(MASON))),
  carpenter: one(onFloor(art2(CARPENTER), 12)),
  still: many([0, 1, 2].map((f) => onFloor(still(f), 13)), 300),
  smelter: many([0, 1, 2].map((f) => onFloor(furnace(f))), 150),
  forge: many([0, 1, 2].map((f) => onFloor(forge(f), 12)), 170),
  tavern: one(onFloor(art2(TAVERN), 13)),
  temple: many([0, 1, 2, 1].map((f) => onFloor(altar(f))), 420),
  depot: one(onFloor(art2(DEPOT), 12)),
  relic: many([0, 1, 2, 3].map((f) => onFloor(relic(f), 13)), 200),
} satisfies Record<string, SpriteDef>;
