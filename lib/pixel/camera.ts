/** Pixels per tile in sprite space. */
export const TILE = 16;

/**
 * x and y are the world-pixel coordinates at the viewport's top-left corner;
 * scale is device pixels per world pixel.
 */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

/** Map zoom presets in percent of one sprite pixel per CSS pixel. */
export const ZOOM_STEPS = [100, 150, 200, 300, 400] as const;

/**
 * Device-pixel scale for a zoom preference. Integer scales keep every sprite
 * pixel the same size; only a "fit" view of a map larger than the screen falls
 * back to a fractional scale.
 */
export function scaleFor(zoom: number | 'fit', dpr: number, viewW: number, viewH: number, worldW: number, worldH: number): number {
  if (zoom === 'fit') {
    const fit = Math.min(viewW / worldW, viewH / worldH);
    return fit >= 1 ? Math.floor(fit) : fit;
  }
  return Math.max(1, Math.round((zoom / 100) * dpr));
}

/** Keeps the world on screen; a world smaller than the viewport is centered. */
export function clampCamera(camera: Camera, viewW: number, viewH: number, worldW: number, worldH: number): Camera {
  const visibleW = viewW / camera.scale;
  const visibleH = viewH / camera.scale;
  const axis = (pos: number, visible: number, world: number) =>
    visible >= world ? (world - visible) / 2 : Math.min(Math.max(pos, 0), world - visible);
  return { ...camera, x: axis(camera.x, visibleW, worldW), y: axis(camera.y, visibleH, worldH) };
}

/** Camera centered on a tile. */
export function centerOn(tileX: number, tileY: number, scale: number, viewW: number, viewH: number): Camera {
  return {
    x: (tileX + 0.5) * TILE - viewW / scale / 2,
    y: (tileY + 0.5) * TILE - viewH / scale / 2,
    scale,
  };
}

/** Changes scale while keeping the world point under (screenX, screenY) fixed. */
export function zoomAround(camera: Camera, scale: number, screenX: number, screenY: number): Camera {
  const worldX = camera.x + screenX / camera.scale;
  const worldY = camera.y + screenY / camera.scale;
  return { x: worldX - screenX / scale, y: worldY - screenY / scale, scale };
}

/** Tile under a device-pixel point, or null outside the world. */
export function tileAt(camera: Camera, screenX: number, screenY: number, cols: number, rows: number): { x: number; y: number } | null {
  const x = Math.floor((camera.x + screenX / camera.scale) / TILE);
  const y = Math.floor((camera.y + screenY / camera.scale) / TILE);
  return x >= 0 && y >= 0 && x < cols && y < rows ? { x, y } : null;
}

/** Inclusive range of tiles at least partly visible. */
export function visibleTiles(camera: Camera, viewW: number, viewH: number, cols: number, rows: number) {
  return {
    x0: Math.max(0, Math.floor(camera.x / TILE)),
    y0: Math.max(0, Math.floor(camera.y / TILE)),
    x1: Math.min(cols - 1, Math.floor((camera.x + viewW / camera.scale) / TILE)),
    y1: Math.min(rows - 1, Math.floor((camera.y + viewH / camera.scale) / TILE)),
  };
}

/** Next zoom step in a direction from the current device scale. */
export function stepZoom(current: number | 'fit', direction: 1 | -1, scale: number, dpr: number): number {
  const percent = current === 'fit' ? (scale / dpr) * 100 : current;
  const steps = [...ZOOM_STEPS];
  if (direction > 0) return steps.find((s) => s > percent + 1) ?? steps[steps.length - 1];
  return [...steps].reverse().find((s) => s < percent - 1) ?? steps[0];
}
