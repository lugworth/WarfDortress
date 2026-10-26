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
