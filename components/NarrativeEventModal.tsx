'use client';
import { speakFortressText } from '@/lib/audio';

import React, { useState, useEffect } from 'react';
import { useGame } from './GameProvider';
import { hasResources } from '@/lib/game-engine';
import { NarrativeEventSeverity } from '@/lib/types';
import { MAX_POPULATION } from '@/lib/game-rules';
import { useDialog } from '@/hooks/use-dialog';
import { ISOTOPE } from '@/lib/colors';

interface NarrativeEventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SEVERITY_STYLE: Record<
  NarrativeEventSeverity,
  { label: string; color: string }
> = {
  MINOR_OMEN: {
    label: 'SUBTERRANEAN OMEN',
    color: ISOTOPE.base0C,
  },
  STRANGE_MOOD: {
    label: 'FEY ARTISAN MOOD',
    color: ISOTOPE.base0A,
  },
  TRADE_CARAVAN: {
    label: 'MERCHANT CARAVAN',
    color: ISOTOPE.base0B,
  },
  DIPLOMATIC_ENVOY: {
    label: 'DIPLOMATIC ENVOY',
    color: ISOTOPE.base0E,
  },
  MAJOR_CRISIS: {
    label: 'FORTRESS CRISIS!',
    color: ISOTOPE.base08,
  },
};

export default function NarrativeEventModal({ isOpen, onClose }: NarrativeEventModalProps) {
  const {
    gameState,
    triggerNarrativeEvent,
    resolveActiveEvent,
    isGeneratingEvent,
  } = useGame();

  const dialogRef = useDialog(isOpen, onClose);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const activeEvent = gameState.activeEvent;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      const choice = activeEvent?.choices[Number(e.key) - 1];
      if (choice && /^[1-9]$/.test(e.key) && hasResources(gameState.resources, choice.cost) && gameState.dwarves.length + (choice.spawnMigrants || 0) <= MAX_POPULATION) { e.preventDefault(); resolveActiveEvent(choice.id); }
    };
    const dialog = dialogRef.current;
    dialog?.addEventListener('keydown', handler);
    return () => dialog?.removeEventListener('keydown', handler);
  }, [isOpen, activeEvent, gameState.resources, gameState.dwarves.length, resolveActiveEvent, dialogRef]);

  if (!isOpen) return null;

  const avgMorale = Math.round(
    gameState.dwarves.reduce((sum, d) => sum + d.happiness, 0) /
      Math.max(1, gameState.dwarves.length)
  );

  const speakNarrative = async (text: string) => {
    if (!text || isSpeaking) return;
    setIsSpeaking(true);
    try { await speakFortressText(text); }
    finally { setIsSpeaking(false); }
  };

  const formatResourceMap = (map?: Record<string, number>, prefix = '') => {
    if (!map) return '';
    return Object.entries(map)
      .filter(([, val]) => val && val > 0)
      .map(([key, val]) => `${prefix}${val} ${key.toUpperCase()}`)
      .join(' · ');
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Fortress Narrative Events and Decrees"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[var(--ui-bg)]/85 font-mono select-none"
    >
      <div className="w-full max-w-3xl bg-[var(--ui-bg)] border-2 border-[var(--ui-accent)] shadow-none flex flex-col max-h-[92vh] text-xs text-[var(--ui-text)]">
        {/* Terminal Header with ASCII Border Frame */}
        <div className="px-3 py-2 bg-[var(--ui-panel)] border-b border-[var(--ui-border)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--ui-accent)] font-bold whitespace-nowrap truncate">
              ╔═[ ROYAL DECREES &amp; NARRATIVE EVENTS ]═
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs shrink-0">
            {isGeneratingEvent && (
              <span className="text-[var(--ui-accent)] animate-pulse whitespace-nowrap shrink-0">
                [ AI Chronicler Consulting... ]
              </span>
            )}
            <button
              type="button"
              aria-label="Close Event Modal"
              onClick={onClose}
              className="text-[var(--ui-danger)] hover:bg-[var(--ui-border)] px-1 font-bold whitespace-nowrap shrink-0"
            >
              [ ESC: CLOSE ]
            </button>
          </div>
        </div>

        <div className="p-3 overflow-y-auto space-y-3.5 custom-scrollbar bg-[var(--ui-bg)]">
          {/* Storyteller Telemetry Strip */}
          <div className="p-1.5 border border-[var(--ui-border)] bg-[var(--ui-panel)] flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-[var(--ui-muted)] whitespace-nowrap">
              STORYTELLER STATE: WEALTH <strong className="text-[var(--ui-accent)]">{gameState.resources.wealth}</strong> | POP <strong className="text-[var(--ui-success)]">{gameState.dwarves.length}</strong> | MORALE <strong className="text-[var(--ui-info)]">{avgMorale}%</strong>
            </span>
            <span className="text-[var(--ui-muted)] whitespace-nowrap shrink-0">
              ANNALS RECORDED: <strong className="text-[var(--ui-bright)]">{gameState.world.history.length}</strong>
            </span>
          </div>

          {/* Summon Bar */}
          <div className="p-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] space-y-1">
            <div className="text-[var(--ui-muted)] text-[10px] font-bold whitespace-nowrap truncate">
              ┌─[ SUMMON EMERGENT STORYTELLER EVENT ]
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'STRANGE_MOOD', label: '[ 1: FEY MOOD ]', color: 'text-[var(--ui-accent)]' },
                  { id: 'TRADE_CARAVAN', label: '[ 2: CARAVAN ]', color: 'text-[var(--ui-success)]' },
                  { id: 'DIPLOMATIC_ENVOY', label: '[ 3: ENVOY ]', color: 'text-[var(--ui-violet)]' },
                  { id: 'MINOR_OMEN', label: '[ 4: DEEP OMEN ]', color: 'text-[var(--ui-info)]' },
                  { id: 'MAJOR_CRISIS', label: '[ 5: SIEGE ]', color: 'text-[var(--ui-danger)]' },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => triggerNarrativeEvent(btn.id, true)}
                  className={`${btn.color} hover:bg-[var(--ui-border)] px-1.5 py-0.5 border border-[var(--ui-border)] transition-colors whitespace-nowrap shrink-0`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Event Card */}
          {activeEvent ? (
            <div className="border border-[var(--ui-accent)] p-3 bg-[var(--ui-panel)] space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
                <div className="min-w-0">
                  <div
                    className="font-bold tracking-wider whitespace-nowrap truncate"
                    style={{ color: SEVERITY_STYLE[activeEvent.severity]?.color || ISOTOPE.base0A }}
                  >
                    [ {SEVERITY_STYLE[activeEvent.severity]?.label || activeEvent.severity} {'//'} YEAR {gameState.year} ({gameState.season.toUpperCase()}) ]
                  </div>
                  <h3 className="text-sm font-bold text-[var(--ui-bright)] mt-0.5">
                    {activeEvent.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => speakNarrative(`${activeEvent.title}. ${activeEvent.narrative}`)}
                  className="text-[var(--ui-info)] hover:bg-[var(--ui-border)] px-1.5 py-0.5 border border-[var(--ui-border)] whitespace-nowrap shrink-0"
                >
                  {isSpeaking ? '[ NARRATING... ]' : '[ SPEAK (TTS) ]'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <pre className="md:col-span-4 p-2 bg-[var(--ui-bg)] border border-[var(--ui-border)] text-[var(--ui-accent)] leading-tight text-center font-bold overflow-x-auto">
                  {activeEvent.asciiArt}
                </pre>
                <div className="md:col-span-8 space-y-1.5 text-xs">
                  <p className="text-[var(--ui-text)] leading-relaxed">{activeEvent.narrative}</p>
                  <div className="text-[11px] text-[var(--ui-accent)]">
                    &gt; HISTORICAL LINK: {activeEvent.historicalConnection}
                  </div>
                  {activeEvent.triggerReason && (
                    <div className="text-[11px] text-[var(--ui-info)]">
                      &gt; TRIGGER CAUSE: {activeEvent.triggerReason}
                    </div>
                  )}
                </div>
              </div>

              {/* Choices */}
              <div className="space-y-1.5 pt-2 border-t border-[var(--ui-border)]">
                <div className="text-[var(--ui-accent)] font-bold">
                  ┌─[ CHOOSE OVERSEER DECREE ]──────────────────────────────
                </div>
                {activeEvent.choices.map((choice, idx) => {
                  const affordable = hasResources(gameState.resources, choice.cost) && gameState.dwarves.length + (choice.spawnMigrants || 0) <= MAX_POPULATION;
                  const costStr = formatResourceMap(choice.cost as Record<string, number>, '-');
                  const rewardStr = formatResourceMap(
                    choice.reward as Record<string, number>,
                    '+'
                  );

                  return (
                    <button
                      key={choice.id}
                      type="button"
                      disabled={!affordable}
                      onClick={() => resolveActiveEvent(choice.id)}
                      className={`w-full text-left p-2 border transition-colors flex flex-col gap-1 ${
                        affordable
                          ? 'border-[var(--ui-border)] bg-[var(--ui-bg)] hover:border-[var(--ui-accent)] hover:bg-[var(--ui-border)] text-[var(--ui-text)]'
                          : 'border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)] opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-[var(--ui-accent)] whitespace-nowrap shrink-0">
                          [ {idx + 1}: {choice.label.toUpperCase()} ]
                        </span>
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] shrink-0">
                          {costStr && <span className="text-[var(--ui-danger)] whitespace-nowrap">{costStr}</span>}
                          {rewardStr && <span className="text-[var(--ui-success)] whitespace-nowrap">{rewardStr}</span>}
                          {choice.moraleDelta ? (
                            <span
                              className={`whitespace-nowrap ${
                                choice.moraleDelta > 0 ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-danger)]'
                              }`}
                            >
                              {choice.moraleDelta > 0 ? `+${choice.moraleDelta}` : choice.moraleDelta} MORALE
                            </span>
                          ) : null}
                          {choice.spawnMigrants ? (
                            <span className="text-[var(--ui-info)] whitespace-nowrap">+{choice.spawnMigrants} MIGRANT</span>
                          ) : null}
                          {choice.stanceChange ? (
                            <span className="text-[var(--ui-violet)] whitespace-nowrap">
                              {choice.stanceChange.race} → {choice.stanceChange.stance.toUpperCase()}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--ui-muted)]">{choice.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 border border-[var(--ui-border)] bg-[var(--ui-panel)] text-center text-[var(--ui-muted)] space-y-1">
              <div className="whitespace-nowrap">[ NO ACTIVE CRISIS AWAITING DECREE ]</div>
              <div className="text-[11px]">
                Events emerge organically every 45 ticks as you delve deeper, or click a summon option above.
              </div>
            </div>
          )}

          {/* Past Decrees Archive */}
          {gameState.eventHistory.length > 0 && (
            <div className="border border-[var(--ui-border)] p-2 bg-[var(--ui-panel)] space-y-1.5">
              <div className="text-[var(--ui-accent)] font-bold whitespace-nowrap truncate">
                ┌─[ ARCHIVE: PAST OVERSEER DECREES ({gameState.eventHistory.length}) ]
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                {gameState.eventHistory.map((ev) => (
                  <div key={ev.id} className="p-1.5 bg-[var(--ui-bg)] border border-[var(--ui-border)] text-[11px]">
                    <div className="flex justify-between text-[var(--ui-bright)] font-bold gap-2">
                      <span className="whitespace-nowrap truncate">[✓] {ev.title}</span>
                      <span className="text-[var(--ui-muted)] whitespace-nowrap shrink-0">TICK {ev.tickTriggered}</span>
                    </div>
                    <div className="text-[var(--ui-accent)] whitespace-nowrap truncate">DECREE: {ev.chosenLabel}</div>
                    <div className="text-[var(--ui-muted)]">{ev.outcomeSummary}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-3 py-1.5 bg-[var(--ui-panel)] border-t border-[var(--ui-border)] flex items-center justify-between text-[11px] text-[var(--ui-muted)] gap-2">
          <span className="whitespace-nowrap truncate">╚═[ PRESS ESC TO CLOSE // 1-3 TO ISSUE DECREE ]</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--ui-accent)] hover:bg-[var(--ui-border)] px-1 whitespace-nowrap shrink-0"
          >
            [ DISMISS ]
          </button>
        </div>
      </div>
    </div>
  );
}
