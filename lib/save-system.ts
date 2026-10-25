import type { Biome, DesignationType, GameState, Tile, TileTerrain } from './types.ts';
import { initializeGuild, validGuildState } from './guild.ts';
import { initializeActivities, validActivities } from './activities.ts';
import { createInitialGameState } from './game-engine.ts';
import { getTerrainVisuals } from './world-gen.ts';
import { MAX_POPULATION, MAX_SEED_LENGTH, RESOURCE_KEYS, validResourceMap } from './game-rules.ts';

export const LOCAL_SAVE_KEY = 'ascii_fortress_autosave';
export const BACKUP_SAVE_KEY = `${LOCAL_SAVE_KEY}_backup`;
export const SAVE_VERSION = 2;
// Append only: these indices are part of the version-1 on-disk format.
const TERRAINS: TileTerrain[] = ['EMPTY_AIR', 'WATER', 'GRASS', 'TREE', 'SHRUB', 'SAND', 'SOIL', 'ROCK_WALL', 'LIMESTONE_WALL', 'GRANITE_WALL', 'IRON_VEIN', 'COPPER_VEIN', 'GOLD_VEIN', 'MITHRIL_VEIN', 'MAGMA', 'ROCK_FLOOR', 'CONSTRUCTED_WALL', 'DOOR', 'BED', 'WORKSHOP_MASON', 'WORKSHOP_CARPENTER', 'WORKSHOP_STILL', 'WORKSHOP_SMELTER', 'WORKSHOP_FORGE', 'TAVERN_HALL', 'TEMPLE_ALTAR', 'TRADE_DEPOT', 'TRAP_STONE', 'CAVERN_RELIC', 'FARM_PLOT', 'STAIRS_UP_DOWN', 'STOCKPILE_TILE'];
const BIOMES: Biome[] = ['DEEP_OCEAN', 'COASTAL_WATER', 'MARSH', 'PLAINS', 'FOREST', 'DESERT', 'MOUNTAINS', 'VOLCANIC'];
const DESIGNATIONS: DesignationType[] = ['MINE', 'CHOP', 'GATHER', 'STAIRS', 'STOCKPILE', 'RECLAIM_RELIC', 'BUILD_WALL', 'BUILD_DOOR', 'BUILD_TRAP', 'BUILD_BED', 'BUILD_MASON', 'BUILD_CARPENTER', 'BUILD_STILL', 'BUILD_SMELTER', 'BUILD_FORGE', 'BUILD_TAVERN', 'BUILD_TEMPLE', 'BUILD_DEPOT', 'BUILD_FARM', 'CANCEL'];
const SEASONS = ['Granite (Spring)', 'Slate (Summer)', 'Sands (Autumn)', 'Timber (Winter)'];
const LABORS = ['MINING', 'WOODCUTTING', 'MASONRY', 'CARPENTRY', 'FARMING', 'SMITHING', 'COMBAT', 'HAULING'] as const;
function check(condition: unknown, message = 'Invalid or damaged fortress save.'): asserts condition {
  if (!condition) throw new Error(message);
}
function coordinate(p: { x: number; y: number; z: number }) {
  return Number.isInteger(p.x) && p.x >= 0 && p.x < 76 && Number.isInteger(p.y) && p.y >= 0 && p.y < 42 && Number.isInteger(p.z) && p.z >= 0 && p.z < 6;
}

function validResourceDrop(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const drop = value as Record<string, unknown>;
  return typeof drop.type === 'string' &&
    RESOURCE_KEYS.includes(drop.type as keyof GameState['resources']) &&
    validResourceMap({ [drop.type]: drop.amount }) &&
    Object.keys(drop).every((key) => key === 'type' || key === 'amount');
}

export function validateGameState(state: GameState): GameState {
  check(state && typeof state === 'object' && typeof state.id === 'string');
  check(state.world && typeof state.world.seed === 'string' && state.world.seed.length <= MAX_SEED_LENGTH);
  check(typeof state.world.name === 'string' && typeof state.world.dwarvenName === 'string' && typeof state.world.backstory === 'string');
  check(state.world.width === 76 && state.world.height === 42 && state.world.depth === 6);
  check(Array.isArray(state.world.history) && state.world.history.every((e) => e && typeof e.title === 'string' && typeof e.description === 'string' && Number.isSafeInteger(e.year) && ['Age of Myth', 'Age of Stone', 'Age of Anvils'].includes(e.era) && ['FOUNDING', 'WAR', 'ARTIFACT', 'BEAST', 'DISCOVERY'].includes(e.category)));
  check(Array.isArray(state.world.civilizations) && state.world.civilizations.length === 4 && state.world.civilizations.every((c) => c && typeof c.name === 'string' && typeof c.ruler === 'string' && typeof c.specialty === 'string' && ['Dwarves', 'Elves', 'Humans', 'Goblins'].includes(c.race) && ['Allied', 'Trade Partner', 'Neutral', 'Hostile'].includes(c.stance)));
  check(Array.isArray(state.world.strata) && state.world.strata.length === 6 && state.world.strata.every((s, z) => s.zLevel === z && typeof s.name === 'string' && typeof s.primaryRock === 'string' && Array.isArray(s.ores) && s.ores.every((ore) => typeof ore === 'string')));
  check(Number.isSafeInteger(state.ticks) && state.ticks >= 0 && Number.isSafeInteger(state.year) && state.year >= 1 && SEASONS.includes(state.season));
  check(validResourceMap(state.resources) && RESOURCE_KEYS.every((k) => k in state.resources));
  check(Array.isArray(state.dwarves) && state.dwarves.length > 0 && state.dwarves.length <= MAX_POPULATION);
  check(new Set(state.dwarves.map((d) => d.id)).size === state.dwarves.length);
  for (const d of state.dwarves) {
    check(coordinate(d) && typeof d.id === 'string' && typeof d.name === 'string' && typeof d.title === 'string');
    check(['IDLE', 'MOVING', 'WORKING', 'EATING', 'DRINKING', 'SLEEPING', 'FIGHTING', 'PRAYING'].includes(d.state));
    check(d.labors && LABORS.every((k) => typeof d.labors[k] === 'boolean') && d.skills && Object.values(d.skills).every(Number.isFinite));
    check([d.hp, d.maxHp, d.hunger, d.thirst, d.energy, d.happiness].every((n) => Number.isFinite(n) && n >= 0 && n <= 100));
    if (d.currentTask) check(coordinate(d.currentTask) && DESIGNATIONS.includes(d.currentTask.type) && Number.isFinite(d.currentTask.progress) && Number.isFinite(d.currentTask.totalTicks));
  }
  check(Array.isArray(state.hostiles) && state.hostiles.every((h) => coordinate(h) && Number.isFinite(h.hp) && Number.isFinite(h.attack)));
  check(Array.isArray(state.alerts) && state.alerts.every(coordinate));
  check(Array.isArray(state.workOrders) && state.workOrders.every((o) => typeof o.title === 'string' && ['WORKSHOP_MASON', 'WORKSHOP_CARPENTER', 'WORKSHOP_STILL', 'WORKSHOP_SMELTER', 'WORKSHOP_FORGE'].includes(o.workshop) && Number.isSafeInteger(o.remaining) && o.remaining >= 0 && validResourceMap(o.cost) && validResourceMap(o.produce)));
  check(Array.isArray(state.chronicle) && state.chronicle.every((e) => typeof e.text === 'string'));
  check(Array.isArray(state.eventHistory));
  for (const event of [state.activeEvent, ...state.eventHistory]) {
    if (!event) continue;
    check(['title', 'narrative', 'historicalConnection', 'asciiArt'].every((key) => typeof event[key as keyof typeof event] === 'string') && typeof event.title === 'string' && ['MINOR_OMEN', 'STRANGE_MOOD', 'TRADE_CARAVAN', 'DIPLOMATIC_ENVOY', 'MAJOR_CRISIS'].includes(event.severity) && Array.isArray(event.choices) && event.choices.length > 0);
    check(event.choices.every((c) => typeof c.id === 'string' && typeof c.label === 'string' && typeof c.description === 'string' && typeof c.outcomeLog === 'string' && (c.moraleDelta === undefined || (Number.isFinite(c.moraleDelta) && Math.abs(c.moraleDelta) <= 100)) && (!c.cost || validResourceMap(c.cost)) && (!c.reward || validResourceMap(c.reward)) && (c.spawnMigrants === undefined || (Number.isInteger(c.spawnMigrants) && c.spawnMigrants >= 0 && c.spawnMigrants <= 5))));
  }
  check(['DEFENSIVE', 'PATROL', 'SALLY_FORTH'].includes(state.militiaDoctrine) && typeof state.paused === 'boolean' && [1, 2, 4].includes(state.speed));
  check(Array.isArray(state.grid) && state.grid.length === 6);
  state.grid.forEach((level, z) => {
    check(Array.isArray(level) && level.length === 42);
    level.forEach((row, y) => {
      check(Array.isArray(row) && row.length === 76);
      row.forEach((t, x) => {
        check(t && t.x === x && t.y === y && t.z === z && TERRAINS.includes(t.terrain) && BIOMES.includes(t.biome) && typeof t.revealed === 'boolean' && (!t.designation || DESIGNATIONS.includes(t.designation)));
        check(t.resourceDrop === undefined || validResourceDrop(t.resourceDrop));
      });
    });
  });
  check(validGuildState(state), 'Invalid guild, relic, or dwarf story data.');
  check(validActivities(state), 'Invalid expedition, celebration, or research data.');
  return state;
}

export function serializeFortress(state: GameState): string {
  validateGameState(state);
  const { grid, ...data } = state;
  const cells = grid.flat(2).map((t) => [TERRAINS.indexOf(t.terrain), BIOMES.indexOf(t.biome), t.revealed ? 1 : 0, t.designation ? DESIGNATIONS.indexOf(t.designation) : -1, ...(t.resourceDrop ? [t.resourceDrop] : [])]);
  const serialized = JSON.stringify({ version: SAVE_VERSION, state: data, cells });
  check(new TextEncoder().encode(serialized).length < 900_000, 'Fortress save is too large. Export/archive older history before cloud saving.');
  return serialized;
}

export function deserializeFortress(text: string): GameState {
  check(typeof text === 'string' && text.length < 8_000_000);
  const raw = JSON.parse(text);
  // Migrate the full, unversioned local saves written by the original app.
  if (raw.version === undefined && raw.grid) { raw.id = `fort-${crypto.randomUUID()}`; return validateGameState(initializeActivities(initializeGuild(raw))); }
  check(raw.version === 1 || raw.version === SAVE_VERSION, 'This save uses an unsupported version.');
  check(raw.state && Array.isArray(raw.cells) && raw.cells.length === 76 * 42 * 6);
  const grid: Tile[][][] = Array.from({ length: 6 }, (_, z) => Array.from({ length: 42 }, (_, y) => Array.from({ length: 76 }, (_, x) => {
    const c = raw.cells[(z * 42 + y) * 76 + x];
    check(Array.isArray(c) && c.slice(0, 4).every(Number.isInteger) && c.length >= 4 && c.length <= 5 && TERRAINS[c[0]] && BIOMES[c[1]] && [0, 1].includes(c[2]) && (c[3] === -1 || DESIGNATIONS[c[3]]));
    check(c.length === 4 || validResourceDrop(c[4]));
    const terrain = TERRAINS[c[0]];
    return { x, y, z, terrain, biome: BIOMES[c[1]], ...getTerrainVisuals(terrain), revealed: c[2] === 1, ...(c[3] >= 0 ? { designation: DESIGNATIONS[c[3]] } : {}), ...(c[4] ? { resourceDrop: c[4] } : {}) };
  })));
  const restored = { ...raw.state, grid };
  return validateGameState(initializeActivities(raw.version === 1 ? initializeGuild(restored) : restored));
}

export function writeLocalSave(storage: Pick<Storage, 'getItem' | 'setItem'>, state: GameState) {
  const snapshot = serializeFortress(state);
  const old = storage.getItem(LOCAL_SAVE_KEY);
  if (old) { try { deserializeFortress(old); storage.setItem(BACKUP_SAVE_KEY, old); } catch { /* Preserve the existing good backup. */ } }
  storage.setItem(LOCAL_SAVE_KEY, snapshot);
}

export function readLocalSave(storage: Pick<Storage, 'getItem'>): GameState | null {
  let found = false;
  for (const key of [LOCAL_SAVE_KEY, BACKUP_SAVE_KEY]) {
    const text = storage.getItem(key);
    if (!text) continue;
    found = true;
    try { return deserializeFortress(text); } catch { /* Try the last known good save. */ }
  }
  if (found) throw new Error('Local save and backup could not be loaded.');
  return null;
}

export interface LegacySave { id: string; seed: string; ticks: number; year: number; season: string; resources: GameState['resources'] }
export function restoreCloudSave(save: LegacySave & { snapshot?: string }): GameState {
  if (save.snapshot) return deserializeFortress(save.snapshot);
  // Old cloud records never stored terrain/dwarves; only their summary is recoverable.
  const fresh = createInitialGameState(save.seed);
  return validateGameState(initializeGuild({ ...fresh, guild: undefined, ticks: save.ticks, year: save.year, season: save.season as GameState['season'], resources: { ...fresh.resources, ...save.resources } }));
}

export function cloudSavePath(uid: string, fortressId: string) {
  check(uid.length > 0 && !uid.includes('/') && /^[a-zA-Z0-9_-]{1,64}$/.test(fortressId));
  return `users/${uid}/saves/${fortressId}`;
}
