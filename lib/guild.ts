import type {
  Civilization,
  Commission,
  DwarfEntity,
  DwarfQuirk,
  FortressResources,
  GameState,
  GuildAction,
  GuildState,
  Relic,
} from "./types";

export const QUIRKS: Record<
  DwarfQuirk | string,
  { name: string; description: string }
> = {
  DEEP_MINER: {
    name: "Subterranean Blood",
    description: "Happiest when digging below Z-2; gains +20% mining speed in deep granite.",
  },
  DRUNKARD: {
    name: "Ale Connoisseur",
    description: "Thirst decays 20% faster, but morale jumps +15 when enjoying tavern drinks.",
  },
  LONER: {
    name: "Solitary Hermit",
    description: "Prefers solitary mining tunnels; loses patience in crowded workshops.",
  },
  SCHOLAR: {
    name: "Chronicle Devotee",
    description: "Spends off-duty hours contemplating historical events and library tomes.",
  },
  HOTHEAD: {
    name: "Quick to Bicker",
    description: "Fierce in combat with +2 attack, but can quarrel with nearby dwarves.",
  },
  IRON_BORN: {
    name: "Master Metalsmith",
    description: "Produces masterwork goods with 15% higher wealth value at forges and smelters.",
  },
  GREEDY: {
    name: "Treasure Hoarder",
    description: "Morale rises when the fortress treasury exceeds 1,000 wealth.",
  },
  PIOUS: {
    name: "Ancestor Blessed",
    description: "Gains continuous blessings and calm thoughts when praying near temple altars.",
  },
};

export interface RelicTemplate {
  name: string;
  display: string;
  equip: string;
  blessing: string;
}

export const RELIC_TEMPLATES: Record<string, RelicTemplate> = {
  CROWN_OF_EMBER: {
    name: "Crown of the First Delver",
    display: "+10% fortress-wide mining speed and illuminated deep strata.",
    equip: "+30 max HP and complete immunity to fear and goblin dread.",
    blessing: "Delvers delve without terror in the deepest magma caverns.",
  },
  RUNIC_ANVIL: {
    name: "Anvil of High Hammering",
    display: "All weapon and armor smithing jobs consume 1 fewer steel bar.",
    equip: "Doubles physical strike power when wielding runed axes.",
    blessing: "Every strike upon hot metal rings with the memory of the Mountainhome.",
  },
  CHRONICLE_CODEX: {
    name: "Golden Codex of Kings",
    display: "+20 trade favor with all civil alliances and double caravan wares.",
    equip: "+25 base happiness and steady mood under siege.",
    blessing: "The deeds of the fortress are recorded for eternity.",
  },
  HORN_OF_VALOR: {
    name: "Warhorn of the Vanguard",
    display: "Militia squads mobilize instantly and gain +2 defense.",
    equip: "Rallies adjacent dwarves in battle, raising squad attack by 3.",
    blessing: "A deafening blast sends invaders fleeing in disorder.",
  },
  MITHRIL_CHALICE: {
    name: "Ever-Full Chalice of Moradin",
    display: "Tavern cheer increases happiness across all off-duty dwarves.",
    equip: "Bearer thirst never falls below 50%; always high spirits.",
    blessing: "Sweet honeyed brew flows endless from the silver brim.",
  },
  ANCIENT_PICK: {
    name: "World-Cleaver Pickaxe",
    display: "Excavation produces double ore yield from mineral veins.",
    equip: "Instant rock shattering in subterranean tunnels.",
    blessing: "Stone splits like ripe fruit beneath its masterwork edge.",
  },
};

export function createInitialGuildState(): GuildState {
  const initialCommissions: Commission[] = [
    {
      id: "comm-1",
      title: "Granite for the High King's Causeway",
      description: "Deliver cut stone blocks to pave the imperial royal highway connecting Mountainhomes.",
      patron: "Dwarves",
      requirement: { resource: "stone", amount: 30 },
      reward: { wealth: 250, favor: 20, relic: "ANCIENT_PICK" },
      deadline: 1200,
      status: "OFFERED",
    },
    {
      id: "comm-2",
      title: "Steel Blades for the Human Frontier",
      description: "Supply tempered steel weapons to arm border garrisons guarding against beast incursions.",
      patron: "Humans",
      requirement: { resource: "weapons", amount: 3 },
      reward: { wealth: 400, favor: 25, relic: "HORN_OF_VALOR" },
      deadline: 2000,
      status: "OFFERED",
    },
    {
      id: "comm-3",
      title: "Rare Timber for the Canopy Pavilions",
      description: "Supply seasoned hardwood logs to craft sacred diplomatic pavilions.",
      patron: "Elves",
      requirement: { resource: "wood", amount: 25 },
      reward: { wealth: 300, favor: 25, relic: "CHRONICLE_CODEX" },
      deadline: 1800,
      status: "OFFERED",
    },
  ];

  return {
    favor: {
      Dwarves: 45,
      Elves: 20,
      Humans: 30,
      Goblins: 0,
    },
    commissions: initialCommissions,
    relics: [],
    relationships: [
      { a: "dwarf-1", b: "dwarf-2", score: 15, reason: "Shared hearty tankards of ale in the tavern hall." },
      { a: "dwarf-3", b: "dwarf-4", score: 10, reason: "Worked together carving the grand entrance hall." },
    ],
  };
}

export function performGuildAction(
  state: GameState,
  action: GuildAction
): { nextState: GameState; success: boolean } {
  if (action.type === "ACCEPT_COMMISSION") {
    const commission = state.guild.commissions.find((c) => c.id === action.id);
    if (!commission || commission.status !== "OFFERED") {
      return { nextState: state, success: false };
    }
    const nextCommissions = state.guild.commissions.map((c) =>
      c.id === action.id ? { ...c, status: "ACTIVE" as const } : c
    );
    return {
      nextState: {
        ...state,
        guild: { ...state.guild, commissions: nextCommissions },
      },
      success: true,
    };
  }

  if (action.type === "DELIVER_COMMISSION") {
    const commission = state.guild.commissions.find((c) => c.id === action.id);
    if (!commission || commission.status !== "ACTIVE") {
      return { nextState: state, success: false };
    }
    const { resource, amount } = commission.requirement;
    if ((state.resources[resource] ?? 0) < amount) {
      return { nextState: state, success: false };
    }

    const templateKey = commission.reward.relic || "CROWN_OF_EMBER";
    const template = RELIC_TEMPLATES[templateKey] || RELIC_TEMPLATES.CROWN_OF_EMBER;

    const newRelic: Relic = {
      id: `relic-${Date.now()}`,
      template: templateKey,
      name: template.name,
      discoveredBy: `Royal Guild (${commission.patron} Charter)`,
      discoveredAt: state.ticks,
      mode: "STORED",
      history: [
        {
          tick: state.ticks,
          text: `Charter "${commission.title}" completed; awarded by ${commission.patron}.`,
        },
      ],
    };

    const nextResources = {
      ...state.resources,
      [resource]: state.resources[resource] - amount,
      wealth: state.resources.wealth + commission.reward.wealth,
    };

  const currentFavor = state.guild.favor[commission.patron] || 0;
  const nextFavorVal = Math.min(100, currentFavor + commission.reward.favor);
  const nextFavor = {
    ...state.guild.favor,
    [commission.patron]: nextFavorVal,
  };

  const nextCivilizations = state.world.civilizations.map((civ) => {
    if (civ.race !== commission.patron) return civ;
    const nextStance: Civilization["stance"] =
      nextFavorVal >= 30
        ? "Allied"
        : nextFavorVal >= 15
          ? "Trade Partner"
          : civ.stance;
    return { ...civ, stance: nextStance };
  });

  const nextCommissions = state.guild.commissions.map((c) =>
    c.id === action.id ? { ...c, status: "COMPLETED" as const } : c
  );

  return {
    nextState: {
      ...state,
      world: {
        ...state.world,
        civilizations: nextCivilizations,
      },
      resources: nextResources,
      guild: {
        ...state.guild,
        favor: nextFavor,
        commissions: nextCommissions,
        relics: [...state.guild.relics, newRelic],
      },
    },
    success: true,
  };
}

  if (action.type === "SET_RELIC_MODE") {
    const relic = state.guild.relics.find((r) => r.id === action.id);
    if (!relic || relic.mode === "GIFTED") {
      return { nextState: state, success: false };
    }

    const nextRelics = state.guild.relics.map((r) => {
      if (r.id === action.id) {
        return {
          ...r,
          mode: action.mode,
          ownerId: action.mode === "EQUIPPED" ? action.ownerId : undefined,
          history: [
            ...r.history,
            {
              tick: state.ticks,
              text:
                action.mode === "EQUIPPED"
                  ? `Equipped by ${state.dwarves.find((d) => d.id === action.ownerId)?.name || "pioneer"}.`
                  : `Moved to ${action.mode.toLowerCase()}.`,
            },
          ],
        };
      }
      // If equipping, unequip any existing relic for this dwarf
      if (action.mode === "EQUIPPED" && r.ownerId === action.ownerId) {
        return { ...r, mode: "STORED" as const, ownerId: undefined };
      }
      return r;
    });

    return {
      nextState: {
        ...state,
        guild: { ...state.guild, relics: nextRelics },
      },
      success: true,
    };
  }

  if (action.type === "GIFT_RELIC") {
    const relic = state.guild.relics.find((r) => r.id === action.id);
    if (!relic || relic.mode === "GIFTED") {
      return { nextState: state, success: false };
    }

    const currentFavor = state.guild.favor[action.patron] || 0;
    const nextFavorVal = Math.min(100, currentFavor + 15);
    const nextFavor = {
      ...state.guild.favor,
      [action.patron]: nextFavorVal,
    };

    const nextCivilizations = state.world.civilizations.map((civ) => {
      if (civ.race !== action.patron) return civ;
      const nextStance: Civilization["stance"] =
        nextFavorVal >= 30
          ? "Allied"
          : nextFavorVal >= 15
            ? "Trade Partner"
            : civ.stance;
      return { ...civ, stance: nextStance };
    });

    const nextRelics = state.guild.relics.map((r) =>
      r.id === action.id
        ? {
            ...r,
            mode: "GIFTED" as const,
            ownerId: undefined,
            giftedTo: action.patron,
            history: [
              ...r.history,
              {
                tick: state.ticks,
                text: `Gifted to the ${action.patron} for +15 diplomatic favor.`,
              },
            ],
          }
        : r
    );

    return {
      nextState: {
        ...state,
        world: {
          ...state.world,
          civilizations: nextCivilizations,
        },
        guild: {
          ...state.guild,
          favor: nextFavor,
          relics: nextRelics,
        },
      },
      success: true,
    };
  }

  return { nextState: state, success: false };
}

/**
 * Apply dwarf quirk modifiers to combat effectiveness.
 * Returns multipliers for attack and defense.
 */
export function getQuirkCombatModifiers(quirk: DwarfQuirk | undefined): {
  attackMultiplier: number;
  defenseMultiplier: number;
} {
  if (!quirk) return { attackMultiplier: 1.0, defenseMultiplier: 1.0 };

  switch (quirk) {
    case 'HOTHEAD':
      return { attackMultiplier: 1.25, defenseMultiplier: 0.9 };
    case 'IRON_BORN':
      return { attackMultiplier: 1.15, defenseMultiplier: 1.05 };
    case 'DEEP_MINER':
      return { attackMultiplier: 1.05, defenseMultiplier: 1.1 };
    default:
      return { attackMultiplier: 1.0, defenseMultiplier: 1.0 };
  }
}

/**
 * Apply dwarf quirk modifiers to work speed.
 * Returns a speed multiplier (higher = faster).
 */
export function getQuirkWorkSpeed(
  quirk: DwarfQuirk | undefined,
  labor: string,
  depth: number
): number {
  if (!quirk) return 1.0;

  switch (quirk) {
    case 'DEEP_MINER':
      if (labor === 'MINING' && depth >= 2) {
        return 1.25;
      }
      if (labor === 'MINING') {
        return 1.1;
      }
      return 1.0;
    case 'IRON_BORN':
      if (labor === 'SMITHING') {
        return 1.2;
      }
      return 1.0;
    case 'SCHOLAR':
      if (labor === 'FARMING') {
        return 1.15;
      }
      return 0.95;
    default:
      return 1.0;
  }
}

/**
 * Apply dwarf quirk modifiers to morale.
 * Returns a morale delta based on fortress conditions.
 */
export function getQuirkMoraleModifier(
  quirk: DwarfQuirk | undefined,
  resources: FortressResources,
  depth: number,
  tavernCount: number
): number {
  if (!quirk) return 0;

  switch (quirk) {
    case 'GREEDY':
      if (resources.wealth >= 1000) {
        return 5;
      }
      return -3;
    case 'DEEP_MINER':
      if (depth >= 2) {
        return 3;
      }
      return -2;
    case 'DRUNKARD':
      if (tavernCount > 0) {
        return 4;
      }
      return -3;
    case 'LONER':
      return 0; // No penalty for being alone
    default:
      return 0;
  }
}

/**
 * Apply dwarf quirk modifiers to production value.
 * Returns a multiplier for wealth generated from crafted goods.
 */
export function getQuirkProductionModifier(
  quirk: DwarfQuirk | undefined,
  workshop: string
): number {
  if (!quirk) return 1.0;

  switch (quirk) {
    case 'IRON_BORN':
      if (workshop === 'WORKSHOP_FORGE' || workshop === 'WORKSHOP_SMELTER') {
        return 1.2;
      }
      return 1.0;
    default:
      return 1.0;
  }
}

const SEASONAL_COMMISSION_TEMPLATES: ReadonlyArray<{
  title: string;
  description: string;
  patron: Civilization["race"];
  resource: keyof FortressResources;
  baseAmount: number;
  baseWealth: number;
  favor: number;
  relic: string;
}> = [
  {
    title: "Dressed Stone for the Royal Bastion",
    description: "Supply quarried stone blocks to reinforce the Mountainhome citadel.",
    patron: "Dwarves",
    resource: "stone",
    baseAmount: 35,
    baseWealth: 420,
    favor: 20,
    relic: "ANCIENT_PICK",
  },
  {
    title: "Masterwork Furnishings for the High Hall",
    description: "Deliver carved coffers and thrones for the royal council chambers.",
    patron: "Dwarves",
    resource: "furniture",
    baseAmount: 8,
    baseWealth: 550,
    favor: 25,
    relic: "RUNIC_ANVIL",
  },
  {
    title: "Tempered Steel Ingots for Frontier Watch",
    description: "Provide smelted steel bars to outfit the northern human watchtowers.",
    patron: "Humans",
    resource: "steelBars",
    baseAmount: 6,
    baseWealth: 600,
    favor: 25,
    relic: "HORN_OF_VALOR",
  },
  {
    title: "Vintage Cavern Ale for the Sylvan Feast",
    description: "Send casks of aged mushroom ale to the elven diplomatic envoy.",
    patron: "Elves",
    resource: "ale",
    baseAmount: 30,
    baseWealth: 480,
    favor: 20,
    relic: "MITHRIL_CHALICE",
  },
  {
    title: "Plate Mail & Arms for the Iron Legion",
    description: "Deliver forged armor suits for the sovereign shield-host.",
    patron: "Humans",
    resource: "armor",
    baseAmount: 4,
    baseWealth: 750,
    favor: 30,
    relic: "CROWN_OF_EMBER",
  },
  {
    title: "Bullion Tribute of the Deep Seams",
    description: "Present unrefined gold ore to the Royal Mint scribes.",
    patron: "Goblins",
    resource: "goldOre",
    baseAmount: 6,
    baseWealth: 850,
    favor: 25,
    relic: "CHRONICLE_CODEX",
  },
];

/**
 * Expire past-deadline commissions and replenish seasonal royal charters when
 * fewer than 2 offered commissions remain.
 */
export function refreshSeasonalCommissions(
  guild: GuildState,
  ticks: number,
  year: number
): { nextGuild: GuildState; addedTitle: string | null } {
  let changed = false;
  const updatedCommissions = guild.commissions.map((c) => {
    if ((c.status === "OFFERED" || c.status === "ACTIVE") && ticks >= c.deadline) {
      changed = true;
      return { ...c, status: "EXPIRED" as const };
    }
    return c;
  });

  const openOffers = updatedCommissions.filter((c) => c.status === "OFFERED");
  let addedTitle: string | null = null;

  if (openOffers.length < 2) {
    const tierScale = Math.max(1, 1 + Math.floor((year - 251) * 0.25));
    const tplIdx = (ticks / 120 + updatedCommissions.length) % SEASONAL_COMMISSION_TEMPLATES.length;
    const tpl = SEASONAL_COMMISSION_TEMPLATES[Math.floor(tplIdx)];
    const newComm: Commission = {
      id: `comm-season-${ticks}-${updatedCommissions.length + 1}`,
      title: tpl.title,
      description: tpl.description,
      patron: tpl.patron,
      requirement: {
        resource: tpl.resource,
        amount: Math.round(tpl.baseAmount * tierScale),
      },
      reward: {
        wealth: Math.round(tpl.baseWealth * tierScale),
        favor: tpl.favor,
        relic: tpl.relic,
      },
      deadline: ticks + 960,
      status: "OFFERED",
    };
    updatedCommissions.push(newComm);
    addedTitle = newComm.title;
    changed = true;
  }

  if (!changed) return { nextGuild: guild, addedTitle: null };
  return {
    nextGuild: {
      ...guild,
      commissions: updatedCommissions,
    },
    addedTitle,
  };
}
