import assert from 'node:assert/strict';
import test from 'node:test';
import type { DesignationType, HostileEntity, Tile, TileTerrain, WeatherConditionId } from '../types.ts';
import { dwarfSlots } from './appearance.ts';
import { PALETTE, SLOT_KEYS } from './palette.ts';
import { rasterize } from './raster.ts';
import { frameAt } from './sprite.ts';
import { SPRITES } from './sprites/index.ts';
import {
  DESIGNATION_SPRITE,
  dwarfAnimation,
  dwarfSpriteName,
  HOSTILE_SPRITE,
  tileSprites,
  type DwarfAnim,
} from './tiles.ts';

const TERRAINS: TileTerrain[] = [
  'EMPTY_AIR', 'WATER', 'GRASS', 'TREE', 'SHRUB', 'SAND', 'SOIL', 'ROCK_WALL', 'LIMESTONE_WALL', 'GRANITE_WALL',
  'IRON_VEIN', 'COPPER_VEIN', 'GOLD_VEIN', 'MITHRIL_VEIN', 'MAGMA', 'ROCK_FLOOR', 'CONSTRUCTED_WALL', 'DOOR', 'BED',
  'WORKSHOP_MASON', 'WORKSHOP_CARPENTER', 'WORKSHOP_STILL', 'WORKSHOP_SMELTER', 'WORKSHOP_FORGE', 'TAVERN_HALL',
  'TEMPLE_ALTAR', 'TRADE_DEPOT', 'TRAP_STONE', 'CAVERN_RELIC', 'FARM_PLOT', 'STAIRS_UP_DOWN', 'STOCKPILE_TILE',
];

const tile = (terrain: TileTerrain, x = 3, y = 4, z = 0, revealed = true): Tile => ({
  x, y, z, terrain, biome: 'PLAINS', char: '.', fg: '#fff', bg: '#000', walkable: true, revealed,
});

test('every sprite uses only palette or slot colors', () => {
  const allowed = new Set(['.', ...Object.keys(PALETTE), ...Object.values(SLOT_KEYS)]);
  for (const [name, def] of Object.entries(SPRITES)) {
    for (const frame of def.frames) {
      for (const row of frame) {
        for (const c of row) assert.ok(allowed.has(c), `${name} uses unknown color "${c}"`);
      }
    }
  }
});

test('every terrain, season, and wall face resolves to real sprites', () => {
  const weathers: (WeatherConditionId | undefined)[] = [undefined, 'SUMMER_SUN', 'WINTER_BLIZZARD'];
  for (const terrain of TERRAINS) {
    for (const weather of weathers) {
      for (const below of [undefined, tile('ROCK_FLOOR', 3, 5), tile('ROCK_WALL', 3, 5), tile('GRASS', 3, 5, 0, false)]) {
        for (const x of [0, 1, 2, 7, 13]) {
          const sprites = tileSprites(tile(terrain, x), below, weather);
          assert.ok(sprites.base in SPRITES, `${terrain} -> ${sprites.base}`);
          if (sprites.overlay) assert.ok(sprites.overlay in SPRITES, `${terrain} -> ${sprites.overlay}`);
        }
      }
    }
    assert.match(tileSprites(tile(terrain, 1, 1, 1, false), undefined).base, /^fog_/);
  }
  assert.equal(tileSprites(tile('ROCK_WALL'), tile('ROCK_FLOOR')).base, 'rock_front');
  assert.equal(tileSprites(tile('ROCK_WALL'), tile('GRANITE_WALL')).base, 'rock_top');
  assert.equal(tileSprites(tile('GOLD_VEIN'), undefined).overlay, 'ore_gold');
  assert.equal(tileSprites(tile('WATER'), undefined, 'WINTER_SNOW').base, 'ice');
  assert.equal(tileSprites(tile('WATER', 1, 1, 2), undefined, 'WINTER_SNOW').base, 'water', 'underground water never freezes');
});

test('creature and designation lookups point at real sprites', () => {
  const anims: DwarfAnim[] = ['idle', 'walk', 'mine', 'fight', 'drink', 'pray', 'sleep', 'rage', 'armed', 'armed_walk'];
  for (const anim of anims) for (const helm of [false, true]) assert.ok(dwarfSpriteName(anim, helm) in SPRITES, `${anim}/${helm}`);
  for (const state of ['IDLE', 'MOVING', 'WORKING', 'EATING', 'DRINKING', 'SLEEPING', 'FIGHTING', 'PRAYING', 'MENTAL_BREAK', 'INJURED', 'BRAWLING'])
    for (const armed of [false, true]) assert.ok(dwarfSpriteName(dwarfAnimation(state, armed, false), true) in SPRITES);
  for (const name of Object.values(HOSTILE_SPRITE)) assert.ok(name in SPRITES, name);
  for (const [type, name] of Object.entries(DESIGNATION_SPRITE)) assert.ok(name in SPRITES, `${type as DesignationType} -> ${name}`);
  const kinds: HostileEntity['kind'][] = ['GOBLIN_RAIDER', 'TROLL_BREAKER', 'CAVE_SPIDER', 'MAGMA_CRAB'];
  assert.deepEqual(Object.keys(HOSTILE_SPRITE).sort(), kinds.sort());
});

test('rasterizing honors slot colors and animation timing', () => {
  const def = SPRITES.dwarf_idle;
  const { slots } = dwarfSlots('dwarf-1');
  const pixels = rasterize(def.frames[0], slots);
  assert.equal(pixels.length, def.w * def.h * 4);
  assert.ok(pixels.some((v, i) => i % 4 === 3 && v === 255), 'sprite has opaque pixels');
  assert.notDeepEqual(dwarfSlots('dwarf-1'), dwarfSlots('dwarf-6'), 'dwarves are recolored individually');
  assert.deepEqual(dwarfSlots('dwarf-1'), dwarfSlots('dwarf-1'), 'colors are stable per dwarf');
  assert.equal(frameAt(SPRITES.water, 0), 0);
  assert.equal(frameAt(SPRITES.water, SPRITES.water.frameMs! * 5), 1);
  assert.equal(frameAt(SPRITES.door, 99999), 0, 'static sprites stay on frame 0');
});
