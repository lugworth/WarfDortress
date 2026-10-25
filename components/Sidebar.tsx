'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGame } from './GameProvider';
import {
  DwarfLabor,
  LaborPresetId,
  MilitiaDoctrine,
} from '@/lib/types';
import { QUIRKS } from '@/lib/guild';
import { scanWorldStrata } from '@/lib/game-engine';
import ToolPicker from './ToolPicker';

const ALL_LABORS: DwarfLabor[] = [
  'MINING',
  'WOODCUTTING',
  'MASONRY',
  'CARPENTRY',
  'FARMING',
  'SMITHING',
  'COMBAT',
  'HAULING',
];

export default function Sidebar() {
  const {
    gameState,
    currentZ,
    setCurrentZ,
    selectedDwarfId,
    setSelectedDwarfId,
    toggleDwarfLabor,
    applyPreset,
    setMilitiaDoctrine,
    triggerGoblinRaid,
    addWorkOrder,
    toggleWorkOrderAutoRepeat,
    removeWorkOrder,
    jumpToLocation,
  } = useGame();

  const [activeTab, setActiveTab] = useState<'DESIGNATE' | 'DWARVES' | 'STOCKS' | 'RADAR'>(
    'DESIGNATE'
  );

  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const strataSummaries = useMemo(() => scanWorldStrata(gameState), [gameState]);

  // Draw Mini-Map Radar when RADAR tab is active
  useEffect(() => {
    if (activeTab !== 'RADAR') return;
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = gameState.world.width;
    const h = gameState.world.height;
    const scale = 4;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w * scale, h * scale);

    const levelGrid = gameState.grid[currentZ];
    if (!levelGrid) return;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = levelGrid[y]?.[x];
        if (!tile || !tile.revealed) {
          ctx.fillStyle = '#070707';
          ctx.fillRect(x * scale, y * scale, scale, scale);
          continue;
        }
        if (tile.terrain === 'CAVERN_RELIC') {
          ctx.fillStyle = '#00ffff';
        } else if (tile.terrain === 'GOLD_VEIN' || tile.terrain === 'MITHRIL_VEIN') {
          ctx.fillStyle = '#ff0099';
        } else if (tile.terrain === 'IRON_VEIN' || tile.terrain === 'COPPER_VEIN') {
          ctx.fillStyle = '#ff9900';
        } else if (tile.terrain === 'WATER') {
          ctx.fillStyle = '#0066ff';
        } else if (tile.terrain === 'MAGMA') {
          ctx.fillStyle = '#ff0000';
        } else if (tile.terrain.endsWith('_WALL')) {
          ctx.fillStyle = '#252525';
        } else if (
          tile.terrain.startsWith('WORKSHOP_') ||
          tile.terrain === 'TAVERN_HALL' ||
          tile.terrain === 'TEMPLE_ALTAR' ||
          tile.terrain === 'TRADE_DEPOT'
        ) {
          ctx.fillStyle = '#cc00ff';
        } else {
          ctx.fillStyle = '#141414';
        }
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    // Draw Dwarves on current Z
    for (const d of gameState.dwarves) {
      if (d.z === currentZ) {
        ctx.fillStyle = '#33ff00';
        ctx.fillRect(d.x * scale, d.y * scale, scale + 1, scale + 1);
      }
    }

    // Draw Hostiles on current Z
    for (const host of gameState.hostiles) {
      if (host.z === currentZ) {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(host.x * scale, host.y * scale, scale + 1, scale + 1);
      }
    }
  }, [activeTab, gameState, currentZ]);

  const handleRadarClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = gameState.world.width / rect.width;
    const scaleY = gameState.world.height / rect.height;
    const gx = Math.max(
      0,
      Math.min(gameState.world.width - 1, Math.floor((e.clientX - rect.left) * scaleX))
    );
    const gy = Math.max(
      0,
      Math.min(gameState.world.height - 1, Math.floor((e.clientY - rect.top) * scaleY))
    );
    jumpToLocation(gx, gy, currentZ);
  };

  return (
    <aside className="w-full h-full bg-[var(--ui-panel)] flex flex-col font-mono text-xs select-none overflow-hidden text-[var(--ui-text)]">
      {/* Top 4-Tab Selector */}
      <div className="sidebar-tabs border-b border-[var(--ui-border)] bg-[var(--ui-bg)] shrink-0">
        {(
          [
            { id: 'DESIGNATE', label: 'Tools' },
            { id: 'DWARVES', label: 'Clan' },
            { id: 'STOCKS', label: 'Stocks' },
            { id: 'RADAR', label: 'Radar' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={`py-2 px-0.5 text-center transition-colors border-r border-[var(--ui-border)] last:border-r-0 whitespace-nowrap flex items-center justify-center shrink-0 text-[11px] ${
              activeTab === tab.id
                ? 'bg-[var(--ui-panel)] text-[var(--ui-accent)] font-bold border-b-2 border-b-[var(--ui-accent)]'
                : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {activeTab === 'DESIGNATE' && <ToolPicker />}

        {activeTab === 'DWARVES' && (
          <div className="space-y-2.5">
            {/* Militia Command & Doctrine Box */}
            <div className="p-2 bg-[var(--ui-bg)] border border-[var(--ui-danger)]/60 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--ui-danger)] font-bold">⚔ MILITIA DOCTRINE</span>
                <span className="text-[var(--ui-muted)] tabular-nums">
                  HOSTILES: <strong className="text-[var(--ui-danger)]">{gameState.hostiles.length}</strong>
                </span>
              </div>
              <div className="button-grid">
                {(
                  [
                    { id: 'DEFENSIVE', label: 'Defend' },
                    { id: 'PATROL', label: 'Patrol' },
                    { id: 'SALLY_FORTH', label: 'Sally' },
                  ] as { id: MilitiaDoctrine; label: string }[]
                ).map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setMilitiaDoctrine(doc.id)}
                    className={`py-1 px-1 text-[10px] border text-center whitespace-nowrap shrink-0 transition-colors ${
                      gameState.militiaDoctrine === doc.id
                        ? 'border-[var(--ui-danger)] bg-[var(--ui-border)] text-[var(--ui-danger)] font-bold'
                        : 'border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-bright)]'
                    }`}
                  >
                    {doc.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={triggerGoblinRaid}
                className="w-full py-1 px-2 border border-[var(--ui-warning)] text-[var(--ui-warning)] hover:bg-[var(--ui-border)] hover:text-[var(--ui-bright)] text-[10px] font-bold text-center whitespace-nowrap shrink-0"
              >
                Sound war horn
              </button>
            </div>

            {/* Clan-Wide Labor Presets */}
            <div className="p-2 bg-[var(--ui-bg)] border border-[var(--ui-border)] space-y-1.5">
              <div className="text-[11px] text-[var(--ui-info)] font-bold">
                CLAN-WIDE LABOR PRESETS (ONE-CLICK)
              </div>
              <div className="button-grid">
                {(
                  [
                    { id: 'ALL_HANDS', label: 'All hands', color: 'text-[var(--ui-success)]' },
                    { id: 'MINING_DELVE', label: 'Miners', color: 'text-[var(--ui-warning)]' },
                    { id: 'SMITH_FORTIFY', label: 'Smiths', color: 'text-[var(--ui-info)]' },
                    { id: 'HARVEST_BREW', label: 'Farmers', color: 'text-[var(--ui-violet)]' },
                  ] as { id: LaborPresetId; label: string; color: string }[]
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className={`py-1 px-1.5 border border-[var(--ui-border)] bg-[var(--ui-panel)] hover:bg-[var(--ui-border)] text-[10px] font-bold whitespace-nowrap shrink-0 ${preset.color}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Individual Dwarf Roster */}
            {gameState.dwarves.map((dwarf) => {
              const isSelected = selectedDwarfId === dwarf.id;
              return (
                <div
                  key={dwarf.id}
                  onClick={() => setSelectedDwarfId(dwarf.id)}
                  className={`p-2 border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--ui-border)] border-[var(--ui-accent)]'
                      : 'bg-[var(--ui-bg)] border-[var(--ui-border)] hover:border-[var(--ui-muted)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="font-bold text-[var(--ui-bright)] flex items-center gap-1.5 min-w-0">
                      <span style={{ color: dwarf.color }}>{dwarf.char}</span>
                      <span className="truncate">{dwarf.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          jumpToLocation(dwarf.x, dwarf.y, dwarf.z);
                        }}
                        className="text-[10px] text-[var(--ui-info)] hover:text-[var(--ui-bright)] px-1 border border-[var(--ui-border)] whitespace-nowrap shrink-0"
                      >
                        [Z-{dwarf.z}]
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-[var(--ui-info)] mt-0.5 flex items-center justify-between gap-1">
                    <span className="truncate">
                      {dwarf.title} {'//'} <span className="text-[var(--ui-success)]">{dwarf.state}</span>
                    </span>
                    <span className="text-[10px] tabular-nums flex items-center gap-1 shrink-0">
                      {dwarf.weaponEquipped && (
                        <span className="text-[var(--ui-warning)] whitespace-nowrap shrink-0" title="Runed Battle Axe Equipped">
                          [⚔AXE]
                        </span>
                      )}
                      {dwarf.armorEquipped && (
                        <span className="text-[var(--ui-info)] whitespace-nowrap shrink-0" title="Steel Plate Mail Equipped">
                          [🛡MAIL]
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Vital Needs & HP Readout */}
                  <div className="clan-stats mt-2 text-[10px] tabular-nums bg-[var(--ui-panel)] p-1.5 border border-[var(--ui-border)]">
                    <div>
                      <span className="text-[var(--ui-muted)]">HP:</span>{' '}
                      <span className={dwarf.hp < 50 ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-success)]'}>
                        {dwarf.hp}/{dwarf.maxHp}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--ui-muted)]">ALE:</span>{' '}
                      <span className={dwarf.thirst < 30 ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-violet)]'}>
                        {Math.round(dwarf.thirst)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--ui-muted)]">MIRTH:</span>{' '}
                      <span className="text-[var(--ui-accent)]">{Math.round(dwarf.happiness)}%</span>
                    </div>
                  </div>

                  {dwarf.quirk && <p className="mt-1 text-xs text-[var(--ui-accent)]" title={QUIRKS[dwarf.quirk].description}>{QUIRKS[dwarf.quirk].name}</p>}
                  {/* Recent Thought */}
                  {dwarf.thought && (
                    <div className="text-[10px] text-[var(--ui-muted)] italic mt-1.5 truncate">
                      &ldquo;{dwarf.thought}&rdquo;
                    </div>
                  )}

                  {/* Labor Toggles (8 Labors) */}
                  <div className="mt-2 pt-1.5 border-t border-[var(--ui-border)]">
                    <div className="text-[10px] text-[var(--ui-muted)] mb-1">ASSIGNED LABORS:</div>
                    <div className="flex flex-wrap gap-1">
                      {ALL_LABORS.map((labor) => {
                        const active = dwarf.labors[labor];
                        return (
                          <button
                            key={labor}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDwarfLabor(dwarf.id, labor);
                            }}
                            className={`px-1 py-0.5 text-[10px] border transition-colors whitespace-nowrap shrink-0 ${
                              active
                                ? 'border-[var(--ui-success)] text-[var(--ui-success)] bg-[var(--ui-panel)]'
                                : 'border-[var(--ui-border)] text-[var(--ui-muted)]'
                            }`}
                          >
                            [{active ? 'X' : ' '} {labor.slice(0, 5)}]
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'STOCKS' && (
          <div className="space-y-3">
            {/* Full Stockpile & Armory Inventory */}
            <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] p-2.5">
              <div className="text-[var(--ui-accent)] font-bold border-b border-[var(--ui-border)] pb-1 mb-2 flex items-center justify-between">
                <span>FORTRESS VAULT &amp; ARMORY</span>
                <span className="text-[var(--ui-info)] tabular-nums">{gameState.resources.wealth} WLTH</span>
              </div>
              <div className="space-y-1 tabular-nums text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">SMELTED STEEL BARS:</span>
                  <span className="text-[var(--ui-info)] font-bold">{gameState.resources.steelBars}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">RUNED WEAPONS (⚔):</span>
                  <span className="text-[var(--ui-warning)] font-bold">{gameState.resources.weapons}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">STEEL PLATE ARMOR (🛡):</span>
                  <span className="text-[var(--ui-success)] font-bold">{gameState.resources.armor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">RECLAIMED RELICS (☼):</span>
                  <span className="text-[var(--ui-accent)] font-bold">{gameState.resources.relics}</span>
                </div>
                <div className="border-t border-[var(--ui-border)] my-1 pt-1 flex justify-between">
                  <span className="text-[var(--ui-muted)]">ROUGH STONE:</span>
                  <span className="text-[var(--ui-bright)] font-bold">{gameState.resources.stone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">TIMBER LOGS:</span>
                  <span className="text-[var(--ui-warning)] font-bold">{gameState.resources.wood}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">IRON ORE:</span>
                  <span className="text-[var(--ui-warning)] font-bold">{gameState.resources.ironOre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">GOLD ORE:</span>
                  <span className="text-[var(--ui-accent)] font-bold">{gameState.resources.goldOre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">PLUMP HELMET FOOD:</span>
                  <span className="text-[var(--ui-success)] font-bold">{gameState.resources.food}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">DWARVEN ALE:</span>
                  <span className="text-[var(--ui-violet)] font-bold">{gameState.resources.ale}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ui-muted)]">CRAFTED FURNITURE:</span>
                  <span className="text-[var(--ui-info)] font-bold">{gameState.resources.furniture}</span>
                </div>
              </div>
            </div>

            {/* Active Workshop Work Orders with AUTO-REPEAT Toggles */}
            <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] p-2.5">
              <div className="text-[var(--ui-info)] font-bold border-b border-[var(--ui-border)] pb-1 mb-2">
                WORKSHOP PRODUCTION QUEUE
              </div>
              <div className="space-y-1.5 mb-3">
                {gameState.workOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-1 bg-[var(--ui-panel)] p-1.5 border border-[var(--ui-border)]"
                  >
                    <div className="min-w-0">
                      <div className="text-[var(--ui-bright)] truncate text-[11px]">{order.title}</div>
                      <div className="text-[10px] text-[var(--ui-muted)] tabular-nums">
                        Left: <strong className="text-[var(--ui-accent)]">{order.remaining}x</strong> ·{' '}
                        {order.workshop.replace('WORKSHOP_', '')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleWorkOrderAutoRepeat(order.id)}
                        className={`px-1 py-0.5 text-[10px] border whitespace-nowrap shrink-0 ${
                          order.autoRepeat
                            ? 'border-[var(--ui-success)] text-[var(--ui-success)] bg-[var(--ui-bg)] font-bold'
                            : 'border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-bright)]'
                        }`}
                      >
                        [{order.autoRepeat ? 'AUTO:ON' : 'AUTO:OFF'}]
                      </button>
                      <button
                        type="button"
                        onClick={() => removeWorkOrder(order.id)}
                        className="px-1 py-0.5 text-[10px] border border-[var(--ui-border)] text-[var(--ui-danger)] hover:bg-[var(--ui-border)] whitespace-nowrap shrink-0"
                      >
                        [X]
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-[var(--ui-muted)] mb-1.5">QUEUE NEW WORKSHOP ORDERS:</div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() =>
                    addWorkOrder({
                      title: 'Smelt Steel Bars',
                      workshop: 'WORKSHOP_SMELTER',
                      cost: { ironOre: 2, wood: 1 },
                      produce: { steelBars: 2, wealth: 35 },
                      remaining: 3,
                      autoRepeat: true,
                    })
                  }
                  className="w-full py-1 px-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-warning)] hover:bg-[var(--ui-border)] text-left whitespace-nowrap shrink-0"
                >
                  Smelt steel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addWorkOrder({
                      title: 'Forge Runed Battle Axes',
                      workshop: 'WORKSHOP_FORGE',
                      cost: { steelBars: 1 },
                      produce: { weapons: 1, wealth: 55 },
                      remaining: 2,
                      autoRepeat: true,
                    })
                  }
                  className="w-full py-1 px-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-info)] hover:bg-[var(--ui-border)] text-left whitespace-nowrap shrink-0"
                >
                  Forge axes
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addWorkOrder({
                      title: 'Forge Steel Plate Mail',
                      workshop: 'WORKSHOP_FORGE',
                      cost: { steelBars: 1 },
                      produce: { armor: 1, wealth: 60 },
                      remaining: 2,
                      autoRepeat: false,
                    })
                  }
                  className="w-full py-1 px-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-success)] hover:bg-[var(--ui-border)] text-left whitespace-nowrap shrink-0"
                >
                  Forge armor
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addWorkOrder({
                      title: 'Brew Plump Helmet Ale',
                      workshop: 'WORKSHOP_STILL',
                      cost: { food: 2 },
                      produce: { ale: 5, wealth: 15 },
                      remaining: 3,
                      autoRepeat: true,
                    })
                  }
                  className="w-full py-1 px-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-violet)] hover:bg-[var(--ui-border)] text-left whitespace-nowrap shrink-0"
                >
                  Brew ale
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addWorkOrder({
                      title: 'Carve Stone Thrones',
                      workshop: 'WORKSHOP_MASON',
                      cost: { stone: 3 },
                      produce: { furniture: 1, wealth: 25 },
                      remaining: 3,
                      autoRepeat: false,
                    })
                  }
                  className="w-full py-1 px-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-text)] hover:bg-[var(--ui-border)] text-left whitespace-nowrap shrink-0"
                >
                  Carve furniture
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'RADAR' && (
          <div className="space-y-3">
            {/* Live Spatial Mini-Map Radar */}
            <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] p-2">
              <div className="flex items-center justify-between text-[11px] border-b border-[var(--ui-border)] pb-1 mb-2">
                <span className="text-[var(--ui-success)] font-bold">SPATIAL RADAR {'//'} Z-{currentZ}</span>
                <span className="text-[var(--ui-muted)] text-[10px]">CLICK TO PING</span>
              </div>
              <div className="flex justify-center bg-[#050505] p-1 border border-[var(--ui-border)]">
                <canvas
                  ref={radarCanvasRef}
                  width={gameState.world.width * 4}
                  height={gameState.world.height * 4}
                  onClick={handleRadarClick}
                  className="w-full h-auto cursor-pointer border border-[var(--ui-border)]"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1 mt-1.5 text-[10px] text-[var(--ui-muted)]">
                <span className="text-[var(--ui-success)]">■ Dwarf</span>
                <span className="text-[var(--ui-danger)]">■ Hostile</span>
                <span className="text-[var(--ui-info)]">■ Relic</span>
                <span className="text-[var(--ui-warning)]">■ Ore Vein</span>
              </div>
            </div>

            {/* 6-Strata Mineral, Relic & Threat Scanner */}
            <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] p-2">
              <div className="text-[var(--ui-info)] font-bold border-b border-[var(--ui-border)] pb-1 mb-2">
                DEEP STRATA ORE &amp; RELIC SCANNER
              </div>
              <div className="space-y-1.5">
                {strataSummaries.map((row) => {
                  const isCurrent = row.zLevel === currentZ;
                  return (
                    <div
                      key={row.zLevel}
                      onClick={() => setCurrentZ(row.zLevel)}
                      className={`p-1.5 border cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-[var(--ui-border)] border-[var(--ui-info)]'
                          : 'bg-[var(--ui-panel)] border-[var(--ui-border)] hover:border-[var(--ui-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-bold text-[var(--ui-bright)] truncate">
                          [Z-{row.zLevel}] {row.name}
                        </span>
                        {row.hostiles > 0 && (
                          <span className="text-[var(--ui-danger)] font-bold text-[10px] whitespace-nowrap shrink-0">
                            [! {row.hostiles} HOSTILE]
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1 mt-1 text-[10px] tabular-nums text-[var(--ui-muted)]">
                        <div>
                          IRN:<span className="text-[var(--ui-warning)] font-bold ml-0.5">{row.ironTiles}</span>
                        </div>
                        <div>
                          GLD:<span className="text-[var(--ui-accent)] font-bold ml-0.5">{row.goldTiles}</span>
                        </div>
                        <div>
                          MTH:<span className="text-[var(--ui-info)] font-bold ml-0.5">{row.mithrilTiles}</span>
                        </div>
                        <div>
                          RLC:<span className="text-[var(--ui-success)] font-bold ml-0.5">{row.relicTiles}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
