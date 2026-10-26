import type {
  ChronicleEntry,
  DwarfEntity,
  DwarfQuirk,
  FortressResources,
  GameState,
  Relic,
  StrangeMoodState,
} from "./types.ts";
import { RELIC_TEMPLATES } from "./guild.ts";

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
  strangeMood: StrangeMoodState | null;
  canFulfillMood: boolean;
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
    strangeMood,
    canFulfillMood,
  };
}

const MIGRANT_NAMES = [
  { name: "Thorek Deepdelver", title: "Journeyman Miner & Mason", quirk: "DEEP_MINER" as DwarfQuirk, color: "#00ffff" },
  { name: "Bari Goldhand", title: "Master Jeweler & Smith", quirk: "IRON_BORN" as DwarfQuirk, color: "#ff9900" },
  { name: "Nori Shieldbreaker", title: "Veteran Axedwarf", quirk: "HOTHEAD" as DwarfQuirk, color: "#ff0099" },
  { name: "Dori Barrelstave", title: "Brewmaster & Herbalist", quirk: "DRUNKARD" as DwarfQuirk, color: "#33ff00" },
  { name: "Balin Runeweaver", title: "Lorekeeper & Chronicler", quirk: "SCHOLAR" as DwarfQuirk, color: "#cc00ff" },
];

function createMigrantDwarf(state: GameState, indexOffset: number): DwarfEntity {
  const template =
    MIGRANT_NAMES[(state.dwarves.length + indexOffset) % MIGRANT_NAMES.length];
  const cx = Math.floor(state.world.width / 2);
  const cy = Math.floor(state.world.height / 2);
  return {
    id: `dwarf-migrant-${state.ticks}-${state.dwarves.length + indexOffset}`,
    name: template.name,
    title: template.title,
    char: "☺",
    color: template.color,
    x: cx + ((indexOffset % 3) - 1),
    y: cy + ((indexOffset % 2) === 0 ? 1 : -1),
    z: 0,
    hp: 100,
    maxHp: 100,
    hunger: 95,
    thirst: 95,
    energy: 95,
    happiness: 95,
    quirk: template.quirk,
    weaponEquipped: indexOffset % 2 === 0,
    armorEquipped: false,
    labors: {
      MINING: true,
      WOODCUTTING: true,
      MASONRY: true,
      CARPENTRY: true,
      FARMING: true,
      SMITHING: true,
      COMBAT: true,
      HAULING: true,
    },
    skills: {
      MINING: 2,
      WOODCUTTING: 2,
      MASONRY: 2,
      CARPENTRY: 2,
      FARMING: 2,
      SMITHING: 2,
      COMBAT: 2,
      HAULING: 2,
    },
    state: "IDLE",
    thought: "Arrived with the migrant wave to seek glory in the fortress!",
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
    nextDwarves.push(createMigrantDwarf(state, i + 1));
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
      ? {
          ...d,
          thought: `Seized by a ${blueprint.moodKind.toLowerCase()} mood! Demands materials to forge "${blueprint.artifactName}"!`,
        }
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
      ? {
          ...d,
          title: `Legendary Artisan (${d.title.split(" ")[0]})`,
          maxHp: d.maxHp + 25,
          hp: d.maxHp + 25,
          happiness: 100,
          thought: `Created the legendary artifact ${mood.artifactName}!`,
        }
      : {
          ...d,
          happiness: Math.min(100, d.happiness + 10),
        },
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
