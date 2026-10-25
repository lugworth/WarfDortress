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
import FortressHeader from '@/components/FortressHeader';

function AsciiCrest() {
  return (
    <pre className="ascii-crest text-[var(--ui-accent)] text-[10px] sm:text-xs leading-none select-none font-mono text-center mx-auto">
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
                  WORLD SEED
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
                      : 'Strike the earth'}
                  </span>
                </button>
              </div>

              {embarkError && <p role="alert">{embarkError}</p>}
              {hasLocalSave && <button type="button" onClick={loadLocalSave} className="p-2 border text-[var(--ui-success)]">Continue</button>}
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
                      Google sign-in
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
                  WORLD CHRONICLE: {previewWorld.name.toUpperCase()}
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
                  HISTORICAL ANNALS ({previewWorld.history.length} ERAS)
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
      <FortressHeader state={gameState} ordersVisible={showLeftSidebar} chronicleVisible={showRightSidebar}
        onCommands={() => openOverlay('commands')} onDisplay={() => openOverlay('settings')}
        onGuild={() => setIsGuildModalOpen(true)} onAdventure={() => setIsAdventureModalOpen(true)}
        onTrade={() => setIsTradeModalOpen(true)} onDecrees={() => { if (!gameState.activeEvent) triggerNarrativeEvent(undefined, true); setIsEventModalOpen(true); }}
        onPause={togglePause} onStep={stepManualTick} onSpeed={setSpeed} onSave={handleCloudSave}
        onOrders={() => setShowLeftSidebar(v => !v)} onChronicle={() => setShowRightSidebar(v => !v)}
        onFullMap={() => { if (showLeftSidebar || showRightSidebar) { setShowLeftSidebar(false); setShowRightSidebar(false); } else setShowLeftSidebar(true); }}
        onRealm={() => setScreen('title')} onNewMap={() => { const seed = generateRandomWorldSeed(); setSeedInput(seed); embarkNewWorld(seed, false); }} />
      {saveStatus && <p role="status" className="ui-caption shrink-0 border-b border-[var(--ui-border)] px-3 py-1 text-[var(--ui-muted)]">{saveStatus}</p>}
      {gameState.activeEvent && <div className="flex shrink-0 items-center gap-3 border-b border-[var(--ui-border)] px-3 py-1"><span className="min-w-0 truncate text-[var(--ui-warning)]">! {gameState.activeEvent.title}</span><button type="button" className="ui-button" onClick={() => setIsEventModalOpen(true)}>Review decree</button></div>}

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
          aria-pressed={mobilePanel === 'MAP'}
          className={`py-1.5 px-0.5 text-center transition-colors whitespace-nowrap flex items-center justify-center shrink-0 ${
            mobilePanel === 'MAP'
              ? 'bg-[var(--ui-border)] text-[var(--ui-accent)] font-bold border border-[var(--ui-accent)]'
              : 'text-[var(--ui-muted)] border border-[var(--ui-border)]'
          }`}
        >
          Map
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel('MANAGE')}
          aria-pressed={mobilePanel === 'MANAGE'}
          className={`py-1.5 px-0.5 text-center transition-colors whitespace-nowrap flex items-center justify-center shrink-0 ${
            mobilePanel === 'MANAGE'
              ? 'bg-[var(--ui-border)] text-[var(--ui-accent)] font-bold border border-[var(--ui-accent)]'
              : 'text-[var(--ui-muted)] border border-[var(--ui-border)]'
          }`}
        >
          Orders
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel('ADVISOR')}
          aria-pressed={mobilePanel === 'ADVISOR'}
          aria-label="Chronicle"
          className={`py-1.5 px-0.5 text-center transition-colors whitespace-nowrap flex items-center justify-center shrink-0 ${
            mobilePanel === 'ADVISOR'
              ? 'bg-[var(--ui-border)] text-[var(--ui-accent)] font-bold border border-[var(--ui-accent)]'
              : 'text-[var(--ui-muted)] border border-[var(--ui-border)]'
          }`}
        >
          Log
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
