import { initializeGuild, stepGuild, makeNamedRelic, workProgressBonus, combatBonus, addRelationship } from './guild.ts';
import { initializeActivities, stepActivities } from './activities.ts';
import { getResearchBonuses } from './research.ts';
import { getFestivalWorkBonus } from './festivals.ts';
import { adjacent, reachableRoutes } from './navigation.ts';
import { MAX_POPULATION, MAX_SEED_LENGTH, TRAP_DAMAGE, validResourceMap, EXPORT_VALUES, IMPORT_VALUES, tradeValues } from './game-rules.ts';
import type {
  ChronicleEntry,
  DesignationType,
  DwarfEntity,
  DwarfLabor,
  FortressAlert,
  FortressResources,
  GameState,
  HostileEntity,
  LaborPresetId,
  MilitiaDoctrine,
  NarrativeEvent,
  NarrativeEventSeverity,
  StratumScanSummary,
  Tile,
  TileTerrain,
  WorkOrder,
} from './types.ts';
import {
  createInitialCavernHostiles,
  createInitialDwarves,
  generateDeterministicWorldMeta,
  generateMultiLevelGrid,
  getTerrainVisuals,
} from './world-gen.ts';

export function getSeasonModifiers(season: GameState['season']): {
  cropMultiplier: number;
  needDecayInterval: number;
  raidChance: number;
  summary: string;
} {
  switch (season) {
    case 'Granite (Spring)':
      return {
        cropMultiplier: 1.25,
        needDecayInterval: 9,
        raidChance: 0.15,
        summary: '+25% Spring Harvest · Mild Weather',
      };
    case 'Slate (Summer)':
      return {
        cropMultiplier: 1.25,
        needDecayInterval: 8,
        raidChance: 0.35,
        summary: '+25% Summer Growth · Clear Skies',
      };
    case 'Sands (Autumn)':
      return {
        cropMultiplier: 1.5,
        needDecayInterval: 8,
        raidChance: 0.5,
        summary: '+50% Autumn Harvest · Caravan Season',
      };
    case 'Timber (Winter)':
      return {
        cropMultiplier: 0.75,
        needDecayInterval: 6,
        raidChance: 0.75,
        summary: 'Winter Frost (-25% Crops · Faster Hunger)',
      };
  }
}

export function scanWorldStrata(state: GameState): StratumScanSummary[] {
  return state.world.strata.map((st) => {
    const z = st.zLevel;
    const level = state.grid[z] || [];
    let ironTiles = 0;
    let goldTiles = 0;
    let mithrilTiles = 0;
    let relicTiles = 0;

    for (let y = 0; y < level.length; y++) {
      const row = level[y];
      for (let x = 0; x < row.length; x++) {
        const t = row[x].terrain;
        if (t === 'IRON_VEIN' || t === 'COPPER_VEIN') ironTiles++;
        else if (t === 'GOLD_VEIN') goldTiles++;
        else if (t === 'MITHRIL_VEIN') mithrilTiles++;
        else if (t === 'CAVERN_RELIC') relicTiles++;
      }
    }

    const hostiles = (state.hostiles || []).filter((h) => h.z === z).length;
    const dwarves = state.dwarves.filter((d) => d.z === z).length;

    return {
      zLevel: z,
      name: st.name,
      ironTiles,
      goldTiles,
      mithrilTiles,
      relicTiles,
      hostiles,
      dwarves,
    };
  });
}

export function applyLaborPreset(state: GameState, preset: LaborPresetId): GameState {
  const updatedDwarves: DwarfEntity[] = state.dwarves.map((d, idx) => {
    let labors: Record<DwarfLabor, boolean>;
    switch (preset) {
      case 'MINING_DELVE':
        labors = {
          MINING: true,
          WOODCUTTING: idx % 3 === 0,
          MASONRY: true,
          CARPENTRY: false,
          FARMING: idx === 3,
          SMITHING: false,
          COMBAT: Boolean(d.weaponEquipped),
          HAULING: true,
        };
        break;
      case 'SMITH_FORTIFY':
        labors = {
          MINING: idx % 2 === 0,
          WOODCUTTING: false,
          MASONRY: true,
          CARPENTRY: true,
          FARMING: idx === 3,
          SMITHING: true,
          COMBAT: true,
          HAULING: true,
        };
        break;
      case 'HARVEST_BREW':
        labors = {
          MINING: false,
          WOODCUTTING: true,
          MASONRY: false,
          CARPENTRY: true,
          FARMING: true,
          SMITHING: false,
          COMBAT: Boolean(d.weaponEquipped),
          HAULING: true,
        };
        break;
      case 'ALL_HANDS':
      default:
        labors = {
          MINING: true,
          WOODCUTTING: true,
          MASONRY: true,
          CARPENTRY: true,
          FARMING: true,
          SMITHING: true,
          COMBAT: true,
          HAULING: true,
        };
        break;
    }
    return {
      ...d,
      labors,
      thought: `Reassigned to ${preset.replace('_', ' ')} clan duty.`,
    };
  });

  const entry: ChronicleEntry = {
    id: `chron-preset-${state.ticks}-${Math.random().toString(36).slice(2, 6)}`,
    tick: state.ticks,
    season: state.season,
    year: state.year,
    text: `Applied "${preset.replace('_', ' ')}" labor preset across all ${updatedDwarves.length} dwarves.`,
    type: 'INFO',
  };

  return {
    ...state,
    dwarves: updatedDwarves,
    chronicle: [entry, ...state.chronicle.slice(0, 59)],
  };
}

export function spawnGoblinRaid(state: GameState): GameState {
  const goblinCiv = state.world.civilizations[3]?.name || 'The Fang Scourge';
  const spawnX = Math.max(2, state.world.width - 4);
  const spawnY = Math.max(3, Math.floor(state.world.height / 2) - 2);

  const newHostiles: HostileEntity[] = [
    {
      id: `raider-gob-${state.ticks}-1`,
      name: 'Snagtooth Goblin Pikeman',
      kind: 'GOBLIN_RAIDER',
      char: 'g',
      color: '#ff0000',
      x: spawnX,
      y: spawnY,
      z: 0,
      hp: 40,
      maxHp: 40,
      attack: 7,
      behavior: 'RAID_SEEK',
    },
    {
      id: `raider-gob-${state.ticks}-2`,
      name: 'Skargash Lasher',
      kind: 'GOBLIN_RAIDER',
      char: 'g',
      color: '#ff9900',
      x: spawnX - 1,
      y: Math.min(state.world.height - 3, spawnY + 2),
      z: 0,
      hp: 35,
      maxHp: 35,
      attack: 6,
      behavior: 'FLANK_PATROL',
    },
  ];

  if (state.resources.wealth >= 850) {
    newHostiles.push({
      id: `raider-troll-${state.ticks}`,
      name: 'Armored War-Troll',
      kind: 'TROLL_BREAKER',
      char: 'T',
      color: '#ff0000',
      x: spawnX,
      y: Math.max(2, spawnY - 2),
      z: 0,
      hp: 75,
      maxHp: 75,
      attack: 12,
      behavior: 'RAID_SEEK',
    });
  }

  const alert: FortressAlert = {
    id: `alert-raid-${state.ticks}`,
    tick: state.ticks,
    title: `GOBLIN RAID (${newHostiles.length} hostiles)`,
    severity: 'DANGER',
    x: spawnX,
    y: spawnY,
    z: 0,
  };

  const entry: ChronicleEntry = {
    id: `chron-raid-${state.ticks}`,
    tick: state.ticks,
    season: state.season,
    year: state.year,
    text: `[ALERT] War horns of ${goblinCiv}! ${newHostiles.length} raiders spotted at (${spawnX}, ${spawnY}, Z-0)!`,
    type: 'COMBAT',
  };

  return {
    ...state,
    hostiles: [...(state.hostiles || []), ...newHostiles],
    alerts: [alert, ...(state.alerts || []).slice(0, 14)],
    chronicle: [entry, ...state.chronicle.slice(0, 59)],
  };
}

export function executeTradeBarter(
  state: GameState,
  give: Partial<FortressResources>,
  receive: Partial<FortressResources>,
  recruitMigrant = false
): GameState {
  const depot = state.grid[0].some((row) => row.some((tile) => tile.terrain === 'TRADE_DEPOT'));
  const values = tradeValues(give, receive, recruitMigrant, depot);
  if (!validResourceMap(give) || !validResourceMap(receive) ||
      Object.keys(give).some((key) => !(key in EXPORT_VALUES)) ||
      Object.keys(receive).some((key) => !(key in IMPORT_VALUES)) ||
      values.offered <= 0 || values.requested <= 0 || values.offered < values.requested ||
      (recruitMigrant && state.dwarves.length >= MAX_POPULATION) || !hasResources(state.resources, give)) {
    return state;
  }

  const resources: FortressResources = { ...state.resources };
  for (const [k, v] of Object.entries(give)) {
    const key = k as keyof FortressResources;
    resources[key] = Math.max(0, (resources[key] || 0) - (v || 0));
  }
  for (const [k, v] of Object.entries(receive)) {
    const key = k as keyof FortressResources;
    resources[key] = (resources[key] || 0) + (v || 0);
  }
  resources.wealth += 45;

  const dwarves: DwarfEntity[] = state.dwarves.map((d) => ({
    ...d,
    happiness: Math.min(100, d.happiness + 4),
    thought: 'Pleased by brisk bartering at the Trade Depot.',
  }));

  if (recruitMigrant && dwarves.length < MAX_POPULATION) {
    const cx = Math.floor(state.world.width / 2);
    const cy = Math.floor(state.world.height / 2);
    const idx = dwarves.length + 1;
    dwarves.push({
      id: `dwarf-${idx}`,
      name: `Thikut Caravan-${idx}`,
      title: 'Recruited Caravan Specialist',
      char: '☺',
      color: '#00ffff',
      x: cx,
      y: cy,
      z: 0,
      hp: 100,
      maxHp: 100,
      hunger: 95,
      thirst: 95,
      energy: 95,
      happiness: 90,
      state: 'IDLE',
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
      thought: `Joined ${state.world.dwarvenName} via Trade Depot charter!`,
      weaponEquipped: resources.weapons > 0 ? (resources.weapons--, true) : false,
      armorEquipped: resources.armor > 0 ? (resources.armor--, true) : false,
      kills: 0,
      skills: { MINING: 2, SMITHING: 2, COMBAT: 2, HAULING: 2 },
    });
  }

  const entry: ChronicleEntry = {
    id: `chron-barter-${state.ticks}-${Math.random().toString(36).slice(2, 6)}`,
    tick: state.ticks,
    season: state.season,
    year: state.year,
    text: `Completed Trade Depot barter exchange (+45 Wealth${recruitMigrant ? ', +1 Migrant Pioneer' : ''}).`,
    type: 'CRAFT',
  };

  return initializeGuild({
    ...state,
    resources,
    dwarves,
    chronicle: [entry, ...state.chronicle.slice(0, 59)],
  });
}

export function generateContextAwareEvent(
  state: GameState,
  severityOverride?: NarrativeEventSeverity
): NarrativeEvent {
  const { world, resources, dwarves, ticks, eventHistory } = state;
  const dwarfCiv = world.civilizations[0]?.name || `The Mountainhome of ${world.dwarvenName}`;
  const elfCiv = world.civilizations[1]?.name || 'The Emerald Canopy';
  const goblinCiv = world.civilizations[3]?.name || 'The Fang Scourge';
  const leadDwarf = dwarves[ticks % dwarves.length] || dwarves[0];

  const avgMorale = Math.round(
    dwarves.reduce((sum, d) => sum + d.happiness, 0) / Math.max(1, dwarves.length)
  );
  const lastDecision = eventHistory[0];

  let chosenSeverity: NarrativeEventSeverity;
  let triggerReason = `Simulation State: Year ${state.year} (${state.season}), Wealth ${resources.wealth}, Population ${dwarves.length}, Clan Morale ${avgMorale}%`;

  if (severityOverride) {
    chosenSeverity = severityOverride;
    triggerReason = `Storyteller Focus (${severityOverride.replace('_', ' ')}) · Wealth ${resources.wealth} · Pop ${dwarves.length} · Morale ${avgMorale}%`;
  } else if (resources.food < 25 || resources.ale < 20) {
    chosenSeverity = 'TRADE_CARAVAN';
    triggerReason = `Low Provisions Alert (Food: ${resources.food}, Ale: ${resources.ale}) attracted an emergency supply caravan`;
  } else if (resources.wealth >= 750 && (ticks + eventHistory.length) % 3 === 0) {
    chosenSeverity = 'MAJOR_CRISIS';
    triggerReason = `High Fortress Wealth (${resources.wealth}) drew the envy of ${goblinCiv} scouts`;
  } else {
    const severities: NarrativeEventSeverity[] = [
      'TRADE_CARAVAN',
      'STRANGE_MOOD',
      'DIPLOMATIC_ENVOY',
      'MINOR_OMEN',
      'MAJOR_CRISIS',
    ];
    chosenSeverity = severities[(ticks + eventHistory.length) % severities.length];
    if (lastDecision) {
      triggerReason += ` · Following "${lastDecision.chosenLabel}"`;
    }
  }

  if (!severityOverride && chosenSeverity === 'MAJOR_CRISIS' && !world.civilizations.some((c) => c.race === 'Goblins' && c.stance === 'Hostile')) chosenSeverity = 'MINOR_OMEN';

  switch (chosenSeverity) {
    case 'STRANGE_MOOD':
      return {
        id: `evt-mood-${ticks}-${eventHistory.length}`,
        title: `Fey Mood: ${leadDwarf.name} Claims a Forge!`,
        severity: 'STRANGE_MOOD',
        asciiArt: [
          '   .---.   *  . ',
          '  /     \\  *    ',
          ' | () () |  [!] ',
          '  \\  ^  /  ╔═══╗',
          '   |||||   ║ ⚒ ║',
        ].join('\n'),
        narrative: `${leadDwarf.name} (${leadDwarf.title}) has been seized by a fey mood, muttering verses from the ${world.history[0]?.title || 'Age of Myth'}. They demand raw stone, timber, and metallic ore to forge a legendary artifact for ${world.dwarvenName}!`,
        historicalConnection: `Echoes the Year 212 forging of Kogan-Ur in ${dwarfCiv}.`,
        triggerReason,
        tickTriggered: ticks,
        choices: [
          {
            id: 'supply-artifact',
            label: 'Grant Finest Materials (4 Stone, 2 Wood, 2 Iron)',
            description: 'Supply prized ore and stone so they complete a legendary masterwork weapon and relic.',
            cost: { stone: 4, wood: 2, ironOre: 2 },
            reward: { weapons: 2, relics: 1, wealth: 350 },
            moraleDelta: 12,
            outcomeLog: `${leadDwarf.name} forged a Masterwork Runed Battleaxe & Relic (+2 Weapons, +1 Relic, +350 Wealth)!`,
          },
          {
            id: 'modest-materials',
            label: 'Provide Modest Stone & Ale (3 Stone, 2 Ale)',
            description: 'Guide their trance toward a sturdy stone statue for the grand hall.',
            cost: { stone: 3, ale: 2 },
            reward: { furniture: 1, wealth: 140 },
            moraleDelta: 5,
            outcomeLog: `${leadDwarf.name} carved an Intricate Dolomite Statue (+140 Wealth).`,
          },
          {
            id: 'restrain-mood',
            label: 'Soothe with Ale & Rest (No Material Cost)',
            description: 'Calm the artisan before they exhaust themselves in the workshop.',
            reward: { stone: 2 },
            moraleDelta: -3,
            outcomeLog: `${leadDwarf.name} awoke from the trance unharmed, though wistful for the unmade artifact.`,
          },
        ],
      };

    case 'TRADE_CARAVAN':
      return {
        id: `evt-caravan-${ticks}-${eventHistory.length}`,
        title: `Merchant Caravan from ${dwarfCiv}`,
        severity: 'TRADE_CARAVAN',
        asciiArt: [
          '   __n__n__    [≡≡≡] ',
          '  /        \\___/   \\ ',
          '  |  O    O   |  ☺  |',
          ' ==(o)====(o)==(o)=(o)',
        ].join('\n'),
        narrative: `Heavy iron-shod wagons flying the banner of ${world.civilizations[0]?.ruler || 'King Urist'} have rumbled into the surface clearing! The outpost liaison offers provisions, casks of aged ale, steel ingots, and hardy mountain migrants in exchange for fortress crafts.`,
        historicalConnection: `Fulfilling the Charter of the Seven Pioneers signed in Year 250.`,
        triggerReason,
        tickTriggered: ticks,
        choices: [
          {
            id: 'trade-crafts',
            label: 'Export Stone & Crafts for Supplies + Migrant (6 Stone)',
            description: 'Trade carved stone for rich food, dwarven ale, and welcome a new pioneer!',
            cost: { stone: 6 },
            reward: { food: 18, ale: 15, steelBars: 2, wealth: 90 },
            moraleDelta: 8,
            spawnMigrants: 1,
            outcomeLog: `Traded stone with ${dwarfCiv} for 18 Food, 15 Ale, 2 Steel Bars, and welcomed a new Dwarf pioneer!`,
          },
          {
            id: 'gift-hospitality',
            label: 'Host Feast for Caravan Guards (4 Food, 4 Ale)',
            description: 'Share fortress hospitality to earn royal tribute and gold bullion.',
            cost: { food: 4, ale: 4 },
            reward: { goldOre: 3, weapons: 1, wealth: 160 },
            moraleDelta: 6,
            stanceChange: { race: 'Dwarves', stance: 'Allied' },
            outcomeLog: `Caravan guards praised ${world.dwarvenName} and gifted 3 Gold Ore & 1 Weapon (+160 Wealth)!`,
          },
          {
            id: 'tax-tolls',
            label: 'Accept Standard Charter Stipend (Free)',
            description: 'Receive the crown’s baseline supply crate without trading stockpiles.',
            reward: { food: 6, ale: 6, wood: 4 },
            moraleDelta: 2,
            outcomeLog: `Unloaded royal supply crate (+6 Food, +6 Ale, +4 Wood).`,
          },
        ],
      };

    case 'DIPLOMATIC_ENVOY':
      return {
        id: `evt-envoy-${ticks}-${eventHistory.length}`,
        title: `Sylvan Timber Envoy from ${elfCiv}`,
        severity: 'DIPLOMATIC_ENVOY',
        asciiArt: [
          '    ♠   /\\   ♠   ',
          '   /|\\ (  ) /|\\  ',
          '    |   ||   |   ',
          '   ~~~~~~~~~~~~  ',
        ].join('\n'),
        narrative: `Draped in livingfeather cloaks, diplomats of ${world.civilizations[1]?.ruler || 'Druid-Queen Saelin'} have stepped from the forest edge. Having observed your surface axes, they invoke the Year 149 Timber Treaty and propose a pact.`,
        historicalConnection: `Directly invokes the Year 149 Timber Treaty of Luth-bel.`,
        triggerReason,
        tickTriggered: ticks,
        choices: [
          {
            id: 'honor-canopy',
            label: 'Sign Canopy Accord & Trade Stone (4 Stone)',
            description: 'Exchange unworked stone for exotic sun-berry harvests and living timber.',
            cost: { stone: 4 },
            reward: { food: 16, wood: 10, wealth: 80 },
            moraleDelta: 5,
            stanceChange: { race: 'Elves', stance: 'Allied' },
            outcomeLog: `Sealed Canopy Accord with ${elfCiv} (+16 Food, +10 Wood, +80 Wealth, Elves Allied).`,
          },
          {
            id: 'assert-sovereignty',
            label: 'Assert Dwarven Logging Rights (Free)',
            description: 'Remind the emissaries that all surface timber within the charter belongs to the anvil.',
            reward: { wood: 12, wealth: 45 },
            moraleDelta: 4,
            stanceChange: { race: 'Elves', stance: 'Neutral' },
            outcomeLog: `Asserted Dwarven charter rights and stacked +12 Timber in the yard.`,
          },
        ],
      };

    case 'MAJOR_CRISIS':
      return {
        id: `evt-crisis-${ticks}-${eventHistory.length}`,
        title: `Siege Vanguard of ${goblinCiv}!`,
        severity: 'MAJOR_CRISIS',
        asciiArt: [
          '   /\\  /\\   ⚔   /\\  /\\ ',
          '  (  o_o ) === ( o_o  )',
          '   /|  |\\       /|  |\\ ',
          '  =======================',
        ].join('\n'),
        narrative: `War horns echo across the crags! Outriders of ${world.civilizations[3]?.ruler || 'Warlord Snagtooth'} have spotted the rising wealth of ${world.dwarvenName} (${resources.wealth} Wealth). They demand a tribute of iron and ale, or threaten to storm the surface gate!`,
        historicalConnection: `Escalation of the long-standing hostility with ${goblinCiv}.`,
        triggerReason,
        tickTriggered: ticks,
        choices: [
          {
            id: 'fortify-ambush',
            label: 'Sally Forth & Drop Deadfall Traps (4 Stone, 2 Iron)',
            description: 'Arm the militia and drop stone deadfall traps on the raiders, seizing their war-chest!',
            cost: { stone: 4, ironOre: 2 },
            reward: { goldOre: 3, ironOre: 4, weapons: 1, wealth: 240 },
            moraleDelta: 10,
            outcomeLog: `Routed the vanguard of ${goblinCiv} and captured their war-chest (+240 Wealth)!`,
          },
          {
            id: 'seal-stairwell',
            label: 'Raise the Drawbridge & Outlast Siege (3 Food, 3 Ale)',
            description: 'Barricade the surface entrance and feast underground until the raiders disperse.',
            cost: { food: 3, ale: 3 },
            reward: { stone: 8, wealth: 75 },
            moraleDelta: 3,
            outcomeLog: `Outlasted the surface raiders while delving +8 Stone underground.`,
          },
          {
            id: 'pay-tribute',
            label: 'Toss Decoy Casks to Distract Raiders (Free)',
            description: 'Lure the goblins away from the entrance with spare provisions.',
            reward: { stone: 4 },
            moraleDelta: -2,
            outcomeLog: `Distracted the raiding party without bloodshed (+4 Stone).`,
          },
        ],
      };

    case 'MINOR_OMEN':
    default:
      return {
        id: `evt-omen-${ticks}-${eventHistory.length}`,
        title: 'Geothermal Shimmer in the Deep Strata',
        severity: 'MINOR_OMEN',
        asciiArt: [
          '  ░░░░░░░░░░░░░░░ ',
          '  ▒▒▒  * $ *  ▒▒▒ ',
          '  ▓▓▓   £££   ▓▓▓ ',
        ].join('\n'),
        narrative: `While sounding the rock walls with iron picks, miners felt a warm resonance rising from the subterranean strata. A fissure has exposed a pocket of glistening mineral crystals and subterranean mushrooms!`,
        historicalConnection: `Linked to the cooling titan-forges of the Age of Myth.`,
        triggerReason,
        tickTriggered: ticks,
        choices: [
          {
            id: 'excavate-fissure',
            label: 'Shore Up & Excavate the Crystal Seam (2 Wood)',
            description: 'Brace the tunnel roof with timber beams to extract all the ore safely.',
            cost: { wood: 2 },
            reward: { ironOre: 4, goldOre: 2, stone: 6, wealth: 150 },
            moraleDelta: 6,
            outcomeLog: `Extracted a rich seam of 4 Iron Ore, 2 Gold Ore, and 6 Stone (+150 Wealth)!`,
          },
          {
            id: 'harvest-spores',
            label: 'Harvest the Cavern Plump Helmets (Free)',
            description: 'Gather the giant subterranean mushrooms flourishing near the warm vent.',
            reward: { food: 12, ale: 6, wealth: 40 },
            moraleDelta: 4,
            outcomeLog: `Harvested +12 Plump Helmets and brewed +6 Casks of Cavern Ale!`,
          },
        ],
      };
  }
}

export function resolveNarrativeEvent(
  state: GameState,
  choiceId: string
): GameState {
  const active = state.activeEvent;
  if (!active) return state;

  const choice = active.choices.find((c) => c.id === choiceId);
  if (!choice || !hasResources(state.resources, choice.cost) ||
      (choice.reward && !validResourceMap(choice.reward)) ||
      (choice.spawnMigrants !== undefined && (!Number.isInteger(choice.spawnMigrants) || choice.spawnMigrants < 0 || choice.spawnMigrants > 5)) ||
      dwarvesWouldOverflow(state, choice.spawnMigrants || 0)) return state;

  const resources: FortressResources = { ...state.resources };

  if (choice.cost) {
    for (const [k, v] of Object.entries(choice.cost)) {
      const key = k as keyof FortressResources;
      resources[key] = Math.max(0, (resources[key] || 0) - (v || 0));
    }
  }

  if (choice.reward) {
    for (const [k, v] of Object.entries(choice.reward)) {
      const key = k as keyof FortressResources;
      resources[key] = (resources[key] || 0) + (v || 0);
    }
  }

  const moraleDelta = choice.moraleDelta || 0;
  const dwarves: DwarfEntity[] = state.dwarves.map((d) => ({
    ...d,
    happiness: Math.max(10, Math.min(100, d.happiness + moraleDelta)),
    thought:
      moraleDelta >= 0
        ? `Heartened by our decision during "${active.title}".`
        : `Concerned by recent events: "${active.title}".`,
  }));

  for (let migrant = 0; migrant < (choice.spawnMigrants || 0); migrant++) {
    const cx = Math.floor(state.world.width / 2);
    const cy = Math.floor(state.world.height / 2);
    const migrantIndex = dwarves.length + 1;
    dwarves.push({
      id: `dwarf-${migrantIndex}`,
      name: `Bomrek Migrant-${migrantIndex}`,
      title: 'Arrived Artisan & Miner',
      char: '☺',
      color: '#34d399',
      x: cx,
      y: cy,
      z: 0,
      hp: 100,
      maxHp: 100,
      hunger: 95,
      thirst: 95,
      energy: 95,
      happiness: 90,
      state: 'IDLE',
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
      thought: `Proud to join the thriving halls of ${state.world.dwarvenName}!`,
      weaponEquipped: resources.weapons > 0 ? (resources.weapons--, true) : false,
      armorEquipped: resources.armor > 0 ? (resources.armor--, true) : false,
      kills: 0,
      skills: { MINING: 2, MASONRY: 2, SMITHING: 1, HAULING: 2 },
    });
  }

  const updatedCivilizations = choice.stanceChange
    ? state.world.civilizations.map((civ) =>
        civ.race === choice.stanceChange?.race
          ? { ...civ, stance: choice.stanceChange.stance }
          : civ
      )
    : state.world.civilizations;

  const categoryMap: Record<NarrativeEventSeverity, 'ARTIFACT' | 'FOUNDING' | 'WAR' | 'DISCOVERY'> = {
    STRANGE_MOOD: 'ARTIFACT',
    TRADE_CARAVAN: 'FOUNDING',
    DIPLOMATIC_ENVOY: 'FOUNDING',
    MAJOR_CRISIS: 'WAR',
    MINOR_OMEN: 'DISCOVERY',
  };

  const updatedHistory = [
    {
      year: state.year,
      era: 'Age of Anvils' as const,
      title: active.title,
      description: choice.outcomeLog,
      category: categoryMap[active.severity] || 'DISCOVERY',
    },
    ...state.world.history,
  ];

  const resolvedEvent: NarrativeEvent = {
    ...active,
    resolved: true,
    chosenLabel: choice.label,
    outcomeSummary: choice.outcomeLog,
  };

  const newChronicleEntry: ChronicleEntry = {
    id: `chron-evt-${state.ticks}-${Math.random().toString(36).slice(2, 6)}`,
    tick: state.ticks,
    season: state.season,
    year: state.year,
    text: `[EVENT] ${active.title} → ${choice.outcomeLog}`,
    type: 'LORE',
  };

  return initializeGuild({
    ...state,
    guild: { ...state.guild, relics: [...state.guild.relics, ...Array.from({ length: Math.min(20, choice.reward?.relics || 0) }, (_, i) => makeNamedRelic(state.world.seed, state.guild.relics.length + i, state.ticks, "The Overseer", active.title))] },
    world: {
      ...state.world,
      civilizations: updatedCivilizations,
      history: updatedHistory,
    },
    resources,
    dwarves,
    activeEvent: null,
    eventHistory: [resolvedEvent, ...state.eventHistory.slice(0, 29)],
    chronicle: [newChronicleEntry, ...state.chronicle.slice(0, 59)],
  });
}

function dwarvesWouldOverflow(state: GameState, migrants: number) {
  return state.dwarves.length + migrants > MAX_POPULATION;
}

export function createInitialGameState(seed = 'Khazad-251'): GameState {
  if (seed.length > MAX_SEED_LENGTH) throw new Error(`Seed must be at most ${MAX_SEED_LENGTH} characters.`);
  const world = generateDeterministicWorldMeta(seed, 76, 42, 6);
  const grid = generateMultiLevelGrid(world);
  const centerX = Math.floor(world.width / 2);
  const centerY = Math.floor(world.height / 2);
  const dwarves = createInitialDwarves(centerX, centerY);
  const hostiles = createInitialCavernHostiles(world.width, world.height, seed);

  // Locate Z-3 relic tile for initial discovery alert
  let relicX = Math.max(4, centerX - 8);
  let relicY = Math.min(world.height - 5, centerY + 6);
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (grid[3]?.[y]?.[x]?.terrain === 'CAVERN_RELIC') {
        relicX = x;
        relicY = y;
        break;
      }
    }
  }

  const initialAlerts: FortressAlert[] = [
    {
      id: 'alert-init-vein',
      tick: 0,
      title: 'RICH SURFACE IRON SEAM',
      severity: 'INFO',
      x: centerX + 7,
      y: centerY,
      z: 0,
    },
    {
      id: 'alert-init-relic',
      tick: 0,
      title: 'ANCIENT CAVERN RELIC (☼)',
      severity: 'DISCOVERY',
      x: relicX,
      y: relicY,
      z: 3,
    },
    {
      id: 'alert-init-spider',
      tick: 0,
      title: 'CAVERN SPIDER DEN',
      severity: 'WARN',
      x: hostiles[0]?.x || centerX - 7,
      y: hostiles[0]?.y || centerY + 5,
      z: 3,
    },
  ];

  const initialChronicle: ChronicleEntry[] = [
    {
      id: 'chron-1',
      tick: 0,
      season: 'Granite (Spring)',
      year: 251,
      text: `Seven dwarven pioneers have arrived at ${world.dwarvenName}. Strike the earth!`,
      type: 'LORE',
    },
    {
      id: 'chron-2',
      tick: 0,
      season: 'Granite (Spring)',
      year: 251,
      text: `Tip: Use [ ? INSPECT ] to examine tiles/dwarves, or build a Smeltery & Forge to arm your militia.`,
      type: 'INFO',
    },
  ];

  return initializeActivities(initializeGuild({
    id: `fort-${crypto.randomUUID()}`,
    world,
    grid,
    dwarves,
    hostiles,
    alerts: initialAlerts,
    militiaDoctrine: 'DEFENSIVE' as MilitiaDoctrine,
    resources: {
      stone: 25,
      wood: 20,
      ironOre: 4,
      goldOre: 0,
      steelBars: 2,
      food: 60,
      ale: 45,
      furniture: 4,
      weapons: 2,
      armor: 1,
      relics: 0,
      wealth: 520,
    },
    workOrders: [
      {
        id: 'order-1',
        title: 'Brew Dwarven Ale (+5 Ale)',
        workshop: 'WORKSHOP_STILL',
        cost: { food: 2 },
        produce: { ale: 5, wealth: 25 },
        remaining: 3,
        autoRepeat: true,
      },
      {
        id: 'order-2',
        title: 'Smelt Pig-Iron & Steel (+2 Bars)',
        workshop: 'WORKSHOP_SMELTER',
        cost: { ironOre: 2, wood: 1 },
        produce: { steelBars: 2, wealth: 45 },
        remaining: 2,
        autoRepeat: true,
      },
      {
        id: 'order-3',
        title: 'Forge Runed Battleaxe & Mail',
        workshop: 'WORKSHOP_FORGE',
        cost: { steelBars: 2 },
        produce: { weapons: 1, armor: 1, wealth: 95 },
        remaining: 2,
        autoRepeat: false,
      },
      {
        id: 'order-4',
        title: 'Craft Stone Coffer & Table',
        workshop: 'WORKSHOP_MASON',
        cost: { stone: 3 },
        produce: { furniture: 2, wealth: 40 },
        remaining: 2,
        autoRepeat: false,
      },
    ],
    chronicle: initialChronicle,
    activeEvent: null,
    eventHistory: [],
    ticks: 0,
    year: 251,
    season: 'Granite (Spring)',
    paused: false,
    speed: 1,
  }));
}

export function canDesignateTile(tile: Tile, type: DesignationType): boolean {
  if (type === 'CANCEL') return Boolean(tile.designation);

  const isWallOrVein =
    tile.terrain === 'ROCK_WALL' ||
    tile.terrain === 'LIMESTONE_WALL' ||
    tile.terrain === 'GRANITE_WALL' ||
    tile.terrain === 'SOIL' ||
    tile.terrain === 'IRON_VEIN' ||
    tile.terrain === 'COPPER_VEIN' ||
    tile.terrain === 'GOLD_VEIN' ||
    tile.terrain === 'MITHRIL_VEIN';

  switch (type) {
    case 'MINE':
      return isWallOrVein;
    case 'STAIRS':
      return isWallOrVein || tile.terrain === 'ROCK_FLOOR' || tile.terrain === 'GRASS';
    case 'CHOP':
      return tile.terrain === 'TREE';
    case 'GATHER':
      return tile.terrain === 'SHRUB';
    case 'RECLAIM_RELIC':
      return tile.terrain === 'CAVERN_RELIC';
    case 'STOCKPILE':
    case 'BUILD_WALL':
    case 'BUILD_DOOR':
    case 'BUILD_TRAP':
    case 'BUILD_BED':
    case 'BUILD_MASON':
    case 'BUILD_CARPENTER':
    case 'BUILD_STILL':
    case 'BUILD_SMELTER':
    case 'BUILD_FORGE':
    case 'BUILD_TAVERN':
    case 'BUILD_TEMPLE':
    case 'BUILD_DEPOT':
    case 'BUILD_FARM':
      return ['ROCK_FLOOR', 'GRASS', 'SAND', 'SHRUB'].includes(tile.terrain);
    default:
      return false;
  }
}

export function getRequiredLabor(type: DesignationType): DwarfLabor {
  switch (type) {
    case 'MINE':
    case 'STAIRS':
      return 'MINING';
    case 'CHOP':
      return 'WOODCUTTING';
    case 'GATHER':
    case 'BUILD_FARM':
    case 'BUILD_STILL':
    case 'BUILD_TAVERN':
      return 'FARMING';
    case 'BUILD_WALL':
    case 'BUILD_DOOR':
    case 'BUILD_TRAP':
    case 'BUILD_MASON':
    case 'BUILD_TEMPLE':
      return 'MASONRY';
    case 'BUILD_BED':
    case 'BUILD_CARPENTER':
    case 'BUILD_DEPOT':
      return 'CARPENTRY';
    case 'BUILD_SMELTER':
    case 'BUILD_FORGE':
      return 'SMITHING';
    case 'RECLAIM_RELIC':
    case 'STOCKPILE':
    default:
      return 'HAULING';
  }
}

export function getConstructionCost(type: DesignationType): Partial<FortressResources> {
  switch (type) {
    case 'BUILD_WALL':
      return { stone: 2 };
    case 'BUILD_DOOR':
      return { stone: 1 };
    case 'BUILD_TRAP':
      return { stone: 2 };
    case 'BUILD_BED':
      return { wood: 2 };
    case 'BUILD_MASON':
      return { stone: 4 };
    case 'BUILD_CARPENTER':
      return { wood: 4 };
    case 'BUILD_STILL':
      return { stone: 3, wood: 2 };
    case 'BUILD_SMELTER':
      return { stone: 4 };
    case 'BUILD_FORGE':
      return { stone: 4, ironOre: 1 };
    case 'BUILD_TAVERN':
      return { stone: 3, wood: 3 };
    case 'BUILD_TEMPLE':
      return { stone: 5 };
    case 'BUILD_DEPOT':
      return { stone: 4, wood: 4 };
    case 'BUILD_FARM':
      return { food: 1 };
    default:
      return {};
  }
}

export function hasResources(
  resources: FortressResources,
  cost?: Partial<FortressResources>
): boolean {
  if (!cost) return true;
  if (!validResourceMap(cost)) return false;
  for (const [k, v] of Object.entries(cost)) {
    const key = k as keyof FortressResources;
    if ((resources[key] || 0) < (v || 0)) return false;
  }
  return true;
}

export function applyAreaDesignation(
  state: GameState,
  z: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  type: DesignationType
): { nextState: GameState; count: number } {
  const minX = Math.max(0, Math.min(x1, x2));
  const maxX = Math.min(state.world.width - 1, Math.max(x1, x2));
  const minY = Math.max(0, Math.min(y1, y2));
  const maxY = Math.min(state.world.height - 1, Math.max(y1, y2));

  if (z < 0 || z >= state.world.depth) {
    return { nextState: state, count: 0 };
  }

  let count = 0;
  const newGrid = state.grid.map((level, lz) => {
    if (lz !== z) return level;
    return level.map((row, y) => {
      if (y < minY || y > maxY) return row;
      return row.map((tile, x) => {
        if (x < minX || x > maxX) return tile;
        if (!canDesignateTile(tile, type)) return tile;
        count++;
        return {
          ...tile,
          designation: type === 'CANCEL' ? undefined : type,
        };
      });
    });
  });

  if (count === 0) return { nextState: state, count: 0 };

  const actionLabel: Record<DesignationType, string> = {
    MINE: 'Mining excavation',
    CHOP: 'Timber felling',
    GATHER: 'Plant foraging',
    STAIRS: 'Stairwell carving',
    STOCKPILE: 'Stockpile zoning',
    RECLAIM_RELIC: 'Ancient relic recovery',
    BUILD_WALL: 'Stone wall construction',
    BUILD_DOOR: 'Portal door installation',
    BUILD_TRAP: 'Stone deadfall trap',
    BUILD_BED: 'Dormitory bed placement',
    BUILD_MASON: "Mason's workshop site",
    BUILD_CARPENTER: "Carpenter's workshop site",
    BUILD_STILL: "Brewer's still site",
    BUILD_SMELTER: 'Smeltery furnace site',
    BUILD_FORGE: 'Metalsmith forge site',
    BUILD_TAVERN: 'Hearth tavern hall site',
    BUILD_TEMPLE: 'Ancestral temple altar site',
    BUILD_DEPOT: 'Seasonal trade depot site',
    BUILD_FARM: 'Subterranean Plump Helmet plot',
    CANCEL: 'Cleared designations',
  };

  const newEntry: ChronicleEntry = {
    id: `chron-${state.ticks}-${Math.random().toString(36).slice(2, 6)}`,
    tick: state.ticks,
    season: state.season,
    year: state.year,
    text: `${actionLabel[type]} designated across ${count} tile${count > 1 ? 's' : ''} at Depth Z-${z}.`,
    type: 'INFO',
  };

  return {
    nextState: {
      ...state,
      grid: newGrid,
      chronicle: [newEntry, ...state.chronicle.slice(0, 59)],
    },
    count,
  };
}

function revealAround(grid: Tile[][][], z: number, x: number, y: number, radius = 2) {
  const height = grid[z].length;
  const width = grid[z][0].length;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const ny = y + dy;
      const nx = x + dx;
      if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
        grid[z][ny][nx].revealed = true;
      }
    }
  }
}

function setTileTerrain(tile: Tile, terrain: TileTerrain) {
  const vis = getTerrainVisuals(terrain);
  tile.terrain = terrain;
  tile.char = vis.char;
  tile.fg = vis.fg;
  tile.bg = vis.bg;
  tile.walkable = vis.walkable;
  tile.designation = undefined;
}

export function stepSimulationTick(state: GameState): GameState {
  const researchBonuses = getResearchBonuses(state);
  const festivalWorkBonus = getFestivalWorkBonus(state);
  const nextTicks = state.ticks + 1;
  const seasons: GameState['season'][] = [
    'Granite (Spring)',
    'Slate (Summer)',
    'Sands (Autumn)',
    'Timber (Winter)',
  ];
  const seasonIdx = Math.floor((nextTicks / 120) % 4);
  const nextSeason = seasons[seasonIdx];
  const nextYear = 251 + Math.floor(nextTicks / 480);
  const seasonMods = getSeasonModifiers(nextSeason);

  const grid: Tile[][][] = state.grid.map((level) =>
    level.map((row) => row.map((tile) => ({ ...tile })))
  );
  const resources: FortressResources = {
    stone: state.resources.stone ?? 25,
    wood: state.resources.wood ?? 20,
    ironOre: state.resources.ironOre ?? 4,
    goldOre: state.resources.goldOre ?? 0,
    steelBars: state.resources.steelBars ?? 0,
    food: state.resources.food ?? 60,
    ale: state.resources.ale ?? 45,
    furniture: state.resources.furniture ?? 4,
    weapons: state.resources.weapons ?? 0,
    armor: state.resources.armor ?? 0,
    relics: state.resources.relics ?? 0,
    wealth: state.resources.wealth ?? 500,
  };
  const chronicle: ChronicleEntry[] = [...state.chronicle];
  const alerts: FortressAlert[] = [...(state.alerts || [])];
  const workOrders: WorkOrder[] = state.workOrders.map((o) => ({ ...o }));
  let hostiles: HostileEntity[] = (state.hostiles || []).map((h) => ({ ...h }));

  const addLog = (text: string, type: ChronicleEntry['type'] = 'WORK') => {
    chronicle.unshift({
      id: `chron-${nextTicks}-${Math.random().toString(36).slice(2, 6)}`,
      tick: nextTicks,
      season: nextSeason,
      year: nextYear,
      text,
      type,
    });
    if (chronicle.length > 60) chronicle.pop();
  };

  const addAlert = (
    title: string,
    severity: FortressAlert['severity'],
    x: number,
    y: number,
    z: number
  ) => {
    alerts.unshift({
      id: `alert-${nextTicks}-${Math.random().toString(36).slice(2, 5)}`,
      tick: nextTicks,
      title,
      severity,
      x,
      y,
      z,
    });
    if (alerts.length > 15) alerts.pop();
  };

  // Count fortress structures for passive buffs and workshop processing
  let farmCount = 0;
  let bedCount = 0;
  let tavernCount = 0;
  let templeCount = 0;
  const builtWorkshops = new Map<TileTerrain, number>();

  for (let z = 0; z < state.world.depth; z++) {
    for (let y = 0; y < state.world.height; y++) {
      for (let x = 0; x < state.world.width; x++) {
        const t = grid[z][y][x].terrain;
        if (t === 'FARM_PLOT') farmCount++;
        else if (t === 'BED') bedCount++;
        else if (t === 'TAVERN_HALL') tavernCount++;
        else if (t === 'TEMPLE_ALTAR') templeCount++;
        else if (
          t === 'WORKSHOP_MASON' ||
          t === 'WORKSHOP_CARPENTER' ||
          t === 'WORKSHOP_STILL' ||
          t === 'WORKSHOP_SMELTER' ||
          t === 'WORKSHOP_FORGE'
        ) {
          builtWorkshops.set(t, (builtWorkshops.get(t) || 0) + 1);
        }
      }
    }
  }

  // Passive farm production every 25 ticks scaled by seasonal multiplier
  if (nextTicks % 25 === 0 && farmCount > 0) {
    const harvested = Math.max(1, Math.round(farmCount * 2 * seasonMods.cropMultiplier)) + farmCount * researchBonuses.foodPerFarm;
    resources.food += harvested;
    resources.wealth += harvested * 3;
    addLog(
      `Harvested ${harvested} Plump Helmets from ${farmCount} farm plots (${nextSeason}).`,
      'WORK'
    );
  }

  // Process active Work Orders every 12 ticks if the corresponding workshop exists
  if (nextTicks % 12 === 0 && workOrders.length > 0) {
    const offset = Math.floor(nextTicks / 12) % workOrders.length;
    for (let i = 0; i < workOrders.length; i++) {
      const order = workOrders[(i + offset) % workOrders.length];
      if (order.remaining <= 0 && !order.autoRepeat) continue;
      if ((builtWorkshops.get(order.workshop) || 0) > 0 && hasResources(resources, order.cost)) {
        builtWorkshops.set(order.workshop, builtWorkshops.get(order.workshop)! - 1);
        for (const [k, v] of Object.entries(order.cost)) {
          const key = k as keyof FortressResources;
          resources[key] = Math.max(0, (resources[key] || 0) - (v || 0));
        }
        for (const [k, v] of Object.entries(order.produce)) {
          const key = k as keyof FortressResources;
          resources[key] = (resources[key] || 0) + (v || 0);
        }
        if (order.autoRepeat) {
          order.remaining = Math.max(1, order.remaining);
        } else {
          order.remaining -= 1;
        }
        addLog(
          `Completed workshop order: ${order.title}${order.autoRepeat ? ' [AUTO]' : ''}.`,
          'CRAFT'
        );
      }
    }
  }

  // Periodic Goblin Raid check when wealth and seasonal pressure align
  if (
    nextTicks > 0 &&
    nextTicks % 85 === 0 &&
    hostiles.filter((h) => h.z === 0).length === 0 &&
    resources.wealth >= 600 &&
    state.world.civilizations.some((c) => c.race === 'Goblins' && c.stance === 'Hostile')
  ) {
    const goblinCiv = state.world.civilizations[3]?.name || 'The Fang Scourge';
    const sx = Math.max(2, state.world.width - 4);
    const sy = Math.max(3, Math.floor(state.world.height / 2));
    hostiles.push({
      id: `raid-gob-${nextTicks}`,
      name: `${goblinCiv} Raider`,
      kind: 'GOBLIN_RAIDER',
      char: 'g',
      color: '#ff0000',
      x: sx,
      y: sy,
      z: 0,
      hp: 40,
      maxHp: 40,
      attack: 7,
      behavior: 'RAID_SEEK',
    });
    addAlert('GOBLIN RAIDER SPOTTED', 'DANGER', sx, sy, 0);
    addLog(`[COMBAT] Outrider of ${goblinCiv} spotted approaching (${sx}, ${sy}, Z-0)!`, 'COMBAT');
  }

  // Step Hostile Entities (movement & stone trap checks)
  const centerX = Math.floor(state.world.width / 2);
  const centerY = Math.floor(state.world.height / 2);

  hostiles = hostiles.filter((h) => {
    if (h.hp <= 0) return false;
    // Move every 2 ticks
    if (nextTicks % 2 === 0) {
      let targetX = centerX;
      let targetY = centerY;

      // Look for nearest dwarf on same Z-level
      let nearestDist = 999;
      for (const d of state.dwarves) {
        if (d.z !== h.z) continue;
        const dist = Math.abs(d.x - h.x) + Math.abs(d.y - h.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          targetX = d.x;
          targetY = d.y;
        }
      }

      if (h.behavior === 'RAID_SEEK' || (h.behavior === 'CAVERN_GUARD' && nearestDist <= 6)) {
        const nx = Math.max(0, Math.min(state.world.width - 1, h.x + Math.sign(targetX - h.x)));
        const ny = Math.max(0, Math.min(state.world.height - 1, h.y + Math.sign(targetY - h.y)));
        const destTile = grid[h.z]?.[ny]?.[nx];
        if (destTile && destTile.walkable) {
          h.x = nx;
          h.y = ny;
        }
      } else if (nextTicks % 4 === 0) {
        const dirs = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 },
        ];
        const d = dirs[(h.x + h.y + nextTicks) % dirs.length];
        const nx = h.x + d.dx;
        const ny = h.y + d.dy;
        const destTile = grid[h.z]?.[ny]?.[nx];
        if (destTile && destTile.walkable) {
          h.x = nx;
          h.y = ny;
        }
      }
    }

    // Check if hostile stepped onto a constructed Stone Deadfall Trap (^)
    const currentTile = grid[h.z]?.[h.y]?.[h.x];
    if (currentTile && currentTile.terrain === 'TRAP_STONE') {
      h.hp -= TRAP_DAMAGE;
      setTileTerrain(currentTile, 'ROCK_FLOOR');
      if (h.hp <= 0) {
        resources.wealth += 50;
        addLog(`Stone deadfall trap crushed ${h.name} at (${h.x}, ${h.y}, Z-${h.z})!`, 'COMBAT');
        return false;
      } else {
        addLog(`Stone trap injured ${h.name} (-40 HP) at (${h.x}, ${h.y}, Z-${h.z})!`, 'COMBAT');
      }
    }

    return h.hp > 0;
  });

  const claimedTargets = new Set<string>();
  state.dwarves.forEach((d) => {
    if (d.currentTask) {
      claimedTargets.add(`${d.currentTask.z}:${d.currentTask.x}:${d.currentTask.y}`);
    }
  });

  // Processed entries point at this tick's mutable copies; unprocessed entries
  // retain their current positions until their turn. Construction must use these
  // positions rather than the stale start-of-tick roster.
  const currentDwarves = new Map<string, DwarfEntity>(state.dwarves.map((d) => [d.id, d]));
  const designatedTiles = grid.flat(2).filter((tile) => tile.designation);
  let namedRelics = state.guild.relics;
  let relationships = state.guild.relationships;
  const nextDwarves: DwarfEntity[] = state.dwarves.map((dwarfRaw) => {
    const dwarf: DwarfEntity = {
      ...dwarfRaw,
      labors: { ...dwarfRaw.labors },
      skills: { ...dwarfRaw.skills },
      currentTask: dwarfRaw.currentTask ? { ...dwarfRaw.currentTask } : undefined,
    };

    currentDwarves.set(dwarf.id, dwarf);

    let routes: ReturnType<typeof reachableRoutes> | undefined;
    const routeTo = (target: { x: number; y: number; z: number; type?: DesignationType; designation?: DesignationType }) => {
      routes ??= reachableRoutes(grid, dwarf);
      return routes.toWorkSite(target, (target.type || target.designation) === 'BUILD_WALL');
    };

    // Auto-equip forged weapons & armor from stockpile onto militia dwarves
    if (!dwarf.weaponEquipped && resources.weapons > 0 && dwarf.labors.COMBAT) {
      resources.weapons -= 1;
      dwarf.weaponEquipped = true;
      dwarf.happiness = Math.min(100, dwarf.happiness + 5);
      dwarf.thought = 'Equipped a newly forged steel battleaxe from the armory!';
    }
    if (!dwarf.armorEquipped && resources.armor > 0 && dwarf.labors.COMBAT) {
      resources.armor -= 1;
      dwarf.armorEquipped = true;
      dwarf.happiness = Math.min(100, dwarf.happiness + 5);
      dwarf.thought = 'Donned forged dwarven mail armor!';
    }

    // Seasonal needs decay
    if (nextTicks % seasonMods.needDecayInterval === 0) {
      dwarf.hunger = Math.max(10, dwarf.hunger - 1);
      dwarf.thirst = Math.max(10, dwarf.thirst - 1);
      dwarf.energy = Math.max(15, dwarf.energy - 1);
    }

    // 1. Check Militia Combat Intercept against Hostiles on the same Z-level
    const engageRadius =
      state.militiaDoctrine === 'SALLY_FORTH'
        ? 40
        : state.militiaDoctrine === 'PATROL'
        ? 14
        : 6;

    if (dwarf.labors.COMBAT || hostiles.some((h) => h.z === dwarf.z && Math.abs(h.x - dwarf.x) + Math.abs(h.y - dwarf.y) <= 2)) {
      let targetHostile: HostileEntity | null = null;
      let bestDist = engageRadius + 1;
      for (const h of hostiles) {
        if (h.z !== dwarf.z || h.hp <= 0) continue;
        const dist = Math.max(Math.abs(h.x - dwarf.x), Math.abs(h.y - dwarf.y));
        if (dist < bestDist && (dist <= 1 || routeTo(h))) {
          bestDist = dist;
          targetHostile = h;
        }
      }

      if (targetHostile) {
        dwarf.currentTask = undefined;
        if (bestDist <= 1) {
          dwarf.state = 'FIGHTING';
          const dmg = (dwarf.weaponEquipped ? 18 : 10) + ((dwarf.skills.COMBAT || 1) * 2) + combatBonus(state, dwarf) + (dwarf.labors.COMBAT ? researchBonuses.combat : 0);
          targetHostile.hp -= dmg;
          const incomingDmg = Math.max(
            1,
            Math.round(targetHostile.attack * (dwarf.armorEquipped ? 0.5 : 1))
          );
          dwarf.hp = Math.max(20, dwarf.hp - incomingDmg);

          if (targetHostile.hp <= 0) {
            for (const ally of state.dwarves) {
              if (ally.id !== dwarf.id && ally.z === dwarf.z && Math.max(Math.abs(ally.x - targetHostile.x), Math.abs(ally.y - targetHostile.y)) <= 4) {
                relationships = addRelationship(relationships, dwarf.id, ally.id, 2, `Stood together against ${targetHostile.name}.`, nextTicks);
              }
            }
            namedRelics = namedRelics.map((r) => r.mode === 'EQUIPPED' && r.ownerId === dwarf.id ? { ...r, history: [...r.history, { tick: nextTicks, text: `${dwarf.name} carried it in victory over ${targetHostile.name}.` }].slice(-20) } : r);
            dwarf.kills = (dwarf.kills || 0) + 1;
            dwarf.skills.COMBAT = (dwarf.skills.COMBAT || 1) + 1;
            dwarf.happiness = Math.min(100, dwarf.happiness + 8);
            dwarf.thought = `Vanquished ${targetHostile.name} in defense of the clan!`;
            resources.wealth += 65;
            resources.ironOre += 1;
            addLog(
              `[VICTORY] ${dwarf.name} slew ${targetHostile.name} at (${targetHostile.x}, ${targetHostile.y}, Z-${dwarf.z}) (+65 Wealth)!`,
              'COMBAT'
            );
          } else {
            dwarf.thought = `Trading blows with ${targetHostile.name}!`;
          }
          return dwarf;
        } else {
          dwarf.state = 'MOVING';
          const route = routeTo(targetHostile);
          if (route) Object.assign(dwarf, route.first);
          else { dwarf.state = 'IDLE'; dwarf.thought = 'No safe route to the hostile.'; }
          return dwarf;
        }
      }
    }

    // 2. Thirst & Tavern Buff
    if (dwarf.thirst < 32 && resources.ale > 0) {
      resources.ale = Math.max(0, resources.ale - 1);
      dwarf.thirst = Math.min(100, dwarf.thirst + 58);
      const tavernBonus = (tavernCount > 0 ? 12 : 6) + (dwarf.quirk === 'ALE_LOVER' ? 4 : 0);
      if (dwarf.quirk === 'ALE_LOVER' && resources.ale > 0) resources.ale--;
      dwarf.happiness = Math.min(100, dwarf.happiness + tavernBonus);
      if (tavernCount > 0) {
        dwarf.energy = Math.min(100, dwarf.energy + 10);
      }
      dwarf.state = 'DRINKING';
      dwarf.thought =
        tavernCount > 0
          ? 'Shared a roaring mug of ale and song in the Hearth Tavern!'
          : 'Quaffed a mug of rich Dwarven Ale. Praise the miners!';
      return dwarf;
    }

    // 3. Hunger
    if (dwarf.hunger < 32 && resources.food > 0) {
      resources.food = Math.max(0, resources.food - 1);
      dwarf.hunger = Math.min(100, dwarf.hunger + 58);
      dwarf.happiness = Math.min(100, dwarf.happiness + 5);
      dwarf.state = 'EATING';
      dwarf.thought = 'Ate a savoury Plump Helmet roast.';
      return dwarf;
    }

    // 4. Energy & Dormitory Bed Rest
    if (dwarf.energy < 28) {
      dwarf.state = 'SLEEPING';
      dwarf.energy = Math.min(100, dwarf.energy + (bedCount > 0 ? 50 : 28));
      dwarf.hp = Math.min(dwarf.maxHp, dwarf.hp + 10);
      if (bedCount > 0) {
        dwarf.happiness = Math.min(100, dwarf.happiness + 6);
        dwarf.thought = 'Rested soundly in a sturdy dwarven dormitory bed.';
      } else {
        dwarf.thought = 'Caught a brief nap on the stone floor.';
      }
      return dwarf;
    }

    // 5. Temple Meditation when Morale dips
    if (dwarf.happiness < 70 && templeCount > 0 && nextTicks % 6 === 0) {
      dwarf.state = 'PRAYING';
      dwarf.happiness = Math.min(100, dwarf.happiness + 12);
      dwarf.thought = 'Received ancestral blessing at the Runed Temple Altar.';
      return dwarf;
    }

    if (dwarf.currentTask) {
      const targetTile = grid[dwarf.currentTask.z]?.[dwarf.currentTask.y]?.[dwarf.currentTask.x];
      if (!targetTile || targetTile.designation !== dwarf.currentTask.type ||
          !dwarf.labors[getRequiredLabor(dwarf.currentTask.type)] || !routeTo(dwarf.currentTask)) {
        claimedTargets.delete(`${dwarf.currentTask.z}:${dwarf.currentTask.x}:${dwarf.currentTask.y}`);
        dwarf.currentTask = undefined;
        dwarf.state = 'IDLE';
      }
    }

    if (!dwarf.currentTask) {
      let bestCandidate: { x: number; y: number; z: number; type: DesignationType; dist: number } | null = null;

      for (const t of designatedTiles) {
        const { x, y, z } = t;
        if (!t.designation || claimedTargets.has(`${z}:${x}:${y}`)) continue;
        if (!dwarf.labors[getRequiredLabor(t.designation)] || !hasResources(resources, getConstructionCost(t.designation))) continue;
        const route = routeTo(t);
        if (route && (!bestCandidate || route.distance < bestCandidate.dist)) {
          bestCandidate = { x, y, z, type: t.designation, dist: route.distance };
        }
      }

      if (bestCandidate) {
        claimedTargets.add(`${bestCandidate.z}:${bestCandidate.x}:${bestCandidate.y}`);
        dwarf.currentTask = {
          x: bestCandidate.x,
          y: bestCandidate.y,
          z: bestCandidate.z,
          type: bestCandidate.type,
          progress: 0,
          totalTicks: 2,
        };
        dwarf.state = 'MOVING';
      } else {
        dwarf.state = 'IDLE';
        if (designatedTiles.length) dwarf.thought = 'Work waiting: no available reachable job for my labors and materials.';
        if (nextTicks % 5 === 0) {
          const dirs = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
          ];
          const d = dirs[(dwarf.x + dwarf.y + nextTicks) % dirs.length];
          const nx = dwarf.x + d.dx;
          const ny = dwarf.y + d.dy;
          const nt = grid[dwarf.z]?.[ny]?.[nx];
          if (nt && nt.walkable && nt.designation !== 'BUILD_WALL') {
            dwarf.x = nx;
            dwarf.y = ny;
          }
        }
        return dwarf;
      }
    }

    const task = dwarf.currentTask;
    if (!task) return dwarf;

    if (!adjacent(dwarf, task) || (task.type === 'BUILD_WALL' && dwarf.x === task.x && dwarf.y === task.y)) {
      const route = routeTo(task);
      if (route) {
        dwarf.state = 'MOVING';
        Object.assign(dwarf, route.first);
        revealAround(grid, dwarf.z, dwarf.x, dwarf.y, 2);
      } else {
        claimedTargets.delete(`${task.z}:${task.x}:${task.y}`);
        dwarf.currentTask = undefined;
        dwarf.state = 'IDLE';
        dwarf.thought = 'Work blocked: no connected, walkable route.';
      }
      return dwarf;
    }

    dwarf.state = 'WORKING';
    const labor = getRequiredLabor(task.type);
    task.progress += 1 + workProgressBonus(state, dwarf, labor) + (labor === 'MINING' ? researchBonuses.mining : 0) + festivalWorkBonus;
    if (dwarf.quirk === 'STONEWISE' && (labor === 'MINING' || labor === 'MASONRY')) dwarf.energy = Math.max(15, dwarf.energy - 1);

    if (task.progress >= task.totalTicks) {
      const targetTile = grid[task.z][task.y][task.x];
      const cost = getConstructionCost(task.type);

      if (hasResources(resources, cost) && !(task.type === 'BUILD_WALL' && [...currentDwarves.values()].some((d) => d.x === task.x && d.y === task.y && d.z === task.z))) {
        for (const [k, v] of Object.entries(cost)) {
          const key = k as keyof FortressResources;
          resources[key] -= v || 0;
        }

        const prevTerrain = targetTile.terrain;
        switch (task.type) {
          case 'MINE': {
            if (prevTerrain === 'IRON_VEIN' || prevTerrain === 'COPPER_VEIN') {
              resources.ironOre += 3;
              resources.stone += 1;
              resources.wealth += 35;
              addLog(`${dwarf.name} struck rich metallic ore at (${task.x}, ${task.y}, Z-${task.z})!`, 'WORK');
            } else if (prevTerrain === 'GOLD_VEIN' || prevTerrain === 'MITHRIL_VEIN') {
              resources.goldOre += 3;
              resources.steelBars += prevTerrain === 'MITHRIL_VEIN' ? 1 : 0;
              resources.wealth += 120;
              addAlert(
                prevTerrain === 'MITHRIL_VEIN' ? 'STAR-MITHRIL UNEARTHED' : 'GOLD SEAM MINED',
                'DISCOVERY',
                task.x,
                task.y,
                task.z
              );
              addLog(
                `${dwarf.name} unearthed precious ${prevTerrain === 'MITHRIL_VEIN' ? 'Star-Mithril' : 'Native Gold'}!`,
                'LORE'
              );
            } else {
              resources.stone += 3;
              resources.wealth += 10;
            }
            setTileTerrain(targetTile, 'ROCK_FLOOR');
            revealAround(grid, task.z, task.x, task.y, 3);
            dwarf.thought = 'Satisfied by the ring of steel against living rock.';
            break;
          }
          case 'RECLAIM_RELIC': {
            const relic = makeNamedRelic(state.world.seed, namedRelics.length, nextTicks, dwarf.name, `recovered at (${task.x}, ${task.y}, Z-${task.z})`);
            namedRelics = [...namedRelics, relic];
            resources.relics += 1;
            resources.wealth += 300;
            setTileTerrain(targetTile, 'ROCK_FLOOR');
            revealAround(grid, task.z, task.x, task.y, 4);
            dwarf.happiness = Math.min(100, dwarf.happiness + 15);
            dwarf.thought = 'Recovered an Ancient Dwarven Relic from the deep caverns!';
            addAlert('CAVERN RELIC RECLAIMED', 'DISCOVERY', task.x, task.y, task.z);
            addLog(
              `[RELIC] ${dwarf.name} reclaimed ${relic.name} at (${task.x}, ${task.y}, Z-${task.z}) (+1 Relic, +300 Wealth)!`,
              'LORE'
            );
            break;
          }
          case 'STAIRS': {
            resources.stone += 2;
            resources.wealth += 15;
            setTileTerrain(targetTile, 'STAIRS_UP_DOWN');
            revealAround(grid, task.z, task.x, task.y, 3);
            if (task.z + 1 < state.world.depth) {
              const belowTile = grid[task.z + 1][task.y][task.x];
              setTileTerrain(belowTile, 'STAIRS_UP_DOWN');
              revealAround(grid, task.z + 1, task.x, task.y, 3);
            }
            addLog(`${dwarf.name} carved a stairwell connecting Depth Z-${task.z} and Z-${task.z + 1}.`, 'WORK');
            break;
          }
          case 'CHOP': {
            resources.wood += 4;
            resources.wealth += 12;
            setTileTerrain(targetTile, 'GRASS');
            dwarf.thought = 'Felled a towering timber trunk for the fortress.';
            addLog(`${dwarf.name} felled timber (+4 Wood).`, 'WORK');
            break;
          }
          case 'GATHER': {
            resources.food += 4;
            resources.wealth += 12;
            setTileTerrain(targetTile, 'GRASS');
            addLog(`${dwarf.name} gathered wild surface berries and tubers (+4 Food).`, 'WORK');
            break;
          }
          case 'STOCKPILE': {
            setTileTerrain(targetTile, 'STOCKPILE_TILE');
            break;
          }
          case 'BUILD_WALL': {
            setTileTerrain(targetTile, 'CONSTRUCTED_WALL');
            resources.wealth += 20;
            break;
          }
          case 'BUILD_DOOR': {
            setTileTerrain(targetTile, 'DOOR');
            resources.wealth += 25;
            break;
          }
          case 'BUILD_TRAP': {
            setTileTerrain(targetTile, 'TRAP_STONE');
            resources.wealth += 30;
            addLog(`${dwarf.name} armed a Stone Deadfall Trap at (${task.x}, ${task.y}, Z-${task.z}).`, 'CRAFT');
            break;
          }
          case 'BUILD_BED': {
            setTileTerrain(targetTile, 'BED');
            resources.furniture += 1;
            resources.wealth += 35;
            dwarf.thought = 'Built a fine wooden bed for the clan.';
            break;
          }
          case 'BUILD_MASON': {
            setTileTerrain(targetTile, 'WORKSHOP_MASON');
            resources.wealth += 65;
            addLog(`${dwarf.name} erected a Mason's Workshop.`, 'CRAFT');
            break;
          }
          case 'BUILD_CARPENTER': {
            setTileTerrain(targetTile, 'WORKSHOP_CARPENTER');
            resources.wealth += 65;
            addLog(`${dwarf.name} erected a Carpenter's Workshop.`, 'CRAFT');
            break;
          }
          case 'BUILD_STILL': {
            setTileTerrain(targetTile, 'WORKSHOP_STILL');
            resources.wealth += 80;
            addLog(`${dwarf.name} constructed a Brewer's Still! Ale production ready.`, 'CRAFT');
            break;
          }
          case 'BUILD_SMELTER': {
            setTileTerrain(targetTile, 'WORKSHOP_SMELTER');
            resources.wealth += 95;
            addAlert('SMELTERY FURNACE LIT', 'INFO', task.x, task.y, task.z);
            addLog(`${dwarf.name} ignited a Smeltery Furnace at (${task.x}, ${task.y}, Z-${task.z})!`, 'CRAFT');
            break;
          }
          case 'BUILD_FORGE': {
            setTileTerrain(targetTile, 'WORKSHOP_FORGE');
            resources.wealth += 110;
            addAlert('METALSMITH FORGE READY', 'INFO', task.x, task.y, task.z);
            addLog(`${dwarf.name} erected a Metalsmith's Forge! Armory crafting unlocked.`, 'CRAFT');
            break;
          }
          case 'BUILD_TAVERN': {
            setTileTerrain(targetTile, 'TAVERN_HALL');
            resources.wealth += 90;
            addLog(`${dwarf.name} inaugurated a Hearth Tavern Hall (+Morale & Song)!`, 'CRAFT');
            break;
          }
          case 'BUILD_TEMPLE': {
            setTileTerrain(targetTile, 'TEMPLE_ALTAR');
            resources.wealth += 110;
            addLog(`${dwarf.name} consecrated an Ancestral Temple Altar (+Clan Serenity)!`, 'LORE');
            break;
          }
          case 'BUILD_DEPOT': {
            setTileTerrain(targetTile, 'TRADE_DEPOT');
            resources.wealth += 100;
            addAlert('TRADE DEPOT OPENED', 'INFO', task.x, task.y, task.z);
            addLog(`${dwarf.name} built a Seasonal Trade Depot for merchant caravans!`, 'CRAFT');
            break;
          }
          case 'BUILD_FARM': {
            setTileTerrain(targetTile, 'FARM_PLOT');
            resources.wealth += 30;
            addLog(`${dwarf.name} furrowed a Plump Helmet Farm Plot.`, 'WORK');
            break;
          }
        }
      }

      claimedTargets.delete(`${task.z}:${task.x}:${task.y}`);
      dwarf.currentTask = undefined;
      dwarf.state = 'IDLE';
    }

    return dwarf;
  });

  // Remove defeated hostiles
  hostiles = hostiles.filter((h) => h.hp > 0);

  // Trigger emergent narrative events every 45 ticks if none is currently awaiting player decision
  let nextActiveEvent = state.activeEvent;
  if (!nextActiveEvent && nextTicks > 0 && nextTicks % 45 === 0) {
    nextActiveEvent = generateContextAwareEvent({
      ...state,
      ticks: nextTicks,
      resources,
      dwarves: nextDwarves,
      hostiles,
      alerts,
    });
    addLog(`[EVENT] ${nextActiveEvent.title} — Awaiting Overseer Decree!`, 'ALERT');
  }

  return stepActivities(stepGuild({
    ...state,
    guild: { ...state.guild, relics: namedRelics, relationships },
    grid,
    dwarves: nextDwarves,
    hostiles,
    alerts,
    resources,
    workOrders,
    chronicle,
    activeEvent: nextActiveEvent,
    ticks: nextTicks,
    year: nextYear,
    season: nextSeason,
  }));
}
