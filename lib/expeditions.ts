import type { FortressResources, GameState } from "./types";

export type ExpeditionApproach = "CAUTIOUS" | "BOLD";

export type ExpeditionAction =
  | {
      type: "START_EXPEDITION";
      routeId: string;
      approach: ExpeditionApproach;
    }
  | {
      type: "CLAIM_EXPEDITION";
      id: string;
    };

export interface RouteApproachPlan {
  duration: number;
  setbackChance: number;
  reward: Partial<FortressResources>;
}

export interface ExpeditionRoute {
  id: string;
  name: string;
  description: string;
  cost: Partial<FortressResources>;
  setbackReward: Partial<FortressResources>;
  relicOnSuccess?: boolean;
  approaches: Record<ExpeditionApproach, RouteApproachPlan>;
}

export interface ActiveExpedition {
  id: string;
  routeId: string;
  approach: ExpeditionApproach;
  startedAt: number;
  returnsAt: number;
}

export interface ExpeditionHistoryItem {
  id: string;
  routeId: string;
  outcome: "SUCCESS" | "SETBACK";
  claimedAt: number;
  reward: Partial<FortressResources>;
  relicId?: string;
}

export interface ExpeditionState {
  active: ActiveExpedition | null;
  history: ExpeditionHistoryItem[];
}

export const EXPEDITION_ROUTES: ExpeditionRoute[] = [
  {
    id: "route-foothills",
    name: "Foothills Foraging & Quarrying",
    description: "Send scouts through adjacent highland valleys to gather timber and limestone blocks.",
    cost: { food: 5, ale: 4 },
    setbackReward: { stone: 10, wood: 5 },
    approaches: {
      CAUTIOUS: {
        duration: 40,
        setbackChance: 10,
        reward: { stone: 20, wood: 15, wealth: 50 },
      },
      BOLD: {
        duration: 25,
        setbackChance: 35,
        reward: { stone: 35, wood: 25, wealth: 100 },
      },
    },
  },
  {
    id: "route-deep-ruins",
    name: "Sunken Cavern Ruins",
    description: "Delve abandoned subterranean dwarven outposts to recover ancient metalwork.",
    cost: { food: 8, ale: 8, weapons: 1 },
    setbackReward: { ironOre: 4, wealth: 40 },
    relicOnSuccess: true,
    approaches: {
      CAUTIOUS: {
        duration: 70,
        setbackChance: 15,
        reward: { ironOre: 10, steelBars: 4, wealth: 180 },
      },
      BOLD: {
        duration: 45,
        setbackChance: 40,
        reward: { ironOre: 18, steelBars: 8, wealth: 350 },
      },
    },
  },
  {
    id: "route-elf-road",
    name: "Whispering Canopy Caravan Way",
    description: "Travel north along the great arboreal canopy to barter with elven herbalists.",
    cost: { food: 6, ale: 10 },
    setbackReward: { food: 10, wealth: 30 },
    approaches: {
      CAUTIOUS: {
        duration: 55,
        setbackChance: 10,
        reward: { food: 25, ale: 20, wealth: 120 },
      },
      BOLD: {
        duration: 35,
        setbackChance: 30,
        reward: { food: 45, ale: 35, wealth: 220 },
      },
    },
  },
];

export function createExpeditionState(): ExpeditionState {
  return {
    active: null,
    history: [],
  };
}

export function expeditionActionAvailable(
  state: GameState,
  action: ExpeditionAction
): boolean {
  const expeditions = state.activities?.expeditions || createExpeditionState();

  if (action.type === "START_EXPEDITION") {
    if (expeditions.active) return false;
    const route = EXPEDITION_ROUTES.find((r) => r.id === action.routeId);
    if (!route) return false;

    // Check resources
    for (const [key, amount] of Object.entries(route.cost)) {
      if ((state.resources[key as keyof FortressResources] ?? 0) < (amount ?? 0)) {
        return false;
      }
    }
    return true;
  }

  if (action.type === "CLAIM_EXPEDITION") {
    if (!expeditions.active || expeditions.active.id !== action.id) return false;
    return state.ticks >= expeditions.active.returnsAt;
  }

  return false;
}

export function performExpeditionAction(
  state: GameState,
  action: ExpeditionAction,
): { nextState: GameState; success: boolean } {
  if (!expeditionActionAvailable(state, action)) {
    return { nextState: state, success: false };
  }

  const expeditions: ExpeditionState =
    state.activities?.expeditions || createExpeditionState();

  if (action.type === "START_EXPEDITION") {
    const route = EXPEDITION_ROUTES.find((r) => r.id === action.routeId);
    if (!route) return { nextState: state, success: false };
    const plan = route.approaches[action.approach];

    const nextResources = { ...state.resources };
    for (const [k, v] of Object.entries(route.cost)) {
      const key = k as keyof FortressResources;
      nextResources[key] = Math.max(0, (nextResources[key] ?? 0) - (v ?? 0));
    }

    const active: ActiveExpedition = {
      id: `exp-${state.ticks}-${route.id}`,
      routeId: route.id,
      approach: action.approach,
      startedAt: state.ticks,
      returnsAt: state.ticks + plan.duration,
    };

    return {
      nextState: {
        ...state,
        resources: nextResources,
        activities: {
          ...state.activities,
          expeditions: {
            ...expeditions,
            active,
          },
        },
        chronicle: [
          {
            id: `chron-exp-start-${state.ticks}`,
            tick: state.ticks,
            season: state.season,
            year: state.year,
            text: `[EXPEDITION] Dispatched scouts on "${route.name}" (${action.approach} approach, returns at Tick ${active.returnsAt}).`,
            type: "INFO",
          },
          ...state.chronicle.slice(0, 59),
        ],
      },
      success: true,
    };
  }

  if (action.type === "CLAIM_EXPEDITION" && expeditions.active) {
    const active = expeditions.active;
    const route = EXPEDITION_ROUTES.find((r) => r.id === active.routeId);
    if (!route) return { nextState: state, success: false };
    const plan = route.approaches[active.approach];

    // Deterministic roll from seed + ticks + routeId
    const hash = (state.ticks * 31 + active.routeId.length * 17) % 100;
    const isSetback = hash < plan.setbackChance;
    const outcome: "SUCCESS" | "SETBACK" = isSetback ? "SETBACK" : "SUCCESS";
    const reward = isSetback ? route.setbackReward : plan.reward;

    const nextResources = { ...state.resources };
    for (const [k, v] of Object.entries(reward)) {
      const key = k as keyof FortressResources;
      nextResources[key] = (nextResources[key] ?? 0) + (v ?? 0);
    }

    const nextRelics = [...state.guild.relics];
    let relicId: string | undefined;
    if (!isSetback && route.relicOnSuccess) {
      relicId = `relic-exp-${state.ticks}`;
      nextResources.relics += 1;
      nextRelics.push({
        id: relicId,
        template: "CROWN_OF_EMBER",
        name: "Crown of the Sunken Outpost",
        discoveredBy: `Scouting Expedition (${route.name})`,
        discoveredAt: state.ticks,
        mode: "STORED",
        history: [
          {
            tick: state.ticks,
            text: `Recovered intact from ${route.name} by ${active.approach.toLowerCase()} scouts.`,
          },
        ],
      });
    }

    const historyItem: ExpeditionHistoryItem = {
      id: active.id,
      routeId: active.routeId,
      outcome,
      claimedAt: state.ticks,
      reward,
      relicId,
    };

    return {
      nextState: {
        ...state,
        resources: nextResources,
        guild: {
          ...state.guild,
          relics: nextRelics,
        },
        activities: {
          ...state.activities,
          expeditions: {
            active: null,
            history: [historyItem, ...expeditions.history],
          },
        },
        chronicle: [
          {
            id: `chron-exp-claim-${state.ticks}`,
            tick: state.ticks,
            season: state.season,
            year: state.year,
            text: `[EXPEDITION] Scouts returned from "${route.name}" (${outcome})! Cargo claimed into fortress stockpiles.`,
            type: outcome === "SUCCESS" ? "LORE" : "ALERT",
          },
          ...state.chronicle.slice(0, 59),
        ],
      },
      success: true,
    };
  }

  return { nextState: state, success: false };
}
