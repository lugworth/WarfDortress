import type { DesignationType, HostileEntity, Tile, TileTerrain, WeatherConditionId } from '../types.ts';
import { hash01 } from './procedural.ts';
import type { SpriteName } from './sprites/index.ts';

export interface TileSprites {
  base: SpriteName;
  overlay?: SpriteName;
}

const SOLID = new Set<TileTerrain>([
  'ROCK_WALL', 'LIMESTONE_WALL', 'GRANITE_WALL', 'SOIL', 'CONSTRUCTED_WALL',
  'IRON_VEIN', 'COPPER_VEIN', 'GOLD_VEIN', 'MITHRIL_VEIN',
]);

const ORE: Partial<Record<TileTerrain, SpriteName>> = {
  IRON_VEIN: 'ore_iron',
  COPPER_VEIN: 'ore_copper',
  GOLD_VEIN: 'ore_gold',
  MITHRIL_VEIN: 'ore_mithril',
};

const BUILDING: Partial<Record<TileTerrain, SpriteName>> = {
  DOOR: 'door',
  BED: 'bed',
  WORKSHOP_MASON: 'mason',
  WORKSHOP_CARPENTER: 'carpenter',
  WORKSHOP_STILL: 'still',
  WORKSHOP_SMELTER: 'smelter',
  WORKSHOP_FORGE: 'forge',
  TAVERN_HALL: 'tavern',
  TEMPLE_ALTAR: 'temple',
  TRADE_DEPOT: 'depot',
  TRAP_STONE: 'trap',
  CAVERN_RELIC: 'relic',
  FARM_PLOT: 'farm',
  STAIRS_UP_DOWN: 'stairs',
  MAGMA: 'magma',
  EMPTY_AIR: 'void',
};

export function isWinter(weather: WeatherConditionId | undefined): boolean {
  return weather === 'WINTER_SNOW' || weather === 'WINTER_BLIZZARD';
}

function variant(tile: Tile, count: number, salt = 0): number {
  return Math.floor(hash01(tile.x, tile.y, tile.z * 31 + salt) * count);
}

/**
 * Which sprites draw a tile. Walls show their dark south face when the tile
 * below is open ground, which gives the map its three-quarter depth.
 */
export function tileSprites(tile: Tile, below: Tile | undefined, weather?: WeatherConditionId): TileSprites {
  if (!tile.revealed) return { base: variant(tile, 2) ? 'fog_1' : 'fog_0' };
  const snow = tile.z === 0 && isWinter(weather);
  const t = tile.terrain;

  if (SOLID.has(t)) {
    const face = below && below.revealed && !SOLID.has(below.terrain) ? 'front' : 'top';
    const stone = t === 'SOIL' ? 'soil' : t === 'LIMESTONE_WALL' ? 'limestone' : t === 'GRANITE_WALL' ? 'granite' : t === 'CONSTRUCTED_WALL' ? 'brick' : 'rock';
    return { base: `${stone}_${face}` as SpriteName, overlay: ORE[t] };
  }
  const building = BUILDING[t];
  if (building) return { base: building };

  switch (t) {
    case 'WATER':
      return { base: snow ? 'ice' : 'water' };
    case 'GRASS':
      return { base: snow ? (variant(tile, 2) ? 'snow_1' : 'snow_0') : (`grass_${variant(tile, 4)}` as SpriteName) };
    case 'TREE': {
      const kind = variant(tile, 3, 7) === 0 ? 'oak' : 'pine';
      return { base: `tree_${kind}${snow ? '_snow' : ''}` as SpriteName };
    }
    case 'SHRUB':
      return { base: snow ? 'shrub_snow' : variant(tile, 2, 3) ? 'shrub_berry' : 'shrub_fern' };
    case 'SAND':
      return { base: snow ? 'snow_0' : variant(tile, 2) ? 'sand_1' : 'sand_0' };
    case 'STOCKPILE_TILE':
      return { base: `stockpile_${variant(tile, 3, 5)}` as SpriteName };
    case 'ROCK_FLOOR':
    default:
      return { base: `floor_${variant(tile, 3)}` as SpriteName };
  }
}

/** Sprites that animate in place; the renderer redraws these tiles every frame. */
export const ANIMATED_SPRITES = new Set<SpriteName>(['water', 'magma', 'still', 'smelter', 'forge', 'temple', 'relic', 'ore_mithril']);

/** Light emitted by a tile, as [radius in tiles, warm glow 0..1]. */
export function tileLight(terrain: TileTerrain): [number, number] | null {
  switch (terrain) {
    case 'MAGMA': return [3, 0.8];
    case 'WORKSHOP_FORGE':
    case 'WORKSHOP_SMELTER': return [4.5, 0.7];
    case 'TAVERN_HALL': return [4, 0.45];
    case 'TEMPLE_ALTAR': return [3.5, 0.2];
    case 'CAVERN_RELIC': return [2.5, 0.1];
    case 'WORKSHOP_STILL': return [2.5, 0.25];
    case 'STAIRS_UP_DOWN': return [2, 0];
    default: return null;
  }
}

export const HOSTILE_SPRITE: Record<HostileEntity['kind'], SpriteName> = {
  GOBLIN_RAIDER: 'goblin_walk',
  TROLL_BREAKER: 'troll_walk',
  CAVE_SPIDER: 'spider_walk',
  MAGMA_CRAB: 'crab_walk',
};

/** Icon drawn on a tile that carries a designation. Buildings preview their own sprite. */
export const DESIGNATION_SPRITE: Record<DesignationType, SpriteName> = {
  MINE: 'icon_mine',
  CHOP: 'icon_chop',
  GATHER: 'icon_gather',
  STAIRS: 'stairs',
  STOCKPILE: 'stockpile_0',
  RECLAIM_RELIC: 'icon_relic',
  BUILD_WALL: 'brick_top',
  BUILD_DOOR: 'door',
  BUILD_TRAP: 'trap',
  BUILD_BED: 'bed',
  BUILD_MASON: 'mason',
  BUILD_CARPENTER: 'carpenter',
  BUILD_STILL: 'still',
  BUILD_SMELTER: 'smelter',
  BUILD_FORGE: 'forge',
  BUILD_TAVERN: 'tavern',
  BUILD_TEMPLE: 'temple',
  BUILD_DEPOT: 'depot',
  BUILD_FARM: 'farm',
  MILITIA_STATION: 'icon_station',
  MILITIA_PATROL: 'icon_patrol',
  CANCEL: 'icon_cancel',
};

export type DwarfAnim = 'idle' | 'walk' | 'mine' | 'fight' | 'drink' | 'pray' | 'sleep' | 'rage' | 'armed' | 'armed_walk';

/** Animation for a dwarf's simulation state. */
export function dwarfAnimation(state: string, armed: boolean, moving: boolean): DwarfAnim {
  switch (state) {
    case 'WORKING': return 'mine';
    case 'FIGHTING': return 'fight';
    case 'DRINKING':
    case 'EATING': return 'drink';
    case 'PRAYING': return 'pray';
    case 'SLEEPING': return 'sleep';
    case 'MENTAL_BREAK':
    case 'BRAWLING': return 'rage';
    default:
      if (moving || state === 'MOVING') return armed ? 'armed_walk' : 'walk';
      return armed ? 'armed' : 'idle';
  }
}

export function dwarfSpriteName(anim: DwarfAnim, helmet: boolean): SpriteName {
  return `${helmet ? 'dwarf_helm' : 'dwarf'}_${anim}` as SpriteName;
}

/** One color per terrain for the minimap. */
export const MINIMAP_COLORS: Record<TileTerrain, string> = {
  EMPTY_AIR: '#0d0a12',
  WATER: '#2b6ea8',
  GRASS: '#4f9a45',
  TREE: '#2f6a3b',
  SHRUB: '#4f9a45',
  SAND: '#d9b679',
  SOIL: '#74452a',
  ROCK_WALL: '#524658',
  LIMESTONE_WALL: '#6e6172',
  GRANITE_WALL: '#3b3145',
  IRON_VEIN: '#e5533d',
  COPPER_VEIN: '#5fc4ad',
  GOLD_VEIN: '#f5c542',
  MITHRIL_VEIN: '#9ee3ff',
  MAGMA: '#ff8e3c',
  ROCK_FLOOR: '#3f3236',
  CONSTRUCTED_WALL: '#8f8191',
  DOOR: '#a06a3d',
  BED: '#9a55c9',
  WORKSHOP_MASON: '#d7a0ff',
  WORKSHOP_CARPENTER: '#d7a0ff',
  WORKSHOP_STILL: '#d7a0ff',
  WORKSHOP_SMELTER: '#d7a0ff',
  WORKSHOP_FORGE: '#d7a0ff',
  TAVERN_HALL: '#d7a0ff',
  TEMPLE_ALTAR: '#d7a0ff',
  TRADE_DEPOT: '#d7a0ff',
  TRAP_STONE: '#a82a2f',
  CAVERN_RELIC: '#e0fbff',
  FARM_PLOT: '#8fcf5c',
  STAIRS_UP_DOWN: '#f0d9a0',
  STOCKPILE_TILE: '#c88a1e',
};

/** Icon for the current surface weather. */
export function weatherIcon(id: WeatherConditionId): SpriteName {
  switch (id) {
    case 'SUMMER_SUN':
    case 'SPRING_THAW': return 'icon_sun';
    case 'SPRING_SHOWER':
    case 'AUTUMN_RAIN': return 'icon_rain';
    case 'SUMMER_SQUALL':
    case 'WINTER_BLIZZARD': return 'icon_storm';
    case 'AUTUMN_MIST': return 'icon_mist';
    case 'WINTER_SNOW': return 'icon_snow';
  }
}
