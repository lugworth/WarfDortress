import type { DesignationType, FortressResources } from "./types";
import { TOOL_NAMES } from "./ui-labels";

export type ToolGroup =
  | "Excavation & Harvest"
  | "Architecture"
  | "Workshops"
  | "Civic & Community"
  | "Orders";

export const TOOL_GROUPS: readonly ToolGroup[] = [
  "Excavation & Harvest",
  "Architecture",
  "Workshops",
  "Civic & Community",
  "Orders",
];

export interface ToolDefinition {
  id: DesignationType;
  label: string;
  desc: string;
  group: ToolGroup;
  color: string;
}

export const TOOLS: ToolDefinition[] = [
  {
    id: "MINE",
    label: TOOL_NAMES.MINE,
    desc: "Dig into subterranean rock walls and mine ore deposits.",
    group: "Excavation & Harvest",
    color: "text-[var(--ui-warning)]",
  },
  {
    id: "CHOP",
    label: TOOL_NAMES.CHOP,
    desc: "Fell surface trees to supply the carpenter with timber.",
    group: "Excavation & Harvest",
    color: "text-[var(--ui-success)]",
  },
  {
    id: "GATHER",
    label: TOOL_NAMES.GATHER,
    desc: "Gather surface shrubs, roots, and wild plants for brewing.",
    group: "Excavation & Harvest",
    color: "text-[var(--ui-success)]",
  },
  {
    id: "STAIRS",
    label: TOOL_NAMES.STAIRS,
    desc: "Carve stairways to connect surface strata with subterranean depths.",
    group: "Excavation & Harvest",
    color: "text-[var(--ui-warning)]",
  },
  {
    id: "STOCKPILE",
    label: TOOL_NAMES.STOCKPILE,
    desc: "Zone dedicated floor space to haul and organize fortress supplies.",
    group: "Orders",
    color: "text-[var(--ui-info)]",
  },
  {
    id: "RECLAIM_RELIC",
    label: TOOL_NAMES.RECLAIM_RELIC,
    desc: "Recover ancient cavern relics and bring them to your vaults.",
    group: "Excavation & Harvest",
    color: "text-[var(--ui-accent)]",
  },
  {
    id: "BUILD_WALL",
    label: TOOL_NAMES.BUILD_WALL,
    desc: "Erect cut-stone walls to fortify corridors and defend the entrance.",
    group: "Architecture",
    color: "text-[var(--ui-bright)]",
  },
  {
    id: "BUILD_DOOR",
    label: TOOL_NAMES.BUILD_DOOR,
    desc: "Construct reinforced wooden or stone doors with lock mechanisms.",
    group: "Architecture",
    color: "text-[var(--ui-warning)]",
  },
  {
    id: "BUILD_TRAP",
    label: TOOL_NAMES.BUILD_TRAP,
    desc: "Set lethal falling-stone mechanisms triggered by intruder steps.",
    group: "Architecture",
    color: "text-[var(--ui-danger)]",
  },
  {
    id: "BUILD_BED",
    label: TOOL_NAMES.BUILD_BED,
    desc: "Place carved beds in pioneer quarters to restore energy and mood.",
    group: "Architecture",
    color: "text-[var(--ui-info)]",
  },
  {
    id: "BUILD_FARM",
    label: TOOL_NAMES.BUILD_FARM,
    desc: "Establish subterranean plump helmet farms on rich muddy loam.",
    group: "Workshops",
    color: "text-[var(--ui-success)]",
  },
  {
    id: "BUILD_MASON",
    label: TOOL_NAMES.BUILD_MASON,
    desc: "Construct a stoneworker bench for blocks, statues, and furniture.",
    group: "Workshops",
    color: "text-[var(--ui-bright)]",
  },
  {
    id: "BUILD_CARPENTER",
    label: TOOL_NAMES.BUILD_CARPENTER,
    desc: "Construct a woodworking shop for barrels, bins, and weapon racks.",
    group: "Workshops",
    color: "text-[var(--ui-warning)]",
  },
  {
    id: "BUILD_STILL",
    label: TOOL_NAMES.BUILD_STILL,
    desc: "Construct a copper still to brew sweet dwarven ale from harvested plants.",
    group: "Workshops",
    color: "text-[var(--ui-violet)]",
  },
  {
    id: "BUILD_SMELTER",
    label: TOOL_NAMES.BUILD_SMELTER,
    desc: "Construct a clay smeltery to process iron ore into gleaming steel.",
    group: "Workshops",
    color: "text-[var(--ui-warning)]",
  },
  {
    id: "BUILD_FORGE",
    label: TOOL_NAMES.BUILD_FORGE,
    desc: "Construct an anvil forge to hammer steel battleaxes and chainmail.",
    group: "Workshops",
    color: "text-[var(--ui-accent)]",
  },
  {
    id: "BUILD_TAVERN",
    label: TOOL_NAMES.BUILD_TAVERN,
    desc: "Designate a warm social gathering hall for tales, songs, and camaraderie.",
    group: "Civic & Community",
    color: "text-[var(--ui-violet)]",
  },
  {
    id: "BUILD_TEMPLE",
    label: TOOL_NAMES.BUILD_TEMPLE,
    desc: "Consecrate an altar to ancestral mountain deities to lift clan spirits.",
    group: "Civic & Community",
    color: "text-[var(--ui-warning)]",
  },
  {
    id: "BUILD_DEPOT",
    label: TOOL_NAMES.BUILD_DEPOT,
    desc: "Erect a broad merchant platform to barter with visiting seasonal caravans.",
    group: "Civic & Community",
    color: "text-[var(--ui-accent)]",
  },
  {
    id: "MILITIA_STATION",
    label: TOOL_NAMES.MILITIA_STATION,
    desc: "Order the active militia squad to form a fortified shield-wall station on the designated floor.",
    group: "Orders",
    color: "text-[var(--ui-danger)]",
  },
  {
    id: "MILITIA_PATROL",
    label: TOOL_NAMES.MILITIA_PATROL,
    desc: "Order the active militia squad to march a continuous patrol route between the start and end corners.",
    group: "Orders",
    color: "text-[var(--ui-info)]",
  },
  {
    id: "CANCEL",
    label: TOOL_NAMES.CANCEL,
    desc: "Cancel queued designations and release assigned tasks.",
    group: "Orders",
    color: "text-[var(--ui-danger)]",
  },
];

export function getTool(id: DesignationType): ToolDefinition {
  const match = TOOLS.find((t) => t.id === id);
  return (
    match || {
      id,
      label: TOOL_NAMES[id] || id,
      desc: "Fortress command order",
      group: "Orders",
      color: "text-[var(--ui-bright)]",
    }
  );
}

export function formatCost(cost?: Partial<FortressResources>): string {
  if (!cost) return "Free";
  const parts: string[] = [];
  const labels: Record<keyof FortressResources, string> = {
    stone: "Stone",
    wood: "Timber",
    ironOre: "Iron Ore",
    goldOre: "Gold Ore",
    steelBars: "Steel",
    food: "Food",
    ale: "Ale",
    furniture: "Furniture",
    weapons: "Weapons",
    armor: "Armor",
    relics: "Relics",
    wealth: "Wealth",
  };

  for (const [key, amount] of Object.entries(cost)) {
    if (typeof amount === "number" && amount > 0) {
      const name = labels[key as keyof FortressResources] || key;
      parts.push(`${amount} ${name}`);
    }
  }

  return parts.length > 0 ? parts.join(", ") : "Free";
}
