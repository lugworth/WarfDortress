'use client';

import { useMemo, useState } from 'react';
import { useGame } from '@/components/GameProvider';
import { PixelIcon } from '@/components/pixel/PixelIcon';
import { PixelMeter } from '@/components/pixel/PixelMeter';
import { playTactileSfx } from '@/lib/audio';
import { getBuildingTileFunctionInfo, getResourceEconomyBalance } from '@/lib/game-engine';
import type { SpriteName } from '@/lib/pixel/sprites';
import { tileSprites } from '@/lib/pixel/tiles';
import { formatCost } from '@/lib/tool-catalog';
import type { FortressResources, WorkOrder } from '@/lib/types';

const VAULT: { key: keyof FortressResources; label: string; icon: SpriteName }[] = [
  { key: 'food', label: 'Food', icon: 'icon_food' },
  { key: 'ale', label: 'Ale', icon: 'icon_ale' },
  { key: 'stone', label: 'Stone', icon: 'icon_stone' },
  { key: 'wood', label: 'Timber', icon: 'icon_wood' },
  { key: 'ironOre', label: 'Iron ore', icon: 'icon_iron' },
  { key: 'goldOre', label: 'Gold ore', icon: 'icon_gold' },
  { key: 'steelBars', label: 'Steel bars', icon: 'icon_steel' },
  { key: 'furniture', label: 'Furniture', icon: 'icon_furniture' },
  { key: 'weapons', label: 'Weapons', icon: 'icon_weapons' },
  { key: 'armor', label: 'Armor', icon: 'icon_armor' },
  { key: 'relics', label: 'Relics', icon: 'icon_relic' },
  { key: 'wealth', label: 'Wealth', icon: 'icon_wealth' },
];

const ORDER_PRESETS: { label: string; icon: SpriteName; order: Omit<WorkOrder, 'id'> }[] = [
  { label: 'Smelt steel', icon: 'icon_steel', order: { title: 'Smelt Steel Bars', workshop: 'WORKSHOP_SMELTER', cost: { ironOre: 2, wood: 1 }, produce: { steelBars: 2, wealth: 35 }, remaining: 3, autoRepeat: true } },
  { label: 'Forge axes', icon: 'icon_weapons', order: { title: 'Forge Runed Battle Axes', workshop: 'WORKSHOP_FORGE', cost: { steelBars: 1 }, produce: { weapons: 1, wealth: 55 }, remaining: 2, autoRepeat: true } },
  { label: 'Forge armor', icon: 'icon_armor', order: { title: 'Forge Steel Plate Mail', workshop: 'WORKSHOP_FORGE', cost: { steelBars: 1 }, produce: { armor: 1, wealth: 60 }, remaining: 2, autoRepeat: false } },
  { label: 'Brew ale', icon: 'icon_ale', order: { title: 'Brew Plump Helmet Ale', workshop: 'WORKSHOP_STILL', cost: { food: 2 }, produce: { ale: 5, wealth: 15 }, remaining: 3, autoRepeat: true } },
  { label: 'Carve furniture', icon: 'icon_furniture', order: { title: 'Carve Stone Thrones', workshop: 'WORKSHOP_MASON', cost: { stone: 3 }, produce: { furniture: 1, wealth: 25 }, remaining: 3, autoRepeat: false } },
];

const WORKSHOP_NAMES: Record<string, string> = {
  WORKSHOP_SMELTER: 'Smeltery',
  WORKSHOP_FORGE: 'Forge',
  WORKSHOP_STILL: 'Still',
  WORKSHOP_MASON: 'Mason',
  WORKSHOP_CARPENTER: 'Carpenter',
};

export default function StocksPanel() {
  const { gameState, jumpToLocation, activateBuildingFunction, addWorkOrder, toggleWorkOrderAutoRepeat, removeWorkOrder } = useGame();
  const [actionStatus, setActionStatus] = useState('');
  const econ = getResourceEconomyBalance(gameState);
  const atRisk = Math.max(0, gameState.resources.food - econ.maxSafeFoodStorage);

  // One working example of each building type, anywhere in the fortress.
  const structures = useMemo(() => {
    const seen = new Set<string>();
    const found = [];
    for (const level of gameState.grid) {
      for (const row of level) {
        for (const tile of row) {
          if (!tile.revealed || seen.has(tile.terrain)) continue;
          const fn = getBuildingTileFunctionInfo(gameState, tile);
          if (!fn) continue;
          seen.add(tile.terrain);
          found.push({ tile, fn });
        }
      }
    }
    return found;
  }, [gameState]);

  return (
    <div className="px-stack">
      <section aria-label="Vault and armory" className="px-stack px-stack--tight">
        <div className="px-heading"><PixelIcon name="icon_barrel" /> Vault & armory</div>
        <div className="vault-grid">
          {VAULT.map(({ key, label, icon }) => (
            <div key={key} className="vault-item px-inset" title={label}>
              <PixelIcon name={icon} scale={2} />
              <span className="min-w-0"><small className="px-dim">{label}</small><strong className="px-num">{gameState.resources[key].toLocaleString()}</strong></span>
            </div>
          ))}
        </div>
      </section>

      <section className="px-card" data-tone={atRisk > 0 ? 'red' : 'green'} data-testid="provisions-economy-card" aria-label="Provisions">
        <div className="px-heading"><PixelIcon name="icon_food" /> Provisions <small>{econ.stockpileTiles} stockpile tiles · {econ.status.toLowerCase()}</small></div>
        <PixelMeter value={gameState.resources.food} max={Math.max(1, econ.maxSafeFoodStorage)} label="Safe food storage" tone={atRisk > 0 ? 'ember' : 'green'} segments />
        <div className="px-stack px-stack--tight" style={{ marginTop: 6, fontSize: '0.85em' }}>
          <span>Safe storage <strong className="px-num">{gameState.resources.food}/{econ.maxSafeFoodStorage}</strong>{atRisk > 0 ? <span className="px-ember"> · {atRisk} may spoil</span> : <span className="px-good"> · safe</span>}</span>
          <span>Food use ~{econ.foodPerSeason}/season · <span className="px-info">{econ.foodRunwaySeasons} seasons left</span></span>
          <span>Ale use ~{econ.alePerSeason}/season · <span className="px-violet">{econ.aleRunwaySeasons} seasons left</span></span>
        </div>
      </section>

      <section aria-label="Production queue" className="px-stack px-stack--tight">
        <div className="px-heading"><PixelIcon name="icon_furnace" /> Production queue <small>{gameState.workOrders.length} orders</small></div>
        {gameState.workOrders.map((order) => (
          <div key={order.id} className="px-card px-row px-row--between">
            <span className="min-w-0" style={{ flex: 1 }}>
              <strong>{order.title}</strong>
              <small className="px-muted" style={{ display: 'block' }}>{order.remaining} left · {WORKSHOP_NAMES[order.workshop] ?? order.workshop}</small>
            </span>
            <button type="button" className="px-btn px-btn--small" aria-pressed={order.autoRepeat} onClick={() => toggleWorkOrderAutoRepeat(order.id)}>Repeat</button>
            <button type="button" className="px-btn px-btn--small px-btn--icon px-btn--red" aria-label={`Remove ${order.title}`} onClick={() => removeWorkOrder(order.id)}><PixelIcon name="icon_close" /></button>
          </div>
        ))}
        {gameState.workOrders.length === 0 && <p className="px-dim" style={{ margin: 0, fontSize: '0.85em' }}>No production orders. Queue one below.</p>}
        <div className="px-grid-2">
          {ORDER_PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="px-btn px-btn--small" title={`${formatCost(preset.order.cost)} → ${formatCost(preset.order.produce)}`}
              onClick={() => { playTactileSfx('stamp'); addWorkOrder(preset.order); }}>
              <PixelIcon name={preset.icon} /> {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Buildings" data-testid="building-actuators-card" className="px-stack px-stack--tight">
        <div className="px-heading"><PixelIcon name="icon_hammer" /> Buildings <small>{structures.length} types built</small></div>
        {actionStatus && <p role="status" data-testid="building-action-status" className="px-good" style={{ margin: 0, fontSize: '0.85em' }}>{actionStatus}</p>}
        {structures.length === 0 && <p className="px-dim" style={{ margin: 0, fontSize: '0.85em' }}>Finished workshops and halls appear here with their special actions.</p>}
        {structures.map(({ tile, fn }) => (
          <article key={tile.terrain} className="px-card">
            <div className="px-row">
              <PixelIcon name={tileSprites(tile, undefined).base} scale={2} />
              <button type="button" className="px-link" onClick={() => jumpToLocation(tile.x, tile.y, tile.z)}>{fn.title}</button>
              <span className="px-dim" style={{ fontSize: '0.75em', marginLeft: 'auto' }}>depth {tile.z}</span>
            </div>
            <p className="px-muted" style={{ margin: '4px 0', fontSize: '0.8em' }}>{fn.passiveFunction}</p>
            <button type="button" className="px-btn px-btn--green px-btn--small px-btn--block" data-testid={`activate-tile-${tile.terrain}`} disabled={!fn.canActivate}
              onClick={() => { playTactileSfx('stamp'); setActionStatus(activateBuildingFunction(tile.x, tile.y, tile.z).message); }}>
              {fn.actionLabel} · <span className="px-num">{formatCost(fn.cost)}</span>{fn.readyInTicks > 0 ? ` · ready in ${fn.readyInTicks}t` : ''}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
