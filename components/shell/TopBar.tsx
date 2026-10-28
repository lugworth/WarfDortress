'use client';

import { useState } from 'react';
import { useGame } from '@/components/GameProvider';
import { useUI } from '@/components/UIProvider';
import { PixelIcon, PixelSprite } from '@/components/pixel/PixelIcon';
import { PixelMeter } from '@/components/pixel/PixelMeter';
import { isTactileSfxMuted, setTactileSfxMuted } from '@/lib/audio';
import { FORTRESS_RANKS } from '@/lib/progression';
import ResourceBar from './ResourceBar';

const GOAL = FORTRESS_RANKS[FORTRESS_RANKS.length - 1].minScore;

export default function TopBar({ onGoals, onGuide }: { onGoals: () => void; onGuide: () => void }) {
  const { gameState: state, progression, togglePause, stepManualTick, setSpeed, handleCloudSave, setScreen } = useGame();
  const { openOverlay } = useUI();
  const [muted, setMuted] = useState(isTactileSfxMuted);
  const closeMenu = () => document.getElementById('game-menu')?.hidePopover();
  const reached = progression.score >= GOAL;

  return (
    <header className="topbar">
      <div className="identity">
        <PixelSprite name="forge" scale={2} className="identity-emblem" />
        <div className="min-w-0">
          <h1>{state.world.dwarvenName}</h1>
          <p>{progression.currentRank.title} · Year {state.year} · {state.season}</p>
          <button type="button" className="goal-link" onClick={onGoals} title="Mountainhome goal and milestones">
            <PixelIcon name="icon_trophy" scale={1} />
            <PixelMeter value={progression.score} max={GOAL} label="Mountainhome goal" tone="gold" />
            <span className="px-num">{reached ? 'Mountainhome reached!' : `${progression.score.toLocaleString()} / ${GOAL.toLocaleString()}`}</span>
          </button>
        </div>
      </div>

      <ResourceBar />

      <div className="sim-controls" role="group" aria-label="Simulation">
        <button type="button" className={`px-btn ${state.paused ? 'px-btn--green' : 'px-btn--gold'}`}
          aria-label={state.paused ? 'Resume' : 'Pause'} onClick={togglePause}>
          <PixelIcon name={state.paused ? 'icon_play' : 'icon_pause'} />
          <span className="hide-narrow">{state.paused ? 'Play' : 'Pause'}</span>
        </button>
        <div className="speed-group" role="group" aria-label="Speed">
          {([1, 2, 4] as const).map((speed) => (
            <button key={speed} type="button" className="px-btn px-btn--small" aria-label={`${speed} times speed`}
              aria-pressed={state.speed === speed} onClick={() => setSpeed(speed)}>{speed}×</button>
          ))}
        </div>
        <button type="button" className="px-btn px-btn--icon step-btn" aria-label="Advance one tick" title="Advance one tick" onClick={stepManualTick}>
          <PixelIcon name="icon_step" />
        </button>
        <button type="button" className="px-btn px-btn--icon" aria-label="Save" title="Save a checkpoint" onClick={handleCloudSave}>
          <PixelIcon name="icon_save" />
        </button>
        <button type="button" className="px-btn px-btn--icon" aria-label="Menu" popoverTarget="game-menu">
          <PixelIcon name="icon_menu" />
        </button>
        <div id="game-menu" popover="auto" className="menu-pop px-panel">
          <button type="button" className="px-btn px-btn--ghost px-btn--block" onClick={() => { closeMenu(); onGuide(); }}>
            <PixelIcon name="icon_book" /> How to play
          </button>
          <button type="button" className="px-btn px-btn--ghost px-btn--block" onClick={() => { closeMenu(); openOverlay('commands'); }}>
            <PixelIcon name="icon_inspect" /> Find a command <kbd className="px-kbd">/</kbd>
          </button>
          <button type="button" className="px-btn px-btn--ghost px-btn--block" onClick={() => { closeMenu(); openOverlay('settings'); }}>
            <PixelIcon name="icon_gear" /> Settings
          </button>
          <button type="button" className="px-btn px-btn--ghost px-btn--block" aria-pressed={muted} onClick={() => { setTactileSfxMuted(!muted); setMuted(!muted); }}>
            <PixelIcon name={muted ? 'icon_mute' : 'icon_sound'} /> {muted ? 'Sound off' : 'Sound on'}
          </button>
          <hr className="px-divider" />
          <button type="button" className="px-btn px-btn--ghost px-btn--block" onClick={() => { closeMenu(); setScreen('title'); }}>
            <PixelIcon name="icon_home" /> Return to the realm
          </button>
        </div>
      </div>
    </header>
  );
}
