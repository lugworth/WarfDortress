import type { CSSProperties } from 'react';
import type { SlotColors } from '@/lib/pixel/palette';
import { SPRITES, type SpriteName } from '@/lib/pixel/sprites';
import { spriteStripUrl, spriteUrl } from '@/lib/pixel/urls';

interface SpriteProps {
  name: SpriteName;
  /** CSS pixels per sprite pixel. */
  scale?: number;
  /** Accessible name. Without one the image is decorative. */
  label?: string;
  className?: string;
}

function a11y(label?: string) {
  return label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
}

/** A still sprite frame, drawn with crisp pixels. */
export function PixelIcon({ name, scale = 2, label, className = '', frame = 0 }: SpriteProps & { frame?: number }) {
  const def = SPRITES[name];
  const style: CSSProperties = {
    width: def.w * scale,
    height: def.h * scale,
    backgroundImage: `url(${spriteUrl(name, frame)})`,
  };
  return <span {...a11y(label)} className={`px-sprite ${className}`} style={style} />;
}

/** A looping sprite animation, stepped through with CSS so it costs no JavaScript per frame. */
export function PixelSprite({ name, scale = 3, label, className = '', slots, slotKey = '', playing = true }: SpriteProps & {
  slots?: SlotColors;
  slotKey?: string;
  playing?: boolean;
}) {
  const def = SPRITES[name];
  const frames = def.frames.length;
  const width = def.w * scale;
  const style = {
    width,
    height: def.h * scale,
    backgroundImage: `url(${spriteStripUrl(name, slots, slotKey)})`,
    '--frames': frames,
    '--w': `${width}px`,
    '--duration': `${(def.frameMs ?? 220) * frames}ms`,
  } as CSSProperties;
  return <span {...a11y(label)} className={`px-sprite px-sprite-strip ${frames > 1 && playing ? 'px-sprite-anim' : ''} ${className}`} style={style} />;
}
