import type { DesignationType, FortressResources } from "./types.ts";
import { TRAP_DAMAGE } from "./game-rules.ts";

export const TOOL_GROUPS = [
  "Dig",
  "Build",
  "Food & Drink",
  "Industry",
  "Defense",
] as const;
export type ToolGroup = (typeof TOOL_GROUPS)[number];
export interface ToolDefinition {
  id: DesignationType;
  label: string;
  desc: string;
  color: string;
  group: ToolGroup;
}

export const TOOLS: ToolDefinition[] = [
  {
    id: "MINE",
    group: "Dig",
    label: "MINE ROCK / ORE",
    color: "text-[var(--ui-warning)]",
    desc: "Excavate rock and ore veins",
  },
  {
    id: "STAIRS",
    group: "Dig",
    label: "CARVE STAIRS",
    color: "text-[var(--ui-accent)]",
    desc: "Link current Z-level with Z+1 cavern",
  },
  {
    id: "RECLAIM_RELIC",
    group: "Dig",
    label: "RECLAIM RELIC (☼)",
    color: "text-[var(--ui-info)]",
    desc: "Recover ancient subterranean artifact",
  },
  {
    id: "CHOP",
    group: "Dig",
    label: "FELL TIMBER",
    color: "text-[var(--ui-success)]",
    desc: "Chop trees for logs (+4 Wood)",
  },
  {
    id: "GATHER",
    group: "Food & Drink",
    label: "GATHER SHRUBS",
    color: "text-[var(--ui-success)]",
    desc: "Forage plants (+4 Food)",
  },
  {
    id: "BUILD_SMELTER",
    group: "Industry",
    label: "BUILD SMELTERY (£)",
    color: "text-[var(--ui-warning)]",
    desc: "Smelt Iron Ore into Steel Bars",
  },
  {
    id: "BUILD_FORGE",
    group: "Industry",
    label: "BUILD FORGE (⚒)",
    color: "text-[var(--ui-info)]",
    desc: "Forge Runed Weapons & Steel Armor",
  },
  {
    id: "BUILD_TAVERN",
    group: "Food & Drink",
    label: "BUILD TAVERN (♫)",
    color: "text-[var(--ui-violet)]",
    desc: "Hearth hall for feasts & morale buffs",
  },
  {
    id: "BUILD_TEMPLE",
    group: "Build",
    label: "BUILD TEMPLE (Ψ)",
    color: "text-[var(--ui-accent)]",
    desc: "Sanctuary granting meditative serenity",
  },
  {
    id: "BUILD_DEPOT",
    group: "Build",
    label: "TRADE DEPOT (¤)",
    color: "text-[var(--ui-info)]",
    desc: "Caravan plaza (+15% export trade value)",
  },
  {
    id: "BUILD_TRAP",
    group: "Defense",
    label: "STONE TRAP (^)",
    color: "text-[var(--ui-danger)]",
    desc: `Deadfall trap (${TRAP_DAMAGE} damage to hostiles)`,
  },
  {
    id: "BUILD_WALL",
    group: "Defense",
    label: "STONE WALL",
    color: "text-[var(--ui-bright)]",
    desc: "Fortified masonry wall blocking raiders",
  },
  {
    id: "BUILD_DOOR",
    group: "Defense",
    label: "STONE DOOR (+)",
    color: "text-[var(--ui-text)]",
    desc: "Install secure gateway portal",
  },
  {
    id: "STOCKPILE",
    group: "Build",
    label: "STOCKPILE ZONE",
    color: "text-[var(--ui-blue)]",
    desc: "Central storage for fortress wares",
  },
  {
    id: "BUILD_FARM",
    group: "Food & Drink",
    label: "PLUMP HELMET FARM",
    color: "text-[var(--ui-success)]",
    desc: "Subterranean mushrooms for food & ale",
  },
  {
    id: "BUILD_STILL",
    group: "Food & Drink",
    label: "BREWERY STILL",
    color: "text-[var(--ui-violet)]",
    desc: "Distill Plump Helmets into Dwarven Ale",
  },
  {
    id: "BUILD_MASON",
    group: "Industry",
    label: "MASON WORKSHOP",
    color: "text-[var(--ui-info)]",
    desc: "Carve stone thrones, statues & coffers",
  },
  {
    id: "BUILD_CARPENTER",
    group: "Industry",
    label: "CARPENTER SHOP",
    color: "text-[var(--ui-warning)]",
    desc: "Craft wooden beds, barrels & shields",
  },
  {
    id: "BUILD_BED",
    group: "Build",
    label: "DWARVEN BED",
    color: "text-[var(--ui-success)]",
    desc: "Quarters for fast fatigue recovery",
  },
  {
    id: "CANCEL",
    group: "Dig",
    label: "CLEAR ORDERS",
    color: "text-[var(--ui-danger)]",
    desc: "Remove pending designations in box",
  },
];

const RESOURCE_NAMES: Record<keyof FortressResources, string> = {
  stone: "Stone",
  wood: "Timber",
  ironOre: "Iron ore",
  goldOre: "Gold ore",
  steelBars: "Steel bars",
  food: "Food",
  ale: "Ale",
  furniture: "Furniture",
  weapons: "Weapons",
  armor: "Armor",
  relics: "Relics",
  wealth: "Wealth",
};

export function formatCost(cost: Partial<FortressResources>): string {
  return (
    Object.entries(cost)
      .filter(([, amount]) => amount !== undefined && amount > 0)
      .map(
        ([resource, amount]) =>
          `${amount} ${RESOURCE_NAMES[resource as keyof FortressResources]}`,
      )
      .join(" · ") || "Free"
  );
}

export function getTool(id: DesignationType): ToolDefinition {
  const tool = TOOLS.find((entry) => entry.id === id);
  if (!tool) throw new Error(`Unknown designation tool: ${id}`);
  return tool;
}
