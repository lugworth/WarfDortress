'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGame } from './GameProvider';
import {
  DesignationType,
  DwarfLabor,
  LaborPresetId,
  MilitiaDoctrine,
} from '@/lib/types';
import { scanWorldStrata } from '@/lib/game-engine';

const DESIGNATION_TOOLS: {
  id: DesignationType;
  label: string;
  keyHint: string;
  cost: string;
  color: string;
  desc: string;
}[] = [
  {
    id: 'MINE',
    label: 'MINE ROCK / ORE',
    keyHint: 'D',
    cost: 'Free',
    color: 'text-[#ff9900]',
    desc: 'Excavate rock, ores & cavern relics (☼)',
  },
  {
    id: 'STAIRS',
    label: 'CARVE STAIRS',
    keyHint: 'X',
    cost: '2 Stone',
    color: 'text-[#ff0099]',
    desc: 'Link current Z-level with Z+1 cavern',
  },
  {
    id: 'RECLAIM_RELIC',
    label: 'RECLAIM RELIC (☼)',
    keyHint: 'V',
    cost: 'Free',
    color: 'text-[#00ffff]',
    desc: 'Recover ancient subterranean artifact',
  },
  {
    id: 'CHOP',
    label: 'FELL TIMBER',
    keyHint: 'T',
    cost: 'Free',
    color: 'text-[#33ff00]',
    desc: 'Chop surface trees for logs (+6 Wood)',
  },
  {
    id: 'GATHER',
    label: 'GATHER SHRUBS',
    keyHint: 'G',
    cost: 'Free',
    color: 'text-[#33ff00]',
    desc: 'Forage surface plants (+5 Food, +1 Ale)',
  },
  {
    id: 'BUILD_SMELTER',
    label: 'BUILD SMELTERY (£)',
    keyHint: 'E',
    cost: '8 Stone',
    color: 'text-[#ff9900]',
    desc: 'Smelt Iron & Gold Ore into Steel Bars',
  },
  {
    id: 'BUILD_FORGE',
    label: 'BUILD FORGE (⚒)',
    keyHint: 'R',
    cost: '6 Stn, 2 Steel',
    color: 'text-[#00ffff]',
    desc: 'Forge Runed Weapons & Steel Armor',
  },
  {
    id: 'BUILD_TAVERN',
    label: 'BUILD TAVERN (♫)',
    keyHint: 'H',
    cost: '6 Wood, 4 Stn',
    color: 'text-[#cc00ff]',
    desc: 'Hearth hall for feasts & morale buffs',
  },
  {
    id: 'BUILD_TEMPLE',
    label: 'BUILD TEMPLE (Ψ)',
    keyHint: 'Y',
    cost: '8 Stn, 1 Gold',
    color: 'text-[#ff0099]',
    desc: 'Sanctuary granting meditative serenity',
  },
  {
    id: 'BUILD_DEPOT',
    label: 'TRADE DEPOT (¤)',
    keyHint: 'O',
    cost: '8 Wood, 8 Stn',
    color: 'text-[#00ffff]',
    desc: 'Caravan plaza (+15% export trade value)',
  },
  {
    id: 'BUILD_TRAP',
    label: 'STONE TRAP (^)',
    keyHint: 'Z',
    cost: '3 Stone',
    color: 'text-[#ff0000]',
    desc: 'Deadfall trap (65 dmg to Raiders)',
  },
  {
    id: 'BUILD_WALL',
    label: 'STONE WALL',
    keyHint: 'W',
    cost: '4 Stone',
    color: 'text-[#ffffff]',
    desc: 'Fortified masonry wall blocking raiders',
  },
  {
    id: 'BUILD_DOOR',
    label: 'STONE DOOR (+)',
    keyHint: 'K',
    cost: '2 Stone',
    color: 'text-[#d0d0d0]',
    desc: 'Install secure gateway portal',
  },
  {
    id: 'STOCKPILE',
    label: 'STOCKPILE ZONE',
    keyHint: 'P',
    cost: 'Free',
    color: 'text-[#0066ff]',
    desc: 'Central storage for fortress wares',
  },
  {
    id: 'BUILD_FARM',
    label: 'PLUMP HELMET FARM',
    keyHint: 'M',
    cost: '2 Wood',
    color: 'text-[#33ff00]',
    desc: 'Subterranean mushrooms for food & ale',
  },
  {
    id: 'BUILD_STILL',
    label: 'BREWERY STILL',
    keyHint: 'S',
    cost: '4 Wood, 2 Stn',
    color: 'text-[#cc00ff]',
    desc: 'Distill Plump Helmets into Dwarven Ale',
  },
  {
    id: 'BUILD_MASON',
    label: 'MASON WORKSHOP',
    keyHint: 'N',
    cost: '6 Stone',
    color: 'text-[#00ffff]',
    desc: 'Carve stone thrones, statues & coffers',
  },
  {
    id: 'BUILD_CARPENTER',
    label: 'CARPENTER SHOP',
    keyHint: 'C',
    cost: '6 Wood',
    color: 'text-[#ff9900]',
    desc: 'Craft wooden beds, barrels & shields',
  },
  {
    id: 'BUILD_BED',
    label: 'DWARVEN BED',
    keyHint: 'B',
    cost: '3 Wood',
    color: 'text-[#33ff00]',
    desc: 'Quarters for fast fatigue recovery',
  },
  {
    id: 'CANCEL',
    label: 'CLEAR ORDERS',
    keyHint: 'Q',
    cost: 'Free',
    color: 'text-[#ff0000]',
    desc: 'Remove pending designations in box',
  },
];

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
    selectedTool,
    setSelectedTool,
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
    <aside className="w-full h-full bg-[#101010] flex flex-col font-mono text-xs select-none overflow-hidden text-[#d0d0d0]">
      {/* Top 4-Tab Selector */}
      <div className="grid grid-cols-4 border-b border-[#202020] bg-[#000000] shrink-0">
        {(
          [
            { id: 'DESIGNATE', label: '[BUILD]' },
            { id: 'DWARVES', label: `[CLAN:${gameState.dwarves.length}]` },
            { id: 'STOCKS', label: '[STOCKS]' },
            { id: 'RADAR', label: '[RADAR]' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`py-2 px-0.5 text-center transition-colors border-r border-[#202020] last:border-r-0 whitespace-nowrap flex items-center justify-center shrink-0 text-[11px] ${
              activeTab === tab.id
                ? 'bg-[#101010] text-[#ff0099] font-bold border-b-2 border-b-[#ff0099]'
                : 'text-[#808080] hover:text-[#d0d0d0]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {activeTab === 'DESIGNATE' && (
          <div className="space-y-1.5">
            <div className="text-[11px] text-[#808080] pb-1 border-b border-[#202020] flex items-center justify-between">
              <span>SELECT TOOL &amp; DRAG ON MAP</span>
              <span className="text-[#00ffff]">Z-{currentZ}</span>
            </div>

            {DESIGNATION_TOOLS.map((tool) => {
              const isSelected = selectedTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setSelectedTool(tool.id)}
                  className={`w-full text-left p-2 border transition-colors ${
                    isSelected
                      ? 'bg-[#202020] border-[#ff0099]'
                      : 'bg-[#000000] border-[#202020] hover:border-[#808080]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`font-bold whitespace-nowrap shrink-0 ${tool.color}`}>
                      [{tool.keyHint}: {tool.label}]
                    </span>
                    <span className="text-[10px] text-[#808080] tabular-nums whitespace-nowrap shrink-0">
                      {tool.cost}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#808080] mt-0.5 leading-snug">{tool.desc}</div>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'DWARVES' && (
          <div className="space-y-2.5">
            {/* Militia Command & Doctrine Box */}
            <div className="p-2 bg-[#000000] border border-[#ff0000]/60 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#ff0000] font-bold">⚔ MILITIA DOCTRINE</span>
                <span className="text-[#808080] tabular-nums">
                  HOSTILES: <strong className="text-[#ff0000]">{gameState.hostiles.length}</strong>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'DEFENSIVE', label: '[DEFEND]' },
                    { id: 'PATROL', label: '[PATROL]' },
                    { id: 'SALLY_FORTH', label: '[SALLY]' },
                  ] as { id: MilitiaDoctrine; label: string }[]
                ).map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setMilitiaDoctrine(doc.id)}
                    className={`py-1 px-1 text-[10px] border text-center whitespace-nowrap shrink-0 transition-colors ${
                      gameState.militiaDoctrine === doc.id
                        ? 'border-[#ff0000] bg-[#202020] text-[#ff0000] font-bold'
                        : 'border-[#202020] text-[#808080] hover:text-[#ffffff]'
                    }`}
                  >
                    {doc.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={triggerGoblinRaid}
                className="w-full py-1 px-2 border border-[#ff9900] text-[#ff9900] hover:bg-[#202020] hover:text-[#ffffff] text-[10px] font-bold text-center whitespace-nowrap shrink-0"
              >
                [ ! SOUND WAR HORN (TEST GOBLIN RAID) ]
              </button>
            </div>

            {/* Clan-Wide Labor Presets */}
            <div className="p-2 bg-[#000000] border border-[#202020] space-y-1.5">
              <div className="text-[11px] text-[#00ffff] font-bold">
                CLAN-WIDE LABOR PRESETS (ONE-CLICK)
              </div>
              <div className="grid grid-cols-2 gap-1">
                {(
                  [
                    { id: 'ALL_HANDS', label: '[ ALL-HANDS ]', color: 'text-[#33ff00]' },
                    { id: 'MINING_DELVE', label: '[ DEEP MINERS ]', color: 'text-[#ff9900]' },
                    { id: 'SMITH_FORTIFY', label: '[ SMITH & ARMS ]', color: 'text-[#00ffff]' },
                    { id: 'HARVEST_BREW', label: '[ FARM & BREW ]', color: 'text-[#cc00ff]' },
                  ] as { id: LaborPresetId; label: string; color: string }[]
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className={`py-1 px-1.5 border border-[#202020] bg-[#101010] hover:bg-[#202020] text-[10px] font-bold whitespace-nowrap shrink-0 ${preset.color}`}
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
                      ? 'bg-[#202020] border-[#ff0099]'
                      : 'bg-[#000000] border-[#202020] hover:border-[#808080]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="font-bold text-[#ffffff] flex items-center gap-1.5 min-w-0">
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
                        className="text-[10px] text-[#00ffff] hover:text-[#ffffff] px-1 border border-[#202020] whitespace-nowrap shrink-0"
                      >
                        [Z-{dwarf.z}]
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#00ffff] mt-0.5 flex items-center justify-between gap-1">
                    <span className="truncate">
                      {dwarf.title} {'//'} <span className="text-[#33ff00]">{dwarf.state}</span>
                    </span>
                    <span className="text-[10px] tabular-nums flex items-center gap-1 shrink-0">
                      {dwarf.weaponEquipped && (
                        <span className="text-[#ff9900] whitespace-nowrap shrink-0" title="Runed Battle Axe Equipped">
                          [⚔AXE]
                        </span>
                      )}
                      {dwarf.armorEquipped && (
                        <span className="text-[#00ffff] whitespace-nowrap shrink-0" title="Steel Plate Mail Equipped">
                          [🛡MAIL]
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Vital Needs & HP Readout */}
                  <div className="grid grid-cols-3 gap-1 mt-2 text-[10px] tabular-nums bg-[#101010] p-1.5 border border-[#202020]">
                    <div>
                      <span className="text-[#808080]">HP:</span>{' '}
                      <span className={dwarf.hp < 50 ? 'text-[#ff0000]' : 'text-[#33ff00]'}>
                        {dwarf.hp}/{dwarf.maxHp}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#808080]">ALE:</span>{' '}
                      <span className={dwarf.thirst < 30 ? 'text-[#ff0000]' : 'text-[#cc00ff]'}>
                        {Math.round(dwarf.thirst)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[#808080]">MIRTH:</span>{' '}
                      <span className="text-[#ff0099]">{Math.round(dwarf.happiness)}%</span>
                    </div>
                  </div>

                  {/* Recent Thought */}
                  {dwarf.thought && (
                    <div className="text-[10px] text-[#808080] italic mt-1.5 truncate">
                      &ldquo;{dwarf.thought}&rdquo;
                    </div>
                  )}

                  {/* Labor Toggles (8 Labors) */}
                  <div className="mt-2 pt-1.5 border-t border-[#202020]">
                    <div className="text-[10px] text-[#808080] mb-1">ASSIGNED LABORS:</div>
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
                                ? 'border-[#33ff00] text-[#33ff00] bg-[#101010]'
                                : 'border-[#202020] text-[#808080]'
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
            <div className="bg-[#000000] border border-[#202020] p-2.5">
              <div className="text-[#ff0099] font-bold border-b border-[#202020] pb-1 mb-2 flex items-center justify-between">
                <span>FORTRESS VAULT &amp; ARMORY</span>
                <span className="text-[#00ffff] tabular-nums">{gameState.resources.wealth} WLTH</span>
              </div>
              <div className="space-y-1 tabular-nums text-xs">
                <div className="flex justify-between">
                  <span className="text-[#808080]">SMELTED STEEL BARS:</span>
                  <span className="text-[#00ffff] font-bold">{gameState.resources.steelBars}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">RUNED WEAPONS (⚔):</span>
                  <span className="text-[#ff9900] font-bold">{gameState.resources.weapons}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">STEEL PLATE ARMOR (🛡):</span>
                  <span className="text-[#33ff00] font-bold">{gameState.resources.armor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">RECLAIMED RELICS (☼):</span>
                  <span className="text-[#ff0099] font-bold">{gameState.resources.relics}</span>
                </div>
                <div className="border-t border-[#202020] my-1 pt-1 flex justify-between">
                  <span className="text-[#808080]">ROUGH STONE:</span>
                  <span className="text-[#ffffff] font-bold">{gameState.resources.stone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">TIMBER LOGS:</span>
                  <span className="text-[#ff9900] font-bold">{gameState.resources.wood}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">IRON ORE:</span>
                  <span className="text-[#ff9900] font-bold">{gameState.resources.ironOre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">GOLD ORE:</span>
                  <span className="text-[#ff0099] font-bold">{gameState.resources.goldOre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">PLUMP HELMET FOOD:</span>
                  <span className="text-[#33ff00] font-bold">{gameState.resources.food}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">DWARVEN ALE:</span>
                  <span className="text-[#cc00ff] font-bold">{gameState.resources.ale}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#808080]">CRAFTED FURNITURE:</span>
                  <span className="text-[#00ffff] font-bold">{gameState.resources.furniture}</span>
                </div>
              </div>
            </div>

            {/* Active Workshop Work Orders with AUTO-REPEAT Toggles */}
            <div className="bg-[#000000] border border-[#202020] p-2.5">
              <div className="text-[#00ffff] font-bold border-b border-[#202020] pb-1 mb-2">
                WORKSHOP PRODUCTION QUEUE
              </div>
              <div className="space-y-1.5 mb-3">
                {gameState.workOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-1 bg-[#101010] p-1.5 border border-[#202020]"
                  >
                    <div className="min-w-0">
                      <div className="text-[#ffffff] truncate text-[11px]">{order.title}</div>
                      <div className="text-[10px] text-[#808080] tabular-nums">
                        Left: <strong className="text-[#ff0099]">{order.remaining}x</strong> ·{' '}
                        {order.workshop.replace('WORKSHOP_', '')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleWorkOrderAutoRepeat(order.id)}
                        className={`px-1 py-0.5 text-[10px] border whitespace-nowrap shrink-0 ${
                          order.autoRepeat
                            ? 'border-[#33ff00] text-[#33ff00] bg-[#000000] font-bold'
                            : 'border-[#202020] text-[#808080] hover:text-[#ffffff]'
                        }`}
                      >
                        [{order.autoRepeat ? 'AUTO:ON' : 'AUTO:OFF'}]
                      </button>
                      <button
                        type="button"
                        onClick={() => removeWorkOrder(order.id)}
                        className="px-1 py-0.5 text-[10px] border border-[#202020] text-[#ff0000] hover:bg-[#202020] whitespace-nowrap shrink-0"
                      >
                        [X]
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-[#808080] mb-1.5">QUEUE NEW WORKSHOP ORDERS:</div>
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
                  className="w-full py-1 px-2 border border-[#202020] bg-[#101010] text-[#ff9900] hover:bg-[#202020] text-left whitespace-nowrap shrink-0"
                >
                  [ + SMELT STEEL BARS (x3 · AUTO) ]
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
                  className="w-full py-1 px-2 border border-[#202020] bg-[#101010] text-[#00ffff] hover:bg-[#202020] text-left whitespace-nowrap shrink-0"
                >
                  [ + FORGE RUNED AXES (x2 · AUTO) ]
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
                  className="w-full py-1 px-2 border border-[#202020] bg-[#101010] text-[#33ff00] hover:bg-[#202020] text-left whitespace-nowrap shrink-0"
                >
                  [ + FORGE STEEL ARMOR (x2) ]
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
                  className="w-full py-1 px-2 border border-[#202020] bg-[#101010] text-[#cc00ff] hover:bg-[#202020] text-left whitespace-nowrap shrink-0"
                >
                  [ + BREW CASK ALE (x3 · AUTO) ]
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
                  className="w-full py-1 px-2 border border-[#202020] bg-[#101010] text-[#d0d0d0] hover:bg-[#202020] text-left whitespace-nowrap shrink-0"
                >
                  [ + CARVE STONE FURNITURE (x3) ]
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'RADAR' && (
          <div className="space-y-3">
            {/* Live Spatial Mini-Map Radar */}
            <div className="bg-[#000000] border border-[#202020] p-2">
              <div className="flex items-center justify-between text-[11px] border-b border-[#202020] pb-1 mb-2">
                <span className="text-[#33ff00] font-bold">SPATIAL RADAR {'//'} Z-{currentZ}</span>
                <span className="text-[#808080] text-[10px]">CLICK TO PING</span>
              </div>
              <div className="flex justify-center bg-[#050505] p-1 border border-[#202020]">
                <canvas
                  ref={radarCanvasRef}
                  width={gameState.world.width * 4}
                  height={gameState.world.height * 4}
                  onClick={handleRadarClick}
                  className="w-full h-auto cursor-pointer border border-[#202020]"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1 mt-1.5 text-[10px] text-[#808080]">
                <span className="text-[#33ff00]">■ Dwarf</span>
                <span className="text-[#ff0000]">■ Hostile</span>
                <span className="text-[#00ffff]">■ Relic</span>
                <span className="text-[#ff9900]">■ Ore Vein</span>
              </div>
            </div>

            {/* 6-Strata Mineral, Relic & Threat Scanner */}
            <div className="bg-[#000000] border border-[#202020] p-2">
              <div className="text-[#00ffff] font-bold border-b border-[#202020] pb-1 mb-2">
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
                          ? 'bg-[#202020] border-[#00ffff]'
                          : 'bg-[#101010] border-[#202020] hover:border-[#808080]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-bold text-[#ffffff] truncate">
                          [Z-{row.zLevel}] {row.name}
                        </span>
                        {row.hostiles > 0 && (
                          <span className="text-[#ff0000] font-bold text-[10px] whitespace-nowrap shrink-0">
                            [! {row.hostiles} HOSTILE]
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1 mt-1 text-[10px] tabular-nums text-[#808080]">
                        <div>
                          IRN:<span className="text-[#ff9900] font-bold ml-0.5">{row.ironTiles}</span>
                        </div>
                        <div>
                          GLD:<span className="text-[#ff0099] font-bold ml-0.5">{row.goldTiles}</span>
                        </div>
                        <div>
                          MTH:<span className="text-[#00ffff] font-bold ml-0.5">{row.mithrilTiles}</span>
                        </div>
                        <div>
                          RLC:<span className="text-[#33ff00] font-bold ml-0.5">{row.relicTiles}</span>
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
