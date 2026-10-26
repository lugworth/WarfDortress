import type {
  DwarfEntity,
  GameState,
  Tile,
  TileTerrain,
  WeatherConditionId,
} from './types.ts';
import { appendDwarfThought } from './thoughts.ts';

export interface WeatherDescriptor {
  id: WeatherConditionId;
  season: GameState['season'];
  label: string;
  shortLabel: string;
  glyph: string;
  color: string;
  precipitation: 'NONE' | 'RAIN' | 'SNOW' | 'BLIZZARD';
  surfaceTempF: number;
  surfaceStepInterval: number; // 1 = full speed (100%), 2 = 50% speed (steps on even ticks), 3 = 33% speed
  surfaceSpeedPct: number;
  outdoorMoodDelta: number;
  shelteredMoodDelta: number;
  summary: string;
}

export interface WeatherTileVisual {
  char: string;
  fg: string;
  bg: string;
  particleChar: string | null;
  particleFg: string | null;
  weatherNote: string | null;
}

export const WEATHER_CATALOG: Record<WeatherConditionId, WeatherDescriptor> = {
  SPRING_THAW: {
    id: 'SPRING_THAW',
    season: 'Granite (Spring)',
    label: 'Vernal Mountain Thaw',
    shortLabel: 'THAW',
    glyph: '☼',
    color: '#33ff00',
    precipitation: 'NONE',
    surfaceTempF: 58,
    surfaceStepInterval: 1,
    surfaceSpeedPct: 100,
    outdoorMoodDelta: 2,
    shelteredMoodDelta: 1,
    summary: 'Crisp mountain air · 100% outdoor speed · +2 Mood on surface',
  },
  SPRING_SHOWER: {
    id: 'SPRING_SHOWER',
    season: 'Granite (Spring)',
    label: 'Vernal Spring Drizzle',
    shortLabel: 'DRIZZLE',
    glyph: '⋮',
    color: '#5bc0be',
    precipitation: 'RAIN',
    surfaceTempF: 51,
    surfaceStepInterval: 2,
    surfaceSpeedPct: 65,
    outdoorMoodDelta: -1,
    shelteredMoodDelta: 1,
    summary: 'Damp spring rain · Slows unpaved Z-0 movement · -1 Mood outdoors',
  },
  SUMMER_SUN: {
    id: 'SUMMER_SUN',
    season: 'Slate (Summer)',
    label: 'Radiant Anvil Sun',
    shortLabel: 'CLEAR',
    glyph: '☼',
    color: '#ff9900',
    precipitation: 'NONE',
    surfaceTempF: 74,
    surfaceStepInterval: 1,
    surfaceSpeedPct: 100,
    outdoorMoodDelta: 3,
    shelteredMoodDelta: 1,
    summary: 'Warm summer sun · 100% outdoor speed · +3 Mood on surface',
  },
  SUMMER_SQUALL: {
    id: 'SUMMER_SQUALL',
    season: 'Slate (Summer)',
    label: 'Thunderhead Ridge Squall',
    shortLabel: 'SQUALL',
    glyph: '⋮',
    color: '#00ffff',
    precipitation: 'RAIN',
    surfaceTempF: 64,
    surfaceStepInterval: 2,
    surfaceSpeedPct: 60,
    outdoorMoodDelta: -2,
    shelteredMoodDelta: 2,
    summary: 'Summer cloudburst · Muddy Z-0 turf slows movement · -2 Mood outdoors',
  },
  AUTUMN_RAIN: {
    id: 'AUTUMN_RAIN',
    season: 'Sands (Autumn)',
    label: 'Cold Felsite Downpour',
    shortLabel: 'RAIN',
    glyph: '⋮',
    color: '#5bc0be',
    precipitation: 'RAIN',
    surfaceTempF: 46,
    surfaceStepInterval: 2,
    surfaceSpeedPct: 55,
    outdoorMoodDelta: -3,
    shelteredMoodDelta: 2,
    summary: 'Heavy autumn rain & puddles · -45% outdoor Z-0 speed · -3 Mood outdoors',
  },
  AUTUMN_MIST: {
    id: 'AUTUMN_MIST',
    season: 'Sands (Autumn)',
    label: 'Amber Harvest Mist',
    shortLabel: 'MIST',
    glyph: '≈',
    color: '#ff9900',
    precipitation: 'NONE',
    surfaceTempF: 49,
    surfaceStepInterval: 1,
    surfaceSpeedPct: 100,
    outdoorMoodDelta: 1,
    shelteredMoodDelta: 1,
    summary: 'Cool harvest fog · Normal outdoor speed · Crisp autumn foliage',
  },
  WINTER_SNOW: {
    id: 'WINTER_SNOW',
    season: 'Timber (Winter)',
    label: 'Rime & Heavy Snowfall',
    shortLabel: 'SNOW',
    glyph: '❄',
    color: '#a8e6ff',
    precipitation: 'SNOW',
    surfaceTempF: 28,
    surfaceStepInterval: 2,
    surfaceSpeedPct: 50,
    outdoorMoodDelta: -4,
    shelteredMoodDelta: 3,
    summary: 'Snow-covered Z-0 tiles & frozen rivers · -50% outdoor speed · -4 Mood outdoors',
  },
  WINTER_BLIZZARD: {
    id: 'WINTER_BLIZZARD',
    season: 'Timber (Winter)',
    label: 'Howling Whiteout Blizzard',
    shortLabel: 'BLIZZARD',
    glyph: '❄',
    color: '#ffffff',
    precipitation: 'BLIZZARD',
    surfaceTempF: 14,
    surfaceStepInterval: 3,
    surfaceSpeedPct: 35,
    outdoorMoodDelta: -6,
    shelteredMoodDelta: 4,
    summary: 'Deep snowdrifts & freezing gale · -65% outdoor speed · -6 Mood outdoors',
  },
};

const PAVED_OR_INDOOR_TERRAINS = new Set<TileTerrain>([
  'ROCK_FLOOR',
  'STOCKPILE_TILE',
  'STAIRS_UP_DOWN',
  'CONSTRUCTED_WALL',
  'DOOR',
  'BED',
  'WORKSHOP_MASON',
  'WORKSHOP_CARPENTER',
  'WORKSHOP_STILL',
  'WORKSHOP_SMELTER',
  'WORKSHOP_FORGE',
  'TAVERN_HALL',
  'TEMPLE_ALTAR',
  'TRADE_DEPOT',
  'TRAP_STONE',
  'FARM_PLOT',
]);

export function isShelteredOrPavedTile(tile: Tile | undefined): boolean {
  if (!tile) return false;
  if (tile.z > 0) return true;
  return PAVED_OR_INDOOR_TERRAINS.has(tile.terrain);
}

/**
 * Resolves the active seasonal weather condition from `state.weatherOverride`
 * or deterministically from `state.season` and `state.ticks`.
 */
export function getCurrentWeather(
  state: Pick<GameState, 'season' | 'ticks' | 'weatherOverride'>
): WeatherDescriptor {
  if (state.weatherOverride && WEATHER_CATALOG[state.weatherOverride]) {
    return WEATHER_CATALOG[state.weatherOverride];
  }

  const phase = ((state.ticks % 120) + 120) % 120;
  const seasonLower = state.season.toLowerCase();

  if (seasonLower.includes('winter') || seasonLower.includes('timber') || seasonLower.includes('obsidian')) {
    if (phase >= 65 && phase < 95) {
      return WEATHER_CATALOG.WINTER_BLIZZARD;
    }
    return WEATHER_CATALOG.WINTER_SNOW;
  }

  if (seasonLower.includes('autumn') || seasonLower.includes('sands') || seasonLower.includes('felsite') || seasonLower.includes('malachite')) {
    if (phase >= 85 && phase < 105) {
      return WEATHER_CATALOG.AUTUMN_MIST;
    }
    return WEATHER_CATALOG.AUTUMN_RAIN;
  }

  if (seasonLower.includes('summer') || seasonLower.includes('slate') || seasonLower.includes('hematite')) {
    if (phase >= 75 && phase < 95) {
      return WEATHER_CATALOG.SUMMER_SQUALL;
    }
    return WEATHER_CATALOG.SUMMER_SUN;
  }

  // Default: Granite (Spring)
  if (phase >= 80 && phase < 98) {
    return WEATHER_CATALOG.SPRING_SHOWER;
  }
  return WEATHER_CATALOG.SPRING_THAW;
}

/**
 * Computes seasonal and weather-driven ASCII glyph, foreground/background color,
 * and precipitation particle overlays for a tile.
 * Subterranean Z-levels (z > 0) remain unaffected by surface weather.
 */
export function getWeatherTileVisuals(
  state: Pick<GameState, 'season' | 'ticks' | 'weatherOverride'>,
  tile: Tile
): WeatherTileVisual {
  const base: WeatherTileVisual = {
    char: tile.char,
    fg: tile.fg,
    bg: tile.bg,
    particleChar: null,
    particleFg: null,
    weatherNote: null,
  };

  if (tile.z !== 0 || !tile.revealed) {
    return base;
  }

  const weather = getCurrentWeather(state);
  const cellHash = Math.abs((tile.x * 37 + tile.y * 53) % 97);
  const animHash = Math.abs((tile.x * 19 + tile.y * 31 + state.ticks * 7) % 29);

  // 1. WINTER: Snow tiles, frosted conifers, frozen river ice, and drifting snow particles
  if (weather.id === 'WINTER_SNOW' || weather.id === 'WINTER_BLIZZARD') {
    const isBlizzard = weather.id === 'WINTER_BLIZZARD';
    switch (tile.terrain) {
      case 'GRASS':
        base.char = cellHash % 3 === 0 ? '*' : '·';
        base.fg = isBlizzard ? '#ffffff' : cellHash % 2 === 0 ? '#e0f7ff' : '#b8e6ff';
        base.bg = '#07131c';
        base.weatherNote = isBlizzard ? 'Deep Blizzard Drift' : 'Snow-Blanketed Turf';
        break;
      case 'SHRUB':
        base.char = '*';
        base.fg = '#9be7ff';
        base.bg = '#07131c';
        base.weatherNote = 'Frost-Rimed Scrub';
        break;
      case 'TREE':
        base.char = '▲';
        base.fg = cellHash % 2 === 0 ? '#d8f6ff' : '#8ce0ff';
        base.bg = '#061119';
        base.weatherNote = 'Snow-Laden Conifer';
        break;
      case 'WATER':
        base.char = '≡';
        base.fg = '#88eeff';
        base.bg = '#0b2232';
        base.weatherNote = 'Frozen River Ice';
        break;
      case 'SAND':
      case 'SOIL':
        base.char = '·';
        base.fg = '#b0d8ec';
        base.bg = '#07131c';
        base.weatherNote = 'Frozen Permafrost';
        break;
      case 'ROCK_WALL':
      case 'LIMESTONE_WALL':
      case 'GRANITE_WALL':
        base.bg = '#091520';
        base.weatherNote = 'Rime-Crusted Crag';
        break;
      default:
        break;
    }

    const snowThreshold = isBlizzard ? 5 : 2;
    if (animHash < snowThreshold) {
      base.particleChar = animHash % 2 === 0 ? '❄' : '*';
      base.particleFg = '#ffffff';
    }
    return base;
  }

  // 2. AUTUMN: Rain puddles, slick mud, amber/crimson autumn trees, and falling rain streaks
  if (weather.id === 'AUTUMN_RAIN' || weather.id === 'AUTUMN_MIST') {
    const isRain = weather.precipitation === 'RAIN';
    switch (tile.terrain) {
      case 'GRASS':
        if (isRain && cellHash % 4 === 0) {
          base.char = '~';
          base.fg = '#5bc0be';
          base.bg = '#05121a';
          base.weatherNote = 'Rain Puddle & Mud';
        } else {
          base.char = cellHash % 2 === 0 ? ',' : "'";
          base.fg = '#94a845';
          base.bg = '#060e12';
          base.weatherNote = isRain ? 'Rain-Slicked Meadow' : 'Dewy Autumn Turf';
        }
        break;
      case 'TREE':
        base.char = '♠';
        base.fg = cellHash % 3 === 0 ? '#ff6b35' : '#ff9900';
        base.bg = '#080c10';
        base.weatherNote = 'Amber Autumn Canopy';
        break;
      case 'SHRUB':
        base.char = '"';
        base.fg = '#e08e45';
        base.bg = '#060e12';
        base.weatherNote = 'Russet Berry Bramble';
        break;
      case 'SOIL':
      case 'SAND':
        if (isRain) {
          base.char = '~';
          base.fg = '#8a6d3b';
          base.bg = '#071014';
          base.weatherNote = 'Sodden Mire';
        }
        break;
      case 'WATER':
        base.char = '≈';
        base.fg = '#38d9ff';
        base.bg = '#061b28';
        base.weatherNote = isRain ? 'Rain-Swollen Current' : 'Misty River';
        break;
      default:
        break;
    }

    if (isRain && animHash < 4) {
      base.particleChar = animHash % 2 === 0 ? '/' : '⋮';
      base.particleFg = '#6dd5ed';
    }
    return base;
  }

  // 3. SPRING SHOWER / SUMMER SQUALL: Rain streaks and damp turf
  if (weather.precipitation === 'RAIN') {
    if (tile.terrain === 'GRASS' && cellHash % 5 === 0) {
      base.char = '~';
      base.fg = '#48b89f';
      base.weatherNote = 'Rain-Dampened Turf';
    }
    if (animHash < 3) {
      base.particleChar = '/';
      base.particleFg = '#5bc0be';
    }
    return base;
  }

  // 4. SUMMER SUN: Warm golden highlights on surface flora
  if (weather.id === 'SUMMER_SUN') {
    if (tile.terrain === 'GRASS') {
      base.fg = cellHash % 4 === 0 ? '#7fff00' : tile.fg;
      base.weatherNote = 'Sun-Warmed Meadow';
    } else if (tile.terrain === 'SHRUB' && cellHash % 3 === 0) {
      base.fg = '#ffdd44';
      base.weatherNote = 'Sunberry Blossom';
    }
    return base;
  }

  // 5. SPRING THAW: Default embark state with occasional vernal wildflowers
  if (tile.terrain === 'SHRUB' && cellHash % 4 === 0) {
    base.weatherNote = 'Vernal Mountain Flora';
  }
  return base;
}

/**
 * Determines whether a dwarf can advance a movement tile on the current tick.
 * Outdoor unpaved tiles on Z-0 slow down movement during Rain, Snow, or Blizzard.
 * Underground tiles (Z >= 1) and paved/indoor floors move at full normal speed.
 */
export function canDwarfStepThisTick(
  dwarf: DwarfEntity,
  state: Pick<GameState, 'season' | 'ticks' | 'weatherOverride'>,
  currentTile: Tile | undefined,
  nextTicks: number
): boolean {
  if (dwarf.z > 0) return true;
  if (isShelteredOrPavedTile(currentTile)) return true;

  const weather = getCurrentWeather(state);
  if (weather.surfaceStepInterval <= 1) return true;

  // Iron-Born dwarves shrug off ordinary rain and snow, only slowing in a howling blizzard
  if (dwarf.quirk === 'IRON_BORN' && weather.id !== 'WINTER_BLIZZARD') {
    return true;
  }

  return nextTicks % weather.surfaceStepInterval === 0;
}

/**
 * Evaluates and records a seasonal weather mood adjustment and `Thoughts & Feelings`
 * anecdote for a dwarf based on whether they are exposed on Z-0 or sheltered underground.
 */
export function applyWeatherExposureToDwarf(
  dwarf: DwarfEntity,
  weather: WeatherDescriptor,
  context: {
    tick: number;
    year: number;
    season: string;
    isSheltered: boolean;
  }
): void {
  const { tick, year, season, isSheltered } = context;

  if (!isSheltered && dwarf.z === 0) {
    if (weather.id === 'WINTER_BLIZZARD') {
      const ironBorn = dwarf.quirk === 'IRON_BORN';
      appendDwarfThought(dwarf, {
        tick,
        year,
        season,
        text: ironBorn
          ? 'Braced against the howling winter blizzard with stoic Iron-Born grit.'
          : 'Bitterly trudging through blinding winter snowdrifts and freezing winds on the surface!',
        category: 'OMEN',
        sentiment: ironBorn ? 'NEUTRAL' : 'NEGATIVE',
        moraleDelta: ironBorn ? 0 : weather.outdoorMoodDelta,
      });
      return;
    }

    if (weather.id === 'WINTER_SNOW') {
      appendDwarfThought(dwarf, {
        tick,
        year,
        season,
        text: 'Beard crusted with rime and frost while trudging through winter snow on the surface.',
        category: 'OMEN',
        sentiment: 'NEGATIVE',
        moraleDelta: weather.outdoorMoodDelta,
      });
      return;
    }

    if (weather.precipitation === 'RAIN') {
      appendDwarfThought(dwarf, {
        tick,
        year,
        season,
        text: `Soaked to the bone by cold ${weather.label.toLowerCase()} and slick mud on the surface.`,
        category: 'OMEN',
        sentiment: 'NEGATIVE',
        moraleDelta: weather.outdoorMoodDelta,
      });
      return;
    }

    if (weather.id === 'SUMMER_SUN' || weather.id === 'SPRING_THAW') {
      appendDwarfThought(dwarf, {
        tick,
        year,
        season,
        text: `Invigorated by the ${weather.label.toLowerCase()} shining above the mountain pass.`,
        category: 'FELLOWSHIP',
        sentiment: 'POSITIVE',
        moraleDelta: weather.outdoorMoodDelta,
      });
      return;
    }
  } else if (
    isSheltered &&
    (weather.precipitation === 'SNOW' ||
      weather.precipitation === 'BLIZZARD' ||
      weather.precipitation === 'RAIN')
  ) {
    appendDwarfThought(dwarf, {
      tick,
      year,
      season,
      text: `Warm and dry inside the stone halls while ${weather.label.toLowerCase()} batters the surface peaks.`,
      category: 'CRAFT_DELVE',
      sentiment: 'POSITIVE',
      moraleDelta: weather.shelteredMoodDelta,
    });
  }
}
