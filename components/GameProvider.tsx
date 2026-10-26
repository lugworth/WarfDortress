'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  listUserCloudSaves,
  saveFortressToCloud,
  signInWithGoogle,
  signOutUser,
  testFirestoreConnection,
} from '@/lib/firebase';

export type ScreenMode = 'title' | 'playing' | 'paused';

interface GameContextType {
  screen: ScreenMode;
  setScreen: (s: ScreenMode) => void;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  currentZ: number;
  setCurrentZ: React.Dispatch<React.SetStateAction<number>>;
  selectedTool: DesignationType;
  setSelectedTool: (t: DesignationType) => void;
  selectedDwarfId: string | null;
  setSelectedDwarfId: (id: string | null) => void;
  hoveredTile: Tile | null;
  setHoveredTile: (t: Tile | null) => void;
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
  handleCloudSave: () => Promise<void>;
  handleGoogleSignIn: () => Promise<void>;
  handleSignOut: () => Promise<void>;
  loadCloudSave: (save: CloudFortressSave) => void;
  performGuildAction: (action: GuildAction) => boolean;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreenState] = useState<ScreenMode>('title');
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState('Khazad-251'));
  const [currentZ, setCurrentZ] = useState<number>(0);
  const [selectedTool, setSelectedTool] = useState<DesignationType>('MINE');
  const [selectedDwarfId, setSelectedDwarfId] = useState<string | null>('dwarf-1');
  const [hoveredTile, setHoveredTile] = useState<Tile | null>(null);
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
        setGameState(createInitialGameState(freshSeed));
        if (autostart) {
          setScreenState('playing');
          document.body.dataset.state = 'playing';
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, []);

  useEffect(() => {
    testFirestoreConnection();
    if (typeof document !== 'undefined') {
      document.body.dataset.state = screen;
    }
  }, [screen]);

  useEffect(() => {
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
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    const baseInterval = isHeadless ? 700 : 480;
    const intervalMs = Math.max(120, Math.floor(baseInterval / gameState.speed));

    const timer = setInterval(() => {
      setGameState((prev) => (prev.paused ? prev : stepSimulationTick(prev)));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [screen, gameState.paused, gameState.speed]);

  const jumpToLocation = useCallback((x: number, y: number, z: number) => {
    setCurrentZ(z);
    setInspectedCoord({ x, y, z });
    setPingTarget({ x, y, z, timestamp: Date.now() });
  }, []);

  const embarkNewWorld = useCallback(
    async (seed: string, enhanceWithAI = true) => {
      const cleanSeed = seed.trim() || 'Khazad-251';
      const freshState = createInitialGameState(cleanSeed);
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
          if (data && data.backstory && Array.isArray(data.history) && data.history.length > 0) {
            setGameState((prev) => ({
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
    [setScreen]
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
    [currentZ, selectedTool]
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
  }, []);

  const applyPreset = useCallback((preset: LaborPresetId) => {
    setGameState((prev) => applyLaborPreset(prev, preset));
  }, []);

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
  }, []);

  const triggerGoblinRaid = useCallback(() => {
    setGameState((prev) => spawnGoblinRaid(prev));
  }, []);

  const performTradeBarter = useCallback(
    (
      give: Partial<FortressResources>,
      receive: Partial<FortressResources>,
      recruitMigrant = false
    ) => {
      setGameState((prev) => executeTradeBarter(prev, give, receive, recruitMigrant));
    },
    []
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
  }, []);

  const toggleWorkOrderAutoRepeat = useCallback((orderId: string) => {
    setGameState((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((o) =>
        o.id === orderId ? { ...o, autoRepeat: !o.autoRepeat, remaining: Math.max(1, o.remaining) } : o
      ),
    }));
  }, []);

  const removeWorkOrder = useCallback((orderId: string) => {
    setGameState((prev) => ({
      ...prev,
      workOrders: prev.workOrders.filter((o) => o.id !== orderId),
    }));
  }, []);

  const triggerNarrativeEvent = useCallback(
    async (severity?: NarrativeEventSeverity, useAI = true) => {
      setGameState((prev) => {
        const deterministicEvt = generateContextAwareEvent(prev, severity);
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
        if (data?.event) {
          setGameState((prev) => (prev.activeEvent ? { ...prev, activeEvent: data.event } : prev));
        }
      } catch {
        // Keep the instant context-aware event if network/API is unavailable
      } finally {
        setIsGeneratingEvent(false);
      }
    },
    [gameState]
  );

  const resolveActiveEvent = useCallback((choiceId: string) => {
    setGameState((prev) => resolveNarrativeEvent(prev, choiceId));
  }, []);

  const stepManualTick = useCallback(() => {
    setGameState((prev) => stepSimulationTick(prev));
  }, []);

  const togglePause = useCallback(() => {
    setGameState((prev) => ({ ...prev, paused: !prev.paused }));
  }, []);

  const setSpeed = useCallback((speed: 1 | 2 | 4) => {
    setGameState((prev) => ({ ...prev, speed, paused: false }));
  }, []);

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
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ascii_fortress_autosave', JSON.stringify(gameState));
      }
      if (!auth.currentUser) {
        setSaveStatus('Saved locally! Sign in with Google to sync to Firestore Cloud.');
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
  }, [gameState]);

  const loadCloudSave = useCallback(
    (save: CloudFortressSave) => {
      const restored = createInitialGameState(save.seed);
      setGameState({
        ...restored,
        id: save.id,
        ticks: save.ticks,
        year: save.year,
        season: (save.season as GameState['season']) || 'Granite (Spring)',
        resources: {
          ...restored.resources,
          ...(save.resources || {}),
        },
      });
      setCurrentZ(0);
      setScreen('playing');
      setSaveStatus(`Loaded ${save.dwarvenName} (Year ${save.year})`);
    },
    [setScreen]
  );

  const performGuildAction = useCallback((action: GuildAction): boolean => {
    let success = false;
    setGameState((prev) => {
      const res = executeGuildAction(prev, action);
      success = res.success;
      return res.nextState;
    });
    return success;
  }, []);

  return (
    <GameContext.Provider
      value={{
        screen,
        setScreen,
        gameState,
        setGameState,
        currentZ,
        setCurrentZ,
        selectedTool,
        setSelectedTool,
        selectedDwarfId,
        setSelectedDwarfId,
        hoveredTile,
        setHoveredTile,
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
        handleCloudSave,
        handleGoogleSignIn,
        handleSignOut,
        loadCloudSave,
        performGuildAction,
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
