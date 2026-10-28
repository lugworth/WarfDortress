'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '@/components/GameProvider';
import { useUI } from '@/components/UIProvider';
import { isModalOpen } from '@/components/pixel/PixelDialog';
import { PixelIcon } from '@/components/pixel/PixelIcon';
import ResourceBar from '@/components/shell/ResourceBar';
import { playTactileSfx } from '@/lib/audio';
import { canDesignateTile } from '@/lib/game-engine';
import { TOOL_KEYS } from '@/lib/game-rules';
import { ensureMilitiaState } from '@/lib/militia';
import { TILE, centerOn, clampCamera, scaleFor, stepZoom, tileAt, zoomAround, type Camera } from '@/lib/pixel/camera';
import { MapRenderer, type MapScene } from '@/lib/pixel/map-renderer';
import { MINIMAP_CELL, drawMinimap } from '@/lib/pixel/minimap';
import { weatherIcon } from '@/lib/pixel/tiles';
import type { DesignationType } from '@/lib/types';
import { TOOL_NAMES } from '@/lib/ui-labels';
import { getDesignationPreview, getMapPoints, getTileHoverMetadata, type MapPoint } from '@/lib/ui-model';
import { getCurrentWeather } from '@/lib/weather';
import {
  BuildDrawer,
  InspectorCard,
  MapOptionsCard,
  OrderPreviewCard,
  TileTooltip,
  ToolDock,
  lockedMessage,
} from './MapCards';

type Point = { x: number; y: number };
type Selection = { start: Point; end: Point; z: number; tool: DesignationType };
interface View { w: number; h: number; cssW: number; cssH: number; dpr: number }

const TOOLTIP_W = 250;

function rectOf(selection: { start: Point; end: Point; z: number }) {
  return {
    minX: Math.min(selection.start.x, selection.end.x),
    maxX: Math.max(selection.start.x, selection.end.x),
    minY: Math.min(selection.start.y, selection.end.y),
    maxY: Math.max(selection.start.y, selection.end.y),
    z: selection.z,
  };
}

/**
 * The fortress map: a pixel-art canvas with a free camera (drag, wheel, pinch,
 * keyboard), tool dock, order previews, the tile inspector, and a minimap.
 */
export default function PixelMap() {
  const { preferences, updatePreferences, reducedMotion } = useUI();
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
    cycleSeasonWeather,
    activateBuildingFunction,
  } = useGame();

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 2 });
  const viewRef = useRef<View>({ w: 0, h: 0, cssW: 0, cssH: 0, dpr: 1 });
  const tweenRef = useRef<{ from: Camera; to: Camera; start: number } | null>(null);
  const sceneRef = useRef<Omit<MapScene, 'now' | 'wallNow'> | null>(null);
  const stampRef = useRef<MapScene['stamp']>(null);
  const panRef = useRef<{ id: number; x: number; y: number; cam: Camera } | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{ dist: number; mid: Point } | null>(null);
  const centeredFor = useRef('');

  const [view, setView] = useState({ cssW: 0, cssH: 0, dpr: 1 });
  const [hover, setHover] = useState<(Point & { sx: number; sy: number }) | null>(null);
  const [cursor, setCursor] = useState<Point>(() => ({ x: Math.floor(gameState.world.width / 2), y: Math.floor(gameState.world.height / 2) }));
  const [keyboardCursor, setKeyboardCursor] = useState(false);
  const [pending, setPending] = useState<Selection | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null);
  const [panning, setPanning] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [mapOptions, setMapOptions] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [focusedPointId, setFocusedPointId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState('');

  // Changing fortress, depth, tool, or pan mode abandons a half-made selection.
  const contextKey = `${gameState.id}:${currentZ}:${selectedTool}:${panMode}`;
  const [selectionContext, setSelectionContext] = useState(contextKey);
  if (selectionContext !== contextKey) {
    setSelectionContext(contextKey);
    setPending(null);
    setDragStart(null);
    setDragCurrent(null);
  }

  const cols = gameState.world.width;
  const rows = gameState.world.height;
  const unlocks = useMemo(() => new Map(progression.buildingUnlocks.map((u) => [u.tool, u])), [progression.buildingUnlocks]);
  const weather = useMemo(() => getCurrentWeather(gameState), [gameState]);
  const squads = useMemo(() => Object.values(ensureMilitiaState(gameState).squads), [gameState]);
  const points = useMemo(
    () => (preferences.labels || inspectMode || mapOptions ? getMapPoints(gameState, currentZ) : []),
    [gameState, currentZ, preferences.labels, inspectMode, mapOptions],
  );
  const selection = useMemo<Selection | null>(
    () => pending || (dragStart && dragCurrent ? { start: dragStart, end: dragCurrent, z: currentZ, tool: selectedTool } : null),
    [pending, dragStart, dragCurrent, currentZ, selectedTool],
  );
  const preview = useMemo(
    () => (selection ? getDesignationPreview(gameState, selection.z, selection.start.x, selection.start.y, selection.end.x, selection.end.y, selection.tool) : null),
    [gameState, selection],
  );
  const hoveredTile = hover ? gameState.grid[currentZ]?.[hover.y]?.[hover.x] ?? null : null;
  const hoverMeta = useMemo(() => (hoveredTile ? getTileHoverMetadata(gameState, hoveredTile) : null), [gameState, hoveredTile]);

  // --------------------------------------------------------------- camera --

  const worldSize = useCallback(() => {
    const world = sceneRef.current?.state.world;
    return { worldW: (world?.width ?? 0) * TILE, worldH: (world?.height ?? 0) * TILE };
  }, []);

  const setCamera = useCallback((next: Camera) => {
    const { w, h } = viewRef.current;
    const { worldW, worldH } = worldSize();
    tweenRef.current = null;
    cameraRef.current = clampCamera(next, w, h, worldW, worldH);
  }, [worldSize]);

  const flyTo = useCallback((x: number, y: number) => {
    const { w, h } = viewRef.current;
    if (!w) return;
    const { worldW, worldH } = worldSize();
    const from = cameraRef.current;
    const to = clampCamera(centerOn(x, y, from.scale, w, h), w, h, worldW, worldH);
    if (reducedMotion) setCamera(to);
    else tweenRef.current = { from, to, start: performance.now() };
  }, [reducedMotion, setCamera, worldSize]);

  /** Moves the camera only if the tile is near or past the edge of the view. */
  const keepVisible = useCallback((x: number, y: number) => {
    const { w, h } = viewRef.current;
    const cam = cameraRef.current;
    const margin = 2 * TILE;
    const px = x * TILE;
    const py = y * TILE;
    if (px < cam.x + margin || py < cam.y + margin || px + TILE > cam.x + w / cam.scale - margin || py + TILE > cam.y + h / cam.scale - margin) flyTo(x, y);
  }, [flyTo]);

  const zoomTo = useCallback((zoom: number | 'fit', anchor?: Point) => {
    const v = viewRef.current;
    if (!v.w) return;
    const { worldW, worldH } = worldSize();
    const scale = scaleFor(zoom, v.dpr, v.w, v.h, worldW, worldH);
    const cam = tweenRef.current?.to ?? cameraRef.current;
    if (scale !== cam.scale) setCamera(zoomAround(cam, scale, anchor?.x ?? v.w / 2, anchor?.y ?? v.h / 2));
  }, [setCamera, worldSize]);

  const zoomStep = useCallback((direction: 1 | -1, anchor?: Point) => {
    const v = viewRef.current;
    const next = stepZoom(preferences.mapZoom, direction, cameraRef.current.scale, v.dpr);
    zoomTo(next, anchor);
    updatePreferences({ mapZoom: next });
  }, [preferences.mapZoom, updatePreferences, zoomTo]);

  // Size the canvas in device pixels so every sprite pixel lands on whole pixels.
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const apply = (cssW: number, cssH: number, devW?: number, devH?: number) => {
      const dpr = window.devicePixelRatio || 1;
      // Prefer the exact device-pixel size, unless it disagrees with the
      // ratio (some emulated and zoomed views report CSS pixels there).
      const w = devW && Math.abs(devW - cssW * dpr) < 2 ? devW : Math.round(cssW * dpr);
      const h = devH && Math.abs(devH - cssH * dpr) < 2 ? devH : Math.round(cssH * dpr);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      viewRef.current = { w, h, cssW, cssH, dpr };
      setView((v) => (v.cssW === cssW && v.cssH === cssH && v.dpr === dpr ? v : { cssW, cssH, dpr }));
    };
    const observer = new ResizeObserver(([entry]) => {
      const device = entry.devicePixelContentBoxSize?.[0];
      apply(entry.contentRect.width, entry.contentRect.height, device?.inlineSize, device?.blockSize);
    });
    try {
      observer.observe(stage, { box: 'device-pixel-content-box' });
    } catch {
      observer.observe(stage);
    }
    const rect = stage.getBoundingClientRect();
    apply(rect.width, rect.height);
    return () => observer.disconnect();
  }, []);

  // Apply the zoom preference, and refit when the view or the fortress changes.
  useEffect(() => {
    if (!view.cssW) return;
    zoomTo(preferences.mapZoom);
    setCamera(tweenRef.current?.to ?? cameraRef.current);
  }, [preferences.mapZoom, view, zoomTo, setCamera]);

  // Open each fortress centered on its clan.
  useEffect(() => {
    if (!view.cssW || centeredFor.current === gameState.id) return;
    centeredFor.current = gameState.id;
    rendererRef.current?.reset();
    const v = viewRef.current;
    const { worldW, worldH } = worldSize();
    const scale = scaleFor(preferences.mapZoom, v.dpr, v.w, v.h, worldW, worldH);
    const here = gameState.dwarves.filter((d) => d.z === currentZ);
    const cx = here.length ? here.reduce((n, d) => n + d.x, 0) / here.length : cols / 2;
    const cy = here.length ? here.reduce((n, d) => n + d.y, 0) / here.length : rows / 2;
    setCamera(centerOn(cx, cy, scale, v.w, v.h));
    // Only a new fortress or the first measured size recenters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.id, view.cssW > 0]);

  // Follow explicit jumps and newly selected dwarves, not every simulation tick.
  useEffect(() => {
    if (pingTarget && pingTarget.z === currentZ) flyTo(pingTarget.x, pingTarget.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pingTarget?.timestamp]);
  useEffect(() => {
    const dwarf = gameState.dwarves.find((d) => d.id === selectedDwarfId && d.z === currentZ);
    if (dwarf) keepVisible(dwarf.x, dwarf.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDwarfId]);

  // ------------------------------------------------------------ rendering --

  const scene: Omit<MapScene, 'now' | 'wallNow' | 'stamp'> = {
    state: gameState,
    z: currentZ,
    tickMs: Math.max(120, Math.floor(480 / gameState.speed)),
    weather,
    selection: selection ? rectOf(selection) : null,
    preview,
    hover: hover && !panning && !selection ? { x: hover.x, y: hover.y, valid: !inspectMode && Boolean(hoveredTile && canDesignateTile(hoveredTile, selectedTool)) } : null,
    cursor: keyboardCursor || inspectMode ? cursor : null,
    inspected: inspectMode ? inspectedCoord : null,
    ping: pingTarget,
    selectedDwarfId,
    squads,
    labels: preferences.labels ? points : null,
    reducedMotion,
    contrast: preferences.theme === 'contrast',
    fontFamily: '',
  };
  useLayoutEffect(() => {
    sceneRef.current = { ...scene, stamp: stampRef.current };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;
    const renderer = (rendererRef.current ??= new MapRenderer());
    const font = getComputedStyle(document.documentElement).getPropertyValue('--font-pixel').trim() || 'monospace';
    let lastMinimap = 0;
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const scene = sceneRef.current;
      const v = viewRef.current;
      if (!scene || !v.w || !v.h) return;
      const tween = tweenRef.current;
      if (tween) {
        const t = Math.min(1, (now - tween.start) / 380);
        const ease = 1 - (1 - t) ** 3;
        cameraRef.current = {
          x: tween.from.x + (tween.to.x - tween.from.x) * ease,
          y: tween.from.y + (tween.to.y - tween.from.y) * ease,
          scale: tween.to.scale,
        };
        if (t >= 1) tweenRef.current = null;
      }
      renderer.render(ctx, v.w, v.h, cameraRef.current, { ...scene, now, wallNow: Date.now(), fontFamily: font });
      const mini = minimapRef.current?.getContext('2d');
      if (mini && now - lastMinimap > 120) {
        lastMinimap = now;
        drawMinimap(mini, scene.state, scene.z, cameraRef.current, v.w, v.h, now);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---------------------------------------------------------------- orders --

  const commitSelection = () => {
    if (!selection || !preview) return;
    const count = designateBox(selection.start.x, selection.start.y, selection.end.x, selection.end.y, selection.tool, selection.z);
    playTactileSfx('stamp');
    stampRef.current = { ...rectOf(selection), at: Date.now() };
    const cancel = selection.tool === 'CANCEL';
    setOrderStatus(`${cancel ? 'Cleared' : 'Queued'} ${count} ${count === 1 ? 'tile' : 'tiles'}${preview.tiles.length - count ? `; skipped ${preview.tiles.length - count}` : ''}.${cancel ? '' : ' Materials are spent when the work is done.'}`);
    setPending(null);
    setDragStart(null);
    setDragCurrent(null);
  };

  const chooseTool = useCallback((tool: DesignationType) => {
    const unlock = unlocks.get(tool);
    if (unlock && !unlock.unlocked) {
      setOrderStatus(lockedMessage(unlock));
      return;
    }
    playTactileSfx('tool');
    setInspectMode(false);
    setSelectedTool(tool);
    setBuildOpen(false);
    setOrderStatus(`${TOOL_NAMES[tool]} selected. Drag across the map, then press Enter or Queue.`);
  }, [unlocks, setInspectMode, setSelectedTool]);

  const designateOne = (tool: DesignationType, x: number, y: number, z: number, x2 = x) => {
    const unlock = unlocks.get(tool);
    if (unlock && !unlock.unlocked) {
      setOrderStatus(lockedMessage(unlock));
      return;
    }
    playTactileSfx('stamp');
    const count = designateBox(x, y, x2, y, tool, z);
    setOrderStatus(count > 0 ? `Queued ${TOOL_NAMES[tool]} at ${x}, ${y}, depth ${z}.` : `${TOOL_NAMES[tool]} cannot go on this tile.`);
  };

  const quickOrder = (kind: 'mine' | 'chop' | 'workshops') => {
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    setCurrentZ(0);
    if (kind === 'mine') {
      const count = designateBox(cx + 5, cy - 2, cx + 9, cy + 2, 'MINE', 0);
      setOrderStatus(`Marked ${count} cliff tiles for mining.`);
    } else if (kind === 'chop') {
      const count = designateBox(4, 4, cols - 5, rows - 5, 'CHOP', 0);
      setOrderStatus(`Marked ${count} trees for felling.`);
    } else {
      const sites = gameState.grid[0].flat()
        .filter((t) => Math.max(Math.abs(t.x - cx), Math.abs(t.y - cy)) <= 3 && canDesignateTile(t, 'BUILD_SMELTER'))
        .sort((a, b) => Math.abs(a.x - cx) + Math.abs(a.y - cy) - (Math.abs(b.x - cx) + Math.abs(b.y - cy)));
      const tools = (['BUILD_SMELTER', 'BUILD_FORGE', 'BUILD_TAVERN'] as const).filter((t) => unlocks.get(t)?.unlocked !== false);
      const queued = tools.filter((tool, i) => (sites[i] ? designateBox(sites[i].x, sites[i].y, sites[i].x, sites[i].y, tool, 0) > 0 : false));
      setOrderStatus(queued.length
        ? `Queued ${queued.map((t) => TOOL_NAMES[t]).join(', ')} near the clan.`
        : 'No starter workshop blueprints are unlocked yet. Open Quests to see what they need.');
    }
    setMapOptions(false);
  };

  // ------------------------------------------------------------ inspection --

  const activeInspect = useMemo(() => {
    const coord = inspectedCoord?.z === currentZ ? inspectedCoord : { ...cursor, z: currentZ };
    const tile = gameState.grid[coord.z]?.[coord.y]?.[coord.x] ?? null;
    const occupants = tile?.revealed ? gameState.dwarves.filter((d) => d.z === coord.z && d.x === coord.x && d.y === coord.y) : [];
    const dwarf = occupants.find((d) => `dwarf:${d.id}` === focusedPointId) ?? occupants[0] ?? null;
    const hostile = tile?.revealed ? gameState.hostiles.find((h) => h.z === coord.z && h.x === coord.x && h.y === coord.y) ?? null : null;
    return { coord, tile, dwarf, hostile };
  }, [inspectedCoord, currentZ, cursor, focusedPointId, gameState.grid, gameState.dwarves, gameState.hostiles]);

  const inspectPoint = (point: MapPoint | (Point & { z: number; id?: string })) => {
    setFocusedPointId(point.id ?? null);
    setCursor({ x: point.x, y: point.y });
    setInspectedCoord({ x: point.x, y: point.y, z: point.z });
    setInspectMode(true);
    setBuildOpen(false);
    flyTo(point.x, point.y);
    const dwarf = point.id
      ? gameState.dwarves.find((d) => `dwarf:${d.id}` === point.id)
      : gameState.dwarves.find((d) => d.x === point.x && d.y === point.y && d.z === point.z);
    setSelectedDwarfId(dwarf?.id ?? null);
  };

  // --------------------------------------------------------------- pointer --

  const deviceXY = (e: { clientX: number; clientY: number }): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / Math.max(1, rect.width),
      y: ((e.clientY - rect.top) * canvas.height) / Math.max(1, rect.height),
    };
  };
  const tileFrom = (e: { clientX: number; clientY: number }) => {
    const p = deviceXY(e);
    return tileAt(cameraRef.current, p.x, p.y, cols, rows);
  };
  const updateHover = (e: { clientX: number; clientY: number }, tile: Point | null) => {
    if (!tile) {
      setHover(null);
      return;
    }
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    setHover((h) => (h && h.x === tile.x && h.y === tile.y ? h : { ...tile, sx, sy }));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    if (e.pointerType === 'mouse') canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setKeyboardCursor(false);

    if (pointersRef.current.size === 2) {
      // A second finger turns the gesture into pan and pinch-zoom.
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      panRef.current = null;
      setDragStart(null);
      setDragCurrent(null);
      return;
    }
    if (panMode || e.button === 1 || (e.button === 0 && e.altKey)) {
      panRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, cam: cameraRef.current };
      tweenRef.current = null;
      setPanning(true);
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    setPending(null);
    setMapOptions(false);
    const coord = tileFrom(e);
    if (!coord) return;
    setCursor(coord);
    if (e.pointerType !== 'touch') updateHover(e, coord);
    const dwarf = gameState.dwarves.find((d) => d.z === currentZ && d.x === coord.x && d.y === coord.y);
    if (inspectMode || e.shiftKey) {
      setInspectedCoord({ ...coord, z: currentZ });
      setInspectMode(true);
      if (dwarf) setSelectedDwarfId(dwarf.id);
      return;
    }
    if (dwarf) {
      setSelectedDwarfId(dwarf.id);
      setInspectedCoord({ ...coord, z: currentZ });
    }
    setDragStart(coord);
    setDragCurrent(coord);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pointers = pointersRef.current;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pinch = pinchRef.current;
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cam = cameraRef.current;
      const ratio = viewRef.current.dpr / cam.scale;
      setCamera({ ...cam, x: cam.x - (mid.x - pinch.mid.x) * ratio, y: cam.y - (mid.y - pinch.mid.y) * ratio });
      pinch.mid = mid;
      if (dist / pinch.dist > 1.35 || dist / pinch.dist < 0.74) {
        zoomStep(dist > pinch.dist ? 1 : -1, deviceXY({ clientX: mid.x, clientY: mid.y }));
        pinch.dist = dist;
      }
      return;
    }
    const pan = panRef.current;
    if (pan && pan.id === e.pointerId) {
      const ratio = viewRef.current.dpr / pan.cam.scale;
      setCamera({ ...pan.cam, x: pan.cam.x - (e.clientX - pan.x) * ratio, y: pan.cam.y - (e.clientY - pan.y) * ratio });
      return;
    }
    const coord = tileFrom(e);
    if (e.pointerType !== 'touch') updateHover(e, coord);
    if (coord && dragStart && !inspectMode) setDragCurrent((p) => (p?.x === coord.x && p.y === coord.y ? p : coord));
  };

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (panRef.current?.id === e.pointerId) {
      panRef.current = null;
      setPanning(false);
      return;
    }
    if (!cancelled && dragStart && dragCurrent && !inspectMode) setPending({ start: dragStart, end: dragCurrent, z: currentZ, tool: selectedTool });
    setDragStart(null);
    setDragCurrent(null);
  };

  // Wheel pans (trackpads scroll in two dimensions); Ctrl+wheel and pinch zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let wheelZoom = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        wheelZoom += e.deltaY;
        if (Math.abs(wheelZoom) < 40) return;
        const rect = canvas.getBoundingClientRect();
        zoomStep(wheelZoom < 0 ? 1 : -1, { x: ((e.clientX - rect.left) * canvas.width) / rect.width, y: ((e.clientY - rect.top) * canvas.height) / rect.height });
        wheelZoom = 0;
        return;
      }
      const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewRef.current.cssH : 1;
      const cam = cameraRef.current;
      const ratio = viewRef.current.dpr / cam.scale;
      const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * lines;
      const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * lines;
      setCamera({ ...cam, x: cam.x + dx * ratio, y: cam.y + dy * ratio });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [setCamera, zoomStep]);

  // --------------------------------------------------------------- keyboard --

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === 'Escape' && !isModalOpen()) {
        setMapOptions(false);
        setBuildOpen(false);
      }
      if (target.closest('input, textarea, select, [contenteditable="true"]') || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isModalOpen()) return;
      // Space and Enter belong to a focused button; letter shortcuts still work.
      if ((e.key === ' ' || e.key === 'Enter') && target.closest('button, a, summary')) return;
      const key = e.key.toLowerCase();
      if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      } else if (e.key === '[' || e.key === '<' || e.key === ',') {
        playTactileSfx('zlevel');
        setCurrentZ((z) => Math.max(0, z - 1));
      } else if (e.key === ']' || e.key === '>' || e.key === '.') {
        playTactileSfx('zlevel');
        setCurrentZ((z) => Math.min(gameState.world.depth - 1, z + 1));
      } else if (e.key === '+' || e.key === '=') {
        zoomStep(1);
      } else if (e.key === '-' || e.key === '_') {
        zoomStep(-1);
      } else if (e.key === '0') {
        updatePreferences({ mapZoom: 'fit' });
      } else if (key === 'i' || e.key === '?') {
        setInspectMode((v) => !v);
        setBuildOpen(false);
      } else if (TOOL_KEYS[key]) {
        chooseTool(TOOL_KEYS[key]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState.world.depth, setCurrentZ, setInspectMode, togglePause, chooseTool, zoomStep, updatePreferences]);

  const onMapKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isModalOpen()) return;
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const step = directions[e.key];
    if (step) {
      e.preventDefault();
      e.stopPropagation();
      const next = { x: Math.max(0, Math.min(cols - 1, cursor.x + step[0])), y: Math.max(0, Math.min(rows - 1, cursor.y + step[1])) };
      setKeyboardCursor(true);
      setFocusedPointId(null);
      setCursor(next);
      setInspectedCoord({ ...next, z: currentZ });
      keepVisible(next.x, next.y);
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
    } else if (e.key === 'Tab' && inspectMode && points.length) {
      e.preventDefault();
      e.stopPropagation();
      const index = points.findIndex((p) => p.id === focusedPointId);
      const next = index === -1 ? (e.shiftKey ? points.length - 1 : 0) : (index + (e.shiftKey ? -1 : 1) + points.length) % points.length;
      inspectPoint(points[next]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (pending) commitSelection();
      else if (dragStart && dragCurrent) {
        setPending({ start: dragStart, end: dragCurrent, z: currentZ, tool: selectedTool });
        setDragStart(null);
        setDragCurrent(null);
      } else inspectPoint({ ...cursor, z: currentZ });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setMapOptions(false);
      setBuildOpen(false);
      setPending(null);
      setDragStart(null);
      setDragCurrent(null);
      setInspectMode(false);
    }
  };

  // ---------------------------------------------------------------- render --

  const stratum = gameState.world.strata[currentZ] || gameState.world.strata[0];
  const zoomLabel = preferences.mapZoom === 'fit' ? 'Fit' : `${preferences.mapZoom}%`;
  const showTooltip = preferences.tooltips && hoverMeta && hover && !dragStart && !panning && !preview && !mapOptions && !buildOpen && !inspectMode;
  const cardOpen = Boolean(preview && selection) || buildOpen || (inspectMode && activeInspect.tile);
  const status = orderStatus || (inspectMode
    ? 'Inspecting: select a tile. Arrows move · Tab cycles objects · Esc closes.'
    : `${TOOL_NAMES[selectedTool]} · drag an area, then Enter to queue`);
  const cursorMode = panning ? 'panning' : panMode ? 'pan' : inspectMode ? 'inspect' : 'designate';

  return (
    <div className="map" ref={stageRef} data-cursor={cursorMode}>
      <p id="map-keyboard-help" className="sr-only">
        Arrow keys move the map cursor and inspect. Tab cycles objects while inspecting. Shift and arrows select an area; Enter confirms; Escape cancels.
        Plus and minus zoom. Square brackets change depth.
      </p>
      <canvas
        ref={canvasRef}
        className="map-canvas"
        data-testid="pixel-map-canvas"
        tabIndex={0}
        aria-label={`Fortress map at depth ${currentZ}, cursor ${cursor.x}, ${cursor.y}. ${inspectMode ? 'Inspecting.' : `${TOOL_NAMES[selectedTool]} selected.`}`}
        aria-describedby="map-keyboard-help"
        onKeyDown={onMapKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') setHover(null);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const coord = tileFrom(e);
          if (coord) {
            setInspectedCoord({ ...coord, z: currentZ });
            setCursor(coord);
            setInspectMode(true);
            setBuildOpen(false);
          }
        }}
      />

      <ResourceBar className="resource-bar--map" />

      <div className="map-hud map-hud--tl">
        <div className="px-panel depth-control" role="group" aria-label="Map depth">
          <button type="button" className="px-btn px-btn--icon px-btn--small" aria-label="Up one level" disabled={currentZ === 0}
            onClick={() => { playTactileSfx('zlevel'); setCurrentZ((z) => Math.max(0, z - 1)); }}>
            <PixelIcon name="icon_up" />
          </button>
          <label className="depth-label">
            <span className="sr-only">Depth</span>
            <select className="depth-select" value={currentZ} onChange={(e) => { playTactileSfx('zlevel'); setCurrentZ(Number(e.target.value)); }}>
              {gameState.world.strata.map((st) => (
                <option key={st.zLevel} value={st.zLevel}>{st.zLevel === 0 ? 'Surface' : `Depth ${st.zLevel}`} · {st.zLevel === 0 ? 'open sky' : st.primaryRock}</option>
              ))}
            </select>
            <small>{currentZ === 0 ? `${weather.shortLabel} · ${weather.surfaceTempF}°F` : stratum.name}</small>
          </label>
          <button type="button" className="px-btn px-btn--icon px-btn--small" aria-label="Down one level" disabled={currentZ >= gameState.world.depth - 1}
            onClick={() => { playTactileSfx('zlevel'); setCurrentZ((z) => Math.min(gameState.world.depth - 1, z + 1)); }}>
            <PixelIcon name="icon_down" />
          </button>
          {currentZ === 0 && <PixelIcon name={weatherIcon(weather.id)} label={weather.label} />}
        </div>
      </div>

      <div className="map-hud map-hud--tr">
        <div className="px-panel map-controls" role="group" aria-label="View">
          <button type="button" className="px-btn px-btn--icon px-btn--small" aria-label="Zoom out" onClick={() => zoomStep(-1)}><PixelIcon name="icon_zoom_out" /></button>
          <button type="button" className="px-btn px-btn--small zoom-label" aria-label={`Zoom ${zoomLabel}. Select to fit the whole map.`}
            onClick={() => updatePreferences({ mapZoom: 'fit' })}>{zoomLabel}</button>
          <button type="button" className="px-btn px-btn--icon px-btn--small" aria-label="Zoom in" onClick={() => zoomStep(1)}><PixelIcon name="icon_zoom_in" /></button>
          <button type="button" className="px-btn px-btn--icon px-btn--small" aria-label="Pan with drag" aria-pressed={panMode} onClick={() => setPanMode((v) => !v)}><PixelIcon name="icon_hand" /></button>
          <button type="button" className="px-btn px-btn--icon px-btn--small" aria-label="Show labels" aria-pressed={preferences.labels} onClick={() => updatePreferences({ labels: !preferences.labels })}><PixelIcon name="icon_tag" /></button>
          <button type="button" className="px-btn px-btn--icon px-btn--small" aria-label="Map options" aria-expanded={mapOptions} aria-controls="map-options"
            onClick={() => { setMapOptions((v) => !v); setBuildOpen(false); }}><PixelIcon name="icon_gear" /></button>
        </div>
        <canvas
          ref={minimapRef}
          className="minimap px-panel"
          width={cols * MINIMAP_CELL}
          height={rows * MINIMAP_CELL}
          style={{ width: cols * MINIMAP_CELL, height: rows * MINIMAP_CELL }}
          aria-label="Minimap. Select a point to move the view there."
          role="img"
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            flyTo(((e.clientX - rect.left) / rect.width) * cols - 0.5, ((e.clientY - rect.top) / rect.height) * rows - 0.5);
          }}
        />
      </div>

      {mapOptions && (
        <MapOptionsCard
          state={gameState}
          z={currentZ}
          panMode={panMode}
          labels={preferences.labels}
          tooltips={preferences.tooltips}
          points={points}
          onTogglePan={() => setPanMode((v) => !v)}
          onToggleLabels={() => updatePreferences({ labels: !preferences.labels })}
          onToggleTooltips={() => updatePreferences({ tooltips: !preferences.tooltips })}
          onCycleWeather={cycleSeasonWeather}
          onQuick={quickOrder}
          onLocate={(point) => {
            inspectPoint(point);
            setMapOptions(false);
            canvasRef.current?.focus();
          }}
          onClose={() => setMapOptions(false)}
        />
      )}

      {preview && selection ? (
        <OrderPreviewCard tool={selection.tool} preview={preview} pending={Boolean(pending)} onCancel={() => setPending(null)} onCommit={commitSelection} />
      ) : buildOpen ? (
        <BuildDrawer selectedTool={selectedTool} inspectMode={inspectMode} unlocks={unlocks} tooltips={preferences.tooltips} onSelect={chooseTool} onClose={() => setBuildOpen(false)} />
      ) : inspectMode && activeInspect.tile ? (
        <InspectorCard
          state={gameState}
          coord={activeInspect.coord}
          tile={activeInspect.tile}
          dwarf={activeInspect.dwarf}
          hostile={activeInspect.hostile}
          onDesignate={(tool, x2) => designateOne(tool, activeInspect.coord.x, activeInspect.coord.y, activeInspect.coord.z, x2)}
          onToggleMilitia={(dwarf) => toggleDwarfLabor(dwarf.id, 'COMBAT')}
          onActivate={() => {
            playTactileSfx('stamp');
            setOrderStatus(activateBuildingFunction(activeInspect.coord.x, activeInspect.coord.y, activeInspect.coord.z).message);
          }}
          onClose={() => setInspectMode(false)}
        />
      ) : null}

      {showTooltip && hover && hoverMeta && (
        <TileTooltip meta={hoverMeta} left={hover.sx + (hover.sx + TOOLTIP_W + 24 > view.cssW ? -16 : 20)} top={Math.max(8, hover.sy - 8)}
          flip={hover.sx + TOOLTIP_W + 24 > view.cssW} />
      )}

      <ToolDock
        selectedTool={selectedTool}
        inspectMode={inspectMode}
        buildOpen={buildOpen}
        unlocks={unlocks}
        tooltips={preferences.tooltips}
        onSelect={chooseTool}
        onToggleBuild={() => { setBuildOpen((v) => !v); setMapOptions(false); setInspectMode(false); setPending(null); }}
        onToggleInspect={() => { playTactileSfx('tool'); setInspectMode((v) => !v); setBuildOpen(false); }}
      />

      <div className="map-status" data-card-open={cardOpen || undefined}>
        <span role="status">{status}{!orderStatus && !inspectMode && <span className="pan-hint" />}</span>
        {hoverMeta && <span className="readout">{hoverMeta.terrainLabel} · {hoverMeta.x}, {hoverMeta.y}</span>}
      </div>
    </div>
  );
}
