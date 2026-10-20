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
    | 'PRAYING';
  currentTask?: {
    x: number;
    y: number;
    z: number;
    type: DesignationType;
    progress: number;
    totalTicks: number;
  };
  labors: Record<DwarfLabor, boolean>;
  thought: string;
  skills: Partial<Record<DwarfLabor, number>>;
  weaponEquipped?: boolean;
  armorEquipped?: boolean;
  kills?: number;
}

export type HostileKind =
  | 'GOBLIN_RAIDER'
  | 'TROLL_BREAKER'
  | 'CAVE_SPIDER'
  | 'MAGMA_CRAB';

export type HostileBehavior = 'RAID_SEEK' | 'CAVERN_GUARD' | 'FLANK_PATROL';

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
  behavior: HostileBehavior;
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
  paused: boolean;
  speed: 1 | 2 | 4;
}
