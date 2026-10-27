'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  DesignationType,
  DwarfEntity,
  DwarfLabor,
  FortressResources,
  GameState,
  GuildAction,
  LaborPresetId,
  MilitiaDoctrine,
  NarrativeEventSeverity,
  Tile,
  WorkOrder,
} from '@/lib/types';
import { performGuildAction as executeGuildAction } from '@/lib/guild';
import {
  performExpeditionAction as executeExpeditionAction,
  type ExpeditionAction,
} from '@/lib/expeditions';
import {
  getFortressProgression,
  type FortressProgressionSummary,
  claimMilestoneReward,
  fulfillStrangeMood,
  syncBuildingUnlocks,
  triggerStrangeMood,
} from '@/lib/progression';
import {
  applyWeatherExposureToDwarf,
  getCurrentWeather,
  isShelteredOrPavedTile,
} from '@/lib/weather';
import {
  buildTacticalRaidPlan,
  ensureMilitiaState,
  evaluateFortressDefenseProfile,
  performMilitiaAction,
  spawnTacticalGoblinRaid,
  type MilitiaAction,
} from '@/lib/militia';

import {
  activateBuildingTileFunction,
  applyAreaDesignation,
  applyLaborPreset,
  createInitialGameState,
  executeTradeBarter,
  generateContextAwareEvent,
  resolveNarrativeEvent,
  spawnGoblinRaid,
  stepSimulationTick,
} from '@/lib/game-engine';
import { generateRandomWorldSeed } from '@/lib/world-gen';
import {
  auth,
  CloudFortressSave,
  getCloudSaveId,
  listUserCloudSaves,
  saveFortressToCloud,
  signInWithGoogle,
  signOutUser,
  testFirestoreConnection,
} from '@/lib/firebase';

import { LOCAL_SAVE_KEY, parseLocalSave, serializeLocalSave, getLocalSaveSummary, type LocalSaveSummary } from '@/lib/local-save';

export type ScreenMode = 'title' | 'playing' | 'paused';

interface GameContextType {
  screen: ScreenMode;
  setScreen: (s: ScreenMode) => void;
  gameState: GameState;
  progression: FortressProgressionSummary;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  currentZ: number;
  setCurrentZ: React.Dispatch<React.SetStateAction<number>>;
  selectedTool: DesignationType;
  setSelectedTool: (t: DesignationType) => void;
  selectedDwarfId: string | null;
  setSelectedDwarfId: (id: string | null) => void;
  inspectMode: boolean;
  setInspectMode: React.Dispatch<React.SetStateAction<boolean>>;
  inspectedCoord: { x: number; y: number; z: number } | null;
  setInspectedCoord: (coord: { x: number; y: number; z: number } | null) => void;
  pingTarget: { x: number; y: number; z: number; timestamp: number } | null;
  jumpToLocation: (x: number, y: number, z: number) => void;
  embarkNewWorld: (seed: string, enhanceWithAI?: boolean) => Promise<void>;
  designateBox: (x1: number, y1: number, x2: number, y2: number, toolOverride?: DesignationType, zOverride?: number) => number;
  toggleDwarfLabor: (dwarfId: string, labor: DwarfLabor) => void;
  applyPreset: (preset: LaborPresetId) => void;
  setMilitiaDoctrine: (doctrine: MilitiaDoctrine) => void;
  triggerGoblinRaid: () => void;
  performTradeBarter: (
    give: Partial<FortressResources>,
    receive: Partial<FortressResources>,
    recruitMigrant?: boolean
  ) => void;
  addWorkOrder: (order: Omit<WorkOrder, 'id'>) => void;
  toggleWorkOrderAutoRepeat: (orderId: string) => void;
  removeWorkOrder: (orderId: string) => void;
  triggerNarrativeEvent: (severity?: NarrativeEventSeverity, useAI?: boolean) => Promise<void>;
  resolveActiveEvent: (choiceId: string) => void;
  isGeneratingEvent: boolean;
  stepManualTick: () => void;
  togglePause: () => void;
  setSpeed: (speed: 1 | 2 | 4) => void;
  user: User | null;
  cloudSaves: CloudFortressSave[];
  saveStatus: string | null;
  localSave: LocalSaveSummary | null;
  resumeLocalSave: () => void;
  handleCloudSave: () => Promise<void>;
  handleGoogleSignIn: () => Promise<void>;
  handleSignOut: () => Promise<void>;
  loadCloudSave: (save: CloudFortressSave) => void;
  performGuildAction: (action: GuildAction) => boolean;
  performExpeditionAction: (action: ExpeditionAction) => boolean;
  claimMilestone: (milestoneId: string) => boolean;
  startStrangeMood: () => boolean;
  completeStrangeMood: () => boolean;
  cycleSeasonWeather: () => void;
  activateBuildingFunction: (x: number, y: number, z: number) => { triggered: boolean; message: string };
  dispatchMilitiaAction: (action: MilitiaAction) => { success: boolean; message: string };
  triggerAIRaidAnalysis: (spawnRaid?: boolean) => Promise<{ message: string }>;
}


const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreenState] = useState<ScreenMode>('title');
  const [gameState, setGameStateInternal] = useState<GameState>(() => createInitialGameState('Khazad-251'));
  const latestState = useRef(gameState);
  // Game commands need their result immediately. Evaluate once against the latest
  // snapshot, then publish it to React; updater replay must not change return values.
  const setGameState = useCallback<React.Dispatch<React.SetStateAction<GameState>>>((update) => {
    const next = typeof update === 'function' ? update(latestState.current) : update;
    latestState.current = next;
    setGameStateInternal(next);
  }, []);
  const progression = useMemo(() => getFortressProgression(gameState), [gameState]);
  const [currentZ, setCurrentZ] = useState<number>(0);
  const [selectedTool, setSelectedTool] = useState<DesignationType>('MINE');
  const [selectedDwarfId, setSelectedDwarfId] = useState<string | null>('dwarf-1');
  const [inspectMode, setInspectMode] = useState<boolean>(false);
  const [inspectedCoord, setInspectedCoord] = useState<{ x: number; y: number; z: number } | null>({
    x: 39,
    y: 21,
    z: 0,
  });
  const [pingTarget, setPingTarget] = useState<{
    x: number;
    y: number;
    z: number;
    timestamp: number;
  } | null>(null);
  const [isGeneratingEvent, setIsGeneratingEvent] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [cloudSaves, setCloudSaves] = useState<CloudFortressSave[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const [localSave, setLocalSave] = useState<LocalSaveSummary | null>(null);
  const sessionStarted = useRef(false);
  const persistLocal = useCallback((state: GameState) => {
    try {
      localStorage.setItem(LOCAL_SAVE_KEY, serializeLocalSave(state));
      setLocalSave(getLocalSaveSummary(state));
      return true;
    } catch {
      setSaveStatus('Local save unavailable. Browser storage may be full or disabled.');
      return false;
    }
  }, []);

  const setScreen = useCallback((next: ScreenMode) => {
    setScreenState(next);
    if (typeof document !== 'undefined') {
      document.body.dataset.state = next;
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const freshSeed = generateRandomWorldSeed();
      const params = new URLSearchParams(window.location.search);
      const autostart = params.get('autostart') === '1';
      const frame = requestAnimationFrame(() => {
        let restored: GameState | null = null;
        try {
          restored = parseLocalSave(localStorage.getItem(LOCAL_SAVE_KEY));
          if (restored) setLocalSave(getLocalSaveSummary(restored));
        } catch { /* Storage can be disabled; the game still runs. */ }
        setGameState(autostart && restored ? restored : createInitialGameState(freshSeed));
        if (autostart) {
          sessionStarted.current = true;
          setScreenState('playing');
          document.body.dataset.state = 'playing';
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [setGameState]);

  useEffect(() => {
    if (screen !== 'playing') return;
    let lastSaved: GameState | null = null;
    let idleSave: number | null = null;
    const save = () => {
      if (sessionStarted.current && latestState.current !== lastSaved && persistLocal(latestState.current)) lastSaved = latestState.current;
    };
    const scheduleSave = () => {
      if (idleSave !== null) return;
      if ('requestIdleCallback' in window) idleSave = window.requestIdleCallback(() => { idleSave = null; save(); }, { timeout: 2000 });
      else save();
    };
    const timer = window.setInterval(scheduleSave, 15_000);
    const onVisibility = () => { if (document.hidden) save(); };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      if (idleSave !== null) window.cancelIdleCallback(idleSave);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onVisibility);
      save();
    };
  }, [screen, persistLocal]);

  useEffect(() => {
    if (!saveStatus) return;
    const timer = window.setTimeout(() => setSaveStatus(null), 6000);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.state = screen;
    }
  }, [screen]);

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const saves = await listUserCloudSaves();
          setCloudSaves(saves);
        } catch (e) {
          console.error('Failed to list cloud saves:', e);
        }
      } else {
        setCloudSaves([]);
      }
    });
    return () => unsub();
  }, []);

  const speedRef = useRef(gameState.speed);
  const pausedRef = useRef(gameState.paused);
  useEffect(() => {
    speedRef.current = gameState.speed;
    pausedRef.current = gameState.paused;
  }, [gameState.speed, gameState.paused]);

  useEffect(() => {
    if (screen !== 'playing' || gameState.paused) return;
    const baseInterval = 480;
    const intervalMs = Math.max(120, Math.floor(baseInterval / gameState.speed));

    const timer = setInterval(() => {
      if (!document.hidden) setGameState((prev) => (prev.paused ? prev : stepSimulationTick(prev)));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [screen, gameState.paused, gameState.speed, setGameState]);

  const jumpToLocation = useCallback((x: number, y: number, z: number) => {
    setCurrentZ(z);
    setInspectedCoord({ x, y, z });
    setPingTarget({ x, y, z, timestamp: Date.now() });
  }, []);

  const embarkNewWorld = useCallback(
    async (seed: string, enhanceWithAI = true) => {
      const cleanSeed = seed.trim() || 'Khazad-251';
      const freshState = { ...createInitialGameState(cleanSeed), paused: true };
      sessionStarted.current = true;
      persistLocal(freshState);
      setGameState(freshState);
      setCurrentZ(0);
      setSelectedDwarfId(freshState.dwarves[0]?.id || null);
      setInspectedCoord({
        x: freshState.dwarves[0]?.x || 24,
        y: freshState.dwarves[0]?.y || 16,
        z: 0,
      });
      setScreen('playing');

      if (enhanceWithAI) {
        try {
          const res = await fetch('/api/world/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              seed: cleanSeed,
              dwarvenName: freshState.world.dwarvenName,
              name: freshState.world.name,
              civilizations: freshState.world.civilizations,
            }),
          });
          const data = await res.json();
          if (res.ok && data && data.backstory && Array.isArray(data.history) && data.history.length > 0) {
            setGameState((prev) => prev.id !== freshState.id ? prev : ({
              ...prev,
              world: {
                ...prev.world,
                backstory: data.backstory,
                history: data.history,
              },
            }));
          }
        } catch {
          // Deterministic lore is already populated
        }
      }
    },
    [setScreen, persistLocal, setGameState]
  );

  const designateBox = useCallback(
    (x1: number, y1: number, x2: number, y2: number, toolOverride?: DesignationType, zOverride?: number): number => {
      const activeTool = toolOverride || selectedTool;
      const targetZ = zOverride !== undefined ? zOverride : currentZ;
      let modifiedCount = 0;
      setGameState((prev) => {
        const { nextState, count } = applyAreaDesignation(prev, targetZ, x1, y1, x2, y2, activeTool);
        modifiedCount = count;
        return nextState;
      });
      return modifiedCount;
    },
    [currentZ, selectedTool, setGameState]
  );

  const toggleDwarfLabor = useCallback((dwarfId: string, labor: DwarfLabor) => {
    setGameState((prev) => ({
      ...prev,
      dwarves: prev.dwarves.map((d: DwarfEntity) =>
        d.id === dwarfId
          ? {
              ...d,
              labors: {
                ...d.labors,
                [labor]: !d.labors[labor],
              },
            }
          : d
      ),
    }));
  }, [setGameState]);

  const applyPreset = useCallback((preset: LaborPresetId) => {
    setGameState((prev) => applyLaborPreset(prev, preset));
  }, [setGameState]);

  const setMilitiaDoctrine = useCallback((doctrine: MilitiaDoctrine) => {
    setGameState((prev) => ({
      ...prev,
      militiaDoctrine: doctrine,
      chronicle: [
        {
          id: `chron-doc-${Date.now()}`,
          tick: prev.ticks,
          season: prev.season,
          year: prev.year,
          text: `Militia doctrine set to [${doctrine.replace('_', ' ')}].`,
          type: 'COMBAT',
        },
        ...prev.chronicle.slice(0, 59),
      ],
    }));
  }, [setGameState]);

  const triggerGoblinRaid = useCallback(() => {
    setGameState((prev) => spawnGoblinRaid(prev));
  }, [setGameState]);

  const performTradeBarter = useCallback(
    (
      give: Partial<FortressResources>,
      receive: Partial<FortressResources>,
      recruitMigrant = false
    ) => {
      setGameState((prev) => executeTradeBarter(prev, give, receive, recruitMigrant));
    },
    [setGameState]
  );

  const addWorkOrder = useCallback((order: Omit<WorkOrder, 'id'>) => {
    setGameState((prev) => ({
      ...prev,
      workOrders: [
        ...prev.workOrders,
        {
          ...order,
          id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        },
      ],
      chronicle: [
        {
          id: `chron-order-${Date.now()}`,
          tick: prev.ticks,
          season: prev.season,
          year: prev.year,
          text: `Queued workshop order: ${order.title} (${order.remaining}x).`,
          type: 'CRAFT',
        },
        ...prev.chronicle.slice(0, 59),
      ],
    }));
  }, [setGameState]);

  const toggleWorkOrderAutoRepeat = useCallback((orderId: string) => {
    setGameState((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((o) =>
        o.id === orderId ? { ...o, autoRepeat: !o.autoRepeat, remaining: Math.max(1, o.remaining) } : o
      ),
    }));
  }, [setGameState]);

  const removeWorkOrder = useCallback((orderId: string) => {
    setGameState((prev) => ({
      ...prev,
      workOrders: prev.workOrders.filter((o) => o.id !== orderId),
    }));
  }, [setGameState]);

  const triggerNarrativeEvent = useCallback(
    async (severity?: NarrativeEventSeverity, useAI = true) => {
      let placeholderId = '';
      setGameState((prev) => {
        const deterministicEvt = generateContextAwareEvent(prev, severity);
        placeholderId = deterministicEvt.id;
        return {
          ...prev,
          activeEvent: deterministicEvt,
          chronicle: [
            {
              id: `chron-evt-trig-${Date.now()}`,
              tick: prev.ticks,
              season: prev.season,
              year: prev.year,
              text: `[EVENT] ${deterministicEvt.title} — Awaiting Overseer Decree!`,
              type: 'ALERT',
            },
            ...prev.chronicle.slice(0, 59),
          ],
        };
      });

      if (!useAI) return;

      // Commands read the live snapshot; the render-time gameState can be ticks old.
      const gameState = latestState.current;
      setIsGeneratingEvent(true);
      try {
        const res = await fetch('/api/events/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worldName: gameState.world.name,
            dwarvenName: gameState.world.dwarvenName,
            year: gameState.year,
            season: gameState.season,
            ticks: gameState.ticks,
            resources: gameState.resources,
            population: gameState.dwarves.length,
            civilizations: gameState.world.civilizations,
            history: gameState.world.history,
            pastEvents: gameState.eventHistory.slice(0, 5).map((e) => ({
              title: e.title,
              chosenLabel: e.chosenLabel,
              outcome: e.outcomeSummary,
            })),
            requestedSeverity: severity,
          }),
        });
        const data = await res.json();
        const event = data?.event;
        if (event && typeof event.title === 'string' && Array.isArray(event.choices) && event.choices.length > 0) {
          // Only replace the placeholder; the player may already have answered it.
          setGameState((prev) => (prev.activeEvent?.id === placeholderId ? { ...prev, activeEvent: event } : prev));
        }
      } catch {
        // Keep the instant context-aware event if network/API is unavailable
      } finally {
        setIsGeneratingEvent(false);
      }
    },
    [setGameState]
  );

  const resolveActiveEvent = useCallback((choiceId: string) => {
    setGameState((prev) => resolveNarrativeEvent(prev, choiceId));
  }, [setGameState]);

  const stepManualTick = useCallback(() => {
    setGameState((prev) => stepSimulationTick(prev));
  }, [setGameState]);

  const togglePause = useCallback(() => {
    setGameState((prev) => ({ ...prev, paused: !prev.paused }));
  }, [setGameState]);

  const setSpeed = useCallback((speed: 1 | 2 | 4) => {
    setGameState((prev) => ({ ...prev, speed }));
  }, [setGameState]);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const u = await signInWithGoogle();
      if (u) {
        const saves = await listUserCloudSaves();
        setCloudSaves(saves);
        setSaveStatus(`Signed in as ${u.displayName || u.email}`);
      }
    } catch (e) {
      setSaveStatus(e instanceof Error ? e.message : 'Sign-in cancelled');
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
    setSaveStatus('Signed out');
  }, []);

  const handleCloudSave = useCallback(async () => {
    const gameState = latestState.current;
    try {
      const savedLocally = persistLocal(gameState);
      if (!auth.currentUser) {
        if (savedLocally) setSaveStatus('Fortress saved in this browser.');
        return;
      }
      setSaveStatus('Syncing fortress to Firestore...');
      await saveFortressToCloud(gameState);
      const saves = await listUserCloudSaves();
      setCloudSaves(saves);
      setSaveStatus(`Saved ${gameState.world.dwarvenName} to Firestore Cloud!`);
    } catch (e) {
      setSaveStatus(e instanceof Error ? e.message : 'Cloud save failed');
    }
  }, [persistLocal]);

  const startSession = useCallback((state: GameState, status: string) => {
    sessionStarted.current = true;
    setGameState(state);
    setCurrentZ(0);
    setSelectedDwarfId(state.dwarves[0]?.id ?? null);
    setInspectMode(false);
    setScreen('playing');
    setSaveStatus(status);
  }, [setScreen, setGameState]);

  const resumeLocalSave = useCallback(() => {
    try {
      const saved = parseLocalSave(localStorage.getItem(LOCAL_SAVE_KEY));
      if (!saved) { setSaveStatus("The local save could not be read."); return; }
      startSession(saved, `Resumed ${saved.world.dwarvenName}. Press Resume when ready.`);
    } catch { setSaveStatus("Browser storage is unavailable."); }
  }, [startSession]);

  const loadCloudSave = useCallback(
    (save: CloudFortressSave) => {
      // Cloud archives hold a summary. This browser's checkpoint of the same
      // fortress has the full map and clan, so prefer it when it is as recent.
      let local: GameState | null = null;
      try { local = parseLocalSave(localStorage.getItem(LOCAL_SAVE_KEY)); } catch { /* storage disabled */ }
      if (local && getCloudSaveId(local) === save.id && local.ticks >= save.ticks) {
        startSession(local, `Resumed ${save.dwarvenName} with its full map from this browser. Press Resume when ready.`);
        return;
      }
      const restored = createInitialGameState(save.seed);
      startSession({
        ...restored,
        id: save.id,
        ticks: save.ticks,
        year: save.year,
        season: (save.season as GameState['season']) || 'Granite (Spring)',
        resources: {
          ...restored.resources,
          ...(save.resources || {}),
        },
        paused: true,
      }, `Loaded ${save.dwarvenName} (Year ${save.year}). Cloud archives keep stockpiles and the calendar; the map and clan start fresh from the seed.`);
    },
    [startSession]
  );

  const performGuildAction = useCallback((action: GuildAction): boolean => {
    let success = false;
    setGameState((prev) => {
      const res = executeGuildAction(prev, action);
      success = res.success;
      return res.nextState;
    });
    return success;
  }, [setGameState]);

  const performExpeditionAction = useCallback((action: ExpeditionAction) => {
    let success = false;
    setGameState((prev) => {
      const res = executeExpeditionAction(prev, action);
      success = res.success;
      return res.nextState;
    });
    return success;
  }, [setGameState]);

  const claimMilestone = useCallback((milestoneId: string) => {
    let claimed = false;
    setGameState((prev) => {
      const res = claimMilestoneReward(prev, milestoneId);
      claimed = res.claimed;
      return res.nextState;
    });
    return claimed;
  }, [setGameState]);

  const startStrangeMood = useCallback(() => {
    let triggered = false;
    setGameState((prev) => {
      const res = triggerStrangeMood(prev);
      triggered = res.triggered;
      return res.nextState;
    });
    return triggered;
  }, [setGameState]);

  const completeStrangeMood = useCallback(() => {
    let fulfilled = false;
    setGameState((prev) => {
      const res = fulfillStrangeMood(prev);
      fulfilled = res.fulfilled;
      return syncBuildingUnlocks(res.nextState).nextState;
    });
    return fulfilled;
  }, [setGameState]);

  const cycleSeasonWeather = useCallback(() => {
    const seasons: GameState['season'][] = [
      'Granite (Spring)',
      'Slate (Summer)',
      'Sands (Autumn)',
      'Timber (Winter)',
    ];
    setGameState((prev) => {
      const idx = Math.max(0, seasons.indexOf(prev.season));
      const nextSeason = seasons[(idx + 1) % seasons.length];
      const nextWeather = getCurrentWeather({
        season: nextSeason,
        ticks: prev.ticks,
        weatherOverride: null,
      });

      const nextDwarves = prev.dwarves.map((d) => {
        const clone: DwarfEntity = {
          ...d,
          labors: { ...d.labors },
          skills: { ...d.skills },
          thoughtLog: Array.isArray(d.thoughtLog) ? [...d.thoughtLog] : [],
        };
        const tile = prev.grid[clone.z]?.[clone.y]?.[clone.x];
        applyWeatherExposureToDwarf(clone, nextWeather, {
          tick: prev.ticks + 1,
          year: prev.year,
          season: nextSeason,
          isSheltered: isShelteredOrPavedTile(tile),
        });
        return clone;
      });

      const entry = {
        id: `chron-weather-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tick: prev.ticks,
        season: nextSeason,
        year: prev.year,
        text: `[SEASON & WEATHER] Season shifted to ${nextSeason} — ${nextWeather.glyph} ${nextWeather.label} (${nextWeather.summary}).`,
        type: 'LORE' as const,
      };


      return {
        ...prev,
        season: nextSeason,
        weatherOverride: null,
        dwarves: nextDwarves,
        chronicle: [entry, ...prev.chronicle.slice(0, 59)],
      };
    });
  }, [setGameState]);

  const activateBuildingFunction = useCallback(
    (x: number, y: number, z: number) => {
      let result = { triggered: false, message: '' };
      setGameState((prev) => {
        const { nextState, ...outcome } = activateBuildingTileFunction(prev, x, y, z);
        result = outcome;
        return nextState;
      });
      return result;
    },
    [setGameState]
  );

  const dispatchMilitiaAction = useCallback(
    (action: MilitiaAction) => {
      let result = { success: false, message: '' };
      setGameState((prev) => {
        const { nextState, success, message } = performMilitiaAction(prev, action);
        result = { success, message };
        return nextState;
      });
      return result;
    },
    [setGameState]
  );

  const triggerAIRaidAnalysis = useCallback(
    async (spawnRaid = false) => {
      const gameState = latestState.current;
      const profile = evaluateFortressDefenseProfile(gameState);
      const militia = ensureMilitiaState(gameState);
      const goblinCiv =
        gameState.world.civilizations.find((c) => c.race === 'Goblins') ||
        gameState.world.civilizations[3];

      let aiPlanOverride: Record<string, unknown> | undefined;
      try {
        const res = await fetch('/api/combat/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dwarvenName: gameState.world.dwarvenName,
            year: gameState.year,
            season: gameState.season,
            ticks: gameState.ticks,
            wealth: gameState.resources.wealth,
            wallCount: profile.wallCount,
            doorCount: profile.doorCount,
            trapCount: profile.trapCount,
            stockpileCount: profile.stockpileCount,
            squads: Object.values(militia.squads),
            goblinCiv,
          }),
        });
        const data = await res.json();
        if (data?.plan) {
          aiPlanOverride = data.plan;
        }
      } catch {
        // Fallback to deterministic tactical evaluation
      }

      const finalPlan = buildTacticalRaidPlan(gameState, aiPlanOverride);
      if (spawnRaid) {
        setGameState((prev) => spawnTacticalGoblinRaid(prev, finalPlan));
        return {
          message: `[WAR HORN · ${finalPlan.tactic}] ${finalPlan.raidName} launched!`,
        };
      } else {
        setGameState((prev) => performMilitiaAction(prev, {
          type: 'RECORD_AI_RAID_PLAN',
          plan: finalPlan,
        }).nextState);
        return {
          message: `Tactical Dispatch: ${finalPlan.raidName} [${finalPlan.tactic}] — ${finalPlan.recommendedCounter}`,
        };
      }
    },
    [setGameState]
  );

  return (
    <GameContext.Provider
      value={{
        screen,
        setScreen,
        gameState,
        progression,
        setGameState,
        currentZ,
        setCurrentZ,
        selectedTool,
        setSelectedTool,
        selectedDwarfId,
        setSelectedDwarfId,
        inspectMode,
        setInspectMode,
        inspectedCoord,
        setInspectedCoord,
        pingTarget,
        jumpToLocation,
        embarkNewWorld,
        designateBox,
        toggleDwarfLabor,
        applyPreset,
        setMilitiaDoctrine,
        triggerGoblinRaid,
        performTradeBarter,
        addWorkOrder,
        toggleWorkOrderAutoRepeat,
        removeWorkOrder,
        triggerNarrativeEvent,
        resolveActiveEvent,
        isGeneratingEvent,
        stepManualTick,
        togglePause,
        setSpeed,
        user,
        cloudSaves,
        saveStatus,
        localSave,
        resumeLocalSave,
        handleCloudSave,
        handleGoogleSignIn,
        handleSignOut,
        loadCloudSave,
        performGuildAction,
        performExpeditionAction,
        claimMilestone,
        startStrangeMood,
        completeStrangeMood,
        cycleSeasonWeather,
        activateBuildingFunction,
        dispatchMilitiaAction,
        triggerAIRaidAnalysis,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}


export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within a GameProvider');
  return context;
}
