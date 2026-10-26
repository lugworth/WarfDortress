"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useGame } from "./GameProvider";
import { DesignationType, DwarfEntity, HostileEntity } from "@/lib/types";
import { ISOTOPE } from "@/lib/colors";
import { canDesignateTile } from "@/lib/game-engine";
import { TOOL_KEYS } from "@/lib/game-rules";
import { getDesignationPreview, getMapPoints } from "@/lib/ui-model";
import { formatCost, getTool } from "@/lib/tool-catalog";
import { TOOL_NAMES } from "@/lib/ui-labels";
import { MAP_ZOOMS } from "@/lib/ui-preferences";
import { useUI } from "./UIProvider";
import AsciiSelect from "./AsciiSelect";
import { playTactileSfx } from "@/lib/audio";

const DESIGNATION_BADGE: Record<
  DesignationType,
  { char: string; color: string }
> = {
  MINE: { char: "⛏", color: ISOTOPE.base09 },
  CHOP: { char: "×", color: ISOTOPE.base0B },
  GATHER: { char: "%", color: ISOTOPE.base0B },
  STAIRS: { char: "X", color: ISOTOPE.base0A },
  STOCKPILE: { char: "≡", color: ISOTOPE.base0D },
  RECLAIM_RELIC: { char: "☼", color: ISOTOPE.base0C },
  BUILD_WALL: { char: "#", color: ISOTOPE.base07 },
  BUILD_DOOR: { char: "+", color: ISOTOPE.base0A },
  BUILD_TRAP: { char: "^", color: ISOTOPE.base08 },
  BUILD_BED: { char: "⌂", color: ISOTOPE.base09 },
  BUILD_MASON: { char: "M", color: ISOTOPE.base05 },
  BUILD_CARPENTER: { char: "C", color: ISOTOPE.base09 },
  BUILD_STILL: { char: "S", color: ISOTOPE.base0E },
  BUILD_SMELTER: { char: "£", color: ISOTOPE.base09 },
  BUILD_FORGE: { char: "⚒", color: ISOTOPE.base0C },
  BUILD_TAVERN: { char: "♫", color: ISOTOPE.base0E },
  BUILD_TEMPLE: { char: "Ψ", color: ISOTOPE.base0A },
  BUILD_DEPOT: { char: "¤", color: ISOTOPE.base0C },
  BUILD_FARM: { char: "≈", color: ISOTOPE.base0B },
  CANCEL: { char: " ", color: ISOTOPE.base08 },
};

export default function ASCIIViewport() {
  const { preferences, updatePreferences } = useUI();
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
    jumpToLocation,
  } = useGame();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 600, dpr: 1 });
  const [mapOptions, setMapOptions] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [focusedPointId, setFocusedPointId] = useState<string | null>(null);
  const [fontReady, setFontReady] = useState(false);
  const [orderStatus, setOrderStatus] = useState("");
  const [cursor, setCursor] = useState({
    x: Math.floor(gameState.world.width / 2),
    y: Math.floor(gameState.world.height / 2),
  });
  const [pending, setPending] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    z: number;
    tool: DesignationType;
  } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dragCurrent, setDragCurrent] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [stampFlash, setStampFlash] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    z: number;
  } | null>(null);
  const contextKey = `${gameState.id}:${currentZ}:${selectedTool}:${panMode}`;
  const [selectionContext, setSelectionContext] = useState(contextKey);
  // Reset transient selections in the render that changes their world/tool.
  // An effect scheduled for the next frame could erase a new keyboard drag.
  if (selectionContext !== contextKey) {
    setSelectionContext(contextKey);
    setPending(null);
    setDragStart(null);
    setDragCurrent(null);
  }

  const gridWidth = gameState.world.width;
  const gridHeight = gameState.world.height;
  const scale =
    preferences.mapZoom === "fit"
      ? Math.max(
          0.2,
          Math.min(
            (viewport.width - 20) / (gridWidth * 14),
            (viewport.height - 20) / (gridHeight * 18),
            2,
          ),
        )
      : preferences.mapZoom / 100;
  const CELL_W = 14 * scale;
  const CELL_H = 18 * scale;
  const logicalWidth = gridWidth * CELL_W;
  const logicalHeight = gridHeight * CELL_H;
  const points = useMemo(
    () => getMapPoints(gameState, currentZ),
    [gameState, currentZ],
  );
  const selection = useMemo(
    () =>
      pending ||
      (dragStart && dragCurrent
        ? {
            start: dragStart,
            end: dragCurrent,
            z: currentZ,
            tool: selectedTool,
          }
        : null),
    [pending, dragStart, dragCurrent, currentZ, selectedTool],
  );
  const preview = useMemo(
    () =>
      selection
        ? getDesignationPreview(
            gameState,
            selection.z,
            selection.start.x,
            selection.start.y,
            selection.end.x,
            selection.end.y,
            selection.tool,
          )
        : null,
    [gameState, selection],
  );
  const palette = useMemo(
    () =>
      preferences.theme === "contrast"
        ? {
            accent: "#ffe166",
            info: "#72e3ff",
            danger: "#ff9999",
            good: "#a5ffbd",
            terrain: "#c6ccd2",
            bg: "#05080c",
            dim: "#8894a0",
          }
        : {
            accent: ISOTOPE.base0A,
            info: ISOTOPE.base0C,
            danger: ISOTOPE.base08,
            good: ISOTOPE.base0B,
            terrain: ISOTOPE.base05,
            bg: ISOTOPE.base00,
            dim: ISOTOPE.base02,
          },
    [preferences.theme],
  );
  const commitSelection = () => {
    if (!selection || !preview) return;
    const count = designateBox(
      selection.start.x,
      selection.start.y,
      selection.end.x,
      selection.end.y,
      selection.tool,
      selection.z,
    );
    playTactileSfx("stamp");
    setStampFlash({
      start: selection.start,
      end: selection.end,
      z: selection.z,
    });
    setOrderStatus(
      `${selection.tool === "CANCEL" ? "Cleared" : "Accepted"} ${count} tiles; skipped ${preview.tiles.length - count}. ${selection.tool === "CANCEL" ? "" : "Materials are consumed when built."}`,
    );
    setPending(null);
    setDragStart(null);
    setDragCurrent(null);
  };
  const focusCell = useCallback(
    (x: number, y: number) => {
      const container = scrollRef.current;
      if (!container) return;
      container.scrollTo({
        left: Math.max(0, x * CELL_W - container.clientWidth / 2),
        top: Math.max(0, y * CELL_H - container.clientHeight / 2),
        behavior: "instant",
      });
    },
    [CELL_W, CELL_H],
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const update = () =>
      setViewport({
        width: container.clientWidth,
        height: container.clientHeight,
        dpr: window.devicePixelRatio || 1,
      });
    const observer = new ResizeObserver(update);
    observer.observe(container);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  useEffect(() => {
    if (!stampFlash) return;
    const timer = window.setTimeout(() => setStampFlash(null), 260);
    return () => window.clearTimeout(timer);
  }, [stampFlash]);
  useEffect(() => {
    let active = true;
    document.fonts
      .load('bold 13px "Fortress Mono"')
      .then(() => {
        if (active) setFontReady(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const target =
      pingTarget?.z === currentZ
        ? pingTarget
        : selectedDwarfId
          ? gameState.dwarves.find(
              (d) => d.id === selectedDwarfId && d.z === currentZ,
            )
          : null;
    if (target) focusCell(target.x, target.y);
    // Follow only explicit jumps, selection, and zoom changes, not each simulation tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pingTarget?.timestamp,
    selectedDwarfId,
    currentZ,
    focusCell,
    gameState.id,
  ]);

  const clientToGrid = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;

      const gx = Math.max(
        0,
        Math.min(
          gridWidth - 1,
          Math.floor(((clientX - rect.left) / rect.width) * gridWidth),
        ),
      );
      const gy = Math.max(
        0,
        Math.min(
          gridHeight - 1,
          Math.floor(((clientY - rect.top) / rect.height) * gridHeight),
        ),
      );
      return { x: gx, y: gy };
    },
    [gridWidth, gridHeight],
  );

  // Keyboard shortcuts for intuitive Dwarf Fortress control
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "BUTTON" ||
        (e.target as HTMLElement)?.isContentEditable ||
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        document.querySelector('[aria-modal="true"]')
      )
        return;

      if (e.key === " ") {
        e.preventDefault();
        togglePause();
      } else if (e.key === "[" || e.key === "<" || e.key === ",") {
        setCurrentZ((z) => Math.max(0, z - 1));
      } else if (e.key === "]" || e.key === ">" || e.key === ".") {
        setCurrentZ((z) => Math.min(gameState.world.depth - 1, z + 1));
      } else if (e.key.toLowerCase() === "i" || e.key === "?") {
        setInspectMode((v) => !v);
      } else if (TOOL_KEYS[e.key.toLowerCase()]) {
        setSelectedTool(TOOL_KEYS[e.key.toLowerCase()]);
        setInspectMode(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    gameState.world.depth,
    setCurrentZ,
    setInspectMode,
    setSelectedTool,
    togglePause,
    jumpToLocation,
  ]);

  // Draw the ASCII Grid, Designations, Selection Box, Hostiles, and Dwarves
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const level = gameState.grid[currentZ];
    if (!level) return;

    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    ctx.font = `bold ${13 * scale}px "Fortress Mono", "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

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
          ctx.fillStyle = palette.dim;
          ctx.fillText("·", px + CELL_W / 2, py + CELL_H / 2);
          continue;
        }

        // Tile background
        ctx.fillStyle = tile.bg === "#000000" ? palette.bg : tile.bg;
        ctx.fillRect(px, py, CELL_W, CELL_H);

        // If designated, tint background and draw designation marker
        if (tile.designation) {
          const des = DESIGNATION_BADGE[tile.designation];
          ctx.fillStyle = "rgba(255, 200, 120, 0.14)";
          ctx.fillRect(px, py, CELL_W, CELL_H);
          ctx.strokeStyle = des?.color || ISOTOPE.base0A;
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, CELL_W - 1, CELL_H - 1);
          ctx.fillStyle =
            preferences.theme === "contrast"
              ? palette.accent
              : des?.color || palette.accent;
          ctx.fillText(
            des?.char || tile.char,
            px + CELL_W / 2,
            py + CELL_H / 2,
          );
        } else {
          const landmark =
            tile.terrain.startsWith("WORKSHOP") ||
            tile.terrain.includes("RELIC") ||
            tile.terrain.startsWith("STAIRS") ||
            ["TAVERN_HALL", "TEMPLE_ALTAR", "TRADE_DEPOT"].includes(
              tile.terrain,
            );
          ctx.fillStyle =
            preferences.theme === "contrast"
              ? landmark
                ? palette.info
                : palette.terrain
              : tile.fg;
          ctx.fillText(tile.char, px + CELL_W / 2, py + CELL_H / 2);
          ctx.globalAlpha = 1;
        }
      }
    }

    // 2. Render Drag-Selection Box
    if (selection && preview && selection.z === currentZ) {
      const minX = Math.min(selection.start.x, selection.end.x);
      const maxX = Math.max(selection.start.x, selection.end.x);
      const minY = Math.min(selection.start.y, selection.end.y);
      const maxY = Math.max(selection.start.y, selection.end.y);

      const rx = minX * CELL_W;
      const ry = minY * CELL_H;
      const rw = (maxX - minX + 1) * CELL_W;
      const rh = (maxY - minY + 1) * CELL_H;

      ctx.fillStyle = "rgba(255, 238, 0, 0.20)";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = ISOTOPE.base0A;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      for (const cell of preview.tiles) {
        const x = cell.x * CELL_W,
          y = cell.y * CELL_H;
        ctx.fillStyle = cell.valid ? "#0b3024" : "#351f26";
        ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
        ctx.fillStyle = cell.valid ? palette.good : palette.danger;
        ctx.fillText(cell.valid ? "+" : "×", x + CELL_W / 2, y + CELL_H / 2);
      }
    }

    // 2b. Render Tactile Order Stamp Flash
    if (stampFlash && stampFlash.z === currentZ) {
      const minX = Math.min(stampFlash.start.x, stampFlash.end.x);
      const maxX = Math.max(stampFlash.start.x, stampFlash.end.x);
      const minY = Math.min(stampFlash.start.y, stampFlash.end.y);
      const maxY = Math.max(stampFlash.start.y, stampFlash.end.y);
      const sx = minX * CELL_W;
      const sy = minY * CELL_H;
      const sw = (maxX - minX + 1) * CELL_W;
      const sh = (maxY - minY + 1) * CELL_H;
      ctx.fillStyle = "rgba(51, 255, 0, 0.22)";
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = palette.good;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 1, sy - 1, sw + 2, sh + 2);
    }

    // 3. Render Hovered Tile Reticle with Tactile Corner Brackets & Ghost Tool Preview
    if (hoveredTile && hoveredTile.z === currentZ) {
      const hx = hoveredTile.x * CELL_W;
      const hy = hoveredTile.y * CELL_H;
      const canApply =
        !inspectMode &&
        canDesignateTile(hoveredTile, selectedTool) &&
        !selection;
      const reticleColor = inspectMode
        ? "#ff0099"
        : canApply
          ? palette.good
          : ISOTOPE.base0C;
      ctx.strokeStyle = reticleColor;
      ctx.lineWidth = 1.5;
      const arm = Math.max(3, Math.min(CELL_W, CELL_H) * 0.32);
      ctx.beginPath();
      // Top-left bracket
      ctx.moveTo(hx + 0.5, hy + arm);
      ctx.lineTo(hx + 0.5, hy + 0.5);
      ctx.lineTo(hx + arm, hy + 0.5);
      // Top-right bracket
      ctx.moveTo(hx + CELL_W - arm, hy + 0.5);
      ctx.lineTo(hx + CELL_W - 0.5, hy + 0.5);
      ctx.lineTo(hx + CELL_W - 0.5, hy + arm);
      // Bottom-left bracket
      ctx.moveTo(hx + 0.5, hy + CELL_H - arm);
      ctx.lineTo(hx + 0.5, hy + CELL_H - 0.5);
      ctx.lineTo(hx + arm, hy + CELL_H - 0.5);
      // Bottom-right bracket
      ctx.moveTo(hx + CELL_W - arm, hy + CELL_H - 0.5);
      ctx.lineTo(hx + CELL_W - 0.5, hy + CELL_H - 0.5);
      ctx.lineTo(hx + CELL_W - 0.5, hy + CELL_H - arm);
      ctx.stroke();

      if (!inspectMode && !selection) {
        const badge = DESIGNATION_BADGE[selectedTool];
        if (badge && badge.char.trim()) {
          ctx.save();
          ctx.globalAlpha = canApply ? 0.85 : 0.38;
          ctx.fillStyle = canApply ? badge.color : palette.danger;
          ctx.fillText(badge.char, hx + CELL_W / 2, hy + CELL_H / 2);
          ctx.restore();
        }
      }
    }

    // 4. Render Inspected Coordinate Highlight
    if (inspectedCoord && inspectedCoord.z === currentZ) {
      const ix = inspectedCoord.x * CELL_W;
      const iy = inspectedCoord.y * CELL_H;
      ctx.strokeStyle = "#ff0099";
      ctx.lineWidth = 2;
      ctx.strokeRect(ix + 1, iy + 1, CELL_W - 2, CELL_H - 2);
    }

    // 5. Render Jump Ping Reticle (if active on current Z)
    if (pingTarget && pingTarget.z === currentZ) {
      const px = pingTarget.x * CELL_W;
      const py = pingTarget.y * CELL_H;
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 2, py - 2, CELL_W + 4, CELL_H + 4);
    }

    // 6. Render Hostiles (Goblin Raiders, Trolls, Cavern Beasts) on current Z-level
    gameState.hostiles.forEach((hostile: HostileEntity) => {
      if (hostile.z !== currentZ || !level[hostile.y]?.[hostile.x]?.revealed)
        return;
      const hx = hostile.x * CELL_W;
      const hy = hostile.y * CELL_H;

      ctx.fillStyle = "#250000";
      ctx.fillRect(hx + 1, hy + 1, CELL_W - 2, CELL_H - 2);
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 1;
      ctx.strokeRect(hx + 0.5, hy + 0.5, CELL_W - 1, CELL_H - 1);

      ctx.fillStyle = hostile.color;
      ctx.fillText(hostile.char, hx + CELL_W / 2, hy + CELL_H / 2);

      // Mini HP bar at top of hostile cell
      const hpRatio = Math.max(0, Math.min(1, hostile.hp / hostile.maxHp));
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(hx + 2, hy + 1, Math.round((CELL_W - 4) * hpRatio), 2);
    });

    // 7. Render Dwarves on current Z-level
    gameState.dwarves.forEach((dwarf: DwarfEntity) => {
      if (dwarf.z !== currentZ || !level[dwarf.y]?.[dwarf.x]?.revealed) return;
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

      ctx.fillStyle =
        preferences.theme === "contrast" ? "#ffffff" : dwarf.color;
      ctx.fillText(dwarf.char, dx + CELL_W / 2, dy + CELL_H / 2);

      // Equipment pips (Top-right orange pip for weapon, Top-left cyan pip for armor)
      if (dwarf.weaponEquipped) {
        ctx.fillStyle = "#ff9900";
        ctx.fillRect(dx + CELL_W - 4, dy + 2, 3, 3);
      }
      if (dwarf.armorEquipped) {
        ctx.fillStyle = "#00ffff";
        ctx.fillRect(dx + 2, dy + 2, 3, 3);
      }
    });

    if (inspectMode) {
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(cursor.x * CELL_W, cursor.y * CELL_H, CELL_W, CELL_H);
    }
    if (preferences.labels) {
      ctx.font = `${Math.max(10, 12 * scale)}px "Fortress Mono", monospace`;
      ctx.textAlign = "left";
      const occupied: Array<{ x: number; y: number; w: number; h: number }> =
        [];
      const view = scrollRef.current;
      // Labels are clipped to the current view and avoid one another. All points
      // remain available in the object selector, even in a crowded settlement.
      for (const point of points) {
        const px = point.x * CELL_W,
          py = point.y * CELL_H;
        if (
          view &&
          (px < view.scrollLeft ||
            py < view.scrollTop ||
            px > view.scrollLeft + view.clientWidth ||
            py > view.scrollTop + view.clientHeight)
        )
          continue;
        const label =
          point.label.length > 24
            ? `${point.label.slice(0, 23)}…`
            : point.label;
        const w = ctx.measureText(label).width + 8,
          h = Math.max(16, CELL_H);
        const x = Math.max(0, Math.min(logicalWidth - w, px + CELL_W));
        const y = py >= h ? py - h : py + CELL_H;
        if (
          occupied.some(
            (b) => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y,
          )
        )
          continue;
        occupied.push({ x, y, w, h });
        ctx.fillStyle = "#05080c";
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle =
          point.kind === "HOSTILE" ? palette.danger : palette.info;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = point.kind === "HOSTILE" ? palette.danger : "#ffffff";
        ctx.fillText(label, x + 4, y + h / 2);
      }
    }
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
    CELL_W,
    CELL_H,
    logicalWidth,
    logicalHeight,
    viewport,
    scale,
    palette,
    preferences.theme,
    preferences.labels,
    points,
    selection,
    preview,
    cursor,
    fontReady,
    selectedTool,
    stampFlash,
  ]);

  const handleMouseDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panMode || e.button === 1) return;
    e.currentTarget.focus();
    setPending(null);
    const coord = clientToGrid(e.clientX, e.clientY);
    if (!coord) return;
    setCursor(coord);

    // Always update inspected coordinate on click when in inspectMode or Shift/Right-click
    const clickedDwarf = gameState.dwarves.find(
      (d) => d.z === currentZ && d.x === coord.x && d.y === coord.y,
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

  const handleMouseMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panMode) return;
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
      setPending({
        start: dragStart,
        end: dragCurrent,
        z: currentZ,
        tool: selectedTool,
      });
    }
    setDragStart(null);
    setDragCurrent(null);
  };

  // Quick-Action Presets for 1-click intuitive fortress orders
  const handleQuickExcavate = () => {
    const cx = Math.floor(gridWidth / 2);
    const cy = Math.floor(gridHeight / 2);
    setCurrentZ(0);
    designateBox(cx + 5, cy - 2, cx + 9, cy + 2, "MINE", 0);
  };

  const handleQuickChop = () => {
    setCurrentZ(0);
    designateBox(4, 4, gridWidth - 5, gridHeight - 5, "CHOP", 0);
  };

  const handleQuickBuildForge = () => {
    const cx = Math.floor(gridWidth / 2);
    const cy = Math.floor(gridHeight / 2);
    setCurrentZ(0);
    const sites = gameState.grid[0]
      .flat()
      .filter(
        (tile) =>
          Math.max(Math.abs(tile.x - cx), Math.abs(tile.y - cy)) <= 3 &&
          canDesignateTile(tile, "BUILD_SMELTER"),
      )
      .sort(
        (a, b) =>
          Math.abs(a.x - cx) +
          Math.abs(a.y - cy) -
          (Math.abs(b.x - cx) + Math.abs(b.y - cy)),
      );
    (["BUILD_SMELTER", "BUILD_FORGE", "BUILD_TAVERN"] as const).forEach(
      (tool, index) => {
        const site = sites[index];
        if (site) designateBox(site.x, site.y, site.x, site.y, tool, 0);
      },
    );
  };

  const currentStratum =
    gameState.world.strata[currentZ] || gameState.world.strata[0];

  // Resolve inspected tile, dwarf, and hostile for the Inspector Drawer
  const activeInspect = useMemo(() => {
    const coord =
      inspectedCoord?.z === currentZ
        ? inspectedCoord
        : { ...cursor, z: currentZ };
    const tile = gameState.grid[coord.z]?.[coord.y]?.[coord.x] || null;
    const occupants = tile?.revealed
      ? gameState.dwarves.filter(
          (d) => d.z === coord.z && d.x === coord.x && d.y === coord.y,
        )
      : [];
    const dwarf =
      occupants.find((d) => `dwarf:${d.id}` === focusedPointId) ||
      occupants[0] ||
      null;
    const hostile = tile?.revealed
      ? gameState.hostiles.find(
          (h) => h.z === coord.z && h.x === coord.x && h.y === coord.y,
        ) || null
      : null;
    return { coord, tile, dwarf, hostile };
  }, [
    inspectedCoord,
    currentZ,
    cursor,
    focusedPointId,
    gameState.grid,
    gameState.dwarves,
    gameState.hostiles,
  ]);

  const inspectPoint = (point: {
    x: number;
    y: number;
    z: number;
    id?: string;
    kind?: string;
  }) => {
    setFocusedPointId(point.id || null);
    setCursor({ x: point.x, y: point.y });
    setInspectedCoord(point);
    setInspectMode(true);
    focusCell(point.x, point.y);
    const dwarf = point.id
      ? gameState.dwarves.find((d) => `dwarf:${d.id}` === point.id)
      : gameState.dwarves.find(
          (d) => d.x === point.x && d.y === point.y && d.z === point.z,
        );
    setSelectedDwarfId(dwarf?.id || null);
  };
  const handleMapKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      document.querySelector('[aria-modal="true"]')
    )
      return;
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (directions[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      const [dx, dy] = directions[e.key];
      const next = {
        x: Math.max(0, Math.min(gridWidth - 1, cursor.x + dx)),
        y: Math.max(0, Math.min(gridHeight - 1, cursor.y + dy)),
      };
      setFocusedPointId(null);
      setCursor(next);
      setInspectedCoord({ ...next, z: currentZ });
      setHoveredTile(gameState.grid[currentZ]?.[next.y]?.[next.x] || null);
      focusCell(next.x, next.y);
      if (e.shiftKey) {
        setPending(null);
        setInspectMode(false);
        if (!dragStart) setDragStart(cursor);
        setDragCurrent(next);
      } else {
        setInspectMode(true);
        setDragStart(null);
        setDragCurrent(null);
        setPending(null);
      }
    } else if (e.key === "Tab" && inspectMode && points.length) {
      e.preventDefault();
      e.stopPropagation();
      const index = points.findIndex((p) => p.id === focusedPointId);
      const nextIndex =
        index === -1
          ? e.shiftKey
            ? points.length - 1
            : 0
          : (index + (e.shiftKey ? -1 : 1) + points.length) % points.length;
      inspectPoint(points[nextIndex]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (pending) commitSelection();
      else if (dragStart && dragCurrent) {
        setPending({
          start: dragStart,
          end: dragCurrent,
          z: currentZ,
          tool: selectedTool,
        });
        setDragStart(null);
        setDragCurrent(null);
      } else inspectPoint({ ...cursor, z: currentZ });
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setPending(null);
      setDragStart(null);
      setDragCurrent(null);
      setInspectMode(false);
    }
  };

  return (
    <div className="map-viewport flex flex-col h-full w-full min-h-0 bg-[var(--ui-bg)] font-mono select-none overflow-y-auto text-[var(--ui-text)]">
      <div className="map-toolbar" aria-label="Map controls">
        <span
          className="ui-caption mr-2 text-[var(--ui-muted)]"
          title={currentStratum.name}
        >
          Z-{currentZ} ·{" "}
          {currentZ === 0 ? "Surface" : currentStratum.primaryRock}
        </span>
        <button
          type="button"
          className="ui-button"
          aria-label="Ascend Z-Level"
          disabled={currentZ === 0}
          onClick={() => {
            playTactileSfx("zlevel");
            setCurrentZ((z) => Math.max(0, z - 1));
          }}
        >
          ↑
        </button>
        <button
          type="button"
          className="ui-button"
          aria-label="Descend Z-Level"
          disabled={currentZ >= gameState.world.depth - 1}
          onClick={() => {
            playTactileSfx("zlevel");
            setCurrentZ((z) => Math.min(gameState.world.depth - 1, z + 1));
          }}
        >
          ↓
        </button>
        <div
          className="hidden sm:flex items-center gap-1"
          role="group"
          aria-label="Strata depth selector"
        >
          {gameState.world.strata.map((stratum) => (
            <button
              key={stratum.zLevel}
              type="button"
              aria-pressed={currentZ === stratum.zLevel}
              title={`Z-${stratum.zLevel}: ${stratum.name} (${stratum.primaryRock})`}
              onClick={() => {
                playTactileSfx("zlevel");
                setCurrentZ(stratum.zLevel);
              }}
              className="ui-button !px-1.5 !py-0.5 text-[11px] tabular-nums"
            >
              Z{stratum.zLevel}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ui-button"
          aria-pressed={inspectMode}
          onClick={() => setInspectMode((v) => !v)}
        >
          Inspect
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="ui-button"
            aria-label="Zoom map out"
            onClick={() =>
              updatePreferences({
                mapZoom:
                  [...MAP_ZOOMS].reverse().find((z) => z < scale * 100 - 1) ||
                  MAP_ZOOMS[0],
              })
            }
          >
            −
          </button>
          <output className="ui-caption" aria-label="Current map zoom">
            {Math.round(scale * 100)}%
          </output>
          <button
            type="button"
            className="ui-button"
            aria-label="Zoom map in"
            onClick={() =>
              updatePreferences({
                mapZoom: MAP_ZOOMS.find((z) => z > scale * 100 + 1) || 200,
              })
            }
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="ui-button"
          onClick={() => updatePreferences({ mapZoom: "fit" })}
        >
          Fit
        </button>
        <button
          type="button"
          className="ui-button"
          aria-expanded={mapOptions}
          aria-controls="map-options"
          onClick={() => setMapOptions((v) => !v)}
        >
          Options {mapOptions ? "▴" : "▾"}
        </button>
      </div>
      {mapOptions && (
        <section
          id="map-options"
          aria-label="Map options"
          className="map-settings space-y-3"
        >
          <p className="ui-caption text-[var(--ui-muted)]">
            {currentStratum.name} · {currentStratum.primaryRock}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ui-button"
              aria-pressed={preferences.labels}
              onClick={() => updatePreferences({ labels: !preferences.labels })}
            >
              Labels {preferences.labels ? "on" : "off"}
            </button>
            <button
              type="button"
              className="ui-button"
              aria-pressed={panMode}
              onClick={() => setPanMode((v) => !v)}
            >
              {panMode ? "Pan mode" : "Draw mode"}
            </button>
            <button
              type="button"
              className="ui-button"
              onClick={handleQuickExcavate}
            >
              Mine cliff
            </button>
            <button
              type="button"
              className="ui-button"
              onClick={handleQuickChop}
            >
              Chop timber
            </button>
            <button
              type="button"
              className="ui-button"
              onClick={handleQuickBuildForge}
            >
              Starter workshops
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 ui-caption">
            <span>Find</span>
            <AsciiSelect
              ariaLabel="Find map object"
              value=""
              className="min-w-0 max-w-full"
              onChange={(val) => {
                const point = points.find((p) => p.id === val);
                if (point) {
                  inspectPoint(point);
                  canvasRef.current?.focus();
                }
              }}
              options={[
                { value: "", label: `Visible objects (${points.length})` },
                ...points.map((point) => ({
                  value: point.id,
                  label: `${point.label} (${point.x},${point.y})`,
                })),
              ]}
            />
          </div>
          <details>
            <summary className="ui-caption">Landmarks &amp; map legend</summary>
            <ul className="mt-2 space-y-2">
              {gameState.alerts.slice(0, 6).map((alert) => (
                <li
                  key={alert.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="ui-caption">{alert.title}</span>
                  <button
                    type="button"
                    className="ui-button"
                    aria-label={`Jump to ${alert.title}`}
                    onClick={() => jumpToLocation(alert.x, alert.y, alert.z)}
                  >
                    Go
                  </button>
                </li>
              ))}
            </ul>
            <p className="ui-caption mt-2">
              ☺ Dwarf · g Raider · ☼ Relic · £ Smelter · ⚒ Forge · ♫ Tavern · Ψ
              Temple · ^ Trap
            </p>
          </details>
        </section>
      )}

      {/* Native-size canvas scrolls instead of shrinking glyphs to fit. */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto bg-[var(--ui-bg)] min-h-[180px] min-w-0"
        onScroll={() => {
          if (preferences.labels) setViewport((v) => ({ ...v }));
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="ascii-map-canvas"
          width={Math.ceil(logicalWidth * viewport.dpr)}
          height={Math.ceil(logicalHeight * viewport.dpr)}
          aria-label={`Fortress map, cursor ${cursor.x}, ${cursor.y}, depth ${currentZ}. ${inspectMode ? "Inspection enabled. Tab cycles objects; Escape exits inspection." : "Shift and arrow keys select an order area."}`}
          aria-describedby="map-keyboard-help"
          tabIndex={0}
          onKeyDown={handleMapKey}
          onPointerDown={(e) => {
            if (!panMode) e.currentTarget.setPointerCapture(e.pointerId);
            handleMouseDown(e);
          }}
          onPointerMove={handleMouseMove}
          onPointerUp={handleMouseUp}
          onPointerCancel={() => {
            setDragStart(null);
            setDragCurrent(null);
          }}
          style={{
            touchAction: panMode ? "pan-x pan-y" : "none",
            width: logicalWidth,
            height: logicalHeight,
            maxWidth: "none",
            maxHeight: "none",
            display: "block",
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            const coord = clientToGrid(e.clientX, e.clientY);
            if (coord) {
              setInspectedCoord({ x: coord.x, y: coord.y, z: currentZ });
              setInspectMode(true);
            }
          }}
          onPointerLeave={() => {
            if (dragStart) return;
            setDragStart(null);
            setDragCurrent(null);
          }}
          className={`ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] ${
            panMode
              ? "cursor-grab"
              : inspectMode
                ? "cursor-pointer"
                : "cursor-crosshair"
          }`}
        />
      </div>

      {preview && selection && (
        <section
          aria-label="Order preview"
          className="max-h-[32dvh] shrink-0 overflow-y-auto border-t-2 border-[var(--ui-info)] bg-[var(--ui-panel)] px-3 py-2 text-xs"
        >
          <strong>{getTool(selection.tool).label}</strong>
          <p>
            <span className="text-[var(--ui-success)]">
              + {preview.accepted} eligible
            </span>{" "}
            ·{" "}
            <span className="text-[var(--ui-danger)]">
              × {preview.skipped} blocked
            </span>
            {preview.alreadyDesignated > 0
              ? ` · ${preview.alreadyDesignated} already queued`
              : ""}
          </p>
          <p>
            Queued completion cost: {formatCost(preview.cost)}. Materials
            consumed when built.
          </p>
          {Object.keys(preview.missing).length > 0 && (
            <p className="text-[var(--ui-warning)]">
              Short by {formatCost(preview.missing)}. Orders can be queued while
              supplies are gathered.
            </p>
          )}
          {preview.skipped > 0 && (
            <p>
              {[
                ...new Set(
                  preview.tiles.filter((t) => !t.valid).map((t) => t.reason),
                ),
              ].join(" · ")}
            </p>
          )}
          {pending && (
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={preview.accepted === 0}
                className="border border-[var(--ui-success)] px-3 py-1"
                onClick={commitSelection}
              >
                Queue {preview.accepted}{" "}
                {preview.accepted === 1 ? "tile" : "tiles"}
              </button>
              <button type="button" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          )}
        </section>
      )}
      <p role="status" className="shrink-0 px-3 text-xs text-[var(--ui-info)]">
        {orderStatus}
      </p>
      <details className="shrink-0 px-3 py-1 text-xs text-[var(--ui-muted)]">
        <summary>Keyboard &amp; touch controls</summary>
        <p id="map-keyboard-help">
          Focus map: arrows inspect · Tab cycles objects in inspect mode ·
          Shift+arrows select · Enter previews/confirms · Esc cancels · Pan mode
          scrolls on touch
        </p>
      </details>

      {/* Interactive Tile & Entity Inspector Panel (Shown when Inspect Mode is ON) */}
      {inspectMode && !preview && activeInspect.tile && (
        <div className="max-h-[35dvh] shrink-0 overflow-y-auto bg-[#0c0c0c] border-t-2 border-[var(--ui-accent)] px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-[var(--ui-border)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[var(--ui-accent)] font-bold whitespace-nowrap">
                [ INSPECTOR // ({activeInspect.coord.x},{activeInspect.coord.y}
                ,Z-{activeInspect.coord.z}) ]
              </span>
              <span className="text-[var(--ui-info)] font-bold whitespace-nowrap">
                {activeInspect.tile.revealed
                  ? activeInspect.tile.terrain
                  : "UNEXPLORED ROCK"}
              </span>
              {activeInspect.tile.revealed &&
                activeInspect.tile.resourceDrop && (
                  <span className="text-[var(--ui-warning)] whitespace-nowrap">
                    · YIELD: +{activeInspect.tile.resourceDrop.amount}{" "}
                    {activeInspect.tile.resourceDrop.type}
                  </span>
                )}
              {activeInspect.tile.revealed &&
                activeInspect.tile.terrain === "CAVERN_RELIC" && (
                  <span className="text-[var(--ui-success)] font-bold whitespace-nowrap">
                    · ☼ ANCIENT RELIC (+300 WEALTH &amp; CLAN MIRTH)
                  </span>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {activeInspect.tile.revealed &&
                activeInspect.tile.terrain === "CAVERN_RELIC" && (
                  <button
                    type="button"
                    onClick={() => {
                      playTactileSfx("stamp");
                      designateBox(
                        activeInspect.coord.x,
                        activeInspect.coord.y,
                        activeInspect.coord.x,
                        activeInspect.coord.y,
                        "RECLAIM_RELIC",
                        activeInspect.coord.z,
                      );
                    }}
                    className="px-1.5 py-0.5 border border-[var(--ui-success)] text-[var(--ui-success)] hover:bg-[var(--ui-border)] font-bold whitespace-nowrap shrink-0"
                  >
                    [ ☼ RECLAIM RELIC ]
                  </button>
                )}
              <button
                type="button"
                onClick={() => {
                  playTactileSfx("stamp");
                  designateBox(
                    activeInspect.coord.x,
                    activeInspect.coord.y,
                    activeInspect.coord.x,
                    activeInspect.coord.y,
                    "MINE",
                    activeInspect.coord.z,
                  );
                }}
                className="px-1.5 py-0.5 border border-[var(--ui-border)] text-[var(--ui-warning)] hover:bg-[var(--ui-border)] whitespace-nowrap shrink-0"
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
                    "BUILD_TRAP",
                    activeInspect.coord.z,
                  )
                }
                className="px-1.5 py-0.5 border border-[var(--ui-border)] text-[var(--ui-danger)] hover:bg-[var(--ui-border)] whitespace-nowrap shrink-0"
              >
                [ SET TRAP ]
              </button>
              <button
                type="button"
                onClick={() => setInspectMode(false)}
                className="px-1.5 py-0.5 border border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-bright)] whitespace-nowrap shrink-0"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Dwarf at or near coordinate */}
            {activeInspect.dwarf ? (
              <div className="p-1.5 bg-[var(--ui-bg)] border border-[var(--ui-border)] flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-[var(--ui-bright)]">
                    <span style={{ color: activeInspect.dwarf.color }}>
                      {activeInspect.dwarf.char}
                    </span>{" "}
                    {activeInspect.dwarf.name} ({activeInspect.dwarf.title})
                  </div>
                  <div className="text-[11px] text-[var(--ui-muted)] tabular-nums">
                    HP:{" "}
                    <span className="text-[var(--ui-success)]">
                      {activeInspect.dwarf.hp}/{activeInspect.dwarf.maxHp}
                    </span>{" "}
                    · State:{" "}
                    <span className="text-[var(--ui-info)]">
                      {activeInspect.dwarf.state}
                    </span>{" "}
                    · Gear:{" "}
                    <span className="text-[var(--ui-warning)]">
                      {activeInspect.dwarf.weaponEquipped ? "⚔Axe " : ""}
                      {activeInspect.dwarf.armorEquipped ? "🛡Mail" : ""}
                      {!activeInspect.dwarf.weaponEquipped &&
                      !activeInspect.dwarf.armorEquipped
                        ? "Unarmed"
                        : ""}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--ui-muted)] italic truncate">
                    &ldquo;{activeInspect.dwarf.thought}&rdquo;
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    toggleDwarfLabor(activeInspect.dwarf!.id, "COMBAT")
                  }
                  className={`px-2 py-1 border text-[10px] font-bold whitespace-nowrap shrink-0 ${
                    activeInspect.dwarf.labors.COMBAT
                      ? "border-[var(--ui-danger)] text-[var(--ui-danger)] bg-[var(--ui-border)]"
                      : "border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-bright)]"
                  }`}
                >
                  {activeInspect.dwarf.labors.COMBAT
                    ? "Militia on"
                    : "Draft militia"}
                </button>
              </div>
            ) : (
              <div className="p-1.5 bg-[var(--ui-bg)] border border-[var(--ui-border)] text-[var(--ui-muted)] flex items-center">
                {activeInspect.tile.revealed
                  ? `No dwarf standing at (${activeInspect.coord.x},${activeInspect.coord.y},Z-${activeInspect.coord.z}). Select a visible pioneer to inspect.`
                  : "Unexplored tile. Occupants are unknown."}
              </div>
            )}

            {/* Hostile at or near coordinate */}
            {activeInspect.hostile ? (
              <div className="p-1.5 bg-[#150000] border border-[var(--ui-danger)] flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-[var(--ui-danger)]">
                    [{activeInspect.hostile.char}] {activeInspect.hostile.name}{" "}
                    ({activeInspect.hostile.kind})
                  </div>
                  <div className="text-[11px] text-[var(--ui-text)] tabular-nums">
                    HP:{" "}
                    <strong className="text-[var(--ui-danger)]">
                      {activeInspect.hostile.hp}/{activeInspect.hostile.maxHp}
                    </strong>{" "}
                    · ATK: <strong>{activeInspect.hostile.attack}</strong> · AI:{" "}
                    {activeInspect.hostile.behavior}
                  </div>
                </div>
                <span className="text-[10px] text-[var(--ui-warning)] font-bold whitespace-nowrap shrink-0">
                  [ ! HOSTILE THREAT ]
                </span>
              </div>
            ) : (
              <div className="p-1.5 bg-[var(--ui-bg)] border border-[var(--ui-border)] text-[var(--ui-muted)] flex items-center">
                {activeInspect.tile.revealed
                  ? "No hostile visible on this tile."
                  : "Explore this tile before assessing threats."}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="ui-caption flex shrink-0 items-center gap-3 overflow-hidden border-t border-[var(--ui-border)] px-3 py-1 text-[var(--ui-muted)]">
        <span className="shrink-0 text-[var(--ui-accent)]">
          {inspectMode ? "Inspect" : TOOL_NAMES[selectedTool]}
        </span>
        <span className="truncate">
          {hoveredTile
            ? `${hoveredTile.x},${hoveredTile.y} · ${hoveredTile.revealed ? hoveredTile.terrain.replaceAll("_", " ").toLowerCase() : "unexplored"}`
            : "Drag to queue · I to inspect"}
        </span>
      </div>
    </div>
  );
}
