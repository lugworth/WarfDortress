"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useGame } from "./GameProvider";
import { DesignationType, DwarfEntity, HostileEntity, Tile } from "@/lib/types";
import { ISOTOPE, STONE_WALL_FOREGROUNDS } from "@/lib/colors";
import {
  canDesignateTile,
  getBuildingTileFunctionInfo,
  getConstructionCost,
} from "@/lib/game-engine";
import { TOOL_KEYS } from "@/lib/game-rules";
import {
  getDesignationPreview,
  getMapPoints,
  getTileHoverMetadata,
  TOOL_GLYPHS,
} from "@/lib/ui-model";
import { formatCost, getTool } from "@/lib/tool-catalog";
import { TOOL_NAMES } from "@/lib/ui-labels";
import { useUI } from "./UIProvider";
import AsciiSelect from "./AsciiSelect";
import FortressSupplies from "./FortressSupplies";
import { playTactileSfx } from "@/lib/audio";
import { getWeatherTileVisuals } from "@/lib/weather";
import { ensureMilitiaState } from "@/lib/militia";


const PRIMARY_FAB_TOOLS: Array<{
  id: DesignationType;
  shortLabel: string;
  hotkey: string;
  accent: string;
}> = [
  { id: "MINE", shortLabel: "Mine", hotkey: "D", accent: "text-[#ff9900]" },
  { id: "CHOP", shortLabel: "Chop", hotkey: "T", accent: "text-[#33ff00]" },
  { id: "GATHER", shortLabel: "Gather", hotkey: "G", accent: "text-[#33ff00]" },
  { id: "STAIRS", shortLabel: "Stairs", hotkey: "X", accent: "text-[#ff0099]" },
  { id: "STOCKPILE", shortLabel: "Stock", hotkey: "P", accent: "text-[#00ffff]" },

];

const SECONDARY_FAB_TOOLS: Array<{
  id: DesignationType;
  shortLabel: string;
  hotkey: string;
  accent: string;
}> = [
  { id: "BUILD_WALL", shortLabel: "Wall", hotkey: "W", accent: "text-[#ffffff]" },
  { id: "BUILD_DOOR", shortLabel: "Door", hotkey: "O", accent: "text-[#ff9900]" },
  { id: "BUILD_TRAP", shortLabel: "Trap", hotkey: "E", accent: "text-[#ff0000]" },
  { id: "BUILD_FARM", shortLabel: "Farm", hotkey: "A", accent: "text-[#33ff00]" },
  { id: "MILITIA_STATION", shortLabel: "Station", hotkey: "J", accent: "text-[#ff0000]" },
  { id: "MILITIA_PATROL", shortLabel: "Patrol", hotkey: "N", accent: "text-[#00ffff]" },
  { id: "BUILD_BED", shortLabel: "Bed", hotkey: "B", accent: "text-[#00ffff]" },
  { id: "BUILD_MASON", shortLabel: "Mason", hotkey: "M", accent: "text-[#d0d0d0]" },
  { id: "BUILD_CARPENTER", shortLabel: "Carpenter", hotkey: "C", accent: "text-[#ff9900]" },
  { id: "BUILD_STILL", shortLabel: "Still", hotkey: "S", accent: "text-[#cc00ff]" },
  { id: "BUILD_SMELTER", shortLabel: "Smeltery", hotkey: "L", accent: "text-[#ff9900]" },
  { id: "BUILD_FORGE", shortLabel: "Forge", hotkey: "F", accent: "text-[#00ffff]" },
  { id: "BUILD_TAVERN", shortLabel: "Tavern", hotkey: "V", accent: "text-[#cc00ff]" },
  { id: "BUILD_TEMPLE", shortLabel: "Temple", hotkey: "Y", accent: "text-[#ff9900]" },
  { id: "BUILD_DEPOT", shortLabel: "Depot", hotkey: "U", accent: "text-[#ff0099]" },
  { id: "RECLAIM_RELIC", shortLabel: "Relic", hotkey: "R", accent: "text-[#ff0099]" },
];

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
  MILITIA_STATION: { char: "♦", color: ISOTOPE.base08 },
  MILITIA_PATROL: { char: "»", color: ISOTOPE.base0C },
  CANCEL: { char: " ", color: ISOTOPE.base08 },
};

export default function ASCIIViewport() {
  const { preferences, updatePreferences } = useUI();
  const {
    gameState,
    progression,
    currentZ,
    setCurrentZ,
    selectedTool,
    setSelectedTool,
    selectedDwarfId,
    setSelectedDwarfId,
    inspectMode,
    setInspectMode,
    inspectedCoord,
    setInspectedCoord,
    pingTarget,
    designateBox,
    toggleDwarfLabor,
    togglePause,
    jumpToLocation,
    cycleSeasonWeather,
    activateBuildingFunction,
  } = useGame();


  // Hover is view state; it must not invalidate every game-context consumer.
  const [hoveredCoord, setHoveredCoord] = useState<{ x: number; y: number; z: number } | null>(null);
  const hoveredTile = hoveredCoord ? gameState.grid[hoveredCoord.z]?.[hoveredCoord.y]?.[hoveredCoord.x] ?? null : null;
  const setHoveredTile = useCallback((tile: Tile | null) => setHoveredCoord(previous => {
    if (!tile) return previous === null ? previous : null;
    return previous?.x === tile.x && previous.y === tile.y && previous.z === tile.z
      ? previous : { x: tile.x, y: tile.y, z: tile.z };
  }), []);
  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const suppliesRef = useRef<HTMLDivElement>(null);
  const [suppliesHeight, setSuppliesHeight] = useState(42);
  const [dockHeight, setDockHeight] = useState(62);
  const panOrigin = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 960, height: 640, dpr: 1 });
  const [mapOptions, setMapOptions] = useState(false);
  const [showBuildDrawer, setShowBuildDrawer] = useState(false);
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
  if (selectionContext !== contextKey) {
    setSelectionContext(contextKey);
    setPending(null);
    setDragStart(null);
    setDragCurrent(null);
  }

  const buildingUnlocks = progression.buildingUnlocks;
  const unlockByTool = useMemo(() => new Map(buildingUnlocks.map(status => [status.tool, status])), [buildingUnlocks]);
  const gridWidth = gameState.world.width;
  const gridHeight = gameState.world.height;
  const zoom = preferences.mapZoom === "fit" ? null : preferences.mapZoom / 100;
  const CELL_W = zoom ? 14 * zoom : viewport.width / gridWidth;
  const CELL_H = zoom ? 18 * zoom : viewport.height / gridHeight;
  const scale = Math.min(CELL_W / 14, CELL_H / 18);
  const logicalWidth = Math.max(viewport.width, CELL_W * gridWidth);
  const logicalHeight = Math.max(viewport.height, CELL_H * gridHeight);
  const points = useMemo(
    () => preferences.labels || inspectMode || mapOptions ? getMapPoints(gameState, currentZ) : [],
    [gameState, currentZ, preferences.labels, inspectMode, mapOptions],
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
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const update = () => {
      const toolHeight = toolbarRef.current?.offsetHeight;
      const resourceHeight = suppliesRef.current?.offsetHeight;
      if (toolHeight) setDockHeight(toolHeight);
      if (resourceHeight) setSuppliesHeight(resourceHeight);
    };
    const observer = new ResizeObserver(update);
    observer.observe(toolbar);
    if (scrollRef.current) observer.observe(scrollRef.current);
    if (suppliesRef.current) observer.observe(suppliesRef.current);
    update();
    return () => observer.disconnect();
  }, []);

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
          Math.floor((clientX - rect.left) / CELL_W),
        ),
      );
      const gy = Math.max(
        0,
        Math.min(
          gridHeight - 1,
          Math.floor((clientY - rect.top) / CELL_H),
        ),
      );
      return { x: gx, y: gy };
    },
    [gridWidth, gridHeight, CELL_W, CELL_H],
  );

  // Keyboard shortcuts for intuitive Dwarf Fortress control
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "Escape" && !document.querySelector('[aria-modal="true"]')) {
        setMapOptions(false);
        setShowBuildDrawer(false);
      }
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
        const candidateTool = TOOL_KEYS[e.key.toLowerCase()];
        const unlockInfo = unlockByTool.get(candidateTool);
        if (unlockInfo && !unlockInfo.unlocked) {
          setOrderStatus(
            `Locked Blueprint: ${unlockInfo.title} requires ${unlockInfo.requirementLabel} (${unlockInfo.progressText}).`,
          );
          return;
        }
        setSelectedTool(candidateTool);
        setInspectMode(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    gameState,
    setCurrentZ,
    setInspectMode,
    setSelectedTool,
    togglePause,
    jumpToLocation,
    unlockByTool,
  ]);


  // The simulation copies only the rows it changes, so an underground level keeps
  // its identity until something on it changes. Surface weather animates per tick.
  const terrainLevel = gameState.grid[currentZ];
  const weatherFrame = currentZ === 0 ? gameState : null;

  // Draw the ASCII Grid, Designations, Selection Box, Hostiles, and Dwarves
  useEffect(() => {
    if (logicalWidth <= 0 || logicalHeight <= 0) return;
    const canvas = terrainCanvasRef.current ?? document.createElement('canvas');
    terrainCanvasRef.current = canvas;
    const width = Math.ceil(logicalWidth * viewport.dpr);
    const height = Math.ceil(logicalHeight * viewport.dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const level = terrainLevel;
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

        const weatherVis = weatherFrame ? getWeatherTileVisuals(weatherFrame, tile) : null;
        const effectiveBg = weatherVis ? weatherVis.bg : tile.bg;
        const effectiveFg = weatherVis ? weatherVis.fg : STONE_WALL_FOREGROUNDS[tile.terrain] ?? tile.fg;
        const effectiveChar = weatherVis ? weatherVis.char : tile.char;

        // Tile background
        ctx.fillStyle = effectiveBg === "#000000" ? palette.bg : effectiveBg;
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
            des?.char || effectiveChar,
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
              : effectiveFg;
          ctx.fillText(effectiveChar, px + CELL_W / 2, py + CELL_H / 2);

          // Draw seasonal weather precipitation particles (snowflakes / rain streaks) on Z-0
          if (weatherVis?.particleChar && weatherVis?.particleFg) {
            ctx.save();
            ctx.globalAlpha = 0.65;
            ctx.fillStyle = weatherVis.particleFg;
            ctx.fillText(
              weatherVis.particleChar,
              px + CELL_W * 0.72,
              py + CELL_H * 0.3,
            );
            ctx.restore();
          }
          ctx.globalAlpha = 1;
        }
      }
    }


  }, [terrainLevel, weatherFrame, gridWidth, gridHeight, CELL_W, CELL_H, logicalWidth, logicalHeight, viewport.dpr, scale, palette, preferences.theme, fontReady]);

  // Composite cached terrain with changing creatures, selection, and hover feedback.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || logicalWidth <= 0 || logicalHeight <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const level = gameState.grid[currentZ];
    if (!level) return;
    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    const terrain = terrainCanvasRef.current;
    if (terrain?.width && terrain.height) ctx.drawImage(terrain, 0, 0, logicalWidth, logicalHeight);
    ctx.font = `bold ${13 * scale}px "Fortress Mono", "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

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

    // 5b. Render Active Militia Squad Station / Patrol Orders on current Z-level
    const militia = ensureMilitiaState(gameState);
    for (const squad of Object.values(militia.squads)) {
      if (squad.order.type === "STATION" && squad.order.z === currentZ) {
        const sx = squad.order.x * CELL_W;
        const sy = squad.order.y * CELL_H;
        ctx.strokeStyle = squad.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx - 1, sy - 1, CELL_W + 2, CELL_H + 2);
        ctx.fillStyle = squad.color;
        ctx.fillText(squad.glyph, sx + CELL_W / 2, sy + CELL_H / 2);
      } else if (
        squad.order.type === "PATROL" &&
        squad.order.z === currentZ
      ) {
        const ax = squad.order.x * CELL_W;
        const ay = squad.order.y * CELL_H;
        ctx.strokeStyle = squad.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ax - 1, ay - 1, CELL_W + 2, CELL_H + 2);
        if (squad.order.x2 !== undefined && squad.order.y2 !== undefined) {
          const bx = squad.order.x2 * CELL_W;
          const by = squad.order.y2 * CELL_H;
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = squad.color;
          ctx.beginPath();
          ctx.moveTo(ax + CELL_W / 2, ay + CELL_H / 2);
          ctx.lineTo(bx + CELL_W / 2, by + CELL_H / 2);
          ctx.stroke();
          ctx.restore();
          ctx.strokeRect(bx - 1, by - 1, CELL_W + 2, CELL_H + 2);
        }
      }
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
    gameState,
  ]);


  const handleMouseDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panMode || e.button === 1) {
      const container = scrollRef.current;
      if (container) panOrigin.current = { x: e.clientX, y: e.clientY, left: container.scrollLeft, top: container.scrollTop };
      e.preventDefault();
      return;
    }
    e.currentTarget.focus();
    setPending(null);
    const coord = clientToGrid(e.clientX, e.clientY);
    if (!coord) return;
    setCursor(coord);
    setHoveredTile(gameState.grid[currentZ]?.[coord.y]?.[coord.x] ?? null);

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
    if (panOrigin.current && scrollRef.current) {
      scrollRef.current.scrollLeft = panOrigin.current.left - (e.clientX - panOrigin.current.x);
      scrollRef.current.scrollTop = panOrigin.current.top - (e.clientY - panOrigin.current.y);
      return;
    }
    if (panMode) return;
    const coord = clientToGrid(e.clientX, e.clientY);
    if (!coord) return;
    if (dragStart && !inspectMode) {
      setDragCurrent(previous => previous?.x === coord.x && previous.y === coord.y ? previous : coord);
    }
    const tile = gameState.grid[currentZ]?.[coord.y]?.[coord.x] || null;
    if (e.pointerType !== "touch") setHoveredTile(tile);
  };

  const handleMouseUp = () => {
    panOrigin.current = null;
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
    const tools = (["BUILD_SMELTER", "BUILD_FORGE", "BUILD_TAVERN"] as const).filter(
      (tool) => unlockByTool.get(tool)?.unlocked !== false,
    );
    const queued = tools.filter((tool, index) => {
      const site = sites[index];
      return site ? designateBox(site.x, site.y, site.x, site.y, tool, 0) > 0 : false;
    });
    setOrderStatus(
      queued.length
        ? `Queued ${queued.map((tool) => TOOL_NAMES[tool]).join(", ")} near the clan.`
        : "No starter workshop blueprints are unlocked yet. Open Goals to see requirements.",
    );
  };

  // One-tile orders from the inspector explain why they were refused.
  const designateFromInspector = (
    tool: DesignationType,
    x: number,
    y: number,
    z: number,
    x2 = x,
  ) => {
    const unlockInfo = unlockByTool.get(tool);
    if (unlockInfo && !unlockInfo.unlocked) {
      setOrderStatus(
        `Locked Blueprint: ${unlockInfo.title} requires ${unlockInfo.requirementLabel} (${unlockInfo.progressText}).`,
      );
      return;
    }
    playTactileSfx("stamp");
    const count = designateBox(x, y, x2, y, tool, z);
    setOrderStatus(
      count > 0
        ? `Queued ${TOOL_NAMES[tool]} at (${x},${y},Z-${z}).`
        : `${TOOL_NAMES[tool]} cannot be placed on this tile.`,
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
      setMapOptions(false);
      setShowBuildDrawer(false);
      setPending(null);
      setDragStart(null);
      setDragCurrent(null);
      setInspectMode(false);
    }
  };

  const isSecondaryToolActive = SECONDARY_FAB_TOOLS.some(
    (t) => t.id === selectedTool,
  );
  const unlockedTierBuildingsCount = useMemo(
    () => buildingUnlocks.filter((b) => b.tier > 0 && b.unlocked).length,
    [buildingUnlocks],
  );
  const totalTierBuildingsCount = useMemo(
    () => buildingUnlocks.filter((b) => b.tier > 0).length,
    [buildingUnlocks],
  );

  const hoverMeta = useMemo(
    () =>
      hoveredTile && hoveredTile.z === currentZ
        ? getTileHoverMetadata(gameState, hoveredTile)
        : null,
    [gameState, hoveredTile, currentZ],
  );


  return (
    <div
      className="map-viewport flex flex-col flex-1 h-full w-full min-h-0 min-w-0 bg-[var(--ui-bg)] font-mono select-none overflow-hidden text-[var(--ui-text)]"
    >
      {/* Screen-reader keyboard help */}
      <p id="map-keyboard-help" className="sr-only">
        Focus map: arrows inspect, Tab cycles objects in inspect mode, Shift and
        arrows select, Enter confirms, Escape cancels.
      </p>

      <div className="map-toolbar map-topbar" aria-label="Map depth and options">
        <div className="map-depth-controls">
          <button type="button" aria-label="Ascend Z-Level" disabled={currentZ === 0}
            onClick={() => setCurrentZ(z => Math.max(0, z - 1))}>↑</button>
          <AsciiSelect<number> ariaLabel="Map depth" value={currentZ}
            onChange={z => setCurrentZ(z)}
            options={gameState.world.strata.map(st => ({ value: st.zLevel,
              label: `Z-${st.zLevel} · ${st.zLevel === 0 ? 'Surface' : st.primaryRock}` }))} />
          <button type="button" aria-label="Descend Z-Level" disabled={currentZ >= gameState.world.depth - 1}
            onClick={() => setCurrentZ(z => Math.min(gameState.world.depth - 1, z + 1))}>↓</button>
        </div>
        <span className="map-tool-label">{inspectMode ? 'Inspecting' : TOOL_NAMES[selectedTool]}</span>
        <button type="button" aria-expanded={mapOptions} aria-controls="map-options"
          onClick={() => { setMapOptions(v => !v); setShowBuildDrawer(false); setInspectMode(false); }}>
          Map options {mapOptions ? '−' : '+'}
        </button>
      </div>
      <div className="map-surface" style={{ '--tool-dock-height': `${dockHeight}px`, '--supplies-hud-height': `${suppliesHeight}px` } as React.CSSProperties}>
      <div ref={suppliesRef} className="map-supplies"><FortressSupplies /></div>
      <div className="map-stage" ref={scrollRef}>
      {/* Full-Container Auto-Scaled ASCII Canvas (Zero Scrollbars) */}
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
          e.currentTarget.setPointerCapture(e.pointerId);
          handleMouseDown(e);
        }}
        onPointerMove={handleMouseMove}
        onPointerUp={handleMouseUp}
        onPointerCancel={() => {
          panOrigin.current = null;
          setDragStart(null);
          setDragCurrent(null);
        }}
        style={{
          touchAction: "none",
          width: logicalWidth,
          height: logicalHeight,
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
          setHoveredTile(null);
          if (dragStart) return;
          setDragStart(null);
          setDragCurrent(null);
        }}
        className={`block w-full h-full bg-[var(--ui-bg)] ${
          panMode ? "cursor-grab" : inspectMode ? "cursor-pointer" : "cursor-crosshair"
        }`}
      />

      {/* FLOATING TOP-LEFT DRAWER: Quick Automation Presets & Object Finder */}
      {mapOptions && (
        <section
          id="map-options"
          aria-label="Map options"
          className="pointer-events-auto map-context-card absolute top-2 left-2 z-30 w-80 max-w-[calc(100vw-1.5rem)] bg-[#0c0c0c]/95 backdrop-blur-md border border-[#ff0099] p-2.5 shadow-2xl space-y-2.5 text-xs"
        >
          <div className="flex items-center justify-between border-b border-[#202020] pb-1">
            <span className="text-[#ff0099] font-bold">
              Map options & quick orders
            </span>
            <button
              type="button"
              onClick={() => setMapOptions(false)}
              className="text-[#808080] hover:text-[#ffffff] px-1"
            >
              ×
            </button>
          </div>
          <p className="text-[11px] text-[#808080]">
            {currentStratum.name} · Primary Rock: {currentStratum.primaryRock}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={panMode} onClick={() => setPanMode(v => !v)} className="ui-button">Pan map {panMode ? 'ON' : 'OFF'}</button>
            <button type="button" onClick={cycleSeasonWeather} className="ui-button">Cycle season & weather</button>
        <button
          type="button"
          aria-pressed={preferences.labels}
          onClick={() => updatePreferences({ labels: !preferences.labels })}
          className={`px-1.5 py-0.5 text-[11px] border transition-colors ${
            preferences.labels
              ? "border-[#00ffff] bg-[#081c20] text-[#00ffff]"
              : "border-[#222222] bg-[#000000] text-[#808080] hover:text-[#d0d0d0]"
          }`}
          title={
            preferences.tooltips
              ? "Toggle floating entity & workshop tags on map"
              : undefined
          }
        >
          Tags {preferences.labels ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          data-testid="toggle-tooltips-btn"
          aria-pressed={preferences.tooltips}
          onClick={() => updatePreferences({ tooltips: !preferences.tooltips })}
          className={`px-1.5 py-0.5 text-[11px] border transition-colors ${
            preferences.tooltips
              ? "border-[#33ff00] bg-[#081c0c] text-[#33ff00]"
              : "border-[#222222] bg-[#000000] text-[#808080] hover:text-[#d0d0d0]"
          }`}
          title="Toggle hover tile inspector & UI tooltips"
        >
          Tips {preferences.tooltips ? "ON" : "OFF"}
        </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="px-2 py-1 border border-[#2a2a2a] bg-[#000000] text-[#ff9900] hover:border-[#ff9900]"
              onClick={() => {
                handleQuickExcavate();
                setMapOptions(false);
              }}
            >
              [ ⛏ Mine Cliff ]
            </button>
            <button
              type="button"
              className="px-2 py-1 border border-[#2a2a2a] bg-[#000000] text-[#33ff00] hover:border-[#33ff00]"
              onClick={() => {
                handleQuickChop();
                setMapOptions(false);
              }}
            >
              [ × Chop Timber ]
            </button>
            <button
              type="button"
              className="px-2 py-1 border border-[#2a2a2a] bg-[#000000] text-[#00ffff] hover:border-[#00ffff]"
              onClick={() => {
                handleQuickBuildForge();
                setMapOptions(false);
              }}
            >
              [ ⚒ Starter Workshops ]
            </button>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-[#202020]">
            <span className="text-[#808080] text-[11px] shrink-0">Locate:</span>
            <AsciiSelect
              ariaLabel="Find map object"
              value=""
              className="min-w-0 flex-1"
              onChange={(val) => {
                const point = points.find((p) => p.id === val);
                if (point) {
                  inspectPoint(point);
                  setMapOptions(false);
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
          <div className="text-[10px] text-[#808080] pt-1 border-t border-[#202020]">
            ☺ Dwarf · g Raider · ☼ Relic · £ Smelter · ⚒ Forge · ♫ Tavern · Ψ
            Temple · ^ Trap
          </div>
        </section>
      )}

      {/* FLOATING ORDER PREVIEW & CONFIRMATION CARD (Above FAB Dock) */}
      {preview && selection && (
        <section
          aria-label="Order preview"
          className="pointer-events-auto map-context-card absolute bottom-2 left-1/2 -translate-x-1/2 z-30 w-[min(92vw,500px)] bg-[#0c0c0c]/95 backdrop-blur-md border-2 border-[#00ffff] p-3 shadow-2xl text-xs space-y-1.5"
        >
          <div className="flex items-center justify-between gap-2">
            <strong className="text-[#00ffff] text-sm">
              {TOOL_GLYPHS[selection.tool]} {getTool(selection.tool).label}
            </strong>
            <span className="tabular-nums text-[11px]">
              <span className="text-[#33ff00] font-bold">
                +{preview.accepted} eligible
              </span>{" "}
              ·{" "}
              <span className="text-[#ff0000]">
                ×{preview.skipped} blocked
              </span>
              {preview.alreadyDesignated > 0
                ? ` · ${preview.alreadyDesignated} queued`
                : ""}
            </span>
          </div>
          <p className="text-[#d0d0d0] text-[11px]">
            Cost: <span className="text-[#ff9900]">{formatCost(preview.cost)}</span>{" "}
            <span className="text-[#808080]">(consumed when built)</span>
          </p>
          {Object.keys(preview.missing).length > 0 && (
            <p className="text-[#ff9900] text-[11px]">
              Short by {formatCost(preview.missing)} — order will wait for supplies.
            </p>
          )}
          {preview.skipped > 0 && (
            <p className="text-[#808080] text-[11px] truncate">
              {[
                ...new Set(
                  preview.tiles.filter((t) => !t.valid).map((t) => t.reason),
                ),
              ].join(" · ")}
            </p>
          )}
          {pending && (
            <div className="pt-1.5 flex items-center justify-end gap-2 border-t border-[#202020]">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="px-2.5 py-1 border border-[#2a2a2a] text-[#808080] hover:text-[#ffffff]"
              >
                [ Esc: Cancel ]
              </button>
              <button
                type="button"
                disabled={preview.accepted === 0}
                onClick={commitSelection}
                className="px-3 py-1 border border-[#33ff00] bg-[#0a200a] text-[#33ff00] font-bold hover:bg-[#143814] disabled:opacity-40"
              >
                [ Enter: Queue {preview.accepted}{" "}
                {preview.accepted === 1 ? "Tile" : "Tiles"} ]
              </button>
            </div>
          )}
        </section>
      )}

      {/* FLOATING INSPECTOR CARD (Shown when Inspect Mode is ON) */}
      {inspectMode && !preview && activeInspect.tile && (
        <div className="pointer-events-auto map-context-card absolute bottom-2 left-1/2 -translate-x-1/2 z-30 w-[min(94vw,640px)] bg-[#0c0c0c]/95 backdrop-blur-md border-2 border-[#ff0099] p-3 shadow-2xl text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 mb-2 border-b border-[#202020]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[#ff0099] font-bold whitespace-nowrap">
                [ INSPECT ({activeInspect.coord.x},{activeInspect.coord.y},Z-
                {activeInspect.coord.z}) ]
              </span>
              <span className="text-[#00ffff] font-bold whitespace-nowrap">
                {activeInspect.tile.revealed
                  ? activeInspect.tile.terrain
                  : "UNEXPLORED ROCK"}
              </span>
              {activeInspect.tile.revealed &&
                activeInspect.tile.resourceDrop && (
                  <span className="text-[#ff9900] whitespace-nowrap">
                    · +{activeInspect.tile.resourceDrop.amount}{" "}
                    {activeInspect.tile.resourceDrop.type}
                  </span>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {activeInspect.tile.revealed &&
                activeInspect.tile.terrain === "CAVERN_RELIC" && (
                  <button
                    type="button"
                    onClick={() =>
                      designateFromInspector(
                        "RECLAIM_RELIC",
                        activeInspect.coord.x,
                        activeInspect.coord.y,
                        activeInspect.coord.z,
                      )
                    }
                    className="px-1.5 py-0.5 border border-[#33ff00] text-[#33ff00] hover:bg-[#202020] font-bold"
                  >
                    [ ☼ RECLAIM RELIC ]
                  </button>
                )}
              <button
                type="button"
                onClick={() =>
                  designateFromInspector(
                    "MINE",
                    activeInspect.coord.x,
                    activeInspect.coord.y,
                    activeInspect.coord.z,
                  )
                }
                className="px-1.5 py-0.5 border border-[#2a2a2a] text-[#ff9900] hover:border-[#ff9900]"
              >
                [ ⛏ MINE ]
              </button>
              <button
                type="button"
                onClick={() =>
                  designateFromInspector(
                    "BUILD_TRAP",
                    activeInspect.coord.x,
                    activeInspect.coord.y,
                    activeInspect.coord.z,
                  )
                }
                className="px-1.5 py-0.5 border border-[#2a2a2a] text-[#ff0000] hover:border-[#ff0000]"
              >
                [ ^ TRAP ]
              </button>
              <button
                type="button"
                data-testid="inspect-station-squad-btn"
                onClick={() =>
                  designateFromInspector(
                    "MILITIA_STATION",
                    activeInspect.coord.x,
                    activeInspect.coord.y,
                    activeInspect.coord.z,
                  )
                }
                className="px-1.5 py-0.5 border border-[#2a2a2a] text-[#ff0000] hover:border-[#ff0000]"
              >
                [ ♦ STATION SQUAD ]
              </button>
              <button
                type="button"
                data-testid="inspect-patrol-squad-btn"
                onClick={() =>
                  designateFromInspector(
                    "MILITIA_PATROL",
                    activeInspect.coord.x,
                    activeInspect.coord.y,
                    activeInspect.coord.z,
                    Math.min(gridWidth - 1, activeInspect.coord.x + 5),
                  )
                }
                className="px-1.5 py-0.5 border border-[#2a2a2a] text-[#00ffff] hover:border-[#00ffff]"
              >
                [ » PATROL HERE ]
              </button>
              <button
                type="button"
                onClick={() => setInspectMode(false)}
                className="px-1.5 py-0.5 border border-[#2a2a2a] text-[#808080] hover:text-[#ffffff]"
              >
                [ × Close ]
              </button>
            </div>
          </div>

          {activeInspect.tile.revealed && (() => {
            const meta = getTileHoverMetadata(gameState, activeInspect.tile);
            return <p className="inspector-material">{meta.materialType} · {meta.temperature} · {meta.liquidLevel}</p>;
          })()}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {activeInspect.dwarf ? (
              <div className="p-2 bg-[#050505] border border-[#222222] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-[#ffffff] truncate">
                    <span style={{ color: activeInspect.dwarf.color }}>
                      {activeInspect.dwarf.char}
                    </span>{" "}
                    {activeInspect.dwarf.name} ({activeInspect.dwarf.title})
                  </div>
                  <div className="text-[11px] text-[#808080] tabular-nums">
                    HP{" "}
                    <span className="text-[#33ff00]">
                      {activeInspect.dwarf.hp}/{activeInspect.dwarf.maxHp}
                    </span>{" "}
                    ·{" "}
                    <span className="text-[#00ffff]">
                      {activeInspect.dwarf.state}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    toggleDwarfLabor(activeInspect.dwarf!.id, "COMBAT")
                  }
                  className={`px-2 py-1 border text-[10px] font-bold shrink-0 ${
                    activeInspect.dwarf.labors.COMBAT
                      ? "border-[#ff0000] text-[#ff0000] bg-[#200808]"
                      : "border-[#2a2a2a] text-[#808080] hover:text-[#ffffff]"
                  }`}
                >
                  {activeInspect.dwarf.labors.COMBAT ? "Militia ON" : "Draft"}
                </button>
              </div>
            ) : (
              <div className="p-2 bg-[#050505] border border-[#222222] text-[#808080] flex items-center">
                No dwarf at ({activeInspect.coord.x},{activeInspect.coord.y},Z-
                {activeInspect.coord.z}).
              </div>
            )}

            {activeInspect.hostile ? (
              <div className="p-2 bg-[#150000] border border-[#ff0000] flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-[#ff0000]">
                    [{activeInspect.hostile.char}] {activeInspect.hostile.name}
                  </div>
                  <div className="text-[11px] text-[#d0d0d0] tabular-nums">
                    HP {activeInspect.hostile.hp}/{activeInspect.hostile.maxHp} ·
                    ATK {activeInspect.hostile.attack}
                  </div>
                </div>
                <span className="text-[10px] text-[#ff9900] font-bold">
                  [ ! HOSTILE ]
                </span>
              </div>
            ) : (
              <div className="p-2 bg-[#050505] border border-[#222222] text-[#808080] flex items-center">
                No hostile threat on this tile.
              </div>
            )}
          </div>

          {(() => {
            const buildingFn = activeInspect.tile.revealed
              ? getBuildingTileFunctionInfo(gameState, activeInspect.tile)
              : null;
            if (!buildingFn) return null;
            return (
              <div
                data-testid="inspect-building-function"
                className="mt-2 p-2 bg-[#051014] border border-[#00ffff]/70 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-[#00ffff]">
                    [ TILE FUNCTION ] {buildingFn.passiveFunction}
                  </div>
                  <div className="text-[10px] text-[#d0d0d0]">
                    {buildingFn.actionDescription} · Cost:{" "}
                    <span className="text-[#ff9900] font-bold">
                      {formatCost(buildingFn.cost)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="activate-building-fn-btn"
                  disabled={!buildingFn.canActivate}
                  onClick={() => {
                    playTactileSfx("stamp");
                    const res = activateBuildingFunction(
                      activeInspect.coord.x,
                      activeInspect.coord.y,
                      activeInspect.coord.z,
                    );
                    setOrderStatus(res.message);
                  }}
                  className="px-2.5 py-1 border border-[#33ff00] bg-[#0a220a] text-[#33ff00] hover:bg-[#143814] disabled:opacity-40 disabled:border-[#444444] disabled:text-[#808080] font-bold text-[11px] shrink-0"
                >
                  [ {buildingFn.actionLabel}{buildingFn.readyInTicks > 0 ? ` · ready in ${buildingFn.readyInTicks}t` : ""} ]
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* FLOATING POP-UP DRAWER: Workshops & Civic Structures (With Building Unlock Progression) */}
      {showBuildDrawer && (
        <div
          data-testid="workshops-build-drawer"
          aria-label="Workshops and civic structures"
          className="pointer-events-auto map-context-card absolute bottom-2 left-1/2 -translate-x-1/2 z-30 w-[min(94vw,660px)] bg-[#0c0c0c]/95 backdrop-blur-md border border-[#ff0099] p-2.5 shadow-2xl space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#222222] text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#ff0099] font-bold">
                [ BUILD &amp; DEFENSE ]
              </span>
              <span className="text-[10px] text-[#00ffff] tabular-nums">
                UNLOCKED: {unlockedTierBuildingsCount}/{totalTierBuildingsCount}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowBuildDrawer(false)}
              className="text-[#808080] hover:text-[#ffffff] px-1"
            >
              [ × Close ]
            </button>
          </div>
          <p className="text-[10px] text-[#808080]">
            Gather Stone, Wood, Iron Ore, and Steel Bars to unlock higher-tier workshops and civic halls.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {SECONDARY_FAB_TOOLS.map((item) => {
              const active = !inspectMode && selectedTool === item.id;
              const cost = getConstructionCost(item.id);
              const costLabel = formatCost(cost);
              const unlockInfo = unlockByTool.get(item.id);
              const isLocked = Boolean(unlockInfo && !unlockInfo.unlocked);
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`build-tool-${item.id}`}
                  aria-pressed={active}
                  title={
                    preferences.tooltips
                      ? isLocked && unlockInfo
                        ? `LOCKED: ${unlockInfo.title} — ${unlockInfo.requirementLabel} (${unlockInfo.progressText})`
                        : `${TOOL_NAMES[item.id]} (${costLabel}) — Hotkey ${item.hotkey}`
                      : undefined
                  }
                  onClick={() => {
                    if (isLocked && unlockInfo) {
                      setOrderStatus(
                        `Locked Blueprint: ${unlockInfo.title} requires ${unlockInfo.requirementLabel} (${unlockInfo.progressText}).`,
                      );
                      return;
                    }
                    playTactileSfx("tool");
                    setInspectMode(false);
                    setSelectedTool(item.id);
                    setShowBuildDrawer(false);
                  }}
                  className={`flex flex-col items-start justify-between p-1.5 border text-left transition-all ${
                    isLocked
                      ? "border-[#222222] bg-[#040404] text-[#666666] opacity-75 hover:border-[#ff9900]"
                      : active
                        ? "border-[#ff0099] bg-[#24101c] text-[#ffffff] shadow-[0_0_10px_rgba(255,0,153,0.3)]"
                        : "border-[#262626] bg-[#060606] hover:border-[#606060] text-[#d0d0d0]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-1">
                    <span
                      className={`font-bold text-xs truncate ${
                        isLocked ? "text-[#707070]" : item.accent
                      }`}
                    >
                      {isLocked ? "🔒" : TOOL_GLYPHS[item.id]} {item.shortLabel}
                    </span>
                    <kbd className="text-[10px] text-[#808080] bg-[#141414] px-1 border border-[#2a2a2a] shrink-0">
                      {isLocked ? `T${unlockInfo?.tier ?? 1}` : item.hotkey}
                    </kbd>
                  </div>
                  {isLocked && unlockInfo ? (
                    <span className="text-[9px] text-[#ff9900] truncate w-full mt-0.5 tabular-nums">
                      Req: {unlockInfo.progressText}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#33ff00] truncate w-full mt-0.5">
                      + {costLabel}
                    </span>
                  )}
                </button>

              );
            })}
          </div>
        </div>
      )}

      </div>
      <div className="map-tool-stack">
      {preferences.tooltips && hoverMeta && !dragStart && !preview && !inspectMode && !mapOptions && !showBuildDrawer && (
        <aside data-testid="hover-tile-inspector" aria-label="Hover tile inspector" className="compact-tile-tooltip">
          <div><span style={{ color: hoverMeta.fg }}>{hoverMeta.char}</span><strong>{hoverMeta.terrainLabel}</strong>
            <span className="tooltip-coord">{hoverMeta.x},{hoverMeta.y}</span></div>
          <p>{hoverMeta.materialType}</p>
          {hoverMeta.occupancy.some(o => o.startsWith('☺') || o.includes('HP)')) && <p>{hoverMeta.occupancy.join(' · ')}</p>}
        </aside>
      )}
      {/* FLOATING ACTION BUTTON (FAB) TOOL DOCK ON MAP DISPLAY */}
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Map designation tools"
        className="designation-toolbar"
      >
        {PRIMARY_FAB_TOOLS.map((item) => {
          const active = !inspectMode && selectedTool === item.id;
          const unlockInfo = unlockByTool.get(item.id);
          const isLocked = Boolean(unlockInfo && !unlockInfo.unlocked);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              title={
                preferences.tooltips
                  ? isLocked && unlockInfo
                    ? `LOCKED: ${unlockInfo.title} — ${unlockInfo.requirementLabel} (${unlockInfo.progressText})`
                    : `${TOOL_NAMES[item.id]} (Hotkey: ${item.hotkey}) — ${
                        getTool(item.id).desc
                      }`
                  : undefined
              }
              onClick={() => {
                if (isLocked && unlockInfo) {
                  setOrderStatus(
                    `Locked Blueprint: ${unlockInfo.title} requires ${unlockInfo.requirementLabel} (${unlockInfo.progressText}).`,
                  );
                  return;
                }
                playTactileSfx("tool");
                setInspectMode(false);
                setSelectedTool(item.id);
                setShowBuildDrawer(false);
              }}
              className={`group relative flex items-center gap-1 px-1.5 py-0.5 border text-[11px] font-mono whitespace-nowrap transition-all shrink-0 ${
                isLocked
                  ? "border-[#222222] bg-[#040404] text-[#666666] hover:border-[#ff9900]"
                  : active
                    ? "border-[#ff0099] bg-[#24101c] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(255,0,153,0.35)] -translate-y-0.5"
                    : "border-[#262626] bg-[#050505] text-[#d0d0d0] hover:border-[#606060] hover:bg-[#141414]"
              }`}
            >
              <span className={isLocked ? "text-[#707070]" : item.accent}>
                {isLocked ? "🔒" : TOOL_GLYPHS[item.id]}
              </span>
              <span>{item.shortLabel}</span>
              <span className="text-[9px] text-[#707070] ml-0.5">
                {item.hotkey}
              </span>
            </button>
          );
        })}

        {/* Divider */}


        {/* Workshops & Civic Pop-up Trigger FAB */}
        <button
          type="button"
          aria-expanded={showBuildDrawer}
          onClick={() => { setShowBuildDrawer(v => !v); setMapOptions(false); setInspectMode(false); setPending(null); }}
          className={`flex items-center gap-1 px-2 py-0.5 border text-[11px] font-mono whitespace-nowrap transition-all shrink-0 ${
            showBuildDrawer || isSecondaryToolActive
              ? "border-[#00ffff] bg-[#082228] text-[#00ffff] font-bold shadow-[0_0_12px_rgba(0,255,255,0.3)] -translate-y-0.5"
              : "border-[#262626] bg-[#050505] text-[#00ffff] hover:border-[#00ffff]"
          }`}
          title={
            preferences.tooltips
              ? "Open Architectural Blueprints, Workshops & Civic Buildings drawer"
              : undefined
          }
        >
          <span>⚒</span>
          <span>
            Build
          </span>
          <span className="text-[10px]">{showBuildDrawer ? "v" : "^"}</span>
        </button>


        {/* Inspect Mode FAB */}
        <button
          type="button"
          aria-pressed={inspectMode}
          onClick={() => {
            playTactileSfx("tool");
            setInspectMode((v) => !v);
            setShowBuildDrawer(false);
          }}
          title={
            preferences.tooltips
              ? "Inspect Tile, Dwarf, or Threat (Hotkey: I)"
              : undefined
          }
          className={`flex items-center gap-1 px-1.5 py-0.5 border text-[11px] font-mono whitespace-nowrap transition-all shrink-0 ${
            inspectMode
              ? "border-[#ff0099] bg-[#24101c] text-[#ff0099] font-bold -translate-y-0.5"
              : "border-[#262626] bg-[#050505] text-[#d0d0d0] hover:border-[#606060]"
          }`}
        >
          <span className="text-[#ff0099]">?</span>
          <span>Inspect</span>
          <span className="text-[9px] text-[#707070]">I</span>
        </button>

        {/* Clear Order / Cancel Tool FAB */}
        <button
          type="button"
          aria-pressed={!inspectMode && selectedTool === "CANCEL"}
          onClick={() => {
            playTactileSfx("tool");
            setInspectMode(false);
            setSelectedTool("CANCEL");
            setShowBuildDrawer(false);
          }}
          title={
            preferences.tooltips
              ? "Clear queued designations (Hotkey: K)"
              : undefined
          }
          className={`flex items-center gap-1 px-1.5 py-0.5 border text-[11px] font-mono whitespace-nowrap transition-all shrink-0 ${
            !inspectMode && selectedTool === "CANCEL"
              ? "border-[#ff0000] bg-[#280808] text-[#ff0000] font-bold -translate-y-0.5"
              : "border-[#262626] bg-[#050505] text-[#808080] hover:text-[#ff0000] hover:border-[#ff0000]"
          }`}
        >
          <span>×</span>
          <span>Clear</span>
        </button>
      </div>
      </div>
      </div>
      <div className="map-status" role="status">
        <span className="truncate">{orderStatus || (inspectMode ? 'Select a tile to inspect. Esc to close.' : 'Choose a tool · drag an area · Enter to queue')}</span>
        {preferences.tooltips && hoverMeta && <span className="map-terrain-readout">{hoverMeta.terrainLabel} · {hoverMeta.x},{hoverMeta.y}</span>}
      </div>
    </div>
  );
}
