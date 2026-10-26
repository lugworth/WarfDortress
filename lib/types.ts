export type Biome =
  | 'DEEP_OCEAN'
  | 'COASTAL_WATER'
  | 'MARSH'
  | 'PLAINS'
  | 'FOREST'
  | 'DESERT'
  | 'MOUNTAINS'
  | 'VOLCANIC';

export type TileTerrain =
  | 'EMPTY_AIR'
  | 'WATER'
  | 'GRASS'
  | 'TREE'
  | 'SHRUB'
  | 'SAND'
  | 'SOIL'
  | 'ROCK_WALL'
  | 'LIMESTONE_WALL'
  | 'GRANITE_WALL'
  | 'IRON_VEIN'
  | 'COPPER_VEIN'
  | 'GOLD_VEIN'
  | 'MITHRIL_VEIN'
  | 'MAGMA'
  | 'ROCK_FLOOR'
  | 'CONSTRUCTED_WALL'
  | 'DOOR'
  | 'BED'
  | 'WORKSHOP_MASON'
  | 'WORKSHOP_CARPENTER'
  | 'WORKSHOP_STILL'
  | 'WORKSHOP_SMELTER'
  | 'WORKSHOP_FORGE'
  | 'TAVERN_HALL'
  | 'TEMPLE_ALTAR'
  | 'TRADE_DEPOT'
  | 'TRAP_STONE'
  | 'CAVERN_RELIC'
  | 'FARM_PLOT'
  | 'STAIRS_UP_DOWN'
  | 'STOCKPILE_TILE';

export type DesignationType =
  | 'MINE'
  | 'CHOP'
  | 'GATHER'
  | 'STAIRS'
  | 'STOCKPILE'
  | 'RECLAIM_RELIC'
  | 'BUILD_WALL'
  | 'BUILD_DOOR'
  | 'BUILD_TRAP'
  | 'BUILD_BED'
  | 'BUILD_MASON'
  | 'BUILD_CARPENTER'
  | 'BUILD_STILL'
  | 'BUILD_SMELTER'
  | 'BUILD_FORGE'
  | 'BUILD_TAVERN'
  | 'BUILD_TEMPLE'
  | 'BUILD_DEPOT'
  | 'BUILD_FARM'
  | 'MILITIA_STATION'
  | 'MILITIA_PATROL'
  | 'CANCEL';

export type DwarfLabor =
  | 'MINING'
  | 'WOODCUTTING'
  | 'MASONRY'
  | 'CARPENTRY'
  | 'FARMING'
  | 'SMITHING'
  | 'COMBAT'
  | 'HAULING';

export type MilitiaDoctrine = 'DEFENSIVE' | 'PATROL' | 'SALLY_FORTH';

export type LaborPresetId =
  | 'ALL_HANDS'
  | 'MINING_DELVE'
  | 'SMITH_FORTIFY'
  | 'HARVEST_BREW';

export interface Tile {
  x: number;
  y: number;
  z: number;
  terrain: TileTerrain;
  biome: Biome;
  char: string;
  fg: string;
  bg: string;
  walkable: boolean;
  designation?: DesignationType;
  resourceDrop?: { type: keyof FortressResources; amount: number };
  revealed: boolean;
}

export type DwarfQuirk =
  | 'DEEP_MINER'
  | 'DRUNKARD'
  | 'LONER'
  | 'SCHOLAR'
  | 'HOTHEAD'
  | 'IRON_BORN'
  | 'GREEDY'
  | 'PIOUS';

export type ThoughtSentiment =
  | 'EUPHORIC'
  | 'POSITIVE'
  | 'NEUTRAL'
  | 'NEGATIVE'
  | 'TERRIFIED';

export type ThoughtCategory =
  | 'SUSTENANCE'
  | 'BEAST_ENCOUNTER'
  | 'COMBAT'
  | 'CRAFT_DELVE'
  | 'FELLOWSHIP'
  | 'OMEN';

export interface DwarfThoughtEntry {
  id: string;
  tick: number;
  year: number;
  season: string;
  text: string;
  category: ThoughtCategory;
  sentiment: ThoughtSentiment;
  moraleDelta: number;
}

export interface DwarfEntity {
  id: string;
  name: string;
  title: string;
  char: string;
  color: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  hunger: number; // 0-100 (100 = full)
  thirst: number; // 0-100 (100 = hydrated)
  energy: number; // 0-100 (100 = rested)
  happiness: number; // 0-100
  state:
    | 'IDLE'
    | 'MOVING'
    | 'WORKING'
    | 'EATING'
    | 'DRINKING'
    | 'SLEEPING'
    | 'FIGHTING'
    | 'PRAYING'
    | 'MENTAL_BREAK'
    | 'INJURED'
    | 'BRAWLING';
  currentTask?: {
    x: number;
    y: number;
    z: number;
    type: DesignationType;
    progress: number;
    totalTicks: number;
    path?: { z: number; y: number; x: number }[];
  };
  labors: Record<DwarfLabor, boolean>;
  thought: string;
  thoughtLog?: DwarfThoughtEntry[];
  skills: Partial<Record<DwarfLabor, number>>;
  weaponEquipped?: boolean;
  weaponType?: WeaponType;
  armorEquipped?: boolean;
  armorType?: ArmorType;
  kills?: number;
  quirk?: DwarfQuirk;
  squadId?: MilitiaSquadId | null;
  patrolLeg?: 0 | 1;
  // New: mental break, injury, brawler tracking
  mentalBreak?: { type: 'DAZE' | 'TANTRUM' | 'FRENZY' | 'FEAR'; startedAt: number; duration: number };
  injury?: { severity: number; ticksToHeal: number };
  brawlerTarget?: string;
}

export type MilitiaSquadId = 'squad-1' | 'squad-2';

export type SquadOrderType = 'FOLLOW_DOCTRINE' | 'STATION' | 'PATROL';

export interface SquadOrder {
  type: SquadOrderType;
  x: number;
  y: number;
  z: number;
  x2?: number;
  y2?: number;
  issuedTick: number;
  label: string;
}

export interface MilitiaSquad {
  id: MilitiaSquadId;
  name: string;
  callsign: string;
  glyph: string;
  color: string;
  memberIds: string[];
  order: SquadOrder;
}

export type RaidTactic =
  | 'GATE_BREAKER'
  | 'PINCER_FLANK'
  | 'SAPPING_SWARM'
  | 'TROPHY_PLUNDER';

export interface RaidBattlePlan {
  id: string;
  tick: number;
  raidName: string;
  warlordName: string;
  tactic: RaidTactic;
  threatLevel: 'MODERATE' | 'HIGH' | 'SEVERE';
  warlordQuote: string;
  targetSummary: string;
  recommendedCounter: string;
  aiGenerated?: boolean;
}

export interface CombatReportEntry {
  id: string;
  tick: number;
  year: number;
  season: string;
  squadId?: MilitiaSquadId | null;
  attackerName: string;
  defenderName: string;
  damageDealt: number;
  damageTaken: number;
  tacticalNote: string;
  outcome: 'CLASH' | 'VANQUISHED' | 'TRAP_CRUSH' | 'RAID_WAVE';
}

export interface MilitiaState {
  activeSquadId: MilitiaSquadId;
  squads: Record<MilitiaSquadId, MilitiaSquad>;
  activeRaidPlan: RaidBattlePlan | null;
  battleLog: CombatReportEntry[];
}

export type HostileKind =
  | 'GOBLIN_RAIDER'
  | 'TROLL_BREAKER'
  | 'CAVE_SPIDER'
  | 'MAGMA_CRAB';

export type HostileBehavior = 'RAID_SEEK' | 'CAVERN_GUARD' | 'FLANK_PATROL';

export type WeaponType =
  | 'BARE_FISTS'
  | 'WOODEN_STAFF'
  | 'IRON_AXE'
  | 'STEEL_BATTLEAXE'
  | 'RUNED_MITHRIL_AXE'
  | 'GOBLIN_PIKE'
  | 'TROLL_CLUB';

export type ArmorType =
  | 'LEATHER'
  | 'IRON_MAIL'
  | 'STEEL_PLATE'
  | 'MITHRIL_MAIL';

export interface Weapon {
  type: WeaponType;
  name: string;
  attackDamage: number;
  attackSpeed: number; // lower is faster (ticks between attacks)
  range: number;
}

export interface Armor {
  type: ArmorType;
  name: string;
  defense: number;
  maxHpBonus: number;
}

export interface HostileEntity {
  id: string;
  name: string;
  kind: HostileKind;
  char: string;
  color: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  attack: number;
  weaponType?: WeaponType;
  armorType?: ArmorType;
  behavior: HostileBehavior;
  tactic?: RaidTactic;
  targetCoord?: { x: number; y: number; z: number };
}

export interface FortressAlert {
  id: string;
  tick: number;
  title: string;
  severity: 'DANGER' | 'DISCOVERY' | 'WARN' | 'INFO';
  x: number;
  y: number;
  z: number;
}

export interface StratumScanSummary {
  zLevel: number;
  name: string;
  ironTiles: number;
  goldTiles: number;
  mithrilTiles: number;
  relicTiles: number;
  hostiles: number;
  dwarves: number;
}

export interface Civilization {
  id: string;
  name: string;
  race: 'Dwarves' | 'Elves' | 'Humans' | 'Goblins';
  stance: 'Allied' | 'Trade Partner' | 'Neutral' | 'Hostile';
  ruler: string;
  capital: { x: number; y: number };
  specialty: string;
}

export interface HistoricalEvent {
  year: number;
  era: 'Age of Myth' | 'Age of Stone' | 'Age of Anvils';
  title: string;
  description: string;
  category: 'FOUNDING' | 'WAR' | 'ARTIFACT' | 'BEAST' | 'DISCOVERY';
}

export interface GeologicalStratum {
  zLevel: number;
  name: string;
  primaryRock: string;
  ores: string[];
  hazard: string;
}

export interface WorldData {
  id: string;
  name: string;
  dwarvenName: string;
  seed: string;
  width: number;
  height: number;
  depth: number;
  backstory: string;
  history: HistoricalEvent[];
  civilizations: Civilization[];
  strata: GeologicalStratum[];
  biomeSummary: Record<Biome, number>;
}

export interface FortressResources {
  stone: number;
  wood: number;
  ironOre: number;
  goldOre: number;
  steelBars: number;
  food: number;
  ale: number;
  furniture: number;
  weapons: number;
  armor: number;
  relics: number;
  wealth: number;
}

export interface WorkOrder {
  id: string;
  title: string;
  workshop:
    | 'WORKSHOP_MASON'
    | 'WORKSHOP_CARPENTER'
    | 'WORKSHOP_STILL'
    | 'WORKSHOP_SMELTER'
    | 'WORKSHOP_FORGE';
  cost: Partial<FortressResources>;
  produce: Partial<FortressResources>;
  remaining: number;
  autoRepeat?: boolean;
}

export interface ChronicleEntry {
  id: string;
  tick: number;
  season: string;
  year: number;
  text: string;
  type: 'INFO' | 'WORK' | 'LORE' | 'ALERT' | 'CRAFT' | 'COMBAT';
}

export type NarrativeEventSeverity =
  | 'MINOR_OMEN'
  | 'STRANGE_MOOD'
  | 'TRADE_CARAVAN'
  | 'DIPLOMATIC_ENVOY'
  | 'MAJOR_CRISIS';

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  cost?: Partial<FortressResources>;
  reward?: Partial<FortressResources>;
  moraleDelta?: number;
  spawnMigrants?: number;
  stanceChange?: {
    race: Civilization['race'];
    stance: Civilization['stance'];
  };
  outcomeLog: string;
}

export interface NarrativeEvent {
  id: string;
  title: string;
  severity: NarrativeEventSeverity;
  asciiArt: string;
  narrative: string;
  historicalConnection: string;
  triggerReason?: string;
  choices: EventChoice[];
  tickTriggered: number;
  resolved?: boolean;
  chosenLabel?: string;
  outcomeSummary?: string;
}

export interface Commission {
  id: string;
  title: string;
  description: string;
  patron: Civilization['race'];
  requirement: { resource: keyof FortressResources; amount: number };
  reward: { wealth: number; favor: number; relic: string };
  deadline: number;
  status: 'OFFERED' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
}

export interface RelicHistoryEntry {
  tick: number;
  text: string;
}

export interface Relic {
  id: string;
  template: string;
  name: string;
  discoveredBy: string;
  discoveredAt: number;
  mode: 'STORED' | 'DISPLAYED' | 'EQUIPPED' | 'GIFTED';
  ownerId?: string;
  giftedTo?: string;
  history: RelicHistoryEntry[];
}

export interface DwarfRelationship {
  a: string;
  b: string;
  score: number;
  reason: string;
}

export interface GuildState {
  favor: Record<Civilization['race'], number>;
  commissions: Commission[];
  relics: Relic[];
  relationships: DwarfRelationship[];
}

export type GuildAction =
  | { type: 'ACCEPT_COMMISSION'; id: string }
  | { type: 'DELIVER_COMMISSION'; id: string }
  | { type: 'SET_RELIC_MODE'; id: string; mode: 'STORED' | 'DISPLAYED' | 'EQUIPPED'; ownerId?: string }
  | { type: 'GIFT_RELIC'; id: string; patron: Civilization['race'] };

export interface StrangeMoodState {
  id: string;
  dwarfId: string;
  dwarfName: string;
  moodKind: 'FEY' | 'SECRETIVE' | 'POSSESSED';
  artifactName: string;
  relicTemplate: string;
  demands: Partial<FortressResources>;
  startedAt: number;
  deadline: number;
}

export type WeatherConditionId =
  | 'SPRING_THAW'
  | 'SPRING_SHOWER'
  | 'SUMMER_SUN'
  | 'SUMMER_SQUALL'
  | 'AUTUMN_MIST'
  | 'AUTUMN_RAIN'
  | 'WINTER_SNOW'
  | 'WINTER_BLIZZARD';

export interface GameState {
  id: string;
  world: WorldData;
  grid: Tile[][][]; // [z][y][x]
  dwarves: DwarfEntity[];
  hostiles: HostileEntity[];
  alerts: FortressAlert[];
  militiaDoctrine: MilitiaDoctrine;
  resources: FortressResources;
  workOrders: WorkOrder[];
  chronicle: ChronicleEntry[];
  activeEvent: NarrativeEvent | null;
  eventHistory: NarrativeEvent[];
  ticks: number;
  year: number;
  season: 'Granite (Spring)' | 'Slate (Summer)' | 'Sands (Autumn)' | 'Timber (Winter)';
  weatherOverride?: WeatherConditionId | null;
  paused: boolean;
  speed: 1 | 2 | 4;
  guild: GuildState;
  activities?: {
    expeditions?: any;
    claimedMilestones?: string[];
    strangeMood?: StrangeMoodState | null;
    unlockedBuildings?: DesignationType[];
    militia?: MilitiaState;
  };
}


