import { dwarfSlots } from './appearance';
import { spriteFrame } from './atlas';
import { hash01 } from './procedural';
import { frameAt } from './sprite';
import { SPRITES, type SpriteName } from './sprites';

const SKY = ['#0d0a12', '#150f1c', '#1b1522', '#241a33', '#2c1640', '#3a2052', '#5b2c7e'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const CARAVAN = ['dwarf-1', 'dwarf-2', 'dwarf-3', 'dwarf-4', 'dwarf-5'];

/**
 * The animated night scene behind the title screen: dithered sky, twinkling
 * stars, drifting mountains, a caravan of dwarves walking into a lit mountain
 * gate, a forge throwing sparks, and fireflies. Drawn at a low resolution and
 * scaled by a whole number so every pixel stays square.
 */
export class TitleScene {
  private sky: HTMLCanvasElement | null = null;
  private skyKey = '';

  draw(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, now: number, motion: boolean) {
    const s = Math.max(2, Math.round(viewH / 210));
    const W = Math.ceil(viewW / s);
    const H = Math.ceil(viewH / s);
    const t = motion ? now : 0;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(this.skyImage(W, H), 0, 0);
    this.stars(ctx, W, H, t);
    this.moon(ctx, W);
    this.mountains(ctx, W, H, t);

    const ground = H - 28;
    const gateX = Math.max(150, W - 40);
    this.fortress(ctx, W, ground, gateX, t);
    this.groundRow(ctx, W, H, ground, gateX);
    this.caravan(ctx, ground, gateX, t, motion);
    this.fireflies(ctx, W, ground, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private sprite(ctx: CanvasRenderingContext2D, name: SpriteName, x: number, y: number, t: number, phase = 0, slots?: ReturnType<typeof dwarfSlots>) {
    ctx.drawImage(spriteFrame(name, frameAt(SPRITES[name], t, phase), slots?.slots, slots?.key ?? ''), Math.round(x), Math.round(y));
  }

  /** A banded, ordered-dither gradient from deep night to a violet horizon. */
  private skyImage(W: number, H: number): HTMLCanvasElement {
    const key = `${W}x${H}`;
    if (this.sky && this.skyKey === key) return this.sky;
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const ctx = canvas.getContext('2d')!;
    const horizon = H * 0.78;
    for (let y = 0; y < H; y++) {
      const f = Math.min(1, y / horizon) * (SKY.length - 1);
      const band = Math.floor(f);
      const mix = f - band;
      for (let x = 0; x < W; x++) {
        const threshold = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
        ctx.fillStyle = SKY[Math.min(SKY.length - 1, band + (mix > threshold ? 1 : 0))];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    this.sky = canvas;
    this.skyKey = key;
    return canvas;
  }

  private stars(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
    const count = Math.floor((W * H) / 260);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(hash01(i, 1, 7) * W);
      const y = Math.floor(hash01(i, 2, 7) * H * 0.62);
      const twinkle = Math.sin(t / (500 + hash01(i, 3, 7) * 900) + i) > 0.6;
      const bright = hash01(i, 4, 7) > 0.85;
      ctx.fillStyle = twinkle ? '#fff0a0' : bright ? '#e8dfd0' : '#8f8191';
      ctx.fillRect(x, y, 1, 1);
      if (bright && twinkle) {
        ctx.fillStyle = 'rgba(255, 240, 160, 0.45)';
        ctx.fillRect(x - 1, y, 1, 1);
        ctx.fillRect(x + 1, y, 1, 1);
        ctx.fillRect(x, y - 1, 1, 1);
        ctx.fillRect(x, y + 1, 1, 1);
      }
    }
  }

  private moon(ctx: CanvasRenderingContext2D, W: number) {
    const cx = Math.floor(W * 0.2);
    const cy = 30;
    const r = 9;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (d > r * r) continue;
        const lit = (x + 3) * (x + 3) + (y - 2) * (y - 2) > 30 || x < -2;
        ctx.fillStyle = d > (r - 1) * (r - 1) ? '#b3a6ad' : lit ? '#fff0a0' : '#e8dfd0';
        ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
    ctx.fillStyle = '#d9b679';
    ctx.fillRect(cx - 3, cy - 2, 2, 2);
    ctx.fillRect(cx + 2, cy + 3, 2, 1);
    ctx.fillRect(cx - 1, cy + 4, 1, 1);
  }

  /** Two silhouette ranges that drift slowly for parallax. */
  private mountains(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
    const ranges = [
      { base: H * 0.62, height: 46, color: '#241a33', snow: '#524658', speed: 0.0015, seed: 3 },
      { base: H * 0.74, height: 38, color: '#1b1522', snow: '#3b3145', speed: 0.004, seed: 9 },
    ];
    for (const r of ranges) {
      const shift = t * r.speed;
      for (let x = 0; x < W; x++) {
        const u = x + shift;
        const h = r.height * (0.55 + 0.25 * Math.sin(u / 37 + r.seed) + 0.15 * Math.sin(u / 13 + r.seed * 2) + 0.05 * Math.sin(u / 5.3));
        const top = Math.round(r.base - h);
        ctx.fillStyle = r.color;
        ctx.fillRect(x, top, 1, H - top);
        if (h > r.height * 0.78) {
          ctx.fillStyle = r.snow;
          ctx.fillRect(x, top, 1, Math.max(1, Math.round((h - r.height * 0.78) / 2)));
        }
      }
    }
  }

  /** The clan's mountain: a cliff of rock tiles with a lit gate, windows, and a forge. */
  private fortress(ctx: CanvasRenderingContext2D, W: number, ground: number, gateX: number, t: number) {
    const left = gateX - 48;
    for (let x = left; x < W + 16; x += 16) {
      const rise = Math.min(6, Math.floor((x - left) / 16) + 2);
      for (let row = 0; row < rise; row++) {
        const y = ground - (row + 1) * 16;
        const top = row === rise - 1;
        ctx.drawImage(spriteFrame(top ? 'rock_top' : 'rock_front'), x, y);
        if (!top && hash01(x, row, 5) > 0.82) ctx.drawImage(spriteFrame('ore_gold'), x, y);
      }
    }
    // Gate, lanterns, and lit windows.
    this.sprite(ctx, 'door', gateX, ground - 16, t);
    this.sprite(ctx, 'door', gateX, ground - 32, t);
    const glow = ctx.createRadialGradient(gateX + 8, ground - 14, 2, gateX + 8, ground - 14, 34);
    glow.addColorStop(0, 'rgba(255, 142, 60, 0.32)');
    glow.addColorStop(1, 'rgba(255, 142, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(gateX - 30, ground - 50, 76, 60);
    for (const dx of [-7, 17]) this.sprite(ctx, 'fx_glow', gateX + dx, ground - 26, t, dx);
    for (let i = 0; i < 4; i++) {
      const wx = gateX + 24 + i * 22;
      const wy = ground - 44 - (i % 2) * 18;
      if (wx > W) break;
      const on = Math.sin(t / 900 + i * 2.1) > -0.7;
      ctx.fillStyle = '#0d0a12';
      ctx.fillRect(wx - 1, wy - 1, 6, 7);
      ctx.fillStyle = on ? '#ffd25e' : '#7a4f12';
      ctx.fillRect(wx, wy, 4, 5);
      ctx.fillStyle = on ? '#ff8e3c' : '#5a1620';
      ctx.fillRect(wx, wy + 3, 4, 2);
    }
    // A miner chipping at the cliff and a smith at the outdoor forge.
    this.sprite(ctx, 'dwarf_mine', left + 2, ground - 16, t, 0, dwarfSlots('dwarf-7'));
    this.sprite(ctx, 'forge', gateX - 30, ground - 16, t);
    this.sprite(ctx, 'dwarf_drink', gateX - 46, ground - 16, t, 1, dwarfSlots('dwarf-6'));
    for (let i = 0; i < 5; i++) {
      const age = ((t / 900 + i / 5) % 1);
      const sx = gateX - 24 + Math.sin(i * 7 + t / 300) * 3;
      const sy = ground - 14 - age * 26;
      ctx.fillStyle = age < 0.5 ? '#ffd25e' : '#ff8e3c';
      if (t) ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
    }
  }

  private groundRow(ctx: CanvasRenderingContext2D, W: number, H: number, ground: number, gateX: number) {
    for (let x = 0; x < W; x += 16) {
      ctx.drawImage(spriteFrame(`grass_${Math.floor(hash01(x, 0, 2) * 4)}` as SpriteName), x, ground);
      for (let y = ground + 16; y < H; y += 16) ctx.drawImage(spriteFrame('soil_top'), x, y);
    }
    for (let x = 4; x < gateX - 70; x += 18) {
      const pick = hash01(x, 1, 4);
      if (pick > 0.55) ctx.drawImage(spriteFrame(pick > 0.8 ? 'tree_oak' : 'tree_pine'), x, ground - 14);
      else if (pick > 0.35) ctx.drawImage(spriteFrame(pick > 0.45 ? 'shrub_berry' : 'shrub_fern'), x, ground - 6);
    }
  }

  /** Dwarves walk in from the left and vanish into the gate, forever. */
  private caravan(ctx: CanvasRenderingContext2D, ground: number, gateX: number, t: number, motion: boolean) {
    const span = gateX + 40;
    CARAVAN.forEach((id, i) => {
      const x = motion ? ((t * 0.018 + i * 26) % span) - 32 : gateX - 120 + i * 20;
      if (x > gateX - 4) return;
      this.sprite(ctx, i === 0 ? 'dwarf_helm_armed_walk' : 'dwarf_walk', x, ground - 16, t, i, dwarfSlots(id));
    });
  }

  private fireflies(ctx: CanvasRenderingContext2D, W: number, ground: number, t: number) {
    for (let i = 0; i < 14; i++) {
      const x = (hash01(i, 5, 3) * W + Math.sin(t / 1400 + i) * 12 + W) % W;
      const y = ground - 6 - hash01(i, 6, 3) * 40 + Math.sin(t / 900 + i * 3) * 4;
      if (Math.sin(t / 380 + i * 1.7) < 0.2) continue;
      ctx.fillStyle = '#fff2a8';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      ctx.fillStyle = 'rgba(200, 236, 138, 0.35)';
      ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
    }
  }
}
