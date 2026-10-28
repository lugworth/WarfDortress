'use client';

import { useState } from 'react';
import { PixelIcon } from '@/components/pixel/PixelIcon';
import { PixelMeter } from '@/components/pixel/PixelMeter';
import {
  EXPEDITION_ROUTES,
  createExpeditionState,
  expeditionActionAvailable,
  type ExpeditionAction,
  type ExpeditionApproach,
  type ExpeditionState,
} from '@/lib/expeditions';
import { formatCost } from '@/lib/tool-catalog';
import type { GameState } from '@/lib/types';

export default function ExpeditionsPanel({ state, onAction }: { state: GameState; onAction: (action: ExpeditionAction) => boolean }) {
  const [status, setStatus] = useState('');
  const [approaches, setApproaches] = useState<Record<string, ExpeditionApproach>>({});
  const expeditions: ExpeditionState = state.activities?.expeditions || createExpeditionState();
  const active = expeditions.active;
  const act = (action: ExpeditionAction, message: string) =>
    setStatus(onAction(action) ? message : 'Conditions changed. Check supplies, the active trip, and its return time.');

  return (
    <div className="px-stack px-stack--tight" aria-label="Caravan expeditions" role="region">
      <p className="px-muted" style={{ margin: 0, fontSize: '0.8em' }}>
        Hire outside scouts while your dwarves keep working. Supplies are spent at departure; cargo is yours when you claim it.
      </p>
      {status && <p role="status" className="px-info" style={{ margin: 0, fontSize: '0.85em' }}>{status}</p>}
      {active && (
        <article className="px-card" data-tone="gold">
          <div className="px-row px-row--between">
            <strong>{EXPEDITION_ROUTES.find((r) => r.id === active.routeId)?.name}</strong>
            <span className="px-chip" data-tone={state.ticks >= active.returnsAt ? 'green' : 'blue'}>{state.ticks >= active.returnsAt ? 'Returned' : 'Travelling'}</span>
          </div>
          <PixelMeter value={state.ticks - active.startedAt} max={active.returnsAt - active.startedAt} label="Expedition travel progress" tone="gold" segments />
          <p className="px-muted" style={{ margin: '4px 0', fontSize: '0.8em' }}>
            {active.approach === 'BOLD' ? 'Bold' : 'Cautious'} · {Math.max(0, active.returnsAt - state.ticks)} ticks to go
          </p>
          <button type="button" className="px-btn px-btn--green px-btn--block"
            disabled={!expeditionActionAvailable(state, { type: 'CLAIM_EXPEDITION', id: active.id })}
            onClick={() => act({ type: 'CLAIM_EXPEDITION', id: active.id }, 'Cargo claimed. The journey is recorded below.')}>
            <PixelIcon name="icon_wealth" /> Claim cargo
          </button>
        </article>
      )}
      {EXPEDITION_ROUTES.map((route) => {
        const approach = approaches[route.id] || 'CAUTIOUS';
        const plan = route.approaches[approach];
        return (
          <article key={route.id} className="px-card">
            <strong className="px-gold">{route.name}</strong>
            <p className="px-muted" style={{ margin: '2px 0 6px', fontSize: '0.8em' }}>{route.description}</p>
            <div className="px-row px-row--between" style={{ fontSize: '0.85em' }}>
              <span>Costs <span className="px-ember">{formatCost(route.cost)}</span></span>
              <select className="px-input" aria-label={`Approach for ${route.name}`} value={approach}
                onChange={(e) => setApproaches((p) => ({ ...p, [route.id]: e.target.value as ExpeditionApproach }))}>
                <option value="CAUTIOUS">Cautious</option>
                <option value="BOLD">Bold</option>
              </select>
            </div>
            <div className="px-stack px-stack--tight" style={{ fontSize: '0.8em', margin: '6px 0' }}>
              <span>{plan.duration} ticks · {plan.setbackChance}% setback risk</span>
              <span className="px-good">Success: {formatCost(plan.reward)}{route.relicOnSuccess ? ' · a named heirloom' : ''}</span>
              <span className="px-ember">Setback: {formatCost(route.setbackReward)}</span>
            </div>
            <button type="button" className="px-btn px-btn--blue px-btn--block" aria-label={`Launch ${route.name}`}
              disabled={!expeditionActionAvailable(state, { type: 'START_EXPEDITION', routeId: route.id, approach })}
              onClick={() => act({ type: 'START_EXPEDITION', routeId: route.id, approach }, `${route.name} has set out. Resume the clock to let them travel.`)}>
              <PixelIcon name="icon_scroll" /> Send scouts
            </button>
          </article>
        );
      })}
      {active && <p className="px-dim" style={{ margin: 0, fontSize: '0.8em' }}>Claim the current expedition before sending another.</p>}
      {expeditions.history.length > 0 && (
        <details className="px-card">
          <summary>Journey accounts ({expeditions.history.length})</summary>
          <ol className="log-list" style={{ marginTop: 6 }}>
            {expeditions.history.map((result) => (
              <li key={result.id}>
                <time>T{result.claimedAt}</time>
                <span>
                  <strong>{EXPEDITION_ROUTES.find((r) => r.id === result.routeId)?.name}</strong> · {result.outcome === 'SUCCESS' ? 'safe return' : 'setback'} · {formatCost(result.reward)}
                  {result.relicId ? ' · relic added to the Guild Hall' : ''}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
