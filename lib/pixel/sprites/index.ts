import type { SpriteDef } from '../sprite.ts';
import { CREATURE_SPRITES } from './creatures.ts';
import { EFFECT_SPRITES } from './effects.ts';
import { ICON_SPRITES } from './icons.ts';
import { TERRAIN_SPRITES } from './terrain.ts';

export const SPRITES = {
  ...TERRAIN_SPRITES,
  ...CREATURE_SPRITES,
  ...EFFECT_SPRITES,
  ...ICON_SPRITES,
} satisfies Record<string, SpriteDef>;

export type SpriteName = keyof typeof SPRITES;
