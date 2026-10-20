'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useGame } from './GameProvider';
import { DesignationType, DwarfEntity, HostileEntity } from '@/lib/types';
import { ISOTOPE } from '@/lib/colors';

const CELL_W = 14;
const CELL_H = 18;

const DESIGNATION_BADGE: Record<DesignationType, { char: string; color: string }> = {
  MINE: { char: '⛏', color: ISOTOPE.base09 },
  CHOP: { char: '×', color: ISOTOPE.base0B },
  GATHER: { char: '%', color: ISOTOPE.base0B },
  STAIRS: { char: 'X', color: ISOTOPE.base0A },
  STOCKPILE: { char: '≡', color: ISOTOPE.base0D },
  RECLAIM_RELIC: { char: '☼', color: ISOTOPE.base0C },
  BUILD_WALL: { char: '#', color: ISOTOPE.base07 },
  BUILD_DOOR: { char: '+', color: ISOTOPE.base0A },
  BUILD_TRAP: { char: '^', color: ISOTOPE.base08 },
  BUILD_BED: { char: '⌂', color: ISOTOPE.base09 },
  BUILD_MASON: { char: 'M', color: ISOTOPE.base05 },
  BUILD_CARPENTER: { char: 'C', color: ISOTOPE.base09 },
  BUILD_STILL: { char: 'S', color: ISOTOPE.base0E },
  BUILD_SMELTER: { char: '£', color: ISOTOPE.base09 },
  BUILD_FORGE: { char: '⚒', color: ISOTOPE.base0C },
  BUILD_TAVERN: { char: '♫', color: ISOTOPE.base0E },
  BUILD_TEMPLE: { char: 'Ψ', color: ISOTOPE.base0A },
  BUILD_DEPOT: { char: '¤', color: ISOTOPE.base0C },
  BUILD_FARM: { char: '≈', color: ISOTOPE.base0B },
  CANCEL: { char: ' ', color: ISOTOPE.base08 },
};

export default function ASCIIViewport() {
  const {
    gameState,
    currentZ,
    setCurrentZ,
    selectedTool,
    setSelectedTool,
    selectedDwarfId,
    setSelectedDwarfId,
    hoveredTile,
    setHoveredTile,
    inspectMode,
    setInspectMode,
    inspectedCoord,
    setInspectedCoord,
    pingTarget,
    designateBox,
    toggleDwarfLabor,
    togglePause,
  } = useGame();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  const gridWidth = gameState.world.width;
  const gridHeight = gameState.world.height;

  const clientToGrid = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;

      const gx = Math.max(0, Math.min(gridWidth - 1, Math.floor(canvasX / CELL_W)));
      const gy = Math.max(0, Math.min(gridHeight - 1, Math.floor(canvasY / CELL_H)));
      return { x: gx, y: gy };
    },
    [gridWidth, gridHeight]
  );

  // Keyboard shortcuts for intuitive Dwarf Fortress control
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      } else if (e.key === '[' || e.key === '<' || e.key === ',') {
        setCurrentZ((z) => Math.max(0, z - 1));
      } else if (e.key === ']' || e.key === '>' || e.key === '.') {
        setCurrentZ((z) => Math.min(gameState.world.depth - 1, z + 1));
      } else if (e.key.toLowerCase() === 'i' || e.key === '?') {
        setInspectMode((v) => !v);
      } else if (e.key.toLowerCase() === 'd') {
        setSelectedTool('MINE');
      } else if (e.key.toLowerCase() === 't') {
        setSelectedTool('CHOP');
      } else if (e.key.toLowerCase() === 'g') {
        setSelectedTool('GATHER');
      } else if (e.key.toLowerCase() === 'x') {
        setSelectedTool('STAIRS');
      } else if (e.key.toLowerCase() === 'p') {
        setSelectedTool('STOCKPILE');
      } else if (e.key.toLowerCase() === 'b') {
        setSelectedTool('BUILD_WALL');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState.world.depth, setCurrentZ, setInspectMode, setSelectedTool, togglePause]);

  // Draw the ASCII Grid, Designations, Selection Box, Hostiles, and Dwarves
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const level = gameState.grid[currentZ];
    if (!level) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 13px "JetBrains Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. Render Terrain & Designations
    for (let y = 0; y < gridHeight; y++) {
      const row = level[y];
      for (let x = 0; x < gridWidth; x++) {
        const tile = row[x];
        const px = x * CELL_W;
        const py = y * CELL_H;

        if (!tile.revealed) {
          ctx.fillStyle = ISOTOPE.base00;
          ctx.fillRect(px, py, CELL_W, CELL_H);
          ctx.fillStyle = ISOTOPE.base02;
          ctx.fillText('·', px + CELL_W / 2, py + CELL_H / 2);
          continue;
        }

        // Tile background
        ctx.fillStyle = tile.bg;
        ctx.fillRect(px, py, CELL_W, CELL_H);

        // If designated, tint background and draw designation marker
        if (tile.designation) {
          const des = DESIGNATION_BADGE[tile.designation];
          ctx.fillStyle = 'rgba(255, 153, 0, 0.25)';
          ctx.fillRect(px, py, CELL_W, CELL_H);
          ctx.strokeStyle = des?.color || ISOTOPE.base0A;
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, CELL_W - 1, CELL_H - 1);
          ctx.fillStyle = des?.color || ISOTOPE.base0A;
          ctx.fillText(tile.char, px + CELL_W / 2, py + CELL_H / 2);
        } else {
          ctx.fillStyle = tile.fg;
          ctx.fillText(tile.char, px + CELL_W / 2, py + CELL_H / 2);
        }
      }
    }

    // 2. Render Drag-Selection Box
    if (dragStart && dragCurrent && !inspectMode) {
      const minX = Math.min(dragStart.x, dragCurrent.x);
      const maxX = Math.max(dragStart.x, dragCurrent.x);
      const minY = Math.min(dragStart.y, dragCurrent.y);
      const maxY = Math.max(dragStart.y, dragCurrent.y);

      const rx = minX * CELL_W;
      const ry = minY * CELL_H;
      const rw = (maxX - minX + 1) * CELL_W;
      const rh = (maxY - minY + 1) * CELL_H;

      ctx.fillStyle = 'rgba(255, 238, 0, 0.20)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = ISOTOPE.base0A;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
    }

    // 3. Render Hovered Tile Reticle
    if (hoveredTile && hoveredTile.z === currentZ) {
      const hx = hoveredTile.x * CELL_W;
      const hy = hoveredTile.y * CELL_H;
      ctx.strokeStyle = inspectMode ? '#ff0099' : ISOTOPE.base0C;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx + 0.5, hy + 0.5, CELL_W - 1, CELL_H - 1);
    }

    // 4. Render Inspected Coordinate Highlight
    if (inspectedCoord && inspectedCoord.z === currentZ) {
      const ix = inspectedCoord.x * CELL_W;
      const iy = inspectedCoord.y * CELL_H;
      ctx.strokeStyle = '#ff0099';
      ctx.lineWidth = 2;
      ctx.strokeRect(ix + 1, iy + 1, CELL_W - 2, CELL_H - 2);
    }

    // 5. Render Jump Ping Reticle (if active on current Z)
    if (pingTarget && pingTarget.z === currentZ) {
      const px = pingTarget.x * CELL_W;
      const py = pingTarget.y * CELL_H;
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 2, py - 2, CELL_W + 4, CELL_H + 4);
    }

    // 6. Render Hostiles (Goblin Raiders, Trolls, Cavern Beasts) on current Z-level
    gameState.hostiles.forEach((hostile: HostileEntity) => {
      if (hostile.z !== currentZ) return;
      const hx = hostile.x * CELL_W;
      const hy = hostile.y * CELL_H;

      ctx.fillStyle = '#250000';
      ctx.fillRect(hx + 1, hy + 1, CELL_W - 2, CELL_H - 2);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 1;
      ctx.strokeRect(hx + 0.5, hy + 0.5, CELL_W - 1, CELL_H - 1);

      ctx.fillStyle = hostile.color;
      ctx.fillText(hostile.char, hx + CELL_W / 2, hy + CELL_H / 2);

      // Mini HP bar at top of hostile cell
      const hpRatio = Math.max(0, Math.min(1, hostile.hp / hostile.maxHp));
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(hx + 2, hy + 1, Math.round((CELL_W - 4) * hpRatio), 2);
    });

    // 7. Render Dwarves on current Z-level
    gameState.dwarves.forEach((dwarf: DwarfEntity) => {
      if (dwarf.z !== currentZ) return;
      const dx = dwarf.x * CELL_W;
      const dy = dwarf.y * CELL_H;

      // Dark halo behind dwarf glyph for contrast
      ctx.fillStyle = ISOTOPE.base00;
      ctx.fillRect(dx + 1, dy + 1, CELL_W - 2, CELL_H - 2);

      // Selected dwarf highlight ring
      if (dwarf.id === selectedDwarfId) {
        ctx.strokeStyle = ISOTOPE.base0A;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(dx + 0.5, dy + 0.5, CELL_W - 1, CELL_H - 1);
      }

      ctx.fillStyle = dwarf.color;
      ctx.fillText(dwarf.char, dx + CELL_W / 2, dy + CELL_H / 2);

      // Equipment pips (Top-right orange pip for weapon, Top-left cyan pip for armor)
      if (dwarf.weaponEquipped) {
        ctx.fillStyle = '#ff9900';
        ctx.fillRect(dx + CELL_W - 4, dy + 2, 3, 3);
      }
      if (dwarf.armorEquipped) {
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(dx + 2, dy + 2, 3, 3);
      }
    });
  }, [
    gameState.grid,
    gameState.dwarves,
    gameState.hostiles,
    currentZ,
    gridWidth,
    gridHeight,
    dragStart,
    dragCurrent,
    hoveredTile,
    selectedDwarfId,
    inspectMode,
    inspectedCoord,
    pingTarget,
  ]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coord = clientToGrid(e.clientX, e.clientY);
    if (!coord) return;

    // Always update inspected coordinate on click when in inspectMode or Shift/Right-click
    const clickedDwarf = gameState.dwarves.find(
      (d) => d.z === currentZ && d.x === coord.x && d.y === coord.y
    );

    if (inspectMode || e.shiftKey || e.button === 2) {
      setInspectedCoord({ x: coord.x, y: coord.y, z: currentZ });
      if (clickedDwarf) {
        setSelectedDwarfId(clickedDwarf.id);
      }
      return;
    }

    if (clickedDwarf) {
      setSelectedDwarfId(clickedDwarf.id);
      setInspectedCoord({ x: coord.x, y: coord.y, z: currentZ });
    }

    setDragStart(coord);
    setDragCurrent(coord);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coord = clientToGrid(e.clientX, e.clientY);
    if (!coord) return;
    if (dragStart && !inspectMode) {
      setDragCurrent(coord);
    }
    const tile = gameState.grid[currentZ]?.[coord.y]?.[coord.x] || null;
    setHoveredTile(tile);
  };

  const handleMouseUp = () => {
    if (dragStart && dragCurrent && !inspectMode) {
      designateBox(dragStart.x, dragStart.y, dragCurrent.x, dragCurrent.y);
    }
    setDragStart(null);
    setDragCurrent(null);
  };

  // Quick-Action Presets for 1-click intuitive fortress orders
  const handleQuickExcavate = () => {
    const cx = Math.floor(gridWidth / 2);
    const cy = Math.floor(gridHeight / 2);
    setCurrentZ(0);
    designateBox(cx + 5, cy - 2, cx + 9, cy + 2, 'MINE');
  };

  const handleQuickChop = () => {
    setCurrentZ(0);
    designateBox(4, 4, gridWidth - 5, gridHeight - 5, 'CHOP');
  };

  const handleQuickBuildForge = () => {
    const cx = Math.floor(gridWidth / 2);
    const cy = Math.floor(gridHeight / 2);
    setCurrentZ(0);
    designateBox(cx - 4, cy - 2, cx - 4, cy - 2, 'BUILD_SMELTER');
    designateBox(cx - 2, cy - 2, cx - 2, cy - 2, 'BUILD_FORGE');
    designateBox(cx - 3, cy + 2, cx - 3, cy + 2, 'BUILD_TAVERN');
  };

  const currentStratum = gameState.world.strata[currentZ] || gameState.world.strata[0];

  // Resolve inspected tile, dwarf, and hostile for the Inspector Drawer
  const activeInspect = useMemo(() => {
    const coord = inspectedCoord || { x: Math.floor(gridWidth / 2), y: Math.floor(gridHeight / 2), z: currentZ };
    const tile = gameState.grid[coord.z]?.[coord.y]?.[coord.x] || null;
    const dwarf =
      gameState.dwarves.find((d) => d.z === coord.z && d.x === coord.x && d.y === coord.y) ||
      gameState.dwarves.find(
        (d) => d.z === coord.z && Math.abs(d.x - coord.x) <= 1 && Math.abs(d.y - coord.y) <= 1
      ) ||
      null;
    const hostile =
      gameState.hostiles.find((h) => h.z === coord.z && h.x === coord.x && h.y === coord.y) ||
      gameState.hostiles.find(
        (h) => h.z === coord.z && Math.abs(h.x - coord.x) <= 1 && Math.abs(h.y - coord.y) <= 1
      ) ||
      null;
    return { coord, tile, dwarf, hostile };
  }, [inspectedCoord, currentZ, gridWidth, gridHeight, gameState.grid, gameState.dwarves, gameState.hostiles]);

  return (
    <div className="flex flex-col h-full w-full bg-[#000000] font-mono select-none overflow-hidden text-[#d0d0d0]">
      {/* Top ASCII Viewport Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#101010] border-b border-[#202020] text-xs">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[#ff0099] font-bold whitespace-nowrap">
            ┌─[ DEPTH Z-{currentZ}: {currentStratum.name.toUpperCase()} ]
          </span>
          <span className="text-[#808080] hidden sm:inline whitespace-nowrap">
            {'//'} STRATA: {currentStratum.primaryRock.toUpperCase()}
          </span>
        </div>

        {/* Pure colored clickable text commands */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <button
            type="button"
            onClick={() => setInspectMode((v) => !v)}
            className={`px-1.5 py-0.5 border transition-colors whitespace-nowrap shrink-0 ${
              inspectMode
                ? 'border-[#ff0099] bg-[#202020] text-[#ff0099] font-bold'
                : 'border-[#202020] text-[#00ffff] hover:bg-[#202020] hover:text-[#ffffff]'
            }`}
          >
            {inspectMode ? '[ ? INSPECT: ON ]' : '[ ? INSPECT ]'}
          </button>

          <button
            type="button"
            onClick={handleQuickExcavate}
            className="text-[#ff9900] hover:bg-[#202020] hover:text-[#ffffff] px-1 transition-colors whitespace-nowrap shrink-0"
          >
            [ D: MINE CLIFF ]
          </button>
          <button
            type="button"
            onClick={handleQuickChop}
            className="text-[#33ff00] hover:bg-[#202020] hover:text-[#ffffff] px-1 transition-colors whitespace-nowrap shrink-0"
          >
            [ T: CHOP TIMBER ]
          </button>
          <button
            type="button"
            onClick={handleQuickBuildForge}
            className="text-[#cc00ff] hover:bg-[#202020] hover:text-[#ffffff] px-1 transition-colors hidden sm:inline whitespace-nowrap shrink-0"
          >
            [ F: SMELTER &amp; TAVERN ]
          </button>

          <span className="text-[#808080]">|</span>

          <button
            type="button"
            aria-label="Ascend Z-Level"
            disabled={currentZ === 0}
            onClick={() => setCurrentZ((z) => Math.max(0, z - 1))}
            className="text-[#ff0099] hover:bg-[#202020] hover:text-[#ffffff] disabled:text-[#808080] px-1 transition-colors whitespace-nowrap shrink-0"
          >
            [ ▲ UP ( &lt; ) ]
          </button>
          <span className="text-[#00ffff] font-bold px-0.5 whitespace-nowrap shrink-0">
            Z-{currentZ}
          </span>
          <button
            type="button"
            aria-label="Descend Z-Level"
            disabled={currentZ >= gameState.world.depth - 1}
            onClick={() => setCurrentZ((z) => Math.min(gameState.world.depth - 1, z + 1))}
            className="text-[#ff0099] hover:bg-[#202020] hover:text-[#ffffff] disabled:text-[#808080] px-1 transition-colors whitespace-nowrap shrink-0"
          >
            [ ▼ DOWN ( &gt; ) ]
          </button>
        </div>
      </div>

      {/* Main Interactive ASCII Map Canvas with Terminal Frame */}
      <div className="relative flex-1 flex items-center justify-center p-2 overflow-auto bg-[#000000] min-h-0">
        <canvas
          ref={canvasRef}
          data-testid="ascii-map-canvas"
          width={gridWidth * CELL_W}
          height={gridHeight * CELL_H}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => {
            e.preventDefault();
            const coord = clientToGrid(e.clientX, e.clientY);
            if (coord) {
              setInspectedCoord({ x: coord.x, y: coord.y, z: currentZ });
              setInspectMode(true);
            }
          }}
          onMouseLeave={() => {
            setDragStart(null);
            setDragCurrent(null);
          }}
          className={`max-w-full max-h-full object-contain border border-[#202020] bg-[#000000] ${
            inspectMode ? 'cursor-pointer' : 'cursor-crosshair'
          }`}
        />
      </div>

      {/* Interactive Tile & Entity Inspector Panel (Shown when Inspect Mode is ON) */}
      {inspectMode && activeInspect.tile && (
        <div className="shrink-0 bg-[#0c0c0c] border-t-2 border-[#ff0099] px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-[#202020]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[#ff0099] font-bold whitespace-nowrap">
                [ INSPECTOR // ({activeInspect.coord.x},{activeInspect.coord.y},Z-{activeInspect.coord.z}) ]
              </span>
              <span className="text-[#00ffff] font-bold whitespace-nowrap">
                {activeInspect.tile.revealed ? activeInspect.tile.terrain : 'UNEXPLORED ROCK'}
              </span>
              {activeInspect.tile.resourceDrop && (
                <span className="text-[#ff9900] whitespace-nowrap">
                  · YIELD: +{activeInspect.tile.resourceDrop.amount} {activeInspect.tile.resourceDrop.type}
                </span>
              )}
              {activeInspect.tile.terrain === 'CAVERN_RELIC' && (
                <span className="text-[#33ff00] font-bold whitespace-nowrap">
                  · ☼ ANCIENT RELIC (+250 WEALTH &amp; CLAN MIRTH)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  designateBox(
                    activeInspect.coord.x,
                    activeInspect.coord.y,
                    activeInspect.coord.x,
                    activeInspect.coord.y,
                    'MINE'
                  )
                }
                className="px-1.5 py-0.5 border border-[#202020] text-[#ff9900] hover:bg-[#202020] whitespace-nowrap shrink-0"
              >
                [ MINE TILE ]
              </button>
              <button
                type="button"
                onClick={() =>
                  designateBox(
                    activeInspect.coord.x,
                    activeInspect.coord.y,
                    activeInspect.coord.x,
                    activeInspect.coord.y,
                    'BUILD_TRAP'
                  )
                }
                className="px-1.5 py-0.5 border border-[#202020] text-[#ff0000] hover:bg-[#202020] whitespace-nowrap shrink-0"
              >
                [ SET TRAP ]
              </button>
              <button
                type="button"
                onClick={() => setInspectMode(false)}
                className="px-1.5 py-0.5 border border-[#202020] text-[#808080] hover:text-[#ffffff] whitespace-nowrap shrink-0"
              >
                [ CLOSE INSPECTOR ]
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Dwarf at or near coordinate */}
            {activeInspect.dwarf ? (
              <div className="p-1.5 bg-[#000000] border border-[#202020] flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-[#ffffff]">
                    <span style={{ color: activeInspect.dwarf.color }}>{activeInspect.dwarf.char}</span>{' '}
                    {activeInspect.dwarf.name} ({activeInspect.dwarf.title})
                  </div>
                  <div className="text-[11px] text-[#808080] tabular-nums">
                    HP: <span className="text-[#33ff00]">{activeInspect.dwarf.hp}/{activeInspect.dwarf.maxHp}</span> ·
                    State: <span className="text-[#00ffff]">{activeInspect.dwarf.state}</span> ·
                    Gear:{' '}
                    <span className="text-[#ff9900]">
                      {activeInspect.dwarf.weaponEquipped ? '⚔Axe ' : ''}
                      {activeInspect.dwarf.armorEquipped ? '🛡Mail' : ''}
                      {!activeInspect.dwarf.weaponEquipped && !activeInspect.dwarf.armorEquipped ? 'Unarmed' : ''}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#808080] italic truncate">
                    &ldquo;{activeInspect.dwarf.thought}&rdquo;
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleDwarfLabor(activeInspect.dwarf!.id, 'COMBAT')}
                  className={`px-2 py-1 border text-[10px] font-bold whitespace-nowrap shrink-0 ${
                    activeInspect.dwarf.labors.COMBAT
                      ? 'border-[#ff0000] text-[#ff0000] bg-[#202020]'
                      : 'border-[#202020] text-[#808080] hover:text-[#ffffff]'
                  }`}
                >
                  {activeInspect.dwarf.labors.COMBAT ? '[⚔ MILITIA: ON]' : '[⚔ DRAFT MILITIA]'}
                </button>
              </div>
            ) : (
              <div className="p-1.5 bg-[#000000] border border-[#202020] text-[#808080] flex items-center">
                No dwarf standing at ({activeInspect.coord.x},{activeInspect.coord.y},Z-{activeInspect.coord.z}). Click any ☺ glyph to inspect pioneer.
              </div>
            )}

            {/* Hostile at or near coordinate */}
            {activeInspect.hostile ? (
              <div className="p-1.5 bg-[#150000] border border-[#ff0000] flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-[#ff0000]">
                    [{activeInspect.hostile.char}] {activeInspect.hostile.name} ({activeInspect.hostile.kind})
                  </div>
                  <div className="text-[11px] text-[#d0d0d0] tabular-nums">
                    HP: <strong className="text-[#ff0000]">{activeInspect.hostile.hp}/{activeInspect.hostile.maxHp}</strong> ·
                    ATK: <strong>{activeInspect.hostile.attack}</strong> · AI: {activeInspect.hostile.behavior}
                  </div>
                </div>
                <span className="text-[10px] text-[#ff9900] font-bold whitespace-nowrap shrink-0">
                  [ ! HOSTILE THREAT ]
                </span>
              </div>
            ) : (
              <div className="p-1.5 bg-[#000000] border border-[#202020] text-[#808080] flex items-center">
                Sector clear of hostile raiders &amp; cavern beasts.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom ASCII Viewport Telemetry Bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-1 bg-[#101010] border-t border-[#202020] text-xs text-[#808080]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#00ffff] whitespace-nowrap shrink-0">
            └─[ MODE:{' '}
            <strong className="text-[#ff0099]">
              {inspectMode ? 'INSPECTOR' : selectedTool.replace('BUILD_', '')}
            </strong>{' '}
            ]
          </span>
          {hoveredTile ? (
            <span className="text-[#d0d0d0] truncate whitespace-nowrap">
              ──[ POS: ({hoveredTile.x},{hoveredTile.y},Z-{hoveredTile.z}) //{' '}
              {hoveredTile.revealed ? hoveredTile.terrain : 'UNEXPLORED'}{' '}
              {hoveredTile.designation ? `// ORDER: ${hoveredTile.designation}` : ''} ]
            </span>
          ) : (
            <span className="text-[#808080] truncate whitespace-nowrap">
              ──[ Click or drag to designate orders · Right-click or [? INSPECT] to examine ]
            </span>
          )}
        </div>

        <div className="hidden xl:flex items-center gap-2 text-[11px] text-[#808080] whitespace-nowrap shrink-0">
          <span className="text-[#ff0099]">☺ Dwarf</span>
          <span className="text-[#ff0000]">g Raider</span>
          <span className="text-[#00ffff]">☼ Relic</span>
          <span className="text-[#ff9900]">£ Smelter</span>
          <span className="text-[#00ffff]">⚒ Forge</span>
          <span className="text-[#cc00ff]">♫ Tavern</span>
          <span className="text-[#ff0099]">Ψ Temple</span>
          <span className="text-[#ff0000]">^ Trap</span>
        </div>
      </div>
    </div>
  );
}
