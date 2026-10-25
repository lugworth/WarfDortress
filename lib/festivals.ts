import type { FortressResources, GameState, TileTerrain } from "./types.ts";
import { createPRNG } from "./world-gen.ts";
import { addRelationship } from "./guild.ts";
import { validResourceMap } from "./game-rules.ts";

export type FestivalId =
  "FOUNDERS_SUPPER" | "STONECRAFT_CONTEST" | "TAVERN_TALES";
export type FestivalAction = { type: "START_FESTIVAL"; festival: FestivalId };
export interface FestivalState {
  version: 1;
  active: { festival: FestivalId; startedAt: number; expiresAt: number } | null;
  readyAt: Record<FestivalId, number>;
  lastStepTick: number;
  memories: Array<{
    festival: FestivalId;
    tick: number;
    dwarfId: string;
    anecdote: string;
  }>;
}
export const FESTIVAL_DURATION = 24;
export const FESTIVAL_COOLDOWN = 120;
export const FESTIVALS: ReadonlyArray<{
  id: FestivalId;
  title: string;
  cost: Partial<FortressResources>;
  building?: TileTerrain;
  buildingLabel?: string;
  description: string;
  effect: string;
}> = [
  {
    id: "FOUNDERS_SUPPER",
    title: "Founders’ supper",
    cost: { food: 8, ale: 4 },
    description:
      "Set a long table by the wagon and remember why the clan came here.",
    effect:
      "+6 clan morale and +5 energy now; +1 morale and +2 energy every 6 ticks while active.",
  },
  {
    id: "STONECRAFT_CONTEST",
    title: "Stonecraft contest",
    cost: { food: 6, ale: 3, wealth: 25 },
    building: "WORKSHOP_MASON",
    buildingLabel: "Built mason’s workshop",
    description:
      "Carvers compete to make a tiny masterpiece before the last cask empties.",
    effect:
      "+3 clan morale now; +1 progress to all work while active, and +1 morale every 6 ticks.",
  },
  {
    id: "TAVERN_TALES",
    title: "Night of tall tales",
    cost: { food: 4, ale: 8, wealth: 20 },
    building: "TAVERN_HALL",
    buildingLabel: "Built tavern hall",
    description:
      "Trade stories around the hearth. Pioneers near the tavern can become friends.",
    effect:
      "+4 clan morale now; +2 morale every 6 ticks. Nearby tavern attendees strengthen one bond per pulse.",
  },
];
const ids = FESTIVALS.map((f) => f.id);
const definition = (id: unknown) => FESTIVALS.find((f) => f.id === id);
const integer = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: string[]) =>
  Object.keys(v).length === expected.length &&
  expected.every((k) => Object.hasOwn(v, k));
const clamp = (n: number) => Math.max(0, Math.min(100, n));
export const createFestivalState = (): FestivalState => ({
  version: 1,
  active: null,
  readyAt: { FOUNDERS_SUPPER: 0, STONECRAFT_CONTEST: 0, TAVERN_TALES: 0 },
  lastStepTick: 0,
  memories: [],
});

export function validFestivalState(
  value: unknown,
  state?: GameState,
): value is FestivalState {
  if (
    !object(value) ||
    !keys(value, [
      "version",
      "active",
      "readyAt",
      "lastStepTick",
      "memories",
    ]) ||
    value.version !== 1 ||
    !integer(value.lastStepTick) ||
    (state && value.lastStepTick > state.ticks) ||
    !object(value.readyAt) ||
    !keys(value.readyAt, ids) ||
    !ids.every((id) =>
      integer((value.readyAt as Record<string, unknown>)[id]),
    ) ||
    !Array.isArray(value.memories) ||
    value.memories.length > 18
  )
    return false;
  if (value.active !== null) {
    const a = value.active;
    if (
      !object(a) ||
      !keys(a, ["festival", "startedAt", "expiresAt"]) ||
      !definition(a.festival) ||
      !integer(a.startedAt) ||
      !integer(a.expiresAt) ||
      a.expiresAt !== a.startedAt + FESTIVAL_DURATION ||
      (state && a.startedAt > state.ticks) ||
      value.readyAt[a.festival as FestivalId] !==
        a.startedAt + FESTIVAL_COOLDOWN
    )
      return false;
  }
  return value.memories.every(
    (m) =>
      object(m) &&
      keys(m, ["festival", "tick", "dwarfId", "anecdote"]) &&
      Boolean(definition(m.festival)) &&
      integer(m.tick) &&
      (!state || m.tick <= state.ticks) &&
      typeof m.dwarfId === "string" &&
      m.dwarfId.length > 0 &&
      m.dwarfId.length <= 128 &&
      typeof m.anecdote === "string" &&
      m.anecdote.length > 0 &&
      m.anecdote.length <= 240,
  );
}

export function festivalBlockers(state: GameState, id: FestivalId): string[] {
  const festival = definition(id),
    current = state.activities?.festivals || createFestivalState();
  if (!festival) return ["Unknown celebration."];
  if (current.active && state.ticks < current.active.expiresAt)
    return ["One celebration at a time."];
  const blockers: string[] = [];
  if (current.readyAt[id] > state.ticks)
    blockers.push(`Ready in ${current.readyAt[id] - state.ticks} ticks`);
  if (
    festival.building &&
    !state.grid.some((level) =>
      level.some((row) => row.some((t) => t.terrain === festival.building)),
    )
  )
    blockers.push(festival.buildingLabel!);
  for (const [key, amount] of Object.entries(festival.cost))
    if (state.resources[key as keyof FortressResources] < amount)
      blockers.push(`Need ${amount} ${key}`);
  return blockers;
}
function memory(
  state: GameState,
  festival: FestivalId,
  pulse: boolean,
): FestivalState["memories"][number] | undefined {
  if (!state.dwarves.length) return;
  const random = createPRNG(
    `${state.world.seed}:festival:${festival}:${state.ticks}`,
  );
  const dwarf = [...state.dwarves].sort((a, b) => a.id.localeCompare(b.id))[
    Math.floor(random() * state.dwarves.length)
  ];
  const lines =
    festival === "FOUNDERS_SUPPER"
      ? [
          "raised a toast to the first seven.",
          "insisted the wagon stew was a family recipe.",
          "saved a seat for the next migrant.",
        ]
      : festival === "STONECRAFT_CONTEST"
        ? [
            "carved a stubbornly square stone duck.",
            "claimed the tiny granite anvil was perfectly life-sized.",
            "won applause for a miniature mountainhome.",
          ]
        : [
            "told a suspiciously heroic story about a cave mouse.",
            "swore the old river once flowed uphill.",
            "got the clan singing the second verse correctly.",
          ];
  return {
    festival,
    tick: state.ticks,
    dwarfId: dwarf.id,
    anecdote: `${dwarf.name} ${lines[Math.floor(random() * lines.length)]}${pulse ? "" : " The celebration began."}`,
  };
}
export function applyFestivalAction(
  state: GameState,
  action: FestivalAction,
): GameState {
  const current = state.activities?.festivals,
    festival = definition(action?.festival);
  if (
    !state.activities ||
    !current ||
    !validFestivalState(current, state) ||
    action?.type !== "START_FESTIVAL" ||
    !festival ||
    !validResourceMap(state.resources) ||
    !Number.isSafeInteger(state.ticks + FESTIVAL_COOLDOWN) ||
    festivalBlockers(state, festival.id).length
  )
    return state;
  const resources = { ...state.resources };
  for (const [key, amount] of Object.entries(festival.cost))
    resources[key as keyof FortressResources] -= amount;
  const recollection = memory(state, festival.id, false);
  const nextFestival: FestivalState = {
    ...current,
    active: {
      festival: festival.id,
      startedAt: state.ticks,
      expiresAt: state.ticks + FESTIVAL_DURATION,
    },
    readyAt: {
      ...current.readyAt,
      [festival.id]: state.ticks + FESTIVAL_COOLDOWN,
    },
    lastStepTick: state.ticks,
    memories: recollection
      ? [...current.memories, recollection].slice(-18)
      : current.memories,
  };
  return {
    ...state,
    resources,
    activities: { ...state.activities, festivals: nextFestival },
    dwarves: state.dwarves.map((d) => ({
      ...d,
      happiness: clamp(
        d.happiness +
          (festival.id === "FOUNDERS_SUPPER"
            ? 6
            : festival.id === "TAVERN_TALES"
              ? 4
              : 3),
      ),
      energy: clamp(d.energy + (festival.id === "FOUNDERS_SUPPER" ? 5 : 0)),
      thought: `Looking forward to ${festival.title.toLowerCase()}.`,
    })),
    chronicle: [
      {
        id: `festival-${festival.id}-${state.ticks}`,
        tick: state.ticks,
        year: state.year,
        season: state.season,
        type: "LORE" as const,
        text: `${festival.title} began! ${recollection?.anecdote || ""}`,
      },
      ...state.chronicle,
    ].slice(0, 60),
  };
}
export function getFestivalWorkBonus(state: GameState): number {
  const current = state.activities?.festivals,
    active = current?.active;
  return current &&
    validFestivalState(current, state) &&
    active?.festival === "STONECRAFT_CONTEST" &&
    state.ticks >= active.startedAt &&
    state.ticks < active.expiresAt
    ? 1
    : 0;
}
export function stepFestivals(state: GameState): GameState {
  const current = state.activities?.festivals;
  if (!state.activities || !current || !validFestivalState(current, state))
    return state;
  const active = current.active;
  if (active && state.ticks >= active.expiresAt)
    return {
      ...state,
      activities: {
        ...state.activities,
        festivals: { ...current, active: null, lastStepTick: state.ticks },
      },
      chronicle: [
        {
          id: `festival-end-${active.festival}-${active.startedAt}`,
          tick: state.ticks,
          year: state.year,
          season: state.season,
          type: "INFO" as const,
          text: `${definition(active.festival)!.title} ended. The clan returns to its usual rhythm.`,
        },
        ...state.chronicle,
      ].slice(0, 60),
    };
  if (current.lastStepTick >= state.ticks) return state;
  const nextFestival = { ...current, lastStepTick: state.ticks };
  if (
    !active ||
    state.ticks <= active.startedAt ||
    (state.ticks - active.startedAt) % 6 !== 0
  )
    return {
      ...state,
      activities: { ...state.activities, festivals: nextFestival },
    };
  const recollection = memory(state, active.festival, true);
  const dwarves = state.dwarves.map((d) => ({
    ...d,
    happiness: clamp(
      d.happiness + (active.festival === "TAVERN_TALES" ? 2 : 1),
    ),
    energy: clamp(d.energy + (active.festival === "FOUNDERS_SUPPER" ? 2 : 0)),
  }));
  let relationships = state.guild.relationships;
  if (active.festival === "TAVERN_TALES") {
    const taverns = state.grid
      .flat(2)
      .filter((t) => t.terrain === "TAVERN_HALL");
    const attending = dwarves
      .filter((d) =>
        taverns.some(
          (t) =>
            t.z === d.z &&
            Math.max(Math.abs(t.x - d.x), Math.abs(t.y - d.y)) <= 3,
        ),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    if (attending.length > 1)
      relationships = addRelationship(
        relationships,
        attending[0].id,
        attending[1].id,
        1,
        "Shared tall tales at the tavern celebration.",
        state.ticks,
      );
  }
  return {
    ...state,
    dwarves,
    guild: { ...state.guild, relationships },
    activities: {
      ...state.activities,
      festivals: {
        ...nextFestival,
        memories: recollection
          ? [...nextFestival.memories, recollection].slice(-18)
          : nextFestival.memories,
      },
    },
  };
}
