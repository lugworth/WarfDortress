'use client';

import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from '@/components/GameProvider';
import { UIProvider } from '@/components/UIProvider';
import ASCIIViewport from '@/components/ASCIIViewport';
import Sidebar from '@/components/Sidebar';
import AdvisorPanel from '@/components/AdvisorPanel';
import NarrativeEventModal from '@/components/NarrativeEventModal';
import { TradeDepotModal } from '@/components/TradeDepotModal';
import GuildHallModal from '@/components/GuildHallModal';
import {
  generateDeterministicWorldMeta,
  generateRandomWorldSeed,
  getSurfaceArchetype,
} from '@/lib/world-gen';
import GameHeader from '@/components/GameHeader';
import UIOverlay from '@/components/UIOverlay';
import { useUI } from '@/components/UIProvider';


function AsciiCrest() {
  return (
    <pre className="ascii-crest text-[#ff0099] text-[10px] sm:text-xs leading-none select-none font-mono text-center mx-auto">
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
    triggerNarrativeEvent,
    user,
    cloudSaves,
    saveStatus,
    localSave,
    resumeLocalSave,
    handleGoogleSignIn,
    handleSignOut,
    loadCloudSave,
  } = useGame();


  const [customSeedInput, setSeedInput] = useState<string | null>(null);
  const seedInput = customSeedInput ?? gameState.world.seed ?? 'Khazad-251';
  const [isEmbarking, setIsEmbarking] = useState(false);
  const [panel, setPanel] = useState<'clan' | 'lore' | null>(null);
  const { openOverlay } = useUI();
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isGuildModalOpen, setIsGuildModalOpen] = useState(false);

  // Desktop side panel toggles to maximize ASCII map area



  const previewWorld = generateDeterministicWorldMeta(seedInput || 'Khazad-251');
  const previewArchetype = getSurfaceArchetype(seedInput || 'Khazad-251');

  const handleStartEmbark = async () => {
    if (isEmbarking) return;
    setIsEmbarking(true);
    try { await embarkNewWorld(seedInput, true); } finally { setIsEmbarking(false); }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (screen !== 'playing' || target.closest('input, textarea, select, [contenteditable="true"]') ||
        e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[aria-modal="true"]')) return;
      if (e.key === '/' && !e.repeat) {
        e.preventDefault();
        openOverlay('commands');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, openOverlay]);

  if (screen === 'title') {
    return (
      <main className="realm-screen min-h-screen w-full bg-[#000000] text-[#d0d0d0] flex flex-col justify-between p-2 sm:p-4 font-mono select-none overflow-y-auto">
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
                  [ PROCEDURAL WORLD SEED ]
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

                {localSave && <button type="button" onClick={resumeLocalSave} className="resume-fortress">
                  <strong>Continue {localSave.name} →</strong>
                  <span>Year {localSave.year} · Tick {localSave.ticks} · Saved in this browser</span>
                </button>}
                {saveStatus && <p role="status" className="text-xs text-[var(--ui-info)]">{saveStatus}</p>}
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
                      ? 'No cloud archives. Use Save in the game to create one.'
                      : 'Play immediately with deterministic seed data, or sign in to sync fortresses.'}
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Live Procedural World Lore, Civilizations & Annals */}
            <div className="lg:col-span-7 bg-[#101010] border border-[#202020] p-3 sm:p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-[#ff0099] text-xs font-bold mb-1">
                  [ WORLD CHRONICLE: {previewWorld.name.toUpperCase()} ]
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
                  [ HISTORICAL ANNALS ({previewWorld.history.length} ERAS) ]
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
          Choose a tool · Drag an area · Enter to queue · Space to pause · / to find a command
        </div>
      </main>
    );
  }

  // PLAYING SCREEN
  return (
    <div className="game-shell">
      <GameHeader panel={panel} onPanel={setPanel}
        onGuild={() => setIsGuildModalOpen(true)} onTrade={() => setIsTradeModalOpen(true)}
        onDecree={() => {
          if (!gameState.activeEvent) triggerNarrativeEvent(undefined, true);
          setIsEventModalOpen(true);
        }} />
      {saveStatus && <div className="save-feedback" role="status">{saveStatus}</div>}
      <div className="game-workspace">
        {panel && <aside className="workspace-sidebar" aria-label={panel === 'clan' ? 'Clan and orders' : 'Chronicle and advisor'}>
          <div className="workspace-sidebar-heading">
            <strong>{panel === 'clan' ? 'Clan & orders' : 'Chronicle'}</strong>
            <button onClick={() => setPanel(null)} aria-label="Close side panel">×</button>
          </div>
          {panel === 'clan' ? <Sidebar /> : <AdvisorPanel />}
        </aside>}
        <main className="game-map" data-panel-open={Boolean(panel)} aria-label="Fortress map workspace">
          <ASCIIViewport />
        </main>
      </div>
      <UIOverlay onShowMap={() => setPanel(null)} />

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

      {/* Royal Guild Hall: Commissions, Relics & Clan Stories Modal */}
      <GuildHallModal
        isOpen={isGuildModalOpen}
        onClose={() => setIsGuildModalOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <GameProvider>
      <UIProvider>
        <FortressShell />
      </UIProvider>
    </GameProvider>
  );
}
