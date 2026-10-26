import type {
  ChronicleEntry,
  CombatReportEntry,
  DwarfEntity,
  GameState,
  HostileEntity,
  MilitiaSquad,
  MilitiaSquadId,
  MilitiaState,
  RaidBattlePlan,
  RaidTactic,
  SquadOrder,
  SquadOrderType,
} from './types.ts';
import { withDwarfThought } from './thoughts.ts';

export type MilitiaAction =
  | { type: 'SELECT_SQUAD'; squadId: MilitiaSquadId }
  | { type: 'ASSIGN_DWARF_SQUAD'; dwarfId: string; squadId: MilitiaSquadId | null }
  | {
      type: 'ISSUE_SQUAD_ORDER';
      squadId: MilitiaSquadId;
      orderType: SquadOrderType;
      x: number;
      y: number;
      z: number;
      x2?: number;
      y2?: number;
      label?: string;
    }
  | { type: 'EQUIP_SQUAD_ARMORY'; squadId: MilitiaSquadId }
  | { type: 'RECORD_AI_RAID_PLAN'; plan: RaidBattlePlan };

export function createDefaultMilitiaState(
  dwarves: DwarfEntity[],
  worldWidth = 76,
  worldHeight = 42
): MilitiaState {
  const cx = Math.floor(worldWidth / 2);
  const cy = Math.floor(worldHeight / 2);

  const initialShieldMembers = dwarves
    .filter((d) => d.labors.COMBAT)
    .slice(0, 4)
    .map((d) => d.id);

  const defaultOrder1: SquadOrder = {
    type: 'FOLLOW_DOCTRINE',
    x: cx + 2,
    y: cy,
    z: 0,
    issuedTick: 0,
    label: 'Following Fortress Doctrine (Gate Readiness)',
  };

  const defaultOrder2: SquadOrder = {
    type: 'FOLLOW_DOCTRINE',
    x: cx - 2,
    y: cy,
    z: 0,
    issuedTick: 0,
    label: 'Following Fortress Doctrine (Deepwatch Reserve)',
  };

  return {
    activeSquadId: 'squad-1',
    squads: {
      'squad-1': {
        id: 'squad-1',
        name: 'Iron Shieldguard',
        callsign: 'SHIELD-1',
        glyph: '♦',
        color: '#ff0099',
        memberIds: initialShieldMembers,
        order: defaultOrder1,
      },
      'squad-2': {
        id: 'squad-2',
        name: 'Deepwatch Vanguard',
        callsign: 'WATCH-2',
        glyph: '»',
        color: '#00ffff',
        memberIds: [],
        order: defaultOrder2,
      },
    },
    activeRaidPlan: null,
    battleLog: [],
  };
}

export function ensureMilitiaState(state: GameState): MilitiaState {
  const existing = state.activities?.militia;
  if (!existing) {
    return createDefaultMilitiaState(
      state.dwarves,
      state.world.width,
      state.world.height
    );
  }

  const validIds = new Set(state.dwarves.map((d) => d.id));
  const s1 = existing.squads['squad-1'];
  const s2 = existing.squads['squad-2'];

  return {
    activeSquadId: existing.activeSquadId || 'squad-1',
    squads: {
      'squad-1': {
        ...s1,
        memberIds: (s1?.memberIds || []).filter((id) => validIds.has(id)),
      },
      'squad-2': {
        ...s2,
        memberIds: (s2?.memberIds || []).filter((id) => validIds.has(id)),
      },
    },
    activeRaidPlan: existing.activeRaidPlan || null,
    battleLog: Array.isArray(existing.battleLog) ? existing.battleLog : [],
  };
}

export function clearMilitiaTileDesignations(
  grid: GameState['grid']
): GameState['grid'] {
  return grid.map((level) =>
    level.map((row) =>
      row.map((tile) =>
        tile.designation === 'MILITIA_STATION' || tile.designation === 'MILITIA_PATROL'
          ? { ...tile, designation: undefined }
          : tile
      )
    )
  );
}

export function performMilitiaAction(
  state: GameState,
  action: MilitiaAction
): { nextState: GameState; success: boolean; message: string } {
  const militia = ensureMilitiaState(state);

  switch (action.type) {
    case 'SELECT_SQUAD': {
      const targetSquad = militia.squads[action.squadId];
      if (!targetSquad) {
        return { nextState: state, success: false, message: 'Unknown squad.' };
      }
      const nextMilitia: MilitiaState = {
        ...militia,
        activeSquadId: action.squadId,
      };
      return {
        nextState: {
          ...state,
          activities: { ...state.activities, militia: nextMilitia },
        },
        success: true,
        message: `Selected ${targetSquad.name} (${targetSquad.callsign}) for tactical orders.`,
      };
    }

    case 'ASSIGN_DWARF_SQUAD': {
      const dwarf = state.dwarves.find((d) => d.id === action.dwarfId);
      if (!dwarf) {
        return { nextState: state, success: false, message: 'Dwarf not found.' };
      }

      const nextSquads: MilitiaState['squads'] = {
        'squad-1': {
          ...militia.squads['squad-1'],
          memberIds: militia.squads['squad-1'].memberIds.filter(
            (id) => id !== action.dwarfId
          ),
        },
        'squad-2': {
          ...militia.squads['squad-2'],
          memberIds: militia.squads['squad-2'].memberIds.filter(
            (id) => id !== action.dwarfId
          ),
        },
      };

      if (action.squadId) {
        nextSquads[action.squadId] = {
          ...nextSquads[action.squadId],
          memberIds: [...nextSquads[action.squadId].memberIds, action.dwarfId],
        };
      }

      const nextDwarves = state.dwarves.map((d) => {
        if (d.id !== action.dwarfId) return d;
        const assignedSquad = action.squadId ? nextSquads[action.squadId] : null;
        const updated: DwarfEntity = {
          ...d,
          squadId: action.squadId,
          patrolLeg: 0,
          labors: {
            ...d.labors,
            COMBAT: action.squadId ? true : d.labors.COMBAT,
          },
        };
        if (assignedSquad) {
          return withDwarfThought(updated, {
            tick: state.ticks,
            year: state.year,
            season: state.season,
            text: `Swore the shield-oath of the ${assignedSquad.name} (${assignedSquad.callsign})!`,
            category: 'COMBAT',
            sentiment: 'POSITIVE',
            moraleDelta: 4,
          });
        }
        return updated;
      });

      const msg = action.squadId
        ? `${dwarf.name} assigned to ${nextSquads[action.squadId].name} (${nextSquads[action.squadId].callsign}).`
        : `${dwarf.name} released from squad duty.`;

      return {
        nextState: {
          ...state,
          dwarves: nextDwarves,
          activities: {
            ...state.activities,
            militia: {
              ...militia,
              activeSquadId: action.squadId || militia.activeSquadId,
              squads: nextSquads,
            },
          },
        },
        success: true,
        message: msg,
      };
    }

    case 'ISSUE_SQUAD_ORDER': {
      const squad = militia.squads[action.squadId];
      if (!squad) {
        return { nextState: state, success: false, message: 'Squad not found.' };
      }

      const clampX = (v: number) =>
        Math.max(0, Math.min(state.world.width - 1, Math.round(v)));
      const clampY = (v: number) =>
        Math.max(0, Math.min(state.world.height - 1, Math.round(v)));
      const clampZ = (v: number) =>
        Math.max(0, Math.min(state.world.depth - 1, Math.round(v)));

      const x = clampX(action.x);
      const y = clampY(action.y);
      const z = clampZ(action.z);
      const x2 = action.x2 !== undefined ? clampX(action.x2) : x;
      const y2 = action.y2 !== undefined ? clampY(action.y2) : y;

      let defaultLabel = 'Following Fortress Doctrine';
      if (action.orderType === 'STATION') {
        defaultLabel = `Stationed Shield-Wall at (${x}, ${y}, Z-${z})`;
      } else if (action.orderType === 'PATROL') {
        defaultLabel = `Patrolling (${x}, ${y}) <-> (${x2}, ${y2}) on Z-${z}`;
      }

      const nextOrder: SquadOrder = {
        type: action.orderType,
        x,
        y,
        z,
        x2: action.orderType === 'PATROL' ? x2 : undefined,
        y2: action.orderType === 'PATROL' ? y2 : undefined,
        issuedTick: state.ticks,
        label: action.label || defaultLabel,
      };

      const nextSquad: MilitiaSquad = {
        ...squad,
        order: nextOrder,
      };

      const memberSet = new Set(squad.memberIds);
      const nextDwarves = state.dwarves.map((d) => {
        if (!memberSet.has(d.id) && d.squadId !== squad.id) return d;
        return {
          ...d,
          squadId: squad.id,
          patrolLeg: 0 as const,
          currentTask: undefined,
        };
      });

      const entry: ChronicleEntry = {
        id: `chron-squad-order-${state.ticks}-${Math.random().toString(36).slice(2, 6)}`,
        tick: state.ticks,
        season: state.season,
        year: state.year,
        text: `[MILITIA ORDER] ${squad.name} (${squad.callsign}): ${nextOrder.label}.`,
        type: 'COMBAT',
      };

      const nextGrid =
        action.orderType === 'FOLLOW_DOCTRINE'
          ? clearMilitiaTileDesignations(state.grid)
          : state.grid;

      return {
        nextState: {
          ...state,
          grid: nextGrid,
          dwarves: nextDwarves,
          chronicle: [entry, ...state.chronicle.slice(0, 59)],
          activities: {
            ...state.activities,
            militia: {
              ...militia,
              activeSquadId: squad.id,
              squads: {
                ...militia.squads,
                [squad.id]: nextSquad,
              },
            },
          },
        },
        success: true,
        message: `${squad.name}: ${nextOrder.label}`,
      };
    }

    case 'EQUIP_SQUAD_ARMORY': {
      const squad = militia.squads[action.squadId];
      if (!squad) {
        return { nextState: state, success: false, message: 'Squad not found.' };
      }
      const memberSet = new Set(squad.memberIds);
      const resources = { ...state.resources };
      let equippedCount = 0;

      const nextDwarves = state.dwarves.map((d) => {
        if (!memberSet.has(d.id) && d.squadId !== squad.id) return d;
        let nextD = { ...d, labors: { ...d.labors, COMBAT: true } };
        if (!nextD.weaponEquipped && resources.weapons > 0) {
          resources.weapons -= 1;
          nextD.weaponEquipped = true;
          equippedCount++;
        }
        if (!nextD.armorEquipped && resources.armor > 0) {
          resources.armor -= 1;
          nextD.armorEquipped = true;
          equippedCount++;
        }
        return nextD;
      });

      const msg =
        equippedCount > 0
          ? `Issued ${equippedCount} armory piece(s) to ${squad.name}.`
          : `${squad.name} is already equipped or armory stockpiles are empty.`;

      return {
        nextState: {
          ...state,
          resources,
          dwarves: nextDwarves,
        },
        success: equippedCount > 0,
        message: msg,
      };
    }

    case 'RECORD_AI_RAID_PLAN': {
      return {
        nextState: {
          ...state,
          activities: {
            ...state.activities,
            militia: {
              ...militia,
              activeRaidPlan: action.plan,
            },
          },
        },
        success: true,
        message: `AI Tactical Dispatch updated: ${action.plan.raidName} [${action.plan.tactic}].`,
      };
    }
  }
}

export function evaluateFortressDefenseProfile(state: GameState): {
  wallCount: number;
  doorCount: number;
  trapCount: number;
  stockpileCount: number;
  farmCount: number;
  armedMilitiaCount: number;
  firstStockpileCoord: { x: number; y: number; z: number } | null;
  firstDoorCoord: { x: number; y: number; z: number } | null;
} {
  let wallCount = 0;
  let doorCount = 0;
  let trapCount = 0;
  let stockpileCount = 0;
  let farmCount = 0;
  let firstStockpileCoord: { x: number; y: number; z: number } | null = null;
  let firstDoorCoord: { x: number; y: number; z: number } | null = null;

  for (let z = 0; z < state.world.depth; z++) {
    const level = state.grid[z] || [];
    for (let y = 0; y < level.length; y++) {
      const row = level[y] || [];
      for (let x = 0; x < row.length; x++) {
        const t = row[x]?.terrain;
        if (t === 'CONSTRUCTED_WALL') wallCount++;
        else if (t === 'DOOR') {
          doorCount++;
          if (!firstDoorCoord && z === 0) firstDoorCoord = { x, y, z };
        } else if (t === 'TRAP_STONE') trapCount++;
        else if (t === 'STOCKPILE_TILE') {
          stockpileCount++;
          if (!firstStockpileCoord && z === 0) firstStockpileCoord = { x, y, z };
        } else if (t === 'FARM_PLOT') farmCount++;
      }
    }
  }

  const armedMilitiaCount = state.dwarves.filter(
    (d) => d.labors.COMBAT && (d.weaponEquipped || d.armorEquipped)
  ).length;

  return {
    wallCount,
    doorCount,
    trapCount,
    stockpileCount,
    farmCount,
    armedMilitiaCount,
    firstStockpileCoord,
    firstDoorCoord,
  };
}

export function buildTacticalRaidPlan(
  state: GameState,
  override?: Partial<RaidBattlePlan>
): RaidBattlePlan {
  const profile = evaluateFortressDefenseProfile(state);
  const goblinCiv =
    state.world.civilizations.find((c) => c.race === 'Goblins') ||
    state.world.civilizations[3];
  const warlordName = goblinCiv?.ruler || 'Warlord Snagtooth the Cruel';
  const civName = goblinCiv?.name || 'The Fang Scourge of Skargash';

  let tactic: RaidTactic = 'SAPPING_SWARM';
  let raidName = `Outrider Skirmish of ${civName}`;
  let threatLevel: RaidBattlePlan['threatLevel'] = 'MODERATE';
  let warlordQuote = `"Strike the surface stairs before their shield-wall forms!"`;
  let targetSummary = 'Fast goblin pike-scouts rushing the central stairway and exposed surface workers.';
  let recommendedCounter =
    'Station Iron Shieldguard (♦) at the central stairs and set Stone Traps (^) along the eastern approach.';

  if (profile.wallCount >= 6 || profile.doorCount >= 2) {
    tactic = 'GATE_BREAKER';
    raidName = `Iron-Ram Siege of ${civName}`;
    threatLevel = 'SEVERE';
    warlordQuote = `"Bring up the Siege Troll! Smash their stone portals to rubble!"`;
    targetSummary = `Armored Troll Breaker and pike escort targeting fortified doors (${profile.doorCount}) and walls (${profile.wallCount}).`;
    recommendedCounter =
      'Station Squad 1 directly behind the portal choke-point (+25% Shield-Wall defense) and Patrol Squad 2 along the flank.';
  } else if (profile.trapCount >= 2) {
    tactic = 'PINCER_FLANK';
    raidName = `Twin-Fang Pincer Raid of ${civName}`;
    threatLevel = 'HIGH';
    warlordQuote = `"Their main road bristles with deadfalls — split the pack North and South!"`;
    targetSummary = `Two flanking packs bypassing ${profile.trapCount} stone traps to strike stockpiles and farms from the north and south.`;
    recommendedCounter =
      'Assign dwarves to both squads: Station Shield-1 at the Stockpile Vault and Patrol Watch-2 across the northern ridge.';
  } else if (state.resources.wealth >= 750) {
    tactic = 'TROPHY_PLUNDER';
    raidName = `Blood-Coffer Reavers of ${civName}`;
    threatLevel = 'HIGH';
    warlordQuote = `"The dwarves hoard ${state.resources.wealth} gold in their vaults — seize the spoils!"`;
    targetSummary = 'Veteran goblin reavers advancing directly toward the surface Stockpile Vault and Trade Depot.';
    recommendedCounter =
      'Issue a Station (♦) order on your Stockpile tiles and equip forged axes from the Armory.';
  }

  return {
    id: `raid-plan-${state.ticks}-${tactic}`,
    tick: state.ticks,
    raidName: override?.raidName || raidName,
    warlordName: override?.warlordName || warlordName,
    tactic: override?.tactic || tactic,
    threatLevel: override?.threatLevel || threatLevel,
    warlordQuote: override?.warlordQuote || warlordQuote,
    targetSummary: override?.targetSummary || targetSummary,
    recommendedCounter: override?.recommendedCounter || recommendedCounter,
    aiGenerated: override?.aiGenerated ?? false,
  };
}

export function spawnTacticalGoblinRaid(
  state: GameState,
  customPlan?: Partial<RaidBattlePlan>
): GameState {
  const militia = ensureMilitiaState(state);
  const plan = buildTacticalRaidPlan(state, customPlan);
  const profile = evaluateFortressDefenseProfile(state);

  const w = state.world.width;
  const h = state.world.height;
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  const goblinCiv =
    state.world.civilizations.find((c) => c.race === 'Goblins')?.name ||
    'The Fang Scourge';

  const baseX = Math.max(3, w - 5);
  const baseY = Math.max(4, Math.min(h - 5, cy));
  const primaryTarget =
    plan.tactic === 'TROPHY_PLUNDER' && profile.firstStockpileCoord
      ? profile.firstStockpileCoord
      : plan.tactic === 'GATE_BREAKER' && profile.firstDoorCoord
      ? profile.firstDoorCoord
      : { x: cx, y: cy, z: 0 };

  const newHostiles: HostileEntity[] = [
    {
      id: `raid-gob-1-${state.ticks}`,
      name: `${goblinCiv} Pike-Raider`,
      kind: 'GOBLIN_RAIDER',
      char: 'g',
      color: '#ff0000',
      x: baseX,
      y: baseY - 1,
      z: 0,
      hp: 45,
      maxHp: 45,
      attack: 8,
      behavior: 'RAID_SEEK',
      tactic: plan.tactic,
      targetCoord: primaryTarget,
    },
    {
      id: `raid-gob-2-${state.ticks}`,
      name: `${goblinCiv} Flank Cutthroat`,
      kind: 'GOBLIN_RAIDER',
      char: 'g',
      color: '#ff9900',
      x: baseX - 1,
      y: plan.tactic === 'PINCER_FLANK' ? Math.max(3, cy - 8) : baseY + 1,
      z: 0,
      hp: 40,
      maxHp: 40,
      attack: 7,
      behavior: plan.tactic === 'PINCER_FLANK' ? 'FLANK_PATROL' : 'RAID_SEEK',
      tactic: plan.tactic,
      targetCoord:
        plan.tactic === 'PINCER_FLANK'
          ? { x: cx - 2, y: Math.max(2, cy - 2), z: 0 }
          : primaryTarget,
    },
  ];

  if (plan.tactic === 'GATE_BREAKER' || state.resources.wealth >= 650) {
    newHostiles.push({
      id: `raid-troll-${state.ticks}`,
      name: 'Armored War-Troll Breaker',
      kind: 'TROLL_BREAKER',
      char: 'T',
      color: '#ff0099',
      x: baseX,
      y: baseY,
      z: 0,
      hp: 75,
      maxHp: 75,
      attack: 11,
      behavior: 'RAID_SEEK',
      tactic: plan.tactic,
      targetCoord: primaryTarget,
    });
  } else if (plan.tactic === 'PINCER_FLANK') {
    newHostiles.push({
      id: `raid-gob-3-${state.ticks}`,
      name: `${goblinCiv} South-Flank Skirmisher`,
      kind: 'GOBLIN_RAIDER',
      char: 'g',
      color: '#ff9900',
      x: baseX - 1,
      y: Math.min(h - 4, cy + 8),
      z: 0,
      hp: 40,
      maxHp: 40,
      attack: 7,
      behavior: 'FLANK_PATROL',
      tactic: plan.tactic,
      targetCoord: { x: cx - 2, y: Math.min(h - 3, cy + 2), z: 0 },
    });
  }

  const report: CombatReportEntry = {
    id: `btl-raid-${state.ticks}-${Math.random().toString(36).slice(2, 6)}`,
    tick: state.ticks,
    year: state.year,
    season: state.season,
    squadId: militia.activeSquadId,
    attackerName: plan.warlordName,
    defenderName: state.world.dwarvenName,
    damageDealt: 0,
    damageTaken: 0,
    tacticalNote: `${plan.raidName} [${plan.tactic}]: ${plan.targetSummary}`,
    outcome: 'RAID_WAVE',
  };

  return {
    ...state,
    hostiles: [...state.hostiles, ...newHostiles],
    alerts: [
      {
        id: `alert-raid-${state.ticks}`,
        tick: state.ticks,
        title: `GOBLIN RAID [${plan.tactic.replace('_', ' ')}]`,
        severity: 'DANGER',
        x: baseX,
        y: baseY,
        z: 0,
      },
      ...state.alerts.slice(0, 7),
    ],
    chronicle: [
      {
        id: `chron-raid-${state.ticks}-${Math.random().toString(36).slice(2, 6)}`,
        tick: state.ticks,
        season: state.season,
        year: state.year,
        text: `[WAR HORN · ${plan.tactic}] ${plan.raidName} (${newHostiles.length} raiders) launched an assault at (${baseX}, ${baseY}, Z-0)! ${plan.warlordQuote}`,
        type: 'COMBAT',
      },
      ...state.chronicle.slice(0, 59),
    ],
    activities: {
      ...state.activities,
      militia: {
        ...militia,
        activeRaidPlan: plan,
        battleLog: [report, ...militia.battleLog].slice(0, 20),
      },
    },
  };
}

export function getDwarfSquad(
  dwarf: DwarfEntity,
  militia: MilitiaState
): MilitiaSquad | null {
  if (dwarf.squadId && militia.squads[dwarf.squadId]) {
    return militia.squads[dwarf.squadId];
  }
  for (const sq of Object.values(militia.squads)) {
    if (sq.memberIds.includes(dwarf.id)) {
      return sq;
    }
  }
  return null;
}

export function getSquadCombatModifiers(
  dwarves: DwarfEntity[],
  dwarf: DwarfEntity,
  militia: MilitiaState
): {
  squad: MilitiaSquad | null;
  nearbySquadmates: number;
  cohesionAttackBonus: number;
  stationDefenseMultiplier: number;
  patrolAttackBonus: number;
  tacticalNote: string;
} {
  const squad = getDwarfSquad(dwarf, militia);
  if (!squad) {
    return {
      squad: null,
      nearbySquadmates: 0,
      cohesionAttackBonus: 0,
      stationDefenseMultiplier: 1,
      patrolAttackBonus: 0,
      tacticalNote: 'Solo Militia Skirmish',
    };
  }

  const nearbySquadmates = dwarves.filter(
    (other) =>
      other.id !== dwarf.id &&
      other.z === dwarf.z &&
      (other.squadId === squad.id || squad.memberIds.includes(other.id)) &&
      Math.max(Math.abs(other.x - dwarf.x), Math.abs(other.y - dwarf.y)) <= 3
  ).length;

  const cohesionAttackBonus = Math.min(8, nearbySquadmates * 4);

  const isNearStation =
    squad.order.type === 'STATION' &&
    squad.order.z === dwarf.z &&
    Math.max(Math.abs(squad.order.x - dwarf.x), Math.abs(squad.order.y - dwarf.y)) <= 4;

  const stationDefenseMultiplier = isNearStation ? 0.75 : 1;
  const patrolAttackBonus =
    squad.order.type === 'PATROL' && squad.order.z === dwarf.z ? 3 : 0;

  const notes: string[] = [squad.callsign];
  if (isNearStation) notes.push('Shield-Wall Station (-25% Dmg)');
  if (patrolAttackBonus > 0) notes.push('Patrol Sweep (+3 ATK)');
  if (cohesionAttackBonus > 0) notes.push(`Squad Cohesion (+${cohesionAttackBonus} ATK)`);

  return {
    squad,
    nearbySquadmates,
    cohesionAttackBonus,
    stationDefenseMultiplier,
    patrolAttackBonus,
    tacticalNote: notes.join(' · '),
  };
}

export function getSquadOrderDestination(
  dwarf: DwarfEntity,
  squad: MilitiaSquad,
  memberIndex: number
): {
  x: number;
  y: number;
  z: number;
  nextPatrolLeg: 0 | 1;
  arrived: boolean;
} | null {
  const order = squad.order;
  if (order.type === 'FOLLOW_DOCTRINE') {
    return null;
  }

  // Spread squad members in a compact 3x3 tactical formation offset around the waypoint
  const offsets = [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: -1 },
  ];
  const off = offsets[memberIndex % offsets.length];

  if (order.type === 'STATION') {
    const tx = order.x + off.dx;
    const ty = order.y + off.dy;
    const arrived =
      dwarf.z === order.z &&
      Math.max(Math.abs(dwarf.x - tx), Math.abs(dwarf.y - ty)) === 0;
    return {
      x: tx,
      y: ty,
      z: order.z,
      nextPatrolLeg: 0,
      arrived,
    };
  }

  // PATROL order: alternate between Waypoint A (order.x, order.y) and Waypoint B (order.x2, order.y2)
  const leg: 0 | 1 = dwarf.patrolLeg === 1 ? 1 : 0;
  const wpAx = order.x;
  const wpAy = order.y;
  const wpBx = order.x2 ?? order.x;
  const wpBy = order.y2 ?? order.y;

  const targetX = (leg === 0 ? wpAx : wpBx) + off.dx;
  const targetY = (leg === 0 ? wpAy : wpBy) + off.dy;
  const dist = Math.max(Math.abs(dwarf.x - targetX), Math.abs(dwarf.y - targetY));

  if (dwarf.z === order.z && dist <= 1) {
    const flippedLeg: 0 | 1 = leg === 0 ? 1 : 0;
    return {
      x: (flippedLeg === 0 ? wpAx : wpBx) + off.dx,
      y: (flippedLeg === 0 ? wpAy : wpBy) + off.dy,
      z: order.z,
      nextPatrolLeg: flippedLeg,
      arrived: false,
    };
  }

  return {
    x: targetX,
    y: targetY,
    z: order.z,
    nextPatrolLeg: leg,
    arrived: false,
  };
}
