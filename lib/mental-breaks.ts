import type { DwarfEntity, ChronicleEntry } from './types.ts';

export type MentalBreakType = 'DAZE' | 'TANTRUM' | 'FRENZY' | 'FEAR';

export interface MentalBreak {
  type: MentalBreakType;
  startedAt: number;
  duration: number;
}

export const MENTAL_BREAK_INFO: Record<MentalBreakType, {
  name: string;
  description: string;
  durationTicks: number;
  glyph: string;
}> = {
  DAZE: {
    name: 'Lost in Thought',
    description: 'Stares blankly at nothing, unresponsive for a while.',
    durationTicks: 60,
    glyph: '◎',
  },
  TANTRUM: {
    name: 'Throwing a Tantrum',
    description: 'Kicks over furniture and yells incoherently.',
    durationTicks: 40,
    glyph: '≡',
  },
  FRENZY: {
    name: 'Going Berserk',
    description: 'Attacks the nearest living thing without reason.',
    durationTicks: 30,
    glyph: '☠',
  },
  FEAR: {
    name: 'Overcome by Fear',
    description: 'Cowers and trembles, unable to function.',
    durationTicks: 50,
    glyph: '⚡',
  },
};

/**
 * Check if a dwarf is prone to a mental break based on happiness.
 * Returns the break type or null if stable.
 */
export function checkMentalBreak(
  dwarf: DwarfEntity,
  tick: number
): MentalBreakType | null {
  // Only check every 10 ticks to avoid spam
  if (tick % 10 !== 0) return null;

  // Lower happiness = higher chance
  const happiness = dwarf.happiness;

  if (happiness > 60) return null;
  if (happiness > 40) {
    return Math.random() < 0.05 ? 'DAZE' : null;
  }
  if (happiness > 20) {
    const roll = Math.random();
    if (roll < 0.15) return 'DAZE';
    if (roll < 0.25) return 'TANTRUM';
    if (roll < 0.35) return 'FEAR';
    return null;
  }
  // Very unhappy - high chance of serious break
  const roll = Math.random();
  if (roll < 0.30) return 'DAZE';
  if (roll < 0.50) return 'TANTRUM';
  if (roll < 0.70) return 'FEAR';
  if (roll < 0.90) return 'FRENZY';
  return 'DAZE';
}

/**
 * Get a chronicle entry for a mental break.
 */
export function getMentalBreakEntry(
  dwarf: DwarfEntity,
  breakType: MentalBreakType,
  tick: number,
  season: string,
  year: number
): ChronicleEntry {
  const info = MENTAL_BREAK_INFO[breakType];
  return {
    id: `chron-mb-${dwarf.id}-${tick}`,
    tick,
    season,
    year,
    text: `[MENTAL BREAK] ${info.glyph} ${dwarf.name} is ${info.name.toLowerCase()} — ${info.description}`,
    type: 'ALERT',
  };
}

/**
 * Check if a mental break has ended.
 */
export function isMentalBreakOver(
  breakState: MentalBreak,
  tick: number
): boolean {
  return tick - breakState.startedAt >= breakState.duration;
}

/**
 * Get the dwarf's state string while having a mental break.
 */
export function getMentalBreakState(breakType: MentalBreakType): string {
  const info = MENTAL_BREAK_INFO[breakType];
  return info.name;
}
