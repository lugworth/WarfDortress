import type {
  ChronicleEntry,
  DesignationType,
  DwarfEntity,
  DwarfQuirk,
  FortressResources,
  GameState,
  Relic,
  StrangeMoodState,
  TileTerrain,
} from "./types.ts";
import { RELIC_TEMPLATES } from "./guild.ts";
import { withDwarfThought } from "./thoughts.ts";
import { createConfiguredMigrantDwarf } from "./world-gen.ts";

export interface BuildingUnlockStatus {
  tool: DesignationType;
  title: string;
  glyph: string;
  tier: 0 | 1 | 2 | 3 | 4;
  tierLabel: string;
  unlocked: boolean;
  requirementLabel: string;
  progressPercent: number;
  progressText: string;
  cost: Partial<FortressResources>;
}

export interface FortressRankInfo {
  tier: number;
  title: string;
  dwarvenTitle: string;
  minScore: number;
  nextScore: number | null;
  perk: string;
}

export const FORTRESS_RANKS: readonly FortressRankInfo[] = [
  {
    tier: 1,
    title: "Expedition Camp",
    dwarvenTitle: "Kogan-Zul",
    minScore: 0,
    nextScore: 900,
    perk: "Pioneer Spirit: Starting wagon supplies & basic surface delves.",
  },
  {
    tier: 2,
    title: "Delver Hamlet",
    dwarvenTitle: "udib-Kazad",
    minScore: 900,
    nextScore: 1600,
    perk: "+10% Caravan Barter Value · Attracts Skilled Migrant Artisans.",
  },
  {
    tier: 3,
    title: "Subterranean Barony",
    dwarvenTitle: "Barak-Thrund",
    minScore: 1600,
    nextScore: 2600,
    perk: "Baron's Charter: Royal Commissions & Strange Mood Inspirations.",
  },
  {
    tier: 4,
    title: "Ironclad Earldom",
    dwarvenTitle: "Khazad-Dûr",
    minScore: 2600,
    nextScore: 4000,
    perk: "Masterwork Forges: +15% Militia Morale & Deep Cavern Expeditions.",
  },
  {
    tier: 5,
    title: "Grand Duchy",
    dwarvenTitle: "Uzbad-Moria",
    minScore: 4000,
    nextScore: 6000,
    perk: "Ducal Treasury: High-Tier Relics & Elite Veteran Recruits.",
  },
  {
    tier: 6,
    title: "Mountainhome Capital",
    dwarvenTitle: "Khazad-Anvil",
    minScore: 6000,
    nextScore: null,
    perk: "Seat of the High King: Sovereign of the Deep Realm.",
  },
];

export interface MilestoneStatus {
  id: string;
  title: string;
  description: string;
  category: "INDUSTRY" | "DELVING" | "DEFENSE" | "GRANDEUR";
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  rewardSummary: string;
  reward: {
    resources?: Partial<FortressResources>;
    migrants?: number;
    relicTemplate?: string;
  };
}

export interface FortressProgressionSummary {
  score: number;
  currentRank: FortressRankInfo;
  nextRank: FortressRankInfo | null;
  rankProgressPercent: number;
  deepestRevealedZ: number;
  workshopCount: number;
  equippedMilitiaCount: number;
  milestones: MilestoneStatus[];
  buildingUnlocks: BuildingUnlockStatus[];
  strangeMood: StrangeMoodState | null;
  canFulfillMood: boolean;
}

function getBuiltTerrainSet(state: GameState): Set<TileTerrain> {
  const built = new Set<TileTerrain>();
  for (let z = 0; z < state.grid.length; z++) {
    const level = state.grid[z] || [];
    for (let y = 0; y < level.length; y++) {
      const row = level[y] || [];
      for (let x = 0; x < row.length; x++) {
        built.add(row[x].terrain);
      }
    }
  }
  return built;
}

function countConstructedWorkshops(state: GameState): number {
  let count = 0;
  for (let z = 0; z < state.grid.length; z++) {
    const level = state.grid[z] || [];
    for (let y = 0; y < level.length; y++) {
      const row = level[y] || [];
      for (let x = 0; x < row.length; x++) {
        const t = row[x].terrain;
        if (
          t.startsWith("WORKSHOP_") ||
          t === "TAVERN_HALL" ||
          t === "TEMPLE_ALTAR" ||
          t === "TRADE_DEPOT"
        ) {
          count++;
        }
      }
    }
  }
  return count;
}

export function getBuildingUnlockStatuses(
  state: GameState,
): BuildingUnlockStatus[] {
  const res = state.resources;
  const unlockedSet = new Set<DesignationType>(
    state.activities?.unlockedBuildings || [],
  );
  const builtTerrains = getBuiltTerrainSet(state);
  const workshopCount = countConstructedWorkshops(state);

  const hasMason = builtTerrains.has("WORKSHOP_MASON");
  const hasCarpenter = builtTerrains.has("WORKSHOP_CARPENTER");
  const hasStill = builtTerrains.has("WORKSHOP_STILL");
  const hasSmelter = builtTerrains.has("WORKSHOP_SMELTER");
  const hasForge = builtTerrains.has("WORKSHOP_FORGE");
  const hasTavern = builtTerrains.has("TAVERN_HALL");
  const hasDepot = builtTerrains.has("TRADE_DEPOT");
  const hasTemple = builtTerrains.has("TEMPLE_ALTAR");
  const hasTrap = builtTerrains.has("TRAP_STONE");

  const pct = (cur: number, target: number) =>
    Math.max(0, Math.min(100, Math.round((cur / Math.max(1, target)) * 100)));

  const list: BuildingUnlockStatus[] = [
    // Tier 0: Foundations (Always Unlocked)
    {
      tool: "BUILD_WALL",
      title: "Stone Wall",
      glyph: "#",
      tier: 0,
      tierLabel: "Tier 0 · Pioneer Shelter",
      unlocked: true,
      requirementLabel: "Embark Foundation (Always Unlocked)",
      progressPercent: 100,
      progressText: "Unlocked",
      cost: { stone: 2 },
    },
    {
      tool: "BUILD_DOOR",
      title: "Portal Door",
      glyph: "+",
      tier: 0,
      tierLabel: "Tier 0 · Pioneer Shelter",
      unlocked: true,
      requirementLabel: "Embark Foundation (Always Unlocked)",
      progressPercent: 100,
      progressText: "Unlocked",
      cost: { stone: 1 },
    },
    {
      tool: "BUILD_BED",
      title: "Dormitory Bed",
      glyph: "⌂",
      tier: 0,
      tierLabel: "Tier 0 · Pioneer Shelter",
      unlocked: true,
      requirementLabel: "Embark Foundation (Always Unlocked)",
      progressPercent: 100,
      progressText: "Unlocked",
      cost: { wood: 2 },
    },
    {
      tool: "BUILD_FARM",
      title: "Plump Helmet Farm",
      glyph: "≈",
      tier: 0,
      tierLabel: "Tier 0 · Pioneer Shelter",
      unlocked: true,
      requirementLabel: "Embark Foundation (Always Unlocked)",
      progressPercent: 100,
      progressText: "Unlocked",
      cost: { food: 1 },
    },

    // Tier 1: Stonecraft & Timber Joinery
    {
      tool: "BUILD_MASON",
      title: "Mason's Workshop",
      glyph: "M",
      tier: 1,
      tierLabel: "Tier 1 · Stonecraft & Joinery",
      unlocked:
        unlockedSet.has("BUILD_MASON") || hasMason || res.stone >= 28,
      requirementLabel: "Collect 28 Stone (Mine 1 rock tile)",
      progressPercent:
        unlockedSet.has("BUILD_MASON") || hasMason
          ? 100
          : pct(res.stone, 28),
      progressText: `${Math.min(28, res.stone)}/28 Stone`,
      cost: { stone: 4 },
    },
    {
      tool: "BUILD_CARPENTER",
      title: "Carpenter's Workshop",
      glyph: "C",
      tier: 1,
      tierLabel: "Tier 1 · Stonecraft & Joinery",
      unlocked:
        unlockedSet.has("BUILD_CARPENTER") || hasCarpenter || res.wood >= 24,
      requirementLabel: "Collect 24 Wood (Chop 1 surface tree)",
      progressPercent:
        unlockedSet.has("BUILD_CARPENTER") || hasCarpenter
          ? 100
          : pct(res.wood, 24),
      progressText: `${Math.min(24, res.wood)}/24 Wood`,
      cost: { wood: 4 },
    },
    {
      tool: "BUILD_TRAP",
      title: "Stone Deadfall Trap",
      glyph: "^",
      tier: 1,
      tierLabel: "Tier 1 · Stonecraft & Joinery",
      unlocked:
        unlockedSet.has("BUILD_TRAP") ||
        hasTrap ||
        hasMason ||
        res.stone >= 28,
      requirementLabel: "Collect 28 Stone or build Mason's Workshop",
      progressPercent:
        unlockedSet.has("BUILD_TRAP") || hasTrap || hasMason
          ? 100
          : pct(res.stone, 28),
      progressText: hasMason
        ? "Mason Built"
        : `${Math.min(28, res.stone)}/28 Stone`,
      cost: { stone: 2 },
    },

    // Tier 2: Brewing & Hearth Fellowship
    {
      tool: "BUILD_STILL",
      title: "Brewer's Still",
      glyph: "S",
      tier: 2,
      tierLabel: "Tier 2 · Hearth & Brewing",
      unlocked:
        unlockedSet.has("BUILD_STILL") ||
        hasStill ||
        hasMason ||
        hasCarpenter ||
        (res.stone >= 30 && res.wood >= 22),
      requirementLabel:
        "Collect 30 Stone & 22 Wood (or build Mason/Carpenter)",
      progressPercent:
        unlockedSet.has("BUILD_STILL") || hasStill || hasMason || hasCarpenter
          ? 100
          : Math.round((pct(res.stone, 30) + pct(res.wood, 22)) / 2),
      progressText: `${Math.min(30, res.stone)}/30 STN · ${Math.min(22, res.wood)}/22 WOD`,
      cost: { stone: 3, wood: 2 },
    },
    {
      tool: "BUILD_TAVERN",
      title: "Hearth Tavern Hall",
      glyph: "♫",
      tier: 2,
      tierLabel: "Tier 2 · Hearth & Brewing",
      unlocked:
        unlockedSet.has("BUILD_TAVERN") ||
        hasTavern ||
        hasStill ||
        (res.stone >= 32 && res.ale >= 48),
      requirementLabel:
        "Build Brewer's Still or collect 32 Stone & 48 Ale",
      progressPercent:
        unlockedSet.has("BUILD_TAVERN") || hasTavern || hasStill
          ? 100
          : Math.round((pct(res.stone, 32) + pct(res.ale, 48)) / 2),
      progressText: hasStill
        ? "Still Built"
        : `${Math.min(32, res.stone)}/32 STN · ${Math.min(48, res.ale)}/48 ALE`,
      cost: { stone: 3, wood: 3 },
    },

    // Tier 3: Metallurgy & The Deep Anvil
    {
      tool: "BUILD_SMELTER",
      title: "Smeltery Furnace",
      glyph: "£",
      tier: 3,
      tierLabel: "Tier 3 · Metallurgy & Anvil",
      unlocked:
        unlockedSet.has("BUILD_SMELTER") ||
        hasSmelter ||
        (res.stone >= 32 && res.ironOre >= 6),
      requirementLabel: "Collect 32 Stone & 6 Iron Ore",
      progressPercent:
        unlockedSet.has("BUILD_SMELTER") || hasSmelter
          ? 100
          : Math.round((pct(res.stone, 32) + pct(res.ironOre, 6)) / 2),
      progressText: `${Math.min(32, res.stone)}/32 STN · ${Math.min(6, res.ironOre)}/6 IRN`,
      cost: { stone: 4 },
    },
    {
      tool: "BUILD_FORGE",
      title: "Metalsmith's Forge",
      glyph: "⚒",
      tier: 3,
      tierLabel: "Tier 3 · Metallurgy & Anvil",
      unlocked:
        unlockedSet.has("BUILD_FORGE") ||
        hasForge ||
        (res.stone >= 36 && (hasSmelter || res.steelBars >= 4)),
      requirementLabel:
        "Collect 36 Stone & (build Smeltery or 4 Steel Bars)",
      progressPercent:
        unlockedSet.has("BUILD_FORGE") || hasForge
          ? 100
          : Math.round(
              (pct(res.stone, 36) + (hasSmelter ? 100 : pct(res.steelBars, 4))) /
                2,
            ),
      progressText: `${Math.min(36, res.stone)}/36 STN · ${hasSmelter ? "Smeltery[+]" : `${Math.min(4, res.steelBars)}/4 STL`}`,
      cost: { stone: 4, ironOre: 1 },
    },


    // Tier 4: Sovereign Trade & Sanctum
    {
      tool: "BUILD_DEPOT",
      title: "Seasonal Trade Depot",
      glyph: "¤",
      tier: 4,
      tierLabel: "Tier 4 · Sovereign Halls",
      unlocked:
        unlockedSet.has("BUILD_DEPOT") ||
        hasDepot ||
        workshopCount >= 2 ||
        (res.stone >= 38 && res.wealth >= 600),
      requirementLabel:
        "Collect 38 Stone & 600 Wealth (or build 2 Workshops)",
      progressPercent:
        unlockedSet.has("BUILD_DEPOT") || hasDepot || workshopCount >= 2
          ? 100
          : Math.max(
              pct(workshopCount, 2),
              Math.round((pct(res.stone, 38) + pct(res.wealth, 600)) / 2),
            ),
      progressText: `${Math.min(38, res.stone)}/38 STN · ${Math.min(600, res.wealth)}/600 WLTH`,
      cost: { stone: 4, wood: 4 },
    },
    {
      tool: "BUILD_TEMPLE",
      title: "Ancestral Temple Altar",
      glyph: "Ψ",
      tier: 4,
      tierLabel: "Tier 4 · Sovereign Halls",
      unlocked:
        unlockedSet.has("BUILD_TEMPLE") ||
        hasTemple ||
        workshopCount >= 3 ||
        (res.stone >= 44 && res.wealth >= 720),
      requirementLabel:
        "Collect 44 Stone & 720 Wealth (or build 3 Workshops)",
      progressPercent:
        unlockedSet.has("BUILD_TEMPLE") || hasTemple || workshopCount >= 3
          ? 100
          : Math.max(
              pct(workshopCount, 3),
              Math.round((pct(res.stone, 44) + pct(res.wealth, 720)) / 2),
            ),
      progressText: `${Math.min(44, res.stone)}/44 STN · ${Math.min(720, res.wealth)}/720 WLTH`,
      cost: { stone: 5 },
    },
  ];

  return list;
}

export function getBuildingUnlockStatus(
  state: GameState,
  tool: DesignationType,
): BuildingUnlockStatus | null {
  return getBuildingUnlockStatuses(state).find((b) => b.tool === tool) || null;
}

export function isBuildingUnlocked(
  state: GameState,
  tool: DesignationType,
): boolean {
  const status = getBuildingUnlockStatus(state, tool);
  return status ? status.unlocked : true;
}

export function syncBuildingUnlocks(state: GameState): {
  nextState: GameState;
  newlyUnlocked: BuildingUnlockStatus[];
} {
  const existing = new Set<DesignationType>(
    state.activities?.unlockedBuildings || [],
  );
  const statuses = getBuildingUnlockStatuses(state);
  const newlyUnlocked: BuildingUnlockStatus[] = [];

  for (const st of statuses) {
    if (st.tier > 0 && st.unlocked && !existing.has(st.tool)) {
      existing.add(st.tool);
      newlyUnlocked.push(st);
    }
  }

  if (newlyUnlocked.length === 0) {
    return { nextState: state, newlyUnlocked: [] };
  }

  const newEntries: ChronicleEntry[] = newlyUnlocked.map((u) => ({
    id: `chron-unlock-${u.tool}-${state.ticks}`,
    tick: state.ticks,
    season: state.season,
    year: state.year,
    text: `[BLUEPRINT UNLOCKED] ${u.glyph} ${u.title} (${u.tierLabel}) is now available for construction!`,
    type: "CRAFT",
  }));

  return {
    nextState: {
      ...state,
      activities: {
        ...state.activities,
        unlockedBuildings: [...existing],
      },
      chronicle: [...newEntries, ...state.chronicle].slice(0, 60),
    },
    newlyUnlocked,
  };
}

function getDeepestRevealedZ(state: GameState): number {

  let deepest = 0;
  for (let z = 1; z < state.grid.length; z++) {
    const level = state.grid[z] || [];
    const hasStairway = level.some((row) =>
      row.some((tile) => tile.terrain === "STAIRS_UP_DOWN"),
    );
    if (hasStairway) deepest = z;
  }
  const deepestDwarfZ = state.dwarves.reduce((max, d) => Math.max(max, d.z), 0);
  return Math.max(deepest, deepestDwarfZ);
}

export function getFortressProgression(
  state: GameState,
): FortressProgressionSummary {
  const workshopCount = countConstructedWorkshops(state);
  const deepestRevealedZ = getDeepestRevealedZ(state);
  const equippedMilitiaCount = state.dwarves.filter(
    (d) => d.weaponEquipped || d.armorEquipped,
  ).length;
  const claimedSet = new Set(state.activities?.claimedMilestones || []);
  const totalRelics =
    state.resources.relics + (state.guild?.relics?.length || 0);

  // Composite progression score combining wealth, population, depth, workshops, and relics
  const score =
    state.resources.wealth +
    state.dwarves.length * 60 +
    workshopCount * 90 +
    deepestRevealedZ * 150 +
    totalRelics * 250;

  let currentRank = FORTRESS_RANKS[0];
  let nextRank: FortressRankInfo | null = FORTRESS_RANKS[1];
  for (let i = 0; i < FORTRESS_RANKS.length; i++) {
    if (score >= FORTRESS_RANKS[i].minScore) {
      currentRank = FORTRESS_RANKS[i];
      nextRank = FORTRESS_RANKS[i + 1] || null;
    }
  }

  const rankProgressPercent = nextRank
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((score - currentRank.minScore) /
              Math.max(1, nextRank.minScore - currentRank.minScore)) *
              100,
          ),
        ),
      )
    : 100;

  const milestones: MilestoneStatus[] = [
    {
      id: "ms-strike-earth",
      title: "Strike the Earth",
      description: "Mine rock and accumulate 35+ Stone in fortress stockpiles.",
      category: "DELVING",
      progress: Math.min(35, state.resources.stone),
      target: 35,
      completed: state.resources.stone >= 35 || claimedSet.has("ms-strike-earth"),
      claimed: claimedSet.has("ms-strike-earth"),
      rewardSummary: "+12 Food, +12 Ale, +100 Wealth",
      reward: {
        resources: { food: 12, ale: 12, wealth: 100 },
      },
    },
    {
      id: "ms-hearth-industry",
      title: "Fires of Industry",
      description:
        "Construct at least 3 Workshops or Civic Halls (Mason, Forge, Smeltery, Still, or Tavern).",
      category: "INDUSTRY",
      progress: Math.min(3, workshopCount),
      target: 3,
      completed: workshopCount >= 3 || claimedSet.has("ms-hearth-industry"),
      claimed: claimedSet.has("ms-hearth-industry"),
      rewardSummary: "+1 Migrant Pioneer, +4 Steel Bars, +150 Wealth",
      reward: {
        resources: { steelBars: 4, wealth: 150 },
        migrants: 1,
      },
    },
    {
      id: "ms-deep-delver",
      title: "Subterranean Delver",
      description:
        "Carve stairs and breach the mid-level caverns at Depth Z-2 or deeper.",
      category: "DELVING",
      progress: Math.min(2, deepestRevealedZ),
      target: 2,
      completed: deepestRevealedZ >= 2 || claimedSet.has("ms-deep-delver"),
      claimed: claimedSet.has("ms-deep-delver"),
      rewardSummary: "+6 Iron Ore, +4 Gold Ore, +180 Wealth",
      reward: {
        resources: { ironOre: 6, goldOre: 4, wealth: 180 },
      },
    },
    {
      id: "ms-iron-guard",
      title: "The Ironclad Guard",
      description:
        "Equip at least 3 Dwarves with forged Axes or Mail Armor.",
      category: "DEFENSE",
      progress: Math.min(3, equippedMilitiaCount),
      target: 3,
      completed:
        equippedMilitiaCount >= 3 || claimedSet.has("ms-iron-guard"),
      claimed: claimedSet.has("ms-iron-guard"),
      rewardSummary: "+2 Weapons, +2 Armor, +200 Wealth",
      reward: {
        resources: { weapons: 2, armor: 2, wealth: 200 },
      },
    },
    {
      id: "ms-ancestral-relic",
      title: "Heirloom of the Mountain",
      description:
        "Recover a Cavern Relic, fulfill a Strange Mood, or complete a Royal Guild Commission.",
      category: "GRANDEUR",
      progress: Math.min(1, totalRelics),
      target: 1,
      completed: totalRelics >= 1 || claimedSet.has("ms-ancestral-relic"),
      claimed: claimedSet.has("ms-ancestral-relic"),
      rewardSummary: "+1 Migrant Pioneer, +250 Wealth, Runic Anvil Relic",
      reward: {
        resources: { wealth: 250 },
        migrants: 1,
        relicTemplate: "RUNIC_ANVIL",
      },
    },
    {
      id: "ms-mountainhome",
      title: "Seat of the Mountainhome",
      description:
        "Grow the fortress to 9+ Dwarves and 1,500+ Wealth.",
      category: "GRANDEUR",
      progress: Math.min(
        100,
        Math.round(
          (Math.min(1, state.dwarves.length / 9) * 50) +
            (Math.min(1, state.resources.wealth / 1500) * 50),
        ),
      ),
      target: 100,
      completed:
        (state.dwarves.length >= 9 && state.resources.wealth >= 1500) ||
        claimedSet.has("ms-mountainhome"),
      claimed: claimedSet.has("ms-mountainhome"),
      rewardSummary: "+2 Migrant Pioneers, +500 Wealth, Crown of Ember",
      reward: {
        resources: { wealth: 500, steelBars: 6 },
        migrants: 2,
        relicTemplate: "CROWN_OF_EMBER",
      },
    },
  ];

  const strangeMood = state.activities?.strangeMood || null;
  const canFulfillMood = Boolean(
    strangeMood &&
      Object.entries(strangeMood.demands).every(
        ([k, amt]) =>
          (state.resources[k as keyof FortressResources] ?? 0) >= (amt ?? 0),
      ),
  );

  return {
    score,
    currentRank,
    nextRank,
    rankProgressPercent,
    deepestRevealedZ,
    workshopCount,
    equippedMilitiaCount,
    milestones,
    buildingUnlocks: getBuildingUnlockStatuses(state),
    strangeMood,
    canFulfillMood,
  };
}


export function claimMilestoneReward(
  state: GameState,
  milestoneId: string,
): { nextState: GameState; claimed: boolean } {
  const progression = getFortressProgression(state);
  const milestone = progression.milestones.find((m) => m.id === milestoneId);
  if (!milestone || !milestone.completed || milestone.claimed) {
    return { nextState: state, claimed: false };
  }

  const nextResources = { ...state.resources };
  if (milestone.reward.resources) {
    for (const [k, v] of Object.entries(milestone.reward.resources)) {
      const key = k as keyof FortressResources;
      nextResources[key] = (nextResources[key] ?? 0) + (v ?? 0);
    }
  }

  const nextDwarves = [...state.dwarves];
  const migrantCount = milestone.reward.migrants || 0;
  for (let i = 0; i < migrantCount; i++) {
    nextDwarves.push(
      createConfiguredMigrantDwarf({
        existingDwarves: nextDwarves,
        worldWidth: state.world.width,
        worldHeight: state.world.height,
        dwarvenName: state.world.dwarvenName,
        ticks: state.ticks,
        indexOffset: i + 1,
        originLabel: `Milestone (${milestone.title})`,
        weaponsAvailable: nextResources.weapons,
        armorAvailable: nextResources.armor,
      }),
    );
  }

  const nextRelics: Relic[] = [...(state.guild?.relics || [])];
  if (milestone.reward.relicTemplate) {
    const tplKey = milestone.reward.relicTemplate;
    const tpl = RELIC_TEMPLATES[tplKey] || RELIC_TEMPLATES.CROWN_OF_EMBER;
    nextResources.relics += 1;
    nextRelics.push({
      id: `relic-ms-${milestone.id}-${state.ticks}`,
      template: tplKey,
      name: tpl.name,
      discoveredBy: `Fortress Milestone (${milestone.title})`,
      discoveredAt: state.ticks,
      mode: "DISPLAYED",
      history: [
        {
          tick: state.ticks,
          text: `Consecrated upon achieving "${milestone.title}".`,
        },
      ],
    });
  }

  const claimedMilestones = [
    ...(state.activities?.claimedMilestones || []),
    milestoneId,
  ];

  const entry: ChronicleEntry = {
    id: `chron-ms-${milestoneId}-${state.ticks}`,
    tick: state.ticks,
    season: state.season,
    year: state.year,
    text: `[MILESTONE] Completed "${milestone.title}"! Awarded ${milestone.rewardSummary}.`,
    type: "LORE",
  };

  return {
    nextState: {
      ...state,
      resources: nextResources,
      dwarves: nextDwarves,
      guild: {
        ...state.guild,
        relics: nextRelics,
      },
      activities: {
        ...state.activities,
        claimedMilestones,
      },
      chronicle: [entry, ...state.chronicle.slice(0, 59)],
    },
    claimed: true,
  };
}

const ARTIFACT_BLUEPRINTS = [
  {
    artifactName: "Uzol-Kogan, The Scepter of Living Stone",
    relicTemplate: "ANCIENT_PICK",
    moodKind: "FEY" as const,
    demands: { stone: 6, wood: 4, ironOre: 2 },
  },
  {
    artifactName: "Zulban-Thrund, The Star-Forged Warhorn",
    relicTemplate: "HORN_OF_VALOR",
    moodKind: "SECRETIVE" as const,
    demands: { stone: 5, steelBars: 1, wood: 4 },
  },
  {
    artifactName: "Moria-Chalice, Goblet of Eternal Mirth",
    relicTemplate: "MITHRIL_CHALICE",
    moodKind: "POSSESSED" as const,
    demands: { stone: 4, ale: 6, ironOre: 1 },
  },
];

export function triggerStrangeMood(state: GameState): {
  nextState: GameState;
  triggered: boolean;
} {
  if (state.activities?.strangeMood || state.dwarves.length === 0) {
    return { nextState: state, triggered: false };
  }

  const dwarf =
    state.dwarves[(state.ticks + state.dwarves.length) % state.dwarves.length];
  const blueprint =
    ARTIFACT_BLUEPRINTS[
      (state.ticks + state.guild.relics.length) % ARTIFACT_BLUEPRINTS.length
    ];

  const strangeMood: StrangeMoodState = {
    id: `mood-${state.ticks}`,
    dwarfId: dwarf.id,
    dwarfName: dwarf.name,
    moodKind: blueprint.moodKind,
    artifactName: blueprint.artifactName,
    relicTemplate: blueprint.relicTemplate,
    demands: blueprint.demands,
    startedAt: state.ticks,
    deadline: state.ticks + 80,
  };

  const nextDwarves = state.dwarves.map((d) =>
    d.id === dwarf.id
      ? withDwarfThought(d, {
          tick: state.ticks,
          year: state.year,
          season: state.season,
          text: `Seized by a ${blueprint.moodKind.toLowerCase()} mood! Demands materials to forge "${blueprint.artifactName}"!`,
          category: "OMEN",
          sentiment: "EUPHORIC",
          moraleDelta: 4,
        })
      : d,
  );

  const entry: ChronicleEntry = {
    id: `chron-mood-start-${state.ticks}`,
    tick: state.ticks,
    season: state.season,
    year: state.year,
    text: `[STRANGE MOOD] ${dwarf.name} is seized by a ${blueprint.moodKind} MOOD and claims a workshop to craft "${blueprint.artifactName}"!`,
    type: "LORE",
  };

  return {
    nextState: {
      ...state,
      dwarves: nextDwarves,
      activities: {
        ...state.activities,
        strangeMood,
      },
      chronicle: [entry, ...state.chronicle.slice(0, 59)],
    },
    triggered: true,
  };
}

export function fulfillStrangeMood(state: GameState): {
  nextState: GameState;
  fulfilled: boolean;
} {
  const mood = state.activities?.strangeMood;
  if (!mood) return { nextState: state, fulfilled: false };

  for (const [k, amt] of Object.entries(mood.demands)) {
    const key = k as keyof FortressResources;
    if ((state.resources[key] ?? 0) < (amt ?? 0)) {
      return { nextState: state, fulfilled: false };
    }
  }

  const nextResources = { ...state.resources };
  for (const [k, amt] of Object.entries(mood.demands)) {
    const key = k as keyof FortressResources;
    nextResources[key] -= amt ?? 0;
  }
  nextResources.wealth += 350;
  nextResources.relics += 1;

  const newRelic: Relic = {
    id: `relic-mood-${state.ticks}`,
    template: mood.relicTemplate,
    name: mood.artifactName,
    discoveredBy: `${mood.dwarfName} (${mood.moodKind} Mood)`,
    discoveredAt: state.ticks,
    mode: "DISPLAYED",
    history: [
      {
        tick: state.ticks,
        text: `Masterwork artifact forged by ${mood.dwarfName} during a ${mood.moodKind.toLowerCase()} trance.`,
      },
    ],
  };

  const nextDwarves = state.dwarves.map((d) =>
    d.id === mood.dwarfId
      ? withDwarfThought(
          {
            ...d,
            title: `Legendary Artisan (${d.title.split(" ")[0]})`,
            maxHp: d.maxHp + 25,
            hp: d.maxHp + 25,
            happiness: 100,
          },
          {
            tick: state.ticks,
            year: state.year,
            season: state.season,
            text: `Created the legendary artifact ${mood.artifactName}!`,
            category: "CRAFT_DELVE",
            sentiment: "EUPHORIC",
            moraleDelta: 15,
          },
        )
      : withDwarfThought(d, {
          tick: state.ticks,
          year: state.year,
          season: state.season,
          text: `Marveled at the newly forged masterwork "${mood.artifactName}"!`,
          category: "FELLOWSHIP",
          sentiment: "POSITIVE",
          moraleDelta: 10,
        }),
  );

  const entry: ChronicleEntry = {
    id: `chron-mood-done-${state.ticks}`,
    tick: state.ticks,
    season: state.season,
    year: state.year,
    text: `[ARTIFACT FORGED] ${mood.dwarfName} completed the legendary artifact "${mood.artifactName}" (+350 Wealth, Legendary Artisan)!`,
    type: "LORE",
  };

  return {
    nextState: {
      ...state,
      resources: nextResources,
      dwarves: nextDwarves,
      guild: {
        ...state.guild,
        relics: [...state.guild.relics, newRelic],
      },
      activities: {
        ...state.activities,
        strangeMood: null,
      },
      chronicle: [entry, ...state.chronicle.slice(0, 59)],
    },
    fulfilled: true,
  };
}
