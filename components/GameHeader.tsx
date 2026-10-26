'use client';

import { useEffect, useRef } from 'react';
import { useGame } from './GameProvider';
import { useUI } from './UIProvider';
import { getCurrentWeather } from '@/lib/weather';
import { getFortressProgression } from '@/lib/progression';
import type { FortressResources } from '@/lib/types';

interface Props {
  panel: 'clan' | 'lore' | null;
  onPanel: (panel: 'clan' | 'lore' | null) => void;
  onGuild: () => void;
  onTrade: () => void;
  onDecree: () => void;
}

const resources: { key: keyof FortressResources; label: string; color?: string }[] = [
  { key: 'food', label: 'Food' }, { key: 'ale', label: 'Ale', color: '#cc00ff' },
  { key: 'stone', label: 'Stone' }, { key: 'wood', label: 'Wood', color: '#ff9900' },
  { key: 'ironOre', label: 'Iron', color: '#ff9900' }, { key: 'steelBars', label: 'Steel', color: '#00ffff' },
  { key: 'wealth', label: 'Wealth', color: '#ff0099' },
];

export default function GameHeader({ panel, onPanel, onGuild, onTrade, onDecree }: Props) {
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
  const weather = getCurrentWeather(state);
  const rank = getFortressProgression(state).currentRank;
  const menuAction = (action: () => void) => {
    if (menu.current) menu.current.open = false;
    action();
  };
  return (
    <header className="game-header">
      <div className="game-command-row">
        <div className="fortress-identity">
          <span className="fortress-mark" aria-hidden="true">⌂</span>
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
      <div className="game-resource-row" aria-label="Fortress supplies">
        <span className="population-stat" title="Dwarf population">☺ <strong>{state.dwarves.length}</strong></span>
        {resources.map(({ key, label, color }) => {
          const low = (key === 'food' || key === 'ale') && state.resources[key] < state.dwarves.length * 2;
          return <span key={key} className={`resource-stat${low ? ' resource-low' : ''}`} title={low ? `${label} supplies are low` : label}>
            <span>{label}</span><strong style={low ? undefined : { color }}>{state.resources[key]}</strong>{low && <span aria-label="Low supplies">!</span>}
          </span>;
        })}
        <span className="weather-stat" style={{ color: weather.color }} title={weather.summary}>{weather.glyph} {weather.shortLabel} {weather.surfaceTempF}°F</span>
      </div>
      <div className="workspace-nav">
        <div className="workspace-tabs" role="group" aria-label="Workspace panels">
          <button aria-pressed={panel === null} onClick={() => onPanel(null)}>Map</button>
          <button aria-pressed={panel === 'clan'} onClick={() => onPanel(panel === 'clan' ? null : 'clan')}>Clan & orders</button>
          <button aria-pressed={panel === 'lore'} onClick={() => onPanel(panel === 'lore' ? null : 'lore')}>Chronicle</button>
        </div>
        <button className="command-search" onClick={() => openOverlay('commands')}>Find command <kbd>/</kbd></button>
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
