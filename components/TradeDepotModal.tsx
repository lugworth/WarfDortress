'use client';

import React, { useState, useMemo } from 'react';
import { useGame } from './GameProvider';
import { FortressResources } from '@/lib/types';
import { hasResources } from '@/lib/game-engine';
import { EXPORT_VALUES, IMPORT_VALUES, MAX_POPULATION, tradeValues } from '@/lib/game-rules';
import { useDialog } from '@/hooks/use-dialog';

interface TradeDepotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EXPORT_ITEMS: {
  key: keyof FortressResources;
  label: string;
  unitValue: number;
  color: string;
}[] = [
  { key: 'stone', label: 'Rough Stone', unitValue: EXPORT_VALUES.stone, color: 'text-[#d0d0d0]' },
  { key: 'furniture', label: 'Masterwork Furniture', unitValue: EXPORT_VALUES.furniture, color: 'text-[#00ffff]' },
  { key: 'steelBars', label: 'Smelted Steel Bars', unitValue: EXPORT_VALUES.steelBars, color: 'text-[#00ffff]' },
  { key: 'weapons', label: 'Runed Battle Axes', unitValue: EXPORT_VALUES.weapons, color: 'text-[#ff9900]' },
  { key: 'armor', label: 'Steel Plate Mail', unitValue: EXPORT_VALUES.armor, color: 'text-[#33ff00]' },
  { key: 'goldOre', label: 'Gold Nuggets', unitValue: EXPORT_VALUES.goldOre, color: 'text-[#ff0099]' },
];

const IMPORT_ITEMS: {
  key: keyof FortressResources;
  label: string;
  unitValue: number;
  color: string;
}[] = [
  { key: 'food', label: 'Plump Helmet Rations', unitValue: IMPORT_VALUES.food, color: 'text-[#33ff00]' },
  { key: 'ale', label: 'Dwarven Cask Ale', unitValue: IMPORT_VALUES.ale, color: 'text-[#cc00ff]' },
  { key: 'wood', label: 'Surface Timber Logs', unitValue: IMPORT_VALUES.wood, color: 'text-[#ff9900]' },
  { key: 'ironOre', label: 'Hematite Iron Ore', unitValue: IMPORT_VALUES.ironOre, color: 'text-[#ff9900]' },
  { key: 'steelBars', label: 'Imported Steel Ingots', unitValue: IMPORT_VALUES.steelBars, color: 'text-[#00ffff]' },
];

export function TradeDepotModal({ isOpen, onClose }: TradeDepotModalProps) {
  const { gameState, performTradeBarter } = useGame();
  const dialogRef = useDialog(isOpen, onClose);
  const [tradeError, setTradeError] = useState('');
  const [giveAmounts, setGiveAmounts] = useState<Partial<Record<keyof FortressResources, number>>>({});
  const [receiveAmounts, setReceiveAmounts] = useState<Partial<Record<keyof FortressResources, number>>>({});
  const [recruitMigrant, setRecruitMigrant] = useState<boolean>(false);

  const hasBuiltDepot = useMemo(() => {
    const surface = gameState.grid[0] || [];
    for (let y = 0; y < surface.length; y++) {
      for (let x = 0; x < (surface[y]?.length || 0); x++) {
        if (surface[y][x].terrain === 'TRADE_DEPOT') return true;
      }
    }
    return false;
  }, [gameState.grid]);

  if (!isOpen) return null;

  const isAutumnCaravan = gameState.season.includes('Autumn') || gameState.season.includes('Summer');
  const { offered: offeredValue, requested: requestedValue } = tradeValues(giveAmounts, receiveAmounts, recruitMigrant, hasBuiltDepot);
  const netBalance = offeredValue - requestedValue;
  const canExecute = offeredValue > 0 && requestedValue > 0 && netBalance >= 0 && hasResources(gameState.resources, giveAmounts) && (!recruitMigrant || gameState.dwarves.length < MAX_POPULATION);

  const adjustGive = (key: keyof FortressResources, delta: number) => {
    const current = giveAmounts[key] || 0;
    const maxAvail = gameState.resources[key] || 0;
    const next = Math.max(0, Math.min(maxAvail, current + delta));
    setGiveAmounts((prev) => ({ ...prev, [key]: next }));
  };

  const adjustReceive = (key: keyof FortressResources, delta: number) => {
    const current = receiveAmounts[key] || 0;
    const next = Math.max(0, Math.min(99, current + delta));
    setReceiveAmounts((prev) => ({ ...prev, [key]: next }));
  };

  const handleReset = () => {
    setGiveAmounts({});
    setReceiveAmounts({});
    setRecruitMigrant(false);
  };

  const handleConfirmTrade = () => {
    if (!canExecute) return;
    if (!performTradeBarter(giveAmounts, receiveAmounts, recruitMigrant)) {
      setTradeError('Stock or trade conditions changed. Adjust your offer and try again.');
      return;
    }
    setTradeError('');
    handleReset();
    onClose();
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Trade exchange" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 font-mono text-xs select-none">
      <div className="w-full max-w-3xl bg-[#000000] border-2 border-[#00ffff] text-[#d0d0d0] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#101010] border-b border-[#202020]">
          <div className="flex items-center gap-2">
            <span className="text-[#00ffff] font-bold">
              ┌─[ ¤ MERCHANT CARAVAN &amp; TRADE DEPOT EXCHANGE ]
            </span>
            <span className="text-[#808080] hidden sm:inline">
              {'//'} {isAutumnCaravan ? 'ACTIVE CARAVAN CHARTER' : 'OUTPOST DISPATCH'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#808080] hover:text-[#ffffff] px-1.5 py-0.5 border border-[#202020] whitespace-nowrap shrink-0"
          >
            [ ESC / CLOSE ]
          </button>
        </div>

        {/* Depot Telemetry Banner */}
        <div className="px-3 py-2 bg-[#080808] border-b border-[#202020] flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#808080]">DEPOT STATUS:</span>
            {hasBuiltDepot ? (
              <span className="text-[#33ff00] font-bold">
                [ ¤ TRADE DEPOT CONSTRUCTED (+15% EXPORT VALUE) ]
              </span>
            ) : (
              <span className="text-[#ff9900]">
                [ NO DEPOT BUILT — CONSTRUCT &apos;TRADE DEPOT&apos; FOR +15% BARTER BONUS ]
              </span>
            )}
          </div>
          <div className="text-[#808080] tabular-nums">
            FORTRESS WEALTH: <span className="text-[#ff0099] font-bold">{gameState.resources.wealth}</span>
          </div>
        </div>

        {/* Two-Column Barter Grid */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Left Column: Fortress Exports (What You Offer) */}
          <div className="border border-[#202020] bg-[#101010] p-2.5 flex flex-col">
            <div className="text-[#ff9900] font-bold border-b border-[#202020] pb-1.5 mb-2 flex items-center justify-between">
              <span>1. FORTRESS EXPORTS (OFFER)</span>
              <span className="text-[10px] text-[#808080]">STOCK // OFFER</span>
            </div>

            <div className="space-y-2 flex-1">
              {EXPORT_ITEMS.map((item) => {
                const stock = gameState.resources[item.key] || 0;
                const offered = giveAmounts[item.key] || 0;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-2 p-1.5 bg-[#000000] border border-[#202020]"
                  >
                    <div className="min-w-0">
                      <div className={`font-bold truncate ${item.color}`}>{item.label}</div>
                      <div className="text-[10px] text-[#808080] tabular-nums">
                        Val: {item.unitValue}g ea · Stock: <span className="text-[#ffffff]">{stock}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 tabular-nums">
                      <button
                        type="button"
                        onClick={() => adjustGive(item.key, -5)}
                        disabled={offered === 0}
                        className="px-1 py-0.5 border border-[#202020] text-[#808080] hover:text-[#ffffff] disabled:opacity-40 whitespace-nowrap shrink-0"
                      >
                        [-5]
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustGive(item.key, -1)}
                        disabled={offered === 0}
                        className="px-1 py-0.5 border border-[#202020] text-[#808080] hover:text-[#ffffff] disabled:opacity-40 whitespace-nowrap shrink-0"
                      >
                        [-]
                      </button>
                      <span className="w-8 text-center font-bold text-[#ff9900]">{offered}</span>
                      <button
                        type="button"
                        onClick={() => adjustGive(item.key, 1)}
                        disabled={offered >= stock}
                        className="px-1 py-0.5 border border-[#202020] text-[#33ff00] hover:bg-[#202020] disabled:opacity-40 whitespace-nowrap shrink-0"
                      >
                        [+]
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustGive(item.key, 5)}
                        disabled={offered >= stock}
                        className="px-1 py-0.5 border border-[#202020] text-[#33ff00] hover:bg-[#202020] disabled:opacity-40 whitespace-nowrap shrink-0"
                      >
                        [+5]
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Caravan Imports (What You Receive) */}
          <div className="border border-[#202020] bg-[#101010] p-2.5 flex flex-col">
            <div className="text-[#33ff00] font-bold border-b border-[#202020] pb-1.5 mb-2 flex items-center justify-between">
              <span>2. CARAVAN IMPORTS (REQUEST)</span>
              <span className="text-[10px] text-[#808080]">COST // QTY</span>
            </div>

            <div className="space-y-2 flex-1">
              {IMPORT_ITEMS.map((item) => {
                const requested = receiveAmounts[item.key] || 0;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-2 p-1.5 bg-[#000000] border border-[#202020]"
                  >
                    <div className="min-w-0">
                      <div className={`font-bold truncate ${item.color}`}>{item.label}</div>
                      <div className="text-[10px] text-[#808080] tabular-nums">
                        Cost: {item.unitValue}g ea · Held:{' '}
                        <span className="text-[#d0d0d0]">{gameState.resources[item.key]}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 tabular-nums">
                      <button
                        type="button"
                        onClick={() => adjustReceive(item.key, -5)}
                        disabled={requested === 0}
                        className="px-1 py-0.5 border border-[#202020] text-[#808080] hover:text-[#ffffff] disabled:opacity-40 whitespace-nowrap shrink-0"
                      >
                        [-5]
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustReceive(item.key, -1)}
                        disabled={requested === 0}
                        className="px-1 py-0.5 border border-[#202020] text-[#808080] hover:text-[#ffffff] disabled:opacity-40 whitespace-nowrap shrink-0"
                      >
                        [-]
                      </button>
                      <span className="w-8 text-center font-bold text-[#33ff00]">{requested}</span>
                      <button
                        type="button"
                        onClick={() => adjustReceive(item.key, 1)}
                        className="px-1 py-0.5 border border-[#202020] text-[#00ffff] hover:bg-[#202020] whitespace-nowrap shrink-0"
                      >
                        [+]
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustReceive(item.key, 5)}
                        className="px-1 py-0.5 border border-[#202020] text-[#00ffff] hover:bg-[#202020] whitespace-nowrap shrink-0"
                      >
                        [+5]
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Recruit Pioneer Option */}
              <div className="p-2 bg-[#000000] border border-[#ff0099]/50 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[#ff0099] font-bold">Hire Caravan Artisan / Mercenary</div>
                  <div className="text-[10px] text-[#808080]">
                    Cost: 90g · Joins fortress immediately (+1 Dwarf)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRecruitMigrant((v) => !v)}
                  className={`px-2 py-1 border transition-colors whitespace-nowrap shrink-0 ${
                    recruitMigrant
                      ? 'border-[#ff0099] bg-[#202020] text-[#ff0099] font-bold'
                      : 'border-[#202020] text-[#808080] hover:text-[#ffffff]'
                  }`}
                >
                  {recruitMigrant ? '[X] RECRUIT (+90g)' : '[ ] RECRUIT (+90g)'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {tradeError && <p role="alert" className="p-2 text-red-400">{tradeError}</p>}
        {/* Footer Summary & Execute Button */}
        <div className="p-3 bg-[#101010] border-t border-[#202020] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 tabular-nums">
            <div>
              <span className="text-[#808080]">OFFERED VALUE: </span>
              <span className="text-[#ff9900] font-bold">{offeredValue}g</span>
            </div>
            <span className="text-[#202020]">|</span>
            <div>
              <span className="text-[#808080]">REQUESTED COST: </span>
              <span className="text-[#00ffff] font-bold">{requestedValue}g</span>
            </div>
            <span className="text-[#202020]">|</span>
            <div>
              <span className="text-[#808080]">MERCHANT BALANCE: </span>
              <span
                className={`font-bold ${
                  netBalance >= 0 ? 'text-[#33ff00]' : 'text-[#ff0000]'
                }`}
              >
                {netBalance >= 0 ? `+${netBalance}g (FAIR)` : `${netBalance}g (INSUFFICIENT OFFER)`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-2 py-1 border border-[#202020] text-[#808080] hover:text-[#ffffff] whitespace-nowrap shrink-0"
            >
              [ CLEAR ]
            </button>
            <button
              type="button"
              disabled={!canExecute}
              onClick={handleConfirmTrade}
              className="px-3 py-1 border border-[#33ff00] bg-[#101010] text-[#33ff00] hover:bg-[#33ff00] hover:text-[#000000] disabled:border-[#202020] disabled:text-[#808080] disabled:bg-transparent font-bold transition-colors whitespace-nowrap shrink-0"
            >
              [ ¤ SIGN BARTER CHARTER ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
