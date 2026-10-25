import type {
  ChronicleEntry,
  FortressResources,
  GameState,
  RelicTemplate,
} from "./types.ts";
import { createPRNG } from "./world-gen.ts";
import { makeNamedRelic } from "./guild.ts";
import { RESOURCE_KEYS, validResourceMap } from "./game-rules.ts";

export type ExpeditionRouteId =
  "RIVER_SUPPLIES" | "IRON_RIDGE" | "ANCIENT_VAULT";
export type ExpeditionApproach = "CAUTIOUS" | "BOLD";

export interface ExpeditionRun {
  id: string;
  ordinal: number;
  routeId: ExpeditionRouteId;
  approach: ExpeditionApproach;
  startedAt: number;
  returnsAt: number;
  status: "TRAVELLING" | "READY";
}
export interface ExpeditionResult extends Omit<ExpeditionRun, "status"> {
  claimedAt: number;
  outcome: "SUCCESS" | "SETBACK";
  reward: Partial<FortressResources>;
  relicId?: string;
}
export interface ExpeditionState {
  nextOrdinal: number;
  active: ExpeditionRun | null;
  history: ExpeditionResult[];
}
export type ExpeditionAction =
  | {
      type: "START_EXPEDITION";
      routeId: ExpeditionRouteId;
      approach: ExpeditionApproach;
    }
  | { type: "CLAIM_EXPEDITION"; id: string };

interface RouteApproach {
  duration: number;
  setbackChance: number;
  reward: Partial<FortressResources>;
}
interface ExpeditionRoute {
  id: ExpeditionRouteId;
  name: string;
  description: string;
  cost: Partial<FortressResources>;
  approaches: Record<ExpeditionApproach, RouteApproach>;
  setbackReward: Partial<FortressResources>;
  relicOnSuccess?: boolean;
}

export const EXPEDITION_ROUTES: readonly ExpeditionRoute[] = [
  {
    id: "RIVER_SUPPLIES",
    name: "River Market Caravan",
    description:
      "Hire a merchant escort to bring back mushroom rations, cask ale, and timber. A cautious party waits for a safe river crossing; a bold party takes the shorter bandit road.",
    cost: { wealth: 35, food: 2 },
    approaches: {
      CAUTIOUS: {
        duration: 24,
        setbackChance: 10,
        reward: { food: 18, ale: 4, wood: 6 },
      },
      BOLD: {
        duration: 16,
        setbackChance: 30,
        reward: { food: 28, ale: 6, wood: 10 },
      },
    },
    setbackReward: { food: 5, wood: 2 },
  },
  {
    id: "IRON_RIDGE",
    name: "Iron Ridge Prospectors",
    description:
      "Contract hill scouts to sample a weathered ore outcrop. Cautious scouts shore up the cut; bold scouts pursue a richer seam before the scree settles.",
    cost: { wealth: 60, food: 4, ale: 2 },
    approaches: {
      CAUTIOUS: {
        duration: 40,
        setbackChance: 15,
        reward: { ironOre: 6, stone: 6, goldOre: 1 },
      },
      BOLD: {
        duration: 26,
        setbackChance: 40,
        reward: { ironOre: 10, stone: 10, goldOre: 2 },
      },
    },
    setbackReward: { ironOre: 1, stone: 4 },
  },
  {
    id: "ANCIENT_VAULT",
    name: "Lost Vault Survey",
    description:
      "Sponsor professional relic hunters following an old caravan map. A successful survey returns a named heirloom; bold hunters take a treasure-heavy shortcut through unstable galleries.",
    cost: { wealth: 100, food: 6, ale: 4 },
    approaches: {
      CAUTIOUS: {
        duration: 60,
        setbackChance: 25,
        reward: { goldOre: 3, steelBars: 2, wealth: 60, relics: 1 },
      },
      BOLD: {
        duration: 40,
        setbackChance: 50,
        reward: { goldOre: 5, steelBars: 3, wealth: 90, relics: 1 },
      },
    },
    setbackReward: { goldOre: 1, stone: 6 },
    relicOnSuccess: true,
  },
];
const HISTORY_LIMIT = 12;
const MAX_ORDINAL = 1_000_000;
const routes = new Map(EXPEDITION_ROUTES.map((route) => [route.id, route]));
const approaches: ExpeditionApproach[] = ["CAUTIOUS", "BOLD"];
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function createExpeditionState(): ExpeditionState {
  return { nextOrdinal: 0, active: null, history: [] };
}

function currentExpeditions(state: GameState): ExpeditionState {
  return state.activities?.expeditions ?? createExpeditionState();
}

export function expeditionOutcome(
  seed: string,
  run: Pick<ExpeditionRun, "ordinal" | "routeId" | "approach">,
): {
  outcome: ExpeditionResult["outcome"];
  reward: Partial<FortressResources>;
} {
  const route = routes.get(run.routeId)!;
  const roll = createPRNG(
    `${seed}:expedition:${run.ordinal}:${run.routeId}:${run.approach}`,
  )();
  const outcome =
    roll * 100 < route.approaches[run.approach].setbackChance
      ? "SETBACK"
      : "SUCCESS";
  return {
    outcome,
    reward: {
      ...(outcome === "SUCCESS"
        ? route.approaches[run.approach].reward
        : route.setbackReward),
    },
  };
}

function sameReward(
  a: Partial<FortressResources>,
  b: Partial<FortressResources>,
): boolean {
  return RESOURCE_KEYS.every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

export function validExpeditionState(
  value: unknown,
  state?: GameState,
): value is ExpeditionState {
  if (
    !record(value) ||
    !integer(value.nextOrdinal) ||
    value.nextOrdinal > MAX_ORDINAL ||
    !Array.isArray(value.history) ||
    value.history.length > HISTORY_LIMIT
  )
    return false;
  const seen = new Set<number>();
  const validRun = (run: unknown): run is ExpeditionRun => {
    if (
      !record(run) ||
      !integer(run.ordinal) ||
      run.ordinal >= Number(value.nextOrdinal) ||
      run.id !== `expedition-${run.ordinal}` ||
      !routes.has(run.routeId as ExpeditionRouteId) ||
      !approaches.includes(run.approach as ExpeditionApproach) ||
      !integer(run.startedAt) ||
      !integer(run.returnsAt)
    )
      return false;
    const route = routes.get(run.routeId as ExpeditionRouteId)!;
    if (
      run.returnsAt !==
        run.startedAt +
          route.approaches[run.approach as ExpeditionApproach].duration ||
      (state && run.startedAt > state.ticks) ||
      seen.has(run.ordinal)
    )
      return false;
    seen.add(run.ordinal);
    return true;
  };
  if (value.active !== null) {
    if (
      !validRun(value.active) ||
      value.active.ordinal !== value.nextOrdinal - 1 ||
      !["TRAVELLING", "READY"].includes(value.active.status)
    )
      return false;
    if (
      state &&
      value.active.status === "READY" &&
      value.active.returnsAt > state.ticks
    )
      return false;
  }
  let previousOrdinal = Number(value.nextOrdinal);
  for (const result of value.history) {
    if (
      !validRun(result) ||
      !record(result) ||
      !integer(result.claimedAt) ||
      result.claimedAt < result.returnsAt ||
      (state && result.claimedAt > state.ticks) ||
      result.ordinal >= previousOrdinal ||
      !["SUCCESS", "SETBACK"].includes(String(result.outcome)) ||
      !validResourceMap(result.reward)
    )
      return false;
    previousOrdinal = result.ordinal;
    const route = routes.get(result.routeId)!;
    const expectedReward =
      result.outcome === "SUCCESS"
        ? route.approaches[result.approach].reward
        : route.setbackReward;
    if (!sameReward(result.reward, expectedReward)) return false;
    const needsRelic = Boolean(
      route.relicOnSuccess && result.outcome === "SUCCESS",
    );
    if (
      needsRelic
        ? typeof result.relicId !== "string" || !result.relicId
        : result.relicId !== undefined
    )
      return false;
    if (state) {
      if (
        expeditionOutcome(state.world.seed, result).outcome !== result.outcome
      )
        return false;
      if (
        needsRelic &&
        !state.guild.relics.some((relic) => relic.id === result.relicId)
      )
        return false;
    }
  }
  return (
    seen.size <= Number(value.nextOrdinal) &&
    (value.nextOrdinal !== 0 ||
      (value.active === null && value.history.length === 0))
  );
}

function canAfford(state: GameState, cost: Partial<FortressResources>) {
  return (
    validResourceMap(state.resources) &&
    Object.entries(cost).every(
      ([key, amount]) =>
        state.resources[key as keyof FortressResources] >= amount!,
    )
  );
}

function canReceive(state: GameState, reward: Partial<FortressResources>) {
  if (!validResourceMap(state.resources)) return false;
  return Object.entries(reward).every(([key, amount]) => {
    const next = state.resources[key as keyof FortressResources] + amount!;
    return Number.isSafeInteger(next) && next <= 1e12;
  });
}

export function expeditionActionAvailable(
  state: GameState,
  action: ExpeditionAction,
): boolean {
  const expeditions = currentExpeditions(state);
  if (!state.activities || !validExpeditionState(expeditions, state))
    return false;
  if (action.type === "START_EXPEDITION") {
    const route = routes.get(action.routeId);
    return Boolean(
      route &&
      approaches.includes(action.approach) &&
      !expeditions.active &&
      expeditions.nextOrdinal < MAX_ORDINAL &&
      integer(state.ticks) &&
      Number.isSafeInteger(
        state.ticks + route.approaches[action.approach].duration,
      ) &&
      canAfford(state, route.cost),
    );
  }
  if (action.type !== "CLAIM_EXPEDITION") return false;
  const run = expeditions.active;
  if (!run || run.id !== action.id || state.ticks < run.returnsAt) return false;
  return canReceive(state, expeditionOutcome(state.world.seed, run).reward);
}

function withExpeditions(
  state: GameState,
  expeditions: ExpeditionState,
): GameState {
  if (!state.activities) return state;
  return { ...state, activities: { ...state.activities, expeditions } };
}

function log(
  state: GameState,
  id: string,
  text: string,
  type: ChronicleEntry["type"] = "INFO",
): GameState {
  return {
    ...state,
    chronicle: [
      {
        id: `chron-${id}`,
        tick: state.ticks,
        year: state.year,
        season: state.season,
        text,
        type,
      },
      ...state.chronicle,
    ].slice(0, 60),
  };
}

export function applyExpeditionAction(
  state: GameState,
  action: ExpeditionAction,
): GameState {
  if (!expeditionActionAvailable(state, action)) return state;
  const expeditions = currentExpeditions(state);
  if (action.type === "START_EXPEDITION") {
    const route = routes.get(action.routeId)!;
    const active: ExpeditionRun = {
      id: `expedition-${expeditions.nextOrdinal}`,
      ordinal: expeditions.nextOrdinal,
      routeId: action.routeId,
      approach: action.approach,
      startedAt: state.ticks,
      returnsAt: state.ticks + route.approaches[action.approach].duration,
      status: "TRAVELLING",
    };
    const resources = { ...state.resources };
    for (const [key, amount] of Object.entries(route.cost))
      resources[key as keyof FortressResources] -= amount!;
    return log(
      withExpeditions(
        { ...state, resources },
        { ...expeditions, nextOrdinal: expeditions.nextOrdinal + 1, active },
      ),
      `${active.id}-start`,
      `Hired external scouts for ${route.name} (${action.approach.toLowerCase()}). Return expected at tick ${active.returnsAt}; fortress dwarves remain on duty.`,
    );
  }
  const run = expeditions.active!;
  const route = routes.get(run.routeId)!;
  const result = expeditionOutcome(state.world.seed, run);
  const resources = { ...state.resources };
  for (const [key, amount] of Object.entries(result.reward))
    resources[key as keyof FortressResources] += amount!;
  let next: GameState = { ...state, resources };
  let relicId: string | undefined;
  if (route.relicOnSuccess && result.outcome === "SUCCESS") {
    let serial = state.guild.relics.length;
    while (state.guild.relics.some((relic) => relic.id === `relic-${serial}`))
      serial++;
    const templates: RelicTemplate[] = [
      "EMBER_CROWN",
      "STONE_SONG",
      "OATH_AXE",
    ];
    const template =
      templates[
        Math.floor(
          createPRNG(`${state.world.seed}:expedition:${run.ordinal}:relic`)() *
            templates.length,
        )
      ];
    const relic = makeNamedRelic(
      state.world.seed,
      serial,
      state.ticks,
      "The hired vault scouts",
      `recovered on ${route.name}`,
      template,
    );
    relicId = relic.id;
    next = {
      ...next,
      guild: { ...state.guild, relics: [...state.guild.relics, relic] },
    };
  }
  const history: ExpeditionResult = {
    id: run.id,
    ordinal: run.ordinal,
    routeId: run.routeId,
    approach: run.approach,
    startedAt: run.startedAt,
    returnsAt: run.returnsAt,
    claimedAt: state.ticks,
    ...result,
    ...(relicId ? { relicId } : {}),
  };
  next = withExpeditions(next, {
    ...expeditions,
    active: null,
    history: [history, ...expeditions.history].slice(0, HISTORY_LIMIT),
  });
  const cargo = Object.entries(result.reward)
    .map(([key, amount]) => `${amount} ${key}`)
    .join(", ");
  return log(
    next,
    `${run.id}-claim`,
    `${route.name}: ${result.outcome === "SUCCESS" ? "the scouts returned safely" : "a setback forced an early retreat"}. Claimed ${cargo}${relicId ? " and its named relic" : ""}.`,
    relicId ? "LORE" : "WORK",
  );
}

export function stepExpeditions(state: GameState): GameState {
  const expeditions = currentExpeditions(state);
  const active = expeditions.active;
  if (
    !state.activities ||
    !active ||
    active.status === "READY" ||
    state.ticks < active.returnsAt
  )
    return state;
  return log(
    withExpeditions(state, {
      ...expeditions,
      active: { ...active, status: "READY" },
    }),
    `${active.id}-return`,
    `Scouts from ${routes.get(active.routeId)!.name} have returned. Claim their cargo in Expeditions.`,
  );
}
