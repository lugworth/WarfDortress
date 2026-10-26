'use client';

import { useEffect, useRef } from 'react';
import { useGame } from './GameProvider';
import { useUI } from './UIProvider';
import { getFortressProgression } from '@/lib/progression';

interface Props {
  clanOpen: boolean;
  chronicleOpen: boolean;
  onShowMap: () => void;
  onToggleClan: () => void;
  onToggleChronicle: () => void;
  onGuild: () => void;
  onTrade: () => void;
  onDecree: () => void;
}

export default function GameHeader({ clanOpen, chronicleOpen, onShowMap, onToggleClan, onToggleChronicle, onGuild, onTrade, onDecree }: Props) {
  const { gameState: state, togglePause, stepManualTick, setSpeed, handleCloudSave, setScreen } = useGame();
  const { openOverlay } = useUI();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (e: PointerEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  const rank = getFortressProgression(state).currentRank;
  const menuAction = (action: () => void) => {
    if (menu.current) menu.current.open = false;
    action();
  };
  return (
    <header className="game-header">
      <div className="game-command-row">
        <div className="fortress-identity">
          <span className="fortress-mark" aria-hidden="true" title="Dwarven warforge">⚒︎</span>
          <div className="min-w-0">
            <h1>{state.world.dwarvenName}</h1>
            <p>{rank.title}<span className="identity-calendar"> · Y{state.year} · {state.season} · T{state.ticks}</span></p>
          </div>
        </div>
        <div className="simulation-controls" role="group" aria-label="Simulation controls">
          <button className="play-control" aria-label={state.paused ? 'Resume simulation' : 'Pause simulation'}
            aria-pressed={!state.paused} onClick={togglePause}>
            {state.paused ? '▶ Resume' : 'Ⅱ Pause'}
          </button>
          <div className="speed-controls" role="group" aria-label="Simulation speed">
            {([1, 2, 4] as const).map(speed => <button key={speed} aria-label={`${speed} times speed`}
              aria-pressed={state.speed === speed} onClick={() => setSpeed(speed)}>{speed}×</button>)}
          </div>
          <button className="step-control" title="Advance one tick" onClick={stepManualTick}>+1</button>
          <button onClick={handleCloudSave}>Save</button>
          <details className="fortress-menu" ref={menu}>
            <summary aria-label="Fortress menu">Menu <span aria-hidden="true">⌄</span></summary>
            <nav aria-label="Fortress actions">
              <button onClick={() => menuAction(onGuild)}>Guild hall</button>
              <button onClick={() => menuAction(onTrade)}>Trade depot</button>
              <button onClick={() => menuAction(onDecree)}>Decrees{state.activeEvent ? ' · New' : ''}</button>
              <hr />
              <button onClick={() => menuAction(() => openOverlay('settings'))}>Display settings</button>
              <button onClick={() => menuAction(() => setScreen('title'))}>Return to realm</button>
            </nav>
          </details>
        </div>
      </div>
      <div className="workspace-nav">
        <div className="workspace-tabs" role="group" aria-label="Workspace panels">
          <button aria-pressed={!clanOpen && !chronicleOpen} onClick={onShowMap}>Map</button>
          <button aria-expanded={clanOpen} aria-controls="clan-panel" onClick={onToggleClan}>Clan & orders</button>
        </div>
        <div className="workspace-actions">
          <button className="command-search" onClick={() => openOverlay('commands')}>Find command <kbd>/</kbd></button>
          <button className="workspace-panel-toggle" aria-expanded={chronicleOpen} aria-controls="chronicle-panel" onClick={onToggleChronicle}>Chronicle</button>
        </div>
      </div>
      {state.activeEvent && <button className={`event-notice ${state.activeEvent.severity === 'MAJOR_CRISIS' ? 'event-danger' : ''}`}
        onClick={onDecree}>
        <span className="event-notice-label">New decree</span>
        <span className="truncate">{state.activeEvent.title}</span>
        <span className="event-notice-action">Review →</span>
      </button>}
    </header>
  );
}
