import type { DesignationType, FortressResources } from './types.ts';

export const MAX_POPULATION = 200;
export const MAX_SEED_LENGTH = 1024;
export const TRAP_DAMAGE = 40;
export const RESOURCE_KEYS: (keyof FortressResources)[] = ['stone', 'wood', 'ironOre', 'goldOre', 'steelBars', 'food', 'ale', 'furniture', 'weapons', 'armor', 'relics', 'wealth'];
export const TOOL_KEYS: Record<string, DesignationType> = {
  d: 'MINE', x: 'STAIRS', v: 'RECLAIM_RELIC', t: 'CHOP', g: 'GATHER',
  e: 'BUILD_SMELTER', r: 'BUILD_FORGE', h: 'BUILD_TAVERN', y: 'BUILD_TEMPLE',
  o: 'BUILD_DEPOT', z: 'BUILD_TRAP', w: 'BUILD_WALL', k: 'BUILD_DOOR', p: 'STOCKPILE',
  m: 'BUILD_FARM', s: 'BUILD_STILL', n: 'BUILD_MASON', c: 'BUILD_CARPENTER', b: 'BUILD_BED', q: 'CANCEL',
};

export function validResourceMap(value: unknown): value is Partial<FortressResources> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).every(([k, v]) => RESOURCE_KEYS.includes(k as keyof FortressResources) && Number.isSafeInteger(v) && v >= 0 && v <= 1e12);
}

export const EXPORT_VALUES = { stone: 2, furniture: 18, steelBars: 25, weapons: 40, armor: 45, goldOre: 35 };
export const IMPORT_VALUES = { food: 5, ale: 6, wood: 5, ironOre: 14, steelBars: 30 };
export function tradeValues(give: Partial<FortressResources>, receive: Partial<FortressResources>, recruit: boolean, depot: boolean) {
  const value = (items: Partial<FortressResources>, prices: Record<string, number>) => Object.entries(items).reduce((sum, [k, v]) => sum + (v || 0) * (prices[k] ?? 0), 0);
  return { offered: Math.floor(value(give, EXPORT_VALUES) * (depot ? 1.15 : 1)), requested: value(receive, IMPORT_VALUES) + (recruit ? 90 : 0) };
}
