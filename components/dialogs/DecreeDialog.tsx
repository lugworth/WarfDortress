'use client';

import { useState } from 'react';
import { useGame } from '@/components/GameProvider';
import { PixelDialog } from '@/components/pixel/PixelDialog';
import { PixelIcon, PixelSprite } from '@/components/pixel/PixelIcon';
import { speakFortressText } from '@/lib/audio';
import { hasResources } from '@/lib/game-engine';
import type { SpriteName } from '@/lib/pixel/sprites';
import { formatCost } from '@/lib/tool-catalog';
import type { FortressResources, NarrativeEventSeverity } from '@/lib/types';

const SEVERITY: Record<NarrativeEventSeverity, { label: string; sprite: SpriteName; tone: string }> = {
  MINOR_OMEN: { label: 'Omen from the deep', sprite: 'temple', tone: 'px-info' },
  STRANGE_MOOD: { label: 'Fey artisan', sprite: 'relic', tone: 'px-gold' },
  TRADE_CARAVAN: { label: 'Merchant caravan', sprite: 'depot', tone: 'px-good' },
  DIPLOMATIC_ENVOY: { label: 'Diplomatic envoy', sprite: 'dwarf_helm_walk', tone: 'px-violet' },
  MAJOR_CRISIS: { label: 'Fortress crisis!', sprite: 'goblin_attack', tone: 'px-bad' },
};

const SUMMONS: { id: NarrativeEventSeverity; label: string }[] = [
  { id: 'STRANGE_MOOD', label: 'Fey mood' },
  { id: 'TRADE_CARAVAN', label: 'Caravan' },
  { id: 'DIPLOMATIC_ENVOY', label: 'Envoy' },
  { id: 'MINOR_OMEN', label: 'Omen' },
  { id: 'MAJOR_CRISIS', label: 'Siege' },
];

export default function DecreeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { gameState, triggerNarrativeEvent, resolveActiveEvent, isGeneratingEvent } = useGame();
  const [speaking, setSpeaking] = useState(false);
  const event = gameState.activeEvent;
  const morale = Math.round(gameState.dwarves.reduce((n, d) => n + d.happiness, 0) / Math.max(1, gameState.dwarves.length));

  const speak = async (text: string) => {
    if (speaking) return;
    setSpeaking(true);
    try { await speakFortressText(text.slice(0, 420)); } finally { setSpeaking(false); }
  };
  const choose = (index: number) => {
    const choice = event?.choices[index];
    if (choice && hasResources(gameState.resources, choice.cost)) resolveActiveEvent(choice.id);
  };

  return (
    <PixelDialog open={open} onClose={onClose} title="Decrees" icon="icon_decree" width={760}
      subtitle={<>Wealth <strong className="px-gold">{gameState.resources.wealth}</strong> · Dwarves <strong className="px-good">{gameState.dwarves.length}</strong> · Morale <strong className="px-info">{morale}%</strong> · Clock paused</>}>
      <div onKeyDown={(e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= 9 && !(e.target as HTMLElement).closest('input, select, textarea')) choose(n - 1);
      }}>
        {event ? (
          <article className="px-stack">
            <div className="decree-scene px-inset">
              <PixelSprite name={SEVERITY[event.severity]?.sprite ?? 'temple'} scale={5} />
            </div>
            <div>
              <p className={SEVERITY[event.severity]?.tone} style={{ margin: 0, fontSize: '0.8em' }}>{SEVERITY[event.severity]?.label ?? event.severity} · Year {gameState.year}, {gameState.season}</p>
              <h3 className="px-title" style={{ margin: '4px 0 8px' }}>{event.title}</h3>
              <p style={{ margin: 0 }}>{event.narrative}</p>
              <p className="px-violet" style={{ margin: '6px 0 0', fontSize: '0.85em' }}>History: {event.historicalConnection}</p>
              {event.triggerReason && <p className="px-info" style={{ margin: '2px 0 0', fontSize: '0.85em' }}>Why now: {event.triggerReason}</p>}
              <button type="button" className="px-link" style={{ marginTop: 6 }} disabled={speaking} onClick={() => speak(`${event.title}. ${event.narrative}`)}>
                {speaking ? 'Narrating…' : 'Read aloud'}
              </button>
            </div>
            <div className="px-stack px-stack--tight" role="group" aria-label="Your decree">
              {event.choices.map((choice, i) => {
                const affordable = hasResources(gameState.resources, choice.cost);
                return (
                  <button key={choice.id} type="button" className="choice-card" disabled={!affordable} onClick={() => choose(i)}>
                    <span className="px-row px-row--between">
                      <strong><kbd className="px-kbd">{i + 1}</kbd> {choice.label}</strong>
                      <span className="px-row" style={{ fontSize: '0.8em' }}>
                        {choice.cost && formatCost(choice.cost as Partial<FortressResources>) !== 'Free' && <span className="px-bad">−{formatCost(choice.cost as Partial<FortressResources>)}</span>}
                        {choice.reward && formatCost(choice.reward as Partial<FortressResources>) !== 'Free' && <span className="px-good">+{formatCost(choice.reward as Partial<FortressResources>)}</span>}
                        {choice.moraleDelta ? <span className={choice.moraleDelta > 0 ? 'px-violet' : 'px-bad'}>{choice.moraleDelta > 0 ? '+' : ''}{choice.moraleDelta} morale</span> : null}
                        {choice.spawnMigrants ? <span className="px-info">+{choice.spawnMigrants} migrants</span> : null}
                        {choice.stanceChange ? <span className="px-violet">{choice.stanceChange.race} → {choice.stanceChange.stance.toLowerCase()}</span> : null}
                      </span>
                    </span>
                    <span className="px-muted" style={{ fontSize: '0.85em' }}>{choice.description}</span>
                    {!affordable && <span className="px-ember" style={{ fontSize: '0.8em' }}>You cannot afford this choice.</span>}
                  </button>
                );
              })}
            </div>
          </article>
        ) : (
          <div className="empty-state">
            <PixelSprite name="dwarf_sleep" scale={4} />
            <strong>No decree awaits you</strong>
            <span className="px-muted">Events arrive as the fortress grows. You can also summon one below.</span>
          </div>
        )}

        <section className="px-card" style={{ marginTop: 12 }} aria-label="Summon an event">
          <div className="px-row px-row--between">
            <strong style={{ fontSize: '0.85em' }}>Summon an event</strong>
            {isGeneratingEvent && <span className="px-gold typing" style={{ fontSize: '0.8em' }}>The storyteller is writing<span className="dots" /></span>}
          </div>
          <div className="px-row" style={{ marginTop: 6 }}>
            {SUMMONS.map((s) => (
              <button key={s.id} type="button" className="px-btn px-btn--small" disabled={isGeneratingEvent} onClick={() => triggerNarrativeEvent(s.id, true)}>
                <PixelIcon name={SEVERITY[s.id].sprite} scale={1} /> {s.label}
              </button>
            ))}
          </div>
        </section>

        {gameState.eventHistory.length > 0 && (
          <details className="px-card" style={{ marginTop: 12 }}>
            <summary>Past decrees ({gameState.eventHistory.length})</summary>
            <ol className="log-list" style={{ marginTop: 6 }}>
              {gameState.eventHistory.map((ev) => (
                <li key={ev.id}>
                  <time>T{ev.tickTriggered}</time>
                  <span><strong>{ev.title}</strong> · <span className="px-gold">{ev.chosenLabel}</span><br /><span className="px-muted">{ev.outcomeSummary}</span></span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </PixelDialog>
  );
}
