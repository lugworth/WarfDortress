import type { DesignationType, DwarfEntity, GameState, HostileEntity, MilitiaSquad, Tile } from '../types';
import type { DesignationPreview, MapPoint } from '../ui-model';
import type { WeatherDescriptor } from '../weather';
import { dwarfSlots } from './appearance';
import { spriteFlash, spriteFrame } from './atlas';
import { TILE, visibleTiles, type Camera } from './camera';
import { hash01 } from './procedural';
import { frameAt } from './sprite';
import { SPRITES, type SpriteName } from './sprites';
import {
  ANIMATED_SPRITES,
  DESIGNATION_SPRITE,
  dwarfAnimation,
  dwarfSpriteName,
  HOSTILE_SPRITE,
  isWinter,
  tileLight,
  tileSprites,
  type TileSprites,
} from './tiles';

type GridLevel = Tile[][];
type Rect = { minX: number; minY: number; maxX: number; maxY: number };

export interface MapScene {
  state: GameState;
  z: number;
  /** performance.now() for animation. */
  now: number;
  /** Date.now(), which ping and stamp timestamps use. */
  wallNow: number;
  /** Milliseconds per simulation tick, for smoothing movement. */
  tickMs: number;
  weather: WeatherDescriptor;
  selection: (Rect & { z: number }) | null;
  preview: DesignationPreview | null;
  hover: { x: number; y: number; valid: boolean } | null;
  cursor: { x: number; y: number } | null;
  inspected: { x: number; y: number; z: number } | null;
  ping: { x: number; y: number; z: number; timestamp: number } | null;
  stamp: (Rect & { z: number; at: number }) | null;
  selectedDwarfId: string | null;
  squads: MilitiaSquad[];
  labels: MapPoint[] | null;
  reducedMotion: boolean;
  contrast: boolean;
  fontFamily: string;
}

interface LevelCache {
  level: GridLevel;
  winter: boolean;
  canvas: HTMLCanvasElement;
  animated: { x: number; y: number; sprites: TileSprites; phase: number }[];
  lights: { x: number; y: number; radius: number; warm: number; flicker: boolean }[];
  designated: Tile[];
  chimneys: { x: number; y: number }[];
}

interface Motion {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  z: number;
  start: number;
  dur: number;
  facing: 1 | -1;
  hp: number;
  flashUntil: number;
  spawnBucket: number;
  drawX: number;
  drawY: number;
  alive: boolean;
}

interface Particle {
  sprite?: SpriteName;
  text?: string;
  color?: string;
  size?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
}

const BACKDROP = '#0d0a12';
const ACCENT = '#f5c542';
const GOOD = '#6dd36a';
const DANGER = '#e0433b';
const INFO = '#5ec8e5';
const SMOKE = ['#6e6172', '#8f8191', '#524658'];

const DUSTY_TASKS = new Set<DesignationType>(['MINE', 'STAIRS', 'CHOP', 'GATHER', 'RECLAIM_RELIC']);

function within(x: number, y: number, v: { x0: number; y0: number; x1: number; y1: number }, margin = 0) {
  return x >= v.x0 - margin && x <= v.x1 + margin && y >= v.y0 - margin && y <= v.y1 + margin;
}

/**
 * Draws one z-level of the fortress. The static terrain is cached per level
 * array; because the simulation copies only the rows it changes, a level is
 * redrawn only after something on it changes. Creatures, effects, weather and
 * light are drawn every frame on top.
 */
export class MapRenderer {
  private levels = new Map<number, LevelCache>();
  private motions = new Map<string, Motion>();
  private particles: Particle[] = [];
  private lastFrame = 0;
  private light: HTMLCanvasElement | null = null;
  private glow: HTMLCanvasElement | null = null;
  private chimneyBuckets = new Map<string, number>();
  private fortressId = '';

  render(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, camera: Camera, scene: MapScene) {
    const { state, z, now } = scene;
    const level = state.grid[z];
    if (!level) return;
    if (state.id !== this.fortressId) {
      this.reset();
      this.fortressId = state.id;
    }
    const cols = state.world.width;
    const rows = state.world.height;
    const dt = this.lastFrame ? Math.min(100, now - this.lastFrame) : 16;
    this.lastFrame = now;
    const motion = !scene.reducedMotion;

    const cache = this.levelCache(level, z, isWinter(scene.weather.id), now, motion);
    const s = camera.scale;
    const ox = Math.round(-camera.x * s);
    const oy = Math.round(-camera.y * s);
    const vis = visibleTiles(camera, viewW, viewH, cols, rows);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BACKDROP;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.drawImage(cache.canvas, 0, 0);

    if (motion) this.drawAnimatedTiles(ctx, cache, vis, now);
    this.drawDesignations(ctx, cache, vis, now, motion);
    this.drawSquadOrders(ctx, scene, now, motion);
    this.drawCreatures(ctx, scene, level, vis, now, motion);
    if (motion) {
      this.spawnAmbient(cache, vis, now);
      this.drawParticles(ctx, now, dt, scene.fontFamily);
    }
    if (z === 0) this.drawSurfaceWeather(ctx, scene, vis, now, motion);
    else this.drawLighting(ctx, scene, cache, vis, now, motion);
    this.drawOverlays(ctx, scene, now, motion);

    if (scene.labels?.length) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.drawLabels(ctx, scene.labels, camera, viewW, viewH, scene.fontFamily);
    }
  }

  /** Forget cached terrain and motion, e.g. after loading another fortress. */
  reset() {
    this.levels.clear();
    this.motions.clear();
    this.particles = [];
    this.chimneyBuckets.clear();
  }

  // ------------------------------------------------------------- terrain ---

  private levelCache(level: GridLevel, z: number, winter: boolean, now: number, motion: boolean): LevelCache {
    const previous = this.levels.get(z);
    if (previous && previous.level === level && previous.winter === winter) return previous;

    const rows = level.length;
    const cols = level[0]?.length ?? 0;
    const canvas = previous && previous.canvas.width === cols * TILE && previous.canvas.height === rows * TILE
      ? previous.canvas
      : Object.assign(document.createElement('canvas'), { width: cols * TILE, height: rows * TILE });
    const ctx = canvas.getContext('2d')!;
    const sameCanvas = previous?.canvas === canvas && previous.winter === winter;
    const cache: LevelCache = { level, winter, canvas, animated: [], lights: [], designated: [], chimneys: [] };
    const weatherId = winter ? 'WINTER_SNOW' : undefined;

    for (let y = 0; y < rows; y++) {
      // Rows the simulation did not copy are unchanged; reuse their pixels.
      const reuse = sameCanvas && previous.level[y] === level[y] && previous.level[y + 1] === level[y + 1];
      for (let x = 0; x < cols; x++) {
        const tile = level[y][x];
        const sprites = tileSprites(tile, level[y + 1]?.[x], weatherId);
        if (!reuse) {
          ctx.drawImage(spriteFrame(sprites.base), x * TILE, y * TILE);
          if (sprites.overlay) ctx.drawImage(spriteFrame(sprites.overlay), x * TILE, y * TILE);
        }
        if (!tile.revealed) continue;
        if (ANIMATED_SPRITES.has(sprites.base) || (sprites.overlay && ANIMATED_SPRITES.has(sprites.overlay))) {
          cache.animated.push({ x, y, sprites, phase: hash01(x, y, z) * 4 });
        }
        const light = tileLight(tile.terrain);
        if (light) {
          cache.lights.push({ x, y, radius: light[0], warm: light[1], flicker: light[1] >= 0.4 });
        }
        if (tile.terrain === 'WORKSHOP_SMELTER' || tile.terrain === 'WORKSHOP_FORGE' || tile.terrain === 'WORKSHOP_STILL') cache.chimneys.push({ x, y });
        if (tile.designation) cache.designated.push(tile);
      }
      if (motion && previous && previous.level[y] !== level[y]) this.burstChanges(previous.level[y], level[y], now);
    }
    this.levels.set(z, cache);
    return cache;
  }

  /** Dust when rock is dug out; a shower of sparks when a building is finished. */
  private burstChanges(before: Tile[] | undefined, after: Tile[], now: number) {
    if (!before) return;
    for (let x = 0; x < after.length; x++) {
      const a = before[x];
      const b = after[x];
      if (!a || a.terrain === b.terrain || !b.revealed) continue;
      const cx = x * TILE + 8;
      const cy = b.y * TILE + 8;
      const built = b.terrain !== 'ROCK_FLOOR' && b.terrain !== 'GRASS' && b.terrain !== 'STAIRS_UP_DOWN';
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        this.particles.push({
          sprite: built ? 'fx_spark' : 'fx_dust',
          x: cx - 4 + Math.cos(angle) * 3,
          y: cy - 4 + Math.sin(angle) * 3,
          vx: Math.cos(angle) * 0.02,
          vy: Math.sin(angle) * 0.02 - 0.01,
          born: now + i * 20,
          life: 420,
        });
      }
    }
  }

  private drawAnimatedTiles(ctx: CanvasRenderingContext2D, cache: LevelCache, vis: ReturnType<typeof visibleTiles>, now: number) {
    for (const t of cache.animated) {
      if (!within(t.x, t.y, vis)) continue;
      const base = SPRITES[t.sprites.base];
      if (ANIMATED_SPRITES.has(t.sprites.base)) ctx.drawImage(spriteFrame(t.sprites.base, frameAt(base, now, t.phase)), t.x * TILE, t.y * TILE);
      if (t.sprites.overlay) ctx.drawImage(spriteFrame(t.sprites.overlay, frameAt(SPRITES[t.sprites.overlay], now, t.phase)), t.x * TILE, t.y * TILE);
    }
  }

  // -------------------------------------------------------- designations ---

  private drawDesignations(ctx: CanvasRenderingContext2D, cache: LevelCache, vis: ReturnType<typeof visibleTiles>, now: number, motion: boolean) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.lineDashOffset = motion ? -Math.floor(now / 90) % 4 : 0;
    for (const tile of cache.designated) {
      if (!tile.designation || !within(tile.x, tile.y, vis)) continue;
      const name = DESIGNATION_SPRITE[tile.designation];
      const def = SPRITES[name];
      const px = tile.x * TILE;
      const py = tile.y * TILE;
      ctx.fillStyle = 'rgba(245, 197, 66, 0.14)';
      ctx.fillRect(px, py, TILE, TILE);
      if (def.w === TILE) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(spriteFrame(name), px, py);
        ctx.globalAlpha = 1;
      } else {
        const bob = motion ? Math.floor(now / 320 + hash01(tile.x, tile.y, 3) * 2) % 2 : 0;
        ctx.drawImage(spriteFrame(name), px + (TILE - def.w) / 2, py + (TILE - def.h) / 2 - bob);
      }
      ctx.strokeStyle = tile.designation === 'CANCEL' ? DANGER : ACCENT;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    }
    ctx.restore();
  }

  private drawSquadOrders(ctx: CanvasRenderingContext2D, scene: MapScene, now: number, motion: boolean) {
    const bob = motion ? Math.floor(now / 400) % 2 : 0;
    for (const squad of scene.squads) {
      const order = squad.order;
      if (order.z !== scene.z || order.type === 'FOLLOW_DOCTRINE') continue;
      const ax = order.x * TILE;
      const ay = order.y * TILE;
      if (order.type === 'PATROL' && order.x2 !== undefined && order.y2 !== undefined) {
        ctx.save();
        ctx.strokeStyle = squad.color;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.lineDashOffset = motion ? -Math.floor(now / 60) % 6 : 0;
        ctx.beginPath();
        ctx.moveTo(ax + 8, ay + 8);
        ctx.lineTo(order.x2 * TILE + 8, order.y2 * TILE + 8);
        ctx.stroke();
        ctx.restore();
        ctx.drawImage(spriteFrame('icon_patrol'), order.x2 * TILE + 2, order.y2 * TILE + 2 - bob);
      }
      ctx.drawImage(spriteFrame(order.type === 'STATION' ? 'icon_station' : 'icon_patrol'), ax + 2, ay + 2 - bob);
    }
  }

  // ----------------------------------------------------------- creatures ---

  private track(id: string, x: number, y: number, z: number, hp: number, now: number, tickMs: number, motion: boolean): Motion {
    let m = this.motions.get(id);
    if (!m) {
      m = { fx: x, fy: y, tx: x, ty: y, z, start: now, dur: 1, facing: 1, hp, flashUntil: 0, spawnBucket: -1, drawX: x, drawY: y, alive: true };
      this.motions.set(id, m);
      return m;
    }
    if (m.tx !== x || m.ty !== y || m.z !== z) {
      const far = m.z !== z || Math.abs(m.tx - x) > 2 || Math.abs(m.ty - y) > 2;
      m.fx = far || !motion ? x : m.drawX;
      m.fy = far || !motion ? y : m.drawY;
      if (x !== m.tx) m.facing = x > m.tx ? 1 : -1;
      m.tx = x;
      m.ty = y;
      m.z = z;
      m.start = now;
      m.dur = Math.max(80, Math.min(tickMs, 600));
    }
    if (hp < m.hp) {
      m.flashUntil = now + 140;
      if (motion) {
        this.particles.push({ text: `-${m.hp - hp}`, color: DANGER, size: 7, x: x * TILE + 6, y: y * TILE - 2, vx: 0, vy: -0.018, born: now, life: 700 });
      }
    }
    m.hp = hp;
    const t = Math.min(1, (now - m.start) / m.dur);
    m.drawX = m.fx + (m.tx - m.fx) * t;
    m.drawY = m.fy + (m.ty - m.fy) * t;
    m.alive = true;
    return m;
  }

  private drawCreatures(ctx: CanvasRenderingContext2D, scene: MapScene, level: GridLevel, vis: ReturnType<typeof visibleTiles>, now: number, motion: boolean) {
    const { state, z } = scene;
    for (const m of this.motions.values()) m.alive = false;

    type Draw = { y: number; draw: () => void };
    const draws: Draw[] = [];

    for (const h of state.hostiles) {
      if (h.hp <= 0) continue;
      const m = this.track(`h:${h.id}`, h.x, h.y, h.z, h.hp, now, scene.tickMs, motion);
      if (h.z !== z || !level[h.y]?.[h.x]?.revealed || !within(h.x, h.y, vis, 1)) continue;
      draws.push({ y: m.drawY, draw: () => this.drawHostile(ctx, h, m, now, motion) });
    }
    for (const d of state.dwarves) {
      const m = this.track(`d:${d.id}`, d.x, d.y, d.z, d.hp, now, scene.tickMs, motion);
      if (d.z !== z || !level[d.y]?.[d.x]?.revealed || !within(d.x, d.y, vis, 1)) continue;
      draws.push({ y: m.drawY, draw: () => this.drawDwarf(ctx, d, m, scene, now, motion) });
    }
    draws.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

    // Departed creatures: a skull for a fallen dwarf, coins for a slain foe.
    for (const [id, m] of this.motions) {
      if (m.alive) continue;
      this.motions.delete(id);
      if (!motion || m.z !== z) continue;
      if (id.startsWith('d:')) {
        this.particles.push({ sprite: 'fx_skull', x: m.drawX * TILE + 4, y: m.drawY * TILE, vx: 0, vy: -0.006, born: now, life: 2200 });
      } else {
        for (let i = 0; i < 3; i++) {
          this.particles.push({ sprite: 'fx_coin', x: m.drawX * TILE + 4, y: m.drawY * TILE + 4, vx: (i - 1) * 0.02, vy: -0.05, born: now + i * 60, life: 650 });
        }
      }
    }
  }

  private drawShadow(ctx: CanvasRenderingContext2D, px: number, py: number) {
    ctx.fillStyle = 'rgba(13, 10, 18, 0.45)';
    ctx.fillRect(px + 4, py + 14, 8, 2);
    ctx.fillRect(px + 5, py + 13, 6, 1);
  }

  private blit(ctx: CanvasRenderingContext2D, image: CanvasImageSource, px: number, py: number, facing: 1 | -1) {
    if (facing > 0) {
      ctx.drawImage(image, px, py);
      return;
    }
    ctx.save();
    ctx.translate(px + TILE, py);
    ctx.scale(-1, 1);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }

  private drawHostile(ctx: CanvasRenderingContext2D, h: HostileEntity, m: Motion, now: number, motion: boolean) {
    const name = HOSTILE_SPRITE[h.kind];
    const def = SPRITES[name];
    const px = Math.round(m.drawX * TILE);
    const py = Math.round(m.drawY * TILE);
    const frame = motion ? frameAt(def, now, hash01(h.x, h.y, 1)) : 0;
    this.drawShadow(ctx, px, py);
    this.blit(ctx, now < m.flashUntil ? spriteFlash(name, frame) : spriteFrame(name, frame), px, py, m.facing);
    if (h.hp < h.maxHp) this.healthBar(ctx, px, py, h.hp / h.maxHp, DANGER);
  }

  private drawDwarf(ctx: CanvasRenderingContext2D, d: DwarfEntity, m: Motion, scene: MapScene, now: number, motion: boolean) {
    const moving = motion && (now - m.start) / m.dur < 1 && (m.fx !== m.tx || m.fy !== m.ty);
    const armed = Boolean(d.weaponEquipped && (d.labors.COMBAT || d.squadId));
    const anim = dwarfAnimation(d.state, armed, moving);
    const name = dwarfSpriteName(anim, Boolean(d.armorEquipped));
    const def = SPRITES[name];
    const { slots, key } = dwarfSlots(d.id);
    const frame = motion ? frameAt(def, now, hash01(d.x, d.y, 2) * 4) : 0;
    const px = Math.round(m.drawX * TILE);
    const py = Math.round(m.drawY * TILE);
    if (anim !== 'sleep') this.drawShadow(ctx, px, py);
    this.blit(ctx, now < m.flashUntil ? spriteFlash(name, frame, slots, key) : spriteFrame(name, frame, slots, key), px, py, m.facing);
    if (d.hp < d.maxHp * 0.7) this.healthBar(ctx, px, py, Math.max(0, d.hp) / d.maxHp, d.hp < d.maxHp * 0.35 ? DANGER : GOOD);

    if (scene.selectedDwarfId === d.id) {
      const bob = motion ? Math.floor(now / 250) % 2 : 0;
      ctx.fillStyle = ACCENT;
      ctx.fillRect(px + 5, py - 6 + bob, 6, 1);
      ctx.fillRect(px + 6, py - 5 + bob, 4, 1);
      ctx.fillRect(px + 7, py - 4 + bob, 2, 1);
    }
    if (anim === 'rage') ctx.drawImage(spriteFrame('fx_alert'), px + 8, py - 9 - (motion ? Math.floor(now / 150) % 2 : 0));

    if (!motion) return;
    const period = anim === 'mine' ? 300 : anim === 'sleep' ? 1300 : anim === 'pray' ? 700 : anim === 'drink' ? 900 : anim === 'fight' ? 360 : 0;
    if (!period) return;
    const bucket = Math.floor(now / period);
    if (bucket === m.spawnBucket) return;
    m.spawnBucket = bucket;
    const task = d.currentTask;
    if (anim === 'mine' && task && DUSTY_TASKS.has(task.type)) {
      this.particles.push({ sprite: 'fx_dust', x: task.x * TILE + 4, y: task.y * TILE + 6, vx: 0, vy: -0.004, born: now, life: 270 });
    } else if (anim === 'mine') {
      this.particles.push({ sprite: 'fx_spark', x: px + 10, y: py + 8, vx: 0.01, vy: -0.01, born: now, life: 160 });
    } else if (anim === 'sleep') {
      this.particles.push({ sprite: 'fx_zzz', x: px + 8, y: py, vx: 0.004, vy: -0.012, born: now, life: 1200 });
    } else if (anim === 'pray') {
      this.particles.push({ sprite: 'fx_glow', x: px + 4, y: py - 2, vx: 0, vy: -0.01, born: now, life: 700 });
    } else if (anim === 'drink') {
      this.particles.push({ sprite: 'fx_heart', x: px + 9, y: py - 2, vx: 0, vy: -0.015, born: now, life: 800 });
    } else if (anim === 'fight') {
      this.particles.push({ sprite: 'fx_slash', x: px + (m.facing > 0 ? 10 : -2), y: py + 4, vx: 0, vy: 0, born: now, life: 180 });
    }
  }

  private healthBar(ctx: CanvasRenderingContext2D, px: number, py: number, ratio: number, color: string) {
    ctx.fillStyle = '#0d0a12';
    ctx.fillRect(px + 2, py - 3, 12, 3);
    ctx.fillStyle = color;
    ctx.fillRect(px + 3, py - 2, Math.max(1, Math.round(10 * Math.max(0, Math.min(1, ratio)))), 1);
  }

  // ----------------------------------------------------------- particles ---

  private spawnAmbient(cache: LevelCache, vis: ReturnType<typeof visibleTiles>, now: number) {
    for (const c of cache.chimneys) {
      if (!within(c.x, c.y, vis)) continue;
      const key = `${c.x},${c.y}`;
      const bucket = Math.floor(now / 520 + hash01(c.x, c.y, 9) * 3);
      if (this.chimneyBuckets.get(key) === bucket) continue;
      this.chimneyBuckets.set(key, bucket);
      this.particles.push({
        color: SMOKE[bucket % SMOKE.length],
        size: 2,
        x: c.x * TILE + 6 + (bucket % 3),
        y: c.y * TILE + 1,
        vx: 0.003,
        vy: -0.012,
        born: now,
        life: 1100,
      });
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, now: number, dt: number, fontFamily: string) {
    const alive: Particle[] = [];
    for (const p of this.particles) {
      const age = now - p.born;
      if (age > p.life) continue;
      alive.push(p);
      if (age < 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const fade = Math.min(1, (p.life - age) / 250);
      ctx.globalAlpha = Math.max(0, fade);
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (p.sprite) {
        const def = SPRITES[p.sprite];
        const frame = def.frameMs ? Math.min(def.frames.length - 1, Math.floor(age / def.frameMs)) : 0;
        ctx.drawImage(spriteFrame(p.sprite, def.frames.length > 1 && p.sprite === 'fx_zzz' ? Math.floor(age / 600) % 2 : frame), x, y);
      } else if (p.text) {
        ctx.font = `${p.size ?? 8}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0d0a12';
        ctx.fillText(p.text, x + 1, y + 1);
        ctx.fillStyle = p.color ?? '#ffffff';
        ctx.fillText(p.text, x, y);
      } else {
        const size = (p.size ?? 1) + (age > p.life / 2 ? 1 : 0);
        ctx.fillStyle = p.color ?? '#ffffff';
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.globalAlpha = 1;
    this.particles = alive.length > 400 ? alive.slice(-400) : alive;
  }

  // ------------------------------------------------------ weather, light ---

  private drawSurfaceWeather(ctx: CanvasRenderingContext2D, scene: MapScene, vis: ReturnType<typeof visibleTiles>, now: number, motion: boolean) {
    const { weather } = scene;
    const x0 = vis.x0 * TILE;
    const y0 = vis.y0 * TILE;
    const w = (vis.x1 - vis.x0 + 1) * TILE;
    const h = (vis.y1 - vis.y0 + 1) * TILE;
    const tint: Record<string, string> = {
      'Slate (Summer)': 'rgba(255, 210, 120, 0.06)',
      'Sands (Autumn)': 'rgba(255, 142, 60, 0.07)',
      'Timber (Winter)': 'rgba(158, 227, 255, 0.08)',
    };
    const season = tint[scene.state.season];
    if (season) {
      ctx.fillStyle = season;
      ctx.fillRect(x0, y0, w, h);
    }
    if (!motion) return;
    const area = (w * h) / (TILE * TILE);
    if (weather.precipitation === 'RAIN') {
      ctx.fillStyle = 'rgba(79, 163, 221, 0.75)';
      const count = Math.floor(area * 0.6);
      for (let i = 0; i < count; i++) {
        const x = x0 + ((hash01(i, 1, 5) * w + now * 0.03) % w);
        const y = y0 + ((hash01(i, 2, 5) * h + now * (0.18 + hash01(i, 3, 5) * 0.08)) % h);
        ctx.fillRect(Math.round(x), Math.round(y), 1, 3);
      }
    } else if (weather.precipitation === 'SNOW' || weather.precipitation === 'BLIZZARD') {
      const blizzard = weather.precipitation === 'BLIZZARD';
      const count = Math.floor(area * (blizzard ? 1.4 : 0.5));
      ctx.fillStyle = '#e0fbff';
      for (let i = 0; i < count; i++) {
        const speed = 0.012 + hash01(i, 3, 6) * 0.02;
        const drift = blizzard ? now * 0.06 : Math.sin(now / 900 + i) * 6;
        const x = x0 + ((((hash01(i, 1, 6) * w + drift) % w) + w) % w);
        const y = y0 + ((hash01(i, 2, 6) * h + now * speed * (blizzard ? 3 : 1)) % h);
        const size = hash01(i, 4, 6) > 0.8 ? 2 : 1;
        ctx.fillRect(Math.round(x), Math.round(y), size, size);
      }
      if (blizzard) {
        ctx.fillStyle = 'rgba(224, 251, 255, 0.12)';
        ctx.fillRect(x0, y0, w, h);
      }
    } else if (weather.id === 'AUTUMN_MIST') {
      for (let band = 0; band < Math.ceil(h / 24); band++) {
        const y = y0 + band * 24 + Math.round(Math.sin(now / 2000 + band) * 4);
        ctx.fillStyle = `rgba(179, 166, 173, ${0.06 + (band % 2) * 0.04})`;
        ctx.fillRect(x0, y, w, 10);
      }
    }
  }

  private drawLighting(ctx: CanvasRenderingContext2D, scene: MapScene, cache: LevelCache, vis: ReturnType<typeof visibleTiles>, now: number, motion: boolean) {
    const PER = 4; // light-map pixels per tile, for chunky pixel-art falloff
    const cols = vis.x1 - vis.x0 + 1;
    const rows = vis.y1 - vis.y0 + 1;
    const lw = cols * PER;
    const lh = rows * PER;
    this.light ??= document.createElement('canvas');
    this.glow ??= document.createElement('canvas');
    for (const c of [this.light, this.glow]) {
      if (c.width !== lw) c.width = lw;
      if (c.height !== lh) c.height = lh;
    }
    const lctx = this.light.getContext('2d')!;
    const gctx = this.glow.getContext('2d')!;
    const darkness = Math.min(0.78, 0.5 + scene.z * 0.06);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lw, lh);
    lctx.fillStyle = `rgba(6, 4, 14, ${darkness})`;
    lctx.fillRect(0, 0, lw, lh);
    gctx.clearRect(0, 0, lw, lh);

    const sources = cache.lights.filter((l) => within(l.x, l.y, vis, 6)).map((l) => ({ ...l }));
    for (const d of scene.state.dwarves) {
      if (d.z === scene.z) {
        const m = this.motions.get(`d:${d.id}`);
        sources.push({ x: m?.drawX ?? d.x, y: m?.drawY ?? d.y, radius: 3.2, warm: 0.22, flicker: true });
      }
    }
    lctx.globalCompositeOperation = 'destination-out';
    gctx.globalCompositeOperation = 'lighter';
    for (const l of sources) {
      const flicker = motion && l.flicker ? Math.sin(now / 130 + l.x * 3 + l.y) * 0.12 + Math.sin(now / 57 + l.y) * 0.05 : 0;
      const r = (l.radius + flicker) * PER;
      const cx = (l.x - vis.x0 + 0.5) * PER;
      const cy = (l.y - vis.y0 + 0.5) * PER;
      const carve = lctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      carve.addColorStop(0, 'rgba(0,0,0,1)');
      carve.addColorStop(0.55, 'rgba(0,0,0,0.85)');
      carve.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = carve;
      lctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      if (l.warm > 0) {
        const warm = gctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.8);
        warm.addColorStop(0, `rgba(255, 142, 60, ${0.32 * l.warm})`);
        warm.addColorStop(1, 'rgba(255, 142, 60, 0)');
        gctx.fillStyle = warm;
        gctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.light, vis.x0 * TILE, vis.y0 * TILE, cols * TILE, rows * TILE);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.glow, vis.x0 * TILE, vis.y0 * TILE, cols * TILE, rows * TILE);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------ overlays ---

  private drawOverlays(ctx: CanvasRenderingContext2D, scene: MapScene, now: number, motion: boolean) {
    const { z } = scene;
    ctx.lineWidth = 1;

    if (scene.selection && scene.selection.z === z) {
      const s = scene.selection;
      if (scene.preview) {
        for (const cell of scene.preview.tiles) {
          ctx.fillStyle = cell.valid ? 'rgba(109, 211, 106, 0.28)' : 'rgba(224, 67, 59, 0.3)';
          ctx.fillRect(cell.x * TILE + 1, cell.y * TILE + 1, TILE - 2, TILE - 2);
          if (!cell.valid) {
            ctx.fillStyle = DANGER;
            for (let i = 4; i < 12; i++) {
              ctx.fillRect(cell.x * TILE + i, cell.y * TILE + i, 1, 1);
              ctx.fillRect(cell.x * TILE + 15 - i, cell.y * TILE + i, 1, 1);
            }
          }
        }
      }
      this.marchingAnts(ctx, s.minX * TILE, s.minY * TILE, (s.maxX - s.minX + 1) * TILE, (s.maxY - s.minY + 1) * TILE, ACCENT, now, motion);
    }

    if (scene.stamp && scene.stamp.z === z) {
      const age = scene.wallNow - scene.stamp.at;
      if (age < 320) {
        const s = scene.stamp;
        ctx.globalAlpha = 1 - age / 320;
        ctx.fillStyle = 'rgba(109, 211, 106, 0.35)';
        ctx.fillRect(s.minX * TILE, s.minY * TILE, (s.maxX - s.minX + 1) * TILE, (s.maxY - s.minY + 1) * TILE);
        ctx.globalAlpha = 1;
      }
    }

    if (scene.inspected && scene.inspected.z === z) this.brackets(ctx, scene.inspected.x, scene.inspected.y, '#d7a0ff', 0);
    if (scene.cursor) this.brackets(ctx, scene.cursor.x, scene.cursor.y, ACCENT, motion ? Math.floor(now / 300) % 2 : 0);
    if (scene.hover) this.brackets(ctx, scene.hover.x, scene.hover.y, scene.hover.valid ? GOOD : INFO, motion ? Math.floor(now / 400) % 2 : 0);

    if (scene.ping && scene.ping.z === z) {
      const age = scene.wallNow - scene.ping.timestamp;
      if (age < 1600) {
        const cx = scene.ping.x * TILE + 8;
        const cy = scene.ping.y * TILE + 8;
        for (let ring = 0; ring < 2; ring++) {
          const t = ((age / 800 + ring * 0.5) % 1);
          const r = Math.round(4 + t * 18);
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = INFO;
          ctx.strokeRect(cx - r + 0.5, cy - r + 0.5, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  private brackets(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, pulse: number) {
    const px = x * TILE - pulse;
    const py = y * TILE - pulse;
    const size = TILE + pulse * 2;
    const arm = 4;
    ctx.fillStyle = color;
    for (const [cx, cy, dx, dy] of [[px, py, 1, 1], [px + size - 1, py, -1, 1], [px, py + size - 1, 1, -1], [px + size - 1, py + size - 1, -1, -1]]) {
      ctx.fillRect(dx > 0 ? cx : cx - arm + 1, cy, arm, 1);
      ctx.fillRect(cx, dy > 0 ? cy : cy - arm + 1, 1, arm);
    }
  }

  private marchingAnts(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, now: number, motion: boolean) {
    ctx.save();
    ctx.strokeStyle = '#0d0a12';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.setLineDash([3, 3]);
    ctx.lineDashOffset = motion ? -Math.floor(now / 70) % 6 : 0;
    ctx.strokeStyle = color;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  private drawLabels(ctx: CanvasRenderingContext2D, points: MapPoint[], camera: Camera, viewW: number, viewH: number, fontFamily: string) {
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const size = Math.round(12 * dpr);
    ctx.font = `${size}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const taken: { x: number; y: number; w: number; h: number }[] = [];
    for (const point of points) {
      const sx = Math.round((point.x * TILE - camera.x) * camera.scale);
      const sy = Math.round((point.y * TILE - camera.y) * camera.scale);
      if (sx < -50 || sy < -50 || sx > viewW || sy > viewH) continue;
      const label = point.label.length > 22 ? `${point.label.slice(0, 21)}…` : point.label;
      const w = Math.ceil(ctx.measureText(label).width) + 8 * dpr;
      const h = size + 6 * dpr;
      const x = Math.max(0, Math.min(viewW - w, sx + TILE * camera.scale));
      const y = Math.max(0, sy - h);
      if (taken.some((b) => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y)) continue;
      taken.push({ x, y, w, h });
      ctx.fillStyle = 'rgba(13, 10, 18, 0.88)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = point.kind === 'HOSTILE' ? DANGER : ACCENT;
      ctx.fillRect(x, y + h - 2 * dpr, w, 2 * dpr);
      ctx.fillStyle = '#f4ecd8';
      ctx.fillText(label, x + 4 * dpr, y + h / 2 - dpr);
    }
  }
}
