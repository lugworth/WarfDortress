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
  createConfiguredMigrantDwarf,
  createInitialCavernHostiles,
  createInitialDwarves,
  generateDeterministicWorldMeta,
  generateMultiLevelGrid,
  getTerrainVisuals,
} from './world-gen.ts';
import { createInitialGuildState } from './guild.ts';
import { createExpeditionState } from './expeditions.ts';
import { syncBuildingUnlocks, triggerStrangeMood } from './progression.ts';
import {
  appendDwarfThought,
  evaluateAmbientDwarfThoughts,
  withDwarfThought,
} from './thoughts.ts';
import {
  applyWeatherExposureToDwarf,
  canDwarfStepThisTick,
  getCurrentWeather,
  isShelteredOrPavedTile,
} from './weather.ts';
import {
  createDefaultMilitiaState,
  ensureMilitiaState,
  getDwarfSquad,
  getSquadCombatModifiers,
  getSquadOrderDestination,
  performMilitiaAction,
  spawnTacticalGoblinRaid,
} from './militia.ts';


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
        needDecayInterval: 4,
        raidChance: 0.15,
        summary: '+25% Spring Harvest · Balanced Appetite',
      };
    case 'Slate (Summer)':
      return {
        cropMultiplier: 1.2,
        needDecayInterval: 4,
        raidChance: 0.35,
        summary: '+20% Summer Growth · Warm Thirst',
      };
    case 'Sands (Autumn)':
      return {
        cropMultiplier: 1.4,
        needDecayInterval: 4,
        raidChance: 0.5,
        summary: '+40% Autumn Harvest · Caravan Season',
      };
    case 'Timber (Winter)':
      return {
        cropMultiplier: 0.7,
        needDecayInterval: 3,
        raidChance: 0.75,
        summary: 'Winter Frost (-30% Crops · +33% Hunger/Thirst)',
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
  return spawnTacticalGoblinRaid(state);
}

export function executeTradeBarter(
  state: GameState,
  give: Partial<FortressResources>,
  receive: Partial<FortressResources>,
  recruitMigrant = false
): GameState {
  if (!hasResources(state.resources, give)) {
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

  let migrantJoinedNote = '';
  if (recruitMigrant) {
    const newMigrant = createConfiguredMigrantDwarf({
      existingDwarves: dwarves,
      worldWidth: state.world.width,
      worldHeight: state.world.height,
      dwarvenName: state.world.dwarvenName,
      ticks: state.ticks,
      indexOffset: 1,
      originLabel: 'Trade Depot Charter',
      weaponsAvailable: resources.weapons,
      armorAvailable: resources.armor,
    });
    dwarves.push(newMigrant);
    migrantJoinedNote = `, +1 Migrant (${newMigrant.name} — ${newMigrant.title})`;
  }

  const entry: ChronicleEntry = {
    id: `chron-barter-${state.ticks}-${Math.random().toString(36).slice(2, 6)}`,
    tick: state.ticks,
    season: state.season,
    year: state.year,
    text: `Completed Trade Depot barter exchange (+45 Wealth${migrantJoinedNote}).`,
    type: 'CRAFT',
  };

  return {
    ...state,
    resources,
    dwarves,
    chronicle: [entry, ...state.chronicle.slice(0, 59)],
  };
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

  const choice = active.choices.find((c) => c.id === choiceId) || active.choices[0];
  if (!choice) return { ...state, activeEvent: null };

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

  if (choice.spawnMigrants && choice.spawnMigrants > 0) {
    for (let i = 0; i < choice.spawnMigrants; i++) {
      dwarves.push(
        createConfiguredMigrantDwarf({
          existingDwarves: dwarves,
          worldWidth: state.world.width,
          worldHeight: state.world.height,
          dwarvenName: state.world.dwarvenName,
          ticks: state.ticks,
          indexOffset: i + 1,
          originLabel: active.title,
          weaponsAvailable: resources.weapons,
          armorAvailable: resources.armor,
        })
      );
    }
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

  return {
    ...state,
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
  };
}

export function createInitialGameState(seed = 'Khazad-251'): GameState {
  const world = generateDeterministicWorldMeta(seed, 76, 42, 6);
  const grid = generateMultiLevelGrid(world);
  const centerX = Math.floor(world.width / 2);
  const centerY = Math.floor(world.height / 2);
  const rawDwarves = createInitialDwarves(centerX, centerY);
  const initialMilitia = createDefaultMilitiaState(
    rawDwarves,
    world.width,
    world.height
  );
  const shieldSet = new Set(initialMilitia.squads['squad-1'].memberIds);
  const dwarves = rawDwarves.map((d) =>
    shieldSet.has(d.id) ? { ...d, squadId: 'squad-1' as const } : d
  );
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

  return {
    id: `fort-${seed}`,
    world,
    grid,
    dwarves,
    hostiles,
    alerts: initialAlerts,
    militiaDoctrine: 'DEFENSIVE' as MilitiaDoctrine,
    resources: {
      stone: 20,
      wood: 15,
      ironOre: 3,
      goldOre: 0,
      steelBars: 1,
      food: 34,
      ale: 28,
      furniture: 3,
      weapons: 2,
      armor: 1,
      relics: 0,
      wealth: 460,
    },
    workOrders: [
      {
        id: 'order-1',
        title: 'Brew Dwarven Ale (+4 Ale)',
        workshop: 'WORKSHOP_STILL',
        cost: { food: 2 },
        produce: { ale: 4, wealth: 25 },
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
    guild: createInitialGuildState(),
    activities: {
      expeditions: createExpeditionState(),
      militia: initialMilitia,
    },
  };
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
    case 'MILITIA_STATION':
    case 'MILITIA_PATROL':
      return tile.walkable && tile.terrain !== 'STAIRS_UP_DOWN' && tile.terrain !== 'WATER';
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
    MILITIA_STATION: 'Militia squad station post',
    MILITIA_PATROL: 'Militia squad patrol route',
    CANCEL: 'Cleared designations',
  };

  const newEntry: ChronicleEntry = {
    id: `chron-${state.ticks}-${Math.random().toString(36).slice(2, 6)}`,
    tick: state.ticks,
    season: state.season,
    year: state.year,
    text: `${actionLabel[type]} designated across ${count} tile${count > 1 ? 's' : ''} at Depth Z-${z}.`,
    type: type === 'MILITIA_STATION' || type === 'MILITIA_PATROL' ? 'COMBAT' : 'INFO',
  };

  let nextState: GameState = {
    ...state,
    grid: newGrid,
    chronicle: [newEntry, ...state.chronicle.slice(0, 59)],
  };

  if (type === 'MILITIA_STATION' || type === 'MILITIA_PATROL') {
    const militia = ensureMilitiaState(nextState);
    const activeSquadId = militia.activeSquadId;
    const clampedMinX = Math.ceil(minX);
    const clampedMaxX = Math.floor(maxX);
    const clampedMinY = Math.ceil(minY);
    const clampedMaxY = Math.floor(maxY);
    const midX = Math.round((clampedMinX + clampedMaxX) / 2);
    const midY = Math.round((clampedMinY + clampedMaxY) / 2);

    const orderRes = performMilitiaAction(nextState, {
      type: 'ISSUE_SQUAD_ORDER',
      squadId: activeSquadId,
      orderType: type === 'MILITIA_STATION' ? 'STATION' : 'PATROL',
      x: type === 'MILITIA_STATION' ? midX : clampedMinX,
      y: type === 'MILITIA_STATION' ? midY : clampedMinY,
      z,
      x2: type === 'MILITIA_PATROL' ? clampedMaxX : undefined,
      y2: type === 'MILITIA_PATROL' ? clampedMaxY : undefined,
    });
    nextState = {
      ...orderRes.nextState,
      grid: newGrid,
    };
  }

  return {
    nextState,
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
  const nextTicks = state.ticks + 1;
  const seasons: GameState['season'][] = [
    'Granite (Spring)',
    'Slate (Summer)',
    'Sands (Autumn)',
    'Timber (Winter)',
  ];
  const currentSeasonIdx = Math.max(0, seasons.indexOf(state.season));
  const nextSeason =
    nextTicks > 0 && nextTicks % 120 === 0
      ? seasons[(currentSeasonIdx + 1) % 4]
      : state.season;
  const nextYear = 251 + Math.floor(nextTicks / 480);
  const seasonMods = getSeasonModifiers(nextSeason);
  const activeWeather = getCurrentWeather({
    season: nextSeason,
    ticks: nextTicks,
    weatherOverride: state.weatherOverride,
  });


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

  // Count fortress structures for passive buffs, storage capacity, and workshop processing
  let farmCount = 0;
  let bedCount = 0;
  let tavernCount = 0;
  let templeCount = 0;
  let stockpileCount = 0;
  let wallCount = 0;
  let doorCount = 0;
  let depotCount = 0;
  let trapCount = 0;
  const builtWorkshops = new Set<TileTerrain>();

  for (let z = 0; z < state.world.depth; z++) {
    for (let y = 0; y < state.world.height; y++) {
      for (let x = 0; x < state.world.width; x++) {
        const t = grid[z][y][x].terrain;
        if (t === 'FARM_PLOT') farmCount++;
        else if (t === 'BED') bedCount++;
        else if (t === 'TAVERN_HALL') tavernCount++;
        else if (t === 'TEMPLE_ALTAR') templeCount++;
        else if (t === 'STOCKPILE_TILE') stockpileCount++;
        else if (t === 'CONSTRUCTED_WALL') wallCount++;
        else if (t === 'DOOR') doorCount++;
        else if (t === 'TRADE_DEPOT') depotCount++;
        else if (t === 'TRAP_STONE') trapCount++;
        else if (
          t === 'WORKSHOP_MASON' ||
          t === 'WORKSHOP_CARPENTER' ||
          t === 'WORKSHOP_STILL' ||
          t === 'WORKSHOP_SMELTER' ||
          t === 'WORKSHOP_FORGE'
        ) {
          builtWorkshops.add(t);
        }
      }
    }
  }

  const activeFarmers = state.dwarves.filter((d) => d.labors.FARMING).length;
  const activeMasons = state.dwarves.filter((d) => d.labors.MASONRY).length;
  const activeCarpenters = state.dwarves.filter((d) => d.labors.CARPENTRY).length;

  // STOCKPILE_TILE Function: Safe storage capacity + Hauling Logistics Bonus
  const maxSafeFood = 24 + stockpileCount * 8;
  if (nextTicks > 0 && nextTicks % 120 === 0 && resources.food > maxSafeFood) {
    const spoiled = Math.min(4, Math.max(1, Math.ceil((resources.food - maxSafeFood) * 0.25)));
    resources.food = Math.max(0, resources.food - spoiled);
    addLog(
      `[STOCKPILE] ${spoiled} unstored Plump Helmets spoiled at season's turn (Safe cap: ${maxSafeFood}). Zone more Stockpiles [P]!`,
      'ALERT'
    );
  }
  if (nextTicks % 30 === 0 && stockpileCount >= 6) {
    resources.wealth += 15;
    resources.food += 1;
    addLog(
      `[STOCKPILE] Well-organized Stockpile Vault (${stockpileCount} tiles) preserved +1 Food & added +15 Wealth.`,
      'WORK'
    );
  }

  // CONSTRUCTED_WALL Function: Bastion Fortification Dividend & Raid Deterrence
  if (nextTicks % 40 === 0 && wallCount >= 4) {
    const bastionBonus = Math.min(25, wallCount * 3);
    resources.wealth += bastionBonus;
  }

  // FARM_PLOT Function: Passive crop growth every 24 ticks scaled by season & active farmers
  if (nextTicks % 24 === 0 && farmCount > 0) {
    const farmerBonus = activeFarmers > 0 ? Math.min(2, activeFarmers) : 0;
    const baseHarvest =
      activeFarmers > 0
        ? (farmCount * 1.5 + farmerBonus) * seasonMods.cropMultiplier
        : farmCount * 0.65 * seasonMods.cropMultiplier;
    const harvested = Math.max(1, Math.round(baseHarvest));
    resources.food += harvested;
    resources.wealth += harvested * 3;
    addLog(
      `Harvested ${harvested} Plump Helmets from ${farmCount} farm plots (${nextSeason}${
        activeFarmers === 0 ? ' — assign FARMING labor for higher yield!' : ''
      }).`,
      'WORK'
    );
  }

  // WORKSHOP_CARPENTER Function: Passive Joinery (Casks & Beds from surplus timber)
  if (
    nextTicks % 28 === 0 &&
    builtWorkshops.has('WORKSHOP_CARPENTER') &&
    activeCarpenters > 0 &&
    resources.wood >= 6
  ) {
    resources.wood -= 1;
    resources.furniture += 1;
    resources.ale += 1;
    resources.wealth += 25;
    addLog(
      `[CARPENTER] Joined seasoned timber into a sturdy bedframe & ale cask (+1 Furniture, +1 Ale, +25 Wealth).`,
      'CRAFT'
    );
  }

  // WORKSHOP_MASON Function: Passive Stonecraft (Dressed stone blocks & coffers)
  if (
    nextTicks % 28 === 0 &&
    builtWorkshops.has('WORKSHOP_MASON') &&
    activeMasons > 0 &&
    resources.stone >= 7
  ) {
    resources.stone -= 1;
    resources.furniture += 1;
    resources.wealth += 25;
    addLog(
      `[MASON] Carved dressed stone blocks and a coffer at the Mason's Workshop (+1 Furniture, +25 Wealth).`,
      'CRAFT'
    );
  }

  // WORKSHOP_STILL Function: Passive Fermentation when ale runs low
  if (
    nextTicks % 24 === 0 &&
    builtWorkshops.has('WORKSHOP_STILL') &&
    resources.food >= 6 &&
    resources.ale < 28
  ) {
    resources.food -= 1;
    resources.ale += 2;
    resources.wealth += 15;
    addLog(
      `[STILL] Fermented a reserve cask of Plump Helmet Ale (+2 Ale, +15 Wealth).`,
      'CRAFT'
    );
  }

  // TRADE_DEPOT Function: Seasonal Merchant Tolls & Charter Dividends
  if (nextTicks % 30 === 0 && depotCount > 0) {
    resources.wealth += 20 * depotCount;
    resources.food += 1;
    resources.ale += 1;
    addLog(
      `[TRADE DEPOT] Collected merchant caravan tolls (+${20 * depotCount} Wealth, +1 Food, +1 Ale).`,
      'CRAFT'
    );
  }

  // Process active Work Orders every 12 ticks if the corresponding workshop exists
  if (nextTicks % 12 === 0 && workOrders.length > 0) {
    for (const order of workOrders) {
      if (order.remaining <= 0 && !order.autoRepeat) continue;
      if (builtWorkshops.has(order.workshop) && hasResources(resources, order.cost)) {
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
        break;
      }
    }
  }

  // Periodic Goblin Raid check when wealth and seasonal pressure align
  if (
    nextTicks > 0 &&
    nextTicks % 85 === 0 &&
    hostiles.filter((h) => h.z === 0).length === 0 &&
    resources.wealth >= 600
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

  // Step Hostile Entities (movement, DOOR choke-point slowdown, & TRAP_STONE checks)
  const centerX = Math.floor(state.world.width / 2);
  const centerY = Math.floor(state.world.height / 2);

  hostiles = hostiles.filter((h) => {
    if (h.hp <= 0) return false;
    // Move every 2 ticks (or every 4 ticks when slowed by a constructed Portal Door +)
    const onTile = grid[h.z]?.[h.y]?.[h.x];
    const slowedByDoor = onTile?.terrain === 'DOOR' && nextTicks % 4 !== 0;
    if (nextTicks % 2 === 0 && !slowedByDoor) {
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
      h.hp -= 45;
      setTileTerrain(currentTile, 'ROCK_FLOOR');
      if (h.hp <= 0) {
        resources.wealth += 50;
        addLog(`Stone deadfall trap crushed ${h.name} at (${h.x}, ${h.y}, Z-${h.z})!`, 'COMBAT');
        return false;
      } else {
        addLog(`Stone trap injured ${h.name} (-45 HP) at (${h.x}, ${h.y}, Z-${h.z})!`, 'COMBAT');
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

  let nextDwarves: DwarfEntity[] = state.dwarves.map((dwarfRaw) => {
    const dwarf: DwarfEntity = {
      ...dwarfRaw,
      labors: { ...dwarfRaw.labors },
      skills: { ...dwarfRaw.skills },
      thoughtLog: Array.isArray(dwarfRaw.thoughtLog) ? [...dwarfRaw.thoughtLog] : [],
      currentTask: dwarfRaw.currentTask ? { ...dwarfRaw.currentTask } : undefined,
    };

    // Auto-equip forged weapons & armor from stockpile onto militia dwarves
    if (!dwarf.weaponEquipped && resources.weapons > 0 && dwarf.labors.COMBAT) {
      resources.weapons -= 1;
      dwarf.weaponEquipped = true;
      appendDwarfThought(dwarf, {
        tick: nextTicks,
        year: nextYear,
        season: nextSeason,
        text: 'Equipped a newly forged steel battleaxe from the armory!',
        category: 'COMBAT',
        sentiment: 'POSITIVE',
        moraleDelta: 5,
      });
    }
    if (!dwarf.armorEquipped && resources.armor > 0 && dwarf.labors.COMBAT) {
      resources.armor -= 1;
      dwarf.armorEquipped = true;
      appendDwarfThought(dwarf, {
        tick: nextTicks,
        year: nextYear,
        season: nextSeason,
        text: 'Donned forged dwarven mail armor!',
        category: 'COMBAT',
        sentiment: 'POSITIVE',
        moraleDelta: 5,
      });
    }

    // Evaluate ambient sightings (e.g. "saw a terrifying beast"), shortages, and quirk reflections
    evaluateAmbientDwarfThoughts(dwarf, {
      tick: nextTicks,
      year: nextYear,
      season: nextSeason,
      hostiles,
      resources,
      tavernCount,
      templeCount,
    });

    // Evaluate seasonal weather mood & thought impact every 10 ticks
    const currentDwarfTile = grid[dwarf.z]?.[dwarf.y]?.[dwarf.x];
    if (nextTicks > 0 && nextTicks % 10 === 0) {
      applyWeatherExposureToDwarf(dwarf, activeWeather, {
        tick: nextTicks,
        year: nextYear,
        season: nextSeason,
        isSheltered: isShelteredOrPavedTile(currentDwarfTile),
      });
    }

    // Seasonal needs decay + active exertion appetite
    if (nextTicks % seasonMods.needDecayInterval === 0) {
      dwarf.hunger = Math.max(8, dwarf.hunger - 1);
      dwarf.thirst = Math.max(8, dwarf.thirst - 1);
      dwarf.energy = Math.max(12, dwarf.energy - 1);
    }
    if ((dwarf.state === 'WORKING' || dwarf.state === 'FIGHTING') && nextTicks % 8 === 0) {
      dwarf.hunger = Math.max(8, dwarf.hunger - 1);
      dwarf.thirst = Math.max(8, dwarf.thirst - 1);
    }

    // Passive civic hall aura functions: TAVERN_HALL, TEMPLE_ALTAR, and BED comfort
    if (nextTicks % 30 === 0 && tavernCount > 0) {
      dwarf.happiness = Math.min(100, dwarf.happiness + 2);
    }
    if (nextTicks % 32 === 0 && templeCount > 0) {
      dwarf.happiness = Math.min(100, dwarf.happiness + 2);
      dwarf.hp = Math.min(dwarf.maxHp, dwarf.hp + 4);
    }
    if (nextTicks % 35 === 0 && bedCount >= Math.ceil(state.dwarves.length / 2)) {
      dwarf.happiness = Math.min(100, dwarf.happiness + 1);
    }

    // 1. Check Militia Combat Intercept against Hostiles on the same Z-level
    const militiaState = ensureMilitiaState(state);
    const squadMods = getSquadCombatModifiers(state.dwarves, dwarf, militiaState);
    const activeSquad = squadMods.squad;
    const baseDoctrineRadius =
      state.militiaDoctrine === 'SALLY_FORTH'
        ? 40
        : state.militiaDoctrine === 'PATROL'
        ? 14
        : 6;
    const engageRadius =
      activeSquad?.order.type === 'STATION' && activeSquad.order.z === dwarf.z
        ? Math.max(10, baseDoctrineRadius)
        : activeSquad?.order.type === 'PATROL' && activeSquad.order.z === dwarf.z
        ? Math.max(16, baseDoctrineRadius)
        : baseDoctrineRadius;

    if (
      dwarf.labors.COMBAT ||
      Boolean(activeSquad) ||
      hostiles.some((h) => h.z === dwarf.z && Math.abs(h.x - dwarf.x) + Math.abs(h.y - dwarf.y) <= 2)
    ) {
      let targetHostile: HostileEntity | null = null;
      let bestDist = engageRadius + 1;
      for (const h of hostiles) {
        if (h.z !== dwarf.z || h.hp <= 0) continue;
        const dist = Math.max(Math.abs(h.x - dwarf.x), Math.abs(h.y - dwarf.y));
        if (dist < bestDist) {
          bestDist = dist;
          targetHostile = h;
        }
      }

      if (targetHostile) {
        dwarf.currentTask = undefined;
        if (bestDist <= 1) {
          dwarf.state = 'FIGHTING';
          const baseDmg = (dwarf.weaponEquipped ? 18 : 10) + ((dwarf.skills.COMBAT || 1) * 2);
          const dmg = baseDmg + squadMods.cohesionAttackBonus + squadMods.patrolAttackBonus;
          targetHostile.hp -= dmg;
          const wallShield = wallCount >= 4 ? 0.85 : 1;
          const incomingDmg = Math.max(
            1,
            Math.round(
              targetHostile.attack *
                (dwarf.armorEquipped ? 0.5 : 1) *
                wallShield *
                squadMods.stationDefenseMultiplier
            )
          );
          dwarf.hp = Math.max(20, dwarf.hp - incomingDmg);

          if (targetHostile.hp <= 0) {
            dwarf.kills = (dwarf.kills || 0) + 1;
            dwarf.skills.COMBAT = (dwarf.skills.COMBAT || 1) + 1;
            appendDwarfThought(dwarf, {
              tick: nextTicks,
              year: nextYear,
              season: nextSeason,
              text: `Vanquished ${targetHostile.name} in defense of the clan (${squadMods.tacticalNote})!`,
              category: 'COMBAT',
              sentiment: 'EUPHORIC',
              moraleDelta: 8,
            });
            resources.wealth += 65;
            resources.ironOre += 1;
            addLog(
              `[VICTORY] ${dwarf.name} (${squadMods.tacticalNote}) slew ${targetHostile.name} at (${targetHostile.x}, ${targetHostile.y}, Z-${dwarf.z}) (+65 Wealth)!`,
              'COMBAT'
            );
          } else {
            appendDwarfThought(dwarf, {
              tick: nextTicks,
              year: nextYear,
              season: nextSeason,
              text: `Trading blows with ${targetHostile.name} (${squadMods.tacticalNote})!`,
              category: 'COMBAT',
              sentiment: 'NEGATIVE',
              moraleDelta: 0,
            });
          }
          return dwarf;
        } else {
          dwarf.state = 'MOVING';
          if (
            canDwarfStepThisTick(
              dwarf,
              { season: nextSeason, ticks: nextTicks, weatherOverride: state.weatherOverride },
              currentDwarfTile,
              nextTicks
            )
          ) {
            dwarf.x = Math.max(
              0,
              Math.min(state.world.width - 1, dwarf.x + Math.sign(targetHostile.x - dwarf.x))
            );
            dwarf.y = Math.max(
              0,
              Math.min(state.world.height - 1, dwarf.y + Math.sign(targetHostile.y - dwarf.y))
            );
          }
          return dwarf;
        }
      }
    }


    // 2. Thirst & Tavern Buff
    if (dwarf.thirst < 36 && resources.ale > 0) {
      resources.ale = Math.max(0, resources.ale - 1);
      dwarf.thirst = Math.min(100, dwarf.thirst + 48);
      const tavernBonus = tavernCount > 0 ? 12 : 6;
      if (tavernCount > 0) {
        dwarf.energy = Math.min(100, dwarf.energy + 10);
      }
      dwarf.state = 'DRINKING';
      appendDwarfThought(dwarf, {
        tick: nextTicks,
        year: nextYear,
        season: nextSeason,
        text:
          tavernCount > 0
            ? 'Shared a roaring mug of ale and song in the Hearth Tavern!'
            : 'Quaffed a mug of rich Dwarven Ale. Praise the miners!',
        category: 'SUSTENANCE',
        sentiment: tavernCount > 0 ? 'EUPHORIC' : 'POSITIVE',
        moraleDelta: tavernBonus,
      });
      return dwarf;
    } else if (dwarf.thirst < 22 && resources.ale === 0 && nextTicks % 12 === 0) {
      appendDwarfThought(dwarf, {
        tick: nextTicks,
        year: nextYear,
        season: nextSeason,
        text: "Parched for Dwarven Ale — build a Brewer's Still or barter with a caravan!",
        category: 'SUSTENANCE',
        sentiment: 'NEGATIVE',
        moraleDelta: -2,
      });
    }

    // 3. Hunger
    if (dwarf.hunger < 36 && resources.food > 0) {
      resources.food = Math.max(0, resources.food - 1);
      dwarf.hunger = Math.min(100, dwarf.hunger + 48);
      dwarf.state = 'EATING';
      appendDwarfThought(dwarf, {
        tick: nextTicks,
        year: nextYear,
        season: nextSeason,
        text: 'Ate a savoury Plump Helmet roast.',
        category: 'SUSTENANCE',
        sentiment: 'POSITIVE',
        moraleDelta: 5,
      });
      return dwarf;
    } else if (dwarf.hunger < 22 && resources.food === 0 && nextTicks % 12 === 0) {
      appendDwarfThought(dwarf, {
        tick: nextTicks,
        year: nextYear,
        season: nextSeason,
        text: 'Hungry — our Plump Helmet larder is empty! Furrow Farm Plots or gather shrubs.',
        category: 'SUSTENANCE',
        sentiment: 'NEGATIVE',
        moraleDelta: -2,
      });
    }

    // 4. Energy & Dormitory Bed Rest
    if (dwarf.energy < 28) {
      dwarf.state = 'SLEEPING';
      dwarf.energy = Math.min(100, dwarf.energy + (bedCount > 0 ? 52 : 28));
      dwarf.hp = Math.min(dwarf.maxHp, dwarf.hp + (bedCount > 0 ? 12 : 8));
      if (bedCount > 0) {
        appendDwarfThought(dwarf, {
          tick: nextTicks,
          year: nextYear,
          season: nextSeason,
          text: 'Rested soundly in a sturdy dwarven dormitory bed.',
          category: 'FELLOWSHIP',
          sentiment: 'POSITIVE',
          moraleDelta: 6,
        });
      } else {
        appendDwarfThought(dwarf, {
          tick: nextTicks,
          year: nextYear,
          season: nextSeason,
          text: 'Caught a brief nap on the cold stone floor.',
          category: 'SUSTENANCE',
          sentiment: 'NEGATIVE',
          moraleDelta: -2,
        });
      }
      return dwarf;
    }

    // 5. Temple Meditation when Morale dips
    if (dwarf.happiness < 72 && templeCount > 0 && nextTicks % 6 === 0) {
      dwarf.state = 'PRAYING';
      appendDwarfThought(dwarf, {
        tick: nextTicks,
        year: nextYear,
        season: nextSeason,
        text: 'Received ancestral blessing at the Runed Temple Altar.',
        category: 'OMEN',
        sentiment: 'POSITIVE',
        moraleDelta: 12,
      });
      return dwarf;
    }

    if (dwarf.currentTask) {
      const targetTile = grid[dwarf.currentTask.z]?.[dwarf.currentTask.y]?.[dwarf.currentTask.x];
      if (!targetTile || targetTile.designation !== dwarf.currentTask.type) {
        dwarf.currentTask = undefined;
        dwarf.state = 'IDLE';
      }
    }

    if (!dwarf.currentTask) {
      // If dwarf belongs to a squad with an active STATION or PATROL order on this Z-level, execute squad maneuver
      const squadForOrder = getDwarfSquad(dwarf, militiaState);
      if (
        squadForOrder &&
        squadForOrder.order.type !== 'FOLLOW_DOCTRINE' &&
        squadForOrder.order.z === dwarf.z
      ) {
        const memberIdx = Math.max(0, squadForOrder.memberIds.indexOf(dwarf.id));
        const dest = getSquadOrderDestination(dwarf, squadForOrder, memberIdx);
        if (dest) {
          dwarf.patrolLeg = dest.nextPatrolLeg;
          if (dest.arrived) {
            dwarf.state = 'IDLE';
            return dwarf;
          }
          const nx = Math.max(
            0,
            Math.min(state.world.width - 1, dwarf.x + Math.sign(dest.x - dwarf.x))
          );
          const ny = Math.max(
            0,
            Math.min(state.world.height - 1, dwarf.y + Math.sign(dest.y - dwarf.y))
          );
          const destTile = grid[dwarf.z]?.[ny]?.[nx];
          if (destTile && destTile.walkable) {
            dwarf.x = nx;
            dwarf.y = ny;
            dwarf.state = 'MOVING';
            return dwarf;
          }
        }
      }

      let bestCandidate: { x: number; y: number; z: number; type: DesignationType; dist: number } | null = null;

      for (let z = 0; z < state.world.depth; z++) {
        for (let y = 0; y < state.world.height; y++) {
          for (let x = 0; x < state.world.width; x++) {
            const t = grid[z][y][x];
            if (
              !t.designation ||
              t.designation === 'MILITIA_STATION' ||
              t.designation === 'MILITIA_PATROL'
            ) {
              continue;
            }
            const key = `${z}:${x}:${y}`;
            if (claimedTargets.has(key)) continue;

            const reqLabor = getRequiredLabor(t.designation);
            if (!dwarf.labors[reqLabor]) continue;

            const cost = getConstructionCost(t.designation);
            if (!hasResources(resources, cost)) continue;

            const zPenalty = Math.abs(z - dwarf.z) * 18;
            const dist = Math.abs(x - dwarf.x) + Math.abs(y - dwarf.y) + zPenalty;
            if (!bestCandidate || dist < bestCandidate.dist) {
              bestCandidate = { x, y, z, type: t.designation, dist };
            }
          }
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
          if (nt && nt.walkable) {
            dwarf.x = nx;
            dwarf.y = ny;
          }
        }
        return dwarf;
      }
    }

    const task = dwarf.currentTask;
    if (!task) return dwarf;

    if (dwarf.z !== task.z) {
      let stairPos: { x: number; y: number } | null = null;
      for (let y = 0; y < state.world.height; y++) {
        for (let x = 0; x < state.world.width; x++) {
          if (grid[dwarf.z][y][x].terrain === 'STAIRS_UP_DOWN') {
            stairPos = { x, y };
            break;
          }
        }
        if (stairPos) break;
      }

      if (stairPos) {
        if (dwarf.x === stairPos.x && dwarf.y === stairPos.y) {
          dwarf.z += task.z > dwarf.z ? 1 : -1;
          revealAround(grid, dwarf.z, dwarf.x, dwarf.y, 3);
        } else if (
          canDwarfStepThisTick(
            dwarf,
            { season: nextSeason, ticks: nextTicks, weatherOverride: state.weatherOverride },
            currentDwarfTile,
            nextTicks
          )
        ) {
          dwarf.x += Math.sign(stairPos.x - dwarf.x);
          dwarf.y += Math.sign(stairPos.y - dwarf.y);
        }
      }
      return dwarf;
    }

    const dist = Math.max(Math.abs(task.x - dwarf.x), Math.abs(task.y - dwarf.y));
    if (dist > 1) {
      dwarf.state = 'MOVING';
      if (
        canDwarfStepThisTick(
          dwarf,
          { season: nextSeason, ticks: nextTicks, weatherOverride: state.weatherOverride },
          currentDwarfTile,
          nextTicks
        )
      ) {
        const stepX = Math.sign(task.x - dwarf.x);
        const stepY = Math.sign(task.y - dwarf.y);
        dwarf.x = Math.max(0, Math.min(state.world.width - 1, dwarf.x + stepX));
        dwarf.y = Math.max(0, Math.min(state.world.height - 1, dwarf.y + stepY));
        revealAround(grid, dwarf.z, dwarf.x, dwarf.y, 2);
      }
      return dwarf;
    }


    dwarf.state = 'WORKING';
    task.progress += 1;

    if (task.progress >= task.totalTicks) {
      const targetTile = grid[task.z][task.y][task.x];
      const cost = getConstructionCost(task.type);

      if (hasResources(resources, cost)) {
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
            appendDwarfThought(dwarf, {
              tick: nextTicks,
              year: nextYear,
              season: nextSeason,
              text:
                prevTerrain === 'GOLD_VEIN' || prevTerrain === 'MITHRIL_VEIN'
                  ? `Unearthed gleaming ${prevTerrain === 'MITHRIL_VEIN' ? 'Star-Mithril' : 'Native Gold'} at Z-${task.z}!`
                  : prevTerrain === 'IRON_VEIN' || prevTerrain === 'COPPER_VEIN'
                    ? `Struck a rich metallic vein of ore at Z-${task.z}!`
                    : 'Satisfied by the ring of steel against living rock.',
              category: 'CRAFT_DELVE',
              sentiment:
                prevTerrain === 'GOLD_VEIN' || prevTerrain === 'MITHRIL_VEIN'
                  ? 'EUPHORIC'
                  : 'POSITIVE',
              moraleDelta:
                prevTerrain === 'GOLD_VEIN' || prevTerrain === 'MITHRIL_VEIN' ? 6 : 2,
            });
            break;
          }
          case 'RECLAIM_RELIC': {
            resources.relics += 1;
            resources.wealth += 300;
            setTileTerrain(targetTile, 'ROCK_FLOOR');
            revealAround(grid, task.z, task.x, task.y, 4);
            appendDwarfThought(dwarf, {
              tick: nextTicks,
              year: nextYear,
              season: nextSeason,
              text: 'Recovered an Ancient Dwarven Relic from the deep caverns!',
              category: 'CRAFT_DELVE',
              sentiment: 'EUPHORIC',
              moraleDelta: 15,
            });
            addAlert('CAVERN RELIC RECLAIMED', 'DISCOVERY', task.x, task.y, task.z);
            addLog(
              `[RELIC] ${dwarf.name} reclaimed an Ancient Vault Relic at (${task.x}, ${task.y}, Z-${task.z}) (+1 Relic, +300 Wealth)!`,
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
            appendDwarfThought(dwarf, {
              tick: nextTicks,
              year: nextYear,
              season: nextSeason,
              text: `Carved a deep stairwell descending to Z-${task.z + 1}.`,
              category: 'CRAFT_DELVE',
              sentiment: 'POSITIVE',
              moraleDelta: 3,
            });
            addLog(`${dwarf.name} carved a stairwell connecting Depth Z-${task.z} and Z-${task.z + 1}.`, 'WORK');
            break;
          }
          case 'CHOP': {
            resources.wood += 4;
            resources.wealth += 12;
            setTileTerrain(targetTile, 'GRASS');
            appendDwarfThought(dwarf, {
              tick: nextTicks,
              year: nextYear,
              season: nextSeason,
              text: 'Felled a towering timber trunk for the fortress.',
              category: 'CRAFT_DELVE',
              sentiment: 'POSITIVE',
              moraleDelta: 2,
            });
            addLog(`${dwarf.name} felled timber (+4 Wood).`, 'WORK');
            break;
          }
          case 'GATHER': {
            resources.food += 4;
            resources.wealth += 12;
            setTileTerrain(targetTile, 'GRASS');
            appendDwarfThought(dwarf, {
              tick: nextTicks,
              year: nextYear,
              season: nextSeason,
              text: 'Gathered crisp surface tubers and plump wild mushrooms.',
              category: 'SUSTENANCE',
              sentiment: 'POSITIVE',
              moraleDelta: 2,
            });
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
            appendDwarfThought(dwarf, {
              tick: nextTicks,
              year: nextYear,
              season: nextSeason,
              text: 'Built a fine wooden bed for the clan dormitory.',
              category: 'CRAFT_DELVE',
              sentiment: 'POSITIVE',
              moraleDelta: 3,
            });
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

      dwarf.currentTask = undefined;
      dwarf.state = 'IDLE';
    }

    return dwarf;
  });

  // Remove defeated hostiles
  hostiles = hostiles.filter((h) => h.hp > 0);

  // Handle Strange Mood deadline expiration
  let nextActivities = state.activities ? { ...state.activities } : {};
  if (
    nextActivities.strangeMood &&
    nextTicks >= nextActivities.strangeMood.deadline
  ) {
    const expiredMood = nextActivities.strangeMood;
    nextActivities.strangeMood = null;
    nextDwarves = nextDwarves.map((d) =>
      d.id === expiredMood.dwarfId
        ? withDwarfThought(d, {
            tick: nextTicks,
            year: nextYear,
            season: nextSeason,
            text: `Melancholic after failing to obtain materials for ${expiredMood.artifactName}!`,
            category: 'OMEN',
            sentiment: 'TERRIFIED',
            moraleDelta: -35,
          })
        : d
    );
    addLog(
      `[STRANGE MOOD FAILED] ${expiredMood.dwarfName} fell into melancholy after lacking materials for "${expiredMood.artifactName}".`,
      'ALERT'
    );
  }

  // Seasonal Migrant Wave at season turn when provisions are healthy
  if (
    nextTicks > 0 &&
    nextTicks % 120 === 0 &&
    resources.food >= 28 &&
    resources.ale >= 22 &&
    nextDwarves.length < 14
  ) {
    const seasonalMigrant = createConfiguredMigrantDwarf({
      existingDwarves: nextDwarves,
      worldWidth: state.world.width,
      worldHeight: state.world.height,
      dwarvenName: state.world.dwarvenName,
      ticks: nextTicks,
      indexOffset: 1,
      originLabel: `${nextSeason} Migrant Wave`,
      weaponsAvailable: resources.weapons,
      armorAvailable: resources.armor,
    });
    nextDwarves.push(seasonalMigrant);
    addLog(
      `[MIGRANT WAVE] ${seasonalMigrant.name} (${seasonalMigrant.title}) joined ${state.world.dwarvenName} with pre-configured jobs!`,
      'LORE'
    );
  }

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

  let nextState: GameState = {
    ...state,
    grid,
    dwarves: nextDwarves,
    hostiles,
    alerts,
    resources,
    workOrders,
    chronicle,
    activeEvent: nextActiveEvent,
    activities: nextActivities,
    ticks: nextTicks,
    year: nextYear,
    season: nextSeason,
  };

  // Sync architectural tech tree building unlocks
  nextState = syncBuildingUnlocks(nextState).nextState;

  // Periodically spark a Strange Mood if none is active and wealth >= 600
  if (
    !nextState.activities?.strangeMood &&
    nextTicks > 0 &&
    nextTicks % 55 === 0 &&
    nextState.resources.wealth >= 600
  ) {
    nextState = triggerStrangeMood(nextState).nextState;
  }

  return nextState;
}

export interface ResourceEconomyBalance {
  foodPerSeason: number;
  alePerSeason: number;
  farmProductionPerSeason: number;
  stillProductionPerSeason: number;
  netFoodPerSeason: number;
  netAlePerSeason: number;
  foodRunwaySeasons: number;
  aleRunwaySeasons: number;
  stockpileTiles: number;
  maxSafeFoodStorage: number;
  farmCount: number;
  bedCount: number;
  wallCount: number;
  doorCount: number;
  trapCount: number;
  tavernCount: number;
  templeCount: number;
  depotCount: number;
  status: 'CRITICAL' | 'TIGHT' | 'STABLE' | 'SURPLUS';
}

export function getResourceEconomyBalance(state: GameState): ResourceEconomyBalance {
  const seasonMods = getSeasonModifiers(state.season);
  let stockpileTiles = 0;
  let farmCount = 0;
  let bedCount = 0;
  let wallCount = 0;
  let doorCount = 0;
  let trapCount = 0;
  let tavernCount = 0;
  let templeCount = 0;
  let depotCount = 0;
  let stillCount = 0;

  for (let z = 0; z < state.world.depth; z++) {
    const level = state.grid[z] || [];
    for (let y = 0; y < level.length; y++) {
      const row = level[y] || [];
      for (let x = 0; x < row.length; x++) {
        const t = row[x].terrain;
        if (t === 'STOCKPILE_TILE') stockpileTiles++;
        else if (t === 'FARM_PLOT') farmCount++;
        else if (t === 'BED') bedCount++;
        else if (t === 'CONSTRUCTED_WALL') wallCount++;
        else if (t === 'DOOR') doorCount++;
        else if (t === 'TRAP_STONE') trapCount++;
        else if (t === 'TAVERN_HALL') tavernCount++;
        else if (t === 'TEMPLE_ALTAR') templeCount++;
        else if (t === 'TRADE_DEPOT') depotCount++;
        else if (t === 'WORKSHOP_STILL') stillCount++;
      }
    }
  }

  const pop = Math.max(1, state.dwarves.length);
  // Each season is 120 ticks; each meal/drink restores 48 points
  const decayPerSeason = 120 / seasonMods.needDecayInterval + 6;
  const mealsPerDwarfPerSeason = decayPerSeason / 48;
  const foodPerSeason = Math.max(4, Math.round(pop * mealsPerDwarfPerSeason * 3.2));
  const alePerSeason = Math.max(4, Math.round(pop * mealsPerDwarfPerSeason * 3.2));

  const activeFarmers = state.dwarves.filter((d) => d.labors.FARMING).length;
  const harvestsPerSeason = 5; // 120 / 24
  const perHarvest =
    farmCount > 0
      ? Math.max(
          1,
          Math.round(
            (activeFarmers > 0
              ? farmCount * 1.5 + Math.min(2, activeFarmers)
              : farmCount * 0.65) * seasonMods.cropMultiplier
          )
        )
      : 0;
  const farmProductionPerSeason = perHarvest * harvestsPerSeason + (depotCount > 0 ? 4 : 0);

  const hasBrewOrder = state.workOrders.some(
    (o) => o.workshop === 'WORKSHOP_STILL' && (o.remaining > 0 || o.autoRepeat)
  );
  const stillProductionPerSeason =
    stillCount > 0 ? (hasBrewOrder ? 16 : 10) + (depotCount > 0 ? 4 : 0) : depotCount > 0 ? 4 : 0;

  const netFoodPerSeason = farmProductionPerSeason - foodPerSeason;
  const netAlePerSeason = stillProductionPerSeason - alePerSeason;
  const foodRunwaySeasons = Number((state.resources.food / Math.max(1, foodPerSeason)).toFixed(1));
  const aleRunwaySeasons = Number((state.resources.ale / Math.max(1, alePerSeason)).toFixed(1));
  const maxSafeFoodStorage = 24 + stockpileTiles * 8;

  let status: ResourceEconomyBalance['status'] = 'STABLE';
  if (foodRunwaySeasons < 0.8 || aleRunwaySeasons < 0.8) {
    status = 'CRITICAL';
  } else if (foodRunwaySeasons < 1.6 || aleRunwaySeasons < 1.5) {
    status = 'TIGHT';
  } else if (netFoodPerSeason >= 0 && netAlePerSeason >= 0 && foodRunwaySeasons >= 2.2) {
    status = 'SURPLUS';
  }

  return {
    foodPerSeason,
    alePerSeason,
    farmProductionPerSeason,
    stillProductionPerSeason,
    netFoodPerSeason,
    netAlePerSeason,
    foodRunwaySeasons,
    aleRunwaySeasons,
    stockpileTiles,
    maxSafeFoodStorage,
    farmCount,
    bedCount,
    wallCount,
    doorCount,
    trapCount,
    tavernCount,
    templeCount,
    depotCount,
    status,
  };
}

export interface BuildingTileFunctionInfo {
  terrain: TileTerrain;
  title: string;
  glyph: string;
  passiveFunction: string;
  actionLabel: string;
  actionDescription: string;
  cost: Partial<FortressResources>;
  canActivate: boolean;
}

export function getBuildingTileFunctionInfo(
  state: GameState,
  tile: Tile
): BuildingTileFunctionInfo | null {
  if (!tile.revealed) return null;
  const econ = getResourceEconomyBalance(state);
  const res = state.resources;

  switch (tile.terrain) {
    case 'STOCKPILE_TILE':
      return {
        terrain: 'STOCKPILE_TILE',
        title: 'Vault Stockpile Tile',
        glyph: '≡',
        passiveFunction: `+8 Safe Provision Cap (Total: ${econ.maxSafeFoodStorage} Food across ${econ.stockpileTiles} tiles) · Prevents seasonal spoilage & grants hauling bonus at 6+ tiles.`,
        actionLabel: 'Consolidate & Audit Stockpile',
        actionDescription: 'Haulers sweep loose tunnel stone, timber, and mushrooms into sorted bins (+3 Stone, +2 Wood, +2 Food, +15 Wealth).',
        cost: {},
        canActivate: true,
      };
    case 'CONSTRUCTED_WALL':
      return {
        terrain: 'CONSTRUCTED_WALL',
        title: 'Bastion Stone Wall',
        glyph: '#',
        passiveFunction: `Blocks raiders, insulates indoor warmth (+8°F), and reduces militia combat damage by 15% when 4+ walls stand (${econ.wallCount} built).`,
        actionLabel: 'Buttress & Engrave Wall (1 Stone)',
        actionDescription: 'Carve ancestral reliefs into the stone bastion (+30 Wealth, +2 Clan Morale).',
        cost: { stone: 1 },
        canActivate: res.stone >= 1,
      };
    case 'DOOR':
      return {
        terrain: 'DOOR',
        title: 'Fortified Portal Door',
        glyph: '+',
        passiveFunction: `Seals room warmth while allowing dwarves 100% speed and slowing hostile raiders by 50% at choke points (${econ.doorCount} built).`,
        actionLabel: 'Reinforce Portal Choke-Ward',
        actionDescription: 'Drop iron crossbars and alert guards (+20 Wealth, +5 HP to all dwarves).',
        cost: {},
        canActivate: true,
      };
    case 'BED':
      return {
        terrain: 'BED',
        title: 'Dwarven Dormitory Bed',
        glyph: '⌂',
        passiveFunction: `Restores +52 Energy & +12 HP on sleep and grants +6 Morale (${econ.bedCount}/${state.dwarves.length} clan beds).`,
        actionLabel: 'Sound Dormitory Rest Call',
        actionDescription: 'Rotate weary dwarves through the dormitory (+20 Energy, +10 HP, +3 Morale across clan).',
        cost: {},
        canActivate: true,
      };
    case 'FARM_PLOT':
      return {
        terrain: 'FARM_PLOT',
        title: 'Plump Helmet Farm Plot',
        glyph: '≈',
        passiveFunction: `Passively harvests Plump Helmets every 24 ticks (~${econ.farmProductionPerSeason} Food/season across ${econ.farmCount} plots).`,
        actionLabel: 'Fertilize & Rush Harvest',
        actionDescription: 'Tend mushroom spores for an immediate harvest (+4 Food, +15 Wealth).',
        cost: {},
        canActivate: true,
      };
    case 'WORKSHOP_MASON':
      return {
        terrain: 'WORKSHOP_MASON',
        title: "Mason's Workshop",
        glyph: 'M',
        passiveFunction: 'Dresses stone blocks and fulfills Stone Furniture work orders every 12–28 ticks.',
        actionLabel: 'Carve Stone Coffer & Throne (2 Stone)',
        actionDescription: 'Chisel a masterwork stone coffer and table (+2 Furniture, +40 Wealth).',
        cost: { stone: 2 },
        canActivate: res.stone >= 2,
      };
    case 'WORKSHOP_CARPENTER':
      return {
        terrain: 'WORKSHOP_CARPENTER',
        title: "Carpenter's Joinery",
        glyph: 'C',
        passiveFunction: 'Joins seasoned timber into beds, shields, and ale casks (+1 Furniture & +1 Ale every 28 ticks).',
        actionLabel: 'Join Timber Bed & Casks (2 Wood)',
        actionDescription: 'Craft wooden furniture and coopered ale casks (+1 Furniture, +2 Ale, +35 Wealth).',
        cost: { wood: 2 },
        canActivate: res.wood >= 2,
      };
    case 'WORKSHOP_STILL':
      return {
        terrain: 'WORKSHOP_STILL',
        title: "Brewer's Still",
        glyph: 'S',
        passiveFunction: `Ferments Plump Helmets into Dwarven Ale (~${econ.stillProductionPerSeason} Ale/season) to sustain clan thirst & mirth.`,
        actionLabel: 'Distill Plump Helmet Ale (2 Food)',
        actionDescription: 'Ferment a fresh batch of rich Dwarven Ale (+5 Ale, +25 Wealth).',
        cost: { food: 2 },
        canActivate: res.food >= 2,
      };
    case 'WORKSHOP_SMELTER':
      return {
        terrain: 'WORKSHOP_SMELTER',
        title: 'Smeltery Blast Furnace',
        glyph: '£',
        passiveFunction: 'Smelts Iron & Copper Ore with timber charcoal into tempered Steel Bars and radiates hearth warmth.',
        actionLabel: 'Smelt Steel Ingots (2 Iron, 1 Wood)',
        actionDescription: 'Run a high-heat blast furnace smelt (+2 Steel Bars, +45 Wealth).',
        cost: { ironOre: 2, wood: 1 },
        canActivate: res.ironOre >= 2 && res.wood >= 1,
      };
    case 'WORKSHOP_FORGE':
      return {
        terrain: 'WORKSHOP_FORGE',
        title: "Metalsmith's Forge",
        glyph: '⚒',
        passiveFunction: 'Hammers Steel Bars into Runed Battleaxes and Plate Mail automatically equipped by militia dwarves.',
        actionLabel: 'Forge Battleaxe & Mail (1 Steel)',
        actionDescription: 'Hammer a runed axe and steel mail suit (+1 Weapon, +1 Armor, +75 Wealth).',
        cost: { steelBars: 1 },
        canActivate: res.steelBars >= 1,
      };
    case 'TAVERN_HALL':
      return {
        terrain: 'TAVERN_HALL',
        title: 'Hearth Tavern Hall',
        glyph: '♫',
        passiveFunction: 'Doubles morale gain from drinking Ale (+12), restores +10 Energy, and radiates +2 Song Morale every 30 ticks.',
        actionLabel: 'Host Hearth Feast & Round (2 Ale)',
        actionDescription: 'Pour tankards for the whole clan (+8 Morale & +25 Thirst to all dwarves, +30 Wealth).',
        cost: { ale: 2 },
        canActivate: res.ale >= 2,
      };
    case 'TEMPLE_ALTAR':
      return {
        terrain: 'TEMPLE_ALTAR',
        title: 'Ancestral Temple Altar',
        glyph: 'Ψ',
        passiveFunction: 'Grants +12 Morale to praying dwarves and radiates +2 Serenity & +4 HP across the fortress every 32 ticks.',
        actionLabel: 'Invoke Ancestral Blessing',
        actionDescription: 'Chant the Litany of the First Anvil (+6 Morale & +12 HP to all dwarves, +25 Wealth).',
        cost: {},
        canActivate: true,
      };
    case 'TRADE_DEPOT':
      return {
        terrain: 'TRADE_DEPOT',
        title: 'Seasonal Trade Depot',
        glyph: '¤',
        passiveFunction: 'Collects merchant tolls every 30 ticks (+20 Wealth, +1 Food, +1 Ale) and unlocks Caravan Barter.',
        actionLabel: 'Barter Stone for Provisions (3 Stone)',
        actionDescription: 'Exchange dressed stone with passing factors (+4 Food, +4 Ale, +40 Wealth).',
        cost: { stone: 3 },
        canActivate: res.stone >= 3,
      };
    case 'TRAP_STONE':
      return {
        terrain: 'TRAP_STONE',
        title: 'Stone Deadfall Trap',
        glyph: '^',
        passiveFunction: 'Crushes any hostile goblin or cavern beast stepping on this tile for 45 damage (+50 Wealth on kill).',
        actionLabel: 'Weight & Hone Trigger (1 Stone)',
        actionDescription: 'Add serrated granite counterweights to the deadfall (+25 Wealth & fortifies tile).',
        cost: { stone: 1 },
        canActivate: res.stone >= 1,
      };
    default:
      return null;
  }
}

export function activateBuildingTileFunction(
  state: GameState,
  x: number,
  y: number,
  z: number
): { nextState: GameState; triggered: boolean; message: string } {
  const tile = state.grid[z]?.[y]?.[x];
  if (!tile) {
    return { nextState: state, triggered: false, message: 'Invalid tile coordinates.' };
  }
  const fnInfo = getBuildingTileFunctionInfo(state, tile);
  if (!fnInfo) {
    return { nextState: state, triggered: false, message: 'No active building function on this tile.' };
  }
  if (!fnInfo.canActivate || !hasResources(state.resources, fnInfo.cost)) {
    return {
      nextState: state,
      triggered: false,
      message: `Insufficient resources to activate ${fnInfo.title}.`,
    };
  }

  const resources: FortressResources = { ...state.resources };
  for (const [k, v] of Object.entries(fnInfo.cost)) {
    const key = k as keyof FortressResources;
    resources[key] = Math.max(0, (resources[key] || 0) - (v || 0));
  }

  let dwarves: DwarfEntity[] = state.dwarves.map((d) => ({
    ...d,
    thoughtLog: Array.isArray(d.thoughtLog) ? [...d.thoughtLog] : [],
  }));

  let outcomeMessage = '';

  switch (tile.terrain) {
    case 'STOCKPILE_TILE': {
      resources.stone += 3;
      resources.wood += 2;
      resources.food += 2;
      resources.wealth += 15;
      outcomeMessage = `[STOCKPILE] Consolidated loose tunnel stores at (${x},${y},Z-${z}) (+3 Stone, +2 Wood, +2 Food, +15 Wealth)!`;
      break;
    }
    case 'CONSTRUCTED_WALL': {
      resources.wealth += 30;
      dwarves = dwarves.map((d) => ({
        ...d,
        happiness: Math.min(100, d.happiness + 2),
      }));
      outcomeMessage = `[BASTION] Buttressed & engraved Stone Wall at (${x},${y},Z-${z}) (+30 Wealth, +2 Clan Morale)!`;
      break;
    }
    case 'DOOR': {
      resources.wealth += 20;
      dwarves = dwarves.map((d) => ({
        ...d,
        hp: Math.min(d.maxHp, d.hp + 5),
      }));
      outcomeMessage = `[PORTAL] Reinforced Portal Door choke-ward at (${x},${y},Z-${z}) (+20 Wealth, +5 HP to clan)!`;
      break;
    }
    case 'BED': {
      dwarves = dwarves.map((d) => ({
        ...d,
        energy: Math.min(100, d.energy + 20),
        hp: Math.min(d.maxHp, d.hp + 10),
        happiness: Math.min(100, d.happiness + 3),
      }));
      outcomeMessage = `[DORMITORY] Sounded rest rotation at (${x},${y},Z-${z}) (+20 Energy, +10 HP, +3 Morale across clan)!`;
      break;
    }
    case 'FARM_PLOT': {
      resources.food += 4;
      resources.wealth += 15;
      outcomeMessage = `[FARM] Tended & harvested Plump Helmet plot at (${x},${y},Z-${z}) (+4 Food, +15 Wealth)!`;
      break;
    }
    case 'WORKSHOP_MASON': {
      resources.furniture += 2;
      resources.wealth += 40;
      outcomeMessage = `[MASON] Carved stone coffer & throne at (${x},${y},Z-${z}) (+2 Furniture, +40 Wealth)!`;
      break;
    }
    case 'WORKSHOP_CARPENTER': {
      resources.furniture += 1;
      resources.ale += 2;
      resources.wealth += 35;
      outcomeMessage = `[CARPENTER] Joined timber bedframe & coopered casks at (${x},${y},Z-${z}) (+1 Furniture, +2 Ale, +35 Wealth)!`;
      break;
    }
    case 'WORKSHOP_STILL': {
      resources.ale += 5;
      resources.wealth += 25;
      outcomeMessage = `[STILL] Distilled a fresh batch of Dwarven Ale at (${x},${y},Z-${z}) (+5 Ale, +25 Wealth)!`;
      break;
    }
    case 'WORKSHOP_SMELTER': {
      resources.steelBars += 2;
      resources.wealth += 45;
      outcomeMessage = `[SMELTER] Smelted 2 Steel Bars in the blast furnace at (${x},${y},Z-${z}) (+2 Steel Bars, +45 Wealth)!`;
      break;
    }
    case 'WORKSHOP_FORGE': {
      resources.weapons += 1;
      resources.armor += 1;
      resources.wealth += 75;
      outcomeMessage = `[FORGE] Hammered Runed Battleaxe & Steel Mail at (${x},${y},Z-${z}) (+1 Weapon, +1 Armor, +75 Wealth)!`;
      break;
    }
    case 'TAVERN_HALL': {
      resources.wealth += 30;
      dwarves = dwarves.map((d) =>
        withDwarfThought(
          {
            ...d,
            thirst: Math.min(100, d.thirst + 25),
          },
          {
            tick: state.ticks,
            year: state.year,
            season: state.season,
            text: 'Celebrated a roaring Hearth Feast in the Tavern Hall!',
            category: 'FELLOWSHIP',
            sentiment: 'EUPHORIC',
            moraleDelta: 8,
          }
        )
      );
      outcomeMessage = `[TAVERN] Hosted Hearth Feast at (${x},${y},Z-${z}) (+8 Morale & +25 Thirst to all dwarves, +30 Wealth)!`;
      break;
    }
    case 'TEMPLE_ALTAR': {
      resources.wealth += 25;
      dwarves = dwarves.map((d) =>
        withDwarfThought(
          {
            ...d,
            hp: Math.min(d.maxHp, d.hp + 12),
          },
          {
            tick: state.ticks,
            year: state.year,
            season: state.season,
            text: 'Blessed by the Ancestral Litany at the Temple Altar!',
            category: 'OMEN',
            sentiment: 'POSITIVE',
            moraleDelta: 6,
          }
        )
      );
      outcomeMessage = `[TEMPLE] Invoked Ancestral Blessing at (${x},${y},Z-${z}) (+6 Morale & +12 HP to all dwarves, +25 Wealth)!`;
      break;
    }
    case 'TRADE_DEPOT': {
      resources.food += 4;
      resources.ale += 4;
      resources.wealth += 40;
      outcomeMessage = `[TRADE DEPOT] Bartered stone with caravan factors at (${x},${y},Z-${z}) (+4 Food, +4 Ale, +40 Wealth)!`;
      break;
    }
    case 'TRAP_STONE': {
      resources.wealth += 25;
      outcomeMessage = `[TRAP] Weighted & honed Stone Deadfall Trap at (${x},${y},Z-${z}) (+25 Wealth)!`;
      break;
    }
  }

  const entry: ChronicleEntry = {
    id: `chron-bldg-fn-${state.ticks}-${Math.random().toString(36).slice(2, 6)}`,
    tick: state.ticks,
    season: state.season,
    year: state.year,
    text: outcomeMessage,
    type: 'CRAFT',
  };

  let nextState: GameState = {
    ...state,
    resources,
    dwarves,
    chronicle: [entry, ...state.chronicle.slice(0, 59)],
  };
  nextState = syncBuildingUnlocks(nextState).nextState;

  return {
    nextState,
    triggered: true,
    message: outcomeMessage,
  };
}


