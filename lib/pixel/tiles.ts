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
