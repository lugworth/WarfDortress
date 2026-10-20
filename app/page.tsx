'use client';

import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from '@/components/GameProvider';
import ASCIIViewport from '@/components/ASCIIViewport';
import Sidebar from '@/components/Sidebar';
import AdvisorPanel from '@/components/AdvisorPanel';
import NarrativeEventModal from '@/components/NarrativeEventModal';
import { TradeDepotModal } from '@/components/TradeDepotModal';
import {
  generateDeterministicWorldMeta,
  generateRandomWorldSeed,
  getSurfaceArchetype,
} from '@/lib/world-gen';
import { ISOTOPE } from '@/lib/colors';

function AsciiCrest() {
  return (
    <pre className="text-[#ff0099] text-[10px] sm:text-xs leading-none select-none font-mono text-center mx-auto">
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
  const {
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

  const [customSeedInput, setSeedInput] = useState<string | null>(null);
  const seedInput = customSeedInput ?? gameState.world.seed ?? 'Khazad-251';
  const [isEmbarking, setIsEmbarking] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'MAP' | 'MANAGE' | 'ADVISOR'>('MAP');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);

  // Desktop side panel toggles to maximize ASCII map area
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(false); // default closed so map is HUGE!

  const previewWorld = generateDeterministicWorldMeta(seedInput || 'Khazad-251');
  const previewArchetype = getSurfaceArchetype(seedInput || 'Khazad-251');

  const handleStartEmbark = async () => {
    setIsEmbarking(true);
    await embarkNewWorld(seedInput, true);
    setIsEmbarking(false);
  };

  // Keyboard shortcut: 'F' or 'M' to toggle Full Map mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key.toLowerCase() === 'm' && screen === 'playing') {
        setShowLeftSidebar((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen]);

  if (screen === 'title') {
    return (
      <main className="min-h-screen w-full bg-[#000000] text-[#d0d0d0] flex flex-col justify-between p-2 sm:p-4 font-mono select-none overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto my-auto space-y-4">
          {/* ASCII Banner Title */}
          <div className="text-center space-y-1">
            <AsciiCrest />
            <div className="text-[11px] text-[#808080]">
              {'//'} BASE16 ISOTOPE DARK TERMINAL {'//'} PROCEDURAL GEOLOGY &amp; CHRONICLES {'//'}
            </div>
          </div>

          {/* 2-Column Split: World Generator Terminal + Live Procedural Chronicle Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* Left Column: Seed & Embark Terminal Box */}
            <div className="lg:col-span-5 bg-[#101010] border border-[#202020] p-3 sm:p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="text-[#ff0099] text-xs font-bold">
                  +---[ PROCEDURAL WORLD SEED ]------------------------+
                </div>

                <div>
                  <label
                    htmlFor="world-seed-input"
                    className="block text-[11px] text-[#808080] mb-1"
                  >
                    Enter Seed Cipher or Roll New Realm:
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="world-seed-input"
                      type="text"
                      value={seedInput}
                      onChange={(e) => setSeedInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStartEmbark()}
                      className="flex-1 min-w-0 bg-[#000000] border border-[#202020] px-2 py-1.5 font-mono text-xs text-[#ff0099] focus:outline-none focus:border-[#ff0099]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSeedInput(generateRandomWorldSeed());
                      }}
                      className="px-2 py-1.5 bg-[#000000] hover:bg-[#202020] border border-[#202020] text-[#00ffff] text-xs transition-colors whitespace-nowrap shrink-0"
                      title="Roll New Procedural World Seed"
                    >
                      [ ~ ROLL ]
                    </button>
                  </div>
                </div>

                {/* Biomes & Strata Summary */}
                <div className="p-2.5 bg-[#000000] border border-[#202020] space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#808080] shrink-0">Generated Realm:</span>
                    <span className="text-[#ff0099] font-bold whitespace-nowrap truncate">{previewWorld.name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#808080] shrink-0">Surface Topography:</span>
                    <span className="text-[#33ff00] font-bold whitespace-nowrap truncate">
                      {previewArchetype.label}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#808080] shrink-0">Map Dimensions:</span>
                    <span className="text-[#00ffff] tabular-nums whitespace-nowrap">
                      {previewWorld.width}×{previewWorld.height}×{previewWorld.depth} (19,152 Tiles)
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#808080] shrink-0">Starting Clan:</span>
                    <span className="text-[#d0d0d0] tabular-nums whitespace-nowrap">
                      7 Skilled Dwarven Pioneers
                    </span>
                  </div>
                </div>

                {/* Subterranean Strata Preview */}
                <div className="p-2.5 bg-[#000000] border border-[#202020] space-y-1 text-xs">
                  <div className="text-[#ff0099] text-[11px] font-bold whitespace-nowrap truncate">
                    +-[ MINERAL STRATA MAPPING ]-
                  </div>
                  <div className="space-y-0.5 text-[11px]">
                    {previewWorld.strata.slice(0, 4).map((st) => (
                      <div key={st.zLevel} className="flex justify-between text-[#808080]">
                        <span className="truncate whitespace-nowrap">
                          Z-{st.zLevel}: {st.name}
                        </span>
                        <span className="text-[#ff9900] shrink-0 ml-2 whitespace-nowrap">{st.ores[0]}</span>
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
                  className="w-full py-2.5 px-3 bg-[#000000] hover:bg-[#202020] border-2 border-[#ff0099] text-[#ff0099] hover:text-[#ffffff] disabled:opacity-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <span className="whitespace-nowrap">
                    {isEmbarking
                      ? '[ ... STRIKING THE EARTH ... ]'
                      : '[ ▶ STRIKE THE EARTH — EMBARK COLONY ]'}
                  </span>
                </button>
              </div>

              {/* Firebase Cloud Saves Section */}
              <div className="pt-3 border-t border-[#202020] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#ff0099] text-[11px] font-bold whitespace-nowrap">
                    +-[ CLOUD SAVES (FIRESTORE) ]-
                  </span>
                  {user ? (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="text-[#ff0000] hover:text-[#ffffff] hover:bg-[#202020] px-1 text-[11px] whitespace-nowrap shrink-0"
                    >
                      [ SIGN OUT ]
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="text-[#00ffff] hover:text-[#ffffff] hover:bg-[#202020] px-1 text-[11px] whitespace-nowrap shrink-0"
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
                        className="w-full flex items-center justify-between px-2 py-1 bg-[#000000] hover:bg-[#202020] border border-[#202020] text-left text-xs text-[#d0d0d0]"
                      >
                        <span className="text-[#ff0099]">{save.dwarvenName}</span>
                        <span className="text-[#808080] tabular-nums text-[11px]">
                          [ Y{save.year} · WLTH {save.wealth} ]
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#808080]">
                    {user
                      ? 'No cloud archives. Embark and press [ S: SAVE ] in-game!'
                      : 'Play immediately with deterministic seed data, or sign in to sync fortresses.'}
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Live Procedural World Lore, Civilizations & Annals */}
            <div className="lg:col-span-7 bg-[#101010] border border-[#202020] p-3 sm:p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-[#ff0099] text-xs font-bold mb-1">
                  +---[ WORLD CHRONICLE: {previewWorld.name.toUpperCase()} ]----------------
                </div>
                <p className="text-xs text-[#d0d0d0] leading-relaxed p-2 bg-[#000000] border border-[#202020]">
                  {previewWorld.backstory}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {previewWorld.civilizations.map((civ) => (
                  <div
                    key={civ.id}
                    className="p-2 bg-[#000000] border border-[#202020] text-xs space-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-2 font-bold text-[#d0d0d0]">
                      <span>{civ.name}</span>
                      <span className="text-[#ff0099] text-[11px] whitespace-nowrap shrink-0">[{civ.stance}]</span>
                    </div>
                    <div className="text-[11px] text-[#808080]">
                      {civ.race} · {civ.ruler}
                    </div>
                    <div className="text-[11px] text-[#00ffff]">{civ.specialty}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-[#ff0099] text-xs font-bold mb-1">
                  +---[ HISTORICAL ANNALS ({previewWorld.history.length} ERAS) ]-------------------
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {previewWorld.history.map((ev, i) => (
                    <div
                      key={i}
                      className="p-1.5 bg-[#000000] border border-[#202020] text-xs leading-snug"
                    >
                      <span className="text-[#ff0099]">
                        [Y{ev.year} · {ev.era}] {ev.title}:
                      </span>{' '}
                      <span className="text-[#d0d0d0]">{ev.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Terminal Keyboard Footer */}
        <div className="text-center text-xs text-[#808080] py-2 border-t border-[#202020] mt-2">
          Click/Drag Designate · D Mine · T Chop · G Gather · X Stairs · P Stockpile · [ / ] Z-Level · Space Pause
        </div>
      </main>
    );
  }

  // PLAYING SCREEN
  return (
    <div className="h-screen w-screen bg-[#000000] text-[#d0d0d0] flex flex-col overflow-hidden select-none font-mono">
      {/* Top Terminal Status & Control Bar */}
      <div className="bg-[#101010] border-b border-[#202020] px-2 py-1 flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 shrink-0 text-xs">
        {/* Fortress Identity & Calendar */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-[#ff0099] whitespace-nowrap">
            [{gameState.world.dwarvenName}]
          </span>
          <span className="text-[#808080]">|</span>
          <span className="text-[#00ffff] tabular-nums whitespace-nowrap">
            Y{gameState.year}·{gameState.season}·T{gameState.ticks}
          </span>
        </div>

        {/* Live Resource Counters (Tabular Base16 Isotope Colored Text) */}
        <div className="flex flex-wrap items-center gap-2 md:gap-2.5 tabular-nums text-xs">
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[#808080] text-[10px] mr-0.5">STN:</span>
            <span className="text-[#ffffff] font-bold">{gameState.resources.stone}</span>
          </div>
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[#808080] text-[10px] mr-0.5">WOD:</span>
            <span className="text-[#ff9900] font-bold">{gameState.resources.wood}</span>
          </div>
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[#808080] text-[10px] mr-0.5">IRN:</span>
            <span className="text-[#ff9900] font-bold">{gameState.resources.ironOre}</span>
          </div>
          <div className="hidden sm:block whitespace-nowrap shrink-0">
            <span className="text-[#808080] text-[10px] mr-0.5">GLD:</span>
            <span className="text-[#ff0099] font-bold">{gameState.resources.goldOre}</span>
          </div>
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[#808080] text-[10px] mr-0.5">STL:</span>
            <span className="text-[#00ffff] font-bold">{gameState.resources.steelBars}</span>
          </div>
          <div className="hidden md:block whitespace-nowrap shrink-0">
            <span className="text-[#808080] text-[10px] mr-0.5">ARM:</span>
            <span className="text-[#ff9900] font-bold">
              {gameState.resources.weapons + gameState.resources.armor}
            </span>
          </div>
          <div className="hidden md:block whitespace-nowrap shrink-0">
            <span className="text-[#808080] text-[10px] mr-0.5">RLC:</span>
            <span className="text-[#ff0099] font-bold">{gameState.resources.relics}</span>
          </div>
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[#808080] text-[10px] mr-0.5">FOD:</span>
            <span className="text-[#33ff00] font-bold">{gameState.resources.food}</span>
          </div>
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[#808080] text-[10px] mr-0.5">ALE:</span>
            <span className="text-[#cc00ff] font-bold">{gameState.resources.ale}</span>
          </div>
          <div className="whitespace-nowrap shrink-0">
            <span className="text-[#808080] text-[10px] mr-0.5">WLTH:</span>
            <span className="text-[#ff0099] font-bold">{gameState.resources.wealth}</span>
          </div>
        </div>

        {/* Clickable Terminal Action Text Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Trade Depot Barter Modal Button */}
          <button
            type="button"
            onClick={() => setIsTradeModalOpen(true)}
            className="px-1.5 py-0.5 border border-[#202020] text-[#00ffff] hover:bg-[#202020] hover:text-[#ffffff] transition-colors whitespace-nowrap shrink-0"
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
                ? 'border-[#ff0000] bg-[#202020] text-[#ff0000] font-bold animate-pulse'
                : 'border-[#202020] text-[#ff0099] hover:bg-[#202020] hover:text-[#ffffff]'
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
                ? 'border-[#ff0099] bg-[#202020] text-[#ff0099] font-bold'
                : 'border-[#202020] text-[#33ff00] hover:bg-[#202020] hover:text-[#ffffff]'
            }`}
          >
            {gameState.paused ? '[ ▶ RESUME ]' : '[ ■ PAUSE ]'}
          </button>

          {/* +1 Tick */}
          <button
            type="button"
            onClick={stepManualTick}
            title="Advance 1 Simulation Tick"
            className="px-1.5 py-0.5 border border-[#202020] text-[#d0d0d0] hover:bg-[#202020] hover:text-[#ffffff] transition-colors whitespace-nowrap shrink-0"
          >
            [ +1 TICK ]
          </button>

          {/* Speed Toggle */}
          <div className="hidden sm:flex items-center border border-[#202020] bg-[#000000] shrink-0">
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSpeed(spd)}
                className={`px-1 py-0.5 text-[11px] transition-colors whitespace-nowrap ${
                  gameState.speed === spd && !gameState.paused
                    ? 'bg-[#202020] text-[#ff0099] font-bold'
                    : 'text-[#808080] hover:text-[#d0d0d0]'
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
            className="px-1.5 py-0.5 border border-[#202020] text-[#00ffff] hover:bg-[#202020] hover:text-[#ffffff] transition-colors whitespace-nowrap shrink-0"
          >
            [ S: SAVE ]
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
            className="px-1.5 py-0.5 border border-[#202020] text-[#ff9900] hover:bg-[#202020] hover:text-[#ffffff] transition-colors whitespace-nowrap shrink-0"
          >
            [ ~ NEW MAP ]
          </button>

          {/* World Map Title Return */}
          <button
            type="button"
            onClick={() => setScreen('title')}
            className="px-1.5 py-0.5 border border-[#202020] text-[#808080] hover:text-[#ff0099] hover:bg-[#202020] transition-colors whitespace-nowrap shrink-0"
          >
            [ &lt; REALM ]
          </button>
        </div>
      </div>

      {/* Optional Save Feedback Toast */}
      {saveStatus && (
        <div className="bg-[#101010] border-b border-[#ff0099] px-3 py-0.5 text-center text-xs text-[#ff0099]">
          {saveStatus}
        </div>
      )}

      {/* Active Narrative Event Alert Banner */}
      {gameState.activeEvent && (
        <div className="bg-[#101010] border-b-2 border-[#ff0000] px-3 py-1 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[#ff0000] font-bold whitespace-nowrap shrink-0">
              [ ! {gameState.activeEvent.severity.replace('_', ' ')} ]
            </span>
            <span className="text-[#ffffff] font-bold truncate">
              {gameState.activeEvent.title}
            </span>
            <span className="hidden md:inline text-[#808080] truncate">
              {'//'} {gameState.activeEvent.historicalConnection}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsEventModalOpen(true)}
            className="text-[#ff0000] hover:bg-[#202020] hover:text-[#ffffff] px-2 py-0.5 border border-[#ff0000] font-bold transition-colors whitespace-nowrap shrink-0"
          >
            [ INSPECT &amp; ISSUE DECREE ]
          </button>
        </div>
      )}

      {/* Fortress Spatial Alerts Ticker with Jump-to-Location Buttons */}
      {gameState.alerts.length > 0 && (
        <div className="bg-[#080808] border-b border-[#202020] px-3 py-1 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`font-bold whitespace-nowrap shrink-0 ${
                gameState.alerts[0].severity === 'DANGER'
                  ? 'text-[#ff0000]'
                  : gameState.alerts[0].severity === 'DISCOVERY'
                  ? 'text-[#00ffff]'
                  : 'text-[#ff9900]'
              }`}
            >
              [{gameState.alerts[0].severity}]
            </span>
            <span className="text-[#d0d0d0] truncate">{gameState.alerts[0].title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {gameState.alerts.slice(0, 2).map((al) => (
              <button
                key={al.id}
                type="button"
                onClick={() => jumpToLocation(al.x, al.y, al.z)}
                className="px-1.5 py-0.5 border border-[#202020] text-[#00ffff] hover:bg-[#202020] hover:text-[#ffffff] transition-colors whitespace-nowrap shrink-0 tabular-nums"
              >
                [ JUMP ({al.x},{al.y},Z-{al.z}) ]
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Secondary Terminal Layout Toolbar: Gives Overseer Direct Control Over Screen Spacing */}
      <div className="hidden lg:flex items-center justify-between px-2 py-0.5 bg-[#101010] border-b border-[#202020] text-[11px] text-[#808080]">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowLeftSidebar((v) => !v)}
            className={`px-1 py-0.5 transition-colors whitespace-nowrap shrink-0 ${
              showLeftSidebar
                ? 'text-[#ff0099] bg-[#202020]'
                : 'text-[#808080] hover:text-[#d0d0d0]'
            }`}
          >
            {showLeftSidebar ? '[ << HIDE ORDERS ]' : '[ >> SHOW ORDERS ]'}
          </button>

          <span className="text-[#202020]">|</span>

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
                ? 'text-[#33ff00] bg-[#202020] font-bold'
                : 'text-[#808080] hover:text-[#d0d0d0]'
            }`}
          >
            {!showLeftSidebar && !showRightSidebar
              ? '[ [X] FULL MAP MODE (100%) ]'
              : '[ [ ] FULL MAP MODE (HOTKEY: M) ]'}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowRightSidebar((v) => !v)}
            className={`px-1 py-0.5 transition-colors whitespace-nowrap shrink-0 ${
              showRightSidebar
                ? 'text-[#ff0099] bg-[#202020]'
                : 'text-[#808080] hover:text-[#d0d0d0]'
            }`}
          >
            {showRightSidebar ? '[ HIDE CHRONICLE >> ]' : '[ SHOW CHRONICLE >> ]'}
          </button>
        </div>
      </div>

      {/* Main Screen Layout: MAP IS THE DOMINANT/BIGGEST PART */}
      <div className="flex-1 flex min-h-0 overflow-hidden bg-[#000000]">
        {/* Left Sidebar: Compact width, collapsible */}
        {showLeftSidebar && (
          <div className="hidden lg:flex w-72 xl:w-80 h-full shrink-0 border-r border-[#202020]">
            <Sidebar />
          </div>
        )}

        {/* Mobile View: Controlled by mobilePanel */}
        <div
          className={`${
            mobilePanel === 'MANAGE' ? 'flex w-full' : 'hidden'
          } lg:hidden h-full`}
        >
          <Sidebar />
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
          <AdvisorPanel />
        </div>

        {/* Right Advisor & Chronicle Panel: Slender, collapsible */}
        {showRightSidebar && (
          <div className="hidden lg:flex w-72 xl:w-80 h-full shrink-0 border-l border-[#202020]">
            <AdvisorPanel />
          </div>
        )}
      </div>

      {/* Mobile Bottom View Switcher (Hidden on Desktop lg+) */}
      <div className="lg:hidden grid grid-cols-3 gap-1 p-1 bg-[#101010] border-t border-[#202020] shrink-0 text-xs">
        <button
          type="button"
          onClick={() => setMobilePanel('MAP')}
          className={`py-1.5 px-0.5 text-center transition-colors whitespace-nowrap flex items-center justify-center shrink-0 ${
            mobilePanel === 'MAP'
              ? 'bg-[#202020] text-[#ff0099] font-bold border border-[#ff0099]'
              : 'text-[#808080] border border-[#202020]'
          }`}
        >
          [ 1: ASCII MAP ]
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel('MANAGE')}
          className={`py-1.5 px-0.5 text-center transition-colors whitespace-nowrap flex items-center justify-center shrink-0 ${
            mobilePanel === 'MANAGE'
              ? 'bg-[#202020] text-[#ff0099] font-bold border border-[#ff0099]'
              : 'text-[#808080] border border-[#202020]'
          }`}
        >
          [ 2: ORDERS ]
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel('ADVISOR')}
          className={`py-1.5 px-0.5 text-center transition-colors whitespace-nowrap flex items-center justify-center shrink-0 ${
            mobilePanel === 'ADVISOR'
              ? 'bg-[#202020] text-[#ff0099] font-bold border border-[#ff0099]'
              : 'text-[#808080] border border-[#202020]'
          }`}
        >
          [ 3: LORE &amp; AI ]
        </button>
      </div>

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
    <GameProvider>
      <FortressShell />
    </GameProvider>
  );
}
