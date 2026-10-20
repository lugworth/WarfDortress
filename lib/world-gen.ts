import type {
  Biome,
  Civilization,
  DwarfEntity,
  GeologicalStratum,
  HistoricalEvent,
  HostileEntity,
  Tile,
  TileTerrain,
  WorldData,
} from './types.ts';

export type SurfaceArchetype =
  | 'TWIN_RIVERS_CONFLUENCE'
  | 'SUNKEN_CALDERA_CRATER'
  | 'WINDING_CANYON_GORGE'
  | 'GLACIAL_LAKELAND_PASS'
  | 'BADLANDS_OASIS_MESA'
  | 'COASTAL_FJORD_HEADLAND';

export interface SurfaceArchetypeMeta {
  id: SurfaceArchetype;
  label: string;
  desc: string;
}

const ARCHETYPES: SurfaceArchetypeMeta[] = [
  {
    id: 'TWIN_RIVERS_CONFLUENCE',
    label: 'Twin-River Confluence & Crags',
    desc: 'Forked mountain rivers converge in a timbered valley flanked by jagged iron-rich peaks.',
  },
  {
    id: 'SUNKEN_CALDERA_CRATER',
    label: 'Volcanic Caldera & Obsidian Rim',
    desc: 'A broken ring of basalt, gold, and iron crags encircles a steaming crater lake and lava vents.',
  },
  {
    id: 'WINDING_CANYON_GORGE',
    label: 'Shattered Canyon & Twin Mesas',
    desc: 'A winding river gorge slices between two towering mineral-veined mountain plateaus.',
  },
  {
    id: 'GLACIAL_LAKELAND_PASS',
    label: 'Highland Lakeland & Alpine Pass',
    desc: 'Glacial tarns and pine forests nestle beneath a sweeping granite and copper mountain range.',
  },
  {
    id: 'BADLANDS_OASIS_MESA',
    label: 'Red-Rock Badlands & Oasis',
    desc: 'Scattered ore-bearing mesas and arid dunes surround a fertile spring-fed emerald oasis.',
  },
  {
    id: 'COASTAL_FJORD_HEADLAND',
    label: 'Deep-Water Fjord & Mountain Spine',
    desc: 'A jagged coastal fjord with rocky islets meets a sheer cliff spine rich in iron and gold.',
  },
];

// Deterministic PRNG (Mulberry32)
export function createPRNG(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function generateRandomWorldSeed(): string {
  const prefixes = [
    'Khazad',
    'Moria',
    'Barak',
    'Obsidian',
    'Mithril',
    'Karaz',
    'Gilded',
    'Brimstone',
    'Grimhold',
    'Thundrak',
    'Zul-Anvil',
    'Durngar',
  ];
  const suffixes = [
    'Peak',
    'Varr',
    'Delve',
    'Crag',
    'Forge',
    'Vault',
    'Gate',
    'Spire',
    'Basin',
    'Fjord',
    'Canyon',
    'Caldera',
  ];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const s = suffixes[Math.floor(Math.random() * suffixes.length)];
  const num = Math.floor(100 + Math.random() * 899);
  return `${p}-${s}-${num}`;
}

export function getSurfaceArchetype(seedStr: string): SurfaceArchetypeMeta {
  const rand = createPRNG(seedStr + '-archetype');
  const idx = Math.floor(rand() * ARCHETYPES.length);
  return ARCHETYPES[idx];
}

// 2D Value Noise for organic elevation, moisture, and temperature maps
export function valueNoise2D(x: number, y: number, seedOffset: number): number {
  const hash = (ix: number, iy: number) => {
    let n = ix * 374761393 + iy * 668265263 + seedOffset * 1442695041;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967296;
  };

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = x - x0;
  const sy = y - y0;

  const u = sx * sx * (3 - 2 * sx);
  const v = sy * sy * (3 - 2 * sy);

  const n00 = hash(x0, y0);
  const n10 = hash(x0 + 1, y0);
  const n01 = hash(x0, y0 + 1);
  const n11 = hash(x0 + 1, y0 + 1);

  const nx0 = n00 * (1 - u) + n10 * u;
  const nx1 = n01 * (1 - u) + n11 * u;
  return nx0 * (1 - v) + nx1 * v;
}

export function fbm2D(x: number, y: number, seedNum: number, octaves = 3): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise2D(x * frequency, y * frequency, seedNum + i * 97);
    maxVal += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxVal;
}

export function classifyBiome(elevation: number, moisture: number, temperature: number): Biome {
  if (elevation < 0.22) return 'DEEP_OCEAN';
  if (elevation < 0.30) return 'COASTAL_WATER';
  if (elevation > 0.80) return temperature > 0.65 ? 'VOLCANIC' : 'MOUNTAINS';
  if (elevation > 0.66) return 'MOUNTAINS';
  if (moisture > 0.68 && elevation < 0.42) return 'MARSH';
  if (moisture < 0.33 && temperature > 0.55) return 'DESERT';
  if (moisture > 0.48) return 'FOREST';
  return 'PLAINS';
}

export function getTerrainVisuals(terrain: TileTerrain): {
  char: string;
  fg: string;
  bg: string;
  walkable: boolean;
} {
  switch (terrain) {
    case 'EMPTY_AIR':
      return { char: '·', fg: '#202020', bg: '#000000', walkable: false };
    case 'WATER':
      return { char: '≈', fg: '#00ffff', bg: '#000000', walkable: false };
    case 'GRASS':
      return { char: '.', fg: '#33ff00', bg: '#000000', walkable: true };
    case 'TREE':
      return { char: '♠', fg: '#33ff00', bg: '#101010', walkable: false };
    case 'SHRUB':
      return { char: '"', fg: '#33ff00', bg: '#000000', walkable: true };
    case 'SAND':
      return { char: '∙', fg: '#ff0099', bg: '#101010', walkable: true };
    case 'SOIL':
      return { char: '░', fg: '#ff9900', bg: '#101010', walkable: false };
    case 'ROCK_WALL':
      return { char: '▓', fg: '#d0d0d0', bg: '#101010', walkable: false };
    case 'LIMESTONE_WALL':
      return { char: '▒', fg: '#e0e0e0', bg: '#101010', walkable: false };
    case 'GRANITE_WALL':
      return { char: '█', fg: '#808080', bg: '#000000', walkable: false };
    case 'IRON_VEIN':
      return { char: '£', fg: '#ff9900', bg: '#101010', walkable: false };
    case 'COPPER_VEIN':
      return { char: '¢', fg: '#ff9900', bg: '#101010', walkable: false };
    case 'GOLD_VEIN':
      return { char: '$', fg: '#ff0099', bg: '#101010', walkable: false };
    case 'MITHRIL_VEIN':
      return { char: '*', fg: '#00ffff', bg: '#101010', walkable: false };
    case 'MAGMA':
      return { char: '≈', fg: '#ff0000', bg: '#101010', walkable: false };
    case 'ROCK_FLOOR':
      return { char: '·', fg: '#808080', bg: '#000000', walkable: true };
    case 'CONSTRUCTED_WALL':
      return { char: '#', fg: '#ffffff', bg: '#202020', walkable: false };
    case 'DOOR':
      return { char: '+', fg: '#ff0099', bg: '#101010', walkable: true };
    case 'BED':
      return { char: '⌂', fg: '#ff9900', bg: '#101010', walkable: true };
    case 'WORKSHOP_MASON':
      return { char: 'M', fg: '#d0d0d0', bg: '#202020', walkable: true };
    case 'WORKSHOP_CARPENTER':
      return { char: 'C', fg: '#ff9900', bg: '#202020', walkable: true };
    case 'WORKSHOP_STILL':
      return { char: 'S', fg: '#cc00ff', bg: '#202020', walkable: true };
    case 'WORKSHOP_SMELTER':
      return { char: '£', fg: '#ff9900', bg: '#202020', walkable: true };
    case 'WORKSHOP_FORGE':
      return { char: '⚒', fg: '#00ffff', bg: '#202020', walkable: true };
    case 'TAVERN_HALL':
      return { char: '♫', fg: '#ff0099', bg: '#202020', walkable: true };
    case 'TEMPLE_ALTAR':
      return { char: 'Ψ', fg: '#cc00ff', bg: '#202020', walkable: true };
    case 'TRADE_DEPOT':
      return { char: '¤', fg: '#00ffff', bg: '#202020', walkable: true };
    case 'TRAP_STONE':
      return { char: '^', fg: '#ff9900', bg: '#101010', walkable: true };
    case 'CAVERN_RELIC':
      return { char: '☼', fg: '#ff0099', bg: '#202020', walkable: true };
    case 'FARM_PLOT':
      return { char: '≈', fg: '#33ff00', bg: '#101010', walkable: true };
    case 'STAIRS_UP_DOWN':
      return { char: 'X', fg: '#ff0099', bg: '#101010', walkable: true };
    case 'STOCKPILE_TILE':
      return { char: '≡', fg: '#0066ff', bg: '#101010', walkable: true };
  }
}

const DWARVEN_PREFIXES = [
  'Khaz',
  'Kar',
  'Barak',
  'Zul',
  'Moria',
  'Durn',
  'Grim',
  'Brim',
  'Thun',
  'Krag',
  'Varr',
  'Azag',
  'Balin',
  'Tor',
];
const DWARVEN_SUFFIXES = [
  'dum',
  'gar',
  'hold',
  'anvil',
  'deep',
  'peak',
  'forge',
  'vault',
  'helm',
  'stone',
  'gate',
  'crag',
  'spire',
  'delve',
];
const REALM_ADJECTIVES = [
  'Shattered',
  'Gilded',
  'Obsidian',
  'Ashen',
  'Eternal',
  'Ironbound',
  'Runed',
  'Crystalline',
  'Stormcarved',
  'Sunken',
  'Frostbitten',
  'Emberlit',
];
const REALM_NOUNS = [
  'Expanse',
  'Reaches',
  'Basin',
  'Crags',
  'Dominion',
  'Spine',
  'Marches',
  'Caldera',
  'Highlands',
  'Fjords',
];

export function generateDeterministicWorldMeta(
  seedStr: string,
  width = 76,
  height = 42,
  depth = 6
): WorldData {
  const rand = createPRNG(seedStr);
  const seedNum = Math.floor(rand() * 100000);
  const archetype = getSurfaceArchetype(seedStr);

  const prefix = DWARVEN_PREFIXES[Math.floor(rand() * DWARVEN_PREFIXES.length)];
  const suffix = DWARVEN_SUFFIXES[Math.floor(rand() * DWARVEN_SUFFIXES.length)];
  const adj = REALM_ADJECTIVES[Math.floor(rand() * REALM_ADJECTIVES.length)];
  const noun = REALM_NOUNS[Math.floor(rand() * REALM_NOUNS.length)];

  const dwarvenName = `${prefix}-${suffix}`;
  const name = `The ${adj} ${noun} of ${dwarvenName}`;

  const biomeSummary: Record<Biome, number> = {
    DEEP_OCEAN: 0,
    COASTAL_WATER: 0,
    MARSH: 0,
    PLAINS: 0,
    FOREST: 0,
    DESERT: 0,
    MOUNTAINS: 0,
    VOLCANIC: 0,
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const elev = fbm2D(x * 0.08, y * 0.08, seedNum);
      const moist = fbm2D(x * 0.09, y * 0.09, seedNum + 333);
      const temp = fbm2D(x * 0.07, y * 0.07, seedNum + 777);
      const b = classifyBiome(elev, moist, temp);
      biomeSummary[b]++;
    }
  }

  const civilizations: Civilization[] = [
    {
      id: 'civ-dwarves',
      name: `The Mountainhome of ${dwarvenName}`,
      race: 'Dwarves',
      stance: 'Allied',
      ruler: 'King Urist Ironbrow VII',
      capital: { x: Math.floor(width * 0.65), y: Math.floor(height * 0.35) },
      specialty: 'Masterwork Steel & Runed Masonry',
    },
    {
      id: 'civ-elves',
      name: 'The Emerald Canopy of Luth-bel',
      race: 'Elves',
      stance: rand() > 0.4 ? 'Neutral' : 'Trade Partner',
      ruler: 'Druid-Queen Saelin Starleaf',
      capital: { x: Math.floor(width * 0.25), y: Math.floor(height * 0.6) },
      specialty: 'Sun-Berries & Living Timber Crafts',
    },
    {
      id: 'civ-humans',
      name: 'The Free Guilds of Oakhaven',
      race: 'Humans',
      stance: 'Trade Partner',
      ruler: 'High Chancellor Vane',
      capital: { x: Math.floor(width * 0.45), y: Math.floor(height * 0.75) },
      specialty: 'Grain Caravans & Mercenary Pikes',
    },
    {
      id: 'civ-goblins',
      name: 'The Fang Scourge of Skargash',
      race: 'Goblins',
      stance: 'Hostile',
      ruler: 'Warlord Snagtooth the Cruel',
      capital: { x: Math.floor(width * 0.8), y: Math.floor(height * 0.8) },
      specialty: 'Subterranean Raids & Iron Siege Pikes',
    },
  ];

  const strata: GeologicalStratum[] = [
    {
      zLevel: 0,
      name: `Surface: ${archetype.label}`,
      primaryRock: 'Alluvial Loam & Granite Outcrops',
      ores: ['Bog Iron', 'Native Copper'],
      hazard: 'Seasonal Frost & Surface Raiders',
    },
    {
      zLevel: 1,
      name: 'Upper Sedimentary Shelf',
      primaryRock: 'Dolomite & Banded Limestone',
      ores: ['Hematite (Iron)', 'Malachite (Copper)'],
      hazard: 'Damp Seepage Pockets',
    },
    {
      zLevel: 2,
      name: 'Metamorphic Schist Belt',
      primaryRock: 'Mica Schist & White Marble',
      ores: ['Magnetite (Iron)', 'Native Gold'],
      hazard: 'Unstable Fault Fractures',
    },
    {
      zLevel: 3,
      name: 'Upper Caverns of Echoing Dripstone',
      primaryRock: 'Basalt & Fungal Silt',
      ores: ['Gold Veins', 'Cassiterite'],
      hazard: 'Blind Cave Spiders & Giant Tower-Caps',
    },
    {
      zLevel: 4,
      name: 'Plutonic Gabbro & Granite Core',
      primaryRock: 'Black Gabbro & Diorite',
      ores: ['Rich Gold Seams', 'Raw Mithril Threads'],
      hazard: 'Geothermal Venting',
    },
    {
      zLevel: 5,
      name: 'The Magma Sea & Adamantine Roots',
      primaryRock: 'Obsidian Crust & Molten Magma',
      ores: ['Star-Mithril', 'Native Platinum'],
      hazard: 'Pressurized Magma Chambers',
    },
  ];

  const history: HistoricalEvent[] = [
    {
      year: 1,
      era: 'Age of Myth',
      title: `Shaping of the ${adj} ${noun}`,
      description: `The titan-forges cooled beneath ${dwarvenName}, leaving rich seams of hematite, gold, and star-mithril braided through six subterranean strata.`,
      category: 'FOUNDING',
    },
    {
      year: 84,
      era: 'Age of Myth',
      title: 'The Delving of the First Hall',
      description: `Ancestors of The Mountainhome of ${dwarvenName} struck the first great anvil in the upper dolomite shelf, establishing the Code of Pick and Pint.`,
      category: 'DISCOVERY',
    },
    {
      year: 149,
      era: 'Age of Stone',
      title: 'The Timber Treaty of Luth-bel',
      description: `Emissaries from ${civilizations[1].name} and ${civilizations[0].name} signed a tense border accord over surface logging in the central valleys.`,
      category: 'WAR',
    },
    {
      year: 212,
      era: 'Age of Stone',
      title: 'Forging of the Sun-Pick "Kogan-Ur"',
      description: `Master smith Morul Hammerhand entered a fey mood and forged a runed mithril pickaxe said to part solid granite like warm tallow.`,
      category: 'ARTIFACT',
    },
    {
      year: 250,
      era: 'Age of Anvils',
      title: 'The Charter of the Seven Pioneers',
      description: `King Urist Ironbrow VII commissioned a seven-dwarf expedition to strike the earth in the ${archetype.label} of ${name}.`,
      category: 'FOUNDING',
    },
  ];

  const backstory = `${archetype.desc} Carved by ancient glaciers and underlined by a restless magma sea, ${name} stands at the crossroads of four great civilizations. In the Year 251 of the Age of Anvils, seven hardy dwarven pioneers have arrived with a wagon of supplies and an ironclad charter: Strike the Earth!`;

  return {
    id: `world-${seedStr.toLowerCase().replace(/[^a-z0-9]/g, '') || 'default'}`,
    name,
    dwarvenName,
    seed: seedStr,
    width,
    height,
    depth,
    backstory,
    history,
    civilizations,
    strata,
    biomeSummary,
  };
}

function pickMountainTerrain(oreNoise: number, elev: number, rand: () => number): TileTerrain {
  if (oreNoise > 0.73) return 'IRON_VEIN';
  if (oreNoise < 0.19) return 'COPPER_VEIN';
  if (oreNoise > 0.495 && oreNoise < 0.51 && rand() < 0.4) return 'GOLD_VEIN';
  if (elev > 0.62) return 'GRANITE_WALL';
  if (elev < 0.45) return 'LIMESTONE_WALL';
  return 'ROCK_WALL';
}

export function generateMultiLevelGrid(world: WorldData): Tile[][][] {
  const rand = createPRNG(world.seed);
  const seedNum = Math.floor(rand() * 100000);
  const { width, height, depth } = world;
  const archetype = getSurfaceArchetype(world.seed).id;

  // Randomize orientation & domain-warp parameters per seed so no two maps look alike
  const flipX = rand() > 0.5;
  const flipY = rand() > 0.5;
  const riverPhase = rand() * Math.PI * 2;
  const riverPhase2 = rand() * Math.PI * 2;
  const mesaCount = 5 + Math.floor(rand() * 4);
  const mesas: Array<{ x: number; y: number; rx: number; ry: number }> = [];
  for (let i = 0; i < mesaCount; i++) {
    mesas.push({
      x: Math.floor(6 + rand() * (width - 12)),
      y: Math.floor(5 + rand() * (height - 10)),
      rx: 4 + rand() * 6,
      ry: 3 + rand() * 5,
    });
  }

  const grid: Tile[][][] = [];
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  for (let z = 0; z < depth; z++) {
    const level: Tile[][] = [];
    for (let y = 0; y < height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < width; x++) {
        const sx = flipX ? width - 1 - x : x;
        const sy = flipY ? height - 1 - y : y;

        // Domain warping for organic, non-rectangular landforms
        const warpX = sx + (fbm2D(sx * 0.07, sy * 0.07, seedNum + 101) - 0.5) * 9;
        const warpY = sy + (fbm2D(sx * 0.07, sy * 0.07, seedNum + 202) - 0.5) * 7;

        const elev = fbm2D(warpX * 0.065, warpY * 0.065, seedNum + z * 131);
        const moist = fbm2D(warpX * 0.08, warpY * 0.08, seedNum + 333 + z * 71);
        const temp = fbm2D(warpX * 0.06, warpY * 0.06, seedNum + 777);
        const oreNoise = fbm2D(x * 0.21, y * 0.21, seedNum + z * 509 + 999);

        const biome = classifyBiome(elev, moist, temp);
        let terrain: TileTerrain = 'ROCK_WALL';
        let revealed = z === 0;

        const distFromEmbark = Math.hypot(x - centerX, y - centerY);

        if (z === 0) {
          if (distFromEmbark < 4.4) {
            terrain = distFromEmbark < 2.3 ? 'ROCK_FLOOR' : rand() < 0.18 ? 'SHRUB' : 'GRASS';
          } else {
            switch (archetype) {
              case 'TWIN_RIVERS_CONFLUENCE': {
                const r1 = width * 0.22 + Math.sin(sy * 0.16 + riverPhase) * 5.5 + (sy / height) * 10;
                const r2 =
                  width * 0.78 - Math.cos(sy * 0.14 + riverPhase2) * 5.0 - ((height - sy) / height) * 12;
                const isRiver1 = Math.abs(warpX - r1) < 1.5;
                const isRiver2 = sy < height * 0.65 && Math.abs(warpX - r2) < 1.35;
                const cornerDist1 = Math.hypot(sx - width * 0.86, sy - height * 0.2);
                const cornerDist2 = Math.hypot(sx - width * 0.82, sy - height * 0.82);
                const isMountain =
                  elev + (sx / width) * 0.28 > 0.68 || cornerDist1 < 11 + elev * 6 || cornerDist2 < 10 + elev * 6;

                if (isRiver1 || isRiver2) terrain = 'WATER';
                else if (Math.abs(warpX - r1) < 2.5 || (sy < height * 0.65 && Math.abs(warpX - r2) < 2.3))
                  terrain = rand() < 0.4 ? 'SHRUB' : 'SAND';
                else if (isMountain) terrain = pickMountainTerrain(oreNoise, elev, rand);
                else if (moist > 0.44 && rand() < 0.36) terrain = 'TREE';
                else if (rand() < 0.16) terrain = 'SHRUB';
                else terrain = 'GRASS';
                break;
              }

              case 'SUNKEN_CALDERA_CRATER': {
                const normDist = Math.hypot((warpX - centerX) / (width * 0.44), (warpY - centerY) / (height * 0.44));
                const lakeX = centerX - 11;
                const lakeY = centerY + 3;
                const lakeDist = Math.hypot((warpX - lakeX) / 6.5, (warpY - lakeY) / 4.5);

                if (lakeDist < 1.0) {
                  terrain = 'WATER';
                } else if (lakeDist < 1.28) {
                  terrain = rand() < 0.45 ? 'SHRUB' : 'SAND';
                } else if (normDist > 0.72 + (elev - 0.5) * 0.35) {
                  // Outer volcanic caldera rim with occasional surface magma vents!
                  if (normDist > 0.98 && oreNoise > 0.74) terrain = 'MAGMA';
                  else terrain = pickMountainTerrain(oreNoise, elev, rand);
                } else if (moist > 0.45 && rand() < 0.3) {
                  terrain = 'TREE';
                } else if (rand() < 0.18) {
                  terrain = 'SHRUB';
                } else {
                  terrain = 'GRASS';
                }
                break;
              }

              case 'WINDING_CANYON_GORGE': {
                // Diagonal winding canyon with river in the center and twin mountain plateaus on both sides
                const canyonCenterY =
                  height * 0.5 +
                  ((warpX - width * 0.5) / width) * (height * 0.45) +
                  Math.sin(warpX * 0.15 + riverPhase) * 4.5;
                const distFromCanyon = Math.abs(warpY - canyonCenterY);

                if (distFromCanyon < 1.35) {
                  terrain = 'WATER';
                } else if (distFromCanyon < 2.6) {
                  terrain = rand() < 0.4 ? 'SHRUB' : 'SAND';
                } else if (distFromCanyon > 8.5 + (elev - 0.5) * 6.0) {
                  terrain = pickMountainTerrain(oreNoise, elev, rand);
                } else if (moist > 0.42 && rand() < 0.35) {
                  terrain = 'TREE';
                } else if (rand() < 0.16) {
                  terrain = 'SHRUB';
                } else {
                  terrain = 'GRASS';
                }
                break;
              }

              case 'GLACIAL_LAKELAND_PASS': {
                const lakeNoise = fbm2D(warpX * 0.11, warpY * 0.11, seedNum + 613);
                const mountainWall =
                  warpY < height * 0.24 + (elev - 0.5) * 10 ||
                  warpX > width * 0.76 - (elev - 0.5) * 12;

                if (mountainWall) {
                  terrain = pickMountainTerrain(oreNoise, elev, rand);
                } else if (lakeNoise > 0.65 && distFromEmbark > 6.5) {
                  terrain = 'WATER';
                } else if (lakeNoise > 0.59 && distFromEmbark > 5.5) {
                  terrain = rand() < 0.5 ? 'SHRUB' : 'SAND';
                } else if (moist > 0.4 && rand() < 0.42) {
                  terrain = 'TREE';
                } else if (rand() < 0.18) {
                  terrain = 'SHRUB';
                } else {
                  terrain = 'GRASS';
                }
                break;
              }

              case 'BADLANDS_OASIS_MESA': {
                const oasisDist = Math.hypot((warpX - (centerX - 10)) / 7.5, (warpY - centerY) / 5.5);
                const inMesa = mesas.some(
                  (m) => Math.hypot((warpX - m.x) / m.rx, (warpY - m.y) / m.ry) < 1.0
                );

                if (oasisDist < 0.95) {
                  terrain = 'WATER';
                } else if (oasisDist < 1.55) {
                  terrain = rand() < 0.55 ? 'TREE' : 'SHRUB';
                } else if (inMesa || elev > 0.68) {
                  terrain = pickMountainTerrain(oreNoise, elev, rand);
                } else if (elev < 0.38) {
                  terrain = rand() < 0.1 ? 'SHRUB' : 'SAND';
                } else if (moist > 0.52 && rand() < 0.22) {
                  terrain = 'TREE';
                } else if (rand() < 0.14) {
                  terrain = 'SHRUB';
                } else {
                  terrain = rand() < 0.35 ? 'SAND' : 'GRASS';
                }
                break;
              }

              case 'COASTAL_FJORD_HEADLAND':
              default: {
                const fjordEdge = width * 0.24 + Math.sin(warpY * 0.18 + riverPhase) * 6.0;
                const mountainEdge = width * 0.68 + Math.cos(warpY * 0.15 + riverPhase2) * 5.5;

                if (warpX < fjordEdge) {
                  // Fjord water with occasional rocky islets
                  if (elev > 0.66) terrain = 'ROCK_WALL';
                  else terrain = 'WATER';
                } else if (warpX < fjordEdge + 2.2) {
                  terrain = rand() < 0.3 ? 'SHRUB' : 'SAND';
                } else if (warpX > mountainEdge || elev > 0.69) {
                  terrain = pickMountainTerrain(oreNoise, elev, rand);
                } else if (moist > 0.43 && rand() < 0.36) {
                  terrain = 'TREE';
                } else if (rand() < 0.16) {
                  terrain = 'SHRUB';
                } else {
                  terrain = 'GRASS';
                }
                break;
              }
            }
          }
        } else if (z === 1) {
          // Z=1: Soil, Limestone & Winding Subterranean Grottos
          const grottoNoise = fbm2D(warpX * 0.13, warpY * 0.13, seedNum + 1409);
          if (grottoNoise > 0.71) {
            terrain = rand() < 0.15 ? 'SHRUB' : 'ROCK_FLOOR';
            revealed = true;
          } else if (oreNoise > 0.7) {
            terrain = 'IRON_VEIN';
          } else if (oreNoise < 0.27) {
            terrain = 'COPPER_VEIN';
          } else if (elev < 0.48) {
            terrain = 'SOIL';
          } else {
            terrain = 'LIMESTONE_WALL';
          }
        } else if (z === 2 || z === 3) {
          // Z=2..3: Deep Fungal Caverns, Underground Lakes & Gold Veins
          const cavernNoise = fbm2D(warpX * 0.12, warpY * 0.12, seedNum + z * 1117);
          if (cavernNoise > 0.65) {
            if (cavernNoise > 0.76 && moist > 0.52) terrain = 'WATER';
            else if (z === 3 && rand() < 0.18) terrain = 'SHRUB';
            else terrain = 'ROCK_FLOOR';
            revealed = true;
          } else if (oreNoise > 0.74) {
            terrain = 'GOLD_VEIN';
          } else if (oreNoise < 0.26) {
            terrain = 'IRON_VEIN';
          } else {
            terrain = 'GRANITE_WALL';
          }
        } else {
          // Z=4..5: Pressurized Magma Rivers, Obsidian & Star-Mithril
          const magmaNoise = fbm2D(warpX * 0.11, warpY * 0.11, seedNum + z * 2229);
          if (magmaNoise > (z === depth - 1 ? 0.59 : 0.69)) {
            terrain = 'MAGMA';
            revealed = true;
          } else if (magmaNoise > 0.54 && z === depth - 1) {
            terrain = 'ROCK_FLOOR';
            revealed = true;
          } else if (oreNoise > 0.76) {
            terrain = 'MITHRIL_VEIN';
          } else if (oreNoise < 0.25) {
            terrain = 'GOLD_VEIN';
          } else {
            terrain = 'GRANITE_WALL';
          }
        }

        const vis = getTerrainVisuals(terrain);
        row.push({
          x,
          y,
          z,
          terrain,
          biome,
          char: vis.char,
          fg: vis.fg,
          bg: vis.bg,
          walkable: vis.walkable,
          revealed,
        });
      }
      level.push(row);
    }
    grid.push(level);
  }

  // Ensure an organic, mineral-rich crag spur sits just east of the embark camp (centerX + 5..9)
  // so immediate mining and quick-excavate orders always strike stone and iron/copper ore!
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = 5; dx <= 9; dx++) {
      const jitter = (rand() - 0.5) * 1.1;
      if (Math.hypot(dx - 7.0, dy) + jitter <= 2.9) {
        const ny = centerY + dy;
        const nx = centerX + dx;
        if (ny >= 1 && ny < height - 1 && nx >= 1 && nx < width - 1) {
          let cliffTerrain: TileTerrain = rand() > 0.45 ? 'GRANITE_WALL' : 'ROCK_WALL';
          if (dx === 6 && Math.abs(dy) <= 1) cliffTerrain = 'IRON_VEIN';
          else if (dx === 7 && dy === 0) cliffTerrain = 'IRON_VEIN';
          else if (rand() < 0.28) cliffTerrain = 'COPPER_VEIN';
          const vis = getTerrainVisuals(cliffTerrain);
          grid[0][ny][nx] = {
            ...grid[0][ny][nx],
            terrain: cliffTerrain,
            char: vis.char,
            fg: vis.fg,
            bg: vis.bg,
            walkable: false,
            revealed: true,
          };
        }
      }
    }
  }

  // Place an initial Up/Down staircase at the embark center connecting Z=0 and Z=1
  const stairVis = getTerrainVisuals('STAIRS_UP_DOWN');
  for (let z = 0; z <= 1; z++) {
    grid[z][centerY][centerX] = {
      ...grid[z][centerY][centerX],
      terrain: 'STAIRS_UP_DOWN',
      char: stairVis.char,
      fg: stairVis.fg,
      bg: stairVis.bg,
      walkable: true,
      revealed: true,
    };
    if (z === 1) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ny = centerY + dy;
          const nx = centerX + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            grid[1][ny][nx].revealed = true;
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
              const floorVis = getTerrainVisuals('ROCK_FLOOR');
              grid[1][ny][nx].terrain = 'ROCK_FLOOR';
              grid[1][ny][nx].char = floorVis.char;
              grid[1][ny][nx].fg = floorVis.fg;
              grid[1][ny][nx].bg = floorVis.bg;
              grid[1][ny][nx].walkable = true;
            }
          }
        }
      }
    }
  }

  // Place a 2x2 starting Stockpile next to the stairs on Z=0
  const stockVis = getTerrainVisuals('STOCKPILE_TILE');
  for (let dy = -1; dy <= 0; dy++) {
    for (let dx = -2; dx <= -1; dx++) {
      const t = grid[0][centerY + dy][centerX + dx];
      t.terrain = 'STOCKPILE_TILE';
      t.char = stockVis.char;
      t.fg = stockVis.fg;
      t.bg = stockVis.bg;
      t.walkable = true;
    }
  }

  // Place Ancient Subterranean Relics (☼) at seed-randomized cavern chambers on Z=3..5
  const relicVis = getTerrainVisuals('CAVERN_RELIC');
  for (let z = 3; z < depth; z++) {
    const rx = Math.max(5, Math.min(width - 6, Math.floor(6 + rand() * (width - 12))));
    const ry = Math.max(5, Math.min(height - 6, Math.floor(6 + rand() * (height - 12))));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const floorVis = getTerrainVisuals('ROCK_FLOOR');
        const cell = grid[z][ry + dy][rx + dx];
        cell.terrain = 'ROCK_FLOOR';
        cell.char = floorVis.char;
        cell.fg = floorVis.fg;
        cell.bg = floorVis.bg;
        cell.walkable = true;
        cell.revealed = true;
      }
    }
    const relicTile = grid[z][ry][rx];
    relicTile.terrain = 'CAVERN_RELIC';
    relicTile.char = relicVis.char;
    relicTile.fg = relicVis.fg;
    relicTile.bg = relicVis.bg;
    relicTile.walkable = true;
    relicTile.revealed = true;
  }

  return grid;
}

export function createInitialCavernHostiles(
  width: number,
  height: number,
  seedStr = 'default'
): HostileEntity[] {
  const rand = createPRNG(seedStr + '-hostiles');
  const randX = () => Math.max(5, Math.min(width - 6, Math.floor(6 + rand() * (width - 12))));
  const randY = () => Math.max(5, Math.min(height - 6, Math.floor(5 + rand() * (height - 10))));

  return [
    {
      id: 'beast-spider-z3',
      name: 'Silk-Fang Cavern Spider',
      kind: 'CAVE_SPIDER',
      char: 's',
      color: '#cc00ff',
      x: randX(),
      y: randY(),
      z: 3,
      hp: 45,
      maxHp: 45,
      attack: 7,
      behavior: 'CAVERN_GUARD',
    },
    {
      id: 'beast-stalker-z3',
      name: 'Blind Grotto Arachnid',
      kind: 'CAVE_SPIDER',
      char: 's',
      color: '#ff0099',
      x: randX(),
      y: randY(),
      z: 3,
      hp: 40,
      maxHp: 40,
      attack: 6,
      behavior: 'CAVERN_GUARD',
    },
    {
      id: 'beast-crab-z4',
      name: 'Basalt-Shell Magma Crab',
      kind: 'MAGMA_CRAB',
      char: 'c',
      color: '#ff0000',
      x: randX(),
      y: randY(),
      z: 4,
      hp: 65,
      maxHp: 65,
      attack: 10,
      behavior: 'CAVERN_GUARD',
    },
  ];
}

export function createInitialDwarves(centerX: number, centerY: number): DwarfEntity[] {
  const roster: Array<{
    name: string;
    title: string;
    color: string;
    dx: number;
    dy: number;
    labors: DwarfEntity['labors'];
    thought: string;
    weaponEquipped?: boolean;
    armorEquipped?: boolean;
  }> = [
    {
      name: 'Urist McPick',
      title: 'Expedition Leader & Master Miner',
      color: '#ff0099',
      dx: 1,
      dy: 0,
      labors: {
        MINING: true,
        WOODCUTTING: false,
        MASONRY: true,
        CARPENTRY: false,
        FARMING: false,
        SMITHING: true,
        COMBAT: true,
        HAULING: true,
      },
      thought: 'Eager to strike rich iron veins in the nearby cliff face.',
      weaponEquipped: true,
    },
    {
      name: 'Zulban Oakcleaver',
      title: 'Forester & Carpenter',
      color: '#33ff00',
      dx: -1,
      dy: 1,
      labors: {
        MINING: false,
        WOODCUTTING: true,
        MASONRY: false,
        CARPENTRY: true,
        FARMING: false,
        SMITHING: false,
        COMBAT: false,
        HAULING: true,
      },
      thought: 'Admired a fine cedar tree this morning.',
    },
    {
      name: 'Mebzuth Stonehand',
      title: 'Deep Delver & Mason',
      color: '#00ffff',
      dx: 2,
      dy: -1,
      labors: {
        MINING: true,
        WOODCUTTING: false,
        MASONRY: true,
        CARPENTRY: false,
        FARMING: false,
        SMITHING: false,
        COMBAT: false,
        HAULING: true,
      },
      thought: 'Wants to carve a grand dining hall underground.',
    },
    {
      name: 'Datan Alebelly',
      title: 'Master Brewer & Planter',
      color: '#cc00ff',
      dx: 0,
      dy: 2,
      labors: {
        MINING: false,
        WOODCUTTING: false,
        MASONRY: false,
        CARPENTRY: false,
        FARMING: true,
        SMITHING: false,
        COMBAT: false,
        HAULING: true,
      },
      thought: 'Dreaming of a bubbling still of Plump Helmet Ale.',
    },
    {
      name: 'Fath Copperbeard',
      title: 'Metalsmith & Prospector',
      color: '#ff9900',
      dx: 1,
      dy: 1,
      labors: {
        MINING: true,
        WOODCUTTING: false,
        MASONRY: false,
        CARPENTRY: false,
        FARMING: false,
        SMITHING: true,
        COMBAT: false,
        HAULING: true,
      },
      thought: 'The scent of hematite and hot forge-coals fills me with resolve.',
    },
    {
      name: 'Iden Timberwright',
      title: 'Architect & Woodcutter',
      color: '#e0e0e0',
      dx: -2,
      dy: 1,
      labors: {
        MINING: false,
        WOODCUTTING: true,
        MASONRY: true,
        CARPENTRY: true,
        FARMING: false,
        SMITHING: false,
        COMBAT: false,
        HAULING: true,
      },
      thought: 'Every fortress needs sturdy beds and stone doors.',
    },
    {
      name: 'Kogan Ironshield',
      title: 'Militia Captain & Warden',
      color: '#d0d0d0',
      dx: 0,
      dy: -2,
      labors: {
        MINING: true,
        WOODCUTTING: true,
        MASONRY: false,
        CARPENTRY: false,
        FARMING: false,
        SMITHING: true,
        COMBAT: true,
        HAULING: true,
      },
      thought: 'My battleaxe is honed and ready to guard the mountain gate.',
      weaponEquipped: true,
      armorEquipped: true,
    },
  ];

  return roster.map((r, idx) => ({
    id: `dwarf-${idx + 1}`,
    name: r.name,
    title: r.title,
    char: '☺',
    color: r.color,
    x: centerX + r.dx,
    y: centerY + r.dy,
    z: 0,
    hp: 100,
    maxHp: 100,
    hunger: 88 - idx * 3,
    thirst: 85 - idx * 2,
    energy: 92 - idx * 2,
    happiness: 85,
    state: 'IDLE',
    labors: r.labors,
    thought: r.thought,
    weaponEquipped: r.weaponEquipped || false,
    armorEquipped: r.armorEquipped || false,
    kills: 0,
    skills: {
      MINING: r.labors.MINING ? 2 : 0,
      WOODCUTTING: r.labors.WOODCUTTING ? 2 : 0,
      MASONRY: r.labors.MASONRY ? 2 : 0,
      CARPENTRY: r.labors.CARPENTRY ? 2 : 0,
      FARMING: r.labors.FARMING ? 2 : 0,
      SMITHING: r.labors.SMITHING ? 2 : 0,
      COMBAT: r.labors.COMBAT ? 2 : 0,
      HAULING: 1,
    },
  }));
}
