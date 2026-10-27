import type { TileTerrain } from './types.ts';

// Base16 Isotope Dark Palette
// Author: Jan T. Sott
export const ISOTOPE = {
  base00: '#000000', // Default Background
  base01: '#101010', // Lighter Background (status bars, panels)
  base02: '#202020', // Selection Background / Borders
  base03: '#808080', // Comments, Dim text
  base04: '#c0c0c0', // Dark Foreground (secondary status)
  base05: '#d0d0d0', // Default Foreground (main body text)
  base06: '#e0e0e0', // Light Foreground
  base07: '#ffffff', // Bright White
  base08: '#ff0000', // Red (Alerts, Magma, Cancel)
  base09: '#ff9900', // Orange (Iron, Wood, Mining)
  base0A: '#ff0099', // Isotope Pink (Gold/Relics, Dwarves, Keybinds, Titles, Accents)
  base0B: '#33ff00', // Green (Grass, Trees, Food, Success)
  base0C: '#00ffff', // Cyan (Mithril, Water, Reticle, Telemetry)
  base0D: '#0066ff', // Blue (Stockpiles, Deep Water)
  base0E: '#cc00ff', // Magenta (Ale, Royal Decrees, Workshops)
  base0F: '#3300ff', // Violet/Indigo (Deep strata, Soil)
} as const;

// Neutral bedrock stays subdued so ore seams and colony activity stand out.
export const STONE_WALL_FOREGROUNDS: Partial<Record<TileTerrain, string>> = {
  ROCK_WALL: '#606060',
  LIMESTONE_WALL: '#707070',
  GRANITE_WALL: '#484848',
};
