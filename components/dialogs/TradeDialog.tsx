'use client';

import { useState } from 'react';
import { useGame } from '@/components/GameProvider';
import { PixelDialog } from '@/components/pixel/PixelDialog';
import { PixelIcon, PixelSprite } from '@/components/pixel/PixelIcon';
import { playTactileSfx } from '@/lib/audio';
import { getLevelTerrainCounts } from '@/lib/grid';
import type { SpriteName } from '@/lib/pixel/sprites';
import type { FortressResources } from '@/lib/types';

type Key = keyof FortressResources;
interface Good { key: Key; label: string; value: number; icon: SpriteName }

const EXPORTS: Good[] = [
  { key: 'stone', label: 'Rough stone', value: 2, icon: 'icon_stone' },
  { key: 'furniture', label: 'Furniture', value: 18, icon: 'icon_furniture' },
  { key: 'steelBars', label: 'Steel bars', value: 25, icon: 'icon_steel' },
  { key: 'weapons', label: 'Battle axes', value: 40, icon: 'icon_weapons' },
  { key: 'armor', label: 'Plate mail', value: 45, icon: 'icon_armor' },
  { key: 'goldOre', label: 'Gold nuggets', value: 35, icon: 'icon_gold' },
];

const IMPORTS: Good[] = [
  { key: 'food', label: 'Rations', value: 5, icon: 'icon_food' },
  { key: 'ale', label: 'Cask ale', value: 6, icon: 'icon_ale' },
  { key: 'wood', label: 'Timber', value: 5, icon: 'icon_wood' },
  { key: 'ironOre', label: 'Iron ore', value: 14, icon: 'icon_iron' },
  { key: 'steelBars', label: 'Steel ingots', value: 30, icon: 'icon_steel' },
];

const MIGRANT_COST = 90;

function Stepper({ label, value, min = 0, max, onChange }: { label: string; value: number; min?: number; max: number; onChange: (next: number) => void }) {
  const set = (next: number) => onChange(Math.max(min, Math.min(max, next)));
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button type="button" className="px-btn px-btn--small" aria-label={`${label}: remove 5`} disabled={value <= min} onClick={() => set(value - 5)}>−5</button>
      <button type="button" className="px-btn px-btn--small px-btn--icon" aria-label={`${label}: remove 1`} disabled={value <= min} onClick={() => set(value - 1)}>−</button>
      <output className="px-num" aria-live="polite">{value}</output>
      <button type="button" className="px-btn px-btn--small px-btn--icon" aria-label={`${label}: add 1`} disabled={value >= max} onClick={() => set(value + 1)}>+</button>
      <button type="button" className="px-btn px-btn--small" aria-label={`${label}: add 5`} disabled={value >= max} onClick={() => set(value + 5)}>+5</button>
    </span>
  );
}

export default function TradeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { gameState, performTradeBarter } = useGame();
  const [give, setGive] = useState<Partial<Record<Key, number>>>({});
  const [receive, setReceive] = useState<Partial<Record<Key, number>>>({});
  const [migrant, setMigrant] = useState(false);

  const depot = getLevelTerrainCounts(gameState.grid[0]).has('TRADE_DEPOT');
  const caravanSeason = gameState.season.includes('Autumn') || gameState.season.includes('Summer');
  const codex = gameState.guild.relics.some((r) => r.mode === 'DISPLAYED' && r.template === 'CHRONICLE_CODEX');
  const multiplier = (depot ? 1.15 : 1) + (gameState.resources.wealth >= 900 ? 0.1 : 0) + (codex ? 0.2 : 0);
  const offered = Math.floor(EXPORTS.reduce((n, g) => n + (give[g.key] || 0) * g.value, 0) * multiplier);
  const requested = IMPORTS.reduce((n, g) => n + (receive[g.key] || 0) * g.value, 0) + (migrant ? MIGRANT_COST : 0);
  const balance = offered - requested;
  const fair = offered > 0 && requested > 0 && balance >= 0;
  const reset = () => { setGive({}); setReceive({}); setMigrant(false); };

  return (
    <PixelDialog open={open} onClose={onClose} title="Trade depot" icon="icon_trade" width={820}
      subtitle={<>{caravanSeason ? 'A caravan is camped outside' : 'An outpost runner awaits'} · {depot ? <span className="px-good">depot built: +15% export value</span> : <span className="px-ember">build a Trade Depot for +15%</span>}</>}
      footer={<>
        <span className="trade-balance px-num">
          Offer <strong className="px-ember">{offered}g</strong> · Ask <strong className="px-info">{requested}g</strong> ·{' '}
          <strong className={balance >= 0 ? 'px-good' : 'px-bad'}>{balance >= 0 ? `+${balance}g fair` : `${balance}g short`}</strong>
        </span>
        <span className="spacer" />
        <button type="button" className="px-btn px-btn--ghost px-btn--small" onClick={reset}>Clear</button>
        <button type="button" className="px-btn px-btn--green" disabled={!fair}
          onClick={() => { playTactileSfx('trade'); performTradeBarter(give, receive, migrant); reset(); onClose(); }}>
          <PixelIcon name="icon_check" /> Seal the deal
        </button>
      </>}>
      <div className="trade-scene px-inset" aria-hidden="true">
        <PixelSprite name="depot" scale={3} />
        <PixelSprite name="dwarf_walk" scale={3} />
        <PixelSprite name="dwarf_helm_idle" scale={3} />
      </div>
      <div className="trade-grid">
        <section aria-label="Your exports" className="px-stack px-stack--tight">
          <div className="px-heading"><PixelIcon name="icon_up" /> You offer</div>
          {EXPORTS.map((g) => (
            <div key={g.key} className="trade-row px-card">
              <PixelIcon name={g.icon} scale={2} />
              <span className="min-w-0"><strong>{g.label}</strong><small className="px-muted">{g.value}g each · have {gameState.resources[g.key]}</small></span>
              <Stepper label={g.label} value={give[g.key] || 0} max={gameState.resources[g.key] || 0} onChange={(n) => setGive((p) => ({ ...p, [g.key]: n }))} />
            </div>
          ))}
        </section>
        <section aria-label="Caravan imports" className="px-stack px-stack--tight">
          <div className="px-heading"><PixelIcon name="icon_down" /> You receive</div>
          {IMPORTS.map((g) => (
            <div key={g.key} className="trade-row px-card">
              <PixelIcon name={g.icon} scale={2} />
              <span className="min-w-0"><strong>{g.label}</strong><small className="px-muted">{g.value}g each · have {gameState.resources[g.key]}</small></span>
              <Stepper label={g.label} value={receive[g.key] || 0} max={99} onChange={(n) => setReceive((p) => ({ ...p, [g.key]: n }))} />
            </div>
          ))}
          <label className="trade-row px-card px-check" data-tone={migrant ? 'gold' : undefined}>
            <PixelIcon name="icon_population" scale={2} />
            <span className="min-w-0"><strong>Hire a caravan artisan</strong><small className="px-muted">{MIGRANT_COST}g · joins the clan at once</small></span>
            <input type="checkbox" checked={migrant} onChange={(e) => setMigrant(e.target.checked)} />
          </label>
        </section>
      </div>
    </PixelDialog>
  );
}
