import type { NarrativeEvent, FortressResources } from './types.ts';

const SEVERITIES = [
  'MINOR_OMEN',
  'STRANGE_MOOD',
  'TRADE_CARAVAN',
  'DIPLOMATIC_ENVOY',
  'MAJOR_CRISIS',
];
const CHOICE_NUMBER_BOUNDS = {
  stoneCost: [0, 100],
  woodCost: [0, 100],
  foodCost: [0, 100],
  stoneReward: [0, 100],
  foodReward: [0, 100],
  aleReward: [0, 100],
  wealthReward: [0, 1000],
  spawnMigrants: [0, 5],
  moraleDelta: [-20, 20],
} as const;

function isBoundedText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function isOptionalInteger(value: unknown, min: number, max: number): boolean {
  return value === undefined || (
    Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max
  );
}

export function formatGeneratedEvent(raw: unknown, ticks: number): NarrativeEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (
    !isBoundedText(data.title, 200) ||
    !isBoundedText(data.narrative, 8000) ||
    !isBoundedText(data.asciiArt, 500) ||
    !isBoundedText(data.historicalConnection, 2000) ||
    !isBoundedText(data.triggerReason, 2000) ||
    typeof data.severity !== 'string' || !SEVERITIES.includes(data.severity) ||
    !Array.isArray(data.choices) || data.choices.length !== 3
  ) return null;

  const choices: NarrativeEvent['choices'] = [];
  for (const [idx, input] of data.choices.entries()) {
    if (!input || typeof input !== 'object') return null;
    const c = input as Record<string, unknown>;
    if (
      !isBoundedText(c.id, 80) || !isBoundedText(c.label, 300) ||
      !isBoundedText(c.description, 2000) || !isBoundedText(c.outcomeLog, 2000)
    ) return null;
    if (Object.entries(CHOICE_NUMBER_BOUNDS).some(
      ([key, [min, max]]) => !isOptionalInteger(c[key], min, max)
    )) return null;

    const cost: Partial<FortressResources> = {};
    const reward: Partial<FortressResources> = {};
    for (const key of ['stone', 'wood', 'food'] as const) {
      if (idx < 2 && Number(c[`${key}Cost`]) > 0) cost[key] = Number(c[`${key}Cost`]);
    }
    for (const key of ['stone', 'food', 'ale', 'wealth'] as const) {
      if (Number(c[`${key}Reward`]) > 0) reward[key] = Number(c[`${key}Reward`]);
    }
    choices.push({
      id: c.id,
      label: c.label,
      description: c.description,
      outcomeLog: c.outcomeLog,
      cost,
      reward,
      moraleDelta: Number(c.moraleDelta || 0),
      spawnMigrants: Number(c.spawnMigrants || 0),
    });
  }
  if (new Set(choices.map((c) => c.id)).size !== choices.length) return null;
  return {
    id: `evt-ai-${crypto.randomUUID()}`,
    title: data.title,
    narrative: data.narrative,
    asciiArt: data.asciiArt,
    historicalConnection: data.historicalConnection,
    triggerReason: data.triggerReason,
    severity: data.severity as NarrativeEvent['severity'],
    choices,
    tickTriggered: ticks,
  };
}
