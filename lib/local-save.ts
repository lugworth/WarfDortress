import type { GameState } from './types.ts';

export const LOCAL_SAVE_KEY = 'ascii_fortress_autosave';
export interface LocalSaveSummary { name: string; ticks: number; year: number; }

export function getLocalSaveSummary(state: GameState): LocalSaveSummary {
  return { name: state.world.dwarvenName, ticks: state.ticks, year: state.year };
}

// A versioned envelope leaves room for deliberate migrations as the simulation grows.
export function serializeLocalSave(state: GameState): string {
  return JSON.stringify({ version: 1, state });
}

export function parseLocalSave(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if ('version' in parsed && parsed.version !== 1) return null;
    // Accept saves written by the original Save button as well.
    const state = ('version' in parsed ? parsed.state : parsed) as GameState;
    if (!state || typeof state.id !== 'string' || !state.world ||
      typeof state.world.seed !== 'string' || typeof state.world.dwarvenName !== 'string' ||
      !Number.isSafeInteger(state.ticks) || state.ticks < 0 || !Number.isFinite(state.year) ||
      !['Granite (Spring)', 'Slate (Summer)', 'Sands (Autumn)', 'Timber (Winter)'].includes(state.season) ||
      ![1, 2, 4].includes(state.speed)) return null;
    const { width, height, depth } = state.world;
    if (![width, height, depth].every(n => Number.isSafeInteger(n) && n > 0) ||
      width > 256 || height > 256 || depth > 32 ||
      !Array.isArray(state.grid) || state.grid.length !== depth ||
      !state.grid.every((level, z) => Array.isArray(level) && level.length === height &&
        level.every((row, y) => Array.isArray(row) && row.length === width &&
          row.every((tile, x) => tile && tile.x === x && tile.y === y && tile.z === z &&
            typeof tile.terrain === 'string' && typeof tile.walkable === 'boolean' &&
            typeof tile.revealed === 'boolean')))) return null;
    const arrays = ['dwarves', 'hostiles', 'alerts', 'workOrders', 'chronicle', 'eventHistory'] as const;
    if (!arrays.every(key => Array.isArray(state[key])) || !state.resources ||
      !['stone', 'wood', 'ironOre', 'goldOre', 'steelBars', 'food', 'ale', 'furniture', 'weapons', 'armor', 'relics', 'wealth']
        .every(key => Number.isFinite(state.resources[key as keyof GameState['resources']]))) return null;
    if (!state.dwarves.every(d => d && typeof d.name === 'string' && d.labors && d.skills &&
      [d.x, d.y, d.z, d.hp, d.happiness].every(Number.isFinite)) ||
      !state.guild || !state.guild.favor ||
      !['commissions', 'relics', 'relationships'].every(key => Array.isArray(state.guild[key as keyof GameState['guild']])) ||
      !Array.isArray(state.world.strata) || !Array.isArray(state.world.history) ||
      !Array.isArray(state.world.civilizations)) return null;
    // A resumed game always gives the player time to orient before the clock runs.
    return { ...state, paused: true };
  } catch {
    return null;
  }
}
