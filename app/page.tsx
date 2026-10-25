'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GameProvider, useGame } from '@/components/GameProvider';
import ASCIIViewport from '@/components/ASCIIViewport';
import Sidebar from '@/components/Sidebar';
import AdvisorPanel from '@/components/AdvisorPanel';
import GuildHallModal from '@/components/GuildHallModal';
import NarrativeEventModal from '@/components/NarrativeEventModal';
import { TradeDepotModal } from '@/components/TradeDepotModal';
import {
  generateDeterministicWorldMeta,
  generateRandomWorldSeed,
  getSurfaceArchetype,
} from '@/lib/world-gen';
import { useIsMobile } from '@/hooks/use-mobile';
import { MAX_SEED_LENGTH } from '@/lib/game-rules';
import { UIProvider, useUI } from '@/components/UIProvider';
import UIOverlay from '@/components/UIOverlay';
import FortressNotices from '@/components/FortressNotices';
import AdventureHallModal from '@/components/AdventureHallModal';

function AsciiCrest() {
  return (
    <pre className="text-[var(--ui-accent)] text-[10px] sm:text-xs leading-none select-none font-mono text-center mx-auto">
{`   /\\                                                          /\\
  /  \\          +====================================+        /  \\
 / /\\ \\         |    ASCII FORTRESS: DEEP ANVIL      |       / /\\ \\
/ /  \\ \\        +====================================+      / /  \\ \\
\\ \\  / /             [#]  [#]    /====\\    [#]  [#]         \\ \\  / /
 \\ \\/ /              | |__| |    |====|    | |__| |          \\ \\/ /
  \\  /               \\______/    \\____/    \\______/           \\  /
   \\/           === MULTI-Z SIMULATION & WORLD ENGINE ===      \\/`}
    </pre>
  );
}

function FortressShell() {
  const { openOverlay } = useUI();
  const {
    hasLocalSave, loadLocalSave,
    screen,
    setScreen,
    gameState,
    embarkNewWorld,
    togglePause,
    stepManualTick,
    setSpeed,
    triggerNarrativeEvent,
    user,
    cloudSaves,
    saveStatus,
    handleCloudSave,
    handleGoogleSignIn,
    handleSignOut,
    loadCloudSave,
    jumpToLocation,
  } = useGame();

  const isMobile = useIsMobile(1024);
  const [embarkError, setEmbarkError] = useState('');
  const [customSeedInput, setSeedInput] = useState<string | null>(null);
  const seedInput = customSeedInput ?? gameState.world.seed ?? 'Khazad-251';
  const [isEmbarking, setIsEmbarking] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'MAP' | 'MANAGE' | 'ADVISOR'>('MAP');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isGuildModalOpen, setIsGuildModalOpen] = useState(false);
  const [isAdventureModalOpen, setIsAdventureModalOpen] = useState(false);
  const [adventureVisit, setAdventureVisit] = useState(0);

  // Desktop side panel toggles to maximize ASCII map area
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(false); // default closed so map is HUGE!

  const previewWorld = useMemo(() => generateDeterministicWorldMeta(seedInput || 'Khazad-251'), [seedInput]);
  const previewArchetype = getSurfaceArchetype(seedInput || 'Khazad-251');

  const handleStartEmbark = async () => {
    setIsEmbarking(true);
    try { await embarkNewWorld(seedInput, true); setEmbarkError(''); }
    catch (error) { setEmbarkError(error instanceof Error ? error.message : 'Embark failed.'); }
    finally { setIsEmbarking(false); }
  };

  // F toggles the command sidebar; Ctrl/Cmd+S saves.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable || e.defaultPrevented) return;
      if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey) && screen === 'playing') { e.preventDefault(); handleCloudSave(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (e.key === '/' && screen === 'playing' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openOverlay('commands'); return; }
      if (e.key.toLowerCase() === 'f' && screen === 'playing') {
        setShowLeftSidebar((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, handleCloudSave, openOverlay]);

  if (screen === 'title') {
    return (
      <main className="min-h-screen w-full bg-[var(--ui-bg)] text-[var(--ui-text)] flex flex-col justify-between p-2 sm:p-4 font-mono select-none overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto my-auto space-y-4">
          {/* ASCII Banner Title */}
          <div className="text-center space-y-1">
            <AsciiCrest />
            <div className="text-[11px] text-[var(--ui-muted)]">
              {'//'} ADAPTIVE ASCII TERMINAL {'//'} PROCEDURAL GEOLOGY &amp; CHRONICLES {'//'}
            </div>
          </div>

          {/* 2-Column Split: World Generator Terminal + Live Procedural Chronicle Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* Left Column: Seed & Embark Terminal Box */}
            <div className="lg:col-span-5 bg-[var(--ui-panel)] border border-[var(--ui-border)] p-3 sm:p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="text-[var(--ui-accent)] text-xs font-bold">
                  +---[ PROCEDURAL WORLD SEED ]------------------------+
                </div>

                <div>
                  <label
                    htmlFor="world-seed-input"
                    className="block text-[11px] text-[var(--ui-muted)] mb-1"
                  >
                    Enter Seed Cipher or Roll New Realm:
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="world-seed-input"
                      maxLength={MAX_SEED_LENGTH}
                      type="text"
                      value={seedInput}
                      onChange={(e) => setSeedInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStartEmbark()}
                      className="flex-1 min-w-0 bg-[var(--ui-bg)] border border-[var(--ui-border)] px-2 py-1.5 font-mono text-xs text-[var(--ui-accent)] focus:outline-none focus:border-[var(--ui-accent)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSeedInput(generateRandomWorldSeed());
                      }}
                      className="px-2 py-1.5 bg-[var(--ui-bg)] hover:bg-[var(--ui-border)] border border-[var(--ui-border)] text-[var(--ui-info)] text-xs transition-colors whitespace-nowrap shrink-0"
                      title="Roll New Procedural World Seed"
                    >
                      [ ~ ROLL ]
                    </button>
                  </div>
                </div>

                {/* Biomes & Strata Summary */}
                <div className="p-2.5 bg-[var(--ui-bg)] border border-[var(--ui-border)] space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--ui-muted)] shrink-0">Generated Realm:</span>
                    <span className="text-[var(--ui-accent)] font-bold whitespace-nowrap truncate">{previewWorld.name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--ui-muted)] shrink-0">Surface Topography:</span>
                    <span className="text-[var(--ui-success)] font-bold whitespace-nowrap truncate">
                      {previewArchetype.label}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--ui-muted)] shrink-0">Map Dimensions:</span>
                    <span className="text-[var(--ui-info)] tabular-nums whitespace-nowrap">
                      {previewWorld.width}×{previewWorld.height}×{previewWorld.depth} (19,152 Tiles)
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--ui-muted)] shrink-0">Starting Clan:</span>
                    <span className="text-[var(--ui-text)] tabular-nums whitespace-nowrap">
                      7 Skilled Dwarven Pioneers
                    </span>
                  </div>
                </div>

                {/* Subterranean Strata Preview */}
                <div className="p-2.5 bg-[var(--ui-bg)] border border-[var(--ui-border)] space-y-1 text-xs">
                  <div className="text-[var(--ui-accent)] text-[11px] font-bold whitespace-nowrap truncate">
                    +-[ MINERAL STRATA MAPPING ]-
                  </div>
                  <div className="space-y-0.5 text-[11px]">
                    {previewWorld.strata.slice(0, 4).map((st) => (
                      <div key={st.zLevel} className="flex justify-between text-[var(--ui-muted)]">
                        <span className="truncate whitespace-nowrap">
                          Z-{st.zLevel}: {st.name}
                        </span>
                        <span className="text-[var(--ui-warning)] shrink-0 ml-2 whitespace-nowrap">{st.ores[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Primary Start Handshake Button */}
                <button
                  type="button"
                  data-start="true"
                  disabled={isEmbarking}
                  onClick={handleStartEmbark}
                  className="w-full py-2.5 px-3 bg-[var(--ui-bg)] hover:bg-[var(--ui-border)] border-2 border-[var(--ui-accent)] text-[var(--ui-accent)] hover:text-[var(--ui-bright)] disabled:opacity-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <span className="whitespace-nowrap">
                    {isEmbarking
                      ? '[ ... STRIKING THE EARTH ... ]'
                      : '[ ▶ STRIKE THE EARTH — EMBARK COLONY ]'}
                  </span>
                </button>
              </div>

              {embarkError && <p role="alert">{embarkError}</p>}
              {hasLocalSave && <button type="button" onClick={loadLocalSave} className="p-2 border text-[var(--ui-success)]">[ CONTINUE LOCAL FORTRESS ]</button>}
              {saveStatus && <p role="status">{saveStatus}</p>}
              {/* Firebase Cloud Saves Section */}
              <div className="pt-3 border-t border-[var(--ui-border)] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ui-accent)] text-[11px] font-bold whitespace-nowrap">
                    +-[ CLOUD SAVES (FIRESTORE) ]-
                  </span>
                  {user ? (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="text-[var(--ui-danger)] hover:text-[var(--ui-bright)] hover:bg-[var(--ui-border)] px-1 text-[11px] whitespace-nowrap shrink-0"
                    >
                      [ SIGN OUT ]
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="text-[var(--ui-info)] hover:text-[var(--ui-bright)] hover:bg-[var(--ui-border)] px-1 text-[11px] whitespace-nowrap shrink-0"
                    >
                      [ SIGN IN WITH GOOGLE ]
                    </button>
                  )}
                </div>

                {cloudSaves.length > 0 ? (
                  <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                    {cloudSaves.map((save) => (
                      <button
                        key={save.id}
                        type="button"
                        onClick={() => loadCloudSave(save)}
                        className="w-full flex items-center justify-between px-2 py-1 bg-[var(--ui-bg)] hover:bg-[var(--ui-border)] border border-[var(--ui-border)] text-left text-xs text-[var(--ui-text)]"
                      >
                        <span className="text-[var(--ui-accent)]">{save.dwarvenName}</span>
                        <span className="text-[var(--ui-muted)] tabular-nums text-[11px]">
                          [ Y{save.year} · WLTH {save.wealth} ]
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--ui-muted)]">
                    {user
                      ? 'No cloud archives. Embark and press [ Ctrl+S: SAVE ] in-game!'
                      : 'Play immediately with deterministic seed data, or sign in to sync fortresses.'}
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Live Procedural World Lore, Civilizations & Annals */}
            <div className="lg:col-span-7 bg-[var(--ui-panel)] border border-[var(--ui-border)] p-3 sm:p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-[var(--ui-accent)] text-xs font-bold mb-1">
                  +---[ WORLD CHRONICLE: {previewWorld.name.toUpperCase()} ]----------------
                </div>
                <p className="text-xs text-[var(--ui-text)] leading-relaxed p-2 bg-[var(--ui-bg)] border border-[var(--ui-border)]">
                  {previewWorld.backstory}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {previewWorld.civilizations.map((civ) => (
                  <div
                    key={civ.id}
                    className="p-2 bg-[var(--ui-bg)] border border-[var(--ui-border)] text-xs space-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-2 font-bold text-[var(--ui-text)]">
                      <span>{civ.name}</span>
                      <span className="text-[var(--ui-accent)] text-[11px] whitespace-nowrap shrink-0">[{civ.stance}]</span>
                    </div>
                    <div className="text-[11px] text-[var(--ui-muted)]">
                      {civ.race} · {civ.ruler}
                    </div>
                    <div className="text-[11px] text-[var(--ui-info)]">{civ.specialty}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-[var(--ui-accent)] text-xs font-bold mb-1">
                  +---[ HISTORICAL ANNALS ({previewWorld.history.length} ERAS) ]-------------------
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {previewWorld.history.map((ev, i) => (
                    <div
                      key={i}
                      className="p-1.5 bg-[var(--ui-bg)] border border-[var(--ui-border)] text-xs leading-snug"
                    >
                      <span className="text-[var(--ui-accent)]">
                        [Y{ev.year} · {ev.era}] {ev.title}:
                      </span>{' '}
                      <span className="text-[var(--ui-text)]">{ev.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Terminal Keyboard Footer */}
        <div className="text-center text-xs text-[var(--ui-muted)] py-2 border-t border-[var(--ui-border)] mt-2">
          Click/Drag Designate · D Mine · T Chop · G Gather · X Stairs · P Stockpile · [ / ] Z-Level · Space Pause
        </div>
      </main>
    );
  }

  // PLAYING SCREEN
  return (
    <div className="fortress-shell h-dvh w-full bg-[var(--ui-bg)] text-[var(--ui-text)] flex flex-col overflow-hidden select-none font-mono">
      {/* Top Terminal Status & Control Bar */}
      <div className="fortress-status bg-[var(--ui-panel)] border-b border-[var(--ui-border)] px-2 py-1 flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 shrink-0 text-xs">
        {/* Fortress Identity & Calendar */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-[var(--ui-accent)] whitespace-nowrap">
            [{gameState.world.dwarvenName}]
          </span>
          <span className="text-[var(--ui-muted)]">|</span>
          <span className="text-[var(--ui-info)] tabular-nums whitespace-nowrap">
            Y{gameState.year}·{gameState.season}·T{gameState.ticks}
          </span>
        </div>

        {/* Live Resource Counters (Tabular Base16 Isotope Colored Text) */}
        <div className="flex flex-wrap items-center gap-2 md:gap-2.5 tabular-nums text-xs">
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[var(--ui-muted)] text-[10px] mr-0.5">STN:</span>
            <span className="text-[var(--ui-bright)] font-bold">{gameState.resources.stone}</span>
          </div>
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[var(--ui-muted)] text-[10px] mr-0.5">WOD:</span>
            <span className="text-[var(--ui-warning)] font-bold">{gameState.resources.wood}</span>
          </div>
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[var(--ui-muted)] text-[10px] mr-0.5">IRN:</span>
            <span className="text-[var(--ui-warning)] font-bold">{gameState.resources.ironOre}</span>
          </div>
          <div className="hidden sm:block whitespace-nowrap shrink-0">
            <span className="text-[var(--ui-muted)] text-[10px] mr-0.5">GLD:</span>
            <span className="text-[var(--ui-accent)] font-bold">{gameState.resources.goldOre}</span>
          </div>
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[var(--ui-muted)] text-[10px] mr-0.5">STL:</span>
            <span className="text-[var(--ui-info)] font-bold">{gameState.resources.steelBars}</span>
          </div>
          <div className="hidden md:block whitespace-nowrap shrink-0">
            <span className="text-[var(--ui-muted)] text-[10px] mr-0.5">ARM:</span>
            <span className="text-[var(--ui-warning)] font-bold">
              {gameState.resources.weapons + gameState.resources.armor}
            </span>
          </div>
          <div className="hidden md:block whitespace-nowrap shrink-0">
            <span className="text-[var(--ui-muted)] text-[10px] mr-0.5">RLC:</span>
            <span className="text-[var(--ui-accent)] font-bold">{gameState.resources.relics}</span>
          </div>
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[var(--ui-muted)] text-[10px] mr-0.5">FOD:</span>
            <span className="text-[var(--ui-success)] font-bold">{gameState.resources.food}</span>
          </div>
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[var(--ui-muted)] text-[10px] mr-0.5">ALE:</span>
            <span className="text-[var(--ui-violet)] font-bold">{gameState.resources.ale}</span>
          </div>
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[var(--ui-muted)] text-[10px] mr-0.5">WLTH:</span>
            <span className="text-[var(--ui-accent)] font-bold">{gameState.resources.wealth}</span>
          </div>
        </div>

        {/* Clickable Terminal Action Text Buttons */}
        <div className="fortress-actions flex flex-wrap items-center gap-1.5 text-xs">
          <button type="button" onClick={() => openOverlay('commands')} className="border border-[var(--ui-info)] px-2 py-1 text-[var(--ui-info)]">[ / COMMANDS ]</button>
          <button type="button" onClick={() => openOverlay('settings')} className="border border-[var(--ui-border)] px-2 py-1">[ DISPLAY ]</button>
          <button type="button" onClick={() => setIsAdventureModalOpen(true)} className="border border-[var(--ui-info)] px-2 py-1 text-[var(--ui-info)]">[ ADVENTURE HALL{gameState.activities?.expeditions.active && gameState.ticks >= gameState.activities.expeditions.active.returnsAt ? ' · CARGO READY' : ''} ]</button>
          <button type="button" onClick={() => setIsGuildModalOpen(true)} className="px-1.5 py-0.5 border border-[var(--ui-accent)] text-[var(--ui-accent)] hover:bg-[var(--ui-border)] whitespace-nowrap">
            [ GUILD HALL{gameState.guild.commissions.some((c) => c.status === 'ACTIVE') ? ' · CHARTER ACTIVE' : ''} ]
          </button>
          {/* Trade Depot Barter Modal Button */}
          <button
            type="button"
            onClick={() => setIsTradeModalOpen(true)}
            className="px-1.5 py-0.5 border border-[var(--ui-border)] text-[var(--ui-info)] hover:bg-[var(--ui-border)] hover:text-[var(--ui-bright)] transition-colors whitespace-nowrap shrink-0"
          >
            [ ¤ TRADE ]
          </button>

          {/* Decree / Narrative Event Button */}
          <button
            type="button"
            onClick={() => {
              if (!gameState.activeEvent) {
                triggerNarrativeEvent(undefined, true);
              }
              setIsEventModalOpen(true);
            }}
            className={`px-1.5 py-0.5 border transition-colors whitespace-nowrap shrink-0 ${
              gameState.activeEvent
                ? 'border-[var(--ui-danger)] bg-[var(--ui-border)] text-[var(--ui-danger)] font-bold animate-pulse'
                : 'border-[var(--ui-border)] text-[var(--ui-accent)] hover:bg-[var(--ui-border)] hover:text-[var(--ui-bright)]'
            }`}
          >
            {gameState.activeEvent ? '[ ! DECREE AWAITS ]' : '[ ! DECREES ]'}
          </button>

          {/* Pause / Resume */}
          <button
            type="button"
            onClick={togglePause}
            className={`px-1.5 py-0.5 border transition-colors whitespace-nowrap shrink-0 ${
              gameState.paused
                ? 'border-[var(--ui-accent)] bg-[var(--ui-border)] text-[var(--ui-accent)] font-bold'
                : 'border-[var(--ui-border)] text-[var(--ui-success)] hover:bg-[var(--ui-border)] hover:text-[var(--ui-bright)]'
            }`}
          >
            {gameState.paused ? '[ ▶ RESUME ]' : '[ ■ PAUSE ]'}
          </button>

          {/* +1 Tick */}
          <button
            type="button"
            onClick={stepManualTick}
            title="Advance 1 Simulation Tick"
            className="px-1.5 py-0.5 border border-[var(--ui-border)] text-[var(--ui-text)] hover:bg-[var(--ui-border)] hover:text-[var(--ui-bright)] transition-colors whitespace-nowrap shrink-0"
          >
            [ +1 TICK ]
          </button>

          {/* Speed Toggle */}
          <div className="hidden sm:flex items-center border border-[var(--ui-border)] bg-[var(--ui-bg)] shrink-0">
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSpeed(spd)}
                className={`px-1 py-0.5 text-[11px] transition-colors whitespace-nowrap ${
                  gameState.speed === spd && !gameState.paused
                    ? 'bg-[var(--ui-border)] text-[var(--ui-accent)] font-bold'
                    : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Cloud Save */}
          <button
            type="button"
            onClick={handleCloudSave}
            className="px-1.5 py-0.5 border border-[var(--ui-border)] text-[var(--ui-info)] hover:bg-[var(--ui-border)] hover:text-[var(--ui-bright)] transition-colors whitespace-nowrap shrink-0"
          >
            [ Ctrl+S: SAVE ]
          </button>

          {/* Reroll Random Map Button */}
          <button
            type="button"
            onClick={() => {
              const nextSeed = generateRandomWorldSeed();
              setSeedInput(nextSeed);
              embarkNewWorld(nextSeed, false);
            }}
            title="Roll a brand-new random 76x42 map & topography"
            className="px-1.5 py-0.5 border border-[var(--ui-border)] text-[var(--ui-warning)] hover:bg-[var(--ui-border)] hover:text-[var(--ui-bright)] transition-colors whitespace-nowrap shrink-0"
          >
            [ ~ NEW MAP ]
          </button>

          {/* World Map Title Return */}
          <button
            type="button"
            onClick={() => setScreen('title')}
            className="px-1.5 py-0.5 border border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-accent)] hover:bg-[var(--ui-border)] transition-colors whitespace-nowrap shrink-0"
          >
            [ &lt; REALM ]
          </button>
        </div>
      </div>

      {/* Optional Save Feedback Toast */}
      {saveStatus && (
        <div className="bg-[var(--ui-panel)] border-b border-[var(--ui-accent)] px-3 py-0.5 text-center text-xs text-[var(--ui-accent)]">
          {saveStatus}
        </div>
      )}

      {/* Active Narrative Event Alert Banner */}
      {gameState.activeEvent && (
        <div className="bg-[var(--ui-panel)] border-b-2 border-[var(--ui-danger)] px-3 py-1 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--ui-danger)] font-bold whitespace-nowrap shrink-0">
              [ ! {gameState.activeEvent.severity.replace('_', ' ')} ]
            </span>
            <span className="text-[var(--ui-bright)] font-bold truncate">
              {gameState.activeEvent.title}
            </span>
            <span className="hidden md:inline text-[var(--ui-muted)] truncate">
              {'//'} {gameState.activeEvent.historicalConnection}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsEventModalOpen(true)}
            className="text-[var(--ui-danger)] hover:bg-[var(--ui-border)] hover:text-[var(--ui-bright)] px-2 py-0.5 border border-[var(--ui-danger)] font-bold transition-colors whitespace-nowrap shrink-0"
          >
            [ INSPECT &amp; ISSUE DECREE ]
          </button>
        </div>
      )}

      {/* Fortress Spatial Alerts Ticker with Jump-to-Location Buttons */}
      {gameState.alerts.length > 0 && (
        <div className="hidden sm:flex bg-[var(--ui-bg)] border-b border-[var(--ui-border)] px-3 py-1 flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`font-bold whitespace-nowrap shrink-0 ${
                gameState.alerts[0].severity === 'DANGER'
                  ? 'text-[var(--ui-danger)]'
                  : gameState.alerts[0].severity === 'DISCOVERY'
                  ? 'text-[var(--ui-info)]'
                  : 'text-[var(--ui-warning)]'
              }`}
            >
              [{gameState.alerts[0].severity}]
            </span>
            <span className="text-[var(--ui-text)] truncate">{gameState.alerts[0].title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {gameState.alerts.slice(0, 2).map((al) => (
              <button
                key={al.id}
                type="button"
                onClick={() => jumpToLocation(al.x, al.y, al.z)}
                className="px-1.5 py-0.5 border border-[var(--ui-border)] text-[var(--ui-info)] hover:bg-[var(--ui-border)] hover:text-[var(--ui-bright)] transition-colors whitespace-nowrap shrink-0 tabular-nums"
              >
                [ JUMP ({al.x},{al.y},Z-{al.z}) ]
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Secondary Terminal Layout Toolbar: Gives Overseer Direct Control Over Screen Spacing */}
      <div className="hidden lg:flex items-center justify-between px-2 py-0.5 bg-[var(--ui-panel)] border-b border-[var(--ui-border)] text-[11px] text-[var(--ui-muted)]">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowLeftSidebar((v) => !v)}
            className={`px-1 py-0.5 transition-colors whitespace-nowrap shrink-0 ${
              showLeftSidebar
                ? 'text-[var(--ui-accent)] bg-[var(--ui-border)]'
                : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
            }`}
          >
            {showLeftSidebar ? '[ << HIDE ORDERS ]' : '[ >> SHOW ORDERS ]'}
          </button>

          <span className="text-[var(--ui-border)]">|</span>

          <button
            type="button"
            onClick={() => {
              if (showLeftSidebar || showRightSidebar) {
                setShowLeftSidebar(false);
                setShowRightSidebar(false);
              } else {
                setShowLeftSidebar(true);
              }
            }}
            className={`px-1 py-0.5 transition-colors whitespace-nowrap shrink-0 ${
              !showLeftSidebar && !showRightSidebar
                ? 'text-[var(--ui-success)] bg-[var(--ui-border)] font-bold'
                : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
            }`}
          >
            {!showLeftSidebar && !showRightSidebar
              ? '[ [X] FULL MAP MODE (100%) ]'
              : '[ [ ] FULL MAP MODE (HOTKEY: F) ]'}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowRightSidebar((v) => !v)}
            className={`px-1 py-0.5 transition-colors whitespace-nowrap shrink-0 ${
              showRightSidebar
                ? 'text-[var(--ui-accent)] bg-[var(--ui-border)]'
                : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
            }`}
          >
            {showRightSidebar ? '[ HIDE CHRONICLE >> ]' : '[ SHOW CHRONICLE >> ]'}
          </button>
        </div>
      </div>

      {/* Main Screen Layout: MAP IS THE DOMINANT/BIGGEST PART */}
      <FortressNotices onOpenGuild={() => setIsGuildModalOpen(true)} onOpenAdventure={() => { setAdventureVisit(v => v + 1); setIsAdventureModalOpen(true); }} onShowMap={() => setMobilePanel('MAP')} />
      <div className="flex-1 flex min-h-0 overflow-hidden bg-[var(--ui-bg)]">
        {/* Left Sidebar: Compact width, collapsible */}
        {!isMobile && showLeftSidebar && (
          <div className="orders-panel hidden lg:flex w-72 xl:w-80 h-full shrink-0 border-r border-[var(--ui-border)]">
            <Sidebar />
          </div>
        )}

        {/* Mobile View: Controlled by mobilePanel */}
        <div
          className={`${
            mobilePanel === 'MANAGE' ? 'flex w-full' : 'hidden'
          } lg:hidden h-full`}
        >
          {isMobile && <Sidebar />}
        </div>

        {/* Center ASCII Viewport: DOMINANT - takes 100% of remaining width and height! */}
        <div
          className={`${
            mobilePanel === 'MAP' ? 'flex' : 'hidden'
          } lg:flex flex-1 h-full min-w-0`}
        >
          <ASCIIViewport />
        </div>

        {/* Mobile View for Advisor */}
        <div
          className={`${
            mobilePanel === 'ADVISOR' ? 'flex w-full' : 'hidden'
          } lg:hidden h-full`}
        >
          {isMobile && <AdvisorPanel />}
        </div>

        {/* Right Advisor & Chronicle Panel: Slender, collapsible */}
        {!isMobile && showRightSidebar && (
          <div className="orders-panel hidden lg:flex w-72 xl:w-80 h-full shrink-0 border-l border-[var(--ui-border)]">
            <AdvisorPanel />
          </div>
        )}
      </div>

      {/* Mobile Bottom View Switcher (Hidden on Desktop lg+) */}
      <div className="lg:hidden grid grid-cols-3 gap-1 p-1 bg-[var(--ui-panel)] border-t border-[var(--ui-border)] shrink-0 text-xs">
        <button
          type="button"
          onClick={() => setMobilePanel('MAP')}
          className={`py-1.5 px-0.5 text-center transition-colors whitespace-nowrap flex items-center justify-center shrink-0 ${
            mobilePanel === 'MAP'
              ? 'bg-[var(--ui-border)] text-[var(--ui-accent)] font-bold border border-[var(--ui-accent)]'
              : 'text-[var(--ui-muted)] border border-[var(--ui-border)]'
          }`}
        >
          [ 1: ASCII MAP ]
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel('MANAGE')}
          className={`py-1.5 px-0.5 text-center transition-colors whitespace-nowrap flex items-center justify-center shrink-0 ${
            mobilePanel === 'MANAGE'
              ? 'bg-[var(--ui-border)] text-[var(--ui-accent)] font-bold border border-[var(--ui-accent)]'
              : 'text-[var(--ui-muted)] border border-[var(--ui-border)]'
          }`}
        >
          [ 2: ORDERS ]
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel('ADVISOR')}
          className={`py-1.5 px-0.5 text-center transition-colors whitespace-nowrap flex items-center justify-center shrink-0 ${
            mobilePanel === 'ADVISOR'
              ? 'bg-[var(--ui-border)] text-[var(--ui-accent)] font-bold border border-[var(--ui-accent)]'
              : 'text-[var(--ui-muted)] border border-[var(--ui-border)]'
          }`}
        >
          [ 3: LORE &amp; AI ]
        </button>
      </div>

      <GuildHallModal isOpen={isGuildModalOpen} onClose={() => setIsGuildModalOpen(false)} />
      <AdventureHallModal key={adventureVisit} isOpen={isAdventureModalOpen} onClose={() => setIsAdventureModalOpen(false)} />
      <UIOverlay onShowMap={() => setMobilePanel('MAP')} />

      {/* Narrative Event & Decree Modal */}
      <NarrativeEventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
      />

      {/* Seasonal Trade Depot & Custom Barter Modal */}
      <TradeDepotModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <UIProvider><GameProvider>
      <FortressShell />
    </GameProvider></UIProvider>
  );
}
